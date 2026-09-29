import { z } from 'zod';

export const AnalyticsDateRangeQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
    timezone: z.string().min(1, 'timezone is required').default('Asia/Baghdad'),
    currency: z.string().length(3).optional(),
    workflow: z.string().optional(),
    catalogItemId: z.string().uuid().optional(),
  })
  .strict();

export type AnalyticsDateRangeQuery = z.infer<typeof AnalyticsDateRangeQuerySchema>;

export interface AnalyticsRangeDto {
  from: string;
  to: string;
  timezone: string;
  semantics: '[from,to)';
}

export interface ConversionRateDto {
  numerator: number;
  denominator: number;
  rate: number | null;
  label?: string;
}

export interface ValueByCurrencyDto {
  currency: string;
  acceptedQuoteValueMinor: string;
  confirmedOrderValueMinor: string;
  totalCommercialValueMinor: string;
}

export interface ConversationMetricsDto {
  total: number;
  new: number;
  aiHandled: number;
  humanTakeover: number;
  handoffRate: number | null;
  inboundMessages: number;
  outboundMessages: number;
  aiResponses: number;
  operatorResponses: number;
  averageResponseLatencyMs: number | null;
}

export interface IntentCountItemDto {
  intent: string;
  count: number;
  percentage: number | null;
}

export interface IntentMetricsDto {
  totalDetections: number;
  byIntent: Record<string, number>;
  topIntents: IntentCountItemDto[];
  unknownIntentCount: number;
  unknownIntentRate: number | null;
}

export interface FunnelStageDto {
  id: string;
  name: string;
  count: number;
  conversionFromPrevious: number | null;
  conversionFromInitial: number | null;
  dropOffFromPrevious: number | null;
}

export interface WorkflowFunnelDto {
  workflowId: string;
  title: string;
  stages: FunnelStageDto[];
  overallConversionRate: number | null;
}

export interface LeadMetricsDto {
  created: number;
  byStatus: Record<string, number>;
  directBookingConversion: ConversionRateDto;
}

export interface BookingMetricsDto {
  total: number;
  byStatus: Record<string, number>;
  confirmed: number;
  cancelled: number;
  completed: number;
  conversionRate: ConversionRateDto;
}

export interface QuoteMetricsDto {
  total: number;
  byStatus: Record<string, number>;
  created: number;
  presented: number;
  accepted: number;
  rejected: number;
  expired: number;
  acceptanceRate: ConversionRateDto;
  acceptedValueByCurrency: Array<{ currency: string; amountMinor: string }>;
}

export interface OrderMetricsDto {
  total: number;
  byStatus: Record<string, number>;
  created: number;
  confirmed: number;
  cancelled: number;
  fulfilled: number;
  confirmationRate: ConversionRateDto;
  confirmedValueByCurrency: Array<{ currency: string; amountMinor: string }>;
}

export interface CatalogItemMetricDto {
  catalogItemId: string;
  name: string;
  itemType: string;
  count: number;
  totalMinor?: string;
  currency?: string;
}

export interface CatalogAnalyticsDto {
  mostBookedServices: CatalogItemMetricDto[];
  mostQuotedItems: CatalogItemMetricDto[];
  mostOrderedItems: CatalogItemMetricDto[];
}

export interface OperationalMetricsDto {
  agentRunsByStatus: Record<string, number>;
  toolCalls: Array<{ toolName: string; resultCode: string; count: number }>;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalLatencyMs: number;
}

export interface AnalyticsOverviewDto {
  metricVersion: 'analytics_overview:v2';
  asOf: string;
  range: AnalyticsRangeDto;
  capabilities: {
    supportsBooking: boolean;
    supportsQuotes: boolean;
    supportsOrders: boolean;
    supportsLeads: boolean;
    supportsOffers: boolean;
  };
  conversations: ConversationMetricsDto;
  intents: IntentMetricsDto;
  funnels: {
    booking?: WorkflowFunnelDto;
    quote?: WorkflowFunnelDto;
    order?: WorkflowFunnelDto;
    lead?: WorkflowFunnelDto;
  };
  leads?: LeadMetricsDto;
  bookings?: BookingMetricsDto;
  quotes?: QuoteMetricsDto;
  orders?: OrderMetricsDto;
  catalog: CatalogAnalyticsDto;
  commercialValues: ValueByCurrencyDto[];
  operational: OperationalMetricsDto;
  unavailable: Record<string, { completeness: 'UNAVAILABLE'; limitations: string[] }>;
}

export interface MetricCatalogItem {
  id: string;
  name: string;
  category: 'CONVERSATIONS' | 'INTENTS' | 'WORKFLOWS' | 'LEADS' | 'BOOKINGS' | 'QUOTES' | 'ORDERS' | 'VALUE' | 'CATALOG' | 'OPERATIONAL';
  sourceTable: string;
  dateField: string;
  numeratorDescription: string;
  denominatorDescription?: string;
  requiredCapability?: string;
  statusSemantics: string;
  previewExcluded: true;
}

export const METRIC_CATALOG: MetricCatalogItem[] = [
  {
    id: 'TOTAL_CONVERSATIONS',
    name: 'Total Conversations',
    category: 'CONVERSATIONS',
    sourceTable: 'conversations',
    dateField: 'created_at',
    numeratorDescription: 'Count of unique conversations created in date range',
    statusSemantics: 'All conversations with non-preview execution',
    previewExcluded: true,
  },
  {
    id: 'AI_HANDLED_CONVERSATIONS',
    name: 'AI-Handled Conversations',
    category: 'CONVERSATIONS',
    sourceTable: 'conversations / messages / audit_logs',
    dateField: 'conversations.created_at',
    numeratorDescription: 'Conversations with AI outbound responses and zero human takeover/operator messages',
    statusSemantics: 'Fully automated resolution without human intervention',
    previewExcluded: true,
  },
  {
    id: 'HUMAN_TAKEOVER_CONVERSATIONS',
    name: 'Human Takeover Conversations',
    category: 'CONVERSATIONS',
    sourceTable: 'conversations / audit_logs / messages',
    dateField: 'conversations.created_at',
    numeratorDescription: 'Conversations with operator takeover event or operator outbound message',
    statusSemantics: 'Operator intervention or claim during conversation',
    previewExcluded: true,
  },
  {
    id: 'HANDOFF_RATE',
    name: 'Handoff Rate',
    category: 'CONVERSATIONS',
    sourceTable: 'conversations / audit_logs',
    dateField: 'conversations.created_at',
    numeratorDescription: 'Count of human takeover conversations',
    denominatorDescription: 'Total conversations in range',
    statusSemantics: 'Ratio of conversations escalated to human staff; null if denominator is 0',
    previewExcluded: true,
  },
  {
    id: 'INTENT_COUNTS',
    name: 'Intent Counts',
    category: 'INTENTS',
    sourceTable: 'conversation_working_states / tool_calls',
    dateField: 'updated_at / created_at',
    numeratorDescription: 'Aggregated frequency of structured intent detections',
    statusSemantics: 'Enums from AgentIntentEnum (e.g. BOOKING_INTENT, QUOTE_INTENT, PURCHASE_INTENT)',
    previewExcluded: true,
  },
  {
    id: 'UNKNOWN_INTENT_RATE',
    name: 'Unknown Intent Rate',
    category: 'INTENTS',
    sourceTable: 'conversation_working_states',
    dateField: 'updated_at',
    numeratorDescription: 'Count of UNKNOWN intent detections',
    denominatorDescription: 'Total intent detections',
    statusSemantics: 'Ratio of unclassified inquiries; null if denominator is 0',
    previewExcluded: true,
  },
  {
    id: 'LEADS_CREATED',
    name: 'Leads Created',
    category: 'LEADS',
    sourceTable: 'leads',
    dateField: 'created_at',
    numeratorDescription: 'Count of lead records created in range',
    requiredCapability: 'supportsLeads',
    statusSemantics: 'New customer leads initiated via agent or operator',
    previewExcluded: true,
  },
  {
    id: 'DIRECT_BOOKING_CONVERSION',
    name: 'Direct Booking Conversion',
    category: 'LEADS',
    sourceTable: 'leads / bookings / booking_activities',
    dateField: 'leads.created_at',
    numeratorDescription: 'Leads in cohort with confirmed booking within 30 days',
    denominatorDescription: 'Total leads created in cohort',
    requiredCapability: 'supportsBooking',
    statusSemantics: 'Direct cohort conversion; null if denominator is 0',
    previewExcluded: true,
  },
  {
    id: 'BOOKINGS_CREATED',
    name: 'Bookings Created',
    category: 'BOOKINGS',
    sourceTable: 'bookings',
    dateField: 'created_at',
    numeratorDescription: 'Count of booking records created in range',
    requiredCapability: 'supportsBooking',
    statusSemantics: 'All booking rows created in period',
    previewExcluded: true,
  },
  {
    id: 'BOOKINGS_CONFIRMED',
    name: 'Bookings Confirmed',
    category: 'BOOKINGS',
    sourceTable: 'bookings',
    dateField: 'created_at',
    numeratorDescription: 'Count of bookings with status CONFIRMED',
    requiredCapability: 'supportsBooking',
    statusSemantics: 'Active confirmed bookings',
    previewExcluded: true,
  },
  {
    id: 'BOOKING_CONVERSION_RATE',
    name: 'Booking Conversion Rate',
    category: 'BOOKINGS',
    sourceTable: 'bookings / conversations',
    dateField: 'created_at',
    numeratorDescription: 'Confirmed bookings created in range',
    denominatorDescription: 'Conversations with booking intent or slot search in range',
    requiredCapability: 'supportsBooking',
    statusSemantics: 'Ratio of booking inquiries resulting in confirmation; null if denominator is 0',
    previewExcluded: true,
  },
  {
    id: 'QUOTES_CREATED',
    name: 'Quotes Created',
    category: 'QUOTES',
    sourceTable: 'quotes',
    dateField: 'created_at',
    numeratorDescription: 'Count of quote records created in range',
    requiredCapability: 'supportsQuotes',
    statusSemantics: 'All quote records regardless of lifecycle status',
    previewExcluded: true,
  },
  {
    id: 'QUOTES_PRESENTED',
    name: 'Quotes Presented',
    category: 'QUOTES',
    sourceTable: 'quotes',
    dateField: 'created_at',
    numeratorDescription: 'Count of quotes with status SENT, ACCEPTED, REJECTED, CANCELLED, EXPIRED',
    requiredCapability: 'supportsQuotes',
    statusSemantics: 'Quotes delivered to the customer (excludes DRAFT)',
    previewExcluded: true,
  },
  {
    id: 'QUOTES_ACCEPTED',
    name: 'Quotes Accepted',
    category: 'QUOTES',
    sourceTable: 'quotes',
    dateField: 'created_at',
    numeratorDescription: 'Count of quotes with status ACCEPTED',
    requiredCapability: 'supportsQuotes',
    statusSemantics: 'Customer accepted quotes',
    previewExcluded: true,
  },
  {
    id: 'QUOTE_ACCEPTANCE_RATE',
    name: 'Quote Acceptance Rate',
    category: 'QUOTES',
    sourceTable: 'quotes',
    dateField: 'created_at',
    numeratorDescription: 'Quotes accepted',
    denominatorDescription: 'Quotes presented (excludes drafts)',
    requiredCapability: 'supportsQuotes',
    statusSemantics: 'Ratio of presented quotes accepted by customers; null if denominator is 0',
    previewExcluded: true,
  },
  {
    id: 'ACCEPTED_QUOTE_VALUE',
    name: 'Accepted Quote Value',
    category: 'VALUE',
    sourceTable: 'quotes',
    dateField: 'created_at',
    numeratorDescription: 'Sum of total_amount_minor for quotes with status ACCEPTED grouped by currency',
    requiredCapability: 'supportsQuotes',
    statusSemantics: 'Authoritative financial snapshot value in minor integer units (BigInt); never mixed across currencies',
    previewExcluded: true,
  },
  {
    id: 'ORDERS_CREATED',
    name: 'Orders Created',
    category: 'ORDERS',
    sourceTable: 'orders',
    dateField: 'created_at',
    numeratorDescription: 'Count of order records created in range',
    requiredCapability: 'supportsOrders',
    statusSemantics: 'All order records created in period',
    previewExcluded: true,
  },
  {
    id: 'ORDERS_CONFIRMED',
    name: 'Orders Confirmed',
    category: 'ORDERS',
    sourceTable: 'orders',
    dateField: 'created_at',
    numeratorDescription: 'Count of orders with status CONFIRMED or FULFILLED',
    requiredCapability: 'supportsOrders',
    statusSemantics: 'Authoritative confirmed orders',
    previewExcluded: true,
  },
  {
    id: 'ORDER_CONFIRMATION_RATE',
    name: 'Order Confirmation Rate',
    category: 'ORDERS',
    sourceTable: 'orders',
    dateField: 'created_at',
    numeratorDescription: 'Orders confirmed or fulfilled',
    denominatorDescription: 'Orders created that reached confirmation or terminal state',
    requiredCapability: 'supportsOrders',
    statusSemantics: 'Ratio of created orders resulting in confirmation; null if denominator is 0',
    previewExcluded: true,
  },
  {
    id: 'CONFIRMED_ORDER_VALUE',
    name: 'Confirmed Order Value',
    category: 'VALUE',
    sourceTable: 'orders',
    dateField: 'created_at',
    numeratorDescription: 'Sum of total_amount_minor for orders with status CONFIRMED or FULFILLED grouped by currency',
    requiredCapability: 'supportsOrders',
    statusSemantics: 'Authoritative order monetary value in minor integer units (BigInt); never mixed across currencies',
    previewExcluded: true,
  },
  {
    id: 'MOST_BOOKED_SERVICES',
    name: 'Most Booked Services',
    category: 'CATALOG',
    sourceTable: 'bookings / services',
    dateField: 'bookings.created_at',
    numeratorDescription: 'Top catalog services sorted by count of confirmed bookings',
    requiredCapability: 'supportsBooking',
    statusSemantics: 'CatalogItem with itemType SERVICE',
    previewExcluded: true,
  },
  {
    id: 'MOST_QUOTED_ITEMS',
    name: 'Most Quoted Items',
    category: 'CATALOG',
    sourceTable: 'quote_line_items / quotes / services',
    dateField: 'quotes.created_at',
    numeratorDescription: 'Top catalog items sorted by frequency in quotes',
    requiredCapability: 'supportsQuotes',
    statusSemantics: 'Aggregated line items across quotes',
    previewExcluded: true,
  },
  {
    id: 'MOST_ORDERED_ITEMS',
    name: 'Most Ordered Items',
    category: 'CATALOG',
    sourceTable: 'order_line_items / orders / services',
    dateField: 'orders.created_at',
    numeratorDescription: 'Top catalog items sorted by frequency in orders',
    requiredCapability: 'supportsOrders',
    statusSemantics: 'Aggregated line items across orders',
    previewExcluded: true,
  },
];

/**
 * Deterministic calculation of conversion rate with zero-denominator safety
 */
export function calculateConversionRate(numerator: number, denominator: number, label?: string): ConversionRateDto {
  if (denominator <= 0) {
    return { numerator, denominator: 0, rate: null, label };
  }
  return {
    numerator,
    denominator,
    rate: Number((numerator / denominator).toFixed(4)),
    label,
  };
}

/**
 * Deterministic funnel drop-off and stage progression calculation
 */
export function buildFunnelStages(stagesInput: Array<{ id: string; name: string; count: number }>): FunnelStageDto[] {
  if (stagesInput.length === 0) return [];
  const initialCount = stagesInput[0]?.count ?? 0;
  return stagesInput.map((stage, idx) => {
    const prevCount = idx === 0 ? stage.count : stagesInput[idx - 1]!.count;
    const conversionFromPrevious = prevCount > 0 ? Number((stage.count / prevCount).toFixed(4)) : null;
    const conversionFromInitial = initialCount > 0 ? Number((stage.count / initialCount).toFixed(4)) : null;
    const dropOffFromPrevious = idx === 0 ? 0 : Math.max(0, prevCount - stage.count);
    return {
      id: stage.id,
      name: stage.name,
      count: stage.count,
      conversionFromPrevious,
      conversionFromInitial,
      dropOffFromPrevious,
    };
  });
}
