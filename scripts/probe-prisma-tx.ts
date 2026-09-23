import { loadLocalEnv } from './load-local-env.ts';
import { createPgPool } from './pg-pool.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

loadLocalEnv();

async function main() {
  const url = process.env.DATABASE_URL!;
  const pool = createPgPool(url, { max: 1 });
  const clientPath = pathToFileURL(
    path.resolve('prisma/generated/client/client.ts'),
  ).href;
  const generated = await import(clientPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);
  const prisma = new generated.PrismaClient({
    adapter,
    transactionOptions: { maxWait: 20_000, timeout: 20_000 },
  });
  try {
    const ping = await prisma.$queryRaw`SELECT current_user AS cu, 1 AS n`;
    console.log(JSON.stringify({ pingOk: true, cu: ping[0]?.cu }));
    const tx = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;
      const rows = await tx.$queryRaw`SELECT current_setting('app.current_user_id', true) AS v`;
      return rows[0]?.v ?? null;
    });
    console.log(JSON.stringify({ txOk: true, settingEmpty: tx === '' || tx == null }));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(String((e as Error).message).slice(0, 300));
  process.exit(1);
});
