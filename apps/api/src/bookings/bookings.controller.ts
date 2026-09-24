import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { BookingsService } from './bookings.service.js';

@Controller('organizations/:organizationId')
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('availability')
  availability(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('serviceId') serviceId: string,
    @Query('customerId') customerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate?: string,
    @Query('locationId') locationId?: string,
    @Query('staffMemberId') staffMemberId?: string,
  ) {
    return this.bookings.getAvailableSlots(req.auth!, org, {
      serviceId,
      customerId,
      startDate,
      endDate,
      locationId,
      staffMemberId,
    });
  }

  @Get('bookings')
  list(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.bookings.list(req.auth!, org, { customerId, status });
  }

  @Get('bookings/:bookingId')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookings.get(req.auth!, org, bookingId);
  }

  @Post('bookings')
  create(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: { slotToken: string; customerId: string; leadId?: string },
  ) {
    return this.bookings.createFromOperator(req.auth!, org, body);
  }

  @Post('bookings/:bookingId/cancel')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('bookingId') bookingId: string,
    @Body() body: { expectedVersion: number; reasonCode: string; reasonText?: string },
  ) {
    return this.bookings.cancel(req.auth!, org, bookingId, body);
  }

  @Post('bookings/:bookingId/reschedule')
  reschedule(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('bookingId') bookingId: string,
    @Body() body: { expectedVersion: number; slotToken: string },
  ) {
    return this.bookings.reschedule(req.auth!, org, bookingId, body);
  }

  @Get('schedule/rules')
  rules(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('staffMemberId') staffMemberId?: string,
  ) {
    return this.bookings.listRules(req.auth!, org, staffMemberId);
  }

  @Post('schedule/rules')
  createRule(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body()
    body: {
      staffMemberId: string;
      locationId: string;
      dayOfWeek: number;
      localStartTime: string;
      localEndTime: string;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
    },
  ) {
    return this.bookings.createRule(req.auth!, org, body);
  }

  @Get('schedule/exceptions')
  exceptions(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('staffMemberId') staffMemberId?: string,
  ) {
    return this.bookings.listExceptions(req.auth!, org, staffMemberId);
  }

  @Post('schedule/exceptions')
  createException(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body()
    body: {
      staffMemberId: string;
      locationId: string;
      localDate: string;
      type: 'AVAILABLE' | 'UNAVAILABLE';
      localStartTime?: string | null;
      localEndTime?: string | null;
      reasonCode?: string | null;
    },
  ) {
    return this.bookings.createException(req.auth!, org, body);
  }
}
