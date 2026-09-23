# Dependency map

```mermaid
flowchart LR
  Identity[Identity and tenant scope] --> Domain[Core domain]
  Domain --> Inbox[Durable conversations]
  Inbox --> Runtime[Agent and safe tools]
  Runtime --> Knowledge[Approved knowledge]
  Runtime --> CRM[Leads]
  CRM --> Booking[Booking commands]
  Inbox --> Channel[WhatsApp adapter]
  Runtime --> Handoff[Ownership and takeover]
  Booking --> Reminders[Follow-ups]
  Handoff --> UI[Operational inbox]
  Channel --> UI
  UI --> Pilot[Pilot gate]
  Reminders --> Pilot
```

Security, trace capture, deterministic tests and durable outbox behavior begin in foundation and progress with every phase. Phase 13 validates them under production conditions; it does not introduce them for the first time. WhatsApp discovery starts P00; external activation waits for booking and takeover controls. See [master plan](../14-roadmap/master-plan.md) for precise dependencies and milestone cuts.
