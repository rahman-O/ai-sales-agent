/**
 * Classifies Phase 01 env readiness without printing secret values.
 */
export type EnvClass =
  | 'CONFIGURED'
  | 'MISSING'
  | 'INVALID'
  | 'EXAMPLE_ONLY'
  | 'ROTATION_REQUIRED'
  | 'NOT_YET_PROVISIONED';

const EXAMPLE_MARKERS = [
  'example.supabase.co',
  'sb_publishable_example',
  'sb_publishable_ci_example',
  'p01_runtime_only',
  'p01_migrate_only',
  '127.0.0.1:5433',
  'localhost:5433',
  'local-test-hs256',
  'change_me',
  'your-project',
];

function looksExample(value: string): boolean {
  const lower = value.toLowerCase();
  return EXAMPLE_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

export function classifyValue(name: string, value: string | undefined): EnvClass {
  if (value == null || value === '') return 'MISSING';
  if (looksExample(value)) return 'EXAMPLE_ONLY';

  if (name === 'NEXT_PUBLIC_SUPABASE_URL' || name === 'SUPABASE_URL') {
    try {
      const u = new URL(value);
      if (!u.protocol.startsWith('http')) return 'INVALID';
    } catch {
      return 'INVALID';
    }
  }

  if (name === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') {
    if (value.length < 20) return 'INVALID';
  }

  if (name === 'MIGRATION_DATABASE_URL' || name === 'DATABASE_URL') {
    if (!value.startsWith('postgres')) return 'INVALID';
  }

  if (name === 'SUPABASE_TEST_EMAIL') {
    if (!value.includes('@')) return 'INVALID';
  }

  return 'CONFIGURED';
}

export interface ClassifiedEnv {
  classifications: Record<string, EnvClass>;
  hostedReady: boolean;
  blockedReasons: string[];
}

const TRACKED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'MIGRATION_DATABASE_URL',
  'DATABASE_URL',
  'SUPABASE_TEST_EMAIL',
  'SUPABASE_TEST_PASSWORD',
  'APP_RUNTIME_DB_PASSWORD',
] as const;

export function classifyEnv(env: NodeJS.ProcessEnv = process.env): ClassifiedEnv {
  const classifications: Record<string, EnvClass> = {};

  for (const name of TRACKED) {
    classifications[name] = classifyValue(name, env[name]);
  }

  if (
    (classifications.DATABASE_URL === 'MISSING' || classifications.DATABASE_URL === 'EXAMPLE_ONLY') &&
    classifications.MIGRATION_DATABASE_URL === 'CONFIGURED'
  ) {
    classifications.DATABASE_URL = 'NOT_YET_PROVISIONED';
  }

  const blockedReasons: string[] = [];
  for (const name of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'MIGRATION_DATABASE_URL',
  ] as const) {
    const c = classifications[name];
    if (c !== 'CONFIGURED') {
      blockedReasons.push(`${name}=${c}`);
    }
  }

  return {
    classifications,
    hostedReady: blockedReasons.length === 0,
    blockedReasons,
  };
}

export function humanActionRequired(classified: ClassifiedEnv): string[] {
  const lines: string[] = [];
  const guide: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL:
      'Supabase Dashboard → Project Settings → API → Project URL. Place in `.env.local`.',
    SUPABASE_URL:
      'Same Project URL as above (server). Place in `.env.local` as SUPABASE_URL.',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      'Supabase Dashboard → Project Settings → API → publishable/anon key. Place in `.env.local`.',
    MIGRATION_DATABASE_URL:
      'Supabase Dashboard → Connect → Database (owner/postgres). Use rotated password only. Place in `.env.local`. Never paste password into chat.',
    DATABASE_URL:
      'After `npm run db:provision-runtime-role`, set restricted app_runtime URL from Connect (pooler username format if required). Place in `.env.local`.',
    SUPABASE_TEST_EMAIL:
      'Create a synthetic Auth user in DEVELOPMENT project. Place email in `.env.local` only.',
    SUPABASE_TEST_PASSWORD:
      'Synthetic Auth user password in `.env.local` only. Never commit or paste into chat.',
    APP_RUNTIME_DB_PASSWORD:
      'Local-only secret for app_runtime LOGIN. Set in `.env.local` or let provision script generate into `.env.local`.',
  };

  for (const [name, c] of Object.entries(classified.classifications)) {
    if (c === 'CONFIGURED') continue;
    if (name === 'DATABASE_URL' && c === 'NOT_YET_PROVISIONED') continue;
    if (guide[name]) {
      lines.push(`${name}: ${c} — ${guide[name]}`);
    }
  }
  return lines;
}
