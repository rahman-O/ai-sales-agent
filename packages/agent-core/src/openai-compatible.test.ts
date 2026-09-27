import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OpenAiCompatibleModelProvider,
  resolveAiProvider,
  resolveProductionProvider,
  resolveProviderLimits,
  DEEPSEEK_LIMIT_DEFAULTS,
  extractJson,
  normalizeMessagesForOpenAi,
} from './openai-compatible.js';

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
  const p2 = resolveProductionProvider({ AI_PROVIDER: 'fake', AI_ALLOW_FAKE: 'true' });
  assert.equal(p2, null);
});

test('resolveAiProvider supports AI_PROVIDER=local and preserves qwen2.5 defaults', () => {
  const res = resolveAiProvider({
    AI_PROVIDER: 'local',
    AI_MODEL_BASE_URL: 'http://127.0.0.1:11434/v1',
    AI_MODEL_NAME: 'qwen2.5:7b',
  });
  assert.equal(res.providerType, 'local');
  assert.equal(res.model, 'qwen2.5:7b');
  assert.ok(res.provider);
  assert.equal(res.provider.id, 'local_ollama');
});

test('resolveAiProvider supports AI_PROVIDER=deepseek with configured credentials', () => {
  const res = resolveAiProvider({
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'sk-deepseek-test-key-12345',
    DEEPSEEK_MODEL: 'deepseek-chat',
  });
  assert.equal(res.providerType, 'deepseek');
  assert.equal(res.model, 'deepseek-chat');
  assert.ok(res.provider);
  assert.equal(res.provider.id, 'deepseek');
});

test('resolveAiProvider fails fast without DEEPSEEK_API_KEY when AI_PROVIDER=deepseek', () => {
  assert.throws(
    () => resolveAiProvider({ AI_PROVIDER: 'deepseek' }),
    (err: Error & { code?: string }) => {
      assert.equal(err.code, 'MISSING_DEEPSEEK_API_KEY');
      assert.ok(!err.message.includes('sk-'));
      return true;
    },
  );
});

test('resolveAiProvider allows AI_PROVIDER=local without requiring DEEPSEEK_API_KEY', () => {
  assert.doesNotThrow(() => {
    const res = resolveAiProvider({
      AI_PROVIDER: 'local',
      AI_MODEL_BASE_URL: 'http://127.0.0.1:11434/v1',
    });
    assert.equal(res.providerType, 'local');
    assert.ok(res.provider);
  });
});

test('resolveAiProvider handles AI_PROVIDER=fake correctly', () => {
  const devFake = resolveAiProvider({ AI_PROVIDER: 'fake', NODE_ENV: 'development' });
  assert.equal(devFake.providerType, 'fake');
  assert.ok(devFake.provider);
  assert.equal(devFake.provider.id, 'fake');

  const prodFakeBlocked = resolveAiProvider({ AI_PROVIDER: 'fake', NODE_ENV: 'production' });
  assert.equal(prodFakeBlocked.providerType, 'fake');
  assert.equal(prodFakeBlocked.provider, null);
});

test('OpenAiCompatibleModelProvider normalizes errors into categorized codes without leaking secrets', async () => {
  const secretKey = 'super-secret-api-key-value-never-leak';

  // 401 Auth error
  const authProvider = new OpenAiCompatibleModelProvider({
    apiKey: secretKey,
    model: 'deepseek-chat',
    fetchImpl: async () => new Response('Unauthorized', { status: 401 }),
  });
  await assert.rejects(
    () =>
      authProvider.generate({
        messages: [{ role: 'user', content: 'hello' }],
        tools: [],
        responseSchemaHint: '',
        budget: {},
        deadlineMs: 5000,
        traceContext: {},
      }),
    (err: Error & { code?: string; retryable?: boolean }) => {
      assert.equal(err.code, 'AUTH_ERROR');
      assert.equal(err.retryable, false);
      assert.ok(!err.message.includes(secretKey));
      return true;
    },
  );

  // 429 Rate limit
  const rateLimitProvider = new OpenAiCompatibleModelProvider({
    apiKey: secretKey,
    model: 'deepseek-chat',
    fetchImpl: async () => new Response('Too Many Requests', { status: 429 }),
  });
  await assert.rejects(
    () =>
      rateLimitProvider.generate({
        messages: [{ role: 'user', content: 'hello' }],
        tools: [],
        responseSchemaHint: '',
        budget: {},
        deadlineMs: 5000,
        traceContext: {},
      }),
    (err: Error & { code?: string; retryable?: boolean }) => {
      assert.equal(err.code, 'RATE_LIMIT');
      assert.equal(err.retryable, true);
      return true;
    },
  );

  // 503 Server error
  const serverErrorProvider = new OpenAiCompatibleModelProvider({
    apiKey: secretKey,
    model: 'deepseek-chat',
    fetchImpl: async () => new Response('Service Unavailable', { status: 503 }),
  });
  await assert.rejects(
    () =>
      serverErrorProvider.generate({
        messages: [{ role: 'user', content: 'hello' }],
        tools: [],
        responseSchemaHint: '',
        budget: {},
        deadlineMs: 5000,
        traceContext: {},
      }),
    (err: Error & { code?: string; retryable?: boolean }) => {
      assert.equal(err.code, 'TRANSIENT_PROVIDER');
      assert.equal(err.retryable, true);
      return true;
    },
  );
});

test('resolveProviderLimits applies DeepSeek and local limits independently', () => {
  // DeepSeek limits defaults
  const deepseekDefault = resolveProviderLimits({ AI_PROVIDER: 'deepseek' });
  assert.deepEqual(deepseekDefault, {
    modelTimeoutMs: DEEPSEEK_LIMIT_DEFAULTS.modelTimeoutMs,
    runDeadlineMs: DEEPSEEK_LIMIT_DEFAULTS.runDeadlineMs,
  });

  // DeepSeek explicit overrides
  const deepseekExplicit = resolveProviderLimits({
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_TIMEOUT_MS: '60000',
    DEEPSEEK_RUN_DEADLINE_MS: '180000',
  });
  assert.deepEqual(deepseekExplicit, {
    modelTimeoutMs: 60000,
    runDeadlineMs: 180000,
  });

  // Local limits defaults
  const localDefault = resolveProviderLimits({
    AI_PROVIDER: 'local',
    AI_MODEL_BASE_URL: 'http://127.0.0.1:11434/v1',
    AI_MODEL_LOCAL_TIMEOUTS: '1',
  });
  assert.deepEqual(localDefault, {
    modelTimeoutMs: 360_000,
    runDeadlineMs: 900_000,
  });
});

import { normalizeMessagesForOpenAi } from './openai-compatible.js';

test('normalizeMessagesForOpenAi translates internal tool_request and tool results to OpenAI protocol', () => {
  const internalMessages = [
    { role: 'system' as const, content: 'system instructions' },
    { role: 'user' as const, content: 'I want a haircut' },
    {
      role: 'assistant' as const,
      content: JSON.stringify({
        type: 'tool_request',
        toolName: 'searchServices',
        arguments: { query: 'haircut' },
      }),
    },
    {
      role: 'tool' as const,
      content: JSON.stringify({ ok: true, code: 'OK', data: [{ id: 'srv-1', name: 'Haircut' }] }),
    },
    {
      role: 'assistant' as const,
      content: JSON.stringify({
        type: 'tool_request',
        toolName: 'getAvailableSlots',
        arguments: { serviceId: 'srv-1' },
      }),
    },
    {
      role: 'tool' as const,
      content: JSON.stringify({ ok: true, code: 'OK', data: { slots: [] } }),
    },
    {
      role: 'assistant' as const,
      content: JSON.stringify({
        type: 'final_response',
        text: 'Here are the slots',
        claims: [],
      }),
    },
  ];

  const upstream = normalizeMessagesForOpenAi(internalMessages);

  // A: assistant internal tool_request becomes an upstream assistant tool_calls message
  assert.equal(upstream[2].role, 'assistant');
  assert.equal(upstream[2].content, null);
  assert.ok(upstream[2].tool_calls);
  assert.equal(upstream[2].tool_calls[0].function.name, 'searchServices');
  assert.equal(upstream[2].tool_calls[0].function.arguments, '{"query":"haircut"}');

  // B & C: tool result receives matching tool_call_id
  assert.equal(upstream[3].role, 'tool');
  assert.equal(upstream[3].tool_call_id, upstream[2].tool_calls[0].id);
  assert.equal(upstream[3].tool_call_id, 'call_1');

  // D: multiple sequential tool calls get distinct deterministic IDs
  assert.equal(upstream[4].tool_calls?.[0].id, 'call_2');
  assert.equal(upstream[5].role, 'tool');
  assert.equal(upstream[5].tool_call_id, 'call_2');

  // E: ordinary assistant final responses remain normal content messages
  assert.equal(upstream[6].role, 'assistant');
  assert.equal(upstream[6].tool_calls, undefined);
  assert.ok(upstream[6].content?.includes('final_response'));

  // F: bare role=tool without tool_call_id is never generated
  assert.ok(upstream.filter((m) => m.role === 'tool').every((m) => Boolean(m.tool_call_id)));
});

test('OpenAiCompatibleModelProvider.generate sends normalized upstream messages to fetch', async () => {
  let capturedBody: { messages: unknown[] } | null = null;
  const provider = new OpenAiCompatibleModelProvider({
    apiKey: 'test-key',
    model: 'deepseek-chat',
    fetchImpl: async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          id: 'gen-1',
          choices: [{ message: { content: JSON.stringify({ type: 'final_response', text: 'ok', claims: [] }) } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });

  await provider.generate({
    messages: [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: JSON.stringify({ type: 'tool_request', toolName: 'searchServices' }) },
      { role: 'tool', content: JSON.stringify({ ok: true }) },
    ],
    tools: [],
    responseSchemaHint: '',
    budget: {},
    deadlineMs: 5000,
    traceContext: {},
  });

  assert.ok(capturedBody);
  const msgs = (capturedBody as { messages: Array<{ role: string; tool_calls?: unknown[]; tool_call_id?: string }> }).messages;
  assert.equal(msgs[1].role, 'assistant');
  assert.ok(msgs[1].tool_calls);
  assert.equal(msgs[2].role, 'tool');
  assert.equal(msgs[2].tool_call_id, 'call_1');
});

test('extractJson extracts valid JSON from markdown code fences and mixed prose', () => {

  // Pure JSON
  assert.deepEqual(extractJson('{"type":"final_response","text":"hello"}'), {
    type: 'final_response',
    text: 'hello',
  });

  // Markdown fenced JSON
  assert.deepEqual(
    extractJson('```json\n{"type":"tool_request","toolName":"searchServices","arguments":{"query":"dental"}}\n```'),
    { type: 'tool_request', toolName: 'searchServices', arguments: { query: 'dental' } },
  );

  // Markdown fence without language
  assert.deepEqual(
    extractJson('```\n{"type":"safe_stop","reason":"stop"}\n```'),
    { type: 'safe_stop', reason: 'stop' },
  );

  // Prose around JSON
  assert.deepEqual(
    extractJson('Here is the decision:\n{"type":"final_response","text":"hi","claims":[]}\nHope this helps!'),
    { type: 'final_response', text: 'hi', claims: [] },
  );

  // Invalid JSON
  assert.equal(extractJson('Just plain text without json'), null);
});

test('OpenAiCompatibleModelProvider maps native tool_calls response to AgentDecision tool_request', async () => {
  const provider = new OpenAiCompatibleModelProvider({
    apiKey: 'test-key',
    model: 'deepseek-chat',
    fetchImpl: async () => {
      return new Response(
        JSON.stringify({
          id: 'gen-2',
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_abc123',
                    type: 'function',
                    function: {
                      name: 'ensureLead',
                      arguments: '{"serviceId":"a0500001-0001-4001-8001-000000000001"}',
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });

  const res = await provider.generate({
    messages: [{ role: 'user', content: 'book me' }],
    tools: [],
    responseSchemaHint: '',
    budget: {},
    deadlineMs: 5000,
    traceContext: {},
  });

  assert.deepEqual(res.decision, {
    type: 'tool_request',
    toolName: 'ensureLead',
    arguments: { serviceId: 'a0500001-0001-4001-8001-000000000001' },
  });
});

test('Plain prose on first response triggers structured retry and succeeds if second is valid', async () => {
  let fetchCount = 0;
  let retryMessagesCaptured: unknown = null;

  const provider = new OpenAiCompatibleModelProvider({
    apiKey: 'test-key',
    model: 'deepseek-chat',
    fetchImpl: async (_url, init) => {
      fetchCount += 1;
      if (fetchCount === 1) {
        // Return pure conversational prose without JSON
        return new Response(
          JSON.stringify({
            id: 'gen-prose-1',
            choices: [{ message: { content: 'أهلاً وسهلاً بك في العيادة، كيف يمكنني مساعدتك؟' } }],
            usage: { prompt_tokens: 10, completion_tokens: 15 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      // Second attempt (retry) returns valid AgentDecision JSON
      const body = JSON.parse(init?.body as string);
      retryMessagesCaptured = body.messages;
      return new Response(
        JSON.stringify({
          id: 'gen-retry-2',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  type: 'final_response',
                  text: 'أهلاً وسهلاً بك في العيادة، كيف يمكنني مساعدتك؟',
                  claims: [],
                }),
              },
            },
          ],
          usage: { prompt_tokens: 25, completion_tokens: 20 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });

  const res = await provider.generate({
    messages: [{ role: 'user', content: 'مرحبا' }],
    tools: [],
    responseSchemaHint: '',
    budget: {},
    deadlineMs: 5000,
    traceContext: {},
  });

  assert.equal(fetchCount, 2);
  assert.deepEqual(res.decision, {
    type: 'final_response',
    text: 'أهلاً وسهلاً بك في العيادة، كيف يمكنني مساعدتك؟',
    claims: [],
  });
  assert.equal(res.usage.inputTokens, 35); // 10 + 25
  assert.equal(res.usage.outputTokens, 35); // 15 + 20
  assert.ok(Array.isArray(retryMessagesCaptured));
});

test('Two consecutive invalid prose responses fail closed with unparseable_provider_json', async () => {
  let fetchCount = 0;

  const provider = new OpenAiCompatibleModelProvider({
    apiKey: 'test-key',
    model: 'deepseek-chat',
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response(
        JSON.stringify({
          id: `gen-prose-${fetchCount}`,
          choices: [{ message: { content: 'كلام عادي بدون جيسون' } }],
          usage: { prompt_tokens: 10, completion_tokens: 10 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });

  const res = await provider.generate({
    messages: [{ role: 'user', content: 'مرحبا' }],
    tools: [],
    responseSchemaHint: '',
    budget: {},
    deadlineMs: 5000,
    traceContext: {},
  });

  assert.equal(fetchCount, 2); // exactly 1 retry
  assert.deepEqual(res.decision, {
    type: 'safe_stop',
    reason: 'unparseable_provider_json',
  });
});


