import { createHash } from 'node:crypto';
import {
  isoDayOfWeekInZone,
  localToUtcCandidates,
} from '../../packages/agent-adapters/src/booking-time.ts';

export type AvailabilityRuleLike = {
  staffMemberId: string;
  dayOfWeek: number;
  localStartTime: string; // HH:MM:SS
  localEndTime: string;
};

export type DemoSlot = {
  staffMemberId: string;
  localDate: string;
  localStart: string;
  startsAt: Date;
  endsAt: Date;
  occupiedStartsAt: Date;
  occupiedEndsAt: Date;
};

function padTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

function enumerateLocalDates(from: Date, days: number, timeZone: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const probe = new Date(from.getTime() + i * 86400000);
    // Format YYYY-MM-DD in zone
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(probe);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) out.push(`${y}-${m}-${d}`);
  }
  return [...new Set(out)];
}

/**
 * Find next valid availability windows from rules (ISO DOW 1–7).
 * Skips weekends automatically when rules are Sun–Thu only.
 */
export function nextValidAvailabilitySlots(input: {
  rules: AvailabilityRuleLike[];
  timezone: string;
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  minimumLeadMinutes?: number;
  count: number;
  now?: Date;
  /** Staff preference order */
  staffIds?: string[];
}): DemoSlot[] {
  const now = input.now ?? new Date();
  const minStart = addMinutes(now, input.minimumLeadMinutes ?? 60);
  const bufBefore = input.bufferBeforeMinutes ?? 0;
  const bufAfter = input.bufferAfterMinutes ?? 0;
  const duration = input.durationMinutes;
  const dates = enumerateLocalDates(now, 21, input.timezone);
  const slots: DemoSlot[] = [];
  const staffFilter = input.staffIds?.length ? new Set(input.staffIds) : null;

  for (const localDate of dates) {
    if (slots.length >= input.count) break;
    const noon = localToUtcCandidates(localDate, '12:00:00', input.timezone)[0];
    if (!noon) continue;
    const dow = isoDayOfWeekInZone(noon, input.timezone);
    const dayRules = input.rules.filter(
      (r) => r.dayOfWeek === dow && (!staffFilter || staffFilter.has(r.staffMemberId)),
    );
    for (const rule of dayRules) {
      if (slots.length >= input.count) break;
      const startLocal = padTime(rule.localStartTime);
      const endLocal = padTime(rule.localEndTime);
      const winStart = localToUtcCandidates(localDate, startLocal, input.timezone)[0];
      const winEnd = localToUtcCandidates(localDate, endLocal, input.timezone)[0];
      if (!winStart || !winEnd) continue;

      // Place slot at window start, then +duration steps until window end
      let cursor = winStart;
      while (addMinutes(cursor, duration).getTime() <= winEnd.getTime()) {
        const startsAt = cursor;
        const endsAt = addMinutes(startsAt, duration);
        if (startsAt.getTime() >= minStart.getTime()) {
          const occupiedStartsAt = addMinutes(startsAt, -bufBefore);
          const occupiedEndsAt = addMinutes(endsAt, bufAfter);
          // Avoid overlap with already chosen slots (staff or time)
          const conflict = slots.some(
            (s) =>
              s.staffMemberId === rule.staffMemberId &&
              occupiedStartsAt < s.occupiedEndsAt &&
              occupiedEndsAt > s.occupiedStartsAt,
          );
          if (!conflict) {
            slots.push({
              staffMemberId: rule.staffMemberId,
              localDate,
              localStart: startLocal,
              startsAt,
              endsAt,
              occupiedStartsAt,
              occupiedEndsAt,
            });
            if (slots.length >= input.count) break;
            // jump past this slot for next pick on same day
            cursor = addMinutes(endsAt, 30);
            continue;
          }
        }
        cursor = addMinutes(cursor, 30);
      }
    }
  }
  return slots;
}

export function digestText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
