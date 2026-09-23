import {
  Body,
  Controller,
  Get,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { ConversationsService } from './conversations.service.js';
import { InboundMessagingService } from '../messaging/inbound.service.js';

@Controller('organizations/:organizationId/conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversations.listInbox(req.auth!, org, cursor, limit ? Number(limit) : 50);
  }

  @Get('events')
  @Sse()
  events(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      let closed = false;
      void this.conversations.subscribeEvents(req.auth!, org).then((sub) => {
        if (closed) {
          sub.close();
          return;
        }
        const heartbeat = setInterval(() => {
          subscriber.next({ type: 'heartbeat', data: { ok: true } } as MessageEvent);
        }, 15000);
        sub.on((event) => {
          subscriber.next({ type: 'refetch', data: event } as MessageEvent);
        });
        subscriber.add(() => {
          closed = true;
          clearInterval(heartbeat);
          sub.close();
        });
      }).catch((err) => {
        subscriber.error(err);
      });
    });
  }

  @Get(':id/messages')
  messages(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversations.listMessages(req.auth!, org, id, cursor, limit ? Number(limit) : 50);
  }

  /** P03 mode/epoch primitive — not full P09 takeover UX. */
  @Post(':id/mode')
  mode(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body() body: { mode: 'AI_ACTIVE' | 'AI_PAUSED' | 'HUMAN_ACTIVE' | 'CLOSED'; expectedVersion: number },
  ) {
    return this.conversations.transitionMode(req.auth!, org, id, body.mode, body.expectedVersion);
  }
}

@Controller('organizations/:organizationId/dev/messaging')
@UseGuards(AuthGuard)
export class DevMessagingController {
  constructor(
    private readonly inbound: InboundMessagingService,
    private readonly conversations: ConversationsService,
  ) {}

  @Post('inbound')
  ingestInbound(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Body()
    body: {
      provider?: string;
      channelConnectionId?: string;
      senderAddress: string;
      providerMessageId: string;
      text: string;
      providerEventAt?: string | null;
    },
  ) {
    this.conversations.assertNotProductionDevRoute();
    if (process.env.NODE_ENV === 'production') throw new NotFoundException();
    return this.inbound.ingestDevInbound(req.auth!, org, body);
  }
}
