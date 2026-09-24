import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { TemplatesService } from './templates.service.js';

@Controller('organizations/:organizationId/message-templates')
@UseGuards(AuthGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string) {
    return this.templates.list(req.auth!, org);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body()
    body: {
      internalName: string;
      providerTemplateName: string;
      providerLanguageCode?: string;
      category?: string;
      parameterSchema?: Record<string, unknown>;
      bodyPreview?: string;
      providerStatus?: string;
    },
  ) {
    return this.templates.create(req.auth!, org, body);
  }

  @Patch(':id/status')
  setStatus(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body() body: { internalStatus: 'DRAFT' | 'APPROVED' | 'DISABLED' },
  ) {
    return this.templates.setInternalStatus(req.auth!, org, id, body.internalStatus);
  }

  @Post(':id/versions')
  addVersion(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body()
    body: {
      providerTemplateName: string;
      providerLanguageCode?: string;
      parameterSchema?: Record<string, unknown>;
      bodyPreview?: string;
      providerStatus?: string;
      activate?: boolean;
    },
  ) {
    return this.templates.addVersion(req.auth!, org, id, body);
  }
}
