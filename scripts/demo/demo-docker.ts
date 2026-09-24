/**
 * Cross-platform demo Docker helpers: port checks + compose wrappers.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COMPOSE_FILE = path.join(ROOT, 'docker-compose.demo.yml');
const ENV_FILE = path.join(ROOT, '.env.demo.local');

const DEMO_PORTS = [
  { port: 3000, name: 'WEB' },
  { port: 3001, name: 'API' },
  { port: 5433, name: 'POSTGRES' },
  { port: 6380, name: 'REDIS' },
] as const;

function run(cmd: string, args: string[], opts: { allowFail?: boolean } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
    // Avoid shell:true — Windows breaks on paths with spaces (e.g. Program Files\nodejs).
    shell: false,
  });
  if (!opts.allowFail && (r.status ?? 1) !== 0) process.exit(r.status ?? 1);
  return r.status ?? 1;
}

function runNodeTs(scriptRel: string, extraArgs: string[] = []) {
  return run(process.execPath, ['--import', 'tsx', path.join(ROOT, scriptRel), ...extraArgs]);
}

function ensureEnv() {
  runNodeTs('scripts/demo/ensure-demo-env.ts');
  if (!fs.existsSync(ENV_FILE)) {
    console.error('Missing .env.demo.local — copy .env.demo.example and fill values');
    process.exit(1);
  }
}

function composeArgs(extra: string[]): string[] {
  return ['compose', '-f', COMPOSE_FILE, '--env-file', ENV_FILE, ...extra];
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, '127.0.0.1');
  });
}

async function checkPortsForUp() {
  // If our demo web container already owns 3000, compose up is fine.
  const ps = spawnSync(
    'docker',
    composeArgs(['ps', '-q', 'web']),
    { cwd: ROOT, encoding: 'utf8', shell: false },
  );
  const webRunning = (ps.stdout || '').trim().length > 0;

  for (const { port, name } of DEMO_PORTS) {
    const free = await portFree(port);
    if (free) continue;
    if (port === 3000 && webRunning) {
      console.log(JSON.stringify({ PORT_3000: 'IN_USE_BY_DEMO_WEB', action: 'reuse' }));
      continue;
    }
    // Check if demo compose already has the service
    const which =
      name === 'WEB'
        ? 'web'
        : name === 'API'
          ? 'api'
          : name === 'POSTGRES'
            ? 'postgres'
            : 'redis';
    const id = spawnSync('docker', composeArgs(['ps', '-q', which]), {
      cwd: ROOT,
      encoding: 'utf8',
      shell: false,
    });
    if ((id.stdout || '').trim()) {
      console.log(JSON.stringify({ [`PORT_${port}`]: 'IN_USE_BY_DEMO', service: which }));
      continue;
    }
    console.error(
      JSON.stringify({
        error: `PORT_${port}_IN_USE`,
        service: name,
        hint:
          process.platform === 'win32'
            ? `netstat -ano | findstr :${port}`
            : `lsof -i :${port} || ss -ltnp | grep :${port}`,
      }),
    );
    process.exit(1);
  }
}

async function waitHttp(url: string, attempts = 60, delayMs = 2000) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

const cmd = process.argv[2] ?? 'help';

async function main() {
  switch (cmd) {
    case 'build':
      ensureEnv();
      run('docker', composeArgs(['build']));
      break;
    case 'up':
      ensureEnv();
      await checkPortsForUp();
      run('docker', composeArgs(['up', '-d', '--build']));
      console.log(JSON.stringify({ DEMO_UP: 'STARTED', UI: 'http://localhost:3000' }));
      break;
    case 'down':
      ensureEnv();
      run('docker', composeArgs(['down']));
      console.log(JSON.stringify({ DEMO_DOWN: 'PASS' }));
      break;
    case 'stop':
      ensureEnv();
      run('docker', composeArgs(['down']));
      break;
    case 'logs':
      ensureEnv();
      run('docker', composeArgs(['logs', '-f', ...(process.argv.slice(3) || [])]));
      break;
    case 'ps':
      ensureEnv();
      run('docker', composeArgs(['ps']));
      break;
    case 'wipe':
      ensureEnv();
      if (process.env.ALLOW_DEMO_RESET !== 'true') {
        console.error('ALLOW_DEMO_RESET=true required for demo:docker:wipe');
        process.exit(1);
      }
      run('docker', composeArgs(['down', '-v']));
      console.log(JSON.stringify({ DEMO_DOCKER_WIPE: 'PASS' }));
      break;
    case 'start': {
      ensureEnv();
      await checkPortsForUp();
      run('docker', composeArgs(['up', '-d', '--build']));
      const apiOk = await waitHttp('http://127.0.0.1:3001/health/live');
      const webOk = await waitHttp('http://127.0.0.1:3000');
      if (!apiOk) {
        console.error(JSON.stringify({ error: 'API_NOT_READY' }));
        process.exit(1);
      }
      // Host seed against localhost:5433
      process.env.DEMO_DB_TARGET = 'LOCAL';
      process.env.DEMO_FORCE_LOCAL_DB = '1';
      // Align host env for seed with compose published ports
      const envLocal = fs.readFileSync(ENV_FILE, 'utf8');
      for (const line of envLocal.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq < 0) continue;
        const k = t.slice(0, eq).trim();
        const v = t.slice(eq + 1).trim();
        if (k === 'APP_RUNTIME_DB_PASSWORD' || k === 'BOOKING_SLOT_TOKEN_SECRET') {
          process.env[k] = v;
        }
      }
      process.env.DATABASE_URL = `postgresql://app_runtime:${process.env.APP_RUNTIME_DB_PASSWORD}@127.0.0.1:5433/ai_sales_agent`;
      process.env.MIGRATION_DATABASE_URL = (() => {
        const m = /POSTGRES_PASSWORD=(.+)/.exec(envLocal);
        const pw = m?.[1]?.trim() || 'postgres';
        return `postgresql://postgres:${pw}@127.0.0.1:5433/ai_sales_agent`;
      })();
      const status = spawnSync(
        process.execPath,
        ['--import', 'tsx', path.join(ROOT, 'scripts/demo/status.ts')],
        { cwd: ROOT, env: process.env, encoding: 'utf8', shell: false },
      );
      const statusOut = status.stdout || '';
      const missing = statusOut.includes('"ORGANIZATION": "MISSING"');
      if (missing) {
        runNodeTs('scripts/demo/seed.ts');
      } else {
        console.log(JSON.stringify({ DEMO_DATASET: 'REUSED' }));
      }
      console.log(
        JSON.stringify({
          DEMO_START: apiOk && webOk ? 'PASS' : 'PARTIAL',
          API: apiOk ? 'PASS' : 'FAIL',
          WEB: webOk ? 'PASS' : 'FAIL',
          UI: 'http://localhost:3000',
        }),
      );
      break;
    }
    default:
      console.log(
        'Usage: demo-docker.ts <build|up|down|stop|logs|ps|wipe|start>',
      );
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
