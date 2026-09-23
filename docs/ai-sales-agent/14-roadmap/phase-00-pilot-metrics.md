# Phase 00 pilot metric dictionary

Status: PROPOSED BASELINE DEFINITIONS. No conversion uplift or target is asserted. Capture a pre-pilot baseline from the clinic’s existing workflow using the same definitions where possible, then report pilot cohorts with sample size and observation window.

## System reliability metrics

- Verified inbound persistence rate: durably accepted valid inbound provider messages / valid verified inbound messages observed. Record provider/outage exclusions separately; target approval belongs to Q08.
- Webhook persistence latency: received-at to committed receipt/message/outbox, median/p95/p99.
- Duplicate processing incidents: count of provider/queue duplicates causing more than one canonical message or business effect. Dedup hits are a normal separate count; incidents should be zero but no untested claim is made.
- Conversation queue delay: durable message commit to run claim, median/p95 and oldest pending age.
- First automated response latency: valid inbound commit to outbound intent, plus separate provider accepted/delivered latency.
- Tool failure rate: terminal failed/denied/timed-out tool attempts / tool attempts, grouped by code; expected denials are reported separately from system failures.
- Booking conflict incidents: overlapping confirmed allocations (integrity incidents) separately from expected slot-conflict rejections. Integrity incidents should be zero.
- False-success incidents: responses claiming price/action without current authoritative evidence or committed operation.
- Unsupported-answer rate: conversations where the assistant abstains or cannot answer from approved structured/knowledge sources / eligible customer inquiries. Human handoff is reported separately.
- Human handoff rate and median time to claim during staffed hours; report unassigned age and off-hours cases.
- Outbound UNKNOWN count and age, delivery failure rate, stale-fence/epoch rejection, failed/dead-letter job count, and recovery time.
- Tenant-isolation incidents, unauthorized tool attempts, and secret/PII leakage incidents; any confirmed incident is a release blocker under the risk policy.
- Model usage and cost: attempts, input/output tokens where measured, estimated share, fallback/retry share, cost per eligible conversation, and budget reservation/reconciliation gap.

## Business outcome metrics

- Inbound conversations: distinct eligible customer conversations with at least one valid inbound during cohort period; exclude sandbox/spam by recorded rule.
- Median first-response time: existing human baseline and pilot response time, using the same start/end definition and staffed/off-hours segmentation.
- Leads created: distinct evidence-linked leads by conversation cohort.
- Qualified leads: distinct leads meeting the versioned qualification policy; report required-field completeness.
- Confirmed bookings: distinct committed bookings linked to lead/conversation; report manual/unattributed separately.
- Booking completion rate: completed appointments / appointments due in the observation window. Report pending, cancelled, and no-show separately; do not treat unknown attendance as nonattendance.
- Cancellation and reschedule rates with initiator/reason where approved.
- Human-assisted conversion: bookings whose lineage includes both agent and human actions, distinct from AI-assisted and human-only.
- Verified revenue only if the clinic supplies an independently verified RevenueRecord. Appointment price is booked value, not collected revenue.
- AI cost per conversation, created lead, qualified lead, and confirmed booking. When denominator is zero, report undefined, not zero.

## Collection and baseline protocol

Interview owner/operators and obtain an approved historical window if data exists. Record timezone, staffed hours, channels, denominator exclusions, missing-data rate, and source system. Do not compare unlike cohorts silently. Suggested minimum reporting is weekly with cohort maturity shown; exact duration/sample requirement is Q08. Every projected fact keeps source event IDs and replays idempotently. Separate operational reliability from commercial outcomes on every dashboard/export.

No success threshold can be accepted until Q08 supplies current volume, baseline, support coverage, cost budget, and stop/rollback authority. “More bookings” alone cannot establish causation or safety.

