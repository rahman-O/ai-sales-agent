# Platform Admin Dashboard

Status: **NOT_STARTED**. This section contains 10 stable implementation phases. Read the [master roadmap](../README.md) and [product principles](../00-product-ui-principles.md) before starting.

## Execution boundaries

All phases start NOT_STARTED, with explicit unresolved platform authorization/API gates. Organization ADMIN is not operator access. Client waves may ship independently, but global roadmap completion includes all operator contracts and pages. No direct browser SQL/Redis access or synthetic health/billing truth.

## Phases

| Phase | Scope | Prerequisites | Complexity | Risk | Status |
|---|---|---|---|---|---|
| [ADMIN-01](ADMIN-01-shell.md) | Platform admin shell | DS-10, INT-03, INT-06 | L | HIGH | NOT_STARTED |
| [ADMIN-02](ADMIN-02-organizations.md) | Organizations | ADMIN-01 | L | HIGH | NOT_STARTED |
| [ADMIN-03](ADMIN-03-users-access.md) | Users and platform access | ADMIN-02 | L | HIGH | NOT_STARTED |
| [ADMIN-04](ADMIN-04-plans-subscriptions.md) | Plans and subscriptions | ADMIN-02, ADMIN-03 | XL | HIGH | NOT_STARTED |
| [ADMIN-05](ADMIN-05-ai-usage.md) | AI usage | ADMIN-02 | L | HIGH | NOT_STARTED |
| [ADMIN-06](ADMIN-06-provider-health-queues.md) | Provider health and queues | ADMIN-05 | L | HIGH | NOT_STARTED |
| [ADMIN-07](ADMIN-07-errors-audit.md) | Errors and audit logs | ADMIN-06 | L | HIGH | NOT_STARTED |
| [ADMIN-08](ADMIN-08-feature-flags.md) | Platform feature flag tools | ADMIN-03, ADMIN-07 | L | HIGH | NOT_STARTED |
| [ADMIN-09](ADMIN-09-support-tools.md) | Support tooling | ADMIN-03, ADMIN-07 | XL | HIGH | NOT_STARTED |
| [ADMIN-10](ADMIN-10-platform-settings.md) | Platform settings | ADMIN-03, ADMIN-07 | L | HIGH | NOT_STARTED |

## Section exit

Every phase has reviewed acceptance evidence, the prerequisite chain is satisfied, and stated contract gaps are resolved before affected functionality is enabled. Evidence identifies owner, reviewer, date, exact commands/results, locale/theme/viewport matrix and rollback limitations. Section planning completion is distinct from implementation completion.

## Frontend ownership update (2026-10-03)

The authoritative [frontend monorepo architecture](../architecture/frontend-monorepo-architecture.md) assigns visual primitives/tokens to `packages/design-system`, Business Client to `apps/web/src/client`, Platform Admin to `apps/web/src/admin`, shared web infrastructure to `apps/web/src/shared`, and app composition to `apps/web/src/providers`. Route entrypoints stay in `apps/web/src/app`. Historical observations above retain their original context; current paths are recorded in the ownership inventory. DS-01 and ROLL-01 remain COMPLETE. At reorganization DS-02 was reset to NOT_STARTED for package-based revalidation; the master roadmap records subsequent completion. No new token/theme implementation occurred during reorganization.
