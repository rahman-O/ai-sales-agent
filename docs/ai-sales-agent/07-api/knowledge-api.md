# Knowledge API

Proposed routes; none are implemented. Shared transport/error/version rules: [API principles](api-principles.md).

## Authority and base

Base: `/v1/organizations/{organizationId}/knowledge`. ADMIN/OWNER curate; OPERATOR may read approved content.

## Contracts

POST /uploads requests bounded private upload; POST /documents finalizes metadata and returns 202 ingestion job; GET /documents and /documents/{id}/versions show progress; POST /documents/{id}/approve and /publish require reviewed version; POST /documents/{id}/unpublish immediately revokes retrieval; DELETE /documents/{id} returns deletion job. GET /jobs/{id} exposes safe progress/error codes.

## Invariants, failure and verification

Upload completion does not imply publication. Prevent publishing partial chunk sets or a stale reviewed version. Downloads require scoped metadata and short-lived signed URLs. Test malware/size/type limits, repeated finalize, revoked documents and cross-tenant job IDs.
