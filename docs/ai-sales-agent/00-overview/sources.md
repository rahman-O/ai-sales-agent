# External source register

Checked 2026-09-23. These sources support platform mechanics; the project-specific limits and architecture in this package are recommendations. Pin versions and repeat provider checks during P00 and before release.

- [PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html): runtime roles must not silently bypass policies. Relevant to [isolation](../06-data/tenant-isolation.md).
- [PostgreSQL range constraints](https://www.postgresql.org/docs/15/rangetypes.html): supports enforcing non-overlap in the database. Relevant to [booking](../03-domain/booking-state-machine.md).
- [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs) and [stalled jobs](https://docs.bullmq.io/guide/jobs/stalled): workers can repeat work; durable command identity is required.
- [pgvector project](https://github.com/pgvector/pgvector): extension, index, and filtering behavior. Benchmark tenant-filtered retrieval before selecting an approximate index.
- [Prisma database extensions](https://www.prisma.io/docs/postgres/database/postgres-extensions) and [Prisma extensions](https://www.prisma.io/docs/orm/extensions): support is version-dependent. P00 must select one compatible ORM release and migration strategy; do not mix version-specific APIs.
- [Prisma migration API](https://www.prisma.io/docs/orm/reference/migration-api), [transactions](https://www.prisma.io/docs/orm/fundamentals/transactions), and [connection pooling](https://www.prisma.io/docs/postgres/database/connection-pooling): current Prisma documentation exposes version-specific PostgreSQL migration/RLS/transaction behavior. The disposable spike must verify the selected pinned release and pooler rather than treating current or legacy examples as universal.
- [WhatsApp messaging policy](https://whatsappbusiness.com/policy/): service window, templates, permission and escalation requirements. See the compact policy summary in [WhatsApp](../05-integrations/whatsapp.md).
- [Meta-hosted webhook SDK reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/): documents challenge verification and signature checking. This is historical reference, not a recommendation to adopt that SDK.
- [Meta Cloud API webhook documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks): attempted direct retrieval returned an error. Current payload schemas, Graph API version, retry duration, account permissions, and signature setup remain P00 sandbox verification items; no exact retry SLA is asserted here.

The 2026-09-23 Phase 00 review rechecked the WhatsApp policy and Prisma/PostgreSQL documentation. Direct Meta developer-page retrieval remains environment-dependent; live sanitized fixtures are still required. External documentation is evidence of documented platform behavior, not evidence that this project's account, credentials, templates, region, or selected versions work.

No secondary-source blog or search snippet is a release contract. Save provider sandbox evidence with the relevant phase closure record.
