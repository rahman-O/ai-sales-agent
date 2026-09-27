/**
 * Local OpenAI-compatible Path B safety: loopback-only dummy keys + local timeout overrides.
 * Does not weaken production DEFAULT_LIMITS unless base URL is approved loopback.
 */
import type { AgentLimits } from './ports.js';

const DUMMY_KEY_PATTERN =
  /^(local|ollama|dummy|test|placeholder|changeme|sk-local|none|not-a-key|your-.*|xxx+)$/i;

/** Hosts treated as local inference (never cloud). */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isDummyModelApiKey(key: string): boolean {
  const k = key.trim();
  if (!k) return true;
  return DUMMY_KEY_PATTERN.test(k);
}

export function isApprovedLoopbackBaseUrl(baseUrl: string | undefined | null): boolean {
  const raw = baseUrl?.trim();
  if (!raw) return false;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
    const u = new URL(withScheme);
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return LOOPBACK_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function isApprovedDockerOllamaBaseUrl(
  baseUrl: string | undefined | null,
  options?: { demoDockerLocalLlm?: string | boolean; nodeEnv?: string },
): boolean {
  const raw = baseUrl?.trim();
  if (!raw) return false;
  if (options?.nodeEnv === 'production') return false;
  const isDemoFlag =
    options?.demoDockerLocalLlm === '1' ||
    options?.demoDockerLocalLlm === true ||
    options?.demoDockerLocalLlm === 'true';
  if (!isDemoFlag) return false;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
    const u = new URL(withScheme);
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'ollama';
  } catch {
    return false;
  }
}

/**
 * Dummy/placeholder keys are allowed only when AI_MODEL_BASE_URL is loopback
 * OR hostname is exactly 'ollama' with DEMO_DOCKER_LOCAL_LLM=1 and NODE_ENV != production.
 * Missing base URL defaults to OpenAI cloud → reject dummy keys.
 */
export function assertDummyKeyLoopbackSafe(
  apiKey: string,
  baseUrl: string | undefined | null,
  options?:
    | { demoDockerLocalLlm?: string | boolean; nodeEnv?: string }
    | Record<string, string | undefined>,
): void {
  if (!isDummyModelApiKey(apiKey)) return;
  if (isApprovedLoopbackBaseUrl(baseUrl)) return;

  const demoDocker =
    options && 'DEMO_DOCKER_LOCAL_LLM' in options
      ? options.DEMO_DOCKER_LOCAL_LLM
      : options && 'demoDockerLocalLlm' in options
        ? (options as { demoDockerLocalLlm?: string | boolean }).demoDockerLocalLlm
        : process.env.DEMO_DOCKER_LOCAL_LLM;

  const nodeEnv =
    options && 'NODE_ENV' in options
      ? options.NODE_ENV
      : options && 'nodeEnv' in options
        ? (options as { nodeEnv?: string }).nodeEnv
        : process.env.NODE_ENV;

  if (isApprovedDockerOllamaBaseUrl(baseUrl, { demoDockerLocalLlm: demoDocker, nodeEnv })) {
    return;
  }

  throw Object.assign(new Error('dummy_ai_model_api_key_requires_loopback_base_url'), {
    code: 'DUMMY_KEY_NOT_LOOPBACK',
  });
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/** Safer local-demo defaults when AI_MODEL_LOCAL_TIMEOUTS=1 on loopback (not production globals). */
export const LOCAL_DEMO_LIMIT_DEFAULTS = {
  modelTimeoutMs: 360_000,
  runDeadlineMs: 900_000,
} as const;

export const DEEPSEEK_LIMIT_DEFAULTS = {
  modelTimeoutMs: 120_000,
  runDeadlineMs: 300_000,
} as const;

/**
 * Timeout overrides apply only when base URL is approved loopback or approved docker ollama.
 * Production cloud path keeps DEFAULT_LIMITS unless caller passes other limits.
 */
export function resolveLocalDemoLimits(
  env: Record<string, string | undefined>,
): Partial<AgentLimits> | undefined {
  const baseUrl = env.AI_MODEL_BASE_URL;
  const isLoopback = isApprovedLoopbackBaseUrl(baseUrl);
  const isDockerOllama = isApprovedDockerOllamaBaseUrl(baseUrl, {
    demoDockerLocalLlm: env.DEMO_DOCKER_LOCAL_LLM,
    nodeEnv: env.NODE_ENV,
  });
  if (!isLoopback && !isDockerOllama) return undefined;

  const explicitTimeout = parsePositiveInt(env.AI_MODEL_TIMEOUT_MS);
  const explicitDeadline = parsePositiveInt(env.AI_RUN_DEADLINE_MS);
  const useLocalDefaults = env.AI_MODEL_LOCAL_TIMEOUTS === '1';

  if (explicitTimeout == null && explicitDeadline == null && !useLocalDefaults) {
    return undefined;
  }

  return {
    ...(useLocalDefaults
      ? {
          modelTimeoutMs: LOCAL_DEMO_LIMIT_DEFAULTS.modelTimeoutMs,
          runDeadlineMs: LOCAL_DEMO_LIMIT_DEFAULTS.runDeadlineMs,
        }
      : {}),
    ...(explicitTimeout != null ? { modelTimeoutMs: explicitTimeout } : {}),
    ...(explicitDeadline != null ? { runDeadlineMs: explicitDeadline } : {}),
  } as Partial<AgentLimits>;
}

export function resolveProviderLimits(
  env: Record<string, string | undefined>,
): Partial<AgentLimits> | undefined {
  const provider = env.AI_PROVIDER?.trim().toLowerCase();
  if (provider === 'deepseek') {
    const explicitTimeout = parsePositiveInt(env.DEEPSEEK_TIMEOUT_MS);
    const explicitDeadline = parsePositiveInt(env.DEEPSEEK_RUN_DEADLINE_MS) ?? parsePositiveInt(env.AI_RUN_DEADLINE_MS);
    return {
      modelTimeoutMs: explicitTimeout ?? DEEPSEEK_LIMIT_DEFAULTS.modelTimeoutMs,
      runDeadlineMs: explicitDeadline ?? DEEPSEEK_LIMIT_DEFAULTS.runDeadlineMs,
    } as Partial<AgentLimits>;
  }
  return resolveLocalDemoLimits(env);
}

/** Hardware-fit gate for 16GB Intel MBP 2018 class hosts (Path B). */
export const PATH_B_HARDWARE_FIT = {
  hostClass: 'MacBookPro15,2_16GB_Intel',
  maxParameterBillions: 7,
  preferredQuant: ['Q4_K', 'Q4_K_M', 'Q5_K', 'Q5_K_M', 'Q4_0', 'Q5_0'],
  maxExpectedMemoryGb: 10,
} as const;

export type ModelFitInput = {
  parameterBillions: number;
  expectedMemoryGb: number;
  quantization?: string;
};

export type ModelFitResult =
  | { ok: true; reason: string }
  | { ok: false; reason: string };

export function evaluateHardwareFit(model: ModelFitInput): ModelFitResult {
  if (model.parameterBillions > PATH_B_HARDWARE_FIT.maxParameterBillions) {
    return {
      ok: false,
      reason: `parameter_billions_${model.parameterBillions}_exceeds_max_${PATH_B_HARDWARE_FIT.maxParameterBillions}`,
    };
  }
  if (model.expectedMemoryGb > PATH_B_HARDWARE_FIT.maxExpectedMemoryGb) {
    return {
      ok: false,
      reason: `expected_memory_gb_${model.expectedMemoryGb}_exceeds_max_${PATH_B_HARDWARE_FIT.maxExpectedMemoryGb}`,
    };
  }
  return {
    ok: true,
    reason: `fit_le_${PATH_B_HARDWARE_FIT.maxParameterBillions}b_mem_le_${PATH_B_HARDWARE_FIT.maxExpectedMemoryGb}gb`,
  };
}
