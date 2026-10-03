# Business Client Dashboard

Status: **NOT_STARTED**. This section contains 13 stable implementation phases. Read the [master roadmap](../README.md) and [product principles](../00-product-ui-principles.md) before starting.

## Execution boundaries

Prioritize UX-03 Test Assistant before major pages. UX-04/06/08/11 can then run in parallel with separate owners. Catalog and business rules join transaction work; analytics follows verified outcomes. Existing routes migrate incrementally; Customers, Catalog and Team need planned new routes/proxies.

## Phases

| Phase | Scope | Prerequisites | Complexity | Risk | Status |
|---|---|---|---|---|---|
| [UX-01](UX-01-overview.md) | Business overview | UX-03, INT-06 | M | MEDIUM | NOT_STARTED |
| [UX-02](UX-02-inbox.md) | Inbox and conversation takeover | UX-03, UX-04, INT-05 | XL | HIGH | NOT_STARTED |
| [UX-03](UX-03-test-assistant.md) | Test Assistant | DS-10, INT-07 | L | HIGH | NOT_STARTED |
| [UX-04](UX-04-customers.md) | Customers | UX-03, INT-06 | L | HIGH | NOT_STARTED |
| [UX-05](UX-05-leads.md) | Leads | UX-04, INT-06 | M | MEDIUM | NOT_STARTED |
| [UX-06](UX-06-catalog.md) | Generic catalog | UX-03, INT-06 | L | HIGH | NOT_STARTED |
| [UX-07](UX-07-offers.md) | Offers and promotions | UX-06, INT-06 | M | MEDIUM | NOT_STARTED |
| [UX-08](UX-08-company-information.md) | Company Information | UX-03, INT-06 | L | HIGH | NOT_STARTED |
| [UX-09](UX-09-business-rules.md) | Business Rules | UX-08, INT-06 | L | HIGH | NOT_STARTED |
| [UX-10](UX-10-bookings-orders-quotes.md) | Bookings, orders and quotes | UX-04, UX-06, UX-09, INT-06 | XL | HIGH | NOT_STARTED |
| [UX-11](UX-11-team-permissions.md) | Team and permissions | UX-03, INT-03 | L | HIGH | NOT_STARTED |
| [UX-12](UX-12-analytics.md) | Business analytics | UX-01, UX-10, INT-06 | L | MEDIUM | NOT_STARTED |
| [UX-13](UX-13-settings-integrations.md) | Settings and integrations | UX-03, UX-11, INT-06 | L | HIGH | NOT_STARTED |

## Section exit

Every phase has reviewed acceptance evidence, the prerequisite chain is satisfied, and stated contract gaps are resolved before affected functionality is enabled. Evidence identifies owner, reviewer, date, exact commands/results, locale/theme/viewport matrix and rollback limitations. Section planning completion is distinct from implementation completion.

## Frontend ownership update (2026-10-03)

The authoritative [frontend monorepo architecture](../architecture/frontend-monorepo-architecture.md) assigns visual primitives/tokens to `packages/design-system`, Business Client to `apps/web/src/client`, Platform Admin to `apps/web/src/admin`, shared web infrastructure to `apps/web/src/shared`, and app composition to `apps/web/src/providers`. Route entrypoints stay in `apps/web/src/app`. Historical observations above retain their original context; current paths are recorded in the ownership inventory. DS-01 and ROLL-01 remain COMPLETE. At reorganization DS-02 was reset to NOT_STARTED for package-based revalidation; the master roadmap records subsequent completion. No new token/theme implementation occurred during reorganization.
