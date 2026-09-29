import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyWorkflowIntentTransition,
  clearPendingWorkflow,
  updateWorkingStateDataWithToolResult,
} from './conversation-working-state.js';
import type { ConversationWorkingStateData } from '@ai-sales-agent/agent-core';

test('MB-10: Working state topic switching (suspend & resume)', () => {
  let state: ConversationWorkingStateData = {};

  // 1. Customer initiates booking
  const step1 = applyWorkflowIntentTransition(state, {
    primary: 'BOOKING_INTENT',
    secondary: [],
    confidence: 0.95,
  });
  assert.equal(step1.changed, true);
  assert.equal(step1.stateData.activeWorkflow?.id, 'BOOKING');
  assert.equal(step1.stateData.activeWorkflow?.stage, 'INITIAL');

  // 2. Service resolved & candidate slots fetched
  const step2 = updateWorkingStateDataWithToolResult(
    step1.stateData,
    'getAvailableSlots',
    { serviceId: 'svc-1' },
    {
      ok: true,
      data: {
        slots: [
          {
            staffMemberId: 'st-1',
            locationId: 'loc-1',
            startsAt: '2026-09-30T10:00:00.000Z',
            endsAt: '2026-09-30T10:30:00.000Z',
            slotToken: 'tok-1',
          },
        ],
      },
    },
  );
  assert.equal(step2.stateData.activeWorkflow?.stage, 'AWAITING_SLOT_SELECTION');
  assert.equal(step2.stateData.candidateSlots?.length, 1);

  // 3. Customer temporarily switches topic to ask about active offers
  const step3 = applyWorkflowIntentTransition(step2.stateData, {
    primary: 'OFFER_INQUIRY',
    secondary: [],
    confidence: 1.0,
  });
  assert.equal(step3.changed, true);
  assert.equal(step3.stateData.activeWorkflow?.id, 'OFFER_DISCOVERY');
  assert.equal(step3.stateData.suspendedWorkflow?.id, 'BOOKING');
  assert.equal(step3.stateData.suspendedWorkflow?.stage, 'AWAITING_SLOT_SELECTION');
  // Crucial: candidateSlots preserved during topic switch
  assert.equal(step3.stateData.candidateSlots?.length, 1);

  // 4. Customer returns to booking: "تمام احجزلي أول موعد"
  const step4 = applyWorkflowIntentTransition(step3.stateData, {
    primary: 'BOOKING_INTENT',
    secondary: [],
    confidence: 1.0,
  });
  assert.equal(step4.changed, true);
  assert.equal(step4.stateData.activeWorkflow?.id, 'BOOKING');
  assert.equal(step4.stateData.activeWorkflow?.stage, 'AWAITING_SLOT_SELECTION');
  assert.equal(step4.stateData.suspendedWorkflow, undefined);
  assert.equal(step4.stateData.candidateSlots?.[0]?.slotToken, 'tok-1');

  // 5. Booking completes
  const step5 = updateWorkingStateDataWithToolResult(
    step4.stateData,
    'createBooking',
    { slotToken: 'tok-1' },
    {
      ok: true,
      data: { bookingId: 'bk-confirmed-10' },
    },
  );
  assert.equal(step5.stateData.activeWorkflow?.stage, 'COMPLETED');
  assert.equal(step5.stateData.lastCompletedWorkflow?.id, 'BOOKING');
  assert.equal(step5.stateData.candidateSlots, undefined);
  assert.equal(step5.stateData.lastConfirmedBookingId, 'bk-confirmed-10');
});

test('MB-10: State invalidation on customer selection change', () => {
  let state: ConversationWorkingStateData = {
    selectedEntity: { entityType: 'SERVICE', entityId: 'svc-1', entityLabel: 'Teeth Cleaning' },
    candidateSlots: [
      {
        entityId: 'svc-1',
        staffMemberId: 'st-1',
        locationId: 'loc-1',
        startsAt: '2026-09-30T10:00:00Z',
        endsAt: '2026-09-30T10:30:00Z',
        localDate: '2026-09-30',
        localStartTime: '10:00',
        slotToken: 'tok-old',
        expiresAt: '2026-09-30T10:15:00Z',
      },
    ],
  };

  // Customer changes to a different service: searchServices returns svc-2
  const updated = updateWorkingStateDataWithToolResult(
    state,
    'searchServices',
    { query: 'تبييض' },
    {
      ok: true,
      data: {
        services: [{ id: 'svc-2', name: 'Teeth Whitening' }],
      },
    },
  );

  assert.equal(updated.changed, true);
  assert.equal(updated.stateData.selectedEntity?.entityId, 'svc-2');
  // Stale candidate slots from svc-1 MUST be invalidated
  assert.equal(updated.stateData.candidateSlots, undefined);
});

test('MB-10: Explicit workflow abandonment clears candidate slots and marks stage ABANDONED', () => {
  let state: ConversationWorkingStateData = {
    activeWorkflow: {
      id: 'BOOKING',
      stage: 'AWAITING_SLOT_SELECTION',
      startedAt: '2026-09-29T10:00:00Z',
      updatedAt: '2026-09-29T10:05:00Z',
    },
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
  };

  // Customer says: "خلاص ما اريد احجز"
  const abandoned = clearPendingWorkflow(state, 'BOOKING');
  assert.equal(abandoned.changed, true);
  assert.equal(abandoned.stateData.activeWorkflow?.stage, 'ABANDONED');
  assert.equal(abandoned.stateData.candidateSlots, undefined);
});
