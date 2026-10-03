# UX-01 — Business overview

## Objective

Deliver business overview for organization business operations. Status: **NOT_STARTED**. Complexity: **M**; risk: **MEDIUM**. This is a future implementation plan, not a claim that the existing UI has passed this phase.

## Why this phase exists

The operational frontend and validated agent foundation need a product layer with explicit behavior and evidence. This phase resolves: No leads capability; dashboard request fails independently from profile. It owns its stated scope; other phases must not silently repeat that work.

## User value

Business owners and employees can understand business overview with predictable controls, clear business vocabulary and recoverable failures. The deliverable is usable in Arabic and English without business-type-specific page forks.

## Scope

- [ ] Show actionable daily summaries and setup checklist.
- [ ] Use capabilities to select relevant transactions and links.
- [ ] Distinguish zero, unavailable and stale counts.
- [ ] Avoid technical infrastructure metrics in the client view.

## Out of scope

Production implementation during this documentation task; backend replacement; customer dashboards; real Meta connection or live acceptance. New API proposals require separate backend review and do not become implemented through UI mockups.

## Existing dependencies

[UX-03 — Test Assistant](UX-03-test-assistant.md), [INT-06 — Loading, empty and error integration](../04-integration/INT-06-error-loading-empty-states.md)

Start only after prerequisites have linked exit evidence. Reference documents may be read earlier, but references are not completed prerequisites.

## Backend capabilities reused

GET /v1/organizations/:org/dashboard and analytics/overview; onboarding progress.

## UX decisions

Use business labels and restrained hierarchy for business overview. Distinguish unavailable, disabled by capability, forbidden, loading and empty. Confirm consequential actions with their exact object and result. Do not default unknown business states to success. Keep Company Information, Business Rules and Test Assistant as the visible vocabulary; takeover belongs inside Inbox.

## Technical approach

Implement through the existing Next app-router architecture after DS-01. Preserve same-origin server proxies and shared typed contracts. Use semantic Tailwind v4 tokens and compose shadcn primitives; keep primitives in packages/design-system/src/components/ui, business components in apps/web/src/client or admin, shared application infrastructure in apps/web/src/shared and provider composition in apps/web/src/providers. Introduce feature modules only when there is a real ownership boundary, avoiding duplicate abstractions. For this phase, build PageHeader, StatCard, TrendMetric, AIStatusCard around the scope above. Library versions must be verified against installed Next/React before installation.

## Components involved

PageHeader, StatCard, TrendMetric, AIStatusCard. Low-level components remain domain-free; orchestration belongs in page/feature adapters.

## API / data requirements

GET /v1/organizations/:org/dashboard and analytics/overview; onboarding progress.

For every consumed field, record DTO/source, nullable behavior, enum fallback, tenant scope and freshness. For each mutation record validation, concurrency token, success response and ambiguous-outcome recovery. Verify missing pagination/filter/action details in INT-01; unsupported controls remain unavailable rather than assuming endpoints.

## Responsive behavior

Validate the business overview workflow at 320/375px phone, 768px tablet and 1440px desktop. Stack secondary information before compressing primary actions. Keep tables in labeled scroll regions; switch panels to sheets only with preserved focus and URL/back behavior. The composer or submit action remains reachable with the virtual keyboard.

## RTL / LTR considerations

Arabic-first labels use root lang=ar/dir=rtl; English uses lang=en/dir=ltr. Use logical spacing and alignment. Isolate Latin identifiers, phone numbers, timestamps and currency; mirror directional arrows, not logos or semantic status icons. Dates are formatted in organization timezone without changing canonical timestamps.

## Accessibility requirements

Apply DS-09/WCAG 2.2 AA to PageHeader, StatCard, TrendMetric, AIStatusCard. Provide names, labels and textual status; never rely on color alone. Keep keyboard order consistent, restore focus after overlays and explain disabled actions. Announce request outcomes politely without repeating entire timelines. Charts need equivalent tables.

## Security / permission considerations

Capability visibility is separate from permission. Membership and backend guards/RLS authorize access; localStorage organization IDs and frontend role checks do not. Organization ADMIN is not platform admin. Scope cache/request state by tenant and clear on switch/logout/revocation. No service-role keys, provider secrets, hidden prompts, chain-of-thought or raw unsafe errors in DOM, storage, telemetry or exports.

## Loading states

Use structural skeletons for first business overview load; show a small pending indicator for refresh while retaining confirmed data with freshness. Prevent duplicate consequential submissions and preserve input. Prerequisite capability/permission bootstrap pending means controls unavailable, not permissive defaults.

## Empty states

Differentiate no business overview data, no filter matches, unsupported capability and unavailable contract. Offer a permitted next action or clear filters. Empty fixtures are required; do not substitute invented records, zero metrics or fabricated provider health.

## Error states

Map 401 to session recovery, 403 to permission denial, 404 to missing/expired context, 409 to refresh-and-review, 422 to field feedback, 429 to bounded retry guidance and 5xx to safe retry. Preserve drafts. Show safe correlation ID when available; never render upstream bodies directly. Ambiguous mutation results require reconciliation, not blind replay.

## Edge cases

No leads capability; dashboard request fails independently from profile. Also verify long Arabic content, deleted references, tenant switch during request and stale permission/capability state.

## Testing strategy

Verify Counts match endpoint data and missing metrics never display fabricated zero. Use focused component/contract tests plus integrated browser flows where applicable. Cover successful, empty, denied, conflict and failed requests; both locales/themes and representative widths. Fixture-based visual tests are valid UI evidence but cannot replace real-provider acceptance of Test Assistant. Reuse existing assertions and keep simulator tests separate from real Meta.

## Acceptance criteria

- [ ] Counts match endpoint data and missing metrics never display fabricated zero..
- [ ] Every scope checkbox has an implemented artifact and evidence owner.
- [ ] Loading/empty/error/permission and stale-state paths are demonstrated for this phase.
- [ ] No undocumented API, role, capability or business-state inference is used.
- [ ] Arabic/English, responsive and accessible behavior pass relevant quality checks.

## Definition of done

Attach reviewed implementation/contract changes, focused tests, screen or interaction evidence, known limitations and rollback/migration notes to this phase. Record actual command/results for typecheck, tests and production build as applicable. Update status only after exit review; planning artifacts alone do not satisfy implementation completion.

## Risks

Primary risk: No leads capability; dashboard request fails independently from profile. Risk level MEDIUM; complexity M is relative effort, not a calendar estimate. Mitigate through prerequisite evidence and the tests above. Missing contracts must be visible blockers with owner and next decision, not hidden by sample data.

## Non-goals

No customer portal, new business engine, hardcoded clinic/store UI, payment/calendar redesign, copied visual product, giant default permission matrix or production secret management in the browser. This phase does not close MB15 or authorize real Meta contact.

## Files likely affected

- `apps/web/src/app/dashboard/page.tsx`
- `api/backend organizations dashboard`

Paths are repository-relative future touchpoints. “Proposed” means absent at inspection; confirm placement in DS-01 before creating files. During this task only roadmap Markdown is changed.

## Exit gate

All prerequisites are complete, all acceptance checkboxes have reviewable evidence, and counts match endpoint data and missing metrics never display fabricated zero.. Unsupported controls remain explicitly unavailable until their contracts are verified. Record owner, reviewer, date, commands and results; then change NOT_STARTED to the agreed implementation status.
