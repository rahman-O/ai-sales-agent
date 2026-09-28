import { z } from 'zod';

export const CATALOG_ITEM_KINDS = [
  'SERVICE',
  'PRODUCT',
  'LISTING',
  'PACKAGE',
  'OTHER',
] as const;

export type CatalogItemKind = (typeof CATALOG_ITEM_KINDS)[number];

export const CATALOG_ITEM_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'ARCHIVED',
] as const;

export type CatalogItemStatus = (typeof CATALOG_ITEM_STATUSES)[number];

export const CatalogItemKindSchema = z.enum(CATALOG_ITEM_KINDS);
export const CatalogItemStatusSchema = z.enum(CATALOG_ITEM_STATUSES);

export interface CatalogItemDto {
  id: string;
  organizationId: string;
  kind: CatalogItemKind;
  name: string;
  description: string | null;
  sku: string | null;
  amountMinor: string | null;
  currency: string | null;
  status: CatalogItemStatus;
  metadataJson: Record<string, unknown> | null;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Specialization payloads if included
  service?: {
    id: string;
    locationId: string;
    durationMinutes: number;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
    bookingEnabled: boolean;
    minimumLeadMinutes: number;
    maximumAdvanceDays: number;
  } | null;
}

export const ServiceSpecializationSchema = z.object({
  locationId: z.string().uuid(),
  durationMinutes: z.number().int().positive(),
  bufferBeforeMinutes: z.number().int().min(0).optional().default(0),
  bufferAfterMinutes: z.number().int().min(0).optional().default(0),
  bookingEnabled: z.boolean().optional().default(true),
  minimumLeadMinutes: z.number().int().min(0).optional().default(60),
  maximumAdvanceDays: z.number().int().min(1).optional().default(30),
});

export type ServiceSpecializationInput = z.infer<typeof ServiceSpecializationSchema>;

export const CreateCatalogItemSchema = z.object({
  kind: CatalogItemKindSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  sku: z.string().trim().max(64).optional(),
  amountMinor: z.string().regex(/^\d+$/).optional(),
  currency: z.string().length(3).optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
  service: ServiceSpecializationSchema.optional(),
});

export type CreateCatalogItemRequest = z.infer<typeof CreateCatalogItemSchema>;

export const UpdateCatalogItemSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  sku: z.string().trim().max(64).nullable().optional(),
  amountMinor: z.string().regex(/^\d+$/).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  status: CatalogItemStatusSchema.optional(),
  metadataJson: z.record(z.string(), z.unknown()).nullable().optional(),
  service: z
    .object({
      durationMinutes: z.number().int().positive().optional(),
      bufferBeforeMinutes: z.number().int().min(0).optional(),
      bufferAfterMinutes: z.number().int().min(0).optional(),
      bookingEnabled: z.boolean().optional(),
      minimumLeadMinutes: z.number().int().min(0).optional(),
      maximumAdvanceDays: z.number().int().min(1).optional(),
    })
    .optional(),
});

export type UpdateCatalogItemRequest = z.infer<typeof UpdateCatalogItemSchema>;

export interface CatalogListResponse {
  items: CatalogItemDto[];
  total: number;
}
