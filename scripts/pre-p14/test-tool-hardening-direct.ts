import pg from 'pg';
import { toolGetAvailableSlots } from '../../packages/agent-adapters/src/booking-tools.ts';
import { matchServices } from '../../packages/agent-adapters/src/service-search.ts';
import { DEMO_ORG_ID, DEMO_CUSTOMER_ID } from '../demo/constants.ts';

async function main() {
  const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:demo-local-postgres-pass@127.0.0.1:5433/ai_sales_agent',
  });
  const client = await pool.connect();
  try {
    console.log('--- TEST 1: SEARCH SERVICES ARABIC ---');
    const r = await client.query(
      `SELECT id, name, duration_minutes, amount_minor, currency, booking_enabled
       FROM services
       WHERE organization_id = $1 AND active = true AND archived_at IS NULL`,
      [DEMO_ORG_ID],
    );
    const matched = matchServices(r.rows, 'فحص أسنان');
    console.log('Search matches:', matched.map((m) => ({ id: m.id, name: m.name })));
    const validServiceId = matched[0]?.id;
    if (!validServiceId) throw new Error('Search failed to find service');
    console.log('Exact catalog UUID:', validServiceId);

    console.log('\n--- TEST 2: INVALID SERVICE ID (checkup) ---');
    const invalidRes = await toolGetAvailableSlots(client, DEMO_ORG_ID, DEMO_CUSTOMER_ID, {
      serviceId: 'checkup',
      startDate: '2026-09-27',
    });
    console.log('Invalid serviceId Result:', JSON.stringify(invalidRes));
    if (invalidRes.ok !== false || invalidRes.code !== 'TOOL_INVALID_ARGS') {
      throw new Error(`Expected TOOL_INVALID_ARGS, got ${JSON.stringify(invalidRes)}`);
    }

    console.log('\n--- TEST 3: VALID SERVICE ID (UUID) ---');
    const validRes = await toolGetAvailableSlots(client, DEMO_ORG_ID, DEMO_CUSTOMER_ID, {
      serviceId: validServiceId,
      startDate: '2026-09-27',
    });
    console.log('Valid serviceId Result ok:', validRes.ok, 'Code:', (validRes as any).code, 'Slots:', (validRes as any).data?.slots?.length ?? 0);
    if (!validRes.ok) {
      throw new Error(`Expected ok: true, got ${JSON.stringify(validRes)}`);
    }

    console.log('\nALL DIRECT TOOL HARDENING CHECKS: PASS');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
