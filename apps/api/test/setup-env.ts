import { loadLocalEnv } from '@ai-sales-agent/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
loadLocalEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'));
process.env.APP_URL ??= 'http://localhost:3000';
process.env.API_URL ??= 'http://127.0.0.1:3001';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
