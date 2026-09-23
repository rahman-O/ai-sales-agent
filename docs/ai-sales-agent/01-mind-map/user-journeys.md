# User journeys

## Owner onboarding

Owner signs in → creates organization/timezone → invites operator → enters service, price, staff and hours → uploads and approves FAQ → tests agent against fixtures → connects verified WhatsApp number → enables automation after operational gate. Failed channel verification leaves automation disabled; credentials never appear in browser responses.

## Customer inquiry to booking

Customer asks price → message persisted → agent requests structured price → asks only missing qualification fields → creates lead → requests slots → customer confirms exact service/staff/time/price → backend commits booking → assistant sends confirmed details and booking reference. A conflict produces new choices, not a success claim.

## Human escalation

Customer requests a human → conversation pauses and emits operator notification → operator claims with version check → AI output pending dispatch is suppressed → human replies → operator reviews latest state and explicitly resumes AI. Messages continue to persist while paused.

## Recovery and follow-up

Provider outage leaves durable work pending. An operator sees backlog and uncertain sends; retry never replays booking mutations blindly. A due reminder checks consent, current booking, recent customer contact, mode and channel eligibility before sending. Opt-out cancels pending follow-ups.

Each journey must run for two tenants in end-to-end tests. See [E2E tests](../09-testing/e2e-tests.md).
