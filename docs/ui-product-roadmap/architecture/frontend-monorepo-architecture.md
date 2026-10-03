# Frontend Monorepo Architecture

## Status

ARCHITECTURE_REORGANIZATION: COMPLETE after quality gates. DS-01 COMPLETE; ROLL-01 COMPLETE; DS-02 COMPLETE after subsequent package-based revalidation; DS-03 COMPLETE after typography/spacing acceptance. The existing foundation is relocated unchanged; its earlier COMPLETE evidence is archived, not erased.

## Goals

Make ownership and dependency direction explicit without redesign, new features or behavior changes.

## Repository ownership model

npm workspaces apps/* and packages/*; existing @ai-sales-agent namespace and single root package-lock.json. No parallel alias or build system.

## packages/design-system

Application-agnostic visual primitives, tokens, scoped styling and class merging. Native Button is relocated; no additional primitive or theme added. React is a peer dependency. No business queries, organization resolution or backend dependencies.

## apps/web/client

apps/web/src/client owns Business Dashboard reusable behavior. OperatorNav is in navigation. Existing one-consumer feature pages remain route-local until scoped feature migration; future business implementations belong in client/features/<domain>.

## apps/web/admin

apps/web/src/admin is a documented ownership namespace. No Admin features, routes or placeholder dashboard were added.

## apps/web/shared

Shared web application infrastructure: shared/auth/supabase, shared/capabilities/CapabilityGuard and shared/utils/dashboard-refresh. No speculative API/query/provider extraction. Visual primitives never belong here.

## apps/web/providers

ThemeProvider integrates next-themes with the app. Root server layout composes it. Future auth/query/organization providers join this namespace only when needed.

## App Router ownership

All page, layout, error, route-handler and authentication entrypoints remain apps/web/src/app. The internal design-system fixture is route-owned because it uses the web theme integration. Next proxy.ts stays at its mandated location.

## Dependency direction

Web → design-system/contracts. Client/Admin → shared and their own implementation. Design-system → React and frontend-safe class/styling libraries. No reverse package-to-app direction.

## Allowed imports

Client: own code, shared, design-system, contracts. Admin: own code, shared, design-system, contracts. Shared: contracts and generic web libraries. Providers: web infrastructure/theme integration. Routes: appropriate feature/infrastructure implementation.

## Forbidden imports

Client → Admin; Admin → Client; shared → Client/Admin business code; design-system → apps/web, contracts with business coupling, server/worker, database or agent packages. Relative paths must obey the same boundaries as aliases.

## Package exports

@ai-sales-agent/design-system explicitly exports Button, buttonVariants and cn from compiled dist. /utils exposes cn for generator integration. /styles.css exposes the source CSS entry for consuming PostCSS. The public /components/ui and /components/ui/button entries expose only the existing Button. /components/ui and /utils use source typings for generator path resolution, while runtime imports remain compiled JS. No recursive barrel or public business API. NodeNext #components/#lib package imports resolve source for tooling and dist at runtime.

## Styling ownership

Existing tokens, Tailwind bridge and scoped normalization live in packages/design-system/src/styles. Web imports its styles.css once. Package @source scans its primitives only; web registers its route-local fixture. Existing tw prefix and no Preflight are preserved. Web legacy color-scheme compatibility stays apps/web/src/styles/legacy-compat.css. PostCSS execution stays web-owned; package owns its Tailwind CSS dependency.

## State/data ownership

Business fetching/forms/SSE/state stay in existing Client pages. Auth and capability helpers retain their exact behavior. Design-system accepts props and owns no API/state/data contract. No tenant, permission, booking or preview behavior changes.

## Client vs Admin boundaries

Separate namespaces and no cross-imports. Shared behavior must be demonstrably common application infrastructure; entity-aware patterns stay with their surface.

## Design System boundaries

Generic Button and cn are valid. Customer cards, booking controls and business capability guards are not package primitives. Generic visual patterns may live in components/patterns only when their props are domain-free.

## Route stability rules

Zero page/handler paths added, removed or moved. The pre-existing post-DS01 internal preview explains 23 pages plus 30 handlers versus the historical 22-page audit. Route groups (client)/(admin) are deferred until layout ownership warrants them; preserve public URLs and auth/proxy semantics.

## Naming conventions

Use @ai-sales-agent/design-system workspace imports across packages and existing @/* within web. Cohesive shared modules; no giant shared/utils.ts. Preserve existing filenames during moves. Only real modules create directories.

## File placement decision tree

Does it know business entities? Keep it outside design-system. Client only → web/src/client; Admin only → web/src/admin. Common application infrastructure → web/src/shared. Pure reusable visual foundation → packages/design-system. Provider composition → web/src/providers. Framework entrypoint → web/src/app or proxy.ts. Unclear ownership → inventory UNKNOWN and defer relocation.

## Examples

OperatorNav → client/navigation. CapabilityGuard → shared/capabilities. Supabase server helper → shared/auth. Button → design-system/components/ui. Internal theme fixture → app/internal/design-system. Future Client page may import a client/features implementation without changing its URL.

## Anti-patterns

Design-system importing Customer API; Client importing Admin features; every feature creating a Button; business type hardcoding whole page structure; shared becoming a dumping ground; package API queries; huge route implementations. Existing large route pages are acknowledged migration debt and are not mechanically extracted during this structural phase.

## Migration notes

See [before-move ownership ledger](frontend-ownership-inventory.md). Thirteen existing files moved; imports updated without behavior changes. Existing workspace packages compile with tsc to dist; the new package follows that convention. Next config stays unchanged because App Router consumes compiled JS and package CSS successfully. Root gates include the new package and existing web helper tests. Shadcn configs point to the package owner. Subsequent DS-02 read-only shadcn info verification confirms source routing in both workspaces; no primitive installation ran. Historical roadmap results remain separate from current gates.

## Future DS-02 integration

DS-02 was reopened at reorganization and is now COMPLETE after subsequent package-based revalidation. Existing package tokens/theme/light-dark/RTL/accessibility were verified without palette recreation. Do not duplicate tokens or create competing Client/Admin foundations. DS02_READY requires successful package and consuming web compilation.

## Typography and font ownership (DS-03)

Semantic typography/spacing stays in the existing package token file and scoped typography.css. Single styles.css entry adds typography after foundation. Web owns one next/font/local Arabic loader and asset under src/styles; only adopted fixture surfaces apply its variable. Root/legacy font rendering is unchanged. Semantic classes and the existing tw bridge share canonical values. Generic ds-page gutter/max-width CSS is foundation guidance; it does not implement the final DS-06 App Shell. See [DS-03](../01-design-system/DS-03-typography-and-spacing.md).
