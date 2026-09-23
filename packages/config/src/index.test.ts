import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadLocalEnv, loadServerEnv, supabaseJwksUrl } from './index.ts';

test('loadServerEnv fails without DATABASE_URL', () => {
  assert.throws(() =>
    loadServerEnv({
      NODE_ENV: 'development',
      APP_URL: 'http://localhost:3000',
      API_URL: 'http://localhost:3001',
      REDIS_URL: 'redis://127.0.0.1:6379',
      SUPABASE_URL: 'https://example.supabase.co',
    } as NodeJS.ProcessEnv),
  );
});

test('loadServerEnv succeeds with required fields', () => {
  const env = loadServerEnv({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:3000',
    API_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://app_runtime:x@localhost:5433/db',
    REDIS_URL: 'redis://127.0.0.1:6379',
    SUPABASE_URL: 'https://example.supabase.co',
  } as NodeJS.ProcessEnv);
  assert.equal(env.DATABASE_URL.includes('app_runtime'), true);
});

test('supabaseJwksUrl derives well-known path', () => {
  assert.equal(
    supabaseJwksUrl('https://example.supabase.co'),
    'https://example.supabase.co/auth/v1/.well-known/jwks.json',
  );
});

test('loadServerEnv rejects DATABASE_URL equal to MIGRATION_DATABASE_URL', () => {
  const same = 'postgresql://app_runtime:x@localhost:5433/db';
  assert.throws(
    () =>
      loadServerEnv({
        NODE_ENV: 'test',
        APP_URL: 'http://localhost:3000',
        API_URL: 'http://localhost:3001',
        DATABASE_URL: same,
        MIGRATION_DATABASE_URL: same,
        REDIS_URL: 'redis://127.0.0.1:6379',
        SUPABASE_URL: 'https://example.supabase.co',
      } as NodeJS.ProcessEnv),
    /must not equal MIGRATION_DATABASE_URL/,
  );
});

test('loadServerEnv strips MIGRATION_DATABASE_URL from server parse input', () => {
  const env = loadServerEnv({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:3000',
    API_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://app_runtime:x@localhost:5433/db',
    MIGRATION_DATABASE_URL: 'postgresql://postgres:y@localhost:5433/db',
    REDIS_URL: 'redis://127.0.0.1:6379',
    SUPABASE_URL: 'https://example.supabase.co',
  } as NodeJS.ProcessEnv);
  assert.equal('MIGRATION_DATABASE_URL' in env, false);
  assert.equal(env.DATABASE_URL.includes('app_runtime'), true);
});

test('loadLocalEnv skips NODE_ENV from env files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asa-env-'));
  fs.writeFileSync(path.join(dir, '.env'), 'NODE_ENV=development\nAPP_URL=http://localhost:3000\n');
  fs.writeFileSync(path.join(dir, '.env.local'), 'NODE_ENV=production\n');
  const prev = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  delete process.env.APP_URL;
  try {
    loadLocalEnv(dir);
    assert.equal(process.env.NODE_ENV, undefined);
    assert.equal(process.env.APP_URL, 'http://localhost:3000');
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
    delete process.env.APP_URL;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
