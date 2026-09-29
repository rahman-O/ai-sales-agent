-- Ensure canonical system agent user exists for system-initiated audit log foreign key invariants.
INSERT INTO users (id, auth_subject, display_name, created_at, updated_at)
VALUES (
  '00000000-0000-4000-8000-0000000000a1',
  'system:agent',
  'System Agent',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;
