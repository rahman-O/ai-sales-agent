import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  TenantContextService,
  type ActorContext,
} from '../database/tenant-context.service.js';

@Injectable()
export class TemplatesService {
  constructor(private readonly tenants: TenantContextService) {}

  private async requireAdmin(actor: ActorContext, organizationId: string) {
    const m = await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    );
    if (!m || (m as { status: string }).status !== 'ACTIVE') throw new NotFoundException();
    const role = (m as { role: string }).role;
    if (role !== 'OWNER' && role !== 'ADMIN') throw new ForbiddenException();
    return role;
  }

  private async requireMember(actor: ActorContext, organizationId: string) {
    const m = await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    );
    if (!m || (m as { status: string }).status !== 'ACTIVE') throw new NotFoundException();
    return m as { role: string };
  }

  async list(actor: ActorContext, organizationId: string) {
    await this.requireMember(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      return tx.messageTemplate.findMany({
        where: { organizationId, archivedAt: null },
        include: { activeVersion: true },
        orderBy: { updatedAt: 'desc' },
      });
    });
  }

  async create(
    actor: ActorContext,
    organizationId: string,
    body: {
      internalName: string;
      providerTemplateName: string;
      providerLanguageCode?: string;
      category?: string;
      parameterSchema?: Record<string, unknown>;
      bodyPreview?: string;
      providerStatus?: string;
    },
  ) {
    await this.requireAdmin(actor, organizationId);
    if (!body.internalName?.trim() || !body.providerTemplateName?.trim()) {
      throw new BadRequestException('internalName_and_providerTemplateName_required');
    }
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const templateId = randomUUID();
      const versionId = randomUUID();
      await tx.messageTemplate.create({
        data: {
          id: templateId,
          organizationId,
          internalName: body.internalName.trim(),
          internalStatus: 'DRAFT',
        },
      });
      await tx.messageTemplateVersion.create({
        data: {
          id: versionId,
          organizationId,
          templateId,
          version: 1,
          providerTemplateName: body.providerTemplateName.trim(),
          providerLanguageCode: body.providerLanguageCode?.trim() || 'ar',
          category: body.category ?? null,
          parameterSchema: body.parameterSchema ?? {},
          bodyPreview: body.bodyPreview ?? null,
          providerStatus: body.providerStatus ?? 'UNKNOWN',
        },
      });
      await tx.messageTemplate.update({
        where: { organizationId_id: { organizationId, id: templateId } },
        data: { activeVersionId: versionId },
      });
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'message_template.created',
        targetType: 'MessageTemplate',
        targetId: templateId,
        requestId: actor.requestId,
      });
      return tx.messageTemplate.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: templateId } },
        include: { activeVersion: true },
      });
    });
  }

  async setInternalStatus(
    actor: ActorContext,
    organizationId: string,
    templateId: string,
    internalStatus: 'DRAFT' | 'APPROVED' | 'DISABLED',
  ) {
    await this.requireAdmin(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const row = await tx.messageTemplate.updateMany({
        where: { organizationId, id: templateId },
        data: { internalStatus },
      });
      if (!row.count) throw new NotFoundException();
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'message_template.status_changed',
        targetType: 'MessageTemplate',
        targetId: templateId,
        metadataJson: { internalStatus },
        requestId: actor.requestId,
      });
      return tx.messageTemplate.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: templateId } },
        include: { activeVersion: true },
      });
    });
  }

  async addVersion(
    actor: ActorContext,
    organizationId: string,
    templateId: string,
    body: {
      providerTemplateName: string;
      providerLanguageCode?: string;
      parameterSchema?: Record<string, unknown>;
      bodyPreview?: string;
      providerStatus?: string;
      activate?: boolean;
    },
  ) {
    await this.requireAdmin(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const template = await tx.messageTemplate.findUnique({
        where: { organizationId_id: { organizationId, id: templateId } },
      });
      if (!template) throw new NotFoundException();
      const max = await tx.messageTemplateVersion.aggregate({
        where: { organizationId, templateId },
        _max: { version: true },
      });
      const nextVersion = (max._max.version ?? 0) + 1;
      const versionId = randomUUID();
      await tx.messageTemplateVersion.create({
        data: {
          id: versionId,
          organizationId,
          templateId,
          version: nextVersion,
          providerTemplateName: body.providerTemplateName.trim(),
          providerLanguageCode: body.providerLanguageCode?.trim() || 'ar',
          parameterSchema: body.parameterSchema ?? {},
          bodyPreview: body.bodyPreview ?? null,
          providerStatus: body.providerStatus ?? 'UNKNOWN',
        },
      });
      if (body.activate !== false) {
        await tx.messageTemplate.update({
          where: { organizationId_id: { organizationId, id: templateId } },
          data: { activeVersionId: versionId },
        });
      }
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'message_template.version_added',
        targetType: 'MessageTemplateVersion',
        targetId: versionId,
        requestId: actor.requestId,
      });
      return tx.messageTemplateVersion.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: versionId } },
      });
    });
  }
}
