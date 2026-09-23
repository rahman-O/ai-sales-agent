# Monitoring targets and operations

Proposed pilot objectives, subject to P00 approval and P13 measurement: 99.5% monthly authenticated API availability; webhook persistence acknowledgement p95 under one second; queue wait p95 under two seconds at the baseline load; eligible automated reply latency p95 under 15 seconds excluding provider outage, with the 45-second hard run deadline tracked separately. Do not hide excluded outage traffic: report end-to-end availability including provider failures alongside internal metrics.

Page on failed verified-message persistence for five minutes, oldest pending conversation over two minutes, rapidly growing outbox, database unavailable, credential revocation, tenant isolation signal, or duplicate booking evidence. Notify operators on any UNKNOWN send and unassigned handoff older than two minutes during coverage hours. Outside coverage, use an approved contact/availability response, never imply a staffed queue.

Cost alerts at 80% of tenant daily budget; hard cap at 100% stops new model work and routes to operators. Reserve estimated cost before concurrent runs so parallel requests cannot evade the cap; reconcile actual usage. Provider uncertainty consumes a conservative reserve pending reconciliation.

Dashboards show queue age by queue, latency distribution, failures by class, retries, fence rejection, tool denials, booking conflicts, delivery failures and usage reconciliation lag. Designate engineering on-call for infrastructure and tenant operators for customer actions. Each alert links an action: pause tenant, reconcile send, replay known-safe work, rotate credentials or restore service.

Incident record: impact window, affected tenants, data integrity, mitigation, recovery proof and regression test. Targets are design acceptance criteria, not claims of tested performance.
