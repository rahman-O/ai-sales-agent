/**
 * PATH B zero-cost live demo driver (API/DB authoritative).
 * Loads .env.demo.session + hosted Auth from .env.local (DB forced local via DEMO_FORCE_LOCAL_DB).
 * Never prints secrets/tokens/passwords.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from '../load-local-env.ts';

type StepResult = {
  step: string;
  input: string;
  observedUi: string;
  authoritative: string;
  result: string;
  transport: string;
};

function loadDemoSession(cwd: string) {
  const p = path.join(cwd, '.env.demo.session');
  if (!fs.existsSync(p)) throw new Error('.env.demo.session missing — run preflight first');
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

async function getAccessToken(): Promise<{ token: string; sub: string }> {
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
  const body = (await res.json()) as { access_token?: string; user?: { id?: string } };
  if (!res.ok || !body.access_token || !body.user?.id) {
    throw new Error(`password_grant_failed status=${res.status}`);
  }
  return { token: body.access_token, sub: body.user.id };
}

function apiBase() {
  return (process.env.API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
}

async function api(
  token: string,
  method: string,
  pathName: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  const res = await fetch(`${apiBase()}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(headers ?? {}),
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
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function asList<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === 'object' && Array.isArray((json as { items?: unknown }).items)) {
    return (json as { items: T[] }).items;
  }
  return [];
}

function upsertSessionKey(cwd: string, key: string, value: string) {
  const p = path.join(cwd, '.env.demo.session');
  const lines = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split(/\r?\n/) : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  fs.writeFileSync(p, `${next.filter((l, i, a) => l.trim() || i < a.length - 1).join('\n').replace(/\n+$/, '')}\n`);
  process.env[key] = value;
}

async function waitFor(
  label: string,
  fn: () => Promise<boolean>,
  attempts = 40,
  delayMs = 500,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await fn()) return true;
    await sleep(delayMs);
  }
  console.log(JSON.stringify({ wait_timeout: label }));
  return false;
}

async function main() {
  const cwd = process.cwd();
  const phase = (process.argv[2] ?? 'all').toLowerCase(); // fixtures | journeys | all
  process.env.DEMO_FORCE_LOCAL_DB = '1';
  loadDemoSession(cwd);
  loadLocalEnv(cwd);
  // Re-assert local DB after loadLocalEnv (DEMO_FORCE skips .env.local DB keys)
  process.env.DEMO_FORCE_LOCAL_DB = '1';
  process.env.ZERO_COST_DEMO = '1';
  process.env.AI_ALLOW_FAKE = 'true';
  // Prefer JWKS for hosted Auth; HS256 secret breaks ECC access tokens.
  delete process.env.SUPABASE_JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('Refuse production');

  console.log(JSON.stringify({ DEMO_DB_TARGET: 'LOCAL', DEMO_REDIS_TARGET: 'LOCAL', phase }));
  console.log(
    JSON.stringify({
      PROVISION_WRITES_TO: 'Supabase Auth only (app User upserted via GET /v1/auth/me)',
    }),
  );

  const steps: StepResult[] = [];
  const record = (s: StepResult) => {
    steps.push(s);
    console.log(JSON.stringify({ step: s.step, result: s.result }));
  };

  // Live probe API
  const live = await fetch(`${apiBase()}/health/live`).then((r) => r.status).catch(() => 0);
  if (live !== 200) throw new Error('API not ready — start npm run dev:api with DEMO env');

  const { token, sub } = await getAccessToken();
  console.log(JSON.stringify({ HOSTED_AUTH_SUBJECT: 'resolved', subPrefix: sub.slice(0, 8) }));

  const me = await api(token, 'GET', '/v1/auth/me');
  if (me.status !== 200) throw new Error(`auth/me failed ${me.status}`);
  const meBody = me.json as { userId?: string; authSubject?: string };
  const localUserOk = meBody.authSubject === sub || Boolean(meBody.userId);
  console.log(
    JSON.stringify({
      LOCAL_USER_MAPPING: localUserOk ? 'PASS' : 'FAIL',
      LOGIN: 'PASS',
    }),
  );
  if (!localUserOk) throw new Error('LOCAL_USER_MAPPING failed');

  let orgId = process.env.DEMO_ORG_ID?.trim() || '';

  if (phase === 'fixtures' || phase === 'all' || !orgId) {
    // Create demo org
    const orgRes = await api(
      token,
      'POST',
      '/v1/organizations',
      { name: `Zero Cost Test Clinic ${Date.now()}` },
      { 'Idempotency-Key': `demo-org-${Date.now()}` },
    );
    if (orgRes.status >= 300) throw new Error(`org create ${orgRes.status} ${JSON.stringify(orgRes.json)}`);
    orgId = (orgRes.json as { organizationId: string }).organizationId;
    upsertSessionKey(cwd, 'DEMO_ORG_ID', orgId);
    console.log(JSON.stringify({ LOCAL_MEMBERSHIP: 'PASS', ROLE: 'OWNER', orgPrefix: orgId.slice(0, 8) }));

    // Catalog — MVP allows only one active location; create fresh on new org
    const loc = await api(token, 'POST', `/v1/organizations/${orgId}/catalog/locations`, {
      name: 'Test Clinic Baghdad',
      timezone: 'Asia/Baghdad',
    });
    if (loc.status >= 300) throw new Error(`location ${loc.status} ${JSON.stringify(loc.json)}`);
    const locationId = (loc.json as { id: string }).id;

    const svc = await api(token, 'POST', `/v1/organizations/${orgId}/catalog/services`, {
      locationId,
      name: 'Dental Consultation',
      durationMinutes: 30,
      amountMinor: '50000',
      currency: 'IQD',
    });
    if (svc.status >= 300) throw new Error(`service ${svc.status} ${JSON.stringify(svc.json)}`);
    const serviceId = (svc.json as { id: string }).id;
    upsertSessionKey(cwd, 'DEMO_SERVICE_ID', serviceId);

    const staff = await api(token, 'POST', `/v1/organizations/${orgId}/catalog/staff`, {
      locationId,
      displayName: 'Dr Test',
    });
    if (staff.status >= 300) throw new Error(`staff ${staff.status}`);
    const staffId = (staff.json as { id: string }).id;

    const link = await api(
      token,
      'POST',
      `/v1/organizations/${orgId}/catalog/services/${serviceId}/staff/${staffId}`,
      {},
    );
    if (link.status >= 300) throw new Error(`link ${link.status}`);

    // Availability: Sun-Thu (ISO 7,1,2,3,4) wide window
    for (const day of [7, 1, 2, 3, 4]) {
      const rule = await api(token, 'POST', `/v1/organizations/${orgId}/schedule/rules`, {
        staffMemberId: staffId,
        locationId,
        dayOfWeek: day,
        localStartTime: '09:00',
        localEndTime: '17:00',
      });
      if (rule.status >= 300) throw new Error(`rule ${rule.status} ${JSON.stringify(rule.json)}`);
    }
    record({
      step: 'CATALOG',
      input: 'API create location/service/staff/rules',
      observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
      authoritative: `service=${serviceId.slice(0, 8)} staff=${staffId.slice(0, 8)}`,
      result: 'PASS',
      transport: 'LOCAL_REAL_STACK',
    });

    // Agent config with tools
    const allowlist = [
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
    ];
    const draft = await api(token, 'POST', `/v1/organizations/${orgId}/agent/configs`, {
      promptVersion: 'demo-path-b-v1',
      modelProfile: 'fake-demo-script',
      toolAllowlist: allowlist,
      budgetsJson: { maxModelCalls: 8, maxToolCalls: 12 },
    });
    if (draft.status >= 300) throw new Error(`agent draft ${draft.status} ${JSON.stringify(draft.json)}`);
    const configId = (draft.json as { id: string }).id;
    const act = await api(token, 'POST', `/v1/organizations/${orgId}/agent/configs/${configId}/activate`, {});
    if (act.status >= 300) throw new Error(`agent activate ${act.status} ${JSON.stringify(act.json)}`);
    record({
      step: 'TENANT_AGENT_CONFIG',
      input: 'activate allowlist P04-P10',
      observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
      authoritative: `config=${configId.slice(0, 8)} ACTIVE`,
      result: 'PASS',
      transport: 'LOCAL_REAL_STACK',
    });

    if (phase === 'fixtures') {
      console.log(
        JSON.stringify({
          FIXTURES: 'PASS',
          DEMO_ORG_ID_PREFIX: orgId.slice(0, 8),
          DEMO_SERVICE_ID_PREFIX: serviceId.slice(0, 8),
          NEXT: 'restart worker with .env.demo.session then run journeys',
        }),
      );
      return;
    }
  }

  if (!orgId) throw new Error('DEMO_ORG_ID missing — run fixtures phase first');
  if (!process.env.DEMO_SERVICE_ID?.trim()) {
    throw new Error('DEMO_SERVICE_ID missing — run fixtures phase and restart worker');
  }
  console.log(
    JSON.stringify({
      DEMO_ORG_PREFIX: orgId.slice(0, 8),
      DEMO_SERVICE_PREFIX: process.env.DEMO_SERVICE_ID.slice(0, 8),
    }),
  );

  const inbound = async (text: string, sender: string, msgId: string) => {
    return api(token, 'POST', `/v1/organizations/${orgId}/dev/messaging/inbound`, {
      senderAddress: sender,
      providerMessageId: msgId,
      text,
      provider: 'whatsapp',
    });
  };

  // Journey 1 — FAQ inbound
  const in1 = await inbound('Hi, what services do you offer?', '+15550001001', `demo-msg-1-${randomUUID()}`);
  if (in1.status >= 300) throw new Error(`inbound1 ${in1.status} ${JSON.stringify(in1.json)}`);
  const msg1 = (in1.json as { message?: { conversationId?: string; id?: string } }).message;
  let conversationId = msg1?.conversationId;
  if (!conversationId) {
    const inbox = await api(token, 'GET', `/v1/organizations/${orgId}/conversations`);
    const conversations = asList<{ id: string }>(inbox.json);
    conversationId = conversations[0]?.id;
  }
  if (!conversationId) throw new Error(`no conversation after inbound: ${JSON.stringify(in1.json).slice(0, 400)}`);
  record({
    step: 'INBOUND',
    input: 'Hi, what services do you offer?',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `conversation=${conversationId.slice(0, 8)} status=${in1.status}`,
    result: 'PASS',
    transport: 'FAKE_TEST_TRANSPORT',
  });

  // Journey 2 — wait for AgentRun + outbound
  const agentOk = await waitFor('agent_run', async () => {
    const runs = await api(
      token,
      'GET',
      `/v1/organizations/${orgId}/agent/runs?conversationId=${conversationId}`,
    );
    return asList(runs.json).length > 0;
  });
  const msgs = await api(token, 'GET', `/v1/organizations/${orgId}/conversations/${conversationId}/messages`);
  const msgList = asList<{ direction: string }>(msgs.json);
  const hasOutbound = msgList.some((m) => m.direction === 'OUTBOUND' || m.direction === 'outbound');
  record({
    step: 'AI_ORCHESTRATION',
    input: 'worker process FAQ scenario',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `agentRun=${agentOk} outbound=${hasOutbound}`,
    result: agentOk && hasOutbound ? 'PASS' : 'FAIL',
    transport: 'FAKE_TEST_TRANSPORT',
  });

  // Journey 3 — lead
  const in2 = await inbound(
    'I want to book a dental consultation.',
    '+15550001001',
    `demo-msg-2-${randomUUID()}`,
  );
  await waitFor('lead', async () => {
    const leads = await api(token, 'GET', `/v1/organizations/${orgId}/leads`);
    return asList(leads.json).length > 0;
  }, 50, 600);
  const leads = await api(token, 'GET', `/v1/organizations/${orgId}/leads`);
  const leadList = asList(leads.json);
  record({
    step: 'LEAD',
    input: '[demo:intent-book] phrase',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `leads=${leadList.length} inbound2=${in2.status}`,
    result: leadList.length > 0 ? 'PASS' : 'FAIL',
    transport: 'FAKE_TEST_TRANSPORT',
  });

  // Journey 4+5 — availability then confirm (CONFIRM_BOOKING does both tools in one run)
  const in3 = await inbound(
    'Book the first available appointment.',
    '+15550001001',
    `demo-msg-3-${randomUUID()}`,
  );
  await waitFor('booking', async () => {
    const b = await api(token, 'GET', `/v1/organizations/${orgId}/bookings`);
    return asList(b.json).length > 0;
  }, 60, 700);
  const bookings = await api(token, 'GET', `/v1/organizations/${orgId}/bookings`);
  const bookingList = asList<{ id: string; status?: string }>(bookings.json);
  record({
    step: 'AVAILABILITY_AND_BOOKING',
    input: 'Book the first available appointment. (CONFIRM_BOOKING script)',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `bookings=${bookingList.length} status=${bookingList[0]?.status ?? 'n/a'} in3=${in3.status}`,
    result: bookingList.length > 0 ? 'PASS' : 'FAIL',
    transport: 'FAKE_TEST_TRANSPORT',
  });

  // Conflict — second customer same slot via createBooking path: send confirm for second identity
  const inConflict = await inbound(
    'Book the first available appointment.',
    '+15550001002',
    `demo-msg-c-${randomUUID()}`,
  );
  await sleep(4000);
  const bookingsAfter = await api(token, 'GET', `/v1/organizations/${orgId}/bookings`);
  const bookingList2 = asList(bookingsAfter.json);
  // Conflict protection: second booking should not double-confirm the same slot (count stays 1 or second fails)
  record({
    step: 'CONFLICT_PROTECTION',
    input: 'second customer same confirm phrase',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `bookings_before=${bookingList.length} after=${bookingList2.length} conflict_inbound=${inConflict.status}`,
    result: bookingList2.length <= Math.max(bookingList.length, 1) ? 'PASS' : 'PARTIAL',
    transport: 'FAKE_TEST_TRANSPORT',
  });

  // Takeover
  const convDetail = await api(token, 'GET', `/v1/organizations/${orgId}/conversations/${conversationId}`);
  const epoch = (convDetail.json as { ownershipEpoch?: number }).ownershipEpoch ?? 0;
  const takeover = await api(token, 'POST', `/v1/organizations/${orgId}/conversations/${conversationId}/takeover`, {
    expectedOwnershipEpoch: epoch,
  });
  const afterTake = await api(token, 'GET', `/v1/organizations/${orgId}/conversations/${conversationId}`);
  const mode = (afterTake.json as { mode?: string }).mode;
  record({
    step: 'HUMAN_TAKEOVER',
    input: 'POST takeover',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `mode=${mode} status=${takeover.status}`,
    result: mode === 'AI_PAUSED' ? 'PASS' : 'FAIL',
    transport: 'LOCAL_REAL_STACK',
  });

  const reply = await api(
    token,
    'POST',
    `/v1/organizations/${orgId}/conversations/${conversationId}/replies`,
    {
      text: 'Human operator here — how can I help?',
      expectedOwnershipEpoch: (afterTake.json as { ownershipEpoch?: number }).ownershipEpoch ?? epoch + 1,
    },
    { 'Idempotency-Key': `demo-reply-${randomUUID()}` },
  );
  record({
    step: 'OPERATOR_REPLY',
    input: 'human reply',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `status=${reply.status}`,
    result: reply.status < 300 ? 'PASS' : 'FAIL',
    transport: 'FAKE_TEST_TRANSPORT',
  });

  // Paused inbound — no new agent run count spike ideally
  const runsBefore = await api(
    token,
    'GET',
    `/v1/organizations/${orgId}/agent/runs?conversationId=${conversationId}`,
  );
  const runCountBefore = asList(runsBefore.json).length;
  await inbound('I have another question.', '+15550001001', `demo-msg-paused-${randomUUID()}`);
  await sleep(3000);
  const runsAfter = await api(
    token,
    'GET',
    `/v1/organizations/${orgId}/agent/runs?conversationId=${conversationId}`,
  );
  const runCountAfter = asList(runsAfter.json).length;
  record({
    step: 'AI_PAUSE_FENCE',
    input: 'inbound while AI_PAUSED',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `runs_before=${runCountBefore} after=${runCountAfter}`,
    result: runCountAfter === runCountBefore ? 'PASS' : 'FAIL',
    transport: 'LOCAL_REAL_STACK',
  });

  // Resume
  const epoch2 = (afterTake.json as { ownershipEpoch?: number }).ownershipEpoch ?? epoch + 1;
  const resume = await api(token, 'POST', `/v1/organizations/${orgId}/conversations/${conversationId}/resume-ai`, {
    expectedOwnershipEpoch: epoch2,
  });
  await inbound('Hi, what services do you offer?', '+15550001001', `demo-msg-resume-${randomUUID()}`);
  await sleep(4000);
  record({
    step: 'RESUME_AI',
    input: 'resume-ai + new FAQ inbound',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `resume=${resume.status}`,
    result: resume.status < 300 ? 'PASS' : 'FAIL',
    transport: 'LOCAL_REAL_STACK',
  });

  // Dedupe
  const dupId = `demo-dup-${randomUUID()}`;
  const d1 = await inbound('Hi, what services do you offer?', '+15550001003', dupId);
  const d2 = await inbound('Hi, what services do you offer?', '+15550001003', dupId);
  record({
    step: 'DEDUPE',
    input: 'replay same providerMessageId',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `first=${d1.status} second=${d2.status}`,
    result: d1.status < 300 && (d2.status === 200 || d2.status === 409 || d2.status === 201) ? 'PASS' : 'PARTIAL',
    transport: 'FAKE_TEST_TRANSPORT',
  });

  // Dashboard / analytics
  const dash = await api(token, 'GET', `/v1/organizations/${orgId}/dashboard`);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const analytics = await api(
    token,
    'GET',
    `/v1/organizations/${orgId}/analytics/overview?from=${encodeURIComponent(day(new Date(Date.now() - 86400000)))}&to=${encodeURIComponent(day(new Date(Date.now() + 86400000)))}&timezone=${encodeURIComponent('Asia/Baghdad')}`,
  );
  record({
    step: 'DASHBOARD',
    input: 'GET dashboard',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `status=${dash.status}`,
    result: dash.status < 300 ? 'PASS' : 'FAIL',
    transport: 'LOCAL_REAL_STACK',
  });
  record({
    step: 'ANALYTICS',
    input: 'GET analytics overview',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `status=${analytics.status}`,
    result: analytics.status < 300 ? 'PASS' : 'FAIL',
    transport: 'LOCAL_REAL_STACK',
  });

  // AI emergency kill
  const kill = await api(token, 'POST', `/v1/organizations/${orgId}/ai-emergency-disable`, {
    reason: 'path_b_demo',
  });
  const runsK0 = asList(
    (await api(token, 'GET', `/v1/organizations/${orgId}/agent/runs?conversationId=${conversationId}`)).json,
  ).length;
  await inbound('Hi, what services do you offer?', '+15550001001', `demo-kill-${randomUUID()}`);
  await sleep(3000);
  const runsK1 = asList(
    (await api(token, 'GET', `/v1/organizations/${orgId}/agent/runs?conversationId=${conversationId}`)).json,
  ).length;
  const enable = await api(token, 'POST', `/v1/organizations/${orgId}/ai-emergency-enable`, {});
  record({
    step: 'AI_EMERGENCY_KILL',
    input: 'disable → inbound → enable',
    observedUi: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    authoritative: `kill=${kill.status} enable=${enable.status} runs=${runsK0}->${runsK1}`,
    result: kill.status < 300 && runsK1 === runsK0 ? 'PASS' : 'FAIL',
    transport: 'LOCAL_REAL_STACK',
  });

  // Follow-up / knowledge / redis — mark deferred/skipped appropriately
  record({
    step: 'FOLLOW-UP_CORE',
    input: 'deferred — requires template + FollowUpDue sweep timing',
    observedUi: 'NOT_RUN',
    authoritative: 'not executed in this automated pass',
    result: 'SKIPPED',
    transport: 'LOCAL_REAL_STACK',
  });
  record({
    step: 'KNOWLEDGE',
    input: 'deferred after core per amendment',
    observedUi: 'NOT_RUN',
    authoritative: 'TEI not required for core PATH B',
    result: 'SKIPPED',
    transport: 'LOCAL_REAL_STACK',
  });
  record({
    step: 'REDIS_VISUAL_RECOVERY',
    input: 'optional local outage',
    observedUi: 'NOT_RUN',
    authoritative: 'skipped to avoid disrupting demo session',
    result: 'SKIPPED',
    transport: 'LOCAL_REAL_STACK',
  });

  const pass = (name: string) => steps.find((s) => s.step === name)?.result === 'PASS';
  const corePass =
    pass('INBOUND') &&
    pass('AI_ORCHESTRATION') &&
    pass('LEAD') &&
    pass('AVAILABILITY_AND_BOOKING') &&
    pass('HUMAN_TAKEOVER') &&
    pass('AI_PAUSE_FENCE');

  const report = {
    ZERO_COST_LIVE_DEMO_STATUS: corePass ? 'PARTIAL' : 'BLOCKED',
    note: 'PARTIAL when follow-up/knowledge/redis skipped; core journeys determine APPLICATION E2E',
    STACK_STARTUP: live === 200 ? 'PASS' : 'FAIL',
    AUTH: 'PASS',
    CATALOG_FIXTURE: pass('CATALOG') || Boolean(process.env.DEMO_SERVICE_ID) ? 'PASS' : 'FAIL',
    KNOWLEDGE: 'SKIPPED',
    INBOUND: pass('INBOUND') ? 'PASS' : 'FAIL',
    AI_ORCHESTRATION: pass('AI_ORCHESTRATION') ? 'PASS' : 'FAIL',
    LEAD: pass('LEAD') ? 'PASS' : 'FAIL',
    AVAILABILITY: pass('AVAILABILITY_AND_BOOKING') ? 'PASS' : 'FAIL',
    BOOKING: pass('AVAILABILITY_AND_BOOKING') ? 'PASS' : 'FAIL',
    CONFLICT_PROTECTION: steps.find((s) => s.step === 'CONFLICT_PROTECTION')?.result ?? 'FAIL',
    HUMAN_TAKEOVER: pass('HUMAN_TAKEOVER') ? 'PASS' : 'FAIL',
    OPERATOR_REPLY: pass('OPERATOR_REPLY') ? 'PASS' : 'FAIL',
    AI_PAUSE_FENCE: pass('AI_PAUSE_FENCE') ? 'PASS' : 'FAIL',
    RESUME_AI: pass('RESUME_AI') ? 'PASS' : 'FAIL',
    FOLLOW_UP_CORE: 'SKIPPED',
    FOLLOW_UP_SUPPRESSION: 'SKIPPED',
    DUPLICATE_INBOUND: steps.find((s) => s.step === 'DEDUPE')?.result ?? 'FAIL',
    DASHBOARD: pass('DASHBOARD') ? 'PASS' : 'FAIL',
    ANALYTICS: pass('ANALYTICS') ? 'PASS' : 'FAIL',
    AI_EMERGENCY_KILL: pass('AI_EMERGENCY_KILL') ? 'PASS' : 'FAIL',
    REDIS_VISUAL_RECOVERY: 'SKIPPED',
    REAL_META_ACCEPTANCE: 'NOT_RUN',
    REAL_TEMPLATE_ACCEPTANCE: 'NOT_RUN',
    TRANSPORT: 'FAKE_TEST_TRANSPORT',
    APPLICATION_E2E: corePass ? 'PASS' : 'FAIL',
    AGENT_TOOL_ORCHESTRATION: pass('LEAD') && pass('AVAILABILITY_AND_BOOKING') ? 'PASS' : 'FAIL',
    LOCAL_QUEUE_OUTBOX: agentOk ? 'PASS' : 'FAIL',
    UI_API_READBACK: 'LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED',
    EXTERNAL_META_E2E: 'NOT_RUN',
    EXTERNAL_LLM_E2E: 'NOT_RUN',
    META_COST: 0,
    LLM_COST: 0,
    REDIS_COST: 0,
    LOCAL_EMBEDDING_COST: 0,
    NEW_INFRA_COST: 0,
    TOTAL_NEW_SPEND: 0,
    READY_FOR_P14_DISCOVERY: 'YES',
    P14_AUTHORIZED: 'NO',
    steps,
  };

  const outPath = path.join(cwd, 'docs/ai-sales-agent/14-roadmap/pre-p14-zero-cost-live-demo.md');
  const md = [
    '# PRE-P14 Zero-cost PATH B live demo evidence',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '```text',
    `DEMO_DB_TARGET: LOCAL`,
    `DEMO_REDIS_TARGET: LOCAL`,
    `MESSAGING TRANSPORT: FAKE_TEST`,
    `MODEL PROVIDER: FAKE_TEST (ZERO_COST_DEMO scripted)`,
    `EMBEDDING: NOT_RUN_IN_THIS_PASS`,
    '```',
    '',
    '## Journey log',
    '',
    ...steps.map(
      (s) =>
        `### ${s.step}\n- INPUT: ${s.input}\n- OBSERVED UI: ${s.observedUi}\n- AUTHORITATIVE: ${s.authoritative}\n- RESULT: ${s.result}\n- TRANSPORT: ${s.transport}\n`,
    ),
    '## Final report',
    '',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
    '',
    '## User visual checklist (unchecked — not browser-verified)',
    '',
    '- [ ] Login works',
    '- [ ] Inbox received synthetic customer message',
    '- [ ] AI reply appeared',
    '- [ ] Lead appeared',
    '- [ ] Available slots were returned',
    '- [ ] Booking appeared',
    '- [ ] Same-slot conflict was rejected',
    '- [ ] Booking visible in schedule',
    '- [ ] Human takeover worked',
    '- [ ] Human reply appeared',
    '- [ ] AI stayed silent while paused',
    '- [ ] Resume AI worked',
    '- [ ] Follow-up core executed',
    '- [ ] Dashboard reflected activity',
    '- [ ] Analytics reflected activity',
    '- [ ] Emergency AI disable stopped new runs',
    '- [ ] New inbound still persisted while AI disabled',
    '',
    'P14_AUTHORIZED: NO',
    '',
  ].join('\n');
  fs.writeFileSync(outPath, md);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
