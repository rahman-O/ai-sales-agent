# Unit tests

## Scope

Domain services, context assembly and policy functions.

## Required cases

Test allowed/forbidden conversation, lead and booking transitions; role capabilities; Money serialization; local-time ambiguity; qualification predicates; proposal confirmation parsing; token-budget trimming; retry classification; channel eligibility and follow-up suppression.

## Evidence and failure checks

Use fixed clocks, fixture repositories and generated boundary inputs. In particular, a mixed “yes, but tomorrow” cannot confirm today’s proposal; unknown timezone/currency rejects explicitly. Assert typed outcomes and no handler call on denied input.

Attach reproducible reports to the owning phase closure. Shared gates: [testing strategy](testing-strategy.md).
