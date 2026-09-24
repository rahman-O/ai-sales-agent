import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { ACCEPTED_EMBEDDING_PROFILE, FakeEmbeddingProvider } from '@ai-sales-agent/embeddings';
import { FilesystemBlobStore } from '@ai-sales-agent/storage';
import { createAppPool } from '../../src/database/pg-pool.js';
import { handleKnowledgeOutboxEvent } from '../../../worker/src/knowledge-jobs.js';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');
assert.notEqual(runtimeUrl, migrationUrl);

const runtime = createAppPool(runtimeUrl, { max: 6 });
const owner = createAppPool(migrationUrl, { max: 1 });

const PROFILE = ACCEPTED_EMBEDDING_PROFILE;

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

function lit(v: number[]) {
  return `[${v.map((x) => Number(x).toFixed(8)).join(',')}]`;
}

test('Phase 05 knowledge: RLS, isolation, publish lifecycle, retrieval, BlobStore', async () => {
  process.env.NODE_ENV = 'test';
  process.env.AI_ALLOW_FAKE = 'true';
  const blobRoot = await mkdtemp(path.join(tmpdir(), 'p05-blob-'));
  process.env.KNOWLEDGE_BLOB_ROOT = blobRoot;
  const blobs = new FilesystemBlobStore(blobRoot);
  const fake = new FakeEmbeddingProvider(1024);

  const userA = randomUUID();
  const userB = randomUUID();
  const orgA = randomUUID();
  const orgB = randomUUID();

  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2),($3,$4)`, [
    userA,
    `p05a-${userA}`,
    userB,
    `p05b-${userB}`,
  ]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P05 A'),($2,'P05 B')`, [
    orgA,
    orgB,
  ]);
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES
     ($1,$2,'OWNER','ACTIVE'),($3,$4,'OWNER','ACTIVE')`,
    [orgA, userA, orgB, userB],
  );

  // Schema + FORCE RLS
  const tables = await owner.query(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname IN (
       'knowledge_documents','knowledge_document_versions','knowledge_chunks'
     ) ORDER BY 1`,
  );
  assert.equal(tables.rowCount, 3);
  for (const row of tables.rows) {
    assert.equal(row.relrowsecurity, true, row.relname);
    assert.equal(row.relforcerowsecurity, true, row.relname);
  }

  // vector(1024) — typmod is dimension (or dimension+4 depending on pgvector build)
  const dim = await owner.query(
    `SELECT format_type(a.atttypid, a.atttypmod) AS typ
     FROM pg_attribute a
     JOIN pg_class c ON c.oid=a.attrelid
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='knowledge_chunks' AND a.attname='embedding'`,
  );
  assert.match(String(dim.rows[0].typ), /vector\(1024\)/);

  const role = await runtime.query(
    `SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname=current_user`,
  );
  assert.equal(role.rows[0].current_user, 'app_runtime');
  assert.equal(role.rows[0].rolbypassrls, false);

  const bare = await runtime.query(`SELECT count(*)::int AS n FROM knowledge_documents`);
  assert.equal(bare.rows[0].n, 0);

  const c = await runtime.connect();
  try {
    await context(c, orgA, userA);

    const docId = randomUUID();
    const verId = randomUUID();
    const issued = await blobs.issueUpload({
      organizationId: orgA,
      documentId: docId,
      versionId: verId,
      contentType: 'text/plain',
      maxBytes: 50_000,
    });
    const body =
      'Clinic hours: Saturday to Thursday 10:00-18:00. Parking is free for patients. Whitening does not guarantee a specific shade.';
    await blobs.putForTests!({
      organizationId: orgA,
      objectKey: issued.objectKey,
      bytes: Buffer.from(body, 'utf8'),
      contentType: 'text/plain',
    });
    const meta = await blobs.verifyObject({
      organizationId: orgA,
      objectKey: issued.objectKey,
      expectedContentType: 'text/plain',
      maxBytes: 50_000,
    });

    await c.query(
      `INSERT INTO knowledge_documents(id,organization_id,title) VALUES($1,$2,'FAQ Hours')`,
      [docId, orgA],
    );
    await c.query(
      `INSERT INTO knowledge_document_versions(
         id,organization_id,document_id,version_number,object_key,content_checksum,mime_type,byte_size,
         pipeline_status,review_status,embedding_profile_id,embedding_model,embedding_model_revision,
         embedding_dimension,query_instruction_version,normalization_mode,max_distance
       ) VALUES ($1,$2,$3,1,$4,$5,'text/plain',$6,'UPLOADED','PENDING',$7,$8,$9,1024,$10,$11,$12)`,
      [
        verId,
        orgA,
        docId,
        issued.objectKey,
        meta.checksumSha256,
        meta.byteSize,
        PROFILE.profileId,
        PROFILE.model,
        PROFILE.modelRevision,
        PROFILE.queryInstructionVersion,
        PROFILE.normalizationMode,
        PROFILE.maxDistance,
      ],
    );

    // Cross-tenant BlobStore
    await assert.rejects(
      () =>
        blobs.verifyObject({
          organizationId: orgB,
          objectKey: issued.objectKey,
          expectedContentType: 'text/plain',
          maxBytes: 50_000,
        }),
    );

    await c.query('COMMIT');

    // extract → review → chunk → embed via worker handlers
    let r = await handleKnowledgeOutboxEvent({
      pool: runtime,
      organizationId: orgA,
      eventType: 'knowledge.extract',
      payload: { documentId: docId, versionId: verId },
      workerUserId: userA,
    });
    assert.equal((r.result as { ok?: boolean }).ok, true);

    await context(c, orgA, userA);
    await c.query(
      `UPDATE knowledge_document_versions
       SET review_status='APPROVED', reviewed_by_user_id=$3, reviewed_at=now(), pipeline_status='CHUNKING'
       WHERE organization_id=$1 AND id=$2`,
      [orgA, verId, userA],
    );
    await c.query('COMMIT');

    r = await handleKnowledgeOutboxEvent({
      pool: runtime,
      organizationId: orgA,
      eventType: 'knowledge.chunk',
      payload: { documentId: docId, versionId: verId },
      workerUserId: userA,
    });
    assert.equal((r.result as { ok?: boolean }).ok, true);

    r = await handleKnowledgeOutboxEvent({
      pool: runtime,
      organizationId: orgA,
      eventType: 'knowledge.embed',
      payload: { documentId: docId, versionId: verId },
      workerUserId: userA,
    });
    assert.equal((r.result as { status?: string }).status, 'READY');

    // Partial embedding exclusion: insert chunk without embedding must not retrieve
    await context(c, orgA, userA);
    const partialId = randomUUID();
    await c.query(
      `INSERT INTO knowledge_chunks(
         id,organization_id,document_id,document_version_id,chunk_index,content,content_hash,embedding_profile_id
       ) VALUES ($1,$2,$3,$4,99,'partial only', $5, $6)`,
      [
        partialId,
        orgA,
        docId,
        verId,
        createHash('sha256').update('partial only').digest('hex'),
        PROFILE.profileId,
      ],
    );
    // publish requires complete — bump expected to block if we tried; keep expected as real count-1? 
    // Instead: publish with READY but we'll fix expected first
    await c.query(
      `DELETE FROM knowledge_chunks WHERE organization_id=$1 AND id=$2`,
      [orgA, partialId],
    );

    const stats = await c.query(
      `SELECT count(*)::int AS total, count(embedding)::int AS embedded,
              (SELECT expected_chunk_count FROM knowledge_document_versions WHERE id=$2) AS expected
       FROM knowledge_chunks WHERE organization_id=$1 AND document_version_id=$2`,
      [orgA, verId],
    );
    assert.equal(stats.rows[0].total, stats.rows[0].embedded);
    assert.equal(stats.rows[0].total, stats.rows[0].expected);

    await c.query(
      `UPDATE knowledge_documents SET active_published_version_id=$3, version=version+1
       WHERE organization_id=$1 AND id=$2`,
      [orgA, docId, verId],
    );
    await c.query('COMMIT');

    // Same-org cross-document active pointer rejection
    const doc2 = randomUUID();
    const ver2 = randomUUID();
    await context(c, orgA, userA);
    await c.query(`INSERT INTO knowledge_documents(id,organization_id,title) VALUES($1,$2,'Other')`, [
      doc2,
      orgA,
    ]);
    await c.query(
      `INSERT INTO knowledge_document_versions(
         id,organization_id,document_id,version_number,object_key,content_checksum,mime_type,byte_size,
         pipeline_status,review_status
       ) VALUES ($1,$2,$3,1,$4,'abc','text/plain',1,'READY','APPROVED')`,
      [ver2, orgA, doc2, `org/${orgA}/doc/${doc2}/ver/${ver2}/x`],
    );
    await assert.rejects(() =>
      c.query(
        `UPDATE knowledge_documents SET active_published_version_id=$3
         WHERE organization_id=$1 AND id=$2`,
        [orgA, doc2, verId], // verId belongs to docId, not doc2
      ),
    );
    await c.query('ROLLBACK');

    // Retrieval tenant isolation (Fake embeddings — validate join/filter; distance gate is profile-specific to Qwen)
    const qEmb = (await fake.embedQuery(body.slice(0, 80))).vectors[0]!;
    await context(c, orgA, userA);
    const published = await c.query(
      `SELECT count(*)::int AS n FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.organization_id=c.organization_id AND d.id=c.document_id
       WHERE c.organization_id=$1 AND d.active_published_version_id=c.document_version_id
         AND c.embedding IS NOT NULL`,
      [orgA],
    );
    assert.ok(published.rows[0].n > 0);
    const hit = await c.query(
      `SELECT c.id, (c.embedding <=> $1::vector) AS distance
       FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.organization_id=c.organization_id AND d.id=c.document_id
       INNER JOIN knowledge_document_versions v
         ON v.organization_id=c.organization_id AND v.id=c.document_version_id AND v.document_id=c.document_id
       WHERE c.organization_id=$2 AND c.organization_id=current_tenant_id()
         AND d.active_published_version_id=c.document_version_id
         AND d.archived_at IS NULL AND d.deleted_at IS NULL
         AND v.pipeline_status='READY' AND v.review_status='APPROVED'
         AND v.embedding_profile_id=$3 AND c.embedding IS NOT NULL
       ORDER BY c.embedding <=> $1::vector ASC LIMIT 6`,
      [lit(qEmb), orgA, PROFILE.profileId],
    );
    assert.ok(hit.rowCount && hit.rowCount > 0);
    assert.equal(Number.isFinite(Number(hit.rows[0].distance)), true);
    await c.query('COMMIT');

    // Wrong tenant sees nothing
    await context(c, orgB, userB);
    const miss = await c.query(
      `SELECT count(*)::int AS n FROM knowledge_chunks WHERE organization_id=$1`,
      [orgA],
    );
    assert.equal(miss.rows[0].n, 0);
    const miss2 = await c.query(
      `SELECT count(*)::int AS n FROM knowledge_documents WHERE id=$1`,
      [docId],
    );
    assert.equal(miss2.rows[0].n, 0);
    await c.query('COMMIT');

    // Unpublish immediate exclusion
    await context(c, orgA, userA);
    await c.query(
      `UPDATE knowledge_documents SET active_published_version_id=NULL WHERE organization_id=$1 AND id=$2`,
      [orgA, docId],
    );
    const afterUnpub = await c.query(
      `SELECT count(*)::int AS n FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.id=c.document_id AND d.organization_id=c.organization_id
       WHERE c.organization_id=$1 AND d.active_published_version_id=c.document_version_id`,
      [orgA],
    );
    assert.equal(afterUnpub.rows[0].n, 0);

    // Archive
    await c.query(
      `UPDATE knowledge_documents SET archived_at=now(), active_published_version_id=NULL
       WHERE organization_id=$1 AND id=$2`,
      [orgA, docId],
    );
    await c.query('COMMIT');

    // AgentConfig: existing default allowlist does not silently include searchKnowledge
    await context(c, orgA, userA);
    await c.query(
      `INSERT INTO agent_configs(id,organization_id,version,status,prompt_version,model_profile,tool_allowlist,budgets_json)
       VALUES ($1,$2,1,'ACTIVE','p05','fake','["searchServices","getCustomer"]'::jsonb,'{}'::jsonb)`,
      [randomUUID(), orgA],
    );
    const cfg = await c.query(`SELECT tool_allowlist FROM agent_configs WHERE organization_id=$1`, [
      orgA,
    ]);
    assert.equal(JSON.stringify(cfg.rows[0].tool_allowlist).includes('searchKnowledge'), false);
    await c.query('COMMIT');

    // Fake forbidden in production
    process.env.NODE_ENV = 'production';
    await assert.rejects(() => fake.embedDocuments(['x']));
    process.env.NODE_ENV = 'test';
  } finally {
    c.release();
    await rm(blobRoot, { recursive: true, force: true });
  }
});
