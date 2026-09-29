import { Controller, Get, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { AppConfigService } from '../config/config.service.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller('health')
export class HealthController implements OnModuleDestroy {
  private redisClient: RedisClientType | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleDestroy() {
    if (this.redisClient && this.redisClient.isOpen) {
      await this.redisClient.quit().catch(() => {});
    }
  }

  @Get('live')
  live() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Get('ready')
  async ready() {
    const checks: { database: 'ok' | 'fail'; redis: 'ok' | 'fail' } = {
      database: 'fail',
      redis: 'fail',
    };

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 3000)),
      ]);
      checks.database = 'ok';
    } catch {
      checks.database = 'fail';
    }

    try {
      if (!this.redisClient || !this.redisClient.isOpen) {
        this.redisClient = createClient({ url: this.config.redisUrl }) as RedisClientType;
        await this.redisClient.connect();
      }
      await Promise.race([
        this.redisClient.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('redis_timeout')), 3000)),
      ]);
      checks.redis = 'ok';
    } catch {
      checks.redis = 'fail';
      // Reset client so next probe attempts reconnection
      if (this.redisClient) {
        this.redisClient.disconnect().catch(() => {});
        this.redisClient = null;
      }
    }

    const allReady = checks.database === 'ok' && checks.redis === 'ok';
    if (!allReady) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks,
      });
    }

    return {
      status: 'ready',
      checks,
    };
  }
}
