import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createAppPool } from '../../src/database/pg-pool.js';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');
assert.notEqual(runtimeUrl, migrationUrl, 'runtime must not use migration credentials');

const runtime = createAppPool(runtimeUrl, { max: 4 });
const owner = createAppPool(migrationUrl, { max: 1 });

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

test('Phase 02 RLS, relational integrity, merge and concurrency', async () => {
  const user = randomUUID(), orgA = randomUUID(), orgB = randomUUID();
  const customerA = randomUUID(), customerSource = randomUUID(), customerB = randomUUID();
  const locationA = randomUUID(), locationB = randomUUID(), serviceA = randomUUID(), staffA = randomUUID();
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [user, `p02-${user}`]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P02 A'),($2,'P02 B')`, [orgA, orgB]);
  await owner.query(`INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$3,'OWNER','ACTIVE'),($2,$3,'OWNER','ACTIVE')`, [orgA, orgB, user]);

  const c = await runtime.connect();
  try {
    const role = await c.query(`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    assert.deepEqual([role.rows[0].current_user, role.rows[0].rolsuper, role.rows[0].rolbypassrls], ['app_runtime', false, false]);
    assert.equal(Number((await c.query(`SELECT count(*) c FROM customers`)).rows[0].c), 0);

    await context(c, orgA, user);
    await c.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$3,'Canonical'),($2,$3,'Source')`, [customerA, customerSource, orgA]);
    const connA = randomUUID();
    await c.query(
      `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status)
       VALUES($1,$2,'whatsapp',$3,'ACTIVE')`,
      [connA, orgA, `fixture:${orgA}:whatsapp`],
    );
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+9647700000001')`,
      [randomUUID(), orgA, customerSource, connA],
    );
    await c.query(`INSERT INTO locations(id,organization_id,name,timezone) VALUES($1,$2,'Baghdad','Asia/Baghdad')`, [locationA, orgA]);
    await c.query(`INSERT INTO services(id,organization_id,location_id,name,duration_minutes,amount_minor,currency) VALUES($1,$2,$3,'Cleaning',30,50000,'IQD')`, [serviceA, orgA, locationA]);
    await c.query(`INSERT INTO staff_members(id,organization_id,location_id,display_name) VALUES($1,$2,$3,'Dr Test')`, [staffA, orgA, locationA]);
    await c.query(`INSERT INTO service_staff(organization_id,service_id,staff_id) VALUES($1,$2,$3)`, [orgA, serviceA, staffA]);
    await c.query('COMMIT');

    await owner.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'Other')`, [customerB, orgB]);
    await owner.query(`INSERT INTO locations(id,organization_id,name,timezone) VALUES($1,$2,'Other','UTC')`, [locationB, orgB]);

    await context(c, orgA, user);
    assert.equal(Number((await c.query(`SELECT count(*) c FROM customers`)).rows[0].c), 2);
    assert.equal(Number((await c.query(`SELECT count(*) c FROM customers WHERE id=$1`, [customerB])).rows[0].c), 0);
    await assert.rejects(c.query(`INSERT INTO services(id,organization_id,location_id,name,duration_minutes,amount_minor,currency) VALUES($1,$2,$3,'Cross',30,1,'IQD')`, [randomUUID(), orgA, locationB]));
    await c.query('ROLLBACK');

    await context(c, orgA, user);
    await c.query(`SELECT id FROM customers WHERE id IN ($1,$2) ORDER BY id FOR UPDATE`, [customerA, customerSource]);
    await c.query(`UPDATE customer_identities SET customer_id=$1 WHERE organization_id=$2 AND customer_id=$3`, [customerA, orgA, customerSource]);
    await c.query(`UPDATE customers SET merged_into_id=$1,archived_at=now(),version=version+1 WHERE organization_id=$2 AND id=$3`, [customerA, orgA, customerSource]);
    await c.query(`INSERT INTO audit_logs(organization_id,actor_user_id,action,target_type,target_id) VALUES($1,$2,'customer.merged','Customer',$3)`, [orgA, user, customerA]);
    await c.query('COMMIT');
    const merged = await owner.query(`SELECT customer_id FROM customer_identities WHERE organization_id=$1 AND external_address='+9647700000001'`, [orgA]);
    assert.equal(merged.rows[0].customer_id, customerA);

    const raceAddress = '+9647700000002';
    async function bind(client: PoolClient, customerId: string) {
      await context(client, orgA, user);
      try {
        await client.query(
          `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
           VALUES($1,$2,$3,$4,'whatsapp',$5)`,
          [randomUUID(), orgA, customerId, connA, raceAddress],
        );
        await client.query('COMMIT');
        return 'won';
      } catch {
        await client.query('ROLLBACK');
        return 'lost';
      }
    }
    const a = await runtime.connect(), b = await runtime.connect();
    try { const result = await Promise.all([bind(a, customerA), bind(b, customerA)]); assert.equal(result.filter(x => x === 'won').length, 1); } finally { a.release(); b.release(); }

    await context(c, orgA, user);
    await c.query('ROLLBACK');
    assert.equal(Number((await c.query(`SELECT count(*) c FROM customers`)).rows[0].c), 0, 'transaction-local tenant context leaked');
  } finally {
    c.release(); await runtime.end(); await owner.end();
  }
});
