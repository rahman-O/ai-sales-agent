# Metrics model

Define versioned facts from committed domain events, not model text. Facts contain organization, event/aggregate identity, occurrence/recording times, source channel, conversation/lead/booking linkage and provenance. Idempotent projections deduplicate event IDs and support rebuild from retained event history.

Separate operational metrics (latency/failures), product metrics (lead conversion), commercial outcomes (attendance/revenue) and AI expense (tokens/tariffs). Show cohort and observation window, denominator, timezone, sample size and freshness on every report. Tenant authorization applies to aggregates and exports too.

Late events revise affected cohorts with recorded_at timestamps; do not silently overwrite earlier exported reports. Corrections carry references and negative/compensating facts where appropriate. P12 starts with daily projections and indexed SQL; no data warehouse is required for pilot.

Projection acceptance: replaying every event twice yields the same totals; manual/no-lead bookings remain unassigned; deleted contacts do not regenerate PII during rebuild. [Funnel](funnel.md) defines attribution.
