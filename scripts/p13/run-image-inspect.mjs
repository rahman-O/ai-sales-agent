import { spawnSync } from 'node:child_process';

function sh(args) {
  const r = spawnSync('docker', args, { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) process.exit(r.status ?? 1);
  return r.stdout;
}

const script = `
const fs = require('fs');
const bad = ['prisma','mysql2','deepmerge-ts'].filter((d) => fs.existsSync('node_modules/' + d));
console.log(JSON.stringify({ topLevelForbidden: bad }));
if (bad.length) process.exit(2);
const { spawnSync } = require('child_process');
const ls = spawnSync('npm', ['ls', 'prisma', 'mysql2', 'deepmerge-ts', '--all'], { encoding: 'utf8' });
console.log((ls.stdout || ls.stderr || '').split('\\n').slice(0, 25).join('\\n'));
console.log('ARTIFACT', fs.existsSync('apps/api/dist/main.js') || fs.existsSync('apps/worker/dist/main.js'));
console.log('PRISMA_CLIENT', fs.existsSync('prisma/generated/client/client.ts'));
`;

for (const tag of ['asa-api:p13-canonical', 'asa-worker:p13-canonical']) {
  console.log('---', tag);
  sh(['run', '--rm', '--entrypoint', 'node', tag, '-e', script]);
}

const labels = sh([
  'inspect',
  'asa-api:p13-canonical',
  '--format',
  '{{json .Config.Labels}}',
]);
console.log('API_LABELS', labels.trim());
