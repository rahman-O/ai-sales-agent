import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  applyExceptionsToDay,
  formatLocalDateInZone,
  formatLocalTimeInZone,
  intervalContained,
  isExplicitBookingConfirmation,
  isoDayOfWeekInZone,
  localToUtcCandidates,
  occupiedRange,
  rangesOverlap,
} from './booking-time.js';
import { resolveSlotTokenSecret, signSlotToken, verifySlotToken } from './slot-token.js';

const SLOT_STEP = 15;
const MAX_SLOTS = 20;

type ToolOk = { ok: true; data: unknown };
type ToolErr = { ok: false; code: string; safeMessage?: string };

function timeStr(v: unknown): string {
  if (typeof v === 'string') return v.length === 5 ? `${v}:00` : v.slice(0, 8);
  if (v instanceof Date) return v.toISOString().slice(11, 19);
  return String(v).slice(0, 8);
}

export async function toolGetAvailableSlots(
  c: PoolClient,
  org: string,
  customerId: string,
  args: {
    serviceId: string;
    startDate: string;
    endDate?: string;
    locationId?: string;
    staffMemberId?: string;
    limit?: number;
  },
): Promise<ToolOk | ToolErr> {
  const limit = Math.min(Math.max(args.limit ?? MAX_SLOTS, 1), MAX_SLOTS);
  const svc = await c.query(
    `SELECT id, location_id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes,
            booking_enabled, minimum_lead_minutes, maximum_advance_days, active, archived_at
     FROM services WHERE organization_id=$1 AND id=$2`,
    [org, args.serviceId],
  );
  const service = svc.rows[0];
  if (!service || service.active !== true || service.archived_at) {
    return { ok: false, code: 'NOT_FOUND' };
  }
  if (service.booking_enabled !== true) return { ok: false, code: 'NOT_BOOKABLE' };
  const locationId = args.locationId ?? service.location_id;
  if (locationId !== service.location_id) return { ok: false, code: 'INVALID_ARGS' };
  const loc = await c.query(
    `SELECT id, timezone, active, archived_at FROM locations WHERE organization_id=$1 AND id=$2`,
    [org, locationId],
  );
  if (!loc.rows[0] || loc.rows[0].active !== true) return { ok: false, code: 'NOT_FOUND' };
  const timezone = loc.rows[0].timezone as string;

  let staffIds: string[] = [];
  if (args.staffMemberId) {
    staffIds = [args.staffMemberId];
  } else {
    const links = await c.query(
      `SELECT staff_id FROM service_staff WHERE organization_id=$1 AND service_id=$2`,
      [org, args.serviceId],
    );
    staffIds = links.rows.map((r) => r.staff_id as string);
  }
  const staffRes = await c.query(
    `SELECT id, display_name FROM staff_members
     WHERE organization_id=$1 AND id = ANY($2::uuid[]) AND location_id=$3
       AND active=true AND archived_at IS NULL
     ORDER BY id ASC`,
    [org, staffIds, locationId],
  );
  if (!staffRes.rows.length) return { ok: true, data: { slots: [], timezone } };

  const endDate = args.endDate ?? args.startDate;
  const dates = enumDates(args.startDate, endDate);
  const now = new Date();
  const minStart = new Date(now.getTime() + Number(service.minimum_lead_minutes) * 60_000);
  const maxEnd = new Date();
  maxEnd.setUTCDate(maxEnd.getUTCDate() + Number(service.maximum_advance_days));
  let secret: string;
  try {
    secret = resolveSlotTokenSecret();
  } catch {
    return { ok: false, code: 'TOOL_UNAVAILABLE', safeMessage: 'slot_token_secret_missing' };
  }

  const slots: unknown[] = [];
  for (const staff of staffRes.rows) {
    if (slots.length >= limit) break;
    for (const localDate of dates) {
      if (slots.length >= limit) break;
      const noon = localToUtcCandidates(localDate, '12:00:00', timezone)[0];
      if (!noon) continue;
      const dow = isoDayOfWeekInZone(noon, timezone);
      const rules = await c.query(
        `SELECT local_start_time, local_end_time, effective_from, effective_to
         FROM staff_availability_rules
         WHERE organization_id=$1 AND staff_member_id=$2 AND location_id=$3
           AND day_of_week=$4 AND is_active=true`,
        [org, staff.id, locationId, dow],
      );
      let windows = rules.rows
        .filter((r) => {
          const from = r.effective_from ? String(r.effective_from).slice(0, 10) : null;
          const to = r.effective_to ? String(r.effective_to).slice(0, 10) : null;
          if (from && localDate < from) return false;
          if (to && localDate > to) return false;
          return true;
        })
        .map((r) => ({
          startLocal: timeStr(r.local_start_time),
          endLocal: timeStr(r.local_end_time),
        }));
      const ex = await c.query(
        `SELECT type, local_start_time, local_end_time FROM staff_availability_exceptions
         WHERE organization_id=$1 AND staff_member_id=$2 AND location_id=$3 AND local_date=$4::date`,
        [org, staff.id, locationId, localDate],
      );
      windows = applyExceptionsToDay(
        windows,
        ex.rows.map((e) => ({
          type: e.type as 'AVAILABLE' | 'UNAVAILABLE',
          localStartTime: e.local_start_time ? timeStr(e.local_start_time) : null,
          localEndTime: e.local_end_time ? timeStr(e.local_end_time) : null,
        })),
      );

      const rangeStart = localToUtcCandidates(localDate, '00:00:00', timezone)[0]!;
      const rangeEnd = localToUtcCandidates(localDate, '23:59:59', timezone).slice(-1)[0]!;
      const existing = await c.query(
        `SELECT occupied_starts_at, occupied_ends_at FROM bookings
         WHERE organization_id=$1 AND status='CONFIRMED'
           AND (staff_member_id=$2 OR customer_id=$3)
           AND occupied_starts_at < $5 AND occupied_ends_at > $4`,
        [org, staff.id, customerId, rangeStart.toISOString(), rangeEnd.toISOString()],
      );

      for (const w of windows) {
        const startSecs = toSec(w.startLocal);
        const endSecs = toSec(w.endLocal);
        const dur = Number(service.duration_minutes);
        for (let sec = startSecs; sec + dur * 60 <= endSecs; sec += SLOT_STEP * 60) {
          if (slots.length >= limit) break;
          const localStart = fromSec(sec);
          for (const startsAt of localToUtcCandidates(localDate, localStart, timezone)) {
            if (startsAt < minStart || startsAt > maxEnd) continue;
            const { endsAt, occupiedStartsAt, occupiedEndsAt } = occupiedRange(
              startsAt,
              dur,
              Number(service.buffer_before_minutes),
              Number(service.buffer_after_minutes),
            );
            const ws = nearest(localToUtcCandidates(localDate, w.startLocal, timezone), startsAt);
            const we = nearest(localToUtcCandidates(localDate, w.endLocal, timezone), endsAt);
            if (!ws || !we || !intervalContained(occupiedStartsAt, occupiedEndsAt, ws, we)) continue;
            const conflict = existing.rows.some((b) =>
              rangesOverlap(
                occupiedStartsAt,
                occupiedEndsAt,
                new Date(b.occupied_starts_at),
                new Date(b.occupied_ends_at),
              ),
            );
            if (conflict) continue;
            const slotToken = signSlotToken(
              {
                organizationId: org,
                customerId,
                serviceId: service.id,
                locationId,
                staffMemberId: staff.id,
                startsAt: startsAt.toISOString(),
                endsAt: endsAt.toISOString(),
              },
              secret,
            );
            slots.push({
              staffMemberId: staff.id,
              serviceId: service.id,
              locationId,
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
              localStartsAt: `${localDate}T${formatLocalTimeInZone(startsAt, timezone)}`,
              localEndsAt: `${formatLocalDateInZone(endsAt, timezone)}T${formatLocalTimeInZone(endsAt, timezone)}`,
              timezone,
              slotToken,
            });
          }
        }
      }
    }
  }
  return { ok: true, data: { slots, timezone } };
}

export async function toolCreateBooking(
  c: PoolClient,
  org: string,
  customerId: string,
  args: { slotToken: string; confirmationMessageId: string; leadId?: string },
  ctx: { conversationId: string; agentRunId: string; targetIngressSequence: number },
): Promise<ToolOk | ToolErr> {
  // Ignore any customerConfirmed boolean if present — never trust it
  let secret: string;
  try {
    secret = resolveSlotTokenSecret();
  } catch {
    return { ok: false, code: 'TOOL_UNAVAILABLE' };
  }
  const verified = verifySlotToken(args.slotToken, secret, {
    organizationId: org,
    customerId,
  });
  if (!verified.ok) {
    return {
      ok: false,
      code: verified.code === 'TOKEN_EXPIRED' ? 'SLOT_UNAVAILABLE' : verified.code,
    };
  }
  const token = verified.payload;

  const msg = await c.query(
    `SELECT id, direction, conversation_id, content_text, ingress_sequence
     FROM messages WHERE organization_id=$1 AND id=$2`,
    [org, args.confirmationMessageId],
  );
  const m = msg.rows[0];
  if (!m || m.direction !== 'INBOUND' || m.conversation_id !== ctx.conversationId) {
    return { ok: false, code: 'CONFIRMATION_REQUIRED' };
  }
  if (m.ingress_sequence !== ctx.targetIngressSequence) {
    return { ok: false, code: 'CONFIRMATION_REQUIRED' };
  }
  if (!isExplicitBookingConfirmation(String(m.content_text ?? ''))) {
    return { ok: false, code: 'CONFIRMATION_REQUIRED' };
  }

  const svc = await c.query(
    `SELECT * FROM services WHERE organization_id=$1 AND id=$2 AND active=true AND archived_at IS NULL`,
    [org, token.serviceId],
  );
  const service = svc.rows[0];
  if (!service || service.booking_enabled !== true) return { ok: false, code: 'SLOT_UNAVAILABLE' };
  const startsAt = new Date(token.startsAt);
  const { endsAt, occupiedStartsAt, occupiedEndsAt } = occupiedRange(
    startsAt,
    Number(service.duration_minutes),
    Number(service.buffer_before_minutes),
    Number(service.buffer_after_minutes),
  );
  if (endsAt.toISOString() !== token.endsAt) return { ok: false, code: 'SLOT_UNAVAILABLE' };
  const now = new Date();
  if (startsAt.getTime() < now.getTime() + Number(service.minimum_lead_minutes) * 60_000) {
    return { ok: false, code: 'SLOT_UNAVAILABLE' };
  }
  const maxAdvance = new Date();
  maxAdvance.setUTCDate(maxAdvance.getUTCDate() + Number(service.maximum_advance_days));
  if (startsAt > maxAdvance) return { ok: false, code: 'SLOT_UNAVAILABLE' };

  const staff = await c.query(
    `SELECT id, display_name, location_id, active FROM staff_members
     WHERE organization_id=$1 AND id=$2 AND active=true AND archived_at IS NULL`,
    [org, token.staffMemberId],
  );
  if (!staff.rows[0] || staff.rows[0].location_id !== token.locationId) {
    return { ok: false, code: 'SLOT_UNAVAILABLE' };
  }
  const link = await c.query(
    `SELECT 1 FROM service_staff WHERE organization_id=$1 AND service_id=$2 AND staff_id=$3`,
    [org, token.serviceId, token.staffMemberId],
  );
  if (!link.rows[0]) return { ok: false, code: 'SLOT_UNAVAILABLE' };

  const loc = await c.query(
    `SELECT timezone FROM locations WHERE organization_id=$1 AND id=$2 AND active=true`,
    [org, token.locationId],
  );
  if (!loc.rows[0]) return { ok: false, code: 'SLOT_UNAVAILABLE' };

  // schedule window fit
  const timezone = loc.rows[0].timezone as string;
  const localDate = formatLocalDateInZone(startsAt, timezone);
  const dow = isoDayOfWeekInZone(startsAt, timezone);
  const rules = await c.query(
    `SELECT local_start_time, local_end_time FROM staff_availability_rules
     WHERE organization_id=$1 AND staff_member_id=$2 AND location_id=$3
       AND day_of_week=$4 AND is_active=true`,
    [org, token.staffMemberId, token.locationId, dow],
  );
  let windows = rules.rows.map((r) => ({
    startLocal: timeStr(r.local_start_time),
    endLocal: timeStr(r.local_end_time),
  }));
  const ex = await c.query(
    `SELECT type, local_start_time, local_end_time FROM staff_availability_exceptions
     WHERE organization_id=$1 AND staff_member_id=$2 AND location_id=$3 AND local_date=$4::date`,
    [org, token.staffMemberId, token.locationId, localDate],
  );
  windows = applyExceptionsToDay(
    windows,
    ex.rows.map((e) => ({
      type: e.type as 'AVAILABLE' | 'UNAVAILABLE',
      localStartTime: e.local_start_time ? timeStr(e.local_start_time) : null,
      localEndTime: e.local_end_time ? timeStr(e.local_end_time) : null,
    })),
  );
  const fits = windows.some((w) => {
    const a = nearest(localToUtcCandidates(localDate, w.startLocal, timezone), occupiedStartsAt);
    const b = nearest(localToUtcCandidates(localDate, w.endLocal, timezone), occupiedEndsAt);
    return a && b && intervalContained(occupiedStartsAt, occupiedEndsAt, a, b);
  });
  if (!fits) return { ok: false, code: 'SLOT_UNAVAILABLE' };

  if (args.leadId) {
    const lead = await c.query(
      `SELECT id, customer_id FROM leads WHERE organization_id=$1 AND id=$2`,
      [org, args.leadId],
    );
    if (!lead.rows[0] || lead.rows[0].customer_id !== customerId) {
      return { ok: false, code: 'INVALID_ARGS' };
    }
  }

  const id = randomUUID();
  try {
    await c.query('SAVEPOINT booking_insert');
    await c.query(
      `INSERT INTO bookings(
         id, organization_id, customer_id, service_id, location_id, staff_member_id, lead_id,
         source_conversation_id, source_message_id,
         starts_at, ends_at, occupied_starts_at, occupied_ends_at, timezone,
         duration_minutes, buffer_before_minutes, buffer_after_minutes, status,
         service_name_snapshot, staff_display_name_snapshot,
         created_by_type, created_by_agent_run_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,
         $10,$11,$12,$13,$14,
         $15,$16,$17,'CONFIRMED',
         $18,$19,
         'AGENT',$20
       )`,
      [
        id,
        org,
        customerId,
        token.serviceId,
        token.locationId,
        token.staffMemberId,
        args.leadId ?? null,
        ctx.conversationId,
        args.confirmationMessageId,
        startsAt.toISOString(),
        endsAt.toISOString(),
        occupiedStartsAt.toISOString(),
        occupiedEndsAt.toISOString(),
        timezone,
        Number(service.duration_minutes),
        Number(service.buffer_before_minutes),
        Number(service.buffer_after_minutes),
        service.name,
        staff.rows[0].display_name,
        ctx.agentRunId,
      ],
    );
    await c.query('RELEASE SAVEPOINT booking_insert');
  } catch (e) {
    try {
      await c.query('ROLLBACK TO SAVEPOINT booking_insert');
    } catch {
      /* ignore */
    }
    const msg = String((e as Error).message ?? e);
    if (msg.includes('excl') || msg.includes('exclusion') || msg.includes('overlap') || msg.includes('23P01')) {
      return { ok: false, code: 'SLOT_UNAVAILABLE' };
    }
    throw e;
  }
  await c.query(
    `INSERT INTO booking_activities(id,organization_id,booking_id,type,actor_type,actor_id,metadata_json)
     VALUES($1,$2,$3,'BOOKING_CREATED','AGENT',$4,$5::jsonb)`,
    [randomUUID(), org, id, ctx.agentRunId, JSON.stringify({ startsAt: token.startsAt })],
  );
  if (args.leadId) {
    await c.query(
      `INSERT INTO lead_activities(id,organization_id,lead_id,type,actor_type,actor_id,source_conversation_id,source_agent_run_id,metadata_json)
       VALUES($1,$2,$3,'BOOKING_CONFIRMED','AGENT',$4,$5,$6,$7::jsonb)`,
      [
        randomUUID(),
        org,
        args.leadId,
        ctx.agentRunId,
        ctx.conversationId,
        ctx.agentRunId,
        JSON.stringify({ bookingId: id }),
      ],
    );
  }
  return {
    ok: true,
    data: {
      bookingId: id,
      status: 'CONFIRMED',
      startsAt: token.startsAt,
      endsAt: token.endsAt,
      version: 1,
    },
  };
}

export async function toolGetBookings(
  c: PoolClient,
  org: string,
  customerId: string,
): Promise<ToolOk | ToolErr> {
  const r = await c.query(
    `SELECT id, service_id, staff_member_id, location_id, starts_at, ends_at, status, version
     FROM bookings WHERE organization_id=$1 AND customer_id=$2
     ORDER BY starts_at ASC LIMIT 50`,
    [org, customerId],
  );
  return { ok: true, data: { bookings: r.rows } };
}

export async function toolCancelBooking(
  c: PoolClient,
  org: string,
  customerId: string,
  args: { bookingId: string; expectedVersion: number; reasonCode?: string },
  ctx: { agentRunId: string },
): Promise<ToolOk | ToolErr> {
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 1) {
    return { ok: false, code: 'INVALID_ARGS' };
  }
  const reason = args.reasonCode ?? 'CUSTOMER_REQUEST';
  if (!['CUSTOMER_REQUEST', 'CLINIC_REQUEST', 'DUPLICATE_BOOKING', 'OTHER'].includes(reason)) {
    return { ok: false, code: 'INVALID_ARGS' };
  }
  const upd = await c.query(
    `UPDATE bookings SET status='CANCELLED', cancellation_reason_code=$5,
       version=version+1, updated_at=now()
     WHERE organization_id=$1 AND id=$2 AND customer_id=$3 AND version=$4 AND status='CONFIRMED'
     RETURNING id, version, status`,
    [org, args.bookingId, customerId, args.expectedVersion, reason],
  );
  if (!upd.rows[0]) return { ok: false, code: 'VERSION_CONFLICT' };
  await c.query(
    `INSERT INTO booking_activities(id,organization_id,booking_id,type,actor_type,actor_id,metadata_json)
     VALUES($1,$2,$3,'BOOKING_CANCELLED','AGENT',$4,$5::jsonb)`,
    [randomUUID(), org, args.bookingId, ctx.agentRunId, JSON.stringify({ reasonCode: reason })],
  );
  return { ok: true, data: upd.rows[0] };
}

export async function toolRescheduleBooking(
  c: PoolClient,
  org: string,
  customerId: string,
  args: { bookingId: string; expectedVersion: number; slotToken: string },
  ctx: { agentRunId: string },
): Promise<ToolOk | ToolErr> {
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 1) {
    return { ok: false, code: 'INVALID_ARGS' };
  }
  let secret: string;
  try {
    secret = resolveSlotTokenSecret();
  } catch {
    return { ok: false, code: 'TOOL_UNAVAILABLE' };
  }
  const cur = await c.query(
    `SELECT * FROM bookings WHERE organization_id=$1 AND id=$2 AND customer_id=$3 FOR UPDATE`,
    [org, args.bookingId, customerId],
  );
  const current = cur.rows[0];
  if (!current || current.status !== 'CONFIRMED') return { ok: false, code: 'NOT_FOUND' };
  if (Number(current.version) !== args.expectedVersion) return { ok: false, code: 'VERSION_CONFLICT' };

  const verified = verifySlotToken(args.slotToken, secret, { organizationId: org, customerId });
  if (!verified.ok) return { ok: false, code: 'SLOT_UNAVAILABLE' };
  const token = verified.payload;

  const svc = await c.query(`SELECT * FROM services WHERE organization_id=$1 AND id=$2`, [
    org,
    token.serviceId,
  ]);
  const service = svc.rows[0];
  if (!service || service.booking_enabled !== true) return { ok: false, code: 'SLOT_UNAVAILABLE' };
  const startsAt = new Date(token.startsAt);
  const { endsAt, occupiedStartsAt, occupiedEndsAt } = occupiedRange(
    startsAt,
    Number(service.duration_minutes),
    Number(service.buffer_before_minutes),
    Number(service.buffer_after_minutes),
  );
  if (endsAt.toISOString() !== token.endsAt) return { ok: false, code: 'SLOT_UNAVAILABLE' };

  // Clear self from exclusion temporarily
  await c.query(`UPDATE bookings SET status='CANCELLED' WHERE organization_id=$1 AND id=$2`, [
    org,
    args.bookingId,
  ]);

  const conflict = await c.query(
    `SELECT id FROM bookings WHERE organization_id=$1 AND status='CONFIRMED'
       AND (staff_member_id=$2 OR customer_id=$3)
       AND occupied_starts_at < $5 AND occupied_ends_at > $4
     LIMIT 1`,
    [
      org,
      token.staffMemberId,
      customerId,
      occupiedStartsAt.toISOString(),
      occupiedEndsAt.toISOString(),
    ],
  );
  if (conflict.rows[0]) {
    await c.query(
      `UPDATE bookings SET status='CONFIRMED',
         starts_at=$3, ends_at=$4, occupied_starts_at=$5, occupied_ends_at=$6,
         service_id=$7, location_id=$8, staff_member_id=$9
       WHERE organization_id=$1 AND id=$2`,
      [
        org,
        args.bookingId,
        current.starts_at,
        current.ends_at,
        current.occupied_starts_at,
        current.occupied_ends_at,
        current.service_id,
        current.location_id,
        current.staff_member_id,
      ],
    );
    return { ok: false, code: 'SLOT_UNAVAILABLE' };
  }

  try {
    const upd = await c.query(
      `UPDATE bookings SET status='CONFIRMED',
         service_id=$3, location_id=$4, staff_member_id=$5,
         starts_at=$6, ends_at=$7, occupied_starts_at=$8, occupied_ends_at=$9,
         duration_minutes=$10, buffer_before_minutes=$11, buffer_after_minutes=$12,
         version=version+1, updated_at=now()
       WHERE organization_id=$1 AND id=$2 AND version=$13
       RETURNING id, version, starts_at, ends_at, status`,
      [
        org,
        args.bookingId,
        token.serviceId,
        token.locationId,
        token.staffMemberId,
        startsAt.toISOString(),
        endsAt.toISOString(),
        occupiedStartsAt.toISOString(),
        occupiedEndsAt.toISOString(),
        Number(service.duration_minutes),
        Number(service.buffer_before_minutes),
        Number(service.buffer_after_minutes),
        args.expectedVersion,
      ],
    );
    if (!upd.rows[0]) {
      await c.query(
        `UPDATE bookings SET status='CONFIRMED' WHERE organization_id=$1 AND id=$2`,
        [org, args.bookingId],
      );
      return { ok: false, code: 'VERSION_CONFLICT' };
    }
    await c.query(
      `INSERT INTO booking_activities(id,organization_id,booking_id,type,actor_type,actor_id,metadata_json)
       VALUES($1,$2,$3,'BOOKING_RESCHEDULED','AGENT',$4,$5::jsonb)`,
      [
        randomUUID(),
        org,
        args.bookingId,
        ctx.agentRunId,
        JSON.stringify({ from: current.starts_at, to: token.startsAt }),
      ],
    );
    return { ok: true, data: upd.rows[0] };
  } catch {
    await c.query(
      `UPDATE bookings SET status='CONFIRMED',
         starts_at=$3, ends_at=$4, occupied_starts_at=$5, occupied_ends_at=$6,
         service_id=$7, location_id=$8, staff_member_id=$9
       WHERE organization_id=$1 AND id=$2`,
      [
        org,
        args.bookingId,
        current.starts_at,
        current.ends_at,
        current.occupied_starts_at,
        current.occupied_ends_at,
        current.service_id,
        current.location_id,
        current.staff_member_id,
      ],
    );
    return { ok: false, code: 'SLOT_UNAVAILABLE' };
  }
}

function enumDates(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
function toSec(t: string): number {
  const [h, m, s] = (t.length === 5 ? `${t}:00` : t).split(':').map(Number);
  return h! * 3600 + m! * 60 + (s ?? 0);
}
function fromSec(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function nearest(cands: Date[], target: Date): Date | null {
  if (!cands.length) return null;
  return cands.reduce((b, x) =>
    Math.abs(x.getTime() - target.getTime()) < Math.abs(b.getTime() - target.getTime()) ? x : b,
  );
}
