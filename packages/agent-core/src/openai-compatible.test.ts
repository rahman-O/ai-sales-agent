import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAiCompatibleModelProvider, resolveProductionProvider } from './openai-compatible.js';

test('OpenAI-compatible adapter parses JSON decision via inject fetch', async () => {
  const provider = new OpenAiCompatibleModelProvider({
    apiKey: 'test-key',
    model: 'gpt-test',
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          id: 'req-1',
          choices: [{ message: { content: JSON.stringify({ type: 'final_response', text: 'hi', claims: [] }) } }],
          usage: { prompt_tokens: 1, completion_tokens: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  });
  const result = await provider.generate({
    messages: [{ role: 'user', content: 'x' }],
    tools: [],
    responseSchemaHint: 'AgentDecision',
    budget: {},
    deadlineMs: 5000,
    traceContext: {},
  });
  assert.equal((result.decision as { type: string }).type, 'final_response');
  assert.equal(result.model, 'gpt-test');
});

test('resolveProductionProvider fails closed without key', () => {
  assert.equal(resolveProductionProvider({ NODE_ENV: 'production' }), null);
  assert.ok(resolveProductionProvider({ AI_MODEL_API_KEY: 'sk-x', AI_MODEL_NAME: 'm' }));
});

test('Fake is never returned by resolveProductionProvider', () => {
  const p = resolveProductionProvider({ NODE_ENV: 'development', AI_ALLOW_FAKE: 'true' });
  assert.equal(p, null);
});
