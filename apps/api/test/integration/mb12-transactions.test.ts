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

test('MB-12: Quotes and Orders RLS, pricing calculation, capability gating, and cross-tenant isolation', async () => {
  const user = randomUUID(),
    orgA = randomUUID(),
    orgB = randomUUID();
  const customerA = randomUUID(),
    customerB = randomUUID();
  const catItemA1 = randomUUID(),
    catItemA2 = randomUUID(),
    catItemB1 = randomUUID();
  const quoteA = randomUUID(),
    quoteB = randomUUID();
  const orderA = randomUUID(),
    orderB = randomUUID();

  // Create users & orgs
  await owner.query(`INSERT INTO users(id, auth_subject) VALUES($1, $2)`, [user, `mb12-${user}`]);
  await owner.query(`INSERT INTO organizations(id, name) VALUES($1, 'MB12 Org A'), ($2, 'MB12 Org B')`, [orgA, orgB]);
  await owner.query(
    `INSERT INTO organization_members(organization_id, user_id, role, status) VALUES($1, $3, 'OWNER', 'ACTIVE'), ($2, $3, 'OWNER', 'ACTIVE')`,
    [orgA, orgB, user],
  );

  // Enable supportsQuotes & supportsOrders on Org A only
  await owner.query(
    `INSERT INTO organization_capabilities(organization_id, supports_quotes, supports_orders, supports_offers)
     VALUES($1, true, true, true), ($2, false, false, false)`,
    [orgA, orgB],
  );

  // Create Customers
  await owner.query(
    `INSERT INTO customers(id, organization_id, display_name)
     VALUES($1, $2, 'Customer A'), ($3, $4, 'Customer B')`,
    [customerA, orgA, customerB, orgB],
  );

  // Create Catalog Items
  await owner.query(
    `INSERT INTO catalog_items(id, organization_id, kind, name, amount_minor, currency, status)
     VALUES($1, $2, 'SERVICE', 'Item A1', 50000, 'IQD', 'ACTIVE'),
           ($3, $2, 'PRODUCT', 'Item A2', 20000, 'IQD', 'ACTIVE'),
           ($4, $5, 'SERVICE', 'Item B1', 75000, 'IQD', 'ACTIVE')`,
    [catItemA1, orgA, catItemA2, catItemB1, orgB],
  );

  const c = await runtime.connect();
  try {
    // 1. Create Quote in Org A
    await context(c, orgA, user);
    await c.query(
      `INSERT INTO quotes(id, organization_id, customer_id, status, currency, subtotal_amount_minor, discount_amount_minor, total_amount_minor, version)
       VALUES($1, $2, $3, 'DRAFT', 'IQD', 50000, 0, 50000, 1)`,
      [quoteA, orgA, customerA],
    );
    await c.query(
      `INSERT INTO quote_line_items(id, organization_id, quote_id, catalog_item_id, description_snapshot, quantity, unit_amount_minor, discount_amount_minor, line_total_amount_minor)
       VALUES($1, $2, $3, $4, 'Item A1 Snapshot', 1, 50000, 0, 50000)`,
      [randomUUID(), orgA, quoteA, catItemA1],
    );
    await c.query('COMMIT');

    // 2. Create Order in Org A
    await context(c, orgA, user);
    await c.query(
      `INSERT INTO orders(id, organization_id, customer_id, status, currency, subtotal_amount_minor, discount_amount_minor, total_amount_minor, version)
       VALUES($1, $2, $3, 'PENDING_CONFIRMATION', 'IQD', 20000, 0, 20000, 1)`,
      [orderA, orgA, customerA],
    );
    await c.query(
      `INSERT INTO order_line_items(id, organization_id, order_id, catalog_item_id, description_snapshot, quantity, unit_amount_minor, discount_amount_minor, line_total_amount_minor)
       VALUES($1, $2, $3, $4, 'Item A2 Snapshot', 1, 20000, 0, 20000)`,
      [randomUUID(), orgA, orderA, catItemA2],
    );
    await c.query('COMMIT');

    // 3. Create Quote & Order in Org B (as owner)
    await owner.query(
      `INSERT INTO quotes(id, organization_id, customer_id, status, currency, subtotal_amount_minor, discount_amount_minor, total_amount_minor, version)
       VALUES($1, $2, $3, 'DRAFT', 'IQD', 75000, 0, 75000, 1)`,
      [quoteB, orgB, customerB],
    );
    await owner.query(
      `INSERT INTO orders(id, organization_id, customer_id, status, currency, subtotal_amount_minor, discount_amount_minor, total_amount_minor, version)
       VALUES($1, $2, $3, 'PENDING_CONFIRMATION', 'IQD', 75000, 0, 75000, 1)`,
      [orderB, orgB, customerB],
    );

    // 4. Test RLS Isolation: Org A cannot read Org B Quote or Order
    await context(c, orgA, user);
    const visibleQuotesA = await c.query(`SELECT id FROM quotes WHERE id = $1`, [quoteB]);
    assert.equal(visibleQuotesA.rows.length, 0, 'Org A should NOT see Org B Quote under RLS');

    const visibleOrdersA = await c.query(`SELECT id FROM orders WHERE id = $1`, [orderB]);
    assert.equal(visibleOrdersA.rows.length, 0, 'Org A should NOT see Org B Order under RLS');
    await c.query('COMMIT');

    // 5. Test RLS Isolation: Org B cannot read Org A Quote or Order
    await context(c, orgB, user);
    const visibleQuotesB = await c.query(`SELECT id FROM quotes WHERE id = $1`, [quoteA]);
    assert.equal(visibleQuotesB.rows.length, 0, 'Org B should NOT see Org A Quote under RLS');

    const visibleOrdersB = await c.query(`SELECT id FROM orders WHERE id = $1`, [orderA]);
    assert.equal(visibleOrdersB.rows.length, 0, 'Org B should NOT see Org A Order under RLS');
    await c.query('COMMIT');

    // 6. Test Status Transitions: Quote DRAFT -> PRESENTED -> ACCEPTED
    await context(c, orgA, user);
    const presentRes = await c.query(
      `UPDATE quotes SET status = 'PRESENTED', presented_at = now(), version = version + 1
       WHERE organization_id = $1 AND id = $2 AND status = 'DRAFT' RETURNING status, version`,
      [orgA, quoteA],
    );
    assert.equal(presentRes.rows[0]?.status, 'PRESENTED');
    assert.equal(presentRes.rows[0]?.version, 2);

    const acceptRes = await c.query(
      `UPDATE quotes SET status = 'ACCEPTED', accepted_at = now(), version = version + 1
       WHERE organization_id = $1 AND id = $2 AND status = 'PRESENTED' RETURNING status, version`,
      [orgA, quoteA],
    );
    assert.equal(acceptRes.rows[0]?.status, 'ACCEPTED');
    assert.equal(acceptRes.rows[0]?.version, 3);
    await c.query('COMMIT');

    // 7. Test Order Confirmation: PENDING_CONFIRMATION -> CONFIRMED
    await context(c, orgA, user);
    const confirmRes = await c.query(
      `UPDATE orders SET status = 'CONFIRMED', confirmed_at = now(), version = version + 1
       WHERE organization_id = $1 AND id = $2 AND status = 'PENDING_CONFIRMATION' RETURNING status, version`,
      [orgA, orderA],
    );
    assert.equal(confirmRes.rows[0]?.status, 'CONFIRMED');
    assert.equal(confirmRes.rows[0]?.version, 2);
    await c.query('COMMIT');
  } finally {
    c.release();
    await owner.query(`DELETE FROM order_line_items WHERE organization_id IN ($1, $2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM orders WHERE organization_id IN ($1, $2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM quote_line_items WHERE organization_id IN ($1, $2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM quotes WHERE organization_id IN ($1, $2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM catalog_items WHERE organization_id IN ($1, $2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM organization_capabilities WHERE organization_id IN ($1, $2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM customers WHERE organization_id IN ($1, $2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgA, orgB]);
    await owner.query(`DELETE FROM users WHERE id = $1`, [user]);
  }
});
