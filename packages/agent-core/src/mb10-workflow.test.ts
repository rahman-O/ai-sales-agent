import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AgentIntentEnum,
  IntentClassificationSchema,
  WorkflowIdEnum,
  WorkflowStageEnum,
} from '@ai-sales-agent/contracts';
import {
  WORKFLOW_DEFINITIONS,
  getWorkflowDefinition,
  findWorkflowForIntent,
} from './workflow-registry.js';
import {
  resolveWorkflow,
} from './workflow-resolver.js';

test('MB-10: Intent contracts and validation schema', () => {
  // Valid intent classification
  const valid = IntentClassificationSchema.parse({
    primary: 'BOOKING_INTENT',
    secondary: ['PRICE_INQUIRY', 'OFFER_INQUIRY'],
    confidence: 0.95,
  });
  assert.equal(valid.primary, 'BOOKING_INTENT');
  assert.equal(valid.secondary.length, 2);
  assert.equal(valid.confidence, 0.95);

  // Defaults
  const minimal = IntentClassificationSchema.parse({
    primary: 'GENERAL_INQUIRY',
  });
  assert.equal(minimal.confidence, 1.0);
  assert.deepEqual(minimal.secondary, []);

  // Reject invalid enum
  assert.throws(() => {
    IntentClassificationSchema.parse({ primary: 'INVALID_INTENT' });
  });

  // Reject invalid confidence
  assert.throws(() => {
    IntentClassificationSchema.parse({ primary: 'BOOKING_INTENT', confidence: 1.5 });
  });
  assert.throws(() => {
    IntentClassificationSchema.parse({ primary: 'BOOKING_INTENT', confidence: -0.1 });
  });

  // Reject more than 3 secondary intents
  assert.throws(() => {
    IntentClassificationSchema.parse({
      primary: 'BOOKING_INTENT',
      secondary: ['PRICE_INQUIRY', 'OFFER_INQUIRY', 'POLICY_INQUIRY', 'DISCOVERY'],
    });
  });
});

test('MB-10: Workflow definitions registry contains expected standard journeys', () => {
  assert.ok(WORKFLOW_DEFINITIONS.DISCOVERY);
  assert.ok(WORKFLOW_DEFINITIONS.BOOKING);
  assert.ok(WORKFLOW_DEFINITIONS.LEAD_CAPTURE);
  assert.ok(WORKFLOW_DEFINITIONS.BOOKING_CANCELLATION);
  assert.ok(WORKFLOW_DEFINITIONS.BOOKING_RESCHEDULING);
  assert.ok(WORKFLOW_DEFINITIONS.OFFER_DISCOVERY);
  assert.ok(WORKFLOW_DEFINITIONS.POLICY_LOOKUP);
  assert.ok(WORKFLOW_DEFINITIONS.KNOWLEDGE_LOOKUP);
  assert.ok(WORKFLOW_DEFINITIONS.HUMAN_HANDOFF);
  assert.ok(WORKFLOW_DEFINITIONS.GENERAL_SUPPORT);
  assert.ok(WORKFLOW_DEFINITIONS.QUOTE);
  assert.ok(WORKFLOW_DEFINITIONS.PURCHASE);

  // QUOTE & PURCHASE executable in MB-12
  assert.equal(WORKFLOW_DEFINITIONS.QUOTE.isExecutable, true);
  assert.equal(WORKFLOW_DEFINITIONS.PURCHASE.isExecutable, true);

  // Core workflows are executable
  assert.equal(WORKFLOW_DEFINITIONS.BOOKING.isExecutable, true);
  assert.equal(WORKFLOW_DEFINITIONS.DISCOVERY.isExecutable, true);
});

test('MB-10: Capability-driven workflow resolution', () => {
  // 1. Booking intent with supportsBooking=true -> Resolves executable BOOKING
  const resBookingEnabled = resolveWorkflow({
    capabilities: { supportsBooking: true },
    intent: { primary: 'BOOKING_INTENT', secondary: [], confidence: 0.9 },
  });
  assert.equal(resBookingEnabled.workflowId, 'BOOKING');
  assert.equal(resBookingEnabled.supported, true);
  assert.equal(resBookingEnabled.executable, true);
  assert.ok(resBookingEnabled.allowedTools.includes('getAvailableSlots'));
  assert.ok(resBookingEnabled.allowedTools.includes('createBooking'));

  // 2. Booking intent with supportsBooking=false -> Rejects with missing capability
  const resBookingDisabled = resolveWorkflow({
    capabilities: { supportsBooking: false },
    intent: { primary: 'BOOKING_INTENT', secondary: [], confidence: 0.9 },
  });
  assert.equal(resBookingDisabled.workflowId, 'BOOKING');
  assert.equal(resBookingDisabled.supported, false);
  assert.equal(resBookingDisabled.executable, false);
  assert.ok(resBookingDisabled.reason?.includes('MISSING_REQUIRED_CAPABILITY'));
  assert.deepEqual(resBookingDisabled.allowedTools, []);
  assert.ok(resBookingDisabled.blockedMutationTools.includes('createBooking'));

  // 3. Offer inquiry with supportsOffers=true -> Resolves OFFER_DISCOVERY
  const resOfferEnabled = resolveWorkflow({
    capabilities: { supportsOffers: true },
    intent: { primary: 'OFFER_INQUIRY', secondary: [], confidence: 1.0 },
  });
  assert.equal(resOfferEnabled.workflowId, 'OFFER_DISCOVERY');
  assert.equal(resOfferEnabled.supported, true);
  assert.equal(resOfferEnabled.executable, true);
  assert.ok(resOfferEnabled.allowedTools.includes('getActiveOffers'));

  // 4. Offer inquiry with supportsOffers=false -> Rejects with missing capability
  const resOfferDisabled = resolveWorkflow({
    capabilities: { supportsOffers: false },
    intent: { primary: 'OFFER_INQUIRY', secondary: [], confidence: 1.0 },
  });
  assert.equal(resOfferDisabled.supported, false);
  assert.equal(resOfferDisabled.executable, false);

  // 5. Quote & Purchase: Executable when capability enabled (MB-12)
  const resQuote = resolveWorkflow({
    capabilities: { supportsQuotes: true },
    intent: { primary: 'QUOTE_INTENT', secondary: [], confidence: 0.9 },
  });
  assert.equal(resQuote.workflowId, 'QUOTE');
  assert.equal(resQuote.supported, true);
  assert.equal(resQuote.executable, true);
  assert.ok(resQuote.allowedTools.includes('createQuote'));

  const resQuoteDisabled = resolveWorkflow({
    capabilities: { supportsQuotes: false },
    intent: { primary: 'QUOTE_INTENT', secondary: [], confidence: 0.9 },
  });
  assert.equal(resQuoteDisabled.supported, false);
  assert.equal(resQuoteDisabled.executable, false);

  const resPurchase = resolveWorkflow({
    capabilities: { supportsOrders: true },
    intent: { primary: 'PURCHASE_INTENT', secondary: [], confidence: 0.9 },
  });
  assert.equal(resPurchase.workflowId, 'PURCHASE');
  assert.equal(resPurchase.supported, true);
  assert.equal(resPurchase.executable, true);
  assert.ok(resPurchase.allowedTools.includes('createOrder'));

  const resPurchaseDisabled = resolveWorkflow({
    capabilities: { supportsOrders: false },
    intent: { primary: 'PURCHASE_INTENT', secondary: [], confidence: 0.9 },
  });
  assert.equal(resPurchaseDisabled.supported, false);
  assert.equal(resPurchaseDisabled.executable, false);
});

test('MB-10: Tool gating strictly intersects capabilities and configured allowlist', () => {
  const resRestrictedAllowlist = resolveWorkflow({
    capabilities: { supportsBooking: true },
    intent: { primary: 'BOOKING_INTENT', secondary: [], confidence: 1.0 },
    configuredToolAllowlist: ['searchServices', 'getAvailableSlots'], // createBooking omitted from config
  });

  assert.equal(resRestrictedAllowlist.workflowId, 'BOOKING');
  assert.ok(resRestrictedAllowlist.allowedTools.includes('searchServices'));
  assert.ok(resRestrictedAllowlist.allowedTools.includes('getAvailableSlots'));
  assert.equal(resRestrictedAllowlist.allowedTools.includes('createBooking'), false);
  assert.ok(resRestrictedAllowlist.blockedMutationTools.includes('createBooking'));
});

test('MB-10: Workflow stage derivation from operational working state', () => {
  // Empty state -> INITIAL
  const resInitial = resolveWorkflow({
    capabilities: { supportsBooking: true },
    intent: { primary: 'BOOKING_INTENT', secondary: [], confidence: 1.0 },
    workingState: {},
  });
  assert.equal(resInitial.stage, 'INITIAL');

  // Selected service -> IN_PROGRESS
  const resSelected = resolveWorkflow({
    capabilities: { supportsBooking: true },
    intent: { primary: 'BOOKING_INTENT', secondary: [], confidence: 1.0 },
    workingState: { selectedEntity: { entityType: 'SERVICE', entityId: 'svc-1' } },
  });
  assert.equal(resSelected.stage, 'IN_PROGRESS');

  // Candidate slots -> AWAITING_SLOT_SELECTION
  const resSlots = resolveWorkflow({
    capabilities: { supportsBooking: true },
    intent: { primary: 'BOOKING_INTENT', secondary: [], confidence: 1.0 },
    workingState: {
      selectedEntity: { entityType: 'SERVICE', entityId: 'svc-1' },
      candidateSlots: [
        {
          entityId: 'svc-1',
          staffMemberId: 'st-1',
          locationId: 'loc-1',
          startsAt: '2026-09-30T10:00:00Z',
          endsAt: '2026-09-30T10:30:00Z',
          localDate: '2026-09-30',
          localStartTime: '10:00',
          slotToken: 'tok-1',
          expiresAt: '2026-09-30T10:15:00Z',
        },
      ],
    },
  });
  assert.equal(resSlots.stage, 'AWAITING_SLOT_SELECTION');

  // Confirmed booking -> COMPLETED
  const resCompleted = resolveWorkflow({
    capabilities: { supportsBooking: true },
    intent: { primary: 'BOOKING_INTENT', secondary: [], confidence: 1.0 },
    workingState: { lastConfirmedBookingId: 'bk-123' },
  });
  assert.equal(resCompleted.stage, 'COMPLETED');
});
