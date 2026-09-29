import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  type PackApplicationMode,
  ApplyBusinessPackSchema,
  PreviewBusinessPackSchema,
} from '@ai-sales-agent/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PacksService } from './packs.service.js';

@Controller()
@UseGuards(AuthGuard)
export class PacksController {
  constructor(private readonly packsService: PacksService) {}

  @Get('business-packs')
  listPacks() {
    return this.packsService.listPacks();
  }

  @Get('business-packs/:packId')
  getPack(@Param('packId') packId: string) {
    return this.packsService.getPack(packId);
  }

  @Post('organizations/:organizationId/packs/:packId/preview')
  previewPack(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('packId') packId: string,
    @Body() body: { mode?: PackApplicationMode },
  ) {
    const validated = PreviewBusinessPackSchema.parse({
      packId,
      mode: body?.mode,
    });
    return this.packsService.previewPack(
      req.auth!,
      organizationId,
      validated.packId,
      validated.mode,
    );
  }

  @Post('organizations/:organizationId/packs/:packId/apply')
  applyPack(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('packId') packId: string,
    @Body() body: { mode?: 'INITIAL_SETUP' | 'MERGE_MISSING' },
  ) {
    const validated = ApplyBusinessPackSchema.parse({
      packId,
      mode: body?.mode,
    });
    return this.packsService.applyPack(
      req.auth!,
      organizationId,
      validated.packId,
      validated.mode,
    );
  }
}
