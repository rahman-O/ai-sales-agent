import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { P04_TOOL_NAMES, ALL_REGISTERED_TOOL_NAMES } from '@ai-sales-agent/contracts';
import {
  FakeModelProvider,
  runAgentOrchestrator,
  type ConversationSnapshot,
} from '@ai-sales-agent/agent-core';
import { createPgRunStore, createToolExecutor } from '@ai-sales-agent/agent-adapters';
import { PrismaService } from '../database/prisma.service.js';
import {
  TenantContextService,
  type ActorContext,
} from '../database/tenant-context.service.js';

/** Default allowlist stays P04-only — P05/P06/P07 tools require explicit new AgentConfig versions. */
const DEFAULT_ALLOWLIST = [...P04_TOOL_NAMES];
const ALLOWED_TOOL_SET = new Set<string>(ALL_REGISTERED_TOOL_NAMES);

@Injectable()
export class AgentService {
  constructor(
    private readonly tenants: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  private async membership(actor: ActorContext, organizationId: string) {
    const m = (await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    )) as { status: string; role: string } | null;
    if (!m || m.status !== 'ACTIVE') throw new NotFoundException();
    return m;
  }

  private requireOperatorPlus(role: string) {
    if (!['OWNER', 'ADMIN', 'OPERATOR'].includes(role)) {
      throw new ForbiddenException('OPERATOR+ required');
    }
  }

  private requireAdmin(role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('ADMIN/OWNER required');
    }
  }

  async listConfigs(actor: ActorContext, organizationId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireOperatorPlus(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.agentConfig.findMany({
        where: { organizationId },
        orderBy: { version: 'desc' },
      }),
    );
  }

  async createDraft(
    actor: ActorContext,
    organizationId: string,
    input: {
      promptVersion: string;
      modelProfile: string;
      toolAllowlist?: string[];
      budgetsJson?: Record<string, number>;
      localeDefault?: string;
    },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);
    const allow = (input.toolAllowlist ?? DEFAULT_ALLOWLIST).filter((n) =>
      ALLOWED_TOOL_SET.has(n),
    );
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const max = await tx.agentConfig.aggregate({
        where: { organizationId },
        _max: { version: true },
      });
      const version = (max._max.version ?? 0) + 1;
      const row = await tx.agentConfig.create({
        data: {
          id: randomUUID(),
          organizationId,
          version,
          status: 'DRAFT',
          promptVersion: input.promptVersion.slice(0, 64),
          modelProfile: input.modelProfile.slice(0, 64),
          toolAllowlist: allow,
          budgetsJson: input.budgetsJson ?? { maxModelCalls: 5, maxToolCalls: 8 },
          localeDefault: input.localeDefault,
        },
      });
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'agent.config_draft',
        targetType: 'AgentConfig',
        targetId: row.id,
        metadataJson: { version },
        requestId: actor.requestId,
      });
      return row;
    });
  }

  async activate(actor: ActorContext, organizationId: string, configId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const target = await tx.agentConfig.findUnique({
        where: { organizationId_id: { organizationId, id: configId } },
      });
      if (!target) throw new NotFoundException();
      if (target.status === 'RETIRED') throw new BadRequestException('Cannot activate RETIRED');
      await tx.agentConfig.updateMany({
        where: { organizationId, status: 'ACTIVE' },
        data: { status: 'RETIRED' },
      });
      const row = await tx.agentConfig.update({
        where: { organizationId_id: { organizationId, id: configId } },
        data: { status: 'ACTIVE', activatedAt: new Date() },
      });
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'agent.config_activate',
        targetType: 'AgentConfig',
        targetId: configId,
        requestId: actor.requestId,
      });
      return row;
    });
  }

  async disable(actor: ActorContext, organizationId: string, configId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireAdmin(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const result = await tx.agentConfig.updateMany({
        where: { organizationId, id: configId, status: 'ACTIVE' },
        data: { status: 'RETIRED' },
      });
      if (!result.count) throw new NotFoundException();
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'agent.config_disable',
        targetType: 'AgentConfig',
        targetId: configId,
        requestId: actor.requestId,
      });
      return { disabled: true };
    });
  }

  async listRuns(actor: ActorContext, organizationId: string, conversationId?: string) {
    const m = await this.membership(actor, organizationId);
    this.requireOperatorPlus(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, (tx) =>
      tx.agentRun.findMany({
        where: {
          organizationId,
          ...(conversationId ? { conversationId } : {}),
        },
        orderBy: { startedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          conversationId: true,
          runKey: true,
          status: true,
          terminalReason: true,
          targetIngressSequence: true,
          modelCalls: true,
          toolCalls: true,
          startedAt: true,
          finishedAt: true,
          promptVersion: true,
          modelProfile: true,
        },
      }),
    );
  }

  async getRunTrace(actor: ActorContext, organizationId: string, runId: string) {
    const m = await this.membership(actor, organizationId);
    this.requireOperatorPlus(m.role);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const run = await tx.agentRun.findUnique({
        where: { organizationId_id: { organizationId, id: runId } },
      });
      if (!run) throw new NotFoundException();
      const tools = await tx.toolCall.findMany({
        where: { organizationId, agentRunId: runId },
        orderBy: { ordinal: 'asc' },
        select: {
          ordinal: true,
          toolName: true,
          toolVersion: true,
          argsHash: true,
          authzResult: true,
          resultCode: true,
          durationMs: true,
          createdAt: true,
        },
      });
      const usage = await tx.usageEvent.findMany({
        where: { organizationId, agentRunId: runId },
        select: {
          provider: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          estimated: true,
          latencyMs: true,
          createdAt: true,
        },
      });
      // Redacted: no raw model prompts, secrets, or hidden reasoning.
      return {
        run: {
          id: run.id,
          conversationId: run.conversationId,
          runKey: run.runKey,
          status: run.status,
          terminalReason: run.terminalReason,
          targetIngressSequence: run.targetIngressSequence,
          ownershipEpoch: run.ownershipEpoch,
          promptVersion: run.promptVersion,
          modelProfile: run.modelProfile,
          modelCalls: run.modelCalls,
          toolCalls: run.toolCalls,
          finalOutboundMessageId: run.finalOutboundMessageId,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
        },
        toolCalls: tools,
        usage,
      };
    });
  }

  /**
   * Sandbox test-run: Fake provider + dry-run tools (no mutate/handoff/outbound).
   * Never writes business mutations.
   */
  async testRun(
    actor: ActorContext,
    organizationId: string,
    input: { fixtureId?: string; userText?: string },
  ) {
    const m = await this.membership(actor, organizationId);
    this.requireOperatorPlus(m.role);
    if (process.env.NODE_ENV === 'production' && process.env.AI_ALLOW_FAKE !== 'true') {
      throw new ForbiddenException('Sandbox Fake provider disabled in production');
    }

    const fixtures = loadEvalFixtures();
    const fixture =
      fixtures.find((f) => f.id === (input.fixtureId ?? 'inquiry_price')) ?? fixtures[0]!;
    const userText = input.userText?.trim() || fixture.userText;

    const cfg = await this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      let active = await tx.agentConfig.findFirst({
        where: { organizationId, status: 'ACTIVE' },
      });
      if (!active) {
        active = await tx.agentConfig.create({
          data: {
            id: randomUUID(),
            organizationId,
            version: 1,
            status: 'ACTIVE',
            promptVersion: 'sandbox-v1',
            modelProfile: 'fake',
            toolAllowlist: DEFAULT_ALLOWLIST,
            budgetsJson: { maxModelCalls: 5, maxToolCalls: 8 },
            activatedAt: new Date(),
          },
        });
      }
      return active;
    });

    const pool = this.prisma.getPgPool();
    const store = createPgRunStore(pool);
    const tools = createToolExecutor(pool, store, true);

    // Sandbox uses ephemeral conversation ids that will fail DB finalize —
    // wrap with in-memory finalize override for dry-run observation only.
    const sandboxStore = {
      ...store,
      async finalizeSuccess() {
        return { outboundMessageId: 'sandbox-no-outbound' };
      },
      async finalizeHandoff() {
        return { newEpoch: 0 };
      },
      async finalizeTerminal() {},
      async createOrResumeRun(_inp: Parameters<typeof store.createOrResumeRun>[0]) {
        return {
          agentRunId: randomUUID(),
          status: 'RUNNING',
          resumed: false,
        };
      },
      async loadAuthority() {
        return {
          mode: 'AI_ACTIVE',
          ownershipEpoch: 0,
          leaseOwner: 'sandbox',
          leaseFence: 1,
          nextIngressSequence: 2,
          processedSequence: 0,
        };
      },
      async hasNewerInbound() {
        return false;
      },
      async recordToolCall() {},
      async claimCommand(_inp: { organizationId: string; operationKey: string; agentRunId: string }) {
        return { alreadySucceeded: false, resultJson: null, operationId: randomUUID() };
      },
      async completeCommand() {},
      async recordUsage() {},
    };

    const snap: ConversationSnapshot = {
      organizationId,
      conversationId: randomUUID(),
      customerId: randomUUID(),
      mode: 'AI_ACTIVE',
      ownershipEpoch: 0,
      leaseOwner: 'sandbox',
      leaseFence: 1,
      nextIngressSequence: 2,
      processedSequence: 0,
      targetIngressSequence: 1,
      messages: [
        {
          id: randomUUID(),
          direction: 'INBOUND',
          ingressSequence: 1,
          timelineSequence: 1,
          contentText: userText,
        },
      ],
      summaryText: null,
      summaryWatermark: null,
      agentConfigVersionId: cfg.id,
      promptVersion: cfg.promptVersion,
      modelProfile: 'fake',
      toolAllowlist: Array.isArray(cfg.toolAllowlist)
        ? (cfg.toolAllowlist as string[])
        : DEFAULT_ALLOWLIST,
    };

    const provider = new FakeModelProvider(
      fixture.scenario === 'tool_price'
        ? {
            kind: 'tool_then_final',
            toolName: 'getServicePrice',
            args: { serviceId: 'sandbox-service' },
            text: fixture.expectedFinal ?? 'Price requires catalog evidence.',
          }
        : { kind: 'final', text: fixture.expectedFinal ?? 'كيف يمكنني مساعدتك؟' },
    );

    const result = await runAgentOrchestrator(snap, {
      provider,
      tools,
      store: sandboxStore,
      allowFakeProvider: true,
    });

    return {
      sandbox: true,
      fixtureId: fixture.id,
      terminal: result.terminal,
      reason: result.reason,
      decisionTrace: result.decisionTrace,
      note: 'No outbound, mutate, or handoff persisted',
    };
  }
}

export interface EvalFixture {
  id: string;
  userText: string;
  scenario: 'final' | 'tool_price';
  expectedFinal?: string;
}

export function loadEvalFixtures(): EvalFixture[] {
  return [
    {
      id: 'inquiry_price',
      userText: 'كم سعر تنظيف الأسنان؟',
      scenario: 'tool_price',
      expectedFinal: 'يمكنني التحقق من السعر من الكتالوج.',
    },
    {
      id: 'greeting',
      userText: 'مرحبا',
      scenario: 'final',
      expectedFinal: 'مرحباً بك في العيادة. كيف يمكنني مساعدتك؟',
    },
    {
      id: 'handoff_request',
      userText: 'أريد التحدث مع موظف',
      scenario: 'final',
      expectedFinal: 'يمكنني تحويلك إلى فريق الاستقبال عند الحاجة.',
    },
  ];
}
