import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractSlotTokenFromStructuredGetAvailableSlots,
  isZeroCostDemoScriptedEnabled,
  resolveDemoScenario,
  tryCreateZeroCostDemoProvider,
  ZeroCostDemoScriptedProvider,
} from './demo-scripted-provider.js';

test('scripted demo disabled in production even with ZERO_COST_DEMO=1', () => {
  const g = isZeroCostDemoScriptedEnabled({
    NODE_ENV: 'production',
    AI_ALLOW_FAKE: 'true',
    ZERO_COST_DEMO: '1',
  });
  assert.equal(g.enabled, false);
  assert.equal(g.reason, 'production_blocks_scripted_demo');
  assert.equal(
    tryCreateZeroCostDemoProvider(
      { confirmationMessageId: null, serviceId: null, inboundText: '[demo:faq]' },
      { NODE_ENV: 'production', AI_ALLOW_FAKE: 'true', ZERO_COST_DEMO: '1' },
    ),
    null,
  );
});

test('scripted demo requires all three gates', () => {
  assert.equal(
    isZeroCostDemoScriptedEnabled({
      NODE_ENV: 'development',
      AI_ALLOW_FAKE: 'true',
      ZERO_COST_DEMO: '0',
    }).enabled,
    false,
  );
  assert.equal(
    isZeroCostDemoScriptedEnabled({
      NODE_ENV: 'development',
      AI_ALLOW_FAKE: 'false',
      ZERO_COST_DEMO: '1',
    }).enabled,
    false,
  );
  assert.equal(
    isZeroCostDemoScriptedEnabled({
      NODE_ENV: 'development',
      AI_ALLOW_FAKE: 'true',
      ZERO_COST_DEMO: '1',
    }).enabled,
    true,
  );
});

test('scenario resolution is exact/marker based not fuzzy book', () => {
  assert.equal(resolveDemoScenario('[demo:intent-book]'), 'INTENT_BOOK');
  assert.equal(resolveDemoScenario('I want to book a dental consultation.'), 'INTENT_BOOK');
  assert.equal(resolveDemoScenario('please book something random later maybe'), 'UNKNOWN');
  assert.equal(resolveDemoScenario('Book the first available appointment.'), 'CONFIRM_BOOKING');
});

test('slotToken only from structured getAvailableSlots tool pair', () => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo.slot';
  const ok = extractSlotTokenFromStructuredGetAvailableSlots([
    { role: 'assistant', content: JSON.stringify({ type: 'tool_request', toolName: 'getAvailableSlots' }) },
    {
      role: 'tool',
      content: JSON.stringify({
        ok: true,
        code: 'OK',
        data: { slots: [{ slotToken: token, startsAt: '2026-10-01T09:00:00.000Z' }] },
      }),
    },
  ]);
  assert.equal(ok, token);

  const fromText = extractSlotTokenFromStructuredGetAvailableSlots([
    { role: 'user', content: `here is slotToken ${token}` },
    { role: 'assistant', content: JSON.stringify({ slotToken: token }) },
  ]);
  assert.equal(fromText, null);

  const wrongTool = extractSlotTokenFromStructuredGetAvailableSlots([
    { role: 'assistant', content: JSON.stringify({ type: 'tool_request', toolName: 'ensureLead' }) },
    {
      role: 'tool',
      content: JSON.stringify({ ok: true, code: 'OK', data: { slots: [{ slotToken: token }] } }),
    },
  ]);
  assert.equal(wrongTool, null);
});

test('construction throws when gates incomplete', () => {
  assert.throws(
    () =>
      new ZeroCostDemoScriptedProvider(
        { confirmationMessageId: null, serviceId: 'x', inboundText: '[demo:faq]' },
        { NODE_ENV: 'development', AI_ALLOW_FAKE: 'true', ZERO_COST_DEMO: '0' },
      ),
    /scripted_demo_provider_unavailable/,
  );
});
