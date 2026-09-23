# Backend architecture

NestJS modules own application services and repositories. Controllers validate transport DTOs, resolve actor and organization context, invoke commands, and normalize errors. Domain services own invariants; repositories never accept an unscoped tenant-owned query. The worker invokes the same application services as HTTP and tools.

Modules: auth, users, organizations, customers, conversations, messaging, agent, knowledge, services, leads, bookings, followups, analytics, integrations, audit and usage. Staff and availability initially live in bookings; avoid a new service for each noun. Integrations holds credentials and adapter wiring, not business logic.

Dependency rules: agent depends on exported application commands through its registry; business modules never depend on model SDKs. Messaging normalizes channel events and consumes outbound intents. Analytics consumes versioned events, not mutable live tables as its only historical evidence. Audit writes participate in sensitive command transactions.

For a command: authenticate → scoped transaction → validate state/version → mutate → persist operation result, audit and outbox → commit. External calls run outside transactions. One command may coordinate lead and booking updates in the same database transaction. No distributed transaction framework is needed.

Prove boundaries with import rules and integration tests. A module cannot write another module's tables directly except through an explicit application transaction coordinator. [Aggregates](../03-domain/aggregates.md) defines command boundaries.
