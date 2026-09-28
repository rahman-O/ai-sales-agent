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
  CreateOfferRequest,
  OfferStatus,
  UpdateOfferRequest,
} from '@ai-sales-agent/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { OffersService } from './offers.service.js';

@Controller('organizations/:organizationId/offers')
@UseGuards(AuthGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('status') status?: OfferStatus,
    @Query('targetCatalogItemId') targetCatalogItemId?: string,
  ) {
    return this.offers.listOffers(req.auth!, org, { status, targetCatalogItemId });
  }

  @Get(':offerId')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('offerId') offerId: string,
  ) {
    return this.offers.getOffer(req.auth!, org, offerId);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: CreateOfferRequest,
  ) {
    return this.offers.createOffer(req.auth!, org, body);
  }

  @Patch(':offerId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('offerId') offerId: string,
    @Body() body: UpdateOfferRequest,
  ) {
    return this.offers.updateOffer(req.auth!, org, offerId, body);
  }

  @Post(':offerId/activate')
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('offerId') offerId: string,
  ) {
    return this.offers.activateOffer(req.auth!, org, offerId);
  }

  @Post(':offerId/pause')
  pause(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('offerId') offerId: string,
  ) {
    return this.offers.pauseOffer(req.auth!, org, offerId);
  }

  @Post(':offerId/archive')
  archive(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('offerId') offerId: string,
  ) {
    return this.offers.archiveOffer(req.auth!, org, offerId);
  }

  @Get('applicable/:catalogItemId')
  getApplicableForCatalogItem(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('catalogItemId') catalogItemId: string,
  ) {
    return this.offers.getApplicableOffersForCatalogItem(req.auth!, org, catalogItemId);
  }
}
