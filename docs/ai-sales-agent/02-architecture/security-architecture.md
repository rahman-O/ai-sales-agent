# Security architecture

## Threat model and controls

Public webhook forgery: verify the signature over raw bytes before trusting payloads, bound sizes, and deduplicate signed replay. Staff session theft: secure HttpOnly cookies, short sessions, revocation, MFA for privileged roles, CSRF checks on cookie-authenticated mutations. Cross-tenant ID enumeration: scoped lookup, RLS and composite references; return a consistent not-found response.

Roles: OWNER controls ownership and deletion; ADMIN manages channel/agent/knowledge/catalog and memberships except ownership transfer; OPERATOR reads operational customer data and performs permitted lead/booking/handoff actions; ANALYST reads aggregate reports only. Platform support has no standing transcript access; approved time-bound support grants are audited. Removing the last owner is forbidden.

Prompt injection/tool abuse: no database, network, shell or arbitrary URL tools; explicit input schemas, allowlisted commands, actor scope, confirmation evidence, spending limits and output checks. Poisoned knowledge: isolated parsing, approval/version provenance, tenant-filtered retrieval and revocation. Model text can neither grant a role nor approve its own booking.

Encrypt transport and managed storage at rest. Envelope-encrypt channel credentials using a managed key service; persist secret references/ciphertext only. Rotation, revocation and least-privilege service identities are mandatory. Never put tokens in frontend bundles, queue payloads, trace attributes or exception dumps.

## Privacy and abuse

Minimize contact collection; keep clinical details out of qualification schemas. Sanitize displayed customer text and extracted HTML; allowlisted upload types and signed private downloads. Limit webhook/IP traffic, authenticated actor commands, tenant model spend and document ingestion independently. Customer opt-out is durable and suppresses pending proactive sends.

Security tests include cross-tenant nested relations, pooled-connection leakage, forged signatures, replay, malicious uploads, SSRF attempts, permission changes during jobs, and stale takeover races. [Security tests](../09-testing/security-tests.md) owns gates; [retention](../06-data/retention-policy.md) records proposed lifecycle policy. Deployment jurisdiction and health-data obligations require review before pilot; no compliance certification is implied.
