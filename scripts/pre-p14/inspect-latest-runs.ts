import { Pool } from 'pg';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';

async function main() {
  loadDemoCliEnv();
  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });

  const runsRes = await pool.query(`
    SELECT id, conversation_id, status, terminal_reason, model_calls, tool_calls, started_at
    FROM agent_runs
    ORDER BY started_at DESC
    LIMIT 10;
  `);

  console.log(`Found ${runsRes.rows.length} recent runs:`);
  for (const r of runsRes.rows) {
    console.log(`\nRUN: ${r.id} | Conv: ${r.conversation_id} | Status: ${r.status} | Reason: ${r.terminal_reason} | Models: ${r.model_calls} | Tools: ${r.tool_calls} | Started: ${r.started_at}`);
    const toolsRes = await pool.query(`
      SELECT ordinal, tool_name, result_code, duration_ms
      FROM tool_calls
      WHERE agent_run_id = $1
      ORDER BY ordinal ASC;
    `, [r.id]);
    for (const t of toolsRes.rows) {
      console.log(`  - [${t.ordinal}] ${t.tool_name}: code=${t.result_code} duration=${t.duration_ms}ms`);
    }
  }

  const wsRes = await pool.query(`SELECT * FROM conversation_working_state;`);
  console.log(`\nWorking States (${wsRes.rows.length}):`);
  for (const ws of wsRes.rows) {
    console.log(`- Conv: ${ws.conversation_id} | Version: ${ws.version} | Lead: ${ws.lead_id} | Cust: ${ws.customer_id}`);
    console.log(`  StateJSON: ${JSON.stringify(ws.state_json, null, 2)}`);
  }

  await pool.end();
}

main().catch(console.error);
