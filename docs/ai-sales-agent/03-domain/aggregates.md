# Aggregates and transaction boundaries

Organization governs membership and settings; ownership transfer locks memberships and guarantees at least one active owner. Customer owns channel identities and consent. Conversation owns mode, ownership epoch, sequence allocation, processing cursor and summary pointer; messages remain separate append-oriented rows to avoid loading the entire history.

Lead owns qualification facts/stage history and version. Booking owns resource allocation, price snapshot and status history. KnowledgeDocument owns immutable published versions and their chunks. AgentConfig owns validated immutable configuration versions with one active pointer.

Commands use short transactions with expected versions. Booking creation may atomically write a booking, link a lead, persist operation result, audit and event. Conversation-related tool commands first lock/check the conversation fence and epoch, then the business resource; use this consistent lock order to reduce deadlocks. No network call occurs inside the transaction.

Cross-aggregate asynchronous changes use outbox events with idempotent consumers. An analytics outage cannot roll back booking success. An audit insert failure does roll back a sensitive command. Mutating tools call these commands, not repositories directly. See [tool registry](../04-agent/tool-registry.md).
