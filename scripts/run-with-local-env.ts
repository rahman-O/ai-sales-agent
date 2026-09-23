/**
 * Run a workspace command with loadLocalEnv() applied (no secrets printed).
 * Usage: node --import tsx scripts/run-with-local-env.ts <cmd> [args...]
 */
import { spawnSync } from 'node:child_process';
import { loadLocalEnv } from './load-local-env.ts';

loadLocalEnv();
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: run-with-local-env.ts <command> [args...]');
  process.exit(2);
}
const cmd = args[0]!;
const rest = args.slice(1);
const r = spawnSync(cmd, rest, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
