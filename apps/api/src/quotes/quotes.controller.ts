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
import type {
  CreateQuoteRequest,
  QuoteStatus,
  UpdateQuoteRequest,
} from '@ai-sales-agent/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { QuotesService } from './quotes.service.js';

@Controller('organizations/:organizationId/quotes')
@UseGuards(AuthGuard)
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('status') status?: QuoteStatus,
    @Query('customerId') customerId?: string,
    @Query('leadId') leadId?: string,
  ) {
    return this.quotes.listQuotes(req.auth!, org, { status, customerId, leadId });
  }

  @Get(':quoteId')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.quotes.getQuote(req.auth!, org, quoteId);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: CreateQuoteRequest,
  ) {
    return this.quotes.createQuote(req.auth!, org, body);
  }

  @Patch(':quoteId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('quoteId') quoteId: string,
    @Body() body: UpdateQuoteRequest,
  ) {
    return this.quotes.updateQuote(req.auth!, org, quoteId, body);
  }

  @Post(':quoteId/present')
  present(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('quoteId') quoteId: string,
    @Body('expectedVersion') expectedVersion?: number,
  ) {
    return this.quotes.presentQuote(req.auth!, org, quoteId, expectedVersion);
  }

  @Post(':quoteId/accept')
  accept(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('quoteId') quoteId: string,
    @Body('expectedVersion') expectedVersion?: number,
  ) {
    return this.quotes.acceptQuote(req.auth!, org, quoteId, expectedVersion);
  }

  @Post(':quoteId/reject')
  reject(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('quoteId') quoteId: string,
    @Body('expectedVersion') expectedVersion?: number,
  ) {
    return this.quotes.rejectQuote(req.auth!, org, quoteId, expectedVersion);
  }

  @Post(':quoteId/cancel')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('quoteId') quoteId: string,
    @Body('expectedVersion') expectedVersion?: number,
  ) {
    return this.quotes.cancelQuote(req.auth!, org, quoteId, expectedVersion);
  }
}
