import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { AgentService } from './agent.service.js';

@Controller('organizations/:organizationId/agent')
@UseGuards(AuthGuard)
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Get('configs')
  listConfigs(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string) {
    return this.agent.listConfigs(req.auth!, org);
  }

  @Post('configs')
  createDraft(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body()
    body: {
      promptVersion: string;
      modelProfile: string;
      toolAllowlist?: string[];
      budgetsJson?: Record<string, number>;
      localeDefault?: string;
    },
  ) {
    return this.agent.createDraft(req.auth!, org, body);
  }

  @Post('configs/:configId/activate')
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('configId') configId: string,
  ) {
    return this.agent.activate(req.auth!, org, configId);
  }

  @Post('configs/:configId/disable')
  disable(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('configId') configId: string,
  ) {
    return this.agent.disable(req.auth!, org, configId);
  }

  @Get('runs')
  listRuns(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('conversationId') conversationId?: string,
  ) {
    return this.agent.listRuns(req.auth!, org, conversationId);
  }

  @Get('runs/:runId')
  getRun(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('runId') runId: string,
  ) {
    return this.agent.getRunTrace(req.auth!, org, runId);
  }

  @Post('test-run')
  testRun(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: { fixtureId?: string; userText?: string },
  ) {
    return this.agent.testRun(req.auth!, org, body ?? {});
  }
}
