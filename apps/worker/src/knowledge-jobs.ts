import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  ACCEPTED_EMBEDDING_PROFILE,
  FakeEmbeddingProvider,
  resolveEmbeddingProvider,
} from '@ai-sales-agent/embeddings';
import { createBlobStoreFromEnv } from '@ai-sales-agent/storage';
import { CHUNK_PROFILE_ID, chunkText } from './chunk-text.js';

export const KNOWLEDGE_EVENT_EXTRACT = 'knowledge.extract';
export const KNOWLEDGE_EVENT_CHUNK = 'knowledge.chunk';
export const KNOWLEDGE_EVENT_EMBED = 'knowledge.embed';
export const KNOWLEDGE_EVENT_CLEANUP = 'knowledge.cleanup';

const PROFILE = ACCEPTED_EMBEDDING_PROFILE;

function vectorLiteral(v: number[]): string {
  return `[${v.map((x) => Number(x).toFixed(8)).join(',')}]`;
}

async function withTenant<T>(
  pool: Pool,
  organizationId: string,
  workerUserId: string,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [workerUserId]);
    await c.query(`SELECT set_config('app.current_organization_id', $1, true)`, [organizationId]);
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    c.release();
  }
}

export async function handleKnowledgeOutboxEvent(input: {
  pool: Pool;
  organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  workerUserId: string;
}): Promise<{ handled: boolean; result?: unknown }> {
  const { pool, organizationId, eventType, payload, workerUserId } = input;
  const versionId = typeof payload.versionId === 'string' ? payload.versionId : '';
  const documentId = typeof payload.documentId === 'string' ? payload.documentId : '';
  const blobs = createBlobStoreFromEnv(process.env);

  if (eventType === KNOWLEDGE_EVENT_EXTRACT && versionId) {
    const ver = await withTenant(pool, organizationId, workerUserId, async (c) => {
      const r = await c.query(
        `SELECT object_key, pipeline_status, mime_type FROM knowledge_document_versions
         WHERE organization_id=$1 AND id=$2`,
        [organizationId, versionId],
      );
      return r.rows[0] as
        | { object_key: string; pipeline_status: string; mime_type: string }
        | undefined;
    });
    if (!ver) return { handled: true, result: { skipped: true } };
    if (ver.pipeline_status === 'AWAITING_REVIEW' || ver.pipeline_status === 'READY') {
      return { handled: true, result: { idempotent: true } };
    }
    await withTenant(pool, organizationId, workerUserId, (c) =>
      c.query(
        `UPDATE knowledge_document_versions SET pipeline_status='EXTRACTING', failure_reason=NULL, updated_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [organizationId, versionId],
      ),
    );
    try {
      const { bytes, contentType } = await blobs.readForIngestion({
        organizationId,
        objectKey: ver.object_key,
      });
      if (contentType === 'application/pdf') throw new Error('pdf_extract_not_enabled_p05');
      const text = bytes.toString('utf8');
      if (!text.trim()) throw new Error('empty_extract');
      await withTenant(pool, organizationId, workerUserId, (c) =>
        c.query(
          `UPDATE knowledge_document_versions
           SET extracted_text=$3, pipeline_status='AWAITING_REVIEW', review_status='PENDING', updated_at=now()
           WHERE organization_id=$1 AND id=$2`,
          [organizationId, versionId, text],
        ),
      );
      return { handled: true, result: { ok: true, status: 'AWAITING_REVIEW' } };
    } catch (e) {
      await withTenant(pool, organizationId, workerUserId, (c) =>
        c.query(
          `UPDATE knowledge_document_versions
           SET pipeline_status='FAILED', failure_reason=$3, updated_at=now()
           WHERE organization_id=$1 AND id=$2`,
          [organizationId, versionId, String((e as Error).message).slice(0, 500)],
        ),
      );
      return { handled: true, result: { ok: false, error: String(e) } };
    }
  }

  if (eventType === KNOWLEDGE_EVENT_CHUNK && versionId) {
    const ver = await withTenant(pool, organizationId, workerUserId, async (c) => {
      const r = await c.query(
        `SELECT document_id, extracted_text, review_status, pipeline_status
         FROM knowledge_document_versions WHERE organization_id=$1 AND id=$2`,
        [organizationId, versionId],
      );
      return r.rows[0] as
        | {
            document_id: string;
            extracted_text: string | null;
            review_status: string;
            pipeline_status: string;
          }
        | undefined;
    });
    if (!ver || ver.review_status !== 'APPROVED') return { handled: true, result: { skipped: true } };
    if (ver.pipeline_status === 'EMBEDDING' || ver.pipeline_status === 'READY') {
      return { handled: true, result: { idempotent: true } };
    }
    const parts = chunkText(ver.extracted_text ?? '');
    await withTenant(pool, organizationId, workerUserId, async (c) => {
      const existing = await c.query(
        `SELECT count(*)::int AS n FROM knowledge_chunks WHERE organization_id=$1 AND document_version_id=$2`,
        [organizationId, versionId],
      );
      if (existing.rows[0].n === 0) {
        for (let i = 0; i < parts.length; i++) {
          const content = parts[i]!;
          await c.query(
            `INSERT INTO knowledge_chunks(
               id, organization_id, document_id, document_version_id, chunk_index,
               content, content_hash, token_count, embedding_profile_id, provenance_json
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
            [
              randomUUID(),
              organizationId,
              ver.document_id,
              versionId,
              i,
              content,
              createHash('sha256').update(content, 'utf8').digest('hex'),
              Math.ceil(content.length / 4),
              PROFILE.profileId,
              JSON.stringify({
                documentId: ver.document_id,
                versionId,
                chunkIndex: i,
                chunkingProfileId: CHUNK_PROFILE_ID,
              }),
            ],
          );
        }
      }
      await c.query(
        `UPDATE knowledge_document_versions
         SET expected_chunk_count=$3, pipeline_status='EMBEDDING', updated_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [organizationId, versionId, parts.length],
      );
      await c.query(
        `INSERT INTO outbox_events(id, organization_id, event_type, payload_json, publication_status, publication_attempts, available_at)
         VALUES ($1::uuid,$2::uuid,$3,$4::jsonb,'PENDING',0,now())`,
        [
          randomUUID(),
          organizationId,
          KNOWLEDGE_EVENT_EMBED,
          JSON.stringify({ documentId: ver.document_id, versionId }),
        ],
      );
    });
    return { handled: true, result: { ok: true, chunks: parts.length } };
  }

  if (eventType === KNOWLEDGE_EVENT_EMBED && versionId) {
    const ver = await withTenant(pool, organizationId, workerUserId, async (c) => {
      const r = await c.query(
        `SELECT pipeline_status, embedding_profile_id, embedding_dimension, expected_chunk_count
         FROM knowledge_document_versions WHERE organization_id=$1 AND id=$2`,
        [organizationId, versionId],
      );
      return r.rows[0] as
        | {
            pipeline_status: string;
            embedding_profile_id: string;
            embedding_dimension: number;
            expected_chunk_count: number | null;
          }
        | undefined;
    });
    if (!ver) return { handled: true, result: { skipped: true } };
    if (ver.pipeline_status === 'READY') return { handled: true, result: { idempotent: true } };
    if (ver.pipeline_status !== 'EMBEDDING') return { handled: true, result: { skipped: true } };
    if (ver.embedding_profile_id !== PROFILE.profileId || ver.embedding_dimension !== 1024) {
      await withTenant(pool, organizationId, workerUserId, (c) =>
        c.query(
          `UPDATE knowledge_document_versions SET pipeline_status='FAILED', failure_reason='profile_mismatch'
           WHERE organization_id=$1 AND id=$2`,
          [organizationId, versionId],
        ),
      );
      return { handled: true, result: { ok: false } };
    }

    const chunks = await withTenant(pool, organizationId, workerUserId, async (c) => {
      const r = await c.query<{ id: string; content: string }>(
        `SELECT id, content FROM knowledge_chunks
         WHERE organization_id=$1 AND document_version_id=$2 ORDER BY chunk_index`,
        [organizationId, versionId],
      );
      return r.rows;
    });

    const provider =
      process.env.NODE_ENV === 'test' && process.env.AI_ALLOW_FAKE === 'true'
        ? new FakeEmbeddingProvider(PROFILE.dimension)
        : resolveEmbeddingProvider(process.env);
    if (!provider) {
      return { handled: true, result: { ok: false, reason: 'tei_unavailable' } };
    }

    let vectors: number[][];
    try {
      const emb = await provider.embedDocuments(
        chunks.map((ch) => ch.content),
        { deadlineMs: 120_000 },
      );
      vectors = emb.vectors;
    } catch (e) {
      await withTenant(pool, organizationId, workerUserId, (c) =>
        c.query(
          `UPDATE knowledge_document_versions
           SET pipeline_status='FAILED', failure_reason=$3 WHERE organization_id=$1 AND id=$2`,
          [organizationId, versionId, `embed_failed:${String((e as Error).message).slice(0, 200)}`],
        ),
      );
      return { handled: true, result: { ok: false, error: String(e) } };
    }

    await withTenant(pool, organizationId, workerUserId, async (c) => {
      for (let i = 0; i < chunks.length; i++) {
        const v = vectors[i]!;
        if (v.length !== 1024) throw new Error('invalid_dim');
        await c.query(
          `UPDATE knowledge_chunks SET embedding = $1::vector
           WHERE organization_id=$2::uuid AND id=$3::uuid AND embedding IS NULL`,
          [vectorLiteral(v), organizationId, chunks[i]!.id],
        );
      }
      const missing = await c.query(
        `SELECT count(*)::int AS n FROM knowledge_chunks
         WHERE organization_id=$1 AND document_version_id=$2 AND embedding IS NULL`,
        [organizationId, versionId],
      );
      if (missing.rows[0].n !== 0) throw new Error('partial_embed');
      await c.query(
        `UPDATE knowledge_document_versions SET pipeline_status='READY', updated_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [organizationId, versionId],
      );
    });
    return { handled: true, result: { ok: true, status: 'READY' } };
  }

  if (eventType === KNOWLEDGE_EVENT_CLEANUP && documentId) {
    const keys = await withTenant(pool, organizationId, workerUserId, async (c) => {
      const doc = await c.query(
        `SELECT deleted_at FROM knowledge_documents WHERE organization_id=$1 AND id=$2`,
        [organizationId, documentId],
      );
      if (!doc.rows[0]?.deleted_at) return null;
      const vers = await c.query<{ object_key: string }>(
        `SELECT object_key FROM knowledge_document_versions WHERE organization_id=$1 AND document_id=$2`,
        [organizationId, documentId],
      );
      await c.query(`DELETE FROM knowledge_chunks WHERE organization_id=$1 AND document_id=$2`, [
        organizationId,
        documentId,
      ]);
      return vers.rows.map((r) => r.object_key);
    });
    if (!keys) return { handled: true, result: { skipped: true } };
    for (const objectKey of keys) {
      await blobs.delete({ organizationId, objectKey });
    }
    return { handled: true, result: { ok: true } };
  }

  return { handled: false };
}
