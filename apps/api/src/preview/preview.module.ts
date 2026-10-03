import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PreviewController } from './preview.controller.js';
import { PreviewService } from './preview.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PreviewController],
  providers: [PreviewService],
  exports: [PreviewService],
})
export class PreviewModule {}
