/** P07 booking time / occupancy / confirmation helpers. */

export function occupiedRange(
  startsAt: Date,
  durationMinutes: number,
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number,
): { endsAt: Date; occupiedStartsAt: Date; occupiedEndsAt: Date } {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const occupiedStartsAt = new Date(startsAt.getTime() - bufferBeforeMinutes * 60_000);
  const occupiedEndsAt = new Date(endsAt.getTime() + bufferAfterMinutes * 60_000);
  return { endsAt, occupiedStartsAt, occupiedEndsAt };
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  // half-open [start, end)
  return aStart < bEnd && bStart < aEnd;
}

export function intervalContained(
  innerStart: Date,
  innerEnd: Date,
  outerStart: Date,
  outerEnd: Date,
): boolean {
  return innerStart >= outerStart && innerEnd <= outerEnd;
}

/** ISO day of week 1=Monday … 7=Sunday from a UTC instant in a timezone. */
export function isoDayOfWeekInZone(instant: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(instant);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const n = map[wd];
  if (!n) throw new Error('weekday_resolve_failed');
  return n;
}

export function formatLocalDateInZone(instant: Date, timeZone: string): string {
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function formatLocalTimeInZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Convert local civil date+time in IANA zone to UTC Date(s).
 * NONEXISTENT → empty. AMBIGUOUS → both offsets (dual candidates).
 */
export function localToUtcCandidates(
  localDate: string, // YYYY-MM-DD
  localTime: string, // HH:MM or HH:MM:SS
  timeZone: string,
): Date[] {
  const time = localTime.length === 5 ? `${localTime}:00` : localTime;
  const [y, m, d] = localDate.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  if (![y, m, d, hh, mm, ss].every((n) => Number.isFinite(n))) return [];

  // Probe a wide UTC window around the nominal instant and keep matches.
  const guess = Date.UTC(y!, m! - 1, d!, hh!, mm!, ss!);
  const candidates = new Map<number, Date>();
  for (const offsetHours of range(-14, 14)) {
    const probe = new Date(guess - offsetHours * 3600_000);
    if (
      formatLocalDateInZone(probe, timeZone) === localDate &&
      formatLocalTimeInZone(probe, timeZone) === time
    ) {
      candidates.set(probe.getTime(), probe);
    }
  }
  return [...candidates.values()].sort((a, b) => a.getTime() - b.getTime());
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

/** Explicit confirmation / selection — not mere availability inquiry. */
export function isExplicitBookingConfirmation(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  // Availability-only questions must fail
  if (
    /^(what|which|any|هل|ايش|شو|متى|كم)\b/.test(t) &&
    /(time|slot|available|availability|مواعيد|متاح|وقت)/i.test(t)
  ) {
    return false;
  }
  if (/\b(what times? are available|available times|show (me )?slots)\b/i.test(t)) {
    return false;
  }
  // Affirmative / selection patterns (EN + common AR)
  if (
    /\b(yes|yeah|yep|confirm|book( it)?|reserve|that one|this one|ok(ay)?|sure|go ahead|i('ll| will) take)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/(^|\s)(إي|اي|نعم|أكد|اكد|احجز|احجزي|ثبّت|ثبت|موافق|تمام|هذا|هاي)(\s|$|[!.؟])/u.test(t)) {
    return true;
  }
  // Explicit ISO-ish time selection often accompanies confirm
  if (/\b\d{1,2}:\d{2}\b/.test(t) && /(book|confirm|take|احجز|أكد|اي|yes)/i.test(t)) {
    return true;
  }
  return false;
}

export type LocalWindow = { startLocal: string; endLocal: string }; // HH:MM:SS

/** Merge UNAVAILABLE exceptions over base windows; AVAILABLE adds windows. */
export function applyExceptionsToDay(
  baseWindows: LocalWindow[],
  exceptions: Array<{
    type: 'AVAILABLE' | 'UNAVAILABLE';
    localStartTime: string | null;
    localEndTime: string | null;
  }>,
): LocalWindow[] {
  let windows = [...baseWindows];
  for (const ex of exceptions.filter((e) => e.type === 'UNAVAILABLE')) {
    if (!ex.localStartTime && !ex.localEndTime) {
      windows = [];
      continue;
    }
    windows = subtractWindow(windows, {
      startLocal: normalizeTime(ex.localStartTime!),
      endLocal: normalizeTime(ex.localEndTime!),
    });
  }
  for (const ex of exceptions.filter((e) => e.type === 'AVAILABLE')) {
    if (!ex.localStartTime || !ex.localEndTime) continue;
    windows.push({
      startLocal: normalizeTime(ex.localStartTime),
      endLocal: normalizeTime(ex.localEndTime),
    });
  }
  return mergeWindows(windows);
}

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

function timeToSec(t: string): number {
  const [h, m, s] = normalizeTime(t).split(':').map(Number);
  return h! * 3600 + m! * 60 + (s ?? 0);
}

function secToTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function subtractWindow(windows: LocalWindow[], cut: LocalWindow): LocalWindow[] {
  const c0 = timeToSec(cut.startLocal);
  const c1 = timeToSec(cut.endLocal);
  const out: LocalWindow[] = [];
  for (const w of windows) {
    const a = timeToSec(w.startLocal);
    const b = timeToSec(w.endLocal);
    if (c1 <= a || c0 >= b) {
      out.push(w);
      continue;
    }
    if (c0 > a) out.push({ startLocal: secToTime(a), endLocal: secToTime(c0) });
    if (c1 < b) out.push({ startLocal: secToTime(c1), endLocal: secToTime(b) });
  }
  return out;
}

function mergeWindows(windows: LocalWindow[]): LocalWindow[] {
  const sorted = [...windows].sort((x, y) => timeToSec(x.startLocal) - timeToSec(y.startLocal));
  const out: LocalWindow[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (!last || timeToSec(w.startLocal) > timeToSec(last.endLocal)) {
      out.push({ ...w });
    } else if (timeToSec(w.endLocal) > timeToSec(last.endLocal)) {
      last.endLocal = w.endLocal;
    }
  }
  return out;
}
