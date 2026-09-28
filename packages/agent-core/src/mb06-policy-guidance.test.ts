import assert from 'node:assert/strict';
import test from 'node:test';
import { POLICY_BLOCK_FOR_TEST } from './context-builder.js';

test('MB-06 context forbids invented or executable informational policies', () => {
  assert.ok(POLICY_BLOCK_FOR_TEST.includes('Never invent a business policy'));
  assert.ok(POLICY_BLOCK_FOR_TEST.includes('INFORMATIONAL_ONLY policies do not authorize transactions'));
});
