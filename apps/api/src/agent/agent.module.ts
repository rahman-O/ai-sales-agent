import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
