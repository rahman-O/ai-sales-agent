# Conversation inbox

## Purpose and interaction

Two-pane queue and timeline with current mode/owner, pause reason, messages and delivery state (`DISPATCHING` / `UNKNOWN` / `SUPPRESSED` visible). Claim or takeover before typing; resume AI is explicit (ADMIN/OWNER). SSE is refetch-only.

## Data and failure behavior

On 409 ownership conflict refetch and disable send. Show in-flight dispatch and UNKNOWN banners — do not claim recall. Human replies require `Idempotency-Key`.

## Acceptance

Two operators cannot both own a conversation; takeover suppresses stale pending AI; resume does not auto-replay paused backlog; reopening a closed thread shows paused status.

Implemented at `apps/web/src/app/inbox/page.tsx` with BFF under `/api/backend/organizations/:orgId/conversations`.
