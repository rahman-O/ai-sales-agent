import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attentionIdentity,
  finalizeAttentionFeed,
  isConversationWaitingForHuman,
  isHandoffPauseReason,
  isPausedUnassignedReason,
  isReviewRequiredSuppression,
  makeAttentionItem,
  sortAttentionItems,
} from './attention.js';
import { deriveQualificationState } from '../domain/lead-state.js';

test('isConversationWaitingForHuman: inbound without operator reply', () => {
  assert.equal(
    isConversationWaitingForHuman({
      maxCustomerInboundSeq: 3,
      maxOperatorOutboundSeq: null,
    }),
    true,
  );
});

test('isConversationWaitingForHuman: operator replied last', () => {
  assert.equal(
    isConversationWaitingForHuman({
      maxCustomerInboundSeq: 3,
      maxOperatorOutboundSeq: 4,
    }),
    false,
  );
});

test('isConversationWaitingForHuman: customer sends again', () => {
  assert.equal(
    isConversationWaitingForHuman({
      maxCustomerInboundSeq: 5,
      maxOperatorOutboundSeq: 4,
    }),
    true,
  );
});

test('isConversationWaitingForHuman: no customer inbound', () => {
  assert.equal(
    isConversationWaitingForHuman({
      maxCustomerInboundSeq: null,
      maxOperatorOutboundSeq: 2,
    }),
    false,
  );
});

test('handoff vs paused unassigned reasons', () => {
  assert.equal(isHandoffPauseReason('CUSTOMER_REQUESTED_HUMAN'), true);
  assert.equal(isHandoffPauseReason('AI_UNCERTAIN'), true);
  assert.equal(isHandoffPauseReason('OPERATOR_MANUAL_TAKEOVER'), false);
  assert.equal(isPausedUnassignedReason('OPERATOR_MANUAL_TAKEOVER'), true);
  assert.equal(isPausedUnassignedReason(null), true);
  assert.equal(isPausedUnassignedReason('CUSTOMER_REQUESTED_HUMAN'), false);
});

test('review-required suppression is reason-aware', () => {
  assert.equal(isReviewRequiredSuppression('TEMPLATE_DISABLED'), true);
  assert.equal(isReviewRequiredSuppression('CHANNEL_DISABLED'), true);
  assert.equal(isReviewRequiredSuppression('CUSTOMER_REPLIED'), false);
  assert.equal(isReviewRequiredSuppression('LEAD_TERMINAL'), false);
  assert.equal(isReviewRequiredSuppression('MISSED_ALLOWED_WINDOW'), false);
});

test('attention identity is stable per conversation for waiting', () => {
  assert.equal(
    attentionIdentity('HUMAN_CONVERSATION_WAITING', 'c1'),
    'conversation:c1:waiting',
  );
});

test('finalizeAttentionFeed: severity order and global cap', () => {
  const items = [
    makeAttentionItem({
      type: 'LEAD_NEEDS_QUALIFICATION',
      entityType: 'Lead',
      entityId: 'l1',
      organizationId: 'o',
      severity: 'INFO',
      title: 'a',
      description: 'd',
      actionRoute: '/',
      occurredAt: '2026-01-02T00:00:00.000Z',
    }),
    makeAttentionItem({
      type: 'CHANNEL_AUTH_FAILED',
      entityType: 'Channel',
      entityId: 'ch1',
      organizationId: 'o',
      severity: 'CRITICAL',
      title: 'c',
      description: 'd',
      actionRoute: '/',
      occurredAt: '2026-01-01T00:00:00.000Z',
    }),
    makeAttentionItem({
      type: 'HUMAN_HANDOFF_UNASSIGNED',
      entityType: 'Conversation',
      entityId: 'c1',
      organizationId: 'o',
      severity: 'WARNING',
      title: 'w',
      description: 'd',
      actionRoute: '/',
      occurredAt: '2026-01-03T00:00:00.000Z',
    }),
  ];
  const sorted = sortAttentionItems(items);
  assert.equal(sorted[0]!.type, 'CHANNEL_AUTH_FAILED');
  assert.equal(sorted[1]!.type, 'HUMAN_HANDOFF_UNASSIGNED');
  assert.equal(sorted[2]!.type, 'LEAD_NEEDS_QUALIFICATION');
});

test('finalizeAttentionFeed: channel unhealthy caps derivative types', () => {
  const items = [
    makeAttentionItem({
      type: 'CHANNEL_AUTH_FAILED',
      entityType: 'Channel',
      entityId: 'ch',
      organizationId: 'o',
      severity: 'CRITICAL',
      title: 'c',
      description: 'd',
      actionRoute: '/',
    }),
    ...Array.from({ length: 6 }, (_, i) =>
      makeAttentionItem({
        type: 'FOLLOWUP_FAILED',
        entityType: 'FollowUp',
        entityId: `f${i}`,
        organizationId: 'o',
        severity: 'WARNING',
        title: 'f',
        description: 'd',
        actionRoute: '/',
        occurredAt: `2026-01-0${i + 1}T00:00:00.000Z`,
      }),
    ),
  ];
  const out = finalizeAttentionFeed(items);
  const failed = out.filter((x) => x.type === 'FOLLOWUP_FAILED');
  assert.equal(failed.length, 3);
  assert.ok(out.some((x) => x.type === 'CHANNEL_AUTH_FAILED'));
});

test('qualification parity: dashboard uses same helper branches', () => {
  assert.equal(
    deriveQualificationState(
      {
        primaryServiceId: null,
        locationId: null,
        needSummary: null,
        preferredContactChannel: null,
      },
      { activeLocationCount: 1 },
    ),
    'INCOMPLETE',
  );
  assert.equal(
    deriveQualificationState(
      {
        primaryServiceId: 's',
        locationId: null,
        needSummary: 'need',
        preferredContactChannel: 'whatsapp',
      },
      { activeLocationCount: 1 },
    ),
    'SUFFICIENT',
  );
  assert.equal(
    deriveQualificationState(
      {
        primaryServiceId: 's',
        locationId: null,
        needSummary: 'need',
        preferredContactChannel: 'whatsapp',
      },
      { activeLocationCount: 2 },
    ),
    'INCOMPLETE',
  );
});
