# End-to-end tests

## Scope

Staff UI plus simulated customer transport and later provider sandbox.

## Required cases

Owner configures organization, staff/hours/prices and knowledge; customer asks price, qualifies, confirms booking; operator takes over and resumes; customer cancels; staff sees correct history. Repeat in tenant B with overlapping contact details. Run Arabic/RTL and English flows.

## Evidence and failure checks

Test two operators claiming, disconnect/reconnect, browser refresh with pending send, CSRF rejection and stale booking edit. Before MVP closure run the real WhatsApp sandbox path; fake-channel success alone is insufficient. Verify database effects, delivery status and audit links.

Attach reproducible reports to the owning phase closure. Shared gates: [testing strategy](testing-strategy.md).
