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
- [ ] Horizontal

### VERIFIED FIXED - NO VERIFICATION NEEDED, CAN BE MOVED TO ARCHIVE

- [x] **Help Page UX Redesign - COMPLETE** (Feb 11, 2026)
  - Two-column layout: Categories LEFT (narrower), Content RIGHT (wider)
  - Hero search with live suggestions and keyboard navigation
  - Collapsible accordion with single-open behavior
  - Quick Start articles grid, clickable to show article detail on right
  - Contact section updated for single person
- [x] **Password Save Prompt Fix - COMPLETE** (Feb 11, 2026)
  - Root cause: Multiple `autocomplete="new-password"` fields caused browsers to show 4 save password prompts
  - Fixed confirm-password fields to use `autocomplete="off"` instead of `autocomplete="new-password"`
  - Added `autocomplete="off"` to password forms
  - Removed dynamic autocomplete manipulation in JavaScript
  - Files fixed: `set-password.html`, `reset-password.html`, `portal-views.ts`, `client-portal.ejs`
- [x] **Module Spec Implementation Plan - COMPLETE** (Feb 11, 2026)
  - [x] Invoice View/Edit Modals - View modal for all invoices, edit modal for drafts only
  - [x] Password Reset Flow - Forgot password page, reset password page, backend endpoints
  - [x] Onboarding Wizard Integration - Shows on first login, triggers from client-portal.ts
  - [x] Notification Center UI - Bell icon, dropdown, mark read, polling
  - [x] Message File Attachments - Paperclip button, file preview chips, drag & drop, download
- [x] **Client Portal Files - Project Folders** - Added `populateFolderTree()` to show projects as folders, `selectFolder()` to filter files by project, intake file PDF preview support
- [x] **Messages Tab Mobile Spacing** - Removed extra padding from `.messages-page-layout`, now matches rest of portal
- [x] **Dashboard API 500 Error** - FIXED: Ambiguous column references in `/me/dashboard` files subquery (added `f.` prefix to `original_filename`, `created_at`, `id`)
- [x] **Admin Recent Activity 500 Error** - FIXED: `client_intakes` table has `first_name`/`last_name` not `contact_name`, updated query to use concatenation
- [x] Verified milestone card layout shows status top-right and date bottom-right
- [x] Tested settings page loads client profile data from database
- [x] Tested hash-based routing: sidebar clicks update URL hash
- [x] Tested sidebar buttons navigate to correct views
- [x] Tested data isolation - login as different clients and verify no data bleed
- [x] Tested collapsed sidebar maintains consistent appearance at all screen sizes
- [x] Tested hash-based routing: direct link to `#/messages` opens messages tab
- [x] **Header Logo** - Changed from avatar image to "no bhad codes" text.
- [x] **Milestone Card Layout** - Status in header, due date in footer.
- [x] **Client Portal Navigation** - Hash-based routing implemented (`#/dashboard`, `#/files`, etc.) with dynamic view rendering via `portal-views.ts`.
- [x] **Sidebar Background Color** - Changed to match global header (`--portal-bg-darker`).
- [x] **"Contact support" email link** - FIXED: Now says "Contact Noelle" with link to messages, red text styling
- [x] **Recent activity "Loading..."** - FIXED: Added `loadDashboard` callback to load stats when dashboard view is rendered
- [x] **Portal 401 Unauthorized Redirect** - FIXED: Added global fetch interceptor that detects 401 responses and redirects to login with "session expired" message.
- [x] **Client Dashboard** - FIXED: Moved stat cards above progress/milestones
- [x] **Client Portal Page Titles** - FIXED: Now shows individual tab titles instead of group titles
- [x] **Settings page form submission** - FIXED: Now calls `setupSettingsForms()` after view is rendered to attach event handlers
- [x] **Messages "No messages yet"** - FIXED: Force refresh DOM cache when loading messages
- [x] **Help page categories on left** - FIXED: Swapped grid columns so categories sidebar is on left
- [x] **Browser tab title** - FIXED: Shows "No Bhad Codes" not "No Bhad Codes - Portfolio"
- [x] **Admin "SUPPORT" to "Knowledge Base"** - FIXED: Updated sidebar button and tab titles
- [x] **Settings Full Name redundancy** - FIXED: Changed billing section label to "Billing Name"
- [x] **Mobile padding** - FIXED: Reduced left/right padding on screens under 400px
- [x] **Portal Greeting** - "Welcome Back" for returning users, "Welcome to the Portal" for first login. Database field `last_login` (migration 076), `isFirstLogin` returned on login.
- [x] **Billing name** - Separate `billing_name` field in database (migration 077), distinct from `contact_name`
- [x] **Tab switching alignment** - Subtabs (Projects, Tasks, Requests, etc.) aligned to far right in page header
- [x] **Knowledge Base toggle** - Removed "Knowledge Base" button from support subtabs, only Categories/Articles toggle shows
- [x] **Mobile menu toggle** - Sidebar panel icon in page header on mobile when sidebar collapsed - opens sidebar
- [x] **Logout button background** - FIXED: Changed `.logout-btn` from `background: var(--portal-bg-light)` to `transparent` so it matches other sidebar buttons
- [x] **Messages mobile padding** - FIXED: Added CSS to remove outer `.dashboard-content` padding on messages tab for screens under 600px
- [x] **Login page menu** - Menu button opens navigation overlay on login page
- [x] **Mobile overflow** - No horizontal scrolling on any page (375px viewport)
- [x] **Login page mobile** - FIXED: Full width, transparent background, no shadow on mobile (both client portal and admin)
- [x] **Help Page Layout** - COMPLETE: Two-column grid layout with accordion categories, search suggestions, article detail view
- [x] **Files display** - Client portal files now match admin: folder tree shows projects, clicking project filters files, intake files open as PDF
- [x] **FILES Layout** - Now matches admin portal: CSS Grid two-column layout, project folders in left panel, files table on right, intake PDFs display correctly
- [x] Messages page two-column layout at various screen sizes
- [x] Client Portal Files Tab - Verify project folders display correctly
- [x] Intake PDF Access - Verify intake files open as PDF (not JSON)
- [ ] Hash-based routing: invalid hash redirects to dashboard

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
