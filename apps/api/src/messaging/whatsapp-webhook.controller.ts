import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { WhatsAppWebhookService } from './whatsapp-webhook.service.js';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('webhooks/whatsapp/meta')
export class WhatsAppWebhookController {
  constructor(private readonly webhooks: WhatsAppWebhookService) {}

  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    const result = this.webhooks.verifyGet({
      'hub.mode': mode,
      'hub.verify_token': verifyToken,
      'hub.challenge': challenge,
    });
    if (!result.ok) throw new ForbiddenException();
    return result.challenge;
  }

  @Post()
  @HttpCode(200)
  async ingest(
    @Req() req: RawBodyRequest,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException('raw_body_required');
    }
    try {
      const result = await this.webhooks.handlePost(raw, headers);
      return { ok: true, processed: result.processed };
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403) throw new ForbiddenException('invalid_signature');
      if (status === 413) throw new PayloadTooLargeException();
      if (status === 400) throw new BadRequestException((e as Error).message);
      throw e;
    }
  }
}
