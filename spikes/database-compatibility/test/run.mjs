import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.ts';

const adminUrl = process.env.DIRECT_URL ?? 'postgresql://postgres:compat_admin_only@localhost:55432/ai_sales_agent_compat';
const runtimeUrl = process.env.DATABASE_URL ?? 'postgresql://app_runtime:compat_runtime_only@localhost:55432/ai_sales_agent_compat';
const adminPool = new pg.Pool({ connectionString: adminUrl, max: 4 });
const runtimePool = new pg.Pool({ connectionString: runtimeUrl, max: 1 });
// max:1 forces connection reuse for tenant-context leak checks (same intent as Prisma 6 connection_limit=1).
const prismaPool = new pg.Pool({ connectionString: runtimeUrl, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(prismaPool) });

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const USER = '00000000-0000-4000-8000-000000000001';
const STAFF_A = '10000000-0000-4000-8000-00000000000a';
const RESOURCE_A = '20000000-0000-4000-8000-00000000000a';
const RESOURCE_B = '20000000-0000-4000-8000-00000000000b';
const results = [];

async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error?.message ?? error) }); throw error; }
}

async function tenantTx(orgId, fn) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${orgId}, true)`;
    return fn(tx);
  });
}

try {
  await check('PostgreSQL and Prisma connectivity', async () => {
    const rows = await prisma.$queryRaw`SELECT current_database() AS db`;
    assert.equal(rows[0].db, 'ai_sales_agent_compat');
  });

  await adminPool.query('TRUNCATE outbox_events, audit_events, vector_records, bookings, staff, test_resources, organization_members, users, organizations CASCADE');
  await adminPool.query('INSERT INTO organizations(id,name) VALUES ($1,$2),($3,$4)', [A, 'Synthetic A', B, 'Synthetic B']);
  await adminPool.query('INSERT INTO users(id,subject) VALUES ($1,$2)', [USER, 'synthetic-user']);
  await adminPool.query('INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,$3)', [A, USER, 'OWNER']);
  await adminPool.query('INSERT INTO test_resources(id,organization_id,value) VALUES ($1,$2,$3),($4,$5,$6)', [RESOURCE_A,A,'A only',RESOURCE_B,B,'B only']);
  await adminPool.query('INSERT INTO staff(id,organization_id,name) VALUES ($1,$2,$3)', [STAFF_A,A,'Synthetic Staff']);

  await check('Extensions enabled', async () => {
    const { rows } = await adminPool.query("SELECT extname FROM pg_extension WHERE extname IN ('vector','btree_gist') ORDER BY extname");
    assert.deepEqual(rows.map(r => r.extname), ['btree_gist', 'vector']);
  });

  await check('Runtime role is non-owner and cannot bypass RLS', async () => {
    const { rows } = await runtimePool.query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user");
    assert.deepEqual(rows[0], { rolsuper: false, rolbypassrls: false });
  });

  await check('Missing tenant context denies rows', async () => {
    const rows = await prisma.testResource.findMany();
    assert.equal(rows.length, 0);
  });

  await check('Tenant A cannot read or guess Tenant B ID', async () => {
    await tenantTx(A, async tx => {
      const visible = await tx.testResource.findMany({ orderBy: { value: 'asc' } });
      assert.deepEqual(visible.map(x => x.value), ['A only']);
      assert.equal(await tx.testResource.findUnique({ where: { organizationId_id: { organizationId: B, id: RESOURCE_B } } }), null);
    });
  });

  await check('Tenant A cannot update or delete Tenant B', async () => {
    await tenantTx(A, async tx => {
      const updated = await tx.testResource.updateMany({ where: { organizationId: B, id: RESOURCE_B }, data: { value: 'attacked' } });
      const deleted = await tx.testResource.deleteMany({ where: { organizationId: B, id: RESOURCE_B } });
      assert.equal(updated.count, 0); assert.equal(deleted.count, 0);
    });
    const { rows } = await adminPool.query('SELECT value FROM test_resources WHERE organization_id=$1 AND id=$2', [B, RESOURCE_B]);
    assert.equal(rows[0].value, 'B only');
  });

  await check('Connection reuse does not leak transaction-local tenant', async () => {
    assert.deepEqual((await tenantTx(A, tx => tx.testResource.findMany())).map(x => x.value), ['A only']);
    assert.equal((await prisma.testResource.findMany()).length, 0);
    assert.deepEqual((await tenantTx(B, tx => tx.testResource.findMany())).map(x => x.value), ['B only']);
    assert.equal((await prisma.testResource.findMany()).length, 0);
  });

  await check('Composite tenant constraint rejects cross-tenant staff reference', async () => {
    await assert.rejects(() => adminPool.query(
      "INSERT INTO bookings(id,organization_id,staff_id,start_at,end_at,status) VALUES ($1,$2,$3,'2030-01-01T10:00Z','2030-01-01T11:00Z','CONFIRMED')",
      [randomUUID(), B, STAFF_A]
    ), error => error.code === '23503');
  });

  await check('pgvector insert and tenant-scoped similarity query', async () => {
    await tenantTx(A, async tx => {
      await tx.$executeRaw`INSERT INTO vector_records(id,organization_id,label,embedding) VALUES (${randomUUID()}::uuid, ${A}::uuid, 'near', '[1,0,0]'::vector)`;
    });
    await adminPool.query('INSERT INTO vector_records(id,organization_id,label,embedding) VALUES ($1,$2,$3,$4::vector)', [randomUUID(),B,'other tenant','[1,0,0]']);
    await tenantTx(A, async tx => {
      const rows = await tx.$queryRaw`SELECT label, embedding <-> '[1,0,0]'::vector AS distance FROM vector_records ORDER BY distance LIMIT 5`;
      assert.deepEqual(rows.map(r => r.label), ['near']);
      assert.equal(Number(rows[0].distance), 0);
    });
  });

  await check('Transaction rollback covers resource, audit, and outbox', async () => {
    const id = randomUUID();
    await assert.rejects(() => tenantTx(A, async tx => {
      await tx.testResource.create({ data: { id, organizationId: A, value: 'rollback' } });
      await tx.auditEvent.create({ data: { id: randomUUID(), organizationId: A, action: 'created' } });
      await tx.outboxEvent.create({ data: { id: randomUUID(), organizationId: A, eventType: 'ResourceCreated' } });
      throw new Error('intentional rollback');
    }));
    await tenantTx(A, async tx => assert.equal(await tx.testResource.count({ where: { id } }), 0));
  });

  await check('Concurrent overlapping bookings allow exactly one commit', async () => {
    const insert = id => tenantTx(A, tx => tx.booking.create({ data: {
      id, organizationId: A, staffId: STAFF_A,
      startAt: new Date('2030-02-01T10:00:00Z'), endAt: new Date('2030-02-01T11:00:00Z'), status: 'CONFIRMED'
    }}));
    const race = await Promise.allSettled([insert(randomUUID()), insert(randomUUID())]);
    assert.equal(race.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(race.filter(x => x.status === 'rejected').length, 1);
    const count = await tenantTx(A, tx => tx.booking.count({ where: { startAt: new Date('2030-02-01T10:00:00Z') } }));
    assert.equal(count, 1);
  });

  await check('Adjacent half-open booking succeeds', async () => {
    await tenantTx(A, tx => tx.booking.create({ data: {
      id: randomUUID(), organizationId: A, staffId: STAFF_A,
      startAt: new Date('2030-02-01T11:00:00Z'), endAt: new Date('2030-02-01T12:00:00Z'), status: 'CONFIRMED'
    }}));
    assert.equal(await tenantTx(A, tx => tx.booking.count()), 2);
  });

  console.log(JSON.stringify({ summary: { passed: results.length, failed: 0 }, results }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ summary: { passed: results.filter(r => r.status === 'PASS').length, failed: 1 }, results }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await prismaPool.end();
  await runtimePool.end();
  await adminPool.end();
}
