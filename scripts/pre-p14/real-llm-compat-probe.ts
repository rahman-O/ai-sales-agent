/**
 * PRE-P14 Real LLM Path B — compatibility harness (not full agent E2E, not P14).
 *
 * Probes:
 *   A — final_response only
 *   B — single tool_request in message.content
 *   C — tool_result → second decision → final_response
 *   N — native tool_calls with empty content → INCOMPATIBLE_WITH_CURRENT_ADAPTER if that is all we get
 *
 * Zero new spend: local OpenAI-compatible server only. No Meta. No billing.
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateHardwareFit,
  isApprovedLoopbackBaseUrl,
  PATH_B_HARDWARE_FIT,
} from '../../packages/agent-core/src/local-provider-guard.ts';
import { AgentDecisionSchema } from '../../packages/contracts/src/agent.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DOC = path.join(ROOT, 'docs/ai-sales-agent/14-roadmap/pre-p14-real-llm-zero-cost.md');

const BASE_URL = (process.env.AI_MODEL_BASE_URL ?? 'http://127.0.0.1:11434/v1').replace(/\/$/, '');
const API_KEY = process.env.AI_MODEL_API_KEY ?? 'local';
const MODEL = process.env.AI_MODEL_NAME ?? process.env.PROBE_MODEL ?? '';
const PROBE_TIMEOUT_MS = Number(process.env.AI_MODEL_TIMEOUT_MS ?? 180_000);
const PARAM_B = Number(process.env.PROBE_PARAM_BILLIONS ?? 3);
const MEM_GB = Number(process.env.PROBE_EXPECTED_MEMORY_GB ?? 4);

type ProbeStatus = 'PASS' | 'FAIL' | 'SKIP' | 'INCOMPATIBLE_WITH_CURRENT_ADAPTER';

type Report = {
  ARCHITECTURALLY_AVAILABLE: 'YES';
  LOCAL_SERVER_INSTALLED: 'YES' | 'NO';
  LOCAL_SERVER_RUNNING: 'YES' | 'NO';
  MODEL_INSTALLED: 'YES' | 'NO';
  MODEL_ID: string;
  HARDWARE_FIT: 'YES' | 'NO' | 'UNKNOWN';
  HARDWARE_FIT_REASON: string;
  PROTOCOL_COMPATIBLE: 'YES' | 'NO' | 'NOT_TESTED';
  PROBE_A: ProbeStatus;
  PROBE_B: ProbeStatus;
  PROBE_C: ProbeStatus;
  PROBE_NATIVE_TOOL_CALLS: ProbeStatus;
  ZERO_COST_REAL_LLM_READY: 'YES' | 'NO';
  CONFIG_CHANGE_REQUIRED: string[];
  EXPECTED_NEW_SPEND: 0;
  P14_AUTHORIZED: 'NO';
  NOTES: string[];
};

const AGENT_DECISION_SYSTEM = `You are a JSON-only agent. Reply with a single JSON object matching AgentDecision exactly (camelCase keys only):
- {"type":"final_response","text":"...","claims":[]}
- {"type":"tool_request","toolName":"...","arguments":{}}
- {"type":"safe_stop","reason":"..."}
Never use snake_case keys (never tool_name). Never use native tool_calls. Put the decision JSON in the message content only.`;

const TOOL_SEARCH = {
  type: 'function' as const,
  function: {
    name: 'searchServices',
    description: 'Search catalog services',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
};

async function chatCompletions(body: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  json: {
    choices?: Array<{
      message?: { content?: string | null; tool_calls?: unknown[] };
    }>;
  };
  rawText: string;
  elapsedMs: number;
}> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawText = await res.text();
    let json: {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: unknown[] } }>;
    } = {};
    try {
      json = JSON.parse(rawText) as typeof json;
    } catch {
      /* leave empty */
    }
    return { ok: res.ok, status: res.status, json, rawText, elapsedMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function parseDecisionFromContent(content: string | null | undefined): {
  ok: boolean;
  decision?: unknown;
  error?: string;
} {
  if (content == null || String(content).trim() === '') {
    return { ok: false, error: 'empty_content' };
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    const decision = AgentDecisionSchema.parse(parsed);
    return { ok: true, decision };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function which(cmd: string): string | null {
  try {
    return execFileSync('which', [cmd], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

async function pingServer(): Promise<boolean> {
  try {
    const base = BASE_URL.replace(/\/v1$/, '');
    const tags = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (tags.ok) return true;
  } catch {
    /* try models */
  }
  try {
    const models = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(3000),
    });
    return models.ok;
  } catch {
    return false;
  }
}

async function listOllamaModels(): Promise<string[]> {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { models?: Array<{ name?: string }> };
    return (body.models ?? []).map((m) => m.name!).filter(Boolean);
  } catch {
    return [];
  }
}

function resolveOllamaBin(): string | null {
  const candidates = [
    process.env.OLLAMA_BIN?.trim(),
    path.join(process.env.HOME ?? '', '.local/share/ollama-extract/ollama'),
    path.join(process.env.HOME ?? '', '.local/bin/ollama'),
    which('ollama') ?? undefined,
  ].filter((x): x is string => Boolean(x && x.length > 0));
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function ensureOllamaInstalled(): { installed: boolean; bin: string | null; notes: string[] } {
  const notes: string[] = [];
  const existing = resolveOllamaBin();
  if (existing) {
    notes.push(`ollama_found:${existing}`);
    return { installed: true, bin: existing, notes };
  }
  notes.push('ollama_absent_attempting_official_tarball');
  const extractDir = path.join(process.env.HOME ?? '', '.local/share/ollama-extract');
  try {
    fs.mkdirSync(extractDir, { recursive: true });
    const tgz = path.join(extractDir, 'ollama-darwin.tgz');
    if (!fs.existsSync(tgz)) {
      execFileSync(
        'curl',
        [
          '-L',
          '--fail',
          '-o',
          tgz,
          'https://github.com/ollama/ollama/releases/download/v0.34.4/ollama-darwin.tgz',
        ],
        { stdio: 'inherit' },
      );
    }
    execFileSync('tar', ['-xzf', tgz, '-C', extractDir], { stdio: 'inherit' });
    const bin = path.join(extractDir, 'ollama');
    if (fs.existsSync(bin)) {
      fs.chmodSync(bin, 0o755);
      notes.push(`ollama_installed:${bin}`);
      return { installed: true, bin, notes };
    }
    notes.push('ollama_tarball_extracted_but_binary_missing');
    return { installed: false, bin: null, notes };
  } catch (e) {
    notes.push(`ollama_install_failed:${e instanceof Error ? e.message : String(e)}`);
    return { installed: false, bin: null, notes };
  }
}

function ensureOllamaServing(bin: string, notes: string[]): void {
  try {
    const alive = execFileSync(
      'curl',
      ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://127.0.0.1:11434/api/tags'],
      { encoding: 'utf8' },
    ).trim();
    if (alive === '200') {
      notes.push('ollama_already_serving');
      return;
    }
  } catch {
    /* start */
  }
  notes.push(`starting_ollama_serve_from:${bin}`);
  const cwd = path.dirname(bin);
  const child = spawn(bin, ['serve'], {
    cwd,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function waitForServer(ms: number, notes: string[]): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await pingServer()) {
      notes.push('local_server_reachable');
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  notes.push('local_server_unreachable');
  return false;
}

function pullModelIfNeeded(bin: string, model: string, notes: string[]): boolean {
  const fit = evaluateHardwareFit({
    parameterBillions: PARAM_B,
    expectedMemoryGb: MEM_GB,
  });
  if (!fit.ok) {
    notes.push(`refused_pull:${fit.reason}`);
    return false;
  }
  try {
    notes.push(`pulling_model:${model}`);
    execFileSync(bin, ['pull', model], { stdio: 'inherit' });
    notes.push(`pulled_model:${model}`);
    return true;
  } catch (e) {
    notes.push(`pull_failed:${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

async function probeA(model: string): Promise<{ status: ProbeStatus; detail: string; elapsedMs: number }> {
  const res = await chatCompletions({
    model,
    messages: [
      { role: 'system', content: AGENT_DECISION_SYSTEM },
      {
        role: 'user',
        content:
          'Return ONLY a final_response AgentDecision JSON. text must be exactly: hello_probe_a. claims must be [].',
      },
    ],
    tools: [TOOL_SEARCH],
    response_format: { type: 'json_object' },
  });
  if (!res.ok) {
    return { status: 'FAIL', detail: `http_${res.status}:${res.rawText.slice(0, 200)}`, elapsedMs: res.elapsedMs };
  }
  const msg = res.json.choices?.[0]?.message;
  const parsed = parseDecisionFromContent(msg?.content);
  if (!parsed.ok) {
    if (Array.isArray(msg?.tool_calls) && msg!.tool_calls!.length > 0 && !msg?.content) {
      return {
        status: 'INCOMPATIBLE_WITH_CURRENT_ADAPTER',
        detail: 'native_tool_calls_empty_content',
        elapsedMs: res.elapsedMs,
      };
    }
    return { status: 'FAIL', detail: parsed.error ?? 'parse_fail', elapsedMs: res.elapsedMs };
  }
  const d = parsed.decision as { type: string; text?: string };
  if (d.type !== 'final_response') {
    return { status: 'FAIL', detail: `unexpected_type_${d.type}`, elapsedMs: res.elapsedMs };
  }
  return { status: 'PASS', detail: `text=${d.text ?? ''}`, elapsedMs: res.elapsedMs };
}

async function probeB(model: string): Promise<{ status: ProbeStatus; detail: string; elapsedMs: number }> {
  const res = await chatCompletions({
    model,
    messages: [
      { role: 'system', content: AGENT_DECISION_SYSTEM },
      {
        role: 'user',
        content:
          'Return ONLY a tool_request AgentDecision JSON for toolName searchServices with arguments {"query":"haircut"}. Do not answer the user directly.',
      },
    ],
    tools: [TOOL_SEARCH],
    response_format: { type: 'json_object' },
  });
  if (!res.ok) {
    return { status: 'FAIL', detail: `http_${res.status}:${res.rawText.slice(0, 200)}`, elapsedMs: res.elapsedMs };
  }
  const msg = res.json.choices?.[0]?.message;
  if (Array.isArray(msg?.tool_calls) && msg!.tool_calls!.length > 0 && (msg?.content == null || msg.content === '')) {
    return {
      status: 'INCOMPATIBLE_WITH_CURRENT_ADAPTER',
      detail: 'native_tool_calls_empty_content',
      elapsedMs: res.elapsedMs,
    };
  }
  const parsed = parseDecisionFromContent(msg?.content);
  if (!parsed.ok) {
    return { status: 'FAIL', detail: parsed.error ?? 'parse_fail', elapsedMs: res.elapsedMs };
  }
  const d = parsed.decision as { type: string; toolName?: string };
  if (d.type !== 'tool_request' || d.toolName !== 'searchServices') {
    return { status: 'FAIL', detail: `got_${JSON.stringify(d)}`, elapsedMs: res.elapsedMs };
  }
  return { status: 'PASS', detail: 'tool_request_searchServices', elapsedMs: res.elapsedMs };
}

async function probeC(model: string): Promise<{ status: ProbeStatus; detail: string; elapsedMs: number }> {
  const first = await chatCompletions({
    model,
    messages: [
      { role: 'system', content: AGENT_DECISION_SYSTEM },
      {
        role: 'user',
        content:
          'Return ONLY this exact shape (fill query): {"type":"tool_request","toolName":"searchServices","arguments":{"query":"massage"}}',
      },
    ],
    tools: [TOOL_SEARCH],
    response_format: { type: 'json_object' },
  });
  if (!first.ok) {
    return { status: 'FAIL', detail: `round1_http_${first.status}`, elapsedMs: first.elapsedMs };
  }
  const firstMsg = first.json.choices?.[0]?.message;
  if (
    Array.isArray(firstMsg?.tool_calls) &&
    firstMsg!.tool_calls!.length > 0 &&
    (firstMsg?.content == null || firstMsg.content === '')
  ) {
    return {
      status: 'INCOMPATIBLE_WITH_CURRENT_ADAPTER',
      detail: 'native_tool_calls_empty_content_round1',
      elapsedMs: first.elapsedMs,
    };
  }
  const firstParsed = parseDecisionFromContent(firstMsg?.content);
  if (!firstParsed.ok || (firstParsed.decision as { type: string }).type !== 'tool_request') {
    return {
      status: 'FAIL',
      detail: `round1_${firstParsed.error ?? 'not_tool_request'}`,
      elapsedMs: first.elapsedMs,
    };
  }

  const second = await chatCompletions({
    model,
    messages: [
      { role: 'system', content: AGENT_DECISION_SYSTEM },
      {
        role: 'user',
        content:
          'Return ONLY {"type":"tool_request","toolName":"searchServices","arguments":{"query":"massage"}}',
      },
      {
        role: 'assistant',
        content: JSON.stringify(firstParsed.decision),
      },
      {
        role: 'user',
        content:
          'Tool result for searchServices: [{"id":"svc_1","name":"Massage 60m","price":120}]. Return ONLY {"type":"final_response","text":"Massage 60m costs 120","claims":[]}',
      },
    ],
    tools: [TOOL_SEARCH],
    response_format: { type: 'json_object' },
  });
  const elapsedMs = first.elapsedMs + second.elapsedMs;
  if (!second.ok) {
    return { status: 'FAIL', detail: `round2_http_${second.status}`, elapsedMs };
  }
  const secondParsed = parseDecisionFromContent(second.json.choices?.[0]?.message?.content);
  if (!secondParsed.ok || (secondParsed.decision as { type: string }).type !== 'final_response') {
    return {
      status: 'FAIL',
      detail: `round2_${secondParsed.error ?? 'not_final_response'}`,
      elapsedMs,
    };
  }
  return { status: 'PASS', detail: 'tool_then_final', elapsedMs };
}

async function probeNativeToolCalls(model: string): Promise<{
  status: ProbeStatus;
  detail: string;
}> {
  /** Ask without response_format to see if server prefers native tool_calls. */
  const res = await chatCompletions({
    model,
    messages: [
      {
        role: 'user',
        content: 'Use the searchServices tool with query haircut. Do not answer without the tool.',
      },
    ],
    tools: [TOOL_SEARCH],
  });
  if (!res.ok) {
    return { status: 'SKIP', detail: `http_${res.status}` };
  }
  const msg = res.json.choices?.[0]?.message;
  const hasToolCalls = Array.isArray(msg?.tool_calls) && msg!.tool_calls!.length > 0;
  const contentEmpty = msg?.content == null || String(msg.content).trim() === '';
  if (hasToolCalls && contentEmpty) {
    return {
      status: 'INCOMPATIBLE_WITH_CURRENT_ADAPTER',
      detail: 'server_returns_native_tool_calls_with_empty_content',
    };
  }
  if (hasToolCalls && !contentEmpty) {
    const parsed = parseDecisionFromContent(msg?.content);
    if (parsed.ok) {
      return { status: 'PASS', detail: 'content_json_present_despite_tool_calls' };
    }
    return {
      status: 'INCOMPATIBLE_WITH_CURRENT_ADAPTER',
      detail: 'tool_calls_present_content_not_agent_decision',
    };
  }
  return { status: 'PASS', detail: 'no_native_only_tool_calls_observed' };
}

function writeReport(report: Report, extraMarkdown: string): void {
  const md = `# PRE-P14 REAL LLM ZERO-COST STATUS

Date: ${new Date().toISOString().slice(0, 10)}. Path B local OpenAI-compatible discovery + compatibility harness.
**P14_AUTHORIZED: NO.** No Meta. No billing. Expected new spend: 0.

## Readiness gates

\`\`\`text
ARCHITECTURALLY_AVAILABLE: ${report.ARCHITECTURALLY_AVAILABLE}
LOCAL_SERVER_INSTALLED: ${report.LOCAL_SERVER_INSTALLED}
LOCAL_SERVER_RUNNING: ${report.LOCAL_SERVER_RUNNING}
MODEL_INSTALLED: ${report.MODEL_INSTALLED}
MODEL_ID: ${report.MODEL_ID || '(none)'}
HARDWARE_FIT: ${report.HARDWARE_FIT}
HARDWARE_FIT_REASON: ${report.HARDWARE_FIT_REASON}
PROTOCOL_COMPATIBLE: ${report.PROTOCOL_COMPATIBLE}
PROBE_A: ${report.PROBE_A}
PROBE_B: ${report.PROBE_B}
PROBE_C: ${report.PROBE_C}
PROBE_NATIVE_TOOL_CALLS: ${report.PROBE_NATIVE_TOOL_CALLS}
ZERO_COST_REAL_LLM_READY: ${report.ZERO_COST_REAL_LLM_READY}
EXPECTED_NEW_SPEND: ${report.EXPECTED_NEW_SPEND}
P14_AUTHORIZED: ${report.P14_AUTHORIZED}
\`\`\`

## Hardware-fit gate (host class)

| Field | Value |
|-------|--------|
| HOST_CLASS | ${PATH_B_HARDWARE_FIT.hostClass} |
| MAX_PARAMETER_BILLIONS | ${PATH_B_HARDWARE_FIT.maxParameterBillions} |
| MAX_EXPECTED_MEMORY_GB | ${PATH_B_HARDWARE_FIT.maxExpectedMemoryGb} |
| PREFERRED_QUANT | ${PATH_B_HARDWARE_FIT.preferredQuant.join(', ')} |

Do not download models clearly above this gate.

## Config gaps

${report.CONFIG_CHANGE_REQUIRED.map((c) => `- ${c}`).join('\n') || '- (none)'}

## Probe notes

${report.NOTES.map((n) => `- ${n}`).join('\n') || '- (none)'}

${extraMarkdown}

## STOP

Do not enable Meta. Do not start Phase 14. Full agent E2E only after A+B+C PASS.
`;
  fs.mkdirSync(path.dirname(OUT_DOC), { recursive: true });
  fs.writeFileSync(OUT_DOC, md, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT_DOC}`);
}

async function main(): Promise<void> {
  if (!isApprovedLoopbackBaseUrl(BASE_URL)) {
    throw new Error(`probe_requires_loopback_base_url_got_${BASE_URL}`);
  }

  const notes: string[] = [`base_url=${BASE_URL}`, `probe_timeout_ms=${PROBE_TIMEOUT_MS}`];
  const fit = evaluateHardwareFit({ parameterBillions: PARAM_B, expectedMemoryGb: MEM_GB });
  notes.push(`hardware_fit_eval:${fit.reason}`);

  const report: Report = {
    ARCHITECTURALLY_AVAILABLE: 'YES',
    LOCAL_SERVER_INSTALLED: 'NO',
    LOCAL_SERVER_RUNNING: 'NO',
    MODEL_INSTALLED: 'NO',
    MODEL_ID: '',
    HARDWARE_FIT: fit.ok ? 'YES' : 'NO',
    HARDWARE_FIT_REASON: fit.reason,
    PROTOCOL_COMPATIBLE: 'NOT_TESTED',
    PROBE_A: 'SKIP',
    PROBE_B: 'SKIP',
    PROBE_C: 'SKIP',
    PROBE_NATIVE_TOOL_CALLS: 'SKIP',
    ZERO_COST_REAL_LLM_READY: 'NO',
    CONFIG_CHANGE_REQUIRED: [
      'IMPLEMENTED:local_timeout_override_via_AI_MODEL_LOCAL_TIMEOUTS_or_AI_MODEL_TIMEOUT_MS_on_loopback_only',
      'IMPLEMENTED:dummy_key_loopback_guard_in_resolveProductionProvider',
      'KNOWN:without_response_format_json_object_native_tool_calls_are_INCOMPATIBLE_WITH_CURRENT_ADAPTER',
    ],
    EXPECTED_NEW_SPEND: 0,
    P14_AUTHORIZED: 'NO',
    NOTES: notes,
  };

  if (!fit.ok) {
    notes.push('abort_before_model_download_hardware_unfit');
    report.NOTES = notes;
    writeReport(report, '## Abort\n\nHardware-fit gate failed; no model download attempted.\n');
    process.exitCode = 2;
    return;
  }

  let ollamaBin: string | null = null;
  if (await pingServer()) {
    report.LOCAL_SERVER_INSTALLED = 'YES';
    report.LOCAL_SERVER_RUNNING = 'YES';
    notes.push('local_server_already_running');
    ollamaBin = resolveOllamaBin();
  } else {
    const install = ensureOllamaInstalled();
    notes.push(...install.notes);
    report.LOCAL_SERVER_INSTALLED = install.installed ? 'YES' : 'NO';
    ollamaBin = install.bin;

    if (install.installed && ollamaBin) {
      ensureOllamaServing(ollamaBin, notes);
      const up = await waitForServer(45_000, notes);
      report.LOCAL_SERVER_RUNNING = up ? 'YES' : 'NO';
    }
  }

  let model = MODEL;
  if (report.LOCAL_SERVER_RUNNING === 'YES') {
    const existing = await listOllamaModels();
    notes.push(`ollama_models:${existing.join(',') || '(none)'}`);
    if (!model) {
      // Prefer already-installed small tags; otherwise pull smallest instruct-class probe candidate.
      const preferred = ['qwen2.5:7b', 'qwen2.5:1.5b', 'qwen2.5:3b', 'llama3.2:3b', 'gemma2:2b', 'phi3:mini'];
      model =
        preferred.find((p) => existing.some((e) => e === p || e.startsWith(`${p}`))) ?? '';
      if (!model && existing.length > 0) {
        model =
          existing.find((e) => /:([0-3]\.?[0-9]*b)\b/i.test(e) || /([123]b)/i.test(e)) ??
          existing[0] ??
          '';
      }
      if (!model && ollamaBin) {
        model = 'qwen2.5:1.5b';
        const pulled = pullModelIfNeeded(ollamaBin, model, notes);
        if (!pulled) model = '';
      }
    } else if (ollamaBin && !existing.some((e) => e === model || e.startsWith(`${model}`))) {
      pullModelIfNeeded(ollamaBin, model, notes);
    }
  }

  const modelsAfter = report.LOCAL_SERVER_RUNNING === 'YES' ? await listOllamaModels() : [];
  if (model && modelsAfter.some((e) => e === model || e.startsWith(model))) {
    report.MODEL_INSTALLED = 'YES';
    report.MODEL_ID = modelsAfter.find((e) => e === model || e.startsWith(model)) ?? model;
  } else if (model && report.LOCAL_SERVER_RUNNING === 'YES') {
    // may still work if tag differs slightly
    report.MODEL_ID = model;
    report.MODEL_INSTALLED = modelsAfter.length > 0 ? 'YES' : 'NO';
  }

  if (report.LOCAL_SERVER_RUNNING !== 'YES' || !report.MODEL_ID) {
    notes.push('probes_skipped_server_or_model_missing');
    report.NOTES = notes;
    writeReport(report, '## Probes\n\nSkipped — local server or model not ready.\n');
    process.exitCode = 1;
    return;
  }

  notes.push(`running_probes_model:${report.MODEL_ID}`);
  const a = await probeA(report.MODEL_ID);
  report.PROBE_A = a.status;
  notes.push(`probe_a=${a.status}:${a.detail}:elapsed_ms=${a.elapsedMs}`);
  if (a.elapsedMs > 15_000) {
    notes.push('CONFIG_NOTE:probe_a_exceeded_production_15s_model_timeout');
  }

  const b = await probeB(report.MODEL_ID);
  report.PROBE_B = b.status;
  notes.push(`probe_b=${b.status}:${b.detail}:elapsed_ms=${b.elapsedMs}`);

  const c = await probeC(report.MODEL_ID);
  report.PROBE_C = c.status;
  notes.push(`probe_c=${c.status}:${c.detail}:elapsed_ms=${c.elapsedMs}`);

  const n = await probeNativeToolCalls(report.MODEL_ID);
  report.PROBE_NATIVE_TOOL_CALLS = n.status;
  notes.push(`probe_native=${n.status}:${n.detail}`);

  const allPass = a.status === 'PASS' && b.status === 'PASS' && c.status === 'PASS';
  const anyIncompat = [a, b, c].some((p) => p.status === 'INCOMPATIBLE_WITH_CURRENT_ADAPTER');
  report.PROTOCOL_COMPATIBLE = allPass ? 'YES' : anyIncompat ? 'NO' : 'NO';
  report.ZERO_COST_REAL_LLM_READY =
    allPass &&
    report.LOCAL_SERVER_INSTALLED === 'YES' &&
    report.LOCAL_SERVER_RUNNING === 'YES' &&
    report.MODEL_INSTALLED === 'YES' &&
    report.HARDWARE_FIT === 'YES'
      ? 'YES'
      : 'NO';

  report.NOTES = notes;
  writeReport(
    report,
    `## Probe detail\n\n| Probe | Status | Detail |\n|-------|--------|--------|\n| A | ${a.status} | ${a.detail} (${a.elapsedMs}ms) |\n| B | ${b.status} | ${b.detail} (${b.elapsedMs}ms) |\n| C | ${c.status} | ${c.detail} (${c.elapsedMs}ms) |\n| Native tool_calls | ${n.status} | ${n.detail} |\n`,
  );

  process.exitCode = allPass ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
