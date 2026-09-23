import assert from 'node:assert/strict';
import test from 'node:test';
import { Money, TimeRange, assertIanaTimezone, normalizeContact } from './value-objects.js';

test('Money preserves bigint precision and normalizes currency', () => {
  assert.deepEqual(Money.create('9007199254740993123', 'iqd').toJSON(), { amountMinor: '9007199254740993123', currency: 'IQD' });
  assert.throws(() => Money.create('1.2', 'IQD'));
  assert.throws(() => Money.create('-1', 'IQD'));
});
test('TimeRange rejects ambiguous local time and reversed ranges', () => {
  assert.throws(() => TimeRange.utc('2026-01-01T10:00:00', '2026-01-01T11:00:00'));
  assert.throws(() => TimeRange.utc('2026-01-01T11:00:00Z', '2026-01-01T10:00:00Z'));
});
test('Contact and timezone normalization is deterministic', () => {
  assert.deepEqual(normalizeContact(' WhatsApp ', '+964 770 123 4567'), { channel: 'whatsapp', externalAddress: '+9647701234567' });
  assert.equal(assertIanaTimezone('Asia/Baghdad'), 'Asia/Baghdad');
  assert.throws(() => assertIanaTimezone('UTC+3'));
});
