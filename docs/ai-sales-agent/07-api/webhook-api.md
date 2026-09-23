# Webhook API

Proposed routes; none are implemented. Shared transport/error/version rules: [API principles](api-principles.md).

## Authority and base

Base: `/v1/webhooks/whatsapp`. Public transport route authenticated by provider signature, not staff session.

## Contracts

GET / handles subscription challenge with exact verification-token match. POST / accepts bounded raw bytes, verifies signature, maps provider account/phone IDs, and persists canonical events plus outbox. Response is success only after durable acceptance or durable quarantine. Delivery status callbacks use the same verified ingestion path.

## Invariants, failure and verification

Missing/invalid signatures return 401/403; oversize 413; malformed payload 400; DB failure 503. Signed supported duplicates return success after dedup. No LLM work in request path. Test mixed batches, partial retries, unknown channel mapping, status-before-message and late event timestamps.
