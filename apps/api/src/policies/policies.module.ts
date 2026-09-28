import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PoliciesController } from './policies.controller.js';
import { PoliciesService } from './policies.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
