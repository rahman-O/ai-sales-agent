import type { PoolClient } from 'pg';
import {
  type ConversationWorkingStateData,
  type CandidateSlotData,
  findWorkflowForIntent,
} from '@ai-sales-agent/agent-core';
import type {
  AgentIntent,
  IntentClassification,
  WorkflowId,
  WorkflowStage,
} from '@ai-sales-agent/contracts';

export interface WorkingStateRecord {
  organizationId: string;
  conversationId: string;
  version: number;
  customerId: string | null;
  leadId: string | null;
  stateData: ConversationWorkingStateData;
  updatedAt: string;
  lastAgentRunId: string | null;
  lastToolCallId: string | null;
}

/**
 * Extracts expiration timestamp from slotToken payload if available.
 */
export function extractSlotTokenExpiry(token: string): string | null {
  try {
    const parts = token.split('.');
    for (const part of parts) {
      if (!part) continue;
      try {
        const payloadStr = Buffer.from(part, 'base64url').toString('utf8');
        const payload = JSON.parse(payloadStr);
        if (payload && typeof payload === 'object') {
          if (payload.exp && typeof payload.exp === 'string') {
            return payload.exp;
          }
          if (payload.expiresAt && typeof payload.expiresAt === 'string') {
            return payload.expiresAt;
          }
        }
      } catch {
        // try next part
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Pure state transition helper applying detected/proposed customer intent to working state data,
 * handling safe topic switching (suspend/resume) and workflow lifecycle transitions.
 */
export function applyWorkflowIntentTransition(
  inputState: ConversationWorkingStateData,
  intent: IntentClassification,
  now = new Date(),
): { stateData: ConversationWorkingStateData; changed: boolean } {
  const stateData: ConversationWorkingStateData = { ...inputState };
  const nowIso = now.toISOString();
  let changed = false;

  // 1. Update active intent
  stateData.activeIntent = {
    type: intent.primary,
    secondary: intent.secondary,
    confidence: intent.confidence,
    updatedAt: nowIso,
  };
  changed = true;

  const candidateWorkflow = findWorkflowForIntent(intent.primary);
  const candidateId = candidateWorkflow?.id;

  if (!candidateId) {
    return { stateData, changed };
  }

  const currentWorkflow = stateData.activeWorkflow;

  // 2. Handle same workflow continuation
  if (currentWorkflow && currentWorkflow.id === candidateId) {
    stateData.activeWorkflow = {
      ...currentWorkflow,
      updatedAt: nowIso,
    };
    return { stateData, changed };
  }

  // 3. Handle read-only interruption of transactional workflow (e.g. BOOKING)
  const isReadOnlyIntent = [
    'OFFER_INQUIRY',
    'POLICY_INQUIRY',
    'KNOWLEDGE_INQUIRY',
    'PRICE_INQUIRY',
    'CATALOG_INQUIRY',
    'GENERAL_INQUIRY',
  ].includes(intent.primary);

  if (currentWorkflow && ['BOOKING', 'LEAD_CAPTURE'].includes(currentWorkflow.id) && isReadOnlyIntent) {
    // Suspend active workflow
    stateData.suspendedWorkflow = {
      id: currentWorkflow.id,
      stage: currentWorkflow.stage,
      suspendedAt: nowIso,
    };
    stateData.activeWorkflow = {
      id: candidateId,
      stage: 'IN_PROGRESS',
      startedAt: nowIso,
      updatedAt: nowIso,
    };
    return { stateData, changed };
  }

  // 4. Handle resumption from suspended workflow
  if (stateData.suspendedWorkflow && stateData.suspendedWorkflow.id === candidateId) {
    stateData.activeWorkflow = {
      id: stateData.suspendedWorkflow.id,
      stage: stateData.suspendedWorkflow.stage,
      startedAt: nowIso,
      updatedAt: nowIso,
    };
    delete stateData.suspendedWorkflow;
    return { stateData, changed };
  }

  // 5. New active workflow
  stateData.activeWorkflow = {
    id: candidateId,
    stage: 'INITIAL',
    startedAt: nowIso,
    updatedAt: nowIso,
  };

  return { stateData, changed };
}

/**
 * Pure state helper to explicitly abandon or clear an active workflow and invalidate pending candidate slots.
 */
export function clearPendingWorkflow(
  inputState: ConversationWorkingStateData,
  workflowId: WorkflowId = 'BOOKING',
  now = new Date(),
): { stateData: ConversationWorkingStateData; changed: boolean } {
  const stateData: ConversationWorkingStateData = { ...inputState };
  let changed = false;

  if (stateData.activeWorkflow?.id === workflowId) {
    stateData.activeWorkflow = {
      id: workflowId,
      stage: 'ABANDONED',
      startedAt: stateData.activeWorkflow.startedAt,
      updatedAt: now.toISOString(),
    };
    changed = true;
  }

  if (stateData.suspendedWorkflow?.id === workflowId) {
    delete stateData.suspendedWorkflow;
    changed = true;
  }

  if (stateData.candidateSlots && stateData.candidateSlots.length > 0) {
    delete stateData.candidateSlots;
    delete stateData.selectedCandidateIndex;
    changed = true;
  }

  return { stateData, changed };
}

/**
 * Loads working state for a conversation and logically prunes expired candidate slots.
 */
export async function loadWorkingState(
  c: PoolClient,
  orgOrInput: string | { organizationId: string; conversationId: string },
  convId?: string,
  now = new Date(),
): Promise<WorkingStateRecord | null> {
  const organizationId = typeof orgOrInput === 'string' ? orgOrInput : orgOrInput.organizationId;
  const conversationId = typeof orgOrInput === 'string' ? convId! : orgOrInput.conversationId;

  const res = await c.query<{
    organization_id: string;
    conversation_id: string;
    version: number;
    customer_id: string | null;
    lead_id: string | null;
    state_json: ConversationWorkingStateData;
    updated_at: Date;
    last_agent_run_id: string | null;
    last_tool_call_id: string | null;
  }>(
    `SELECT organization_id, conversation_id, version, customer_id, lead_id, state_json, updated_at, last_agent_run_id, last_tool_call_id
     FROM conversation_working_state
     WHERE organization_id = $1 AND conversation_id = $2`,
    [organizationId, conversationId],
  );

  const row = res.rows[0];
  if (!row) return null;

  const stateData: ConversationWorkingStateData = row.state_json || {};
  const currentTime = now.getTime();

  // Prune expired candidate slots
  if (Array.isArray(stateData.candidateSlots) && stateData.candidateSlots.length > 0) {
    stateData.candidateSlots = stateData.candidateSlots.filter((slot) => {
      const expTime = new Date(slot.expiresAt).getTime();
      return !Number.isNaN(expTime) && expTime > currentTime;
    });
  }

  return {
    organizationId: row.organization_id,
    conversationId: row.conversation_id,
    version: row.version,
    customerId: row.customer_id,
    leadId: row.lead_id,
    stateData,
    updatedAt: row.updated_at.toISOString(),
    lastAgentRunId: row.last_agent_run_id,
    lastToolCallId: row.last_tool_call_id,
  };
}

/**
 * Upserts working state with optimistic concurrency check (version CAS) and optional authority validation.
 */
export async function upsertWorkingStateCAS(
  c: PoolClient,
  input: {
    organizationId: string;
    conversationId: string;
    expectedVersion?: number;
    customerId?: string | null;
    leadId?: string | null;
    stateData: ConversationWorkingStateData;
    agentRunId?: string | null;
    toolCallId?: string | null;
    leaseFence?: number;
    ownershipEpoch?: number;
  },
): Promise<{ ok: true; version: number } | { ok: false; reason: 'VERSION_MISMATCH' | 'AUTHORITY_LOST' }> {
  const {
    organizationId,
    conversationId,
    expectedVersion,
    customerId,
    leadId,
    stateData,
    agentRunId,
    toolCallId,
    leaseFence,
    ownershipEpoch,
  } = input;

  if (leaseFence !== undefined || ownershipEpoch !== undefined) {
    const auth = await c.query<{
      mode: string;
      ownership_epoch: number;
      lease_fence: number;
    }>(
      `SELECT mode, ownership_epoch, lease_fence
       FROM conversations WHERE organization_id = $1 AND id = $2`,
      [organizationId, conversationId],
    );
    const row = auth.rows[0];
    if (!row) return { ok: false, reason: 'AUTHORITY_LOST' };
    if (row.mode !== 'AI_ACTIVE') return { ok: false, reason: 'AUTHORITY_LOST' };
    if (ownershipEpoch !== undefined && row.ownership_epoch !== ownershipEpoch) {
      return { ok: false, reason: 'AUTHORITY_LOST' };
    }
    if (leaseFence !== undefined && row.lease_fence !== leaseFence) {
      return { ok: false, reason: 'AUTHORITY_LOST' };
    }
  }

  let validAgentRunId: string | null = null;
  if (agentRunId) {
    try {
      const check = await c.query(
        `SELECT 1 FROM agent_runs WHERE organization_id = $1::uuid AND id = $2::uuid`,
        [organizationId, agentRunId],
      );
      if (check.rows.length > 0) {
        validAgentRunId = agentRunId;
      }
    } catch {
      validAgentRunId = null;
    }
  }

  const stateJson = JSON.stringify(stateData);

  if (expectedVersion != null && expectedVersion > 0) {
    const res = await c.query<{ version: number }>(
      `UPDATE conversation_working_state
       SET version = version + 1,
           customer_id = COALESCE($3, customer_id),
           lead_id = COALESCE($4, lead_id),
           state_json = $5::jsonb,
           updated_at = now(),
           last_agent_run_id = $6,
           last_tool_call_id = $7
       WHERE organization_id = $1 AND conversation_id = $2 AND version = $8
       RETURNING version`,
      [organizationId, conversationId, customerId ?? null, leadId ?? null, stateJson, validAgentRunId, toolCallId ?? null, expectedVersion],
    );

    if (res.rows.length === 0) {
      return { ok: false, reason: 'VERSION_MISMATCH' };
    }
    return { ok: true, version: res.rows[0]!.version };
  }

  // Insert or update on conflict
  const res = await c.query<{ version: number }>(
    `INSERT INTO conversation_working_state (
       organization_id, conversation_id, version, customer_id, lead_id, state_json, updated_at, last_agent_run_id, last_tool_call_id
     ) VALUES ($1, $2, 1, $3, $4, $5::jsonb, now(), $6, $7)
     ON CONFLICT (organization_id, conversation_id) DO UPDATE
     SET version = conversation_working_state.version + 1,
         customer_id = COALESCE(EXCLUDED.customer_id, conversation_working_state.customer_id),
         lead_id = COALESCE(EXCLUDED.lead_id, conversation_working_state.lead_id),
         state_json = EXCLUDED.state_json,
         updated_at = now(),
         last_agent_run_id = EXCLUDED.last_agent_run_id,
         last_tool_call_id = EXCLUDED.last_tool_call_id
     RETURNING version`,
    [organizationId, conversationId, customerId ?? null, leadId ?? null, stateJson, validAgentRunId, toolCallId ?? null],
  );

  return { ok: true, version: res.rows[0]!.version };
}

/**
 * Clears or deletes working state.
 */
export async function clearWorkingState(
  c: PoolClient,
  organizationId: string,
  conversationId: string,
): Promise<void> {
  await c.query(
    `DELETE FROM conversation_working_state WHERE organization_id = $1 AND conversation_id = $2`,
    [organizationId, conversationId],
  );
}

/**
 * Pure state transition helper applying tool results to working state data.
 */
export function updateWorkingStateDataWithToolResult(
  inputState: ConversationWorkingStateData,
  toolName: string,
  toolArgs: Record<string, unknown>,
  toolResult: { ok: boolean; code?: string; data?: unknown },
  now = new Date(),
): {
  stateData: ConversationWorkingStateData;
  leadId?: string | null;
  customerId?: string | null;
  changed: boolean;
} {
  const stateData: ConversationWorkingStateData = { ...inputState };
  const nowIso = now.toISOString();
  let leadId: string | null = null;
  let customerId: string | null = null;
  let changed = false;

  const resultData = (toolResult.data ?? {}) as Record<string, unknown>;

  if (toolName === 'searchServices' && toolResult.ok) {
    const services = Array.isArray(resultData.services)
      ? (resultData.services as Array<{ id: string; name: string }>)
      : [];
    if (services.length === 1 && services[0]) {
      const svc = services[0];
      const prevEntityId = stateData.selectedEntity?.entityId;
      stateData.selectedEntity = {
        entityType: 'SERVICE',
        entityId: svc.id,
        entityLabel: svc.name,
      };
      if (prevEntityId && prevEntityId !== svc.id) {
        delete stateData.candidateSlots;
        delete stateData.selectedCandidateIndex;
      }
      stateData.activeWorkflow = {
        id: 'DISCOVERY',
        stage: 'IN_PROGRESS',
        startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
        updatedAt: nowIso,
      };
      changed = true;
    }
  } else if ((toolName === 'ensureLead' || toolName === 'getLead') && toolResult.ok) {
    if (typeof resultData.leadId === 'string') {
      leadId = resultData.leadId;
      changed = true;
    } else if (typeof resultData.id === 'string' && toolName === 'getLead') {
      leadId = resultData.id;
      changed = true;
    }
    if (typeof resultData.customerId === 'string') {
      customerId = resultData.customerId;
      changed = true;
    }
    stateData.activeWorkflow = {
      id: 'LEAD_CAPTURE',
      stage: 'IN_PROGRESS',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
  } else if (toolName === 'createCustomer' && toolResult.ok) {
    if (typeof resultData.customerId === 'string') {
      customerId = resultData.customerId;
      changed = true;
    }
  } else if (toolName === 'getAvailableSlots' && toolResult.ok) {
    const slots = Array.isArray(resultData.slots)
      ? (resultData.slots as Array<Record<string, unknown>>)
      : [];
    const entityId =
      typeof toolArgs.serviceId === 'string'
        ? toolArgs.serviceId
        : stateData.selectedEntity?.entityId ?? '';

    const candidateSlots: CandidateSlotData[] = slots.slice(0, 3).map((s) => {
      const slotToken = String(s.slotToken ?? '');
      const parsedExp = extractSlotTokenExpiry(slotToken);
      const expiresAt =
        typeof s.expiresAt === 'string'
          ? s.expiresAt
          : parsedExp ?? new Date(now.getTime() + 15 * 60_000).toISOString();

      const localStartsAt = typeof s.localStartsAt === 'string' ? s.localStartsAt : '';
      let localDate = typeof s.localDate === 'string' ? s.localDate : '';
      let localStartTime = typeof s.localStartTime === 'string' ? s.localStartTime : '';
      if (!localDate && localStartsAt) {
        const parts = localStartsAt.split('T');
        localDate = parts[0] ?? '';
        localStartTime = parts[1] ? parts[1].slice(0, 5) : '';
      }
      if (!localDate && typeof s.startsAt === 'string') {
        const parts = s.startsAt.split('T');
        localDate = parts[0] ?? '';
        localStartTime = parts[1] ? parts[1].slice(0, 5) : '';
      }

      return {
        entityId,
        staffMemberId: String(s.staffMemberId ?? ''),
        locationId: String(s.locationId ?? ''),
        startsAt: String(s.startsAt ?? ''),
        endsAt: String(s.endsAt ?? ''),
        localDate,
        localStartTime,
        slotToken,
        expiresAt,
      };
    });

    stateData.candidateSlots = candidateSlots;
    delete stateData.selectedCandidateIndex;
    stateData.activeWorkflow = {
      id: 'BOOKING',
      stage: 'AWAITING_SLOT_SELECTION',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    changed = true;
  } else if (toolName === 'createBooking') {
    if (toolResult.ok) {
      delete stateData.candidateSlots;
      delete stateData.selectedCandidateIndex;
      if (typeof resultData.bookingId === 'string') {
        stateData.lastConfirmedBookingId = resultData.bookingId;
      }
      stateData.activeWorkflow = {
        id: 'BOOKING',
        stage: 'COMPLETED',
        startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
        updatedAt: nowIso,
      };
      stateData.lastCompletedWorkflow = {
        id: 'BOOKING',
        completedAt: nowIso,
      };
      changed = true;
    } else if (toolResult.code === 'CONFLICT' || toolResult.code === 'SLOT_UNAVAILABLE') {
      delete stateData.candidateSlots;
      delete stateData.selectedCandidateIndex;
      changed = true;
    }
  } else if (toolName === 'cancelBooking' && toolResult.ok) {
    stateData.activeWorkflow = {
      id: 'BOOKING_CANCELLATION',
      stage: 'COMPLETED',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    stateData.lastCompletedWorkflow = {
      id: 'BOOKING_CANCELLATION',
      completedAt: nowIso,
    };
    changed = true;
  } else if (toolName === 'rescheduleBooking' && toolResult.ok) {
    delete stateData.candidateSlots;
    stateData.activeWorkflow = {
      id: 'BOOKING_RESCHEDULING',
      stage: 'COMPLETED',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    stateData.lastCompletedWorkflow = {
      id: 'BOOKING_RESCHEDULING',
      completedAt: nowIso,
    };
    changed = true;
  } else if (toolName === 'handoffToHuman' && toolResult.ok) {
    stateData.activeWorkflow = {
      id: 'HUMAN_HANDOFF',
      stage: 'COMPLETED',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    changed = true;
  } else if (toolName === 'createQuote' && toolResult.ok) {
    const quote = (resultData.quote as Record<string, unknown>) ?? resultData;
    if (typeof quote.id === 'string') {
      stateData.draftQuoteId = quote.id;
    }
    stateData.activeWorkflow = {
      id: 'QUOTE',
      stage: 'IN_PROGRESS',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    changed = true;
  } else if (toolName === 'presentQuote' && toolResult.ok) {
    const quote = (resultData.quote as Record<string, unknown>) ?? resultData;
    if (typeof quote.id === 'string') {
      stateData.draftQuoteId = quote.id;
      stateData.pendingTransactionConfirmation = {
        transactionType: 'QUOTE',
        transactionId: quote.id,
        totalAmountMinor: String(quote.totalAmountMinor ?? '0'),
        currency: String(quote.currency ?? 'SAR'),
      };
    }
    stateData.activeWorkflow = {
      id: 'QUOTE',
      stage: 'AWAITING_CONFIRMATION',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    changed = true;
  } else if (toolName === 'acceptQuote' && toolResult.ok) {
    delete stateData.pendingTransactionConfirmation;
    stateData.activeWorkflow = {
      id: 'QUOTE',
      stage: 'COMPLETED',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    stateData.lastCompletedWorkflow = {
      id: 'QUOTE',
      completedAt: nowIso,
    };
    changed = true;
  } else if ((toolName === 'rejectQuote' || toolName === 'cancelQuote') && toolResult.ok) {
    delete stateData.pendingTransactionConfirmation;
    stateData.activeWorkflow = {
      id: 'QUOTE',
      stage: 'CANCELLED',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    changed = true;
  } else if (toolName === 'createOrder' && toolResult.ok) {
    const order = (resultData.order as Record<string, unknown>) ?? resultData;
    if (typeof order.id === 'string') {
      stateData.draftOrderId = order.id;
      stateData.pendingTransactionConfirmation = {
        transactionType: 'ORDER',
        transactionId: order.id,
        totalAmountMinor: String(order.totalAmountMinor ?? '0'),
        currency: String(order.currency ?? 'SAR'),
      };
    }
    stateData.activeWorkflow = {
      id: 'PURCHASE',
      stage: 'AWAITING_CONFIRMATION',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    changed = true;
  } else if (toolName === 'confirmOrder' && toolResult.ok) {
    delete stateData.pendingTransactionConfirmation;
    stateData.activeWorkflow = {
      id: 'PURCHASE',
      stage: 'COMPLETED',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    stateData.lastCompletedWorkflow = {
      id: 'PURCHASE',
      completedAt: nowIso,
    };
    changed = true;
  } else if (toolName === 'cancelOrder' && toolResult.ok) {
    delete stateData.pendingTransactionConfirmation;
    stateData.activeWorkflow = {
      id: 'PURCHASE',
      stage: 'CANCELLED',
      startedAt: stateData.activeWorkflow?.startedAt ?? nowIso,
      updatedAt: nowIso,
    };
    changed = true;
  }

  return { stateData, leadId, customerId, changed };
}

/**
 * Applies selective tool result write-back to the conversation working state.
 */
export async function applySelectiveToolWriteBack(
  c: PoolClient,
  input: {
    organizationId: string;
    conversationId: string;
    customerId?: string | null;
    agentRunId: string;
    toolCallId?: string | null;
    toolName: string;
    toolArgs: Record<string, unknown>;
    toolResult: { ok: boolean; code?: string; data?: unknown };
    leaseFence?: number;
    ownershipEpoch?: number;
  },
): Promise<void> {
  const {
    organizationId,
    conversationId,
    agentRunId,
    toolCallId,
    toolName,
    toolArgs,
    toolResult,
    leaseFence,
    ownershipEpoch,
  } = input;

  const current = await loadWorkingState(c, organizationId, conversationId);
  const currentData: ConversationWorkingStateData = current?.stateData ? { ...current.stateData } : {};

  const res = updateWorkingStateDataWithToolResult(currentData, toolName, toolArgs, toolResult);

  let customerId: string | null = input.customerId ?? current?.customerId ?? null;
  let leadId: string | null = current?.leadId ?? null;

  if (res.leadId) leadId = res.leadId;
  if (!customerId && res.customerId) customerId = res.customerId;

  if (res.changed || (input.customerId && !current?.customerId)) {
    await upsertWorkingStateCAS(c, {
      organizationId,
      conversationId,
      expectedVersion: current?.version,
      customerId,
      leadId,
      stateData: res.stateData,
      agentRunId,
      toolCallId,
      leaseFence,
      ownershipEpoch,
    });
  }
}
