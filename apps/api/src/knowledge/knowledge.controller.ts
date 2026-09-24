import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { KnowledgeService } from './knowledge.service.js';

@Controller('organizations/:organizationId/knowledge')
@UseGuards(AuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('documents')
  list(@Req() req: AuthenticatedRequest, @Param('organizationId') org: string) {
    return this.knowledge.listDocuments(req.auth!, org);
  }

  @Get('documents/:documentId')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('documentId') documentId: string,
  ) {
    return this.knowledge.getDocument(req.auth!, org, documentId);
  }

  @Post('uploads')
  createUpload(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: { title: string; contentType: string },
  ) {
    return this.knowledge.createUpload(req.auth!, org, body);
  }

  @Post('documents/:documentId/finalize')
  finalize(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('documentId') documentId: string,
    @Body() body: { versionId: string },
  ) {
    return this.knowledge.finalizeUpload(req.auth!, org, documentId, body);
  }

  @Post('documents/:documentId/versions/:versionId/approve')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.knowledge.approve(req.auth!, org, documentId, versionId);
  }

  @Post('documents/:documentId/versions/:versionId/publish')
  publish(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.knowledge.publish(req.auth!, org, documentId, versionId);
  }

  @Post('documents/:documentId/unpublish')
  unpublish(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('documentId') documentId: string,
  ) {
    return this.knowledge.unpublish(req.auth!, org, documentId);
  }

  @Post('documents/:documentId/archive')
  archive(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('documentId') documentId: string,
  ) {
    return this.knowledge.archive(req.auth!, org, documentId);
  }

  @Delete('documents/:documentId')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('documentId') documentId: string,
  ) {
    return this.knowledge.softDelete(req.auth!, org, documentId);
  }

  /** Filesystem BlobStore helper — local/dev only; forbidden in production. */
  @Post('blob-put')
  blobPut(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body() body: { objectKey: string; contentType: string; text: string },
  ) {
    return this.knowledge.putBlobText(req.auth!, org, body);
  }
}
