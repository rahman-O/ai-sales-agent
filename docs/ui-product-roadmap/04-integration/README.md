# Frontend integration

Status: **NOT_STARTED**. This section contains 7 stable implementation phases. Read the [master roadmap](../README.md) and [product principles](../00-product-ui-principles.md) before starting.

## Execution boundaries

Map contracts first; capability and permission adapters may then proceed independently. State and cache strategy follow both, then consistent failure states and preview integration. Keep server-side bearer forwarding and same-origin requests; do not move tokens into custom browser storage.

## Phases

| Phase | Scope | Prerequisites | Complexity | Risk | Status |
|---|---|---|---|---|---|
| [INT-01](INT-01-api-contract-mapping.md) | API contract mapping | DS-01 | L | HIGH | NOT_STARTED |
| [INT-02](INT-02-capability-driven-ui.md) | Capability-driven UI | INT-01 | L | HIGH | NOT_STARTED |
| [INT-03](INT-03-permissions.md) | Permission architecture | INT-01 | L | HIGH | NOT_STARTED |
| [INT-04](INT-04-state-management.md) | State management | INT-02, INT-03 | L | MEDIUM | NOT_STARTED |
| [INT-05](INT-05-query-cache-strategy.md) | Query and cache strategy | INT-04 | L | HIGH | NOT_STARTED |
| [INT-06](INT-06-error-loading-empty-states.md) | Loading, empty and error integration | INT-05, DS-05 | M | HIGH | NOT_STARTED |
| [INT-07](INT-07-preview-mode.md) | Preview integration | INT-06, DS-06, DS-07 | L | HIGH | NOT_STARTED |

## Section exit

Every phase has reviewed acceptance evidence, the prerequisite chain is satisfied, and stated contract gaps are resolved before affected functionality is enabled. Evidence identifies owner, reviewer, date, exact commands/results, locale/theme/viewport matrix and rollback limitations. Section planning completion is distinct from implementation completion.

## Frontend ownership update (2026-10-03)

The authoritative [frontend monorepo architecture](../architecture/frontend-monorepo-architecture.md) assigns visual primitives/tokens to `packages/design-system`, Business Client to `apps/web/src/client`, Platform Admin to `apps/web/src/admin`, shared web infrastructure to `apps/web/src/shared`, and app composition to `apps/web/src/providers`. Route entrypoints stay in `apps/web/src/app`. Historical observations above retain their original context; current paths are recorded in the ownership inventory. DS-01 and ROLL-01 remain COMPLETE. At reorganization DS-02 was reset to NOT_STARTED for package-based revalidation; the master roadmap records subsequent completion. No new token/theme implementation occurred during reorganization.
