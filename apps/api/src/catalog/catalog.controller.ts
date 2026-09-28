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
  CatalogItemKind,
  CatalogItemStatus,
  CreateCatalogItemRequest,
  UpdateCatalogItemRequest,
} from '@ai-sales-agent/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { CatalogService } from './catalog.service.js';

@Controller('organizations/:organizationId/catalog')
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string) {
    return this.catalog.list(req.auth!, org);
  }

  @Get('items')
  listItems(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('kind') kind?: CatalogItemKind,
    @Query('status') status?: CatalogItemStatus,
  ) {
    return this.catalog.listCatalogItems(req.auth!, org, { kind, status });
  }

  @Get('items/:itemId')
  getItem(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('itemId') itemId: string,
  ) {
    return this.catalog.getCatalogItem(req.auth!, org, itemId);
  }

  @Post('items')
  createItem(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: CreateCatalogItemRequest,
  ) {
    return this.catalog.createCatalogItem(req.auth!, org, body);
  }

  @Patch('items/:itemId')
  updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateCatalogItemRequest,
  ) {
    return this.catalog.updateCatalogItem(req.auth!, org, itemId, body);
  }

  @Post('items/:itemId/archive')
  archiveItem(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('itemId') itemId: string,
  ) {
    return this.catalog.archiveCatalogItem(req.auth!, org, itemId);
  }

  // Legacy endpoints
  @Post('locations')
  location(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: { name: string; timezone: string; address?: string },
  ) {
    return this.catalog.createLocation(req.auth!, org, body);
  }

  @Post('services')
  service(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body()
    body: {
      locationId: string;
      name: string;
      durationMinutes: number;
      bufferBeforeMinutes?: number;
      bufferAfterMinutes?: number;
      amountMinor: string;
      currency: string;
    },
  ) {
    return this.catalog.createService(req.auth!, org, body);
  }

  @Post('staff')
  staff(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: { locationId: string; displayName: string; memberUserId?: string },
  ) {
    return this.catalog.createStaff(req.auth!, org, body);
  }

  @Post('services/:serviceId/staff/:staffId')
  link(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('serviceId') serviceId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.catalog.linkStaff(req.auth!, org, serviceId, staffId);
  }

  @Post(':kind/:id/archive')
  archive(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    return this.catalog.archive(req.auth!, org, kind, id);
  }
}
