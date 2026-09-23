# Audit log

Append-only audit records include organization, actor type/ID, effective role, action, target type/ID, old/new version, changed field names, redacted before/after values, reason, request/run/operation references and recorded_at. Cover role changes, credentials, knowledge publication, agent policy changes, takeover, lead transitions, booking commands, consent, data export/deletion, support grants and operator resend decisions.

Write required audit records inside the business transaction. Runtime roles cannot update/delete audit rows; dedicated retention jobs perform approved expiry. Restrict audit readers by organization and role. Secrets and full transcripts are never audit payloads; a secret rotation records key reference/version only.

Exports have an actor, purpose and short expiry and are themselves audited. Security review can add tamper-evident archival if contracts demand it; append-only permissions alone are not a cryptographic guarantee. Verify failed commands do not create false success audit events; denied attempts are separate security events with minimal personal data.
