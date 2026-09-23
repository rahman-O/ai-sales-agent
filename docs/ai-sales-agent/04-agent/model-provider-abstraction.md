# Model provider abstraction

Define a narrow ModelProvider interface: generate({messages,tools,responseSchema,budget,deadline,traceContext}) returns {text,toolRequests,finishReason,usage,providerRequestId,model,capabilities}. EmbeddingProvider is separate and returns vectors with model/dimension metadata. No business module imports a provider SDK.

Normalize schema-validation failures, refusals, rate limits, timeouts and usage gaps. Capability flags include tool calling, structured output, streaming and context limit; unavailable capabilities fail configuration validation. Choose a single primary adapter initially and a deterministic fake for tests. Provider-agnostic does not mean every model is interchangeable.

Fallback requires an approved provider/model that passes the same evaluation and data-processing constraints. It may retry inference within the run budget, but must reuse committed tool results and operation keys. Never repeat an ambiguous business action as part of fallback. If no approved fallback exists, pause and surface an operator incident.

Track actual provider usage where available; missing usage is unknown with a conservative estimated cost, not zero. Record tariff version and reconcile later. Embedding-model changes require versioned re-indexing rather than mixing dimensions. Specific SDK versions, model names and prices are P00 selections.
