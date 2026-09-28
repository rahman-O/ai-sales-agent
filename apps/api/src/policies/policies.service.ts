import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BUSINESS_POLICY_STATUSES,
  BusinessPolicyTypeSchema,
  isEnforceablePolicyType,
  parseBusinessPolicyRules,
  selectEffectivePolicy,
  type BusinessPolicyDto,
  type BusinessPolicyStatus,
  type BusinessPolicyType,
  type CreateBusinessPolicyRequest,
  type EffectivePolicyResponse,
  type UpdateBusinessPolicyRequest,
} from '@ai-sales-agent/contracts';
import { ZodError } from 'zod';
import { TenantContextService, type ActorContext, type TenantTxClient } from '../database/tenant-context.service.js';

@Injectable()
export class PoliciesService {
  constructor(private readonly tenants: TenantContextService) {}

  private async authorize(actor: ActorContext, organizationId: string, mutate = false) {
    const membership = await this.tenants.runAsActor(actor, (tx) => tx.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: actor.userId } },
    })) as { status: string; role: string } | null;
    if (!membership || membership.status !== 'ACTIVE') throw new NotFoundException();
    if (mutate && membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN may manage policies');
    }
  }

  private policyType(value: unknown): BusinessPolicyType {
    const parsed = BusinessPolicyTypeSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException('Invalid policyType');
    return parsed.data;
  }

  private rules(type: BusinessPolicyType, value: unknown) {
    try {
      return parseBusinessPolicyRules(type, value);
    } catch (error) {
      throw new BadRequestException(error instanceof ZodError ? error.issues : 'Invalid rulesJson');
    }
  }

  private text(value: unknown, field: string, max: number) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || normalized.length > max) throw new BadRequestException(`Invalid ${field}`);
    return normalized;
  }

  private dates(effectiveFrom?: string | null, effectiveUntil?: string | null) {
    const from = effectiveFrom ? new Date(effectiveFrom) : null;
    const until = effectiveUntil ? new Date(effectiveUntil) : null;
    if ((from && Number.isNaN(from.getTime())) || (until && Number.isNaN(until.getTime()))) {
      throw new BadRequestException('Effective dates must be ISO timestamps');
    }
    if (from && until && until < from) throw new BadRequestException('effectiveUntil must be after effectiveFrom');
    return { from, until };
  }

  async list(actor: ActorContext, organizationId: string, filter: { policyType?: BusinessPolicyType; status?: BusinessPolicyStatus }) {
    await this.authorize(actor, organizationId);
    if (filter.policyType) this.policyType(filter.policyType);
    if (filter.status && !(BUSINESS_POLICY_STATUSES as readonly string[]).includes(filter.status)) {
      throw new BadRequestException('Invalid status');
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = await tx.businessPolicy.findMany({
        where: { organizationId, ...(filter.policyType ? { policyType: filter.policyType } : {}), ...(filter.status ? { status: filter.status } : {}) },
        orderBy: [{ policyType: 'asc' }, { version: 'desc' }],
      });
      return { items: rows.map((row: unknown) => this.dto(row)), total: rows.length };
    });
  }

  async get(actor: ActorContext, organizationId: string, policyId: string) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const row = await tx.businessPolicy.findUnique({ where: { organizationId_id: { organizationId, id: policyId } } });
      if (!row) throw new NotFoundException('Policy not found');
      return this.dto(row);
    });
  }

  async create(actor: ActorContext, organizationId: string, input: CreateBusinessPolicyRequest) {
    await this.authorize(actor, organizationId, true);
    const type = this.policyType(input.policyType);
    const rules = this.rules(type, input.rulesJson);
    const dates = this.dates(input.effectiveFrom, input.effectiveUntil);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${type}`}))`;
      const latest = await tx.businessPolicy.findFirst({ where: { organizationId, policyType: type }, orderBy: { version: 'desc' } });
      const row = await tx.businessPolicy.create({ data: {
        id: randomUUID(), organizationId, policyType: type, status: 'DRAFT',
        title: this.text(input.title, 'title', 160), summary: this.text(input.summary, 'summary', 4000),
        rulesJson: rules, enforcementMode: isEnforceablePolicyType(type) ? 'ENFORCEABLE' : 'INFORMATIONAL_ONLY',
        effectiveFrom: dates.from, effectiveUntil: dates.until, version: (latest?.version ?? 0) + 1,
        metadataJson: input.metadataJson ?? undefined,
      } });
      await this.audit(tx, actor, organizationId, 'policy.created', row);
      return this.dto(row);
    });
  }

  async update(actor: ActorContext, organizationId: string, policyId: string, input: UpdateBusinessPolicyRequest) {
    await this.authorize(actor, organizationId, true);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const existing = await tx.businessPolicy.findUnique({ where: { organizationId_id: { organizationId, id: policyId } } });
      if (!existing) throw new NotFoundException('Policy not found');
      if (existing.status !== 'DRAFT') throw new BadRequestException('Only DRAFT policies can be edited; create a new version instead');
      const dates = this.dates(
        input.effectiveFrom === undefined ? existing.effectiveFrom?.toISOString() : input.effectiveFrom,
        input.effectiveUntil === undefined ? existing.effectiveUntil?.toISOString() : input.effectiveUntil,
      );
      const row = await tx.businessPolicy.update({ where: { organizationId_id: { organizationId, id: policyId } }, data: {
        ...(input.title !== undefined ? { title: this.text(input.title, 'title', 160) } : {}),
        ...(input.summary !== undefined ? { summary: this.text(input.summary, 'summary', 4000) } : {}),
        ...(input.rulesJson !== undefined ? { rulesJson: this.rules(existing.policyType as BusinessPolicyType, input.rulesJson) } : {}),
        ...(input.effectiveFrom !== undefined ? { effectiveFrom: dates.from } : {}),
        ...(input.effectiveUntil !== undefined ? { effectiveUntil: dates.until } : {}),
        ...(input.metadataJson !== undefined ? { metadataJson: input.metadataJson ?? undefined } : {}),
      } });
      await this.audit(tx, actor, organizationId, 'policy.updated', row);
      return this.dto(row);
    });
  }

  async activate(actor: ActorContext, organizationId: string, policyId: string) {
    await this.authorize(actor, organizationId, true);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const existing = await tx.businessPolicy.findUnique({ where: { organizationId_id: { organizationId, id: policyId } } });
      if (!existing) throw new NotFoundException('Policy not found');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${existing.policyType}`}))`;
      await tx.businessPolicy.updateMany({
        where: { organizationId, policyType: existing.policyType, status: 'ACTIVE', id: { not: policyId } },
        data: { status: 'ARCHIVED' },
      });
      const row = await tx.businessPolicy.update({ where: { organizationId_id: { organizationId, id: policyId } }, data: { status: 'ACTIVE' } });
      await this.audit(tx, actor, organizationId, 'policy.activated', row);
      return this.dto(row);
    });
  }

  async archive(actor: ActorContext, organizationId: string, policyId: string) {
    await this.authorize(actor, organizationId, true);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const existing = await tx.businessPolicy.findUnique({ where: { organizationId_id: { organizationId, id: policyId } } });
      if (!existing) throw new NotFoundException('Policy not found');
      const row = await tx.businessPolicy.update({ where: { organizationId_id: { organizationId, id: policyId } }, data: { status: 'ARCHIVED' } });
      await this.audit(tx, actor, organizationId, 'policy.archived', row);
      return this.dto(row);
    });
  }

  async getEffective(actor: ActorContext, organizationId: string, policyType: BusinessPolicyType, currentTime = new Date()): Promise<EffectivePolicyResponse> {
    await this.authorize(actor, organizationId);
    const type = this.policyType(policyType);
    return this.tenants.runInTenantContext(organizationId, actor, (tx) => this.resolveEffectiveInTx(tx, organizationId, type, currentTime));
  }

  async resolveEffectiveInTx(tx: TenantTxClient, organizationId: string, policyType: BusinessPolicyType, currentTime = new Date()): Promise<EffectivePolicyResponse> {
    const candidates = await tx.businessPolicy.findMany({
      where: { organizationId, policyType, status: 'ACTIVE' },
      orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });
    const selected = selectEffectivePolicy(candidates, currentTime);
    return { policy: selected ? this.dto(selected) : null, resolvedAt: currentTime.toISOString(), precedence: 'HIGHEST_VERSION_THEN_LATEST_EFFECTIVE_FROM' };
  }

  private dto(row: any): BusinessPolicyDto {
    return {
      id: row.id, organizationId: row.organizationId, policyType: row.policyType, status: row.status,
      title: row.title, summary: row.summary, rulesJson: row.rulesJson as Record<string, unknown>,
      enforcementMode: row.enforcementMode, effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      effectiveUntil: row.effectiveUntil?.toISOString() ?? null, version: row.version,
      metadataJson: row.metadataJson as Record<string, unknown> | null,
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    };
  }

  private audit(tx: TenantTxClient, actor: ActorContext, organizationId: string, action: string, row: any) {
    return this.tenants.writeAudit(tx, {
      organizationId, actorUserId: actor.userId, action, targetType: 'BusinessPolicy', targetId: row.id,
      requestId: actor.requestId, metadataJson: { policyType: row.policyType, version: row.version },
    });
  }
}
