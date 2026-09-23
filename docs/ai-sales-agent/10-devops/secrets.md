# Secrets operations

Store database, Redis, identity-provider, storage, model, webhook app-secret and channel-token material in the host secret manager. Use separate environment identities and least-privilege grants. Frontend receives only public configuration; API responses never return saved secrets.

Tenant channel credentials are envelope-encrypted with key version metadata or referenced in a managed vault. Workers fetch only the active tenant credential needed for the operation. Rotate by validating new credentials, atomically switching active reference and revoking old credentials after a short controlled overlap where provider rules permit.

Webhook verification secrets and subscription challenge tokens have different purposes. Redact authorization headers, cookies, signed URLs and provider error dumps before logging. Secret scanning runs in CI; a leak requires revocation, impact review and log/artifact cleanup, not merely deleting a source line.

Test revocation while jobs are pending: sends stop with an actionable channel state, no infinite retry, and no secret disclosure in failure messages. Break-glass access is time-bound and audited.
