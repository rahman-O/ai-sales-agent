import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService, type DbClient } from './prisma.service.js';

export interface ActorContext {
  userId: string;
  authSubject: string;
  requestId?: string;
}

export type TenantTxClient = DbClient;

/**
 * Structural tenant boundary. Tenant-owned services must use the callback client,
 * not an unrestricted PrismaClient.
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  /** Global identity path — no tenant RLS setting. Sets actor for membership listing. */
  async runAsActor<T>(actor: ActorContext, fn: (tx: TenantTxClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${actor.userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', '', true)`;
      return fn(tx);
    });
  }

  async runInTenantContext<T>(
    organizationId: string,
    actor: ActorContext,
    fn: (tx: TenantTxClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${actor.userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
      return fn(tx);
    });
  }

  async writeAudit(
    tx: TenantTxClient,
    input: {
      organizationId: string;
      actorUserId: string;
      action: string;
      targetType?: string;
      targetId?: string;
      metadataJson?: unknown;
      requestId?: string;
    },
  ) {
    return tx.auditLog.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadataJson: input.metadataJson as object | undefined,
        requestId: input.requestId,
      },
    });
  }

  async writeOutbox(
    tx: TenantTxClient,
    input: { organizationId: string; eventType: string; payloadJson: unknown; eventId?: string },
  ) {
    const envelope = input.payloadJson as { eventId?: string } | null;
    const id = input.eventId ?? envelope?.eventId ?? randomUUID();
    return tx.outboxEvent.create({
      data: {
        id,
        organizationId: input.organizationId,
        eventType: input.eventType,
        payloadJson: input.payloadJson as object,
        publicationStatus: 'PENDING',
        publicationAttempts: 0,
        availableAt: new Date(),
      },
    });
  }
}

export function hashRequest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
