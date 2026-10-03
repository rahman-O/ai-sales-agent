# DS-01 Design Audit & Baseline

## Status

**COMPLETE — investigation and documentation only.** Inspected 2026-10-03. DS-02 is NOT_STARTED. Production code, backend behavior and schema were not changed. No Meta or provider requests were made.

Method: source/config/dependency inventory, all authored page and handler inventory, focused source tracing and existing frontend-safe commands. Responsive/accessibility conclusions are static risk assessments; no authenticated browser, screen-reader, contrast measurement or screenshot certification was performed. Audit completion does not mean WCAG compliance, UI acceptance or production readiness. “Not found” is scoped to the inspected frontend source/package configuration.

## Objective

Establish a source-grounded baseline of the existing frontend before tokens or new components are introduced. Preserve operational behavior and identify future work owners without solving later phases.

## Repository frontend overview

Frontend root: `apps/web/`; npm workspaces in root `package.json` cover `apps/*` and `packages/*`, with root `package-lock.json`. Uses App Router at `apps/web/src/app`, not Pages Router. Only one authored layout exists: `apps/web/src/app/layout.tsx`. Page-local UI dominates; `src/components` contains only OperatorNav and CapabilityGuard, `src/lib` contains Supabase helpers and dashboard-refresh. No features/hooks/providers tree was found.

Configuration: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/next-env.d.ts`, `apps/web/src/proxy.ts`. Alias `@/*` targets `./src/*`; strict TypeScript, bundler resolution, incremental noEmit, test files excluded. Next transpiles shared config/contracts. Future code work must read `apps/web/AGENTS.md` and installed Next documentation as directed there.

Environment is consumed in `src/lib/supabase/{browser,server}.ts`, `src/proxy.ts`, auth callback and proxy handlers: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, API_URL and NEXT_PUBLIC_API_URL. No values were read or recorded. No frontend-local env file was enumerated in the frontend file tree; private root environment files were intentionally not opened. `next-env.d.ts` is generated type setup, not runtime configuration. `docs/ai-sales-agent/10-devops/environments.md` documents environment architecture.

## Versions and tooling

| Tool | Verified version/state | Evidence |
|---|---|---|
| Next.js | 16.3.6 | apps/web/package.json; successful build banner |
| React / React DOM | 19.1.1 | apps/web/package.json |
| TypeScript | 5.9.2 | apps/web/package.json |
| Supabase SSR / client | 0.7.0 / 2.58.0 | apps/web/package.json |
| Node / npm used | 24.12.0 / 11.7.0 | node -p process.version; npm --version |
| Tailwind | NOT_INSTALLED / NOT_CONFIGURED | No frontend dependency, CSS, PostCSS or Tailwind configuration |
| shadcn / Radix primitives | NOT_PRESENT | No components.json or components/ui tree/dependencies |
| TanStack Query/Table, RHF, Lucide, Sonner, next-themes | NOT_INSTALLED | frontend dependency inventory |
| Zod | Shared contract schemas exist; no direct web dependency/use found | packages/contracts; frontend imports |

Existing baseline commands executed without loading private env files:

| Check | Exact command | Result |
|---|---|---|
| Typecheck | npm run typecheck -w @ai-sales-agent/web | PASS, exit 0 |
| Lint | npm run lint -w @ai-sales-agent/web | PASS, exit 0; same tsc command, not ESLint |
| Existing frontend tests | node --import tsx --test apps/web/src/lib/dashboard-refresh.test.ts | PASS, 3/3, exit 0 |
| Build | npm run build -w @ai-sales-agent/web | PASS, exit 0; Turbopack compilation, type validation and page generation |

No web npm test/e2e script exists; the test result is only the existing Node helper suite, not a component/browser suite. Root npm test omits the web workspace. Build success does not mean styles, authorization UX or preview sessions work. Generated ignored build artifacts are expected; no product source edits were needed.

## Route inventory

Counts: **22 authored page routes + 30 authored HTTP handler routes = 52 authored routes**. Next also generates /_not-found (53 build-listed routes including that framework route). ROUTES_FOUND below uses 52; it excludes generated not-found and static assets. Route families with [[...path]] are counted once, not as every possible URL. ACTIVE means a bounded implemented function, PARTIAL means functional code with unverified/incomplete product behavior, PLACEHOLDER means source explicitly provides a foundation screen. No route is called LEGACY without evidence.

All page owners use root layout. “Nav” below means page-composed OperatorNav; it is not a nested authenticated layout. Backend organization authorization remains required even where frontend context is manual.

| Page | Owner | Purpose / class | Frontend auth | Org context | Visible permission / capability | Layout / major dependencies |
|---|---|---|---|---|---|---|
| /analytics | `apps/web/src/app/analytics/page.tsx` | Funnels, intents, catalog and transactions; PARTIAL | Proxy when Supabase configured | Page input/query/storage; varies by page | No restriction in registry; Registry None | root + Nav; client fetch/state |
| /app | `apps/web/src/app/app/page.tsx` | Verified-user foundation screen; PLACEHOLDER | Proxy when Supabase configured + server getUser redirect | None | Not wired; Registry None | root + own markup; Next server component/links |
| /bookings | `apps/web/src/app/bookings/page.tsx` | Booking list and cancel; PARTIAL | Proxy when Supabase configured | Page input/query/storage; varies by page | No restriction in registry; Guard supportsBooking | root + Nav; client fetch/state |
| /dashboard | `apps/web/src/app/dashboard/page.tsx` | Operational summary and attention; PARTIAL | Proxy when Supabase configured | Page input/query/storage; varies by page | No restriction in registry; Registry None | root + Nav; client fetch/state |
| /follow-ups | `apps/web/src/app/follow-ups/page.tsx` | Follow-up queue and actions; PARTIAL | Proxy when Supabase configured | Page input/query/storage; varies by page | No restriction in registry; Registry None | root + Nav; client fetch/state |
| /inbox | `apps/web/src/app/inbox/page.tsx` | Conversation list, timeline, takeover and replies; PARTIAL | Proxy when Supabase configured | Page input/query/storage; varies by page | No restriction in registry; Registry None | root + Nav; client fetch/state |
| /knowledge | `apps/web/src/app/knowledge/page.tsx` | Text, FAQ, upload, search and publication; PARTIAL | Proxy when Supabase configured | auth/me active org | No restriction in registry; Registry None | root + Nav; client fetch/state |
| /leads | `apps/web/src/app/leads/page.tsx` | List, detail, notes/activity; PARTIAL | Proxy when Supabase configured | Page input/query/storage; varies by page | No restriction in registry; Guard supportsLeads | root + Nav; client fetch/state |
| /login | `apps/web/src/app/login/page.tsx` | Supabase authentication/sign-out; ACTIVE | Public | None | Not wired; Registry None | root + own markup; client fetch/state |
| /offers | `apps/web/src/app/offers/page.tsx` | Offer CRUD and lifecycle; PARTIAL | No page proxy match | auth/me active org | No restriction in registry; Guard supportsOffers | root + Nav; client fetch/state |
| /onboarding | `apps/web/src/app/onboarding/page.tsx` | Business profile, capabilities and pack setup; PARTIAL | Proxy when Supabase configured | Page input/query/storage; varies by page | Not wired; Registry None | root + own markup; client fetch/state |
| /orders | `apps/web/src/app/orders/page.tsx` | Order create/list/detail/lifecycle; PARTIAL | No page proxy match | auth/me active org | No restriction in registry; Guard supportsOrders | root + Nav; client fetch/state |
| / | `apps/web/src/app/page.tsx` | Foundation landing links; PLACEHOLDER | Public | None | Not wired; Registry None | root + own markup; Next server component/links |
| /policies | `apps/web/src/app/policies/page.tsx` | Policies/effective rules/drafts; PARTIAL | Proxy when Supabase configured | auth/me active org | Explicit OWNER/ADMIN page gate; Registry None | root + Nav; client fetch/state |
| /quotes | `apps/web/src/app/quotes/page.tsx` | Quote create/list/detail/lifecycle; PARTIAL | No page proxy match | auth/me active org | No restriction in registry; Guard supportsQuotes | root + Nav; client fetch/state |
| /schedule | `apps/web/src/app/schedule/page.tsx` | Rules and exceptions; PARTIAL | Proxy when Supabase configured | Page input/query/storage; varies by page | No restriction in registry; Guard supportsBooking | root + Nav; client fetch/state |
| /settings/ai | `apps/web/src/app/settings/ai/page.tsx` | Conversation profile/personality; PARTIAL | Proxy when Supabase configured | auth/me active org | Explicit OWNER/ADMIN edit gate; Registry None | root + Nav; client fetch/state |
| /settings/ai/preview | `apps/web/src/app/settings/ai/preview/page.tsx` | Preview chat and trace panel; PARTIAL | Proxy when Supabase configured | auth/me active org | Not wired; Registry None | root + Nav; client fetch/state |
| /settings/channels | `apps/web/src/app/settings/channels/page.tsx` | Channel setup and verify control; PARTIAL | Proxy when Supabase configured | Page input/query/storage; varies by page | ['OWNER', 'ADMIN']; Registry None | root + Nav; client fetch/state |
| /settings/templates | `apps/web/src/app/settings/templates/page.tsx` | Message templates; PARTIAL | Proxy when Supabase configured | Page input/query/storage; varies by page | ['OWNER', 'ADMIN']; Registry None | root + Nav; client fetch/state |
| /test-assistant | `apps/web/src/app/test-assistant/page.tsx` | Alias re-export of preview page; PARTIAL | No page proxy match | auth/me active org | Not wired; Registry None | root + Nav; client fetch/state |
| /unauthorized | `apps/web/src/app/unauthorized/page.tsx` | Permission message; ACTIVE | Public | None | Not wired; Registry None | root + own markup; Next server component/links |

Proxy matching omits /offers, /orders, /quotes and /test-assistant. Their same-origin API requests still require session/bearer verification; this finding does not establish a backend data leak. Missing Supabase config causes proxy pass-through even for configured protected routes. No frontend org switcher enforces active membership centrally.

HTTP route inventory (handler source is authoritative; callable backend suffixes require controller mapping):

| Route | Source | Methods | Purpose / class / requirements |
|---|---|---|---|
| /api/backend/business-packs | `apps/web/src/app/api/backend/business-packs/route.ts` | GET | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/me | `apps/web/src/app/api/backend/me/route.ts` | GET | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/analytics/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/analytics/[[...path]]/route.ts` | GET | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/analytics/overview | `apps/web/src/app/api/backend/organizations/[organizationId]/analytics/overview/route.ts` | GET | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/availability | `apps/web/src/app/api/backend/organizations/[organizationId]/availability/route.ts` | GET | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/bookings/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/bookings/[[...path]]/route.ts` | GET, POST | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/capabilities | `apps/web/src/app/api/backend/organizations/[organizationId]/capabilities/route.ts` | GET, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/catalog/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/catalog/[[...path]]/route.ts` | GET, POST, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/channels/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/channels/[[...path]]/route.ts` | GET, POST, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/conversation-profile | `apps/web/src/app/api/backend/organizations/[organizationId]/conversation-profile/route.ts` | GET, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/conversations/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/conversations/[[...path]]/route.ts` | GET, POST, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/conversations/events | `apps/web/src/app/api/backend/organizations/[organizationId]/conversations/events/route.ts` | GET | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/dashboard | `apps/web/src/app/api/backend/organizations/[organizationId]/dashboard/route.ts` | GET | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/follow-ups/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/follow-ups/[[...path]]/route.ts` | GET, POST, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/knowledge/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/knowledge/[[...path]]/route.ts` | GET, POST, DELETE | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/leads/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/leads/[[...path]]/route.ts` | GET, POST, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/message-templates/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/message-templates/[[...path]]/route.ts` | GET, POST, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/offers/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/offers/[[...path]]/route.ts` | GET, POST, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/onboarding/complete | `apps/web/src/app/api/backend/organizations/[organizationId]/onboarding/complete/route.ts` | POST | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/onboarding | `apps/web/src/app/api/backend/organizations/[organizationId]/onboarding/route.ts` | GET | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/onboarding-progress | `apps/web/src/app/api/backend/organizations/[organizationId]/onboarding-progress/route.ts` | PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/orders/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/orders/[[...path]]/route.ts` | GET, POST, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/packs/[packId]/apply | `apps/web/src/app/api/backend/organizations/[organizationId]/packs/[packId]/apply/route.ts` | POST | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/packs/[packId]/preview | `apps/web/src/app/api/backend/organizations/[organizationId]/packs/[packId]/preview/route.ts` | POST | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/policies/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/policies/[[...path]]/route.ts` | GET, POST, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/preview/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/preview/[[...path]]/route.ts` | GET, POST | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/profile | `apps/web/src/app/api/backend/organizations/[organizationId]/profile/route.ts` | GET, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/quotes/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/quotes/[[...path]]/route.ts` | GET, POST, PATCH | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /api/backend/organizations/[organizationId]/schedule/[[...path]] | `apps/web/src/app/api/backend/organizations/[organizationId]/schedule/[[...path]]/route.ts` | GET, POST | BFF forwarding; ACTIVE as adapter, downstream actions not universally verified; Supabase session + backend bearer auth; org ID for organization paths, membership checked backend |
| /auth/callback | `apps/web/src/app/auth/callback/route.ts` | GET | Auth code callback; ACTIVE; public entry validates/exchanges auth code; no org |


## Application shell

One root body supplies system-ui, margin 0 and padding 24. Feature pages invent max width, margins, typography and layout. There is no shared authenticated layout, sidebar, breadcrumb, user menu, notification center or organization switcher. OperatorNav is a wrapping horizontal header with grouped links and onboarding/language controls. mobileMenuOpen state exists but is not used to render mobile navigation.

Inbox uses Georgia and maxWidth 960 with a fixed two-column grid (`inbox/page.tsx:155,203`); dashboard uses its own page and metric layout; Orders/Quotes attempt a full-screen flex shell in utility classes (`orders/page.tsx:141`, `quotes/page.tsx:141`). Root padding compounds page padding. Organization ID fields are developer-oriented input, not a membership switcher. No shared toast infrastructure was found. Replacement belongs to DS-06 after foundation approval, not this audit.

## Navigation architecture

`packages/contracts/src/navigation.ts` DASHBOARD_NAV_ITEMS → filterNavItems(capabilities, optional role, includeComingSoon=false) → `apps/web/src/components/OperatorNav.tsx` grouping WORKSPACE/OPERATIONS/GROWTH/ADMIN → Next Link with orgId query → page-composed header. Labels are bilingual; current selection compares href strings.

Org resolution uses prop, then URL orgId/localStorage ai_sales_org_id. Capabilities initialize to DEFAULT_ORGANIZATION_CAPABILITIES and failed fetch keeps defaults. Role is optional; most callers omit it. Registry role constraints are skipped when role is undefined. Unknown route is allowed by evaluateRouteAccess. Coming-soon products/inventory/listings are omitted. ADMIN group is client settings, not SaaS admin. Test Assistant is not its own registry item; settings page links and alias give access. `settings/ai/page.tsx` passes current="settings-ai" while nav compares href, creating an active-state mismatch.

CapabilityGuard fetches independently, passes no role to evaluateRouteAccess, renders children when no org, and uses defaults after error. Its error state is collected but not rendered as a bootstrap failure. This is partial centralization of relevance, not authorization.

## shadcn inventory

**SHADCN_PRESENT: NO. SHADCN_COMPONENTS_FOUND: 0.** No `apps/web/components.json`, `src/components/ui`, CSS or Radix primitive dependency was found. Stock/light/heavy/unknown classifications therefore have zero entries; there are no existing primitive forks to preserve or upgrade. Native HTML buttons/inputs/selects and custom div overlays are not shadcn components. No component overwrite or package installation occurred.

## Component inventory

A. UI primitives: zero extracted primitives; native elements embedded in pages.

B. Shared product component: **1 — CapabilityGuard**, reusable capability/unsupported-state boundary, not permission authority. C. Layout component: **1 — OperatorNav**. RootLayout and GlobalError are app boundary files, not shared product patterns. Counts distinguish categories; there are 2 exported cross-page custom components total.

| Component | Source | Direct page consumers | Future disposition |
|---|---|---|---|
| OperatorNav | `apps/web/src/components/OperatorNav.tsx` | 16: /analytics, /bookings, /dashboard, /follow-ups, /inbox, /knowledge, /leads, /offers, /orders, /policies, /quotes, /schedule, /settings/ai, /settings/ai/preview, /settings/channels, /settings/templates | Preserve registry adapter; replace visual shell in DS-06, bootstrap in INT-02/03 |
| CapabilityGuard | `apps/web/src/components/CapabilityGuard.tsx` | 6: /bookings, /leads, /offers, /orders, /quotes, /schedule | Preserve intent, replace permissive fallback and typed boundary in INT-02; compose DS-05 states |

D. Feature-local components: dashboard SummaryCard (`dashboard/page.tsx:348`), analytics MetricCard/FunnelView (`analytics/page.tsx:449,467`) and onboarding CapabilityCard (`onboarding/page.tsx:1168`). Each has one owning page, often multiple instances; metric visuals inform DS-05 but FunnelView remains domain-specific. Offer badge helper remains local. Page-specific types, fetch and handlers are co-located, not feature modules.

E. Duplicated patterns: metrics/cards, error panels, org fields, form rows, status labels and custom overlays across Orders/Quotes/Offers/Knowledge. F. Potentially obsolete: foundation /app and / screens plus preview alias need a migration decision, not deletion. No verified obsolete component exists; unused mobileMenuOpen state is navigation debt. Do not classify the alias as LEGACY merely because it re-exports.

## Theme baseline

DARK_MODE_CURRENT_STATE: NOT_IMPLEMENTED as a configurable theme. No CSS variables, semantic token names, theme provider, next-themes, theme persistence or system preference branch found. background/foreground/card/primary/secondary/muted/accent/destructive/border/input/ring/sidebar are not a configured token namespace. Hardcoded light inline colors dominate. Orders and Quotes contain dark slate utilities, but these are uncompiled class names, not working dark-mode infrastructure. No sidebar-specific token set. DS-02 must choose semantic foundation before feature migration.

## Visual consistency findings

| Concrete evidence | Current issue | Future owner |
|---|---|---|
| Orders/Quotes page class recipes: bg-slate-950, text-slate-100, border-slate-800, rounded-xl, shadow-2xl | Tailwind-looking classes exist without configured CSS; intended dark shell/modal/overflow styling is not supplied by the repo | DS-02/04; UX-10 |
| OperatorNav hardcoded #f8fafc/#e2e8f0/#1d4ed8/#dbeafe and inline radius 4/6 | Shared visual choices local to header | DS-02/06 |
| Offers overlay #fff, radius 8, rgba shadow; Orders/Quotes duplicated utility overlays | Different visual recipes and independent interaction semantics | DS-04/05 |
| Inbox error #a00; Policies alert #fee2e2/#991b1b; Knowledge own red errors | No semantic shared error presentation | DS-02/05; INT-06 |
| Dashboard SummaryCard vs Analytics MetricCard vs onboarding CapabilityCard | Local card padding/type/status decisions repeated | DS-05 |
| Root padding24, inbox padding16, page-local rem spacing and widths | Inconsistent container and density | DS-03/06 |

This flags duplicated decisions, not all utility use. Literal values are baseline facts, not approved future tokens.

## Typography baseline

Root system-ui; OperatorNav explicit system/-apple-system/BlinkMacSystemFont/Segoe UI/Roboto stack; Inbox Georgia serif. No next/font import or hosted/self-hosted font loading was found. Arabic text exists, but there is no intentional Arabic font selection: glyphs rely on available system fallback; actual installed glyph rendering was not visually tested.

No centralized hierarchy. OperatorNav 12/13/16px, Inbox h1 1.75rem/h2 1.2rem, Offers title 1.35rem/form labels .875rem, analytics labels 12/13px and local metric weights. Preview includes .7rem debug text; AI settings uses 11px captions. Line heights are selectively inline (guard 1.5), not a global type scale. Native elements otherwise inherit browser defaults. DS-03 should measure readability, diacritics, numerals, font budget and zoom rather than assume current fallback is acceptable.

## RTL/LTR baseline

**RTL_READINESS: PARTIAL.** Root html lang=en and no dir. OperatorNav toggles dir on header only; onboarding/offers/orders/quotes use separate page-local dir states. No shared locale provider, persistent global choice or translation catalog exists. Some bilingual copy is present, many forms/statuses remain English.

Physical assumptions: inbox/leads textAlign:left; analytics marginLeft6/8; channels/templates/schedule marginRight8; schedule/leads paddingLeft lists; policies action marginLeft; AI settings textAlign:right. Offers manually swaps paddingLeft/Right with isArabic. Orders/Quotes text-left/text-right/ml-like recipes are source assumptions even though stylesheet is absent. No configured logical spacing or rtl utilities. No implemented sidebar/sheet/breadcrumb to assess; future DS-07 must cover them. Chat identifiers/timestamps are not systematically isolated. Directional return arrow in CapabilityGuard is fixed. These are implementation risks, not proof every physical property is wrong.

## Responsive baseline

Static assessment at intended mobile/tablet/desktop/large-desktop categories; no measured viewport screenshots or browser overflow claims. No global breakpoints or @media CSS found. OperatorNav flex-wrap provides some adaptation but no rendered mobile menu. Onboarding/analytics use auto-fit/minmax grids; this is a useful intrinsic-layout pattern.

At 320px root padding leaves 272px. Analytics minmax320/340 grids can exceed that space (`analytics/page.tsx:238,301`); Inbox fixed 1fr/1.4fr grid has no mobile stack (`:203`); Knowledge 2fr/1fr form grids (`:367,422`) and Offers two-column form grids (`:445,520`) have no explicit narrow behavior. Preview fixed panel widths/minimums and scroll regions need runtime checks. Orders/Quotes intend h-screen/overflow-x-auto/fixed modal utilities but missing CSS prevents reliance on them. Offers overlay maxHeight90vh/overflowY:auto is useful but its focus/keyboard and mobile scrolling are unverified. Large desktop containers differ by page. QA-04 must reproduce actual overflow and keyboard behavior before claiming resolution.

## Accessibility baseline

Static assessment only; **no WCAG compliance claim**. No CRITICAL confirmed finding (demonstrated exploitable/complete task loss) established. Severity counts in final output are the prioritized debt matrix; accessibility items are marked here.

| Severity | Evidence | Finding / validation needed |
|---|---|---|
| HIGH | offers/page.tsx:394+, orders/page.tsx:365+, quotes equivalent | Div overlays lack dialog role/aria-modal, focus trap/restoration and documented Escape behavior; no Radix inheritance |
| HIGH | offers/page.tsx:420+; knowledge/page.tsx:369+; orders/page.tsx:381+ | Visually separate labels without htmlFor/input id association; native wrapping labels elsewhere are stronger |
| MEDIUM | Offers/Orders/Quotes close button text ✕ | No explicit accessible close name; glyph pronunciation is not a reliable action label |
| MEDIUM | Root and header dir/lang behavior | Arabic reading metadata does not follow page locale |
| MEDIUM | Inbox error paragraph; page-local generic errors | No consistent announcement/focus-to-validation strategy |
| MEDIUM | Hardcoded muted/status palettes and tiny captions | Contrast and zoom risks; not measured failures |
| LOW | Missing explicit focus token/skip link strategy | Native controls retain browser keyboard behavior, but shared visible focus and landmarks need manual verification |

Strengths: native controls, semantic main/headings, wrapping labels on operational pages, nav aria-label/aria-current and role=alert/status in selected pages. No common focus reset CSS was found. Keyboard/contrast/screen-reader tests remain later QA gates.

## Forms architecture

FORM_ARCHITECTURE: PAGE_LOCAL_MANUAL_REACT_STATE + NATIVE_VALIDATION. useState/onChange and onSubmit/manual action handlers dominate. No RHF useForm, frontend Zod parse/safeParse or server action directives found. Shared contract types are imported; runtime request validation is mainly backend plus native required/min/max/maxLength and handwritten checks.

Orders/Quotes repeat line-item state and create/action handlers; Offers repeats field style and validation; Knowledge repeats text/FAQ/document draft/error flows; Policies constructs type-specific rules manually. Error handling is mostly one page-level string, not typed field errors. Preview clears draft before awaiting send, risking lost input on failure. No migration performed. DS-04 establishes field patterns; INT-04 decides form adapter reuse; backend validation remains authority.

## Data fetching architecture

Client pages use direct fetch, useEffect/useCallback and local state; no TanStack Query, Axios, central API client, query keys or shared mutation cache found. Server components exist for root/entry/login boundaries; /app explicitly reads verified Supabase identity. No business server actions found.

Browser → /api/backend/* → createSupabaseServerClient/getSession (me also getUser) → bearer to API_URL fallback → Nest /v1 with independent auth. Handlers repeat token extraction, no-store and response relay. Me forwards optional x-organization-id. Most relay only content-type/status, not safe request-ID/retry-after metadata. Events proxy is specialized streaming and has different API_URL fallback; preserve its behavior.

Dashboard reuses createRefreshController for debounce/single-flight/trailing refresh, 45s interval and SSE. **Inbox does not use this helper**: its refetch event directly refreshes list/detail (`inbox/page.tsx:85-102`). Prior roadmap wording must not be read as coalescing already implemented in Inbox. Mutations generally await result and refresh; no shared optimistic-update framework. Request race/cancellation and tenant change handling vary. INT-04/05 own server/local state and cache, INT-06 owns safe error normalization.

## Authentication and organization context

`src/proxy.ts` uses Supabase SSR cookies/getUser for matched routes; missing config returns pass-through. `src/lib/supabase/server.ts` uses async cookies; browser.ts uses public publishable configuration; `auth/callback/route.ts` exchanges code. `/app` independently redirects unauthenticated users; `/api/backend/me` verifies getUser/getSession and forwards Bearer to auth/me.

Policies, AI settings and Preview read auth/me activeOrganizationId (Policies/AI also membership role). Dashboard/nav use URL orgId or ai_sales_org_id; Analytics uses last_active_organization_id; Inbox and other pages expose manual org input. No shared active-org provider or switcher. Tenant IDs supplied by browser are not trusted for backend authorization. Cache/state race behavior on organization change is not globally centralized. No private environment values were inspected.

## Permission handling

UI_AUTHORIZATION: PARTIALLY_CENTRALIZED / SCATTERED. Registry requiredRole covers client settings/policies; OperatorNav optional role often omitted; CapabilityGuard evaluates without role. Policies gates OWNER/ADMIN; AI settings checks canEdit and mutation handlers. Other controls generally rely on backend response rather than a uniform frontend permission map.

Actual org roles OWNER/ADMIN/MEMBER. There is no verified platform-operator role bootstrap or differentiated Support/Receptionist grant in this frontend. Backend AuthGuard/membership checks/RLS remain authoritative; frontend visibility is not authorization. Incomplete UI checks are documented as UX/security boundary debt, not a proven backend bypass.

## Capability-driven UI

CAPABILITY_DRIVEN_NAV: PARTIAL. Shared registry has meaningful gates: Leads supportsLeads; Bookings/Schedule supportsBooking; Orders supportsOrders; Quotes supportsQuotes; Offers supportsOffers; coming-soon Products/Inventory/Listings map their actual capabilities. CapabilityGuard is used by Leads/Bookings/Schedule/Offers/Orders/Quotes. Analytics selectively renders transaction sections from response capabilities. Policies merely prioritizes booking rule types, not full capability hiding. Dashboard's operational summary is not globally capability-adapted. Page action/form checks vary.

Actual definitions in `packages/contracts/src/organization.ts`: supportsLeads, leadRequiredBeforeBooking, autoCreateLeadOnIntent, supportsBooking, supportsOffers, supportsQuotes, supportsOrders, supportsInventory, supportsStaff, supportsLocations, supportsProducts, supportsServices, supportsListings. No supportsPackages. Defaults enable several clinic-like functions; defaults must not become authorization on network failure. Guards/registry allow unknown capability/role paths permissively. Existing shared module registry is worth preserving; bootstrap and route/action consistency are INT-02/03 work.

## Business-type runtime branches

BUSINESS_TYPE_RUNTIME_UI_BRANCHES: **0 core operational layout/action branches found**. Search covered all `apps/web/src` source for businessType/business_type and business preset uses. Every found direct businessType reference is in `onboarding/page.tsx`: state default CLINIC_HEALTHCARE (:43), profile loading (:154), submitted profile (:236), selection/preset description (:549-560), pack availability/name/preview/apply (:630-666), summary label (:1031). Pack conditional rendering is one onboarding template branch, with helper use repeated for labels/actions; it is explicitly excluded from the core-runtime count and preserved as legitimate onboarding behavior.

Hardcoded clinic-oriented Preview scenario copy is separate domain-coupling debt; it is not a businessType conditional. No assertion is made about dynamic generated values or backend business-type decisions beyond inspected frontend source.

## Status presentation

Raw enums appear in Leads status/qualification/version (:130,143), Bookings status (:72), Inbox mode/pause reason/delivery/epochs (:218 onward), Policies policyType/status/version/enforcementMode (:171), Orders/Quotes lifecycle (:228) and onboarding catalog status (:1076). Some are useful diagnostics, but default business display is inconsistent.

Offers uses local getStatusBadge switch (:157) with human labels/colors; Orders/Quotes duplicate utility-based lifecycle color branches. Dashboard/Analytics have independent count/status presentations. There is no shared StatusBadge mapping or unknown-enum policy. DS-05 should centralize display-only mappings while preserving canonical values for API requests and audit, UX-02 keeps delivery ambiguity explicit.

## Loading / Empty / Error patterns

| Area | Existing pattern | Gap / preserve |
|---|---|---|
| Dashboard | loading, attention/sectionErrors, timestamp, refresh controller | Preserve partial section errors; standardize action recovery |
| CapabilityGuard | checking access, Feature Not Enabled with dashboard/onboarding links | Error stored but defaults render; disabled != failed != forbidden |
| Inbox | No conversations/No messages/Select a conversation; raw list/detail/reply status strings | Empty can appear before request completes; no shared load/denied state |
| Orders/Quotes | fetching/no records text, page error, pending action, overflow wrapper classes | Preserve basic distinction; styles unavailable, unsafe upstream message handling needs normalization |
| Knowledge | processing/publication/search and no sources messages; HTTP errors | Preserve workflow-specific progress; unify retries and form draft handling |
| Onboarding | role=alert/status and pack review summary | Good explicit feedback; still local patterns |
| Preview | loading/error, reset control, optional trace | No-session/bootstrap recovery, draft loss and first-load dead end |

No shared spinner/skeleton/EmptyState/ErrorState/PermissionDeniedState components. Some early return/no-org paths are instructional rather than blank; uniform coverage is absent. API body/text sometimes flows directly into errors (Policies :118-130); safe normalization needs INT-06. No styling or failure behavior was repaired.

## Test Assistant baseline

TEST_ASSISTANT_CURRENT_STATE: PARTIAL, first-session bootstrap defect present. `/test-assistant/page.tsx` re-exports `/settings/ai/preview/page.tsx`. UI reads me active org, constructs preview-Date.now ID and GETs sessions/:id without POST create (`:60-63`). Backend createSession issues UUID; getSession 404s unknown ID. Existing reset POST resets the same ID (server reset recreates in-memory session); this is not an explicit start-new-session flow and does not make initial GET correct.

Trace: UI → preview BFF GET/POST → PreviewController (AuthGuard) → PreviewService membership assertion and org:session in-memory map → runPreviewAgentTurn (`packages/agent-adapters/src/run-preview-agent.ts`) → shared runAgentOrchestrator with preview-specific snapshot, intent heuristic, in-memory RunStore and createPreviewToolExecutor. This shares orchestration, not every production adapter/intent path. Configured resolveAiProvider is used; conditional FakeModelProvider fallback exists only when no provider and test/AI_ALLOW_FAKE. No actual provider execution was run during DS-01; do not claim real-provider parity from source inspection.

PREVIEW snapshot/execution and executor read-only/simulated/default-blocked cases protect intended operations. Booking/lead/customer/quote/order changes use simulated identifiers/state; preview uses in-memory run persistence, not production outbound dispatcher. No production outbound enqueue path was found in these adapters. This is static safety evidence, not a runtime no-write audit. Imported policyAllowsAction alone is not proof of enforcement; future INT-07 must verify actual branch coverage.

Sessions have two-hour TTL refreshed on activity and vanish on restart/replica change. Membership is asserted; createdBy is stored but not used as a per-user ownership gate in the examined lookup. UI has TEST MODE, chat, simulated customer controls, reset and optional workflow/tool/source/mutation/timing panel plus workingState JSON (:453). DTO includes raw trace fields; current display/projection needs reviewed allowlisting and privacy checks. No trace content, prompts, chain-of-thought or secrets were output in this audit. Clinic-centric scenarios, non-global localization, reset/send races and draft clearing remain future work.

## Inbox baseline

INBOX_CURRENT_STATE: PARTIAL operational takeover UI. Existing list filters paused/unassigned/mine/all; selection fetches detail/messages; UI shows AI/human mode, owner IDs, epochs/pause reasons, message origin/direction/delivery and timeline. Claim/takeover/release/resume-ai and reply controls submit expectedOwnershipEpoch, then refresh. DISPATCHING/UNKNOWN delivery is explicitly visible; already-started sends cannot be recalled. SSE event refetch triggers list/detail refresh, reconnect handled by browser.

Not present in UI: unread persistence/indicators, general search, friendly customer identity/profile, lead summary, booking/order context, assignment/reassign picker, consistent role/capability guard and mobile list/detail layout. Backend controller has additional mode/reassign actions, but UI source does not establish linked-context/search/unread availability. Manual org ID and raw identifiers remain. Message list is authoritative fetch, not event-payload replacement. Preserve epochs and ambiguous delivery handling; add coalescing only later after proving behavior.

## Admin baseline

ADMIN_UI_CURRENT_STATE: NOT_IMPLEMENTED. No operator route namespace, operator shell/pages or dedicated platform auth bootstrap in frontend inventory. OperatorNav name and ADMIN nav group refer to organization operations/settings. No user-facing operator billing/provider/queue/audit/support UI was found. Platform Admin must remain separate from client OWNER/ADMIN/MEMBER; no pages were created.

## Technical debt matrix

Priority uses BLOCKER/HIGH/MEDIUM/LOW as requested. BLOCKER is scoped to future feature execution, not preventing the audit. Final severity counts map BLOCKER to CRITICAL for reporting only: **2 critical/blocking, 7 high, 9 medium, 3 low**. No confirmed critical security exploit is asserted. All items are documented, not fixed.

| ID | Priority | Area | Finding | Evidence (apps/web unless stated) | Impact | Recommended future phase |
|---|---|---|---|---|---|---|
| AUD-01 | BLOCKER | Styling | Orders/Quotes depend on uncompiled Tailwind recipes | `orders/page.tsx:141; quotes/page.tsx:141; package.json; no CSS` | Cannot rely on modal/overflow/layout styling | DS-02, DS-04, UX-10 |
| AUD-02 | BLOCKER | Preview | Client invents session ID and GETs before create | `settings/ai/preview/page.tsx:60-63; preview.service.ts:153` | Initial test chat fails to initialize correctly | INT-07, UX-03 |
| AUD-03 | HIGH | Auth route UX | Offers/orders/quotes/test-assistant missing proxy matcher | `src/proxy.ts` | Protected page redirect coverage incomplete; API remains guarded | INT-03, QA-07 |
| AUD-04 | HIGH | Capabilities | Defaults after failure, stale capability/optional role | `OperatorNav.tsx; CapabilityGuard.tsx; navigation.ts` | Misleading permitted UI and tenant switch state | INT-02, INT-03 |
| AUD-05 | HIGH | Tenant context | Manual org plus inconsistent storage and late-response handling | `analytics/page.tsx:22; dashboard/page.tsx:87; inbox/page.tsx` | Cross-context UI confusion; needs runtime race verification | INT-04, INT-05 |
| AUD-06 | HIGH | Accessibility | Custom div modal has no shared dialog/focus behavior | `offers/page.tsx:394; orders/page.tsx:365; quotes/page.tsx` | Keyboard/screen-reader interaction risk | DS-04, QA-03 |
| AUD-07 | HIGH | Accessibility | Separate visual labels lack input association | `knowledge/page.tsx:369; offers/page.tsx:420; orders/page.tsx:381` | Missing reliable accessible names | DS-04, QA-03 |
| AUD-08 | HIGH | Preview privacy/parity | Unreviewed trace/working-state display and alternate intent/adapters | `preview/page.tsx:453; run-preview-agent.ts` | Cannot claim safe debugging or production parity | INT-07, UX-03, QA-07 |
| AUD-09 | HIGH | Admin contracts | No platform operator surface/contract bootstrap | `app inventory; API controller inventory` | Operator implementation blocked until reviewed contracts | ADMIN-01, INT-01 |
| AUD-10 | MEDIUM | Theme | No semantic tokens/theme; independent palettes | `layout.tsx; OperatorNav.tsx; offers/page.tsx` | Theme changes cannot propagate coherently | DS-02 |
| AUD-11 | MEDIUM | Typography | System fallback vs Georgia and unscaled captions | `layout.tsx; inbox/page.tsx:155; settings/ai/page.tsx:619` | Arabic readability and hierarchy unmeasured | DS-03 |
| AUD-12 | MEDIUM | RTL | Header-local toggle and physical spacing | `OperatorNav.tsx:99; analytics/page.tsx:406` | Direction/language inconsistent | DS-07, QA-05 |
| AUD-13 | MEDIUM | Responsive | Fixed grids/minimums, no effective mobile menu | `inbox/page.tsx:203; analytics/page.tsx:301` | Static mobile overflow risk | DS-08, QA-04 |
| AUD-14 | MEDIUM | Forms | Manual state/validation and lost preview draft | `preview/page.tsx:86-110; orders/quotes forms` | Duplicated validation and weak retry recovery | INT-04, UX-03 |
| AUD-15 | MEDIUM | Errors | Raw body/error strings, no shared safe mapping | `policies/page.tsx:118-130; inbox/page.tsx:52` | Poor recovery and potential diagnostic overexposure | INT-06 |
| AUD-16 | MEDIUM | Statuses | Raw enums and duplicated badge logic | `offers/page.tsx:157; leads/page.tsx:130` | Inconsistent business labels and unknown fallback | DS-05 |
| AUD-17 | MEDIUM | Quality | No UI/browser harness; lint is tsc only | `apps/web/package.json; tsconfig.json` | Passes do not cover interactions/styles/accessibility | QA-01..05 |
| AUD-18 | MEDIUM | Realtime | Inbox refetch lacks shared coalescing | `inbox/page.tsx:85-102; dashboard-refresh.ts` | Reconnect/burst load and stale request risk | INT-05, UX-02 |
| AUD-19 | LOW | Navigation | current ID does not match href; unused mobile state | `settings/ai/page.tsx:274; OperatorNav.tsx` | Selection feedback and dead state | DS-06 |
| AUD-20 | LOW | Migration | Foundation routes/preview alias need explicit disposition | `app/page.tsx; page.tsx; test-assistant/page.tsx` | Potential duplicate routes; no proven legacy | ROLL-01 |
| AUD-21 | LOW | Accessibility | No shared skip/focus/close-label convention | `layout.tsx; offers/page.tsx:413` | Interaction polish and manual verification debt | DS-09, QA-03 |

## Existing strengths to preserve

Shared typed capability/nav registry and bilingual labels; backend tenant/auth authority; same-origin bearer proxies; actual preview orchestration with dedicated simulation executor; ownership epoch and UNKNOWN/DISPATCHING visibility; refetch-only SSE; dashboard refresh coalescing with three passing tests; knowledge draft/processing/publication separation; business pack preview/apply review; native wrapping labels and semantic main/nav headings; operational dashboard sectionErrors; successful compile/type baseline. Preserve old working routes and avoid a parallel duplicate implementation.

## Risks

Static source inspection cannot prove responsive overflow, contrast, keyboard/screen-reader behavior, real-provider parity or runtime tenant isolation. These limitations are explicit and assigned to future quality/integration phases. Missing design tooling is a foundation gap, not authorization to install it during this task. Existing uncommitted MB15 changes were retained; no source reset or unrelated repairs occurred. Backend MB15A/B acceptance does not close UI quality or Meta live acceptance; MB15 remains NOT_CLOSED.

## DS-02 prerequisites

DS-01 investigation is complete; **DS-02 remains NOT_STARTED**. Before starting DS-02 implementation:

1. ROLL-01 migration planning exit is still a listed roadmap prerequisite; it was not executed here. Capture route/state baselines and ownership before changing styles.
2. Review this debt matrix and source inventory; approve semantic color/theme token naming and light/dark/system requirements without retrofitting random page literals.
3. Verify installed Next/React compatibility and package installation plan for Tailwind v4, PostCSS/shadcn/next-themes; no version recommendation is certified by this audit.
4. Decide global CSS/provider placement under existing src/app and @ alias; no files were guessed as current implementation.
5. Preserve mixed inline/class pages during incremental migration. Flag missing Tailwind styling as baseline debt rather than treating new behavior as a regression-free refactor.
6. Define theme persistence/hydration and Arabic typography contrast specimens; keep RTL/global locale ownership coordinated with DS-07.
7. Assign foundation/feature owners and rollback boundary. Auth/capability/preview defects remain owned by INT/UX gates; DS-02 must not silently fix backend or business behavior.

DS-02 is the next design-system phase, not blanket authorization to skip ROLL-01 or other gates.

## Acceptance criteria

- [x] Frontend root, versions/config paths and actual tooling documented.
- [x] 22 pages and 30 HTTP handlers inventoried with owners/context/classification.
- [x] Shell/navigation generation and shadcn/component inventory traced.
- [x] Theme/visual/typography/RTL/responsive/accessibility baselines assessed with static limits.
- [x] Forms/API/data/auth/org/permissions and capability behavior documented.
- [x] Frontend businessType search and onboarding exceptions recorded.
- [x] Statuses and loading/empty/error/partial/denied patterns audited.
- [x] Preview UI-to-engine, simulation, outbound boundary and parity limits documented.
- [x] Inbox current support versus absent context/unread/search documented.
- [x] Admin absence and prioritized debt/owners recorded.
- [x] Available frontend-safe baseline commands executed and exact results recorded.
- [x] DS-02 prerequisites explicit; later phases not started.

## Exit gate

**PASS for DS-01 audit scope.** All requested inspection areas and available baseline checks are documented. Completion is based on source/config inventory and executed checks, not live UI certification. Existing gaps remain visible with future owners. The master/section register may mark DS-01 COMPLETE; all other phase statuses remain NOT_STARTED. Changes remain under docs/ui-product-roadmap, no migrations/backend/UI implementation, no Meta contact. Stop after this report.

## Post-audit architecture update

The audit above is unchanged historical evidence. Reorganization now establishes `packages/design-system` and explicit web Client/Admin/shared/provider ownership. See [architecture](../architecture/frontend-monorepo-architecture.md) and [source-to-target inventory](../architecture/frontend-ownership-inventory.md). Original route counts remain the audit baseline; the pre-existing internal foundation preview added one page after the audit. No route topology changed in this reorganization. DS-02 is reopened as NOT_STARTED for package-based revalidation; its prior implementation is preserved.
