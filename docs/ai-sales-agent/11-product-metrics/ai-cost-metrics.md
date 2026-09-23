# AI cost accounting

Record input/output/cached/reasoning token categories only where providers report them; absent categories remain unknown. Embeddings use their own usage unit. Calculate estimated cost from a versioned provider/model tariff effective at request time, preserving currency and unit scale. Never hardcode a current advertised price into architecture.

Total AI cost is the sum of model attempt charges plus embedding charges; tool/API fees and messaging charges are separate cost classes. Include failed/timeout attempts when potentially billed. Reconcile provider reports through append-only adjustment entries, not destructive replacement of original estimates.

Reports: cost per eligible conversation, qualified lead and confirmed booking with explicit denominator; estimated versus reconciled cost; retry/fallback share; tenant budget remaining. Zero conversions yields an undefined unit cost, not zero. Currency conversion requires a recorded FX source/date and is deferred by default.

Acceptance fixture: duplicate imported usage does not double count; a failed first call plus successful fallback counts both; missing usage creates an estimate flagged as such; concurrent hard-budget reservations cannot overspend the configured allowance unnoticed.
