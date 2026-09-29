import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CONVERSATION_PROFILE,
  UpdateConversationProfileSchema,
  type ConversationProfileDto,
} from '@ai-sales-agent/contracts';

test('MB-07: default conversation profile matches safe defaults', () => {
  assert.equal(DEFAULT_CONVERSATION_PROFILE.primaryLanguage, 'ar');
  assert.equal(DEFAULT_CONVERSATION_PROFILE.dialect, 'IRAQI');
  assert.equal(DEFAULT_CONVERSATION_PROFILE.tone, 'PROFESSIONAL');
  assert.equal(DEFAULT_CONVERSATION_PROFILE.formality, 'BALANCED');
  assert.equal(DEFAULT_CONVERSATION_PROFILE.responseLength, 'BALANCED');
  assert.equal(DEFAULT_CONVERSATION_PROFILE.salesStyle, 'BALANCED');
  assert.equal(DEFAULT_CONVERSATION_PROFILE.emojiUsage, 'MINIMAL');
  assert.equal(DEFAULT_CONVERSATION_PROFILE.customerNameUsage, 'WHEN_KNOWN');
  assert.equal(DEFAULT_CONVERSATION_PROFILE.questionsPerTurn, 1);
  assert.equal(DEFAULT_CONVERSATION_PROFILE.greetingStyle, 'BRIEF');
  assert.equal(DEFAULT_CONVERSATION_PROFILE.handoffStyle, 'PROFESSIONAL');
  assert.equal(DEFAULT_CONVERSATION_PROFILE.assistantName, null);
  assert.equal(DEFAULT_CONVERSATION_PROFILE.customInstructions, null);
});

test('MB-07: UpdateConversationProfileSchema validates valid inputs', () => {
  const valid = UpdateConversationProfileSchema.safeParse({
    assistantName: 'سارة',
    primaryLanguage: 'ar',
    dialect: 'IRAQI',
    tone: 'WARM',
    formality: 'BALANCED',
    responseLength: 'SHORT',
    salesStyle: 'PROACTIVE',
    emojiUsage: 'NORMAL',
    customerNameUsage: 'WHEN_KNOWN',
    questionsPerTurn: 2,
    greetingStyle: 'WARM',
    handoffStyle: 'WARM',
    customInstructions: 'استخدم عبارات ترحيبية ودية ومبسطة.',
  });
  assert.equal(valid.success, true);
});

test('MB-07: UpdateConversationProfileSchema rejects invalid enums and bounded fields', () => {
  // Invalid tone enum
  const invTone = UpdateConversationProfileSchema.safeParse({
    tone: 'AGGRESSIVE',
  });
  assert.equal(invTone.success, false);

  // Invalid dialect enum
  const invDialect = UpdateConversationProfileSchema.safeParse({
    dialect: 'EGYPTIAN',
  });
  assert.equal(invDialect.success, false);

  // Invalid responseLength
  const invLength = UpdateConversationProfileSchema.safeParse({
    responseLength: 'NOVEL',
  });
  assert.equal(invLength.success, false);

  // Invalid questionsPerTurn (exceeds max 3)
  const invQuestions = UpdateConversationProfileSchema.safeParse({
    questionsPerTurn: 5,
  });
  assert.equal(invQuestions.success, false);

  // Invalid questionsPerTurn (below min 1)
  const invQuestionsMin = UpdateConversationProfileSchema.safeParse({
    questionsPerTurn: 0,
  });
  assert.equal(invQuestionsMin.success, false);

  // Custom instructions exceeding max 500 chars
  const invInstructions = UpdateConversationProfileSchema.safeParse({
    customInstructions: 'a'.repeat(501),
  });
  assert.equal(invInstructions.success, false);
});
