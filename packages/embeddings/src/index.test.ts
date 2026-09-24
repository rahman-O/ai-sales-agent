import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeEmbeddingProvider } from './fake-provider.js';
import { resolveProductionEmbeddingProvider, assertNotFakeInProduction } from './openai-compatible.js';
import { resolveEmbeddingProvider, LocalQwenEmbeddingProvider } from './local-qwen.js';
import { cosineDistance, similarityFromDistance } from './similarity.js';
import { assertNormalizedEmbedding, formatQwenQuery, l2Norm } from './ports.js';

test('Fake vectors are deterministic and identical for same text', async () => {
  const p = new FakeEmbeddingProvider(32);
  const a = await p.embedQuery('تنظيف الأسنان');
  const b = await p.embedQuery('تنظيف الأسنان');
  assert.equal(a.vectors[0]!.length, 32);
  assert.deepEqual(a.vectors[0], b.vectors[0]);
  assert.ok(cosineDistance(a.vectors[0]!, b.vectors[0]!) < 1e-9);
});

test('similarity = 1 - distance', () => {
  assert.equal(similarityFromDistance(0.2), 0.8);
});

test('resolveProductionEmbeddingProvider requires AI_EMBEDDING_API_KEY only', () => {
  assert.equal(resolveProductionEmbeddingProvider({ AI_MODEL_API_KEY: 'sk-x' }), null);
  assert.ok(resolveProductionEmbeddingProvider({ AI_EMBEDDING_API_KEY: 'sk-emb' }));
});

test('resolveEmbeddingProvider defaults to local_qwen without API key', () => {
  const p = resolveEmbeddingProvider({});
  assert.ok(p instanceof LocalQwenEmbeddingProvider);
});

test('Fake forbidden in production via assert', () => {
  const p = new FakeEmbeddingProvider(8);
  assert.throws(() => assertNotFakeInProduction(p, 'production'));
});

test('formatQwenQuery uses Instruct/Query and leaves Arabic query intact', () => {
  const q = formatQwenQuery('وين العيادة؟');
  assert.match(q, /^Instruct: /);
  assert.match(q, /\nQuery: وين العيادة؟$/);
});

test('assertNormalizedEmbedding rejects wrong dim and non-unit', () => {
  assert.throws(() => assertNormalizedEmbedding([1, 0], 3));
  const unit = [1, 0, 0];
  assert.equal(Math.abs(l2Norm(unit) - 1) < 1e-9, true);
  assertNormalizedEmbedding(unit, 3);
});
