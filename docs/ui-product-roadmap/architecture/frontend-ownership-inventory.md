# Frontend ownership inventory

Inventory recorded before relocation. All route entrypoints remain at their existing URLs.

| Previous source | Ownership | Target |
| --- | --- | --- |
| `apps/web/src/components/OperatorNav.tsx` | CLIENT | `apps/web/src/client/navigation/OperatorNav.tsx` |
| `apps/web/src/components/CapabilityGuard.tsx` | WEB_SHARED | `apps/web/src/shared/capabilities/CapabilityGuard.tsx` |
| `apps/web/src/lib/supabase/browser.ts` | WEB_SHARED | `apps/web/src/shared/auth/supabase/browser.ts` |
| `apps/web/src/lib/supabase/server.ts` | WEB_SHARED | `apps/web/src/shared/auth/supabase/server.ts` |
| `apps/web/src/lib/dashboard-refresh.ts` | WEB_SHARED | `apps/web/src/shared/utils/dashboard-refresh.ts` |
| `apps/web/src/lib/dashboard-refresh.test.ts` | WEB_SHARED | `apps/web/src/shared/utils/dashboard-refresh.test.ts` |
| `apps/web/src/lib/utils.ts` | DESIGN_SYSTEM | `packages/design-system/src/lib/utils.ts` |
| `apps/web/src/lib/utils.test.ts` | DESIGN_SYSTEM | `packages/design-system/src/lib/utils.test.ts` |
| `apps/web/src/components/ui/button.tsx` | DESIGN_SYSTEM | `packages/design-system/src/components/ui/button.tsx` |
| `apps/web/src/styles/design-system/tokens.css` | DESIGN_SYSTEM | `packages/design-system/src/styles/tokens.css` |
| `apps/web/src/styles/design-system/tailwind.css` | DESIGN_SYSTEM | `packages/design-system/src/styles/tailwind.css` |
| `apps/web/src/styles/design-system/foundation.css` | DESIGN_SYSTEM | `packages/design-system/src/styles/foundation.css` |
| `packages/design-system/src/components/patterns/foundation-preview.tsx` | ROUTE_ONLY | `apps/web/src/app/internal/design-system/foundation-preview.tsx` |
| apps/web/src/app/**/page.tsx | CLIENT or ROUTE_ONLY | KEEP_IN_PLACE: existing feature pages remain route-local until their feature migration |
| apps/web/src/app/api/**/route.ts; auth/callback | ROUTE_ONLY | unchanged server entrypoints; auth helper imports updated |
| apps/web/src/app/layout.tsx; globals.css; global-error.tsx | ROUTE_ONLY | unchanged composition ownership |
| apps/web/src/providers/theme-provider.tsx | PROVIDER | unchanged |
| apps/web/src/proxy.ts | KEEP_IN_PLACE | Next.js mandated entrypoint |
| apps/web/src/admin | ADMIN | structural README only; no existing admin implementation |
| inline feature fetch/forms/permissions/state | CLIENT | KEEP_IN_PLACE within current route pages; no speculative shared extraction |

No UNKNOWN reusable modules found. There is no centralized API client, organization provider, permission evaluator or feature directory to relocate. Those remain future integration work. Route groups are deferred to avoid unnecessary route/layout churn.
