import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { createClient } from 'redis';
import { AppConfigService } from '../config/config.service.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const redis = createClient({ url: this.config.redisUrl });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready' });
    }
  }
}
