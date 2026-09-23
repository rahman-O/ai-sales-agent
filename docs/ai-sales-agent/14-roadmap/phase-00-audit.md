# Phase 00 repository and documentation audit

Audit date: 2026-09-23. Auditor: Codex acting in the requested architecture-review role. Status: REVIEWABLE EVIDENCE; human review pending.

## Repository assessment

The workspace contains `docs/ai-sales-agent/` only: 137 Markdown documents and one standard-library documentation validator at the start of this audit. `git status` reports that the directory is not a Git repository. There are no package manifests, source modules, Prisma schema or migrations, dependency lockfiles, environment definitions, application tests, deployment manifests, credentials, or infrastructure resources. This remains a documentation-only repository. No Phase 01 scaffolding exists or was created.

The documentation validator passed before Phase 00 changes: 122 required baseline documents, 137 Markdown documents, 90 unique roadmap task IDs, 391 valid local links, and 15 balanced Mermaid source blocks. This proves structural coverage and local link existence only. It does not render Mermaid, validate external links, execute a database/provider test, or prove an application behavior.

## Internal consistency review

The architecture is materially consistent on these points: modular monolith; shared-schema tenancy with `organization_id`; global User plus tenant OrganizationMember; PostgreSQL as structured truth; database outbox plus BullMQ wake-ups; backend-controlled tools; channel-neutral messaging; relational prices and bookings; bounded layered memory; explicit human ownership; and uncertain outbound-send state.

The following items were gaps or ambiguities requiring Phase 00 treatment:

- The provisional clinic vertical was generic. The current request makes dental clinics the provisional vertical, but does not constitute product acceptance.
- The master plan proposed up to five pilot organizations, while the new provisional initial MVP says one organization. This is reconciled as one-organization MVP and up-to-five-organization controlled pilot, both pending approval.
- Internal booking authority was recommended but Q02 remained open. It remains PROPOSED because existing clinic calendar use is unknown.
- Version-specific Prisma statements can become stale across major releases. The compatibility plan now requires pinning and testing one version rather than assuming either legacy schema/raw-vector behavior or newer extension APIs.
- Phase 00 lacked a detailed threat matrix, decision register, provider evidence classification, evaluation fixtures, baseline metric dictionary, and closure report. These are now added.

No contradiction requires rejecting the proposed architecture. The unresolved calendar, jurisdiction, provider, identity, hosting, budget, and operating decisions can materially change later phases and therefore block Phase 01 approval.

## Existing evidence versus missing evidence

Repository inspection and documentation structure are directly evidenced. Primary-source documentation supports PostgreSQL RLS/exclusion concepts, Prisma custom/raw migration needs depending on selected version, and WhatsApp template/service-window/escalation policy. ADR-005 is ACCEPTED because the user brief explicitly mandates backend-controlled tools. All other ADRs remain PROPOSED.

No evidence exists for pilot interviews, current clinic workflow, baseline measurements, Meta account/test-number access, live webhook fixtures, outbound provider behavior, chosen host/pooler, a runnable PostgreSQL/Prisma/pgvector/RLS spike, approved privacy position, named decision owners, or product/technical approval. Documentation text is not substituted for any of these.

## Phase 00 task status

- P00-T001: BLOCKED — HUMAN ACTION REQUIRED. No clinic interview or measured baseline exists.
- P00-T002: IN PROGRESS. Q01–Q08 are fully registered with options, recommendations, owners by role, dependencies, and acceptance evidence; none requiring human approval is silently accepted.
- P00-T003: BLOCKED — HUMAN ACTION REQUIRED. Requirements and test protocol exist; no Meta account, test number, credentials, or live fixtures were supplied.
- P00-T004: BLOCKED — HUMAN ACTION REQUIRED. A disposable spike specification exists; host, Prisma version, and infrastructure access are unselected.
- P00-T005: IN REVIEW. Threat, ADR, product boundary, booking, tenancy, metrics, and AI trust reviews are documented; accountable human review is absent.
- P00-T006: BLOCKED — HUMAN ACTION REQUIRED. Roadmap and fixture plan are reviewable, but no product/technical approval authorizes P01.

## Audit conclusion

Phase 00 has moved from NOT STARTED to IN REVIEW / BLOCKED. The package is ready for human decisions and external evidence collection, not for Phase 01 implementation.

