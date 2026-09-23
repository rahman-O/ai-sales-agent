# Prisma model plan

Select and pin a supported Prisma/PostgreSQL/Node combination during P00. Provider extension APIs and schema syntax differ by major release; do not copy mixed-version examples. First validate transactions, tenant-local session context, composite references, custom constraints, pgvector and migration behavior against the chosen managed database.

Likely implementation locations: `prisma/schema.prisma` or the chosen version's equivalent schema entrypoint, `prisma/migrations`, and module repositories. Start with identity/organization/membership and custom RLS migration; add entities by phase. Each migration requires a fresh-database and upgrade test.

Use composite tenant keys even if IDs are globally unique. Encapsulate parameterized raw SQL needed for RLS, exclusion/partial indexes, and vector queries in narrowly scoped repository methods. Never interpolate model/user SQL. Database features not representable by the chosen ORM still belong in versioned migrations and drift checks.

Phase allocations: P01 tenancy and audit/outbox foundations; P02 catalog/contact primitives; P03 messages/lease/ownership; P04 runs/tool/operation/usage; P05 document versions/vectors; P06 lead history; P07 proposal/booking constraints; P08 receipt/attempt details; P10 follow-up; P12 projections/revenue evidence. Earlier primitives may be introduced earlier when required for tests.

Exit proof for this plan is a P00 compatibility spike report, not a final Prisma schema. Reference: [Prisma extension support](https://www.prisma.io/docs/postgres/database/postgres-extensions).
