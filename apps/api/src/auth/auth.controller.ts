import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthMeResponse, SwitchOrganizationRequest } from '@ai-sales-agent/contracts';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard.js';
import { AuthService } from './auth.service.js';

/**
 * Nest owns identity/authorization endpoints only.
 * Browser login/callback/logout session lifecycle lives on Next.js BFF (see auth-api.md reconciliation).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async me(
    @Req() req: AuthenticatedRequest,
    @Headers('x-organization-id') orgHeader?: string,
  ): Promise<AuthMeResponse> {
    const actor = req.auth!;
    let active: string | null = null;
    if (orgHeader) {
      await this.auth.assertActiveMembership(actor, orgHeader);
      active = orgHeader;
    }
    return this.auth.getMe(actor, active);
  }

  @Post('switch-organization')
  @UseGuards(AuthGuard)
  async switchOrganization(
    @Req() req: AuthenticatedRequest,
    @Body() body: SwitchOrganizationRequest,
  ) {
    const actor = req.auth!;
    const membership = await this.auth.assertActiveMembership(actor, body.organizationId);
    return {
      organizationId: membership.organizationId,
      role: membership.role,
      status: membership.status,
    };
  }
}
