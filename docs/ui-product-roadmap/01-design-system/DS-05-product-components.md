# DS-05 — Product components

## Objective

Deliver product components for shared visual and interaction foundations. Status: **COMPLETE**. Complexity: **L**; risk: **MEDIUM**.

## Why this phase exists

The operational frontend and validated agent foundation need a product layer with explicit behavior and evidence. This phase resolves: Unknown enum value must show neutral unsupported state, not success. It owns its stated scope; other phases must not silently repeat that work.

## User value

Business owners and employees can understand product components with predictable controls, clear business vocabulary and recoverable failures. The deliverable is usable in Arabic and English without business-type-specific page forks.

## Scope

- [x] Compose primitives into page, status, customer and transaction patterns.
- [x] Define domain status mappings from contracts rather than colors in pages.
- [x] Create reusable empty/error/permission states with recovery actions.
- [x] Keep product patterns outside components/ui.

## Acceptance criteria

- [x] All listed product components have typed fixtures, localized labels and documented consumers.
- [x] Every scope checkbox has an implemented artifact and evidence owner.
- [x] Loading/empty/error/permission and stale-state paths are demonstrated for this phase.
- [x] No undocumented API, role, capability or business-state inference is used.
- [x] Arabic/English, responsive and accessible behavior pass relevant quality checks.

## Definition of done

Completed with 14 domain-neutral product patterns inside `packages/design-system/src/components/patterns/` (PageHeader, SectionHeader, StatCard, Metric, TrendMetric, StatusBadge, CapabilityBadge, EmptyState, ErrorState, PermissionDeniedState, SettingsSection, SettingsRow, DataList, InfoRow, AuditEventRow, SearchField, FilterBar, DataTable), verified by `packages/design-system/test/product-patterns.test.mjs` and interactive test fixture `apps/web/src/app/internal/design-system/patterns-preview.tsx`.

## Exit gate

- PRODUCT_PATTERNS: PASS (14 patterns implemented)
- DOMAIN_NEUTRALITY: PASS
- STATUS_SYSTEM: PASS
- EMPTY_ERROR_SYSTEM: PASS
- RTL: PASS
- ACCESSIBILITY: PASS
- PACKAGE_BUILD: PASS (`tsc -p tsconfig.json`)
- WEB_BUILD: PASS (`next build --webpack`)
- TYPECHECK: PASS (all workspaces)
- LINT: PASS (all workspaces)
- TESTS: PASS (all workspaces)
- STATUS: **COMPLETE**

