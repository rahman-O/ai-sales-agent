import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  CreatePreviewSessionRequest,
  SendPreviewMessageRequest,
  ResetPreviewSessionRequest,
} from '@ai-sales-agent/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PreviewService } from './preview.service.js';

@Controller('organizations/:organizationId/preview')
@UseGuards(AuthGuard)
export class PreviewController {
  constructor(private readonly preview: PreviewService) {}

  @Post('sessions')
  createSession(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: CreatePreviewSessionRequest,
  ) {
    return this.preview.createSession(req.auth!, org, body);
  }

  @Get('sessions/:sessionId')
  getSession(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.preview.getSession(req.auth!, org, sessionId);
  }

  @Post('sessions/:sessionId/messages')
  sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('sessionId') sessionId: string,
    @Body() body: SendPreviewMessageRequest,
  ) {
    return this.preview.sendMessage(req.auth!, org, sessionId, body);
  }

  @Post('sessions/:sessionId/reset')
  resetSession(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('sessionId') sessionId: string,
    @Body() body: ResetPreviewSessionRequest,
  ) {
    return this.preview.resetSession(req.auth!, org, sessionId, body);
  }
}
