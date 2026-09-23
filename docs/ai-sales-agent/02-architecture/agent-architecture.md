# Agent architecture

AgentOrchestrator coordinates one bounded run. ContextBuilder assembles trusted configuration and explicitly untrusted conversation/knowledge content. ModelProvider normalizes responses and usage. ToolRegistry publishes only allowed schemas; ToolExecutor validates and invokes application commands. OutputGate checks action claims, mode, epoch, fence and current input watermark before creating outbound intent.

Customer and lead state are typed records. Model-generated summaries are fallible context, never authorization or source of price/booking truth. Persist prompt/config/model versions, context references and tool results so operators can inspect the evidence behind a reply without storing private chain-of-thought.

The runtime is deliberately a small orchestrator rather than an autonomous multi-agent framework. Business decisions remain reviewable; tool arguments do not select organization scope. See [runtime](../04-agent/agent-runtime.md), [contracts](../04-agent/tool-contracts.md), and [context builder](../04-agent/context-builder.md).
