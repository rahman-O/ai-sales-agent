# Knowledge base

## Purpose and interaction

Upload and version list with scanning/parsing/embedding/review/publication states. Show extracted preview, source, reviewer and current publication version.

## Data and failure behavior

Failed jobs expose safe retry actions; repeated upload/finalize does not publish duplicates. Unpublish takes effect before blob cleanup completes. Warn when document text conflicts with structured prices.

## Acceptance

Only approved complete versions enter retrieval; operator can identify why a document is unavailable; tenant switching clears previews and signed links.

Shared accessibility, cache and role rules: [information architecture](information-architecture.md). Proposed implementation belongs in `apps/web` feature routes; no UI is implemented in this package.
