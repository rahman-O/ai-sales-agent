# Conversation inbox

## Purpose and interaction

Two-pane queue and timeline with current mode/owner, customer/lead facts, messages and delivery state. Claim before typing; preserve unsent draft locally within current tenant session. Pause/resume shows consequences and requires current version.

## Data and failure behavior

On 409 claim conflict refetch ownership and disable send. Show in-flight dispatch and UNKNOWN send banners. Display concise context/tool evidence without hidden reasoning or secrets.

## Acceptance

Two operators cannot both own a conversation; takeover suppresses stale pending AI drafts; keyboard and RTL flows work; reopening a closed thread shows paused status.

Shared accessibility, cache and role rules: [information architecture](information-architecture.md). Proposed implementation belongs in `apps/web` feature routes; no UI is implemented in this package.
