import type { PoolClient } from 'pg';
import type { ConversationWorkingStateData, CandidateSlotData } from '@ai-sales-agent/agent-core';

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
    if (parts.length >= 2 && parts[1]) {
      const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadStr);
      if (payload.exp && typeof payload.exp === 'string') {
        return payload.exp;
      }
      if (payload.expiresAt && typeof payload.expiresAt === 'string') {
        return payload.expiresAt;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
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
      [organizationId, conversationId, customerId ?? null, leadId ?? null, stateJson, agentRunId ?? null, toolCallId ?? null, expectedVersion],
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
    [organizationId, conversationId, customerId ?? null, leadId ?? null, stateJson, agentRunId ?? null, toolCallId ?? null],
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
    toolResult,
    leaseFence,
    ownershipEpoch,
  } = input;

  const current = await loadWorkingState(c, organizationId, conversationId);
  const stateData: ConversationWorkingStateData = current?.stateData ? { ...current.stateData } : {};
  let customerId: string | null = current?.customerId ?? input.customerId ?? null;
  let leadId: string | null = current?.leadId ?? null;
  let shouldUpdate = false;

  const resultData = (toolResult.data ?? {}) as Record<string, unknown>;

  if (toolName === 'searchServices' && toolResult.ok) {
    const services = Array.isArray(resultData.services) ? (resultData.services as Array<{ id: string; name: string }>) : [];
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
      shouldUpdate = true;
    }
  } else if ((toolName === 'ensureLead' || toolName === 'getLead') && toolResult.ok) {
    if (typeof resultData.leadId === 'string') {
      leadId = resultData.leadId;
      shouldUpdate = true;
    } else if (typeof resultData.id === 'string' && toolName === 'getLead') {
      leadId = resultData.id;
      shouldUpdate = true;
    }
    if (typeof resultData.customerId === 'string') {
      customerId = resultData.customerId;
      shouldUpdate = true;
    }
  } else if (toolName === 'createCustomer' && toolResult.ok) {
    if (typeof resultData.customerId === 'string') {
      customerId = resultData.customerId;
      shouldUpdate = true;
    }
  } else if (toolName === 'getAvailableSlots' && toolResult.ok) {
    const slots = Array.isArray(resultData.slots) ? (resultData.slots as Array<Record<string, unknown>>) : [];
    const entityId = typeof input.toolArgs.serviceId === 'string' ? input.toolArgs.serviceId : stateData.selectedEntity?.entityId ?? '';
    
    const candidateSlots: CandidateSlotData[] = slots.slice(0, 3).map((s) => {
      const slotToken = String(s.slotToken ?? '');
      const parsedExp = extractSlotTokenExpiry(slotToken);
      const expiresAt = typeof s.expiresAt === 'string' ? s.expiresAt : (parsedExp ?? new Date(Date.now() + 15 * 60_000).toISOString());
      
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
    shouldUpdate = true;
  } else if (toolName === 'createBooking') {
    if (toolResult.ok) {
      delete stateData.candidateSlots;
      delete stateData.selectedCandidateIndex;
      if (typeof resultData.bookingId === 'string') {
        stateData.lastConfirmedBookingId = resultData.bookingId;
      }
      shouldUpdate = true;
    } else if (toolResult.code === 'CONFLICT' || toolResult.code === 'SLOT_UNAVAILABLE') {
      delete stateData.candidateSlots;
      delete stateData.selectedCandidateIndex;
      shouldUpdate = true;
    }
  }

  if (shouldUpdate) {
    await upsertWorkingStateCAS(c, {
      organizationId,
      conversationId,
      expectedVersion: current?.version,
      customerId,
      leadId,
      stateData,
      agentRunId,
      toolCallId,
      leaseFence,
      ownershipEpoch,
    });
  }
}
