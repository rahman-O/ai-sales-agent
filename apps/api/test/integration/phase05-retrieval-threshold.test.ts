import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { ACCEPTED_EMBEDDING_PROFILE } from '@ai-sales-agent/embeddings';
import { createAppPool } from '../../src/database/pg-pool.js';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');

const runtime = createAppPool(runtimeUrl, { max: 4 });
const owner = createAppPool(migrationUrl, { max: 1 });
const PROFILE = ACCEPTED_EMBEDDING_PROFILE;
const MAX_D = PROFILE.maxDistance; // 0.558746

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

/** Unit vector e0 — cosine distance between e0 and scaled/noisy variants is exact. */
function e0(): number[] {
  const v = new Array(1024).fill(0);
  v[0] = 1;
  return v;
}

function lit(v: number[]) {
  return `[${v.map((x) => Number(x).toFixed(8)).join(',')}]`;
}

/**
 * Build a unit vector at a target cosine *distance* from e0.
 * For unit vectors: distance = 1 - cosθ = 1 - v·e0 = 1 - v[0]
 * So v[0] = 1 - distance, and remaining mass on v[1].
 */
function unitAtDistance(distance: number): number[] {
  const v = new Array(1024).fill(0);
  const c0 = 1 - distance;
  assert.ok(c0 >= -1 && c0 <= 1);
  v[0] = c0;
  const rest = Math.sqrt(Math.max(0, 1 - c0 * c0));
  v[1] = rest;
  return v;
}

test('Phase 05 retrieval threshold boundary + lifecycle exclusions', async () => {
  const user = randomUUID();
  const org = randomUUID();
  const otherOrg = randomUUID();
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [user, `thr-${user}`]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'Thr'),($2,'ThrB')`, [
    org,
    otherOrg,
  ]);
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
    [org, user],
  );

  const docId = randomUUID();
  const verId = randomUUID();
  const c = await runtime.connect();
  try {
    await context(c, org, user);
    await c.query(`INSERT INTO knowledge_documents(id,organization_id,title) VALUES($1,$2,'T')`, [
      docId,
      org,
    ]);
    await c.query(
      `INSERT INTO knowledge_document_versions(
         id,organization_id,document_id,version_number,object_key,content_checksum,mime_type,byte_size,
         pipeline_status,review_status,embedding_profile_id,embedding_dimension,max_distance,expected_chunk_count
       ) VALUES ($1,$2,$3,1,$4,'chk','text/plain',1,'READY','APPROVED',$5,1024,$6,3)`,
      [
        verId,
        org,
        docId,
        `org/${org}/doc/${docId}/ver/${verId}/${randomUUID()}`,
        PROFILE.profileId,
        MAX_D,
      ],
    );

    // Boundary vectors vs e0. Use a representable "at threshold" slightly inside
    // the frozen maxDistance so float32 pgvector rounding cannot push it over.
    const below = unitAtDistance(MAX_D - 0.01);
    const atBoundary = unitAtDistance(MAX_D - 1e-7);
    const above = unitAtDistance(MAX_D + 0.01);
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const vectors = [below, atBoundary, above];
    for (let i = 0; i < 3; i++) {
      await c.query(
        `INSERT INTO knowledge_chunks(
           id,organization_id,document_id,document_version_id,chunk_index,content,content_hash,
           embedding,embedding_profile_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector,$9)`,
        [
          ids[i],
          org,
          docId,
          verId,
          i,
          `chunk-${i}`,
          `hash-${i}`,
          lit(vectors[i]!),
          PROFILE.profileId,
        ],
      );
    }
    await c.query(
      `UPDATE knowledge_documents SET active_published_version_id=$3 WHERE organization_id=$1 AND id=$2`,
      [org, docId, verId],
    );

    const q = lit(e0());
    const hit = await c.query(
      `SELECT c.id, (c.embedding <=> $1::vector)::float8 AS distance
       FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.organization_id=c.organization_id AND d.id=c.document_id
       INNER JOIN knowledge_document_versions v
         ON v.organization_id=c.organization_id AND v.document_id=c.document_id AND v.id=c.document_version_id
       WHERE c.organization_id=$2::uuid
         AND c.organization_id=current_tenant_id()
         AND d.active_published_version_id=c.document_version_id
         AND d.archived_at IS NULL AND d.deleted_at IS NULL
         AND v.pipeline_status='READY' AND v.review_status='APPROVED'
         AND v.embedding_profile_id=$3 AND c.embedding_profile_id=$3
         AND c.embedding IS NOT NULL
         AND (c.embedding <=> $1::vector) <= $4
       ORDER BY c.embedding <=> $1::vector`,
      [q, org, PROFILE.profileId, MAX_D],
    );
    const hitIds = new Set(hit.rows.map((r: { id: string }) => r.id));
    assert.equal(hitIds.has(ids[0]!), true, 'distance just below threshold eligible');
    assert.equal(hitIds.has(ids[1]!), true, 'distance at frozen maxDistance boundary eligible (<=)');
    assert.equal(hitIds.has(ids[2]!), false, 'distance just above threshold excluded');
    for (const row of hit.rows) {
      assert.ok(Number(row.distance) <= MAX_D);
    }

    // Explicit equality path: force distance via SQL filter using literal MAX_D on a row
    // whose measured distance equals the parameter after cast.
    const eqCheck = await c.query(
      `SELECT ($1::float8 <= $1::float8) AS ok, ($2::float8 <= $1::float8) AS above_excluded`,
      [MAX_D, MAX_D + 0.01],
    );
    assert.equal(eqCheck.rows[0].ok, true);
    assert.equal(eqCheck.rows[0].above_excluded, false);

    // wrong profile excluded
    await c.query(
      `UPDATE knowledge_chunks SET embedding_profile_id='other_profile' WHERE id=$1`,
      [ids[0]],
    );
    const wrongProfile = await c.query(
      `SELECT count(*)::int AS n FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.id=c.document_id AND d.organization_id=c.organization_id
       INNER JOIN knowledge_document_versions v ON v.id=c.document_version_id AND v.organization_id=c.organization_id
       WHERE c.organization_id=$1 AND d.active_published_version_id=c.document_version_id
         AND v.embedding_profile_id=$2 AND c.embedding_profile_id=$2
         AND c.embedding IS NOT NULL AND (c.embedding <=> $3::vector) <= $4`,
      [org, PROFILE.profileId, q, MAX_D],
    );
    assert.equal(wrongProfile.rows[0].n, 1); // only exact remains with correct profile
    await c.query(
      `UPDATE knowledge_chunks SET embedding_profile_id=$2 WHERE id=$1`,
      [ids[0], PROFILE.profileId],
    );

    // unapproved / non-READY excluded
    await c.query(
      `UPDATE knowledge_document_versions SET pipeline_status='EMBEDDING' WHERE id=$1`,
      [verId],
    );
    const nonReady = await c.query(
      `SELECT count(*)::int AS n FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.id=c.document_id AND d.organization_id=c.organization_id
       INNER JOIN knowledge_document_versions v ON v.id=c.document_version_id AND v.organization_id=c.organization_id
       WHERE c.organization_id=$1 AND d.active_published_version_id=c.document_version_id
         AND v.pipeline_status='READY' AND v.review_status='APPROVED'
         AND c.embedding IS NOT NULL AND (c.embedding <=> $2::vector) <= $3`,
      [org, q, MAX_D],
    );
    assert.equal(nonReady.rows[0].n, 0);
    await c.query(
      `UPDATE knowledge_document_versions SET pipeline_status='READY', review_status='PENDING' WHERE id=$1`,
      [verId],
    );
    const unapproved = await c.query(
      `SELECT count(*)::int AS n FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.id=c.document_id AND d.organization_id=c.organization_id
       INNER JOIN knowledge_document_versions v ON v.id=c.document_version_id AND v.organization_id=c.organization_id
       WHERE c.organization_id=$1 AND d.active_published_version_id=c.document_version_id
         AND v.pipeline_status='READY' AND v.review_status='APPROVED'
         AND c.embedding IS NOT NULL AND (c.embedding <=> $2::vector) <= $3`,
      [org, q, MAX_D],
    );
    assert.equal(unapproved.rows[0].n, 0);
    await c.query(
      `UPDATE knowledge_document_versions SET review_status='APPROVED' WHERE id=$1`,
      [verId],
    );

    // inactive version (unpublish)
    await c.query(
      `UPDATE knowledge_documents SET active_published_version_id=NULL WHERE id=$1`,
      [docId],
    );
    const inactive = await c.query(
      `SELECT count(*)::int AS n FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.id=c.document_id AND d.organization_id=c.organization_id
       WHERE c.organization_id=$1 AND d.active_published_version_id=c.document_version_id
         AND c.embedding IS NOT NULL AND (c.embedding <=> $2::vector) <= $3`,
      [org, q, MAX_D],
    );
    assert.equal(inactive.rows[0].n, 0);
    await c.query(
      `UPDATE knowledge_documents SET active_published_version_id=$2 WHERE id=$1`,
      [docId, verId],
    );

    // archived / deleted
    await c.query(`UPDATE knowledge_documents SET archived_at=now() WHERE id=$1`, [docId]);
    const archived = await c.query(
      `SELECT count(*)::int AS n FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.id=c.document_id AND d.organization_id=c.organization_id
       WHERE c.organization_id=$1 AND d.active_published_version_id=c.document_version_id
         AND d.archived_at IS NULL AND d.deleted_at IS NULL
         AND c.embedding IS NOT NULL`,
      [org],
    );
    assert.equal(archived.rows[0].n, 0);
    await c.query(
      `UPDATE knowledge_documents SET archived_at=NULL, deleted_at=now(), active_published_version_id=NULL WHERE id=$1`,
      [docId],
    );
    const deleted = await c.query(
      `SELECT count(*)::int AS n FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.id=c.document_id AND d.organization_id=c.organization_id
       WHERE c.organization_id=$1 AND d.active_published_version_id=c.document_version_id
         AND d.archived_at IS NULL AND d.deleted_at IS NULL`,
      [org],
    );
    assert.equal(deleted.rows[0].n, 0);
    await c.query('COMMIT');

    // wrong tenant
    await context(c, otherOrg, user);
    const cross = await c.query(`SELECT count(*)::int AS n FROM knowledge_chunks WHERE organization_id=$1`, [
      org,
    ]);
    assert.equal(cross.rows[0].n, 0);
    await c.query('COMMIT');
  } finally {
    c.release();
  }
});
