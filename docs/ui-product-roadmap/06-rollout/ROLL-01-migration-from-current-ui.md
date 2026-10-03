# ROLL-01 Migration from Current UI

## Status

**COMPLETE — migration strategy documentation only, 2026-10-03.** DS-01 is COMPLETE; DS-02 and all migration implementation milestones remain NOT_STARTED. No packages installed, CSS changed, pages/components refactored, backend changed, migrations created or Meta contacted.

This user-requested planning phase supersedes the earlier generic ROLL-01 implementation-shaped acceptance text. DS-01 supplies sufficient evidence for strategy. **INT-01 remains NOT_STARTED:** its full API mapping is a gate for integrated page migrations, not for this CSS strategy or DS-02 token foundation. The master dependency list is corrected accordingly; no prerequisite is marked complete by implication.

Responsible roles below are proposed accountable work owners, not claims that named people have accepted assignments. At implementation start, the release owner records named implementer/reviewer and exact baseline revision for each slice.

## Objective

Define reversible coexistence from the current page-local styling to a semantic-token design system without changing business behavior. Sequence: current UI → bounded coexistence → tested foundations → isolated reference page → shared shell adoption → capability-aware feature waves → retirement of proven-unused styles. This phase defines the plan; it does not execute any future milestone.

## Current baseline

The [DS-01 audit](../01-design-system/DS-01-audit-and-baseline.md) is authoritative; this document uses it rather than repeating the inventory. Frontend `apps/web/`, Next 16.3.6, React 19.1.1, TypeScript 5.9.2, npm workspaces and `@/*` → `src/*`. There are 22 authored pages and 30 HTTP handlers, no installed/configured Tailwind or shadcn, one shared product boundary (CapabilityGuard), one shared navigation component (OperatorNav), partial RTL and capability navigation, no configurable dark theme or Platform Admin UI.

DS-01 typecheck/lint/build passed, and three existing dashboard-refresh tests passed. These were not rerun for documentation changes; they are dated baseline evidence, not current browser/visual certification. Lint is tsc, and no frontend npm test/e2e script exists. Current screenshots/keyboard evidence have not been captured; future Preparation must capture them before source changes. Partial Inbox/Test Assistant and dormant transaction styling are known gaps, not behaviors to pretend are accepted.

## Migration principles

- Change one owned presentation slice at a time; every exposure has reviewed evidence and an independent rollback boundary.
- Preserve routes, deep links, query parameters, organization context and API semantics while replacing presentation.
- Keep untouched UI stable. Introducing utilities must not accidentally style old dormant class names or reset native elements globally.
- Resolve a behavior/security defect in a separately identified INT/UX change before or alongside a gated slice; never disguise it as visual cleanup.
- Use shared primitives/product patterns only when repeated responsibility warrants them; no generic abstraction that owns domain workflows.
- Keep loading, denied, conflict, stale and ambiguous delivery visible. A green build cannot excuse visual/interaction failure.
- Backend contracts, database schema, tenant/RLS/auth, permissions, capability authority and agent execution remain invariant. No new customer dashboard, secret exposure or Meta dependency.

Each future visual PR includes a before/after behavior matrix: same method/path/request DTO, state transition, concurrency token, response handling and retry semantics. Preserve existing fetch callbacks initially. Query/form architecture changes occur under INT-04/05 with their own evidence; there are no existing TanStack query hooks to preserve by name.

## Current styling architecture

**CURRENT_STYLE_ARCHITECTURE: native browser styles + page-local React inline styles + dormant Tailwind-like class strings.** Targeted reinspection confirms no authored global CSS, CSS modules, styled-components/emotion equivalent, CSS reset, Tailwind/PostCSS config or semantic CSS variables in `apps/web`. No reusable component-scoped CSS files or layout stylesheet exists.

`src/app/layout.tsx` sets inline body fontFamily system-ui, margin0 and padding24. OperatorNav defines its own system font stack, palette, padding and border. Inbox uses Georgia, own maxWidth/margins and fixed grid. Offers/Knowledge/Analytics/Onboarding repeat inline cards/forms/metrics. Orders/Quotes have dark utility recipes with no compiled styling. Intrinsic flex wrapping/auto-fit grids coexist with fixed columns and minimum widths; there is no shared breakpoint strategy.

Inline styles can coexist with utility CSS but ordinarily win on the same property; remove a conflicting inline value only inside a migrated slice with evidence. Native/default element styling remains a compatibility baseline. Dormant utilities are TEMPORARY_COMPATIBILITY, not a reason to turn on unprefixed generation globally.

## Target styling architecture

Future paths, all **proposed and absent unless DS-01 says otherwise**:

| Path | Ownership |
|---|---|
| apps/web/postcss.config.mjs | Foundation toolchain owner; Tailwind PostCSS plugin only as required |
| apps/web/src/app/globals.css | Stable stylesheet entry imported once by root layout; no uncontrolled body/reset selectors |
| packages/design-system/src/styles/tokens.css | DS-02 semantic variables and theme scopes; sole final color owner |
| packages/design-system/src/styles/foundation.css | DS-03/04 scoped normalization/type/focus conventions |
| packages/design-system/src/styles/tailwind.css | Tailwind import/source/layer policy; controlled utility namespace |
| packages/design-system/components.json; apps/web/components.json | Package primitive generation owner and web consumption aliases |
| packages/design-system/src/components/ui | Low-level shadcn primitives only |
| packages/design-system/src/components/patterns | Domain-free visual patterns only; business-aware DS-05 patterns live in Client/Admin |
| apps/web/src/client/layouts and apps/web/src/admin/layouts | New shell regions; DS-06 |
| packages/design-system/src/lib/utils.ts | cn class composition/merging adapter |
| apps/web/src/providers/theme-provider.tsx | Theme resolution adapter; DS-02 foundation and later shell adoption |

Keep current src alias; do not create a competing apps/web/components tree. Existing refresh coordination and Supabase helpers now move to web/src/shared; same-origin BFF handlers and shared contracts stay in place. Features/domain folders appear only when orchestration warrants them. This strategy selects ownership, not final token values or package versions.

## Tailwind v4 introduction

Decision: **B + bounded C — omit global Preflight, use a prefixed utility namespace and explicit migration sources.** Scope tokens/normalization to migrated boundaries; prefix provides collision protection for utility selectors even when they are loaded globally.

| Option | Evaluation |
|---|---|
| A: full Preflight immediately | Rejected: can change native headings, buttons, borders, lists and root/page spacing across untouched routes. |
| B: omit Preflight initially | Selected: preserve existing browser baseline; supply reviewed normalization only to adopted primitives/regions. |
| C: stylesheet import in a nested route only | Insufficient alone: navigation/loading can retain CSS and portals escape descendants; also utility selectors can match old classes. Use component markers/prefix instead. |
| D: rewrite all old classes or blanket !important | Rejected: broad changes and difficult rollback; does not preserve inline-style/native baseline. |

Future DS-02 toolchain proposal: workspace-owned `tailwindcss`, `@tailwindcss/postcss`, `postcss`; lock reviewed compatible v4 versions through the existing npm lockfile. Add `postcss.config.mjs` and a single global stylesheet entry only in authorized implementation. Verify local `apps/web/AGENTS.md` and installed Next docs, production/dev build behavior and peer compatibility. No installation validation occurred here. [Official PostCSS installation](https://tailwindcss.com/docs/installation/using-postcss) documents this plugin path; it is a feasibility reference, not proof this repo already passes it.

Import theme and utilities separately, omit preflight.css, and apply a stable `tw` prefix to relevant imports. v4 prefix is variant-like (e.g. `tw:flex`); future generated primitives must consistently use it. Do not copy the full `@import "tailwindcss"` recipe into this coexistence setup. [Preflight documentation](https://tailwindcss.com/docs/preflight) explains selective imports, their configuration placement and reset effects.

Disable automatic broad detection with the supported source control and explicitly list newly adopted component/style/specimen paths; add each migrated route's source deliberately. Never scan the entire monorepo or register old Orders/Quotes as a bulk activation. Use static complete class variants, not interpolated token names. Prefix remains necessary because scan restriction alone cannot stop a generated unprefixed class from matching another element. [Source detection documentation](https://tailwindcss.com/docs/detecting-classes-in-source-files) supports explicit source registration; exact pinned-version syntax and emitted CSS must be verified during DS-02.

Release gate: inspected emitted CSS has no legacy utility activation, no global element reset and no unexpected root background/font/layout rule. Compare all untouched route baselines, not just a new specimen. Add any required border style/box-sizing/font inheritance explicitly within the owned foundation; disabling Preflight means new primitives cannot assume its defaults.

## shadcn/ui introduction

DS-04 owns future primitive expansion after DS-02/03. `packages/design-system/components.json` owns generation into package `src/components/ui`; web configuration references public package exports. Package-local @/* resolves to src/* for tooling, while built implementation uses relative .js imports. Existing `tw` prefix and scoped CSS remain; each added primitive requires an explicit public export and consumer validation. No generator ran in this reorganization.

Use Lucide for icons; `cn` composes conditional class values (clsx) with a v4-compatible tailwind-merge implementation configured/tested for the selected prefix. Document deterministic overrides for size/variant and verify conflicting prefixed classes, RTL variants and state selectors. Dependency versions/primitive accessibility base must be read from the selected registry output rather than assumed.

Run future generator in a reviewed branch and inspect its diff before adoption: it may add global base selectors, theme rules, animations or unprefixed classes. Reject root-wide defaults during coexistence; align generated styles with approved boundary and prefix. Verify portaled content and focus behavior without Preflight. This is a supported bootstrap plan requiring a build/primitive feasibility gate, not an executed initialization.

Retain upstream structural conventions and keep an extension log. Customer/Booking/Conversation components never go in ui. No unnecessary primitive forks or bulk install; start with reference-page primitives and add by consumer demand. [Next installation reference](https://ui.shadcn.com/docs/installation/next) is consulted again at implementation because generator behavior may change.

## Semantic token coexistence

DS-02 owns values in `src/styles/design-system/tokens.css`; ROLL-01 defines names and boundaries only. Use background/foreground, card/card-foreground, popover/popover-foreground, primary/primary-foreground, secondary/secondary-foreground, muted/muted-foreground, accent/accent-foreground, destructive/destructive-foreground, border/input/ring and a later sidebar family. Avoid backend/domain names for raw colors.

Resolve variables within a `[data-ui="ds"]` boundary with explicit resolved theme; Tailwind's prefixed utilities bridge to canonical semantic variables. CSS variable prefixing from Tailwind must not silently rename public product token ownership: test the bridge once in DS-02. Unadopted inline values remain unchanged. Do not map every old literal globally to a new token; map an owned component's role (error foreground, muted border) as that component migrates.

Fallback: legacy pages use their existing explicit values/browser styles; migrated boundaries require a complete default light token set before use. Missing DS tokens are a failed foundation check, not a license to add arbitrary hex fallback in pages. Portals get matching data-ui/theme context or a theme-aware portal container. No final palette is selected here.

## CSS cascade strategy

Declare predictable layer order for theme, base/foundation, components and utilities; keep import ordering explicit at the one entry. Semantic variable declarations are scoped to DS roots/portals. Foundation rules use low specificity and only adopted elements; utility overrides must work inside migrated components. Unlayered and inline rules can outrank layered styles: inspect computed styles and remove old declarations only with the adopting slice.

| Collision | Mitigation / gate |
|---|---|
| Dormant flex/bg/rounded/etc in Orders/Quotes | Prefix all new utilities; source allowlist; verify untouched computed styles. |
| Generic .button/.card/.container | None currently found; do not introduce these as global compatibility classes. Use owned component or DS namespace. |
| input/button/select/table/heading/a selectors | No unscoped element reset or generated universal base apply; normalize only DS-owned boundary. |
| body inline font/padding | Preserve until separate root/shell compatibility milestone; no negative-margin workaround per page. |
| Preflight border/box-sizing defaults | Define necessary rules in scoped foundation and test portal/input/table rendering. |
| Theme root/body selectors | Theme attribute alone must not repaint legacy pages; DS tokens/surfaces own painting. |
| Portal mounting at body | Attach DS markers/theme/dir to portal root; inspect siblings and focus, not only nested page screenshots. |
| CSS imported by multiple routes | Import entry once; test hard load and client navigation both directions. |

No blanket !important or specificity escalation. A utility override losing to inline style is solved by migrating that declaration, not by overriding every legacy property.

## Migration boundaries

Safest unit: one primitive/product family for foundation certification, then one complete **page content region** plus its owned overlays, with old header retained outside the DS boundary until shell rollout. Within that page do not mix old and new controls in the same form/dialog. Old OperatorNav is the only temporary shared region and remains light until its own adoption.

Each slice ledger records: route and owner, source files, baseline revision/screens, adopted boundary/classes/tokens, old consumers, API/action invariants, known defects, required INT/QA gates, cohort/exposure mechanism and rollback commit. No flag framework is assumed to exist; controlled staging with a revert is acceptable initially. ROLL-02 governs any server-resolved exposure config, independently from permissions/capabilities.

Sources remain authored once: share a page implementation across route aliases. Do not maintain two independently evolving Test Assistant trees or nest full old and new shells. Page-local style deletion is coupled to that slice; global/root deletion waits for all consumers.

## App shell migration

Sequence: tokens → primitives → product components and shell **contract/specimens** → isolated Test Assistant content → shared shell exposure. This preserves DS-06/DS-10 prerequisite work while separating shell readiness from global rollout. DS-06 can certify an unexposed ClientShell before UX-03; it must not automatically replace OperatorNav on every route.

First keep root body padding24/font baseline. Reference content is tested within it. When exposing shell later, move root presentation to owned legacy/DS wrappers in one dedicated compatibility commit: legacy wrapper preserves its effective padding/font, migrated shell owns container spacing. That commit has all-route before/after comparison and independent revert. No universal font/heading reset is smuggled into tokens.

Build sidebar/topbar/breadcrumb/mobile navigation/container as one shell region; preserve nav registry and queries. Select exactly one shell per route; content and overlays adopt the same boundary/theme/locale. Replace old header at page-group boundaries after compatibility evidence, without duplicated breadcrumbs/menus. Org/user controls require INT-03 bootstrap; no manual field becomes a trusted organization switcher through styling. Platform Admin shell is separate and cannot expose before platform contracts exist.

## First reference page

**Test Assistant — canonical /test-assistant, UX-03.** It exercises chat typography, buttons, form fields, status/card/trace patterns, loading/empty/error, reset dialogs, themes, Arabic/English and mobile layout while intended mutations are simulated and outbound is blocked. Inbox is deferred because ownership/delivery races make it a higher-risk first adoption.

Reference page is gated on DS-10 and INT-07 plus normal UX-03 prerequisites. AUD-02 session creation and AUD-08 privacy/parity must be resolved in separate integration/behavior changes before claiming a usable reference. These fixes do not belong to DS-02 styling. If those gates are pending, DS foundations progress using a safe static specimen of reference components; that specimen is not a different first product page or agent acceptance substitute.

Keep existing preview implementation single-owned; both current URLs remain working. Canonical routing changes/redirects are a dedicated compatibility change preserving query/session behavior and auth coverage. No route is called legacy merely because it is an alias.

## Legacy style classification

“Legacy” here means pre-design-system styling, not a deprecation claim about routes.

| Class | Examples | Treatment / removal criterion |
|---|---|---|
| KEEP | layout geometry with confirmed domain need; scrollable timeline; native semantics; safe coalescing behavior | Preserve behavior; style value may later be tokenized with tests. |
| TEMPORARY_COMPATIBILITY | root padding24/font; old OperatorNav; unmigrated page inline colors; dormant transaction classes | Keep baseline isolated; ledger tracks remaining consumers. |
| MIGRATE | repeated error/badge/card/form recipes, physical spacing, custom div modal visuals | Transfer to owned tokens/primitives/product patterns in listed UX/DS phase. |
| REMOVE_LATER | duplicated recipes after all callers adopt replacement; unused mobile menu state after reviewed shell migration | Removal is a distinct audited diff with zero active consumers and rollback. |
| UNKNOWN | uncertain one-off declarations and inferred obsolete pages | Investigate consumer/behavior; do not delete or call obsolete from appearance. |

Retirement gate: rg confirms zero source/runtime consumers including imports, string variants, aliases and portals; route ledger is fully adopted; theme/RTL/viewport/keyboard visual evidence passes; typecheck/lint/tests/build pass; old path deep links and rollback reviewed. A text search alone cannot prove runtime absence. No global Preflight activation is necessary at retirement: keep no-Preflight policy unless a separate all-route reset proposal passes its own review.

## Component ownership rules

| Layer | Create when | Examples / boundary |
|---|---|---|
| shadcn primitive in src/components/ui | General interaction with established accessible primitive semantics | Button/Input/Dialog/Table; no fetch or business DTO lifecycle logic. |
| shared DS/product component outside ui | At least two real consumers or approved cross-product invariant | StatusBadge/PageHeader/EmptyState; semantic props and typed display maps. |
| domain product/feature component | Interaction/layout tied to one domain | ConversationRow/HumanTakeoverBanner, BookingCard; compose primitives, backend remains authoritative. |
| page-local helper | One-off content/layout with no stable reuse | Reference scenario description, local illustration; promote only after real reuse. |

Do not extract every repeated div into a configurable mega-component. Separate safe view projections from fetch/mutation adapters. Status display maps may translate canonical enums but cannot alter allowed transitions. Reuse existing helper abstractions where present; never move Supabase secrets or provider credentials into presentational components.

## RTL migration

Introduce global locale/direction under DS-07 as a reviewed behavior boundary, not at initial CSS import. Before that, new DS roots and all owned portal roots carry consistent lang/dir; old header/page local toggles remain documented compatibility state. After global adoption, remove those toggles page by page and preserve drafts/focus. Do not globally set dir and assume fixed-direction old layouts are now correct.

Use margin/padding-inline, inset-inline and start/end alignment where semantics are directional. Physical timeline/channel identifiers may intentionally remain LTR with bdi/dir isolation. Sidebar uses inline-start; sheets/drawers anchor based on direction; arrows/back/breadcrumb separators mirror, status icons/logos do not. Chat bubbles align by speaker and reading direction through a documented rule; never infer speaker from left/right. Table headings/actions and form labels align logically; phone/email/code/time/currency remain readable. QA-05 checks portals and mixed-language rows, not just the sidebar. Ownership: DS-07/UX slice, with QA-05 evidence.

## Dark mode migration

Stage A: token/primitive specimens support light/dark/system within DS boundaries. Stage B: complete migrated pages and overlays share resolved theme; old header is explicitly light. Stage C: untouched pages stay **temporarily light-only**, with explicit background/foreground/color-scheme compatibility where needed. They do not inherit dark colors that conflict with their hardcoded light surfaces. Do not darken arbitrary old cards by token replacement.

Future next-themes provider resolves preference/system and a dedicated theme attribute; import/provider behavior must be checked for hydration and CSP. Mount theme controls only on pages certified for all themes; preserve selected preference when visiting light-only legacy pages and make the temporary supported theme understandable. Light-only rendering is a scope rule, not changing the saved preference.

Boundary marker carries resolved theme into portals/toasts. Root body/legacy wrapper remains neutral/light until shell compatibility rollout; migrated page owns its surface so no unreadable mixed foreground/background inheritance. Test OS preference changes, first load/hydration, navigation between migrated and old pages, reset dialog and theme toggling with dirty draft. DS-02 defines values; this plan only defines containment and progression.

## Capability-driven navigation migration

Keep `packages/contracts/src/navigation.ts` registry and bilingual labels. New shell initially adapts its evaluated destinations, preserving href/query behavior and coming-soon omission. Normalize active selection against canonical pathname while handling existing settings-ai current-ID mismatch in a separate tested shell change.

INT-02/03 own authoritative capabilities/membership bootstrap and fail-safe pending/error/denied outcomes. Preserve backend checks and do not intentionally enshrine permissive defaults: audit defect fixes need separate evidence, not silent CSS changes. Hide irrelevant destinations by capability; show a useful forbidden state on an attempted unauthorized direct link where appropriate. Rollout exposure cannot create grants. No invented supportsPackages, new platform role or client ADMIN elevation.

Centralization order: verified bootstrap contract → adapter for existing registry → route and action presentation guards → new shell rendering. Do not redesign backend authorization or rename real role semantics in ROLL-01.

## Test Assistant migration

Keep production orchestrator reuse and PREVIEW read-only/simulated/blocked adapter policies; preserve no production outbound and no real business mutation invariants. Existing alternate intent/adapter paths and conditional fake fallback are evidence limits, not established parity. Real-provider acceptance must audit configured provider/model and actual calls; fixtures never substitute for it.

Separate customer-like chat, draft/send/loading/status and reset/new-session controls from optional execution metadata. Always display TEST MODE; metadata is collapsed and allowlisted for workflow/tool/status/timing/reviewed simulation effects. No hidden prompts, chain-of-thought, secrets, raw provider bodies or arbitrary working-state/tool payload dumps. INT-07 owns server-created IDs, expiry/restart handling, session authorization scope and safe trace projection. UX-03 owns chat integration. Visual slice retains those verified adapters and does not modify execution mode or tool policy.

Both /test-assistant and /settings/ai/preview resolve one implementation during coexistence; later redirect has auth/deep-link tests. A new test session must remain server-issued; reset remains a separate clearly named operation. No Meta simulator/live endpoint is added to the chat migration.

## Migration wave plan

Internal milestones below are strategy checkpoints, **not new top-level phase IDs** and not started work. W1–W6 are the six product migration waves; Preparation/Foundation/Shell/Retirement are supporting milestones.

| Milestone / wave | Scope | Dependencies and gate | Risk | Rollback complexity / owner |
|---|---|---|---|---|
| Preparation | Record named owners, baseline revision, route/state screenshots and API invariants; preserve all 52 authored routes | DS-01 and this strategy; actual captures before implementation | M | Low; docs/evidence only; release owner |
| Foundation | Toolchain/prefixed no-Preflight coexistence, tokens, type, primitives, patterns, shell specimens | DS-02..10 with QA-01..05; untouched-route non-regression gate | H | Medium; reverse dependent adoption before removing imports/packages; foundation owner |
| W1 reference | Test Assistant content/overlays, both URL entry paths | DS-10, INT-01..07, UX-03; AUD-02/03/04/05/08 relevant gates | H until preview defects resolved | Low–medium; one page adapter/presentation commit; UX-03 owner |
| Shell adoption | Replace header/container for W1 then each ready route group; keep old wrapper for remaining pages | DS-06/07/08/09, INT-02/03; dedicated root compatibility snapshots | H | Medium; shell/root wrapper commit reversible independently; shell owner |
| W2 settings/information | Company Information, Business Rules, AI/general/channels/templates, onboarding and follow-up compatibility | UX-08/09/11/13 as applicable; permissions/form gates; preserve pack/knowledge lifecycles | H for writes | Medium; per route, not one all-settings commit; domain owners |
| W3 customer/catalog/growth | Customers/Leads/Catalog/Offers/Team; new routes only when proxies/contracts verified | UX-04/05/06/07/11 and INT gates; dependent order within wave | H | Medium; per domain/overlays; customer/catalog/team owners |
| W4 operational | Overview, Inbox, Bookings/Schedule/Orders/Quotes | UX-01/02/10 and listed prerequisites; epoch/conflict/delivery evidence, AUD-01 styling resolution | H | Medium–high for live drafts; revert UI without replaying mutations; operations owner |
| W5 analytics | Business charts/funnels/tables and performance tuning | UX-12 and transactional predecessors; QA-06 metrics | M | Low–medium; page/component adoption; analytics owner |
| W6 operator | Platform Admin shell/organizations/access/usage/billing/health/queues/audit/flags/support/settings | ADMIN phases and independent operator contracts; cannot infer readiness from client wave | H | High when operational writes exist; separate operator cohort/action gates; platform UI owner |
| Retirement | Remove proven-unused old style recipes/wrappers; optional prefix retention review | All affected wave consumers migrated and retirement gates passed | M | Medium; isolated removal commit; foundation + release owner |

Wave priority is exposure priority, not permission to violate dependencies. UX-04/06/08/11 can be prepared in parallel after W1; Business Rules waits for Company Information and transactions wait for customer/catalog/rules. Settings integrations waits for Team. Overview can be developed early but broad operational shell rollout remains W4. Local staging first; controlled cohort later under ROLL-02. ROLL-03 manages staged delivery and QA-08/ROLL-04 global completion. W6 gaps cannot be silently removed from global acceptance or delay an independently safe client pilot.

## Critical/high finding ownership

The DS-01 “Critical” count is two implementation BLOCKERs, not confirmed exploits. All 2/2 and 7/7 are assigned below; no finding is declared fixed by this strategy.

| ID / severity | Migration impact | Accountable future role / phase | Blocking scope | Required timing / evidence |
|---|---|---|---|---|
| AUD-01 critical/blocker: dormant transaction styling | Broad utility enablement would accidentally repaint layout/overlays | Foundation owner DS-02/04; transaction owner UX-10 | Blocks unprefixed global enablement and Orders/Quotes adoption | Containment tested before foundation exposure; intended visuals/interaction certified before W4 |
| AUD-02 critical/blocker: invented preview ID | Reference cannot initialize a real session | Preview integration owner INT-07 / UX-03 | Blocks W1 enabled reference, not token/specimen work | Server-issued create/get/reset flow before reference acceptance |
| AUD-03 high: auth matcher omissions | New shell/alias could imply protected entry without matching redirect | Auth integration owner INT-03; security reviewer QA-07 | Blocks exposure of affected routes/aliases | Separate redirect/direct API denial tests before W1/affected waves |
| AUD-04 high: permissive/stale capability and role handling | Nav migration may preserve misleading controls or stale context | Capability/auth owners INT-02/03 | Blocks shell/affected actions, not static foundations | Verified pending/error/role states and capability-disable tests before exposure |
| AUD-05 high: scattered tenant context/races | Presentation change can retain stale tenant data/draft | Data integration owner INT-04/05 | Blocks integrated tenant-switchable wave | Late-response/cache/draft isolation tests before each page rollout |
| AUD-06 high: custom inaccessible overlays | New presentation can conceal unusable modal behavior | Primitive owner DS-04; accessibility reviewer QA-03 | Blocks any migrated overlay | Keyboard/focus/Escape/restore and portal tests before slice exposure |
| AUD-07 high: label associations missing | Visual forms may remain unnamed to assistive tech | Form/primitive owner DS-04; QA-03 | Blocks migrated forms | Explicit IDs/labels, errors and screen-reader check before slice exposure |
| AUD-08 high: trace privacy/parity | Reference could expose unsafe metadata or misleading production equivalence | Preview owner INT-07/UX-03; QA-07 | Blocks debug/real-provider reference acceptance | Safe projection, policy/no-outbound and audited real-provider tests before W1 acceptance; hide debug if gate not met |
| AUD-09 high: no operator contracts | Client shell work could accidentally grant platform access | Contract owner INT-01; platform owner ADMIN-01 | Blocks W6; non-blocking for isolated client/DS work | Reviewed operator identity/API/audit contracts before operator pages enabled |

No styling PR weakens an assertion to pass these gates. Contract/behavior remediation is separately scoped and reviewed. If a gap cannot be resolved, the affected slice remains unexposed while unrelated foundations continue.

## Visual regression strategy

Minimal viable future approach: local Playwright browser screenshots and interaction flows, version-controlled reviewed baselines with deterministic safe DTO fixtures. No current Playwright harness exists; QA-02 owns setup, QA-01 integration. Storybook is optional only after component consumers justify it; Chromatic/cloud uploads are not needed and not planned.

Capture pre-migration legacy pages first, including empty/loading/error/denied and open overlays where safe. Separate expected new-design screenshots from untouched-route non-regression snapshots; do not bless every diff as intended. Cover English LTR/Arabic RTL × phone320/375, tablet768, desktop1440 (1920 large-desktop smoke). Migrated pages also light/dark/system-resolved variants, long Arabic/mixed identifiers, zoom and portal content. Legacy pages remain light-only but are checked after both theme navigations.

Fix browser/font/device-scale versions and clock/dataset; mask only approved volatile content, never focus/status/error/delivery labels. Keep private records/screenshots out of fixtures. Record hard reload and old→new→old navigation to catch persistent CSS collisions. Local fixture screenshots verify CSS and states; integrated real-provider/tenant/action tests verify semantics separately. Preserve baseline failures as known findings until separately fixed; new diffs require implementer and reviewer rationale.

## Accessibility regression strategy

Future QA-03 adds Playwright plus axe-core integration to critical page/dialog states, sharing the minimal browser harness. It complements keyboard-only and selected screen-reader checks, not replaces them. Record initial baseline violations and require no new serious/critical violations; migrated slices must resolve their relevant HIGH findings before release.

Manual matrix: Tab/Shift-Tab/Enter/Escape, visible focus, logical order, overlay trap/restoration, label/error association, announcements without timeline spam, theme contrast, 200% zoom/reflow, reduced motion and Arabic reading metadata. Check native controls after no-Preflight foundation and portal theming. WCAG 2.2 AA remains a target until measured evidence exists. No compliance assertion is made by this documentation.

## Quality gates

Every future slice needs a ledger with owner/reviewer/date/revision, exact command results, screenshots/diff decisions, locale/theme/viewport evidence and rollback instructions.

| Gate | Requirement |
|---|---|
| TYPECHECK | npm run typecheck -w @ai-sales-agent/web PASS |
| LINT | npm run lint -w @ai-sales-agent/web PASS; record that currently this is tsc |
| TESTS | Existing node --import tsx --test apps/web/src/shared/utils/dashboard-refresh.test.ts PASS plus focused new slice tests under approved harness |
| BUILD | npm run build -w @ai-sales-agent/web PASS; inspect emitted CSS/source scoping after toolchain changes |
| VISUAL_REGRESSION | PASS for migrated states and unchanged-route smoke; fixture masking/diff rationale reviewed |
| RTL_CHECK | PASS for both locales, root/portal direction and mixed identifiers |
| RESPONSIVE_CHECK | PASS at supported widths/keyboard/zoom; overflow allowed only inside labeled regions |
| ACCESSIBILITY_CHECK | PASS automated + manual relevant interactions; no unresolved blocking slice findings |
| SEMANTIC/SECURITY | Same API/action contracts, no tenant/auth/capability regression, preview policies/outbound boundaries preserved |

Global toolchain/root changes trigger all-route CSS regression, not only one slice. Feature adapters trigger focused contract/integration checks and existing platform quality gates appropriate to the change. Scope exclusions need evidence: a docs-only change does not need CSS screenshots, but a migrated button cannot omit relevant focus/label checks. No assertion weakening, provider substitution or zero-data metrics to make acceptance pass.

## Rollback strategy

Small commits separate dependency/stylesheet bootstrap, token/primitive family, integration defect fix, page presentation, root/shell compatibility and retirement. A page rollback reverts its adoption and boundary/source registration, preserving the separately fixed API/security adapter. Reverse topological order: consumers before shared primitives/toolchain removal. Keep package-lock changes paired with their bootstrap commit.

For each slice record exact last-known-good revision and revert command/commit list, exposure config revision if any, operator performing rollback and checks after rollback. Preview/Inbox/transaction actions already accepted server-side remain accepted; reverting UI never replays or “undoes” business writes. Preserve draft safely or warn before transition; do not persist sensitive transcript just to support rollback.

Use a controlled staging deployment/revert until ROLL-02 exposure mechanism is verified. A feature flag never bypasses security. Root shell commit can restore the old wrapper/header without deleting new tested primitives. Avoid destructive global CSS retirement; its separate removal commit is recoverable. Rollback drill checks old URLs, aliases, auth, tenant context, empty/errors, basic responsive view and relevant action semantics before wider exposure.

## Risks

Prefix/shadcn/class-merge compatibility and no-Preflight primitive defaults require an executed future feasibility check; official docs are not repo compilation proof. Generated global base rules and portaled tokens can escape containment. Root inline padding and independently scoped headers risk visual inconsistency; dedicated wrapper rollout mitigates it. Current screenshots/accessibility runtime evidence are absent until Preparation/QA; DS-01 remains a static audit.

Preview defects can delay reference adoption while tokens/specimens progress. Shell/data changes combined in one PR obscure rollback and risk stale tenant behavior. Dormant transaction styles are known broken intent, so first-generation styling needs explicit approved new baseline. Unverified admin contracts block W6 only. These are planning risks with timing/owners above; none justifies backend changes or skipping gates.

## Non-goals

No DS-02 implementation or final palette, no Tailwind/shadcn/theme install, no current CSS/page/component modifications, no backend/schema/migration changes, no auth redesign or permission invention, no Big Bang rewrite, no customer portal, no Meta contact and no real-provider acceptance run during this phase. Real Meta live acceptance remains separate; MB15 stays NOT_CLOSED.

## Acceptance criteria

- [x] Current CSS and future ownership paths documented from DS-01 and targeted source inspection.
- [x] Tailwind coexistence, prefix/source containment, Preflight alternatives and collision policy chosen.
- [x] shadcn bootstrap/aliases/class merging and semantic token ownership defined without implementation.
- [x] Incremental boundaries, shell sequencing and Test Assistant reference chosen.
- [x] Legacy classification/removal gates and component ownership defined.
- [x] RTL and light-only legacy/dark-mode progression defined.
- [x] Business/data invariants and capability navigation migration preserved with separate defect owners.
- [x] Test Assistant session/debug/parity and preview-to-production gates explicit.
- [x] Six product waves, supporting milestones, dependencies and rollback owners defined.
- [x] All two Critical/blocking and seven High DS-01 findings assigned with scope/timing.
- [x] Minimal visual/accessibility tools, evidence matrix and quality gates defined.
- [x] Per-slice rollback and reverse dependency order defined.
- [x] DS-02 planning prerequisites satisfied; unresolved implementation gates remain visible.
- [x] Only roadmap documentation changed and phase status consistency checked.

## Exit gate

**PASS for migration strategy planning.** Required decisions and every Critical/High owner/timing are recorded. DS-01 and ROLL-01 are COMPLETE; INT-01 and all other implementation phases remain NOT_STARTED. Baseline evidence is reused and runtime/style feasibility remains an implementation gate, not a missing strategy decision. Master and section indexes are synchronized; no production changes. Stop after reporting.

## DS-02 prerequisites

**DS02_READY: YES to begin the next separately requested phase, not started here.** Its roadmap prerequisites DS-01 and ROLL-01 are COMPLETE. The dependency correction reflects this request's planning scope; INT-01 remains required for integrated feature adapters and rollout.

DS-02 kickoff checklist (execution tasks within DS-02, not a claim they have already passed): review semantic names/value proposals; pin compatible toolchain; read installed Next guidance; verify prefixed imports/source controls/no-Preflight generated CSS; prove no untouched-route changes; choose boundary tokens/theme/hydration; keep body font/padding compatibility; record named owners and rollback commit. No shadcn bootstrap or major pages start until their DS-03/04/10 gates. Final theme values and styling implementation require the user's next phase instruction.

## Frontend ownership update (2026-10-03)

The authoritative [frontend monorepo architecture](../architecture/frontend-monorepo-architecture.md) assigns visual primitives/tokens to `packages/design-system`, Business Client to `apps/web/src/client`, Platform Admin to `apps/web/src/admin`, shared web infrastructure to `apps/web/src/shared`, and app composition to `apps/web/src/providers`. Route entrypoints stay in `apps/web/src/app`. Historical observations above retain their original context; current paths are recorded in the ownership inventory. DS-01 and ROLL-01 remain COMPLETE. At reorganization DS-02 was reset to NOT_STARTED for package-based revalidation; the master roadmap records subsequent completion. No new token/theme implementation occurred during reorganization.
