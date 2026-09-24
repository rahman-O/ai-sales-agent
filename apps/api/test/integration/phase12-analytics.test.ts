import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { AppConfigService } from '../../src/config/config.service.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { TenantContextService } from '../../src/database/tenant-context.service.js';
import { AnalyticsService } from '../../src/analytics/analytics.service.js';
import { createAppPool } from '../../src/database/pg-pool.js';

test('P12 overview is tenant-scoped, role-scoped, aggregate-only and marks unavailable truth', async () => {
  process.env.APP_URL??='http://localhost:3000'; process.env.API_URL??='http://127.0.0.1:3001'; process.env.REDIS_URL??='redis://127.0.0.1:6379';
  const migrationUrl=process.env.MIGRATION_DATABASE_URL; assert.ok(migrationUrl);
  const owner=createAppPool(migrationUrl,{max:1}); const user=randomUUID(),orgA=randomUUID(),orgB=randomUUID(),orgMissing=randomUUID(),customer=randomUUID(),lead=randomUUID();
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`,[user,`p12-${user}`]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P12 A'),($2,'P12 B'),($3,'P12 Missing')`,[orgA,orgB,orgMissing]);
  await owner.query(`INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$3,'OWNER','ACTIVE'),($2,$3,'ADMIN','ACTIVE')`,[orgA,orgB,user]);
  await owner.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'Synthetic')`,[customer,orgA]);
  await owner.query(`INSERT INTO leads(id,organization_id,customer_id,status,source_type,created_at) VALUES($1,$2,$3,'QUALIFIED','MANUAL',now())`,[lead,orgA,customer]);
  assert.ok(process.env.DATABASE_URL);
  const prisma=new PrismaService({databaseUrl:process.env.DATABASE_URL} as AppConfigService); const analytics=new AnalyticsService(new TenantContextService(prisma));
  try {
    const q={from:'2026-09-01',to:'2026-10-01',timezone:'Asia/Baghdad'};
    const a=await analytics.overview({userId:user,authSubject:`p12-${user}`},orgA,q);
    const b=await analytics.overview({userId:user,authSubject:`p12-${user}`},orgB,q);
    assert.equal(a.leads.created,1); assert.equal(b.leads.created,0);
    assert.equal(a.unavailable.cost.completeness,'UNAVAILABLE');
    assert.equal(JSON.stringify(a).includes('Synthetic'),false,'PII leaked into aggregate response');
    await assert.rejects(analytics.overview({userId:user,authSubject:`p12-${user}`},orgMissing,q));
  } finally { await prisma.onModuleDestroy(); await owner.end(); }
});
