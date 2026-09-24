import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLocalDemoDb, isApprovedLocalDemoHost, parseDbHost } from './assert-local-demo-db.ts';

test('parseDbHost extracts hostname', () => {
  assert.equal(parseDbHost('postgresql://u:p@127.0.0.1:5433/db'), '127.0.0.1');
  assert.equal(parseDbHost('postgresql://u:p@localhost:5432/db'), 'localhost');
});

test('blocks supabase and remote hosts', () => {
  assert.equal(isApprovedLocalDemoHost('db.xxx.supabase.co'), false);
  assert.equal(isApprovedLocalDemoHost('aws-0-eu.pooler.supabase.com'), false);
  assert.equal(isApprovedLocalDemoHost('10.0.0.5'), false);
  assert.equal(isApprovedLocalDemoHost('127.0.0.1'), true);
});

test('production rejected even with LOCAL marker', () => {
  const r = assertLocalDemoDb({
    NODE_ENV: 'production',
    DEMO_DB_TARGET: 'LOCAL',
    DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/ai_sales_agent',
    MIGRATION_DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/ai_sales_agent',
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'NODE_ENV_production');
});

test('hosted URL rejected', () => {
  const r = assertLocalDemoDb({
    NODE_ENV: 'development',
    DEMO_FORCE_LOCAL_DB: '1',
    DATABASE_URL: 'postgresql://u:p@db.abc.supabase.co:5432/postgres',
    MIGRATION_DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/ai_sales_agent',
  });
  assert.equal(r.ok, false);
});

test('reset requires ALLOW_DEMO_RESET', () => {
  const r = assertLocalDemoDb(
    {
      NODE_ENV: 'development',
      DEMO_DB_TARGET: 'LOCAL',
      DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/ai_sales_agent',
      MIGRATION_DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/ai_sales_agent',
    },
    { requireAllowReset: true },
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'ALLOW_DEMO_RESET_required');
});

test('approved local gate passes', () => {
  const r = assertLocalDemoDb({
    NODE_ENV: 'development',
    DEMO_DB_TARGET: 'LOCAL',
    DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/ai_sales_agent',
    MIGRATION_DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/ai_sales_agent',
    ALLOW_DEMO_RESET: 'true',
  }, { requireAllowReset: true });
  assert.equal(r.ok, true);
});
