/**
 * demo:reseed = reset + seed (no verify).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

function run(script: string) {
  const r = spawnSync(
    process.execPath,
    ['--import', 'tsx', path.join(here, script)],
    {
      cwd: root,
      env: {
        ...process.env,
        DEMO_DB_TARGET: process.env.DEMO_DB_TARGET ?? 'LOCAL',
        DEMO_FORCE_LOCAL_DB: '1',
        ALLOW_DEMO_RESET: process.env.ALLOW_DEMO_RESET ?? 'true',
      },
      stdio: 'inherit',
    },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('reset.ts');
run('seed.ts');
console.log(JSON.stringify({ DEMO_RESEED: 'PASS' }));
