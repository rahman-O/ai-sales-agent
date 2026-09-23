# Agent guardrails

Price claims require a current relational price result. Booking/cancellation/reschedule claims require the corresponding committed command result. Render critical booking confirmations with backend templates containing returned IDs/time/price; do not rely solely on probabilistic final-text checks. Unknown facts produce clarification or human escalation.

Customer instructions, quoted documents and tool output text cannot change system policy, capabilities, tenant scope or confirmation requirements. Sanitize content without pretending delimiters alone solve injection. Backend authorization and limited tools are the enforcement boundary; prompt policy is defense in depth.

Clinic default scope is reception/scheduling. Do not diagnose, recommend treatment, collect medical history or claim urgency assessment. Use an approved generic urgent-help message for apparent emergencies and offer human contact; local wording and escalation numbers must be approved in P00, not invented by the model.

Autonomy: read approved information, capture explicitly supplied contact/lead facts, propose slots, perform explicitly confirmed booking changes, and schedule permitted reminders. No discounts, deletion, credential changes, financial decisions or bulk outreach. Any denied/uncertain action stays uncommitted and visible to operators.

Block unsafe output before outbound creation. Track false positives and false negatives using adversarial fixtures; never relax tenant or mutation rules to improve answer completion rate. [Evaluations](evaluation-strategy.md).
