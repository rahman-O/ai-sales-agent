import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { BUSINESS_POLICY_TYPES, parseBusinessPolicyRules, policyAllowsAction, selectEffectivePolicy } from '@ai-sales-agent/contracts';

const now = new Date('2026-09-28T12:00:00.000Z');
const candidate = (overrides: Partial<{ status: string; version: number; effectiveFrom: string | null; effectiveUntil: string | null; createdAt: string }> = {}) => ({
  id: randomUUID(), status: 'ACTIVE', version: 1, effectiveFrom: null, effectiveUntil: null,
  createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
});

test('MB-06 generic policy types do not encode business categories', () => {
  assert.deepEqual(BUSINESS_POLICY_TYPES, ['BOOKING', 'CANCELLATION', 'RESCHEDULING', 'PAYMENT', 'REFUND', 'RETURN', 'DELIVERY', 'SERVICE_AREA', 'MINIMUM_ORDER', 'ADVANCE_NOTICE', 'QUOTE', 'HANDOFF', 'CUSTOM']);
});

test('ACTIVE_POLICY_RESOLVES and non-effective lifecycle states/windows are ignored', () => {
  const active = candidate();
  assert.equal(selectEffectivePolicy([active], now)?.id, active.id);
  assert.equal(selectEffectivePolicy([candidate({ status: 'DRAFT' })], now), null);
  assert.equal(selectEffectivePolicy([candidate({ status: 'ARCHIVED' })], now), null);
  assert.equal(selectEffectivePolicy([candidate({ effectiveFrom: '2026-09-29T00:00:00.000Z' })], now), null);
  assert.equal(selectEffectivePolicy([candidate({ effectiveUntil: '2026-09-27T00:00:00.000Z' })], now), null);
});

test('LATEST_EFFECTIVE_VERSION_SELECTED deterministically prefers highest version', () => {
  const v1 = candidate({ version: 1, effectiveFrom: '2026-01-01T00:00:00.000Z' });
  const v2 = candidate({ version: 2, effectiveFrom: '2026-02-01T00:00:00.000Z' });
  assert.equal(selectEffectivePolicy([v1, v2], now)?.id, v2.id);
});

test('cancellation and rescheduling policy cutoffs are enforced', () => {
  assert.equal(policyAllowsAction('CANCELLATION', { cutoffMinutes: 120, allowAfterCutoff: false }, new Date('2026-09-28T15:00:00.000Z'), now).allowed, true);
  assert.equal(policyAllowsAction('CANCELLATION', { cutoffMinutes: 120, allowAfterCutoff: false }, new Date('2026-09-28T13:00:00.000Z'), now).allowed, false);
  assert.equal(policyAllowsAction('RESCHEDULING', { cutoffMinutes: 60 }, new Date('2026-09-28T14:00:00.000Z'), now).allowed, true);
  assert.equal(policyAllowsAction('RESCHEDULING', { cutoffMinutes: 60 }, new Date('2026-09-28T12:30:00.000Z'), now).allowed, false);
});

test('typed rules reject arbitrary executable fields and CUSTOM remains informational', () => {
  assert.throws(() => parseBusinessPolicyRules('CANCELLATION', { cutoffMinutes: 10, arbitraryExecution: true }));
  assert.throws(() => parseBusinessPolicyRules('CUSTOM', { refundCompleted: true }));
  assert.deepEqual(parseBusinessPolicyRules('CUSTOM', {}), {});
});
