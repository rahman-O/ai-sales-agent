import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService, type ActorContext } from '../database/tenant-context.service.js';
import { parseAnalyticsRange } from './range.js';
import {
  calculateConversionRate,
  buildFunnelStages,
  type AnalyticsOverviewDto,
  type WorkflowFunnelDto,
  type ValueByCurrencyDto,
  type CatalogItemMetricDto,
  type IntentMetricsDto,
  type ConversationMetricsDto,
  type LeadMetricsDto,
  type BookingMetricsDto,
  type QuoteMetricsDto,
  type OrderMetricsDto,
  type CatalogAnalyticsDto,
  type OperationalMetricsDto,
} from '@ai-sales-agent/contracts';

type Group = Record<string, unknown> & { _count?: { _all?: number } };
const counts = (rows: Group[], key: string) =>
  Object.fromEntries(rows.map(r => [String(r[key]), Number(r._count?._all ?? 0)]));

@Injectable()
export class AnalyticsService {
  constructor(private readonly tenants: TenantContextService) {}

  async overview(
    actor: ActorContext,
    organizationId: string,
    q: { from: string; to: string; timezone?: string }
  ): Promise<AnalyticsOverviewDto & Record<string, unknown>> {
    const member = (await this.tenants.runAsActor(actor, tx =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      })
    )) as { status: string; role: string } | null;

    if (!member || member.status !== 'ACTIVE') throw new NotFoundException();
    if (!['OWNER', 'ADMIN'].includes(member.role)) {
      throw new ForbiddenException('Analytics requires ADMIN or OWNER');
    }

    const targetTimezone = q.timezone || 'Asia/Baghdad';
    const range = parseAnalyticsRange(q.from, q.to, targetTimezone);

    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const [caps, profile] = await Promise.all([
        tx.organizationCapabilities.findUnique({
          where: { organizationId },
        }),
        tx.organizationProfile.findUnique({
          where: { organizationId },
        }),
      ]);

      const supportsBooking = caps?.supportsBooking !== false;
      const supportsQuotes = caps?.supportsQuotes === true;
      const supportsOrders = caps?.supportsOrders === true;
      const supportsLeads = caps?.supportsLeads !== false;
      const supportsOffers = caps?.supportsOffers === true;

      const where = { organizationId, createdAt: { gte: range.from, lt: range.to } };

      // 1. Concurrent aggregate queries
      const [
        leadState,
        leadCreated,
        bookingStates,
        quoteStates,
        orderStates,
        followStates,
        origins,
        delivery,
        runs,
        tools,
        usage,
        handoffs,
        conversionRaw,
        latencyRaw,
        followOutcomeRaw,
        automationRaw,
        acceptedQuotesValueRaw,
        confirmedOrdersValueRaw,
        topBookedServicesRaw,
        topQuotedItemsRaw,
        topOrderedItemsRaw,
        intentDetectionsRaw,
      ] = await Promise.all([
        // Leads
        tx.lead.groupBy({ by: ['status'], where: { organizationId }, _count: { _all: true } }),
        tx.lead.count({ where }),

        // Bookings
        tx.booking.groupBy({ by: ['status'], where, _count: { _all: true } }),

        // Quotes
        supportsQuotes
          ? tx.quote.groupBy({ by: ['status'], where, _count: { _all: true } })
          : Promise.resolve([]),

        // Orders
        supportsOrders
          ? tx.order.groupBy({ by: ['status'], where, _count: { _all: true } })
          : Promise.resolve([]),

        // FollowUps
        tx.followUp.groupBy({ by: ['status'], where, _count: { _all: true } }),

        // Outbound messages origin & delivery
        tx.message.groupBy({ by: ['origin'], where: { ...where, direction: 'OUTBOUND' }, _count: { _all: true } }),
        tx.message.groupBy({ by: ['deliveryState'], where: { ...where, direction: 'OUTBOUND' }, _count: { _all: true } }),

        // Agent runs
        tx.agentRun.groupBy({
          by: ['status'],
          where: { organizationId, startedAt: { gte: range.from, lt: range.to } },
          _count: { _all: true },
        }),

        // Tool calls
        tx.toolCall.groupBy({ by: ['toolName', 'resultCode'], where, _count: { _all: true } }),

        // Usage Events
        tx.usageEvent.aggregate({
          where,
          _count: { _all: true },
          _sum: { inputTokens: true, outputTokens: true, latencyMs: true },
        }),

        // Audit Logs (Takeover)
        tx.auditLog.groupBy({
          by: ['action'],
          where: {
            organizationId,
            recordedAt: { gte: range.from, lt: range.to },
            action: { in: ['conversation.takeover', 'conversation.claimed', 'conversation.resumed_ai'] },
          },
          _count: { _all: true },
        }),

        // Direct Booking Conversion
        tx.$queryRaw<Array<{ denominator: number; numerator: number }>>`
          SELECT count(*)::int as denominator,
                 count(*) FILTER (
                   WHERE EXISTS (
                     SELECT 1 FROM bookings b
                     JOIN booking_activities ba ON ba.organization_id = b.organization_id AND ba.booking_id = b.id AND ba.type = 'BOOKING_CONFIRMED'
                     WHERE b.organization_id = l.organization_id AND b.lead_id = l.id
                       AND ba.created_at >= l.created_at AND ba.created_at < l.created_at + interval '30 days'
                   )
                 )::int as numerator
          FROM leads l
          WHERE l.organization_id = ${organizationId}::uuid
            AND l.created_at >= ${range.from} AND l.created_at < ${range.to}
        `,

        // Response Latency
        tx.$queryRaw<Array<{ origin: string; median_ms: number | null; p90_ms: number | null; samples: number }>>`
          WITH pairs AS (
            SELECT o.origin, extract(epoch from (o.created_at - i.created_at)) * 1000 as latency
            FROM messages i
            JOIN LATERAL (
              SELECT x.origin, x.created_at, x.id
              FROM messages x
              WHERE x.organization_id = i.organization_id
                AND x.conversation_id = i.conversation_id
                AND x.timeline_sequence > i.timeline_sequence
                AND x.direction = 'OUTBOUND'
                AND x.origin IN ('AI', 'OPERATOR')
                AND NOT EXISTS (SELECT 1 FROM follow_ups f WHERE f.organization_id = x.organization_id AND f.outbound_message_id = x.id)
              ORDER BY x.timeline_sequence LIMIT 1
            ) o ON true
            WHERE i.organization_id = ${organizationId}::uuid
              AND i.direction = 'INBOUND'
              AND i.origin = 'CUSTOMER'
              AND i.created_at >= ${range.from} AND i.created_at < ${range.to}
          )
          SELECT origin,
                 percentile_cont(0.5) WITHIN GROUP (ORDER BY latency)::float8 as median_ms,
                 percentile_cont(0.9) WITHIN GROUP (ORDER BY latency)::float8 as p90_ms,
                 count(*)::int as samples
          FROM pairs GROUP BY origin
        `,

        // Follow Up outcome
        tx.$queryRaw<Array<{ eligible: number; replied: number; booking_associated: number }>>`
          SELECT count(*) FILTER (WHERE m.delivery_state IN ('ACCEPTED', 'DELIVERED', 'READ'))::int as eligible,
                 count(*) FILTER (
                   WHERE m.delivery_state IN ('ACCEPTED', 'DELIVERED', 'READ')
                     AND EXISTS (
                       SELECT 1 FROM messages i
                       WHERE i.organization_id = f.organization_id
                         AND i.conversation_id = f.conversation_id
                         AND i.direction = 'INBOUND'
                         AND i.origin = 'CUSTOMER'
                         AND i.timeline_sequence > m.timeline_sequence
                         AND i.created_at < m.created_at + interval '7 days'
                     )
                 )::int as replied,
                 count(*) FILTER (
                   WHERE EXISTS (
                     SELECT 1 FROM bookings b
                     JOIN booking_activities ba ON ba.organization_id = b.organization_id AND ba.booking_id = b.id AND ba.type = 'BOOKING_CONFIRMED'
                     WHERE b.organization_id = f.organization_id
                       AND b.customer_id = f.customer_id
                       AND (f.lead_id IS NULL OR b.lead_id = f.lead_id)
                       AND ba.created_at >= f.executed_at AND ba.created_at < f.executed_at + interval '7 days'
                   )
                 )::int as booking_associated
          FROM follow_ups f
          JOIN messages m ON m.organization_id = f.organization_id AND m.id = f.outbound_message_id
          WHERE f.organization_id = ${organizationId}::uuid
            AND f.status = 'DISPATCHED'
            AND f.executed_at >= ${range.from} AND f.executed_at < ${range.to}
        `,

        // Automation rate (Total Conversations & AI Only)
        tx.$queryRaw<Array<{ denominator: number; numerator: number }>>`
          SELECT count(*)::int as denominator,
                 count(*) FILTER (
                   WHERE NOT EXISTS (
                     SELECT 1 FROM messages o
                     WHERE o.organization_id = c.organization_id
                       AND o.conversation_id = c.id
                       AND o.direction = 'OUTBOUND'
                       AND o.origin = 'OPERATOR'
                   )
                   AND NOT EXISTS (
                     SELECT 1 FROM audit_logs a
                     WHERE a.organization_id = c.organization_id
                       AND a.target_id = c.id::text
                       AND a.action = 'conversation.takeover'
                   )
                 )::int as numerator
          FROM conversations c
          WHERE c.organization_id = ${organizationId}::uuid
            AND c.created_at >= ${range.from} AND c.created_at < ${range.to}
            AND EXISTS (
              SELECT 1 FROM messages a
              WHERE a.organization_id = c.organization_id
                AND a.conversation_id = c.id
                AND a.direction = 'OUTBOUND'
                AND a.origin = 'AI'
            )
        `,

        // Accepted Quotes Value by Currency
        supportsQuotes
          ? tx.$queryRaw<Array<{ currency: string; total_minor: bigint; count: number }>>`
              SELECT currency, sum(total_amount_minor) as total_minor, count(*)::int as count
              FROM quotes
              WHERE organization_id = ${organizationId}::uuid
                AND status = 'ACCEPTED'
                AND created_at >= ${range.from} AND created_at < ${range.to}
              GROUP BY currency
            `
          : Promise.resolve([]),

        // Confirmed Orders Value by Currency
        supportsOrders
          ? tx.$queryRaw<Array<{ currency: string; total_minor: bigint; count: number }>>`
              SELECT currency, sum(total_amount_minor) as total_minor, count(*)::int as count
              FROM orders
              WHERE organization_id = ${organizationId}::uuid
                AND status IN ('CONFIRMED', 'FULFILLED')
                AND created_at >= ${range.from} AND created_at < ${range.to}
              GROUP BY currency
            `
          : Promise.resolve([]),

        // Most Booked Services
        supportsBooking
          ? tx.$queryRaw<Array<{ catalog_item_id: string; name: string; item_type: string; count: number }>>`
              SELECT coalesce(ci.id, s.id) as catalog_item_id, s.name, coalesce(ci.kind, 'SERVICE') as item_type, count(*)::int as count
              FROM bookings b
              JOIN services s ON s.organization_id = b.organization_id AND s.id = b.service_id
              LEFT JOIN catalog_items ci ON ci.organization_id = s.organization_id AND ci.id = s.catalog_item_id
              WHERE b.organization_id = ${organizationId}::uuid
                AND b.status = 'CONFIRMED'
                AND b.created_at >= ${range.from} AND b.created_at < ${range.to}
              GROUP BY coalesce(ci.id, s.id), s.name, coalesce(ci.kind, 'SERVICE')
              ORDER BY count DESC
              LIMIT 5
            `
          : Promise.resolve([]),

        // Most Quoted Items
        supportsQuotes
          ? tx.$queryRaw<Array<{ catalog_item_id: string; name: string; item_type: string; count: number; total_minor: bigint; currency: string }>>`
              SELECT qli.catalog_item_id, qli.description_snapshot as name, coalesce(ci.kind, 'SERVICE') as item_type,
                     count(*)::int as count, sum(qli.line_total_amount_minor) as total_minor, q.currency
              FROM quote_line_items qli
              JOIN quotes q ON q.organization_id = qli.organization_id AND q.id = qli.quote_id
              LEFT JOIN catalog_items ci ON ci.organization_id = qli.organization_id AND ci.id = qli.catalog_item_id
              WHERE qli.organization_id = ${organizationId}::uuid
                AND q.created_at >= ${range.from} AND q.created_at < ${range.to}
              GROUP BY qli.catalog_item_id, qli.description_snapshot, ci.kind, q.currency
              ORDER BY count DESC
              LIMIT 5
            `
          : Promise.resolve([]),

        // Most Ordered Items
        supportsOrders
          ? tx.$queryRaw<Array<{ catalog_item_id: string; name: string; item_type: string; count: number; total_minor: bigint; currency: string }>>`
              SELECT oli.catalog_item_id, oli.description_snapshot as name, coalesce(ci.kind, 'PRODUCT') as item_type,
                     count(*)::int as count, sum(oli.line_total_amount_minor) as total_minor, o.currency
              FROM order_line_items oli
              JOIN orders o ON o.organization_id = oli.organization_id AND o.id = oli.order_id
              LEFT JOIN catalog_items ci ON ci.organization_id = oli.organization_id AND ci.id = oli.catalog_item_id
              WHERE oli.organization_id = ${organizationId}::uuid
                AND o.created_at >= ${range.from} AND o.created_at < ${range.to}
              GROUP BY oli.catalog_item_id, oli.description_snapshot, ci.kind, o.currency
              ORDER BY count DESC
              LIMIT 5
            `
          : Promise.resolve([]),

        // Working State Intent Detections
        tx.$queryRaw<Array<{ intent: string; count: number }>>`
          SELECT coalesce(state_json->>'currentIntent', 'UNKNOWN') as intent, count(*)::int as count
          FROM conversation_working_state
          WHERE organization_id = ${organizationId}::uuid
            AND updated_at >= ${range.from} AND updated_at < ${range.to}
          GROUP BY coalesce(state_json->>'currentIntent', 'UNKNOWN')
        `,
      ]);

      // Process conversion & latency
      const c = conversionRaw[0] ?? { denominator: 0, numerator: 0 };
      const f = followOutcomeRaw[0] ?? { eligible: 0, replied: 0, booking_associated: 0 };
      const a = automationRaw[0] ?? { denominator: 0, numerator: 0 };
      const d = counts(delivery as Group[], 'deliveryState');
      const unknown = Number(d['UNKNOWN'] ?? 0);
      const deliveryStateMap = counts(delivery as Group[], 'deliveryState');
      const followByStatus = counts(followStates as Group[], 'status');
      const leadStatusMap = counts(leadState as Group[], 'status');
      const bookingStatusMap = counts(bookingStates as Group[], 'status');
      const quoteStatusMap = counts(quoteStates as Group[], 'status');
      const orderStatusMap = counts(orderStates as Group[], 'status');
      const originsMap = counts(origins as Group[], 'origin');
      const handoffsMap = counts(handoffs as Group[], 'action');

      // Conversations metrics
      const totalConversations = Number(a.denominator);
      const aiHandled = Number(a.numerator);
      const humanTakeover = Math.max(0, totalConversations - aiHandled);
      const handoffRate = calculateConversionRate(humanTakeover, totalConversations, 'Handoff Rate').rate;
      const inboundMessages = await tx.message.count({
        where: { organizationId, direction: 'INBOUND', createdAt: { gte: range.from, lt: range.to } },
      });
      const outboundMessages = Number(originsMap['AI'] ?? 0) + Number(originsMap['OPERATOR'] ?? 0) + Number(originsMap['SYSTEM'] ?? 0);
      const aiResponses = Number(originsMap['AI'] ?? 0);
      const operatorResponses = Number(originsMap['OPERATOR'] ?? 0);
      const avgLatency = (latencyRaw as Array<{ origin: string; median_ms: number | null }>).find(l => l.origin === 'AI')?.median_ms ?? null;

      const conversationMetrics: ConversationMetricsDto = {
        total: totalConversations,
        new: totalConversations,
        aiHandled,
        humanTakeover,
        handoffRate,
        inboundMessages,
        outboundMessages,
        aiResponses,
        operatorResponses,
        averageResponseLatencyMs: avgLatency,
      };

      // Intent Metrics
      const intentMap: Record<string, number> = {};
      let totalIntentDetections = 0;
      for (const row of (intentDetectionsRaw as Array<{ intent: string; count: number }>)) {
        intentMap[row.intent] = row.count;
        totalIntentDetections += row.count;
      }
      const unknownIntentCount = intentMap['UNKNOWN'] ?? 0;
      const unknownIntentRate = calculateConversionRate(unknownIntentCount, totalIntentDetections, 'Unknown Intent Rate').rate;
      const topIntents = Object.entries(intentMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([intent, count]) => ({
          intent,
          count,
          percentage: totalIntentDetections > 0 ? Number((count / totalIntentDetections).toFixed(4)) : null,
        }));

      const intentMetrics: IntentMetricsDto = {
        totalDetections: totalIntentDetections,
        byIntent: intentMap,
        topIntents,
        unknownIntentCount,
        unknownIntentRate,
      };

      // Booking Metrics & Funnel
      let bookingMetrics: BookingMetricsDto | undefined;
      let bookingFunnel: WorkflowFunnelDto | undefined;
      if (supportsBooking) {
        const bookingsConfirmed = Number(bookingStatusMap['CONFIRMED'] ?? 0);
        const bookingsCancelled = Number(bookingStatusMap['CANCELLED'] ?? 0);
        const bookingsCompleted = Number(bookingStatusMap['COMPLETED'] ?? 0);
        const totalBookings = Object.values(bookingStatusMap).reduce((acc, v) => acc + v, 0);

        const bookingIntentInquiries = Math.max(
          totalBookings,
          (intentMap['BOOKING_INTENT'] ?? 0) + (tools as Group[]).filter(t => t['toolName'] === 'getAvailableSlots').reduce((acc, r) => acc + Number(r._count?._all ?? 0), 0)
        );

        bookingMetrics = {
          total: totalBookings,
          byStatus: bookingStatusMap,
          confirmed: bookingsConfirmed,
          cancelled: bookingsCancelled,
          completed: bookingsCompleted,
          conversionRate: calculateConversionRate(bookingsConfirmed, bookingIntentInquiries, 'Booking Conversion'),
        };

        const slotSearches = (tools as Group[]).filter(t => t['toolName'] === 'getAvailableSlots').reduce((acc, r) => acc + Number(r._count?._all ?? 0), 0);
        const leadsEngaged = Number(leadCreated);

        bookingFunnel = {
          workflowId: 'BOOKING',
          title: 'Booking Funnel',
          stages: buildFunnelStages([
            { id: 'INTENT', name: 'Booking Inquiries', count: Math.max(bookingIntentInquiries, totalBookings) },
            { id: 'AVAILABILITY', name: 'Slots Searched', count: Math.max(slotSearches, totalBookings) },
            { id: 'LEAD_CAPTURED', name: 'Leads Created', count: Math.max(leadsEngaged, totalBookings) },
            { id: 'CONFIRMED', name: 'Bookings Confirmed', count: bookingsConfirmed },
          ]),
          overallConversionRate: calculateConversionRate(bookingsConfirmed, Math.max(bookingIntentInquiries, totalBookings)).rate,
        };
      }

      // Quote Metrics & Funnel
      let quoteMetrics: QuoteMetricsDto | undefined;
      let quoteFunnel: WorkflowFunnelDto | undefined;
      if (supportsQuotes) {
        const quotesCreated = Object.values(quoteStatusMap).reduce((acc, v) => acc + v, 0);
        const quotesAccepted = Number(quoteStatusMap['ACCEPTED'] ?? 0);
        const quotesRejected = Number(quoteStatusMap['REJECTED'] ?? 0);
        const quotesExpired = Number(quoteStatusMap['EXPIRED'] ?? 0);
        const quotesPresented = quotesCreated - Number(quoteStatusMap['DRAFT'] ?? 0);

        quoteMetrics = {
          total: quotesCreated,
          byStatus: quoteStatusMap,
          created: quotesCreated,
          presented: quotesPresented,
          accepted: quotesAccepted,
          rejected: quotesRejected,
          expired: quotesExpired,
          acceptanceRate: calculateConversionRate(quotesAccepted, quotesPresented, 'Quote Acceptance Rate'),
          acceptedValueByCurrency: (acceptedQuotesValueRaw as Array<{ currency: string; total_minor: bigint }>).map(r => ({
            currency: r.currency,
            amountMinor: String(r.total_minor ?? 0),
          })),
        };

        const quoteIntents = Math.max(quotesCreated, intentMap['QUOTE_INTENT'] ?? 0);
        quoteFunnel = {
          workflowId: 'QUOTE',
          title: 'Quote Funnel',
          stages: buildFunnelStages([
            { id: 'INTENT', name: 'Quote Inquiries', count: quoteIntents },
            { id: 'CREATED', name: 'Quotes Created', count: quotesCreated },
            { id: 'PRESENTED', name: 'Quotes Presented', count: quotesPresented },
            { id: 'ACCEPTED', name: 'Quotes Accepted', count: quotesAccepted },
          ]),
          overallConversionRate: calculateConversionRate(quotesAccepted, quoteIntents).rate,
        };
      }

      // Order Metrics & Funnel
      let orderMetrics: OrderMetricsDto | undefined;
      let orderFunnel: WorkflowFunnelDto | undefined;
      if (supportsOrders) {
        const ordersCreated = Object.values(orderStatusMap).reduce((acc, v) => acc + v, 0);
        const ordersConfirmed = Number(orderStatusMap['CONFIRMED'] ?? 0) + Number(orderStatusMap['FULFILLED'] ?? 0);
        const ordersCancelled = Number(orderStatusMap['CANCELLED'] ?? 0);
        const ordersFulfilled = Number(orderStatusMap['FULFILLED'] ?? 0);

        orderMetrics = {
          total: ordersCreated,
          byStatus: orderStatusMap,
          created: ordersCreated,
          confirmed: ordersConfirmed,
          cancelled: ordersCancelled,
          fulfilled: ordersFulfilled,
          confirmationRate: calculateConversionRate(ordersConfirmed, ordersCreated, 'Order Confirmation Rate'),
          confirmedValueByCurrency: (confirmedOrdersValueRaw as Array<{ currency: string; total_minor: bigint }>).map(r => ({
            currency: r.currency,
            amountMinor: String(r.total_minor ?? 0),
          })),
        };

        const orderIntents = Math.max(ordersCreated, intentMap['PURCHASE_INTENT'] ?? 0);
        orderFunnel = {
          workflowId: 'PURCHASE',
          title: 'Order Purchase Funnel',
          stages: buildFunnelStages([
            { id: 'INTENT', name: 'Purchase Inquiries', count: orderIntents },
            { id: 'CREATED', name: 'Orders Created', count: ordersCreated },
            { id: 'PENDING_CONFIRMATION', name: 'Reached Confirmation', count: ordersConfirmed + ordersCancelled },
            { id: 'CONFIRMED', name: 'Orders Confirmed', count: ordersConfirmed },
          ]),
          overallConversionRate: calculateConversionRate(ordersConfirmed, orderIntents).rate,
        };
      }

      // Lead Metrics & Funnel
      let leadMetrics: LeadMetricsDto | undefined;
      let leadFunnel: WorkflowFunnelDto | undefined;
      if (supportsLeads) {
        leadMetrics = {
          created: Number(leadCreated),
          byStatus: leadStatusMap,
          directBookingConversion: {
            numerator: Number(c.numerator),
            denominator: Number(c.denominator),
            rate: c.denominator ? Number((c.numerator / c.denominator).toFixed(4)) : null,
            label: 'Direct Lead Booking Conversion',
          },
        };

        const leadIntents = Math.max(Number(leadCreated), intentMap['LEAD_INTENT'] ?? 0);
        const qualifiedLeads = Number(leadStatusMap['QUALIFIED'] ?? 0) + Number(leadStatusMap['CONVERTED'] ?? 0);
        leadFunnel = {
          workflowId: 'LEAD_CAPTURE',
          title: 'Lead Capture Funnel',
          stages: buildFunnelStages([
            { id: 'INTENT', name: 'Lead Inquiries', count: leadIntents },
            { id: 'CREATED', name: 'Leads Created', count: Number(leadCreated) },
            { id: 'QUALIFIED', name: 'Leads Qualified/Converted', count: qualifiedLeads },
          ]),
          overallConversionRate: calculateConversionRate(qualifiedLeads, leadIntents).rate,
        };
      }

      // Catalog Analytics
      const catalogAnalytics: CatalogAnalyticsDto = {
        mostBookedServices: (topBookedServicesRaw as Array<{ catalog_item_id: string; name: string; item_type: string; count: number }>).map(r => ({
          catalogItemId: r.catalog_item_id,
          name: r.name,
          itemType: r.item_type,
          count: r.count,
        })),
        mostQuotedItems: (topQuotedItemsRaw as Array<{ catalog_item_id: string; name: string; item_type: string; count: number; total_minor: bigint; currency: string }>).map(r => ({
          catalogItemId: r.catalog_item_id,
          name: r.name,
          itemType: r.item_type,
          count: r.count,
          totalMinor: String(r.total_minor ?? 0),
          currency: r.currency,
        })),
        mostOrderedItems: (topOrderedItemsRaw as Array<{ catalog_item_id: string; name: string; item_type: string; count: number; total_minor: bigint; currency: string }>).map(r => ({
          catalogItemId: r.catalog_item_id,
          name: r.name,
          itemType: r.item_type,
          count: r.count,
          totalMinor: String(r.total_minor ?? 0),
          currency: r.currency,
        })),
      };

      // Multi-Currency Commercial Values (Never mixed!)
      const currencyMap = new Map<string, { quoteMinor: bigint; orderMinor: bigint }>();
      for (const qv of (acceptedQuotesValueRaw as Array<{ currency: string; total_minor: bigint }>)) {
        const cur = qv.currency || 'IQD';
        const entry = currencyMap.get(cur) ?? { quoteMinor: 0n, orderMinor: 0n };
        entry.quoteMinor += BigInt(qv.total_minor ?? 0);
        currencyMap.set(cur, entry);
      }
      for (const ov of (confirmedOrdersValueRaw as Array<{ currency: string; total_minor: bigint }>)) {
        const cur = ov.currency || 'IQD';
        const entry = currencyMap.get(cur) ?? { quoteMinor: 0n, orderMinor: 0n };
        entry.orderMinor += BigInt(ov.total_minor ?? 0);
        currencyMap.set(cur, entry);
      }

      const commercialValues: ValueByCurrencyDto[] = Array.from(currencyMap.entries()).map(([curr, val]) => ({
        currency: curr,
        acceptedQuoteValueMinor: val.quoteMinor.toString(),
        confirmedOrderValueMinor: val.orderMinor.toString(),
        totalCommercialValueMinor: (val.quoteMinor + val.orderMinor).toString(),
      }));

      // Operational Metrics
      const operationalMetrics: OperationalMetricsDto = {
        agentRunsByStatus: counts(runs as Group[], 'status'),
        toolCalls: (tools as Group[]).map(r => ({
          toolName: String(r['toolName']),
          resultCode: String(r['resultCode']),
          count: Number(r._count?._all ?? 0),
        })),
        modelCalls: Number(usage._count._all),
        inputTokens: usage._sum.inputTokens ?? 0,
        outputTokens: usage._sum.outputTokens ?? 0,
        totalTokens: (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0),
        totalLatencyMs: usage._sum.latencyMs ?? 0,
      };

      // V2 Structured Payload with backward-compatible legacy keys
      const overviewResponse: AnalyticsOverviewDto & Record<string, unknown> = {
        metricVersion: 'analytics_overview:v2',
        asOf: new Date().toISOString(),
        range: {
          from: q.from,
          to: q.to,
          timezone: targetTimezone,
          semantics: '[from,to)',
        },
        capabilities: {
          supportsBooking,
          supportsQuotes,
          supportsOrders,
          supportsLeads,
          supportsOffers,
        },
        conversations: conversationMetrics,
        intents: intentMetrics,
        funnels: {
          booking: bookingFunnel,
          quote: quoteFunnel,
          order: orderFunnel,
          lead: leadFunnel,
        },
        leads: leadMetrics,
        bookings: bookingMetrics,
        quotes: quoteMetrics,
        orders: orderMetrics,
        catalog: catalogAnalytics,
        commercialValues,
        operational: operationalMetrics,
        unavailable: {
          cost: { completeness: 'UNAVAILABLE', limitations: ['COST_PRICING_NOT_VERSIONED'] },
          attendanceRevenue: { completeness: 'UNAVAILABLE', limitations: ['OUTCOME_NOT_MODELED'] },
          knowledgeEffectiveness: { completeness: 'UNAVAILABLE', limitations: ['NO_CAUSAL_DESIGN'] },
        },

        // Backward compatibility mappings for legacy callers
        conversion: {
          completeness: 'PARTIAL',
          attribution: 'DIRECT',
          observationDays: 30,
          numerator: Number(c.numerator),
          denominator: Number(c.denominator),
          rate: c.denominator ? c.numerator / c.denominator : null,
          limitations: [...(range.to > new Date(Date.now() - 30 * 86400000) ? ['IMMATURE_COHORT'] : [])],
        },
        followUps: {
          completeness: 'PARTIAL',
          byStatus: followByStatus,
          replyRate: {
            attribution: 'ASSOCIATED',
            numerator: Number(f.replied),
            denominator: Number(f.eligible),
            rate: f.eligible ? f.replied / f.eligible : null,
          },
          bookingAssociation: {
            attribution: 'ASSOCIATED',
            count: Number(f.booking_associated),
            windowDays: 7,
          },
          limitations: [],
        },
        delivery: {
          completeness: unknown ? 'PARTIAL' : 'COMPLETE',
          byCurrentState: deliveryStateMap,
          limitations: unknown ? ['UNKNOWN_DELIVERY_OUTCOMES'] : [],
        },
        agent: {
          completeness: 'COMPLETE',
          runsByStatus: counts(runs as Group[], 'status'),
          toolCalls: (tools as Group[]).map(r => ({
            toolName: String(r['toolName']),
            resultCode: String(r['resultCode']),
            count: Number(r._count?._all ?? 0),
          })),
          usage: {
            modelCalls: Number(usage._count._all),
            inputTokens: usage._sum.inputTokens,
            outputTokens: usage._sum.outputTokens,
            totalTokens: (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0),
            totalLatencyMs: usage._sum.latencyMs,
          },
        },
      };

      return overviewResponse;
    });
  }

  async funnels(actor: ActorContext, organizationId: string, q: { from: string; to: string; timezone?: string }) {
    const res = await this.overview(actor, organizationId, q);
    return {
      metricVersion: 'analytics_funnels:v1',
      asOf: res.asOf,
      range: res.range,
      funnels: res.funnels,
    };
  }

  async catalog(actor: ActorContext, organizationId: string, q: { from: string; to: string; timezone?: string }) {
    const res = await this.overview(actor, organizationId, q);
    return {
      metricVersion: 'analytics_catalog:v1',
      asOf: res.asOf,
      range: res.range,
      catalog: res.catalog,
    };
  }

  async transactions(actor: ActorContext, organizationId: string, q: { from: string; to: string; timezone?: string }) {
    const res = await this.overview(actor, organizationId, q);
    return {
      metricVersion: 'analytics_transactions:v1',
      asOf: res.asOf,
      range: res.range,
      quotes: res.quotes,
      orders: res.orders,
      commercialValues: res.commercialValues,
    };
  }

  async intents(actor: ActorContext, organizationId: string, q: { from: string; to: string; timezone?: string }) {
    const res = await this.overview(actor, organizationId, q);
    return {
      metricVersion: 'analytics_intents:v1',
      asOf: res.asOf,
      range: res.range,
      intents: res.intents,
    };
  }
}
