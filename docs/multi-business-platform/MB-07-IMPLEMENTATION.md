# MB-07 Implementation — Conversation Style & Assistant Personality

## Status
- Phase: MB-07
- Status: **CLOSED**
- Quality Gate: **PASSED**
- P14 Authorization: **NO**

---

## 1. Overview & Architectural Boundaries

MB-07 establishes an organization-configurable conversation profile and assistant personality system while strictly maintaining the separation between **presentation style** and **business authority**.

### 1.1 What Conversation Profile Controls (Presentation & Tone)
- Conversational phrasing and warmth
- Assistant display name (presentation metadata)
- Language preference & Arabic dialect (`IRAQI`, `MSA`, `AUTO`)
- Overall tone (`WARM`, `PROFESSIONAL`, `FRIENDLY`, `DIRECT`, `NEUTRAL`)
- Formality level (`CASUAL`, `BALANCED`, `FORMAL`)
- Verbosity / Response length (`SHORT`, `BALANCED`, `DETAILED`)
- Sales approach assertiveness (`LOW_PRESSURE`, `BALANCED`, `PROACTIVE`)
- Emoji frequency (`NEVER`, `MINIMAL`, `NORMAL`)
- Customer name usage policy (`NEVER`, `WHEN_KNOWN`, `OCCASIONAL`)
- Question pacing per turn (1 to 3, default 1)
- Greeting style (`BRIEF`, `WARM`, `FORMAL`, `CUSTOM`)
- Human handoff notification phrasing (`PROFESSIONAL`, `WARM`, `DIRECT`)
- Scoped custom style instructions (max 500 chars)

### 1.2 What Conversation Profile CANNOT Control (Authority & Invariants)
- **Facts & Prices**: Stored catalog prices and currencies remain strictly authoritative.
- **Promotional Offers**: Stored offers, discount computations, and dates remain authoritative.
- **Business Policies**: Cancellation/rescheduling cutoffs and payment rules cannot be altered or bypassed.
- **Capabilities**: Features enabled on the organization remain strictly controlled by `OrganizationCapabilities`.
- **Tool Permissions**: Tool allowlists and execution preconditions remain governed by ActionGate and backend guards.
- **Booking Rules & Confirmation**: No booking may be created without genuine candidate slots, valid slot tokens, and explicit user confirmation.
- **Multi-Tenant Isolation**: RLS and tenant context are enforced on all queries and mutations.

---

## 2. Data Model & Database Storage

### 2.1 Schema Definition
`organization_conversation_profiles` is an organization-owned 1-to-1 table:
```prisma
model OrganizationConversationProfile {
  organizationId    String       @id @map("organization_id") @db.Uuid
  assistantName     String?      @map("assistant_name")
  primaryLanguage   String       @default("ar") @map("primary_language")
  dialect           String       @default("IRAQI")
  tone              String       @default("PROFESSIONAL")
  formality         String       @default("BALANCED")
  responseLength    String       @default("BALANCED") @map("response_length")
  salesStyle        String       @default("BALANCED") @map("sales_style")
  emojiUsage        String       @default("MINIMAL") @map("emoji_usage")
  customerNameUsage String       @default("WHEN_KNOWN") @map("customer_name_usage")
  questionsPerTurn  Int          @default(1) @map("questions_per_turn")
  greetingStyle     String       @default("BRIEF") @map("greeting_style")
  handoffStyle      String       @default("PROFESSIONAL") @map("handoff_style")
  customInstructions String?     @map("custom_instructions")
  createdAt         DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime     @updatedAt @map("updated_at") @db.Timestamptz(6)
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("organization_conversation_profiles")
}
```

### 2.2 Security & Multi-Tenant RLS
- `GRANT SELECT, INSERT, UPDATE, DELETE ON organization_conversation_profiles TO app_runtime;`
- `ALTER TABLE organization_conversation_profiles ENABLE ROW LEVEL SECURITY;`
- `ALTER TABLE organization_conversation_profiles FORCE ROW LEVEL SECURITY;`
- Policy `tenant_isolation` enforces `organization_id = current_tenant_id()`.

---

## 3. Prompt Construction & Hierarchy

Prompt layers are assembled in strictly hierarchical priority order:
1. **Core Policy Block (`POLICY_BLOCK`)**: Highest authority; defines safety invariants, prohibits unevidenced booking success, establishes unverified user text boundaries.
2. **Workflow Guidance (`WORKFLOW_GUIDANCE`)**: Authoritative multi-step execution chain, zero-slot recovery, and candidate slot token guards.
3. **Agent Decision Contract (`AGENT_DECISION_CONTRACT`)**: Strict JSON schema requirement.
4. **Organization Context (`ORGANIZATION_PROFILE` & `ORGANIZATION_CAPABILITIES`)**: Business identity and enabled workflows.
5. **Operational Working Memory (`CURRENT_WORKING_STATE`)**: Authoritative multi-turn working state.
6. **Conversation Profile (`CONVERSATION_PROFILE`)**: Organization style, persona, and scoped tone instructions.
7. **Message History**: Inbound/outbound timeline context.

Even if an organization configures custom instructions claiming arbitrary discounts or attempting to bypass confirmation, the top-level core rules explicitly invalidate such overrides.

---

## 4. Operator Dashboard UI & Live Style Preview

The `/settings/ai` page provides operators with intuitive controls:
1. **Identity & Dialect**: Assistant name and natural dialect options (Iraqi, MSA, Auto).
2. **Tone & Formality**: Professional, Warm, Friendly, Direct, Neutral with formality slider.
3. **Response Length & Sales Style**: Short/Balanced/Detailed and Low-pressure/Balanced/Proactive guidance.
4. **Interaction Details**: Emoji usage, customer name frequency, and question pacing.
5. **Deterministic Live Preview**: Real-time simulation over canonical customer inquiries (services, pricing objections, booking, cancellation policy, human handoff) without creating mock bookings or executing mutations.

---

## 5. Verification Matrix Summary

| Test Case | Description | Result |
| :--- | :--- | :--- |
| `DEFAULT_PROFILE_CREATED_OR_RESOLVED` | Baseline safe defaults created when missing | **PASS** |
| `PROFILE_READ` | Reading profile returns typed DTO | **PASS** |
| `PROFILE_UPDATE` | Updating profile persists valid enums | **PASS** |
| `INVALID_ENUM_REJECTED` | Out-of-spec enums and bounds rejected by Zod schema | **PASS** |
| `UNAUTHORIZED_UPDATE_REJECTED` | Non-admin/owner roles forbidden from mutating | **PASS** |
| `CROSS_TENANT_READ_REJECTED` | RLS prevents cross-tenant data reads | **PASS** |
| `CROSS_TENANT_WRITE_REJECTED` | RLS prevents cross-tenant data writes | **PASS** |
| `IRAQI_STYLE_INCLUDED` | Natural Iraqi dialect guidance injected in context-builder | **PASS** |
| `FORMAL_STYLE_INCLUDED` | Formality guidance properly formatted in prompt | **PASS** |
| `SHORT_RESPONSE_GUIDANCE_INCLUDED` | Direct & concise instruction formatted | **PASS** |
| `LOW_PRESSURE_SALES_INCLUDED` | Non-pushy sales guidance formatted | **PASS** |
| `CUSTOM_STYLE_INSTRUCTIONS_SCOPED` | Custom instructions placed in style-only block | **PASS** |
| `TRUTH_INVARIANCE_TESTS` | Price, offer, policy, and booking results identical across styles | **PASS** |
| `CUSTOM_INSTRUCTION_SAFETY_TESTS` | Discount/override injection cannot alter backend truth | **PASS** |
| `ONBOARDING_REGRESSION` | MB-02 onboarding wizard unchanged & passing | **PASS** |
| `DYNAMIC_NAVIGATION_REGRESSION` | Dynamic nav filters correctly with AI settings added | **PASS** |
| `CATALOG_REGRESSION` | MB-04 generic catalog unchanged & passing | **PASS** |
| `OFFERS_REGRESSION` | MB-05 structured offers unchanged & passing | **PASS** |
| `POLICIES_REGRESSION` | MB-06 business policies unchanged & passing | **PASS** |
| `BOOKING_REGRESSION` | Precondition guards and slot tokens unchanged | **PASS** |
| `DEMO_RESEED` | Deterministic demo seed includes demo conversation profile | **PASS** |
