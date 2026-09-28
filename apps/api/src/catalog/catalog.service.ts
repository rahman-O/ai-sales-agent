import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CatalogItemDto,
  CatalogItemKind,
  CatalogItemStatus,
  CreateCatalogItemRequest,
  UpdateCatalogItemRequest,
} from '@ai-sales-agent/contracts';
import { TenantContextService, type ActorContext, type TenantTxClient } from '../database/tenant-context.service.js';
import { Money, assertIanaTimezone } from '../domain/value-objects.js';

@Injectable()
export class CatalogService {
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

  private async assertCapability(
    tx: TenantTxClient,
    organizationId: string,
    kind: CatalogItemKind,
  ) {
    const caps = await tx.organizationCapabilities.findUnique({
      where: { organizationId },
    });

    if (kind === 'SERVICE') {
      if (caps && caps.supportsServices === false) {
        throw new ConflictException("Organization capability 'supportsServices' is disabled");
      }
    } else if (kind === 'PRODUCT') {
      if (!caps || caps.supportsProducts === false) {
        throw new ConflictException("Organization capability 'supportsProducts' is disabled");
      }
    } else if (kind === 'LISTING') {
      if (!caps || caps.supportsListings === false) {
        throw new ConflictException("Organization capability 'supportsListings' is disabled");
      }
    }
  }

  async list(actor: ActorContext, organizationId: string) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const services = await tx.service.findMany({
        where: { organizationId, archivedAt: null },
        include: { staff: true, catalogItem: true },
        orderBy: { name: 'asc' },
      });
      const locations = await tx.location.findMany({
        where: { organizationId, archivedAt: null },
        orderBy: { name: 'asc' },
      });
      const staff = await tx.staffMember.findMany({
        where: { organizationId, archivedAt: null },
        orderBy: { displayName: 'asc' },
      });
      return {
        locations,
        services: services.map((service: { amountMinor: bigint; [key: string]: unknown }) => ({
          ...service,
          amountMinor: service.amountMinor.toString(),
        })),
        staff,
      };
    });
  }

  async listCatalogItems(
    actor: ActorContext,
    organizationId: string,
    filter?: { kind?: CatalogItemKind; status?: CatalogItemStatus },
  ): Promise<{ items: CatalogItemDto[]; total: number }> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const where: {
        organizationId: string;
        kind?: string;
        status?: string;
      } = { organizationId };

      if (filter?.kind) where.kind = filter.kind;
      if (filter?.status) where.status = filter.status;

      const rows = await tx.catalogItem.findMany({
        where,
        include: { service: true },
        orderBy: [{ createdAt: 'desc' }],
      });

      const items: CatalogItemDto[] = rows.map((row: any) => ({
        id: row.id,
        organizationId: row.organizationId,
        kind: row.kind as CatalogItemKind,
        name: row.name,
        description: row.description,
        sku: row.sku,
        amountMinor: row.amountMinor !== null ? row.amountMinor.toString() : null,
        currency: row.currency,
        status: row.status as CatalogItemStatus,
        metadataJson: (row.metadataJson as Record<string, unknown>) ?? null,
        version: row.version,
        archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        service: row.service
          ? {
              id: row.service.id,
              locationId: row.service.locationId,
              durationMinutes: row.service.durationMinutes,
              bufferBeforeMinutes: row.service.bufferBeforeMinutes,
              bufferAfterMinutes: row.service.bufferAfterMinutes,
              bookingEnabled: row.service.bookingEnabled,
              minimumLeadMinutes: row.service.minimumLeadMinutes,
              maximumAdvanceDays: row.service.maximumAdvanceDays,
            }
          : null,
      }));

      return { items, total: items.length };
    });
  }

  async getCatalogItem(
    actor: ActorContext,
    organizationId: string,
    itemId: string,
  ): Promise<CatalogItemDto> {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const row = await tx.catalogItem.findUnique({
        where: { organizationId_id: { organizationId, id: itemId } },
        include: { service: true },
      });
      if (!row) throw new NotFoundException('Catalog item not found');

      return {
        id: row.id,
        organizationId: row.organizationId,
        kind: row.kind as CatalogItemKind,
        name: row.name,
        description: row.description,
        sku: row.sku,
        amountMinor: row.amountMinor !== null ? row.amountMinor.toString() : null,
        currency: row.currency,
        status: row.status as CatalogItemStatus,
        metadataJson: (row.metadataJson as Record<string, unknown>) ?? null,
        version: row.version,
        archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        service: row.service
          ? {
              id: row.service.id,
              locationId: row.service.locationId,
              durationMinutes: row.service.durationMinutes,
              bufferBeforeMinutes: row.service.bufferBeforeMinutes,
              bufferAfterMinutes: row.service.bufferAfterMinutes,
              bookingEnabled: row.service.bookingEnabled,
              minimumLeadMinutes: row.service.minimumLeadMinutes,
              maximumAdvanceDays: row.service.maximumAdvanceDays,
            }
          : null,
      };
    });
  }

  async createCatalogItem(
    actor: ActorContext,
    organizationId: string,
    input: CreateCatalogItemRequest,
  ): Promise<CatalogItemDto> {
    await this.authorize(actor, organizationId);
    const name = this.text(input.name, 'name');

    let amountMinor: bigint | null = null;
    let currency: string | null = null;
    if (input.amountMinor && input.currency) {
      const m = Money.create(input.amountMinor, input.currency);
      amountMinor = m.amountMinor;
      currency = m.currency;
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId, input.kind);

      const catalogItemId = randomUUID();

      let serviceRecord = null;
      if (input.kind === 'SERVICE') {
        if (!input.service) {
          throw new BadRequestException('Service specialization details are required for kind SERVICE');
        }
        if (amountMinor === null || currency === null) {
          throw new BadRequestException('amountMinor and currency are required for kind SERVICE');
        }
        const location = await tx.location.findUnique({
          where: { organizationId_id: { organizationId, id: input.service.locationId } },
        });
        if (!location || !location.active || location.archivedAt) {
          throw new ConflictException('Location is not active');
        }

        if (
          !Number.isInteger(input.service.durationMinutes) ||
          input.service.durationMinutes <= 0 ||
          !Number.isInteger(input.service.bufferBeforeMinutes ?? 0) ||
          (input.service.bufferBeforeMinutes ?? 0) < 0 ||
          !Number.isInteger(input.service.bufferAfterMinutes ?? 0) ||
          (input.service.bufferAfterMinutes ?? 0) < 0
        ) {
          throw new BadRequestException('Invalid duration or buffers');
        }

        const catItem = await tx.catalogItem.create({
          data: {
            id: catalogItemId,
            organizationId,
            kind: input.kind,
            name,
            description: input.description?.trim() || null,
            sku: input.sku?.trim() || null,
            amountMinor,
            currency,
            status: 'ACTIVE',
            metadataJson: input.metadataJson ?? undefined,
          },
        });

        const serviceId = randomUUID();
        serviceRecord = await tx.service.create({
          data: {
            id: serviceId,
            organizationId,
            catalogItemId: catItem.id,
            locationId: input.service.locationId,
            name,
            durationMinutes: input.service.durationMinutes,
            bufferBeforeMinutes: input.service.bufferBeforeMinutes ?? 0,
            bufferAfterMinutes: input.service.bufferAfterMinutes ?? 0,
            amountMinor,
            currency,
            bookingEnabled: input.service.bookingEnabled ?? true,
            minimumLeadMinutes: input.service.minimumLeadMinutes ?? 60,
            maximumAdvanceDays: input.service.maximumAdvanceDays ?? 30,
          },
        });

        await this.audit(tx, actor, organizationId, 'catalog_item.created', 'CatalogItem', catItem.id);
        await this.audit(tx, actor, organizationId, 'service.created', 'Service', serviceRecord.id);

        return {
          id: catItem.id,
          organizationId: catItem.organizationId,
          kind: catItem.kind as CatalogItemKind,
          name: catItem.name,
          description: catItem.description,
          sku: catItem.sku,
          amountMinor: catItem.amountMinor ? catItem.amountMinor.toString() : null,
          currency: catItem.currency,
          status: catItem.status as CatalogItemStatus,
          metadataJson: (catItem.metadataJson as Record<string, unknown>) ?? null,
          version: catItem.version,
          archivedAt: null,
          createdAt: catItem.createdAt.toISOString(),
          updatedAt: catItem.updatedAt.toISOString(),
          service: {
            id: serviceRecord.id,
            locationId: serviceRecord.locationId,
            durationMinutes: serviceRecord.durationMinutes,
            bufferBeforeMinutes: serviceRecord.bufferBeforeMinutes,
            bufferAfterMinutes: serviceRecord.bufferAfterMinutes,
            bookingEnabled: serviceRecord.bookingEnabled,
            minimumLeadMinutes: serviceRecord.minimumLeadMinutes,
            maximumAdvanceDays: serviceRecord.maximumAdvanceDays,
          },
        };
      }

      // Non-service item kind (PRODUCT, LISTING, PACKAGE, OTHER)
      const catItem = await tx.catalogItem.create({
        data: {
          id: catalogItemId,
          organizationId,
          kind: input.kind,
          name,
          description: input.description?.trim() || null,
          sku: input.sku?.trim() || null,
          amountMinor,
          currency,
          status: 'ACTIVE',
          metadataJson: input.metadataJson ?? undefined,
        },
      });

      await this.audit(tx, actor, organizationId, 'catalog_item.created', 'CatalogItem', catItem.id);

      return {
        id: catItem.id,
        organizationId: catItem.organizationId,
        kind: catItem.kind as CatalogItemKind,
        name: catItem.name,
        description: catItem.description,
        sku: catItem.sku,
        amountMinor: catItem.amountMinor ? catItem.amountMinor.toString() : null,
        currency: catItem.currency,
        status: catItem.status as CatalogItemStatus,
        metadataJson: (catItem.metadataJson as Record<string, unknown>) ?? null,
        version: catItem.version,
        archivedAt: null,
        createdAt: catItem.createdAt.toISOString(),
        updatedAt: catItem.updatedAt.toISOString(),
        service: null,
      };
    });
  }

  async updateCatalogItem(
    actor: ActorContext,
    organizationId: string,
    itemId: string,
    input: UpdateCatalogItemRequest,
  ): Promise<CatalogItemDto> {
    await this.authorize(actor, organizationId);

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const existing = await tx.catalogItem.findUnique({
        where: { organizationId_id: { organizationId, id: itemId } },
        include: { service: true },
      });
      if (!existing || existing.archivedAt) throw new NotFoundException('Catalog item not found');

      const updateData: {
        name?: string;
        description?: string | null;
        sku?: string | null;
        amountMinor?: bigint | null;
        currency?: string | null;
        status?: string;
        metadataJson?: Record<string, unknown> | null;
        version: { increment: number };
      } = {
        version: { increment: 1 },
      };

      if (input.name !== undefined) updateData.name = this.text(input.name, 'name');
      if (input.description !== undefined) updateData.description = input.description?.trim() || null;
      if (input.sku !== undefined) updateData.sku = input.sku?.trim() || null;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.metadataJson !== undefined) updateData.metadataJson = input.metadataJson;

      if (input.amountMinor !== undefined || input.currency !== undefined) {
        if (input.amountMinor && input.currency) {
          const m = Money.create(input.amountMinor, input.currency);
          updateData.amountMinor = m.amountMinor;
          updateData.currency = m.currency;
        } else if (input.amountMinor === null && input.currency === null) {
          updateData.amountMinor = null;
          updateData.currency = null;
        }
      }

      const updatedItem = await tx.catalogItem.update({
        where: { organizationId_id: { organizationId, id: itemId } },
        data: updateData as any,
      });

      let updatedService = existing.service;
      if (existing.service) {
        const serviceUpdate: {
          name?: string;
          amountMinor?: bigint;
          currency?: string;
          active?: boolean;
          durationMinutes?: number;
          bufferBeforeMinutes?: number;
          bufferAfterMinutes?: number;
          bookingEnabled?: boolean;
          minimumLeadMinutes?: number;
          maximumAdvanceDays?: number;
          version: { increment: number };
        } = {
          version: { increment: 1 },
        };

        if (updateData.name) serviceUpdate.name = updateData.name;
        if (updateData.amountMinor) serviceUpdate.amountMinor = updateData.amountMinor;
        if (updateData.currency) serviceUpdate.currency = updateData.currency;
        if (input.status !== undefined) serviceUpdate.active = input.status === 'ACTIVE';

        if (input.service) {
          if (input.service.durationMinutes !== undefined) {
            serviceUpdate.durationMinutes = input.service.durationMinutes;
          }
          if (input.service.bufferBeforeMinutes !== undefined) {
            serviceUpdate.bufferBeforeMinutes = input.service.bufferBeforeMinutes;
          }
          if (input.service.bufferAfterMinutes !== undefined) {
            serviceUpdate.bufferAfterMinutes = input.service.bufferAfterMinutes;
          }
          if (input.service.bookingEnabled !== undefined) {
            serviceUpdate.bookingEnabled = input.service.bookingEnabled;
          }
          if (input.service.minimumLeadMinutes !== undefined) {
            serviceUpdate.minimumLeadMinutes = input.service.minimumLeadMinutes;
          }
          if (input.service.maximumAdvanceDays !== undefined) {
            serviceUpdate.maximumAdvanceDays = input.service.maximumAdvanceDays;
          }
        }

        updatedService = await tx.service.update({
          where: { organizationId_id: { organizationId, id: existing.service.id } },
          data: serviceUpdate,
        });
      }

      await this.audit(tx, actor, organizationId, 'catalog_item.updated', 'CatalogItem', itemId);

      return {
        id: updatedItem.id,
        organizationId: updatedItem.organizationId,
        kind: updatedItem.kind as CatalogItemKind,
        name: updatedItem.name,
        description: updatedItem.description,
        sku: updatedItem.sku,
        amountMinor: updatedItem.amountMinor ? updatedItem.amountMinor.toString() : null,
        currency: updatedItem.currency,
        status: updatedItem.status as CatalogItemStatus,
        metadataJson: (updatedItem.metadataJson as Record<string, unknown>) ?? null,
        version: updatedItem.version,
        archivedAt: updatedItem.archivedAt ? updatedItem.archivedAt.toISOString() : null,
        createdAt: updatedItem.createdAt.toISOString(),
        updatedAt: updatedItem.updatedAt.toISOString(),
        service: updatedService
          ? {
              id: updatedService.id,
              locationId: updatedService.locationId,
              durationMinutes: updatedService.durationMinutes,
              bufferBeforeMinutes: updatedService.bufferBeforeMinutes,
              bufferAfterMinutes: updatedService.bufferAfterMinutes,
              bookingEnabled: updatedService.bookingEnabled,
              minimumLeadMinutes: updatedService.minimumLeadMinutes,
              maximumAdvanceDays: updatedService.maximumAdvanceDays,
            }
          : null,
      };
    });
  }

  async archiveCatalogItem(
    actor: ActorContext,
    organizationId: string,
    itemId: string,
  ): Promise<{ id: string; archived: true }> {
    await this.authorize(actor, organizationId);
    const now = new Date();
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const existing = await tx.catalogItem.findUnique({
        where: { organizationId_id: { organizationId, id: itemId } },
        include: { service: true },
      });
      if (!existing || existing.archivedAt) throw new NotFoundException('Catalog item not found');

      await tx.catalogItem.update({
        where: { organizationId_id: { organizationId, id: itemId } },
        data: {
          status: 'ARCHIVED',
          archivedAt: now,
          version: { increment: 1 },
        },
      });

      if (existing.service) {
        await tx.service.update({
          where: { organizationId_id: { organizationId, id: existing.service.id } },
          data: {
            active: false,
            archivedAt: now,
            version: { increment: 1 },
          },
        });
      }

      await this.audit(tx, actor, organizationId, 'catalog_item.archived', 'CatalogItem', itemId);
      return { id: itemId, archived: true };
    });
  }

  // --- Location, Staff, and Legacy Service Methods ---

  async createLocation(
    actor: ActorContext,
    organizationId: string,
    input: { name: string; timezone: string; address?: string },
  ) {
    await this.authorize(actor, organizationId);
    let timezone: string;
    try {
      timezone = assertIanaTimezone(input.timezone);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const activeCount = await tx.location.count({
        where: { organizationId, active: true, archivedAt: null },
      });
      if (activeCount) throw new ConflictException('Only one active location is supported in MVP');
      const row = await tx.location.create({
        data: {
          id: randomUUID(),
          organizationId,
          name: this.text(input.name, 'name'),
          timezone,
          address: input.address?.trim() || undefined,
        },
      });
      await this.audit(tx, actor, organizationId, 'location.created', 'Location', row.id);
      return row;
    });
  }

  async createService(
    actor: ActorContext,
    organizationId: string,
    input: {
      locationId: string;
      name: string;
      durationMinutes: number;
      bufferBeforeMinutes?: number;
      bufferAfterMinutes?: number;
      amountMinor: string;
      currency: string;
    },
  ) {
    await this.authorize(actor, organizationId);
    let money: Money;
    try {
      money = Money.create(input.amountMinor, input.currency);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (
      !Number.isInteger(input.durationMinutes) ||
      input.durationMinutes <= 0 ||
      !Number.isInteger(input.bufferBeforeMinutes ?? 0) ||
      (input.bufferBeforeMinutes ?? 0) < 0 ||
      !Number.isInteger(input.bufferAfterMinutes ?? 0) ||
      (input.bufferAfterMinutes ?? 0) < 0
    ) {
      throw new BadRequestException('Invalid duration or buffers');
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await this.assertCapability(tx, organizationId, 'SERVICE');

      const location = await tx.location.findUnique({
        where: { organizationId_id: { organizationId, id: input.locationId } },
      });
      if (!location || !location.active || location.archivedAt) {
        throw new ConflictException('Location is not active');
      }

      const catalogItemId = randomUUID();
      const serviceId = randomUUID();
      const name = this.text(input.name, 'name');

      const catItem = await tx.catalogItem.create({
        data: {
          id: catalogItemId,
          organizationId,
          kind: 'SERVICE',
          name,
          amountMinor: money.amountMinor,
          currency: money.currency,
          status: 'ACTIVE',
        },
      });

      const row = await tx.service.create({
        data: {
          id: serviceId,
          organizationId,
          catalogItemId: catItem.id,
          locationId: input.locationId,
          name,
          durationMinutes: input.durationMinutes,
          bufferBeforeMinutes: input.bufferBeforeMinutes ?? 0,
          bufferAfterMinutes: input.bufferAfterMinutes ?? 0,
          amountMinor: money.amountMinor,
          currency: money.currency,
        },
      });

      await this.audit(tx, actor, organizationId, 'catalog_item.created', 'CatalogItem', catItem.id);
      await this.audit(tx, actor, organizationId, 'service.created', 'Service', row.id);

      return {
        ...row,
        amountMinor: row.amountMinor.toString(),
        catalogItem: catItem,
      };
    });
  }

  async createStaff(
    actor: ActorContext,
    organizationId: string,
    input: { locationId: string; displayName: string; memberUserId?: string },
  ) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const location = await tx.location.findUnique({
        where: { organizationId_id: { organizationId, id: input.locationId } },
      });
      if (!location || !location.active || location.archivedAt) {
        throw new ConflictException('Location is not active');
      }
      if (input.memberUserId) {
        const membership = await tx.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId: input.memberUserId } },
        });
        if (!membership || membership.status !== 'ACTIVE') {
          throw new ConflictException('Staff user must be an active organization member');
        }
      }
      const row = await tx.staffMember.create({
        data: {
          id: randomUUID(),
          organizationId,
          locationId: input.locationId,
          displayName: this.text(input.displayName, 'displayName'),
          memberUserId: input.memberUserId,
        },
      });
      await this.audit(tx, actor, organizationId, 'staff.created', 'StaffMember', row.id);
      return row;
    });
  }

  async linkStaff(
    actor: ActorContext,
    organizationId: string,
    serviceId: string,
    staffId: string,
  ) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const service = await tx.service.findUnique({
        where: { organizationId_id: { organizationId, id: serviceId } },
      });
      const staff = await tx.staffMember.findUnique({
        where: { organizationId_id: { organizationId, id: staffId } },
      });
      if (!service || !staff) throw new NotFoundException();
      if (!service.active || service.archivedAt || !staff.active || staff.archivedAt) {
        throw new ConflictException('Archived or inactive reference');
      }
      if (service.locationId !== staff.locationId) {
        throw new ConflictException('Service and staff must share a location');
      }
      const row = await tx.serviceStaff.upsert({
        where: {
          organizationId_serviceId_staffId: { organizationId, serviceId, staffId },
        },
        create: { organizationId, serviceId, staffId },
        update: {},
      });
      await this.audit(
        tx,
        actor,
        organizationId,
        'service.staff_linked',
        'ServiceStaff',
        `${serviceId}:${staffId}`,
      );
      return row;
    });
  }

  async archive(actor: ActorContext, organizationId: string, kind: string, id: string) {
    await this.authorize(actor, organizationId);
    const now = new Date();
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      let count = 0;
      let target = '';
      if (kind === 'locations') {
        count = (
          await tx.location.updateMany({
            where: { organizationId, id, archivedAt: null },
            data: { active: false, archivedAt: now, version: { increment: 1 } },
          })
        ).count;
        target = 'Location';
      } else if (kind === 'services') {
        const svc = await tx.service.findUnique({
          where: { organizationId_id: { organizationId, id } },
        });
        if (svc) {
          count = (
            await tx.service.updateMany({
              where: { organizationId, id, archivedAt: null },
              data: { active: false, archivedAt: now, version: { increment: 1 } },
            })
          ).count;
          if (svc.catalogItemId) {
            await tx.catalogItem.updateMany({
              where: { organizationId, id: svc.catalogItemId, archivedAt: null },
              data: { status: 'ARCHIVED', archivedAt: now, version: { increment: 1 } },
            });
          }
        }
        target = 'Service';
      } else if (kind === 'staff') {
        count = (
          await tx.staffMember.updateMany({
            where: { organizationId, id, archivedAt: null },
            data: { active: false, archivedAt: now, version: { increment: 1 } },
          })
        ).count;
        target = 'StaffMember';
      } else {
        throw new BadRequestException('Invalid catalog kind');
      }
      if (!count) throw new NotFoundException();
      await this.audit(
        tx,
        actor,
        organizationId,
        `${target.toLowerCase()}.archived`,
        target,
        id,
      );
      return { id, archived: true };
    });
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
