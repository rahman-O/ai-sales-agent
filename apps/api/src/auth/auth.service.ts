import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtVerifierService } from './jwt-verifier.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { TenantContextService, type ActorContext } from '../database/tenant-context.service.js';
import type { AuthMeResponse } from '@ai-sales-agent/contracts';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtVerifierService,
    private readonly prisma: PrismaService,
    private readonly tenants: TenantContextService,
  ) {}

  async resolveUserFromAccessToken(token: string): Promise<ActorContext & { userId: string }> {
    const claims = await this.jwt.verifyAccessToken(token);
    // JIT User create only after successful verification.
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', '', true)`;
      const existing = await tx.user.findUnique({ where: { authSubject: claims.sub } });
      if (existing) return existing;
      return tx.user.create({
        data: { id: randomUUID(), authSubject: claims.sub },
      });
    });
    return { userId: user.id, authSubject: user.authSubject };
  }

  async getMe(actor: ActorContext, activeOrganizationId: string | null): Promise<AuthMeResponse> {
    const memberships = await this.tenants.runAsActor(actor, async (tx) => {
      return tx.organizationMember.findMany({
        where: { userId: actor.userId },
        include: { organization: true },
      });
    });
    return {
      userId: actor.userId,
      authSubject: actor.authSubject,
      activeOrganizationId,
      memberships: memberships.map((m: { organizationId: string; organization: { name: string }; role: string; status: string }) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role as AuthMeResponse['memberships'][number]['role'],
        status: m.status as AuthMeResponse['memberships'][number]['status'],
      })),
    };
  }

  async assertActiveMembership(actor: ActorContext, organizationId: string) {
    const membership = await this.tenants.runAsActor(actor, async (tx) => {
      return tx.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: actor.userId },
        },
      });
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('Not a member of organization');
    }
    return membership;
  }
}
