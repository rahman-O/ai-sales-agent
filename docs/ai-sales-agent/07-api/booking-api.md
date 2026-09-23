# Booking and catalog API

Proposed routes; none are implemented. Shared transport/error/version rules: [API principles](api-principles.md).

## Authority and base

Base: `/v1/organizations/{organizationId}`. OPERATOR may book and view catalog; ADMIN/OWNER edit catalog/schedules.

## Contracts

GET/POST /services; PATCH /services/{id}; GET/POST /staff; PATCH /staff/{id}; GET/PUT /staff/{id}/working-hours; POST /availability-overrides. GET /availability?serviceId=&from=&to= returns bounded candidates. POST /booking-proposals; POST /bookings {proposalId}; GET /bookings?from=&to=; POST /bookings/{id}/cancel or /reschedule; POST /bookings/{id}/attendance {expectedVersion,outcome,evidence}. Manual operators attest customer agreement explicitly; agent confirmations use message-bound evidence.

## Invariants, failure and verification

POST /booking-change-proposals {bookingId,expectedVersion,action,replacement?} prepares cancellation or reschedule for confirmation. POST /booking-proposals/{id}/confirm is staff-only and records the operator's explicit customer-agreement attestation; it is not exposed to the model. Messaging confirmation is captured by the server from a verified inbound reply/token. Mutation endpoints require the resulting action-specific confirmed proposal reference. Ordinary customers cannot call staff confirmation APIs.

Booking response only after commit; overlap returns 409 SLOT_CONFLICT. Schedule edits detect affected future bookings. Reschedule is atomic and preserves original on conflict. Validate customer/staff/service tenant and eligibility; test timezone transitions and stale price/proposal.
