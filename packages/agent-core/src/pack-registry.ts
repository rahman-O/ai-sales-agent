import {
  BusinessPackDefinition,
  BusinessPackDefinitionSchema,
  PackApplicationMode,
  PackPreviewDto,
  PackPreviewItem,
  PackDiffAction,
  parseBusinessPolicyRules,
  DEFAULT_ORGANIZATION_CAPABILITIES,
  DEFAULT_CONVERSATION_PROFILE,
} from '@ai-sales-agent/contracts';
import {
  CLINIC_PACK,
  SALON_PACK,
  REAL_ESTATE_PACK,
  RESTAURANT_PACK,
  PROFESSIONAL_SERVICES_PACK,
  REPRESENTATIVE_BUSINESS_PACKS,
} from './pack-definitions.js';

const PACK_REGISTRY_MAP = new Map<string, BusinessPackDefinition>();

// Register representative packs
for (const pack of REPRESENTATIVE_BUSINESS_PACKS) {
  validateBusinessPack(pack);
  PACK_REGISTRY_MAP.set(pack.id.toUpperCase(), pack);
}

/**
 * Validates a business pack definition for schema compliance, uniqueness of starter keys,
 * valid policy rules, and lack of unsafe instructions.
 */
export function validateBusinessPack(pack: BusinessPackDefinition): void {
  BusinessPackDefinitionSchema.parse(pack);

  // Validate policy rules
  const policyKeys = new Set<string>();
  for (const policy of pack.policyTemplates) {
    if (policyKeys.has(policy.starterKey)) {
      throw new Error(`Duplicate policy starter key detected: ${policy.starterKey}`);
    }
    policyKeys.add(policy.starterKey);
    // Ensure rules parse cleanly with policy-specific parser
    parseBusinessPolicyRules(policy.policyType, policy.rulesJson);
  }

  // Validate knowledge starters
  const knowledgeKeys = new Set<string>();
  for (const doc of pack.knowledgeStarters) {
    if (knowledgeKeys.has(doc.starterKey)) {
      throw new Error(`Duplicate knowledge starter key detected: ${doc.starterKey}`);
    }
    knowledgeKeys.add(doc.starterKey);
  }

  // Validate catalog starters
  const catalogKeys = new Set<string>();
  for (const item of pack.catalogStarters) {
    if (catalogKeys.has(item.starterKey)) {
      throw new Error(`Duplicate catalog starter key detected: ${item.starterKey}`);
    }
    catalogKeys.add(item.starterKey);
  }

  // Validate safety of custom instructions if provided
  if (pack.conversationProfileDefaults?.customInstructions) {
    const dangerousPatterns = [
      /ignore\s+policy/i,
      /always\s+discount/i,
      /book\s+automatically/i,
      /api[_-]?key/i,
      /password/i,
      /secret/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(pack.conversationProfileDefaults.customInstructions)) {
        throw new Error(
          `Pack contains unsafe instruction matching ${pattern}: ${pack.conversationProfileDefaults.customInstructions}`,
        );
      }
    }
  }
}

/**
 * Retrieves a BusinessPack by ID (case-insensitive).
 */
export function getBusinessPack(id: string): BusinessPackDefinition | null {
  if (!id) return null;
  return PACK_REGISTRY_MAP.get(id.trim().toUpperCase()) ?? null;
}

/**
 * Returns all registered BusinessPacks.
 */
export function listBusinessPacks(): BusinessPackDefinition[] {
  return Array.from(PACK_REGISTRY_MAP.values());
}

export interface ExistingOrgStateForPreview {
  capabilities?: Record<string, boolean> | null;
  conversationProfile?: Record<string, unknown> | null;
  policies?: Array<{
    starterKey?: string | null;
    policyType: string;
    status: string;
  }>;
  knowledgeDocuments?: Array<{
    starterKey?: string | null;
    title: string;
    status: string;
  }>;
  catalogItems?: Array<{
    starterKey?: string | null;
    name: string;
    kind: string;
  }>;
}

/**
 * Pure, side-effect free preview calculator for applying a pack to an organization.
 */
export function previewBusinessPackApplication(
  pack: BusinessPackDefinition,
  existingState: ExistingOrgStateForPreview,
  mode: PackApplicationMode = 'PREVIEW_ONLY',
): PackPreviewDto {
  const items: PackPreviewItem[] = [];

  // 1. Capabilities Diff
  const currentCaps = existingState.capabilities ?? (DEFAULT_ORGANIZATION_CAPABILITIES as Record<string, boolean>);
  for (const [key, proposedVal] of Object.entries(pack.recommendedCapabilities)) {
    const currentVal = currentCaps[key];
    if (currentVal === undefined) {
      items.push({
        category: 'CAPABILITY',
        key,
        action: 'WILL_CREATE',
        proposedVal,
        reason: `Capability ${key} will be initialized to ${proposedVal}`,
      });
    } else if (currentVal === proposedVal) {
      items.push({
        category: 'CAPABILITY',
        key,
        action: 'NO_CHANGE',
        currentVal,
        proposedVal,
        reason: `Capability ${key} already matches recommended value (${proposedVal})`,
      });
    } else {
      items.push({
        category: 'CAPABILITY',
        key,
        action: mode === 'INITIAL_SETUP' ? 'WILL_UPDATE_IF_MISSING' : 'CONFLICT',
        currentVal,
        proposedVal,
        reason: `Capability ${key} is currently ${currentVal}, pack recommends ${proposedVal}`,
      });
    }
  }

  // 2. Conversation Profile Diff
  const hasExistingProfile = !!existingState.conversationProfile;
  if (!hasExistingProfile) {
    items.push({
      category: 'CONVERSATION_PROFILE',
      key: 'conversation_profile',
      action: 'WILL_CREATE',
      proposedVal: pack.conversationProfileDefaults,
      reason: 'Will initialize conversation profile with pack style defaults',
    });
  } else {
    items.push({
      category: 'CONVERSATION_PROFILE',
      key: 'conversation_profile',
      action: 'WILL_SKIP',
      currentVal: existingState.conversationProfile,
      proposedVal: pack.conversationProfileDefaults,
      reason: 'Existing customized conversation profile preserved without overwriting',
    });
  }

  // 3. Policies Diff
  const existingStarterKeys = new Set(
    (existingState.policies ?? [])
      .map((p) => p.starterKey)
      .filter((k): k is string => !!k),
  );
  const existingActivePolicyTypes = new Set(
    (existingState.policies ?? [])
      .filter((p) => p.status === 'ACTIVE')
      .map((p) => p.policyType),
  );

  for (const template of pack.policyTemplates) {
    if (existingStarterKeys.has(template.starterKey)) {
      items.push({
        category: 'POLICY',
        key: template.starterKey,
        action: 'WILL_SKIP',
        reason: `Policy starter with key ${template.starterKey} already exists`,
      });
    } else if (existingActivePolicyTypes.has(template.policyType)) {
      items.push({
        category: 'POLICY',
        key: template.starterKey,
        action: 'CONFLICT',
        proposedVal: template,
        reason: `Active policy for ${template.policyType} already exists. Starter will be created in DRAFT.`,
      });
    } else {
      items.push({
        category: 'POLICY',
        key: template.starterKey,
        action: 'WILL_CREATE',
        proposedVal: template,
        reason: `Will create draft policy template for ${template.policyType} (${template.starterKey})`,
      });
    }
  }

  // 4. Knowledge Starters Diff
  const existingDocKeys = new Set(
    (existingState.knowledgeDocuments ?? [])
      .map((d) => d.starterKey)
      .filter((k): k is string => !!k),
  );

  for (const starter of pack.knowledgeStarters) {
    if (existingDocKeys.has(starter.starterKey)) {
      items.push({
        category: 'KNOWLEDGE',
        key: starter.starterKey,
        action: 'WILL_SKIP',
        reason: `Knowledge starter with key ${starter.starterKey} already exists`,
      });
    } else {
      items.push({
        category: 'KNOWLEDGE',
        key: starter.starterKey,
        action: 'WILL_CREATE',
        proposedVal: starter,
        reason: `Will create draft knowledge document "${starter.title}"`,
      });
    }
  }

  // 5. Catalog Starters Diff
  const existingCatalogKeys = new Set(
    (existingState.catalogItems ?? [])
      .map((c) => c.starterKey)
      .filter((k): k is string => !!k),
  );

  for (const starter of pack.catalogStarters) {
    if (existingCatalogKeys.has(starter.starterKey)) {
      items.push({
        category: 'CATALOG',
        key: starter.starterKey,
        action: 'WILL_SKIP',
        reason: `Catalog starter with key ${starter.starterKey} already exists`,
      });
    } else {
      items.push({
        category: 'CATALOG',
        key: starter.starterKey,
        action: 'WILL_CREATE',
        proposedVal: starter,
        reason: `Will create draft catalog item "${starter.name}"`,
      });
    }
  }

  // Summary counts
  const summary = {
    willCreate: items.filter((i) => i.action === 'WILL_CREATE').length,
    willUpdate: items.filter((i) => i.action === 'WILL_UPDATE_IF_MISSING').length,
    willSkip: items.filter((i) => i.action === 'WILL_SKIP').length,
    conflicts: items.filter((i) => i.action === 'CONFLICT').length,
    noChange: items.filter((i) => i.action === 'NO_CHANGE').length,
  };

  return {
    packId: pack.id,
    packVersion: pack.version,
    packName: pack.name,
    mode,
    items,
    summary,
  };
}
