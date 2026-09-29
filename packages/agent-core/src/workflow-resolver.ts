import type {
  AgentIntent,
  IntentClassification,
  WorkflowId,
  WorkflowResolutionResult,
  WorkflowStage,
} from '@ai-sales-agent/contracts';
import type {
  ConversationWorkingStateData,
  OrganizationCapabilitiesSnapshot,
} from './ports.js';
import {
  WORKFLOW_DEFINITIONS,
  findWorkflowForIntent,
} from './workflow-registry.js';

export interface WorkflowResolutionInput {
  capabilities?: OrganizationCapabilitiesSnapshot | null;
  intent: IntentClassification;
  workingState?: ConversationWorkingStateData;
  executionMode?: 'PRODUCTION' | 'PREVIEW';
  configuredToolAllowlist?: readonly string[];
}

export function resolveWorkflow(input: WorkflowResolutionInput): WorkflowResolutionResult {
  const caps = input.capabilities ?? {};
  const intent = input.intent;
  const state = input.workingState ?? {};
  const allowlist = new Set(input.configuredToolAllowlist ?? []);

  // 1. Identify matching workflow definition
  let def = findWorkflowForIntent(intent.primary);
  if (!def) {
    def = WORKFLOW_DEFINITIONS.GENERAL_SUPPORT;
  }

  // 2. Check capability requirements
  const missingCaps: string[] = [];
  for (const capKey of def.requiredCapabilities) {
    if ((caps as any)[capKey] !== true) {
      missingCaps.push(capKey);
    }
  }

  if (missingCaps.length > 0) {
    return {
      workflowId: def.id,
      supported: false,
      executable: false,
      reason: `MISSING_REQUIRED_CAPABILITY: ${missingCaps.join(', ')}`,
      stage: 'INITIAL',
      allowedTools: [],
      blockedMutationTools: [...def.mutationTools],
      missingCapabilities: missingCaps,
      missingPrerequisites: [],
    };
  }

  // 3. Check if workflow is marked executable (e.g. QUOTE & PURCHASE reserved for MB-12)
  if (!def.isExecutable) {
    return {
      workflowId: def.id,
      supported: true,
      executable: false,
      reason: 'WORKFLOW_NOT_IMPLEMENTED',
      stage: 'INITIAL',
      allowedTools: [],
      blockedMutationTools: [...def.mutationTools],
      missingCapabilities: [],
      missingPrerequisites: [],
    };
  }

  // 4. Determine stage from current working state
  let stage: WorkflowStage = 'INITIAL';
  if (def.id === 'BOOKING') {
    if (state.lastConfirmedBookingId) {
      stage = 'COMPLETED';
    } else if (state.candidateSlots && state.candidateSlots.length > 0) {
      stage = 'AWAITING_SLOT_SELECTION';
    } else if (state.selectedEntity?.entityId) {
      stage = 'IN_PROGRESS';
    } else {
      stage = 'INITIAL';
    }
  } else if (def.id === 'LEAD_CAPTURE') {
    if (state.selectedEntity?.entityId) {
      stage = 'IN_PROGRESS';
    } else {
      stage = 'INITIAL';
    }
  } else {
    stage = 'IN_PROGRESS';
  }

  // 5. Compute effective tool allowlist: GLOBAL ∩ CAPABILITIES ∩ WORKFLOW ALLOWLIST
  const effectiveAllowedTools = def.allowedTools.filter((tool) => {
    if (allowlist.size > 0 && !allowlist.has(tool)) {
      return false;
    }
    // Booking tools check
    if (['getAvailableSlots', 'createBooking', 'cancelBooking', 'rescheduleBooking'].includes(tool)) {
      if (caps.supportsBooking === false) return false;
    }
    // Lead tools check
    if (['ensureLead', 'updateLeadQualification', 'getLead', 'transitionLead'].includes(tool)) {
      if (caps.supportsLeads === false) return false;
    }
    // Offer tools check
    if (tool === 'getActiveOffers') {
      if (caps.supportsOffers === false) return false;
    }
    return true;
  });

  const blockedMutations = def.mutationTools.filter((t) => !effectiveAllowedTools.includes(t));

  return {
    workflowId: def.id,
    supported: true,
    executable: true,
    stage,
    allowedTools: effectiveAllowedTools,
    blockedMutationTools: blockedMutations,
    missingCapabilities: [],
    missingPrerequisites: [],
  };
}
