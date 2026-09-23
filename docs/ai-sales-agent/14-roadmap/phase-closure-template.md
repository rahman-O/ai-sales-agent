# Phase closure evidence template

Phase ID/name:

Status: NOT STARTED → IN PROGRESS → IN REVIEW → CLOSED. BLOCKED may be recorded with a specific unresolved dependency and owner; it is not completion.

Accountable implementer, product reviewer and technical reviewer:

Implementation commit(s), migration versions, deployed test environment and configuration:

Task results: reference each PXX-TNNN with implementation and verification evidence. Scope removal requires a reviewed decision and updated dependent docs.

Test evidence: exact commands or CI report links, timestamp, fixture/model/prompt versions, environment, deterministic results, evaluation sample sizes and known limitations.

Acceptance checklist: copy phase checkboxes and attach evidence for each. Unchecked required criteria block closure.

Operational proof: logs/traces, redaction, alarms, recovery/rollback, tenant boundary and migration outcomes appropriate to the phase.

Open defects/risks: severity, owner, mitigation and whether they block closure; no implicit waiver of critical integrity/safety issues.

Documentation updates: architecture/API/schema/ADR references reflecting the actual implementation.

Sign-off: product/technical names, decision, date and explicitly authorized next phase. Release/go-live authority is separate from code review where applicable.
