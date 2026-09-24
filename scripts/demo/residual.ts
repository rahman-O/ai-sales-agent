import type { Pool } from 'pg';
import { DEMO_ORG_ID, DEMO_TENANT_TABLES_DELETE_ORDER } from './constants.ts';

export async function countDemoTenantRows(pool: Pool, orgId = DEMO_ORG_ID): Promise<number> {
  let total = 0;
  for (const table of DEMO_TENANT_TABLES_DELETE_ORDER) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS c FROM ${table} WHERE organization_id = $1::uuid`, [
        orgId,
      ]);
      total += Number(r.rows[0]?.c ?? 0);
    } catch {
      // table may not exist in older schemas — ignore
    }
  }
  const org = await pool.query(`SELECT count(*)::int AS c FROM organizations WHERE id = $1::uuid`, [orgId]);
  total += Number(org.rows[0]?.c ?? 0);
  return total;
}

export async function deleteDemoTenant(pool: Pool, orgId = DEMO_ORG_ID): Promise<void> {
  for (const table of DEMO_TENANT_TABLES_DELETE_ORDER) {
    try {
      await pool.query(`DELETE FROM ${table} WHERE organization_id = $1::uuid`, [orgId]);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('does not exist')) continue;
      throw e;
    }
  }
  await pool.query(`DELETE FROM organizations WHERE id = $1::uuid`, [orgId]);
}

export async function assertOrgIdentity(
  pool: Pool,
  orgId: string,
  expectedName: string,
): Promise<'absent' | 'match' | 'collision'> {
  const r = await pool.query(`SELECT name FROM organizations WHERE id = $1::uuid`, [orgId]);
  if (!r.rows.length) return 'absent';
  if (r.rows[0].name === expectedName) return 'match';
  return 'collision';
}
