import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';

/** Messaging lives with conversations for P03; module retained for clear ownership. */
@Module({
  imports: [ConversationsModule],
  exports: [ConversationsModule],
})
export class MessagingModule {}
