# QA-08 — Product acceptance

## Objective

Deliver product acceptance for measurable UI quality. Status: **NOT_STARTED**. Complexity: **XL**; risk: **HIGH**. This is a future implementation plan, not a claim that the existing UI has passed this phase.

## Why this phase exists

The operational frontend and validated agent foundation need a product layer with explicit behavior and evidence. This phase resolves: Client wave approved while admin APIs still absent; simulator mistaken for live channel. It owns its stated scope; other phases must not silently repeat that work.

## User value

Business owners and employees can understand product acceptance with predictable controls, clear business vocabulary and recoverable failures. The deliverable is usable in Arabic and English without business-type-specific page forks.

## Scope

- [ ] Run business-owner and employee journeys on two capability configurations.
- [ ] Run separately authorized operator journeys.
- [ ] Collect regression, accessibility, visual, performance and security evidence.
- [ ] Maintain scope ledger distinguishing client wave approval from entire roadmap completion.

## Out of scope

Production implementation during this documentation task; backend replacement; customer dashboards; real Meta connection or live acceptance. New API proposals require separate backend review and do not become implemented through UI mockups.

## Existing dependencies

[ROLL-03 — Incremental delivery](../06-rollout/ROLL-03-incremental-delivery.md), [UX-01 — Business overview](../02-client-dashboard/UX-01-overview.md), [UX-02 — Inbox and conversation takeover](../02-client-dashboard/UX-02-inbox.md), [UX-03 — Test Assistant](../02-client-dashboard/UX-03-test-assistant.md), [UX-04 — Customers](../02-client-dashboard/UX-04-customers.md), [UX-05 — Leads](../02-client-dashboard/UX-05-leads.md), [UX-06 — Generic catalog](../02-client-dashboard/UX-06-catalog.md), [UX-07 — Offers and promotions](../02-client-dashboard/UX-07-offers.md), [UX-08 — Company Information](../02-client-dashboard/UX-08-company-information.md), [UX-09 — Business Rules](../02-client-dashboard/UX-09-business-rules.md), [UX-10 — Bookings, orders and quotes](../02-client-dashboard/UX-10-bookings-orders-quotes.md), [UX-11 — Team and permissions](../02-client-dashboard/UX-11-team-permissions.md), [UX-12 — Business analytics](../02-client-dashboard/UX-12-analytics.md), [UX-13 — Settings and integrations](../02-client-dashboard/UX-13-settings-integrations.md), [ADMIN-01 — Platform admin shell](../03-admin-dashboard/ADMIN-01-shell.md), [ADMIN-02 — Organizations](../03-admin-dashboard/ADMIN-02-organizations.md), [ADMIN-03 — Users and platform access](../03-admin-dashboard/ADMIN-03-users-access.md), [ADMIN-04 — Plans and subscriptions](../03-admin-dashboard/ADMIN-04-plans-subscriptions.md), [ADMIN-05 — AI usage](../03-admin-dashboard/ADMIN-05-ai-usage.md), [ADMIN-06 — Provider health and queues](../03-admin-dashboard/ADMIN-06-provider-health-queues.md), [ADMIN-07 — Errors and audit logs](../03-admin-dashboard/ADMIN-07-errors-audit.md), [ADMIN-08 — Platform feature flag tools](../03-admin-dashboard/ADMIN-08-feature-flags.md), [ADMIN-09 — Support tooling](../03-admin-dashboard/ADMIN-09-support-tools.md), [ADMIN-10 — Platform settings](../03-admin-dashboard/ADMIN-10-platform-settings.md)

Start only after prerequisites have linked exit evidence. Reference documents may be read earlier, but references are not completed prerequisites.

## Backend capabilities reused

Use local simulator and real configured provider for relevant agent parity; no real Meta dependency. Existing MB15B evidence is backend baseline only.

## UX decisions

Use business labels and restrained hierarchy for product acceptance. Distinguish unavailable, disabled by capability, forbidden, loading and empty. Confirm consequential actions with their exact object and result. Do not default unknown business states to success. Keep Company Information, Business Rules and Test Assistant as the visible vocabulary; takeover belongs inside Inbox.

## Technical approach

Implement through the existing Next app-router architecture after DS-01. Preserve same-origin server proxies and shared typed contracts. Use semantic Tailwind v4 tokens and compose shadcn primitives; keep primitives in packages/design-system/src/components/ui, business components in apps/web/src/client or admin, shared application infrastructure in apps/web/src/shared and provider composition in apps/web/src/providers. Introduce feature modules only when there is a real ownership boundary, avoiding duplicate abstractions. For this phase, build Acceptance checklist and evidence ledger around the scope above. Library versions must be verified against installed Next/React before installation.

## Components involved

Acceptance checklist and evidence ledger. Low-level components remain domain-free; orchestration belongs in page/feature adapters.

## API / data requirements

Use local simulator and real configured provider for relevant agent parity; no real Meta dependency. Existing MB15B evidence is backend baseline only.

For every consumed field, record DTO/source, nullable behavior, enum fallback, tenant scope and freshness. For each mutation record validation, concurrency token, success response and ambiguous-outcome recovery. Verify missing pagination/filter/action details in INT-01; unsupported controls remain unavailable rather than assuming endpoints.

## Responsive behavior

Validate the product acceptance workflow at 320/375px phone, 768px tablet and 1440px desktop. Stack secondary information before compressing primary actions. Keep tables in labeled scroll regions; switch panels to sheets only with preserved focus and URL/back behavior. The composer or submit action remains reachable with the virtual keyboard.

## RTL / LTR considerations

Arabic-first labels use root lang=ar/dir=rtl; English uses lang=en/dir=ltr. Use logical spacing and alignment. Isolate Latin identifiers, phone numbers, timestamps and currency; mirror directional arrows, not logos or semantic status icons. Dates are formatted in organization timezone without changing canonical timestamps.

## Accessibility requirements

Apply DS-09/WCAG 2.2 AA to Acceptance checklist and evidence ledger. Provide names, labels and textual status; never rely on color alone. Keep keyboard order consistent, restore focus after overlays and explain disabled actions. Announce request outcomes politely without repeating entire timelines. Charts need equivalent tables.

## Security / permission considerations

Capability visibility is separate from permission. Membership and backend guards/RLS authorize access; localStorage organization IDs and frontend role checks do not. Organization ADMIN is not platform admin. Scope cache/request state by tenant and clear on switch/logout/revocation. No service-role keys, provider secrets, hidden prompts, chain-of-thought or raw unsafe errors in DOM, storage, telemetry or exports.

## Loading states

Use structural skeletons for first product acceptance load; show a small pending indicator for refresh while retaining confirmed data with freshness. Prevent duplicate consequential submissions and preserve input. Prerequisite capability/permission bootstrap pending means controls unavailable, not permissive defaults.

## Empty states

Differentiate no product acceptance data, no filter matches, unsupported capability and unavailable contract. Offer a permitted next action or clear filters. Empty fixtures are required; do not substitute invented records, zero metrics or fabricated provider health.

## Error states

Map 401 to session recovery, 403 to permission denial, 404 to missing/expired context, 409 to refresh-and-review, 422 to field feedback, 429 to bounded retry guidance and 5xx to safe retry. Preserve drafts. Show safe correlation ID when available; never render upstream bodies directly. Ambiguous mutation results require reconciliation, not blind replay.

## Edge cases

Client wave approved while admin APIs still absent; simulator mistaken for live channel. Also verify long Arabic content, deleted references, tenant switch during request and stale permission/capability state.

## Testing strategy

Verify All roadmap phases in scope satisfy exit gates; unresolved admin contracts prevent global completion without silently deleting requirements. Use focused component/contract tests plus integrated browser flows where applicable. Cover successful, empty, denied, conflict and failed requests; both locales/themes and representative widths. Fixture-based visual tests are valid UI evidence but cannot replace real-provider acceptance of Test Assistant. Reuse existing assertions and keep simulator tests separate from real Meta.

## Acceptance criteria

- [ ] All roadmap phases in scope satisfy exit gates; unresolved admin contracts prevent global completion without silently deleting requirements..
- [ ] Every scope checkbox has an implemented artifact and evidence owner.
- [ ] Loading/empty/error/permission and stale-state paths are demonstrated for this phase.
- [ ] No undocumented API, role, capability or business-state inference is used.
- [ ] Arabic/English, responsive and accessible behavior pass relevant quality checks.

## Definition of done

Attach reviewed implementation/contract changes, focused tests, screen or interaction evidence, known limitations and rollback/migration notes to this phase. Record actual command/results for typecheck, tests and production build as applicable. Update status only after exit review; planning artifacts alone do not satisfy implementation completion.

## Risks

Primary risk: Client wave approved while admin APIs still absent; simulator mistaken for live channel. Risk level HIGH; complexity XL is relative effort, not a calendar estimate. Mitigate through prerequisite evidence and the tests above. Missing contracts must be visible blockers with owner and next decision, not hidden by sample data.

## Non-goals

No customer portal, new business engine, hardcoded clinic/store UI, payment/calendar redesign, copied visual product, giant default permission matrix or production secret management in the browser. This phase does not close MB15 or authorize real Meta contact.

## Files likely affected

- `proposed UI acceptance suite`
- `roadmap evidence ledger`

Paths are repository-relative future touchpoints. “Proposed” means absent at inspection; confirm placement in DS-01 before creating files. During this task only roadmap Markdown is changed.

## Exit gate

All prerequisites are complete, all acceptance checkboxes have reviewable evidence, and all roadmap phases in scope satisfy exit gates; unresolved admin contracts prevent global completion without silently deleting requirements.. Unsupported controls remain explicitly unavailable until their contracts are verified. Record owner, reviewer, date, commands and results; then change NOT_STARTED to the agreed implementation status.
