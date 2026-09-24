import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import {
  TenantContextService,
  type ActorContext,
} from '../database/tenant-context.service.js';
import { META_WHATSAPP_PROVIDER, resolveMetaGraphApiVersion } from '@ai-sales-agent/agent-adapters';

@Controller('organizations/:organizationId/channels')
@UseGuards(AuthGuard)
export class ChannelsController {
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

  private requireWrite(role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') throw new ForbiddenException('ADMIN/OWNER required');
  }

  private sanitize(row: {
    id: string;
    provider: string;
    externalChannelId: string;
    status: string;
    healthStatus: string;
    displayPhoneNumber: string | null;
    wabaId: string | null;
    lastVerifiedAt: Date | null;
    credentialRef: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      provider: row.provider,
      phoneNumberId: row.externalChannelId,
      status: row.status,
      healthStatus: row.healthStatus,
      displayPhoneNumber: row.displayPhoneNumber,
      wabaId: row.wabaId,
      lastVerifiedAt: row.lastVerifiedAt,
      hasCredentialRef: Boolean(row.credentialRef),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // never expose secrets
    };
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string) {
    const m = await this.membership(req.auth!, org);
    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(m.role)) throw new ForbiddenException();
    const rows = (await this.tenants.runInTenantContext(org, req.auth!, (tx) =>
      tx.channelConnection.findMany({
        where: { organizationId: org },
        orderBy: { createdAt: 'desc' },
      }),
    )) as Array<{
      id: string;
      provider: string;
      externalChannelId: string;
      status: string;
      healthStatus: string;
      displayPhoneNumber: string | null;
      wabaId: string | null;
      lastVerifiedAt: Date | null;
      credentialRef: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    return rows.map((r) => this.sanitize(r));
  }

  @Get(':channelId')
  async get(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('channelId') channelId: string,
  ) {
    await this.membership(req.auth!, org);
    const row = await this.tenants.runInTenantContext(org, req.auth!, (tx) =>
      tx.channelConnection.findUnique({
        where: { organizationId_id: { organizationId: org, id: channelId } },
      }),
    );
    if (!row) throw new NotFoundException();
    return this.sanitize(row as never);
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body()
    body: {
      phoneNumberId: string;
      displayPhoneNumber?: string;
      wabaId?: string;
      credentialRef?: string;
    },
  ) {
    const m = await this.membership(req.auth!, org);
    this.requireWrite(m.role);
    const phoneNumberId = body.phoneNumberId?.trim();
    if (!phoneNumberId || phoneNumberId.length > 64) {
      throw new BadRequestException('phoneNumberId required');
    }
    return this.tenants.runInTenantContext(org, req.auth!, async (tx) => {
      const existing = await tx.channelConnection.findUnique({
        where: {
          provider_externalChannelId: {
            provider: META_WHATSAPP_PROVIDER,
            externalChannelId: phoneNumberId,
          },
        },
      });
      if (existing) {
        if (existing.organizationId !== org) {
          throw new ConflictException('phone_number_bound_other_tenant');
        }
        throw new ConflictException('channel_exists');
      }
      const row = await tx.channelConnection.create({
        data: {
          id: randomUUID(),
          organizationId: org,
          provider: META_WHATSAPP_PROVIDER,
          externalChannelId: phoneNumberId,
          status: 'ACTIVE',
          healthStatus: 'ACTIVE',
          displayPhoneNumber: body.displayPhoneNumber?.trim() || null,
          wabaId: body.wabaId?.trim() || null,
          credentialRef: body.credentialRef?.trim() || null,
        },
      });
      await this.tenants.writeAudit(tx, {
        organizationId: org,
        actorUserId: req.auth!.userId,
        action: 'channel.created',
        targetType: 'ChannelConnection',
        targetId: row.id,
        requestId: req.auth!.requestId,
      });
      return this.sanitize(row as never);
    });
  }

  @Patch(':channelId')
  async patch(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('channelId') channelId: string,
    @Body()
    body: {
      status?: 'ACTIVE' | 'DISABLED' | 'REVOKED';
      displayPhoneNumber?: string | null;
      wabaId?: string | null;
      credentialRef?: string | null;
      healthStatus?: 'ACTIVE' | 'MISCONFIGURED' | 'AUTH_FAILED' | 'DISABLED';
    },
  ) {
    const m = await this.membership(req.auth!, org);
    this.requireWrite(m.role);
    return this.tenants.runInTenantContext(org, req.auth!, async (tx) => {
      const existing = await tx.channelConnection.findUnique({
        where: { organizationId_id: { organizationId: org, id: channelId } },
      });
      if (!existing) throw new NotFoundException();
      const row = await tx.channelConnection.update({
        where: { organizationId_id: { organizationId: org, id: channelId } },
        data: {
          status: body.status ?? undefined,
          displayPhoneNumber:
            body.displayPhoneNumber === undefined ? undefined : body.displayPhoneNumber,
          wabaId: body.wabaId === undefined ? undefined : body.wabaId,
          credentialRef: body.credentialRef === undefined ? undefined : body.credentialRef,
          healthStatus: body.healthStatus ?? undefined,
        },
      });
      await this.tenants.writeAudit(tx, {
        organizationId: org,
        actorUserId: req.auth!.userId,
        action: 'channel.updated',
        targetType: 'ChannelConnection',
        targetId: channelId,
        requestId: req.auth!.requestId,
      });
      return this.sanitize(row as never);
    });
  }

  @Post(':channelId/verify')
  async verify(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('channelId') channelId: string,
  ) {
    const m = await this.membership(req.auth!, org);
    this.requireWrite(m.role);
    // Config completeness check only — no expensive Meta round-trip every verify
    return this.tenants.runInTenantContext(org, req.auth!, async (tx) => {
      const row = await tx.channelConnection.findUnique({
        where: { organizationId_id: { organizationId: org, id: channelId } },
      });
      if (!row) throw new NotFoundException();
      let graphOk = false;
      try {
        resolveMetaGraphApiVersion();
        graphOk = true;
      } catch {
        graphOk = false;
      }
      const hasToken =
        Boolean(row.credentialRef) || Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN?.trim());
      const health =
        row.provider === META_WHATSAPP_PROVIDER &&
        row.externalChannelId &&
        graphOk &&
        hasToken &&
        Boolean(process.env.META_WHATSAPP_APP_SECRET?.trim()) &&
        Boolean(process.env.META_WHATSAPP_VERIFY_TOKEN?.trim())
          ? 'ACTIVE'
          : 'MISCONFIGURED';
      const updated = await tx.channelConnection.update({
        where: { organizationId_id: { organizationId: org, id: channelId } },
        data: { healthStatus: health, lastVerifiedAt: new Date() },
      });
      await this.tenants.writeAudit(tx, {
        organizationId: org,
        actorUserId: req.auth!.userId,
        action: 'channel.verify',
        targetType: 'ChannelConnection',
        targetId: channelId,
        metadataJson: { health },
        requestId: req.auth!.requestId,
      });
      return this.sanitize(updated as never);
    });
  }
}
