# Organization API

Proposed routes; none are implemented. Shared transport/error/version rules: [API principles](api-principles.md).

## Authority and base

Base: `/v1/organizations`. OWNER/ADMIN for settings and invites; OWNER for ownership transfer/offboarding.

## Contracts

POST / creates tenant plus initial owner atomically with Idempotency-Key. GET /{id} and PATCH /{id} read/update versioned locale/timezone/settings. GET/POST /{id}/members list/invite; PATCH /{id}/members/{memberId} changes role; POST /{id}/transfer-ownership requires reauthentication. POST /{id}/deletion-requests starts reviewed offboarding. GET/POST /{id}/channel-connections and POST /{id}/channel-connections/{connectionId}/disconnect manage channel lifecycle using secret-write-only input.

## Invariants, failure and verification

Prevent removing/demoting last owner and assigning a connection already bound elsewhere. Invitation tokens are hashed, expiring and one-use. Credential responses show masked status only. Test cross-tenant invitations, concurrent owner transfer and reconnect collisions.
