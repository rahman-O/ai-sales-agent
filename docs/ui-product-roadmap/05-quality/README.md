# Quality gates

Status: **NOT_STARTED**. This section contains 8 stable implementation phases. Read the [master roadmap](../README.md) and [product principles](../00-product-ui-principles.md) before starting.

## Execution boundaries

Establish foundation harnesses before DS-10. Apply them again as pages arrive; early primitive passes do not certify later features. Performance and security evidence gate rollout; final acceptance covers the entire roadmap. Do not weaken backend or agent assertions.

## Phases

| Phase | Scope | Prerequisites | Complexity | Risk | Status |
|---|---|---|---|---|---|
| [QA-01](QA-01-component-testing.md) | Component testing | DS-04 | M | MEDIUM | NOT_STARTED |
| [QA-02](QA-02-visual-regression.md) | Visual regression | DS-05, DS-07 | M | MEDIUM | NOT_STARTED |
| [QA-03](QA-03-accessibility.md) | Accessibility verification | DS-09 | M | MEDIUM | NOT_STARTED |
| [QA-04](QA-04-responsive.md) | Responsive verification | DS-08 | M | MEDIUM | NOT_STARTED |
| [QA-05](QA-05-rtl-ltr.md) | RTL and LTR verification | DS-07 | M | MEDIUM | NOT_STARTED |
| [QA-06](QA-06-performance.md) | Performance verification | UX-02, UX-03, UX-12 | L | MEDIUM | NOT_STARTED |
| [QA-07](QA-07-security-ui-boundaries.md) | UI security boundaries | INT-03, INT-07, UX-03 | L | HIGH | NOT_STARTED |
| [QA-08](QA-08-acceptance.md) | Product acceptance | ROLL-03, UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12, UX-13, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08, ADMIN-09, ADMIN-10 | XL | HIGH | NOT_STARTED |

## Section exit

Every phase has reviewed acceptance evidence, the prerequisite chain is satisfied, and stated contract gaps are resolved before affected functionality is enabled. Evidence identifies owner, reviewer, date, exact commands/results, locale/theme/viewport matrix and rollback limitations. Section planning completion is distinct from implementation completion.

## Frontend ownership update (2026-10-03)

The authoritative [frontend monorepo architecture](../architecture/frontend-monorepo-architecture.md) assigns visual primitives/tokens to `packages/design-system`, Business Client to `apps/web/src/client`, Platform Admin to `apps/web/src/admin`, shared web infrastructure to `apps/web/src/shared`, and app composition to `apps/web/src/providers`. Route entrypoints stay in `apps/web/src/app`. Historical observations above retain their original context; current paths are recorded in the ownership inventory. DS-01 and ROLL-01 remain COMPLETE. At reorganization DS-02 was reset to NOT_STARTED for package-based revalidation; the master roadmap records subsequent completion. No new token/theme implementation occurred during reorganization.
