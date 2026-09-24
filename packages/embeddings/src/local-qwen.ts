import {
  CANDIDATE_EMBEDDING_PROFILE,
  EmbeddingProviderError,
  assertNormalizedEmbedding,
  formatQwenQuery,
  type EmbedResult,
  type EmbeddingProvider,
} from './ports.js';

export interface LocalQwenConfig {
  baseUrl: string;
  model?: string;
  modelRevision?: string;
  dimension?: number;
  profileId?: string;
  expectedTeiSha?: string;
  fetchImpl?: typeof fetch;
  maxBatchSize?: number;
}

export interface TeiInfo {
  modelId?: string;
  modelSha?: string;
  version?: string;
  raw: unknown;
}

/**
 * Adapter for private Hugging Face Text Embeddings Inference (TEI).
 * Domain code must not call TEI HTTP directly.
 */
export class LocalQwenEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'local_qwen';
  readonly model: string;
  readonly dimension: number;
  readonly profileId: string;
  readonly modelRevision: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxBatchSize: number;
  private readonly expectedTeiSha?: string;

  constructor(config: LocalQwenConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model = config.model ?? CANDIDATE_EMBEDDING_PROFILE.model;
    this.modelRevision = config.modelRevision ?? CANDIDATE_EMBEDDING_PROFILE.modelRevision;
    this.dimension = config.dimension ?? CANDIDATE_EMBEDDING_PROFILE.dimension;
    this.profileId = config.profileId ?? CANDIDATE_EMBEDDING_PROFILE.profileId;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.maxBatchSize = config.maxBatchSize ?? 4;
    this.expectedTeiSha = config.expectedTeiSha;
  }

  async fetchInfo(deadlineMs = 10_000): Promise<TeiInfo> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/info`, { signal: controller.signal });
      if (!res.ok) {
        throw new EmbeddingProviderError(
          `tei_info_http_${res.status}`,
          'TEI_UNREACHABLE',
          true,
        );
      }
      const raw = await res.json();
      const modelId =
        (raw as { model_id?: string }).model_id ??
        (raw as { modelId?: string }).modelId ??
        (raw as { model?: string }).model;
      const modelSha =
        (raw as { model_sha?: string }).model_sha ??
        (raw as { sha?: string }).sha ??
        (raw as { revision?: string }).revision;
      const version =
        (raw as { version?: string }).version ??
        (raw as { docker_label?: string }).docker_label;
      return { modelId, modelSha, version, raw };
    } catch (e) {
      if (e instanceof EmbeddingProviderError) throw e;
      if ((e as Error)?.name === 'AbortError') {
        throw new EmbeddingProviderError('tei_info_timeout', 'INGESTION_TIMEOUT', true);
      }
      throw new EmbeddingProviderError(String(e), 'TEI_UNREACHABLE', true);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Fail if TEI is serving the wrong model/revision. */
  async assertHealthy(): Promise<TeiInfo> {
    const info = await this.fetchInfo();
    const idOk =
      !info.modelId ||
      info.modelId === this.model ||
      info.modelId.includes('Qwen3-Embedding-0.6B');
    if (!idOk) {
      throw new EmbeddingProviderError(
        `unexpected_model_${info.modelId}`,
        'TEI_WRONG_MODEL',
        false,
      );
    }
    if (this.expectedTeiSha && info.modelSha && !info.modelSha.startsWith(this.expectedTeiSha.slice(0, 7))) {
      // Soft: some TEI builds omit sha; if present must match pin prefix
      if (info.modelSha !== this.expectedTeiSha && !this.expectedTeiSha.startsWith(info.modelSha)) {
        throw new EmbeddingProviderError(
          `unexpected_revision_${info.modelSha}`,
          'TEI_WRONG_MODEL',
          false,
        );
      }
    }
    return info;
  }

  private async embedRaw(texts: string[], deadlineMs: number): Promise<EmbedResult> {
    if (!texts.length) {
      return {
        vectors: [],
        model: this.model,
        dimension: this.dimension,
        providerRequestId: 'empty',
        usage: { inputTokens: null, estimated: true },
      };
    }
    if (texts.length > this.maxBatchSize) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += this.maxBatchSize) {
        const part = await this.embedRaw(texts.slice(i, i + this.maxBatchSize), deadlineMs);
        out.push(...part.vectors);
      }
      return {
        vectors: out,
        model: this.model,
        dimension: this.dimension,
        providerRequestId: `batch-${texts.length}`,
        usage: { inputTokens: null, estimated: true },
      };
    }

    const deadline = Date.now() + deadlineMs;
    let attempt = 0;
    while (true) {
      attempt += 1;
      const remaining = Math.max(1000, deadline - Date.now());
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remaining);
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: texts, normalize: true }),
          signal: controller.signal,
        });
        if (res.status === 429 || res.status >= 500) {
          if (Date.now() >= deadline || attempt >= 8) {
            throw new EmbeddingProviderError(
              `tei_embed_http_${res.status}`,
              'TRANSIENT_EMBEDDING_ERROR',
              true,
            );
          }
          await new Promise((r) => setTimeout(r, 250 * attempt));
          continue;
        }
        if (!res.ok) {
          throw new EmbeddingProviderError(
            `tei_embed_http_${res.status}`,
            'PERMANENT_EMBEDDING_ERROR',
            false,
          );
        }
        const body = (await res.json()) as number[][] | { embeddings?: number[][] };
        const vectors = Array.isArray(body) ? body : (body.embeddings ?? []);
        if (vectors.length !== texts.length) {
          throw new EmbeddingProviderError(
            `embed_count_mismatch_${vectors.length}_${texts.length}`,
            'PERMANENT_EMBEDDING_ERROR',
            false,
          );
        }
        for (const v of vectors) {
          assertNormalizedEmbedding(v, this.dimension);
        }
        return {
          vectors,
          model: this.model,
          dimension: this.dimension,
          providerRequestId: `tei-${Date.now()}`,
          usage: { inputTokens: null, estimated: true },
        };
      } catch (e) {
        if (e instanceof EmbeddingProviderError) throw e;
        if ((e as Error)?.name === 'AbortError') {
          throw new EmbeddingProviderError('tei_embed_timeout', 'INGESTION_TIMEOUT', true);
        }
        if (Date.now() < deadline && attempt < 8) {
          await new Promise((r) => setTimeout(r, 250 * attempt));
          continue;
        }
        throw new EmbeddingProviderError(String(e), 'TEI_UNREACHABLE', true);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  embedDocuments(texts: string[], opts?: { deadlineMs?: number }): Promise<EmbedResult> {
    return this.embedRaw(texts, opts?.deadlineMs ?? 120_000);
  }

  embedQuery(text: string, opts?: { deadlineMs?: number }): Promise<EmbedResult> {
    return this.embedRaw([formatQwenQuery(text)], opts?.deadlineMs ?? 30_000);
  }
}

/** Resolve production/dev embedding provider. Never returns Fake. */
export function resolveEmbeddingProvider(env: Record<string, string | undefined>): EmbeddingProvider | null {
  const kind = (env.EMBEDDING_PROVIDER ?? 'local_qwen').trim();
  if (kind === 'local_qwen') {
    const base = env.EMBEDDING_LOCAL_BASE_URL?.trim() || 'http://127.0.0.1:8080';
    return new LocalQwenEmbeddingProvider({
      baseUrl: base,
      model: env.EMBEDDING_MODEL?.trim() || CANDIDATE_EMBEDDING_PROFILE.model,
      modelRevision: env.EMBEDDING_MODEL_REVISION?.trim() || CANDIDATE_EMBEDDING_PROFILE.modelRevision,
      expectedTeiSha: env.EMBEDDING_MODEL_REVISION?.trim() || CANDIDATE_EMBEDDING_PROFILE.modelRevision,
    });
  }
  if (kind === 'openai_compatible') {
    // Optional future — require explicit key; no silent use as P05 primary.
    const key = env.AI_EMBEDDING_API_KEY?.trim();
    if (!key) return null;
    // Lazy import avoided; callers can construct OpenAiCompatibleEmbeddingProvider.
    return null;
  }
  return null;
}
