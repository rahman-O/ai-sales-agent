import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { CustomersService } from './customers.service.js';

@Controller('organizations/:organizationId/customers')
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get() list(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string, @Query('query') query?: string) {
    return this.customers.list(req.auth!, org, query);
  }
  @Get(':id') get(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string, @Param('id') id: string) {
    return this.customers.get(req.auth!, org, id);
  }
  @Post() create(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string, @Body() body: { displayName?: string; preferredLocale?: string }) {
    return this.customers.create(req.auth!, org, body);
  }
  @Patch(':id') update(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string, @Param('id') id: string, @Body() body: { displayName?: string; preferredLocale?: string; expectedVersion: number }) {
    return this.customers.update(req.auth!, org, id, body);
  }
  @Post(':id/identities') identity(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string, @Param('id') id: string, @Body() body: { channel: string; externalAddress: string }) {
    return this.customers.bindIdentity(req.auth!, org, id, body);
  }
  @Post(':id/merge') merge(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string, @Param('id') canonicalId: string, @Body() body: { sourceCustomerId: string; evidenceReference: string }) {
    return this.customers.merge(req.auth!, org, canonicalId, body.sourceCustomerId, body.evidenceReference);
  }
  @Post(':id/archive') archive(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string, @Param('id') id: string) {
    return this.customers.archive(req.auth!, org, id);
  }
}
