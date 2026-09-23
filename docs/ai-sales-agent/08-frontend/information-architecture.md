# Frontend information architecture

Primary navigation: Inbox, Leads, Bookings, Knowledge, Analytics and Settings. Settings contains organization/members, channel, catalog/staff/hours and agent behavior. Organization switcher is always visible. Role-based hiding improves usability but never supplies authorization.

Minimum MVP: sign-in/org setup, shared inbox with claim/pause/resume, customer/lead side panel, services/staff/hours editor, booking list and simple scheduler, knowledge upload/publication, agent enable/disable and trace inspection. P11 dashboard aggregates can arrive after the initial inbox slice, but these operational screens cannot be deferred beyond MVP.

Every screen needs loading, empty, permission-denied, stale/conflict and retry states. Arabic RTL and English LTR are first-class, including mixed-direction phone numbers and IDs. Display organization timezone and currency, avoid ambiguous date-only strings, and provide keyboard/focus support. Keep destructive confirmations explicit.

TanStack Query keys include organization and object IDs; clear tenant state on switching and logout. SSE is a refetch hint; never let it bypass scoped API reads. [Frontend architecture](../02-architecture/frontend-architecture.md).
