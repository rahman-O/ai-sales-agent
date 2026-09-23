# Context builder

Order context by authority: immutable system safety policy; tenant business configuration; versioned agent instructions; typed customer facts and consent; lead state; versioned conversation summary; recent messages; quoted retrieval evidence; normalized tool results; currently allowed tools. Customer text and uploaded documents are explicitly untrusted data, never system instructions.

Proposed hard context budget: 12,000 input tokens and 1,000 output tokens, within the chosen model's limit. Reserve input allocations: policy/config 2,000; structured state/summary 2,000; recent messages 3,000; knowledge 2,000; tool schemas/results 3,000. Use the provider tokenizer or conservative estimator and record estimate uncertainty. Actual input must satisfy both this cap and the provider context limit after reserving output.

When over budget, remove lowest-relevance knowledge, compact old tool results, then shrink oldest complete turns. Never truncate system safety, current request, pending confirmation details or a tool call without its result. If these cannot fit, pause instead of omitting critical constraints. Maximum recent messages: 20 within the token allocation; unusually long input receives a length-limit response before expensive processing.

Persist IDs, versions, hashes, ordering, retrieval scores and truncation decisions in the context manifest. Re-read prices and availability through tools; do not elevate summary claims to facts. Test that tenant-B chunks and secret fields never enter tenant-A contexts. [Memory](memory-strategy.md).
