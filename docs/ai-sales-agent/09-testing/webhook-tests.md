# Webhook tests

## Scope

Provider ingress and outbound receipt semantics.

## Required cases

Fixture valid/invalid raw signatures, challenge mismatch, malformed JSON, oversize requests, mixed message/status batches, duplicate message IDs, unknown connection, receipts before acceptance and out-of-order timestamps.

## Evidence and failure checks

Kill process after persistence before acknowledgement and after outbox publication before marking published. Retry must create one canonical message. Return 503 when persistence fails. Verify late receipts cannot regress delivered/read status or duplicate business effects; UNKNOWN outbound attempts are not blindly resent.

Attach reproducible reports to the owning phase closure. Shared gates: [testing strategy](testing-strategy.md).
