import pg from 'pg';
import { matchServices } from '../../packages/agent-adapters/src/service-search.ts';
import { DEMO_ORG_ID } from '../demo/constants.ts';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:demo-local-postgres-pass@127.0.0.1:5433/ai_sales_agent',
  });

  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, name, duration_minutes, amount_minor, currency, booking_enabled
       FROM services
       WHERE organization_id = $1 AND active = true AND archived_at IS NULL`,
      [DEMO_ORG_ID]
    );

    console.log(`Database returned ${r.rows.length} services for org ${DEMO_ORG_ID}`);

    const queries = [
      { q: 'فحص أسنان', expected: 'Dental Check-up (Demo Synthetic)' },
      { q: 'تنظيف أسنان', expected: 'Teeth Cleaning (Demo Synthetic)' },
      { q: 'استشارة', expected: 'Dental Consultation (Demo Synthetic)' },
      { q: 'check up', expected: 'Dental Check-up (Demo Synthetic)' },
      { q: 'cleaning', expected: 'Teeth Cleaning (Demo Synthetic)' },
      { q: 'consultation', expected: 'Dental Consultation (Demo Synthetic)' },
      { q: 'unknown-query-xyz', expected: null },
    ];

    let passed = true;
    for (const item of queries) {
      const matched = matchServices(r.rows, item.q);
      const top = matched[0]?.name ?? null;
      const ok = top === item.expected;
      console.log(`"${item.q}" -> "${top}" [expected: "${item.expected}"] => ${ok ? 'PASS' : 'FAIL'}`);
      if (!ok) passed = false;
    }

    if (!passed) process.exit(1);
    console.log('REAL TOOL BILINGUAL SEARCH VALIDATION: PASS');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
