import { Injectable, NotFoundException } from '@nestjs/common';
import {
  formatLocalDateInZone,
  formatLocalTimeInZone,
} from '@ai-sales-agent/agent-adapters';
import {
  TenantContextService,
  type ActorContext,
} from '../database/tenant-context.service.js';
import {
  deriveQualificationState,
  OPEN_LEAD_STATUSES,
} from '../domain/lead-state.js';
import {
  finalizeAttentionFeed,
  isConversationWaitingForHuman,
  isReviewRequiredSuppression,
  makeAttentionItem,
} from './attention.js';
import type {
  DashboardAttentionItem,
  DashboardBookingItem,
  DashboardChannelHealth,
  DashboardFollowUpItem,
  DashboardKnowledgeHealth,
  DashboardResponse,
  DashboardSummary,
} from './dashboard.types.js';

type MemberRow = { role: string; status: string };

@Injectable()
export class DashboardService {
  constructor(private readonly tenants: TenantContextService) {}

  private async membership(actor: ActorContext, organizationId: string): Promise<MemberRow> {
    const m = (await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    )) as MemberRow | null;
    if (!m || m.status !== 'ACTIVE') throw new NotFoundException();
    return m;
  }

  private isAdmin(role: string) {
    return role === 'OWNER' || role === 'ADMIN';
  }

  async getDashboard(actor: ActorContext, organizationId: string): Promise<DashboardResponse> {
    const member = await this.membership(actor, organizationId);
    const asOf = new Date();
    const sectionErrors: Record<string, string> = {};

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const attention: DashboardAttentionItem[] = [];

      // ——— Conversations: handoff / paused unassigned / my active / waiting ———
      const handoffRows = await tx.conversation.findMany({
        where: {
          organizationId,
          mode: 'AI_PAUSED',
          ownerMemberId: null,
          pauseReasonCode: {
            in: [
              'CUSTOMER_REQUESTED_HUMAN',
              'AI_UNCERTAIN',
              'POLICY_REQUIRES_HUMAN',
              'BOOKING_EXCEPTION',
            ],
          },
        },
        orderBy: [{ pausedAt: 'asc' }, { id: 'asc' }],
        take: 50,
        select: {
          id: true,
          pauseReasonCode: true,
          pausedAt: true,
          lastMessageAt: true,
        },
      });
      for (const row of handoffRows) {
        attention.push(
          makeAttentionItem({
            type: 'HUMAN_HANDOFF_UNASSIGNED',
            entityType: 'Conversation',
            entityId: row.id,
            organizationId,
            severity: 'WARNING',
            occurredAt: row.pausedAt ?? row.lastMessageAt,
            title: 'Unassigned human handoff',
            description: `Pause reason: ${row.pauseReasonCode ?? 'unknown'}`,
            actionRoute: `/inbox?conversationId=${row.id}`,
          }),
        );
      }

      const pausedUnassignedRows = await tx.conversation.findMany({
        where: {
          organizationId,
          mode: 'AI_PAUSED',
          ownerMemberId: null,
          OR: [
            { pauseReasonCode: { in: ['OPERATOR_MANUAL_TAKEOVER', 'OTHER'] } },
            { pauseReasonCode: null },
          ],
        },
        orderBy: [{ pausedAt: 'asc' }, { id: 'asc' }],
        take: 50,
        select: {
          id: true,
          pauseReasonCode: true,
          pausedAt: true,
          lastMessageAt: true,
        },
      });
      for (const row of pausedUnassignedRows) {
        attention.push(
          makeAttentionItem({
            type: 'PAUSED_CONVERSATION_UNASSIGNED',
            entityType: 'Conversation',
            entityId: row.id,
            organizationId,
            severity: 'INFO',
            occurredAt: row.pausedAt ?? row.lastMessageAt,
            title: 'Unassigned paused conversation',
            description: `Pause reason: ${row.pauseReasonCode ?? 'none'}`,
            actionRoute: `/inbox?conversationId=${row.id}`,
          }),
        );
      }

      const waitingCandidates = await tx.conversation.findMany({
        where: {
          organizationId,
          mode: 'AI_PAUSED',
          ownerMemberId: this.isAdmin(member.role)
            ? { not: null }
            : actor.userId,
        },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: { id: true, lastMessageAt: true, pausedAt: true, ownerMemberId: true },
      });

      if (waitingCandidates.length > 0) {
        const ids = (waitingCandidates as Array<{ id: string }>).map((c) => c.id);
        const seqMsgs = (await tx.message.findMany({
          where: {
            organizationId,
            conversationId: { in: ids },
            OR: [
              { origin: 'CUSTOMER', direction: 'INBOUND' },
              { origin: 'OPERATOR', direction: 'OUTBOUND' },
            ],
          },
          select: {
            conversationId: true,
            origin: true,
            direction: true,
            timelineSequence: true,
          },
        })) as Array<{
          conversationId: string;
          origin: string;
          direction: string;
          timelineSequence: number;
        }>;
        const seqByConv = new Map<
          string,
          { maxCustomerInboundSeq: number | null; maxOperatorOutboundSeq: number | null }
        >();
        for (const m of seqMsgs) {
          const cur = seqByConv.get(m.conversationId) ?? {
            maxCustomerInboundSeq: null,
            maxOperatorOutboundSeq: null,
          };
          if (m.origin === 'CUSTOMER' && m.direction === 'INBOUND') {
            cur.maxCustomerInboundSeq = Math.max(
              cur.maxCustomerInboundSeq ?? -1,
              m.timelineSequence,
            );
          } else if (m.origin === 'OPERATOR' && m.direction === 'OUTBOUND') {
            cur.maxOperatorOutboundSeq = Math.max(
              cur.maxOperatorOutboundSeq ?? -1,
              m.timelineSequence,
            );
          }
          seqByConv.set(m.conversationId, cur);
        }

        for (const conv of waitingCandidates) {
          const seq = seqByConv.get(conv.id) ?? {
            maxCustomerInboundSeq: null,
            maxOperatorOutboundSeq: null,
          };
          if (!isConversationWaitingForHuman(seq)) continue;
          attention.push(
            makeAttentionItem({
              type: 'HUMAN_CONVERSATION_WAITING',
              entityType: 'Conversation',
              entityId: conv.id,
              organizationId,
              severity: 'WARNING',
              occurredAt: conv.lastMessageAt ?? conv.pausedAt,
              title: 'Customer waiting for human reply',
              description: 'Newer customer inbound than latest operator response',
              actionRoute: `/inbox?conversationId=${conv.id}`,
            }),
          );
        }
      }

      const myActiveConversations = await tx.conversation.count({
        where: {
          organizationId,
          mode: 'AI_PAUSED',
          ownerMemberId: actor.userId,
        },
      });

      const unassignedHandoffs = await tx.conversation.count({
        where: {
          organizationId,
          mode: 'AI_PAUSED',
          ownerMemberId: null,
          pauseReasonCode: {
            in: [
              'CUSTOMER_REQUESTED_HUMAN',
              'AI_UNCERTAIN',
              'POLICY_REQUIRES_HUMAN',
              'BOOKING_EXCEPTION',
            ],
          },
        },
      });

      const unassignedPaused = await tx.conversation.count({
        where: {
          organizationId,
          mode: 'AI_PAUSED',
          ownerMemberId: null,
          OR: [
            { pauseReasonCode: { in: ['OPERATOR_MANUAL_TAKEOVER', 'OTHER'] } },
            { pauseReasonCode: null },
          ],
        },
      });

      const legacyHumanActiveObserved = await tx.conversation.count({
        where: { organizationId, mode: 'HUMAN_ACTIVE' },
      });

      // ——— Failed / unknown outbound (7d, bounded) ———
      const since = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
      const failedOutbound = await tx.message.findMany({
        where: {
          organizationId,
          direction: 'OUTBOUND',
          deliveryState: 'FAILED',
          createdAt: { gte: since },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
        select: { id: true, conversationId: true, createdAt: true, deliveryState: true },
      });
      for (const m of failedOutbound) {
        attention.push(
          makeAttentionItem({
            type: 'FAILED_OUTBOUND_MESSAGE',
            entityType: 'Message',
            entityId: m.id,
            organizationId,
            severity: 'WARNING',
            occurredAt: m.createdAt,
            title: 'Outbound message failed',
            description: 'deliveryState=FAILED',
            actionRoute: `/inbox?conversationId=${m.conversationId}`,
          }),
        );
      }

      const unknownOutbound = await tx.message.findMany({
        where: {
          organizationId,
          direction: 'OUTBOUND',
          deliveryState: 'UNKNOWN',
          createdAt: { gte: since },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
        select: { id: true, conversationId: true, createdAt: true },
      });
      for (const m of unknownOutbound) {
        attention.push(
          makeAttentionItem({
            type: 'UNKNOWN_OUTBOUND_MESSAGE',
            entityType: 'Message',
            entityId: m.id,
            organizationId,
            severity: 'WARNING',
            occurredAt: m.createdAt,
            title: 'Outbound message unknown',
            description: 'deliveryState=UNKNOWN',
            actionRoute: `/inbox?conversationId=${m.conversationId}`,
          }),
        );
      }

      // ——— Follow-ups ———
      const failedFollowUpsRows = await tx.followUp.findMany({
        where: { organizationId, status: 'FAILED' },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: 20,
        select: {
          id: true,
          updatedAt: true,
          resultReasonCode: true,
          nextEligibleAt: true,
        },
      });
      for (const fu of failedFollowUpsRows) {
        attention.push(
          makeAttentionItem({
            type: 'FOLLOWUP_FAILED',
            entityType: 'FollowUp',
            entityId: fu.id,
            organizationId,
            severity: 'WARNING',
            occurredAt: fu.updatedAt,
            dueAt: fu.nextEligibleAt,
            title: 'Follow-up failed',
            description: fu.resultReasonCode ?? 'FAILED',
            actionRoute: `/follow-ups?id=${fu.id}`,
          }),
        );
      }

      const suppressedReviewRows = await tx.followUp.findMany({
        where: {
          organizationId,
          status: 'SUPPRESSED',
          resultReasonCode: {
            in: [
              'TEMPLATE_DISABLED',
              'CHANNEL_DISABLED',
              'OUTSIDE_POLICY_WINDOW',
              'MISSING_CONVERSATION',
              'CONVERSATION_MISSING',
            ],
          },
        },
        orderBy: [{ suppressedAt: 'desc' }, { id: 'asc' }],
        take: 20,
        select: {
          id: true,
          suppressedAt: true,
          resultReasonCode: true,
          updatedAt: true,
        },
      });
      for (const fu of suppressedReviewRows) {
        if (!isReviewRequiredSuppression(fu.resultReasonCode)) continue;
        attention.push(
          makeAttentionItem({
            type: 'FOLLOWUP_SUPPRESSED_REVIEW',
            entityType: 'FollowUp',
            entityId: fu.id,
            organizationId,
            severity: 'INFO',
            occurredAt: fu.suppressedAt ?? fu.updatedAt,
            title: 'Follow-up needs configuration review',
            description: fu.resultReasonCode ?? 'SUPPRESSED',
            actionRoute: `/follow-ups?id=${fu.id}`,
          }),
        );
      }

      const soonEnd = new Date(asOf.getTime() + 24 * 60 * 60 * 1000);
      const [
        pendingFollowUps,
        failedFollowUps,
        suppressedFollowUps,
        scheduledSoonFollowUps,
        processingFollowUps,
        dispatchedFollowUps,
      ] = await Promise.all([
        tx.followUp.count({
          where: { organizationId, status: { in: ['SCHEDULED', 'PROCESSING'] } },
        }),
        tx.followUp.count({ where: { organizationId, status: 'FAILED' } }),
        tx.followUp.count({ where: { organizationId, status: 'SUPPRESSED' } }),
        tx.followUp.count({
          where: {
            organizationId,
            status: { in: ['SCHEDULED', 'PROCESSING'] },
            nextEligibleAt: { lte: soonEnd },
          },
        }),
        tx.followUp.count({ where: { organizationId, status: 'PROCESSING' } }),
        tx.followUp.count({ where: { organizationId, status: 'DISPATCHED' } }),
      ]);

      const recentFailed = await tx.followUp.findMany({
        where: { organizationId, status: 'FAILED' },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: 5,
        select: {
          id: true,
          status: true,
          triggerType: true,
          nextEligibleAt: true,
          timezone: true,
          resultReasonCode: true,
          outboundMessageId: true,
          customerId: true,
          leadId: true,
        },
      });
      const recentSoon = await tx.followUp.findMany({
        where: {
          organizationId,
          status: { in: ['SCHEDULED', 'PROCESSING'] },
        },
        orderBy: [{ nextEligibleAt: 'asc' }, { id: 'asc' }],
        take: 10,
        select: {
          id: true,
          status: true,
          triggerType: true,
          nextEligibleAt: true,
          timezone: true,
          resultReasonCode: true,
          outboundMessageId: true,
          customerId: true,
          leadId: true,
        },
      });
      const recentMerged = [...recentFailed, ...recentSoon].slice(0, 10);
      const msgIds = recentMerged
        .map((r) => r.outboundMessageId)
        .filter((id): id is string => !!id);
      const deliveryByMsg = new Map<string, string>();
      if (msgIds.length) {
        const msgs = await tx.message.findMany({
          where: { organizationId, id: { in: msgIds } },
          select: { id: true, deliveryState: true },
        });
        for (const m of msgs) deliveryByMsg.set(m.id, m.deliveryState);
      }
      const recentFollowUps: DashboardFollowUpItem[] = recentMerged.map((r) => ({
        id: r.id,
        status: r.status,
        triggerType: r.triggerType,
        nextEligibleAt: r.nextEligibleAt.toISOString(),
        timezone: r.timezone,
        resultReasonCode: r.resultReasonCode,
        messageDeliveryState: r.outboundMessageId
          ? deliveryByMsg.get(r.outboundMessageId) ?? null
          : null,
        customerId: r.customerId,
        leadId: r.leadId,
      }));

      // ——— Bookings ———
      const bookingSoonEnd = new Date(asOf.getTime() + 2 * 60 * 60 * 1000);
      const bookingSoonRows = await tx.booking.findMany({
        where: {
          organizationId,
          status: 'CONFIRMED',
          startsAt: { gte: asOf, lte: bookingSoonEnd },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: 20,
        select: { id: true, startsAt: true },
      });
      for (const b of bookingSoonRows) {
        attention.push(
          makeAttentionItem({
            type: 'BOOKING_SOON',
            entityType: 'Booking',
            entityId: b.id,
            organizationId,
            severity: 'INFO',
            dueAt: b.startsAt,
            occurredAt: b.startsAt,
            title: 'Booking starting soon',
            description: 'Within the next 2 hours',
            actionRoute: `/bookings`,
          }),
        );
      }

      const upcomingRaw = await tx.booking.findMany({
        where: {
          organizationId,
          status: 'CONFIRMED',
          startsAt: { gte: asOf },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: 10,
        select: {
          id: true,
          customerId: true,
          serviceId: true,
          locationId: true,
          staffMemberId: true,
          leadId: true,
          startsAt: true,
          timezone: true,
          status: true,
          serviceNameSnapshot: true,
          staffDisplayNameSnapshot: true,
        },
      });

      const customerIds = [
        ...new Set((upcomingRaw as Array<{ customerId: string }>).map((b) => b.customerId)),
      ];
      const serviceIds = [
        ...new Set((upcomingRaw as Array<{ serviceId: string }>).map((b) => b.serviceId)),
      ];
      const locationIds = [
        ...new Set((upcomingRaw as Array<{ locationId: string }>).map((b) => b.locationId)),
      ];
      const staffIds = [
        ...new Set((upcomingRaw as Array<{ staffMemberId: string }>).map((b) => b.staffMemberId)),
      ];

      const [customers, services, locations, staff] = await Promise.all([
        customerIds.length
          ? tx.customer.findMany({
              where: { organizationId, id: { in: customerIds } },
              select: { id: true, displayName: true },
            })
          : Promise.resolve([] as Array<{ id: string; displayName: string | null }>),
        serviceIds.length
          ? tx.service.findMany({
              where: { organizationId, id: { in: serviceIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([] as Array<{ id: string; name: string }>),
        locationIds.length
          ? tx.location.findMany({
              where: { organizationId, id: { in: locationIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([] as Array<{ id: string; name: string }>),
        staffIds.length
          ? tx.staffMember.findMany({
              where: { organizationId, id: { in: staffIds } },
              select: { id: true, displayName: true },
            })
          : Promise.resolve([] as Array<{ id: string; displayName: string }>),
      ]);
      const custName = new Map(
        (customers as Array<{ id: string; displayName: string | null }>).map((c) => [
          c.id,
          c.displayName,
        ]),
      );
      const svcName = new Map(
        (services as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]),
      );
      const locName = new Map(
        (locations as Array<{ id: string; name: string }>).map((l) => [l.id, l.name]),
      );
      const staffName = new Map(
        (staff as Array<{ id: string; displayName: string }>).map((s) => [s.id, s.displayName]),
      );

      const upcomingBookings: DashboardBookingItem[] = (
        upcomingRaw as Array<{
          id: string;
          customerId: string;
          serviceId: string;
          locationId: string;
          staffMemberId: string;
          leadId: string | null;
          startsAt: Date;
          timezone: string;
          status: string;
          serviceNameSnapshot: string | null;
          staffDisplayNameSnapshot: string | null;
        }>
      ).map((b) => {
        const localDate = formatLocalDateInZone(b.startsAt, b.timezone);
        const localTime = formatLocalTimeInZone(b.startsAt, b.timezone);
        return {
          id: b.id,
          customerDisplayName: custName.get(b.customerId) ?? null,
          serviceName: b.serviceNameSnapshot ?? svcName.get(b.serviceId) ?? 'Service',
          staffDisplayName:
            b.staffDisplayNameSnapshot ?? staffName.get(b.staffMemberId) ?? 'Staff',
          locationName: locName.get(b.locationId) ?? 'Location',
          startsAt: b.startsAt.toISOString(),
          localStartsAt: `${localDate}T${localTime}`,
          timezone: b.timezone,
          status: b.status,
          leadId: b.leadId,
        };
      });

      // Today's bookings: UTC window then filter by booking timezone local date
      const windowStart = new Date(asOf.getTime() - 14 * 60 * 60 * 1000);
      const windowEnd = new Date(asOf.getTime() + 38 * 60 * 60 * 1000);
      const todayCandidates = await tx.booking.findMany({
        where: {
          organizationId,
          status: 'CONFIRMED',
          startsAt: { gte: windowStart, lte: windowEnd },
        },
        select: { id: true, startsAt: true, timezone: true },
        take: 200,
      });
      let todaysBookings = 0;
      for (const b of todayCandidates) {
        const localToday = formatLocalDateInZone(asOf, b.timezone);
        const bookingLocal = formatLocalDateInZone(b.startsAt, b.timezone);
        if (localToday === bookingLocal) todaysBookings += 1;
      }

      // ——— Channels ———
      const channels = await tx.channelConnection.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          provider: true,
          healthStatus: true,
          status: true,
          displayPhoneNumber: true,
          lastVerifiedAt: true,
        },
      });
      const channelHealth: DashboardChannelHealth[] = (
        channels as Array<{
          id: string;
          provider: string;
          healthStatus: string;
          status: string;
          displayPhoneNumber: string | null;
          lastVerifiedAt: Date | null;
        }>
      ).map((c) => ({
        id: c.id,
        provider: c.provider,
        healthStatus: c.healthStatus,
        status: c.status,
        displayPhoneNumber: c.displayPhoneNumber,
        lastVerifiedAt: c.lastVerifiedAt?.toISOString() ?? null,
      }));
      let channelHealthy = 0;
      let channelUnhealthy = 0;
      let channelDisabled = 0;
      for (const c of channels as Array<{
        id: string;
        provider: string;
        healthStatus: string;
        displayPhoneNumber: string | null;
        lastVerifiedAt: Date | null;
      }>) {
        if (c.healthStatus === 'ACTIVE') channelHealthy += 1;
        else if (c.healthStatus === 'DISABLED') channelDisabled += 1;
        else if (c.healthStatus === 'AUTH_FAILED' || c.healthStatus === 'MISCONFIGURED') {
          channelUnhealthy += 1;
        }
        if (c.healthStatus === 'AUTH_FAILED') {
          attention.push(
            makeAttentionItem({
              type: 'CHANNEL_AUTH_FAILED',
              entityType: 'ChannelConnection',
              entityId: c.id,
              organizationId,
              severity: 'CRITICAL',
              occurredAt: c.lastVerifiedAt,
              title: 'Channel authentication failed',
              description: c.displayPhoneNumber ?? c.provider,
              actionRoute: '/settings/channels',
            }),
          );
        } else if (c.healthStatus === 'MISCONFIGURED') {
          attention.push(
            makeAttentionItem({
              type: 'CHANNEL_MISCONFIGURED',
              entityType: 'ChannelConnection',
              entityId: c.id,
              organizationId,
              severity: 'CRITICAL',
              occurredAt: c.lastVerifiedAt,
              title: 'Channel misconfigured',
              description: c.displayPhoneNumber ?? c.provider,
              actionRoute: '/settings/channels',
            }),
          );
        }
      }

      // ——— Leads (canonical qualification) ———
      const activeLocationCount = await tx.location.count({
        where: { organizationId, active: true, archivedAt: null },
      });
      const openLeadsRows = await tx.lead.findMany({
        where: {
          organizationId,
          status: { in: [...OPEN_LEAD_STATUSES] },
        },
        select: {
          id: true,
          status: true,
          primaryServiceId: true,
          locationId: true,
          needSummary: true,
          preferredContactChannel: true,
          updatedAt: true,
        },
        take: 500,
      });
      const leadStatusCounts = { NEW: 0, ENGAGED: 0, QUALIFIED: 0, NURTURE: 0 };
      let leadsNeedingQualification = 0;
      for (const lead of openLeadsRows) {
        if (lead.status in leadStatusCounts) {
          leadStatusCounts[lead.status as keyof typeof leadStatusCounts] += 1;
        }
        const q = deriveQualificationState(lead, { activeLocationCount });
        if (q === 'INCOMPLETE') {
          leadsNeedingQualification += 1;
          if (attention.filter((a) => a.type === 'LEAD_NEEDS_QUALIFICATION').length < 20) {
            attention.push(
              makeAttentionItem({
                type: 'LEAD_NEEDS_QUALIFICATION',
                entityType: 'Lead',
                entityId: lead.id,
                organizationId,
                severity: 'INFO',
                occurredAt: lead.updatedAt,
                title: 'Lead needs qualification',
                description: `Status ${lead.status}; qualification incomplete`,
                actionRoute: `/leads`,
              }),
            );
          }
        }
      }
      const openLeads = openLeadsRows.length;
      const qualifiedLeads = leadStatusCounts.QUALIFIED;

      // ——— Knowledge (ADMIN/OWNER only; role omit ≠ sectionError) ———
      let knowledgeHealth: DashboardKnowledgeHealth | null = null;
      if (this.isAdmin(member.role)) {
        try {
          const [awaitingReview, processing, failed, publishedDocuments] = await Promise.all([
            tx.knowledgeDocumentVersion.count({
              where: {
                organizationId,
                OR: [
                  { pipelineStatus: 'AWAITING_REVIEW' },
                  { reviewStatus: 'PENDING', pipelineStatus: { not: 'FAILED' } },
                ],
              },
            }),
            tx.knowledgeDocumentVersion.count({
              where: {
                organizationId,
                pipelineStatus: { in: ['EXTRACTING', 'CHUNKING', 'EMBEDDING'] },
              },
            }),
            tx.knowledgeDocumentVersion.count({
              where: { organizationId, pipelineStatus: 'FAILED' },
            }),
            tx.knowledgeDocument.count({
              where: {
                organizationId,
                deletedAt: null,
                activePublishedVersionId: { not: null },
              },
            }),
          ]);
          knowledgeHealth = { awaitingReview, processing, failed, publishedDocuments };

          const failedVersions = await tx.knowledgeDocumentVersion.findMany({
            where: { organizationId, pipelineStatus: 'FAILED' },
            orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
            take: 10,
            select: { id: true, documentId: true, updatedAt: true, failureReason: true },
          });
          for (const v of failedVersions) {
            attention.push(
              makeAttentionItem({
                type: 'KNOWLEDGE_PROCESSING_FAILED',
                entityType: 'KnowledgeDocumentVersion',
                entityId: v.id,
                organizationId,
                severity: 'WARNING',
                occurredAt: v.updatedAt,
                title: 'Knowledge ingestion failed',
                description: v.failureReason ?? 'pipeline FAILED',
                actionRoute: '/knowledge',
              }),
            );
          }
        } catch {
          knowledgeHealth = null;
          sectionErrors.knowledgeHealth = 'QUERY_FAILED';
        }
      }

      const summary: DashboardSummary = {
        unassignedHandoffs,
        unassignedPaused,
        myActiveConversations,
        openLeads,
        qualifiedLeads,
        leadsNeedingQualification,
        leadStatusCounts,
        todaysBookings,
        pendingFollowUps,
        failedFollowUps,
        suppressedFollowUps,
        scheduledSoonFollowUps,
        processingFollowUps,
        dispatchedFollowUps,
        channelHealthy,
        channelUnhealthy,
        channelDisabled,
        legacyHumanActiveObserved,
      };

      return {
        asOf: asOf.toISOString(),
        attention: finalizeAttentionFeed(attention),
        summary,
        upcomingBookings,
        recentFollowUps,
        channelHealth,
        knowledgeHealth,
        sectionErrors,
      };
    });
  }
}
