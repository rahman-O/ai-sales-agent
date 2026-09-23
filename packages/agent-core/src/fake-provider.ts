import { AgentDecisionSchema, type AgentDecision } from '@ai-sales-agent/contracts';
import type { ModelGenerateInput, ModelGenerateResult, ModelProvider } from './ports.js';

export type FakeScenario =
  | { kind: 'final'; text: string }
  | { kind: 'tool_then_final'; toolName: string; args: Record<string, unknown>; text: string }
  | { kind: 'malformed' }
  | { kind: 'unknown_tool' }
  | { kind: 'timeout' }
  | { kind: 'transient_fail'; times: number }
  | { kind: 'permanent_fail' }
  | { kind: 'loop_tool'; toolName: string; args: Record<string, unknown> };

/**
 * Deterministic test/dev provider. Must never be selected as production fallback.
 */
export class FakeModelProvider implements ModelProvider {
  readonly id = 'fake';
  private calls = 0;
  private transientLeft = 0;

  constructor(private scenario: FakeScenario) {
    if (scenario.kind === 'transient_fail') this.transientLeft = scenario.times;
  }

  async generate(_input: ModelGenerateInput): Promise<ModelGenerateResult> {
    this.calls += 1;
    if (this.scenario.kind === 'timeout') {
      throw Object.assign(new Error('provider_timeout'), { code: 'TIMEOUT', retryable: true });
    }
    if (this.scenario.kind === 'permanent_fail') {
      throw Object.assign(new Error('provider_permanent'), { code: 'PERMANENT', retryable: false });
    }
    if (this.scenario.kind === 'transient_fail') {
      if (this.transientLeft > 0) {
        this.transientLeft -= 1;
        throw Object.assign(new Error('provider_transient'), { code: 'TRANSIENT', retryable: true });
      }
    }
    if (this.scenario.kind === 'malformed') {
      return {
        decision: { not: 'a decision' },
        finishReason: 'error',
        usage: { estimated: true },
        providerRequestId: `fake-${this.calls}`,
        model: 'fake',
      };
    }

    let decision: AgentDecision;
    if (this.scenario.kind === 'final' || (this.scenario.kind === 'transient_fail' && this.transientLeft === 0)) {
      const text = this.scenario.kind === 'final' ? this.scenario.text : 'ok after retry';
      decision = { type: 'final_response', text, claims: [] };
    } else if (this.scenario.kind === 'tool_then_final') {
      if (this.calls === 1) {
        decision = {
          type: 'tool_request',
          toolName: this.scenario.toolName,
          arguments: this.scenario.args,
        };
      } else {
        decision = { type: 'final_response', text: this.scenario.text, claims: [] };
      }
    } else if (this.scenario.kind === 'unknown_tool') {
      decision = { type: 'tool_request', toolName: 'dropDatabase', arguments: {} };
    } else if (this.scenario.kind === 'loop_tool') {
      decision = {
        type: 'tool_request',
        toolName: this.scenario.toolName,
        arguments: this.scenario.args,
      };
    } else {
      decision = { type: 'safe_stop', reason: 'unconfigured_scenario' };
    }

    return {
      decision,
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, estimated: false },
      providerRequestId: `fake-${this.calls}`,
      model: 'fake',
    };
  }
}

export function parseAgentDecision(raw: unknown): AgentDecision {
  return AgentDecisionSchema.parse(raw);
}
