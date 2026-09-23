# Customer API

Proposed routes; none are implemented. Shared transport/error/version rules: [API principles](api-principles.md).

## Authority and base

Base: `/v1/organizations/{organizationId}/customers`. OPERATOR/ADMIN/OWNER; exports and deletion restricted to ADMIN/OWNER.

## Contracts

GET /?query=&cursor= searches permitted contact fields; POST / creates a manual contact; GET /{id} and PATCH /{id} use expectedVersion; POST /{id}/consents records purpose/channel/source; POST /{id}/merge requires verified identity evidence; POST /{id}/deletion-requests returns tracked privacy work. No public customer-search endpoint is exposed to messaging customers.

## Invariants, failure and verification

Different tenants may share a phone number; never merge across organizations. Conflict requires operator resolution when identities already exist. Revocation atomically updates consent projection and creates suppression events. Test identity collision, malicious field injection and privacy completion.
