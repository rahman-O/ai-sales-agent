import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CONVERSATION_PROFILE,
  UpdateConversationProfileSchema,
} from '@ai-sales-agent/contracts';

test('MB-07: DEFAULT_PROFILE_CREATED_OR_RESOLVED matches baseline specification', () => {
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
});

test('MB-07: PROFILE_UPDATE parses valid partial and complete updates', () => {
  const partial = UpdateConversationProfileSchema.safeParse({
    tone: 'WARM',
    responseLength: 'SHORT',
  });
  assert.equal(partial.success, true);
  if (partial.success) {
    assert.equal(partial.data.tone, 'WARM');
    assert.equal(partial.data.responseLength, 'SHORT');
  }

  const complete = UpdateConversationProfileSchema.safeParse({
    assistantName: 'سارة',
    primaryLanguage: 'ar',
    dialect: 'IRAQI',
    tone: 'FRIENDLY',
    formality: 'CASUAL',
    responseLength: 'SHORT',
    salesStyle: 'PROACTIVE',
    emojiUsage: 'NORMAL',
    customerNameUsage: 'OCCASIONAL',
    questionsPerTurn: 2,
    greetingStyle: 'WARM',
    handoffStyle: 'WARM',
    customInstructions: 'استخدم أسلوباً لطيفاً.',
  });
  assert.equal(complete.success, true);
});

test('MB-07: INVALID_ENUM_REJECTED rejects out-of-spec enum values', () => {
  const invalidTone = UpdateConversationProfileSchema.safeParse({ tone: 'RUDE' });
  assert.equal(invalidTone.success, false);

  const invalidFormality = UpdateConversationProfileSchema.safeParse({ formality: 'EXTREME' });
  assert.equal(invalidFormality.success, false);

  const invalidSales = UpdateConversationProfileSchema.safeParse({ salesStyle: 'MANIPULATIVE' });
  assert.equal(invalidSales.success, false);

  const invalidEmoji = UpdateConversationProfileSchema.safeParse({ emojiUsage: 'SPAM' });
  assert.equal(invalidEmoji.success, false);
});
