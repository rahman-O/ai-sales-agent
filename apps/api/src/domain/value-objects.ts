const ISO_CURRENCIES = new Set(['IQD', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'TRY']);

export class Money {
  private constructor(readonly amountMinor: bigint, readonly currency: string) {}

  static create(amountMinor: string | bigint, currency: string, allowNegative = false): Money {
    if (!/^-?\d+$/.test(String(amountMinor))) throw new Error('amountMinor must be an integer decimal string');
    const amount = BigInt(amountMinor);
    if (!allowNegative && amount < 0n) throw new Error('amountMinor must be nonnegative');
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!ISO_CURRENCIES.has(normalizedCurrency)) throw new Error('Unsupported ISO currency');
    return new Money(amount, normalizedCurrency);
  }

  toJSON() { return { amountMinor: this.amountMinor.toString(), currency: this.currency }; }
}

export class TimeRange {
  private constructor(readonly start: Date, readonly end: Date) {}

  static utc(start: string, end: string): TimeRange {
    if (!/(Z|[+-]\d\d:\d\d)$/.test(start) || !/(Z|[+-]\d\d:\d\d)$/.test(end)) {
      throw new Error('TimeRange requires explicit UTC offset');
    }
    const a = new Date(start); const b = new Date(end);
    if (!Number.isFinite(a.valueOf()) || !Number.isFinite(b.valueOf()) || a >= b) throw new Error('Invalid TimeRange');
    return new TimeRange(a, b);
  }
}

export function normalizeContact(channel: string, address: string) {
  const normalizedChannel = channel.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(normalizedChannel)) throw new Error('Invalid channel');
  let normalizedAddress = address.trim().toLowerCase();
  if (normalizedChannel === 'phone' || normalizedChannel === 'whatsapp') {
    normalizedAddress = normalizedAddress.replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedAddress)) throw new Error('Phone address must be E.164');
  }
  if (!normalizedAddress || normalizedAddress.length > 320) throw new Error('Invalid external address');
  return { channel: normalizedChannel, externalAddress: normalizedAddress };
}

export function assertIanaTimezone(value: string): string {
  const timezone = value.trim();
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw new Error('Invalid IANA timezone'); }
  return timezone;
}
