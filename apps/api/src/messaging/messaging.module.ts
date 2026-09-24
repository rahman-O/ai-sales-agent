import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller.js';
import { WhatsAppWebhookService } from './whatsapp-webhook.service.js';
import { ChannelsController } from './channels.controller.js';

@Module({
  imports: [DatabaseModule, AuthModule, ConversationsModule],
  controllers: [WhatsAppWebhookController, ChannelsController],
  providers: [WhatsAppWebhookService],
  exports: [WhatsAppWebhookService],
})
export class MessagingModule {}
