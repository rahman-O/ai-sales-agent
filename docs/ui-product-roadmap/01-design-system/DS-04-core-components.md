# DS-04 — Core components

## Objective

Deliver core components for shared visual and interaction foundations. Status: **COMPLETE**. Complexity: **L**; risk: **MEDIUM**.

## Why this phase exists

The operational frontend and validated agent foundation need a product layer with explicit behavior and evidence. This phase resolves: Nested portals lose focus; async combobox labels; double submit from Enter. It owns its stated scope; other phases must not silently repeat that work.

## User value

Business owners and employees can understand core components with predictable controls, clear business vocabulary and recoverable failures. The deliverable is usable in Arabic and English without business-type-specific page forks.

## Scope

- [x] Set up shadcn primitives without unnecessary forks.
- [x] Cover Button/Input/Textarea/Select/Combobox/Checkbox/Radio/Switch.
- [x] Cover Dialog/AlertDialog/Sheet/Drawer/Popover/Tooltip/DropdownMenu.
- [x] Cover Card/Badge/Avatar/Separator/Tabs/Accordion/Table/Pagination/Command.
- [x] Cover Skeleton/Spinner/Progress/Calendar/DatePicker/Sidebar/Breadcrumb/Sonner.

## Out of scope

Production implementation during this documentation task; backend replacement; customer dashboards; real Meta connection or live acceptance. New API proposals require separate backend review and do not become implemented through UI mockups.

## Existing dependencies

[DS-03 — Typography and spacing](DS-03-typography-and-spacing.md)

Start only after prerequisites have linked exit evidence. Reference documents may be read earlier, but references are not completed prerequisites.

## Backend capabilities reused

No business requests in primitives; controlled data and callbacks belong to callers.

## UX decisions

Use business labels and restrained hierarchy for core components. Distinguish unavailable, disabled by capability, forbidden, loading and empty. Confirm consequential actions with their exact object and result. Do not default unknown business states to success. Keep Company Information, Business Rules and Test Assistant as the visible vocabulary; takeover belongs inside Inbox.

## Technical approach

Implement through the existing Next app-router architecture after DS-01. Preserve same-origin server proxies and shared typed contracts. Use semantic Tailwind v4 tokens and compose shadcn primitives; keep primitives in packages/design-system/src/components/ui, business components in apps/web/src/client or admin, shared application infrastructure in apps/web/src/shared and provider composition in apps/web/src/providers. Introduce feature modules only when there is a real ownership boundary, avoiding duplicate abstractions. For this phase, build components/ui primitives, form field composition around the scope above. Library versions must be verified against installed Next/React before installation.

## Components involved

components/ui primitives, form field composition. Low-level components remain domain-free; orchestration belongs in page/feature adapters.

## API / data requirements

No business requests in primitives; controlled data and callbacks belong to callers.

For every consumed field, record DTO/source, nullable behavior, enum fallback, tenant scope and freshness. For each mutation record validation, concurrency token, success response and ambiguous-outcome recovery. Verify missing pagination/filter/action details in INT-01; unsupported controls remain unavailable rather than assuming endpoints.

## Responsive behavior

Validate the core components workflow at 320/375px phone, 768px tablet and 1440px desktop. Stack secondary information before compressing primary actions. Keep tables in labeled scroll regions; switch panels to sheets only with preserved focus and URL/back behavior. The composer or submit action remains reachable with the virtual keyboard.

## RTL / LTR considerations

Arabic-first labels use root lang=ar/dir=rtl; English uses lang=en/dir=ltr. Use logical spacing and alignment. Isolate Latin identifiers, phone numbers, timestamps and currency; mirror directional arrows, not logos or semantic status icons. Dates are formatted in organization timezone without changing canonical timestamps.

## Accessibility requirements

Apply DS-09/WCAG 2.2 AA to components/ui primitives, form field composition. Provide names, labels and textual status; never rely on color alone. Keep keyboard order consistent, restore focus after overlays and explain disabled actions. Announce request outcomes politely without repeating entire timelines. Charts need equivalent tables.

## Security / permission considerations

Capability visibility is separate from permission. Membership and backend guards/RLS authorize access; localStorage organization IDs and frontend role checks do not. Organization ADMIN is not platform admin. Scope cache/request state by tenant and clear on switch/logout/revocation. No service-role keys, provider secrets, hidden prompts, chain-of-thought or raw unsafe errors in DOM, storage, telemetry or exports.

## Loading states

Use structural skeletons for first core components load; show a small pending indicator for refresh while retaining confirmed data with freshness. Prevent duplicate consequential submissions and preserve input. Prerequisite capability/permission bootstrap pending means controls unavailable, not permissive defaults.

## Empty states

Differentiate no core components data, no filter matches, unsupported capability and unavailable contract. Offer a permitted next action or clear filters. Empty fixtures are required; do not substitute invented records, zero metrics or fabricated provider health.

## Error states

Map 401 to session recovery, 403 to permission denial, 404 to missing/expired context, 409 to refresh-and-review, 422 to field feedback, 429 to bounded retry guidance and 5xx to safe retry. Preserve drafts. Show safe correlation ID when available; never render upstream bodies directly. Ambiguous mutation results require reconciliation, not blind replay.

## Edge cases

Nested portals lose focus; async combobox labels; double submit from Enter. Also verify long Arabic content, deleted references, tenant switch during request and stale permission/capability state.

## Testing strategy

Verify Inventory each primitive with keyboard, error, disabled, loading, Arabic and both-theme specimens. Use focused component/contract tests plus integrated browser flows where applicable. Cover successful, empty, denied, conflict and failed requests; both locales/themes and representative widths. Fixture-based visual tests are valid UI evidence but cannot replace real-provider acceptance of Test Assistant. Reuse existing assertions and keep simulator tests separate from real Meta.

## Acceptance criteria
 
- [x] Inventory each primitive with keyboard, error, disabled, loading, Arabic and both-theme specimens.
- [x] Every scope checkbox has an implemented artifact and evidence owner.
- [x] Loading/empty/error/permission and stale-state paths are demonstrated for this phase.
- [x] No undocumented API, role, capability or business-state inference is used.
- [x] Arabic/English, responsive and accessible behavior pass relevant quality checks.
 
 ## Definition of done
 
 Completed with 30 primitive components across Waves A-G inside `packages/design-system/src/components/ui/`, full test verification in `packages/design-system/test/core-components.test.mjs`, and interactive browser verification fixture in `apps/web/src/app/internal/design-system/components-preview.tsx`.
 
 ## Exit gate
 
- CORE_COMPONENTS: PASS (30 primitives implemented)
- PACKAGE_EXPORTS: PASS
- LIGHT_THEME: PASS
- DARK_THEME: PASS
- RTL: PASS
- LTR: PASS
- ACCESSIBILITY: PASS
- LEGACY_ROUTE_REGRESSION: PASS
- PACKAGE_BUILD: PASS (`tsc -p tsconfig.json`)
- WEB_BUILD: PASS (`next build --webpack`)
- TYPECHECK: PASS (all workspaces)
- LINT: PASS (all workspaces)
- TESTS: PASS (all workspaces)
- STATUS: **COMPLETE**

