/**
 * Quiet hours: preserve scheduledFor; compute nextEligibleAt only.
 * Quiet window is [startMinute, endMinute) in local minutes-from-midnight.
 * When start > end (e.g. 20:00–09:00), quiet spans midnight.
 */
export function isInQuietHours(
  localMinutesFromMidnight: number,
  quietStart: number,
  quietEnd: number,
): boolean {
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) {
    return localMinutesFromMidnight >= quietStart && localMinutesFromMidnight < quietEnd;
  }
  return localMinutesFromMidnight >= quietStart || localMinutesFromMidnight < quietEnd;
}

/** Next local midnight-based eligible instant after `from` (UTC Date). Uses Intl for zone. */
export function computeNextEligibleAt(input: {
  scheduledFor: Date;
  timezone: string;
  quietStartMinute: number;
  quietEndMinute: number;
}): Date {
  const { scheduledFor, timezone, quietStartMinute, quietEndMinute } = input;
  const localParts = localWallParts(scheduledFor, timezone);
  const mins = localParts.hour * 60 + localParts.minute;
  if (!isInQuietHours(mins, quietStartMinute, quietEndMinute)) {
    return scheduledFor;
  }
  // Push to quietEnd on the appropriate local day
  let dayOffset = 0;
  if (quietStartMinute > quietEndMinute) {
    // overnight quiet: if currently after start, end is tomorrow
    if (mins >= quietStartMinute) dayOffset = 1;
  } else {
    // same-day quiet block: end is today if before end, else already outside
    dayOffset = 0;
  }
  const target = new Date(
    Date.UTC(localParts.year, localParts.month - 1, localParts.day + dayOffset, 0, 0, 0),
  );
  // Convert quietEnd local civil time to UTC via iterative search (same approach as booking-time)
  const y = target.getUTCFullYear();
  const m = target.getUTCMonth() + 1;
  const d = target.getUTCDate();
  const h = Math.floor(quietEndMinute / 60);
  const mi = quietEndMinute % 60;
  const candidates = civilToUtcApprox(y, m, d, h, mi, timezone);
  return candidates[0] ?? scheduledFor;
}

function localWallParts(instant: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** Approximate civil→UTC by binary search of offset (good enough for quiet-hours). */
function civilToUtcApprox(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date[] {
  // Guess: treat as UTC then correct offset
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const parts = localWallParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess += wanted - asUtc;
  }
  const verify = localWallParts(new Date(guess), timeZone);
  if (
    verify.year === year &&
    verify.month === month &&
    verify.day === day &&
    verify.hour === hour &&
    verify.minute === minute
  ) {
    return [new Date(guess)];
  }
  return [new Date(guess)];
}

export function validateTemplateParams(
  schema: Record<string, unknown>,
  params: Record<string, unknown>,
): { ok: true; params: Record<string, string> } | { ok: false; reason: string } {
  const out: Record<string, string> = {};
  const allowed = Object.keys(schema);
  for (const key of Object.keys(params)) {
    if (!allowed.includes(key)) return { ok: false, reason: 'extra_param' };
  }
  for (const key of allowed) {
    const spec = schema[key];
    const required = typeof spec === 'object' && spec && (spec as { required?: boolean }).required !== false;
    const val = params[key];
    if (val == null || val === '') {
      if (required !== false && schema[key] !== 'optional') {
        // treat string type as required by default
        if (typeof spec === 'string' || (typeof spec === 'object' && (spec as { required?: boolean }).required !== false)) {
          if (val == null || val === '') return { ok: false, reason: `missing_${key}` };
        }
      }
      continue;
    }
    if (typeof val !== 'string' && typeof val !== 'number') {
      return { ok: false, reason: `invalid_${key}` };
    }
    out[key] = String(val).slice(0, 500);
  }
  return { ok: true, params: out };
}

/** Build Meta template components from ordered parameter schema keys. */
export function buildMetaTemplateComponents(
  schema: Record<string, unknown>,
  params: Record<string, string>,
): Array<{ type: string; parameters: Array<{ type: string; text: string }> }> {
  const keys = Object.keys(schema);
  if (!keys.length) return [];
  return [
    {
      type: 'body',
      parameters: keys.map((k) => ({ type: 'text', text: params[k] ?? '' })),
    },
  ];
}
