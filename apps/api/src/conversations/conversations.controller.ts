import {
  Body,
  Controller,
  Get,
  Headers,
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
import { ConversationControlService } from './conversation-control.service.js';
import { InboundMessagingService } from '../messaging/inbound.service.js';

@Controller('organizations/:organizationId/conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly control: ConversationControlService,
  ) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('mode') mode?: string,
    @Query('unassignedOnly') unassignedOnly?: string,
    @Query('assignedToMe') assignedToMe?: string,
  ) {
    return this.conversations.listInbox(req.auth!, org, {
      cursor,
      limit: limit ? Number(limit) : 50,
      mode,
      unassignedOnly: unassignedOnly === 'true' || unassignedOnly === '1',
      assignedToMe: assignedToMe === 'true' || assignedToMe === '1',
    });
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

  @Get(':id')
  getOne(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
  ) {
    return this.conversations.getOne(req.auth!, org, id);
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

  /** Legacy P03 — hardened; always rejects arbitrary mode mutation. */
  @Post(':id/mode')
  mode(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body() body: { mode: string; expectedVersion: number },
  ) {
    return this.conversations.transitionMode(
      req.auth!,
      org,
      id,
      body.mode,
      body.expectedVersion,
    );
  }

  @Post(':id/takeover')
  takeover(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body()
    body: {
      expectedOwnershipEpoch: number;
      reasonCode?: string;
      reasonText?: string;
    },
  ) {
    return this.control.takeover(
      req.auth!,
      org,
      id,
      body.expectedOwnershipEpoch,
      body.reasonCode,
      body.reasonText,
    );
  }

  @Post(':id/claim')
  claim(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body() body: { expectedOwnershipEpoch: number },
  ) {
    return this.control.claim(req.auth!, org, id, body.expectedOwnershipEpoch);
  }

  @Post(':id/reassign')
  reassign(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body() body: { expectedOwnershipEpoch: number; ownerUserId: string },
  ) {
    return this.control.reassign(
      req.auth!,
      org,
      id,
      body.expectedOwnershipEpoch,
      body.ownerUserId,
    );
  }

  @Post(':id/release')
  release(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body() body: { expectedOwnershipEpoch: number },
  ) {
    return this.control.release(req.auth!, org, id, body.expectedOwnershipEpoch);
  }

  @Post(':id/resume-ai')
  resumeAi(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body() body: { expectedOwnershipEpoch: number },
  ) {
    return this.control.resumeAI(req.auth!, org, id, body.expectedOwnershipEpoch);
  }

  @Post(':id/replies')
  reply(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: { text: string; expectedOwnershipEpoch: number },
  ) {
    return this.control.humanReply(
      req.auth!,
      org,
      id,
      body.text,
      body.expectedOwnershipEpoch,
      idempotencyKey ?? '',
    );
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
