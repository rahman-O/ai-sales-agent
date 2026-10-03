# DS-02 Tokens & Theme

## Status

**COMPLETE — package-based DS-02 revalidation, 2026-10-03.** DS-01 and ROLL-01 remain COMPLETE. DS-03 remains NOT_STARTED. All scoped gates pass; no product migration, Admin feature, backend change, database change, migration, Agent change or Meta contact occurred.

Subsequent phase note: DS-03 typography/spacing is now COMPLETE. The descriptions below record DS-02 acceptance before DS-03; historical measurements/evidence remain preserved.

## Objective

Make the existing @ai-sales-agent/design-system token/theme foundation authoritative under the verified monorepo architecture. Revalidate working code rather than recreate it.

## Historical foundation note

FOUNDATION_ALREADY_PRESENT: YES. The previous implementation survived relocation: tokens, scoped CSS/Tailwind bridge, Button/cn, app ThemeProvider and internal fixture. The [pre-reorganization report](evidence/ds02/pre-reorganization-report.md) remains historical evidence. Reorganization explicitly reopened DS-02 as NOT_STARTED; this execution closes that package-based revalidation. Historical screenshots/results are preserved unchanged.

## Package ownership

`packages/design-system` owns semantic tokens/theme variables, Tailwind-facing styles, Button and cn. `apps/web` owns ThemeProvider integration, root document composition, route rendering and application compatibility CSS. Client/Admin remain separate consumers; no business logic moved into the package.

## Monorepo dependency placement

Existing npm apps/* and packages/* workspaces, @ai-sales-agent namespace, single active root package-lock.json. No dependencies added or upgraded and no lockfile change. The existing isolated spikes/database-compatibility lockfile is unrelated historical tooling and was untouched. React is peer-owned by the package; package React dev dependency supports standalone development. Web owns Next/next-themes/Lucide/PostCSS. No frontend dependency added to backend packages.

## Tailwind v4 integration

Installed Tailwind 4.3.3; @tailwindcss/postcss 4.3.3; PostCSS 8.5.23. The package owns CSS imports/semantic bridge. Web runs PostCSS and consumes the public styles.css export. Existing tw prefix works (tw:bg-primary, tw:p-4). No Tailwind v3 config, full utility migration or CSS entry duplication.

## Tailwind source boundaries

Package tailwind.css imports theme.css and utilities.css with prefix(tw), source(none); @source ../components/ui scans package primitives. Web globals.css registers ./internal/design-system only. No backend, worker, Prisma, migrations, documentation, evidence or full legacy feature scan. Add future adopted sources explicitly.

## Preflight strategy

GLOBAL_PREFLIGHT: DISABLED. No preflight.css or full @import tailwindcss recipe. Existing scoped box sizing, native control font inheritance and focus rules target [data-ui=ds]. Root native control color-scheme compatibility remains web-owned; untouched product routes preserve browser defaults.

## shadcn ownership

Authoritative primitives: packages/design-system/src/components/ui. Both components.json files retain new-york, RSC/TSX, neutral semantic base, CSS variables, tw prefix and Lucide strategy. Package aliases #components/#components/ui/#lib use Node package imports to resolve source for tooling and dist for runtime. Web ui alias points at @ai-sales-agent/design-system/components/ui; utils points at /utils. Real read-only shadcn 4.21.1 info passes from both workspaces and resolves UI and utility paths to package src, not dist declarations. No generator add, bulk installation or component overwrite ran. Lucide stays in web because the existing Button itself imports no icon library; future icon-bearing package primitives require their own dependency review. [Official monorepo guidance](https://ui.shadcn.com/docs/monorepo) supports package-import/export based routing; [package imports](https://ui.shadcn.com/docs/package-imports) describes the local alias model.

## Design-system package exports

Explicit root API: Button, buttonVariants, cn (dist JS/declarations). styles.css exposes the package stylesheet. /utils exposes compiled cn with source typings so CLI routing finds its authoritative source. /components/ui exposes a two-line intentional Button entry with source typings for generator path resolution and compiled runtime JS. /components/ui/button exposes the existing compiled primitive directly. No wildcard public exports, recursive barrels, private test helpers or business API. NodeNext package imports retain runtime-safe compiled resolution.

## File architecture

Package src/styles/index.css → tailwind.css → tokens.css → foundation.css; Tailwind declares layer order theme, base, components, utilities. Web src/app/globals.css imports package styles.css once, then styles/legacy-compat.css and registers its fixture. Existing styles were not fragmented or rewritten. Package src/lib/utils.ts is canonical cn; src/components/ui/button.tsx is the only primitive. App providers/theme-provider.tsx and app/internal/design-system remain web-owned. Compiled dist is generated by the existing tsc build convention.

## Semantic token model

All required surface/text/action tokens exist: background/foreground, card, popover, primary, secondary, muted, accent, destructive with foreground pairs, border/input/ring. Sidebar surface, foreground, primary, accent, border/ring aliases inherit the same semantics. Variables are scoped to [data-ui=ds], preserving legacy body paint. One authoritative token file; no feature-specific color names or equivalent duplicate tokens. Dark aliases inherit overridden semantic values correctly.

## Light theme

Near-white neutral background/card surfaces, readable dark text and restrained blue action family. Low-noise neutral supporting surfaces; input border and focus ring distinguish controls. Every required category is present and inherited aliases resolve.

## Dark theme

Dark neutral OKLCH background L=0.20, card L=0.25, popover L=0.28; avoids pure black. Foreground L=0.94 and muted L=0.76 preserve contrast. Action/state meanings remain equivalent to light; no brightly saturated surface system.

## System theme

Existing next-themes supports system OS preference, explicit light/dark and selection persistence. Browser emulation verifies OS light/dark switching, reload persistence and subsequent legacy navigation. No parallel Redux/Zustand/custom theme state.

## Primary color strategy

Restrained blue, OKLCH hue 260. Existing light primary L=0.47/C=0.16 and dark primary L=0.78/C=0.10 remain unchanged. No palette novelty or alternate brand family.

## Semantic states

success, warning, info use foreground variables plus background/border pairs. danger aliases destructive and supplies contextual background/border; no redundant danger/destructive color palette. Bilingual fixture renders each state with text, not color alone.

## Radius

Existing limited 0.25/0.375/0.5/0.75rem options, default 0.375rem. No pill proliferation, new spacing scale or DS-03 implementation.

## Shadows

Existing two restrained shadow levels, with dark equivalents. Surfaces/borders remain primary; no heavy card restyling.

## Motion

Existing fast 120ms, standard 180ms and easing token; prefers-reduced-motion reduces both durations to zero. Browser checks accept equivalent zero CSS time serialization (0s or 0ms), still requiring zero. No decorative animation added.

## Theme provider

Existing web-owned next-themes provider uses data-theme, storageKey ai-sales-ui-theme, default system, enableSystem and enableColorScheme=false. Root stays a server component; only provider/fixture require client behavior. html suppressHydrationWarning is justified by the pre-hydration theme attribute; no broad suppression on descendants. Body retains legacy inline font/margin/padding, and only adopted DS surfaces use token paint.

## RTL/LTR foundation

Fixture dir=ltr and dir=rtl pass in both themes. Existing direction-agnostic Button, symmetric padding and flex/grid layout remain valid. No physical left/right token model. Full application direction/localization migration remains DS-07.

## Arabic/English rendering

Bilingual heading, state content, actions and input label render in both directions. Browser checks verify Arabic/English text presence, fixture lang and no surface overflow; screenshots inspected for joining/readability/clipping in light LTR and dark RTL. Existing system font fallback retained. Typography scale/font selection/whole-product text certification belongs to DS-03/DS-07.

## Legacy coexistence

Login, Dashboard, Policies, Orders and Test Assistant remain pixel-identical to preserved historical screenshots and computed geometry/styles, including saved dark theme navigation. Inline styles/native rendering/unprefixed dormant utilities remain stable. Web legacy color-scheme rule is unchanged; no Client migration.

## Internal verification surface

Existing /internal/design-system fixture, unlinked from navigation. Production HTTP 404 without opt-in; HTTP 200 with DS_FOUNDATION_PREVIEW=true. It exercises light/dark/system, direction, native input/card surface, Button variants, semantic states and focus. No business data or agent execution. No Storybook or new primitive catalog.

## Accessibility validation

Foundation-only evidence: 18 contrast pairs per theme, including surface/text, accent/sidebar variants, state foreground/background, ring and input. Minimum normal-text contrast: light 6.73:1, dark 6.60:1, all >=4.5:1. Ring/input pairs all >=3:1. Two-pixel visible focus indicator and forward/reverse native Button tab order pass; reduced motion and mobile overflow pass. No axe infrastructure installed and no claim of whole-product WCAG compliance. [Light measurements](evidence/ds02-package-revalidation/contrast-light.json) and [dark measurements](evidence/ds02-package-revalidation/contrast-dark.json).

## Browser regression

Existing foundation-browser.mjs reused and strengthened, with separate DS_EVIDENCE_DIR and historical DS_BASELINE_DIR. Light LTR/RTL and dark LTR/RTL desktop screenshots, dark RTL mobile, OS/reload persistence, contrast, keyboard/focus, bilingual text and reduced motion all pass. Five legacy routes remain pixel-identical. Zero console hydration/page errors. External network blocked and same-origin backend requests use 401 fixtures; no live agent/Meta calls. [Browser results](evidence/ds02-package-revalidation/browser-results.json). Historical evidence was not overwritten.

## Dependencies

No repository dependency added or version changed; shadcn 4.21.1 ran from a temporary external npm cache for read-only configuration validation.

| Name | Version | Owner / type | Purpose |
| --- | --- | --- | --- |
| react | ^19.1.1 peer; 19.1.1 dev | DS peer/dev; web runtime 19.1.1 | Consumer runtime contract; standalone development |
| react-dom | 19.1.1 | web runtime | App rendering |
| @types/react | 19.1.13 | DS/web dev | Component typing |
| @types/react-dom | 19.1.9 | web dev | Renderer typing |
| @types/node | 24.5.2 | web dev | Build/runtime typing |
| typescript | 5.9.2 | DS/web/root dev | Existing compiler |
| class-variance-authority | 0.7.1 | DS runtime | Button variants |
| clsx | 2.1.1 | DS runtime | Conditional class composition |
| tailwind-merge | 3.7.0 | DS runtime | Prefix-aware class conflict merging |
| tailwindcss | 4.3.3 | DS runtime CSS; web dev | Package styles and consumer compilation |
| @tailwindcss/postcss | 4.3.3 | web dev | CSS processing |
| postcss | 8.5.23 | web dev | Build pipeline |
| next-themes | 0.4.6 | web runtime | App theme integration |
| lucide-react | 1.50.0 | web runtime | Fixture icons |
| next | 16.3.6 | web runtime | Existing App Router |

Installation audit finds separate existing web/package React 19.1.1 development installations and hoisted React 19.3.0 from existing tooling peers, including Prisma Studio. This is not a single-physical-copy npm tree. DS declares no React runtime dependency; no new copy was added. Installed Next App Router compiler aliases route frontend React/JSX imports to its vendored runtime, and fixture hydration/interaction tests pass without duplicate-runtime errors. Avoid removing standalone development peer support or changing unrelated backend tooling solely to flatten the npm tree.

## Files changed

Package package.json/components.json/tsconfig.json, Button import, new intentional UI entry and automated boundary tests; web components.json and existing browser harness; current DS-02/master/section/architecture documentation and separate evidence. No dependency/lock/provider/root-layout/style/token change. The machine-readable acceptance record lists the exact changed files and scope hashes.

## Tests

Independent package build PASS; final consuming web build PASS; root typecheck and lint PASS with final package/web checks PASS; full root npm test PASS, 414 tests, zero failures; final full root npm run build PASS. Seven new boundary/foundation tests plus the existing cn test run through the existing root test gate. Real shadcn info passes in both workspaces. Compiled root/direct Button/cn public APIs load correctly. Final strict browser suite PASS; production fixture gate 200/404 verified.

## Risks

Future generator additions must retain tw prefix/no global Preflight and inspect resulting CSS/dependencies. Source-typing entries exist intentionally for correct generator routing; runtime remains compiled, so build before running the app. New package icon primitives require package-owned icon dependencies. New adopted routes must register their own sources deliberately.

## Known limitations

One minimal native Button, native fixture input and semantic card surface only. No Slot/asChild or complete shadcn catalog. Global product typography, route shells, locale state, permission/capability bootstrap remediation and whole-product accessibility remain later work. No real DeepSeek/Meta acceptance performed or inferred. Existing physical development React copies are documented above rather than falsely reported as a flat npm tree.

## DS-03 prerequisites

DS-01, ROLL-01 and package-based DS-02 COMPLETE. DS-03 may define typography/spacing next using the shared package and surface-specific consumers; DS-03 is NOT_STARTED and was not executed here.

## Acceptance criteria

All requested package, Tailwind, semantic theme, generator, provider, direction, bilingual fixture, legacy regression, accessibility foundation, hydration, boundary and quality gates PASS. ONE_AUTHORITATIVE_TOKEN_SYSTEM YES; controlled source scope; global Preflight DISABLED. DESIGN_SYSTEM_IMPORTS_WEB 0, CLIENT_IMPORTS_ADMIN 0, ADMIN_IMPORTS_CLIENT 0. No production backend/database change or migrations.

## Exit gate

**PASS — DS-02 COMPLETE.** The relocated foundation is authoritative and independently compiled/consumed/verified. Stop after this report. NEXT_PHASE: DS-03 — Typography & Spacing; remains NOT_STARTED.
