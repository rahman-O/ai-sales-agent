/**
 * Zero-cost PATH B demo: fail-closed scripted model provider.
 * Enabled ONLY when NODE_ENV!==production AND AI_ALLOW_FAKE===true AND ZERO_COST_DEMO===1.
 */
import type { AgentDecision } from '@ai-sales-agent/contracts';
import type { ModelGenerateInput, ModelGenerateResult, ModelProvider } from './ports.js';

export const DEMO_SCENARIO_VERSION = 'p14-path-b-v1';

export type DemoScenarioId =
  | 'FAQ'
  | 'INTENT_BOOK'
  | 'ASK_AVAILABILITY'
  | 'CONFIRM_BOOKING'
  | 'FOLLOWUP_TEST'
  | 'UNKNOWN';

/** Exact normalized phrases / markers (no fuzzy includes). */
const MARKERS: Record<Exclude<DemoScenarioId, 'UNKNOWN'>, readonly string[]> = {
  FAQ: ['[demo:faq]', 'hi, what services do you offer?'],
  INTENT_BOOK: ['[demo:intent-book]', 'i want to book a dental consultation.'],
  ASK_AVAILABILITY: ['[demo:availability]', 'what appointments are available?'],
  CONFIRM_BOOKING: ['[demo:confirm-booking]', 'book the first available appointment.'],
  FOLLOWUP_TEST: ['[demo:followup]', '[demo:follow-up]'],
};

export function isZeroCostDemoScriptedEnabled(
  env: NodeJS.ProcessEnv = process.env,
): { enabled: boolean; reason: string } {
  if (env.NODE_ENV === 'production') {
    return { enabled: false, reason: 'production_blocks_scripted_demo' };
  }
  if (env.AI_ALLOW_FAKE !== 'true') {
    return { enabled: false, reason: 'AI_ALLOW_FAKE_required' };
  }
  if (env.ZERO_COST_DEMO !== '1') {
    return { enabled: false, reason: 'ZERO_COST_DEMO_required' };
  }
  return { enabled: true, reason: 'ok' };
}

export function normalizeDemoInbound(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveDemoScenario(inboundText: string): DemoScenarioId {
  const n = normalizeDemoInbound(inboundText);
  for (const [id, phrases] of Object.entries(MARKERS) as Array<
    [Exclude<DemoScenarioId, 'UNKNOWN'>, readonly string[]]
  >) {
    for (const p of phrases) {
      if (p.startsWith('[demo:') && n.includes(p)) return id;
      if (n === p) return id;
    }
  }
  return 'UNKNOWN';
}

type SlotRow = {
  slotToken?: unknown;
  staffMemberId?: unknown;
  serviceId?: unknown;
  startsAt?: unknown;
};

/**
 * Extract first slotToken ONLY from a structured successful getAvailableSlots tool result.
 * Tool message shape from orchestrator: { ok, code, data: { slots, timezone } }
 * Preceding assistant message: { type: 'tool_request', toolName }
 */
export function extractSlotTokenFromStructuredGetAvailableSlots(
  messages: ModelGenerateInput['messages'],
): string | null {
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || m.role !== 'tool') continue;
    const prev = messages[i - 1];
    let toolName: string | null = null;
    if (prev?.role === 'assistant') {
      try {
        const parsed = JSON.parse(prev.content) as { type?: string; toolName?: string };
        if (parsed?.type === 'tool_request' && typeof parsed.toolName === 'string') {
          toolName = parsed.toolName;
        }
      } catch {
        toolName = null;
      }
    }
    if (toolName !== 'getAvailableSlots') continue;
    try {
      const body = JSON.parse(m.content) as {
        ok?: boolean;
        code?: string;
        data?: { slots?: SlotRow[]; schemaVersion?: string };
      };
      if (body.ok !== true) continue;
      if (body.code != null && body.code !== 'OK') continue;
      const slots = body.data?.slots;
      if (!Array.isArray(slots) || slots.length === 0) continue;
      const token = slots[0]?.slotToken;
      if (typeof token === 'string' && token.length > 10) return token;
    } catch {
      continue;
    }
  }
  return null;
}

export type DemoScriptContext = {
  /** Inbound message id at targetIngressSequence — for createBooking confirmationMessageId */
  confirmationMessageId: string | null;
  /** Fixture service id from demo env */
  serviceId: string | null;
  /** Latest customer inbound text */
  inboundText: string;
};

/**
 * Multi-step scripted Fake for PATH B. Must only be constructed when isZeroCostDemoScriptedEnabled().enabled.
 */
export class ZeroCostDemoScriptedProvider implements ModelProvider {
  readonly id = 'fake';
  private calls = 0;
  readonly scenario: DemoScenarioId;

  constructor(
    private readonly ctx: DemoScriptContext,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    const gate = isZeroCostDemoScriptedEnabled(env);
    if (!gate.enabled) {
      throw new Error(`scripted_demo_provider_unavailable:${gate.reason}`);
    }
    this.scenario = resolveDemoScenario(ctx.inboundText);
  }

  async generate(input: ModelGenerateInput): Promise<ModelGenerateResult> {
    this.calls += 1;
    const decision = this.nextDecision(input);
    return {
      decision,
      finishReason: 'stop',
      usage: { inputTokens: 8, outputTokens: 16, estimated: false },
      providerRequestId: `demo-${DEMO_SCENARIO_VERSION}-${this.scenario}-${this.calls}`,
      model: 'fake-demo-script',
    };
  }

  private nextDecision(input: ModelGenerateInput): AgentDecision {
    const { scenario } = this;
    if (scenario === 'FAQ' || scenario === 'UNKNOWN' || scenario === 'FOLLOWUP_TEST') {
      return {
        type: 'final_response',
        text:
          scenario === 'FAQ'
            ? 'We offer dental consultations. Ask to book or request available appointments.'
            : 'How can I help you today?',
        claims: [],
      };
    }

    if (scenario === 'INTENT_BOOK') {
      if (this.calls === 1) {
        const args: Record<string, unknown> = {
          needSummary: 'Dental consultation interest',
          language: 'en',
        };
        if (this.ctx.serviceId) args.serviceId = this.ctx.serviceId;
        return { type: 'tool_request', toolName: 'ensureLead', arguments: args };
      }
      return {
        type: 'final_response',
        text: 'I can help you book a dental consultation. Ask what appointments are available.',
        claims: [],
      };
    }

    if (scenario === 'ASK_AVAILABILITY') {
      if (this.calls === 1) {
        if (!this.ctx.serviceId) {
          return { type: 'safe_stop', reason: 'demo_service_id_missing' };
        }
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60_000);
        return {
          type: 'tool_request',
          toolName: 'getAvailableSlots',
          arguments: {
            serviceId: this.ctx.serviceId,
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10),
            limit: 5,
          },
        };
      }
      const token = extractSlotTokenFromStructuredGetAvailableSlots(input.messages);
      return {
        type: 'final_response',
        text: token
          ? 'I found available appointments. Reply to book the first available appointment.'
          : 'No available slots in the requested window.',
        claims: [],
      };
    }

    if (scenario === 'CONFIRM_BOOKING') {
      // Same-run: getAvailableSlots then createBooking from structured tool result only.
      if (this.calls === 1) {
        if (!this.ctx.serviceId) {
          return { type: 'safe_stop', reason: 'demo_service_id_missing' };
        }
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60_000);
        return {
          type: 'tool_request',
          toolName: 'getAvailableSlots',
          arguments: {
            serviceId: this.ctx.serviceId,
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10),
            limit: 5,
          },
        };
      }
      if (this.calls === 2) {
        const slotToken = extractSlotTokenFromStructuredGetAvailableSlots(input.messages);
        if (!slotToken) {
          return { type: 'safe_stop', reason: 'demo_no_structured_slot_token' };
        }
        if (!this.ctx.confirmationMessageId) {
          return { type: 'safe_stop', reason: 'demo_confirmation_message_missing' };
        }
        return {
          type: 'tool_request',
          toolName: 'createBooking',
          arguments: {
            slotToken,
            confirmationMessageId: this.ctx.confirmationMessageId,
          },
        };
      }
      return {
        type: 'final_response',
        text: 'Your dental consultation is confirmed.',
        claims: [],
      };
    }

    return { type: 'safe_stop', reason: 'demo_unhandled_scenario' };
  }
}

export function tryCreateZeroCostDemoProvider(
  ctx: DemoScriptContext,
  env: NodeJS.ProcessEnv = process.env,
): ZeroCostDemoScriptedProvider | null {
  const gate = isZeroCostDemoScriptedEnabled(env);
  if (!gate.enabled) return null;
  return new ZeroCostDemoScriptedProvider(ctx, env);
}
