import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('organizations/:organizationId/analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('timezone') timezone?: string
  ) {
    return this.analytics.overview(req.auth!, org, { from, to, timezone });
  }

  @Get('funnels')
  getFunnels(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('timezone') timezone?: string
  ) {
    return this.analytics.funnels(req.auth!, org, { from, to, timezone });
  }

  @Get('catalog')
  getCatalog(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('timezone') timezone?: string
  ) {
    return this.analytics.catalog(req.auth!, org, { from, to, timezone });
  }

  @Get('transactions')
  getTransactions(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('timezone') timezone?: string
  ) {
    return this.analytics.transactions(req.auth!, org, { from, to, timezone });
  }

  @Get('intents')
  getIntents(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('timezone') timezone?: string
  ) {
    return this.analytics.intents(req.auth!, org, { from, to, timezone });
  }
}
