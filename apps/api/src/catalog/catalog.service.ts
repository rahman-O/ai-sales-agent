import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantContextService, type ActorContext, type TenantTxClient } from '../database/tenant-context.service.js';
import { Money, assertIanaTimezone } from '../domain/value-objects.js';

@Injectable()
export class CatalogService {
  constructor(private readonly tenants: TenantContextService) {}
  private async authorize(actor: ActorContext, organizationId: string) {
    const m = await this.tenants.runAsActor(actor, tx => tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: actor.userId } } })) as { status: string } | null;
    if (!m || m.status !== 'ACTIVE') throw new NotFoundException(); return m;
  }
  private text(value: string, field: string) { const v = value?.trim(); if (!v || v.length > 160) throw new BadRequestException(`Invalid ${field}`); return v; }
  async list(actor: ActorContext, organizationId: string) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const services = await tx.service.findMany({ where: { organizationId, archivedAt: null }, include: { staff: true }, orderBy: { name: 'asc' } });
      return {
        locations: await tx.location.findMany({ where: { organizationId, archivedAt: null }, orderBy: { name: 'asc' } }),
        services: services.map((service: { amountMinor: bigint; [key: string]: unknown }) => ({ ...service, amountMinor: service.amountMinor.toString() })),
        staff: await tx.staffMember.findMany({ where: { organizationId, archivedAt: null }, orderBy: { displayName: 'asc' } }),
      };
    });
  }
  async createLocation(actor: ActorContext, organizationId: string, input: { name: string; timezone: string; address?: string }) {
    await this.authorize(actor, organizationId); let timezone: string;
    try { timezone = assertIanaTimezone(input.timezone); } catch (e) { throw new BadRequestException((e as Error).message); }
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const activeCount = await tx.location.count({ where: { organizationId, active: true, archivedAt: null } });
      if (activeCount) throw new ConflictException('Only one active location is supported in MVP');
      const row = await tx.location.create({ data: { id: randomUUID(), organizationId, name: this.text(input.name, 'name'), timezone, address: input.address?.trim() || undefined } });
      await this.audit(tx, actor, organizationId, 'location.created', 'Location', row.id); return row;
    });
  }
  async createService(actor: ActorContext, organizationId: string, input: { locationId: string; name: string; durationMinutes: number; bufferBeforeMinutes?: number; bufferAfterMinutes?: number; amountMinor: string; currency: string }) {
    await this.authorize(actor, organizationId); let money: Money;
    try { money = Money.create(input.amountMinor, input.currency); } catch (e) { throw new BadRequestException((e as Error).message); }
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0 || !Number.isInteger(input.bufferBeforeMinutes ?? 0) || (input.bufferBeforeMinutes ?? 0) < 0 || !Number.isInteger(input.bufferAfterMinutes ?? 0) || (input.bufferAfterMinutes ?? 0) < 0) throw new BadRequestException('Invalid duration or buffers');
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const location = await tx.location.findUnique({ where: { organizationId_id: { organizationId, id: input.locationId } } });
      if (!location || !location.active || location.archivedAt) throw new ConflictException('Location is not active');
      const row = await tx.service.create({ data: { id: randomUUID(), organizationId, locationId: input.locationId, name: this.text(input.name, 'name'), durationMinutes: input.durationMinutes, bufferBeforeMinutes: input.bufferBeforeMinutes ?? 0, bufferAfterMinutes: input.bufferAfterMinutes ?? 0, amountMinor: money.amountMinor, currency: money.currency } });
      await this.audit(tx, actor, organizationId, 'service.created', 'Service', row.id); return { ...row, amountMinor: row.amountMinor.toString() };
    });
  }
  async createStaff(actor: ActorContext, organizationId: string, input: { locationId: string; displayName: string; memberUserId?: string }) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const location = await tx.location.findUnique({ where: { organizationId_id: { organizationId, id: input.locationId } } });
      if (!location || !location.active || location.archivedAt) throw new ConflictException('Location is not active');
      if (input.memberUserId) {
        const membership = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: input.memberUserId } } });
        if (!membership || membership.status !== 'ACTIVE') throw new ConflictException('Staff user must be an active organization member');
      }
      const row = await tx.staffMember.create({ data: { id: randomUUID(), organizationId, locationId: input.locationId, displayName: this.text(input.displayName, 'displayName'), memberUserId: input.memberUserId } });
      await this.audit(tx, actor, organizationId, 'staff.created', 'StaffMember', row.id); return row;
    });
  }
  async linkStaff(actor: ActorContext, organizationId: string, serviceId: string, staffId: string) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const service = await tx.service.findUnique({ where: { organizationId_id: { organizationId, id: serviceId } } });
      const staff = await tx.staffMember.findUnique({ where: { organizationId_id: { organizationId, id: staffId } } });
      if (!service || !staff) throw new NotFoundException();
      if (!service.active || service.archivedAt || !staff.active || staff.archivedAt) throw new ConflictException('Archived or inactive reference');
      if (service.locationId !== staff.locationId) throw new ConflictException('Service and staff must share a location');
      const row = await tx.serviceStaff.upsert({ where: { organizationId_serviceId_staffId: { organizationId, serviceId, staffId } }, create: { organizationId, serviceId, staffId }, update: {} });
      await this.audit(tx, actor, organizationId, 'service.staff_linked', 'ServiceStaff', `${serviceId}:${staffId}`); return row;
    });
  }
  async archive(actor: ActorContext, organizationId: string, kind: string, id: string) {
    await this.authorize(actor, organizationId); const now = new Date();
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      let count = 0; let target = '';
      if (kind === 'locations') { count = (await tx.location.updateMany({ where: { organizationId, id, archivedAt: null }, data: { active: false, archivedAt: now, version: { increment: 1 } } })).count; target = 'Location'; }
      else if (kind === 'services') { count = (await tx.service.updateMany({ where: { organizationId, id, archivedAt: null }, data: { active: false, archivedAt: now, version: { increment: 1 } } })).count; target = 'Service'; }
      else if (kind === 'staff') { count = (await tx.staffMember.updateMany({ where: { organizationId, id, archivedAt: null }, data: { active: false, archivedAt: now, version: { increment: 1 } } })).count; target = 'StaffMember'; }
      else throw new BadRequestException('Invalid catalog kind');
      if (!count) throw new NotFoundException(); await this.audit(tx, actor, organizationId, `${target.toLowerCase()}.archived`, target, id); return { id, archived: true };
    });
  }
  private audit(tx: TenantTxClient, actor: ActorContext, organizationId: string, action: string, targetType: string, targetId: string) { return this.tenants.writeAudit(tx, { organizationId, actorUserId: actor.userId, action, targetType, targetId, requestId: actor.requestId }); }
}
