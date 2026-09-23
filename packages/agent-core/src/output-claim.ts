/**
 * Defense-in-depth lexical checks. Authoritative: structured claims + backend evidence.
 * P04 has no booking tools — booking confirmations can never be evidenced.
 */
const BOOKING_SUCCESS_PATTERNS = [
  /your appointment is booked/i,
  /booking is confirmed/i,
  /تم تأكيد الحجز/,
  /حجزك صار/,
  /موعدك محجوز/,
  /payment succeeded/i,
];

export function containsUnevidencedBookingClaim(text: string): boolean {
  return BOOKING_SUCCESS_PATTERNS.some((re) => re.test(text));
}

export function assertFinalResponseSafe(
  text: string,
  claims: Array<{ kind: string; evidenceRef?: string }>,
): { ok: true } | { ok: false; reason: string } {
  const bookingClaims = claims.filter((c) => c.kind === 'booking' || c.kind === 'availability');
  for (const c of bookingClaims) {
    if (!c.evidenceRef) {
      return { ok: false, reason: 'booking_or_availability_claim_without_evidence' };
    }
  }
  if (containsUnevidencedBookingClaim(text)) {
    return { ok: false, reason: 'unevidenced_booking_success_language' };
  }
  return { ok: true };
}
