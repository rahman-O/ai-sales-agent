import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BlobStoreError,
  FilesystemBlobStore,
  SupabaseKnowledgeBlobStore,
  createBlobStoreFromEnv,
  isLocalDevBlobPutAllowed,
  buildObjectKey,
  assertTenantObjectKey,
} from './blob-store.js';

test('BlobStore: server keys, no overwrite, cross-tenant reject', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'blob-'));
  try {
    const store = new FilesystemBlobStore(root);
    assert.equal(store.kind, 'filesystem');
    const orgA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const issued = await store.issueUpload({
      organizationId: orgA,
      documentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      versionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      contentType: 'text/plain',
      maxBytes: 1024,
    });
    assert.ok(issued.objectKey.startsWith(`org/${orgA}/`));
    assertTenantObjectKey(orgA, issued.objectKey);
    const meta = await store.putForTests!({
      organizationId: orgA,
      objectKey: issued.objectKey,
      bytes: Buffer.from('clinic hours friday', 'utf8'),
      contentType: 'text/plain',
    });
    assert.equal(meta.byteSize > 0, true);
    await assert.rejects(
      () =>
        store.putForTests!({
          organizationId: orgA,
          objectKey: issued.objectKey,
          bytes: Buffer.from('again', 'utf8'),
          contentType: 'text/plain',
        }),
      (e: unknown) => e instanceof BlobStoreError && e.code === 'INVALID_KEY',
    );
    await assert.rejects(
      () =>
        store.verifyObject({
          organizationId: orgB,
          objectKey: issued.objectKey,
          expectedContentType: 'text/plain',
          maxBytes: 1024,
        }),
      (e: unknown) => e instanceof BlobStoreError && e.code === 'CROSS_TENANT',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('createBlobStoreFromEnv: production fails closed without supabase credentials', () => {
  assert.throws(
    () =>
      createBlobStoreFromEnv({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
      }),
    /production_blobstore_misconfigured/,
  );
  assert.throws(
    () =>
      createBlobStoreFromEnv({
        NODE_ENV: 'production',
        KNOWLEDGE_STORAGE_BACKEND: 'filesystem',
        KNOWLEDGE_BLOB_ROOT: '/tmp/x',
      }),
    /filesystem_blobstore_forbidden_in_production/,
  );
});

test('createBlobStoreFromEnv: never accepts SUPABASE_TEST_ADMIN_KEY as storage credential', () => {
  assert.throws(
    () =>
      createBlobStoreFromEnv({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_TEST_ADMIN_KEY: 'secret-admin',
        KNOWLEDGE_STORAGE_SERVICE_KEY: 'secret-admin',
      }),
    /SUPABASE_TEST_ADMIN_KEY/,
  );
});

test('createBlobStoreFromEnv: production supabase selects SupabaseKnowledgeBlobStore', () => {
  const store = createBlobStoreFromEnv({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://example.supabase.co',
    KNOWLEDGE_STORAGE_SERVICE_KEY: 'service-role-not-test-admin',
  });
  assert.equal(store.kind, 'supabase');
  assert.equal(typeof store.putForTests, 'undefined');
  assert.ok(store instanceof SupabaseKnowledgeBlobStore);
});

test('isLocalDevBlobPutAllowed: false in production', () => {
  assert.equal(
    isLocalDevBlobPutAllowed({
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://example.supabase.co',
      KNOWLEDGE_STORAGE_SERVICE_KEY: 'svc',
    }),
    false,
  );
});

test('buildObjectKey shape rejects client-selected paths', () => {
  const key = buildObjectKey(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  );
  assertTenantObjectKey('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', key);
  assert.throws(() =>
    assertTenantObjectKey('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'org/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/evil'),
  );
});
