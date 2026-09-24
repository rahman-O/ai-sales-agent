import { createHash, randomUUID, createHmac } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type BlobObjectMeta = {
  key: string;
  byteSize: number;
  contentType: string;
  checksumSha256: string;
};

export type IssuedUpload = {
  uploadId: string;
  objectKey: string;
  /** Signed upload URL (production) or opaque local token (filesystem). */
  uploadUrl?: string;
  uploadToken: string;
  expiresAt: string;
  maxBytes: number;
  contentType: string;
  bucket?: string;
};

/**
 * Narrow BlobStore port. Server storage credential lives only inside implementations.
 * Never use SUPABASE_TEST_ADMIN_KEY.
 */
export interface BlobStore {
  readonly kind: 'filesystem' | 'supabase';
  issueUpload(input: {
    organizationId: string;
    documentId: string;
    versionId: string;
    contentType: string;
    maxBytes: number;
  }): Promise<IssuedUpload>;
  verifyObject(input: {
    organizationId: string;
    objectKey: string;
    expectedContentType: string;
    maxBytes: number;
  }): Promise<BlobObjectMeta>;
  readForIngestion(input: {
    organizationId: string;
    objectKey: string;
  }): Promise<{ bytes: Buffer; contentType: string }>;
  /** Dev/test only — must be absent on production stores. */
  putForTests?(input: {
    organizationId: string;
    objectKey: string;
    bytes: Buffer;
    contentType: string;
  }): Promise<BlobObjectMeta>;
  delete(input: { organizationId: string; objectKey: string }): Promise<void>;
}

export class BlobStoreError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'CROSS_TENANT'
      | 'NOT_FOUND'
      | 'TYPE_MISMATCH'
      | 'SIZE_EXCEEDED'
      | 'INVALID_KEY'
      | 'MAGIC_MISMATCH'
      | 'CONFIG',
  ) {
    super(message);
    this.name = 'BlobStoreError';
  }
}

const ALLOWED_MIME = new Set(['text/plain', 'text/markdown', 'application/pdf']);
const DEFAULT_BUCKET = 'knowledge';

export function assertTenantObjectKey(organizationId: string, objectKey: string): void {
  const prefix = `org/${organizationId}/`;
  if (!objectKey.startsWith(prefix)) {
    throw new BlobStoreError('object_key_tenant_mismatch', 'CROSS_TENANT');
  }
  if (objectKey.includes('..') || objectKey.includes('\\') || objectKey.includes('//')) {
    throw new BlobStoreError('invalid_object_key', 'INVALID_KEY');
  }
  // Server path shape only — client cannot invent alternate org/doc/ver layout.
  const re =
    /^org\/[0-9a-f-]{36}\/doc\/[0-9a-f-]{36}\/ver\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;
  if (!re.test(objectKey)) {
    throw new BlobStoreError('invalid_object_key_shape', 'INVALID_KEY');
  }
}

export function buildObjectKey(
  organizationId: string,
  documentId: string,
  versionId: string,
): string {
  return `org/${organizationId}/doc/${documentId}/ver/${versionId}/${randomUUID()}`;
}

export function sniffMime(bytes: Buffer, claimed: string): string {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return 'application/pdf';
  }
  const sample = bytes.subarray(0, Math.min(bytes.length, 512));
  for (const b of sample) {
    if (b === 0) throw new BlobStoreError('binary_not_text', 'MAGIC_MISMATCH');
  }
  if (claimed === 'text/markdown' || claimed === 'text/plain') return claimed;
  if (claimed === 'application/pdf') {
    throw new BlobStoreError('pdf_magic_missing', 'MAGIC_MISMATCH');
  }
  return claimed;
}

function refuseTestAdminKey(env: NodeJS.ProcessEnv, candidate?: string): void {
  const testAdmin = env.SUPABASE_TEST_ADMIN_KEY?.trim();
  if (!testAdmin) return;
  if (env.KNOWLEDGE_USE_TEST_ADMIN === 'true') {
    throw new Error('BlobStore must never use SUPABASE_TEST_ADMIN_KEY');
  }
  if (candidate && candidate === testAdmin) {
    throw new Error('BlobStore must never use SUPABASE_TEST_ADMIN_KEY');
  }
}

/**
 * Local filesystem BlobStore for development/tests ONLY.
 * Forbidden in NODE_ENV=production via createBlobStoreFromEnv.
 */
export class FilesystemBlobStore implements BlobStore {
  readonly kind = 'filesystem' as const;

  constructor(private readonly rootDir: string) {}

  private abs(organizationId: string, objectKey: string): string {
    assertTenantObjectKey(organizationId, objectKey);
    return path.join(this.rootDir, objectKey);
  }

  async issueUpload(input: {
    organizationId: string;
    documentId: string;
    versionId: string;
    contentType: string;
    maxBytes: number;
  }): Promise<IssuedUpload> {
    if (!ALLOWED_MIME.has(input.contentType)) {
      throw new BlobStoreError('unsupported_content_type', 'TYPE_MISMATCH');
    }
    const uploadId = randomUUID();
    const objectKey = buildObjectKey(input.organizationId, input.documentId, input.versionId);
    return {
      uploadId,
      objectKey,
      uploadToken: `fs:${objectKey}:${uploadId}`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      maxBytes: input.maxBytes,
      contentType: input.contentType,
    };
  }

  async putForTests(input: {
    organizationId: string;
    objectKey: string;
    bytes: Buffer;
    contentType: string;
  }): Promise<BlobObjectMeta> {
    assertTenantObjectKey(input.organizationId, input.objectKey);
    if (input.bytes.length === 0) throw new BlobStoreError('empty_object', 'SIZE_EXCEEDED');
    const mime = sniffMime(input.bytes, input.contentType);
    if (!ALLOWED_MIME.has(mime)) throw new BlobStoreError('unsupported_content_type', 'TYPE_MISMATCH');
    const full = this.abs(input.organizationId, input.objectKey);
    await mkdir(path.dirname(full), { recursive: true });
    try {
      await access(full);
      throw new BlobStoreError('overwrite_forbidden', 'INVALID_KEY');
    } catch (e) {
      if ((e as BlobStoreError).code === 'INVALID_KEY') throw e;
    }
    await writeFile(full, input.bytes, { flag: 'wx' });
    return {
      key: input.objectKey,
      byteSize: input.bytes.length,
      contentType: mime,
      checksumSha256: createHash('sha256').update(input.bytes).digest('hex'),
    };
  }

  async verifyObject(input: {
    organizationId: string;
    objectKey: string;
    expectedContentType: string;
    maxBytes: number;
  }): Promise<BlobObjectMeta> {
    const full = this.abs(input.organizationId, input.objectKey);
    let bytes: Buffer;
    try {
      bytes = await readFile(full);
    } catch {
      throw new BlobStoreError('object_missing', 'NOT_FOUND');
    }
    if (bytes.length > input.maxBytes) {
      throw new BlobStoreError('object_too_large', 'SIZE_EXCEEDED');
    }
    const mime = sniffMime(bytes, input.expectedContentType);
    if (mime !== input.expectedContentType) {
      throw new BlobStoreError('content_type_mismatch', 'TYPE_MISMATCH');
    }
    return {
      key: input.objectKey,
      byteSize: bytes.length,
      contentType: mime,
      checksumSha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }

  async readForIngestion(input: {
    organizationId: string;
    objectKey: string;
  }): Promise<{ bytes: Buffer; contentType: string }> {
    const full = this.abs(input.organizationId, input.objectKey);
    let bytes: Buffer;
    try {
      bytes = await readFile(full);
    } catch {
      throw new BlobStoreError('object_missing', 'NOT_FOUND');
    }
    const mime = sniffMime(bytes, 'text/plain');
    return { bytes, contentType: mime };
  }

  async delete(input: { organizationId: string; objectKey: string }): Promise<void> {
    const full = this.abs(input.organizationId, input.objectKey);
    try {
      await unlink(full);
    } catch {
      /* idempotent */
    }
  }
}

/**
 * Production private Supabase Storage BlobStore.
 * Bucket: `knowledge` (private). Credential: service role / dedicated storage key only.
 */
export class SupabaseKnowledgeBlobStore implements BlobStore {
  readonly kind = 'supabase' as const;
  private readonly client: SupabaseClient;
  private readonly bucket: string;
  private readonly signingSecret: string;

  constructor(input: {
    supabaseUrl: string;
    serviceKey: string;
    bucket?: string;
    /** HMAC secret for binding upload tokens (defaults to service key material). */
    uploadBindingSecret?: string;
  }) {
    this.client = createClient(input.supabaseUrl, input.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.bucket = input.bucket ?? DEFAULT_BUCKET;
    this.signingSecret = input.uploadBindingSecret ?? input.serviceKey;
  }

  async issueUpload(input: {
    organizationId: string;
    documentId: string;
    versionId: string;
    contentType: string;
    maxBytes: number;
  }): Promise<IssuedUpload> {
    if (!ALLOWED_MIME.has(input.contentType)) {
      throw new BlobStoreError('unsupported_content_type', 'TYPE_MISMATCH');
    }
    const uploadId = randomUUID();
    const objectKey = buildObjectKey(input.organizationId, input.documentId, input.versionId);
    assertTenantObjectKey(input.organizationId, objectKey);
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(objectKey, { upsert: false });
    if (error || !data?.signedUrl) {
      throw new BlobStoreError(
        `signed_upload_failed:${error?.message ?? 'unknown'}`,
        'CONFIG',
      );
    }
    const binding = createHmac('sha256', this.signingSecret)
      .update(
        `${uploadId}|${objectKey}|${input.contentType}|${input.maxBytes}|${expiresAt.toISOString()}`,
      )
      .digest('hex');
    return {
      uploadId,
      objectKey,
      uploadUrl: data.signedUrl,
      uploadToken: `sb:${uploadId}:${binding}`,
      expiresAt: expiresAt.toISOString(),
      maxBytes: input.maxBytes,
      contentType: input.contentType,
      bucket: this.bucket,
    };
  }

  private async downloadBytes(organizationId: string, objectKey: string): Promise<Buffer> {
    assertTenantObjectKey(organizationId, objectKey);
    const { data, error } = await this.client.storage.from(this.bucket).download(objectKey);
    if (error || !data) {
      throw new BlobStoreError('object_missing', 'NOT_FOUND');
    }
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }

  async verifyObject(input: {
    organizationId: string;
    objectKey: string;
    expectedContentType: string;
    maxBytes: number;
  }): Promise<BlobObjectMeta> {
    const bytes = await this.downloadBytes(input.organizationId, input.objectKey);
    if (bytes.length > input.maxBytes) {
      throw new BlobStoreError('object_too_large', 'SIZE_EXCEEDED');
    }
    if (bytes.length === 0) {
      throw new BlobStoreError('empty_object', 'SIZE_EXCEEDED');
    }
    const mime = sniffMime(bytes, input.expectedContentType);
    if (mime !== input.expectedContentType) {
      throw new BlobStoreError('content_type_mismatch', 'TYPE_MISMATCH');
    }
    return {
      key: input.objectKey,
      byteSize: bytes.length,
      contentType: mime,
      checksumSha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }

  async readForIngestion(input: {
    organizationId: string;
    objectKey: string;
  }): Promise<{ bytes: Buffer; contentType: string }> {
    const bytes = await this.downloadBytes(input.organizationId, input.objectKey);
    const mime = sniffMime(bytes, 'text/plain');
    return { bytes, contentType: mime };
  }

  async delete(input: { organizationId: string; objectKey: string }): Promise<void> {
    assertTenantObjectKey(input.organizationId, input.objectKey);
    await this.client.storage.from(this.bucket).remove([input.objectKey]);
  }
}

/**
 * Resolve BlobStore from env.
 * Production: Supabase private `knowledge` bucket only — fail closed if misconfigured.
 * Development/test: FilesystemBlobStore allowed.
 */
export function createBlobStoreFromEnv(env: NodeJS.ProcessEnv = process.env): BlobStore {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';
  const backend = (env.KNOWLEDGE_STORAGE_BACKEND ?? '').trim().toLowerCase();

  const serviceKey =
    env.KNOWLEDGE_STORAGE_SERVICE_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  refuseTestAdminKey(env, serviceKey);

  if (isProd && backend === 'filesystem') {
    throw new Error('filesystem_blobstore_forbidden_in_production');
  }

  const wantSupabase = backend === 'supabase' || (isProd && backend !== 'filesystem');

  if (wantSupabase || (isProd && !backend)) {
    const url = env.SUPABASE_URL?.trim();
    if (!url || !serviceKey) {
      throw new Error(
        'production_blobstore_misconfigured: require SUPABASE_URL and KNOWLEDGE_STORAGE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)',
      );
    }
    return new SupabaseKnowledgeBlobStore({
      supabaseUrl: url,
      serviceKey,
      bucket: env.KNOWLEDGE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET,
    });
  }

  if (isProd) {
    throw new Error('production_blobstore_misconfigured');
  }

  const root =
    env.KNOWLEDGE_BLOB_ROOT?.trim() ||
    path.join(process.cwd(), '.data', 'knowledge-blobs');
  return new FilesystemBlobStore(root);
}

/** True only for local/dev filesystem helper paths. */
export function isLocalDevBlobPutAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') return false;
  try {
    const store = createBlobStoreFromEnv(env);
    return store.kind === 'filesystem' && typeof store.putForTests === 'function';
  } catch {
    return false;
  }
}
