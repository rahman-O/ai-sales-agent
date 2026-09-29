-- MB-07: Organization Conversation Profile & Assistant Personality

CREATE TABLE organization_conversation_profiles (
  organization_id uuid NOT NULL,
  assistant_name text,
  primary_language text NOT NULL DEFAULT 'ar',
  dialect text NOT NULL DEFAULT 'IRAQI' CHECK (dialect IN ('IRAQI', 'MSA', 'AUTO')),
  tone text NOT NULL DEFAULT 'PROFESSIONAL' CHECK (tone IN ('WARM', 'PROFESSIONAL', 'FRIENDLY', 'DIRECT', 'NEUTRAL')),
  formality text NOT NULL DEFAULT 'BALANCED' CHECK (formality IN ('CASUAL', 'BALANCED', 'FORMAL')),
  response_length text NOT NULL DEFAULT 'BALANCED' CHECK (response_length IN ('SHORT', 'BALANCED', 'DETAILED')),
  sales_style text NOT NULL DEFAULT 'BALANCED' CHECK (sales_style IN ('LOW_PRESSURE', 'BALANCED', 'PROACTIVE')),
  emoji_usage text NOT NULL DEFAULT 'MINIMAL' CHECK (emoji_usage IN ('NEVER', 'MINIMAL', 'NORMAL')),
  customer_name_usage text NOT NULL DEFAULT 'WHEN_KNOWN' CHECK (customer_name_usage IN ('NEVER', 'WHEN_KNOWN', 'OCCASIONAL')),
  questions_per_turn integer NOT NULL DEFAULT 1 CHECK (questions_per_turn BETWEEN 1 AND 3),
  greeting_style text NOT NULL DEFAULT 'BRIEF' CHECK (greeting_style IN ('BRIEF', 'WARM', 'FORMAL', 'CUSTOM')),
  handoff_style text NOT NULL DEFAULT 'PROFESSIONAL' CHECK (handoff_style IN ('PROFESSIONAL', 'WARM', 'DIRECT')),
  custom_instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id),
  CONSTRAINT organization_conversation_profiles_org_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON organization_conversation_profiles TO app_runtime;
ALTER TABLE organization_conversation_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_conversation_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization_conversation_profiles
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- Backfill existing organizations with defaults
INSERT INTO organization_conversation_profiles (
  organization_id, primary_language, dialect, tone, formality, response_length,
  sales_style, emoji_usage, customer_name_usage, questions_per_turn, greeting_style, handoff_style
)
SELECT id, 'ar', 'IRAQI', 'PROFESSIONAL', 'BALANCED', 'BALANCED', 'BALANCED', 'MINIMAL', 'WHEN_KNOWN', 1, 'BRIEF', 'PROFESSIONAL'
FROM organizations
ON CONFLICT (organization_id) DO NOTHING;
