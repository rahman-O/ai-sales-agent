import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AddMemberRequest, CreateOrganizationRequest, MemberRole } from '@ai-sales-agent/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { OrganizationsService } from './organizations.service.js';

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateOrganizationRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orgs.createOrganization(req.auth!, body.name, idempotencyKey ?? '');
  }

  @Get(':id')
  get(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.orgs.getOrganization(req.auth!, id);
  }

  @Get(':id/members')
  listMembers(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.orgs.listMembers(req.auth!, id);
  }

  @Post(':id/members')
  addMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: AddMemberRequest,
  ) {
    return this.orgs.addMember(req.auth!, id, body);
  }

  @Patch(':id/members/:userId')
  updateRole(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { role: MemberRole },
  ) {
    return this.orgs.updateMemberRole(req.auth!, id, userId, body.role);
  }

  @Post(':id/members/:userId/revoke')
  revoke(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.orgs.revokeMember(req.auth!, id, userId);
  }
}
