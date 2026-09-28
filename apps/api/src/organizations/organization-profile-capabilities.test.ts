import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ORGANIZATION_CAPABILITIES,
  validateCapabilitiesCombination,
  UpdateOrganizationCapabilitiesSchema,
  UpdateOrganizationProfileSchema,
} from '@ai-sales-agent/contracts';

test('MB-01: default capabilities match expected backward-compatible baseline', () => {
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsBooking, true);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsLeads, true);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.leadRequiredBeforeBooking, false);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.autoCreateLeadOnIntent, true);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsOffers, false);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsQuotes, false);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsOrders, false);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsInventory, false);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsStaff, true);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsLocations, true);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsProducts, false);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsServices, true);
  assert.equal(DEFAULT_ORGANIZATION_CAPABILITIES.supportsListings, false);
});

test('MB-01: validateCapabilitiesCombination accepts valid capability sets', () => {
  // Leads disabled, booking enabled
  const caseA = validateCapabilitiesCombination(DEFAULT_ORGANIZATION_CAPABILITIES, {
    supportsLeads: false,
    autoCreateLeadOnIntent: false,
    leadRequiredBeforeBooking: false,
  });
  assert.equal(caseA.valid, true);
  assert.equal(caseA.errors.length, 0);
  assert.equal(caseA.resolved.supportsLeads, false);
  assert.equal(caseA.resolved.supportsBooking, true);

  // Leads optional, booking enabled
  const caseB = validateCapabilitiesCombination(DEFAULT_ORGANIZATION_CAPABILITIES, {
    supportsLeads: true,
    leadRequiredBeforeBooking: false,
  });
  assert.equal(caseB.valid, true);
  assert.equal(caseB.errors.length, 0);

  // Leads required, booking enabled
  const caseC = validateCapabilitiesCombination(DEFAULT_ORGANIZATION_CAPABILITIES, {
    supportsLeads: true,
    supportsBooking: true,
    leadRequiredBeforeBooking: true,
  });
  assert.equal(caseC.valid, true);
  assert.equal(caseC.errors.length, 0);
  assert.equal(caseC.resolved.leadRequiredBeforeBooking, true);

  // Booking disabled, leads enabled (e.g. real estate lead intake)
  const caseD = validateCapabilitiesCombination(DEFAULT_ORGANIZATION_CAPABILITIES, {
    supportsBooking: false,
    supportsLeads: true,
    leadRequiredBeforeBooking: false,
  });
  assert.equal(caseD.valid, true);
  assert.equal(caseD.errors.length, 0);
  assert.equal(caseD.resolved.supportsBooking, false);
});

test('MB-01: validateCapabilitiesCombination rejects invalid capability sets', () => {
  // leadRequiredBeforeBooking=true but supportsLeads=false
  const inv1 = validateCapabilitiesCombination(DEFAULT_ORGANIZATION_CAPABILITIES, {
    supportsLeads: false,
    leadRequiredBeforeBooking: true,
  });
  assert.equal(inv1.valid, false);
  assert.ok(inv1.errors.some((e) => e.includes('supportsLeads=true')));

  // leadRequiredBeforeBooking=true but supportsBooking=false
  const inv2 = validateCapabilitiesCombination(DEFAULT_ORGANIZATION_CAPABILITIES, {
    supportsBooking: false,
    leadRequiredBeforeBooking: true,
  });
  assert.equal(inv2.valid, false);
  assert.ok(inv2.errors.some((e) => e.includes('supportsBooking=true')));

  // autoCreateLeadOnIntent=true but supportsLeads=false
  const inv3 = validateCapabilitiesCombination(DEFAULT_ORGANIZATION_CAPABILITIES, {
    supportsLeads: false,
    autoCreateLeadOnIntent: true,
  });
  assert.equal(inv3.valid, false);
  assert.ok(inv3.errors.some((e) => e.includes('autoCreateLeadOnIntent=true requires supportsLeads=true')));
});

test('MB-01: UpdateOrganizationProfileSchema validates profile inputs', () => {
  const valid = UpdateOrganizationProfileSchema.safeParse({
    displayName: 'Al-Mansour Dental & Aesthetics',
    businessType: 'clinic',
    description: 'Premier dental clinic in Baghdad',
    country: 'IQ',
    timezone: 'Asia/Baghdad',
    defaultLanguage: 'ar',
    defaultCurrency: 'IQD',
  });
  assert.equal(valid.success, true);

  const invalid = UpdateOrganizationProfileSchema.safeParse({
    displayName: 'x'.repeat(300), // Exceeds max 200
  });
  assert.equal(invalid.success, false);
});

test('MB-01: UpdateOrganizationCapabilitiesSchema validates capability flags', () => {
  const valid = UpdateOrganizationCapabilitiesSchema.safeParse({
    supportsBooking: true,
    supportsLeads: false,
    supportsOffers: true,
  });
  assert.equal(valid.success, true);

  const invalid = UpdateOrganizationCapabilitiesSchema.safeParse({
    supportsBooking: 'yes', // Must be boolean
  });
  assert.equal(invalid.success, false);
});
