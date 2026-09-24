import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { TemplatesController } from './templates.controller.js';
import { TemplatesService } from './templates.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
