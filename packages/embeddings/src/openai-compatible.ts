import {
  EmbeddingProviderError,
  type EmbedResult,
  type EmbeddingProvider,
} from './ports.js';

export interface OpenAiCompatibleEmbeddingConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  dimension?: number;
  profileId?: string;
  fetchImpl?: typeof fetch;
}

/**
 * OpenAI-compatible embeddings HTTP adapter. Vendor types do not leak.
 */
export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openai_compatible';
  readonly model: string;
  readonly dimension: number;
  readonly profileId: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAiCompatibleEmbeddingConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = config.model ?? 'text-embedding-3-small';
    this.dimension = config.dimension ?? 1536;
    this.profileId = config.profileId ?? 'openai_compat_optional';
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async embed(texts: string[], deadlineMs: number): Promise<EmbedResult> {
    if (!texts.length) {
      return {
        vectors: [],
        model: this.model,
        dimension: this.dimension,
        providerRequestId: 'empty',
        usage: { inputTokens: 0, estimated: false },
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        throw new EmbeddingProviderError(
          `embedding_http_${res.status}`,
          retryable ? 'TRANSIENT_EMBEDDING_ERROR' : 'PERMANENT_EMBEDDING_ERROR',
          retryable,
        );
      }
      const body = (await res.json()) as {
        data?: Array<{ embedding: number[]; index: number }>;
        usage?: { prompt_tokens?: number; total_tokens?: number };
        id?: string;
      };
      const sorted = [...(body.data ?? [])].sort((a, b) => a.index - b.index);
      const vectors = sorted.map((d) => d.embedding);
      for (const v of vectors) {
        if (v.length !== this.dimension) {
          throw new EmbeddingProviderError(
            `expected_dim_${this.dimension}_got_${v.length}`,
            'INVALID_DIMENSION',
            false,
          );
        }
        for (const x of v) {
          if (!Number.isFinite(x)) {
            throw new EmbeddingProviderError('non_finite_component', 'CONTENT_REJECTED', false);
          }
        }
      }
      return {
        vectors,
        model: this.model,
        dimension: this.dimension,
        providerRequestId: body.id ?? `emb-${Date.now()}`,
        usage: {
          inputTokens: body.usage?.prompt_tokens ?? body.usage?.total_tokens ?? null,
          estimated: body.usage == null,
        },
      };
    } catch (e) {
      if (e instanceof EmbeddingProviderError) throw e;
      if ((e as Error)?.name === 'AbortError') {
        throw new EmbeddingProviderError('embedding_timeout', 'INGESTION_TIMEOUT', true);
      }
      throw new EmbeddingProviderError(String(e), 'TRANSIENT_EMBEDDING_ERROR', true);
    } finally {
      clearTimeout(timer);
    }
  }

  embedDocuments(texts: string[], opts?: { deadlineMs?: number }): Promise<EmbedResult> {
    return this.embed(texts, opts?.deadlineMs ?? 60_000);
  }

  embedQuery(text: string, opts?: { deadlineMs?: number }): Promise<EmbedResult> {
    return this.embed([text], opts?.deadlineMs ?? 15_000);
  }
}

/** Optional future OpenAI-compatible path — not P05 primary. Explicit key only. */
export function resolveProductionEmbeddingProvider(env: Record<string, string | undefined>): EmbeddingProvider | null {
  const key = env.AI_EMBEDDING_API_KEY?.trim();
  if (!key) return null;
  return new OpenAiCompatibleEmbeddingProvider({
    apiKey: key,
    baseUrl: env.AI_EMBEDDING_BASE_URL,
    model: env.AI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    dimension: Number(env.AI_EMBEDDING_DIMENSION) || 1536,
    profileId: 'openai_compat_optional',
  });
}

export function assertNotFakeInProduction(provider: EmbeddingProvider, nodeEnv?: string): void {
  if (nodeEnv === 'production' && provider.id === 'fake') {
    throw new EmbeddingProviderError(
      'FakeEmbeddingProvider forbidden in production',
      'PERMANENT_EMBEDDING_ERROR',
      false,
    );
  }
}
