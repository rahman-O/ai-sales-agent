/** Apply migrations to the same guarded local database used by demo reset/seed. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { loadDemoCliEnv } from './load-demo-cli-env.ts';
import { requireLocalDemoDb } from './assert-local-demo-db.ts';

loadDemoCliEnv();
requireLocalDemoDb();

const prismaCli = path.resolve('node_modules/prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});
if (result.error) {
  console.error(`demo_migrate_spawn_failed:${result.error.code ?? result.error.name}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(JSON.stringify({ DEMO_MIGRATE: 'PASS', DEMO_DB_TARGET: 'LOCAL' }));
