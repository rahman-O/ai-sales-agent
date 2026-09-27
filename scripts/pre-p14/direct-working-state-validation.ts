import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  loadWorkingState,
  upsertWorkingStateCAS,
  applySelectiveToolWriteBack,
  clearWorkingState,
} from '../../packages/agent-adapters/src/conversation-working-state.js';
import type { ConversationWorkingStateData } from '@ai-sales-agent/agent-core';

const DATABASE_URL =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:demo-local-postgres-pass@127.0.0.1:5433/ai_sales_agent';

async function runDirectValidation() {
  console.log('--- DIRECT WORKING STATE VALIDATION START ---');
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    const orgRes = await client.query(`SELECT id FROM organizations LIMIT 1`);
    const organizationId = orgRes.rows[0]?.id;
    assert.ok(organizationId, 'Must have at least one organization in DB');

    const convRes = await client.query(
      `SELECT id, customer_id FROM conversations WHERE organization_id = $1 LIMIT 1`,
      [organizationId],
    );
    const conversationId = convRes.rows[0]?.id;
    const customerId = convRes.rows[0]?.customer_id;
    assert.ok(conversationId, 'Must have at least one conversation in DB');

    console.log(`Testing with org=${organizationId}, conv=${conversationId}`);

    const runRes = await client.query(
      `SELECT id FROM agent_runs WHERE organization_id = $1 LIMIT 2`,
      [organizationId],
    );
    const runId1 = runRes.rows[0]?.id ?? null;
    const runId2 = runRes.rows[1]?.id ?? runId1;

    // Clean initial state
    await clearWorkingState(client, organizationId, conversationId);

    // 1. searchServices write-back
    console.log('1. Testing searchServices selective write-back...');
    const svcRes = await client.query(
      `SELECT id, name FROM services WHERE organization_id = $1 LIMIT 1`,
      [organizationId],
    );
    const service = svcRes.rows[0];
    assert.ok(service, 'Must have at least one service');

    await applySelectiveToolWriteBack(client, {
      organizationId,
      conversationId,
      agentRunId: runId1,
      toolName: 'searchServices',
      toolArgs: { query: service.name },
      toolResult: {
        ok: true,
        data: { services: [{ id: service.id, name: service.name }] },
      },
    });

    let state = await loadWorkingState(client, organizationId, conversationId);
    assert.ok(state, 'Working state must exist after searchServices');
    assert.equal(state.stateData.selectedEntity?.entityId, service.id);
    assert.equal(state.stateData.selectedEntity?.entityLabel, service.name);
    console.log('   PASS: selectedEntity persisted cleanly.');

    // 2. ensureLead write-back
    console.log('2. Testing ensureLead selective write-back...');
    const leadRes = await client.query(
      `SELECT id FROM leads WHERE organization_id = $1 LIMIT 1`,
      [organizationId],
    );
    const leadId = leadRes.rows[0]?.id || '11111111-1111-1111-1111-111111111111';

    await applySelectiveToolWriteBack(client, {
      organizationId,
      conversationId,
      agentRunId: runId1,
      toolName: 'ensureLead',
      toolArgs: { serviceId: service.id },
      toolResult: {
        ok: true,
        data: { leadId, customerId },
      },
    });

    state = await loadWorkingState(client, organizationId, conversationId);
    assert.ok(state);
    assert.equal(state.leadId, leadId);
    assert.equal(state.customerId, customerId);
    console.log('   PASS: leadId and customerId persisted cleanly.');

    // 3. getAvailableSlots write-back
    console.log('3. Testing getAvailableSlots candidate slots persistence...');
    const futureExpiry = new Date(Date.now() + 600_000).toISOString();
    const exactSlotToken = `v1.eyJleHAiOiIke2Z1dHVyZUV4cGlyeX0ifQ.test_fingerprint_token_12345`;

    await applySelectiveToolWriteBack(client, {
      organizationId,
      conversationId,
      agentRunId: runId1,
      toolName: 'getAvailableSlots',
      toolArgs: { serviceId: service.id },
      toolResult: {
        ok: true,
        data: {
          slots: [
            {
              staffMemberId: 'staff-1',
              locationId: 'loc-1',
              startsAt: '2026-09-27T10:00:00Z',
              endsAt: '2026-09-27T10:30:00Z',
              localDate: '2026-09-27',
              localStartTime: '10:00',
              slotToken: exactSlotToken,
              expiresAt: futureExpiry,
            },
          ],
        },
      },
    });

    state = await loadWorkingState(client, organizationId, conversationId);
    assert.ok(state);
    assert.equal(state.stateData.candidateSlots?.length, 1);
    assert.equal(state.stateData.candidateSlots?.[0]?.slotToken, exactSlotToken);
    console.log('   PASS: exact slotToken persisted across turns.');

    // 4. Simulate next AgentRun snapshot load
    console.log('4. Testing next AgentRun snapshot loading...');
    const nextRunState = await loadWorkingState(client, organizationId, conversationId);
    assert.ok(nextRunState);
    assert.equal(nextRunState.stateData.candidateSlots?.[0]?.slotToken, exactSlotToken);
    console.log('   PASS: exact slotToken loaded in next turn snapshot.');

    // 5. Simulate expired token pruning
    console.log('5. Testing expired slot token logical pruning...');
    const simulatedFutureTime = new Date(Date.now() + 1200_000); // 20 mins in future
    const prunedState = await loadWorkingState(
      client,
      organizationId,
      conversationId,
      simulatedFutureTime,
    );
    assert.ok(prunedState);
    assert.equal(prunedState.stateData.candidateSlots?.length, 0);
    console.log('   PASS: expired candidate slots pruned automatically.');

    // 6. Simulate successful createBooking
    console.log('6. Testing createBooking success candidate slots clearing...');
    await applySelectiveToolWriteBack(client, {
      organizationId,
      conversationId,
      agentRunId: runId2,
      toolName: 'createBooking',
      toolArgs: { slotToken: exactSlotToken },
      toolResult: {
        ok: true,
        data: { bookingId: 'booking-direct-1', status: 'CONFIRMED' },
      },
    });

    state = await loadWorkingState(client, organizationId, conversationId);
    assert.ok(state);
    assert.equal(state.stateData.candidateSlots, undefined);
    assert.equal(state.stateData.lastConfirmedBookingId, 'booking-direct-1');
    console.log('   PASS: candidateSlots cleared on booking success.');

    // 7. Test RLS / Tenant Isolation
    console.log('7. Testing RLS tenant isolation...');
    const otherOrgId = '99999999-9999-9999-9999-999999999999';
    await client.query(`BEGIN`);
    await client.query(`SET LOCAL ROLE app_runtime`);
    await client.query(`SET LOCAL "app.current_tenant_id" = '${otherOrgId}'`);

    const rlsRead = await client.query(
      `SELECT * FROM conversation_working_state WHERE conversation_id = $1`,
      [conversationId],
    );
    assert.equal(rlsRead.rows.length, 0, 'Other tenant cannot read working state');
    await client.query(`ROLLBACK`);
    console.log('   PASS: RLS prevents cross-tenant read.');

    console.log('--- DIRECT WORKING STATE VALIDATION COMPLETED SUCCESSFULLY ---');
  } finally {
    client.release();
    await pool.end();
  }
}

runDirectValidation().catch((err) => {
  console.error('Direct validation error:', err);
  process.exit(1);
});
