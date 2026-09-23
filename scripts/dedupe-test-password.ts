/**
 * Deduplicate SUPABASE_TEST_PASSWORD in .env.local (keep last non-empty).
 * Never prints secret values.
 */
import fs from 'node:fs';

const path = '.env.local';
const text = fs.readFileSync(path, 'utf8');
const lines = text.split(/\r?\n/);
const passwordValues: string[] = [];
const kept: string[] = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    kept.push(line);
    continue;
  }
  const eq = trimmed.indexOf('=');
  if (eq < 0) {
    kept.push(line);
    continue;
  }
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (key === 'SUPABASE_TEST_PASSWORD') {
    if (value) passwordValues.push(value);
    continue; // drop all; re-append once
  }
  kept.push(line);
}

if (passwordValues.length === 0) {
  console.log(JSON.stringify({ ok: false, reason: 'no_password_values' }));
  process.exit(1);
}

const chosen = passwordValues[passwordValues.length - 1]!;
const outLines = [...kept.filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))];
// Ensure trailing structure
while (outLines.length && outLines[outLines.length - 1] === '') outLines.pop();
outLines.push(`SUPABASE_TEST_PASSWORD=${chosen}`);
outLines.push('');
fs.writeFileSync(path, outLines.join('\n'), { mode: 0o600 });

console.log(
  JSON.stringify({
    ok: true,
    duplicatesFound: passwordValues.length,
    keptLastNonEmpty: true,
    passwordLen: chosen.length,
    // fingerprint only — not reversible to secret
    passwordLenChangedFromPriorProbe: chosen.length !== 16 ? true : 'same_length_16',
  }),
);
