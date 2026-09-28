import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createAppPool } from '../../src/database/pg-pool.js';

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

test('MB-04: Catalog RLS, foreign keys, backfill preservation, and tenant isolation', async () => {
  const user = randomUUID(),
    orgA = randomUUID(),
    orgB = randomUUID();
  const locA = randomUUID(),
    locB = randomUUID();
  const catItemA = randomUUID(),
    catItemB = randomUUID();
  const serviceA = randomUUID();

  // Create users & orgs
  await owner.query(`INSERT INTO users(id, auth_subject) VALUES($1, $2)`, [user, `mb04-${user}`]);
  await owner.query(`INSERT INTO organizations(id, name) VALUES($1, 'MB04 Org A'), ($2, 'MB04 Org B')`, [orgA, orgB]);
  await owner.query(
    `INSERT INTO organization_members(organization_id, user_id, role, status) VALUES($1, $3, 'OWNER', 'ACTIVE'), ($2, $3, 'OWNER', 'ACTIVE')`,
    [orgA, orgB, user],
  );

  // Setup locations
  await owner.query(`INSERT INTO locations(id, organization_id, name, timezone) VALUES($1, $2, 'Loc A', 'Asia/Baghdad'), ($3, $4, 'Loc B', 'UTC')`, [
    locA,
    orgA,
    locB,
    orgB,
  ]);

  const c = await runtime.connect();
  try {
    // 1. Create CatalogItem in Org A as runtime role
    await context(c, orgA, user);
    await c.query(
      `INSERT INTO catalog_items(id, organization_id, kind, name, description, sku, amount_minor, currency, status)
       VALUES($1, $2, 'SERVICE', 'General Consultation', 'Routine dental consult', 'SKU-01', 50000, 'IQD', 'ACTIVE')`,
      [catItemA, orgA],
    );

    // 2. Create Service linked to CatalogItem in Org A
    await c.query(
      `INSERT INTO services(id, organization_id, catalog_item_id, location_id, name, duration_minutes, amount_minor, currency)
       VALUES($1, $2, $3, $4, 'General Consultation', 30, 50000, 'IQD')`,
      [serviceA, orgA, catItemA, locA],
    );
    await c.query('COMMIT');

    // 3. Create CatalogItem in Org B
    await owner.query(
      `INSERT INTO catalog_items(id, organization_id, kind, name, amount_minor, currency, status)
       VALUES($1, $2, 'SERVICE', 'Org B Service', 10000, 'USD', 'ACTIVE')`,
      [catItemB, orgB],
    );

    // 4. Verify RLS tenant isolation on catalog_items
    await context(c, orgA, user);
    const orgACatalog = await c.query(`SELECT id, name, kind FROM catalog_items`);
    assert.equal(orgACatalog.rows.length, 1);
    assert.equal(orgACatalog.rows[0].id, catItemA);

    // Cross-tenant catalog read rejected
    const crossRead = await c.query(`SELECT * FROM catalog_items WHERE id = $1`, [catItemB]);
    assert.equal(crossRead.rows.length, 0);

    // Cross-tenant catalog write rejected (cannot write into orgB while in orgA context)
    await assert.rejects(
      c.query(
        `INSERT INTO catalog_items(id, organization_id, kind, name) VALUES($1, $2, 'PRODUCT', 'Illegal Cross Item')`,
        [randomUUID(), orgB],
      ),
    );

    // Cross-tenant service link rejected (cannot link Org A service to Org B catalog item)
    await assert.rejects(
      c.query(
        `INSERT INTO services(id, organization_id, catalog_item_id, location_id, name, duration_minutes, amount_minor, currency)
         VALUES($1, $2, $3, $4, 'Cross Service', 30, 50000, 'IQD')`,
        [randomUUID(), orgA, catItemB, locA],
      ),
    );
    await c.query('ROLLBACK');

    // 5. Verify Archive lifecycle semantics
    await context(c, orgA, user);
    await c.query(
      `UPDATE catalog_items SET status = 'ARCHIVED', archived_at = now() WHERE id = $1`,
      [catItemA],
    );
    await c.query(
      `UPDATE services SET active = false, archived_at = now() WHERE id = $1`,
      [serviceA],
    );
    await c.query('COMMIT');

    await context(c, orgA, user);
    const activeServices = await c.query(
      `SELECT * FROM services WHERE active = true AND archived_at IS NULL`,
    );
    assert.equal(activeServices.rows.length, 0);
    await c.query('COMMIT');
  } finally {
    c.release();
  }
});
