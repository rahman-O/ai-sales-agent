import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { LeadsService } from './leads.service.js';

@Controller('organizations/:organizationId/leads')
@UseGuards(AuthGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('assignedUserId') assignedUserId?: string,
  ) {
    return this.leads.list(req.auth!, org, { status, customerId, assignedUserId });
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body()
    body: {
      customerId: string;
      primaryServiceId?: string | null;
      locationId?: string | null;
      needSummary?: string | null;
      preferredContactChannel?: string | null;
      language?: string | null;
      urgency?: string | null;
      sourceConversationId?: string | null;
      sourceMessageId?: string | null;
      sourceType?: string;
    },
  ) {
    return this.leads.create(req.auth!, org, body);
  }

  @Get(':leadId')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('leadId') leadId: string,
  ) {
    return this.leads.get(req.auth!, org, leadId);
  }

  @Get(':leadId/activities')
  activities(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('leadId') leadId: string,
  ) {
    return this.leads.listActivities(req.auth!, org, leadId);
  }

  @Patch(':leadId')
  updateQualification(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('leadId') leadId: string,
    @Body()
    body: {
      expectedVersion: number;
      primaryServiceId?: string | null;
      locationId?: string | null;
      needSummary?: string | null;
      preferredContactChannel?: string | null;
      language?: string | null;
      urgency?: string | null;
    },
  ) {
    return this.leads.updateQualification(req.auth!, org, leadId, body);
  }

  @Post(':leadId/transitions')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('leadId') leadId: string,
    @Body()
    body: {
      expectedVersion: number;
      toStatus: string;
      reasonCode?: string;
      reasonText?: string;
    },
  ) {
    return this.leads.transitionStatus(req.auth!, org, leadId, body);
  }

  @Post(':leadId/assign')
  assign(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('leadId') leadId: string,
    @Body() body: { expectedVersion: number; assignedUserId: string },
  ) {
    return this.leads.assign(req.auth!, org, leadId, body);
  }

  @Post(':leadId/unassign')
  unassign(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('leadId') leadId: string,
    @Body() body: { expectedVersion: number },
  ) {
    return this.leads.unassign(req.auth!, org, leadId, body);
  }

  @Post(':leadId/notes')
  note(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('leadId') leadId: string,
    @Body() body: { text: string },
  ) {
    return this.leads.addNote(req.auth!, org, leadId, body);
  }
}
