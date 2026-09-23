# Lead API

Proposed routes; none are implemented. Shared transport/error/version rules: [API principles](api-principles.md).

## Authority and base

Base: `/v1/organizations/{organizationId}/leads`. OPERATOR/ADMIN/OWNER; aggregate-only view for ANALYST through analytics API.

## Contracts

GET /?stage=&owner=&cursor=; POST / {customerId,serviceId?,interestNote?}; GET /{id}; PATCH /{id} {expectedVersion,allowed facts}; POST /{id}/transitions {expectedVersion,target,reason}; GET /{id}/history. Stage side effects from booking use backend commands, not arbitrary PATCH fields.

## Invariants, failure and verification

Require qualification evidence before QUALIFIED, attendance before WON, and reason for LOST. Stale edits return 409 with safe refetch guidance. Prevent duplicate open opportunities. Test concurrent create, invalid stage jumps and references to another tenant customer.
