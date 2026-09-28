import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createAppPool } from '../../src/database/pg-pool.js';
import { createToolExecutor } from '@ai-sales-agent/agent-adapters';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');

const runtime = createAppPool(runtimeUrl, { max: 4 });
const owner = createAppPool(migrationUrl, { max: 1 });

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

test('MB-05: Offers RLS, active time windows, catalog targeting, and cross-tenant isolation', async () => {
  const user = randomUUID(),
    orgA = randomUUID(),
    orgB = randomUUID();
  const catItemA1 = randomUUID(),
    catItemA2 = randomUUID(),
    catItemB1 = randomUUID();
  const offerActiveA = randomUUID(),
    offerFutureA = randomUUID(),
    offerExpiredA = randomUUID(),
    offerPausedA = randomUUID(),
    offerArchivedA = randomUUID(),
    offerTargetedA = randomUUID(),
    offerOrgB = randomUUID();

  // Create users & orgs
  await owner.query(`INSERT INTO users(id, auth_subject) VALUES($1, $2)`, [user, `mb05-${user}`]);
  await owner.query(`INSERT INTO organizations(id, name) VALUES($1, 'MB05 Org A'), ($2, 'MB05 Org B')`, [orgA, orgB]);
  await owner.query(
    `INSERT INTO organization_members(organization_id, user_id, role, status) VALUES($1, $3, 'OWNER', 'ACTIVE'), ($2, $3, 'OWNER', 'ACTIVE')`,
    [orgA, orgB, user],
  );

  // Enable supportsOffers on Org A
  await owner.query(
    `INSERT INTO organization_capabilities(organization_id, supports_offers) VALUES($1, true), ($2, true)`,
    [orgA, orgB],
  );

  // Create Catalog Items
  await owner.query(
    `INSERT INTO catalog_items(id, organization_id, kind, name, amount_minor, currency, status)
     VALUES($1, $2, 'SERVICE', 'Cleaning A1', 50000, 'IQD', 'ACTIVE'),
           ($3, $2, 'SERVICE', 'Whitening A2', 150000, 'IQD', 'ACTIVE'),
           ($4, $5, 'SERVICE', 'Org B Item', 80000, 'IQD', 'ACTIVE')`,
    [catItemA1, orgA, catItemA2, catItemB1, orgB],
  );

  const c = await runtime.connect();
  try {
    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const wayPast = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const future = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const farFuture = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    // 1. Insert various offers in Org A
    await context(c, orgA, user);

    // Active store-wide offer
    await c.query(
      `INSERT INTO offers(id, organization_id, name, status, offer_type, discount_percentage, starts_at, ends_at)
       VALUES($1, $2, 'Active Store-wide 10%', 'ACTIVE', 'PERCENTAGE_DISCOUNT', 10, $3, $4)`,
      [offerActiveA, orgA, past, future],
    );

    // Future scheduled offer (not active yet)
    await c.query(
      `INSERT INTO offers(id, organization_id, name, status, offer_type, discount_percentage, starts_at, ends_at)
       VALUES($1, $2, 'Future Promo 25%', 'ACTIVE', 'PERCENTAGE_DISCOUNT', 25, $3, $4)`,
      [offerFutureA, orgA, future, farFuture],
    );

    // Expired offer
    await c.query(
      `INSERT INTO offers(id, organization_id, name, status, offer_type, discount_percentage, starts_at, ends_at)
       VALUES($1, $2, 'Expired Promo 50%', 'ACTIVE', 'PERCENTAGE_DISCOUNT', 50, $3, $4)`,
      [offerExpiredA, orgA, wayPast, past],
    );

    // Paused offer
    await c.query(
      `INSERT INTO offers(id, organization_id, name, status, offer_type, discount_percentage, starts_at, ends_at)
       VALUES($1, $2, 'Paused Promo 15%', 'PAUSED', 'PERCENTAGE_DISCOUNT', 15, $3, $4)`,
      [offerPausedA, orgA, past, future],
    );

    // Archived offer
    await c.query(
      `INSERT INTO offers(id, organization_id, name, status, offer_type, discount_percentage, archived_at)
       VALUES($1, $2, 'Archived Promo', 'ARCHIVED', 'PERCENTAGE_DISCOUNT', 30, now())`,
      [offerArchivedA, orgA],
    );

    // Active offer targeted only to Cleaning A1 (catItemA1)
    await c.query(
      `INSERT INTO offers(id, organization_id, name, status, offer_type, discount_amount_minor, currency, starts_at, ends_at)
       VALUES($1, $2, 'Cleaning Special 10,000 Off', 'ACTIVE', 'FIXED_DISCOUNT', 10000, 'IQD', $3, $4)`,
      [offerTargetedA, orgA, past, future],
    );
    await c.query(
      `INSERT INTO offer_catalog_items(organization_id, offer_id, catalog_item_id)
       VALUES($1, $2, $3)`,
      [orgA, offerTargetedA, catItemA1],
    );

    await c.query('COMMIT');

    // 2. Insert Offer in Org B
    await owner.query(
      `INSERT INTO offers(id, organization_id, name, status, offer_type, discount_percentage)
       VALUES($1, $2, 'Org B Offer', 'ACTIVE', 'PERCENTAGE_DISCOUNT', 20)`,
      [offerOrgB, orgB],
    );

    // 3. Verify RLS tenant isolation on offers table
    await context(c, orgA, user);
    const orgAOffers = await c.query(`SELECT id, name FROM offers`);
    assert.equal(orgAOffers.rows.length, 6);
    assert.ok(orgAOffers.rows.every((r) => r.id !== offerOrgB));

    // Cross-tenant read returns 0 rows
    const crossRead = await c.query(`SELECT * FROM offers WHERE id = $1`, [offerOrgB]);
    assert.equal(crossRead.rows.length, 0);

    // Cross-tenant offer insert rejected
    await assert.rejects(
      c.query(
        `INSERT INTO offers(id, organization_id, name, offer_type) VALUES($1, $2, 'Illegal Cross Offer', 'PERCENTAGE_DISCOUNT')`,
        [randomUUID(), orgB],
      ),
    );

    // Cross-tenant target link rejected (Org A offer targeting Org B catalog item)
    await assert.rejects(
      c.query(
        `INSERT INTO offer_catalog_items(organization_id, offer_id, catalog_item_id)
         VALUES($1, $2, $3)`,
        [orgA, offerActiveA, catItemB1],
      ),
    );
    await c.query('ROLLBACK');

    // 4. Test AI Tool getActiveOffers
    const executor = createToolExecutor(runtime, {
      toolSecret: 'test-secret',
    });

    const toolCtxA = {
      organizationId: orgA,
      conversationId: randomUUID(),
      customerId: randomUUID(),
      agentRunId: randomUUID(),
      leaseFence: 1,
      ownershipEpoch: 0,
    };

    const activeToolRes = await executor.execute('getActiveOffers', {}, toolCtxA);

    assert.equal(activeToolRes.ok, true);
    if (activeToolRes.ok) {
      const data = activeToolRes.data as { offers: Array<{ id: string; name: string }> };
      const returnedIds = data.offers.map((o) => o.id);

      // Must include currently active offers
      assert.ok(returnedIds.includes(offerActiveA));
      assert.ok(returnedIds.includes(offerTargetedA));

      // Must NOT include future, expired, paused, or archived offers
      assert.ok(!returnedIds.includes(offerFutureA), 'Future offer should not be returned');
      assert.ok(!returnedIds.includes(offerExpiredA), 'Expired offer should not be returned');
      assert.ok(!returnedIds.includes(offerPausedA), 'Paused offer should not be returned');
      assert.ok(!returnedIds.includes(offerArchivedA), 'Archived offer should not be returned');
      assert.ok(!returnedIds.includes(offerOrgB), 'Other tenant offer should not be returned');
    }

    // 5. Test getActiveOffers filtered by catalogItemId
    const targetedRes = await executor.execute(
      'getActiveOffers',
      { catalogItemId: catItemA1 },
      toolCtxA,
    );
    assert.equal(targetedRes.ok, true);
    if (targetedRes.ok) {
      const data = targetedRes.data as { offers: Array<{ id: string; name: string }> };
      const ids = data.offers.map((o) => o.id);
      assert.ok(ids.includes(offerTargetedA));
      assert.ok(ids.includes(offerActiveA)); // store-wide applies to all
    }

    const nonTargetedRes = await executor.execute(
      'getActiveOffers',
      { catalogItemId: catItemA2 }, // Whitening - offerTargetedA is NOT for this item
      toolCtxA,
    );
    assert.equal(nonTargetedRes.ok, true);
    if (nonTargetedRes.ok) {
      const data = nonTargetedRes.data as { offers: Array<{ id: string; name: string }> };
      const ids = data.offers.map((o) => o.id);
      assert.ok(!ids.includes(offerTargetedA));
      assert.ok(ids.includes(offerActiveA));
    }
  } finally {
    c.release();
  }
});
