import { z } from 'zod';

export const ToneEnum = z.enum(['WARM', 'PROFESSIONAL', 'FRIENDLY', 'DIRECT', 'NEUTRAL']);
export type Tone = z.infer<typeof ToneEnum>;

export const FormalityEnum = z.enum(['CASUAL', 'BALANCED', 'FORMAL']);
export type Formality = z.infer<typeof FormalityEnum>;

export const ResponseLengthEnum = z.enum(['SHORT', 'BALANCED', 'DETAILED']);
export type ResponseLength = z.infer<typeof ResponseLengthEnum>;

export const SalesStyleEnum = z.enum(['LOW_PRESSURE', 'BALANCED', 'PROACTIVE']);
export type SalesStyle = z.infer<typeof SalesStyleEnum>;

export const EmojiUsageEnum = z.enum(['NEVER', 'MINIMAL', 'NORMAL']);
export type EmojiUsage = z.infer<typeof EmojiUsageEnum>;

export const CustomerNameUsageEnum = z.enum(['NEVER', 'WHEN_KNOWN', 'OCCASIONAL']);
export type CustomerNameUsage = z.infer<typeof CustomerNameUsageEnum>;

export const GreetingStyleEnum = z.enum(['BRIEF', 'WARM', 'FORMAL', 'CUSTOM']);
export type GreetingStyle = z.infer<typeof GreetingStyleEnum>;

export const HandoffStyleEnum = z.enum(['PROFESSIONAL', 'WARM', 'DIRECT']);
export type HandoffStyle = z.infer<typeof HandoffStyleEnum>;

export const DialectEnum = z.enum(['IRAQI', 'MSA', 'AUTO']);
export type Dialect = z.infer<typeof DialectEnum>;

export interface ConversationProfileDto {
  organizationId: string;
  assistantName: string | null;
  primaryLanguage: string;
  dialect: Dialect;
  tone: Tone;
  formality: Formality;
  responseLength: ResponseLength;
  salesStyle: SalesStyle;
  emojiUsage: EmojiUsage;
  customerNameUsage: CustomerNameUsage;
  questionsPerTurn: number;
  greetingStyle: GreetingStyle;
  handoffStyle: HandoffStyle;
  customInstructions: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_CONVERSATION_PROFILE: Omit<
  ConversationProfileDto,
  'organizationId' | 'createdAt' | 'updatedAt'
> = {
  assistantName: null,
  primaryLanguage: 'ar',
  dialect: 'IRAQI',
  tone: 'PROFESSIONAL',
  formality: 'BALANCED',
  responseLength: 'BALANCED',
  salesStyle: 'BALANCED',
  emojiUsage: 'MINIMAL',
  customerNameUsage: 'WHEN_KNOWN',
  questionsPerTurn: 1,
  greetingStyle: 'BRIEF',
  handoffStyle: 'PROFESSIONAL',
  customInstructions: null,
};

export const UpdateConversationProfileSchema = z.object({
  assistantName: z.string().max(80).nullable().optional(),
  primaryLanguage: z.string().max(10).optional(),
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
  customInstructions: z.string().max(500).nullable().optional(),
});

export type UpdateConversationProfileRequest = z.infer<typeof UpdateConversationProfileSchema>;
