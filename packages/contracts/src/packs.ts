import { z } from 'zod';
import { OrganizationCapabilitiesDto, DEFAULT_ORGANIZATION_CAPABILITIES } from './organization.js';
import { BusinessPolicyType, BusinessPolicyTypeSchema, parseBusinessPolicyRules } from './policies.js';
import { KnowledgeSourceType, KnowledgeVisibility, KnowledgeSourceStatus, KnowledgeSourceTypeEnum, KnowledgeVisibilityEnum, KnowledgeSourceStatusEnum } from './knowledge.js';
import { CatalogItemKind, CatalogItemStatus, CatalogItemKindSchema, CatalogItemStatusSchema } from './catalog.js';
import { ConversationProfileDto, ToneEnum, FormalityEnum, ResponseLengthEnum, SalesStyleEnum, EmojiUsageEnum, CustomerNameUsageEnum, GreetingStyleEnum, HandoffStyleEnum, DialectEnum } from './conversation-profile.js';

export const BUSINESS_PACK_IDS = [
  'CLINIC',
  'SALON',
  'REAL_ESTATE',
  'RESTAURANT',
  'PROFESSIONAL_SERVICES',
] as const;
export const BusinessPackIdSchema = z.enum(BUSINESS_PACK_IDS);
export type BusinessPackId = (typeof BUSINESS_PACK_IDS)[number];

export const PACK_APPLICATION_MODES = [
  'INITIAL_SETUP',
  'MERGE_MISSING',
  'PREVIEW_ONLY',
] as const;
export const PackApplicationModeSchema = z.enum(PACK_APPLICATION_MODES);
export type PackApplicationMode = (typeof PACK_APPLICATION_MODES)[number];

export const PACK_DIFF_ACTIONS = [
  'WILL_CREATE',
  'WILL_UPDATE_IF_MISSING',
  'WILL_SKIP',
  'CONFLICT',
  'NO_CHANGE',
] as const;
export const PackDiffActionSchema = z.enum(PACK_DIFF_ACTIONS);
export type PackDiffAction = (typeof PACK_DIFF_ACTIONS)[number];

export interface BusinessPackPolicyStarter {
  starterKey: string;
  policyType: BusinessPolicyType;
  title: string;
  summary: string;
  rulesJson: Record<string, unknown>;
  enforcementMode: 'ENFORCEABLE' | 'INFORMATIONAL_ONLY';
  status: 'DRAFT' | 'ACTIVE';
}

export interface BusinessPackKnowledgeStarter {
  starterKey: string;
  title: string;
  sourceType: KnowledgeSourceType;
  visibility: KnowledgeVisibility;
  content: string;
  status: KnowledgeSourceStatus;
}

export interface BusinessPackCatalogStarter {
  starterKey: string;
  kind: CatalogItemKind;
  name: string;
  description?: string;
  status: CatalogItemStatus;
  amountMinor?: number | null;
  currency?: string | null;
  needsReview?: boolean;
}

export interface BusinessPackDefinition {
  id: BusinessPackId;
  version: string;
  name: string;
  description: string;
  category: string;
  recommendedCapabilities: Partial<OrganizationCapabilitiesDto>;
  onboardingDefaults?: {
    defaultLanguage?: string;
    defaultCurrency?: string;
    timezone?: string;
  };
  conversationProfileDefaults?: Partial<
    Omit<ConversationProfileDto, 'organizationId' | 'createdAt' | 'updatedAt'>
  >;
  policyTemplates: BusinessPackPolicyStarter[];
  knowledgeStarters: BusinessPackKnowledgeStarter[];
  catalogStarters: BusinessPackCatalogStarter[];
  metadata?: Record<string, unknown>;
}

export interface PackPreviewItem {
  category: 'CAPABILITY' | 'CONVERSATION_PROFILE' | 'POLICY' | 'KNOWLEDGE' | 'CATALOG';
  key: string;
  action: PackDiffAction;
  currentVal?: unknown;
  proposedVal?: unknown;
  reason?: string;
}

export interface PackPreviewDto {
  packId: string;
  packVersion: string;
  packName: string;
  mode: PackApplicationMode;
  items: PackPreviewItem[];
  summary: {
    willCreate: number;
    willUpdate: number;
    willSkip: number;
    conflicts: number;
    noChange: number;
  };
}

export interface PackApplyResultDto {
  packId: string;
  packVersion: string;
  mode: PackApplicationMode;
  appliedAt: string;
  created: {
    capabilities: number;
    policies: number;
    knowledgeSources: number;
    catalogItems: number;
    conversationProfile: boolean;
  };
  skipped: {
    existingProfile: boolean;
    existingPolicies: number;
    existingKnowledge: number;
    existingCatalog: number;
  };
  warnings: string[];
}

export const PreviewBusinessPackSchema = z.object({
  packId: z.string().min(1).max(100),
  mode: PackApplicationModeSchema.optional().default('PREVIEW_ONLY'),
});

export const ApplyBusinessPackSchema = z.object({
  packId: z.string().min(1).max(100),
  mode: z.enum(['INITIAL_SETUP', 'MERGE_MISSING']).optional().default('INITIAL_SETUP'),
});

// Schema for validating BusinessPackDefinition at build/registration time
export const BusinessPackDefinitionSchema = z.object({
  id: BusinessPackIdSchema,
  version: z.string().min(1).regex(/^[a-z0-9_.-]+$/i),
  name: z.string().min(1).max(150),
  description: z.string().min(1).max(500),
  category: z.string().min(1).max(100),
  recommendedCapabilities: z.record(z.string(), z.boolean()),
  onboardingDefaults: z.object({
    defaultLanguage: z.string().max(10).optional(),
    defaultCurrency: z.string().max(10).optional(),
    timezone: z.string().max(50).optional(),
  }).optional(),
  conversationProfileDefaults: z.object({
    assistantName: z.string().nullable().optional(),
    primaryLanguage: z.string().optional(),
    dialect: DialectEnum.optional(),
    tone: ToneEnum.optional(),
    formality: FormalityEnum.optional(),
    responseLength: ResponseLengthEnum.optional(),
    salesStyle: SalesStyleEnum.optional(),
    emojiUsage: EmojiUsageEnum.optional(),
    customerNameUsage: CustomerNameUsageEnum.optional(),
    questionsPerTurn: z.number().int().min(1).max(3).optional(),
    greetingStyle: GreetingStyleEnum.optional(),
    handoffStyle: HandoffStyleEnum.optional(),
    customInstructions: z.string().nullable().optional(),
  }).optional(),
  policyTemplates: z.array(
    z.object({
      starterKey: z.string().min(1).regex(/^[a-z0-9_.-]+$/i),
      policyType: BusinessPolicyTypeSchema,
      title: z.string().min(1).max(200),
      summary: z.string().min(1).max(1000),
      rulesJson: z.record(z.string(), z.unknown()),
      enforcementMode: z.enum(['ENFORCEABLE', 'INFORMATIONAL_ONLY']),
      status: z.enum(['DRAFT', 'ACTIVE']),
    }),
  ),
  knowledgeStarters: z.array(
    z.object({
      starterKey: z.string().min(1).regex(/^[a-z0-9_.-]+$/i),
      title: z.string().min(1).max(200),
      sourceType: KnowledgeSourceTypeEnum,
      visibility: KnowledgeVisibilityEnum,
      content: z.string().min(1).max(50_000),
      status: KnowledgeSourceStatusEnum,
    }),
  ),
  catalogStarters: z.array(
    z.object({
      starterKey: z.string().min(1).regex(/^[a-z0-9_.-]+$/i),
      kind: CatalogItemKindSchema,
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      status: CatalogItemStatusSchema,
      amountMinor: z.number().int().nullable().optional(),
      currency: z.string().max(10).nullable().optional(),
      needsReview: z.boolean().optional(),
    }),
  ),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
