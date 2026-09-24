import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyExceptionsToDay,
  isExplicitBookingConfirmation,
  localToUtcCandidates,
  occupiedRange,
  intervalContained,
} from './booking-time.js';
import { signSlotToken, verifySlotToken } from './slot-token.js';

test('occupiedRange expands buffers', () => {
  const starts = new Date('2026-06-01T13:00:00.000Z');
  const o = occupiedRange(starts, 30, 10, 15);
  assert.equal(o.endsAt.toISOString(), '2026-06-01T13:30:00.000Z');
  assert.equal(o.occupiedStartsAt.toISOString(), '2026-06-01T12:50:00.000Z');
  assert.equal(o.occupiedEndsAt.toISOString(), '2026-06-01T13:45:00.000Z');
});

test('end-of-day occupied must fit capacity', () => {
  const dayStart = new Date('2026-06-01T06:00:00.000Z'); // 09:00 Asia/Baghdad UTC+3
  const dayEnd = new Date('2026-06-01T14:00:00.000Z'); // 17:00
  const candidateStart = new Date('2026-06-01T13:30:00.000Z'); // 16:30
  const occ = occupiedRange(candidateStart, 30, 0, 15);
  assert.equal(intervalContained(occ.occupiedStartsAt, occ.occupiedEndsAt, dayStart, dayEnd), false);
});

test('confirmation policy rejects availability inquiry', () => {
  assert.equal(isExplicitBookingConfirmation('What times are available?'), false);
  assert.equal(isExplicitBookingConfirmation('yes book 10:00'), true);
  assert.equal(isExplicitBookingConfirmation('احجز هذا الموعد'), true);
});

test('slot token roundtrip and fail-closed', () => {
  const secret = 'unit-test-secret';
  const token = signSlotToken(
    {
      organizationId: 'o',
      customerId: 'c',
      serviceId: 's',
      locationId: 'l',
      staffMemberId: 'st',
      startsAt: '2026-06-01T10:00:00.000Z',
      endsAt: '2026-06-01T10:30:00.000Z',
    },
    secret,
  );
  const ok = verifySlotToken(token, secret, { organizationId: 'o', customerId: 'c' });
  assert.equal(ok.ok, true);
  const bad = verifySlotToken(token.slice(0, -2) + 'aa', secret, {
    organizationId: 'o',
    customerId: 'c',
  });
  assert.equal(bad.ok, false);
  const tenant = verifySlotToken(token, secret, { organizationId: 'other', customerId: 'c' });
  assert.equal(tenant.ok, false);
});

test('DST spring forward nonexistent local time rejected', () => {
  // America/New_York 2026-03-08 02:30 does not exist
  const r = localToUtcCandidates('2026-03-08', '02:30:00', 'America/New_York');
  assert.equal(r.length, 0);
});

test('DST fall back ambiguous yields dual candidates', () => {
  // America/New_York 2026-11-01 01:30 occurs twice
  const r = localToUtcCandidates('2026-11-01', '01:30:00', 'America/New_York');
  assert.ok(r.length >= 2, `expected >=2 got ${r.length}`);
  assert.notEqual(r[0]!.getTime(), r[1]!.getTime());
});

test('UNAVAILABLE exception removes capacity', () => {
  const w = applyExceptionsToDay(
    [{ startLocal: '09:00:00', endLocal: '17:00:00' }],
    [{ type: 'UNAVAILABLE', localStartTime: '12:00:00', localEndTime: '13:00:00' }],
  );
  assert.deepEqual(w, [
    { startLocal: '09:00:00', endLocal: '12:00:00' },
    { startLocal: '13:00:00', endLocal: '17:00:00' },
  ]);
});
