import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDiscountedPrice,
  CreateOfferSchema,
  OFFER_ELIGIBILITIES,
  OFFER_STATUSES,
  OFFER_TYPES,
  UpdateOfferSchema,
} from '@ai-sales-agent/contracts';

test('MB-05: Offer types, statuses, and eligibilities match platform requirements', () => {
  assert.deepEqual(OFFER_TYPES, [
    'PERCENTAGE_DISCOUNT',
    'FIXED_DISCOUNT',
    'FIXED_PRICE',
    'INFORMATIONAL',
  ]);

  assert.deepEqual(OFFER_STATUSES, ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);
  assert.deepEqual(OFFER_ELIGIBILITIES, ['ANY_CUSTOMER', 'NEW_CUSTOMER', 'EXISTING_CUSTOMER']);
});

test('MB-05: CreateOfferSchema validates valid percentage and fixed offers', () => {
  const validPercentage = CreateOfferSchema.safeParse({
    name: 'Summer Smile 20% Off',
    offerType: 'PERCENTAGE_DISCOUNT',
    discountPercentage: 20,
    status: 'ACTIVE',
    eligibility: 'ANY_CUSTOMER',
  });
  assert.equal(validPercentage.success, true);

  const validFixed = CreateOfferSchema.safeParse({
    name: '15,000 IQD First Visit Voucher',
    offerType: 'FIXED_DISCOUNT',
    discountAmountMinor: '15000',
    currency: 'IQD',
    startsAt: '2026-10-01T00:00:00.000Z',
    endsAt: '2026-10-31T23:59:59.000Z',
    eligibility: 'NEW_CUSTOMER',
  });
  assert.equal(validFixed.success, true);

  // Invalid: discount percentage over 100
  const invalidPercentage = CreateOfferSchema.safeParse({
    name: 'Extreme Discount',
    offerType: 'PERCENTAGE_DISCOUNT',
    discountPercentage: 150,
  });
  assert.equal(invalidPercentage.success, false);
});

test('MB-05: calculateDiscountedPrice calculates single non-stackable percentage discount', () => {
  const baseAmount = 100000n; // 100,000 IQD
  const result = calculateDiscountedPrice(baseAmount, 'IQD', [
    {
      id: 'offer-1',
      name: '20% Summer Discount',
      offerType: 'PERCENTAGE_DISCOUNT',
      discountPercentage: 20,
      priority: 0,
      stackable: false,
    },
  ]);

  assert.equal(result.baseAmountMinor, '100000');
  assert.equal(result.discountAmountMinor, '20000');
  assert.equal(result.finalAmountMinor, '80000');
  assert.equal(result.currency, 'IQD');
  assert.equal(result.appliedOffers.length, 1);
  assert.equal(result.appliedOffers[0].offerId, 'offer-1');
});

test('MB-05: calculateDiscountedPrice calculates single fixed discount without negative price', () => {
  const baseAmount = 25000n; // 25,000 IQD
  // Discount is 30,000 IQD (exceeds base amount)
  const result = calculateDiscountedPrice(baseAmount, 'IQD', [
    {
      id: 'offer-fixed',
      name: '30,000 Voucher',
      offerType: 'FIXED_DISCOUNT',
      discountAmountMinor: 30000n,
      currency: 'IQD',
      priority: 0,
      stackable: false,
    },
  ]);

  assert.equal(result.baseAmountMinor, '25000');
  assert.equal(result.discountAmountMinor, '25000');
  assert.equal(result.finalAmountMinor, '0');
  assert.equal(result.currency, 'IQD');
});

test('MB-05: calculateDiscountedPrice resolves non-stackable offers by best discount and priority', () => {
  const baseAmount = 100000n; // 100,000 IQD
  // Offer A: 10% (10,000 discount)
  // Offer B: 25,000 IQD fixed discount (25,000 discount) -> wins
  const result = calculateDiscountedPrice(baseAmount, 'IQD', [
    {
      id: 'offer-a',
      name: '10% Discount',
      offerType: 'PERCENTAGE_DISCOUNT',
      discountPercentage: 10,
      priority: 0,
      stackable: false,
    },
    {
      id: 'offer-b',
      name: '25,000 IQD Voucher',
      offerType: 'FIXED_DISCOUNT',
      discountAmountMinor: 25000n,
      currency: 'IQD',
      priority: 0,
      stackable: false,
    },
  ]);

  assert.equal(result.discountAmountMinor, '25000');
  assert.equal(result.finalAmountMinor, '75000');
  assert.equal(result.appliedOffers[0].offerId, 'offer-b');
});

test('MB-05: calculateDiscountedPrice applies multiple stackable offers sequentially', () => {
  const baseAmount = 100000n; // 100,000 IQD
  // Offer 1 (Priority 10): 20% off 100,000 -> 20,000 discount (subtotal 80,000)
  // Offer 2 (Priority 5): 10,000 off 80,000 -> 10,000 discount (final 70,000)
  const result = calculateDiscountedPrice(baseAmount, 'IQD', [
    {
      id: 'offer-stack-1',
      name: '20% Member Bonus',
      offerType: 'PERCENTAGE_DISCOUNT',
      discountPercentage: 20,
      priority: 10,
      stackable: true,
    },
    {
      id: 'offer-stack-2',
      name: '10,000 Voucher',
      offerType: 'FIXED_DISCOUNT',
      discountAmountMinor: 10000n,
      currency: 'IQD',
      priority: 5,
      stackable: true,
    },
  ]);

  assert.equal(result.baseAmountMinor, '100000');
  assert.equal(result.discountAmountMinor, '30000');
  assert.equal(result.finalAmountMinor, '70000');
  assert.equal(result.appliedOffers.length, 2);
  assert.equal(result.appliedOffers[0].offerId, 'offer-stack-1');
  assert.equal(result.appliedOffers[1].offerId, 'offer-stack-2');
});
