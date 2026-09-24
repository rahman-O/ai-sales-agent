# Storage integration

Define a narrow BlobStore adapter: `issueUpload`, `verifyObject`, `readForIngestion`, and `delete`.

## Production (required)

`SupabaseKnowledgeBlobStore` — private Supabase Storage bucket `knowledge` (override via `KNOWLEDGE_STORAGE_BUCKET`).

Env (server-only):

- `SUPABASE_URL`
- `KNOWLEDGE_STORAGE_SERVICE_KEY` (preferred) or `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `KNOWLEDGE_STORAGE_BACKEND=supabase`

**Fail closed** in `NODE_ENV=production` if credentials are missing or if `KNOWLEDGE_STORAGE_BACKEND=filesystem`.

**Never** use `SUPABASE_TEST_ADMIN_KEY` as the storage credential.

Trust rules:

- ADMIN/OWNER authorize mutations in Nest before issuing uploads
- Server-generated keys: `org/{organizationId}/doc/{documentId}/ver/{versionId}/{uuid}`
- Client cannot select organization/document/version path
- Bounded signed upload (`createSignedUploadUrl`, `upsert: false`)
- Finalize downloads the exact object and verifies size, MIME magic, and SHA-256
- Worker reads `object_key` only from tenant-authorized DB rows
- Deletion is tenant-scoped via key prefix checks

## Local development

`FilesystemBlobStore` via `KNOWLEDGE_BLOB_ROOT` when not production.

`POST .../knowledge/blob-put` is **forbidden** when `NODE_ENV=production` or when the active store is not filesystem (`isLocalDevBlobPutAllowed`).

Implementation: `packages/storage/src/blob-store.ts`.
