/**
 * OpenAI-compatible structured-output adapter (interim while P00 vendor open).
 * Does not import business domain. Live HTTP optional; contract tests use inject.
 */
import { assertDummyKeyLoopbackSafe } from './local-provider-guard.js';
import { FakeModelProvider } from './fake-provider.js';
import type { ModelGenerateInput, ModelGenerateResult, ModelProvider } from './ports.js';

export interface OpenAiCompatibleConfig {
  id?: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  fetchImpl?: typeof fetch;
}

export {
  assertDummyKeyLoopbackSafe,
  evaluateHardwareFit,
  isApprovedDockerOllamaBaseUrl,
  isApprovedLoopbackBaseUrl,
  isDummyModelApiKey,
  LOCAL_DEMO_LIMIT_DEFAULTS,
  DEEPSEEK_LIMIT_DEFAULTS,
  PATH_B_HARDWARE_FIT,
  resolveLocalDemoLimits,
  resolveProviderLimits,
} from './local-provider-guard.js';
export type { ModelFitInput, ModelFitResult } from './local-provider-guard.js';

export interface NormalizedUpstreamMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch?.[1]) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        // continue
      }
    }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        // continue
      }
    }
    return null;
  }
}

/**
 * Normalizes internal Agent Core messages into strict OpenAI/DeepSeek chat completion schema:
 * 1. Historical tool_request assistant decisions -> role: 'assistant' with tool_calls
 * 2. Historical tool results -> role: 'tool' with matching tool_call_id
 */
export function normalizeMessagesForOpenAi(
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>,
): NormalizedUpstreamMessage[] {
  const result: NormalizedUpstreamMessage[] = [];
  let callCounter = 0;
  let lastAssistantToolCallId: string | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'assistant') {
      let isToolRequest = false;
      let toolName = '';
      let toolArgs = '{}';

      try {
        const parsed = extractJson(msg.content) as Record<string, unknown> | null;
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.type === 'tool_request' &&
          typeof parsed.toolName === 'string'
        ) {
          isToolRequest = true;
          toolName = parsed.toolName;
          toolArgs =
            typeof parsed.arguments === 'object' && parsed.arguments !== null
              ? JSON.stringify(parsed.arguments)
              : typeof parsed.arguments === 'string'
                ? parsed.arguments
                : '{}';
        }
      } catch {
        // Regular non-JSON assistant text
      }

      if (isToolRequest) {
        callCounter += 1;
        const callId = `call_${callCounter}`;
        lastAssistantToolCallId = callId;
        result.push({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: callId,
              type: 'function',
              function: {
                name: toolName,
                arguments: toolArgs,
              },
            },
          ],
        });
      } else {
        lastAssistantToolCallId = null;
        result.push({
          role: 'assistant',
          content: msg.content,
        });
      }
    } else if (msg.role === 'tool') {
      const toolCallId = lastAssistantToolCallId ?? `call_${callCounter || 1}`;
      result.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: msg.content,
      });
    } else {
      result.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return result;
}

export class OpenAiCompatibleModelProvider implements ModelProvider {
  readonly id: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.id = config.id ?? 'openai_compatible';
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async generate(input: ModelGenerateInput): Promise<ModelGenerateResult> {
    const base = (this.config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.deadlineMs);
    const upstreamMessages = normalizeMessagesForOpenAi(input.messages);
    try {
      let res: Response;
      try {
        res = await this.fetchImpl(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: upstreamMessages,
            tools: (input.tools ?? []).length > 0 ? (input.tools ?? []).map((t) => ({
              type: 'function',
              function: { name: t.name, description: t.description, parameters: t.parameters },
            })) : undefined,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          throw Object.assign(new Error('provider_timeout'), {
            code: 'TIMEOUT',
            retryable: true,
          });
        }
        throw Object.assign(new Error('provider_network_error'), {
          code: 'TRANSIENT_PROVIDER',
          retryable: true,
        });
      }

      if (!res.ok) {
        let code: string;
        let retryable = false;
        if (res.status === 401 || res.status === 403) {
          code = 'AUTH_ERROR';
          retryable = false;
        } else if (res.status === 429) {
          code = 'RATE_LIMIT';
          retryable = true;
        } else if (res.status >= 500) {
          code = 'TRANSIENT_PROVIDER';
          retryable = true;
        } else {
          code = 'PERMANENT_PROVIDER';
          retryable = false;
        }
        throw Object.assign(new Error(`provider_http_${res.status}`), {
          code,
          retryable,
        });
      }

      const body = (await res.json()) as {
        id?: string;
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id?: string;
              type?: string;
              function?: {
                name?: string;
                arguments?: string | Record<string, unknown>;
              };
            }>;
          };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      let decision: unknown = null;
      const message = body.choices?.[0]?.message;
      const nativeToolCalls = message?.tool_calls;
      if (Array.isArray(nativeToolCalls) && nativeToolCalls.length > 0) {
        const firstCall = nativeToolCalls[0];
        if (firstCall?.function?.name) {
          let parsedArgs: Record<string, unknown> = {};
          if (typeof firstCall.function.arguments === 'string') {
            try {
              parsedArgs = JSON.parse(firstCall.function.arguments);
            } catch {
              parsedArgs = {};
            }
          } else if (typeof firstCall.function.arguments === 'object' && firstCall.function.arguments !== null) {
            parsedArgs = firstCall.function.arguments as Record<string, unknown>;
          }
          decision = {
            type: 'tool_request',
            toolName: firstCall.function.name,
            arguments: parsedArgs,
          };
        }
      }

      let repairHttpStatus: number | null = null;
      let repairAttempted = false;
      let repairContentLength = 0;
      let inputTokens = body.usage?.prompt_tokens;
      let outputTokens = body.usage?.completion_tokens;

      if (!decision) {
        decision = typeof message?.content === 'string' ? extractJson(message.content) : null;
        if (!decision) {
          repairAttempted = true;
          // Exactly ONE bounded structured-output recovery attempt
          const retryMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }> = [
            ...input.messages,
            { role: 'assistant', content: message?.content?.trim() ? message.content : '[Empty provider output: no valid AgentDecision returned.]' },
            {
              role: 'user',
              content:
                'The previous response did not match the required AgentDecision JSON schema.\nReturn exactly one valid JSON object only.\nNo markdown.\nNo prose.\nNo explanation.',
            },
          ];
          try {
            const retryRes = await this.fetchImpl(`${base}/chat/completions`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: this.config.model,
                messages: normalizeMessagesForOpenAi(retryMessages),
                tools: (input.tools ?? []).length > 0 ? (input.tools ?? []).map((t) => ({
                  type: 'function',
                  function: { name: t.name, description: t.description, parameters: t.parameters },
                })) : undefined,
                response_format: { type: 'json_object' },
              }),
              signal: controller.signal,
            });
            repairHttpStatus = retryRes.status;
            if (retryRes.ok) {
              const retryBody = (await retryRes.json()) as {
                id?: string;
                choices?: Array<{
                  message?: {
                    content?: string | null;
                    tool_calls?: Array<{
                      id?: string;
                      type?: string;
                      function?: {
                        name?: string;
                        arguments?: string | Record<string, unknown>;
                      };
                    }>;
                  };
                }>;
                usage?: { prompt_tokens?: number; completion_tokens?: number };
              };
              const retryMsg = retryBody.choices?.[0]?.message;
              repairContentLength = retryMsg?.content?.length ?? 0;
              const retryNativeToolCalls = retryMsg?.tool_calls;
              if (Array.isArray(retryNativeToolCalls) && retryNativeToolCalls.length > 0) {
                const firstCall = retryNativeToolCalls[0];
                if (firstCall?.function?.name) {
                  let parsedArgs: Record<string, unknown> = {};
                  if (typeof firstCall.function.arguments === 'string') {
                    try {
                      parsedArgs = JSON.parse(firstCall.function.arguments);
                    } catch {
                      parsedArgs = {};
                    }
                  } else if (typeof firstCall.function.arguments === 'object' && firstCall.function.arguments !== null) {
                    parsedArgs = firstCall.function.arguments as Record<string, unknown>;
                  }
                  decision = {
                    type: 'tool_request',
                    toolName: firstCall.function.name,
                    arguments: parsedArgs,
                  };
                }
              }
              if (!decision && retryMsg?.content) {
                decision = extractJson(retryMsg.content);
              }
              if (retryBody.usage) {
                inputTokens = (inputTokens ?? 0) + (retryBody.usage.prompt_tokens ?? 0);
                outputTokens = (outputTokens ?? 0) + (retryBody.usage.completion_tokens ?? 0);
              }
            }
          } catch {
            // fail-closed on retry error
          }
        }
      }
      if (repairAttempted) console.info(JSON.stringify({ event: 'provider_structured_repair', agentRunId: input.traceContext.agentRunId, repairHttpStatus, recovered: Boolean(decision) }));

      if (!decision) {
        console.warn(JSON.stringify({ event: 'provider_decision_unparseable', agentRunId: input.traceContext.agentRunId, initialContentLength: message?.content?.length ?? 0, nativeToolCalls: nativeToolCalls?.length ?? 0, repairAttempted, repairHttpStatus, repairContentLength }));
        decision = { type: 'safe_stop', reason: 'unparseable_provider_json' };
      }
      return {
        decision,
        finishReason: 'stop',
        usage: {
          inputTokens,
          outputTokens,
          estimated: inputTokens == null,
        },
        providerRequestId: body.id ?? `${this.id}-${Date.now()}`,
        model: this.config.model,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export type AiProviderType = 'local' | 'deepseek' | 'fake';

export interface ResolvedAiProvider {
  providerType: AiProviderType;
  model: string;
  provider: ModelProvider | null;
}

/**
 * Provider factory supporting local, deepseek, and fake.
 * Fails fast on invalid configuration without leaking secrets.
 */
export function resolveAiProvider(
  env: Record<string, string | undefined>,
  options?: { fetchImpl?: typeof fetch },
): ResolvedAiProvider {
  const explicitProvider = env.AI_PROVIDER?.trim().toLowerCase();

  if (explicitProvider === 'deepseek') {
    const apiKey = env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      throw Object.assign(new Error('DEEPSEEK_API_KEY is required when AI_PROVIDER=deepseek'), {
        code: 'MISSING_DEEPSEEK_API_KEY',
      });
    }
    const baseUrl = env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com';
    const model = env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat';
    return {
      providerType: 'deepseek',
      model,
      provider: new OpenAiCompatibleModelProvider({
        id: 'deepseek',
        apiKey,
        baseUrl,
        model,
        fetchImpl: options?.fetchImpl,
      }),
    };
  }

  if (explicitProvider === 'fake') {
    if (env.NODE_ENV === 'production' && env.AI_ALLOW_FAKE !== 'true') {
      return {
        providerType: 'fake',
        model: 'fake',
        provider: null,
      };
    }
    return {
      providerType: 'fake',
      model: 'fake',
      provider: new FakeModelProvider({
        kind: 'final',
        text: 'Fake provider response',
      }),
    };
  }

  if (explicitProvider === 'local') {
    const key = env.AI_MODEL_API_KEY?.trim() || 'ollama';
    const baseUrl = env.AI_MODEL_BASE_URL?.trim() || 'http://127.0.0.1:11434/v1';
    const model = env.AI_MODEL_NAME?.trim() || 'qwen2.5:7b';
    assertDummyKeyLoopbackSafe(key, baseUrl, env);
    return {
      providerType: 'local',
      model,
      provider: new OpenAiCompatibleModelProvider({
        id: 'local_ollama',
        apiKey: key,
        baseUrl,
        model,
        fetchImpl: options?.fetchImpl,
      }),
    };
  }

  // Fallback: if AI_PROVIDER is not specified, maintain backward compatibility
  const key = env.AI_MODEL_API_KEY?.trim();
  if (key) {
    assertDummyKeyLoopbackSafe(key, env.AI_MODEL_BASE_URL, env);
    const model = env.AI_MODEL_NAME ?? 'gpt-4o-mini';
    return {
      providerType: 'local',
      model,
      provider: new OpenAiCompatibleModelProvider({
        apiKey: key,
        baseUrl: env.AI_MODEL_BASE_URL,
        model,
        fetchImpl: options?.fetchImpl,
      }),
    };
  }

  if (env.NODE_ENV === 'production' && env.AI_ALLOW_FAKE !== 'true') {
    return {
      providerType: 'local',
      model: env.AI_MODEL_NAME ?? 'qwen2.5:7b',
      provider: null,
    };
  }

  return {
    providerType: 'local',
    model: env.AI_MODEL_NAME ?? 'qwen2.5:7b',
    provider: null,
  };
}

/** Fail closed: production must not fall back to Fake. Dummy keys require loopback base URL. */
export function resolveProductionProvider(env: Record<string, string | undefined>): ModelProvider | null {
  try {
    const resolved = resolveAiProvider(env);
    if (resolved.providerType === 'fake') {
      return null; // Production resolver never returns Fake provider directly
    }
    return resolved.provider;
  } catch (err) {
    if (err instanceof Error && err.message.includes('dummy_ai_model_api_key')) {
      throw err;
    }
    return null;
  }
}
