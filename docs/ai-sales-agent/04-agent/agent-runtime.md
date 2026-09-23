# Agent runtime

1. Wake for durable pending input; acquire the fenced conversation lease and load the oldest unprocessed input snapshot.
2. Recheck tenant/channel enablement, ownership mode, consent-related suppression, run budget and input watermark.
3. Load customer/lead structured state, versioned summary and recent messages; retrieve approved relevant knowledge.
4. Build the bounded context and allowed tool schemas; persist AgentRun with context manifest and config versions.
5. Call the approved provider. Validate the response; execute requested tools through the registry, serially for mutations, recording each result.
6. Return normalized tool results to the provider while under iteration/time/token budgets.
7. Validate final response and claims. In a short transaction recheck lease, fence, mode, epoch and input watermark, then persist response, outbound intent, run terminal state and processed input cursor.
8. Release the lease using owner/fence matching. A separate dispatcher applies channel policy and current epoch before provider I/O.

Proposed default limits: four tool rounds, eight tool calls total, five model calls total, 45-second end-to-end run deadline, 15-second model-call timeout and five-second local tool timeout. One schema repair or provider fallback counts against these totals. A pure answer uses one call; hitting any limit pauses/escalates with a safe non-success message if channel eligible. Defaults are versioned and benchmarked in P04; they are not provider guarantees.

Model-generated IDs are never authority. Successful tool results survive crashes; reruns recover prior command results. Background summaries and analytics do not extend the live run transaction. [Failure handling](failure-handling.md) defines retry classes; [queue architecture](../02-architecture/queue-architecture.md) defines ordering.
