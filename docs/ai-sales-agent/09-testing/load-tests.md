# Load and resilience tests

## Scope

Proposed pilot envelope and saturation behavior.

## Required cases

Baseline: five tenants, 50 simultaneous active conversations, sustained five inbound messages/second and a 30-second burst of 25/second. Run 30 minutes using deterministic model latency, plus a small real-provider sample under approved spend. Inject one hot tenant using 80% of traffic.

## Evidence and failure checks

Measure webhook p95, queue age, end-to-end p95, DB pool utilization, lock conflicts, duplicate effects, fairness and cost. Kill workers, interrupt Redis, throttle providers and delay receipts. Targets live in [monitoring](../10-devops/monitoring.md). Record hardware/configuration; these are proposed load assumptions, not demonstrated capacity.

Attach reproducible reports to the owning phase closure. Shared gates: [testing strategy](testing-strategy.md).
