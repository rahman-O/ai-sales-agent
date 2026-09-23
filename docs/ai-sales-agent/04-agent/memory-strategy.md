# Layered memory strategy

Short-term memory consists of recent complete turns, current tool results, pending proposal references and the run's structured state snapshot. It is bounded by [context builder](context-builder.md), discarded on stale ownership/input versions, and reconstructed after retries.

Long-term memory consists of typed customer facts with source/verification timestamps, lead stage/evidence, consent, booking records, and a rolling conversation summary. No free-form global memory shared across organizations. Customer preferences are recorded only when relevant and explicitly provided; summaries do not infer sensitive attributes.

Generate a new summary asynchronously when older turns exceed the recent-context budget. Summary has version, source range, source hash, model/prompt version and through_sequence. Publish with compare-and-swap so an older summarizer cannot replace a newer summary. Recent messages start after the summary watermark, preserving complete context without double-counting.

Summaries include unresolved questions and referenced action IDs, not invented results. Deleted messages invalidate affected summary versions and trigger regeneration or removal. Failure leaves the old summary plus recent raw turns within budget, or pauses if critical context cannot fit. Evaluate multi-turn contradictions and facts changed after summarization.
