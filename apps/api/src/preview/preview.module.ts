import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PreviewController } from './preview.controller.js';
import { PreviewService } from './preview.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PreviewController],
  providers: [PreviewService],
  exports: [PreviewService],
})
export class PreviewModule {}
