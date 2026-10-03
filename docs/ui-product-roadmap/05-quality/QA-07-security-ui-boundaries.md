# QA-07 — UI security boundaries

## Objective

Deliver ui security boundaries for measurable UI quality. Status: **NOT_STARTED**. Complexity: **L**; risk: **HIGH**. This is a future implementation plan, not a claim that the existing UI has passed this phase.

## Why this phase exists

The operational frontend and validated agent foundation need a product layer with explicit behavior and evidence. This phase resolves: Org Admin opens platform route; raw debug payload enters DOM; malicious document markup. It owns its stated scope; other phases must not silently repeat that work.

## User value

Business owners and employees can understand ui security boundaries with predictable controls, clear business vocabulary and recoverable failures. The deliverable is usable in Arabic and English without business-type-specific page forks.

## Scope

- [ ] Test cross-tenant route, query, cache and late-response isolation.
- [ ] Test role revoke, direct links and capability failures.
- [ ] Inspect preview debug and UI exports for prohibited payloads.
- [ ] Verify no browser service-role/DB/Redis/secret access.

## Out of scope

Production implementation during this documentation task; backend replacement; customer dashboards; real Meta connection or live acceptance. New API proposals require separate backend review and do not become implemented through UI mockups.

## Existing dependencies

[INT-03 — Permission architecture](../04-integration/INT-03-permissions.md), [INT-07 — Preview integration](../04-integration/INT-07-preview-mode.md), [UX-03 — Test Assistant](../02-client-dashboard/UX-03-test-assistant.md)

Start only after prerequisites have linked exit evidence. Reference documents may be read earlier, but references are not completed prerequisites.

## Backend capabilities reused

Reuse backend auth/RLS and preview policy gates; UI tests are additional evidence.

## UX decisions

Use business labels and restrained hierarchy for ui security boundaries. Distinguish unavailable, disabled by capability, forbidden, loading and empty. Confirm consequential actions with their exact object and result. Do not default unknown business states to success. Keep Company Information, Business Rules and Test Assistant as the visible vocabulary; takeover belongs inside Inbox.

## Technical approach

Implement through the existing Next app-router architecture after DS-01. Preserve same-origin server proxies and shared typed contracts. Use semantic Tailwind v4 tokens and compose shadcn primitives; keep primitives in packages/design-system/src/components/ui, business components in apps/web/src/client or admin, shared application infrastructure in apps/web/src/shared and provider composition in apps/web/src/providers. Introduce feature modules only when there is a real ownership boundary, avoiding duplicate abstractions. For this phase, build Security browser scenarios, redaction checks around the scope above. Library versions must be verified against installed Next/React before installation.

## Components involved

Security browser scenarios, redaction checks. Low-level components remain domain-free; orchestration belongs in page/feature adapters.

## API / data requirements

Reuse backend auth/RLS and preview policy gates; UI tests are additional evidence.

For every consumed field, record DTO/source, nullable behavior, enum fallback, tenant scope and freshness. For each mutation record validation, concurrency token, success response and ambiguous-outcome recovery. Verify missing pagination/filter/action details in INT-01; unsupported controls remain unavailable rather than assuming endpoints.

## Responsive behavior

Validate the ui security boundaries workflow at 320/375px phone, 768px tablet and 1440px desktop. Stack secondary information before compressing primary actions. Keep tables in labeled scroll regions; switch panels to sheets only with preserved focus and URL/back behavior. The composer or submit action remains reachable with the virtual keyboard.

## RTL / LTR considerations

Arabic-first labels use root lang=ar/dir=rtl; English uses lang=en/dir=ltr. Use logical spacing and alignment. Isolate Latin identifiers, phone numbers, timestamps and currency; mirror directional arrows, not logos or semantic status icons. Dates are formatted in organization timezone without changing canonical timestamps.

## Accessibility requirements

Apply DS-09/WCAG 2.2 AA to Security browser scenarios, redaction checks. Provide names, labels and textual status; never rely on color alone. Keep keyboard order consistent, restore focus after overlays and explain disabled actions. Announce request outcomes politely without repeating entire timelines. Charts need equivalent tables.

## Security / permission considerations

Capability visibility is separate from permission. Membership and backend guards/RLS authorize access; localStorage organization IDs and frontend role checks do not. Organization ADMIN is not platform admin. Scope cache/request state by tenant and clear on switch/logout/revocation. No service-role keys, provider secrets, hidden prompts, chain-of-thought or raw unsafe errors in DOM, storage, telemetry or exports.

## Loading states

Use structural skeletons for first ui security boundaries load; show a small pending indicator for refresh while retaining confirmed data with freshness. Prevent duplicate consequential submissions and preserve input. Prerequisite capability/permission bootstrap pending means controls unavailable, not permissive defaults.

## Empty states

Differentiate no ui security boundaries data, no filter matches, unsupported capability and unavailable contract. Offer a permitted next action or clear filters. Empty fixtures are required; do not substitute invented records, zero metrics or fabricated provider health.

## Error states

Map 401 to session recovery, 403 to permission denial, 404 to missing/expired context, 409 to refresh-and-review, 422 to field feedback, 429 to bounded retry guidance and 5xx to safe retry. Preserve drafts. Show safe correlation ID when available; never render upstream bodies directly. Ambiguous mutation results require reconciliation, not blind replay.

## Edge cases

Org Admin opens platform route; raw debug payload enters DOM; malicious document markup. Also verify long Arabic content, deleted references, tenant switch during request and stale permission/capability state.

## Testing strategy

Verify Denied calls stay denied server-side, private data does not render, and preview sends no production outbound. Use focused component/contract tests plus integrated browser flows where applicable. Cover successful, empty, denied, conflict and failed requests; both locales/themes and representative widths. Fixture-based visual tests are valid UI evidence but cannot replace real-provider acceptance of Test Assistant. Reuse existing assertions and keep simulator tests separate from real Meta.

## Acceptance criteria

- [ ] Denied calls stay denied server-side, private data does not render, and preview sends no production outbound..
- [ ] Every scope checkbox has an implemented artifact and evidence owner.
- [ ] Loading/empty/error/permission and stale-state paths are demonstrated for this phase.
- [ ] No undocumented API, role, capability or business-state inference is used.
- [ ] Arabic/English, responsive and accessible behavior pass relevant quality checks.

## Definition of done

Attach reviewed implementation/contract changes, focused tests, screen or interaction evidence, known limitations and rollback/migration notes to this phase. Record actual command/results for typecheck, tests and production build as applicable. Update status only after exit review; planning artifacts alone do not satisfy implementation completion.

## Risks

Primary risk: Org Admin opens platform route; raw debug payload enters DOM; malicious document markup. Risk level HIGH; complexity L is relative effort, not a calendar estimate. Mitigate through prerequisite evidence and the tests above. Missing contracts must be visible blockers with owner and next decision, not hidden by sample data.

## Non-goals

No customer portal, new business engine, hardcoded clinic/store UI, payment/calendar redesign, copied visual product, giant default permission matrix or production secret management in the browser. This phase does not close MB15 or authorize real Meta contact.

## Files likely affected

- `proposed security UI tests`
- `proxy contract tests`

Paths are repository-relative future touchpoints. “Proposed” means absent at inspection; confirm placement in DS-01 before creating files. During this task only roadmap Markdown is changed.

## Exit gate

All prerequisites are complete, all acceptance checkboxes have reviewable evidence, and denied calls stay denied server-side, private data does not render, and preview sends no production outbound.. Unsupported controls remain explicitly unavailable until their contracts are verified. Record owner, reviewer, date, commands and results; then change NOT_STARTED to the agreed implementation status.
