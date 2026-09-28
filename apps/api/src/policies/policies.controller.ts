import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type {
  BusinessPolicyStatus,
  BusinessPolicyType,
  CreateBusinessPolicyRequest,
  UpdateBusinessPolicyRequest,
} from '@ai-sales-agent/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PoliciesService } from './policies.service.js';

@Controller('organizations/:organizationId/policies')
@UseGuards(AuthGuard)
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Query('policyType') policyType?: BusinessPolicyType,
    @Query('status') status?: BusinessPolicyStatus,
  ) {
    return this.policies.list(req.auth!, organizationId, { policyType, status });
  }

  @Get('effective/:policyType')
  effective(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('policyType') policyType: BusinessPolicyType,
  ) {
    return this.policies.getEffective(req.auth!, organizationId, policyType);
  }

  @Get(':policyId')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
  ) {
    return this.policies.get(req.auth!, organizationId, policyId);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Body() body: CreateBusinessPolicyRequest,
  ) {
    return this.policies.create(req.auth!, organizationId, body);
  }

  @Patch(':policyId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
    @Body() body: UpdateBusinessPolicyRequest,
  ) {
    return this.policies.update(req.auth!, organizationId, policyId, body);
  }

  @Post(':policyId/activate')
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
  ) {
    return this.policies.activate(req.auth!, organizationId, policyId);
  }

  @Post(':policyId/archive')
  archive(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
  ) {
    return this.policies.archive(req.auth!, organizationId, policyId);
  }
}
