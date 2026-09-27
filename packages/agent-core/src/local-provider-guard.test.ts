import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertDummyKeyLoopbackSafe,
  evaluateHardwareFit,
  isApprovedDockerOllamaBaseUrl,
  isApprovedLoopbackBaseUrl,
  isDummyModelApiKey,
  resolveLocalDemoLimits,
  resolveProductionProvider,
} from './openai-compatible.js';

test('isApprovedLoopbackBaseUrl accepts loopback only', () => {
  assert.equal(isApprovedLoopbackBaseUrl('http://127.0.0.1:11434/v1'), true);
  assert.equal(isApprovedLoopbackBaseUrl('http://localhost:11434/v1'), true);
  assert.equal(isApprovedLoopbackBaseUrl(undefined), false);
  assert.equal(isApprovedLoopbackBaseUrl('https://api.openai.com/v1'), false);
  assert.equal(isApprovedLoopbackBaseUrl('https://openrouter.ai/api/v1'), false);
});

test('isApprovedDockerOllamaBaseUrl allows exact ollama hostname under demo flags only', () => {
  assert.equal(
    isApprovedDockerOllamaBaseUrl('http://ollama:11434/v1', {
      demoDockerLocalLlm: '1',
      nodeEnv: 'development',
    }),
    true,
  );
  // Rejects production
  assert.equal(
    isApprovedDockerOllamaBaseUrl('http://ollama:11434/v1', {
      demoDockerLocalLlm: '1',
      nodeEnv: 'production',
    }),
    false,
  );
  // Rejects missing demo flag
  assert.equal(
    isApprovedDockerOllamaBaseUrl('http://ollama:11434/v1', {
      demoDockerLocalLlm: '0',
      nodeEnv: 'development',
    }),
    false,
  );
  // Rejects arbitrary internal hosts
  assert.equal(
    isApprovedDockerOllamaBaseUrl('http://internal-ollama:11434/v1', {
      demoDockerLocalLlm: '1',
      nodeEnv: 'development',
    }),
    false,
  );
  assert.equal(
    isApprovedDockerOllamaBaseUrl('http://192.168.1.50:11434/v1', {
      demoDockerLocalLlm: '1',
      nodeEnv: 'development',
    }),
    false,
  );
});

test('isDummyModelApiKey detects placeholders', () => {
  assert.equal(isDummyModelApiKey('local'), true);
  assert.equal(isDummyModelApiKey('ollama'), true);
  assert.equal(isDummyModelApiKey('sk-proj-realishkeyvalue123'), false);
});

test('assertDummyKeyLoopbackSafe rejects dummy against cloud/default', () => {
  assert.throws(() => assertDummyKeyLoopbackSafe('local', undefined), /dummy_ai_model_api_key/);
  assert.throws(
    () => assertDummyKeyLoopbackSafe('local', 'https://api.openai.com/v1'),
    /dummy_ai_model_api_key/,
  );
  assert.doesNotThrow(() => assertDummyKeyLoopbackSafe('local', 'http://127.0.0.1:11434/v1'));
  assert.doesNotThrow(() =>
    assertDummyKeyLoopbackSafe('local', 'http://ollama:11434/v1', {
      DEMO_DOCKER_LOCAL_LLM: '1',
      NODE_ENV: 'development',
    }),
  );
  assert.throws(
    () =>
      assertDummyKeyLoopbackSafe('local', 'http://ollama:11434/v1', {
        DEMO_DOCKER_LOCAL_LLM: '0',
        NODE_ENV: 'development',
      }),
    /dummy_ai_model_api_key/,
  );
  assert.doesNotThrow(() =>
    assertDummyKeyLoopbackSafe('sk-proj-realishkeyvalue123', 'https://api.openai.com/v1'),
  );
});

test('resolveProductionProvider rejects dummy key without loopback or approved docker ollama', () => {
  assert.throws(
    () => resolveProductionProvider({ AI_MODEL_API_KEY: 'local', AI_MODEL_NAME: 'm' }),
    /dummy_ai_model_api_key/,
  );
  assert.ok(
    resolveProductionProvider({
      AI_MODEL_API_KEY: 'local',
      AI_MODEL_BASE_URL: 'http://127.0.0.1:11434/v1',
      AI_MODEL_NAME: 'probe',
    }),
  );
  assert.ok(
    resolveProductionProvider({
      AI_MODEL_API_KEY: 'local',
      AI_MODEL_BASE_URL: 'http://ollama:11434/v1',
      AI_MODEL_NAME: 'qwen2.5:1.5b',
      DEMO_DOCKER_LOCAL_LLM: '1',
      NODE_ENV: 'development',
    }),
  );
});

import { DEFAULT_LIMITS } from './ports.js';

test('resolveLocalDemoLimits only on loopback or approved docker ollama', () => {
  // A & F: Production cloud path keeps DEFAULT_LIMITS; local override cannot leak into production mode
  assert.equal(
    resolveLocalDemoLimits({
      AI_MODEL_BASE_URL: 'https://api.openai.com/v1',
      AI_MODEL_LOCAL_TIMEOUTS: '1',
      AI_MODEL_TIMEOUT_MS: '360000',
      AI_RUN_DEADLINE_MS: '900000',
    }),
    undefined,
  );
  assert.equal(DEFAULT_LIMITS.modelTimeoutMs, 15_000);
  assert.equal(DEFAULT_LIMITS.runDeadlineMs, 45_000);

  // B & C: Local demo defaults resolve to 360000ms model timeout and 900000ms run deadline
  const localDefaults = resolveLocalDemoLimits({
    AI_MODEL_BASE_URL: 'http://127.0.0.1:11434/v1',
    AI_MODEL_LOCAL_TIMEOUTS: '1',
  });
  assert.ok(localDefaults);
  assert.equal(localDefaults.modelTimeoutMs, 360_000);
  assert.equal(localDefaults.runDeadlineMs, 900_000);

  // Explicit overrides on loopback
  const explicit = resolveLocalDemoLimits({
    AI_MODEL_BASE_URL: 'http://localhost:8080/v1',
    AI_MODEL_TIMEOUT_MS: '360000',
    AI_RUN_DEADLINE_MS: '900000',
  });
  assert.deepEqual(explicit, { modelTimeoutMs: 360_000, runDeadlineMs: 900_000 });

  // Approved docker ollama host
  const dockerOllama = resolveLocalDemoLimits({
    AI_MODEL_BASE_URL: 'http://ollama:11434/v1',
    AI_MODEL_LOCAL_TIMEOUTS: '1',
    DEMO_DOCKER_LOCAL_LLM: '1',
    NODE_ENV: 'development',
  });
  assert.ok(dockerOllama);
  assert.equal(dockerOllama.modelTimeoutMs, 360_000);
  assert.equal(dockerOllama.runDeadlineMs, 900_000);

  // E: Invalid timeout values are rejected / ignored
  const invalidValues = resolveLocalDemoLimits({
    AI_MODEL_BASE_URL: 'http://127.0.0.1:11434/v1',
    AI_MODEL_LOCAL_TIMEOUTS: '1',
    AI_MODEL_TIMEOUT_MS: '-100',
    AI_RUN_DEADLINE_MS: 'not-a-number',
  });
  assert.deepEqual(invalidValues, { modelTimeoutMs: 360_000, runDeadlineMs: 900_000 });

  // D: Harness wait (500 * 2000 = 1,000,000ms) is greater than run deadline (900,000ms)
  const LOCAL_E2E_RUN_WAIT_MS = 500 * 2000;
  assert.ok(LOCAL_E2E_RUN_WAIT_MS > (localDefaults?.runDeadlineMs ?? 0));
});

test('evaluateHardwareFit rejects oversized models', () => {
  assert.equal(evaluateHardwareFit({ parameterBillions: 3, expectedMemoryGb: 4 }).ok, true);
  assert.equal(evaluateHardwareFit({ parameterBillions: 13, expectedMemoryGb: 8 }).ok, false);
  assert.equal(evaluateHardwareFit({ parameterBillions: 7, expectedMemoryGb: 12 }).ok, false);
});
