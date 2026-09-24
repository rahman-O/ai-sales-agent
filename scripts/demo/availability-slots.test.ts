import assert from 'node:assert/strict';
import test from 'node:test';
import { nextValidAvailabilitySlots } from './availability-slots.ts';
import { DEMO_STAFF_IDS, DEMO_TIMEZONE } from './constants.ts';
import { normalizeContact } from '../../apps/api/src/domain/value-objects.ts';
import { demoCustomerPhone } from './constants.ts';

test('demo phones are valid E.164 whatsapp identities', () => {
  for (let i = 1; i <= 6; i++) {
    const r = normalizeContact('whatsapp', demoCustomerPhone(i));
    assert.match(r.externalAddress, /^\+[1-9]\d{7,14}$/);
  }
});

test('nextValidAvailabilitySlots skips Friday/Saturday when rules are Sun-Thu', () => {
  // 2026-09-25 is Friday
  const friday = new Date('2026-09-25T08:00:00.000Z');
  const rules = [7, 1, 2, 3, 4].flatMap((dow) => [
    {
      staffMemberId: DEMO_STAFF_IDS.one,
      dayOfWeek: dow,
      localStartTime: '09:00:00',
      localEndTime: '17:00:00',
    },
  ]);
  const slots = nextValidAvailabilitySlots({
    rules,
    timezone: DEMO_TIMEZONE,
    durationMinutes: 30,
    minimumLeadMinutes: 60,
    count: 3,
    now: friday,
  });
  assert.equal(slots.length, 3);
  // First slot should be on Sunday 2026-09-27 (Baghdad)
  assert.ok(slots[0]!.localDate >= '2026-09-27');
  // Non-overlapping
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!;
      const b = slots[j]!;
      if (a.staffMemberId !== b.staffMemberId) continue;
      const overlap = a.occupiedStartsAt < b.occupiedEndsAt && a.occupiedEndsAt > b.occupiedStartsAt;
      assert.equal(overlap, false);
    }
  }
});
