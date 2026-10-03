# Rollout

Status: **ROLL-01 COMPLETE; ROLL-02 through ROLL-04 NOT_STARTED**. This section contains 4 stable implementation phases. Read the [master roadmap](../README.md) and [product principles](../00-product-ui-principles.md) before starting.

## Execution boundaries

Migration planning runs early after audits. Rollout flags are exposure controls, not grants or capabilities. First product implementation milestone remains Test Assistant; staged release evidence can approve a client cohort without claiming admin/global completion. Real Meta is outside this roadmap.

## Phases

| Phase | Scope | Prerequisites | Complexity | Risk | Status |
|---|---|---|---|---|---|
| [ROLL-01](ROLL-01-migration-from-current-ui.md) | Migration from current UI | DS-01 | M | MEDIUM | COMPLETE |
| [ROLL-02](ROLL-02-feature-flags.md) | Rollout feature flags | ROLL-01, INT-02, INT-03 | M | HIGH | NOT_STARTED |
| [ROLL-03](ROLL-03-incremental-delivery.md) | Incremental delivery | UX-03, QA-06, QA-07, ROLL-02 | L | HIGH | NOT_STARTED |
| [ROLL-04](ROLL-04-definition-of-done.md) | Definition of done | QA-08 | M | HIGH | NOT_STARTED |

## Section exit

Every phase has reviewed acceptance evidence, the prerequisite chain is satisfied, and stated contract gaps are resolved before affected functionality is enabled. Evidence identifies owner, reviewer, date, exact commands/results, locale/theme/viewport matrix and rollback limitations. Section planning completion is distinct from implementation completion.

## Frontend ownership update (2026-10-03)

The authoritative [frontend monorepo architecture](../architecture/frontend-monorepo-architecture.md) assigns visual primitives/tokens to `packages/design-system`, Business Client to `apps/web/src/client`, Platform Admin to `apps/web/src/admin`, shared web infrastructure to `apps/web/src/shared`, and app composition to `apps/web/src/providers`. Route entrypoints stay in `apps/web/src/app`. Historical observations above retain their original context; current paths are recorded in the ownership inventory. DS-01 and ROLL-01 remain COMPLETE. At reorganization DS-02 was reset to NOT_STARTED for package-based revalidation; the master roadmap records subsequent completion. No new token/theme implementation occurred during reorganization.
