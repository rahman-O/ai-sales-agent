import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AnalyticsDateRangeQuerySchema,
  METRIC_CATALOG,
  buildFunnelStages,
  calculateConversionRate,
} from './analytics.js';

test('AnalyticsDateRangeQuerySchema validates valid ranges and timezones', () => {
  const valid = AnalyticsDateRangeQuerySchema.safeParse({
    from: '2026-09-01',
    to: '2026-09-30',
    timezone: 'Asia/Baghdad',
  });
  assert.equal(valid.success, true);

  const invalidDate = AnalyticsDateRangeQuerySchema.safeParse({
    from: '01-09-2026',
    to: '2026-09-30',
  });
  assert.equal(invalidDate.success, false);
});

test('calculateConversionRate returns null rate on zero or negative denominator', () => {
  const zeroDenom = calculateConversionRate(5, 0, 'Booking Conversion');
  assert.equal(zeroDenom.numerator, 5);
  assert.equal(zeroDenom.denominator, 0);
  assert.equal(zeroDenom.rate, null);
  assert.equal(zeroDenom.label, 'Booking Conversion');

  const valid = calculateConversionRate(15, 60, 'Quote Acceptance');
  assert.equal(valid.numerator, 15);
  assert.equal(valid.denominator, 60);
  assert.equal(valid.rate, 0.25);
});

test('buildFunnelStages deterministically computes stage transitions and drop-offs', () => {
  const stages = [
    { id: 'INTENT', name: 'Inquiry', count: 100 },
    { id: 'CREATED', name: 'Quote Created', count: 40 },
    { id: 'PRESENTED', name: 'Presented', count: 30 },
    { id: 'ACCEPTED', name: 'Accepted', count: 15 },
  ];

  const result = buildFunnelStages(stages);
  assert.equal(result.length, 4);

  // Initial stage
  assert.equal(result[0]!.count, 100);
  assert.equal(result[0]!.conversionFromPrevious, 1.0);
  assert.equal(result[0]!.conversionFromInitial, 1.0);
  assert.equal(result[0]!.dropOffFromPrevious, 0);

  // Stage 1
  assert.equal(result[1]!.count, 40);
  assert.equal(result[1]!.conversionFromPrevious, 0.4);
  assert.equal(result[1]!.conversionFromInitial, 0.4);
  assert.equal(result[1]!.dropOffFromPrevious, 60);

  // Stage 2
  assert.equal(result[2]!.count, 30);
  assert.equal(result[2]!.conversionFromPrevious, 0.75);
  assert.equal(result[2]!.conversionFromInitial, 0.3);
  assert.equal(result[2]!.dropOffFromPrevious, 10);

  // Stage 3
  assert.equal(result[3]!.count, 15);
  assert.equal(result[3]!.conversionFromPrevious, 0.5);
  assert.equal(result[3]!.conversionFromInitial, 0.15);
  assert.equal(result[3]!.dropOffFromPrevious, 15);
});

test('METRIC_CATALOG contains explicit sources of truth and preview exclusion', () => {
  assert.ok(METRIC_CATALOG.length >= 10);
  for (const metric of METRIC_CATALOG) {
    assert.ok(metric.id);
    assert.ok(metric.name);
    assert.ok(metric.sourceTable);
    assert.ok(metric.numeratorDescription);
    assert.equal(metric.previewExcluded, true);
  }
});
