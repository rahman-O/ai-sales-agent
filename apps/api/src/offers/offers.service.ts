import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  calculateDiscountedPrice,
  type CreateOfferRequest,
  type OfferCatalogItemDto,
  type OfferDto,
  type OfferStatus,
  type OfferType,
  type PriceCalculationResult,
  type UpdateOfferRequest,
} from '@ai-sales-agent/contracts';
import {
  TenantContextService,
  type ActorContext,
  type TenantTxClient,
} from '../database/tenant-context.service.js';

@Injectable()
export class OffersService {
  constructor(private readonly tenants: TenantContextService) {}

  private async authorize(actor: ActorContext, organizationId: string) {
    const m = (await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    )) as { status: string } | null;
    if (!m || m.status !== 'ACTIVE') throw new NotFoundException();
    return m;
  }

  private text(value: string, field: string) {
    const v = value?.trim();
    if (!v || v.length > 160) throw new BadRequestException(`Invalid ${field}`);
    return v;
  }

  private async assertCapability(tx: TenantTxClient, organizationId: string) {
    const caps = await tx.organizationCapabilities.findUnique({
      where: { organizationId },
    });
    if (!caps || caps.supportsOffers === false) {
      throw new ConflictException("Organization capability 'supportsOffers' is disabled");
    }
  }

  async listOffers(
    actor: ActorContext,
    organizationId: string,
    filter?: { status?: OfferStatus; targetCatalogItemId?: string },
  ): Promise<{ items: OfferDto[]; total: number }> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const where: {
        organizationId: string;
        status?: string;
        targetCatalogItems?: { some: { catalogItemId: string } };
      } = { organizationId };

      if (filter?.status) where.status = filter.status;
      if (filter?.targetCatalogItemId) {
        where.targetCatalogItems = { some: { catalogItemId: filter.targetCatalogItemId } };
      }

      const rows = await tx.offer.findMany({
        where,
        include: {
          targetCatalogItems: {
            include: { catalogItem: true },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      const items: OfferDto[] = rows.map((row: any) => this.mapOfferDto(row));
      return { items, total: items.length };
    });
  }

  async getOffer(
    actor: ActorContext,
    organizationId: string,
    offerId: string,
  ): Promise<OfferDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const row = await tx.offer.findUnique({
        where: { organizationId_id: { organizationId, id: offerId } },
        include: {
          targetCatalogItems: {
            include: { catalogItem: true },
          },
        },
      });
      if (!row) throw new NotFoundException('Offer not found');
      return this.mapOfferDto(row);
    });
  }

  async createOffer(
    actor: ActorContext,
    organizationId: string,
    input: CreateOfferRequest,
  ): Promise<OfferDto> {
    await this.authorize(actor, organizationId);
    const name = this.text(input.name, 'name');

    if (input.startsAt && input.endsAt) {
      if (new Date(input.endsAt).getTime() < new Date(input.startsAt).getTime()) {
        throw new BadRequestException('endsAt must be greater than or equal to startsAt');
      }
    }

    if (input.offerType === 'PERCENTAGE_DISCOUNT') {
      if (!input.discountPercentage || input.discountPercentage < 1 || input.discountPercentage > 100) {
        throw new BadRequestException('discountPercentage (1..100) is required for PERCENTAGE_DISCOUNT');
      }
    } else if (input.offerType === 'FIXED_DISCOUNT' || input.offerType === 'FIXED_PRICE') {
      if (!input.discountAmountMinor || !input.currency) {
        throw new BadRequestException('discountAmountMinor and currency are required for fixed discount/price');
      }
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      // Validate targets if supplied
      if (input.targetCatalogItemIds && input.targetCatalogItemIds.length > 0) {
        const found = await tx.catalogItem.findMany({
          where: {
            organizationId,
            id: { in: input.targetCatalogItemIds },
            archivedAt: null,
          },
        });
        if (found.length !== input.targetCatalogItemIds.length) {
          throw new BadRequestException('One or more targeted catalog items do not exist in this organization');
        }
      }

      const offerId = randomUUID();
      const row = await tx.offer.create({
        data: {
          id: offerId,
          organizationId,
          name,
          description: input.description?.trim() || null,
          status: input.status ?? 'ACTIVE',
          offerType: input.offerType,
          discountPercentage: input.discountPercentage ?? null,
          discountAmountMinor: input.discountAmountMinor ? BigInt(input.discountAmountMinor) : null,
          currency: input.currency?.trim().toUpperCase() || null,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          priority: input.priority ?? 0,
          stackable: input.stackable ?? false,
          eligibility: input.eligibility ?? 'ANY_CUSTOMER',
          metadataJson: input.metadataJson ?? undefined,
          targetCatalogItems: {
            create: (input.targetCatalogItemIds ?? []).map((catalogItemId) => ({
              organizationId,
              catalogItemId,
            })),
          },
        },
        include: {
          targetCatalogItems: {
            include: { catalogItem: true },
          },
        },
      });

      await this.audit(tx, actor, organizationId, 'offer.created', 'Offer', offerId);
      return this.mapOfferDto(row);
    });
  }

  async updateOffer(
    actor: ActorContext,
    organizationId: string,
    offerId: string,
    input: UpdateOfferRequest,
  ): Promise<OfferDto> {
    await this.authorize(actor, organizationId);

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      const existing = await tx.offer.findUnique({
        where: { organizationId_id: { organizationId, id: offerId } },
      });
      if (!existing || existing.archivedAt) throw new NotFoundException('Offer not found');

      const startsAt = input.startsAt !== undefined ? (input.startsAt ? new Date(input.startsAt) : null) : existing.startsAt;
      const endsAt = input.endsAt !== undefined ? (input.endsAt ? new Date(input.endsAt) : null) : existing.endsAt;

      if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
        throw new BadRequestException('endsAt must be greater than or equal to startsAt');
      }

      const updateData: Record<string, unknown> = {
        version: { increment: 1 },
      };

      if (input.name !== undefined) updateData.name = this.text(input.name, 'name');
      if (input.description !== undefined) updateData.description = input.description?.trim() || null;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.offerType !== undefined) updateData.offerType = input.offerType;
      if (input.discountPercentage !== undefined) updateData.discountPercentage = input.discountPercentage;
      if (input.discountAmountMinor !== undefined) {
        updateData.discountAmountMinor = input.discountAmountMinor ? BigInt(input.discountAmountMinor) : null;
      }
      if (input.currency !== undefined) updateData.currency = input.currency?.trim().toUpperCase() || null;
      if (input.startsAt !== undefined) updateData.startsAt = startsAt;
      if (input.endsAt !== undefined) updateData.endsAt = endsAt;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.stackable !== undefined) updateData.stackable = input.stackable;
      if (input.eligibility !== undefined) updateData.eligibility = input.eligibility;
      if (input.metadataJson !== undefined) updateData.metadataJson = input.metadataJson;

      if (input.targetCatalogItemIds !== undefined) {
        if (input.targetCatalogItemIds.length > 0) {
          const found = await tx.catalogItem.findMany({
            where: {
              organizationId,
              id: { in: input.targetCatalogItemIds },
              archivedAt: null,
            },
          });
          if (found.length !== input.targetCatalogItemIds.length) {
            throw new BadRequestException('One or more targeted catalog items do not exist in this organization');
          }
        }

        // Replace targets
        await tx.offerCatalogItem.deleteMany({
          where: { organizationId, offerId },
        });

        if (input.targetCatalogItemIds.length > 0) {
          await tx.offerCatalogItem.createMany({
            data: input.targetCatalogItemIds.map((catalogItemId) => ({
              organizationId,
              offerId,
              catalogItemId,
            })),
          });
        }
      }

      const updated = await tx.offer.update({
        where: { organizationId_id: { organizationId, id: offerId } },
        data: updateData as any,
        include: {
          targetCatalogItems: {
            include: { catalogItem: true },
          },
        },
      });

      await this.audit(tx, actor, organizationId, 'offer.updated', 'Offer', offerId);
      return this.mapOfferDto(updated);
    });
  }

  async activateOffer(actor: ActorContext, organizationId: string, offerId: string) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);
      const existing = await tx.offer.findUnique({
        where: { organizationId_id: { organizationId, id: offerId } },
      });
      if (!existing || existing.archivedAt) throw new NotFoundException('Offer not found');

      const updated = await tx.offer.update({
        where: { organizationId_id: { organizationId, id: offerId } },
        data: { status: 'ACTIVE', version: { increment: 1 } },
        include: {
          targetCatalogItems: {
            include: { catalogItem: true },
          },
        },
      });
      await this.audit(tx, actor, organizationId, 'offer.activated', 'Offer', offerId);
      return this.mapOfferDto(updated);
    });
  }

  async pauseOffer(actor: ActorContext, organizationId: string, offerId: string) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);
      const existing = await tx.offer.findUnique({
        where: { organizationId_id: { organizationId, id: offerId } },
      });
      if (!existing || existing.archivedAt) throw new NotFoundException('Offer not found');

      const updated = await tx.offer.update({
        where: { organizationId_id: { organizationId, id: offerId } },
        data: { status: 'PAUSED', version: { increment: 1 } },
        include: {
          targetCatalogItems: {
            include: { catalogItem: true },
          },
        },
      });
      await this.audit(tx, actor, organizationId, 'offer.paused', 'Offer', offerId);
      return this.mapOfferDto(updated);
    });
  }

  async archiveOffer(actor: ActorContext, organizationId: string, offerId: string) {
    await this.authorize(actor, organizationId);
    const now = new Date();
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);
      const existing = await tx.offer.findUnique({
        where: { organizationId_id: { organizationId, id: offerId } },
      });
      if (!existing || existing.archivedAt) throw new NotFoundException('Offer not found');

      await tx.offer.update({
        where: { organizationId_id: { organizationId, id: offerId } },
        data: {
          status: 'ARCHIVED',
          archivedAt: now,
          version: { increment: 1 },
        },
      });
      await this.audit(tx, actor, organizationId, 'offer.archived', 'Offer', offerId);
      return { id: offerId, archived: true };
    });
  }

  async getApplicableOffersForCatalogItem(
    actor: ActorContext,
    organizationId: string,
    catalogItemId: string,
    currentTime?: Date,
  ): Promise<{
    catalogItemId: string;
    applicableOffers: OfferDto[];
    pricing: PriceCalculationResult | null;
  }> {
    await this.authorize(actor, organizationId);
    const now = currentTime ?? new Date();

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const item = await tx.catalogItem.findUnique({
        where: { organizationId_id: { organizationId, id: catalogItemId } },
      });
      if (!item || item.archivedAt) throw new NotFoundException('Catalog item not found');

      const activeOffers = await tx.offer.findMany({
        where: {
          organizationId,
          status: 'ACTIVE',
          archivedAt: null,
          OR: [
            { startsAt: null },
            { startsAt: { lte: now } },
          ],
          AND: [
            {
              OR: [
                { endsAt: null },
                { endsAt: { gte: now } },
              ],
            },
            {
              OR: [
                // Targeted specifically to this item
                { targetCatalogItems: { some: { catalogItemId } } },
                // Or organization-wide offer (no specific targets)
                { targetCatalogItems: { none: {} } },
              ],
            },
          ],
        },
        include: {
          targetCatalogItems: {
            include: { catalogItem: true },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      const offerDtos: OfferDto[] = activeOffers.map((o: any) => this.mapOfferDto(o));

      let pricing: PriceCalculationResult | null = null;
      if (item.amountMinor !== null && item.currency) {
        pricing = calculateDiscountedPrice(
          item.amountMinor,
          item.currency,
          activeOffers.map((o: any) => ({
            id: o.id,
            name: o.name,
            offerType: o.offerType as OfferType,
            discountPercentage: o.discountPercentage,
            discountAmountMinor: o.discountAmountMinor,
            currency: o.currency,
            priority: o.priority,
            stackable: o.stackable,
          })),
        );
      }

      return {
        catalogItemId,
        applicableOffers: offerDtos,
        pricing,
      };
    });
  }

  private mapOfferDto(row: any): OfferDto {
    const targets: OfferCatalogItemDto[] = (row.targetCatalogItems ?? []).map((t: any) => ({
      catalogItemId: t.catalogItemId,
      catalogItemName: t.catalogItem?.name,
      kind: t.catalogItem?.kind,
    }));

    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      description: row.description,
      status: row.status,
      offerType: row.offerType,
      discountPercentage: row.discountPercentage,
      discountAmountMinor: row.discountAmountMinor !== null && row.discountAmountMinor !== undefined ? row.discountAmountMinor.toString() : null,
      currency: row.currency,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      priority: row.priority,
      stackable: row.stackable,
      eligibility: row.eligibility,
      metadataJson: (row.metadataJson as Record<string, unknown>) ?? null,
      targetCatalogItemIds: targets.map((t) => t.catalogItemId),
      targetCatalogItems: targets,
      version: row.version,
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private audit(
    tx: TenantTxClient,
    actor: ActorContext,
    organizationId: string,
    action: string,
    targetType: string,
    targetId: string,
  ) {
    return this.tenants.writeAudit(tx, {
      organizationId,
      actorUserId: actor.userId,
      action,
      targetType,
      targetId,
      requestId: actor.requestId,
    });
  }
}
