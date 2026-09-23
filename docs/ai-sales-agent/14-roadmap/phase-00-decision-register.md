# Phase 00 decision register

Status values are OPEN, PROPOSED, ACCEPTED, or BLOCKED. “Recommended” records the architecture recommendation; it is not human approval. Owners are roles until named people and decision dates are supplied.

## Q01 — Pilot business, jurisdiction, and data boundary

Question: Will the initial pilot be a dental clinic, in which country/region, and which customer data may the platform process? Why it matters: jurisdiction, hosting, model processing, consent, retention, clinic policy, and WhatsApp eligibility depend on it.

Options: dental reception/scheduling only; broader dental patient workflow; another business vertical. Recommended: dental reception/scheduling only, explicitly excluding diagnosis, triage, treatment advice, medical history, prescriptions, and clinical records. Trade-off: narrow scope reduces value breadth but materially lowers safety and privacy risk. Dependencies: P01 hosting/auth, P04 prompts, P05 knowledge, P14 launch. Owner: product lead with privacy/legal reviewer. Status: BLOCKED. Evidence required: named clinic, operating country, approved data categories and processing/retention position.

## Q02 — Booking source of truth

Question: Is this platform authoritative for appointments, is an external calendar authoritative, or is authority hybrid? Why it matters: conflict prevention, availability, reconciliation, critical path, and operator behavior.

Options: A internal booking engine; B external calendar; C hybrid. Recommended: A for MVP only if the clinic agrees all relevant appointments and schedule changes occur in this platform. Trade-off: lowest technical risk and atomic correctness, but requires operational adoption; B/C add integration, partial-failure, replay, and reconciliation scope. Dependencies: P02 domain, P07 booking, P11 UI, P14 operations. Owner: clinic/product owner. Status: BLOCKED. Evidence required: current booking workflow interview, systems inventory, explicit authority decision, and operator commitment or revised integration plan.

## Q03 — MVP scheduling model

Question: Does MVP use one organization, one location, fixed service durations, one staff resource per appointment, and exclude deposits/group/recurring bookings? Why it matters: database constraints and slot computation change substantially otherwise.

Options: constrained model; add selected complexity; general scheduling. Recommended: constrained model exactly as stated, with multiple staff records allowed but one staff allocation per booking. Trade-off: some clinic appointment types may be deferred. Dependencies: Q02, P02/P07. Owner: product lead and clinic operator. Status: PROPOSED. Evidence required: service/staff/hours sample and written confirmation that excluded appointment types are not pilot-critical.

## Q04 — Language, qualification, and coverage

Question: Which languages/tone, required lead fields, and staffed escalation hours apply? Why it matters: prompt behavior, evaluation, PII collection, and handoff promises.

Options: Iraqi Arabic plus English; Arabic only; broader languages. Recommended: Iraqi Arabic plus English, minimal facts (name or preferred identifier, service interest, scheduling intent/contact channel), and explicit published coverage hours. Trade-off: bilingual evaluation and RTL effort. Dependencies: P04/P06/P09/P11/P14. Owner: product and operations leads. Status: PROPOSED. Evidence required: native-speaker-approved examples/tone, required-field list, named coverage rota, and off-hours wording.

## Q05 — Consent, retention, deletion, and sensitive data

Question: What consent purposes, reminder rules, retention periods, deletion workflow, and treatment of minors/sensitive data are approved? Why it matters: customer rights, proactive messaging, storage, analytics, and provider processing.

Options: adopt proposed defaults after review; stricter tenant policy; jurisdiction-specific alternative. Recommended: purpose-specific consent, no clinical data, no sales follow-up by default, one booking reminder only after approval, and the shorter of approved legal/business need and proposed retention. Trade-off: reduced automation/data history. Dependencies: Q01, P01/P05/P10/P12/P14. Owner: privacy/legal reviewer and product lead. Status: BLOCKED. Evidence required: approved policy, privacy notice/consent language, deletion authority, backup treatment, minors policy, and provider processing approval.

## Q06 — Hosting, identity, providers, and spend

Question: Which region, PostgreSQL/storage host, identity provider, model/embedding providers, Prisma major version, and tenant spend limits are approved? Why it matters: data processing, RLS/pooling compatibility, SDK contracts, cost controls, and deployment.

Options: managed providers meeting the approved region and features; self-managed components; postpone vendor choice. Recommended: one managed PostgreSQL with pgvector/private storage, a managed identity provider supporting secure web sessions/MFA, and one approved primary model provider; choose only after compatibility and processing review. Trade-off: vendor dependence versus operational load. Dependencies: Q01/Q05, P00 database spike, P01, P04/P05. Owner: technical lead with product/privacy approvers. Status: **PROPOSED (partially evidenced)**. Spike-selected Prisma pin: **7.10.0** (+ adapter-pg). Local PG/RLS/pgvector/booking exclusion: **PASS**. Managed Supabase region/credentials, identity project, model provider, and spend limits: still open. Evidence: [technical readiness](phase-00-technical-readiness.md).

## Q07 — WhatsApp ownership and onboarding

Question: Who owns the Meta business assets, phone number, app, credentials, templates, and operational reconnect process? Why it matters: provider access and pilot delivery cannot be delegated to architecture text.

Options: clinic-owned business assets with delegated app access; platform-owned integration where policy permits; approved solution partner. Recommended: clinic-owned number/business identity with documented delegated platform access and platform-managed encrypted credentials. Trade-off: onboarding coordination but clearer business ownership. Dependencies: Q01/Q05, P08/P14. Owner: clinic owner and integration lead. Status: BLOCKED. Evidence required: verified Meta developer/business access, test number, subscribed app, approved test template, credential rotation owner, sandbox payloads, and policy eligibility.

## Q08 — SLOs, pilot success, staffing, and rollout authority

Question: Which reliability/load targets, baseline outcome metrics, support coverage, stop conditions, and enable/rollback authorities apply? Why it matters: P13/P14 gates and honest pilot evaluation.

Options: approve proposed technical targets; revise after measured baseline; operate without explicit targets. Recommended: approve provisional technical targets only after host/provider tests; measure business baseline without promised uplift; name product, engineering, and operations authorities. Trade-off: discovery effort before launch. Dependencies: Q04/Q06/Q07, P12/P13/P14. Owner: product, technical, and operations leads. Status: BLOCKED. Evidence required: baseline interview/data, named people, coverage hours, load envelope, budget, stop conditions, and signed rollout/rollback matrix.

## D09 — Multi-tenancy architecture

Question: Use shared schema with organization-scoped rows, composite tenant references, server authorization, and PostgreSQL RLS defense in depth? Why it matters: P01 foundation and every data path.

Options: shared schema; schema per tenant; database per tenant. Recommended: shared schema for initial scale, with global User and tenant OrganizationMember. Trade-off: strongest discipline required on all queries; simpler operations and transactions. Dependencies: Q06 and database spike. Owner: technical lead. Status: **ACCEPTED** (architecture; ADR-008). Evidence: P00 spike proved runtime non-owner role, FORCE RLS, transaction-local scope under local pool max=1, composite FK behavior; background-job scoping documented for P01. Supabase pooler re-check remains P01.

## D10 — Authentication and session boundary

Question: Which identity provider and application session pattern will establish User and OrganizationMember authority? Why it matters: P01 cannot claim secure auth/session lifecycle without provider proof.

Options: managed OIDC provider with server-side secure cookie session; Supabase Auth if selected stack/region fits; custom auth. Recommended: Supabase Auth with NestJS verification of identity then OrganizationMember lookup; browser organizationId never authorizes alone. Trade-off: vendor dependency and configuration effort versus security maturity. Dependencies: Q01/Q06. Owner: technical/security lead. Status: **PROPOSED — architecture PASS / provider BLOCKED_EXTERNAL_ACCESS**. Evidence: local authorize invariant in spike `auth-boundary.test.mjs`. Live JWT/JWKS/refresh/logout/revocation: P01 acceptance gate.

## D11 — Architecture and roadmap approval

Question: Do accountable product and technical owners accept the reviewed MVP boundary, ADR dispositions, risks, and Phase 01 entry gates? Why it matters: the roadmap explicitly requires authorization before scaffolding.

Options: approve; approve with recorded revisions; reject/rework. Recommended: technical foundation is **READY_FOR_P01** per spike evidence; named human product/privacy sign-off still required for pilot/privacy claims. Trade-off: delays pilot but scaffolding may proceed on technical readiness alone. Dependencies: technical readiness report; remaining Q/D items classified to later gates. Owner: named product and technical leads. Status: **TECHNICAL READY_FOR_P01**; human ceremony still OPEN. Evidence: [technical readiness](phase-00-technical-readiness.md), [closure](phase-00-closure.md).

