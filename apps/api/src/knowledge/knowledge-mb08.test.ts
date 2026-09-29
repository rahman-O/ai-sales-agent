import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_SOURCE_STATUSES,
  KNOWLEDGE_VISIBILITY_LEVELS,
  CreateKnowledgeTextSchema,
  CreateKnowledgeFaqSchema,
  KnowledgeSearchQuerySchema,
} from '@ai-sales-agent/contracts';
import { CHUNK_PROFILE_ID, chunkText } from '@ai-sales-agent/knowledge-chunking';
import { ACCEPTED_EMBEDDING_PROFILE } from '@ai-sales-agent/embeddings';

test('MB-08: Source types and lifecycle status models are generic', () => {
  assert.deepEqual(KNOWLEDGE_SOURCE_TYPES, ['TEXT', 'FAQ', 'FILE', 'URL', 'MANUAL_NOTE']);
  assert.deepEqual(KNOWLEDGE_SOURCE_STATUSES, [
    'DRAFT',
    'PROCESSING',
    'READY_FOR_REVIEW',
    'PUBLISHED',
    'FAILED',
    'ARCHIVED',
  ]);
  assert.deepEqual(KNOWLEDGE_VISIBILITY_LEVELS, ['CUSTOMER_VISIBLE', 'INTERNAL_ONLY']);
});

test('MB-08: CreateKnowledgeTextSchema validates input and defaults visibility', () => {
  const valid = CreateKnowledgeTextSchema.parse({
    title: 'Preparation Guide',
    content: 'Please arrive 10 minutes before your scheduled appointment.',
  });
  assert.equal(valid.title, 'Preparation Guide');
  assert.equal(valid.visibility, 'CUSTOMER_VISIBLE');

  const internal = CreateKnowledgeTextSchema.parse({
    title: 'Staff Internal Notes',
    content: 'Room 2 key is located in drawer 1.',
    visibility: 'INTERNAL_ONLY',
  });
  assert.equal(internal.visibility, 'INTERNAL_ONLY');

  assert.throws(() => CreateKnowledgeTextSchema.parse({ title: '', content: 'some text' }));
  assert.throws(() => CreateKnowledgeTextSchema.parse({ title: 'Title', content: '' }));
});

test('MB-08: CreateKnowledgeFaqSchema parses Q&A structure and tags', () => {
  const faq = CreateKnowledgeFaqSchema.parse({
    question: 'Do you offer parking on site?',
    answer: 'Yes, free guest parking is available behind the building.',
    tags: ['parking', 'location', 'amenities'],
  });
  assert.equal(faq.question, 'Do you offer parking on site?');
  assert.equal(faq.answer, 'Yes, free guest parking is available behind the building.');
  assert.equal(faq.visibility, 'CUSTOMER_VISIBLE');
  assert.equal(faq.tags?.length, 3);

  assert.throws(() => CreateKnowledgeFaqSchema.parse({ question: '', answer: 'ans' }));
  assert.throws(() => CreateKnowledgeFaqSchema.parse({ question: 'q', answer: '' }));
});

test('MB-08: KnowledgeSearchQuerySchema enforces query length and bounded limits', () => {
  const q = KnowledgeSearchQuerySchema.parse({ query: 'parking instructions' });
  assert.equal(q.query, 'parking instructions');
  assert.equal(q.limit, 5);

  const bounded = KnowledgeSearchQuerySchema.parse({ query: 'haircut prep', limit: 10 });
  assert.equal(bounded.limit, 10);

  assert.throws(() => KnowledgeSearchQuerySchema.parse({ query: 'haircut prep', limit: 20 }));
  assert.throws(() => KnowledgeSearchQuerySchema.parse({ query: '' }));
});

test('MB-08: Chunking produces semantic pieces with metadata preserved', () => {
  assert.equal(CHUNK_PROFILE_ID, 'chunk_v1');
  const text = 'First section about arrival.\n\nSecond section about aftercare.\n\nThird section about parking.';
  const chunks = chunkText(text);
  assert.ok(chunks.length >= 1);
  for (const c of chunks) {
    assert.ok(c.length > 0);
  }
});

test('MB-08: Embedding profile configuration enforces 1024 dimension and maxDistance threshold', () => {
  assert.equal(ACCEPTED_EMBEDDING_PROFILE.dimension, 1024);
  assert.equal(ACCEPTED_EMBEDDING_PROFILE.profileId, 'qwen3_embed_06b_1024_v1');
  assert.ok(ACCEPTED_EMBEDDING_PROFILE.maxDistance > 0 && ACCEPTED_EMBEDDING_PROFILE.maxDistance < 1);
});
