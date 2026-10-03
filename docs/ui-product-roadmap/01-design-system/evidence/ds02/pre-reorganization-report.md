# DS-02 Tokens & Theme

## Status

**COMPLETE — DS-02 foundation only, 2026-10-03.** DS-01 and ROLL-01 prerequisites are complete. DS-03 remains NOT_STARTED. No feature page migration, backend change, schema change, migration, live agent acceptance or Meta contact occurred. Implementation and local evidence are recorded below; whole-product accessibility and operational acceptance are not implied.

## Objective

Establish controlled Tailwind v4 utilities, minimal shadcn-compatible configuration/Button, semantic light/dark/state tokens and system-theme infrastructure alongside unchanged legacy UI. Keep the adoption boundary explicit so future pages consume the foundation deliberately.

## Monorepo dependency placement

Repository root: `Al-salsas/`; npm workspaces `apps/*`, `packages/*` in root `package.json`; single root `package-lock.json`. Frontend package `@ai-sales-agent/web` at `apps/web/package.json`. Shared `packages/config` and `packages/contracts` remain unchanged. `@/*` maps to `apps/web/src/*` in existing tsconfig.

Before installation, dependency resolution confirmed Next/TypeScript are hoisted while React resolves from apps/web/node_modules. ESLint and a frontend browser test package were absent; current lint remains tsc. Existing tsx lives at the root. All eight direct added dependencies are owned only by apps/web: runtime helpers/theme/icons in dependencies, Tailwind/PostCSS in devDependencies. Hoisted physical node_modules does not change ownership. No backend/shared manifest changed, no root dependency added, no second lockfile introduced. Lock comparison found no existing package version change and no other workspace metadata change.

Commands used existing npm workspace convention with exact saved versions, a temporary npm cache, ignore-scripts/no-audit/no-fund. The initially attempted Slot dependency was removed from direct web ownership because polymorphic primitives are outside the minimal foundation; existing transitive Slot entries are not a new direct foundation dependency.

## Tailwind v4 integration

Installed tailwindcss and @tailwindcss/postcss 4.3.3 plus postcss 8.5.23 in the web workspace. `apps/web/postcss.config.mjs` configures the v4 plugin; root layout imports `src/app/globals.css` once. CSS imports theme and utilities separately with prefix(tw); compiled utilities use `tw:` variants and @theme inline semantic bridges.

Next 16.3.6's default Turbopack PostCSS worker failed with local IPC bind EPERM in this environment, including elevated retry. Supported webpack production compilation succeeded. Web dev/build scripts explicitly use --webpack so the normal npm commands remain usable; no framework version or next.config change. Dev route compilation was separately checked. This is a toolchain compatibility choice, not a business-page workaround. Installed Next CSS guidance and [Tailwind's PostCSS reference](https://tailwindcss.com/docs/installation/using-postcss) informed integration.

## Tailwind source boundaries

`src/styles/design-system/tailwind.css` uses source(none) and explicitly registers only `src/components/ui`, `src/components/design-system`, and `src/app/internal/design-system` relative to that CSS file. No broad src/monorepo scan. Backend, worker, Prisma, docs/evidence, unrelated packages and legacy feature pages are excluded. Add future adopted sources deliberately.

Prefix prevents emitted utilities from matching old Orders/Quotes class strings even when shared CSS remains loaded during navigation. Compiled CSS contains prefixed bg-primary and no unprefixed bg-slate-950. Static complete class variants are used. No dynamically constructed Tailwind class names.

## Preflight strategy

GLOBAL_PREFLIGHT: DISABLED. There is no preflight.css or whole-tailwind import. [Selective imports](https://tailwindcss.com/docs/preflight) provide utilities without the reset. Scoped foundation applies box-sizing only under data-ui=ds, font inheritance for its controls and visible focus styling. No heading/list/margin/link reset touches existing routes.

One intentional compatibility rule keeps root color-scheme light for legacy native controls; DS boundaries independently set light/dark color-scheme. Root body font/margin/padding remain exactly as before. Tailwind emits prefixed custom-property initialization; it does not reset legacy element rendering. Generated CSS was inspected and legacy pixels/styles compared.

## shadcn bootstrap

`apps/web/components.json` configures new-york, RSC/TSX, v4 empty config path, CSS `src/app/globals.css`, CSS variables, tw prefix, Lucide, and existing @ aliases for components/ui/utils/lib. No second components tree or mass installation. Low-level primitives live at `src/components/ui`.

One minimal Button (`src/components/ui/button.tsx`) uses the shadcn-style cva/cn variant composition for default/secondary/destructive, with prefixed classes and native button semantics. It is a documented subset/adaptation rather than an untouched generated full primitive: Slot/asChild, extensive size/interaction variants and broader component certification belong to DS-04. Scope-specific ds-button supplies border/transition defaults because Preflight is absent. Existing components were not overwritten. [components.json reference](https://ui.shadcn.com/docs/components-json) documents the configured paths.

Canonical cn at `src/lib/utils.ts` uses clsx plus extendTailwindMerge({prefix:tw}); tests cover conditional composition, prefixed padding/RTL/focus conflicts and preservation of unprefixed legacy classes. No alternate class utility.

## File architecture

| File | Responsibility |
|---|---|
| apps/web/postcss.config.mjs | Tailwind PostCSS integration |
| apps/web/components.json | Minimal shadcn bootstrap paths/prefix/icons |
| apps/web/src/app/globals.css | Single stylesheet entry |
| apps/web/src/styles/design-system/tailwind.css | Layer order, source bounds, semantic utility bridge |
| apps/web/src/styles/design-system/tokens.css | Sole semantic color/theme/radius/shadow/motion values |
| apps/web/src/styles/design-system/foundation.css | Scoped normalization, focus and verification sample styles |
| apps/web/src/providers/theme-provider.tsx | Client next-themes adapter |
| apps/web/src/lib/utils.ts and utils.test.ts | Prefix-aware class merge and regression test |
| apps/web/src/components/ui/button.tsx | Only foundation primitive |
| apps/web/src/components/design-system/foundation-preview.tsx | Internal sample, not product component library |
| apps/web/src/app/internal/design-system/page.tsx | Production-gated verification route |
| apps/web/test/foundation-browser.mjs | Local browser harness, uses existing Playwright runtime |

Cascade: declared theme → base → components → utilities; token values in theme, scoped normalization in base, owned ds-* styles in components, prefixed utilities override as appropriate. Global entry preserves composition order through Next's production build.

## Semantic token model

All values live under `[data-ui='ds']`, avoiding accidental inherited feature-page paint. Required tokens: background/foreground; card/card-foreground; popover/popover-foreground; primary/primary-foreground; secondary/secondary-foreground; muted/muted-foreground; accent/accent-foreground; destructive/destructive-foreground; border/input/ring. Sidebar surface/foreground/primary/primary-foreground/accent/accent-foreground/border/ring are prepared without building a sidebar.

Theme utility bridges read these variables. Success/warning/danger/info each have foreground, background and border roles; the base state name is foreground, e.g. --success, paired with --success-background/--success-border. Danger aliases destructive. No booking/lead/clinic/business-type color tokens. Variables encode meaning and structure, not direction. A future portal must carry a DS marker and theme/direction context; no portal component is implemented here.

## Light theme

Soft neutral background oklch(0.98 0 0), card 0.995, foreground 0.22. Supporting text uses restrained neutral contrast; primary is a deep blue. This avoids an all-bright-white surface while preserving readable neutral hierarchy. Default DS scope provides complete light values before theme script resolution. Screenshot and browser-computed contrast evidence pass.

## Dark theme

Root data-theme=dark changes only DS-boundary values: background oklch(0.2 0 0), card 0.25, foreground 0.94. No pure-black primary surface. Primary becomes a light blue with dark label; destructive and semantic state text likewise adapt to dark surfaces. Root body and legacy pages are not recolored. Four desktop screenshots include both directions and themes.

## Primary color strategy

PRIMARY_COLOR_DIRECTION: restrained blue (OKLCH hue260), preserving the existing header/action blue family. Light primary oklch(0.47 0.16 260) with near-white foreground; dark primary oklch(0.78 0.1 260) with dark foreground. Use for actions/focus/selection later, not every surface. Success stays green, independent from brand. No per-business themes.

## Semantic state colors

Success green hue150, warning warm amber hue75/85, danger red hue25, info cool blue hue240. Explicit background and border values exist for both themes; readable text and icons share the foreground role. Warning is distinct from destructive, and success from primary. Verification samples use text labels as well as color. No StatusBadge/product status mapping implemented.

## Radius

Limited DS scale: 0.25rem small, 0.375rem medium/base radius, 0.5rem large, 0.75rem extra-large. Internal ds-radius variables feed prefixed Tailwind radius aliases. No pill default or feature-owned radius scale. Full spacing/type scale remains DS-03.

## Shadows

Two subtle elevations only: ds-shadow-sm (1px/2px) and ds-shadow-md (3px/8px), with theme-specific low-opacity neutral values. Sample surfaces primarily use borders and surface contrast. No decorative heavy shadow, gradient or glass effect.

## Motion

Fast120ms/standard180ms with one interaction easing; prefers-reduced-motion reduces both to0ms within DS roots. Button background transition consumes fast timing. No page animations or motion framework.

## Theme provider

`src/providers/theme-provider.tsx` is a small client boundary composed inside the existing server RootLayout; children remain server/client according to their own definitions. next-themes writes stable root `data-theme` (rather than color props), storage key ai-sales-ui-theme, default system and enableSystem. enableColorScheme=false prevents the provider from changing global native controls; DS scope owns its own color-scheme.

Root html alone gets suppressHydrationWarning because the early theme script updates its theme attribute; no blanket descendant suppression. Native body typography/layout preserved. Preview controls wait for client mount before reading stored theme; server markup is stable. No hydration errors appeared in captured browser runs.

## System theme behavior

Verified selecting system, emulating OS light/dark and observing root resolution; reload preserves preference/resolved dark state. Explicit light/dark work independently. No React state color propagation. Legacy pages remain light while DS boundaries follow theme, with saved preference retained. System capability does not promise dark styling for existing product pages.

## RTL/LTR foundation

Tokens and structural names are direction-neutral. Internal sample root has dir=ltr/rtl and corresponding lang=en/ar; controls/buttons/sample grid render in both directions, including mobile RTL. Existing root lang=en and page-local language controls remain unchanged. Full locale catalogs, document-language/direction coordination, physical spacing migration, calendars, portal direction and intentional Arabic fonts remain DS-03/DS-07. This is primitive/token readiness, not whole-platform RTL completion.

## Legacy coexistence

Before adding foundation CSS, captured authentication/Login, Dashboard, form-heavy Policies, Orders list/table shell and current Test Assistant routes. Harness blocks external network and returns safe401 fixtures for backend requests. No login credential, tenant record or live agent call used. It exercises available page/no-org/denied states, not authenticated full business datasets.

After adoption, all five have identical computed layout/styles and exact PNG bytes in a matching browser profile. Same pixel assertions pass with saved dark theme. The apparent Policies date-input regression occurred after changing the browser's media emulation: native datetime shadow fonts changed. A same-OS dark comparison with/without all DS CSS was pixel-identical, proving no DS stylesheet cause. The harness uses a fresh matching OS profile for saved-dark comparisons; exact pixel assertions were retained. [Preserved investigation image](./legacy-policies-dark-failure.png) is diagnostic, not an accepted current regression.

No feature sources, auth/nav/guards, BFF routes, query/mutation logic or agent adapters changed. Root changes are stylesheet/provider only; compatibility color-scheme does not paint legacy pages. Existing uncompiled Orders/Quotes utility debt remains for its future migration.

## Verification surface

Internal `/internal/design-system`, absent from business navigation. Dev is available; production returns404 unless DS_FOUNDATION_PREVIEW=true is deliberately set server-side. It contains only synthetic bilingual token samples, native input/select, Button variants and internal theme/direction controls. It never reads business APIs or executes agent tools.

Production default404 and explicit-enabled route verified; dev compilation/200 verified. Desktop lightLTR/darkLTR/lightRTL/darkRTL and 375px darkRTL mobile screenshots captured. These fixtures certify foundation rendering, not Test Assistant acceptance. [Browser evidence](./browser-results.json).

## Accessibility checks

Browser renders OKLCH colors into sRGB canvas for relative-luminance contrast checks; important text pairs exceed4.5:1, input/focus boundaries exceed3:1. Light: background16.22, card16.93, primary6.84, secondary13.55, muted6.73, destructive7.93. Dark: background15.18, card13.35, primary9.40, secondary10.60, muted6.60, destructive8.40. State pairs also exceed4.5. Ring against background/card exceeds6.9 light and8.5 dark; input/card4.80 light and4.37 dark.

[Light measured pairs](./contrast-light.json), [dark pairs](./contrast-dark.json). Focus-visible outline2px/offset3px tested on Button in both themes. Samples are named native controls, semantic headings/sections, and icons aria-hidden beside text. Border token on decorative cards is not claimed as interactive contrast evidence. Disabled-button opacity is not a whole-product contrast certification. No full axe/manual screen-reader audit or WCAG compliance claim.

## Dependencies added

| Name | Exact version | Installed at / ownership | Reason |
|---|---|---|---|
| tailwindcss | 4.3.3 | apps/web/package.json devDependencies | Prefixed v4 utility compiler |
| @tailwindcss/postcss | 4.3.3 | apps/web/package.json devDependencies | Next PostCSS build integration |
| postcss | 8.5.23 | apps/web/package.json devDependencies | CSS build processor |
| next-themes | 0.4.6 | apps/web/package.json dependencies | System/light/dark root resolution |
| clsx | 2.1.1 | apps/web/package.json dependencies | Conditional class composition |
| tailwind-merge | 3.7.0 | apps/web/package.json dependencies | v4/prefix-aware class conflict resolution |
| class-variance-authority | 0.7.1 | apps/web/package.json dependencies | Minimal Button variants |
| lucide-react | 1.50.0 | apps/web/package.json dependencies | Named icon strategy; two sample icons |

Single root lockfile; npm may hoist files physically. No pre-existing locked package version changed and no other workspace manifest changed. Bundled Playwright/installed Chromium were reused through environment-provided module/executable paths; no Playwright/browser product dependency or second lockfile added. Broader form/query/chart/toast libraries were not installed.

## Files changed

Existing production files changed: `apps/web/package.json` (foundation dependencies and supported webpack dev/build scripts), `apps/web/src/app/layout.tsx` (CSS/provider/root attribute handling), root `package-lock.json`. New foundation/test files listed in File architecture. No existing feature page was modified.

Roadmap DS-02 report/master/design-system index updated; evidence screenshots and JSON reside under `docs/ui-product-roadmap/01-design-system/./`. Hash comparisons confirm backend/shared source/schema unchanged. Pre-existing unrelated MB15 work retained.

## Tests

| Check | Command / evidence | Result |
|---|---|---|
| Web type/lint | npm run typecheck -w @ai-sales-agent/web; npm run lint -w @ai-sales-agent/web through final root runs | PASS |
| Web helper tests | node --import tsx --test apps/web/src/lib/*.test.ts | PASS4/4 (three preserved refresh tests + cn) |
| Build | npm run build -w @ai-sales-agent/web → next build --webpack | PASS; CSS compiled/type/page output validated |
| Repo type/lint | npm run typecheck; npm run lint | PASS across every workspace |
| Repo unit tests | npm test | PASS403/403; initial loopback-test sandbox EPERM rerun with local socket permission |
| Browser | node apps/web/test/foundation-browser.mjs with existing PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM_EXECUTABLE; DS_BASE_URL optional | PASS themes/system/persistence/RTL/LTR/mobile/focus/contrast/legacy/hydration |
| Hidden route | production request without DS_FOUNDATION_PREVIEW |404 |
| Development | npm run dev -w @ai-sales-agent/web -- --hostname127.0.0.1 --port3104; internal route request |200, webpack compile |
| Scope/lock audit | source hashes, workspace lock comparison, emitted CSS inspection | PASS |

Harness baseline flag --baseline was used only before source adoption, with local old production build. Do not recapture approved legacy baselines to conceal a regression. Playwright module/executable are caller configuration, not hardcoded machine paths in repository code. External browser requests blocked;401 fixture errors excluded from hydration error collection, all page/hydration errors still asserted absent. A missing backend session is not real agent acceptance.

Monorepo full type/lint/unit validation covers dependency/config regressions; no destructive integration/service/database commands were run. No existing assertion weakened. Initial native-script DOM text difference was corrected by excluding non-rendered script/style text while retaining visible text/style/layout and strict image checks.

## Risks

Future generators may introduce unprefixed classes or global base selectors; review diffs and keep current sources/prefix. Primitives that depend on Preflight need explicit scoped defaults. DS marker is required for token consumers and future portal mounts. Web dev/build intentionally use webpack due execution-environment Turbopack/PostCSS failure; revisit Turbopack only with passing equivalent CSS/browser gates. No package/Next version upgrade was used as workaround.

## Known limitations

Full font/spacing/type scale, global i18n and product RTL remain unimplemented. No final shell/sidebar/product components. One Button is a minimal documented adaptation, not DS-04 completeness. Only representative no-org/fixture legacy states were browser compared; authenticated large datasets/interaction flows remain future UX/QA evidence. CSS/OKLCH was verified with existing Chromium, not Safari/Firefox; browser support policy/cross-browser coverage remains future quality work. Full platform accessibility compliance is not claimed. Test Assistant initialization/privacy/parity defects remain untouched.

## DS-03 prerequisites

DS-02 foundation gates pass; **DS-03 is NOT_STARTED**. Next phase may evaluate Arabic/Latin font licensing/loading, readability, hierarchy, spacing/density and numerals using these tokens. Preserve prefix/source/no-Preflight/scoped-theme policy, root legacy typography until intentional adoption, and existing route screenshots. Changes to existing feature pages or full RTL remain their own later phases.

## Acceptance criteria

- [x] Monorepo/dependency ownership verified; frontend-only pinned dependencies and one lockfile.
- [x] Tailwind v4 compiled with controlled foundation sources and tw prefix.
- [x] Global Preflight omitted; scoped normalization and legacy coexistence verified.
- [x] Minimal shadcn configuration/Button, icons and canonical cn established.
- [x] Semantic/state/sidebar tokens, radius/shadow/motion foundation implemented.
- [x] Light/dark/system resolution and preference persistence pass.
- [x] Internal LTR/RTL desktop and mobile sample passes with screenshots.
- [x] Required text/focus/input contrast pairs pass measured thresholds.
- [x] Legacy representative routes pixel-identical; no feature migration.
- [x] SSR/hydration checks show no introduced browser errors; production preview hidden by default.
- [x] Frontend build/tests and repository type/lint/unit gates pass.
- [x] Backend/schema/migration scope unchanged and docs statuses synchronized.

## Exit gate

**PASS: DS-02 COMPLETE.** Foundation implementation and bounded evidence meet this phase's gates. Do not infer later UX/backend/Meta acceptance. DS-03 remains NOT_STARTED; stop after the final DS-02 report.
