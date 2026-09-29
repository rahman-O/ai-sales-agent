import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PacksController } from './packs.controller.js';
import { PacksService } from './packs.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PacksController],
  providers: [PacksService],
  exports: [PacksService],
})
export class PacksModule {}
