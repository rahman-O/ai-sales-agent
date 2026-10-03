# ADMIN-05 — AI usage

## Objective

Deliver ai usage for platform operator operations. Status: **NOT_STARTED**. Complexity: **L**; risk: **HIGH**. This is a future implementation plan, not a claim that the existing UI has passed this phase.

## Why this phase exists

The operational frontend and validated agent foundation need a product layer with explicit behavior and evidence. This phase resolves: Missing price basis or double-counted retries It owns its stated scope; other phases must not silently repeat that work.

## User value

Platform operators can understand ai usage with predictable controls, clear business vocabulary and recoverable failures. The deliverable is usable in Arabic and English without business-type-specific page forks.

## Scope

- [ ] Specify aggregated model usage by tenant/provider/time.
- [ ] Define token/call/cost units and retention.
- [ ] Display incomplete accounting honestly.

## Out of scope

Production implementation during this documentation task; backend replacement; customer dashboards; real Meta connection or live acceptance. New API proposals require separate backend review and do not become implemented through UI mockups.

## Existing dependencies

[ADMIN-02 — Organizations](ADMIN-02-organizations.md)

Start only after prerequisites have linked exit evidence. Reference documents may be read earlier, but references are not completed prerequisites.

## Backend capabilities reused

No dedicated platform-admin HTTP API or platform-operator authorization contract was verified. Specify method/path, DTO, pagination, filters, redaction, grant, audit and concurrency semantics before implementation; database tables are not a browser API.

## UX decisions

Use business labels and restrained hierarchy for ai usage. Distinguish unavailable, disabled by capability, forbidden, loading and empty. Confirm consequential actions with their exact object and result. Do not default unknown business states to success. Show operator context prominently and never reuse organization role names as platform grants.

## Technical approach

Implement through the existing Next app-router architecture after DS-01. Preserve same-origin server proxies and shared typed contracts. Use semantic Tailwind v4 tokens and compose shadcn primitives; keep primitives in packages/design-system/src/components/ui, business components in apps/web/src/client or admin, shared application infrastructure in apps/web/src/shared and provider composition in apps/web/src/providers. Introduce feature modules only when there is a real ownership boundary, avoiding duplicate abstractions. For this phase, build UsageTable, cost chart around the scope above. Library versions must be verified against installed Next/React before installation.

## Components involved

UsageTable, cost chart. Low-level components remain domain-free; orchestration belongs in page/feature adapters.

## API / data requirements

No dedicated platform-admin HTTP API or platform-operator authorization contract was verified. Specify method/path, DTO, pagination, filters, redaction, grant, audit and concurrency semantics before implementation; database tables are not a browser API.

For every consumed field, record DTO/source, nullable behavior, enum fallback, tenant scope and freshness. For each mutation record validation, concurrency token, success response and ambiguous-outcome recovery. **Blocking contract gap:** Backend contract and operator authorization gap: phase cannot exit based on mocked screens. This document does not authorize backend redesign or implementation.

## Responsive behavior

Validate the ai usage workflow at 320/375px phone, 768px tablet and 1440px desktop. Stack secondary information before compressing primary actions. Keep tables in labeled scroll regions; switch panels to sheets only with preserved focus and URL/back behavior. The composer or submit action remains reachable with the virtual keyboard.

## RTL / LTR considerations

Arabic-first labels use root lang=ar/dir=rtl; English uses lang=en/dir=ltr. Use logical spacing and alignment. Isolate Latin identifiers, phone numbers, timestamps and currency; mirror directional arrows, not logos or semantic status icons. Dates are formatted in organization timezone without changing canonical timestamps.

## Accessibility requirements

Apply DS-09/WCAG 2.2 AA to UsageTable, cost chart. Provide names, labels and textual status; never rely on color alone. Keep keyboard order consistent, restore focus after overlays and explain disabled actions. Announce request outcomes politely without repeating entire timelines. Charts need equivalent tables.

## Security / permission considerations

Capability visibility is separate from permission. Membership and backend guards/RLS authorize access; localStorage organization IDs and frontend role checks do not. Organization ADMIN is not platform admin. Scope cache/request state by tenant and clear on switch/logout/revocation. No service-role keys, provider secrets, hidden prompts, chain-of-thought or raw unsafe errors in DOM, storage, telemetry or exports.

## Loading states

Use structural skeletons for first ai usage load; show a small pending indicator for refresh while retaining confirmed data with freshness. Prevent duplicate consequential submissions and preserve input. Prerequisite capability/permission bootstrap pending means controls unavailable, not permissive defaults.

## Empty states

Differentiate no ai usage data, no filter matches, unsupported capability and unavailable contract. Offer a permitted next action or clear filters. Empty fixtures are required; do not substitute invented records, zero metrics or fabricated provider health.

## Error states

Map 401 to session recovery, 403 to permission denial, 404 to missing/expired context, 409 to refresh-and-review, 422 to field feedback, 429 to bounded retry guidance and 5xx to safe retry. Preserve drafts. Show safe correlation ID when available; never render upstream bodies directly. Ambiguous mutation results require reconciliation, not blind replay.

## Edge cases

Missing price basis or double-counted retries Also verify long Arabic content, deleted references, tenant switch during request and stale permission/capability state.

## Testing strategy

Verify Aggregates reconcile with audited source and show currency/rate provenance Use focused component/contract tests plus integrated browser flows where applicable. Cover successful, empty, denied, conflict and failed requests; both locales/themes and representative widths. Fixture-based visual tests are valid UI evidence but cannot replace real-provider acceptance of Test Assistant. Reuse existing assertions and keep simulator tests separate from real Meta.

## Acceptance criteria

- [ ] Aggregates reconcile with audited source and show currency/rate provenance.
- [ ] Every scope checkbox has an implemented artifact and evidence owner.
- [ ] Loading/empty/error/permission and stale-state paths are demonstrated for this phase.
- [ ] No undocumented API, role, capability or business-state inference is used.
- [ ] Arabic/English, responsive and accessible behavior pass relevant quality checks.
- [ ] Resolve and verify the blocking contract gap: Backend contract and operator authorization gap: phase cannot exit based on mocked screens. This document does not authorize backend redesign or implementation.

## Definition of done

Attach reviewed implementation/contract changes, focused tests, screen or interaction evidence, known limitations and rollback/migration notes to this phase. Record actual command/results for typecheck, tests and production build as applicable. Update status only after exit review; planning artifacts alone do not satisfy implementation completion.

## Risks

Primary risk: Missing price basis or double-counted retries Risk level HIGH; complexity L is relative effort, not a calendar estimate. Mitigate through prerequisite evidence and the tests above. Missing contracts must be visible blockers with owner and next decision, not hidden by sample data.

## Non-goals

No customer portal, new business engine, hardcoded clinic/store UI, payment/calendar redesign, copied visual product, giant default permission matrix or production secret management in the browser. This phase does not close MB15 or authorize real Meta contact.

## Files likely affected

- `proposed apps/web/src/app/(platform-admin)`
- `proposed operator proxy`
- `existing API controller inventory`

Paths are repository-relative future touchpoints. “Proposed” means absent at inspection; confirm placement in DS-01 before creating files. During this task only roadmap Markdown is changed.

## Exit gate

All prerequisites are complete, all acceptance checkboxes have reviewable evidence, and aggregates reconcile with audited source and show currency/rate provenance. The stated backend contract gap must be resolved and verified against authorized real endpoints before enabled rollout. Record owner, reviewer, date, commands and results; then change NOT_STARTED to the agreed implementation status.
