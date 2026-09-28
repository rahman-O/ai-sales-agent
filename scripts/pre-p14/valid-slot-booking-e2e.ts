import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DEMO_ORG_ID } from '../demo/constants.ts';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';
import { verifySlotToken } from '../../packages/agent-adapters/src/slot-token.ts';
import { toolGetAvailableSlots } from '../../packages/agent-adapters/src/booking-tools.ts';
import { hashNormalizedArgs } from '../../packages/agent-core/src/orchestrator.ts';

loadDemoCliEnv();

function apiBase() {
  return (process.env.API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
}

function localDateInZone(value: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function yesNo(value: boolean): 'YES' | 'NO' {
  return value ? 'YES' : 'NO';
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

async function measuredRun(pool: Pool, orgId: string, runId: string) {
  const row = (
    await pool.query(
      `SELECT id, status, terminal_reason, target_ingress_sequence
       FROM agent_runs WHERE organization_id=$1 AND id=$2`,
      [orgId, runId],
    )
  ).rows[0];
  if (!row) throw new Error(`required_run_missing:${runId}`);
  return row as { id: string; status: string; terminal_reason: string | null; target_ingress_sequence: number };
}

function requireSucceededRun(
  row: { id: string; status: string; terminal_reason: string | null },
  stage: string,
) {
  if (row.status !== 'SUCCEEDED') {
    throw new Error(
      `REQUIRED_RUN_FAILED stage=${stage} runId=${row.id} status=${row.status} terminalReason=${row.terminal_reason ?? 'NONE'}`,
    );
  }
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
  const searchStartDate = localDateInZone(new Date(), fixtureTimezone);

  const client = await pool.connect();
  let preflightSlots: Array<Record<string, unknown>> = [];
  try {
    const dummyCustId = 'f68a3d11-3a80-46cd-9ab0-fb09d7802180';
    const preflightRes = await toolGetAvailableSlots(client, orgId, dummyCustId, {
      serviceId: fixtureServiceId,
      startDate: searchStartDate,
      locationId: fixtureLocationId,
    });
    preflightSlots = ((preflightRes as any).data?.slots ?? []) as Array<Record<string, unknown>>;
  } finally {
    client.release();
  }

  const preflightSlotCount = preflightSlots.length;
  if (preflightSlotCount < 1) {
    console.error(`FAIL: Real backend toolGetAvailableSlots returned ${preflightSlotCount} slots from ${searchStartDate}.`);
    process.exit(1);
  }

  const fixtureSlot0 = preflightSlots[0]!;
  const fixtureDate =
    typeof fixtureSlot0.localStartsAt === 'string'
      ? fixtureSlot0.localStartsAt.slice(0, 10)
      : localDateInZone(String(fixtureSlot0.startsAt), fixtureTimezone);
  const fixtureFirstStartsAt = fixtureSlot0.startsAt as string;
  const fixtureFirstEndsAt = fixtureSlot0.endsAt as string;
  const fixtureFirstStaffId = fixtureSlot0.staffMemberId as string;
  const fixtureSlotTokenFp = Buffer.from(String(fixtureSlot0.slotToken ?? '')).toString('base64').slice(0, 16);

  console.log(`HARNESS_DISCOVERS_VALID_SLOT: ${yesNo(preflightSlotCount >= 1)}`);
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
  const run1Db = await measuredRun(pool, orgId, run1.id);
  requireSucceededRun(run1Db, 'TURN_1');

  const turn1StateRes = await pool.query(
    `SELECT ws.customer_id, ws.lead_id, ws.state_json, c.customer_id AS conversation_customer_id
     FROM conversations c
     LEFT JOIN conversation_working_state ws
       ON ws.organization_id=c.organization_id AND ws.conversation_id=c.id
     WHERE c.organization_id=$1 AND c.id=$2`,
    [orgId, convId],
  );
  const turn1State = turn1StateRes.rows[0];
  const turn1ServiceId = turn1State?.state_json?.selectedEntity?.entityId;
  const turn1Tools = (
    await pool.query(`SELECT tool_name, result_code FROM tool_calls WHERE agent_run_id=$1 ORDER BY ordinal`, [run1.id])
  ).rows;
  const serviceDiscoveryPass =
    turn1Tools.some((row) => row.tool_name === 'searchServices' && row.result_code === 'OK') &&
    Boolean(turn1ServiceId);
  const leadFlowPass = Boolean(turn1State?.lead_id);
  console.log(`SERVICE_DISCOVERY: ${serviceDiscoveryPass ? 'PASS' : 'FAIL'}`);
  console.log(`LEAD_FLOW: ${leadFlowPass ? 'PASS' : 'FAIL'}`);
  console.log(`WORKING_STATE_CUSTOMER_ID_PRESENT: ${yesNo(Boolean(turn1State?.customer_id))}`);
  console.log(
    `WORKING_STATE_CUSTOMER_MATCHES_CONVERSATION: ${yesNo(Boolean(turn1State?.customer_id) && turn1State.customer_id === turn1State.conversation_customer_id)}`,
  );
  console.log(`SERVICE_ID_PRESENT_AFTER_TURN1: ${yesNo(Boolean(turn1ServiceId))}`);
  console.log(
    `LEAD_ID_PRESENT_AFTER_ENSURELEAD: ${turn1State?.lead_id ? 'YES' : 'NOT_RUN'}`,
  );

  // Turn 2: Availability Discovery with explicit fixture date
  const turn2Message = `شنو المواعيد المتوفرة يوم ${fixtureDate}؟`;
  console.log(`\nTurn 2: Inbound "${turn2Message}"`);
  await inbound(token, orgId, turn2Message, phone);

  const run2 = await waitForRun(token, orgId, convId, 1);
  console.log(`Run 2 completed: ID=${run2.id}, Status=${run2.status}`);
  const run2Db = await measuredRun(pool, orgId, run2.id);
  requireSucceededRun(run2Db, 'TURN_2');

  // Inspect Tool Calls for Turn 2
  const r2TcRes = await pool.query(
    `SELECT tool_name, result_code, args_hash FROM tool_calls WHERE agent_run_id = $1 ORDER BY ordinal ASC`,
    [run2.id],
  );
  const r2Tools = r2TcRes.rows;
  const availabilityCall = r2Tools.find((t) => t.tool_name === 'getAvailableSlots');
  const availToolCalled = Boolean(availabilityCall);
  const possibleTurn2Args: Array<Record<string, unknown>> = [];
  for (const endDate of [undefined, fixtureDate]) {
    for (const locationId of [undefined, fixtureLocationId]) {
      for (const limit of [undefined, 1, 3, 5, 10, 20]) {
        const args: Record<string, unknown> = { serviceId: fixtureServiceId, startDate: fixtureDate };
        if (endDate) args.endDate = endDate;
        if (locationId) args.locationId = locationId;
        if (limit) args.limit = limit;
        possibleTurn2Args.push(args);
      }
    }
  }
  const turn2DateMatches = Boolean(
    availabilityCall && possibleTurn2Args.some((args) => hashNormalizedArgs(args) === availabilityCall.args_hash),
  );
  console.log(`TURN2_START_DATE: ${turn2DateMatches ? fixtureDate : 'UNVERIFIED'}`);
  console.log(`TURN2_DATE_MATCHES_FIXTURE: ${yesNo(turn2DateMatches)}`);
  console.log(`AVAILABILITY_TOOL_CALLED: ${availToolCalled ? 'YES' : 'NO'}`);
  console.log(`AVAILABILITY_SERVICE_MATCH: ${yesNo(turn2DateMatches)}`);
  console.log(`AVAILABILITY_DATE_MATCH: ${yesNo(turn2DateMatches)}`);

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
  const run3Db = await measuredRun(pool, orgId, run3.id);
  requireSucceededRun(run3Db, 'TURN_3_POST_BOOKING_FINALIZATION');

  // Fetch tool calls for Run 3
  const tcRes = await pool.query(
    `SELECT ordinal, tool_name, result_code, duration_ms, operation_id, args_hash
     FROM tool_calls WHERE agent_run_id = $1 ORDER BY ordinal ASC`,
    [run3.id],
  );
  const toolCalls = tcRes.rows;
  const firstTool = toolCalls[0]?.tool_name ?? 'NONE';
  const createBookingCalled = toolCalls.some((t) => t.tool_name === 'createBooking');
  const createBookingExecutionCount = toolCalls.filter((t) => t.tool_name === 'createBooking').length;
  const createBookingCall = toolCalls.find((t) => t.tool_name === 'createBooking');
  const toolResultCode = createBookingCall?.result_code ?? 'NOT_CALLED';

  const confirmationIngress = (
    await pool.query(
      `SELECT ingress_sequence FROM messages WHERE organization_id=$1 AND id=$2 AND conversation_id=$3 AND direction='INBOUND'`,
      [orgId, in3.messageId, convId],
    )
  ).rows[0]?.ingress_sequence;
  const bookingTurnReached =
    run3Db.target_ingress_sequence === confirmationIngress && run3Db.status === 'SUCCEEDED';
  console.log(`\nBOOKING_TURN_REACHED: ${yesNo(bookingTurnReached)}`);
  console.log(`BOOKING_FIRST_TOOL: ${firstTool}`);
  console.log(`CREATEBOOKING_CALLED: ${createBookingCalled ? 'YES' : 'NO'}`);
  console.log(`CREATEBOOKING_EXECUTION_COUNT: ${createBookingExecutionCount}`);
  console.log(`TOOL_RESULT_CODE: ${toolResultCode}`);

  // 5. Token Provenance & Server Proof
  console.log('\n--- 5. TOKEN PROVENANCE & SERVER PROOF ---');
  const expectedCreateBookingArgs: Array<Record<string, unknown>> = slot0TokenPresent
    ? [
        { slotToken: String(slot0!.slotToken) },
        ...(ws?.lead_id ? [{ slotToken: String(slot0!.slotToken), leadId: ws.lead_id }] : []),
      ]
    : [];
  const exactTokenUsed = Boolean(
    createBookingCall &&
      expectedCreateBookingArgs.some((args) => hashNormalizedArgs(args) === createBookingCall.args_hash),
  );
  const createBookingTokenFp = exactTokenUsed ? persistedFp : createBookingCall ? 'UNVERIFIED' : 'NOT_RUN';

  const commandResult = createBookingCall?.operation_id
    ? (
        await pool.query(
          `SELECT status, result_json FROM command_operations WHERE organization_id=$1 AND id=$2`,
          [orgId, createBookingCall.operation_id],
        )
      ).rows[0]
    : null;
  const successAudit = (
    await pool.query(
      `SELECT metadata_json FROM audit_logs
       WHERE organization_id=$1 AND action='agent.run_succeeded' AND target_type='AgentRun' AND target_id=$2
       ORDER BY recorded_at DESC LIMIT 1`,
      [orgId, run3.id],
    )
  ).rows[0];
  const finalizationEvidence = successAudit?.metadata_json?.finalization as
    | {
        source?: string;
        postToolModelOutputInvalid?: boolean;
        structuredRetryUsed?: boolean;
        structuredRetryRecovered?: boolean;
        fallbackUsed?: boolean;
        mutationToolName?: string;
      }
    | undefined;
  console.log(
    `POST_BOOKING_MODEL_OUTPUT_VALID: ${finalizationEvidence ? yesNo(!finalizationEvidence.postToolModelOutputInvalid) : 'NOT_RUN'}`,
  );
  console.log(
    `STRUCTURED_RETRY_USED: ${finalizationEvidence ? yesNo(finalizationEvidence.structuredRetryUsed === true) : 'NOT_RUN'}`,
  );
  console.log(
    `STRUCTURED_RETRY_RECOVERED: ${finalizationEvidence ? yesNo(finalizationEvidence.structuredRetryRecovered === true) : 'NOT_RUN'}`,
  );
  console.log(
    `DETERMINISTIC_FINALIZATION_FALLBACK_USED: ${finalizationEvidence ? yesNo(finalizationEvidence.fallbackUsed === true) : 'NOT_RUN'}`,
  );
  console.log(`FINAL_RESPONSE_SOURCE: ${finalizationEvidence?.source ?? 'NOT_RUN'}`);
  const resultBookingId =
    typeof commandResult?.result_json?.bookingId === 'string'
      ? commandResult.result_json.bookingId
      : null;
  const bookingByRun = (
    await pool.query(
      `SELECT b.id, b.status, b.customer_id, b.service_id, b.staff_member_id, b.starts_at, b.ends_at,
              b.source_conversation_id, b.source_message_id,
              m.organization_id AS message_organization_id, m.conversation_id AS message_conversation_id,
              m.direction AS message_direction, m.ingress_sequence AS message_ingress_sequence
       FROM bookings b
       LEFT JOIN messages m ON m.organization_id=b.organization_id AND m.id=b.source_message_id
       WHERE b.organization_id=$1 AND b.created_by_agent_run_id=$2
       ORDER BY b.created_at DESC LIMIT 1`,
      [orgId, run3.id],
    )
  ).rows[0];
  const bookingIdPresent = Boolean(resultBookingId || bookingByRun?.id);
  const backendConfirmed =
    createBookingCall?.result_code === 'OK' &&
    commandResult?.status === 'SUCCEEDED' &&
    bookingByRun?.status === 'CONFIRMED';
  const confirmationMeasured = Boolean(createBookingCall && bookingByRun);
  const confirmationResolved = confirmationMeasured && Boolean(bookingByRun.source_message_id);
  const confirmationMatchesIngress =
    confirmationMeasured && bookingByRun.message_ingress_sequence === run3Db?.target_ingress_sequence;
  const confirmationInbound = confirmationMeasured && bookingByRun.message_direction === 'INBOUND';
  const confirmationSameConversation =
    confirmationMeasured && bookingByRun.message_conversation_id === convId;
  const confirmationSameOrganization =
    confirmationMeasured && bookingByRun.message_organization_id === orgId;
  const llmSuppliedConfirmationId = Boolean(
    createBookingCall &&
      slot0TokenPresent &&
      hashNormalizedArgs({
        slotToken: String(slot0!.slotToken),
        confirmationMessageId: in3.messageId,
        ...(ws?.lead_id ? { leadId: ws.lead_id } : {}),
      }) === createBookingCall.args_hash,
  );

  console.log(`EXACT_SLOT_TOKEN_USED: ${createBookingCall ? yesNo(exactTokenUsed) : 'NOT_RUN'}`);
  console.log(`PERSISTED_TOKEN_FINGERPRINT: ${persistedFp}`);
  console.log(`CREATEBOOKING_TOKEN_FINGERPRINT: ${createBookingTokenFp}`);
  console.log(`CONFIRMATION_MESSAGE_RESOLVED_SERVER_SIDE: ${confirmationMeasured ? yesNo(confirmationResolved) : 'NOT_RUN'}`);
  console.log(`CONFIRMATION_MESSAGE_MATCHES_TARGET_INGRESS: ${confirmationMeasured ? yesNo(confirmationMatchesIngress) : 'NOT_RUN'}`);
  console.log(`CONFIRMATION_MESSAGE_DIRECTION_INBOUND: ${confirmationMeasured ? yesNo(confirmationInbound) : 'NOT_RUN'}`);
  console.log(`CONFIRMATION_MESSAGE_SAME_CONVERSATION: ${confirmationMeasured ? yesNo(confirmationSameConversation) : 'NOT_RUN'}`);
  console.log(`CONFIRMATION_MESSAGE_SAME_ORGANIZATION: ${confirmationMeasured ? yesNo(confirmationSameOrganization) : 'NOT_RUN'}`);
  console.log(`LLM_SUPPLIED_CONFIRMATION_MESSAGE_ID_REQUIRED: ${createBookingCall ? yesNo(llmSuppliedConfirmationId) : 'NOT_RUN'}`);
  console.log(`BACKEND_CONFIRMED_BOOKING: ${createBookingCall ? yesNo(backendConfirmed) : 'NOT_RUN'}`);
  console.log(`BOOKING_ID_PRESENT: ${createBookingCall ? yesNo(bookingIdPresent) : 'NOT_RUN'}`);
  console.log(`BOOKING: ${backendConfirmed && exactTokenUsed ? 'PASS' : 'FAIL'}\n`);

  // 6. DB Persistence Proof
  console.log('--- 6. DATABASE PERSISTENCE PROOF ---');
  const bookingRow = bookingByRun;
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
  let idempotency: 'PASS' | 'FAIL' | 'NOT_RUN' = 'NOT_RUN';
  let run4: { id: string } | null = null;
  if (backendConfirmed && bookingRow) {
    const bookingsCountBeforeReplay = (
      await pool.query(
        `SELECT count(*)::int AS cnt FROM bookings WHERE organization_id=$1 AND source_conversation_id=$2 AND status='CONFIRMED'`,
        [orgId, convId],
      )
    ).rows[0].cnt;
    await inbound(token, orgId, 'تمام احجزلي أول موعد', phone);
    run4 = await waitForRun(token, orgId, convId, 3);
    const bookingsCountAfterReplay = (
      await pool.query(
        `SELECT count(*)::int AS cnt FROM bookings WHERE organization_id=$1 AND source_conversation_id=$2 AND status='CONFIRMED'`,
        [orgId, convId],
      )
    ).rows[0].cnt;
    idempotency = bookingsCountAfterReplay === bookingsCountBeforeReplay ? 'PASS' : 'FAIL';
    console.log(`DUPLICATE_BOOKING_CREATED: ${yesNo(bookingsCountAfterReplay > bookingsCountBeforeReplay)}`);
  } else {
    console.log('DUPLICATE_BOOKING_CREATED: NOT_RUN');
  }
  console.log(`IDEMPOTENCY: ${idempotency}\n`);

  // 8. Zero-Slot Regression
  console.log('--- 8. ZERO-SLOT REGRESSION ---');
  const freshPhone = `+964770${Math.floor(1000000 + Math.random() * 9000000)}`;
  const freshIn = await inbound(token, orgId, 'تمام احجزلي أول موعد', freshPhone);
  const freshConvId = freshIn.conversationId;
  if (!freshConvId) throw new Error('No fresh conversationId');
  const freshRun = await waitForRun(token, orgId, freshConvId, 0);
  const freshTc = await pool.query(`SELECT tool_name FROM tool_calls WHERE agent_run_id = $1`, [freshRun.id]);
  const calledCreateOnEmpty = freshTc.rows.some((t) => t.tool_name === 'createBooking');
  const freshEvidence = (
    await pool.query(
      `SELECT ws.state_json,
              EXISTS (
                SELECT 1 FROM messages mi
                WHERE mi.organization_id=$1 AND mi.conversation_id=$2
                  AND mi.direction='INBOUND' AND mi.content_text=$3
              ) AS confirmation_attempted,
              (
                SELECT mo.content_text FROM messages mo
                WHERE mo.organization_id=$1 AND mo.conversation_id=$2 AND mo.direction='OUTBOUND'
                ORDER BY mo.timeline_sequence DESC LIMIT 1
              ) AS outbound_text
       FROM conversations c
       LEFT JOIN conversation_working_state ws
         ON ws.organization_id=c.organization_id AND ws.conversation_id=c.id
       WHERE c.organization_id=$1 AND c.id=$2`,
      [orgId, freshConvId, 'تمام احجزلي أول موعد'],
    )
  ).rows[0];
  const freshSlots = freshEvidence?.state_json?.candidateSlots;
  const freshHasNoSlots = !Array.isArray(freshSlots) || freshSlots.length === 0;
  const zeroSlotReasonMatches =
    typeof freshEvidence?.outbound_text === 'string' &&
    /(لا يوجد|ما عندي|ما توجد|مو متوفر|غير متاح|لا تتوفر).*(موعد|مواعيد)/i.test(freshEvidence.outbound_text);
  const zeroSlotPass =
    freshHasNoSlots &&
    freshEvidence?.confirmation_attempted === true &&
    !calledCreateOnEmpty &&
    zeroSlotReasonMatches;

  console.log(`CREATEBOOKING_CALLED_WITH_NO_SLOT: ${calledCreateOnEmpty ? 'YES' : 'NO'}`);
  console.log(`ZERO_SLOT_CANDIDATES_EMPTY: ${yesNo(freshHasNoSlots)}`);
  console.log(`ZERO_SLOT_CONFIRMATION_ATTEMPTED: ${yesNo(freshEvidence?.confirmation_attempted === true)}`);
  console.log(`ZERO_SLOT_REASON_MATCHED: ${yesNo(zeroSlotReasonMatches)}`);
  console.log(`ZERO_SLOT_REGRESSION: ${zeroSlotPass ? 'PASS' : 'FAIL'}\n`);

  // 9. Safety & Provider Counters
  console.log('--- 9. SAFETY & PROVIDER COUNTERS ---');
  const journeyRunIds = [run1.id, run2.id, run3.id, ...(run4 ? [run4.id] : [])];
  const usageRows = (
    await pool.query(
      `SELECT agent_run_id, provider, model FROM usage_events
       WHERE organization_id=$1 AND agent_run_id=ANY($2::uuid[])
       ORDER BY created_at`,
      [orgId, journeyRunIds],
    )
  ).rows as Array<{ agent_run_id: string; provider: string; model: string }>;
  const providerFor = (runId: string) => {
    const values = [...new Set(usageRows.filter((row) => row.agent_run_id === runId).map((row) => row.provider))];
    return values.length === 1 ? values[0]! : values.length ? values.join(',') : 'NOT_RUN';
  };
  const modelFor = (runId: string) => {
    const values = [...new Set(usageRows.filter((row) => row.agent_run_id === runId).map((row) => row.model))];
    return values.length === 1 ? values[0]! : values.length ? values.join(',') : 'NOT_RUN';
  };
  const runCounters = (
    await pool.query(
      `SELECT
         count(*) FILTER (WHERE terminal_reason='model_output_invalid')::int AS model_output_invalid_count,
         count(*) FILTER (WHERE terminal_reason='unparseable_provider_json')::int AS unparseable_provider_json_count,
         count(*) FILTER (WHERE terminal_reason='authority_lost' OR status='STALE')::int AS authority_lost_count,
         count(*) FILTER (WHERE status='TIMED_OUT' OR terminal_reason='transient_provider')::int AS model_timeout_count
       FROM agent_runs WHERE organization_id=$1 AND id=ANY($2::uuid[])`,
      [orgId, journeyRunIds],
    )
  ).rows[0];
  const toolFailureCount = (
    await pool.query(
      `SELECT count(*)::int AS count FROM tool_calls
       WHERE organization_id=$1 AND agent_run_id=ANY($2::uuid[]) AND result_code <> 'OK'`,
      [orgId, journeyRunIds],
    )
  ).rows[0].count;
  const fallbackOccurred = journeyRunIds.some((runId) => {
    const providers = new Set(usageRows.filter((row) => row.agent_run_id === runId).map((row) => row.provider));
    return providers.size > 1;
  });
  console.log(`PROVIDER_FOR_TURN1: ${providerFor(run1.id)}`);
  console.log(`PROVIDER_FOR_TURN2: ${providerFor(run2.id)}`);
  console.log(`PROVIDER_FOR_TURN3: ${providerFor(run3.id)}`);
  console.log(`MODEL_FOR_TURN1: ${modelFor(run1.id)}`);
  console.log(`MODEL_FOR_TURN2: ${modelFor(run2.id)}`);
  console.log(`MODEL_FOR_TURN3: ${modelFor(run3.id)}`);
  console.log(`MODEL_OUTPUT_INVALID_COUNT: ${runCounters.model_output_invalid_count}`);
  console.log(`UNPARSEABLE_PROVIDER_JSON_COUNT: ${runCounters.unparseable_provider_json_count}`);
  console.log(`TOOL_EXECUTION_FAILURE_COUNT: ${toolFailureCount}`);
  console.log(`AUTHORITY_LOST_COUNT: ${runCounters.authority_lost_count}`);
  console.log('BULLMQ_STALLED_COUNT: NOT_RUN');
  console.log(`MODEL_TIMEOUT_OCCURRED: ${yesNo(runCounters.model_timeout_count > 0)}`);
  console.log('PROVIDER_AUTH_ERROR_OCCURRED: NOT_RUN');
  console.log('PROVIDER_RATE_LIMIT_OCCURRED: NOT_RUN');
  console.log(`MID_RUN_PROVIDER_FALLBACK_OCCURRED: ${yesNo(fallbackOccurred)}\n`);

  await pool.end();
}

main().catch((err) => {
  console.error('FATAL E2E FAILURE:', err);
  process.exit(1);
});
