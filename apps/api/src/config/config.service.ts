import { Injectable } from '@nestjs/common';
import { loadServerEnv, supabaseIssuer, supabaseJwksUrl, type ServerEnv } from '@ai-sales-agent/config';

@Injectable()
export class AppConfigService {
  readonly env: ServerEnv;
  readonly jwksUrl: string;
  readonly issuer: string;

  constructor() {
    this.env = loadServerEnv(process.env);
    this.jwksUrl = supabaseJwksUrl(this.env.SUPABASE_URL);
    this.issuer = supabaseIssuer(this.env.SUPABASE_URL);
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.env.REDIS_URL;
  }
}
