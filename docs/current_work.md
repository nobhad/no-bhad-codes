# Current Work

**Last Updated:** February 11, 2026 (Full System Audit Complete)

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-02.md`.

---

## System Audit Summary (Feb 11, 2026)

**Overall Status:** 85-90% complete. Core features fully operational. Gaps exist in feature integrations.

**Complete:** Client Portal, Admin Dashboard, Invoices (full system), Files (versioning, folders, tags), Messages (with attachments), Deliverables, Document Requests, Questionnaires, Auth, Analytics, Knowledge Base

**Incomplete:** Feature integrations (see below)

---

## HIGH PRIORITY - Feature Integrations Needed

### 1. File Sharing Control (FOUNDATION - Do First)

- [ ] Add `shared_with_client` column to uploads table (BOOLEAN, default FALSE)
- [ ] Add `shared_at` and `shared_by` columns
- [ ] Create `/api/uploads/:id/share` and `/api/uploads/:id/unshare` endpoints
- [ ] Admin Files tab: Add "Share with Client" toggle button
- [ ] Client portal: Only show files where `shared_with_client = TRUE`
- [ ] All auto-generated files default to NOT shared

### 2. Receipts Feature

- [ ] Create `receipts` table (receipt_number, invoice_id, payment_id, amount, file_id)
- [ ] Auto-generate PDF receipt on ANY payment (including partial)
- [ ] Each payment gets its own receipt
- [ ] Save receipt PDF to project Files (Documents folder)
- [ ] Add receipt management UI in admin
- [ ] Client can download receipts from invoices tab

### 3. Questionnaires to Files Integration

- [ ] On questionnaire completion: generate PDF of Q&A
- [ ] Keep raw JSON data export available
- [ ] Auto-save PDF to project Files (Forms folder)
- [ ] Mark questionnaire as having exported file

### 4. Document Requests to Files Integration

- [ ] After admin approval: MOVE uploaded file from Doc Requests to Files tab
- [ ] File goes to Forms folder
- [ ] Original request marked complete with file reference
- [ ] Maintain audit trail

### 5. Project Details - Invoices Tab

- [ ] Add Invoices section to admin project detail view
- [ ] Full CRUD: create, view, edit, send, mark paid
- [ ] Filter invoices by current project
- [ ] Quick actions without leaving project context

### 6. Project Details - PDF Creation

- [ ] Add document generation dropdown in Files tab
- [ ] Generate: proposals, contracts, receipts, reports, SOWs
- [ ] Template-based generation
- [ ] Auto-save to project Files (NOT shared by default)
- [ ] Preview before saving

---

## DISCONNECTED FEATURES - Workflow Gaps

These features exist independently but should be connected. The workflow infrastructure (`WorkflowTriggerService`) exists but events aren't being emitted from routes.

### Proposal → Project (BROKEN)

- **Current:** Proposal accepted, status changes, STOPS
- **Should:** On acceptance → Create project, auto-send questionnaires, create milestones, generate deposit invoice, notify admin for contract
- **Files:** `server/routes/proposals.ts`, `server/services/proposal-service.ts`

### Contract → Project Status (BROKEN)

- **Current:** Contract signed, timestamp set, STOPS
- **Should:** On signing → Update project status to 'active', trigger project start, create initial milestone, log in timeline
- **Files:** `server/services/contract-service.ts`, `server/routes/contracts.ts`

### Milestone → Invoice (BROKEN)

- **Current:** Milestone marked complete, STOPS
- **Should:** On completion → If payment milestone, create/send invoice automatically, trigger payment workflow
- **Files:** `server/routes/projects/milestones.ts`, `server/services/invoice-service.ts`

### Deliverable → Files Archive (BROKEN)

- **Current:** Deliverable approved and locked, STOPS
- **Should:** On approval → Move to Files (Design folder), create file entry, archive from active review, notify client
- **Files:** `server/services/deliverable-service.ts`, `server/routes/deliverables.ts`

### Ad Hoc Request → Time/Invoice (PARTIAL)

- **Current:** Can manually create invoice from ad hoc request
- **Should:** On completion → Auto-aggregate time entries, calculate final amount, create invoice line item
- **Files:** `server/routes/ad-hoc-requests.ts`, `server/services/ad-hoc-request-service.ts`

### Missing Workflow Event Emissions

These event types are defined in `workflow-trigger-service.ts` but NO routes emit them:

- `proposal.accepted`, `proposal.rejected`
- `contract.signed`
- `project.milestone_completed`
- `invoice.paid`
- `deliverable.approved`
- `document_request.approved`
- `questionnaire.completed`

### Missing Notifications

No notifications trigger for: proposal accepted, contract signed, deliverable approved, questionnaire completed, document request approved, invoice paid, milestone completed, ad hoc request completed

---

## FRONTEND vs BACKEND Gaps (Audit Feb 11, 2026)

### Backend Endpoints with NO Frontend UI (ORPHANED)

These backend routes exist but have no admin interface:

| Endpoint | Feature | Priority |
|----------|---------|----------|
| `/api/invoices/aging/*` | A/R Aging Reports | HIGH |
| `/api/invoices/recurring/*` | Recurring Invoice Management | HIGH |
| `/api/invoices/credits/*` | Credit System | HIGH |
| `/api/invoices/payment-plans/*` | Payment Plan Templates | MEDIUM |
| `/api/invoices/reminders/*` | Reminder Management | MEDIUM |
| `/api/analytics/bi/revenue` | Revenue BI Dashboard | MEDIUM |
| `/api/analytics/bi/pipeline` | Sales Pipeline | MEDIUM |
| `/api/analytics/bi/funnel` | Conversion Funnel | MEDIUM |
| `/api/integrations/stripe/*` | Stripe Management | LOW (deferred) |
| `/api/integrations/calendar/*` | Calendar Integration | LOW |
| `/api/data-quality/*` | Data Quality Dashboard | LOW |

### Frontend Calling Missing Backend

| Frontend Location | Endpoint Called | Status |
|-------------------|-----------------|--------|
| `portal-invoices.ts` | `/api/clients/me/billing` | MISSING - needs endpoint |
| `admin-ad-hoc-analytics.ts` | `/api/ad-hoc-requests/summary/monthly` | MISSING - uses fallback |

### Debug Code to Remove (Production Cleanup)

- `admin-analytics.ts:587` - console.log for report debug
- `admin-projects.ts:2216,2235,2322-2329` - Invoice debug logs
- `portal-invoices.ts:67` - Error logging

### Services with No Admin UI

| Service | Feature | UI Status |
|---------|---------|-----------|
| `soft-delete-service.ts` | Deleted Items Recovery | NO UI |
| `duplicate-detection-service.ts` | Duplicate Detection | LIMITED |
| Invoice Payment Plans | Template management | NO UI |
| Invoice Credits | Credit application | NO UI |
| Invoice Aging | Report viewing | NO UI |

---

## MEDIUM PRIORITY - UI/UX Issues

- [ ] **Admin global header logo** - Needs ACME font, match main site style
- [ ] **Client portal headers** - Move toggle + breadcrumbs to page header, hide title
- [ ] **Dashboard greeting** - Client name stays together on own line if can't fit
- [ ] **DIV SPACING** - Verify remaining pages for consistency
- [ ] **CSS Base Styling** - Help page card/section structure

  ---

  ORPHANED BACKEND (No Admin UI)
  ┌──────────────┬───────────────────────────────┬──────────┬──────────────────┐
  │   Feature    │        Backend Exists         │ Frontend │      Impact      │
  │              │                               │    UI    │                  │
  ├──────────────┼───────────────────────────────┼──────────┼──────────────────┤
  │ Invoice      │                               │          │ Can't see        │
  │ Aging        │ /api/invoices/aging/*│ NONE     │ overdue invoices │
  │ Reports      │                               │          │  by age          │
  ├──────────────┼───────────────────────────────┼──────────┼──────────────────┤
  │ Recurring    │                               │          │ Can't manage     │
  │ Invoices     │ /api/invoices/recurring/*     │ NONE     │ recurring        │
  │              │                               │          │ billing          │
  ├──────────────┼───────────────────────────────┼──────────┼──────────────────┤
  │ Invoice      │ /api/invoices/credits/*│ NONE     │ Credit system    │
  │ Credits      │                               │          │ unusable         │
  ├──────────────┼───────────────────────────────┼──────────┼──────────────────┤
  │ Payment      │                               │          │ Can't configure  │
  │ Plans        │ /api/invoices/payment-plans/* │ NONE     │ payment          │
  │              │                               │          │ templates        │
  ├──────────────┼───────────────────────────────┼──────────┼──────────────────┤
  │ Invoice      │                               │          │ Can't manage     │
  │ Reminders    │ /api/invoices/reminders/*     │ NONE     │ reminder         │
  │              │                               │          │ schedules        │
  ├──────────────┼───────────────────────────────┼──────────┼──────────────────┤
  │ BI Revenue   │ /api/analytics/bi/revenue     │ NONE     │ Revenue          │
  │ Dashboard    │                               │          │ analytics hidden │
  ├──────────────┼───────────────────────────────┼──────────┼──────────────────┤
  │ Sales        │ /api/analytics/bi/pipeline    │ NONE     │ Pipeline data    │
  │ Pipeline     │                               │          │ inaccessible     │
  ├──────────────┼───────────────────────────────┼──────────┼──────────────────┤
  │ Conversion   │ /api/analytics/bi/funnel      │ NONE     │ Funnel analytics │
  │ Funnel       │                               │          │  hidden          │
  ├──────────────┼───────────────────────────────┼──────────┼──────────────────┤
  │ Soft Delete  │ soft-delete-service.ts        │ NONE     │ Can't restore    │
  │ Recovery     │                               │          │ deleted items    │
  └──────────────┴───────────────────────────────┴──────────┴──────────────────┘
  MISSING BACKEND (Frontend Calls Non-Existent)
  Frontend: Client Portal Billing
  Calls: /api/clients/me/billing
  Status: MISSING
  ────────────────────────────────────────
  Frontend: Ad Hoc Analytics
  Calls: /api/ad-hoc-requests/summary/monthly
  Status: MISSING (uses fallback)
  DEBUG CODE TO CLEAN UP

  - admin-analytics.ts:587
  - admin-projects.ts:2216,2235,2322-2329
  - portal-invoices.ts:67

  ---
  COMPLETE PICTURE
  ┌─────────────────────────────┬───────┐
  │          Category           │ Count │
  ├─────────────────────────────┼───────┤
  │ Feature Integrations Needed │ 6     │
  ├─────────────────────────────┼───────┤
  │ Workflow Disconnections     │ 8     │
  ├─────────────────────────────┼───────┤
  │ Orphaned Backend Endpoints  │ 11+   │
  ├─────────────────────────────┼───────┤
  │ Missing Backend Endpoints   │ 2     │
  ├─────────────────────────────┼───────┤
  │ Services Without UI         │ 5     │
  ├─────────────────────────────┼───────┤
  │ Debug Code Locations        │ 3     │
  └─────────────────────────────┴───────┘  

---

## DATABASE SCHEMA GAPS (Audit Feb 11, 2026)

### TypeScript Types vs Actual Schema Mismatch

- `InvoiceRow` type uses `amount_subtotal`, `amount_tax`, `amount_total`
- Actual schema (migration 029) has `subtotal`, `tax_amount`, `tax_rate`
- 15+ fields need updating in `server/types/database.ts`

### Missing Foreign Key Relationships

- `projects` table missing `intake_id` and `proposal_id` columns
- No explicit link between proposals → projects
- No explicit link between contracts → projects

### Missing Type Definitions (40+ tables)

No TypeScript types for: deliverable_workflows, approval_workflows, payment_terms_presets, invoice_payments, invoice_credits, scheduled_invoices, recurring_invoices, ad_hoc_requests, document_requests, questionnaires, contracts, proposals, email_templates, workflow_triggers, kb_articles

### Missing Soft Delete Columns

Tables created after migration 050 missing `deleted_at`, `deleted_by`:
invoice_line_items, invoice_payments, invoice_reminders, scheduled_invoices, recurring_invoices, approval_workflow tables, deliverable tables

### Deferred Migration 075

- Invoices table has 30+ columns, should be slimmed to ~20
- Waiting period passed (deferred 2026-02-10, now 2026-02-11)
- Can run now if safe

---

## TEST COVERAGE GAPS (Audit Feb 11, 2026)

### Routes WITHOUT Tests (18 of 25)

| Route | Lines | Priority |
|-------|-------|----------|
| `uploads.ts` | 1,189 | CRITICAL |
| `projects.ts` | Multiple | CRITICAL |
| `clients.ts` | 53 funcs | HIGH |
| `analytics.ts` | 51 funcs | HIGH |
| `messages.ts` | 35 funcs | HIGH |
| `integrations.ts` | 21 funcs | HIGH |

### Services WITHOUT Tests (26 of 39)

CRITICAL: `stripe-service.ts` (485 lines), `file-service.ts` (1,254 lines)
HIGH: project-service, client-service, proposal-service, contract-service, deliverable-service, questionnaire-service, workflow-trigger-service, scheduler-service

### Test Quality Issues

- Most tests only check happy path (no error cases)
- Over-mocking: Tests mock DB, don't test real behavior
- 2 skipped tests: `errorHandler.test.ts:213`, E2E login failures

### Coverage Summary

- Routes tested: 7/25 (28%)
- Services tested: 13/39 (33%)
- Payment processing: 0%
- File operations: 0%

---

## SECURITY GAPS (Audit Feb 11, 2026)

### CRITICAL: Rate Limiting Not Global

- Only auth endpoints have rate limiting
- Public intake endpoint: NO rate limiting (DDoS risk)
- Webhook endpoints: NO rate limiting
- Admin endpoints: NO rate limiting

### Missing Input Validation

- `POST /api/intake` - NO validation middleware
- Query parameters on file listings - NOT validated
- Admin endpoint inputs - NOT strictly validated

### Authorization Gaps

- `GET /api/intake/status/:projectId` - NO auth required (info disclosure)
- File access allows uploader access even if removed from project

### Other Security Issues

- Stripe webhook needs signature verification before processing
- Error messages may leak user existence info
- File upload filename collisions possible
- JWT algorithm not explicitly specified

### Priority Fixes

1. Add global rate limiting to `/api` routes
2. Validate intake form inputs
3. Secure Stripe webhook signature verification
4. Add auth to intake status endpoint

---

## PERFORMANCE GAPS (Audit Feb 11, 2026)

### N+1 Query Problems

| Location | Issue | Impact |
|----------|-------|--------|
| `recurring-service.ts:288-314` | Loop calls createInvoice + UPDATE per invoice | HIGH |
| `recurring-service.ts:340-352` | 6 INSERT calls per invoice instead of batch | MEDIUM |
| `soft-delete-service.ts:109-120` | Loop calls softDeleteProject per project | MEDIUM |

### Missing Database Indexes

```sql
-- Critical indexes to add
CREATE INDEX idx_invoice_reminders_status_date ON invoice_reminders(status, scheduled_date);
CREATE INDEX idx_recurring_invoices_active_next ON recurring_invoices(is_active, next_generation_date);
CREATE INDEX idx_scheduled_invoices_status_trigger_date ON scheduled_invoices(status, trigger_type, scheduled_date);
CREATE INDEX idx_invoice_reminders_invoice_id ON invoice_reminders(invoice_id);
```

### Missing Pagination

- `SELECT * FROM data_quality_metrics` - NO LIMIT
- `SELECT * FROM integration_status` - NO LIMIT
- Some admin endpoints missing pagination

### Caching Gaps

- No query-level caching for: payment terms, business info, settings
- Expensive reports not cached: aging report, comprehensive stats

---

## Open Issues

### ACTIVE - IN PROGRESS THIS SESSION

### PENDING TESTING

- [ ] **Horizontal scroll on mobile** - Fixed `min-width: 320px` to `min-width: 0`, added `overflow-x: hidden` to containers - NEEDS VERIFICATION
- [ ] **Client Portal Files Tab** - Verify project folders display correctly, clicking project filters files, all files (including documents) show for each project
- [ ] **Intake PDF Access** - Verify intake files open as PDF (not JSON) for logged-in clients
- [ ] Test hash-based routing: invalid hash `#/invalid` redirects to dashboard
- [ ] Test Messages page two-column layout at various screen sizes
- [ ] hash-based routing: browser back/forward navigates correctly - cant test with vite
- [ ] Browser back/forward navigation (needs production build)
- [ ] Hash-based routing: invalid hash redirects to dashboard

### VERIFIED FIXED - NO VERIFICATION NEEDED, CAN BE MOVED TO ARCHIVE

none yet

---

## Pre-existing Server TypeScript Errors

These errors existed before current session and are not blocking:

- `unknown` type errors in `calendar-service.ts` and `stripe-service.ts`
- `rootDir` configuration issue with `shared/` folder imports

---

## Database Normalization

**Full Documentation:** See `docs/architecture/DATABASE_SCHEMA.md` and `docs/architecture/DATABASE_NORMALIZATION_PLAN.md`

**Phase 1-3:** COMPLETE (Feb 10, 2026) - Migrations 067-074 applied

**Phase 4 - High Risk:** DEFERRED

- [ ] Consolidate lead/intake overlap (single source of truth)
- [ ] Unify message tables (messages vs general_messages)
- [ ] Add soft-delete to all core entities
- [ ] Slim invoices table (remove redundant columns) - `075_slim_invoices_table.sql.bak`

---

## Portfolio Assets Needed (for Noelle not Claude)

**Status:** Waiting on assets

- [ ] Project screenshots
- [ ] CRT TV title cards for each project
- [ ] OG images for social sharing (1200x630 PNG)

**Location:** public/images/portfolio/

---

## Deferred Items

- **Stripe Payments** - Cost deferral
- **Real-Time Messages (WebSockets)** - Polling works fine
- **MFA/2FA, SSO** - Single admin user
- **Virtual Tour/Walkthrough** - Nice to have

---

## Recent Test Runs

- 2026-02-11: `npm run test:run` - 34 files, 847 passed, 1 skipped
- 2026-02-11: `npm run lint` - clean

---

## DO NOT REMOVE OR EDIT ANYTHING BELOW THIS LINE - Used for tracking and documentation purposes

### Design System Reference

For design guidelines, see:

- `docs/design/UX_GUIDELINES.md` - Icons, typography, spacing, accessibility
- `docs/design/CSS_ARCHITECTURE.md` - CSS variables, component classes, naming conventions

Key rules:

- NO EMOJIS - Use Lucide icons only
- NEVER hardcode colors - use CSS variables
- Use `createPortalModal()` for modals - never custom modal HTML
- Complex animations use GSAP, not CSS animations
- BUT MUST REVIEW ALL

### Post-Task Documentation Checklist

After completing any task list:

- [ ] Update feature docs (docs/features/*.md) if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [ ] Update relevant audit file (current state only, no fix logs)
- [ ] Move fully completed tasks from current_work to archive
- [ ] Verify no markdown violations
