# Conversation API

Proposed routes; none are implemented. Shared transport/error/version rules: [API principles](api-principles.md).

## Authority and base

Base: `/v1/organizations/{organizationId}/conversations`. OPERATOR/ADMIN/OWNER operational access; ANALYST denied transcripts.

## Contracts

GET /?mode=&cursor= lists inbox; GET /{id}/messages?cursor= retrieves ordered timeline; POST /{id}/messages {text,expectedEpoch} creates a human outbound intent only for an authorized owner/claim; POST /{id}/claim, /pause, /resume and /close use expectedVersion and reason; GET /events emits scoped refetch notifications. GET /{id}/runs returns redacted evidence for permitted operators.

## Invariants, failure and verification

Claim is compare-and-swap; competing claim returns 409. Pause/resume increments epoch and suppresses stale intents. A human message cannot bypass channel policy. Test in-flight model and dispatch races; expose DISPATCHING/UNKNOWN exceptions rather than claiming recall.
