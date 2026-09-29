import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type CreateQuoteRequest,
  type QuoteDto,
  type QuoteLineItemDto,
  type QuoteStatus,
  type UpdateQuoteRequest,
  calculateTransactionPricing,
  isValidQuoteTransition,
} from '@ai-sales-agent/contracts';
import {
  TenantContextService,
  type ActorContext,
  type TenantTxClient,
} from '../database/tenant-context.service.js';

@Injectable()
export class QuotesService {
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

  private async assertCapability(tx: TenantTxClient, organizationId: string) {
    const caps = await tx.organizationCapabilities.findUnique({
      where: { organizationId },
    });
    if (!caps || caps.supportsQuotes === false) {
      throw new ConflictException("Organization capability 'supportsQuotes' is disabled");
    }
  }

  private mapQuoteDto(row: any): QuoteDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      customerId: row.customerId,
      leadId: row.leadId,
      status: row.status as QuoteStatus,
      currency: row.currency,
      subtotalAmountMinor: row.subtotalAmountMinor.toString(),
      discountAmountMinor: row.discountAmountMinor.toString(),
      totalAmountMinor: row.totalAmountMinor.toString(),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      notes: row.notes ?? null,
      version: row.version,
      metadataJson: (row.metadataJson as Record<string, unknown>) ?? null,
      presentedAt: row.presentedAt ? row.presentedAt.toISOString() : null,
      acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
      rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : null,
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lineItems: row.lineItems?.map((l: any): QuoteLineItemDto => ({
        id: l.id,
        organizationId: l.organizationId,
        quoteId: l.quoteId,
        catalogItemId: l.catalogItemId,
        descriptionSnapshot: l.descriptionSnapshot,
        quantity: l.quantity,
        unitAmountMinor: l.unitAmountMinor.toString(),
        discountAmountMinor: l.discountAmountMinor.toString(),
        lineTotalAmountMinor: l.lineTotalAmountMinor.toString(),
        metadataJson: (l.metadataJson as Record<string, unknown>) ?? null,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
    };
  }

  async listQuotes(
    actor: ActorContext,
    organizationId: string,
    filter?: { status?: QuoteStatus; customerId?: string; leadId?: string },
  ): Promise<{ items: QuoteDto[]; total: number }> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      const where: any = { organizationId };
      if (filter?.status) where.status = filter.status;
      if (filter?.customerId) where.customerId = filter.customerId;
      if (filter?.leadId) where.leadId = filter.leadId;

      const rows = await tx.quote.findMany({
        where,
        include: {
          lineItems: true,
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      const items = rows.map((r: any) => this.mapQuoteDto(r));
      return { items, total: items.length };
    });
  }

  async getQuote(
    actor: ActorContext,
    organizationId: string,
    quoteId: string,
  ): Promise<QuoteDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      const row = await tx.quote.findUnique({
        where: { organizationId_id: { organizationId, id: quoteId } },
        include: {
          lineItems: true,
        },
      });

      if (!row) throw new NotFoundException(`Quote ${quoteId} not found`);
      return this.mapQuoteDto(row);
    });
  }

  async createQuote(
    actor: ActorContext,
    organizationId: string,
    req: CreateQuoteRequest,
    options?: { allowManualPricing?: boolean },
  ): Promise<QuoteDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      // 1. Fetch catalog items for requested items
      const catalogItemIds = req.items
        .map((i) => i.catalogItemId)
        .filter((id): id is string => Boolean(id));

      const catalogItems = catalogItemIds.length > 0
        ? await tx.catalogItem.findMany({
            where: {
              organizationId,
              id: { in: catalogItemIds },
              archivedAt: null,
            },
          })
        : [];

      const catalogItemsMap = new Map<string, { id: string; name: string; amountMinor: bigint | null; currency: string | null; status: string }>(
        catalogItems.map((c: any) => [
          c.id,
          {
            id: c.id,
            name: c.name,
            amountMinor: c.amountMinor != null ? BigInt(c.amountMinor) : null,
            currency: c.currency,
            status: c.status,
          },
        ]),
      );

      // 2. Fetch active offers
      const activeOffers = await tx.offer.findMany({
        where: {
          organizationId,
          status: 'ACTIVE',
          archivedAt: null,
        },
        include: {
          targetCatalogItems: true,
        },
      });

      const mappedOffers = activeOffers.map((o: any) => ({
        id: o.id,
        offerType: o.offerType,
        discountPercentage: o.discountPercentage,
        discountAmountMinor: o.discountAmountMinor != null ? BigInt(o.discountAmountMinor) : null,
        targetCatalogItemIds: o.targetCatalogItems.map((t: any) => t.catalogItemId),
        stackable: o.stackable,
        priority: o.priority,
      }));

      // 3. Compute authoritative pricing
      const pricing = calculateTransactionPricing({
        items: req.items,
        catalogItemsMap,
        activeOffers: mappedOffers,
        defaultCurrency: req.currency || 'IQD',
        allowManualPricing: options?.allowManualPricing ?? true,
      });

      const quoteId = randomUUID();
      const expiresAt = req.expiresAt ? new Date(req.expiresAt) : null;

      // 4. Atomically persist quote and line items
      const created = await tx.quote.create({
        data: {
          id: quoteId,
          organizationId,
          customerId: req.customerId ?? null,
          leadId: req.leadId ?? null,
          status: 'DRAFT',
          currency: pricing.currency,
          subtotalAmountMinor: pricing.subtotalAmountMinor,
          discountAmountMinor: pricing.discountAmountMinor,
          totalAmountMinor: pricing.totalAmountMinor,
          expiresAt,
          notes: req.notes ?? null,
          version: 1,
          metadataJson: (req.metadataJson ?? {}) as any,
          lineItems: {
            create: pricing.lineItems.map((line) => ({
              id: randomUUID(),
              organizationId,
              catalogItemId: line.catalogItemId,
              descriptionSnapshot: line.description,
              quantity: line.quantity,
              unitAmountMinor: line.unitAmountMinor,
              discountAmountMinor: line.discountAmountMinor,
              lineTotalAmountMinor: line.lineTotalAmountMinor,
              metadataJson: line.appliedOfferId ? { appliedOfferId: line.appliedOfferId } : {},
            })),
          },
        },
        include: {
          lineItems: true,
        },
      });

      return this.mapQuoteDto(created);
    });
  }

  async updateQuote(
    actor: ActorContext,
    organizationId: string,
    quoteId: string,
    req: UpdateQuoteRequest,
  ): Promise<QuoteDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      const existing = await tx.quote.findUnique({
        where: { organizationId_id: { organizationId, id: quoteId } },
        include: { lineItems: true },
      });

      if (!existing) throw new NotFoundException(`Quote ${quoteId} not found`);
      if (existing.status !== 'DRAFT') {
        throw new ConflictException(`Only DRAFT quotes can be edited; current status is ${existing.status}`);
      }

      if (req.expectedVersion != null && existing.version !== req.expectedVersion) {
        throw new ConflictException(`Version mismatch on quote: expected ${req.expectedVersion}, found ${existing.version}`);
      }

      let subtotal = existing.subtotalAmountMinor;
      let discount = existing.discountAmountMinor;
      let total = existing.totalAmountMinor;
      let currency = existing.currency;

      if (req.items && req.items.length > 0) {
        const catalogItemIds = req.items
          .map((i) => i.catalogItemId)
          .filter((id): id is string => Boolean(id));

        const catalogItems = catalogItemIds.length > 0
          ? await tx.catalogItem.findMany({
              where: { organizationId, id: { in: catalogItemIds }, archivedAt: null },
            })
          : [];

        const catalogItemsMap = new Map<string, { id: string; name: string; amountMinor: bigint | null; currency: string | null; status: string }>(
          catalogItems.map((c: any) => [
            c.id,
            {
              id: c.id,
              name: c.name,
              amountMinor: c.amountMinor != null ? BigInt(c.amountMinor) : null,
              currency: c.currency,
              status: c.status,
            },
          ]),
        );

        const activeOffers = await tx.offer.findMany({
          where: { organizationId, status: 'ACTIVE', archivedAt: null },
          include: { targetCatalogItems: true },
        });

        const mappedOffers = activeOffers.map((o: any) => ({
          id: o.id,
          offerType: o.offerType,
          discountPercentage: o.discountPercentage,
          discountAmountMinor: o.discountAmountMinor != null ? BigInt(o.discountAmountMinor) : null,
          targetCatalogItemIds: o.targetCatalogItems.map((t: any) => t.catalogItemId),
          stackable: o.stackable,
          priority: o.priority,
        }));

        const pricing = calculateTransactionPricing({
          items: req.items,
          catalogItemsMap,
          activeOffers: mappedOffers,
          defaultCurrency: currency,
          allowManualPricing: true,
        });

        subtotal = pricing.subtotalAmountMinor;
        discount = pricing.discountAmountMinor;
        total = pricing.totalAmountMinor;
        currency = pricing.currency;

        // Replace line items
        await tx.quoteLineItem.deleteMany({
          where: { organizationId, quoteId },
        });

        await tx.quoteLineItem.createMany({
          data: pricing.lineItems.map((line) => ({
            id: randomUUID(),
            organizationId,
            quoteId,
            catalogItemId: line.catalogItemId,
            descriptionSnapshot: line.description,
            quantity: line.quantity,
            unitAmountMinor: line.unitAmountMinor,
            discountAmountMinor: line.discountAmountMinor,
            lineTotalAmountMinor: line.lineTotalAmountMinor,
            metadataJson: line.appliedOfferId ? { appliedOfferId: line.appliedOfferId } : {},
          })),
        });
      }

      const updated = await tx.quote.update({
        where: { organizationId_id: { organizationId, id: quoteId } },
        data: {
          customerId: req.customerId !== undefined ? req.customerId : existing.customerId,
          leadId: req.leadId !== undefined ? req.leadId : existing.leadId,
          notes: req.notes !== undefined ? req.notes : existing.notes,
          expiresAt: req.expiresAt !== undefined ? (req.expiresAt ? new Date(req.expiresAt) : null) : existing.expiresAt,
          metadataJson: req.metadataJson !== undefined ? (req.metadataJson as any) : existing.metadataJson,
          currency,
          subtotalAmountMinor: subtotal,
          discountAmountMinor: discount,
          totalAmountMinor: total,
          version: existing.version + 1,
        },
        include: {
          lineItems: true,
        },
      });

      return this.mapQuoteDto(updated);
    });
  }

  async transitionQuote(
    actor: ActorContext,
    organizationId: string,
    quoteId: string,
    targetStatus: QuoteStatus,
    expectedVersion?: number,
  ): Promise<QuoteDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      const existing = await tx.quote.findUnique({
        where: { organizationId_id: { organizationId, id: quoteId } },
        include: { lineItems: true },
      });

      if (!existing) throw new NotFoundException(`Quote ${quoteId} not found`);

      if (expectedVersion != null && existing.version !== expectedVersion) {
        throw new ConflictException(`Version mismatch on quote: expected ${expectedVersion}, found ${existing.version}`);
      }

      if (!isValidQuoteTransition(existing.status as QuoteStatus, targetStatus)) {
        throw new ConflictException(`Invalid quote status transition from ${existing.status} to ${targetStatus}`);
      }

      const now = new Date();

      if (targetStatus === 'ACCEPTED' && existing.expiresAt && existing.expiresAt < now) {
        throw new BadRequestException(`Quote has expired at ${existing.expiresAt.toISOString()} and cannot be accepted`);
      }

      const updateData: any = {
        status: targetStatus,
        version: existing.version + 1,
      };

      if (targetStatus === 'PRESENTED') {
        updateData.presentedAt = now;
      } else if (targetStatus === 'ACCEPTED') {
        updateData.acceptedAt = now;
      } else if (targetStatus === 'REJECTED') {
        updateData.rejectedAt = now;
      } else if (targetStatus === 'CANCELLED') {
        updateData.cancelledAt = now;
      }

      const updated = await tx.quote.update({
        where: { organizationId_id: { organizationId, id: quoteId } },
        data: updateData,
        include: { lineItems: true },
      });

      return this.mapQuoteDto(updated);
    });
  }

  async presentQuote(actor: ActorContext, organizationId: string, quoteId: string, expectedVersion?: number): Promise<QuoteDto> {
    return this.transitionQuote(actor, organizationId, quoteId, 'PRESENTED', expectedVersion);
  }

  async acceptQuote(actor: ActorContext, organizationId: string, quoteId: string, expectedVersion?: number): Promise<QuoteDto> {
    return this.transitionQuote(actor, organizationId, quoteId, 'ACCEPTED', expectedVersion);
  }

  async rejectQuote(actor: ActorContext, organizationId: string, quoteId: string, expectedVersion?: number): Promise<QuoteDto> {
    return this.transitionQuote(actor, organizationId, quoteId, 'REJECTED', expectedVersion);
  }

  async cancelQuote(actor: ActorContext, organizationId: string, quoteId: string, expectedVersion?: number): Promise<QuoteDto> {
    return this.transitionQuote(actor, organizationId, quoteId, 'CANCELLED', expectedVersion);
  }
}
