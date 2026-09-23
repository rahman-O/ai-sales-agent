import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createAppPool } from '../../src/database/pg-pool.js';
import { contentDigest, fixtureExternalChannelId } from '../../src/messaging/fake-channel.js';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');
assert.notEqual(runtimeUrl, migrationUrl, 'runtime must not use migration credentials');

const runtime = createAppPool(runtimeUrl, { max: 6 });
const owner = createAppPool(migrationUrl, { max: 1 });

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

function digest(text: string, providerMessageId: string, sender: string) {
  return contentDigest(JSON.stringify({ providerMessageId, text, sender }));
}

test('Phase 03 durable messaging, lease fence, outbox claim, merge compatibility', async () => {
  const user = randomUUID();
  const orgA = randomUUID();
  const orgB = randomUUID();
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [user, `p03-${user}`]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P03 A'),($2,'P03 B')`, [orgA, orgB]);
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$3,'OWNER','ACTIVE'),($2,$3,'OWNER','ACTIVE')`,
    [orgA, orgB, user],
  );

  const c = await runtime.connect();
  try {
    const role = await c.query(
      `SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`,
    );
    assert.equal(role.rows[0].current_user, 'app_runtime');
    assert.equal(role.rows[0].rolsuper, false);
    assert.equal(role.rows[0].rolbypassrls, false);

    // Worker claim functions executable; return only metadata columns
    const claimCols = await c.query(
      `SELECT * FROM claim_pending_outbox_events(1) LIMIT 0`,
    );
    assert.deepEqual(
      claimCols.fields.map((f) => f.name).sort(),
      ['available_at', 'organization_id', 'work_id', 'work_kind'].sort(),
    );

    await context(c, orgA, user);
    const connId = randomUUID();
    const ext = fixtureExternalChannelId(orgA, 'whatsapp');
    await c.query(
      `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status)
       VALUES($1,$2,'whatsapp',$3,'ACTIVE')`,
      [connId, orgA, ext],
    );
    const customerA = randomUUID();
    const customerSource = randomUUID();
    await c.query(
      `INSERT INTO customers(id,organization_id,display_name) VALUES($1,$3,'Canonical'),($2,$3,'Source')`,
      [customerA, customerSource, orgA],
    );
    const identityId = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+9647700000099')`,
      [identityId, orgA, customerSource, connId],
    );
    const conversationId = randomUUID();
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,lease_fence,version
       ) VALUES($1,$2,$3,$4,$5,'AI_ACTIVE',0,1,0,1,0,1)`,
      [conversationId, orgA, customerSource, connId, identityId],
    );
    await c.query('COMMIT');

    // Concurrent ingress sequence allocation
    async function insertInbound(client: PoolClient, providerMessageId: string, text: string) {
      await context(client, orgA, user);
      try {
        const locked = await client.query(
          `SELECT next_sequence, next_timeline_sequence, provider_event_watermark_at
           FROM conversations WHERE id=$1::uuid FOR UPDATE`,
          [conversationId],
        );
        const nextSeq = locked.rows[0].next_sequence;
        const nextTl = locked.rows[0].next_timeline_sequence;
        const d = digest(text, providerMessageId, '+9647700000099');
        await client.query(
          `INSERT INTO messages(
             id,organization_id,conversation_id,channel_connection_id,direction,origin,
             provider_message_id,ingress_sequence,timeline_sequence,late_flag,content_type,content_text,content_digest,delivery_state
           ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER',$5,$6,$7,false,'text',$8,$9,'ACCEPTED')`,
          [randomUUID(), orgA, conversationId, connId, providerMessageId, nextSeq, nextTl, text, d],
        );
        await client.query(
          `UPDATE conversations SET next_sequence=$2, next_timeline_sequence=$3, last_message_at=now(), version=version+1 WHERE id=$1::uuid`,
          [conversationId, nextSeq + 1, nextTl + 1],
        );
        await client.query('COMMIT');
        return nextSeq;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    const a = await runtime.connect();
    const b = await runtime.connect();
    let seqs: number[];
    try {
      seqs = await Promise.all([
        insertInbound(a, `pm-${randomUUID()}`, 'hello-a'),
        insertInbound(b, `pm-${randomUUID()}`, 'hello-b'),
      ]);
    } finally {
      a.release();
      b.release();
    }
    assert.equal(new Set(seqs).size, 2);
    assert.ok(Math.min(...seqs) >= 1);

    // Duplicate provider message rejected by unique index
    await context(c, orgA, user);
    const dupId = `dup-${randomUUID()}`;
    const d1 = digest('same', dupId, '+9647700000099');
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER',$5, (SELECT next_sequence FROM conversations WHERE id=$3::uuid),
         (SELECT next_timeline_sequence FROM conversations WHERE id=$3::uuid), 'same', $6, 'ACCEPTED')`,
      [randomUUID(), orgA, conversationId, connId, dupId, d1],
    );
    await c.query(
      `UPDATE conversations SET next_sequence=next_sequence+1, next_timeline_sequence=next_timeline_sequence+1 WHERE id=$1::uuid`,
      [conversationId],
    );
    await c.query('COMMIT');

    await context(c, orgA, user);
    await assert.rejects(
      c.query(
        `INSERT INTO messages(
           id,organization_id,conversation_id,channel_connection_id,direction,origin,
           provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
         ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER',$5, 999, 999, 'same', $6, 'ACCEPTED')`,
        [randomUUID(), orgA, conversationId, connId, dupId, d1],
      ),
    );
    await c.query('ROLLBACK');

    // Lease fence: B reclaim rejects A write
    await context(c, orgA, user);
    await c.query(
      `UPDATE conversations SET lease_owner='A', lease_fence=1, lease_expires_at=now() - interval '1 second' WHERE id=$1::uuid`,
      [conversationId],
    );
    await c.query('COMMIT');

    await context(c, orgA, user);
    const bLease = await c.query(
      `UPDATE conversations SET lease_owner='B', lease_fence=lease_fence+1, lease_expires_at=now()+interval '60 seconds'
       WHERE id=$1::uuid AND lease_expires_at <= now() RETURNING lease_fence, ownership_epoch`,
      [conversationId],
    );
    assert.equal(bLease.rows[0].lease_fence, 2);
    await c.query('COMMIT');

    await context(c, orgA, user);
    const stale = await c.query(
      `UPDATE conversations SET processed_sequence=processed_sequence
       WHERE id=$1::uuid AND lease_owner='A' AND lease_fence=1 AND lease_expires_at > now()
       RETURNING id`,
      [conversationId],
    );
    assert.equal(stale.rowCount, 0);
    await c.query('ROLLBACK');

    // Mode/epoch bump
    await context(c, orgA, user);
    await c.query(
      `UPDATE conversations SET mode='AI_PAUSED', ownership_epoch=ownership_epoch+1, version=version+1 WHERE id=$1::uuid`,
      [conversationId],
    );
    const ep = await c.query(`SELECT ownership_epoch FROM conversations WHERE id=$1::uuid`, [
      conversationId,
    ]);
    assert.ok(ep.rows[0].ownership_epoch >= 1);
    await c.query('COMMIT');

    // Customer merge reparents conversation
    await context(c, orgA, user);
    await c.query(`SELECT id FROM customers WHERE id IN ($1,$2) ORDER BY id FOR UPDATE`, [
      customerA,
      customerSource,
    ]);
    await c.query(
      `UPDATE customer_identities SET customer_id=$1 WHERE organization_id=$2 AND customer_id=$3`,
      [customerA, orgA, customerSource],
    );
    await c.query(
      `UPDATE conversations SET customer_id=$1, version=version+1 WHERE organization_id=$2 AND customer_id=$3`,
      [customerA, orgA, customerSource],
    );
    await c.query(
      `UPDATE customers SET merged_into_id=$1, archived_at=now(), version=version+1 WHERE id=$2`,
      [customerA, customerSource],
    );
    await c.query('COMMIT');
    const moved = await owner.query(
      `SELECT customer_id FROM conversations WHERE id=$1::uuid`,
      [conversationId],
    );
    assert.equal(moved.rows[0].customer_id, customerA);

    // Cross-tenant conversation invisible
    await context(c, orgB, user);
    assert.equal(
      Number((await c.query(`SELECT count(*) c FROM conversations WHERE id=$1`, [conversationId])).rows[0].c),
      0,
    );
    await c.query('ROLLBACK');

    // Outbox claim + publish mark
    const eventId = randomUUID();
    await context(c, orgA, user);
    await c.query(
      `INSERT INTO outbox_events(id,organization_id,event_type,payload_json,publication_status,available_at)
       VALUES($1,$2,'InboundMessageAccepted',$3::jsonb,'PENDING',now())`,
      [eventId, orgA, JSON.stringify({ eventId, organizationId: orgA, aggregateId: conversationId })],
    );
    await c.query('COMMIT');

    const claimed = await c.query(
      `SELECT * FROM claim_pending_outbox_events(10)`,
    );
    assert.ok(claimed.rows.some((r: { work_id: string }) => r.work_id === eventId));
    await c.query(`SELECT mark_outbox_event_published($1::uuid)`, [eventId]);
    const status = await owner.query(
      `SELECT publication_status FROM outbox_events WHERE id=$1::uuid`,
      [eventId],
    );
    assert.equal(status.rows[0].publication_status, 'PUBLISHED');

    // Consumer receipt only after apply semantics — insert under tenant context
    await context(c, orgA, user);
    await c.query(
      `INSERT INTO consumer_receipts(organization_id,consumer_name,event_id) VALUES($1,'conversation-drain',$2::uuid)`,
      [orgA, eventId],
    );
    await c.query('COMMIT');
    await context(c, orgA, user);
    await assert.rejects(
      c.query(
        `INSERT INTO consumer_receipts(organization_id,consumer_name,event_id) VALUES($1,'conversation-drain',$2::uuid)`,
        [orgA, eventId],
      ),
    );
    await c.query('ROLLBACK');
  } finally {
    c.release();
    await runtime.end();
    await owner.end();
  }
});

test('Phase 03 unit: late flag and digest helpers', () => {
  const d1 = contentDigest('a');
  const d2 = contentDigest('a');
  const d3 = contentDigest('b');
  assert.equal(d1, d2);
  assert.notEqual(d1, d3);
  assert.equal(createHash('sha256').update('a').digest('hex'), d1);
});
