# Storage integration

Define a narrow BlobStore adapter: issueUpload, verifyObject, readForIngestion, issueDownload and delete. Select Supabase Storage or equivalent in P00 based on region and private-access requirements. NestJS authorizes object metadata before issuing short-lived signed access; no public knowledge bucket.

Keys use organization/document/version/random ID, never an untrusted filename as a path. Upload tokens bind expected key, media type, maximum bytes and short expiry. Finalization verifies actual object size/checksum/type and queues scanning. A signed upload is not approval for retrieval.

Ingestion fetches only known object references, not arbitrary user URLs. Scan/quarantine failures leave the document unpublished. Track orphan uploads and clean them after 24 hours if no finalized metadata exists. Version object writes to avoid overwriting a published document in place.

Deletion is idempotent: database visibility is revoked first, then blobs and chunks are purged through durable work with retry. Database and object backups need coordinated version references; restore verification includes missing objects and stale signed URLs. [Knowledge architecture](../02-architecture/rag-architecture.md).
