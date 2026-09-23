# Agent settings

## Purpose and interaction

Versioned language/tone, qualification policy, enabled capabilities, approved model profile and bounded budget controls. Show active version and safe rollback.

## Data and failure behavior

Sandbox test conversations use fake customers/tools and never production sends. Publish requires validation/evaluation evidence; platform safety limits cannot be edited away.

## Acceptance

Owner can disable automation immediately; unsupported models/tools are rejected; changes show audit actor and version; secrets never appear.

Shared accessibility, cache and role rules: [information architecture](information-architecture.md). Proposed implementation belongs in `apps/web` feature routes; no UI is implemented in this package.
