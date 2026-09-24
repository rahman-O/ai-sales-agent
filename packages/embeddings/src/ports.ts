export interface EmbeddingUsage {
  inputTokens: number | null;
  estimated: boolean;
}

export interface EmbedResult {
  vectors: number[][];
  model: string;
  dimension: number;
  providerRequestId: string;
  usage: EmbeddingUsage;
}

export type EmbeddingErrorCode =
  | 'TRANSIENT_EMBEDDING_ERROR'
  | 'PERMANENT_EMBEDDING_ERROR'
  | 'INVALID_DIMENSION'
  | 'CONTENT_REJECTED'
  | 'INGESTION_TIMEOUT'
  | 'MISSING_CREDENTIAL'
  | 'TEI_UNREACHABLE'
  | 'TEI_WRONG_MODEL'
  | 'NORMALIZATION_FAILED';

export class EmbeddingProviderError extends Error {
  constructor(
    message: string,
    readonly code: EmbeddingErrorCode,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'EmbeddingProviderError';
  }
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dimension: number;
  readonly profileId: string;
  embedDocuments(texts: string[], opts?: { deadlineMs?: number }): Promise<EmbedResult>;
  embedQuery(text: string, opts?: { deadlineMs?: number }): Promise<EmbedResult>;
}

/** English instruct for multilingual retrieval (Qwen recommendation). Versioned. */
export const QWEN_DENTAL_QUERY_INSTRUCTION =
  'Given a customer question, retrieve relevant passages from a dental clinic knowledge base that help answer the question.';

export const QWEN_QUERY_INSTRUCTION_VERSION = 'qwen3_dental_retrieve_en_v1';

/** HF commit for Qwen/Qwen3-Embedding-0.6B (pinned for bake-off). */
export const QWEN3_EMBED_06B_REVISION = '97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3';

/**
 * Accepted / locked profile after held-out bake-off PASS + migration GO.
 * maxDistance frozen — do not retune on held-out.
 */
export const ACCEPTED_EMBEDDING_PROFILE = {
  profileId: 'qwen3_embed_06b_1024_v1',
  provider: 'local_qwen',
  model: 'Qwen/Qwen3-Embedding-0.6B',
  modelRevision: QWEN3_EMBED_06B_REVISION,
  dimension: 1024,
  queryInstructionVersion: QWEN_QUERY_INSTRUCTION_VERSION,
  queryInstruction: QWEN_DENTAL_QUERY_INSTRUCTION,
  normalizationMode: 'tei_normalize_true_l2' as const,
  maxDistance: 0.558746,
  teiVersion: '1.9.4',
  teiImageDigest:
    'ghcr.io/huggingface/text-embeddings-inference@sha256:2538ea1c9640d3763b15af668039d24172d063b42337b0c27796fc2be180c78d',
} as const;

/** @deprecated Use ACCEPTED_EMBEDDING_PROFILE */
export const CANDIDATE_EMBEDDING_PROFILE = ACCEPTED_EMBEDDING_PROFILE;

export type EmbeddingProfile = {
  profileId: string;
  provider: string;
  model: string;
  modelRevision?: string;
  dimension: number;
  queryInstructionVersion?: string;
  normalizationMode?: string;
  maxDistance: number | null;
  teiVersion?: string;
  teiImageDigest?: string;
};

export function formatQwenQuery(query: string, instruction = QWEN_DENTAL_QUERY_INSTRUCTION): string {
  return `Instruct: ${instruction}\nQuery: ${query}`;
}

export function l2Norm(v: number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

export function assertNormalizedEmbedding(
  v: number[],
  expectedDim: number,
  epsilon = 1e-3,
): void {
  if (v.length !== expectedDim) {
    throw new EmbeddingProviderError(
      `expected_dim_${expectedDim}_got_${v.length}`,
      'INVALID_DIMENSION',
      false,
    );
  }
  for (const x of v) {
    if (!Number.isFinite(x)) {
      throw new EmbeddingProviderError('non_finite_component', 'NORMALIZATION_FAILED', false);
    }
  }
  const n = l2Norm(v);
  if (Math.abs(n - 1) > epsilon) {
    throw new EmbeddingProviderError(
      `l2_norm_${n}_not_unit`,
      'NORMALIZATION_FAILED',
      false,
    );
  }
}
