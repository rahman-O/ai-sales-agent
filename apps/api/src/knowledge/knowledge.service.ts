import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ACCEPTED_EMBEDDING_PROFILE,
  FakeEmbeddingProvider,
  resolveEmbeddingProvider,
  type EmbeddingProvider,
} from '@ai-sales-agent/embeddings';
import {
  BlobStoreError,
  createBlobStoreFromEnv,
  isLocalDevBlobPutAllowed,
  type BlobStore,
} from '@ai-sales-agent/storage';
import { CHUNK_PROFILE_ID, chunkText } from '@ai-sales-agent/knowledge-chunking';
import {
  TenantContextService,
  type ActorContext,
  type TenantTxClient,
} from '../database/tenant-context.service.js';

export const KNOWLEDGE_EVENT_EXTRACT = 'knowledge.extract';
export const KNOWLEDGE_EVENT_CHUNK = 'knowledge.chunk';
export const KNOWLEDGE_EVENT_EMBED = 'knowledge.embed';
export const KNOWLEDGE_EVENT_CLEANUP = 'knowledge.cleanup';

const MAX_UPLOAD_BYTES = 512 * 1024;
const PROFILE = ACCEPTED_EMBEDDING_PROFILE;

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function vectorLiteral(v: number[]): string {
  return `[${v.map((x) => Number(x).toFixed(8)).join(',')}]`;
}

type VersionRow = {
  id: string;
  documentId: string;
  objectKey: string;
  mimeType: string;
  extractedText: string | null;
  pipelineStatus: string;
  reviewStatus: string;
  expectedChunkCount: number | null;
  embeddingProfileId: string;
  embeddingDimension: number;
};

type ChunkRow = {
  id: string;
  content: string;
  chunkIndex: number;
};

type DocWithVersions = {
  deletedAt: Date | null;
  versions: Array<{ objectKey: string }>;
};

@Injectable()
export class KnowledgeService {
  private readonly blobs: BlobStore;

  constructor(private readonly tenants: TenantContextService) {
    this.blobs = createBlobStoreFromEnv(process.env);
  }

  /** Test hook */
  getBlobStore(): BlobStore {
    return this.blobs;
  }

  private async membership(actor: ActorContext, organizationId: string) {
    const m = (await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    )) as { status: string; role: string } | null;
    if (!m || m.status !== 'ACTIVE') throw new NotFoundException();
    return m;
  }

  private requireAdmin(role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('ADMIN/OWNER required');
    }
  }

  private requireOperatorPlus(role: string) {
    if (!['OWNER', 'ADMIN', 'OPERATOR'].includes(role)) {
      throw new ForbiddenException('OPERATOR+ required');
    }
  }

  private async audit(
    tx: TenantTxClient,
    actor: ActorContext,
    organizationId: string,
    action: string,
    targetType: string,
    targetId: string,
  ) {
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        organizationId,
        actorUserId: actor.userId,
        action,
        targetType,
        targetId,
      },
    });
  }

  async listDocuments(actor: ActorContext, organizationId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireOperatorPlus(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.knowledgeDocument.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: {
          versions: { orderBy: { versionNumber: 'desc' }, take: 5 },
        },
      }),
    );
  }

  async getDocument(actor: ActorContext, organizationId: string, documentId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireOperatorPlus(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const doc = await tx.knowledgeDocument.findUnique({
        where: { organizationId_id: { organizationId, id: documentId } },
        include: { versions: { orderBy: { versionNumber: 'desc' } } },
      });
      if (!doc || doc.deletedAt) throw new NotFoundException();
      return doc;
    });
  }

  async createUpload(
    actor: ActorContext,
    organizationId: string,
    input: { title: string; contentType: string },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);
    const title = input.title?.trim();
    if (!title || title.length > 200) throw new BadRequestException('Invalid title');
    const contentType = input.contentType?.trim();
    if (!['text/plain', 'text/markdown', 'application/pdf'].includes(contentType)) {
      throw new BadRequestException('Unsupported content type');
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const documentId = randomUUID();
      const versionId = randomUUID();
      const issued = await this.blobs.issueUpload({
        organizationId,
        documentId,
        versionId,
        contentType,
        maxBytes: MAX_UPLOAD_BYTES,
      });
      await tx.knowledgeDocument.create({
        data: {
          id: documentId,
          organizationId,
          title,
        },
      });
      await tx.knowledgeDocumentVersion.create({
        data: {
          id: versionId,
          organizationId,
          documentId,
          versionNumber: 1,
          objectKey: issued.objectKey,
          contentChecksum: 'pending',
          mimeType: contentType,
          byteSize: 0,
          pipelineStatus: 'PENDING_UPLOAD',
          reviewStatus: 'PENDING',
          embeddingProfileId: PROFILE.profileId,
          embeddingModel: PROFILE.model,
          embeddingModelRevision: PROFILE.modelRevision,
          embeddingDimension: PROFILE.dimension,
          queryInstructionVersion: PROFILE.queryInstructionVersion,
          normalizationMode: PROFILE.normalizationMode,
          maxDistance: PROFILE.maxDistance,
        },
      });
      await this.audit(tx, actor, organizationId, 'knowledge.upload_issued', 'KnowledgeDocument', documentId);
      return {
        documentId,
        versionId,
        upload: issued,
        embeddingProfileId: PROFILE.profileId,
      };
    });
  }

  async finalizeUpload(
    actor: ActorContext,
    organizationId: string,
    documentId: string,
    input: { versionId: string },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const ver = await tx.knowledgeDocumentVersion.findUnique({
        where: {
          organizationId_documentId_id: {
            organizationId,
            documentId,
            id: input.versionId,
          },
        },
      });
      if (!ver) throw new NotFoundException();
      if (ver.pipelineStatus !== 'PENDING_UPLOAD') {
        throw new ConflictException('Version already finalized');
      }
      let meta;
      try {
        meta = await this.blobs.verifyObject({
          organizationId,
          objectKey: ver.objectKey,
          expectedContentType: ver.mimeType,
          maxBytes: MAX_UPLOAD_BYTES,
        });
      } catch (e) {
        if (e instanceof BlobStoreError) {
          throw new BadRequestException(e.code);
        }
        throw e;
      }
      await tx.knowledgeDocumentVersion.update({
        where: { organizationId_id: { organizationId, id: ver.id } },
        data: {
          contentChecksum: meta.checksumSha256,
          byteSize: meta.byteSize,
          mimeType: meta.contentType,
          pipelineStatus: 'UPLOADED',
        },
      });
      await this.tenants.writeOutbox(tx, {
        organizationId,
        eventType: KNOWLEDGE_EVENT_EXTRACT,
        payloadJson: {
          documentId,
          versionId: ver.id,
          objectKey: ver.objectKey,
        },
      });
      await this.audit(tx, actor, organizationId, 'knowledge.finalized', 'KnowledgeDocumentVersion', ver.id);
      return { documentId, versionId: ver.id, status: 'UPLOADED', accepted: true };
    });
  }

  /** Worker: extract text outside long TX — stage then process. */
  async processExtract(organizationId: string, versionId: string, workerUserId: string) {
    const actor: ActorContext = { userId: workerUserId, authSubject: 'worker' };
    const ver = (await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.knowledgeDocumentVersion.findUnique({
        where: { organizationId_id: { organizationId, id: versionId } },
      }),
    )) as VersionRow | null;
    if (!ver) return { skipped: true };
    if (ver.pipelineStatus === 'AWAITING_REVIEW' || ver.pipelineStatus === 'READY') {
      return { idempotent: true };
    }
    if (!['UPLOADED', 'EXTRACTING', 'FAILED'].includes(ver.pipelineStatus)) {
      return { skipped: true, status: ver.pipelineStatus };
    }

    await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.knowledgeDocumentVersion.update({
        where: { organizationId_id: { organizationId, id: versionId } },
        data: { pipelineStatus: 'EXTRACTING', failureReason: null },
      }),
    );

    try {
      const { bytes, contentType } = await this.blobs.readForIngestion({
        organizationId,
        objectKey: ver.objectKey,
      });
      if (contentType === 'application/pdf') {
        throw new Error('pdf_extract_not_enabled_p05');
      }
      const text = bytes.toString('utf8');
      if (!text.trim()) throw new Error('empty_extract');
      if (text.length > 400_000) throw new Error('extract_too_large');

      await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
        tx.knowledgeDocumentVersion.update({
          where: { organizationId_id: { organizationId, id: versionId } },
          data: {
            extractedText: text,
            pipelineStatus: 'AWAITING_REVIEW',
            reviewStatus: 'PENDING',
          },
        }),
      );
      return { ok: true, status: 'AWAITING_REVIEW' };
    } catch (e) {
      await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
        tx.knowledgeDocumentVersion.update({
          where: { organizationId_id: { organizationId, id: versionId } },
          data: {
            pipelineStatus: 'FAILED',
            failureReason: String((e as Error).message).slice(0, 500),
          },
        }),
      );
      return { ok: false, error: String(e) };
    }
  }

  async approve(
    actor: ActorContext,
    organizationId: string,
    documentId: string,
    versionId: string,
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const ver = await tx.knowledgeDocumentVersion.findUnique({
        where: {
          organizationId_documentId_id: { organizationId, documentId, id: versionId },
        },
      });
      if (!ver) throw new NotFoundException();
      if (ver.pipelineStatus !== 'AWAITING_REVIEW') {
        throw new ConflictException('Version not awaiting review');
      }
      await tx.knowledgeDocumentVersion.update({
        where: { organizationId_id: { organizationId, id: versionId } },
        data: {
          reviewStatus: 'APPROVED',
          reviewedByUserId: actor.userId,
          reviewedAt: new Date(),
          pipelineStatus: 'CHUNKING',
        },
      });
      await this.tenants.writeOutbox(tx, {
        organizationId,
        eventType: KNOWLEDGE_EVENT_CHUNK,
        payloadJson: { documentId, versionId },
      });
      await this.audit(tx, actor, organizationId, 'knowledge.approved', 'KnowledgeDocumentVersion', versionId);
      return { documentId, versionId, reviewStatus: 'APPROVED' };
    });
  }

  async processChunk(organizationId: string, versionId: string, workerUserId: string) {
    const actor: ActorContext = { userId: workerUserId, authSubject: 'worker' };
    const ver = (await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.knowledgeDocumentVersion.findUnique({
        where: { organizationId_id: { organizationId, id: versionId } },
      }),
    )) as VersionRow | null;
    if (!ver) return { skipped: true };
    if (ver.reviewStatus !== 'APPROVED') return { skipped: true, reason: 'not_approved' };
    if (ver.pipelineStatus === 'EMBEDDING' || ver.pipelineStatus === 'READY') {
      return { idempotent: true };
    }
    if (ver.pipelineStatus !== 'CHUNKING' && ver.pipelineStatus !== 'FAILED') {
      return { skipped: true };
    }
    const text = ver.extractedText ?? '';
    const parts = chunkText(text);
    if (!parts.length) {
      await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
        tx.knowledgeDocumentVersion.update({
          where: { organizationId_id: { organizationId, id: versionId } },
          data: { pipelineStatus: 'FAILED', failureReason: 'no_chunks' },
        }),
      );
      return { ok: false };
    }

    await this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const existing = await tx.knowledgeChunk.count({
        where: { organizationId, documentVersionId: versionId },
      });
      if (existing === 0) {
        for (let i = 0; i < parts.length; i++) {
          await tx.knowledgeChunk.create({
            data: {
              id: randomUUID(),
              organizationId,
              documentId: ver.documentId,
              documentVersionId: versionId,
              chunkIndex: i,
              content: parts[i]!,
              contentHash: sha256(parts[i]!),
              tokenCount: Math.ceil(parts[i]!.length / 4),
              embeddingProfileId: PROFILE.profileId,
              provenanceJson: {
                documentId: ver.documentId,
                versionId,
                chunkIndex: i,
                profileId: PROFILE.profileId,
                chunkingProfileId: CHUNK_PROFILE_ID,
              },
            },
          });
        }
      }
      await tx.knowledgeDocumentVersion.update({
        where: { organizationId_id: { organizationId, id: versionId } },
        data: {
          expectedChunkCount: parts.length,
          pipelineStatus: 'EMBEDDING',
        },
      });
      await this.tenants.writeOutbox(tx, {
        organizationId,
        eventType: KNOWLEDGE_EVENT_EMBED,
        payloadJson: { documentId: ver.documentId, versionId },
      });
    });
    return { ok: true, chunks: parts.length };
  }

  resolveProviderForIngest(): EmbeddingProvider {
    if (process.env.NODE_ENV === 'test' && process.env.AI_ALLOW_FAKE === 'true') {
      return new FakeEmbeddingProvider(PROFILE.dimension);
    }
    const p = resolveEmbeddingProvider(process.env);
    if (!p) {
      throw new ServiceUnavailableException('embedding_provider_unavailable');
    }
    return p;
  }

  async processEmbed(organizationId: string, versionId: string, workerUserId: string) {
    const actor: ActorContext = { userId: workerUserId, authSubject: 'worker' };
    const ver = (await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.knowledgeDocumentVersion.findUnique({
        where: { organizationId_id: { organizationId, id: versionId } },
      }),
    )) as VersionRow | null;
    if (!ver) return { skipped: true };
    if (ver.pipelineStatus === 'READY') return { idempotent: true };
    if (ver.pipelineStatus !== 'EMBEDDING') return { skipped: true };
    if (ver.embeddingProfileId !== PROFILE.profileId || ver.embeddingDimension !== 1024) {
      await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
        tx.knowledgeDocumentVersion.update({
          where: { organizationId_id: { organizationId, id: versionId } },
          data: { pipelineStatus: 'FAILED', failureReason: 'profile_mismatch' },
        }),
      );
      return { ok: false, reason: 'profile_mismatch' };
    }

    const chunks = (await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.knowledgeChunk.findMany({
        where: { organizationId, documentVersionId: versionId },
        orderBy: { chunkIndex: 'asc' },
      }),
    )) as ChunkRow[];
    if (!chunks.length || (ver.expectedChunkCount != null && chunks.length !== ver.expectedChunkCount)) {
      return { ok: false, reason: 'chunk_count' };
    }

    let provider: EmbeddingProvider;
    try {
      provider = this.resolveProviderForIngest();
    } catch (e) {
      return { ok: false, reason: 'tei_unavailable', error: String(e) };
    }

    // Network outside DB transaction
    const texts = chunks.map((c: ChunkRow) => c.content);
    let vectors: number[][];
    try {
      const result = await provider.embedDocuments(texts, { deadlineMs: 120_000 });
      vectors = result.vectors;
    } catch (e) {
      await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
        tx.knowledgeDocumentVersion.update({
          where: { organizationId_id: { organizationId, id: versionId } },
          data: {
            pipelineStatus: 'FAILED',
            failureReason: `embed_failed:${String((e as Error).message).slice(0, 200)}`,
          },
        }),
      );
      return { ok: false, error: String(e) };
    }

    // Persist embeddings via raw SQL (pgvector) — no network inside TX.
    await this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      for (let i = 0; i < chunks.length; i++) {
        const v = vectors[i]!;
        if (v.length !== 1024) throw new Error('invalid_dim');
        await tx.$executeRawUnsafe(
          `UPDATE knowledge_chunks
           SET embedding = $1::vector
           WHERE organization_id = $2::uuid AND id = $3::uuid AND embedding IS NULL`,
          vectorLiteral(v),
          organizationId,
          chunks[i]!.id,
        );
      }
      const missing = (await tx.$queryRawUnsafe(
        `SELECT count(*)::bigint AS n FROM knowledge_chunks
         WHERE organization_id = $1::uuid AND document_version_id = $2::uuid AND embedding IS NULL`,
        organizationId,
        versionId,
      )) as Array<{ n: bigint }>;
      if (Number(missing[0]?.n ?? 1) !== 0) {
        throw new Error('partial_embed');
      }
      await tx.knowledgeDocumentVersion.update({
        where: { organizationId_id: { organizationId, id: versionId } },
        data: { pipelineStatus: 'READY' },
      });
    });
    return { ok: true, status: 'READY' };
  }

  async publish(
    actor: ActorContext,
    organizationId: string,
    documentId: string,
    versionId: string,
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const doc = await tx.knowledgeDocument.findUnique({
        where: { organizationId_id: { organizationId, id: documentId } },
      });
      if (!doc || doc.deletedAt || doc.archivedAt) throw new NotFoundException();
      const ver = await tx.knowledgeDocumentVersion.findUnique({
        where: {
          organizationId_documentId_id: { organizationId, documentId, id: versionId },
        },
      });
      if (!ver) throw new NotFoundException();
      if (ver.reviewStatus !== 'APPROVED' || ver.pipelineStatus !== 'READY') {
        throw new ConflictException('Version not publishable');
      }
      if (ver.embeddingProfileId !== PROFILE.profileId || ver.embeddingDimension !== 1024) {
        throw new ConflictException('embedding_profile_mismatch');
      }
      const chunkStats = (await tx.$queryRawUnsafe(
        `SELECT count(*)::bigint AS total,
                count(embedding)::bigint AS embedded
         FROM knowledge_chunks
         WHERE organization_id = $1::uuid AND document_version_id = $2::uuid`,
        organizationId,
        versionId,
      )) as Array<{ total: bigint; embedded: bigint }>;
      const total = Number(chunkStats[0]?.total ?? 0);
      const embedded = Number(chunkStats[0]?.embedded ?? 0);
      if (!total || total !== embedded || total !== ver.expectedChunkCount) {
        throw new ConflictException('incomplete_embeddings');
      }
      await tx.knowledgeDocument.update({
        where: { organizationId_id: { organizationId, id: documentId } },
        data: {
          activePublishedVersionId: versionId,
          version: { increment: 1 },
        },
      });
      await this.audit(tx, actor, organizationId, 'knowledge.published', 'KnowledgeDocument', documentId);
      return { documentId, activePublishedVersionId: versionId };
    });
  }

  async unpublish(actor: ActorContext, organizationId: string, documentId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const updated = await tx.knowledgeDocument.updateMany({
        where: { organizationId, id: documentId, deletedAt: null },
        data: { activePublishedVersionId: null, version: { increment: 1 } },
      });
      if (!updated.count) throw new NotFoundException();
      await this.audit(tx, actor, organizationId, 'knowledge.unpublished', 'KnowledgeDocument', documentId);
      return { documentId, unpublished: true };
    });
  }

  async archive(actor: ActorContext, organizationId: string, documentId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);
    const now = new Date();
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const updated = await tx.knowledgeDocument.updateMany({
        where: { organizationId, id: documentId, deletedAt: null, archivedAt: null },
        data: {
          archivedAt: now,
          activePublishedVersionId: null,
          version: { increment: 1 },
        },
      });
      if (!updated.count) throw new NotFoundException();
      await this.audit(tx, actor, organizationId, 'knowledge.archived', 'KnowledgeDocument', documentId);
      return { documentId, archived: true };
    });
  }

  async softDelete(actor: ActorContext, organizationId: string, documentId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);
    const now = new Date();
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const doc = await tx.knowledgeDocument.findUnique({
        where: { organizationId_id: { organizationId, id: documentId } },
      });
      if (!doc || doc.deletedAt) throw new NotFoundException();
      await tx.knowledgeDocument.update({
        where: { organizationId_id: { organizationId, id: documentId } },
        data: {
          deletedAt: now,
          activePublishedVersionId: null,
          version: { increment: 1 },
        },
      });
      await this.tenants.writeOutbox(tx, {
        organizationId,
        eventType: KNOWLEDGE_EVENT_CLEANUP,
        payloadJson: { documentId },
      });
      await this.audit(tx, actor, organizationId, 'knowledge.deleted', 'KnowledgeDocument', documentId);
      return { documentId, deleted: true };
    });
  }

  async putBlobText(
    actor: ActorContext,
    organizationId: string,
    input: { objectKey: string; contentType: string; text: string },
  ) {
    if (!isLocalDevBlobPutAllowed(process.env)) {
      throw new ForbiddenException('blob_put_forbidden_outside_local_dev');
    }
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);
    if (!input.text?.length) throw new BadRequestException('empty_body');
    if (this.blobs.kind !== 'filesystem' || !this.blobs.putForTests) {
      throw new ForbiddenException('blob_put_unsupported');
    }
    // Authorize object key exists on a pending version for this org.
    await this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const ver = await tx.knowledgeDocumentVersion.findFirst({
        where: {
          organizationId,
          objectKey: input.objectKey,
          pipelineStatus: 'PENDING_UPLOAD',
        },
      });
      if (!ver) throw new NotFoundException();
    });
    try {
      return await this.blobs.putForTests({
        organizationId,
        objectKey: input.objectKey,
        bytes: Buffer.from(input.text, 'utf8'),
        contentType: input.contentType || 'text/plain',
      });
    } catch (e) {
      if (e instanceof BlobStoreError) throw new BadRequestException(e.code);
      throw e;
    }
  }

  async processCleanup(organizationId: string, documentId: string, workerUserId: string) {
    const actor: ActorContext = { userId: workerUserId, authSubject: 'worker' };
    const doc = (await this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.knowledgeDocument.findUnique({
        where: { organizationId_id: { organizationId, id: documentId } },
        include: { versions: true },
      }),
    )) as DocWithVersions | null;
    if (!doc?.deletedAt) return { skipped: true };
    // Visibility already revoked; purge chunks then blobs (idempotent).
    await this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await tx.knowledgeChunk.deleteMany({ where: { organizationId, documentId } });
    });
    for (const v of doc.versions) {
      await this.blobs.delete({ organizationId, objectKey: v.objectKey });
    }
    return { ok: true };
  }
}

/** Tenant-filtered exact retrieval. Used by searchKnowledge tool. */
export async function searchKnowledgeChunks(
  tx: { $queryRawUnsafe: (...args: unknown[]) => Promise<unknown> },
  input: {
    organizationId: string;
    queryEmbedding: number[];
    limit?: number;
    maxDistance?: number;
    profileId?: string;
  },
): Promise<
  Array<{
    chunkId: string;
    documentId: string;
    documentVersionId: string;
    chunkIndex: number;
    content: string;
    distance: number;
    similarity: number;
    title: string;
  }>
> {
  const limit = Math.min(Math.max(input.limit ?? 6, 1), 6);
  const maxDistance = input.maxDistance ?? PROFILE.maxDistance;
  const profileId = input.profileId ?? PROFILE.profileId;
  if (input.queryEmbedding.length !== 1024) {
    throw new Error('query_embedding_dim');
  }
  const lit = vectorLiteral(input.queryEmbedding);
  const rows = (await tx.$queryRawUnsafe(
    `SELECT
       c.id AS "chunkId",
       c.document_id AS "documentId",
       c.document_version_id AS "documentVersionId",
       c.chunk_index AS "chunkIndex",
       c.content,
       (c.embedding <=> $1::vector) AS distance,
       (1 - (c.embedding <=> $1::vector)) AS similarity,
       d.title AS title
     FROM knowledge_chunks c
     INNER JOIN knowledge_documents d
       ON d.organization_id = c.organization_id AND d.id = c.document_id
     INNER JOIN knowledge_document_versions v
       ON v.organization_id = c.organization_id
      AND v.document_id = c.document_id
      AND v.id = c.document_version_id
     WHERE c.organization_id = $2::uuid
       AND c.organization_id = current_tenant_id()
       AND d.active_published_version_id = c.document_version_id
       AND d.archived_at IS NULL
       AND d.deleted_at IS NULL
       AND v.pipeline_status = 'READY'
       AND v.review_status = 'APPROVED'
       AND v.embedding_profile_id = $3
       AND c.embedding_profile_id = $3
       AND c.embedding IS NOT NULL
       AND (c.embedding <=> $1::vector) <= $4
     ORDER BY c.embedding <=> $1::vector ASC
     LIMIT $5`,
    lit,
    input.organizationId,
    profileId,
    maxDistance,
    limit,
  )) as Array<{
    chunkId: string;
    documentId: string;
    documentVersionId: string;
    chunkIndex: number;
    content: string;
    distance: number;
    similarity: number;
    title: string;
  }>;
  return rows.map((r) => ({
    ...r,
    distance: Number(r.distance),
    similarity: Number(r.similarity),
  }));
}
