# Product UI principles

Status: NOT_STARTED for implementation. Inspection date: 2026-10-03. This document defines review criteria; it does not certify the existing frontend.

## Product boundaries

Business Client serves organization owners and employees. Platform Admin serves explicitly authorized SaaS operators through a separate route namespace, authorization bootstrap and information architecture. They share visual components, not grants. Customers interact through channels; there is no customer dashboard in this roadmap. Organization ADMIN and the navigation ADMIN group do not confer platform access.

## Visual foundations

Use a calm, restrained interface with strong typography and subtle surfaces. Avoid decorative gradients, excessive shadows and card wrapping for every row. Semantic tokens define background, foreground, muted text, borders, actions, destructive states, success and warning. Light/dark/system themes propagate through tokens. Document spacing, type, radius, z-index, motion and focus scales. Feature pages cannot introduce random colors or repeat raw visual recipes that belong in reusable components.

Place shadcn primitives in components/ui and compose product components outside it. Modify primitives only with a recorded compatibility/accessibility reason. Arabic and English typography must support long daily use, diacritics, fallback loading and zoom. Icon-only controls require names; Lucide directional icons mirror selectively. Sonner notifications supplement persistent field/page feedback rather than replacing it.

## Business language

| Backend concept | Visible product language | Rule |
|---|---|---|
| KnowledgeSource | Company Information | FAQs, Notes, Documents and Business information first; processing/publication states remain visible. |
| Policy Engine | Business Rules | Capability-relevant typed forms; backend policy types stay authoritative. |
| Human Handoff | Take over conversation | Ownership and return-to-AI controls live in Inbox. |
| PREVIEW | Test Assistant / TEST MODE | Always visibly distinguish simulation from production. |
| Generic catalog | Catalog, Services, Products, Packages | One model and capability adapter; no clinic/store page branches. |

## Navigation and authorization

Reuse packages/contracts/src/navigation.ts. Capabilities determine relevance; permission determines access; rollout flags determine exposure. None substitutes for another. Coming-soon items are not enabled routes. Pending or failed capability bootstrap must not grant access through defaults. Profile and membership come from authoritative auth/me and organization contracts. A remembered organization ID is a convenience only.

Unknown roles or unsupported enum values fail safely. Owner/Manager/Support Agent/Receptionist are desired product presets, but actual roles are OWNER/ADMIN/MEMBER. Do not invent differentiated grants: Owner uses its verified role; a Manager alias requires identical Admin semantics; Support/Receptionist remain blocked until reviewed granular permissions exist. Keep a small preset list, not a giant default matrix.

## Interaction and data truth

Backend remains authoritative for prices, availability, effective rules, lifecycle, permissions, ownership epochs and delivery. Do not optimistically confirm consequential mutations. Preserve draft on rejection, reconcile ambiguous outcomes, and do not blindly retry sends or booking/payment-like actions. Distinguish loading, refreshing, empty, no matches, denied, unsupported, stale and failed. Show timestamps and units for analytics; unavailable is not zero.

Realtime events trigger bounded invalidation/refetch. Existing dashboard-refresh coalescing is an asset. Cache keys contain organization and relevant authorization context; switching organization cancels old requests and clears tenant drafts/data before revealing the next organization.

## Test Assistant safety and priority

Test Assistant is the first product milestone after design and integration gates. Use the same production agent stack with server-enforced PREVIEW READ_ONLY/SIMULATED/BLOCKED tool policies. Create server-issued session IDs, support reset/new-session, and explain expiry or restart recovery. No production outbound messages or accidental real mutations are allowed.

Optional debug is an allowlisted safe projection: workflow/stage, tool name/status, execution mode, latency and reviewed simulated changes. Never display chain-of-thought, hidden prompts, secrets, raw provider bodies or arbitrary tool argument/result dumps. Real-provider parity evidence is required for agent acceptance; synthetic UI fixtures are only for deterministic component/visual tests.

## Arabic, responsive and accessibility

Root lang and dir own locale/direction, including overlays. Use logical properties, isolate mixed identifiers and format canonical dates in organization timezone. Theme and locale changes preserve drafts and focus. Start at 320px, then tablet and desktop; secondary panels become sheets without losing accessible navigation. Aim WCAG 2.2 AA, keyboard completion, visible focus, contrast, meaningful names, reduced motion and chart data alternatives. Automated checks supplement manual screen-reader testing.

## Delivery discipline

No design-system phase is complete because older operational dashboard work was CLOSED. Every phase requires its own reviewed evidence. Platform billing, subscriptions, operator metrics, support access and flags need verified contracts before enabled screens. This roadmap does not authorize backend redesign. Preserve existing quality assertions. Local simulator and preview enable pre-Meta UI delivery; real Meta live acceptance remains separate, MB15 remains NOT_CLOSED, and this roadmap requires no real Meta contact.

Visual primitives/tokens belong to `packages/design-system`; business-aware Client/Admin components remain in their web namespaces. Auth/API/capability infrastructure belongs to web/shared; providers remain web-owned.
