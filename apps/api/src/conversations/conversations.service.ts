import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  TenantContextService,
  type ActorContext,
} from '../database/tenant-context.service.js';
import { ConversationEventsHub } from './conversation-events.hub.js';

function decodeCursor(raw?: string): { t: string; id: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      t?: string;
      id?: string;
    };
    if (!parsed.t || !parsed.id) return null;
    return { t: parsed.t, id: parsed.id };
  } catch {
    return null;
  }
}

function encodeCursor(t: string | Date, id: string): string {
  const value = t instanceof Date ? t.toISOString() : t;
  return Buffer.from(JSON.stringify({ t: value, id }), 'utf8').toString('base64url');
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly tenants: TenantContextService,
    private readonly events: ConversationEventsHub,
  ) {}

  private async authorize(actor: ActorContext, organizationId: string) {
    const m = await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    );
    if (!m || (m as { status: string }).status !== 'ACTIVE') throw new NotFoundException();
    return m as { role: string; status: string };
  }

  async getOne(actor: ActorContext, organizationId: string, conversationId: string) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const conv = await tx.conversation.findUnique({
        where: { organizationId_id: { organizationId, id: conversationId } },
      });
      if (!conv) throw new NotFoundException();
      return conv;
    });
  }

  async listInbox(
    actor: ActorContext,
    organizationId: string,
    opts: {
      cursor?: string;
      limit?: number;
      mode?: string;
      unassignedOnly?: boolean;
      assignedToMe?: boolean;
    } = {},
  ) {
    await this.authorize(actor, organizationId);
    const take = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const c = decodeCursor(opts.cursor);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = await tx.conversation.findMany({
        where: {
          organizationId,
          ...(opts.mode ? { mode: opts.mode } : {}),
          ...(opts.unassignedOnly ? { mode: 'AI_PAUSED', ownerMemberId: null } : {}),
          ...(opts.assignedToMe ? { ownerMemberId: actor.userId } : {}),
          ...(c
            ? {
                OR: [
                  { lastMessageAt: { lt: new Date(c.t) } },
                  { lastMessageAt: new Date(c.t), id: { lt: c.id } },
                  { lastMessageAt: null },
                ],
              }
            : {}),
        },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
      });
      const page = rows.slice(0, take);
      const next =
        rows.length > take && page.length
          ? encodeCursor(page[page.length - 1]!.lastMessageAt ?? page[page.length - 1]!.createdAt, page[page.length - 1]!.id)
          : null;
      return { items: page, nextCursor: next };
    });
  }

  async listMessages(
    actor: ActorContext,
    organizationId: string,
    conversationId: string,
    cursor?: string,
    limit = 50,
  ) {
    await this.authorize(actor, organizationId);
    const take = Math.min(Math.max(limit, 1), 100);
    const c = decodeCursor(cursor);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const conv = await tx.conversation.findUnique({
        where: { organizationId_id: { organizationId, id: conversationId } },
      });
      if (!conv) throw new NotFoundException();
      const rows = await tx.message.findMany({
        where: {
          organizationId,
          conversationId,
          ...(c
            ? {
                OR: [
                  { timelineSequence: { gt: Number(c.t) } },
                  { timelineSequence: Number(c.t), id: { gt: c.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ timelineSequence: 'asc' }, { id: 'asc' }],
        take: take + 1,
      });
      const page = rows.slice(0, take);
      const next =
        rows.length > take && page.length
          ? encodeCursor(String(page[page.length - 1]!.timelineSequence), page[page.length - 1]!.id)
          : null;
      return { items: page, nextCursor: next };
    });
  }

  /** Authenticated SSE invalidation stream — organization scoped. */
  async subscribeEvents(actor: ActorContext, organizationId: string) {
    await this.authorize(actor, organizationId);
    return this.events.subscribe(organizationId, actor.userId);
  }

  /**
   * Legacy P03 primitive — HARDENED in P09.
   * Public callers must use takeover/claim/reassign/release/resume-ai.
   * Always rejects arbitrary mode mutation (including HUMAN_ACTIVE).
   */
  async transitionMode(
    _actor: ActorContext,
    _organizationId: string,
    _conversationId: string,
    _mode: string,
    _expectedVersion: number,
  ): Promise<never> {
    throw new GoneException({
      code: 'MODE_ENDPOINT_REMOVED',
      message:
        'Arbitrary mode mutation removed. Use takeover, claim, reassign, release, or resume-ai.',
    });
  }

  /**
   * Lease acquisition with fence increment. Uses DB now() via raw SQL.
   */
  async acquireLease(
    actor: ActorContext,
    organizationId: string,
    conversationId: string,
    ownerId: string,
    ttlSeconds = 60,
  ) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; lease_fence: number; ownership_epoch: number }>
      >`
        UPDATE conversations
        SET lease_owner = ${ownerId},
            lease_fence = lease_fence + 1,
            lease_expires_at = now() + (${ttlSeconds}::text || ' seconds')::interval,
            updated_at = now(),
            version = version + 1
        WHERE organization_id = ${organizationId}::uuid
          AND id = ${conversationId}::uuid
          AND (lease_expires_at IS NULL OR lease_expires_at <= now() OR lease_owner = ${ownerId})
        RETURNING id, lease_fence, ownership_epoch`;
      if (!rows[0]) throw new ForbiddenException('Lease unavailable');
      return {
        conversationId: rows[0].id,
        leaseFence: rows[0].lease_fence,
        ownershipEpoch: rows[0].ownership_epoch,
        leaseOwner: ownerId,
      };
    });
  }

  async renewLease(
    actor: ActorContext,
    organizationId: string,
    conversationId: string,
    ownerId: string,
    expectedFence: number,
    ttlSeconds = 60,
  ) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; lease_fence: number }>>`
        UPDATE conversations
        SET lease_expires_at = now() + (${ttlSeconds}::text || ' seconds')::interval,
            updated_at = now()
        WHERE organization_id = ${organizationId}::uuid
          AND id = ${conversationId}::uuid
          AND lease_owner = ${ownerId}
          AND lease_fence = ${expectedFence}
          AND lease_expires_at > now()
        RETURNING id, lease_fence`;
      if (!rows[0]) throw new ForbiddenException('Lease renew rejected');
      return { conversationId: rows[0].id, leaseFence: rows[0].lease_fence };
    });
  }

  /** Advance processed_sequence under fence+epoch check (P03 drain foundation). */
  async markProcessedUnderFence(
    actor: ActorContext,
    organizationId: string,
    conversationId: string,
    ownerId: string,
    expectedFence: number,
    expectedEpoch: number,
    throughIngressSequence: number,
  ) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; processed_sequence: number }>>`
        UPDATE conversations
        SET processed_sequence = GREATEST(processed_sequence, ${throughIngressSequence}),
            updated_at = now(),
            version = version + 1
        WHERE organization_id = ${organizationId}::uuid
          AND id = ${conversationId}::uuid
          AND lease_owner = ${ownerId}
          AND lease_fence = ${expectedFence}
          AND ownership_epoch = ${expectedEpoch}
          AND lease_expires_at > now()
          AND ${throughIngressSequence} < next_sequence
          AND ${throughIngressSequence} >= processed_sequence
        RETURNING id, processed_sequence`;
      if (!rows[0]) throw new ForbiddenException('Fenced write rejected');
      return rows[0];
    });
  }

  assertNotProductionDevRoute() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
  }

  requireRedisForSseFanout() {
    if (!process.env.REDIS_URL) {
      throw new ServiceUnavailableException('REDIS_URL required for multi-instance SSE');
    }
  }
}
