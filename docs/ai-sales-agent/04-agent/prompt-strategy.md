# Prompt strategy

Version a platform policy template separately from tenant-approved business instructions and agent tone. Tenant configuration can choose language and qualification questions but cannot override tool authorization, safety policy, budget or privacy rules. Validate configuration before publishing and preserve the previous version for rollback.

Prompt requires: use tools for current price/availability; do not invent success; ask one focused clarification when key details are ambiguous; distinguish quoted knowledge from instructions; disclose automation; offer human escalation. Respond in the customer's language when supported and retain exact numbers/timezones from backend results.

Publish prompt changes only with dataset results and reviewer identity. Compare candidate and active versions on the same scenarios and fixed tool fixtures. Canary by tenant with a kill switch; do not silently change all tenants' model/prompt pair at once. Record version in every AgentRun.

A/B conversion improvement cannot outweigh safety regressions. Prompts are product behavior with a release history, not untracked environment variables. [Context builder](context-builder.md) defines ordering and token allocation.
