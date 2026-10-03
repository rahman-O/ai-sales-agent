# DS-03 Typography & Spacing

## Status

**COMPLETE — 2026-10-03.** DS-01, ROLL-01 and DS-02 remain COMPLETE. DS-04 is NOT_STARTED. Only typography/spacing foundation, font integration, internal specimens, tests and documentation changed. No product feature migration, Admin feature, backend/database/Agent change, migration or Meta contact.

## Objective

Define one calm, readable, bilingual typography and spacing foundation for future dashboard work. Reuse the existing package, approved tw prefix, scoped surfaces, token ownership and no-global-Preflight architecture; do not build a Typography React API or final App Shell.

## Existing baseline

CURRENT_FONT_STRATEGY before DS-03: root system-ui with inline 24px body padding, mixed route-local system/Georgia/monospace declarations, no next/font loader or font assets. CURRENT_ARABIC_FONT: no intentional font; platform fallback. CURRENT_LATIN_FONT: system UI at root, with Georgia in several existing routes. Route-local pixel sizes ranged from 10 to 28; explicit weights included 500/600/700/800 and line heights 1.4/1.5/1.6. No package semantic typography/spacing scale. [Before-change inventory](evidence/ds03/baseline-inventory.json). These legacy declarations remain unchanged.

## Font ownership

Web owns the single local font asset and next/font/local loader in apps/web/src/styles/fonts.ts. Design-system owns semantic --ds-font-sans/arabic/mono tokens in its existing tokens.css. Only the internal adopted main receives arabicFont.variable; root/body/product routes do not. Other frontend frameworks can provide --app-font-arabic without any package dependency on Next.

## Arabic font strategy

Noto Sans Arabic, locally hosted variable WOFF2, normal width, exposed weights 400–600. This is a restrained sans Arabic choice with broad script coverage and useful weights; readability and bilingual balance were verified in the fixture. The [official font metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarabic/METADATA.pb) identifies Arabic/Latin coverage and variable weight/width axes; [upstream description](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarabic/DESCRIPTION.en_us.html) describes its sans design. One 361,528-byte WOFF2 was compressed from the official TTF using existing fontTools 4.61.1; all glyphs/axes retained, no subsetting. OFL license, copyright and provenance/checksums are stored beside the asset. No external runtime font request or font dependency.

## Latin font strategy

Retain neutral system UI for Latin rather than add a second downloaded family. Package stack: system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif. Explicit lang=en switches mixed-script spans back to that stack; lang=ar uses Arabic. Existing dashboard platform familiarity and modest 400/500/600 weights remain compatible with Noto Arabic; visual specimens verify both scripts at shared role sizes.

## Font fallback

Arabic: var(--app-font-arabic, Noto Sans Arabic), Tahoma, Arial, sans-serif. Latin: system stack above. Code: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace. next/font/local uses display=swap, preload=false and adjustFontFallback=false; no automatic Latin metric adjustment is applied to Arabic. Font-network denial in a fresh browser context verifies readable fallback, glyph bounds and no horizontal overflow. One authoritative loader/asset; no remote runtime dependency.

## Typography hierarchy

Semantic CSS roles apply only inside [data-ui=ds]. No React Typography wrapper or giant barrel.

| Role / class suffix | Size at 16px root | Leading | Weight |
| --- | --- | --- | --- |
| page-title | 24px mobile/tablet; 32px desktop | 1.6 | 600 |
| section-title | 20px | 1.6 | 600 |
| card-title | 18px | 1.6 | 600 |
| body | 16px | 1.75 | 400 |
| body-small | 14px | 1.75 | 400 |
| label | 14px | 1.6 | 500 |
| helper | 14px | 1.75 | 400 |
| caption | 12px | 1.6 | 400 |
| metric-lg / metric-md | 32px / 24px | 1.5 | 600 |
| code | 14px | 1.75 | 400 |

Use ds-text-<role>; ds-text-long changes body leading to 1.875. Helpers/captions inherit muted-foreground. Captions are metadata, not essential instructions. Prefer semantic roles over ad hoc sizes.

## Size scale

Seven rem values: xs .75, sm .875, base 1, lg 1.125, xl 1.25, 2xl 1.5, 3xl 2. These are --ds-text-* tokens and the corresponding tw:text-* bridge. Larger default Tailwind size families are cleared in the approved theme bridge. Normal body remains 16px at the default root; no 13/17/19/23px styles or marketing display type.

## Line heights

Compact labels/captions 1.6; body 1.75; long paragraphs 1.875; headings 1.6; metrics 1.5. No global tight leading or fixed text height. Browser canvas ink-bound measurements verify marked Arabic diacritics fit each sample line at normal and 200% text size; desktop/mobile screenshots show no clipping. Do not clamp Arabic labels or truncate instructions solely to enforce density.

## Font weights

400 regular, 500 medium, 600 semibold. Hierarchy uses size, spacing and semantic color as well as weight. Body/helper copy remains regular; headings/metrics use semibold. The Tailwind weight bridge exposes normal/medium/semibold and clears the inherited wider weight family. No broad bold/800 adoption.

## Letter spacing

Normal tracking throughout, including metrics. Arabic explicitly resets letter-spacing to normal. No uppercase tracking rule or Latin negative tracking applied to Arabic. Full language/localization policy remains DS-07.

## Metric typography

ds-text-metric-lg (2rem) and metric-md (1.5rem) use tabular-nums, 600 and 1.5 leading. Specimens include 124, 12.4%, IQD 250,000 and ١٢٤. Use bdi with an explicit direction for currency/identifiers where appropriate; locale formatting belongs to consumers. Numerals are aligned and restrained rather than oversized card decoration.

## Spacing scale

Existing quarter-rem Tailwind basis is consolidated as --ds-space-unit: .25rem in the existing token file. Approved values are:

| Token suffix | rem | Default px |
| --- | --- | --- |
| 0 | 0 | 0 |
| 1 | .25 | 4 |
| 2 | .5 | 8 |
| 3 | .75 | 12 |
| 4 | 1 | 16 |
| 6 | 1.5 | 24 |
| 8 | 2 | 32 |
| 12 | 3 | 48 |

Derived tokens share that basis; the Tailwind --spacing bridge uses it. No second spacing file/scale. Tailwind still permits numeric utilities; use the approved scale rather than arbitrary values. Existing specimen padding now references the canonical compact-card token instead of another literal.

## Semantic spacing rules

Page gutter 16/24/32px; page block padding 24px; section gap 32px; standard card padding 24px, compact 16px; standard form/group gap 24px, compact/field gap 16px; label/control/helper gap 8px; inline actions 8px; button-group gap 12px. Table cells use inline 16px/block 12px standard, inline 12px/block 8px compact. Dialog guidance reuses standard card padding 24px, compact 16px on narrow surfaces. Reuse shared tokens/scale; do not create a variable for every use case.

## Page gutters

Mobile <40rem: 1rem (16px). Tablet >=40rem: 1.5rem (24px). Desktop >=64rem: 2rem (32px). Large desktop >=90rem retains 2rem; content is bounded at 90rem, border-box, centered with margin-inline:auto. ds-page uses padding-inline and padding-block. Apply once per surface, avoid nested gutters. Fixture retains the legacy root body 24px outer padding; these measurements refer to the semantic inner container. DS-06 owns final shell/root adoption.

## Section rhythm

ds-sections establishes 32px between major title/content/form sections; ds-stack uses 16px for content blocks. Title→description can use 8px; description→actions 16px; action/stat/section transitions 24–32px from the approved scale. Inline groups use 8px, button groups 12px. Preserve hierarchy rather than invent per-card or per-page gaps.

## Card density

Standard .ds-card-space: 24px for substantive content; compact .ds-card-space-compact: 16px for metadata/control panels. Both keep readable type; compact does not mean tiny text. Existing specimen wrappers show both, no new Card React component or feature-specific card variant.

## Form rhythm

ds-form uses 24px group gaps; ds-form-compact uses 16px. ds-field uses 8px label→control→helper/error spacing; field→field 16px, group→group 24px, section→section 32px, actions after content 24px. Labels are 14px/500; helpers/errors at least 14px with explicit text. Native read-only specimen inputs demonstrate rhythm without form submission, schema or full Form primitives.

## Table density

DEFINED for later DS-04/DataTable work: standard cell inline 16px/block 12px; compact inline 12px/block 8px. Body-small 14px or body 16px, natural multi-line height; do not shrink Arabic names below the body-small role. Interactive rows should retain 44px targets and enough room for badges/actions. Tablet preserves readable columns with scoped scroll when needed. Mobile may use a summary/card fallback in later feature work. No DataTable implementation in DS-03.

## Control sizing

Minimum heights: small 2.25rem (36px), default 2.75rem (44px), large 3rem (48px). Native field .ds-control and existing Button use default minimum; small is a desktop density option. Coarse pointer promotes small minimum to 44px. Padding inline 12px/block 8px and natural glyph metrics may grow controls beyond their minimum; no fixed-height clipping. Existing DS-02 native theme switchers/sample input are verification controls, not a claim of a complete certified primitive suite.

## Icon sizing

Inline 1rem/16px, control 1.25rem/20px, navigation 1.5rem/24px, empty-state 2rem/32px. Generic CSS classes ds-icon-inline/control/navigation/empty prevent arbitrary size props; existing fixture Lucide icons use ds-icon-control. Icon dimensions are separate from the parent hit area; decorative fixture icons remain aria-hidden. No icon catalog or package Lucide dependency added.

## Responsive behavior

Body, helper, label, section/card titles and metrics stay stable. Only page-title changes from 24 to 32px at 64rem. Page gutters adjust at two meaningful breakpoints; large desktop uses the same gutter with bounded width. All tokens use rem where relevant. Browser checks 375/768/1280/1440/1920px, touch context and 200% text zoom; no overflow.

## RTL/LTR behavior

Spacing uses inline/block, gap and symmetric shorthand; no new left/right padding/margin assumptions. Metric bdi isolates directed numeric strings. Scoped :lang(ar)/:lang(en) chooses script families without global locale state. The fixture supports both directions in both themes; full product direction migration remains DS-07.

## Package ownership

tokens.css remains the sole semantic token definition file, now including typography/spacing alongside unchanged DS-02 colors/radius/shadow/motion. typography.css contains scoped semantic role/layout helpers. Package has no Next/font, asset URL, API, business or app imports. Web owns fonts.ts, one font asset/license/provenance and route-local TypographyPreview. No workspace/runtime dependency or lockfile change.

## Tailwind integration

Existing v4.3.3 @theme inline bridge maps font families, seven text sizes, normal/medium/semibold weights and spacing to canonical --ds-* values. tw prefix, source(none), package primitive scan and web fixture-only source registration remain unchanged; global Preflight remains disabled. CSS import order: tailwind → tokens → foundation → typography, then web legacy compatibility through the existing single styles.css entry. [Official theme-variable guidance](https://tailwindcss.com/docs/theme) describes the namespace bridge.

## Internal fixture

Existing /internal/design-system stays production-gated and unlinked from navigation. Main applies the local font variable and ds-page. Route-owned TypographyPreview adds Arabic/English titles, long diacritized paragraphs, role samples, metrics, card densities and standard/compact native form spacing. No product routes, app shell, business data or Meta flow changed.

## Accessibility checks

Foundation-only PASS: inherited DS-02 contrast checks (18 pairs per theme), visible 2px focus/native Button keyboard order, readable 16px body/14px helper, Arabic ink bounds, no horizontal overflow, coarse-pointer 44px control minimums, font-denial fallback and 200% text zoom. Screenshot inspection confirms script joining and rhythm. No axe/whole-product WCAG claim. [Typography measurements](evidence/ds03/typography-results.json), [light contrast](evidence/ds03/contrast-light.json), [dark contrast](evidence/ds03/contrast-dark.json).

## Legacy coexistence

Typography/font variables/classes apply only to adopted [data-ui=ds] boundaries. Root layout/body/font provider and Client/Admin feature routes remain unchanged. Established Login/Dashboard/Policies/Orders/Test Assistant computed-style and byte-identical screenshot regression passes, including saved dark-theme navigation. Historical DS-02 and package-revalidation screenshots were not overwritten.

## Files changed

Package tokens/typography/Tailwind/foundation/entry styles and focused tests; web-local font asset/license/provenance/loader, internal foundation/typography specimens and browser harness extension; phase/master/section/architecture documentation and new DS-03 evidence. Exact file list and scope verification are in [acceptance.json](evidence/ds03/acceptance.json). No dependency additions or metadata/lock changes.

## Tests

Independent design-system build PASS; independent web build PASS; root typecheck/lint PASS; root npm test PASS, 417 tests, zero failures; root npm run build PASS. Existing boundaries remain zero and source/Preflight/token assertions pass. Three focused tests cover readable rem scale/weights, scoped logical typography/unique spacing basis, and app-owned loading. Browser reuse preserves all prior assertions and adds eight theme/direction/desktop/mobile matrices, responsive gutters/max width, icon size, font availability/fallback, glyph bounds, density, coarse pointer and text zoom.

## Risks

Fonts and text may naturally increase block height; use min heights and wrapping, not clipping. Variable font is approximately 353KiB; it is local, loaded only when used and not root-preloaded. Future adoption must use one font loader and one page gutter boundary. Additional script/platform/browser testing may reveal different fallback metrics; retain readable fallback and natural layout.

## Known limitations

No product page migration or typography certification for all languages/platforms. System Latin rendering varies by OS. Text zoom is tested by doubling the root font size, not every browser chrome zoom mode. Existing native verification selectors are not a full Input/Select suite. Actual table/dialog/form component APIs, final shell and full RTL/locale infrastructure remain later phases. No operational/real-provider/Meta acceptance implied.

## DS-04 prerequisites

DS-01/ROLL-01/DS-02/DS-03 COMPLETE. DS-04 may expand core primitives using the authoritative semantic font/size/spacing system and controlled coexistence model. It remains NOT_STARTED and was not executed here.

## Acceptance criteria

FONT_OWNERSHIP DEFINED; Arabic/Latin/fallback/type scale/leading/weights/metrics/spacing/gutters/section/form/control/icon/RTL foundation PASS. LTR/RTL/Arabic/English fixture PASS; five legacy routes pixel-identical; accessibility foundation PASS; hydration errors NONE. DESIGN_SYSTEM_IMPORTS_WEB 0, CLIENT_IMPORTS_ADMIN 0, ADMIN_IMPORTS_CLIENT 0. Independent package/web and root quality gates PASS. No backend/database change or migrations.

## Exit gate

**PASS — DS-03 COMPLETE.** Typography and spacing are authoritative and verified for future UI work. Stop after this report. NEXT_PHASE: DS-04 — Core Components; NOT_STARTED.
