import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContextMessages, POLICY_BLOCK_FOR_TEST } from './context-builder.js';
import type { ConversationSnapshot } from './ports.js';

test('MB-08: Policy block defines knowledge grounding and structured truth precedence', () => {
  assert.ok(
    POLICY_BLOCK_FOR_TEST.includes('KNOWLEDGE & STRUCTURED TRUTH PRECEDENCE'),
    'Policy block must define knowledge and structured truth precedence header',
  );
  assert.ok(
    POLICY_BLOCK_FOR_TEST.includes('Catalog prices and items strictly govern over prices in knowledge'),
    'Catalog prices must strictly govern over knowledge',
  );
  assert.ok(
    POLICY_BLOCK_FOR_TEST.includes('Active Offers strictly govern over discounts/promotions in knowledge'),
    'Active offers must strictly govern over knowledge',
  );
  assert.ok(
    POLICY_BLOCK_FOR_TEST.includes('Business Policies strictly govern over cancellation/refund/deposit rules in knowledge'),
    'Business policies must strictly govern over knowledge',
  );
  assert.ok(
    POLICY_BLOCK_FOR_TEST.includes('NEVER fabricate or invent missing facts; politely state that confirmed information is unavailable'),
    'Empty or missing knowledge must forbid fabrication',
  );
});

test('MB-08: System prompt includes knowledge rules ahead of conversation turns', () => {
  const snap: ConversationSnapshot = {
    organizationId: 'org-test',
    conversationId: 'conv-1',
    customerId: 'cust-1',
    mode: 'AI_ACTIVE',
    ownershipEpoch: 0,
    leaseOwner: 'worker-1',
    leaseFence: 1,
    nextIngressSequence: 2,
    processedSequence: 0,
    targetIngressSequence: 1,
    messages: [
      { id: 'm1', direction: 'INBOUND', ingressSequence: 1, timelineSequence: 1, contentText: 'شنو أوقات العمل والأسعار؟' },
    ],
    summaryText: null,
    summaryWatermark: null,
    agentConfigVersionId: 'cfg-1',
    promptVersion: 'p1',
    modelProfile: 'default',
    toolAllowlist: ['searchKnowledge', 'searchServices', 'getEffectivePolicy', 'getAvailableSlots', 'createBooking'],
  };

  const msgs = buildContextMessages(snap);
  assert.equal(msgs[0]?.role, 'system');
  assert.ok(msgs[0]?.content.includes('searchKnowledge'));
  assert.ok(msgs[0]?.content.includes('Structured backend truth ALWAYS overrides knowledge'));
  assert.equal(msgs[1]?.role, 'user');
  assert.equal(msgs[1]?.content, 'شنو أوقات العمل والأسعار؟');
});
