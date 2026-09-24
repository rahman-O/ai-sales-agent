import { createHash } from 'node:crypto';
import {
  ACCEPTED_EMBEDDING_PROFILE,
  EmbeddingProviderError,
  type EmbedResult,
  type EmbeddingProvider,
} from './ports.js';

/**
 * Deterministic Fake for unit/integration tests only.
 * MUST NEVER be used in production (no env escape hatch).
 */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'fake';
  readonly model = 'fake-hash-v1';
  readonly dimension: number;
  readonly profileId: string;

  constructor(dimension: number = ACCEPTED_EMBEDDING_PROFILE.dimension) {
    this.dimension = dimension;
    this.profileId = `fake_dim_${dimension}`;
  }

  private vectorFor(text: string): number[] {
    const norm = text.normalize('NFKC').toLowerCase().trim();
    const v = new Array<number>(this.dimension).fill(0);
    // Character n-grams → sparse-ish unit vector (stable, language-agnostic).
    for (let i = 0; i < norm.length; i++) {
      const tri = norm.slice(i, i + 3);
      if (tri.length < 1) continue;
      const h = createHash('sha256').update(tri).digest();
      const idx = h.readUInt32BE(0) % this.dimension;
      const sign = h[4]! & 1 ? 1 : -1;
      v[idx]! += sign * (1 + (h[5]! % 5) / 5);
    }
    // Mix whole-string hash so identical strings match exactly.
    const whole = createHash('sha256').update(norm).digest();
    for (let i = 0; i < 32; i++) {
      const idx = whole[i]! % this.dimension;
      v[idx]! += 2;
    }
    let mag = 0;
    for (const x of v) mag += x * x;
    mag = Math.sqrt(mag) || 1;
    return v.map((x) => x / mag);
  }

  async embedDocuments(texts: string[]): Promise<EmbedResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new EmbeddingProviderError(
        'FakeEmbeddingProvider forbidden in production',
        'PERMANENT_EMBEDDING_ERROR',
        false,
      );
    }
    return {
      vectors: texts.map((t) => this.vectorFor(t)),
      model: this.model,
      dimension: this.dimension,
      providerRequestId: `fake-doc-${texts.length}`,
      usage: { inputTokens: null, estimated: true },
    };
  }

  async embedQuery(text: string): Promise<EmbedResult> {
    return this.embedDocuments([text]);
  }
}
