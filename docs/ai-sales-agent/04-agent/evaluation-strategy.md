# Agent evaluation strategy

Create a versioned, de-identified evaluation set with at least 120 scenarios: ten each for price, new booking, ambiguous time, missing contact, reschedule, cancellation, unsupported request, human request, injection, wrong-business question, multi-turn context and Iraqi Arabic variation. Include Arabic/English/code-switching, conflicting documents and opt-out examples within those categories. Human reviewers validate labels and dialect realism.

Each fixture contains tenant/catalog/knowledge state, conversation turns, expected allowed/forbidden tool calls, required clarification, committed-action constraints and an answer rubric. Store expected facts, not exact prose. Use deterministic fake tools for replay, then a separate sampled sandbox run against real providers.

Proposed release gates: 100% tenant boundary and unauthorized-mutation checks; zero false success claims in the release set; 100% explicit human requests pause; ≥95% factual price accuracy; ≥90% task completion on unambiguous in-scope scenarios; ≥90% dialect intent/clarification pass. Thresholds require P00 approval and must report sample size. Run each probabilistic case three times and disclose variance; zero observed failures is not proof of zero real-world risk.

Automated graders evaluate facts/tool traces, with blinded human review for language, appropriateness and uncertain results. Never let an LLM grader alone certify authorization. Freeze holdout fixtures, track model/prompt/config versions, tokens, latency and cost. Review pilot failures and add regression cases without contaminating the holdout. [Agent evaluation tests](../09-testing/agent-evaluation.md).
