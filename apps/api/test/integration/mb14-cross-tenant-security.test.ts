import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');

const pool = new pg.Pool({
  connectionString: url,
  max: 2,
  ssl: /supabase\.co|supabase\.com/i.test(url) ? { rejectUnauthorized: false } : undefined,
});

async function runInTenantContext<T>(
  orgId: string,
  fn: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgId]);
    await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [randomUUID()]);
    const res = await fn(c);
    await c.query('COMMIT');
    return res;
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}

test('MB-14 Security & Hardening: Complete cross-tenant negative test matrix', async () => {
  const orgA = randomUUID();
  const orgB = randomUUID();

  // Create two distinct tenant organizations
  await runInTenantContext(orgA, async (c) => {
    await c.query(
      `INSERT INTO organizations (id, name)
       VALUES ($1, 'Tenant A Corp')`,
      [orgA],
    );
    await c.query(
      `INSERT INTO organization_capabilities (organization_id, supports_booking, supports_quotes, supports_orders, supports_leads)
       VALUES ($1, true, true, true, true)`,
      [orgA],
    );
    await c.query(
      `INSERT INTO organization_profiles (organization_id, display_name, business_type, country, timezone, default_currency)
       VALUES ($1, 'Tenant A', 'RETAIL', 'IQ', 'Asia/Baghdad', 'IQD')`,
      [orgA],
    );
  });

  await runInTenantContext(orgB, async (c) => {
    await c.query(
      `INSERT INTO organizations (id, name)
       VALUES ($1, 'Tenant B Corp')`,
      [orgB],
    );
    await c.query(
      `INSERT INTO organization_capabilities (organization_id, supports_booking, supports_quotes, supports_orders, supports_leads)
       VALUES ($1, true, true, true, true)`,
      [orgB],
    );
    await c.query(
      `INSERT INTO organization_profiles (organization_id, display_name, business_type, country, timezone, default_currency)
       VALUES ($1, 'Tenant B', 'SERVICES', 'IQ', 'Asia/Baghdad', 'USD')`,
      [orgB],
    );
  });

  const itemA = randomUUID();
  const quoteA = randomUUID();
  const orderA = randomUUID();
  const convA = randomUUID();
  const customerA = randomUUID();

  // Seed Tenant A operational rows
  await runInTenantContext(orgA, async (c) => {
    await c.query(
      `INSERT INTO catalog_items (id, organization_id, kind, name, description, amount_minor, currency, status)
       VALUES ($1, $2, 'SERVICE', 'Tenant A Secret Service', 'Top secret', 100000, 'IQD', 'ACTIVE')`,
      [itemA, orgA],
    );
    await c.query(
      `INSERT INTO customers (id, organization_id, display_name)
       VALUES ($1, $2, 'Customer A')`,
      [customerA, orgA],
    );
    await c.query(
      `INSERT INTO quotes (id, organization_id, customer_id, status, currency, total_amount_minor)
       VALUES ($1, $2, $3, 'ACCEPTED', 'IQD', 100000)`,
      [quoteA, orgA, customerA],
    );
    await c.query(
      `INSERT INTO orders (id, organization_id, customer_id, status, currency, total_amount_minor)
       VALUES ($1, $2, $3, 'CONFIRMED', 'IQD', 100000)`,
      [orderA, orgA, customerA],
    );
  });

  // 1. Negative Test: Tenant B tries to read Tenant A's CatalogItems
  await runInTenantContext(orgB, async (c) => {
    const items = await c.query(`SELECT * FROM catalog_items WHERE id = $1`, [itemA]);
    assert.equal(items.rowCount, 0, 'Tenant B must not see Tenant A catalog item');
  });

  // 2. Negative Test: Tenant B tries to read Tenant A's Customers
  await runInTenantContext(orgB, async (c) => {
    const custs = await c.query(`SELECT * FROM customers WHERE id = $1`, [customerA]);
    assert.equal(custs.rowCount, 0, 'Tenant B must not see Tenant A customer');
  });

  // 4. Negative Test: Tenant B tries to read Tenant A's Quotes
  await runInTenantContext(orgB, async (c) => {
    const quotes = await c.query(`SELECT * FROM quotes WHERE id = $1`, [quoteA]);
    assert.equal(quotes.rowCount, 0, 'Tenant B must not see Tenant A quote');
  });

  // 5. Negative Test: Tenant B tries to read Tenant A's Orders
  await runInTenantContext(orgB, async (c) => {
    const orders = await c.query(`SELECT * FROM orders WHERE id = $1`, [orderA]);
    assert.equal(orders.rowCount, 0, 'Tenant B must not see Tenant A order');
  });

  // 6. Negative Test: Tenant B tries to mutate Tenant A's Quotes
  await runInTenantContext(orgB, async (c) => {
    const updateRes = await c.query(
      `UPDATE quotes SET status = 'CANCELLED' WHERE id = $1`,
      [quoteA],
    );
    assert.equal(updateRes.rowCount, 0, 'Tenant B cannot update Tenant A quote');
  });

  // 7. Negative Test: Unscoped client cannot see Tenant A rows
  const rawClient = await pool.connect();
  try {
    await rawClient.query('BEGIN');
    const unscoped = await rawClient.query(`SELECT * FROM quotes WHERE id = $1`, [quoteA]);
    assert.equal(unscoped.rowCount, 0, 'Unscoped query must return 0 tenant rows due to RLS');
    await rawClient.query('COMMIT');
  } finally {
    rawClient.release();
  }

  // Teardown
  await runInTenantContext(orgA, async (c) => {
    await c.query(`DELETE FROM orders WHERE organization_id = $1`, [orgA]);
    await c.query(`DELETE FROM quotes WHERE organization_id = $1`, [orgA]);
    await c.query(`DELETE FROM conversations WHERE organization_id = $1`, [orgA]);
    await c.query(`DELETE FROM customers WHERE organization_id = $1`, [orgA]);
    await c.query(`DELETE FROM catalog_items WHERE organization_id = $1`, [orgA]);
    await c.query(`DELETE FROM organization_capabilities WHERE organization_id = $1`, [orgA]);
    await c.query(`DELETE FROM organization_profiles WHERE organization_id = $1`, [orgA]);
    await c.query(`DELETE FROM organizations WHERE id = $1`, [orgA]);
  });

  await runInTenantContext(orgB, async (c) => {
    await c.query(`DELETE FROM organization_capabilities WHERE organization_id = $1`, [orgB]);
    await c.query(`DELETE FROM organization_profiles WHERE organization_id = $1`, [orgB]);
    await c.query(`DELETE FROM organizations WHERE id = $1`, [orgB]);
  });
});
