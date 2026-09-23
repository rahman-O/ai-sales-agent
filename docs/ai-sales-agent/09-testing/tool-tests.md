# Tool tests

## Scope

Every registry entry and domain command boundary.

## Required cases

Generate valid and invalid payloads from each tool schema; reject extra properties, foreign IDs, excessive ranges, stale versions, unsupported fields and missing confirmation. Verify allowed actor/capability combinations and normalized result codes.

## Evidence and failure checks

Call each mutation twice with same operation key; assert one committed action. Reuse key with changed arguments and expect conflict. Crash after commit and recover result. Provider fallback must reuse the command outcome. Inspect logs to ensure argument redaction.

Attach reproducible reports to the owning phase closure. Shared gates: [testing strategy](testing-strategy.md).
