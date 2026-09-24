import { BadRequestException } from '@nestjs/common';

export type AnalyticsRange = { from: Date; to: Date; timezone: string; fromLocal: string; toLocal: string };

export function parseAnalyticsRange(from: string, to: string, timezone: string): AnalyticsRange {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new BadRequestException('from/to must be YYYY-MM-DD');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date()); } catch { throw new BadRequestException('Invalid IANA timezone'); }
  const start = zonedMidnight(from, timezone), end = zonedMidnight(to, timezone);
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (!(start < end) || days > 367) throw new BadRequestException('Range must be positive and at most 365 local days');
  return { from: start, to: end, timezone, fromLocal: from, toLocal: to };
}

function zonedMidnight(date: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  let guess = Date.UTC(year!, month! - 1, day!);
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
    const represented = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    guess -= represented - Date.UTC(year!, month! - 1, day!);
  }
  return new Date(guess);
}
