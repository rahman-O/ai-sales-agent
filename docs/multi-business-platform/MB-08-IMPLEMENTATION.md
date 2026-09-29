# MB-08 Implementation: Generic Organization-Owned Knowledge Setup

## Status: CLOSED

## Overview

MB-08 implements a generic organization-owned Knowledge Setup system enabling any business to teach the AI assistant approved unstructured and semi-structured operational information (text guides, FAQs, uploaded documents, manual notes) while preserving strict architectural separation between structured transactional truth and knowledge explanatory context.

## Architectural Boundaries

### Structured Truth vs Knowledge Precedence

| Domain | Source of Truth | Role of Knowledge | Precedence Rule |
|---|---|---|---|
| **Catalog Prices** | `CatalogItem` / `Service` | Informational descriptions only | Catalog price **strictly governs**; knowledge prices ignored |
| **Offers & Discounts** | `Offer` engine (`calculateDiscountedPrice`) | Informational promotion explanations | Active Offer **strictly governs**; knowledge cannot activate discounts |
| **Business Policies** | `BusinessPolicy` rules | Explanatory context & FAQs | Structured Policy (e.g. cancellation cutoff) **strictly governs** |
| **Booking Availability** | Availability engine & slot tokens | General scheduling guidelines | Real backend `getAvailableSlots` / `slotToken` **strictly governs** |
| **Bookings** | `Booking` table | N/A | `createBooking` **strictly governs**; no synthetic confirmations |

### Knowledge Source Model

- **Model**: `KnowledgeDocument` (owned by `Organization`)
- **Source Types**: `TEXT`, `FAQ`, `FILE`, `URL`, `MANUAL_NOTE`
- **Visibility Levels**:
  - `CUSTOMER_VISIBLE`: Eligible for retrieval by customer-facing AI agent once published.
  - `INTERNAL_ONLY`: Reserved for operator/internal copilot workflows; excluded from customer retrieval.
- **Lifecycle States**: `DRAFT`, `PROCESSING`, `READY_FOR_REVIEW`, `PUBLISHED`, `FAILED`, `ARCHIVED`
- **Publish Approval Boundary**:
  - Direct upload/ingest -> `AWAITING_REVIEW` / `READY_FOR_REVIEW`
  - Admin/Operator Review -> `APPROVED`
  - Explicit Publish -> `PUBLISHED` (sets `activePublishedVersionId`)
  - Only `PUBLISHED` + `CUSTOMER_VISIBLE` content is retrievable by customer-facing runtime.

### Chunking & Semantic Search

- **Chunking Profile**: `chunk_v1` (Unicode-script aware, deterministic token estimation, 500 target tokens, 75 overlap tokens, 800 max tokens).
- **Embedding Profile**: `qwen3_embed_06b_1024_v1` (1024-dimension vectors).
- **Vector Retrieval**: Tenant-isolated cosine distance search over `knowledge_chunks` with `(c.organization_id = current_tenant_id())`, `active_published_version_id` matching, and strict relevance distance thresholds.
- **Fail-Closed Retrieval**: Empty results or low-relevance results return explicit empty matches without hallucinated facts.

## API Endpoints

- `GET /organizations/:organizationId/knowledge/documents` - List organization knowledge documents
- `GET /organizations/:organizationId/knowledge/documents/:documentId` - Get document details and versions
- `POST /organizations/:organizationId/knowledge/text` - Create plain text guide
- `POST /organizations/:organizationId/knowledge/faq` - Create structured FAQ entry
- `POST /organizations/:organizationId/knowledge/uploads` - Initialize file upload
- `POST /organizations/:organizationId/knowledge/documents/:documentId/finalize` - Finalize upload
- `POST /organizations/:organizationId/knowledge/documents/:documentId/versions/:versionId/approve` - Approve review
- `POST /organizations/:organizationId/knowledge/documents/:documentId/versions/:versionId/publish` - Publish version
- `POST /organizations/:organizationId/knowledge/documents/:documentId/unpublish` - Unpublish active version
- `POST /organizations/:organizationId/knowledge/documents/:documentId/archive` - Archive document
- `POST /organizations/:organizationId/knowledge/documents/:documentId/reprocess` - Reprocess document chunks
- `POST /organizations/:organizationId/knowledge/search` - Semantic test search & preview

## Database Migration

Migration `202609290100_mb08_knowledge_setup` applied to both local Supabase and Postgres instances:
- Added `source_type` (`TEXT`, `FAQ`, `FILE`, `URL`, `MANUAL_NOTE`) to `knowledge_documents`
- Added `visibility` (`CUSTOMER_VISIBLE`, `INTERNAL_ONLY`) to `knowledge_documents`
- Added `metadata_json` (JSONB) to `knowledge_documents`
- Added index `idx_knowledge_docs_org_type_vis` on `(organization_id, source_type, visibility)`
- Row-Level Security (RLS) forced on all knowledge tables (`knowledge_documents`, `knowledge_document_versions`, `knowledge_chunks`).

## Verification & Quality Gates

- `npx prisma validate`: PASS
- `npx prisma generate`: PASS
- `npm test`: PASS (all unit, integration, RLS, and contract suites passing)
- `npm run build`: PASS (`@ai-sales-agent/contracts`, `@ai-sales-agent/api`, `@ai-sales-agent/web`)
- `npm run demo:reseed`: PASS (Deterministic published and review sources seeded)
- No `businessType` runtime branching introduced
- DeepSeek runtime unchanged
