import assert from 'node:assert/strict';
import test from 'node:test';
import { createToolExecutor } from './tool-executor.js';

test('MB-06 policy read tool is registered as read-only with typed policy input', () => {
  const executor = createToolExecutor({} as never, { toolSecret: 'test' });
  const tool = executor.listTools().find((entry) => entry.name === 'getEffectivePolicy');
  assert.ok(tool);
  assert.equal(tool.classification, 'read');
  assert.deepEqual(tool.inputSchema.required, ['policyType']);
});
