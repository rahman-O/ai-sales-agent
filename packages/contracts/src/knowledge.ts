import { z } from 'zod';

export const KNOWLEDGE_SOURCE_TYPES = ['TEXT', 'FAQ', 'FILE', 'URL', 'MANUAL_NOTE'] as const;
export const KnowledgeSourceTypeEnum = z.enum(KNOWLEDGE_SOURCE_TYPES);
export type KnowledgeSourceType = z.infer<typeof KnowledgeSourceTypeEnum>;

export const KNOWLEDGE_SOURCE_STATUSES = [
  'DRAFT',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'PUBLISHED',
  'FAILED',
  'ARCHIVED',
] as const;
export const KnowledgeSourceStatusEnum = z.enum(KNOWLEDGE_SOURCE_STATUSES);
export type KnowledgeSourceStatus = z.infer<typeof KnowledgeSourceStatusEnum>;

export const KNOWLEDGE_VISIBILITY_LEVELS = ['CUSTOMER_VISIBLE', 'INTERNAL_ONLY'] as const;
export const KnowledgeVisibilityEnum = z.enum(KNOWLEDGE_VISIBILITY_LEVELS);
export type KnowledgeVisibility = z.infer<typeof KnowledgeVisibilityEnum>;

export interface KnowledgeVersionDto {
  id: string;
  versionNumber: number;
  objectKey: string;
  mimeType: string;
  byteSize: number;
  extractedText: string | null;
  pipelineStatus: string;
  reviewStatus: string;
  failureReason: string | null;
  expectedChunkCount: number | null;
  embeddingProfileId: string;
  embeddingDimension: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocumentDto {
  id: string;
  organizationId: string;
  title: string;
  sourceType: KnowledgeSourceType;
  visibility: KnowledgeVisibility;
  status: KnowledgeSourceStatus;
  activePublishedVersionId: string | null;
  archivedAt: string | null;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  versions?: KnowledgeVersionDto[];
}

export const CreateKnowledgeTextSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50_000),
  visibility: KnowledgeVisibilityEnum.optional().default('CUSTOMER_VISIBLE'),
  language: z.string().max(10).optional().default('ar'),
});
export type CreateKnowledgeTextRequest = z.infer<typeof CreateKnowledgeTextSchema>;

export const CreateKnowledgeFaqSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(5_000),
  tags: z.array(z.string().max(50)).optional(),
  visibility: KnowledgeVisibilityEnum.optional().default('CUSTOMER_VISIBLE'),
  language: z.string().max(10).optional().default('ar'),
});
export type CreateKnowledgeFaqRequest = z.infer<typeof CreateKnowledgeFaqSchema>;

export const KnowledgeSearchQuerySchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(10).optional().default(5),
});
export type KnowledgeSearchQueryRequest = z.infer<typeof KnowledgeSearchQuerySchema>;

export interface KnowledgeSearchResultItemDto {
  chunkId: string;
  documentId: string;
  documentVersionId: string;
  chunkIndex: number;
  title: string;
  excerpt: string;
  similarity: number;
  distance: number;
}

export interface KnowledgeSearchResponseDto {
  query: string;
  results: KnowledgeSearchResultItemDto[];
}
