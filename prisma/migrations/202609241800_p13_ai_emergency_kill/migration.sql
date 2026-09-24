-- P13: org-scoped emergency AI disable (conversation takeover is insufficient).
-- When cleared, conversations advance ai_eligible_after_sequence so backlog is not unsafe-replayed.

ALTER TABLE organizations
  ADD COLUMN ai_emergency_disabled_at timestamptz NULL,
  ADD COLUMN ai_emergency_disabled_reason text NULL,
  ADD COLUMN ai_emergency_disabled_by_user_id uuid NULL;

COMMENT ON COLUMN organizations.ai_emergency_disabled_at IS
  'When set, worker must not start new AgentRuns for this organization. Inbound persistence and human inbox remain available.';
