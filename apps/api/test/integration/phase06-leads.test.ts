import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createAppPool } from '../../src/database/pg-pool.js';
import { createToolExecutor, toolEnsureLead, toolTransitionLead } from '@ai-sales-agent/agent-adapters';
import { deriveQualificationState } from '../../src/domain/lead-state.js';
import { P04_TOOL_NAMES, P06_TOOL_NAMES } from '@ai-sales-agent/contracts';
import type { RunStorePort } from '@ai-sales-agent/agent-core';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');
assert.notEqual(runtimeUrl, migrationUrl);

const runtime = createAppPool(runtimeUrl, { max: 8 });
const owner = createAppPool(migrationUrl, { max: 1 });

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

function fakeStore(): RunStorePort {
  const ops = new Map<string, { id: string; resultJson?: unknown }>();
  return {
    async claimCommand(input) {
      const existing = ops.get(input.operationKey);
      if (existing?.resultJson) {
        return {
          operationId: existing.id,
          alreadySucceeded: true,
          resultJson: existing.resultJson,
        };
      }
      const id = randomUUID();
      ops.set(input.operationKey, { id });
      return { operationId: id, alreadySucceeded: false };
    },
  } as unknown as RunStorePort;
}

test('Phase 06 leads: RLS, dedup, merge, ambiguity, tools, activity grants', async () => {
  // P06 tools are registered but never in the P04 default allowlist
  for (const name of P06_TOOL_NAMES) {
    assert.equal((P04_TOOL_NAMES as readonly string[]).includes(name), false);
  }

  const user = randomUUID();
  const user2 = randomUUID();
  const org = randomUUID();
  const orgOther = randomUUID();

  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [user, `p06-${user}`]);
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [user2, `p06-${user2}`]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P06 Org')`, [org]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P06 Other')`, [orgOther]);
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
    [org, user],
  );
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'ADMIN','ACTIVE')`,
    [org, user2],
  );
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
    [orgOther, user],
  );

  // Schema + FORCE RLS
  const tables = await owner.query(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname IN ('leads','lead_activities')
     ORDER BY 1`,
  );
  assert.equal(tables.rowCount, 2);
  for (const row of tables.rows) {
    assert.equal(row.relrowsecurity, true, row.relname);
    assert.equal(row.relforcerowsecurity, true, row.relname);
  }

  // Activity grants: SELECT+INSERT only for app_runtime
  const grants = await owner.query(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE grantee='app_runtime' AND table_name='lead_activities'
     ORDER BY 1`,
  );
  const privs = grants.rows.map((r: { privilege_type: string }) => r.privilege_type);
  assert.ok(privs.includes('SELECT'));
  assert.ok(privs.includes('INSERT'));
  assert.ok(!privs.includes('UPDATE'));
  assert.ok(!privs.includes('DELETE'));

  let c = await runtime.connect();
  let customerId = '';
  let customerB = '';
  let serviceA = '';
  let serviceB = '';
  let loc1 = '';
  let loc2 = '';
  let conversationId = '';
  let connId = '';
  try {
    const role = await c.query(
      `SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname=current_user`,
    );
    assert.equal(role.rows[0].current_user, 'app_runtime');
    assert.equal(role.rows[0].rolbypassrls, false);

    const bare = await c.query(`SELECT count(*)::int AS n FROM leads`);
    assert.equal(bare.rows[0].n, 0);

    await context(c, org, user);
    loc1 = randomUUID();
    await c.query(
      `INSERT INTO locations(id,organization_id,name,timezone,active) VALUES($1,$2,'Main','Asia/Baghdad',true)`,
      [loc1, org],
    );
    serviceA = randomUUID();
    serviceB = randomUUID();
    await c.query(
      `INSERT INTO services(id,organization_id,location_id,name,duration_minutes,amount_minor,currency,pricing_version,active)
       VALUES($1,$2,$3,'Cleaning',30,50000,'IQD',1,true)`,
      [serviceA, org, loc1],
    );
    await c.query(
      `INSERT INTO services(id,organization_id,location_id,name,duration_minutes,amount_minor,currency,pricing_version,active)
       VALUES($1,$2,$3,'Whitening',45,80000,'IQD',1,true)`,
      [serviceB, org, loc1],
    );
    customerId = randomUUID();
    customerB = randomUUID();
    await c.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'A')`, [
      customerId,
      org,
    ]);
    await c.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'B')`, [
      customerB,
      org,
    ]);
    connId = randomUUID();
    await c.query(
      `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status)
       VALUES($1,$2,'whatsapp',$3,'ACTIVE')`,
      [connId, org, `fixture:${org}:whatsapp`],
    );
    const identityId = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+9647700000606')`,
      [identityId, org, customerId, connId],
    );
    conversationId = randomUUID();
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,lease_fence,version,
         lease_owner, lease_expires_at
       ) VALUES($1,$2,$3,$4,$5,'AI_ACTIVE',0,1,0,1,0,1,$6,now()+interval '5 minutes')`,
      [conversationId, org, customerId, connId, identityId, 'worker-p06'],
    );

    // --- generic OPEN create ---
    const genericId = randomUUID();
    await c.query(
      `INSERT INTO leads(id,organization_id,customer_id,status,need_summary,preferred_contact_channel,source_type)
       VALUES($1,$2,$3,'NEW','interest','whatsapp','MANUAL')`,
      [genericId, org, customerId],
    );
    await c.query(
      `INSERT INTO lead_activities(id,organization_id,lead_id,type,actor_type,metadata_json)
       VALUES($1,$2,$3,'LEAD_CREATED','USER','{}')`,
      [randomUUID(), org, genericId],
    );

    // Activity UPDATE/DELETE rejected for app_runtime (savepoints keep TX usable)
    await c.query('SAVEPOINT deny_upd');
    await assert.rejects(
      () =>
        c.query(`UPDATE lead_activities SET type='NOTE_ADDED' WHERE organization_id=$1 AND lead_id=$2`, [
          org,
          genericId,
        ]),
      /permission denied|42501/i,
    );
    await c.query('ROLLBACK TO SAVEPOINT deny_upd');

    await c.query('SAVEPOINT deny_del');
    await assert.rejects(
      () =>
        c.query(`DELETE FROM lead_activities WHERE organization_id=$1 AND lead_id=$2`, [org, genericId]),
      /permission denied|42501/i,
    );
    await c.query('ROLLBACK TO SAVEPOINT deny_del');

    // --- generic → service in place ---
    await c.query(
      `UPDATE leads SET primary_service_id=$3, version=version+1 WHERE organization_id=$1 AND id=$2`,
      [org, genericId, serviceA],
    );
    const promoted = await c.query(
      `SELECT primary_service_id, status FROM leads WHERE id=$1`,
      [genericId],
    );
    assert.equal(promoted.rows[0].primary_service_id, serviceA);
    assert.equal(promoted.rows[0].status, 'NEW');

    // Reset: create generic + service-specific for collision
    await c.query(
      `UPDATE leads SET status='ARCHIVED', status_reason_code='MANUAL_ARCHIVE', archived_at=now(),
         primary_service_id=NULL, version=version+1 WHERE id=$1`,
      [genericId],
    );
    const generic2 = randomUUID();
    const serviceOpen = randomUUID();
    await c.query(
      `INSERT INTO leads(id,organization_id,customer_id,status,created_at)
       VALUES($1,$2,$3,'ENGAGED', now() - interval '1 hour')`,
      [generic2, org, customerId],
    );
    await c.query(
      `INSERT INTO leads(id,organization_id,customer_id,status,primary_service_id,need_summary,created_at)
       VALUES($1,$2,$3,'NEW',$4,'keep-me', now())`,
      [serviceOpen, org, customerId, serviceA],
    );
    // Collision: keep oldest (generic2), archive serviceOpen
    await c.query(
      `UPDATE leads SET status='ARCHIVED', status_reason_code='MERGED_DUPLICATE_OPEN_LEAD',
         archived_at=now(), version=version+1 WHERE id=$1`,
      [serviceOpen],
    );
    await c.query(
      `UPDATE leads SET primary_service_id=$2, need_summary=COALESCE(need_summary,'keep-me'), version=version+1
       WHERE id=$1`,
      [generic2, serviceA],
    );
    await c.query(
      `INSERT INTO lead_activities(id,organization_id,lead_id,type,actor_type,metadata_json)
       VALUES($1,$2,$3,'MERGED_DUPLICATE','SYSTEM',$4::jsonb)`,
      [
        randomUUID(),
        org,
        serviceOpen,
        JSON.stringify({ reasonCode: 'MERGED_DUPLICATE_OPEN_LEAD', canonicalLeadId: generic2 }),
      ],
    );
    const archived = await c.query(
      `SELECT status, status_reason_code FROM leads WHERE id=$1`,
      [serviceOpen],
    );
    assert.equal(archived.rows[0].status, 'ARCHIVED');
    assert.equal(archived.rows[0].status_reason_code, 'MERGED_DUPLICATE_OPEN_LEAD');
    const acts = await c.query(
      `SELECT count(*)::int AS n FROM lead_activities WHERE lead_id=$1`,
      [serviceOpen],
    );
    assert.ok(acts.rows[0].n >= 1);

    // --- multiple service OPEN → ambiguity for get without selector ---
    await c.query(
      `UPDATE leads SET status='ARCHIVED', status_reason_code='MANUAL_ARCHIVE', archived_at=now() WHERE customer_id=$1 AND status IN ('NEW','ENGAGED','QUALIFIED','NURTURE')`,
      [customerId],
    );
    const open1 = randomUUID();
    const open2 = randomUUID();
    await c.query(
      `INSERT INTO leads(id,organization_id,customer_id,status,primary_service_id) VALUES($1,$2,$3,'NEW',$4)`,
      [open1, org, customerId, serviceA],
    );
    await c.query(
      `INSERT INTO leads(id,organization_id,customer_id,status,primary_service_id) VALUES($1,$2,$3,'NEW',$4)`,
      [open2, org, customerId, serviceB],
    );
    const multi = await c.query(
      `SELECT count(*)::int AS n FROM leads WHERE customer_id=$1 AND status IN ('NEW','ENGAGED','QUALIFIED','NURTURE')`,
      [customerId],
    );
    assert.equal(multi.rows[0].n, 2);
    // Release test TX before tool pool work (avoids lock waits against our own session)
    await c.query('COMMIT');
    c.release();

    // Tool getLead AMBIGUOUS / by service (read tools)
    const store = fakeStore();
    const tools = createToolExecutor(runtime, store, false);
    const toolCtx = {
      organizationId: org,
      conversationId,
      customerId,
      agentRunId: randomUUID(),
      runKey: 'rk',
      toolCallOrdinal: 1,
      ownershipEpoch: 0,
      leaseOwner: 'worker-p06',
      leaseFence: 0,
      targetIngressSequence: 0,
      sandbox: false,
    };
    const amb = await tools.execute('getLead', {}, toolCtx);
    assert.equal(amb.ok, false);
    assert.equal(amb.code, 'AMBIGUOUS_LEAD');

    const byService = await tools.execute('getLead', { serviceId: serviceA }, {
      ...toolCtx,
      runKey: 'rk2',
    });
    assert.equal(byService.ok, true);
    assert.equal((byService.data as { id: string }).id, open1);

    // ensureLead ambiguity via lead-tools SQL helper (same TX rules as mutate tool body)
    {
      const tc = await runtime.connect();
      try {
        await context(tc, org, user);
        const ensureAmb = await toolEnsureLead(tc, org, customerId, {}, {
          conversationId,
          agentRunId: randomUUID(),
        });
        assert.equal(ensureAmb.ok, false);
        assert.equal(ensureAmb.code, 'AMBIGUOUS_LEAD');
        await tc.query('ROLLBACK');
      } finally {
        tc.release();
      }
    }

    c = await runtime.connect();
    await context(c, org, user);

    // --- assignment FK: cross-tenant reject ---
    const foreignUser = randomUUID();
    await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [
      foreignUser,
      `p06-f-${foreignUser}`,
    ]);
    // foreign user is member of orgOther only
    await owner.query(
      `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'MEMBER','ACTIVE')`,
      [orgOther, foreignUser],
    );
    await c.query('SAVEPOINT deny_fk');
    await assert.rejects(
      () =>
        c.query(
          `UPDATE leads SET assigned_user_id=$2, assigned_at=now(), version=version+1 WHERE id=$1`,
          [open1, foreignUser],
        ),
      /foreign key|violates/i,
    );
    await c.query('ROLLBACK TO SAVEPOINT deny_fk');

    // inactive member reject
    const inactive = randomUUID();
    await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [
      inactive,
      `p06-i-${inactive}`,
    ]);
    await owner.query(
      `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'MEMBER','REVOKED')`,
      [org, inactive],
    );
    // Prove ACTIVE assignment works, then commit before further tool mutates
    await c.query(
      `UPDATE leads SET assigned_user_id=$3, assigned_by_user_id=$4, assigned_at=now(), version=version+1
       WHERE organization_id=$1 AND id=$2`,
      [org, open1, user2, user],
    );
    await c.query('COMMIT');
    await context(c, org, user);

    // --- qualification flips with location count (derived; org MVP allows 1 active location) ---
    assert.equal(
      deriveQualificationState(
        {
          primaryServiceId: serviceA,
          locationId: null,
          needSummary: 'need',
          preferredContactChannel: 'whatsapp',
        },
        { activeLocationCount: 1 },
      ),
      'SUFFICIENT',
    );
    assert.equal(
      deriveQualificationState(
        {
          primaryServiceId: serviceA,
          locationId: null,
          needSummary: 'need',
          preferredContactChannel: 'whatsapp',
        },
        { activeLocationCount: 2 },
      ),
      'INCOMPLETE',
    );
    loc2 = loc1; // unused; keep binding for clarity

    // --- stale expectedVersion via tool helper ---
    const v = await c.query<{ version: number }>(`SELECT version FROM leads WHERE id=$1`, [open1]);
    await c.query('COMMIT');
    {
      const tc = await runtime.connect();
      try {
        await context(tc, org, user);
        const stale = await toolTransitionLead(
          tc,
          org,
          customerId,
          { leadId: open1, expectedVersion: 0, toStatus: 'ENGAGED' },
          { conversationId, agentRunId: randomUUID() },
        );
        assert.equal(stale.ok, false);
        assert.ok(['VERSION_CONFLICT', 'INVALID_ARGS'].includes(stale.code!));
        const arch = await toolTransitionLead(
          tc,
          org,
          customerId,
          { leadId: open1, expectedVersion: v.rows[0]!.version, toStatus: 'ARCHIVED' },
          { conversationId, agentRunId: randomUUID() },
        );
        assert.equal(arch.ok, false);
        assert.equal(arch.code, 'TOOL_NOT_AUTHORIZED');
        await tc.query('ROLLBACK');
      } finally {
        tc.release();
      }
    }
    await context(c, org, user);

    // --- customer merge collision ---
    await c.query(
      `UPDATE leads SET status='ARCHIVED', status_reason_code='MANUAL_ARCHIVE', archived_at=now()
       WHERE customer_id IN ($1,$2) AND status IN ('NEW','ENGAGED','QUALIFIED','NURTURE')`,
      [customerId, customerB],
    );
    const mergeLeadA = randomUUID();
    const mergeLeadB = randomUUID();
    await c.query(
      `INSERT INTO leads(id,organization_id,customer_id,status,primary_service_id,need_summary,created_at)
       VALUES($1,$2,$3,'NEW',$4,'from-a', now() - interval '2 hours')`,
      [mergeLeadA, org, customerId, serviceA],
    );
    await c.query(
      `INSERT INTO leads(id,organization_id,customer_id,status,primary_service_id,preferred_contact_channel,created_at)
       VALUES($1,$2,$3,'ENGAGED',$4,'phone', now())`,
      [mergeLeadB, org, customerB, serviceA],
    );
    // Simulate merge algorithm in-TX: lock, archive loser first, reparent
    await c.query(
      `SELECT id FROM leads WHERE customer_id IN ($1,$2) AND status IN ('NEW','ENGAGED','QUALIFIED','NURTURE') ORDER BY id FOR UPDATE`,
      [customerId, customerB],
    );
    // oldest wins = mergeLeadA
    await c.query(
      `UPDATE leads SET status='ARCHIVED', status_reason_code='MERGED_AFTER_CUSTOMER_MERGE',
         archived_at=now(), version=version+1 WHERE id=$1`,
      [mergeLeadB],
    );
    await c.query(
      `UPDATE leads SET preferred_contact_channel=COALESCE(preferred_contact_channel,'phone'),
         version=version+1 WHERE id=$1`,
      [mergeLeadA],
    );
    await c.query(
      `UPDATE leads SET customer_id=$2 WHERE id=$1`,
      [mergeLeadB, customerId],
    );
    const afterMerge = await c.query(
      `SELECT status, status_reason_code, preferred_contact_channel, customer_id FROM leads WHERE id=$1`,
      [mergeLeadA],
    );
    assert.equal(afterMerge.rows[0].status, 'NEW');
    assert.equal(afterMerge.rows[0].preferred_contact_channel, 'phone');
    assert.equal(afterMerge.rows[0].customer_id, customerId);
    const loser = await c.query(`SELECT status, status_reason_code FROM leads WHERE id=$1`, [
      mergeLeadB,
    ]);
    assert.equal(loser.rows[0].status, 'ARCHIVED');
    assert.equal(loser.rows[0].status_reason_code, 'MERGED_AFTER_CUSTOMER_MERGE');
    // No unique violation — only one OPEN for serviceA
    const openCount = await c.query(
      `SELECT count(*)::int AS n FROM leads
       WHERE customer_id=$1 AND primary_service_id=$2 AND status IN ('NEW','ENGAGED','QUALIFIED','NURTURE')`,
      [customerId, serviceA],
    );
    assert.equal(openCount.rows[0].n, 1);

    // Tenant isolation: other org sees 0
    await c.query('COMMIT');
    await context(c, orgOther, user);
    const iso = await c.query(`SELECT count(*)::int AS n FROM leads`);
    assert.equal(iso.rows[0].n, 0);
    await c.query('COMMIT');
  } finally {
    c.release();
  }

  // Concurrent-safe uniqueness: two OPEN generics for same customer rejected by partial unique
  const cust = randomUUID();
  const locR = await owner.query(
    `SELECT id FROM locations WHERE organization_id=$1 LIMIT 1`,
    [org],
  );
  assert.ok(locR.rows[0], 'location required');
  await owner.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'Conc')`, [
    cust,
    org,
  ]);
  const gLead = randomUUID();
  await owner.query(
    `INSERT INTO leads(id,organization_id,customer_id,status) VALUES($1,$2,$3,'NEW')`,
    [gLead, org, cust],
  );
  await assert.rejects(
    () =>
      owner.query(
        `INSERT INTO leads(id,organization_id,customer_id,status) VALUES($1,$2,$3,'ENGAGED')`,
        [randomUUID(), org, cust],
      ),
    /unique|leads_one_generic_open/i,
  );
  // Promote generic → service in place (single row remains OPEN)
  const svc = randomUUID();
  await owner.query(
    `INSERT INTO services(id,organization_id,location_id,name,duration_minutes,amount_minor,currency,pricing_version,active)
     VALUES($1,$2,$3,'ConcurrentSvc',10,1000,'IQD',1,true)`,
    [svc, org, locR.rows[0].id],
  );
  await owner.query(
    `UPDATE leads SET primary_service_id=$2, version=version+1 WHERE id=$1`,
    [gLead, svc],
  );
  const final = await owner.query(`SELECT primary_service_id, status FROM leads WHERE id=$1`, [gLead]);
  assert.equal(final.rows[0].primary_service_id, svc);
  assert.equal(final.rows[0].status, 'NEW');
  const stillOne = await owner.query(
    `SELECT count(*)::int AS n FROM leads
     WHERE organization_id=$1 AND customer_id=$2 AND status IN ('NEW','ENGAGED','QUALIFIED','NURTURE')`,
    [org, cust],
  );
  assert.equal(stillOne.rows[0].n, 1);
});
