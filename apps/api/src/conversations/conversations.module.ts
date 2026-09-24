import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ConversationsController, DevMessagingController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { ConversationControlService } from './conversation-control.service.js';
import { ConversationEventsHub } from './conversation-events.hub.js';
import { InboundMessagingService } from '../messaging/inbound.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ConversationsController, DevMessagingController],
  providers: [
    ConversationsService,
    ConversationControlService,
    ConversationEventsHub,
    InboundMessagingService,
  ],
  exports: [
    ConversationsService,
    ConversationControlService,
    InboundMessagingService,
    ConversationEventsHub,
  ],
})
export class ConversationsModule {}
