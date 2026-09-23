import { createHash, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from './generated/client/client.ts';

/**
 * Synthetic seed only. Uses MIGRATION_DATABASE_URL (privileged).
 * Refuses production unless ALLOW_DB_SEED=true and NODE_ENV !== production.
 */
async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'reviewed') {
    throw new Error('Refusing to seed production database');
  }
  if (process.env.ALLOW_DB_SEED !== 'true') {
    throw new Error('Set ALLOW_DB_SEED=true to run synthetic seed');
  }

  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL required for seed');

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const userA = await prisma.user.upsert({
    where: { authSubject: 'synthetic-user-a' },
    update: {},
    create: { id: randomUUID(), authSubject: 'synthetic-user-a', displayName: 'Synthetic A' },
  });
  const userB = await prisma.user.upsert({
    where: { authSubject: 'synthetic-user-b' },
    update: {},
    create: { id: randomUUID(), authSubject: 'synthetic-user-b', displayName: 'Synthetic B' },
  });
  const userRevoked = await prisma.user.upsert({
    where: { authSubject: 'synthetic-user-revoked' },
    update: {},
    create: { id: randomUUID(), authSubject: 'synthetic-user-revoked', displayName: 'Synthetic Revoked' },
  });

  let orgA = await prisma.organization.findFirst({ where: { name: 'Synthetic Clinic A' } });
  if (!orgA) {
    orgA = await prisma.organization.create({
      data: { id: randomUUID(), name: 'Synthetic Clinic A' },
    });
  }
  let orgB = await prisma.organization.findFirst({ where: { name: 'Synthetic Clinic B' } });
  if (!orgB) {
    orgB = await prisma.organization.create({
      data: { id: randomUUID(), name: 'Synthetic Clinic B' },
    });
  }

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgA.id, userId: userA.id } },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: { organizationId: orgA.id, userId: userA.id, role: 'OWNER', status: 'ACTIVE' },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgA.id, userId: userB.id } },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: { organizationId: orgA.id, userId: userB.id, role: 'ADMIN', status: 'ACTIVE' },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgB.id, userId: userB.id } },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: { organizationId: orgB.id, userId: userB.id, role: 'OWNER', status: 'ACTIVE' },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgA.id, userId: userRevoked.id } },
    update: { role: 'MEMBER', status: 'REVOKED' },
    create: { organizationId: orgA.id, userId: userRevoked.id, role: 'MEMBER', status: 'REVOKED' },
  });

  console.log(
    JSON.stringify({
      seeded: true,
      orgA: orgA.id,
      orgB: orgB.id,
      users: [userA.id, userB.id, userRevoked.id],
      fingerprint: createHash('sha256').update('synthetic-p01').digest('hex').slice(0, 8),
    }),
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
