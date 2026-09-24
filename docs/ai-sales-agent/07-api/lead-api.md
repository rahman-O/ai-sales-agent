# Lead API (P06)

Base: `/v1/organizations/{organizationId}/leads`.

Roles (DB): **read** OWNER|ADMIN|MEMBER; **mutate/assign** OWNER|ADMIN. Docs that mention OPERATOR map to MEMBER for read.

## Routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | List; filters `status`, `customerId`, `assignedUserId` |
| POST | `/` | Ensure/create OPEN lead (`customerId`, optional `primaryServiceId`) |
| GET | `/{leadId}` | Detail + derived `qualificationState` |
| GET | `/{leadId}/activities` | Append-only history |
| PATCH | `/{leadId}` | Qualification patch; **requires `expectedVersion`** → 409 `VERSION_CONFLICT` |
| POST | `/{leadId}/transitions` | Human transitions; DISQUALIFIED/ARCHIVED need reason vocab |
| POST | `/{leadId}/assign` | `assignedUserId` must be ACTIVE org member (composite FK) |
| POST | `/{leadId}/unassign` | Clear assignment |
| POST | `/{leadId}/notes` | `NOTE_ADDED` activity |

No WON/BOOKED in P06. Ambiguity codes: `AMBIGUOUS_LEAD` (409).
