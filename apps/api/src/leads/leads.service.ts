import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  TenantContextService,
  type ActorContext,
  type TenantTxClient,
} from '../database/tenant-context.service.js';
import { domainEvent } from '../domain/domain-event.js';
import {
  deriveQualificationState,
  isArchivedReason,
  isDisqualifiedReason,
  isOpenStatus,
  isValidTransition,
  mergeMissingQualification,
  type LeadStatus,
  type QualificationState,
} from '../domain/lead-state.js';

type LeadRecord = {
  id: string;
  organizationId: string;
  customerId: string;
  status: string;
  primaryServiceId: string | null;
  locationId: string | null;
  assignedUserId: string | null;
  assignedAt: Date | null;
  assignedByUserId: string | null;
  preferredContactChannel: string | null;
  language: string | null;
  urgency: string | null;
  needSummary: string | null;
  sourceType: string;
  sourceConversationId: string | null;
  sourceMessageId: string | null;
  statusReasonCode: string | null;
  statusReasonText: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

@Injectable()
export class LeadsService {
  constructor(private readonly tenants: TenantContextService) {}

  private async membership(actor: ActorContext, organizationId: string) {
    const m = (await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    )) as { status: string; role: string } | null;
    if (!m || m.status !== 'ACTIVE') throw new NotFoundException();
    return m;
  }

  private requireRead(role: string) {
    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(role)) {
      throw new ForbiddenException('MEMBER+ required');
    }
  }

  private requireWrite(role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('ADMIN/OWNER required');
    }
  }

  private async activeLocationCount(tx: TenantTxClient, organizationId: string): Promise<number> {
    return tx.location.count({
      where: { organizationId, active: true, archivedAt: null },
    });
  }

  private async toDto(tx: TenantTxClient, organizationId: string, lead: LeadRecord) {
    const activeLocationCount = await this.activeLocationCount(tx, organizationId);
    const qualificationState: QualificationState = deriveQualificationState(lead, {
      activeLocationCount,
    });
    return { ...lead, qualificationState };
  }

  private async appendActivity(
    tx: TenantTxClient,
    input: {
      organizationId: string;
      leadId: string;
      type: string;
      actorType: 'USER' | 'AGENT' | 'SYSTEM';
      actorId?: string | null;
      sourceConversationId?: string | null;
      sourceAgentRunId?: string | null;
      metadataJson?: Record<string, unknown>;
    },
  ) {
    const meta = input.metadataJson ?? {};
    const size = Buffer.byteLength(JSON.stringify(meta), 'utf8');
    if (size > 4096) throw new BadRequestException('Activity metadata too large');
    return tx.leadActivity.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        leadId: input.leadId,
        type: input.type,
        actorType: input.actorType,
        actorId: input.actorId ?? undefined,
        sourceConversationId: input.sourceConversationId ?? undefined,
        sourceAgentRunId: input.sourceAgentRunId ?? undefined,
        metadataJson: meta,
      },
    });
  }

  async list(
    actor: ActorContext,
    organizationId: string,
    query: { status?: string; customerId?: string; assignedUserId?: string; take?: number },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireRead(m.role);
    const take = Math.min(Math.max(query.take ?? 50, 1), 100);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = (await tx.lead.findMany({
        where: {
          organizationId,
          ...(query.status ? { status: query.status } : {}),
          ...(query.customerId ? { customerId: query.customerId } : {}),
          ...(query.assignedUserId ? { assignedUserId: query.assignedUserId } : {}),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take,
      })) as LeadRecord[];
      const activeLocationCount = await this.activeLocationCount(tx, organizationId);
      return rows.map((lead) => ({
        ...lead,
        qualificationState: deriveQualificationState(lead, { activeLocationCount }),
      }));
    });
  }

  async get(actor: ActorContext, organizationId: string, leadId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireRead(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const lead = (await tx.lead.findUnique({
        where: { organizationId_id: { organizationId, id: leadId } },
      })) as LeadRecord | null;
      if (!lead) throw new NotFoundException();
      return this.toDto(tx, organizationId, lead);
    });
  }

  async listActivities(actor: ActorContext, organizationId: string, leadId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireRead(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { organizationId_id: { organizationId, id: leadId } },
      });
      if (!lead) throw new NotFoundException();
      return tx.leadActivity.findMany({
        where: { organizationId, leadId },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });
    });
  }

  async create(
    actor: ActorContext,
    organizationId: string,
    input: {
      customerId: string;
      primaryServiceId?: string | null;
      locationId?: string | null;
      needSummary?: string | null;
      preferredContactChannel?: string | null;
      language?: string | null;
      urgency?: string | null;
      sourceConversationId?: string | null;
      sourceMessageId?: string | null;
      sourceType?: string;
    },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const ensured = await this.ensureOpenLeadInTx(tx, {
        organizationId,
        customerId: input.customerId,
        primaryServiceId: input.primaryServiceId ?? null,
        locationId: input.locationId ?? null,
        needSummary: input.needSummary ?? null,
        preferredContactChannel: input.preferredContactChannel ?? null,
        language: input.language ?? null,
        urgency: input.urgency ?? null,
        sourceConversationId: input.sourceConversationId ?? null,
        sourceMessageId: input.sourceMessageId ?? null,
        sourceType: input.sourceType ?? 'MANUAL',
        actorType: 'USER',
        actorId: actor.userId,
        createdByUserId: actor.userId,
      });
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'lead.ensured',
        targetType: 'Lead',
        targetId: ensured.lead.id,
        requestId: actor.requestId,
        metadataJson: { created: ensured.created },
      });
      return this.toDto(tx, organizationId, ensured.lead);
    });
  }

  /**
   * Core ensure/resolve used by API and (via SQL twin) agent tools.
   * With serviceId: promote generic or collide-merge.
   * Without: reuse generic only; AMBIGUOUS if multiple OPEN.
   */
  async ensureOpenLeadInTx(
    tx: TenantTxClient,
    input: {
      organizationId: string;
      customerId: string;
      primaryServiceId: string | null;
      locationId?: string | null;
      needSummary?: string | null;
      preferredContactChannel?: string | null;
      language?: string | null;
      urgency?: string | null;
      sourceConversationId?: string | null;
      sourceMessageId?: string | null;
      sourceType?: string;
      actorType: 'USER' | 'AGENT' | 'SYSTEM';
      actorId?: string | null;
      createdByUserId?: string | null;
      createdByAgentRunId?: string | null;
      sourceAgentRunId?: string | null;
    },
  ): Promise<{ lead: LeadRecord; created: boolean }> {
    const customer = await tx.customer.findUnique({
      where: {
        organizationId_id: { organizationId: input.organizationId, id: input.customerId },
      },
    });
    if (!customer || customer.archivedAt || customer.mergedIntoId) {
      throw new NotFoundException('Customer not found');
    }

    if (input.primaryServiceId) {
      const svc = await tx.service.findUnique({
        where: {
          organizationId_id: {
            organizationId: input.organizationId,
            id: input.primaryServiceId,
          },
        },
      });
      if (!svc || svc.archivedAt || !svc.active) {
        throw new BadRequestException('Invalid serviceId');
      }
    }

    const open = (await tx.lead.findMany({
      where: {
        organizationId: input.organizationId,
        customerId: input.customerId,
        status: { in: ['NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE'] },
      },
      orderBy: { createdAt: 'asc' },
    })) as LeadRecord[];

    if (input.primaryServiceId) {
      const serviceOpen = open.find((l) => l.primaryServiceId === input.primaryServiceId);
      const genericOpen = open.find((l) => l.primaryServiceId === null);

      if (serviceOpen && genericOpen) {
        return {
          lead: await this.collideGenericIntoService(tx, genericOpen, serviceOpen, input),
          created: false,
        };
      }
      if (serviceOpen) {
        return { lead: serviceOpen, created: false };
      }
      if (genericOpen) {
        const updated = (await tx.lead.update({
          where: {
            organizationId_id: { organizationId: input.organizationId, id: genericOpen.id },
          },
          data: {
            primaryServiceId: input.primaryServiceId,
            locationId: genericOpen.locationId ?? input.locationId ?? undefined,
            needSummary: genericOpen.needSummary ?? input.needSummary ?? undefined,
            preferredContactChannel:
              genericOpen.preferredContactChannel ?? input.preferredContactChannel ?? undefined,
            language: genericOpen.language ?? input.language ?? undefined,
            urgency: genericOpen.urgency ?? input.urgency ?? undefined,
            version: { increment: 1 },
          },
        })) as LeadRecord;
        await this.appendActivity(tx, {
          organizationId: input.organizationId,
          leadId: updated.id,
          type: 'SERVICE_INTEREST_CHANGED',
          actorType: input.actorType,
          actorId: input.actorId,
          sourceConversationId: input.sourceConversationId,
          sourceAgentRunId: input.sourceAgentRunId,
          metadataJson: {
            from: null,
            to: input.primaryServiceId,
            promotion: 'generic_to_service',
          },
        });
        return { lead: updated, created: false };
      }
      return {
        lead: await this.insertNewLead(tx, input),
        created: true,
      };
    }

    // No serviceId — reuse generic only; never treat service-specific as generic.
    const generic = open.filter((l) => l.primaryServiceId === null);
    if (generic.length === 1) return { lead: generic[0]!, created: false };
    if (generic.length > 1) throw new ConflictException('AMBIGUOUS_LEAD');
    // Multiple OPEN without a selector (e.g. several service-specific) → ambiguous
    if (open.length > 1) throw new ConflictException('AMBIGUOUS_LEAD');
    // 0 OPEN, or exactly one service-specific OPEN → create a distinct generic OPEN
    return {
      lead: await this.insertNewLead(tx, { ...input, primaryServiceId: null }),
      created: true,
    };
  }

  private async collideGenericIntoService(
    tx: TenantTxClient,
    generic: LeadRecord,
    serviceLead: LeadRecord,
    input: {
      organizationId: string;
      actorType: 'USER' | 'AGENT' | 'SYSTEM';
      actorId?: string | null;
      sourceConversationId?: string | null;
      sourceAgentRunId?: string | null;
    },
  ): Promise<LeadRecord> {
    const sorted = [generic, serviceLead].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
    );
    const winner = sorted[0]!;
    const loser = sorted[1]!;
    const merged = mergeMissingQualification(
      {
        primaryServiceId: winner.primaryServiceId ?? serviceLead.primaryServiceId,
        locationId: winner.locationId,
        needSummary: winner.needSummary,
        preferredContactChannel: winner.preferredContactChannel,
        language: winner.language,
        urgency: winner.urgency,
      },
      {
        primaryServiceId: loser.primaryServiceId,
        locationId: loser.locationId,
        needSummary: loser.needSummary,
        preferredContactChannel: loser.preferredContactChannel,
        language: loser.language,
        urgency: loser.urgency,
      },
    );
    // Winner must end as service-specific
    merged.primaryServiceId = serviceLead.primaryServiceId;

    await tx.lead.update({
      where: { organizationId_id: { organizationId: input.organizationId, id: loser.id } },
      data: {
        status: 'ARCHIVED',
        statusReasonCode: 'MERGED_DUPLICATE_OPEN_LEAD',
        statusChangedAt: new Date(),
        statusChangedByType: 'SYSTEM',
        archivedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await this.appendActivity(tx, {
      organizationId: input.organizationId,
      leadId: loser.id,
      type: 'MERGED_DUPLICATE',
      actorType: 'SYSTEM',
      metadataJson: {
        reasonCode: 'MERGED_DUPLICATE_OPEN_LEAD',
        canonicalLeadId: winner.id,
      },
    });

    const updated = (await tx.lead.update({
      where: { organizationId_id: { organizationId: input.organizationId, id: winner.id } },
      data: {
        primaryServiceId: merged.primaryServiceId,
        locationId: merged.locationId,
        needSummary: merged.needSummary,
        preferredContactChannel: merged.preferredContactChannel,
        language: merged.language,
        urgency: merged.urgency,
        version: { increment: 1 },
      },
    })) as LeadRecord;

    await this.appendActivity(tx, {
      organizationId: input.organizationId,
      leadId: winner.id,
      type: 'MERGED_DUPLICATE',
      actorType: input.actorType,
      actorId: input.actorId,
      sourceConversationId: input.sourceConversationId,
      sourceAgentRunId: input.sourceAgentRunId,
      metadataJson: {
        reasonCode: 'MERGED_DUPLICATE_OPEN_LEAD',
        archivedLeadId: loser.id,
      },
    });
    return updated;
  }

  private async insertNewLead(
    tx: TenantTxClient,
    input: {
      organizationId: string;
      customerId: string;
      primaryServiceId: string | null;
      locationId?: string | null;
      needSummary?: string | null;
      preferredContactChannel?: string | null;
      language?: string | null;
      urgency?: string | null;
      sourceConversationId?: string | null;
      sourceMessageId?: string | null;
      sourceType?: string;
      actorType: 'USER' | 'AGENT' | 'SYSTEM';
      actorId?: string | null;
      createdByUserId?: string | null;
      createdByAgentRunId?: string | null;
      sourceAgentRunId?: string | null;
    },
  ): Promise<LeadRecord> {
    try {
      const lead = (await tx.lead.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          customerId: input.customerId,
          status: 'NEW',
          primaryServiceId: input.primaryServiceId,
          locationId: input.locationId ?? undefined,
          needSummary: input.needSummary ?? undefined,
          preferredContactChannel: input.preferredContactChannel ?? undefined,
          language: input.language ?? undefined,
          urgency: input.urgency ?? undefined,
          sourceType: input.sourceType ?? 'INBOUND_CONVERSATION',
          sourceConversationId: input.sourceConversationId ?? undefined,
          sourceMessageId: input.sourceMessageId ?? undefined,
          createdByUserId: input.createdByUserId ?? undefined,
          createdByAgentRunId: input.createdByAgentRunId ?? undefined,
          statusChangedByType: input.actorType,
          statusChangedById: input.actorId ?? undefined,
        },
      })) as LeadRecord;
      await this.appendActivity(tx, {
        organizationId: input.organizationId,
        leadId: lead.id,
        type: 'LEAD_CREATED',
        actorType: input.actorType,
        actorId: input.actorId,
        sourceConversationId: input.sourceConversationId,
        sourceAgentRunId: input.sourceAgentRunId,
        metadataJson: { status: 'NEW', primaryServiceId: input.primaryServiceId },
      });
      const event = domainEvent({
        organizationId: input.organizationId,
        eventType: 'LeadCreated',
        aggregateType: 'Lead',
        aggregateId: lead.id,
        aggregateVersion: lead.version,
        actor: { type: 'USER', id: input.createdByUserId ?? input.actorId ?? randomUUID() },
        payload: { leadId: lead.id, customerId: input.customerId },
      });
      await this.tenants.writeOutbox(tx, {
        organizationId: input.organizationId,
        eventType: event.eventType,
        payloadJson: event,
      });
      return lead;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'P2002') {
        // Unique violation — return existing OPEN
        const existing = (await tx.lead.findFirst({
          where: {
            organizationId: input.organizationId,
            customerId: input.customerId,
            status: { in: ['NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE'] },
            ...(input.primaryServiceId
              ? { primaryServiceId: input.primaryServiceId }
              : { primaryServiceId: null }),
          },
          orderBy: { createdAt: 'asc' },
        })) as LeadRecord | null;
        if (existing) return existing;
      }
      throw e;
    }
  }

  async getForConversationCustomer(
    actor: ActorContext,
    organizationId: string,
    customerId: string,
    selector: { leadId?: string; serviceId?: string },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireRead(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      return this.resolveGetLeadInTx(tx, organizationId, customerId, selector);
    });
  }

  async resolveGetLeadInTx(
    tx: TenantTxClient,
    organizationId: string,
    customerId: string,
    selector: { leadId?: string; serviceId?: string },
  ) {
    if (selector.leadId) {
      const lead = (await tx.lead.findUnique({
        where: { organizationId_id: { organizationId, id: selector.leadId } },
      })) as LeadRecord | null;
      if (!lead || lead.customerId !== customerId) throw new NotFoundException();
      return this.toDto(tx, organizationId, lead);
    }
    const open = (await tx.lead.findMany({
      where: {
        organizationId,
        customerId,
        status: { in: ['NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE'] },
      },
      orderBy: { createdAt: 'asc' },
    })) as LeadRecord[];

    if (selector.serviceId) {
      const match = open.find((l) => l.primaryServiceId === selector.serviceId);
      if (!match) throw new NotFoundException();
      return this.toDto(tx, organizationId, match);
    }

    if (open.length === 0) throw new NotFoundException();
    if (open.length > 1) throw new ConflictException('AMBIGUOUS_LEAD');
    return this.toDto(tx, organizationId, open[0]!);
  }

  async updateQualification(
    actor: ActorContext,
    organizationId: string,
    leadId: string,
    input: {
      expectedVersion: number;
      primaryServiceId?: string | null;
      locationId?: string | null;
      needSummary?: string | null;
      preferredContactChannel?: string | null;
      language?: string | null;
      urgency?: string | null;
    },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
      throw new BadRequestException('expectedVersion required');
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const current = (await tx.lead.findUnique({
        where: { organizationId_id: { organizationId, id: leadId } },
      })) as LeadRecord | null;
      if (!current) throw new NotFoundException();
      if (!isOpenStatus(current.status)) {
        throw new ConflictException('Lead is terminal');
      }
      if (current.version !== input.expectedVersion) {
        throw new ConflictException('VERSION_CONFLICT');
      }

      if (input.primaryServiceId) {
        // Route through ensure semantics for generic→service
        if (!current.primaryServiceId) {
          const ensured = await this.ensureOpenLeadInTx(tx, {
            organizationId,
            customerId: current.customerId,
            primaryServiceId: input.primaryServiceId,
            locationId: input.locationId ?? current.locationId,
            needSummary: input.needSummary ?? current.needSummary,
            preferredContactChannel:
              input.preferredContactChannel ?? current.preferredContactChannel,
            language: input.language ?? current.language,
            urgency: input.urgency ?? current.urgency,
            actorType: 'USER',
            actorId: actor.userId,
            createdByUserId: actor.userId,
          });
          // If ensure returned a different lead (collision), still patch remaining fields
          const target = ensured.lead;
          if (target.version === input.expectedVersion || target.id === leadId) {
            // fall through to patch on target with fresh version check
          }
          const patched = await this.patchQualificationFields(tx, organizationId, target, {
            ...input,
            expectedVersion: target.version,
            primaryServiceId: undefined, // already set
          }, actor);
          await this.tenants.writeAudit(tx, {
            organizationId,
            actorUserId: actor.userId,
            action: 'lead.qualification_updated',
            targetType: 'Lead',
            targetId: patched.id,
            requestId: actor.requestId,
          });
          return this.toDto(tx, organizationId, patched);
        }
      }

      const patched = await this.patchQualificationFields(
        tx,
        organizationId,
        current,
        input,
        actor,
      );
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'lead.qualification_updated',
        targetType: 'Lead',
        targetId: patched.id,
        requestId: actor.requestId,
      });
      return this.toDto(tx, organizationId, patched);
    });
  }

  private async patchQualificationFields(
    tx: TenantTxClient,
    organizationId: string,
    current: LeadRecord,
    input: {
      expectedVersion: number;
      primaryServiceId?: string | null;
      locationId?: string | null;
      needSummary?: string | null;
      preferredContactChannel?: string | null;
      language?: string | null;
      urgency?: string | null;
    },
    actor: ActorContext,
  ): Promise<LeadRecord> {
    if (input.urgency != null && !['LOW', 'NORMAL', 'HIGH'].includes(input.urgency)) {
      throw new BadRequestException('Invalid urgency');
    }
    const result = await tx.lead.updateMany({
      where: {
        organizationId,
        id: current.id,
        version: input.expectedVersion,
        status: { in: ['NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE'] },
      },
      data: {
        ...(input.primaryServiceId !== undefined
          ? { primaryServiceId: input.primaryServiceId }
          : {}),
        ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
        ...(input.needSummary !== undefined ? { needSummary: input.needSummary?.slice(0, 2000) } : {}),
        ...(input.preferredContactChannel !== undefined
          ? { preferredContactChannel: input.preferredContactChannel?.slice(0, 64) }
          : {}),
        ...(input.language !== undefined ? { language: input.language?.slice(0, 16) } : {}),
        ...(input.urgency !== undefined ? { urgency: input.urgency } : {}),
        version: { increment: 1 },
      },
    });
    if (!result.count) throw new ConflictException('VERSION_CONFLICT');
    const row = (await tx.lead.findUniqueOrThrow({
      where: { organizationId_id: { organizationId, id: current.id } },
    })) as LeadRecord;
    await this.appendActivity(tx, {
      organizationId,
      leadId: row.id,
      type: 'QUALIFICATION_UPDATED',
      actorType: 'USER',
      actorId: actor.userId,
      metadataJson: {
        fields: Object.keys(input).filter((k) => k !== 'expectedVersion'),
      },
    });
    return row;
  }

  async transitionStatus(
    actor: ActorContext,
    organizationId: string,
    leadId: string,
    input: {
      expectedVersion: number;
      toStatus: string;
      reasonCode?: string;
      reasonText?: string;
    },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
      throw new BadRequestException('expectedVersion required');
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const current = (await tx.lead.findUnique({
        where: { organizationId_id: { organizationId, id: leadId } },
      })) as LeadRecord | null;
      if (!current) throw new NotFoundException();
      if (current.version !== input.expectedVersion) {
        throw new ConflictException('VERSION_CONFLICT');
      }
      const from = current.status as LeadStatus;
      const to = input.toStatus as LeadStatus;
      if (!isValidTransition(from, to, 'HUMAN')) {
        throw new BadRequestException('Invalid transition');
      }
      if (to === 'DISQUALIFIED') {
        if (!input.reasonCode || !isDisqualifiedReason(input.reasonCode)) {
          throw new BadRequestException('Invalid DISQUALIFIED reasonCode');
        }
      }
      if (to === 'ARCHIVED') {
        if (!input.reasonCode || !isArchivedReason(input.reasonCode)) {
          throw new BadRequestException('Invalid ARCHIVED reasonCode');
        }
      }
      const result = await tx.lead.updateMany({
        where: { organizationId, id: leadId, version: input.expectedVersion },
        data: {
          status: to,
          statusReasonCode: input.reasonCode ?? null,
          statusReasonText: input.reasonText?.slice(0, 500) ?? null,
          statusChangedAt: new Date(),
          statusChangedByType: 'USER',
          statusChangedById: actor.userId,
          archivedAt: to === 'ARCHIVED' ? new Date() : undefined,
          version: { increment: 1 },
        },
      });
      if (!result.count) throw new ConflictException('VERSION_CONFLICT');
      const row = (await tx.lead.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: leadId } },
      })) as LeadRecord;
      await this.appendActivity(tx, {
        organizationId,
        leadId,
        type: 'STATUS_CHANGED',
        actorType: 'USER',
        actorId: actor.userId,
        metadataJson: {
          from,
          to,
          reasonCode: input.reasonCode ?? null,
        },
      });
      const event = domainEvent({
        organizationId,
        eventType: 'LeadStageChanged',
        aggregateType: 'Lead',
        aggregateId: leadId,
        aggregateVersion: row.version,
        actor: { type: 'USER', id: actor.userId },
        correlationId: actor.requestId,
        payload: { leadId, from, to },
      });
      await this.tenants.writeOutbox(tx, {
        organizationId,
        eventType: event.eventType,
        payloadJson: event,
      });
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'lead.status_changed',
        targetType: 'Lead',
        targetId: leadId,
        requestId: actor.requestId,
        metadataJson: { from, to },
      });
      return this.toDto(tx, organizationId, row);
    });
  }

  async assign(
    actor: ActorContext,
    organizationId: string,
    leadId: string,
    input: { expectedVersion: number; assignedUserId: string },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
      throw new BadRequestException('expectedVersion required');
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const member = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: input.assignedUserId,
          },
        },
      });
      if (!member || member.status !== 'ACTIVE') {
        throw new BadRequestException('Assignee must be an active organization member');
      }
      const result = await tx.lead.updateMany({
        where: {
          organizationId,
          id: leadId,
          version: input.expectedVersion,
          status: { in: ['NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE'] },
        },
        data: {
          assignedUserId: input.assignedUserId,
          assignedAt: new Date(),
          assignedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (!result.count) throw new ConflictException('VERSION_CONFLICT');
      const row = (await tx.lead.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: leadId } },
      })) as LeadRecord;
      await this.appendActivity(tx, {
        organizationId,
        leadId,
        type: 'ASSIGNED',
        actorType: 'USER',
        actorId: actor.userId,
        metadataJson: { assignedUserId: input.assignedUserId },
      });
      return this.toDto(tx, organizationId, row);
    });
  }

  async unassign(
    actor: ActorContext,
    organizationId: string,
    leadId: string,
    input: { expectedVersion: number },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
      throw new BadRequestException('expectedVersion required');
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const result = await tx.lead.updateMany({
        where: {
          organizationId,
          id: leadId,
          version: input.expectedVersion,
        },
        data: {
          assignedUserId: null,
          assignedAt: null,
          assignedByUserId: null,
          version: { increment: 1 },
        },
      });
      if (!result.count) throw new ConflictException('VERSION_CONFLICT');
      const row = (await tx.lead.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: leadId } },
      })) as LeadRecord;
      await this.appendActivity(tx, {
        organizationId,
        leadId,
        type: 'UNASSIGNED',
        actorType: 'USER',
        actorId: actor.userId,
        metadataJson: {},
      });
      return this.toDto(tx, organizationId, row);
    });
  }

  async addNote(
    actor: ActorContext,
    organizationId: string,
    leadId: string,
    input: { text: string },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireWrite(m.role);
    const text = input.text?.trim();
    if (!text || text.length > 2000) throw new BadRequestException('Invalid note text');
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { organizationId_id: { organizationId, id: leadId } },
      });
      if (!lead) throw new NotFoundException();
      return this.appendActivity(tx, {
        organizationId,
        leadId,
        type: 'NOTE_ADDED',
        actorType: 'USER',
        actorId: actor.userId,
        metadataJson: { text, humanOwned: true },
      });
    });
  }
}
