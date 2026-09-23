# Integration tests

## Scope

Real database transactions, constraints, RLS, queues and adapters.

## Required cases

Run the actual runtime role and pooled connection path. Verify cross-tenant composite foreign keys/RLS, simultaneous staff booking conflict, outbox atomicity, operation-result recovery after crash, repeat consumer dedup, Redis rebuild and lease fencing.

## Evidence and failure checks

Use a barrier to force two booking commits to race; exactly one succeeds. Expire worker A lease, let B reclaim, then assert A cannot mutate or enqueue a response. Fresh-install and upgrade migrations must preserve custom SQL constraints and policies.

Attach reproducible reports to the owning phase closure. Shared gates: [testing strategy](testing-strategy.md).
