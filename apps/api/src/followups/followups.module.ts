import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { FollowUpsController } from './followups.controller.js';
import { FollowUpsService } from './followups.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, ConversationsModule],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
