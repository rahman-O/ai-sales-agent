# WhatsApp first integration

Use the Cloud API through the MessagingChannel adapter. P00 validates business-account ownership, phone-number mapping, app permissions/review, credentials, subscription setup, test recipient flow and a supported Graph API version. Pin that version and retain sandbox fixtures before P08 implementation. No exact provider quotas, retry durations or prices are assumed.

The current policy permits free-form replies within 24 hours of the last user message; outside that window use approved templates. Proactive contact requires recorded permission, and opt-outs must be honored. Automated conversations need a clear human escalation path. Recheck the policy for launch and the selected vertical. [WhatsApp messaging policy](https://whatsappbusiness.com/policy/).

Enforce eligibility again at actual send time, not only when scheduling. Store latest qualifying inbound time from verified events, guard against implausible timestamps, and let the adapter choose template versus session reply. Block unavailable/rejected templates and surface an operator action. Channel receipts are separate from business command success.

MVP text support: inbound text, outbound text, approved reminder templates, delivery/read/failure receipts. Unsupported image/audio input is durably recorded as an unsupported attachment reference and gets a safe response or handoff; no transcription or vision pipeline is implied. Downloading media, if later enabled, requires scoped provider URLs, limits and scanning.

Revoked credentials disable sends, alert an admin and preserve pending data; reconnect cannot remap another tenant's number. Explicitly test opt-out, expired service window, template rejection, malformed signed payload, repeated message IDs and send uncertainty. [Webhooks](webhooks.md) and [channel contract](messaging-channel-contract.md).
