import assert from 'node:assert/strict';
import test from 'node:test';
import { toolCancelBooking, toolRescheduleBooking } from './booking-tools.js';

const bookingId = '00000000-0000-4000-8000-000000000010';
const orgId = '00000000-0000-4000-8000-000000000020';
const customerId = '00000000-0000-4000-8000-000000000030';

test('CANCELLATION_OUTSIDE_POLICY_REJECTED before booking mutation', async () => {
  const sql: string[] = [];
  const client = { query: async (query: string) => {
    sql.push(query);
    if (query.includes('SELECT starts_at FROM bookings')) return { rows: [{ starts_at: new Date(Date.now() + 30 * 60_000) }] };
    if (query.includes('FROM business_policies')) return { rows: [{ rules_json: { cutoffMinutes: 120, allowAfterCutoff: false } }] };
    throw new Error('unexpected mutation');
  } } as never;
  const result = await toolCancelBooking(client, orgId, customerId, { bookingId, expectedVersion: 1 }, { agentRunId: 'run' });
  assert.deepEqual(result, { ok: false, code: 'CANCELLATION_POLICY_CUTOFF', safeMessage: 'This request is outside the active cancellation policy cutoff.' });
  assert.equal(sql.some((query) => query.includes('UPDATE bookings SET status')), false);
});

test('RESCHEDULE_OUTSIDE_POLICY_REJECTED before slot mutation', async () => {
  const previousSecret = process.env.BOOKING_SLOT_TOKEN_SECRET;
  process.env.BOOKING_SLOT_TOKEN_SECRET = 'mb06-test-secret-at-least-32-characters';
  const sql: string[] = [];
  const client = { query: async (query: string) => {
    sql.push(query);
    if (query.includes('SELECT * FROM bookings')) return { rows: [{ status: 'CONFIRMED', version: 1, starts_at: new Date(Date.now() + 15 * 60_000) }] };
    if (query.includes('FROM business_policies')) return { rows: [{ rules_json: { cutoffMinutes: 60 } }] };
    throw new Error('unexpected mutation');
  } } as never;
  try {
    const result = await toolRescheduleBooking(client, orgId, customerId, { bookingId, expectedVersion: 1, slotToken: 'unused' }, { agentRunId: 'run' });
    assert.deepEqual(result, { ok: false, code: 'RESCHEDULING_POLICY_CUTOFF', safeMessage: 'This request is outside the active rescheduling policy cutoff.' });
    assert.equal(sql.some((query) => query.includes("UPDATE bookings SET status='CANCELLED'")), false);
  } finally {
    if (previousSecret === undefined) delete process.env.BOOKING_SLOT_TOKEN_SECRET;
    else process.env.BOOKING_SLOT_TOKEN_SECRET = previousSecret;
  }
});
