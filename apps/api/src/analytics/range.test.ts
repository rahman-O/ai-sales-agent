import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAnalyticsRange } from './range.js';
test('Baghdad and DST boundaries produce UTC half-open windows', () => {
  const baghdad = parseAnalyticsRange('2026-09-01','2026-09-02','Asia/Baghdad');
  assert.equal(baghdad.from.toISOString(), '2026-08-31T21:00:00.000Z');
  const ny = parseAnalyticsRange('2026-03-08','2026-03-09','America/New_York');
  assert.equal((ny.to.getTime()-ny.from.getTime())/3_600_000, 23);
});
test('invalid and unbounded ranges are rejected', () => {
  assert.throws(() => parseAnalyticsRange('2026-01-01','2026-01-02','UTC+3'));
  assert.throws(() => parseAnalyticsRange('2025-01-01','2026-12-31','UTC'));
});
