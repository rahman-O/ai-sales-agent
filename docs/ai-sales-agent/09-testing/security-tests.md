# Security tests

## Scope

Tenant boundaries, access controls, injection and secret handling.

## Required cases

Probe every API, tool, storage URL, cache key, job, SSE subscription, vector query and export with two tenants and four roles. Include disabled members, last-owner removal, nested references, raw SQL scoping and reused pooled connections.

## Evidence and failure checks

Attempt system-policy override through customer text/documents; malicious file types, parser bombs, HTML injection, arbitrary URLs/SSRF and secret-bearing error paths. Assert no unexpected tool/network call. Verify credential rotation/revocation, access logging and approved retention deletion in all stores.

Attach reproducible reports to the owning phase closure. Shared gates: [testing strategy](testing-strategy.md).
