import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadServerEnv } from '@ai-sales-agent/config';

async function bootstrap() {
  const env = loadServerEnv(process.env);
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('v1', { exclude: ['health/live', 'health/ready'] });
  app.enableCors({
    origin: env.APP_URL,
    credentials: true,
  });
  const port = Number(new URL(env.API_URL).port || 3001);
  await app.listen(port, '127.0.0.1');
  console.log(JSON.stringify({ msg: 'api_listening', port, env: env.NODE_ENV }));
}

bootstrap().catch((err) => {
  console.error(JSON.stringify({ msg: 'api_boot_failed', error: String(err) }));
  process.exit(1);
});
