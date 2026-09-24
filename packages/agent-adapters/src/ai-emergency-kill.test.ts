import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isGlobalAiEmergencyDisabled,
  isOrgAiEmergencyDisabled,
  shouldBlockNewAgentRuns,
} from './ai-emergency-kill.js';

test('global AI emergency disable blocks AgentRuns', () => {
  const r = shouldBlockNewAgentRuns({
    env: { AI_EMERGENCY_DISABLE_ALL: 'true' },
    org: { ai_emergency_disabled_at: null },
  });
  assert.equal(r.blocked, true);
  assert.equal(r.reason, 'GLOBAL');
  assert.equal(isGlobalAiEmergencyDisabled({ AI_EMERGENCY_DISABLE_ALL: true }), true);
});

test('org AI emergency disable blocks when global off', () => {
  const r = shouldBlockNewAgentRuns({
    env: {},
    org: { ai_emergency_disabled_at: new Date().toISOString() },
  });
  assert.equal(r.blocked, true);
  assert.equal(r.reason, 'ORG');
  assert.equal(isOrgAiEmergencyDisabled({ ai_emergency_disabled_at: new Date() }), true);
});

test('neither kill switch allows AgentRuns', () => {
  const r = shouldBlockNewAgentRuns({
    env: { AI_EMERGENCY_DISABLE_ALL: 'false' },
    org: { ai_emergency_disabled_at: null },
  });
  assert.equal(r.blocked, false);
  assert.equal(r.reason, null);
});
