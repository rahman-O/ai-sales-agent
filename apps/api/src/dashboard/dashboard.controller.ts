import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { DashboardService } from './dashboard.service.js';

@Controller('organizations/:organizationId/dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string) {
    return this.dashboard.getDashboard(req.auth!, org);
  }
}
