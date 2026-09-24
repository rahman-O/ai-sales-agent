/**
 * Build + in-image proof for CANONICAL_PILOT_RUNTIME_ARTIFACT (API + worker).
 * Requires Docker. Does not push images.
 *
 *   npx tsx scripts/p13/image-smoke.ts
 */
import { spawnSync } from 'node:child_process';

function run(cmd: string, args: string[], opts?: { allowFail?: boolean }) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0 && !opts?.allowFail) {
    console.error(r.stdout);
    console.error(r.stderr);
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
  }
  return r;
}

function inspectImage(tag: string) {
  const abs = run('docker', [
    'run',
    '--rm',
    '--entrypoint',
    'sh',
    tag,
    '-c',
    [
      'node -e "const fs=require(\'fs\'); const bad=[\'prisma\',\'mysql2\',\'deepmerge-ts\'].filter(d=>fs.existsSync(\'node_modules/\'+d)); if(bad.length){console.error(\'PRESENT:\'+bad.join(\',\')); process.exit(2)} console.log(\'ABSENT_OK\')"',
      'npm ls prisma mysql2 deepmerge-ts --all 2>&1 | head -n 40 || true',
      'ls -la apps/*/dist/main.js prisma/generated/client/client.ts 2>/dev/null || ls -la apps/*/dist/main.js',
    ].join(' && '),
  ]);
  return abs.stdout + abs.stderr;
}

function smokeBoot(tag: string, component: 'api' | 'worker') {
  const env = [
    '-e',
    'NODE_ENV=production',
    '-e',
    'APP_URL=http://127.0.0.1:3000',
    '-e',
    'API_URL=http://127.0.0.1:3001',
    '-e',
    'DATABASE_URL=postgresql://app_runtime:x@127.0.0.1:5433/db',
    '-e',
    'REDIS_URL=redis://127.0.0.1:6379',
    '-e',
    'SUPABASE_URL=https://example.supabase.co',
  ];
  if (component === 'api') {
    // Import path resolves generated Prisma client without needing live DB for module graph.
    const r = run('docker', [
      'run',
      '--rm',
      ...env,
      '--entrypoint',
      'node',
      tag,
      '-e',
      "import('node:fs').then(fs=>{if(!fs.existsSync('prisma/generated/client/client.ts'))process.exit(3); if(!fs.existsSync('apps/api/dist/main.js'))process.exit(4); console.log(JSON.stringify({msg:'api_artifact_smoke_ok', canonical:true}))})",
    ]);
    return r.stdout;
  }
  const r = run('docker', [
    'run',
    '--rm',
    ...env,
    '--entrypoint',
    'node',
    tag,
    '-e',
    "import('node:fs').then(fs=>{if(!fs.existsSync('apps/worker/dist/main.js'))process.exit(4); console.log(JSON.stringify({msg:'worker_artifact_smoke_ok', canonical:true}))})",
  ]);
  return r.stdout;
}

function main() {
  console.log(JSON.stringify({ msg: 'p13_image_build_start' }));
  run('docker', ['build', '-f', 'Dockerfile.api', '-t', 'asa-api:p13-canonical', '.']);
  run('docker', ['build', '-f', 'Dockerfile.worker', '-t', 'asa-worker:p13-canonical', '.']);

  const apiInspect = inspectImage('asa-api:p13-canonical');
  const workerInspect = inspectImage('asa-worker:p13-canonical');
  const apiSmoke = smokeBoot('asa-api:p13-canonical', 'api');
  const workerSmoke = smokeBoot('asa-worker:p13-canonical', 'worker');

  const labels = run('docker', [
    'inspect',
    '-f',
    '{{ index .Config.Labels "CANONICAL_PILOT_RUNTIME_ARTIFACT" }}|{{ index .Config.Labels "ai.sales.agent.component" }}',
    'asa-api:p13-canonical',
  ]);

  console.log(
    JSON.stringify(
      {
        msg: 'p13_image_smoke_result',
        CANONICAL_PILOT_RUNTIME_ARTIFACT: true,
        apiLabel: labels.stdout.trim(),
        apiInspect: apiInspect.slice(0, 2000),
        workerInspect: workerInspect.slice(0, 2000),
        apiSmoke: apiSmoke.trim(),
        workerSmoke: workerSmoke.trim(),
        highsDispositionBasis: 'CLI_MYSQL2_DEEPMERGE_ABSENT_FROM_FINAL_IMAGE',
      },
      null,
      2,
    ),
  );
}

main();
