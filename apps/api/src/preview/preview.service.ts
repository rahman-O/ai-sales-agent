import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  type ConversationWorkingStateData,
} from '@ai-sales-agent/agent-core';
import { runPreviewAgentTurn } from '@ai-sales-agent/agent-adapters';
import type {
  CreatePreviewSessionRequest,
  SendPreviewMessageRequest,
  ResetPreviewSessionRequest,
  PreviewSessionDto,
  PreviewMessageDto,
  SimulatedCustomerContextDto,
} from '@ai-sales-agent/contracts';
import { createAppPool } from '../database/pg-pool.js';
import { TenantContextService, type ActorContext } from '../database/tenant-context.service.js';

interface SessionRecord {
  id: string;
  organizationId: string;
  createdBy: string;
  scenario: string | null;
  simulatedCustomer: SimulatedCustomerContextDto | null;
  workingState: ConversationWorkingStateData;
  messages: PreviewMessageDto[];
  createdAt: string;
  updatedAt: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

@Injectable()
export class PreviewService {
  private readonly sessions = new Map<string, SessionRecord>();
  private poolInstance: Pool | null = null;

  constructor(
    private readonly tenants: TenantContextService,
  ) {}

  public setPoolOverride(pool: Pool) {
    this.poolInstance = pool;
  }

  private get pool(): Pool {
    if (!this.poolInstance) {
      const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
      this.poolInstance = createAppPool(url);
    }
    return this.poolInstance;
  }

  private cleanExpiredSessions() {
    const now = Date.now();
    for (const [id, s] of this.sessions.entries()) {
      if (s.expiresAt < now) {
        this.sessions.delete(id);
      }
    }
  }

  private async assertMembership(actor: ActorContext, organizationId: string) {
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const m = await tx.organizationMember.findFirst({
        where: { organizationId, userId: actor.userId, status: 'ACTIVE' },
      });
      if (!m) throw new ForbiddenException('Not a member of this organization');
      return m;
    });
  }

  private async getConfigSnapshot(organizationId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [organizationId]);
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, ['00000000-0000-4000-8000-0000000000a1']);

      const org = await client.query<{ name: string }>(`SELECT name FROM organizations WHERE id = $1`, [organizationId]);
      const caps = await client.query<{
        supports_booking: boolean;
        supports_leads: boolean;
        supports_offers: boolean;
        supports_orders: boolean;
        supports_quotes: boolean;
        supports_services: boolean;
        supports_products: boolean;
      }>(`SELECT supports_booking, supports_leads, supports_offers, supports_orders, supports_quotes, supports_services, supports_products FROM organization_capabilities WHERE organization_id = $1`, [organizationId]);
      const conv = await client.query<{
        tone: string;
        formality: string;
        dialect: string;
        sales_style: string;
        assistant_name: string | null;
      }>(`SELECT tone, formality, dialect, sales_style, assistant_name FROM organization_conversation_profiles WHERE organization_id = $1`, [organizationId]);

      const polCount = await client.query<{ count: string }>(`SELECT count(*) FROM business_policies WHERE organization_id = $1 AND status = 'ACTIVE'`, [organizationId]);
      const offCount = await client.query<{ count: string }>(`SELECT count(*) FROM offers WHERE organization_id = $1 AND status = 'ACTIVE'`, [organizationId]);
      const knwCount = await client.query<{ count: string }>(`SELECT count(*) FROM knowledge_documents WHERE organization_id = $1 AND active_published_version_id IS NOT NULL AND archived_at IS NULL AND deleted_at IS NULL`, [organizationId]);

      await client.query('COMMIT');

      const c = caps.rows[0];
      const cv = conv.rows[0];
      return {
        organizationName: org.rows[0]?.name ?? 'Preview Organization',
        capabilities: c
          ? {
              supportsBooking: c.supports_booking,
              supportsLeads: c.supports_leads,
              supportsOffers: c.supports_offers,
              supportsOrders: c.supports_orders,
              supportsQuotes: c.supports_quotes,
              supportsServices: c.supports_services,
              supportsProducts: c.supports_products,
            }
          : undefined,
        conversationProfile: cv
          ? {
              assistantName: cv.assistant_name,
              tone: cv.tone,
              formality: cv.formality,
              dialect: cv.dialect,
              salesStyle: cv.sales_style,
            }
          : undefined,
        activePoliciesCount: parseInt(polCount.rows[0]?.count ?? '0', 10),
        activeOffersCount: parseInt(offCount.rows[0]?.count ?? '0', 10),
        publishedKnowledgeCount: parseInt(knwCount.rows[0]?.count ?? '0', 10),
      };
    } catch {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      return undefined;
    } finally {
      client.release();
    }
  }

  async createSession(
    actor: ActorContext,
    organizationId: string,
    input: CreatePreviewSessionRequest,
  ): Promise<PreviewSessionDto> {
    await this.assertMembership(actor, organizationId);
    this.cleanExpiredSessions();

    const sessionId = randomUUID();
    const nowIso = new Date().toISOString();

    const session: SessionRecord = {
      id: sessionId,
      organizationId,
      createdBy: actor.userId,
      scenario: input.scenario ?? null,
      simulatedCustomer: input.simulatedCustomer ?? null,
      workingState: {},
      messages: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };

    this.sessions.set(`${organizationId}:${sessionId}`, session);
    const configSnapshot = await this.getConfigSnapshot(organizationId);

    return {
      id: session.id,
      organizationId: session.organizationId,
      createdBy: session.createdBy,
      scenario: session.scenario,
      simulatedCustomer: session.simulatedCustomer,
      workingState: session.workingState as Record<string, unknown>,
      messages: session.messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      configSnapshot,
    };
  }

  async getSession(
    actor: ActorContext,
    organizationId: string,
    sessionId: string,
  ): Promise<PreviewSessionDto> {
    await this.assertMembership(actor, organizationId);
    this.cleanExpiredSessions();

    const key = `${organizationId}:${sessionId}`;
    const session = this.sessions.get(key);

    if (!session) {
      throw new NotFoundException('Preview session not found');
    }

    const configSnapshot = await this.getConfigSnapshot(organizationId);

    return {
      id: session.id,
      organizationId: session.organizationId,
      createdBy: session.createdBy,
      scenario: session.scenario,
      simulatedCustomer: session.simulatedCustomer,
      workingState: session.workingState as Record<string, unknown>,
      messages: session.messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      configSnapshot,
    };
  }

  async sendMessage(
    actor: ActorContext,
    organizationId: string,
    sessionId: string,
    input: SendPreviewMessageRequest,
  ): Promise<PreviewSessionDto> {
    await this.assertMembership(actor, organizationId);
    this.cleanExpiredSessions();

    const key = `${organizationId}:${sessionId}`;
    const session = this.sessions.get(key);
    if (!session) {
      throw new NotFoundException('Preview session not found');
    }

    const userMessageText = input.content.trim();
    if (!userMessageText) {
      throw new BadRequestException('Empty message');
    }

    const userMsg: PreviewMessageDto = {
      id: randomUUID(),
      role: 'user',
      content: userMessageText,
      createdAt: new Date().toISOString(),
    };

    // Run preview agent turn
    const result = await runPreviewAgentTurn(this.pool, {
      organizationId,
      sessionId,
      userMessage: userMessageText,
      history: session.messages,
      workingState: session.workingState,
      simulatedCustomer: session.simulatedCustomer,
    });

    const assistantMsg: PreviewMessageDto = {
      id: randomUUID(),
      role: 'assistant',
      content: result.assistantMessage,
      createdAt: new Date().toISOString(),
      trace: result.trace,
    };

    session.messages.push(userMsg, assistantMsg);
    session.workingState = result.updatedWorkingState;
    session.updatedAt = new Date().toISOString();
    session.expiresAt = Date.now() + SESSION_TTL_MS;

    return {
      id: session.id,
      organizationId: session.organizationId,
      createdBy: session.createdBy,
      scenario: session.scenario,
      simulatedCustomer: session.simulatedCustomer,
      workingState: session.workingState as Record<string, unknown>,
      messages: session.messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      configSnapshot: result.configSnapshot,
    };
  }

  async resetSession(
    actor: ActorContext,
    organizationId: string,
    sessionId: string,
    input?: ResetPreviewSessionRequest,
  ): Promise<PreviewSessionDto> {
    await this.assertMembership(actor, organizationId);

    const key = `${organizationId}:${sessionId}`;
    const nowIso = new Date().toISOString();

    const session: SessionRecord = {
      id: sessionId,
      organizationId,
      createdBy: actor.userId,
      scenario: input?.scenario ?? null,
      simulatedCustomer: input?.simulatedCustomer ?? null,
      workingState: {},
      messages: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };

    this.sessions.set(key, session);
    const configSnapshot = await this.getConfigSnapshot(organizationId);

    return {
      id: session.id,
      organizationId: session.organizationId,
      createdBy: session.createdBy,
      scenario: session.scenario,
      simulatedCustomer: session.simulatedCustomer,
      workingState: session.workingState as Record<string, unknown>,
      messages: session.messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      configSnapshot,
    };
  }
}
