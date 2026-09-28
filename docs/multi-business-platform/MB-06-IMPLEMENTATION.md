# MB-06 — Business Policies Implementation

## Status

**CLOSED.** MB-06 adds a generic organization-owned policy foundation without business-type runtime branching. P14 remains not authorized.

## Audit and boundary

Existing policy-like sources were classified before implementation:

- **STRUCTURED_EXISTING:** service `minimumLeadMinutes`, `maximumAdvanceDays`, booking buffers, staff working hours/exceptions, `OrganizationFollowUpPolicy`, organization capabilities, tool allowlists, and conversation handoff/ownership rules.
- **HARDCODED_RUNTIME_RULE:** booking confirmation, slot-token validation, availability conflicts, and allowed cancellation reason codes.
- **PROMPT_ONLY:** guidance against invented prices, availability, bookings, offers, and policies.
- **KNOWLEDGE_ONLY:** demo working-hours documents and arbitrary approved knowledge content.
- **DEMO_ONLY:** synthetic offer and booking fixtures.
- **NOT_PRESENT:** refund execution, return execution, payment processing, order minimum enforcement, delivery routing, and quote execution.

MB-06 keeps lead time, maximum advance, buffers, and working hours in the booking/service configuration. It does not duplicate those rules in the policy engine. `ADVANCE_NOTICE` can be stored for future migration and explanation, but it is informational in MB-06. Only cancellation and rescheduling cutoffs are enforced because those workflows exist.

## Model and lifecycle

`BusinessPolicy` belongs to one organization and stores policy type, lifecycle status, title, explanatory summary, validated structured rules, enforcement mode, UTC effective window, monotonic type-local version, metadata, and timestamps.

Statuses are `DRAFT`, `ACTIVE`, and `ARCHIVED`. Only active rows inside their effective window resolve. Active and archived policies are immutable through the edit endpoint; changes require a new draft version. Activating a version takes an organization/type advisory transaction lock, archives another active version of the same type, and activates the selected version.

Policy types are `BOOKING`, `CANCELLATION`, `RESCHEDULING`, `PAYMENT`, `REFUND`, `RETURN`, `DELIVERY`, `SERVICE_AREA`, `MINIMUM_ORDER`, `ADVANCE_NOTICE`, `QUOTE`, `HANDOFF`, and `CUSTOM`.

## Structured and informational truth

Typed schemas validate cancellation, rescheduling, advance notice, service area, minimum order, and payment-method rules. Types without an implemented structured workflow accept an empty rules object and remain `INFORMATIONAL_ONLY`. `CUSTOM` rejects arbitrary rule fields. Human-readable `summary` content explains a policy but never authorizes a transaction.

`CANCELLATION` and `RESCHEDULING` are marked `ENFORCEABLE`. The booking API and agent booking tools resolve the current policy and reject requests inside the cutoff. Cancellation fee fields are informational because there is no payment engine; MB-06 never collects a fee.

## Deterministic resolution

Effective resolution is organization- and type-scoped. It filters for `ACTIVE`, `effectiveFrom <= currentTime`, and `effectiveUntil >= currentTime`, with null bounds treated as open. Precedence is highest version, then latest effective start, then latest creation time. The database query is bounded to 20 candidates, and the shared resolver applies the same rules in memory.

Effective timestamps are stored as PostgreSQL `timestamptz` and returned as UTC ISO strings. The dashboard labels effective inputs as UTC. Organization-local policy scheduling can be added later without changing stored instants.

## API and permissions

The API provides list, get, create draft, update draft, activate, archive, and effective-by-type endpoints under `/organizations/:organizationId/policies`. Active organization members may read. Only `OWNER` and `ADMIN` may mutate. Audit events record action, organization, actor, policy type, and version without copying freeform summary content.

## AI retrieval

`getEffectivePolicy` is a read-only, allowlisted tool. It requests one typed policy at a time and returns an authoritative policy or an authoritative empty result. Context guidance prohibits invention, prevents informational policies from authorizing transactions, and requires natural explanations that match tool evidence. Policies are fetched on demand rather than added wholesale to every prompt.

## UI and navigation

Policies are always available to OWNER and ADMIN users in the Admin navigation group. The route remains session protected and all data access also requires organization membership in the API. The UI lists and filters policies, creates and edits drafts, activates and archives versions, and presents type-specific fields rather than a raw JSON editor. Booking-related types are emphasized when `supportsBooking` is enabled.

## Tenancy, constraints, and performance

The table has RLS enabled and forced. Runtime grants are tenant-scoped through `current_tenant_id()`. Composite organization identity, unique organization/type/version, positive versions, valid status/type/enforcement values, object-shaped JSON, valid effective windows, and enforcement-mode restrictions are database constraints. The effective lookup index covers organization, type, status, dates, and descending version.

## Demo and limitations

The deterministic demo includes active cancellation and rescheduling policies with 30-minute cutoffs plus an informational payment-method policy. These cutoffs do not invalidate seeded future bookings.

MB-06 does not implement payments, refunds, returns, orders, quotes, delivery routing, geospatial service areas, legal automation, analytics, conversation style, or knowledge redesign. Stored policies for unsupported workflows are explanatory data only.
