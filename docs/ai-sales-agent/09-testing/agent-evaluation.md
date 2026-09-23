# Agent evaluation tests

## Scope

Real-provider language and tool-selection behavior.

## Required cases

Use the dataset and thresholds in [evaluation strategy](../04-agent/evaluation-strategy.md). Freeze holdout examples; compare candidate prompt/model against active baseline, with three repeated runs per case and human dialect review.

## Evidence and failure checks

Report tool correctness, factual grounding, clarification, escalation, false success claims, latency and estimated/actual cost. A judge cannot override deterministic security failures. Any unsafe mutation or cross-tenant exposure blocks release even if average quality improves.

Attach reproducible reports to the owning phase closure. Shared gates: [testing strategy](testing-strategy.md).
