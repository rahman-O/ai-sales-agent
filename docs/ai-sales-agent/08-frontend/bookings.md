# Bookings workspace

## Purpose and interaction

Day/list view with visible timezone, staff filter and status. Editor loads current services/prices and proposes eligible slots; confirmation shows service, staff, exact time and amount/currency.

## Data and failure behavior

Treat fetched slots as provisional. Conflict refreshes choices while preserving entered contact details. Reschedule leaves existing booking visible until committed. Attendance requires authorized explicit action.

## Acceptance

No success toast before commit; a double click creates one booking; concurrent conflict leaves original reschedule slot intact; no-show is never inferred solely from elapsed time.

Shared accessibility, cache and role rules: [information architecture](information-architecture.md). Proposed implementation belongs in `apps/web` feature routes; no UI is implemented in this package.
