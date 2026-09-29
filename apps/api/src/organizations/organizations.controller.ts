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
import type {
  AddMemberRequest,
  CreateOrganizationRequest,
  MemberRole,
  UpdateConversationProfileRequest,
  UpdateOrganizationCapabilitiesRequest,
  UpdateOrganizationProfileRequest,
} from '@ai-sales-agent/contracts';
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

  @Get(':id/profile')
  getProfile(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.orgs.getProfile(req.auth!, id);
  }

  @Patch(':id/profile')
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateOrganizationProfileRequest,
  ) {
    return this.orgs.updateProfile(req.auth!, id, body);
  }

  @Get(':id/capabilities')
  getCapabilities(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.orgs.getCapabilities(req.auth!, id);
  }

  @Patch(':id/capabilities')
  updateCapabilities(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateOrganizationCapabilitiesRequest,
  ) {
    return this.orgs.updateCapabilities(req.auth!, id, body);
  }

  @Get(':id/conversation-profile')
  getConversationProfile(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.orgs.getConversationProfile(req.auth!, id);
  }

  @Patch(':id/conversation-profile')
  updateConversationProfile(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateConversationProfileRequest,
  ) {
    return this.orgs.updateConversationProfile(req.auth!, id, body);
  }

  @Get(':id/onboarding')
  getOnboarding(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.orgs.getOnboardingState(req.auth!, id);
  }

  @Patch(':id/onboarding-progress')
  updateOnboardingProgress(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.orgs.updateOnboardingProgress(req.auth!, id, body);
  }

  @Post(':id/onboarding/complete')
  completeOnboarding(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.orgs.completeOnboarding(req.auth!, id);
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

  /** P13: org-scoped emergency AI disable — blocks new AgentRuns; inbound + human inbox continue. */
  @Post(':id/ai-emergency-disable')
  disableAi(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.orgs.setAiEmergencyDisable(req.auth!, id, true, body?.reason);
  }

  @Post(':id/ai-emergency-enable')
  enableAi(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.orgs.setAiEmergencyDisable(req.auth!, id, false);
  }
}

