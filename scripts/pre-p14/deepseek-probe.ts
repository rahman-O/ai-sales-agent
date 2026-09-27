/**
 * DeepSeek Provider Connectivity and Safe Agent Tool Probes.
 *
 * Validates:
 * 1. AI_PROVIDER=deepseek resolution
 * 2. Safe authentication & connectivity (if DEEPSEEK_API_KEY is configured)
 * 3. Model response & JSON AgentDecision schema conformance
 * 4. Safe tool calling probe (searchServices tool request -> tool result -> final response)
 * 5. Multi-step conversation loop
 *
 * Secrets are NEVER logged or echoed.
 */
import { AgentDecisionSchema } from '../../packages/contracts/src/agent.ts';
import {
  OpenAiCompatibleModelProvider,
  resolveAiProvider,
  resolveProviderLimits,
} from '../../packages/agent-core/src/openai-compatible.ts';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';

loadDemoCliEnv();

const API_KEY = process.env.DEEPSEEK_API_KEY?.trim();
const BASE_URL = process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com';
const MODEL = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat';
const TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 120_000);

const SYSTEM_PROMPT = `You are a JSON-only sales assistant. You must ALWAYS respond with a single JSON object matching the AgentDecision schema (camelCase keys only):
1. {"type":"tool_request","toolName":"searchServices","arguments":{"query":"haircut"}}
2. {"type":"final_response","text":"...","claims":[]}
3. {"type":"safe_stop","reason":"..."}
CRITICAL: For final_response, claims must be an empty array [] unless specific claims with 'kind' are verified. Never use snake_case keys (never tool_name). Put the decision JSON directly in your message content.`;

async function main() {
  console.log('--- DEEPSEEK PROVIDER PROBE ---');
  console.log(`PROVIDER: deepseek`);
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`MODEL: ${MODEL}`);
  console.log(`API_KEY_CONFIGURED: ${API_KEY ? 'YES' : 'NO'}`);

  if (!API_KEY || API_KEY === '<set-locally>' || API_KEY === 'your-api-key-here') {
    console.log('\n[INFO] DEEPSEEK_API_KEY is not set or is a placeholder.');
    console.log('Skipping live HTTP probe. Testing provider resolution and config validation only.\n');

    try {
      resolveAiProvider({ AI_PROVIDER: 'deepseek' });
      console.error('FAIL: Expected missing DEEPSEEK_API_KEY to throw an error.');
      process.exit(1);
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      if (err.code === 'MISSING_DEEPSEEK_API_KEY') {
        console.log('CONFIG_VALIDATION: PASS (missing key rejected safely)');
      } else {
        console.error('FAIL: Unexpected error code', err);
        process.exit(1);
      }
    }

    const resolved = resolveAiProvider({
      AI_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'sk-test-mock-key-placeholder',
      DEEPSEEK_BASE_URL: BASE_URL,
      DEEPSEEK_MODEL: MODEL,
    });
    console.log(`DEEPSEEK_PROVIDER_RESOLVED: ${resolved.provider ? 'YES' : 'NO'}`);
    console.log(`DEEPSEEK_PROVIDER_ID: ${resolved.provider?.id}`);
    console.log(`DEEPSEEK_LIMITS: ${JSON.stringify(resolveProviderLimits({ AI_PROVIDER: 'deepseek' }))}`);
    console.log('\nDEEPSEEK_PROBE_RESULT: SKIPPED_LIVE (no key provided, config valid)');
    return;
  }

  // Live DeepSeek test
  const provider = new OpenAiCompatibleModelProvider({
    id: 'deepseek',
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    model: MODEL,
  });

  console.log('\n[1/3] Testing DeepSeek Connectivity & Simple Final Response...');
  const res1 = await provider.generate({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: 'مرحبا، كيف حالك؟' },
    ],
    tools: [
      {
        name: 'searchServices',
        description: 'Search catalog services by query',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    ],
    responseSchemaHint: 'AgentDecision',
    budget: { maxTokens: 500 },
    deadlineMs: TIMEOUT_MS,
    traceContext: { probe: 'deepseek_simple' },
  });

  const parseResult1 = AgentDecisionSchema.safeParse(res1.decision);
  console.log(`DEEPSEEK_CONNECTIVITY: PASS`);
  console.log(`DEEPSEEK_AUTH: PASS`);
  console.log(`DEEPSEEK_MODEL_RESPONSE: PASS`);
  console.log(`DEEPSEEK_DECISION_SCHEMA: ${parseResult1.success ? 'PASS' : 'FAIL'}`);
  console.log(`DEEPSEEK_USAGE: inputTokens=${res1.usage.inputTokens}, outputTokens=${res1.usage.outputTokens}`);

  console.log('\n[2/3] Testing DeepSeek Tool Calling (searchServices)...');
  const res2 = await provider.generate({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: 'ما هي الخدمات المتوفرة لديكم للعناية بالبشرة؟' },
    ],
    tools: [
      {
        name: 'searchServices',
        description: 'Search catalog services by query',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    ],
    responseSchemaHint: 'AgentDecision',
    budget: { maxTokens: 500 },
    deadlineMs: TIMEOUT_MS,
    traceContext: { probe: 'deepseek_tool_calling' },
  });

  const parseResult2 = AgentDecisionSchema.safeParse(res2.decision);
  const decision2 = res2.decision as { type?: string; toolName?: string; arguments?: Record<string, unknown> };
  console.log(`DEEPSEEK_TOOL_DECISION_TYPE: ${decision2?.type}`);
  const isTool = decision2?.type === 'tool_request' && decision2?.toolName === 'searchServices';
  console.log(`DEEPSEEK_TOOL_CALLING: ${isTool && parseResult2.success ? 'PASS' : 'PARTIAL'}`);

  console.log('\n[3/3] Testing DeepSeek Multi-Step Loop Continuation...');
  const res3 = await provider.generate({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: 'ما هي الخدمات المتوفرة لديكم للعناية بالبشرة؟' },
      { role: 'assistant', content: JSON.stringify(decision2) },
      {
        role: 'tool',
        content: JSON.stringify({
          ok: true,
          code: 'OK',
          data: [
            { id: '00000000-0000-4000-8000-000000000001', name: 'تنظيف بشرة هيدرافاشيل', priceAmount: 250, durationMinutes: 60 },
          ],
        }),
      },
    ],
    tools: [
      {
        name: 'searchServices',
        description: 'Search catalog services by query',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    ],
    responseSchemaHint: 'AgentDecision',
    budget: { maxTokens: 500 },
    deadlineMs: TIMEOUT_MS,
    traceContext: { probe: 'deepseek_continuation' },
  });

  const parseResult3 = AgentDecisionSchema.safeParse(res3.decision);
  const decision3 = res3.decision as { type?: string; text?: string };
  console.log(`DEEPSEEK_CONTINUATION_DECISION_TYPE: ${decision3?.type}`);
  if (!parseResult3.success) {
    console.log(`DEEPSEEK_DECISION_PARSE_ERROR: ${JSON.stringify(parseResult3.error.issues)}`);
    console.log(`DEEPSEEK_RAW_DECISION: ${JSON.stringify(res3.decision)}`);
  }
  console.log(`DEEPSEEK_MULTI_STEP: ${decision3?.type === 'final_response' && parseResult3.success ? 'PASS' : 'PARTIAL'}`);

  console.log('\n[4/4] Testing Structured Retry Probe (controlled fixture)...');
  {
    let callCount = 0;
    const mockCustomFetch = async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
      callCount++;
      if (callCount === 1) {
        // First call: returns plain Arabic prose with no JSON
        return new Response(
          JSON.stringify({
            id: 'mock-probe-1',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'مرحباً بك، أهلاً وسهلاً في عيادتنا! كيف يمكنني مساعدتك اليوم؟',
                },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Second call (retry): returns valid AgentDecision JSON
      return new Response(
        JSON.stringify({
          id: 'mock-probe-2',
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  type: 'final_response',
                  text: 'أهلاً بك! كيف يمكنني مساعدتك؟',
                  claims: [],
                }),
              },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 35, completion_tokens: 20, total_tokens: 55 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const retryFixtureProvider = new OpenAiCompatibleModelProvider({
      id: 'deepseek',
      apiKey: 'sk-probe-fixture-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      fetchImpl: mockCustomFetch as unknown as typeof fetch,
    });

    const retryRes = await retryFixtureProvider.generate({
      messages: [{ role: 'user', content: 'مرحبا' }],
      responseSchemaHint: 'AgentDecision',
    });

    const isRecovered =
      callCount === 2 &&
      retryRes.decision.type === 'final_response' &&
      retryRes.usage.inputTokens === 55;

    console.log(`STRUCTURED_RETRY_PROBE: ${isRecovered ? 'PASS' : 'FAIL'}`);
    console.log(`STRUCTURED_RETRY_CALL_COUNT: ${callCount}`);
    console.log(`STRUCTURED_RETRY_RECOVERED_DECISION_TYPE: ${retryRes.decision.type}`);
  }

  console.log('\n--- DEEPSEEK PROBE COMPLETE ---');
}

main().catch((err) => {
  console.error('DEEPSEEK_PROBE_ERROR:', err.message || err);
  process.exit(1);
});
