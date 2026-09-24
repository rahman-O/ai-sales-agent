import assert from 'node:assert/strict';
import test from 'node:test';
import { CHUNK_PROFILE_ID, chunkText } from '@ai-sales-agent/knowledge-chunking';

test('knowledge service uses chunk_v1', () => {
  assert.equal(CHUNK_PROFILE_ID, 'chunk_v1');
  const parts = chunkText('A'.repeat(50));
  assert.equal(parts.length, 1);
});
