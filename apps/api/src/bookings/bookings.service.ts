import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  TenantContextService,
  type ActorContext,
  type TenantTxClient,
} from '../database/tenant-context.service.js';
import { domainEvent } from '../domain/domain-event.js';
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
} from '../domain/booking-time.js';
import {
  resolveSlotTokenSecret,
  signSlotToken,
  verifySlotToken,
  type SlotTokenPayloadV1,
} from '../domain/slot-token.js';

const SLOT_STEP_MINUTES = 15;
const MAX_SLOTS = 20;

type ServiceRow = {
  id: string;
  locationId: string;
  name: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  bookingEnabled: boolean;
  minimumLeadMinutes: number;
  maximumAdvanceDays: number;
  active: boolean;
  archivedAt: Date | null;
};

@Injectable()
export class BookingsService {
  constructor(private readonly tenants: TenantContextService) {}

  private async membership(actor: ActorContext, organizationId: string) {
    const m = (await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    )) as { status: string; role: string } | null;
    if (!m || m.status !== 'ACTIVE') throw new NotFoundException();
    return m;
  }

  private requireRead(role: string) {
    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(role)) {
      throw new ForbiddenException('MEMBER+ required');
    }
  }

  private requireWrite(role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('ADMIN/OWNER required');
    }
  }

  private secret() {
    try {
      return resolveSlotTokenSecret();
    } catch (e) {
      throw new ServiceUnavailableException((e as Error).message);
    }
  }

  private timeToStr(v: Date | string): string {
    if (typeof v === 'string') return v.length === 5 ? `${v}:00` : v;
    // Prisma Time mapped as Date — use UTC components of the time-only value
    const iso = v.toISOString();
    return iso.slice(11, 19);
  }

  // ——— Schedule CRUD ———

  async listRules(actor: ActorContext, organizationId: string, staffMemberId?: string) {
    const m = await this.membership(actor, organizationId);
    this.requireRead(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.staffAvailabilityRule.findMany({
        where: {
          organizationId,
          ...(staffMemberId ? { staffMemberId } : {}),
        },
        orderBy: [{ staffMemberId: 'asc' }, { dayOfWeek: 'asc' }, { localStartTime: 'asc' }],
      }),
    );
  }

  async createRule(
    actor: ActorContext,
    organizationId: string,
    input: {
      staffMemberId: string;
      locationId: string;
      dayOfWeek: number;
      localStartTime: string;
      localEndTime: string;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
    },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 1 || input.dayOfWeek > 7) {
      throw new BadRequestException('Invalid dayOfWeek');
    }
    if (input.localStartTime >= input.localEndTime) {
      throw new BadRequestException('localStartTime must be before localEndTime');
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertStaffLocation(tx, organizationId, input.staffMemberId, input.locationId);
      const row = await tx.staffAvailabilityRule.create({
        data: {
          id: randomUUID(),
          organizationId,
          staffMemberId: input.staffMemberId,
          locationId: input.locationId,
          dayOfWeek: input.dayOfWeek,
          localStartTime: this.asTime(input.localStartTime),
          localEndTime: this.asTime(input.localEndTime),
          effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
          effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
        },
      });
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'schedule.rule_created',
        targetType: 'StaffAvailabilityRule',
        targetId: row.id,
        requestId: actor.requestId,
      });
      return row;
    });
  }

  async listExceptions(actor: ActorContext, organizationId: string, staffMemberId?: string) {
    const m = await this.membership(actor, organizationId);
    this.requireRead(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.staffAvailabilityException.findMany({
        where: {
          organizationId,
          ...(staffMemberId ? { staffMemberId } : {}),
        },
        orderBy: [{ localDate: 'asc' }],
      }),
    );
  }

  async createException(
    actor: ActorContext,
    organizationId: string,
    input: {
      staffMemberId: string;
      locationId: string;
      localDate: string;
      type: 'AVAILABLE' | 'UNAVAILABLE';
      localStartTime?: string | null;
      localEndTime?: string | null;
      reasonCode?: string | null;
    },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    if (input.type !== 'AVAILABLE' && input.type !== 'UNAVAILABLE') {
      throw new BadRequestException('Invalid exception type');
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertStaffLocation(tx, organizationId, input.staffMemberId, input.locationId);
      const row = await tx.staffAvailabilityException.create({
        data: {
          id: randomUUID(),
          organizationId,
          staffMemberId: input.staffMemberId,
          locationId: input.locationId,
          localDate: new Date(input.localDate),
          type: input.type,
          localStartTime: input.localStartTime ? this.asTime(input.localStartTime) : undefined,
          localEndTime: input.localEndTime ? this.asTime(input.localEndTime) : undefined,
          reasonCode: input.reasonCode ?? undefined,
        },
      });
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'schedule.exception_created',
        targetType: 'StaffAvailabilityException',
        targetId: row.id,
        requestId: actor.requestId,
      });
      return row;
    });
  }

  private asTime(hhmmss: string): Date {
    const t = hhmmss.length === 5 ? `${hhmmss}:00` : hhmmss;
    return new Date(`1970-01-01T${t}.000Z`);
  }

  private async assertStaffLocation(
    tx: TenantTxClient,
    organizationId: string,
    staffMemberId: string,
    locationId: string,
  ) {
    const staff = await tx.staffMember.findUnique({
      where: { organizationId_id: { organizationId, id: staffMemberId } },
    });
    if (!staff || !staff.active || staff.archivedAt) throw new BadRequestException('Invalid staff');
    if (staff.locationId !== locationId) {
      throw new BadRequestException('Staff location mismatch');
    }
    const loc = await tx.location.findUnique({
      where: { organizationId_id: { organizationId, id: locationId } },
    });
    if (!loc || !loc.active || loc.archivedAt) throw new BadRequestException('Invalid location');
  }

  // ——— Availability ———

  async getAvailableSlots(
    actor: ActorContext | null,
    organizationId: string,
    input: {
      serviceId: string;
      locationId?: string;
      staffMemberId?: string;
      startDate: string;
      endDate?: string;
      customerId: string;
      limit?: number;
    },
  ) {
    if (actor) {
      const m = await this.membership(actor, organizationId);
      this.requireRead(m.role);
    }
    const limit = Math.min(Math.max(input.limit ?? MAX_SLOTS, 1), MAX_SLOTS);
    return this.tenants.runInTenantContext(
      organizationId,
      actor ?? { userId: '00000000-0000-4000-8000-0000000000a1', authSubject: 'system' },
      async (tx) => this.generateSlotsInTx(tx, organizationId, input, limit),
    );
  }

  /** Agent/tool path — same generation inside existing tenant TX or new. */
  async generateSlotsInTx(
    tx: TenantTxClient,
    organizationId: string,
    input: {
      serviceId: string;
      locationId?: string;
      staffMemberId?: string;
      startDate: string;
      endDate?: string;
      customerId: string;
      limit?: number;
    },
    limit = MAX_SLOTS,
  ) {
    const service = (await tx.service.findUnique({
      where: { organizationId_id: { organizationId, id: input.serviceId } },
    })) as ServiceRow | null;
    if (!service || !service.active || service.archivedAt) throw new NotFoundException('Service');
    if (!service.bookingEnabled) throw new BadRequestException('Service not bookable');

    const locationId = input.locationId ?? service.locationId;
    if (locationId !== service.locationId) {
      throw new BadRequestException('Service location mismatch');
    }
    const location = await tx.location.findUnique({
      where: { organizationId_id: { organizationId, id: locationId } },
    });
    if (!location || !location.active || location.archivedAt) {
      throw new NotFoundException('Location');
    }
    const timezone = location.timezone;

    const startDate = input.startDate;
    const endDate = input.endDate ?? startDate;
    const maxEnd = new Date();
    maxEnd.setUTCDate(maxEnd.getUTCDate() + service.maximumAdvanceDays);
    // iterate local dates
    const dates = enumerateDates(startDate, endDate);
    if (dates.length > service.maximumAdvanceDays + 1) {
      throw new BadRequestException('Search window too large');
    }

    let staffIds: string[];
    if (input.staffMemberId) {
      staffIds = [input.staffMemberId];
    } else {
      const links = await tx.serviceStaff.findMany({
        where: { organizationId, serviceId: service.id },
      });
      staffIds = links.map((l: { staffId: string }) => l.staffId);
    }

    const staffRows = await tx.staffMember.findMany({
      where: {
        organizationId,
        id: { in: staffIds },
        locationId,
        active: true,
        archivedAt: null,
      },
      orderBy: { id: 'asc' },
    });
    if (!staffRows.length) return { slots: [], timezone };

    const now = new Date();
    const minStart = new Date(now.getTime() + service.minimumLeadMinutes * 60_000);
    const secret = this.secret();
    const slots: Array<Record<string, unknown>> = [];

    for (const staff of staffRows) {
      if (slots.length >= limit) break;
      for (const localDate of dates) {
        if (slots.length >= limit) break;
        const dow = (() => {
          // noon UTC probe → DOW in zone for localDate
          const probe = localToUtcCandidates(localDate, '12:00:00', timezone)[0];
          if (!probe) return null;
          return isoDayOfWeekInZone(probe, timezone);
        })();
        if (!dow) continue;

        const rules = await tx.staffAvailabilityRule.findMany({
          where: {
            organizationId,
            staffMemberId: staff.id,
            locationId,
            dayOfWeek: dow,
            isActive: true,
          },
        });
        const effectiveRules = rules.filter((r: {
          effectiveFrom: Date | null;
          effectiveTo: Date | null;
        }) => {
          const from = r.effectiveFrom ? r.effectiveFrom.toISOString().slice(0, 10) : null;
          const to = r.effectiveTo ? r.effectiveTo.toISOString().slice(0, 10) : null;
          if (from && localDate < from) return false;
          if (to && localDate > to) return false;
          return true;
        });
        let windows = effectiveRules.map((r: { localStartTime: unknown; localEndTime: unknown }) => ({
          startLocal: this.timeToStr(r.localStartTime as unknown as Date),
          endLocal: this.timeToStr(r.localEndTime as unknown as Date),
        }));

        const exceptions = await tx.staffAvailabilityException.findMany({
          where: {
            organizationId,
            staffMemberId: staff.id,
            locationId,
            localDate: new Date(localDate),
          },
        });
        windows = applyExceptionsToDay(
          windows,
          exceptions.map((e: {
            type: string;
            localStartTime: unknown;
            localEndTime: unknown;
          }) => ({
            type: e.type as 'AVAILABLE' | 'UNAVAILABLE',
            localStartTime: e.localStartTime
              ? this.timeToStr(e.localStartTime as unknown as Date)
              : null,
            localEndTime: e.localEndTime
              ? this.timeToStr(e.localEndTime as unknown as Date)
              : null,
          })),
        );

        const dayStartCandidates = localToUtcCandidates(localDate, '00:00:00', timezone);
        const dayEndCandidates = localToUtcCandidates(localDate, '23:59:59', timezone);
        const rangeStart = dayStartCandidates[0] ?? new Date(`${localDate}T00:00:00Z`);
        const rangeEnd = dayEndCandidates[dayEndCandidates.length - 1] ?? new Date(`${localDate}T23:59:59Z`);

        const existing = await tx.booking.findMany({
          where: {
            organizationId,
            status: 'CONFIRMED',
            OR: [
              { staffMemberId: staff.id },
              { customerId: input.customerId },
            ],
            occupiedStartsAt: { lt: rangeEnd },
            occupiedEndsAt: { gt: rangeStart },
          },
        });

        for (const w of windows) {
          const startSecs = timeToSec(w.startLocal);
          const endSecs = timeToSec(w.endLocal);
          for (let sec = startSecs; sec + service.durationMinutes * 60 <= endSecs; sec += SLOT_STEP_MINUTES * 60) {
            if (slots.length >= limit) break;
            const localStart = secToTime(sec);
            const utcStarts = localToUtcCandidates(localDate, localStart, timezone);
            for (const startsAt of utcStarts) {
              if (startsAt < minStart) continue;
              if (startsAt > maxEnd) continue;
              const { endsAt, occupiedStartsAt, occupiedEndsAt } = occupiedRange(
                startsAt,
                service.durationMinutes,
                service.bufferBeforeMinutes,
                service.bufferAfterMinutes,
              );
              // occupied must fit in this local window (capacity)
              const winStartUtc = localToUtcCandidates(localDate, w.startLocal, timezone);
              const winEndUtc = localToUtcCandidates(localDate, w.endLocal, timezone);
              // For dual candidates, match same index when possible
              const ws = pickNearest(winStartUtc, startsAt);
              const we = pickNearest(winEndUtc, endsAt);
              if (!ws || !we) continue;
              if (!intervalContained(occupiedStartsAt, occupiedEndsAt, ws, we)) continue;

              const conflict = existing.some((b: {
                occupiedStartsAt: Date;
                occupiedEndsAt: Date;
              }) =>
                rangesOverlap(
                  occupiedStartsAt,
                  occupiedEndsAt,
                  b.occupiedStartsAt,
                  b.occupiedEndsAt,
                ),
              );
              if (conflict) continue;

              const slotToken = signSlotToken(
                {
                  organizationId,
                  customerId: input.customerId,
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
                utcOffsetMinutes: -startsAt.getTimezoneOffset(), // display hint only; prefer token UTC
                slotToken,
              });
              if (slots.length >= limit) break;
            }
          }
        }
      }
    }

    slots.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)) || String(a.staffMemberId).localeCompare(String(b.staffMemberId)));
    return { slots: slots.slice(0, limit), timezone };
  }

  // ——— Bookings ———

  async list(actor: ActorContext, organizationId: string, query?: { customerId?: string; status?: string }) {
    const m = await this.membership(actor, organizationId);
    this.requireRead(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.booking.findMany({
        where: {
          organizationId,
          ...(query?.customerId ? { customerId: query.customerId } : {}),
          ...(query?.status ? { status: query.status } : {}),
        },
        orderBy: [{ startsAt: 'asc' }],
        take: 100,
      }),
    );
  }

  async get(actor: ActorContext, organizationId: string, bookingId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireRead(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const row = await tx.booking.findUnique({
        where: { organizationId_id: { organizationId, id: bookingId } },
      });
      if (!row) throw new NotFoundException();
      return row;
    });
  }

  async createFromOperator(
    actor: ActorContext,
    organizationId: string,
    input: { slotToken: string; customerId: string; leadId?: string | null },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) =>
      this.createBookingInTx(tx, {
        organizationId,
        customerId: input.customerId,
        slotToken: input.slotToken,
        leadId: input.leadId,
        actorType: 'USER',
        actorUserId: actor.userId,
        requestId: actor.requestId,
        skipConfirmationProof: true,
      }),
    );
  }

  async createBookingInTx(
    tx: TenantTxClient,
    input: {
      organizationId: string;
      customerId: string;
      slotToken: string;
      leadId?: string | null;
      actorType: 'USER' | 'AGENT';
      actorUserId?: string;
      agentRunId?: string;
      conversationId?: string;
      sourceMessageId?: string;
      requestId?: string;
      /** When set, prove inbound confirmation (agent path). */
      confirmationMessageId?: string;
      skipConfirmationProof?: boolean;
    },
  ) {
    const secret = this.secret();
    const verified = verifySlotToken(input.slotToken, secret, {
      organizationId: input.organizationId,
      customerId: input.customerId,
    });
    if (!verified.ok) {
      if (verified.code === 'TOKEN_EXPIRED') throw new ConflictException('SLOT_UNAVAILABLE');
      throw new BadRequestException(verified.code);
    }
    const token = verified.payload;

    if (input.confirmationMessageId) {
      await this.proveConfirmationMessage(tx, {
        organizationId: input.organizationId,
        customerId: input.customerId,
        conversationId: input.conversationId!,
        confirmationMessageId: input.confirmationMessageId,
        agentRunId: input.agentRunId,
      });
    } else if (!input.skipConfirmationProof) {
      throw new BadRequestException('confirmationMessageId required');
    }

    const ok = await this.revalidateSlot(tx, input.organizationId, token);
    if (!ok) throw new ConflictException('SLOT_UNAVAILABLE');

    const service = (await tx.service.findUniqueOrThrow({
      where: { organizationId_id: { organizationId: input.organizationId, id: token.serviceId } },
    })) as ServiceRow;
    const staff = await tx.staffMember.findUniqueOrThrow({
      where: {
        organizationId_id: { organizationId: input.organizationId, id: token.staffMemberId },
      },
    });
    const startsAt = new Date(token.startsAt);
    const { endsAt, occupiedStartsAt, occupiedEndsAt } = occupiedRange(
      startsAt,
      service.durationMinutes,
      service.bufferBeforeMinutes,
      service.bufferAfterMinutes,
    );
    if (endsAt.toISOString() !== token.endsAt) {
      throw new ConflictException('SLOT_UNAVAILABLE');
    }

    if (input.leadId) {
      const lead = await tx.lead.findUnique({
        where: {
          organizationId_id: { organizationId: input.organizationId, id: input.leadId },
        },
      });
      if (!lead || lead.customerId !== input.customerId) {
        throw new BadRequestException('Invalid leadId');
      }
    }

    const location = await tx.location.findUniqueOrThrow({
      where: {
        organizationId_id: { organizationId: input.organizationId, id: token.locationId },
      },
    });

    let booking;
    try {
      booking = await tx.booking.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          customerId: input.customerId,
          serviceId: token.serviceId,
          locationId: token.locationId,
          staffMemberId: token.staffMemberId,
          leadId: input.leadId ?? undefined,
          sourceConversationId: input.conversationId,
          sourceMessageId: input.sourceMessageId ?? input.confirmationMessageId,
          startsAt,
          endsAt,
          occupiedStartsAt,
          occupiedEndsAt,
          timezone: location.timezone,
          durationMinutes: service.durationMinutes,
          bufferBeforeMinutes: service.bufferBeforeMinutes,
          bufferAfterMinutes: service.bufferAfterMinutes,
          status: 'CONFIRMED',
          serviceNameSnapshot: service.name,
          staffDisplayNameSnapshot: staff.displayName,
          createdByType: input.actorType,
          createdByUserId: input.actorUserId,
          createdByAgentRunId: input.agentRunId,
        },
      });
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      if (msg.includes('bookings_staff_occupied_excl') || msg.includes('bookings_customer_occupied_excl') || msg.includes('exclusion')) {
        throw new ConflictException('SLOT_UNAVAILABLE');
      }
      throw e;
    }

    await tx.bookingActivity.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        bookingId: booking.id,
        type: 'BOOKING_CREATED',
        actorType: input.actorType,
        actorId: input.actorUserId ?? input.agentRunId,
        metadataJson: { startsAt: token.startsAt, endsAt: token.endsAt },
      },
    });

    if (input.leadId) {
      await tx.leadActivity.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          leadId: input.leadId,
          type: 'BOOKING_CONFIRMED',
          actorType: input.actorType,
          actorId: input.actorUserId ?? input.agentRunId,
          sourceConversationId: input.conversationId,
          sourceAgentRunId: input.agentRunId,
          metadataJson: { bookingId: booking.id },
        },
      });
    }

    const event = domainEvent({
      organizationId: input.organizationId,
      eventType: 'booking.confirmed',
      aggregateType: 'Booking',
      aggregateId: booking.id,
      aggregateVersion: booking.version,
      actor: {
        type: 'USER',
        id: input.actorUserId ?? input.agentRunId ?? randomUUID(),
      },
      correlationId: input.requestId,
      payload: {
        bookingId: booking.id,
        customerId: input.customerId,
        startsAt: token.startsAt,
        endsAt: token.endsAt,
      },
    });
    await this.tenants.writeOutbox(tx, {
      organizationId: input.organizationId,
      eventType: event.eventType,
      payloadJson: event,
    });
    if (input.actorUserId) {
      await this.tenants.writeAudit(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: 'booking.confirmed',
        targetType: 'Booking',
        targetId: booking.id,
        requestId: input.requestId,
      });
    }
    return booking;
  }

  private async proveConfirmationMessage(
    tx: TenantTxClient,
    input: {
      organizationId: string;
      customerId: string;
      conversationId: string;
      confirmationMessageId: string;
      agentRunId?: string;
    },
  ) {
    const msg = await tx.message.findUnique({
      where: {
        organizationId_id: {
          organizationId: input.organizationId,
          id: input.confirmationMessageId,
        },
      },
    });
    if (!msg || msg.direction !== 'INBOUND') {
      throw new BadRequestException('CONFIRMATION_REQUIRED');
    }
    if (msg.conversationId !== input.conversationId) {
      throw new BadRequestException('CONFIRMATION_REQUIRED');
    }
    const conv = await tx.conversation.findUnique({
      where: {
        organizationId_id: { organizationId: input.organizationId, id: input.conversationId },
      },
    });
    if (!conv || conv.customerId !== input.customerId) {
      throw new BadRequestException('CONFIRMATION_REQUIRED');
    }
    if (input.agentRunId) {
      const run = await tx.agentRun.findUnique({
        where: {
          organizationId_id: { organizationId: input.organizationId, id: input.agentRunId },
        },
      });
      if (!run || run.conversationId !== input.conversationId) {
        throw new BadRequestException('CONFIRMATION_REQUIRED');
      }
      // Message must be the inbound driving this run (targetIngressSequence)
      if (msg.ingressSequence == null || msg.ingressSequence !== run.targetIngressSequence) {
        throw new BadRequestException('CONFIRMATION_REQUIRED');
      }
    }
    if (!isExplicitBookingConfirmation(msg.contentText)) {
      throw new BadRequestException('CONFIRMATION_REQUIRED');
    }
  }

  private async revalidateSlot(
    tx: TenantTxClient,
    organizationId: string,
    token: SlotTokenPayloadV1,
  ): Promise<boolean> {
    const service = (await tx.service.findUnique({
      where: { organizationId_id: { organizationId, id: token.serviceId } },
    })) as ServiceRow | null;
    if (!service || !service.active || service.archivedAt || !service.bookingEnabled) return false;
    const startsAt = new Date(token.startsAt);
    const expectedEnds = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    if (expectedEnds.toISOString() !== token.endsAt) return false;
    const now = new Date();
    if (startsAt.getTime() < now.getTime() + service.minimumLeadMinutes * 60_000) return false;
    const max = new Date();
    max.setUTCDate(max.getUTCDate() + service.maximumAdvanceDays);
    if (startsAt > max) return false;

    const staff = await tx.staffMember.findUnique({
      where: { organizationId_id: { organizationId, id: token.staffMemberId } },
    });
    if (!staff || !staff.active || staff.archivedAt) return false;
    if (staff.locationId !== token.locationId || staff.locationId !== service.locationId) {
      return false;
    }
    const link = await tx.serviceStaff.findUnique({
      where: {
        organizationId_serviceId_staffId: {
          organizationId,
          serviceId: service.id,
          staffId: staff.id,
        },
      },
    });
    if (!link) return false;

    const location = await tx.location.findUnique({
      where: { organizationId_id: { organizationId, id: token.locationId } },
    });
    if (!location || !location.active) return false;

    const timezone = location.timezone;
    const localDate = formatLocalDateInZone(startsAt, timezone);
    const dow = isoDayOfWeekInZone(startsAt, timezone);
    const { occupiedStartsAt, occupiedEndsAt } = occupiedRange(
      startsAt,
      service.durationMinutes,
      service.bufferBeforeMinutes,
      service.bufferAfterMinutes,
    );

    const rules = await tx.staffAvailabilityRule.findMany({
      where: {
        organizationId,
        staffMemberId: staff.id,
        locationId: location.id,
        dayOfWeek: dow,
        isActive: true,
      },
    });
    let windows = rules
      .filter((r: { effectiveFrom: Date | null; effectiveTo: Date | null }) => {
        const from = r.effectiveFrom ? r.effectiveFrom.toISOString().slice(0, 10) : null;
        const to = r.effectiveTo ? r.effectiveTo.toISOString().slice(0, 10) : null;
        if (from && localDate < from) return false;
        if (to && localDate > to) return false;
        return true;
      })
      .map((r: { localStartTime: unknown; localEndTime: unknown }) => ({
        startLocal: this.timeToStr(r.localStartTime as unknown as Date),
        endLocal: this.timeToStr(r.localEndTime as unknown as Date),
      }));
    const exceptions = await tx.staffAvailabilityException.findMany({
      where: {
        organizationId,
        staffMemberId: staff.id,
        locationId: location.id,
        localDate: new Date(localDate),
      },
    });
    windows = applyExceptionsToDay(
      windows,
      exceptions.map((e: {
        type: string;
        localStartTime: unknown;
        localEndTime: unknown;
      }) => ({
        type: e.type as 'AVAILABLE' | 'UNAVAILABLE',
        localStartTime: e.localStartTime
          ? this.timeToStr(e.localStartTime as unknown as Date)
          : null,
        localEndTime: e.localEndTime ? this.timeToStr(e.localEndTime as unknown as Date) : null,
      })),
    );

    const fits = windows.some((w: { startLocal: string; endLocal: string }) => {
      const ws = localToUtcCandidates(localDate, w.startLocal, timezone);
      const we = localToUtcCandidates(localDate, w.endLocal, timezone);
      const a = pickNearest(ws, occupiedStartsAt);
      const b = pickNearest(we, occupiedEndsAt);
      return a && b && intervalContained(occupiedStartsAt, occupiedEndsAt, a, b);
    });
    if (!fits) return false;

    const conflicts = await tx.booking.findMany({
      where: {
        organizationId,
        status: 'CONFIRMED',
        OR: [{ staffMemberId: staff.id }, { customerId: token.customerId }],
        occupiedStartsAt: { lt: occupiedEndsAt },
        occupiedEndsAt: { gt: occupiedStartsAt },
      },
    });
    return conflicts.length === 0;
  }

  async cancel(
    actor: ActorContext,
    organizationId: string,
    bookingId: string,
    input: { expectedVersion: number; reasonCode: string; reasonText?: string },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
      throw new BadRequestException('expectedVersion required');
    }
    if (!['CUSTOMER_REQUEST', 'CLINIC_REQUEST', 'DUPLICATE_BOOKING', 'OTHER'].includes(input.reasonCode)) {
      throw new BadRequestException('Invalid reasonCode');
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const result = await tx.booking.updateMany({
        where: {
          organizationId,
          id: bookingId,
          version: input.expectedVersion,
          status: 'CONFIRMED',
        },
        data: {
          status: 'CANCELLED',
          cancellationReasonCode: input.reasonCode,
          cancellationReasonText: input.reasonText?.slice(0, 500),
          version: { increment: 1 },
        },
      });
      if (!result.count) throw new ConflictException('VERSION_CONFLICT');
      const row = await tx.booking.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: bookingId } },
      });
      await tx.bookingActivity.create({
        data: {
          id: randomUUID(),
          organizationId,
          bookingId,
          type: 'BOOKING_CANCELLED',
          actorType: 'USER',
          actorId: actor.userId,
          metadataJson: { reasonCode: input.reasonCode },
        },
      });
      if (row.leadId) {
        await tx.leadActivity.create({
          data: {
            id: randomUUID(),
            organizationId,
            leadId: row.leadId,
            type: 'BOOKING_CANCELLED',
            actorType: 'USER',
            actorId: actor.userId,
            metadataJson: { bookingId },
          },
        });
      }
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'booking.cancelled',
        targetType: 'Booking',
        targetId: bookingId,
        requestId: actor.requestId,
      });
      return row;
    });
  }

  async reschedule(
    actor: ActorContext,
    organizationId: string,
    bookingId: string,
    input: { expectedVersion: number; slotToken: string },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
      throw new BadRequestException('expectedVersion required');
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const current = await tx.booking.findUnique({
        where: { organizationId_id: { organizationId, id: bookingId } },
      });
      if (!current || current.status !== 'CONFIRMED') throw new NotFoundException();
      if (current.version !== input.expectedVersion) {
        throw new ConflictException('VERSION_CONFLICT');
      }

      const secret = this.secret();
      const verified = verifySlotToken(input.slotToken, secret, {
        organizationId,
        customerId: current.customerId,
      });
      if (!verified.ok) throw new ConflictException('SLOT_UNAVAILABLE');
      const token = verified.payload;

      const service = (await tx.service.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: token.serviceId } },
      })) as ServiceRow;
      const staff = await tx.staffMember.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: token.staffMemberId } },
      });
      const startsAt = new Date(token.startsAt);
      const { endsAt, occupiedStartsAt, occupiedEndsAt } = occupiedRange(
        startsAt,
        service.durationMinutes,
        service.bufferBeforeMinutes,
        service.bufferAfterMinutes,
      );
      if (endsAt.toISOString() !== token.endsAt) {
        throw new ConflictException('SLOT_UNAVAILABLE');
      }
      const location = await tx.location.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: token.locationId } },
      });

      // Soft revalidate ignoring this booking's own occupied range
      const tokenForReval = { ...token };
      const otherConflicts = await tx.booking.findMany({
        where: {
          organizationId,
          status: 'CONFIRMED',
          id: { not: bookingId },
          OR: [{ staffMemberId: token.staffMemberId }, { customerId: current.customerId }],
          occupiedStartsAt: { lt: occupiedEndsAt },
          occupiedEndsAt: { gt: occupiedStartsAt },
        },
      });
      if (otherConflicts.length) throw new ConflictException('SLOT_UNAVAILABLE');

      // Schedule/eligibility (without existing-booking check against self)
      await tx.booking.update({
        where: { organizationId_id: { organizationId, id: bookingId } },
        data: { status: 'CANCELLED' },
      });
      const scheduleOk = await this.revalidateSlot(tx, organizationId, tokenForReval);
      if (!scheduleOk) {
        await tx.booking.update({
          where: { organizationId_id: { organizationId, id: bookingId } },
          data: {
            status: 'CONFIRMED',
            startsAt: current.startsAt,
            endsAt: current.endsAt,
            occupiedStartsAt: current.occupiedStartsAt,
            occupiedEndsAt: current.occupiedEndsAt,
          },
        });
        throw new ConflictException('SLOT_UNAVAILABLE');
      }

      try {
        await tx.booking.update({
          where: { organizationId_id: { organizationId, id: bookingId } },
          data: {
            status: 'CONFIRMED',
            serviceId: token.serviceId,
            locationId: token.locationId,
            staffMemberId: token.staffMemberId,
            startsAt,
            endsAt,
            occupiedStartsAt,
            occupiedEndsAt,
            timezone: location.timezone,
            durationMinutes: service.durationMinutes,
            bufferBeforeMinutes: service.bufferBeforeMinutes,
            bufferAfterMinutes: service.bufferAfterMinutes,
            serviceNameSnapshot: service.name,
            staffDisplayNameSnapshot: staff.displayName,
            version: { increment: 1 },
          },
        });
      } catch {
        await tx.booking.update({
          where: { organizationId_id: { organizationId, id: bookingId } },
          data: {
            status: 'CONFIRMED',
            startsAt: current.startsAt,
            endsAt: current.endsAt,
            occupiedStartsAt: current.occupiedStartsAt,
            occupiedEndsAt: current.occupiedEndsAt,
            staffMemberId: current.staffMemberId,
            serviceId: current.serviceId,
            locationId: current.locationId,
            version: current.version,
          },
        });
        throw new ConflictException('SLOT_UNAVAILABLE');
      }

      const row = await tx.booking.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: bookingId } },
      });
      await tx.bookingActivity.create({
        data: {
          id: randomUUID(),
          organizationId,
          bookingId,
          type: 'BOOKING_RESCHEDULED',
          actorType: 'USER',
          actorId: actor.userId,
          metadataJson: {
            from: current.startsAt.toISOString(),
            to: token.startsAt,
          },
        },
      });
      if (row.leadId) {
        await tx.leadActivity.create({
          data: {
            id: randomUUID(),
            organizationId,
            leadId: row.leadId,
            type: 'BOOKING_RESCHEDULED',
            actorType: 'USER',
            actorId: actor.userId,
            metadataJson: { bookingId },
          },
        });
      }
      return row;
    });
  }

  /** Agent cancel scoped to conversation customer. */
  async cancelForCustomerInTx(
    tx: TenantTxClient,
    input: {
      organizationId: string;
      customerId: string;
      bookingId: string;
      expectedVersion: number;
      reasonCode: string;
      agentRunId?: string;
    },
  ) {
    const result = await tx.booking.updateMany({
      where: {
        organizationId: input.organizationId,
        id: input.bookingId,
        customerId: input.customerId,
        version: input.expectedVersion,
        status: 'CONFIRMED',
      },
      data: {
        status: 'CANCELLED',
        cancellationReasonCode: input.reasonCode,
        version: { increment: 1 },
      },
    });
    if (!result.count) throw new ConflictException('VERSION_CONFLICT');
    const row = await tx.booking.findUniqueOrThrow({
      where: {
        organizationId_id: { organizationId: input.organizationId, id: input.bookingId },
      },
    });
    await tx.bookingActivity.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        bookingId: input.bookingId,
        type: 'BOOKING_CANCELLED',
        actorType: 'AGENT',
        actorId: input.agentRunId,
        metadataJson: { reasonCode: input.reasonCode },
      },
    });
    return row;
  }
}

function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (last < cur) throw new BadRequestException('Invalid date range');
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function timeToSec(t: string): number {
  const [h, m, s] = (t.length === 5 ? `${t}:00` : t).split(':').map(Number);
  return h! * 3600 + m! * 60 + (s ?? 0);
}

function secToTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pickNearest(candidates: Date[], target: Date): Date | null {
  if (!candidates.length) return null;
  let best = candidates[0]!;
  let bestDist = Math.abs(best.getTime() - target.getTime());
  for (const c of candidates.slice(1)) {
    const d = Math.abs(c.getTime() - target.getTime());
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}
