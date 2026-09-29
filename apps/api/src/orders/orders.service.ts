import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type ConfirmOrderRequest,
  type CreateOrderRequest,
  type OrderDto,
  type OrderLineItemDto,
  type OrderStatus,
  calculateTransactionPricing,
  isValidOrderTransition,
} from '@ai-sales-agent/contracts';
import {
  TenantContextService,
  type ActorContext,
  type TenantTxClient,
} from '../database/tenant-context.service.js';

@Injectable()
export class OrdersService {
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
    if (!caps || caps.supportsOrders === false) {
      throw new ConflictException("Organization capability 'supportsOrders' is disabled");
    }
  }

  private mapOrderDto(row: any): OrderDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      customerId: row.customerId,
      leadId: row.leadId,
      quoteId: row.quoteId,
      status: row.status as OrderStatus,
      currency: row.currency,
      subtotalAmountMinor: row.subtotalAmountMinor.toString(),
      discountAmountMinor: row.discountAmountMinor.toString(),
      totalAmountMinor: row.totalAmountMinor.toString(),
      notes: row.notes ?? null,
      version: row.version,
      metadataJson: (row.metadataJson as Record<string, unknown>) ?? null,
      confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lineItems: row.lineItems?.map((l: any): OrderLineItemDto => ({
        id: l.id,
        organizationId: l.organizationId,
        orderId: l.orderId,
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

  async listOrders(
    actor: ActorContext,
    organizationId: string,
    filter?: { status?: OrderStatus; customerId?: string; leadId?: string },
  ): Promise<{ items: OrderDto[]; total: number }> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      const where: any = { organizationId };
      if (filter?.status) where.status = filter.status;
      if (filter?.customerId) where.customerId = filter.customerId;
      if (filter?.leadId) where.leadId = filter.leadId;

      const rows = await tx.order.findMany({
        where,
        include: {
          lineItems: true,
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      const items = rows.map((r: any) => this.mapOrderDto(r));
      return { items, total: items.length };
    });
  }

  async getOrder(
    actor: ActorContext,
    organizationId: string,
    orderId: string,
  ): Promise<OrderDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      const row = await tx.order.findUnique({
        where: { organizationId_id: { organizationId, id: orderId } },
        include: {
          lineItems: true,
        },
      });

      if (!row) throw new NotFoundException(`Order ${orderId} not found`);
      return this.mapOrderDto(row);
    });
  }

  async createOrder(
    actor: ActorContext,
    organizationId: string,
    req: CreateOrderRequest,
  ): Promise<OrderDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      // 1. Fetch catalog items
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

      // 3. Calculate authoritative pricing
      const pricing = calculateTransactionPricing({
        items: req.items,
        catalogItemsMap,
        activeOffers: mappedOffers,
        defaultCurrency: req.currency || 'IQD',
        allowManualPricing: false, // Orders strictly require authoritative catalog pricing
      });

      // 4. Policy check: Minimum Order Policy
      const minOrderPolicy = await tx.businessPolicy.findFirst({
        where: {
          organizationId,
          policyType: 'MINIMUM_ORDER',
          archivedAt: null,
        },
      });

      if (minOrderPolicy?.contentStructured) {
        const struct = minOrderPolicy.contentStructured as { minimumOrderAmountMinor?: string | number };
        if (struct.minimumOrderAmountMinor != null) {
          const minRequired = BigInt(struct.minimumOrderAmountMinor);
          if (pricing.totalAmountMinor < minRequired) {
            throw new BadRequestException(
              `Order total (${pricing.totalAmountMinor.toString()}) does not meet the minimum order policy requirement of ${minRequired.toString()}`,
            );
          }
        }
      }

      const orderId = randomUUID();

      // 5. Create Order and lines atomically
      const created = await tx.order.create({
        data: {
          id: orderId,
          organizationId,
          customerId: req.customerId ?? null,
          leadId: req.leadId ?? null,
          quoteId: req.quoteId ?? null,
          status: 'PENDING_CONFIRMATION',
          currency: pricing.currency,
          subtotalAmountMinor: pricing.subtotalAmountMinor,
          discountAmountMinor: pricing.discountAmountMinor,
          totalAmountMinor: pricing.totalAmountMinor,
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

      return this.mapOrderDto(created);
    });
  }

  async confirmOrder(
    actor: ActorContext,
    organizationId: string,
    orderId: string,
    req?: ConfirmOrderRequest,
  ): Promise<OrderDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      const existing = await tx.order.findUnique({
        where: { organizationId_id: { organizationId, id: orderId } },
        include: { lineItems: true },
      });

      if (!existing) throw new NotFoundException(`Order ${orderId} not found`);

      if (req?.expectedVersion != null && existing.version !== req.expectedVersion) {
        throw new ConflictException(`Version mismatch on order: expected ${req.expectedVersion}, found ${existing.version}`);
      }

      if (req?.expectedTotalAmountMinor != null) {
        const expected = BigInt(req.expectedTotalAmountMinor);
        if (existing.totalAmountMinor !== expected) {
          throw new ConflictException(
            `CONFIRMATION_STALE: Order total changed from ${expected.toString()} to ${existing.totalAmountMinor.toString()}; re-confirmation required`,
          );
        }
      }

      if (!isValidOrderTransition(existing.status as OrderStatus, 'CONFIRMED')) {
        throw new ConflictException(`Invalid order status transition from ${existing.status} to CONFIRMED`);
      }

      const now = new Date();
      const metadata = (existing.metadataJson as Record<string, unknown>) || {};
      if (req?.confirmationMessageId) {
        metadata.confirmationMessageId = req.confirmationMessageId;
      }

      const updated = await tx.order.update({
        where: { organizationId_id: { organizationId, id: orderId } },
        data: {
          status: 'CONFIRMED',
          confirmedAt: now,
          version: existing.version + 1,
          metadataJson: metadata as any,
        },
        include: {
          lineItems: true,
        },
      });

      return this.mapOrderDto(updated);
    });
  }

  async cancelOrder(
    actor: ActorContext,
    organizationId: string,
    orderId: string,
    expectedVersion?: number,
  ): Promise<OrderDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      const existing = await tx.order.findUnique({
        where: { organizationId_id: { organizationId, id: orderId } },
        include: { lineItems: true },
      });

      if (!existing) throw new NotFoundException(`Order ${orderId} not found`);

      if (expectedVersion != null && existing.version !== expectedVersion) {
        throw new ConflictException(`Version mismatch on order: expected ${expectedVersion}, found ${existing.version}`);
      }

      if (!isValidOrderTransition(existing.status as OrderStatus, 'CANCELLED')) {
        throw new ConflictException(`Invalid order status transition from ${existing.status} to CANCELLED`);
      }

      const updated = await tx.order.update({
        where: { organizationId_id: { organizationId, id: orderId } },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          version: existing.version + 1,
        },
        include: {
          lineItems: true,
        },
      });

      return this.mapOrderDto(updated);
    });
  }

  async completeOrder(
    actor: ActorContext,
    organizationId: string,
    orderId: string,
    expectedVersion?: number,
  ): Promise<OrderDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId);

      const existing = await tx.order.findUnique({
        where: { organizationId_id: { organizationId, id: orderId } },
        include: { lineItems: true },
      });

      if (!existing) throw new NotFoundException(`Order ${orderId} not found`);

      if (expectedVersion != null && existing.version !== expectedVersion) {
        throw new ConflictException(`Version mismatch on order: expected ${expectedVersion}, found ${existing.version}`);
      }

      if (!isValidOrderTransition(existing.status as OrderStatus, 'COMPLETED')) {
        throw new ConflictException(`Invalid order status transition from ${existing.status} to COMPLETED`);
      }

      const updated = await tx.order.update({
        where: { organizationId_id: { organizationId, id: orderId } },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          version: existing.version + 1,
        },
        include: {
          lineItems: true,
        },
      });

      return this.mapOrderDto(updated);
    });
  }
}
