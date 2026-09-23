import { createHash } from 'node:crypto';

export interface RunKeyInput {
  organizationId: string;
  conversationId: string;
  targetIngressSequence: number;
  ownershipEpoch: number;
  agentConfigVersionId: string;
}

/** Deterministic logical AgentRun identity (not a random UUID). */
export function buildRunKey(input: RunKeyInput): string {
  const canonical = [
    input.organizationId,
    input.conversationId,
    String(input.targetIngressSequence),
    String(input.ownershipEpoch),
    input.agentConfigVersionId,
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

export function buildOperationKey(input: {
  runKey: string;
  toolCallOrdinal: number;
  toolName: string;
  toolVersion: string;
  normalizedArgsHash: string;
}): string {
  const canonical = [
    input.runKey,
    String(input.toolCallOrdinal),
    input.toolName,
    input.toolVersion,
    input.normalizedArgsHash,
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

export function hashNormalizedArgs(args: Record<string, unknown>): string {
  const sorted = JSON.stringify(args, Object.keys(args).sort());
  return createHash('sha256').update(sorted).digest('hex');
}
