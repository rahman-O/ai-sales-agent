# Product scope

## MVP

An invited organization configures one WhatsApp connection, staff/services/prices, working hours, and approved FAQ documents. A customer sends text; the system persists it, builds bounded context, answers from approved knowledge, creates a lead, and books a confirmed slot through authorized tools. An operator sees the conversation, takes over, replies, and explicitly returns control. Every run, action, and send has a trace and usage record.

The operational inbox, basic catalog editor, and booking view are required MVP slices of Phase 11. Basic trace inspection is required before Phase 12 analytics. A fake channel supports development but does not satisfy external MVP acceptance.

## Pilot

MVP plus consent-aware reminders, minimal funnel/cost reports, tested recovery, security/load gates, operator training, and a staffed escalation process. Proposed ceiling: five organizations, one location each, text only, one staff member per booking; validate in discovery.

## Production

Pilot exit evidence, agreed SLOs, restore drills, incident ownership, privacy review, provider onboarding lifecycle, tenant offboarding, capacity and cost controls. Production-grade is a release gate, not a promise that this documentation implements it.

Instagram, customer web chat, payments, voice, advanced CRM, marketing campaigns, recurring/group bookings, and external calendar sync are deferred. See [master plan](../14-roadmap/master-plan.md).
