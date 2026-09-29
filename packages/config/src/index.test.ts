import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadLocalEnv,
  loadServerEnv,
  supabaseJwksUrl,
  resolveAppEnvironment,
  assertNonProduction,
  redactSecret,
  redactUrlCredentials,
  redactHeaders,
  sanitizeLogObject,
} from './index.ts';


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

test('resolveAppEnvironment respects APP_ENV and falls back to NODE_ENV', () => {
  assert.equal(resolveAppEnvironment({ APP_ENV: 'staging' }), 'staging');
  assert.equal(resolveAppEnvironment({ NODE_ENV: 'production' }), 'production');
  assert.equal(resolveAppEnvironment({ NODE_ENV: 'test' }), 'test');
  assert.equal(resolveAppEnvironment({}), 'development');
});

test('assertNonProduction blocks destructive commands in production and allows non-production', () => {
  assert.throws(
    () => assertNonProduction('demo:reset', { APP_ENV: 'production' }),
    /CRITICAL_SECURITY_GUARD/,
  );
  assert.throws(
    () => assertNonProduction('demo:reseed', { NODE_ENV: 'production' }),
    /CRITICAL_SECURITY_GUARD/,
  );
  assert.throws(
    () => assertNonProduction('db:reset', { DB_ENV: 'production' }),
    /CRITICAL_SECURITY_GUARD/,
  );

  // Should succeed without throwing in development/test/staging
  assert.doesNotThrow(() =>
    assertNonProduction('demo:reset', { APP_ENV: 'development', NODE_ENV: 'development' }),
  );
  assert.doesNotThrow(() =>
    assertNonProduction('demo:reset', { APP_ENV: 'test', NODE_ENV: 'test' }),
  );
});

test('redactSecret and redactUrlCredentials hide passwords and sensitive material', () => {
  assert.equal(redactSecret('supersecrettoken12345'), 'sup...345');
  assert.equal(redactSecret('short'), '***');
  assert.equal(redactSecret(''), '[EMPTY]');

  const pgUrl = 'postgresql://postgres:mysecretpassword@aws-0-eu.pooler.supabase.com:6543/postgres';
  const redacted = redactUrlCredentials(pgUrl);
  assert.equal(redacted.includes('mysecretpassword'), false);
  assert.equal(redacted.includes('aws-0-eu.pooler.supabase.com'), true);
});

test('redactHeaders and sanitizeLogObject remove authorization and password keys', () => {
  const headers = {
    authorization: 'Bearer secret-jwt-token',
    'content-type': 'application/json',
    cookie: 'session=12345',
  };
  const safeHeaders = redactHeaders(headers);
  assert.equal(safeHeaders.authorization, '[REDACTED]');
  assert.equal(safeHeaders.cookie, '[REDACTED]');
  assert.equal(safeHeaders['content-type'], 'application/json');

  const logPayload = {
    user: 'admin',
    dbPassword: 'secretpassword',
    deepseek_api_key: 'sk-12345',
    metadata: {
      clientSecret: 'shhh',
      items: 5,
    },
  };
  const safeLog = sanitizeLogObject(logPayload) as Record<string, any>;
  assert.equal(safeLog.user, 'admin');
  assert.equal(safeLog.dbPassword, '[REDACTED]');
  assert.equal(safeLog.metadata.clientSecret, '[REDACTED]');
  assert.equal(safeLog.metadata.items, 5);
});

