import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantContextService, type ActorContext, type TenantTxClient } from '../database/tenant-context.service.js';
import { normalizeContact } from '../domain/value-objects.js';
import { domainEvent } from '../domain/domain-event.js';

@Injectable()
export class CustomersService {
  constructor(private readonly tenants: TenantContextService) {}

  private async authorize(actor: ActorContext, organizationId: string) {
    const m = await this.tenants.runAsActor(actor, tx => tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: actor.userId } } })) as { status: string } | null;
    if (!m || m.status !== 'ACTIVE') throw new NotFoundException();
    return m;
  }
  private name(value?: string) {
    if (value === undefined) return undefined;
    const v = value.trim(); if (!v || v.length > 160) throw new BadRequestException('Invalid displayName'); return v;
  }
  async list(actor: ActorContext, organizationId: string, query?: string) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, tx => tx.customer.findMany({
      where: { organizationId, archivedAt: null, ...(query?.trim() ? { displayName: { contains: query.trim(), mode: 'insensitive' } } : {}) },
      include: { identities: { where: { revokedAt: null } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 100,
    }));
  }
  async get(actor: ActorContext, organizationId: string, id: string) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const row = await tx.customer.findUnique({ where: { organizationId_id: { organizationId, id } }, include: { identities: true } });
      if (!row) throw new NotFoundException(); return row;
    });
  }
  async create(actor: ActorContext, organizationId: string, input: { displayName?: string; preferredLocale?: string }) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const customer = await tx.customer.create({ data: { id: randomUUID(), organizationId, displayName: this.name(input.displayName), preferredLocale: input.preferredLocale?.trim() || undefined } });
      await this.audit(tx, actor, organizationId, 'customer.created', customer.id);
      const event = domainEvent({ organizationId, eventType: 'CustomerCreated', aggregateType: 'Customer', aggregateId: customer.id, aggregateVersion: customer.version, actor: { type: 'USER', id: actor.userId }, correlationId: actor.requestId, payload: { customerId: customer.id } });
      await this.tenants.writeOutbox(tx, { organizationId, eventType: event.eventType, payloadJson: event });
      return customer;
    });
  }
  async update(actor: ActorContext, organizationId: string, id: string, input: { displayName?: string; preferredLocale?: string; expectedVersion: number }) {
    await this.authorize(actor, organizationId);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw new BadRequestException('expectedVersion required');
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const result = await tx.customer.updateMany({ where: { organizationId, id, version: input.expectedVersion, archivedAt: null, mergedIntoId: null }, data: { displayName: this.name(input.displayName), preferredLocale: input.preferredLocale?.trim(), version: { increment: 1 } } });
      if (!result.count) throw new ConflictException('Customer version or state conflict');
      const row = await tx.customer.findUniqueOrThrow({ where: { organizationId_id: { organizationId, id } } });
      await this.audit(tx, actor, organizationId, 'customer.updated', id, { version: row.version }); return row;
    });
  }
  async bindIdentity(actor: ActorContext, organizationId: string, customerId: string, input: { channel: string; externalAddress: string }) {
    await this.authorize(actor, organizationId);
    let address; try { address = normalizeContact(input.channel, input.externalAddress); } catch (e) { throw new BadRequestException((e as Error).message); }
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const customer = await tx.customer.findUnique({ where: { organizationId_id: { organizationId, id: customerId } } });
      if (!customer || customer.archivedAt || customer.mergedIntoId) throw new NotFoundException();
      const externalChannelId = `fixture:${organizationId}:${address.channel}`;
      let connection = await tx.channelConnection.findUnique({
        where: { provider_externalChannelId: { provider: address.channel, externalChannelId } },
      });
      if (!connection) {
        connection = await tx.channelConnection.create({
          data: {
            id: randomUUID(),
            organizationId,
            provider: address.channel,
            externalChannelId,
            status: 'ACTIVE',
          },
        });
      } else if (connection.organizationId !== organizationId) {
        throw new ConflictException('Channel connection bound elsewhere');
      }
      const existing = await tx.customerIdentity.findUnique({
        where: {
          organizationId_channelConnectionId_externalAddress: {
            organizationId,
            channelConnectionId: connection.id,
            externalAddress: address.externalAddress,
          },
        },
      });
      if (existing) {
        if (existing.customerId !== customerId || existing.revokedAt) throw new ConflictException('Identity already bound');
        return existing;
      }
      const identity = await tx.customerIdentity.create({
        data: {
          id: randomUUID(),
          organizationId,
          customerId,
          channelConnectionId: connection.id,
          channel: address.channel,
          externalAddress: address.externalAddress,
        },
      });
      await this.audit(tx, actor, organizationId, 'customer.identity_bound', identity.id, { customerId, channel: address.channel });
      return identity;
    });
  }
  async merge(actor: ActorContext, organizationId: string, canonicalId: string, sourceId: string, evidenceReference: string) {
    await this.authorize(actor, organizationId);
    if (canonicalId === sourceId) throw new BadRequestException('Customers must differ');
    const evidence = evidenceReference?.trim();
    if (!evidence || evidence.length > 200) throw new BadRequestException('Verified identity evidence reference required');
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const locked = await tx.$queryRaw<Array<{ id: string; archived_at: Date | null; merged_into_id: string | null }>>`
        SELECT id, archived_at, merged_into_id FROM customers WHERE organization_id=${organizationId}::uuid AND id IN (${canonicalId}::uuid, ${sourceId}::uuid) ORDER BY id FOR UPDATE`;
      if (locked.length !== 2 || locked.some((x: { archived_at: Date | null; merged_into_id: string | null }) => x.archived_at || x.merged_into_id)) throw new ConflictException('Customer merge state conflict');
      await tx.customerIdentity.updateMany({ where: { organizationId, customerId: sourceId }, data: { customerId: canonicalId } });
      // P03: keep Conversation.customerId aligned with identity canonical ownership
      await tx.conversation.updateMany({ where: { organizationId, customerId: sourceId }, data: { customerId: canonicalId, version: { increment: 1 } } });
      await tx.customer.update({ where: { organizationId_id: { organizationId, id: sourceId } }, data: { mergedIntoId: canonicalId, archivedAt: new Date(), version: { increment: 1 } } });
      const canonical = await tx.customer.update({ where: { organizationId_id: { organizationId, id: canonicalId } }, data: { version: { increment: 1 } } });
      await this.audit(tx, actor, organizationId, 'customer.merged', canonicalId, { sourceCustomerId: sourceId, evidenceReference: evidence });
      return { canonicalCustomerId: canonicalId, sourceCustomerId: sourceId, version: canonical.version };
    });
  }
  async archive(actor: ActorContext, organizationId: string, id: string) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async tx => {
      const r = await tx.customer.updateMany({ where: { organizationId, id, archivedAt: null, mergedIntoId: null }, data: { archivedAt: new Date(), version: { increment: 1 } } });
      if (!r.count) throw new NotFoundException(); await this.audit(tx, actor, organizationId, 'customer.archived', id); return { id, archived: true };
    });
  }
  private audit(tx: TenantTxClient, actor: ActorContext, organizationId: string, action: string, targetId: string, metadataJson?: unknown) {
    return this.tenants.writeAudit(tx, { organizationId, actorUserId: actor.userId, action, targetType: 'Customer', targetId, metadataJson, requestId: actor.requestId });
  }
}
