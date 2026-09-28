import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CATALOG_ITEM_KINDS,
  CATALOG_ITEM_STATUSES,
  CreateCatalogItemSchema,
  UpdateCatalogItemSchema,
  type CatalogItemDto,
} from '@ai-sales-agent/contracts';

test('MB-04: CatalogItem kinds and statuses match platform requirements', () => {
  assert.deepEqual(CATALOG_ITEM_KINDS, [
    'SERVICE',
    'PRODUCT',
    'LISTING',
    'PACKAGE',
    'OTHER',
  ]);

  assert.deepEqual(CATALOG_ITEM_STATUSES, ['ACTIVE', 'INACTIVE', 'ARCHIVED']);
});

test('MB-04: CreateCatalogItemSchema validates service and non-service items', () => {
  // Valid Service item
  const validService = CreateCatalogItemSchema.safeParse({
    kind: 'SERVICE',
    name: 'Teeth Cleaning',
    description: 'Professional hygiene cleaning',
    amountMinor: '75000',
    currency: 'IQD',
    service: {
      locationId: 'a0333333-3333-4333-8333-333333333333',
      durationMinutes: 45,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
    },
  });
  assert.equal(validService.success, true);

  // Valid Product item (structural support)
  const validProduct = CreateCatalogItemSchema.safeParse({
    kind: 'PRODUCT',
    name: 'Dental Care Kit',
    sku: 'DCK-001',
    amountMinor: '25000',
    currency: 'IQD',
  });
  assert.equal(validProduct.success, true);

  // Valid Listing item (structural support)
  const validListing = CreateCatalogItemSchema.safeParse({
    kind: 'LISTING',
    name: 'Luxury 2-Bedroom Apartment',
    description: 'Prime location in Al-Mansour',
    amountMinor: '150000000',
    currency: 'IQD',
  });
  assert.equal(validListing.success, true);

  // Invalid: missing name
  const invalidNoName = CreateCatalogItemSchema.safeParse({
    kind: 'SERVICE',
    name: '',
  });
  assert.equal(invalidNoName.success, false);

  // Invalid: invalid kind
  const invalidKind = CreateCatalogItemSchema.safeParse({
    kind: 'UNKNOWN_KIND',
    name: 'Sample Item',
  });
  assert.equal(invalidKind.success, false);
});

test('MB-04: UpdateCatalogItemSchema validates updates and partial inputs', () => {
  const validUpdate = UpdateCatalogItemSchema.safeParse({
    name: 'Updated Teeth Cleaning',
    status: 'INACTIVE',
    service: {
      durationMinutes: 60,
    },
  });
  assert.equal(validUpdate.success, true);

  const invalidDuration = UpdateCatalogItemSchema.safeParse({
    service: {
      durationMinutes: -10,
    },
  });
  assert.equal(invalidDuration.success, false);
});

test('MB-04: CatalogItemDto preserves service specialization structure without mega-table bloat', () => {
  const item: CatalogItemDto = {
    id: 'item-uuid-1',
    organizationId: 'org-uuid-1',
    kind: 'SERVICE',
    name: 'Teeth Cleaning',
    description: 'Routine cleaning',
    sku: null,
    amountMinor: '75000',
    currency: 'IQD',
    status: 'ACTIVE',
    metadataJson: null,
    version: 1,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    service: {
      id: 'service-uuid-1',
      locationId: 'loc-uuid-1',
      durationMinutes: 45,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
      bookingEnabled: true,
      minimumLeadMinutes: 60,
      maximumAdvanceDays: 30,
    },
  };

  assert.equal(item.kind, 'SERVICE');
  assert.equal(item.service?.durationMinutes, 45);
  assert.equal(item.service?.id, 'service-uuid-1');
});
