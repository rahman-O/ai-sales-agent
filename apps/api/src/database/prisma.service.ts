import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { AppConfigService } from '../config/config.service.js';
import { createAppPool } from './pg-pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.resolve(here, '../../../../prisma/generated/client/client.ts');
const generated = await import(pathToFileURL(clientPath).href);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PrismaClientCtor = generated.PrismaClient as any;

export type DbClient = any;

/**
 * Runtime Prisma client bound ONLY to DATABASE_URL (app_runtime).
 * Never uses MIGRATION_DATABASE_URL.
 * Pass an explicit pg Pool so interactive transactions work on Supabase SESSION_POOLER.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly client: any;
  private readonly pool: Pool;

  constructor(@Inject(AppConfigService) config: AppConfigService) {
    this.pool = createAppPool(config.databaseUrl, {
      max: 2,
      connectionTimeoutMillis: 20_000,
    });
    // Dual @types/pg versions can disagree; runtime Pool is correct for adapter-pg.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaPg(this.pool as any);
    this.client = new PrismaClientCtor({
      adapter,
      transactionOptions: { maxWait: 20_000, timeout: 20_000 },
    });
  }

  $transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    return this.client.$transaction(fn);
  }

  $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
    return this.client.$queryRaw(strings, ...values);
  }

  /** Shared app_runtime pool for adapters that use pg directly (agent). */
  getPgPool(): Pool {
    return this.pool;
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    await this.pool.end();
  }
}
