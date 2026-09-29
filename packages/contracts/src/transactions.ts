import { z } from 'zod';
import { CatalogItemDto } from './catalog.js';
import { OfferDto, calculateDiscountedPrice } from './offers.js';

export const QUOTE_STATUSES = [
  'DRAFT',
  'PRESENTED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
] as const;
export const QuoteStatusSchema = z.enum(QUOTE_STATUSES);
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const ORDER_STATUSES = [
  'DRAFT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'REJECTED',
] as const;
export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ALLOWED_QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ['PRESENTED', 'CANCELLED'],
  PRESENTED: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['PENDING_CONFIRMATION', 'CANCELLED'],
  PENDING_CONFIRMATION: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function isValidQuoteTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return ALLOWED_QUOTE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface QuoteLineItemDto {
  id: string;
  organizationId: string;
  quoteId: string;
  catalogItemId: string | null;
  descriptionSnapshot: string;
  quantity: number;
  unitAmountMinor: string;
  discountAmountMinor: string;
  lineTotalAmountMinor: string;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDto {
  id: string;
  organizationId: string;
  customerId: string | null;
  leadId: string | null;
  status: QuoteStatus;
  currency: string;
  subtotalAmountMinor: string;
  discountAmountMinor: string;
  totalAmountMinor: string;
  expiresAt: string | null;
  notes: string | null;
  version: number;
  metadataJson: Record<string, unknown> | null;
  presentedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: QuoteLineItemDto[];
}

export interface OrderLineItemDto {
  id: string;
  organizationId: string;
  orderId: string;
  catalogItemId: string | null;
  descriptionSnapshot: string;
  quantity: number;
  unitAmountMinor: string;
  discountAmountMinor: string;
  lineTotalAmountMinor: string;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDto {
  id: string;
  organizationId: string;
  customerId: string | null;
  leadId: string | null;
  quoteId: string | null;
  status: OrderStatus;
  currency: string;
  subtotalAmountMinor: string;
  discountAmountMinor: string;
  totalAmountMinor: string;
  notes: string | null;
  version: number;
  metadataJson: Record<string, unknown> | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: OrderLineItemDto[];
}

export const TransactionItemInputSchema = z.object({
  catalogItemId: z.string().uuid().optional(),
  description: z.string().min(1).max(300).optional(),
  quantity: z.number().int().positive().default(1),
  unitAmountMinor: z.union([z.number().int().nonnegative(), z.bigint()]).optional(),
});
export type TransactionItemInput = z.infer<typeof TransactionItemInputSchema>;

export const CreateQuoteSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  currency: z.string().length(3).optional().default('IQD'),
  items: z.array(TransactionItemInputSchema).min(1).max(50),
  notes: z.string().max(1000).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  metadataJson: z.record(z.string(), z.unknown()).optional().nullable(),
});
export type CreateQuoteRequest = z.infer<typeof CreateQuoteSchema>;

export const UpdateQuoteSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  items: z.array(TransactionItemInputSchema).min(1).max(50).optional(),
  notes: z.string().max(1000).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  metadataJson: z.record(z.string(), z.unknown()).optional().nullable(),
  expectedVersion: z.number().int().positive().optional(),
});
export type UpdateQuoteRequest = z.infer<typeof UpdateQuoteSchema>;

export const CreateOrderSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  quoteId: z.string().uuid().optional().nullable(),
  currency: z.string().length(3).optional().default('IQD'),
  items: z.array(TransactionItemInputSchema).min(1).max(50),
  notes: z.string().max(1000).optional().nullable(),
  metadataJson: z.record(z.string(), z.unknown()).optional().nullable(),
});
export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;

export const ConfirmOrderSchema = z.object({
  confirmationMessageId: z.string().uuid().optional(),
  expectedTotalAmountMinor: z.union([z.string(), z.number().int(), z.bigint()]).optional(),
  expectedVersion: z.number().int().positive().optional(),
});
export type ConfirmOrderRequest = z.infer<typeof ConfirmOrderSchema>;

export interface TransactionCalculatedLineItem {
  catalogItemId: string | null;
  description: string;
  quantity: number;
  unitAmountMinor: bigint;
  discountAmountMinor: bigint;
  lineTotalAmountMinor: bigint;
  appliedOfferId: string | null;
}

export interface TransactionPricingResult {
  currency: string;
  lineItems: TransactionCalculatedLineItem[];
  subtotalAmountMinor: bigint;
  discountAmountMinor: bigint;
  totalAmountMinor: bigint;
  appliedOfferIds: string[];
}

export interface CalculatePricingOptions {
  items: TransactionItemInput[];
  catalogItemsMap: Map<string, { id: string; name: string; amountMinor: bigint | null; currency: string | null; status: string }>;
  activeOffers?: Array<{ id: string; offerType: string; discountPercentage?: number | null; discountAmountMinor?: bigint | null; targetCatalogItemIds: string[]; stackable: boolean; priority: number }>;
  defaultCurrency?: string;
  allowManualPricing?: boolean;
}

/**
 * Authoritative, deterministic transaction pricing calculator.
 * Pure function with no floating-point math, applying active offers and minor unit integer calculations.
 */
export function calculateTransactionPricing(options: CalculatePricingOptions): TransactionPricingResult {
  const { items, catalogItemsMap, activeOffers = [], defaultCurrency = 'IQD', allowManualPricing = false } = options;

  let currency = defaultCurrency;
  let currencyInitialized = false;

  let subtotal = 0n;
  let totalDiscount = 0n;
  const calculatedLines: TransactionCalculatedLineItem[] = [];
  const appliedOfferIdsSet = new Set<string>();

  for (const item of items) {
    const qty = BigInt(item.quantity);
    let unitPrice = 0n;
    let description = item.description || '';
    let itemCurrency: string | null = null;
    let catalogItemId: string | null = null;

    if (item.catalogItemId) {
      catalogItemId = item.catalogItemId;
      const catalogItem = catalogItemsMap.get(item.catalogItemId);
      if (!catalogItem) {
        throw new Error(`Catalog item ${item.catalogItemId} not found`);
      }
      if (catalogItem.status !== 'ACTIVE') {
        throw new Error(`Catalog item ${catalogItem.name} is inactive and cannot be added to transactions`);
      }
      if (catalogItem.amountMinor == null) {
        if (!allowManualPricing || item.unitAmountMinor == null) {
          throw new Error(`Catalog item ${catalogItem.name} does not have an authoritative price`);
        }
        unitPrice = BigInt(item.unitAmountMinor);
      } else {
        unitPrice = catalogItem.amountMinor;
      }
      description = item.description || catalogItem.name;
      itemCurrency = catalogItem.currency || currency;
    } else {
      if (!allowManualPricing || item.unitAmountMinor == null) {
        throw new Error(`Item without catalogItemId requires explicit unitAmountMinor by authorized operator`);
      }
      unitPrice = BigInt(item.unitAmountMinor);
      description = item.description || 'Custom Line Item';
      itemCurrency = currency;
    }

    if (!currencyInitialized && itemCurrency) {
      currency = itemCurrency;
      currencyInitialized = true;
    } else if (itemCurrency && itemCurrency !== currency) {
      throw new Error(`Currency mismatch: Transaction is in ${currency} but item is in ${itemCurrency}`);
    }

    const lineSubtotal = unitPrice * qty;
    subtotal += lineSubtotal;

    // Evaluate matching offers for this catalog item using MB-05 calculateDiscountedPrice
    let lineDiscount = 0n;
    let lineAppliedOfferId: string | null = null;

    if (catalogItemId && activeOffers.length > 0) {
      const eligibleOffers = activeOffers
        .filter((o) => o.targetCatalogItemIds.length === 0 || o.targetCatalogItemIds.includes(catalogItemId!))
        .map((o) => ({
          id: o.id,
          name: o.id,
          offerType: (o.offerType === 'PERCENTAGE' ? 'PERCENTAGE_DISCOUNT' : o.offerType) as any,
          discountPercentage: o.discountPercentage,
          discountAmountMinor: o.discountAmountMinor,
          currency,
          priority: o.priority,
          stackable: o.stackable,
        }));

      if (eligibleOffers.length > 0) {
        const pricingResult = calculateDiscountedPrice(unitPrice, currency, eligibleOffers);
        const unitDiscount = BigInt(pricingResult.discountAmountMinor);
        lineDiscount = unitDiscount * qty;
        if (pricingResult.appliedOffers.length > 0) {
          lineAppliedOfferId = pricingResult.appliedOffers[0]!.offerId;
          for (const ap of pricingResult.appliedOffers) {
            appliedOfferIdsSet.add(ap.offerId);
          }
        }
      }
    }

    const lineTotal = lineSubtotal > lineDiscount ? lineSubtotal - lineDiscount : 0n;
    totalDiscount += lineDiscount;

    calculatedLines.push({
      catalogItemId,
      description,
      quantity: item.quantity,
      unitAmountMinor: unitPrice,
      discountAmountMinor: lineDiscount,
      lineTotalAmountMinor: lineTotal,
      appliedOfferId: lineAppliedOfferId,
    });
  }

  const grandTotal = subtotal > totalDiscount ? subtotal - totalDiscount : 0n;

  return {
    currency,
    lineItems: calculatedLines,
    subtotalAmountMinor: subtotal,
    discountAmountMinor: totalDiscount,
    totalAmountMinor: grandTotal,
    appliedOfferIds: Array.from(appliedOfferIdsSet),
  };
}
