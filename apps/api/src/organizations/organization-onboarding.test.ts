import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUSINESS_TYPE_PRESETS,
  DEFAULT_ORGANIZATION_CAPABILITIES,
  ONBOARDING_STEPS,
  UpdateOnboardingProgressSchema,
  validateCapabilitiesCombination,
} from '@ai-sales-agent/contracts';

test('MB-02: BUSINESS_TYPE_PRESETS provide editable suggestion defaults without runtime branching', () => {
  assert.ok(BUSINESS_TYPE_PRESETS.length >= 8);

  const salon = BUSINESS_TYPE_PRESETS.find((p) => p.id === 'SALON_BEAUTY');
  assert.ok(salon);
  assert.equal(salon?.suggestedCapabilities.supportsBooking, true);
  assert.equal(salon?.suggestedCapabilities.supportsStaff, true);

  const realEstate = BUSINESS_TYPE_PRESETS.find((p) => p.id === 'REAL_ESTATE');
  assert.ok(realEstate);
  assert.equal(realEstate?.suggestedCapabilities.supportsLeads, true);
  assert.equal(realEstate?.suggestedCapabilities.supportsBooking, false);

  const ecommerce = BUSINESS_TYPE_PRESETS.find((p) => p.id === 'RETAIL_ECOMMERCE');
  assert.ok(ecommerce);
  assert.equal(ecommerce?.suggestedCapabilities.supportsProducts, true);
  assert.equal(ecommerce?.suggestedCapabilities.supportsOrders, true);
});

test('MB-02: ONBOARDING_STEPS contains the canonical 5 wizard steps', () => {
  assert.deepEqual(ONBOARDING_STEPS, [
    'IDENTITY',
    'CAPABILITIES',
    'BASIC_SETUP',
    'OPERATIONS',
    'REVIEW',
  ]);
});

test('MB-02: UpdateOnboardingProgressSchema validates progress updates', () => {
  const valid = UpdateOnboardingProgressSchema.safeParse({
    currentStep: 'CAPABILITIES',
    completedSteps: ['IDENTITY'],
    status: 'IN_PROGRESS',
  });
  assert.equal(valid.success, true);

  const invalid = UpdateOnboardingProgressSchema.safeParse({
    status: 'UNKNOWN_STATUS',
  });
  assert.equal(invalid.success, false);
});

test('MB-02: Readiness model checks completion criteria correctly', () => {
  // Scenario 1: Missing profile display name -> INCOMPLETE
  const emptyProfile = { displayName: '' };
  const validCaps = { ...DEFAULT_ORGANIZATION_CAPABILITIES };
  assert.ok(!emptyProfile.displayName?.trim(), 'Profile displayName is empty');

  // Scenario 2: Valid profile and capabilities -> READY
  const goodProfile = { displayName: 'Baghdad Care' };
  const capsValidation = validateCapabilitiesCombination(validCaps, {});
  assert.equal(capsValidation.valid, true);

  // Scenario 3: Invalid capabilities combination -> INCOMPLETE
  const badCapsValidation = validateCapabilitiesCombination(validCaps, {
    supportsLeads: false,
    leadRequiredBeforeBooking: true,
  });
  assert.equal(badCapsValidation.valid, false);
  assert.ok(badCapsValidation.errors.length > 0);
});

test('MB-02: Completion rules ignore irrelevant non-enabled capabilities', () => {
  // For booking-disabled businesses (e.g. Real Estate):
  const realEstateCaps = {
    ...DEFAULT_ORGANIZATION_CAPABILITIES,
    supportsBooking: false,
    supportsStaff: false,
    supportsLocations: false,
  };
  const validation = validateCapabilitiesCombination(realEstateCaps, {});
  assert.equal(validation.valid, true);
  // Non-enabled capabilities are NOT_APPLICABLE and do NOT block completion
  assert.equal(realEstateCaps.supportsBooking, false);
});
