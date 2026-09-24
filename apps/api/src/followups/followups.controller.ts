import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { FollowUpsService } from './followups.service.js';

@Controller('organizations/:organizationId/follow-ups')
@UseGuards(AuthGuard)
export class FollowUpsController {
  constructor(private readonly followUps: FollowUpsService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('status') status?: string,
  ) {
    return this.followUps.list(req.auth!, org, status);
  }

  @Get('policy')
  getPolicy(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string) {
    return this.followUps.getPolicy(req.auth!, org);
  }

  @Patch('policy')
  updatePolicy(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body()
    body: {
      followUpEnabled?: boolean;
      defaultNoResponseDelayMinutes?: number;
      maxPendingPerCustomer?: number;
      quietHoursStartMinute?: number;
      quietHoursEndMinute?: number;
      timezone?: string;
    },
  ) {
    return this.followUps.updatePolicy(req.auth!, org, body);
  }

  @Post()
  schedule(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body()
    body: {
      customerId: string;
      conversationId?: string;
      leadId?: string;
      bookingId?: string;
      triggerType: 'LEAD_NO_RESPONSE' | 'MANUAL_SCHEDULED' | 'BOOKING_REMINDER';
      outreachBasis:
        | 'CUSTOMER_INITIATED_CONVERSATION'
        | 'TRANSACTIONAL_BOOKING'
        | 'EXPLICIT_OPT_IN'
        | 'OPERATOR_SCHEDULED';
      scheduledFor: string;
      timezone?: string;
      templateVersionId?: string;
      sendMode?: 'FREE_FORM' | 'TEMPLATE';
      text?: string;
      params?: Record<string, string>;
    },
  ) {
    return this.followUps.schedule(req.auth!, org, body, idempotencyKey);
  }

  @Post(':id/cancel')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body() body: { expectedVersion: number },
  ) {
    return this.followUps.cancel(req.auth!, org, id, body.expectedVersion);
  }
}
