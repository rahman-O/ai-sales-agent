/**
 * OpenAI-compatible structured-output adapter (interim while P00 vendor open).
 * Does not import business domain. Live HTTP optional; contract tests use inject.
 */
import type { ModelGenerateInput, ModelGenerateResult, ModelProvider } from './ports.js';

export interface OpenAiCompatibleConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  fetchImpl?: typeof fetch;
}

export class OpenAiCompatibleModelProvider implements ModelProvider {
  readonly id = 'openai_compatible';
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async generate(input: ModelGenerateInput): Promise<ModelGenerateResult> {
    const base = (this.config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.deadlineMs);
    try {
      const res = await this.fetchImpl(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: input.messages,
          tools: input.tools.map((t) => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.parameters },
          })),
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        throw Object.assign(new Error(`provider_http_${res.status}`), {
          code: retryable ? 'TRANSIENT' : 'PERMANENT',
          retryable,
        });
      }
      const body = (await res.json()) as {
        id?: string;
        choices?: Array<{ message?: { content?: string; tool_calls?: unknown } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = body.choices?.[0]?.message?.content ?? '{}';
      let decision: unknown;
      try {
        decision = JSON.parse(content);
      } catch {
        decision = { type: 'safe_stop', reason: 'unparseable_provider_json' };
      }
      return {
        decision,
        finishReason: 'stop',
        usage: {
          inputTokens: body.usage?.prompt_tokens,
          outputTokens: body.usage?.completion_tokens,
          estimated: body.usage == null,
        },
        providerRequestId: body.id ?? `oai-${Date.now()}`,
        model: this.config.model,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Fail closed: production must not fall back to Fake. */
export function resolveProductionProvider(env: Record<string, string | undefined>): ModelProvider | null {
  const key = env.AI_MODEL_API_KEY?.trim();
  if (key) {
    return new OpenAiCompatibleModelProvider({
      apiKey: key,
      baseUrl: env.AI_MODEL_BASE_URL,
      model: env.AI_MODEL_NAME ?? 'gpt-4o-mini',
    });
  }
  if (env.NODE_ENV === 'production' && env.AI_ALLOW_FAKE !== 'true') {
    return null;
  }
  return null;
}
