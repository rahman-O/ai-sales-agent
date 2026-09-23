# Planning package validation

Date: 2026-09-23. This validates documentation, not an implemented system.

## Repository evidence

Initial workspace listing, including hidden files, was empty. Git reported no repository. No existing architecture, package scripts or application tests were available. Only planning documentation and its standard-library validation helper were created.

## Reproducible structural checks

Run `python docs/ai-sales-agent/_checks/validate_docs.py` from the workspace root. The helper checks every requested baseline document, local link targets, the 19 ordered sections in each phase, six distinct task IDs per phase, unchecked acceptance criteria, NOT STARTED phase status, required mind-map branches and balanced fenced blocks.

The package includes 15 phases and 90 uniquely identified tasks. Phase 00 may be IN REVIEW — BLOCKED while implementation phases remain NOT STARTED; the validator rejects an unsubstantiated CLOSED/completed claim. A final run must pass with no missing baseline files or broken local links. File/link totals are emitted by the helper rather than duplicated as a manually maintained assertion here.

## Consistency review

- Existing versus proposed paths and architecture are distinguished; there is no application migration.
- Security, ownership, audit and deterministic tests start before agent/provider activation.
- PostgreSQL accepted-order sequencing and fencing supply correctness; BullMQ is not assumed to provide per-conversation exactly-once execution.
- Provider acceptance uncertainty and already-dispatching takeover exceptions are explicit.
- Create/cancel/reschedule confirmations have server-recorded action-specific evidence; no model boolean can authorize booking.
- Human resume records which inputs were handled, preventing automatic replay of all human-era messages.
- Entity ownership, constraints, timestamps, lifecycle and audit requirements are specified, including the global User exception.
- MVP requires operational UI and human takeover; follow-ups and broader analytics are pilot additions.
- P08/P09 development and live-acceptance dependencies are separated to avoid a circular roadmap dependency.
- Revenue is distinct from booked value and attendance; projection replay and usage uncertainty are explicit.
- ADR status does not imply implementation approval; all phases remain unstarted.

## Limits and next validation

Mermaid source fences and required branches are checked; diagrams have not been rendered by a Mermaid engine in this environment. API schemas, database constraints, model evaluations, provider payloads, performance targets and recovery objectives are plans requiring implementation or discovery evidence. No application test result, benchmark, deployment or compliance approval is claimed.

External primary sources and the failed direct Meta documentation retrieval are documented in the [source register](00-overview/sources.md). Reverify version-specific behavior in P00. The next step is review and discovery, not automatic P01 implementation.
