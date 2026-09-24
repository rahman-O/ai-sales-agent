/** Deterministic demo identity — do not reuse for real tenants. */

export const DEMO_ORG_SLUG = 'zero-cost-test-clinic';
export const DEMO_ORG_NAME = 'Zero Cost Test Clinic';

/** Fixed UUID for the demo organization. Collision with different name → HARD FAIL. */
export const DEMO_ORG_ID = 'a0111111-1111-4111-8111-111111111111';

export const DEMO_OPERATOR_USER_ID = 'a0222222-2222-4222-8222-222222222222';
export const DEMO_LOCATION_ID = 'a0333333-3333-4333-8333-333333333333';
export const DEMO_CHANNEL_ID = 'a0444444-4444-4444-8444-444444444444';

export const DEMO_SERVICE_IDS = {
  consultation: 'a0500001-0001-4001-8001-000000000001',
  cleaning: 'a0500002-0002-4002-8002-000000000002',
  checkup: 'a0500003-0003-4003-8003-000000000003',
} as const;

export const DEMO_STAFF_IDS = {
  one: 'a0600001-0001-4001-8001-000000000001',
  two: 'a0600002-0002-4002-8002-000000000002',
} as const;

export const DEMO_TIMEZONE = 'Asia/Baghdad';

/** US 555 exchange — fiction/test; digit-only E.164. */
export function demoCustomerPhone(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error('demo phone index 1..99');
  return `+15555550${String(n).padStart(3, '0')}`;
}

export const DEMO_CUSTOMER_COUNT = 6;

export const DEMO_TOOL_ALLOWLIST = [
  'searchServices',
  'getServiceDetails',
  'getServicePrice',
  'getCustomer',
  'createCustomer',
  'handoffToHuman',
  'searchKnowledge',
  'ensureLead',
  'updateLeadQualification',
  'getLead',
  'transitionLead',
  'getAvailableSlots',
  'createBooking',
  'getBookings',
  'cancelBooking',
  'rescheduleBooking',
  'scheduleLeadFollowUp',
  'cancelFollowUp',
  'getFollowUps',
] as const;

/** Tables with organization_id — delete/count order (children first). */
export const DEMO_TENANT_TABLES_DELETE_ORDER = [
  'follow_ups',
  'booking_activities',
  'bookings',
  'lead_activities',
  'leads',
  'tool_calls',
  'usage_events',
  'command_operations',
  'agent_runs',
  'conversation_summaries',
  'outbound_attempts',
  'messages',
  'consumer_receipts',
  'webhook_receipts',
  'conversations',
  'customer_identities',
  'customers',
  'knowledge_chunks',
  'knowledge_document_versions',
  'knowledge_documents',
  'staff_availability_exceptions',
  'staff_availability_rules',
  'service_staff',
  'services',
  'staff_members',
  'locations',
  'agent_configs',
  'message_template_versions',
  'message_templates',
  'organization_follow_up_policies',
  'channel_connections',
  'audit_logs',
  'outbox_events',
  'organization_members',
] as const;
