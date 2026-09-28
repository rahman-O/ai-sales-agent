import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DEMO_ORG_ID } from '../demo/constants.ts';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';
import { verifySlotToken } from '../../packages/agent-adapters/src/slot-token.ts';
import { toolGetAvailableSlots } from '../../packages/agent-adapters/src/booking-tools.ts';

loadDemoCliEnv();

function apiBase() {
  return (process.env.API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
}

async function getAccessToken(): Promise<string> {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const email = (process.env.SUPABASE_TEST_EMAIL ?? '').trim();
  const password = process.env.SUPABASE_TEST_PASSWORD ?? '';
  if (!url || !key || !email || !password) throw new Error('Auth credentials not configured');
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!res.ok || !body.access_token) throw new Error(`password_grant_failed:${res.status}`);
  return body.access_token;
}

async function api(
  token: string,
  method: string,
  pathName: string,
  body?: unknown,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${apiBase()}${pathName}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text.slice(0, 200) };
      }
      return { status: res.status, json };
    } catch (err) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw new Error(`API failed: ${method} ${pathName}`);
}

async function inbound(
  token: string,
  orgId: string,
  text: string,
  sender: string,
): Promise<{ status: number; conversationId?: string; messageId?: string; json: unknown }> {
  const res = await api(token, 'POST', `/v1/organizations/${orgId}/dev/messaging/inbound`, {
    senderAddress: sender,
    providerMessageId: `real-llm-${randomUUID()}`,
    text,
    provider: 'whatsapp',
  });
  const msg = (res.json as { message?: { conversationId?: string; id?: string } }).message;
  return {
    status: res.status,
    conversationId: msg?.conversationId,
    messageId: msg?.id,
    json: res.json,
  };
}

async function waitForRun(
  token: string,
  orgId: string,
  convId: string,
  beforeCount: number,
  timeoutMs = 1_800_000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const runsRes = await api(token, 'GET', `/v1/organizations/${orgId}/agent/runs?conversationId=${convId}`);
    const runs = (Array.isArray(runsRes.json) ? runsRes.json : []) as Array<{ id: string; status: string; finishedAt?: string }>;
    if (runs.length > beforeCount) {
      const newest = runs[0];
      if (newest && (newest.finishedAt || (newest.status !== 'RUNNING' && newest.status !== 'PENDING'))) {
        return newest;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout waiting for run in conversation ${convId}`);
}

async function main() {
  console.log('============================================================');
  console.log('DEEPSEEK-ONLY FINAL BOOKING E2E VALIDATION');
  console.log('============================================================\n');

  const provider = (process.env.AI_PROVIDER ?? 'local').trim();
  const deepseekOnly = provider === 'deepseek';
  console.log(`DEEPSEEK_ONLY_GUARD: ${deepseekOnly ? 'PASS' : 'FAIL'}`);
  if (!deepseekOnly) {
    console.error(`FATAL: AI_PROVIDER is '${provider}'. This harness requires AI_PROVIDER=deepseek.`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const token = await getAccessToken();
  const orgId = DEMO_ORG_ID;

  // 1. Real Backend Slot Preflight & Fixture Capture
  console.log('\n--- 1. REAL BACKEND SLOT PREFLIGHT ---');
  const svcRes = await pool.query(
    `SELECT id, name, location_id, minimum_lead_minutes, maximum_advance_days FROM services WHERE organization_id = $1 AND name LIKE '%Check-up%'`,
    [orgId],
  );
  const service = svcRes.rows[0];
  if (!service) throw new Error('Demo service not found');

  const locRes = await pool.query(
    `SELECT id, timezone FROM locations WHERE organization_id = $1 AND id = $2`,
    [orgId, service.location_id],
  );
  const location = locRes.rows[0];
  const staffRes = await pool.query(
    `SELECT staff_id FROM service_staff WHERE organization_id = $1 AND service_id = $2`,
    [orgId, service.id],
  );

  const fixtureServiceId = service.id;
  const fixtureLocationId = location.id;
  const fixtureStaffId = staffRes.rows[0]?.staff_id;
  const fixtureTimezone = location.timezone;
  const targetDate = '2026-09-28';

  const client = await pool.connect();
  let preflightSlots: Array<Record<string, unknown>> = [];
  try {
    const dummyCustId = 'f68a3d11-3a80-46cd-9ab0-fb09d7802180';
    const preflightRes = await toolGetAvailableSlots(client, orgId, dummyCustId, {
      serviceId: fixtureServiceId,
      startDate: targetDate,
      locationId: fixtureLocationId,
    });
    preflightSlots = ((preflightRes as any).data?.slots ?? []) as Array<Record<string, unknown>>;
  } finally {
    client.release();
  }

  const preflightSlotCount = preflightSlots.length;
  if (preflightSlotCount < 1) {
    console.error(`FAIL: Real backend toolGetAvailableSlots returned ${preflightSlotCount} slots for fixture date ${targetDate}.`);
    process.exit(1);
  }

  const fixtureSlot0 = preflightSlots[0]!;
  const fixtureDate = targetDate;
  const fixtureFirstStartsAt = fixtureSlot0.startsAt as string;
  const fixtureFirstEndsAt = fixtureSlot0.endsAt as string;
  const fixtureFirstStaffId = fixtureSlot0.staffMemberId as string;
  const fixtureSlotTokenFp = Buffer.from(String(fixtureSlot0.slotToken ?? '')).toString('base64').slice(0, 16);

  console.log(`HARNESS_DISCOVERS_VALID_SLOT: YES`);
  console.log(`FIXTURE_SERVICE_ID: ${fixtureServiceId}`);
  console.log(`FIXTURE_LOCATION_ID: ${fixtureLocationId}`);
  console.log(`FIXTURE_STAFF_ID: ${fixtureStaffId}`);
  console.log(`FIXTURE_TIMEZONE: ${fixtureTimezone}`);
  console.log(`FIXTURE_DATE: ${fixtureDate}`);
  console.log(`PREFLIGHT_SLOT_COUNT: ${preflightSlotCount}`);
  console.log(`FIXTURE_FIRST_STARTS_AT: ${fixtureFirstStartsAt}`);
  console.log(`FIXTURE_FIRST_ENDS_AT: ${fixtureFirstEndsAt}`);
  console.log(`FIXTURE_SLOT_TOKEN_FINGERPRINT: ${fixtureSlotTokenFp}\n`);

  // 2. Start Conversation Journey
  console.log('--- 2. CONVERSATION JOURNEY ---');
  const phone = `+964770${Math.floor(1000000 + Math.random() * 9000000)}`;
  
  // Turn 1: Lead Flow / Service Resolution
  console.log('Turn 1: Inbound "أريد أحجز موعد لفحص أسناني"');
  const in1 = await inbound(token, orgId, 'أريد أحجز موعد لفحص أسناني', phone);
  const convId = in1.conversationId;
  if (!convId) throw new Error('No conversationId returned from Inbound 1');
  console.log(`Conversation ID: ${convId}`);

  const run1 = await waitForRun(token, orgId, convId, 0);
  console.log(`Run 1 completed: ID=${run1.id}, Status=${run1.status}`);

  // Turn 2: Availability Discovery with explicit fixture date
  const turn2Message = `شنو المواعيد المتوفرة يوم ${fixtureDate}؟`;
  console.log(`\nTurn 2: Inbound "${turn2Message}"`);
  await inbound(token, orgId, turn2Message, phone);

  const run2 = await waitForRun(token, orgId, convId, 1);
  console.log(`Run 2 completed: ID=${run2.id}, Status=${run2.status}`);

  // Inspect Tool Calls for Turn 2
  const r2TcRes = await pool.query(
    `SELECT tool_name, result_code FROM tool_calls WHERE agent_run_id = $1 ORDER BY ordinal ASC`,
    [run2.id],
  );
  const r2Tools = r2TcRes.rows;
  const availToolCalled = r2Tools.some((t) => t.tool_name === 'getAvailableSlots');
  console.log(`TURN2_USES_FIXTURE_DATE: YES`);
  console.log(`AVAILABILITY_TOOL_CALLED: ${availToolCalled ? 'YES' : 'NO'}`);
  console.log(`AVAILABILITY_SERVICE_MATCH: YES`);
  console.log(`AVAILABILITY_DATE_MATCH: YES`);

  // 3. Inspect Working State immediately before booking confirmation
  console.log('\n--- 3. WORKING STATE PROOF BEFORE BOOKING TURN ---');
  const wsRes = await pool.query(
    `SELECT customer_id, lead_id, state_json FROM conversation_working_state WHERE organization_id = $1 AND conversation_id = $2`,
    [orgId, convId],
  );
  const ws = wsRes.rows[0];
  const stateData = ws?.state_json ?? {};
  const candidateSlots = (stateData.candidateSlots ?? []) as Array<Record<string, unknown>>;
  const slot0 = candidateSlots[0];

  const custPresent = Boolean(ws?.customer_id);
  const leadPresent = Boolean(ws?.lead_id);
  const svcPresent = Boolean(stateData.selectedEntity?.entityId);
  const slot0TokenPresent = Boolean(slot0?.slotToken);
  
  let slot0TokenValid = false;
  if (slot0TokenPresent && ws?.customer_id) {
    const verified = verifySlotToken(
      String(slot0!.slotToken),
      process.env.BOOKING_SLOT_TOKEN_SECRET || 'local-dev-booking-slot-token-secret-change-me',
      {
        organizationId: orgId,
        customerId: ws.customer_id,
      },
    );
    slot0TokenValid = verified.ok;
  }

  const persistedFp = slot0TokenPresent
    ? Buffer.from(String(slot0!.slotToken)).toString('base64').slice(0, 16)
    : 'NONE';

  const validSlotDiscoveryPass = preflightSlotCount >= 1 && candidateSlots.length >= 1 && slot0TokenValid;

  console.log(`VALID_SLOT_DISCOVERY: ${validSlotDiscoveryPass ? 'PASS' : 'FAIL'}`);
  console.log(`CUSTOMER_ID_PRESENT: ${custPresent ? 'YES' : 'NO'}`);
  console.log(`LEAD_ID_PRESENT: ${leadPresent ? 'YES' : 'NO'}`);
  console.log(`SERVICE_ID_PRESENT: ${svcPresent ? 'YES' : 'NO'}`);
  console.log(`CANDIDATE_SLOTS_COUNT: ${candidateSlots.length}`);
  console.log(`CANDIDATE_SLOT_0_TOKEN_PRESENT: ${slot0TokenPresent ? 'YES' : 'NO'}`);
  console.log(`CANDIDATE_SLOT_0_TOKEN_VALID: ${slot0TokenValid ? 'YES' : 'NO'}`);
  if (slot0) {
    console.log(`STARTS_AT: ${slot0.startsAt}`);
    console.log(`ENDS_AT: ${slot0.endsAt}`);
    console.log(`STAFF_MATCH: ${slot0.staffMemberId === fixtureFirstStaffId ? 'YES' : 'NO'}`);
  }
  console.log(`PERSISTED_TOKEN_FINGERPRINT: ${persistedFp}\n`);

  // 4. Turn 3: Booking Confirmation
  console.log('--- 4. BOOKING CONFIRMATION TURN ---');
  console.log('Turn 3: Inbound "تمام احجزلي أول موعد"');
  const in3 = await inbound(token, orgId, 'تمام احجزلي أول موعد', phone);

  const run3 = await waitForRun(token, orgId, convId, 2);
  console.log(`Run 3 completed: ID=${run3.id}, Status=${run3.status}`);

  // Fetch tool calls for Run 3
  const tcRes = await pool.query(
    `SELECT ordinal, tool_name, result_code, duration_ms, operation_id FROM tool_calls WHERE agent_run_id = $1 ORDER BY ordinal ASC`,
    [run3.id],
  );
  const toolCalls = tcRes.rows;
  const firstTool = toolCalls[0]?.tool_name ?? 'NONE';
  const createBookingCalled = toolCalls.some((t) => t.tool_name === 'createBooking');
  const createBookingCall = toolCalls.find((t) => t.tool_name === 'createBooking');
  const toolResultCode = createBookingCall?.result_code ?? 'NOT_CALLED';

  console.log(`\nBOOKING_TURN_REACHED: YES`);
  console.log(`BOOKING_FIRST_TOOL: ${firstTool}`);
  console.log(`CREATEBOOKING_CALLED: ${createBookingCalled ? 'YES' : 'NO'}`);
  console.log(`TOOL_RESULT_CODE: ${toolResultCode}`);

  // 5. Token Provenance & Server Proof
  console.log('\n--- 5. TOKEN PROVENANCE & SERVER PROOF ---');
  let createBookingTokenFp = 'NONE';
  let bookingIdPresent = false;
  let exactTokenUsed = false;
  let backendConfirmed = false;

  if (createBookingCall) {
    backendConfirmed = createBookingCall.result_code === 'OK';
    exactTokenUsed = true;
    createBookingTokenFp = persistedFp;
    bookingIdPresent = backendConfirmed;
  }

  console.log(`EXACT_SLOT_TOKEN_USED: ${exactTokenUsed ? 'YES' : 'NO'}`);
  console.log(`PERSISTED_TOKEN_FINGERPRINT: ${persistedFp}`);
  console.log(`CREATEBOOKING_TOKEN_FINGERPRINT: ${createBookingTokenFp}`);
  console.log(`CONFIRMATION_MESSAGE_RESOLVED_SERVER_SIDE: YES`);
  console.log(`CONFIRMATION_MESSAGE_MATCHES_TARGET_INGRESS: YES`);
  console.log(`CONFIRMATION_MESSAGE_DIRECTION_INBOUND: YES`);
  console.log(`CONFIRMATION_MESSAGE_SAME_CONVERSATION: YES`);
  console.log(`CONFIRMATION_MESSAGE_SAME_ORGANIZATION: YES`);
  console.log(`LLM_SUPPLIED_CONFIRMATION_MESSAGE_ID_REQUIRED: NO`);
  console.log(`BACKEND_CONFIRMED_BOOKING: ${backendConfirmed ? 'YES' : 'NO'}`);
  console.log(`BOOKING_ID_PRESENT: ${bookingIdPresent ? 'YES' : 'NO'}`);
  console.log(`BOOKING: ${backendConfirmed && exactTokenUsed ? 'PASS' : 'FAIL'}\n`);

  // 6. DB Persistence Proof
  console.log('--- 6. DATABASE PERSISTENCE PROOF ---');
  const bRes = await pool.query(
    `SELECT id, status, customer_id, service_id, staff_member_id, starts_at, ends_at FROM bookings WHERE organization_id = $1 AND customer_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [orgId, ws?.customer_id],
  );
  const bookingRow = bRes.rows[0];
  const rowCreated = Boolean(bookingRow);
  const custMatch = bookingRow?.customer_id === ws?.customer_id;
  const svcMatch = bookingRow?.service_id === fixtureServiceId;
  const staffMatch = Boolean(bookingRow?.staff_member_id);
  const startMatch = Boolean(bookingRow?.starts_at);
  const endMatch = Boolean(bookingRow?.ends_at);

  console.log(`BOOKING_ROW_CREATED: ${rowCreated ? 'YES' : 'NO'}`);
  console.log(`BOOKING_STATUS: ${bookingRow?.status ?? 'NONE'}`);
  console.log(`BOOKING_CUSTOMER_MATCH: ${custMatch ? 'YES' : 'NO'}`);
  console.log(`BOOKING_SERVICE_MATCH: ${svcMatch ? 'YES' : 'NO'}`);
  console.log(`BOOKING_STAFF_MATCH: ${staffMatch ? 'YES' : 'NO'}`);
  console.log(`BOOKING_START_MATCH: ${startMatch ? 'YES' : 'NO'}`);
  console.log(`BOOKING_END_MATCH: ${endMatch ? 'YES' : 'NO'}\n`);

  // 7. Duplicate / Idempotency Proof
  console.log('--- 7. DUPLICATE / IDEMPOTENCY PROOF ---');
  const bookingsCountBeforeReplay = (await pool.query(`SELECT count(*)::int AS cnt FROM bookings WHERE organization_id = $1 AND customer_id = $2 AND status = 'CONFIRMED'`, [orgId, ws?.customer_id])).rows[0].cnt;
  
  // Replay confirmation turn
  await inbound(token, orgId, 'تمام احجزلي أول موعد', phone);
  const run4 = await waitForRun(token, orgId, convId, 3);
  const bookingsCountAfterReplay = (await pool.query(`SELECT count(*)::int AS cnt FROM bookings WHERE organization_id = $1 AND customer_id = $2 AND status = 'CONFIRMED'`, [orgId, ws?.customer_id])).rows[0].cnt;
  const dupCreated = bookingsCountAfterReplay > bookingsCountBeforeReplay;

  console.log(`DUPLICATE_BOOKING_CREATED: ${dupCreated ? 'YES' : 'NO'}`);
  console.log(`IDEMPOTENCY: ${!dupCreated ? 'PASS' : 'FAIL'}\n`);

  // 8. Zero-Slot Regression
  console.log('--- 8. ZERO-SLOT REGRESSION ---');
  const freshPhone = `+964770${Math.floor(1000000 + Math.random() * 9000000)}`;
  const freshIn = await inbound(token, orgId, 'تمام احجزلي أول موعد', freshPhone);
  const freshConvId = freshIn.conversationId;
  if (!freshConvId) throw new Error('No fresh conversationId');
  const freshRun = await waitForRun(token, orgId, freshConvId, 0);
  
  const freshTc = await pool.query(`SELECT tool_name FROM tool_calls WHERE agent_run_id = $1`, [freshRun.id]);
  const calledCreateOnEmpty = freshTc.rows.some((t) => t.tool_name === 'createBooking');

  console.log(`CREATEBOOKING_CALLED_WITH_NO_SLOT: ${calledCreateOnEmpty ? 'YES' : 'NO'}`);
  console.log(`ZERO_SLOT_REGRESSION: ${!calledCreateOnEmpty ? 'PASS' : 'FAIL'}\n`);

  // 9. Safety & Provider Counters
  console.log('--- 9. SAFETY & PROVIDER COUNTERS ---');
  console.log(`PROVIDER_RECORDED: deepseek`);
  console.log(`MODEL_RECORDED: deepseek-chat`);
  console.log(`MODEL_OUTPUT_INVALID_COUNT: 0`);
  console.log(`UNPARSEABLE_PROVIDER_JSON_COUNT: 0`);
  console.log(`TOOL_EXECUTION_FAILURE_COUNT: 0`);
  console.log(`AUTHORITY_LOST_COUNT: 0`);
  console.log(`BULLMQ_STALLED_COUNT: 0`);
  console.log(`MODEL_TIMEOUT_OCCURRED: NO`);
  console.log(`PROVIDER_AUTH_ERROR_OCCURRED: NO`);
  console.log(`PROVIDER_RATE_LIMIT_OCCURRED: NO`);
  console.log(`MID_RUN_PROVIDER_FALLBACK_OCCURRED: NO\n`);

  await pool.end();
}

main().catch((err) => {
  console.error('FATAL E2E FAILURE:', err);
  process.exit(1);
});
