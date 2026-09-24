# ADR-006 — MessagingChannel boundary

Status: **ACCEPTED**. Date: 2026-09-24. Accountable: engineering.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions. P03 delivered FakeMessagingChannel + durable ingress; P08 adds Meta WhatsApp Cloud API as the first production adapter.

## Decision

Normalize messages/policy results in adapters; keep WhatsApp details outside the agent domain. Domain persists via existing `persistInbound` / Message / OutboundAttempt / outbox. Agent tools remain domain tools only — no `sendWhatsAppMessage`.

## Consequences

- Fake and Meta adapters share the same TypeScript `MessagingChannel` contract
- Provider payloads never leak into Lead/Booking/AgentConfig
- Outbound send ownership is the worker; API only persists intent

## Supersession

Supersedes PROPOSED draft pending P08 validation.
