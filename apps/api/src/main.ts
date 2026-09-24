import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import { loadLocalEnv, loadServerEnv } from '@ai-sales-agent/config';

async function bootstrap() {
  loadLocalEnv();
  const env = loadServerEnv(process.env);
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });
  app.use(
    json({
      limit: '1mb',
      verify: (req, _res, buffer) => {
        (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      },
    }),
  );
  app.use(urlencoded({ extended: false, limit: '16kb' }));
  app.setGlobalPrefix('v1', { exclude: ['health/live', 'health/ready'] });
  app.enableCors({
    origin: env.APP_URL,
    credentials: true,
  });
  const port = Number(process.env.PORT || new URL(env.API_URL).port || 3001);
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  console.log(JSON.stringify({ msg: 'api_listening', port, env: env.NODE_ENV }));
}

bootstrap().catch((err) => {
  console.error(JSON.stringify({ msg: 'api_boot_failed', error: String(err) }));
  process.exit(1);
});
