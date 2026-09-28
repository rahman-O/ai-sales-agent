import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createToolExecutor } from '@ai-sales-agent/agent-adapters';
import { createAppPool } from '../../src/database/pg-pool.js';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');
const runtime = createAppPool(runtimeUrl, { max: 4 });
const owner = createAppPool(migrationUrl, { max: 1 });

async function context(client: PoolClient, organizationId: string, userId: string) {
  await client.query('BEGIN');
  await client.query(`SELECT set_config('app.current_user_id',$1,true)`, [userId]);
  await client.query(`SELECT set_config('app.current_organization_id',$1,true)`, [organizationId]);
}

test('MB-06: policy RLS, effective resolution, and authoritative AI tool are tenant scoped', async () => {
  const userId = randomUUID();
  const orgA = randomUUID();
  const orgB = randomUUID();
  const activeA = randomUUID();
  const draftA = randomUUID();
  const policyB = randomUUID();
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [userId, `mb06-${userId}`]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'MB06 A'),($2,'MB06 B')`, [orgA, orgB]);
  await owner.query(`INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$3,'OWNER','ACTIVE'),($2,$3,'OWNER','ACTIVE')`, [orgA, orgB, userId]);
  await owner.query(
    `INSERT INTO business_policies(id,organization_id,policy_type,status,title,summary,rules_json,enforcement_mode,version)
     VALUES($1,$2,'CANCELLATION','ACTIVE','Cancel A','Two hour cutoff','{"cutoffMinutes":120,"allowAfterCutoff":false}','ENFORCEABLE',2),
           ($3,$2,'CANCELLATION','DRAFT','Draft A','Ignored draft','{"cutoffMinutes":1,"allowAfterCutoff":true}','ENFORCEABLE',3),
           ($4,$5,'CANCELLATION','ACTIVE','Cancel B','Other tenant','{"cutoffMinutes":5,"allowAfterCutoff":true}','ENFORCEABLE',1)`,
    [activeA, orgA, draftA, policyB, orgB],
  );

  const client = await runtime.connect();
  try {
    await context(client, orgA, userId);
    const visible = await client.query(`SELECT id FROM business_policies ORDER BY version`);
    assert.deepEqual(visible.rows.map((row) => row.id).sort(), [activeA, draftA].sort());
    assert.equal((await client.query(`SELECT id FROM business_policies WHERE id=$1`, [policyB])).rowCount, 0);
    assert.equal((await client.query(`UPDATE business_policies SET title='cross tenant' WHERE id=$1`, [policyB])).rowCount, 0);
    await client.query('ROLLBACK');

    const executor = createToolExecutor(runtime, { toolSecret: 'test' });
    const response = await executor.execute('getEffectivePolicy', { policyType: 'CANCELLATION' }, {
      organizationId: orgA, conversationId: randomUUID(), customerId: randomUUID(), agentRunId: randomUUID(), leaseFence: 1, ownershipEpoch: 0,
    });
    assert.equal(response.ok, true);
    if (response.ok) {
      const data = response.data as { policy: { id: string; rules: { cutoffMinutes: number } } | null; authoritative: boolean };
      assert.equal(data.authoritative, true);
      assert.equal(data.policy?.id, activeA);
      assert.equal(data.policy?.rules.cutoffMinutes, 120);
    }
  } finally {
    client.release();
    await owner.query(`DELETE FROM business_policies WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM users WHERE id=$1`, [userId]);
  }
});
