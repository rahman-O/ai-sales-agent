import { loadLocalEnv } from './load-local-env.ts';

loadLocalEnv();
const e = process.env.SUPABASE_TEST_EMAIL ?? '';
const p = process.env.SUPABASE_TEST_PASSWORD ?? '';
console.log(
  JSON.stringify({
    emailExact: e === 'phase01-test@example.com',
    emailLen: e.length,
    emailHasWhitespace: /\s/.test(e),
    passwordHasWhitespace: /\s/.test(p),
    passwordStartsWithQuote: p.startsWith('"') || p.startsWith("'"),
    passwordEndsWithQuote: p.endsWith('"') || p.endsWith("'"),
  }),
);
