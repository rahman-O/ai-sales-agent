# Assumptions and decisions needed

Status: PROPOSED defaults, dated 2026-09-23. These unblock planning, not implementation approval.

## Repository evidence

The workspace root was empty, including hidden entries. `git rev-parse --show-toplevel` reported no Git repository. No package manifests, application code, migrations, tests, or workspace instructions existed. Ancestor AGENTS.md checks found none. There is no existing architecture to preserve and no application migration to perform. All implementation paths in this package are proposed.

## Product decisions (owner: product lead; close in P00)

- Q01: The provisional vertical is dental-clinic reception/scheduling. Which named pilot clinic, country of operation, and privacy/data residency constraints apply? Prohibit clinical advice by default; the vertical remains unapproved until human evidence exists.
- Q02: Is the platform the appointment source of truth? Default yes. An existing external calendar changes booking scope and the critical path.
- Q03: Confirm one location, one resource, fixed service duration, and no deposits/group appointments for MVP.
- Q04: Confirm Iraqi Arabic and English, approved tone, mandatory qualification fields, and operator coverage hours.
- Q05: Approve consent wording, reminder purpose, retention periods, customer deletion workflow, and handling of minors/sensitive data with appropriate reviewers.
- Q06: Select hosting region, managed database/storage, identity provider, approved model providers, and maximum spend per tenant. Provider approval includes processing terms.
- Q07: Who owns each WhatsApp business account and onboarding? Validate access, review requirements, templates, and disconnect/reconnect workflow before building dependent features.
- Q08: Approve proposed SLO/load envelope, pilot success measures, support staffing, and rollout/rollback authority.

## Planning defaults

Tenant isolation uses shared tables with organization IDs and RLS defense in depth. One active conversation per channel connection and customer identity. Existing medical software integration is deferred. Costs and library versions are deliberately unpinned until discovery verifies compatible releases. Proposed operating targets live in [monitoring](../10-devops/monitoring.md); retention defaults in [retention policy](../06-data/retention-policy.md).

No repository evidence contradicted the stack; the absence of a repository means all operational assumptions remain unvalidated. External provider documentation changes; see [source register](sources.md).

The detailed Q01–Q08 options, recommendations, owners, statuses, dependencies, trade-offs, and acceptance evidence are maintained in the [Phase 00 decision register](../14-roadmap/phase-00-decision-register.md).
