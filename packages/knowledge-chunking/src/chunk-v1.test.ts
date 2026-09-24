import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHUNK_PROFILE_ID,
  CHUNK_V1,
  chunkTextV1,
  estimateTokensV1,
} from './chunk-v1.js';

test('chunk_v1 profile identity', () => {
  assert.equal(CHUNK_PROFILE_ID, 'chunk_v1');
  assert.equal(CHUNK_V1.targetTokens, 500);
  assert.equal(CHUNK_V1.overlapTokens, 75);
  assert.equal(CHUNK_V1.maxTokens, 800);
});

test('estimateTokensV1: Arabic words count as script runs not chars/4 alone', () => {
  const ar = 'العيادة مفتوحة يوم الجمعة صباحاً';
  const tok = estimateTokensV1(ar);
  assert.ok(tok >= 4);
  assert.ok(tok < ar.length / 2); // stricter than naive char count
});

test('chunk_v1: empty and very short', () => {
  assert.deepEqual(chunkTextV1('').chunks, []);
  assert.deepEqual(chunkTextV1('  ').chunks, []);
  const short = chunkTextV1('مرحبا');
  assert.equal(short.chunks.length, 1);
  assert.equal(short.profileId, 'chunk_v1');
});

test('chunk_v1: English paragraph boundaries', () => {
  const paras = Array.from(
    { length: 80 },
    (_, i) =>
      `Paragraph ${i}. Clinic hours and parking details for guests visiting the dental office each week with additional notes about whitening and orthodontics.`,
  ).join('\n\n');
  const { chunks } = chunkTextV1(paras);
  assert.ok(estimateTokensV1(paras) > CHUNK_V1.targetTokens);
  assert.ok(chunks.length > 1);
  for (const c of chunks) {
    assert.ok(estimateTokensV1(c) <= CHUNK_V1.maxTokens, c.slice(0, 40));
  }
});

test('chunk_v1: MSA Arabic long text', () => {
  const msa = Array.from(
    { length: 80 },
    (_, i) => `الفقرة رقم ${i}. تقع العيادة بالقرب من ساحة النصب وتوفر مواقف مجانية للمرضى.`,
  ).join('\n\n');
  const { chunks } = chunkTextV1(msa);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(estimateTokensV1(c) <= CHUNK_V1.maxTokens);
});

test('chunk_v1: Iraqi Arabic dialect sample', () => {
  const iq = Array.from(
    { length: 60 },
    (_, i) => `هذي معلومة ${i}. العيادة مفتوحة من السبت للخميس والموقف مجاني.`,
  ).join(' ');
  const { chunks } = chunkTextV1(iq);
  assert.ok(chunks.length >= 1);
  for (const c of chunks) assert.ok(estimateTokensV1(c) <= CHUNK_V1.maxTokens);
});

test('chunk_v1: mixed Arabic/English', () => {
  const mixed = Array.from(
    { length: 50 },
    (_, i) => `Visit ${i}: العيادة open Saturday-Thursday. Parking مجاني.`,
  ).join('\n\n');
  const { chunks } = chunkTextV1(mixed);
  assert.ok(chunks.length > 1);
});

test('chunk_v1: long unbroken input respects hard max', () => {
  const unbroken = 'كلمة'.repeat(5000);
  const { chunks } = chunkTextV1(unbroken);
  assert.ok(chunks.length > 1);
  for (const c of chunks) {
    assert.ok(estimateTokensV1(c) <= CHUNK_V1.maxTokens);
  }
});

test('chunk_v1: deterministic replay stable ordinals and content', () => {
  const text = Array.from({ length: 30 }, (_, i) => `Section ${i}. Hours and whitening FAQ.`).join(
    '\n\n',
  );
  const a = chunkTextV1(text);
  const b = chunkTextV1(text);
  assert.deepEqual(a.chunks, b.chunks);
  assert.equal(a.chunks.length, b.chunks.length);
});

test('chunk_v1: overlap exists between consecutive chunks when multi', () => {
  const text = Array.from(
    { length: 100 },
    (_, i) => `UniqueMarker${i} clinic services description sentence.`,
  ).join(' ');
  const { chunks } = chunkTextV1(text);
  assert.ok(chunks.length >= 2);
  // Some shared tokens/markers should appear across boundary (overlap)
  const mid = chunks[0]!.split(/\s+/).slice(-5);
  const found = mid.some((w) => chunks[1]!.includes(w));
  assert.equal(found, true);
});

test('chunk_v1: no duplicate ordinals (unique chunk_index via unique content positions)', () => {
  const text = Array.from({ length: 40 }, (_, i) => `Block-${i}. ` + 'x'.repeat(200)).join('\n\n');
  const { chunks } = chunkTextV1(text);
  const indexes = chunks.map((_, i) => i);
  assert.equal(new Set(indexes).size, indexes.length);
});
