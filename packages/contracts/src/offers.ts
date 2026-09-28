import { z } from 'zod';

export const OFFER_TYPES = [
  'PERCENTAGE_DISCOUNT',
  'FIXED_DISCOUNT',
  'FIXED_PRICE',
  'INFORMATIONAL',
] as const;

export type OfferType = (typeof OFFER_TYPES)[number];

export const OFFER_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_ELIGIBILITIES = [
  'ANY_CUSTOMER',
  'NEW_CUSTOMER',
  'EXISTING_CUSTOMER',
] as const;

export type OfferEligibility = (typeof OFFER_ELIGIBILITIES)[number];

export const OfferTypeSchema = z.enum(OFFER_TYPES);
export const OfferStatusSchema = z.enum(OFFER_STATUSES);
export const OfferEligibilitySchema = z.enum(OFFER_ELIGIBILITIES);

export interface OfferCatalogItemDto {
  catalogItemId: string;
  catalogItemName?: string;
  kind?: string;
}

export interface OfferDto {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: OfferStatus;
  offerType: OfferType;
  discountPercentage: number | null;
  discountAmountMinor: string | null;
  currency: string | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  stackable: boolean;
  eligibility: OfferEligibility;
  metadataJson: Record<string, unknown> | null;
  targetCatalogItemIds: string[];
  targetCatalogItems?: OfferCatalogItemDto[];
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CreateOfferSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  status: OfferStatusSchema.optional().default('ACTIVE'),
  offerType: OfferTypeSchema,
  discountPercentage: z.number().int().min(1).max(100).optional(),
  discountAmountMinor: z.string().regex(/^\d+$/).optional(),
  currency: z.string().length(3).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  priority: z.number().int().min(0).max(1000).optional().default(0),
  stackable: z.boolean().optional().default(false),
  eligibility: OfferEligibilitySchema.optional().default('ANY_CUSTOMER'),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
  targetCatalogItemIds: z.array(z.string().uuid()).optional().default([]),
});

export type CreateOfferRequest = z.infer<typeof CreateOfferSchema>;

export const UpdateOfferSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: OfferStatusSchema.optional(),
  offerType: OfferTypeSchema.optional(),
  discountPercentage: z.number().int().min(1).max(100).nullable().optional(),
  discountAmountMinor: z.string().regex(/^\d+$/).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  stackable: z.boolean().optional(),
  eligibility: OfferEligibilitySchema.optional(),
  metadataJson: z.record(z.string(), z.unknown()).nullable().optional(),
  targetCatalogItemIds: z.array(z.string().uuid()).optional(),
});

export type UpdateOfferRequest = z.infer<typeof UpdateOfferSchema>;

export interface PriceCalculationResult {
  baseAmountMinor: string;
  discountAmountMinor: string;
  finalAmountMinor: string;
  currency: string;
  appliedOffers: Array<{
    offerId: string;
    offerName: string;
    offerType: OfferType;
    discountAmountMinor: string;
  }>;
}

export function calculateDiscountedPrice(
  baseAmountMinor: bigint,
  currency: string,
  applicableOffers: Array<{
    id: string;
    name: string;
    offerType: OfferType;
    discountPercentage?: number | null;
    discountAmountMinor?: bigint | null;
    currency?: string | null;
    priority?: number;
    stackable?: boolean;
  }>,
): PriceCalculationResult {
  if (baseAmountMinor <= 0n || applicableOffers.length === 0) {
    return {
      baseAmountMinor: baseAmountMinor.toString(),
      discountAmountMinor: '0',
      finalAmountMinor: baseAmountMinor.toString(),
      currency,
      appliedOffers: [],
    };
  }

  // Sort offers: highest priority first, then best potential discount
  const sorted = [...applicableOffers].sort((a, b) => {
    const pA = a.priority ?? 0;
    const pB = b.priority ?? 0;
    if (pA !== pB) return pB - pA;
    return a.id.localeCompare(b.id);
  });

  const hasStackable = sorted.some((o) => o.stackable);
  const applied: Array<{
    offerId: string;
    offerName: string;
    offerType: OfferType;
    discountAmountMinor: string;
  }> = [];

  let currentAmount = baseAmountMinor;

  if (hasStackable && sorted.every((o) => o.stackable)) {
    // All stackable
    for (const offer of sorted) {
      if (currentAmount <= 0n) break;
      let discount = 0n;

      if (offer.offerType === 'PERCENTAGE_DISCOUNT' && offer.discountPercentage) {
        discount = (currentAmount * BigInt(offer.discountPercentage)) / 100n;
      } else if (offer.offerType === 'FIXED_DISCOUNT' && offer.discountAmountMinor) {
        if (!offer.currency || offer.currency === currency) {
          discount = offer.discountAmountMinor > currentAmount ? currentAmount : offer.discountAmountMinor;
        }
      } else if (offer.offerType === 'FIXED_PRICE' && offer.discountAmountMinor !== undefined && offer.discountAmountMinor !== null) {
        if ((!offer.currency || offer.currency === currency) && currentAmount > offer.discountAmountMinor) {
          discount = currentAmount - offer.discountAmountMinor;
        }
      }

      if (discount > 0n) {
        currentAmount -= discount;
        applied.push({
          offerId: offer.id,
          offerName: offer.name,
          offerType: offer.offerType,
          discountAmountMinor: discount.toString(),
        });
      }
    }
  } else {
    // Non-stackable: take the single best offer among applicable
    let bestDiscount = 0n;
    let bestOffer: (typeof sorted)[0] | null = null;

    for (const offer of sorted) {
      let discount = 0n;
      if (offer.offerType === 'PERCENTAGE_DISCOUNT' && offer.discountPercentage) {
        discount = (baseAmountMinor * BigInt(offer.discountPercentage)) / 100n;
      } else if (offer.offerType === 'FIXED_DISCOUNT' && offer.discountAmountMinor) {
        if (!offer.currency || offer.currency === currency) {
          discount = offer.discountAmountMinor > baseAmountMinor ? baseAmountMinor : offer.discountAmountMinor;
        }
      } else if (offer.offerType === 'FIXED_PRICE' && offer.discountAmountMinor !== undefined && offer.discountAmountMinor !== null) {
        if ((!offer.currency || offer.currency === currency) && baseAmountMinor > offer.discountAmountMinor) {
          discount = baseAmountMinor - offer.discountAmountMinor;
        }
      }

      if (discount > bestDiscount) {
        bestDiscount = discount;
        bestOffer = offer;
      }
    }

    if (bestOffer && bestDiscount > 0n) {
      currentAmount = baseAmountMinor - bestDiscount;
      applied.push({
        offerId: bestOffer.id,
        offerName: bestOffer.name,
        offerType: bestOffer.offerType,
        discountAmountMinor: bestDiscount.toString(),
      });
    }
  }

  const finalAmount = currentAmount < 0n ? 0n : currentAmount;
  const totalDiscount = baseAmountMinor - finalAmount;

  return {
    baseAmountMinor: baseAmountMinor.toString(),
    discountAmountMinor: totalDiscount.toString(),
    finalAmountMinor: finalAmount.toString(),
    currency,
    appliedOffers: applied,
  };
}
