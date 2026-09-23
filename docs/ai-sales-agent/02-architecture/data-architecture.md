# Data architecture

PostgreSQL owns contacts, prices, services, leads, bookings, consent, conversation sequencing, action ledgers and event history. pgvector stores versioned embeddings only for approved unstructured knowledge. Private object storage owns document/media bytes; database metadata controls access and lifecycle.

Redis holds queue and optional short-lived caches, not booking truth or unique action results. Cache keys include tenant and configuration/document versions. Cache invalidation is emitted after a committed mutation; stale prices cannot authorize booking because the backend validates the current quote.

Use UTC timestamptz for instants and an IANA timezone for business schedules. Money uses integer minor units plus currency metadata; never floating-point arithmetic or an assumed two-decimal currency. Record service duration and price snapshots on a booking.

Derived analytics may lag and must show an as-of time. Audit and business events are distinct: auditing answers who changed what; business events support outcomes. See [database design](../06-data/database-design.md) and [metrics](../11-product-metrics/metrics-model.md).
