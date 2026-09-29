import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  ALLOWED_ORDER_TRANSITIONS,
  ALLOWED_QUOTE_TRANSITIONS,
  calculateTransactionPricing,
  isValidOrderTransition,
  isValidQuoteTransition,
} from './transactions.js';

const mockCatalogItemsMap = new Map([
  [
    'item-1',
    {
      id: 'item-1',
      name: 'Classic Haircut',
      amountMinor: 25000n, // 25,000 IQD
      currency: 'IQD',
      status: 'ACTIVE',
    },
  ],
  [
    'item-2',
    {
      id: 'item-2',
      name: 'Styling Pomade',
      amountMinor: 15000n, // 15,000 IQD
      currency: 'IQD',
      status: 'ACTIVE',
    },
  ],
  [
    'item-inactive',
    {
      id: 'item-inactive',
      name: 'Archived Wax',
      amountMinor: 10000n,
      currency: 'IQD',
      status: 'INACTIVE',
    },
  ],
  [
    'item-usd',
    {
      id: 'item-usd',
      name: 'Imported Shampoo',
      amountMinor: 2000n, // $20.00
      currency: 'USD',
      status: 'ACTIVE',
    },
  ],
]);

test('MB-12 calculateTransactionPricing: calculates BASE_PRICE correctly with single item', () => {
  const res = calculateTransactionPricing({
    items: [{ catalogItemId: 'item-1', quantity: 1 }],
    catalogItemsMap: mockCatalogItemsMap,
  });

  assert.equal(res.currency, 'IQD');
  assert.equal(res.subtotalAmountMinor, 25000n);
  assert.equal(res.discountAmountMinor, 0n);
  assert.equal(res.totalAmountMinor, 25000n);
  assert.equal(res.lineItems.length, 1);
  assert.equal(res.lineItems[0]!.lineTotalAmountMinor, 25000n);
});

test('MB-12 calculateTransactionPricing: QUANTITY_CALCULATION correctly with multiple quantities', () => {
  const res = calculateTransactionPricing({
    items: [
      { catalogItemId: 'item-1', quantity: 2 }, // 50,000
      { catalogItemId: 'item-2', quantity: 3 }, // 45,000
    ],
    catalogItemsMap: mockCatalogItemsMap,
  });

  assert.equal(res.subtotalAmountMinor, 95000n);
  assert.equal(res.discountAmountMinor, 0n);
  assert.equal(res.totalAmountMinor, 95000n);
});

test('MB-12 calculateTransactionPricing: applies PERCENTAGE_OFFER accurately with minor integer math', () => {
  const activeOffers = [
    {
      id: 'offer-pct',
      offerType: 'PERCENTAGE_DISCOUNT',
      discountPercentage: 20, // 20%
      targetCatalogItemIds: ['item-1'],
      stackable: false,
      priority: 10,
    },
  ];

  const res = calculateTransactionPricing({
    items: [{ catalogItemId: 'item-1', quantity: 2 }], // 25,000 * 2 = 50,000 -> 20% discount = 10,000
    catalogItemsMap: mockCatalogItemsMap,
    activeOffers,
  });

  assert.equal(res.subtotalAmountMinor, 50000n);
  assert.equal(res.discountAmountMinor, 10000n);
  assert.equal(res.totalAmountMinor, 40000n);
  assert.ok(res.appliedOfferIds.includes('offer-pct'));
});

test('MB-12 calculateTransactionPricing: applies FIXED_DISCOUNT offer properly', () => {
  const activeOffers = [
    {
      id: 'offer-fixed',
      offerType: 'FIXED_DISCOUNT',
      discountAmountMinor: 5000n, // 5,000 IQD off per unit
      targetCatalogItemIds: ['item-2'],
      stackable: false,
      priority: 10,
    },
  ];

  const res = calculateTransactionPricing({
    items: [{ catalogItemId: 'item-2', quantity: 2 }], // 15,000 * 2 = 30,000 -> 5,000 * 2 discount = 10,000
    catalogItemsMap: mockCatalogItemsMap,
    activeOffers,
  });

  assert.equal(res.subtotalAmountMinor, 30000n);
  assert.equal(res.discountAmountMinor, 10000n);
  assert.equal(res.totalAmountMinor, 20000n);
  assert.ok(res.appliedOfferIds.includes('offer-fixed'));
});

test('MB-12 calculateTransactionPricing: ensures NO_NEGATIVE_TOTAL when discount exceeds base price', () => {
  const activeOffers = [
    {
      id: 'huge-discount',
      offerType: 'FIXED_DISCOUNT',
      discountAmountMinor: 50000n, // 50,000 discount on 15,000 item
      targetCatalogItemIds: ['item-2'],
      stackable: false,
      priority: 10,
    },
  ];

  const res = calculateTransactionPricing({
    items: [{ catalogItemId: 'item-2', quantity: 1 }],
    catalogItemsMap: mockCatalogItemsMap,
    activeOffers,
  });

  assert.equal(res.subtotalAmountMinor, 15000n);
  assert.equal(res.discountAmountMinor, 15000n);
  assert.equal(res.totalAmountMinor, 0n);
});

test('MB-12 calculateTransactionPricing: rejects INACTIVE catalog items from new transactions', () => {
  assert.throws(() => {
    calculateTransactionPricing({
      items: [{ catalogItemId: 'item-inactive', quantity: 1 }],
      catalogItemsMap: mockCatalogItemsMap,
    });
  }, /inactive/i);
});

test('MB-12 calculateTransactionPricing: rejects CURRENCY_MISMATCH in multi-item transactions', () => {
  assert.throws(() => {
    calculateTransactionPricing({
      items: [
        { catalogItemId: 'item-1', quantity: 1 }, // IQD
        { catalogItemId: 'item-usd', quantity: 1 }, // USD
      ],
      catalogItemsMap: mockCatalogItemsMap,
    });
  }, /Currency mismatch/i);
});

test('MB-12 calculateTransactionPricing: handles manual pricing when allowManualPricing is true', () => {
  const res = calculateTransactionPricing({
    items: [
      { description: 'Custom Bespoke Tailoring', quantity: 1, unitAmountMinor: 75000n },
    ],
    catalogItemsMap: mockCatalogItemsMap,
    allowManualPricing: true,
    defaultCurrency: 'IQD',
  });

  assert.equal(res.subtotalAmountMinor, 75000n);
  assert.equal(res.totalAmountMinor, 75000n);
});

test('MB-12 calculateTransactionPricing: rejects manual pricing when allowManualPricing is false', () => {
  assert.throws(() => {
    calculateTransactionPricing({
      items: [
        { description: 'Custom Item', quantity: 1, unitAmountMinor: 75000n },
      ],
      catalogItemsMap: mockCatalogItemsMap,
      allowManualPricing: false,
    });
  }, /requires explicit unitAmountMinor/i);
});

test('MB-12 State Transitions: validates allowed Quote transitions', () => {
  assert.equal(isValidQuoteTransition('DRAFT', 'PRESENTED'), true);
  assert.equal(isValidQuoteTransition('DRAFT', 'CANCELLED'), true);
  assert.equal(isValidQuoteTransition('PRESENTED', 'ACCEPTED'), true);
  assert.equal(isValidQuoteTransition('PRESENTED', 'REJECTED'), true);
  assert.equal(isValidQuoteTransition('PRESENTED', 'EXPIRED'), true);
  assert.equal(isValidQuoteTransition('PRESENTED', 'CANCELLED'), true);

  // Disallowed transitions
  assert.equal(isValidQuoteTransition('DRAFT', 'ACCEPTED'), false);
  assert.equal(isValidQuoteTransition('ACCEPTED', 'REJECTED'), false);
  assert.equal(isValidQuoteTransition('REJECTED', 'ACCEPTED'), false);
  assert.equal(isValidQuoteTransition('CANCELLED', 'PRESENTED'), false);
});

test('MB-12 State Transitions: validates allowed Order transitions', () => {
  assert.equal(isValidOrderTransition('DRAFT', 'PENDING_CONFIRMATION'), true);
  assert.equal(isValidOrderTransition('PENDING_CONFIRMATION', 'CONFIRMED'), true);
  assert.equal(isValidOrderTransition('PENDING_CONFIRMATION', 'REJECTED'), true);
  assert.equal(isValidOrderTransition('PENDING_CONFIRMATION', 'CANCELLED'), true);
  assert.equal(isValidOrderTransition('CONFIRMED', 'COMPLETED'), true);
  assert.equal(isValidOrderTransition('CONFIRMED', 'CANCELLED'), true);

  // Disallowed transitions
  assert.equal(isValidOrderTransition('DRAFT', 'CONFIRMED'), false);
  assert.equal(isValidOrderTransition('CONFIRMED', 'PENDING_CONFIRMATION'), false);
  assert.equal(isValidOrderTransition('COMPLETED', 'CANCELLED'), false);
  assert.equal(isValidOrderTransition('CANCELLED', 'CONFIRMED'), false);
});
