# Current Work

**Last Updated:** February 6, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-02.md`.

## Planned Enhancements

### Admin UI for Deleted Items

**Priority:** Medium
**Status:** Pending

Create admin UI module for viewing and managing deleted items (trash).

**Files to Create:**

- `src/features/admin/modules/admin-deleted-items.ts`

**Features:**

- Table view of all deleted items
- Filter by entity type (client, project, invoice, lead, proposal)
- Days until permanent deletion column
- Restore button per row
- Permanent delete with confirmation

## Recently Completed

- [x] **30-Day Soft Delete Recovery System (Feb 6, 2026)**: Implemented soft delete with 30-day recovery.

  **Core Pattern:**

  - Added `deleted_at` and `deleted_by` columns to: clients, projects, invoices, client_intakes, proposal_requests
  - Converted DELETE endpoints to soft delete via `softDeleteService`
  - Added `WHERE deleted_at IS NULL` to all SELECT queries using `notDeleted()` helper
  - Added admin API endpoints for viewing/restoring deleted items
  - Added scheduled cleanup job (daily at 2 AM) to permanently delete items older than 30 days

  **Cascade Behavior:**

  - Deleting client cascades to: projects, proposals, voids unpaid invoices (keeps paid)
  - Deleting project cascades to: proposals (keeps invoices)
  - Paid invoices cannot be deleted

  **Files Created:**

  - `server/database/migrations/050_soft_delete_system.sql`
  - `server/services/soft-delete-service.ts`
  - `server/database/query-helpers.ts`

  **Files Modified:**

  - `server/routes/clients.ts` - Soft delete endpoint, query updates
  - `server/routes/projects.ts` - Soft delete endpoint, query updates
  - `server/routes/invoices.ts` - Soft delete endpoint
  - `server/routes/proposals.ts` - New DELETE endpoint, query updates
  - `server/routes/admin.ts` - New deleted items management endpoints
  - `server/services/scheduler-service.ts` - Daily cleanup job

  **Admin API Endpoints:**

  - `GET /api/admin/deleted-items` - List deleted items (optional ?type= filter)
  - `GET /api/admin/deleted-items/stats` - Get counts by entity type
  - `POST /api/admin/deleted-items/:type/:id/restore` - Restore a deleted item
  - `DELETE /api/admin/deleted-items/:type/:id/permanent` - Force permanent delete
  - `POST /api/admin/deleted-items/cleanup` - Manual cleanup trigger

  **Status:** Complete. Migration applied. Backend fully functional.



- [x] **Audit Critical & High Priority Fixes (Feb 6, 2026)**: Implemented fixes for all critical and high priority issues from the database, forms, and modals audits.

  **Phase 1 - Database Critical Fixes:**

  - Removed deprecated `users` table and dead code
    - Deleted unused `/auth/register` endpoint from `api.ts`
    - Fixed avatar upload to use `clients` table instead of `users`
    - Fixed status metrics endpoint to query `clients` instead of `users`
    - Deleted unused `server/models/User.ts`
    - Created migration `048_drop_deprecated_users_table.sql`
  - Fixed project status CHECK constraint
    - Created migration `049_fix_project_status_constraint.sql`
    - Added 'active' and 'cancelled' to allowed status values

  **Phase 2 - Database High Priority Fixes:**

  - Fixed boolean handling in `row-helpers.ts`
    - Updated `getBoolean()` and `getBooleanOrNull()` to handle SQLite's 0/1 representation
    - Removed unused `sqliteBoolToJs/jsBoolToSqlite` from `database.ts`

  **Phase 3 - Forms High Priority Fixes:**

  - Created reusable password toggle component
    - New file: `src/components/password-toggle.ts`
    - Features: icon updates (eye/eye-off), ARIA labels, `initPasswordToggle()` and `initAllPasswordToggles()`
    - Updated `admin-login.ts` to use new component
    - Updated `client/set-password.html` with toggle buttons and component import
    - Exported from `src/components/index.ts`

  **Files Modified:**

  - `server/routes/api.ts` - Removed dead registration code, fixed status metrics
  - `server/routes/uploads.ts` - Fixed avatar upload table reference
  - `server/database/row-helpers.ts` - Fixed boolean handling
  - `server/types/database.ts` - Removed unused boolean helpers
  - `src/features/main-site/admin-login.ts` - Use password toggle component
  - `client/set-password.html` - Added toggle buttons, use component
  - `src/components/index.ts` - Export password toggle

  **Files Created:**

  - `server/database/migrations/048_drop_deprecated_users_table.sql`
  - `server/database/migrations/049_fix_project_status_constraint.sql`
  - `src/components/password-toggle.ts`

  **Files Deleted:**

  - `server/models/User.ts`

  **Status:** Complete. Migrations applied.

- [x] **Form Label Associations Fix (Feb 6, 2026)**: Fixed accessibility issue from Forms Audit.

  - Fixed missing label association in `admin/index.html` line 2067
  - Added `<label for="file-comment-input" class="sr-only">` and `aria-label` to file comment textarea
  - All other forms in `index.html`, `client/portal.html`, and `admin/index.html` already had proper associations

  **Status:** Complete. All audit tasks finished.

- [x] **Database Schema Audit (Feb 6, 2026)**: Comprehensive audit of database tables, relationships, and indexes.

  **Created:** `docs/design/DATABASE_AUDIT.md`

  **Statistics:**
  - 44+ tables across 47 migrations
  - 600+ columns total
  - 180+ indexes
  - 60+ foreign key relationships

  **Critical Issues Found:**
  - Dual user management (`clients` and `users` tables)
  - Project status CHECK constraint excludes 'active' and 'cancelled'
  - Boolean inconsistency (INTEGER vs BOOLEAN)
  - Cascading deletes could cause accidental data loss

  **High Priority Issues:**
  - Text-based foreign keys (`assigned_to`, `user_name`) lack referential integrity
  - JSON columns without schema validation
  - Missing composite indexes for common queries
  - No row-level security

  **Status:** Audit complete, fixes pending

- [x] **Forms Audit (Feb 6, 2026)**: Comprehensive audit of all forms, validation patterns, and accessibility.

  **Created:** `docs/design/FORMS_AUDIT.md`

  **Findings:**
  - 9 major HTML forms across the codebase
  - 11 field types (text, email, password, tel, number, date, url, checkbox, radio, textarea, select)
  - 30+ validation functions in 3 layers (HTML5, client-side, server-side)
  - 10 pre-defined validation schemas
  - 7 CSS files dedicated to form styling

  **Issues Found:**
  - Inconsistent password toggle implementations
  - Mixed required attribute patterns (`data-required` vs `required`)
  - Different error display patterns (popups vs inline)
  - Some missing label-for associations

  **Status:** Audit complete, fixes pending

- [x] **Modals & Dialogs Audit (Feb 6, 2026)**: Comprehensive audit of all modals, dialogs, and overlay components.

  **Created:** `docs/design/MODALS_AUDIT.md`

  **Findings:**
  - 7 modal implementation types
  - 47+ files with modal code
  - 20+ confirm/alert dialog instances
  - 15+ form modal instances
  - 3 z-index layers (9999, 10002, 10100)

  **Modal Types:**
  - ModalComponent (base class)
  - PortalModal (lightweight factory)
  - ConfirmDialog (Promise-based utilities)
  - FocusTrap (accessibility utilities)
  - ModalDropdown (select converter)
  - Invoice modals (feature-specific)
  - Admin module modals (dynamic)

  **Issues Found:**
  - Hardcoded z-index values not centralized
  - Mixed modal creation patterns
  - Inconsistent close animation timing
  - Some missing aria-describedby attributes

  **Status:** Audit complete, fixes pending

- [x] **CSS Architecture Audit (Feb 6, 2026)**: Comprehensive audit of 83 CSS files (33,555 lines).

  **Created:** `docs/design/CSS_AUDIT.md`

  **Current State:**

  | Metric | Status |
  |--------|--------|
  | Hardcoded colors | 0 critical (3 acceptable fallbacks) |
  | Z-index values | All portal files use `--z-index-portal-*` tokens |
  | Standard breakpoints | All use `@custom-media` (`--mobile`, `--small-mobile`) |
  | `.hidden` selector | Single source in `base/layout.css` |
  | `.password-toggle` | Base styles in `shared/portal-forms.css` |
  | `!important` declarations | 51 instances (most legitimate for GSAP/print) |

  **Remaining (lower priority):**
  - Non-standard breakpoints (900px, 1024px, 1300px) need evaluation
  - Large files: `admin.css` (2,922 lines), `project-detail.css` (2,127 lines)
  - Duplicate utility classes (`.text-*`, `.overview-grid`)

  **Status:** Critical and high priority complete

- [x] **PDF Caching & Utilities (Feb 6, 2026)**: Added in-memory PDF caching and utility functions for all PDF endpoints.

  **New File Created:**
  - `server/utils/pdf-utils.ts` — Shared utilities for PDF generation

  **Caching Implementation:**
  - TTL-based in-memory cache (default 5 minutes, configurable via `PDF_CACHE_TTL_MS`)
  - LRU eviction when max entries reached (default 100, configurable via `PDF_CACHE_MAX_ENTRIES`)
  - Cache key format: `{type}:{id}:{updatedAt}` — auto-invalidates when source data changes
  - Response header `X-PDF-Cache: HIT|MISS` for debugging

  **Utility Functions Added:**
  - `getPdfCacheKey()`, `getCachedPdf()`, `cachePdf()`, `invalidatePdfCache()`, `clearPdfCache()`
  - Multi-page helpers: `createPdfContext()`, `ensureSpace()`, `drawWrappedText()`, `addPageNumbers()`
  - PDF/A metadata: `setPdfMetadata()` with title, author, subject, keywords, dates

  **Endpoints Updated:**
  - `GET /api/invoices/:id/pdf` — Invoice PDF with caching
  - `GET /api/proposals/:id/pdf` — Proposal PDF with caching
  - `GET /api/projects/:id/contract/pdf` — Contract PDF with caching
  - `GET /api/projects/:id/intake/pdf` — Intake PDF with caching

  **Files Modified:**
  - `server/routes/invoices.ts` — Added pdf-utils import and caching
  - `server/routes/proposals.ts` — Added pdf-utils import and caching
  - `server/routes/projects.ts` — Added pdf-utils import and caching
  - `docs/design/PDF_AUDIT.md` — Updated with PDF Utilities section, marked issues resolved

- [x] **Admin UI Fixes (Feb 5, 2026)**: Fixed dropdown alignment and sidebar order issues.

  - **Dropdown alignment**: Table dropdowns now align left with trigger (`left: 0; right: auto; min-width: 100%`)
  - **Dropdown overflow**: Changed `.admin-table-container` from `overflow: hidden` to `overflow: visible` so dropdowns overlay table
  - **Sidebar order**: Reordered to logical grouping: DASHBOARD, LEADS, PROJECTS, CLIENTS, INVOICES, MESSAGES, DOCUMENTS, KNOWLEDGE, ANALYTICS, SYSTEM

  **Files Modified:**
  - `src/styles/shared/portal-dropdown.css` - Dropdown menu positioning
  - `src/styles/pages/admin.css` - Dropdown positioning and table overflow
  - `admin/index.html` - Sidebar button order

- [x] **PDF Generation Audit & High Priority Fixes (Feb 5, 2026)**: Completed comprehensive PDF_AUDIT.md documentation and resolved all high priority issues.

  **Added Missing Documentation:**
  - Contract PDF endpoint (`GET /api/projects/:id/contract/pdf`) - was completely undocumented
  - Contract signature request system (token generation, email notification, audit logging)
  - PDF metadata settings (`setTitle`, `setAuthor`, `setSubject`, `setCreator`)
  - IntakeDocument interface and helper functions with exact mapping values
  - Line items table structure and column positions for Invoice PDF
  - Page constants and font sizes for markdown-to-pdf script
  - Code line counts for all PDF-generating files

  **High Priority Fixes Applied:**
  - **Consolidated BUSINESS_INFO**: Created `server/config/business.ts` as single source of truth
  - **Removed unused pdfkit**: Removed `pdfkit` and `@types/pdfkit` from package.json (only pdf-lib used)
  - **Fixed inconsistent website default**: All files now use `nobhad.codes`
  - **Updated environment.ts**: Added missing fields (BUSINESS_OWNER, BUSINESS_TAGLINE, ZELLE_EMAIL)
  - Deposit invoice title: Changed from "DEPOSIT INVOICE" to "INVOICE"

  **Medium Priority Fixes Applied:**
  - **Line item word wrapping**: Invoice bullet point details now wrap within column bounds
  - **Centralized logo loading**: Added `getPdfLogoBytes()` with fallback paths to business.ts
  - **Contract terms configurable**: Moved to `CONTRACT_TERMS` in business.ts (env override: `CONTRACT_TERMS`)

  **Files Modified:**
  - `server/config/business.ts` - Centralized business info, logo helper, contract terms
  - `server/config/environment.ts` - Added missing business fields to schema
  - `server/routes/invoices.ts` - Word-wrapped details, centralized logo, shared config
  - `server/routes/proposals.ts` - Centralized logo, shared config
  - `server/routes/projects.ts` - Centralized logo, contract terms from config
  - `server/services/invoice-service.ts` - Import from shared config
  - `scripts/markdown-to-pdf.ts` - Updated defaults to match shared config
  - `package.json` - Removed pdfkit and @types/pdfkit
  - `docs/design/PDF_AUDIT.md` - Comprehensive documentation update

- [x] **Cross-Table Consistency Fix (Feb 5, 2026)**: Implemented comprehensive standardization across all admin dashboard tables based on TABLE_AUDIT.md findings.

  **Phase 1 - Fixed Dead/Orphaned UI:**
  - Wired Leads export button to `exportToCsv()` with LEADS_EXPORT_CONFIG
  - Wired Invoices bulk actions (Mark Paid, Send, Delete) with checkbox selection

  **Phase 2-4 - Shared Infrastructure:**
  - Invoices: Added filter UI (`createFilterUI`), pagination, replaced custom export with shared utility
  - Proposals: Replaced custom filter buttons with `createFilterUI()`, added sortable headers
  - Time Tracking: Replaced custom CSV export with shared `exportToCsv()` utility

  **Phase 5 - HTML Structure Normalization:**
  - Renamed tbody IDs: `dr-tbody` → `document-requests-table-body`, `kb-categories-tbody` → `kb-categories-table-body`, `kb-articles-tbody` → `kb-articles-table-body`
  - Fixed KB localStorage key: `admin_kb_filter` → `admin_knowledge_base_filter`
  - Added loading placeholder rows to Document Requests, KB Categories, KB Articles

  **Phase 6 - Toolbar Standardization:**
  - Reordered buttons: Search → Filter → View Toggle → Export → Refresh → Add (last)
  - Standardized labels: "Create Invoice" → "Add Invoice", "New request" → "Add Request"
  - Wrapped SVGs in `<span class="icon-btn-svg">` for consistency

  **Phase 8-9 - State Standardization:**
  - Empty state messages: "No {entity} yet." (zero data) / "No {entity} match the current filters." (filtered empty)
  - Loading states: Added `showTableLoading()` to admin-leads.ts and admin-contacts.ts

  **Phase 10 - Added Pagination:**
  - Document Requests: Added pagination with `createPaginationUI()`
  - KB Articles: Added pagination with `createPaginationUI()`

  **Phase 11 - Filter Config Consistency:**
  - Added `email` to Projects filter searchFields
  - Added `contact_name` to Clients filter searchFields
  - Documented intentional camelCase in Proposals config (API returns camelCase)

  **Files Modified:**
  - `admin/index.html`
  - `src/features/admin/modules/admin-leads.ts`
  - `src/features/admin/modules/admin-contacts.ts`
  - `src/features/admin/modules/admin-projects.ts`
  - `src/features/admin/modules/admin-clients.ts`
  - `src/features/admin/modules/admin-invoices.ts`
  - `src/features/admin/modules/admin-proposals.ts`
  - `src/features/admin/modules/admin-time-tracking.ts`
  - `src/features/admin/modules/admin-document-requests.ts`
  - `src/features/admin/modules/admin-knowledge-base.ts`
  - `src/utils/table-filter.ts`
  - `src/utils/table-export.ts`
  - `docs/design/TABLE_AUDIT.md`

  **Deferred:**
  - DOM caching pattern unification (Map vs createDOMCache vs el() helper): Current patterns all work correctly; this is a code style optimization only
  - Stat cards for Contacts/Document Requests: Filter dropdowns provide equivalent functionality

  **Final Fixes (Feb 5, 2026):**
  - Proposals: Added pagination (`createPaginationUI`, pagination state, container)
  - Document Requests: Added sortable headers (`createSortableHeaders`)
  - Projects: Wired export button to `exportToCsv()`
  - Empty values: Updated `formatDisplayValue()` to return `-` instead of blank
  - Proposals: Changed `btn-icon` to `icon-btn` class, added row click navigation
  - Leads: Changed 14px icons to 16px for consistency

  **All 20 Tiers Complete** - TABLE_AUDIT.md reduced from 3,305 to 2,631 lines

- [x] **Table Column Order Analysis (Feb 5, 2026)**: Comprehensive analysis of all 14 admin tables verifying column headers match data sources.

  **Created:** `docs/design/TABLE_COLUMN_ANALYSIS.md` - Full analysis document

  **Discrepancies Fixed in TABLE_AUDIT.md:**
  - **Tasks List View**: Removed non-existent Checklist column (6→5 cols), fixed header "Title"→"Task", corrected column order (Due Date before Assignee)
  - **Project Files**: Fixed Actions from "Download + Delete" to "Preview (conditional) + Download"
  - **Project Invoices**: Fixed Actions from "View + Edit" to full list of 5 conditional buttons

  **Naming Inconsistency Documented:**
  - Document Requests uses "Due" while all other tables use "Due Date"

  **Verified All Tables Match:** Leads, Clients, Contacts, Projects, Invoices, Proposals, Time Tracking, Document Requests, KB Categories, KB Articles, Visitors

- [x] **Cross-Module Consistency Standardization (Feb 5, 2026)**: Standardized notification and variable naming patterns across all admin modules for consistency.

  **Notifications Standardized to `showToast()`:**
  - `admin-document-requests.ts`: Replaced all `alertSuccess()`/`alertError()` with `showToast()`
  - `admin-knowledge-base.ts`: Replaced all `alertSuccess()`/`alertError()`/`ctx.showNotification()` with `showToast()`
  - `admin-contacts.ts`: Replaced all `ctx.showNotification()`/`storedContext.showNotification()` with `showToast()`
  - `admin-clients.ts`: Replaced all `ctx.showNotification()`/`storedContext?.showNotification()` with `showToast()`

  **Variable Naming Standardized (removed prefixes):**
  - `admin-document-requests.ts`: `drFilterState` → `filterState`, `drPaginationState` → `paginationState`, `drFilterUIContainer` → `filterUIContainer`
  - `admin-knowledge-base.ts`: `kbFilterState` → `filterState`, `kbArticlesPaginationState` → `paginationState`, `kbFilterUIContainer` → `filterUIContainer`

  **Files Modified:**
  - `src/features/admin/modules/admin-document-requests.ts`
  - `src/features/admin/modules/admin-knowledge-base.ts`
  - `src/features/admin/modules/admin-contacts.ts`
  - `src/features/admin/modules/admin-clients.ts`

- [x] **Table Audit Column Order Reference (Feb 5, 2026)**: Added comprehensive "Column Order Reference (All Tables)" section to TABLE_AUDIT.md with numbered columns for all 14 tables showing exact left-to-right display order, header names, and data sources. Replaces the previous condensed text format with clear numbered tables for each: Leads, Clients, Contacts, Projects, Invoices, Proposals, Time Tracking, Document Requests, KB Categories, KB Articles, Visitors, Project Files, Project Invoices, and Tasks List View.

- [x] **Table Audit Documentation (Feb 5, 2026)**: Created and updated comprehensive `docs/design/TABLE_AUDIT.md` with all 18 tables. Added UI display names (e.g., "Intake Submissions", "Client Accounts", "Contact Form Submissions"), exact `<th>` header text, HTML source locations, TypeScript module paths, nav tab identifiers. Added 3 previously missing tables: Visitors (Analytics), Project Detail Files sub-table, Project Detail Invoices sub-table. Fixed column discrepancies in Proposals and Document Requests. Added Display Name Reference quick-lookup section and Table Header Quick Reference.

---

## Open Issues (active)

The items below are active and require immediate attention or follow-up testing.

- **Admin dashboard auth / dev-proxy wiring**: Frontend previously used absolute backend URLs for admin auth endpoints which bypassed the Vite `/api` proxy and caused HttpOnly cookie problems in development. `src/config/api.ts` was adjusted to use relative `/api/...` admin auth endpoints — verify in-browser admin login sets the `auth_token` cookie and that proxied requests include it.

- **Admin Dashboard Overview Stats Not Displaying (Feb 3, 2026)**: Active Projects, Clients, Revenue MTD, and Conversion Rate show "-" instead of actual counts.

  **Root Causes Identified & Fixed:**
  1. **admin-dashboard.ts** - Initial load and tab switch not calling overview module:
     - `loadDashboardData()` (initial load) only called `analyticsModule` - missing `overviewModule`
     - `switchTab('overview')` was only calling `analyticsModule.loadOverviewData()` (charts)
     - FIXED: Both now call `overviewModule.loadOverviewData()` for stats AND `analyticsModule.loadOverviewData()` for charts
  2. **admin-analytics.ts** - Invalid invoice status value (caused 400 error):
     - Called `/api/invoices/search?status=pending,overdue` but "pending" is not valid
     - Valid statuses: `draft, sent, viewed, partial, paid, overdue, cancelled`
     - FIXED: Changed to `/api/invoices/search?status=sent,overdue`
  3. **analytics-service.ts** - SQL column name mismatches:
     - Changed `paid_at` → `paid_date` (invoices table)
     - Changed `total_amount` → `amount_total` (invoices table)
     - Changed project status check `'in_progress'` → `'active', 'in-progress'`
  4. **admin-overview.ts** - API response parsing mismatches:
     - Leads API returns `{ success, leads, stats }` - frontend expected raw array
     - Clients API returns `{ clients }` - frontend expected raw array
     - Projects API returns `{ projects }` - frontend expected raw array
     - Messages unread API returns `{ unread_count }` - frontend expected `{ count }`
     - Project status filter used `'in_progress'` but DB uses `'in-progress'` (hyphenated)

  **Files Modified:**
  - `server/services/analytics-service.ts` - Fixed SQL column names
  - `src/features/admin/admin-dashboard.ts` - Fixed initial load AND tab switch to load both modules
  - `src/features/admin/modules/admin-analytics.ts` - Fixed invalid status value
  - `src/features/admin/modules/admin-overview.ts` - Fixed response parsing and status checks

  **Status:** ✅ FIXED - User Confirmed Working

- **Analytics Page KPI Cards Not Displaying (Feb 3, 2026)**: KPI cards (Revenue, Pipeline, Projects, Invoices) showing incorrect/empty values.

  **Root Cause:** Frontend expected different response format than backend returns.

  **Fixes in admin-analytics.ts:**
  1. **Revenue KPI**: Used `revenueData.summary.total_revenue` instead of `revenueData.currentMonth`
  2. **Pipeline KPI**: Used `pipelineData.summary.total_pipeline_value` and `total_leads` instead of `totalValue` and `activeLeads`
  3. **Projects KPI**: Used `projectsData.summary.active_projects` instead of `activeProjects`
  4. **Invoices KPI**: Used `inv.amount_total` (snake_case) instead of `inv.total`
  5. **Revenue Chart**: Used `result.data` with `total_revenue` field instead of `result.monthly` with `revenue` field
  6. **Project Status Chart**: Built chart from `summary.active_projects` and `completed_projects` instead of non-existent `byStatus` object

  **Status:** FIXED - Awaiting User Testing

- **Recent Activity Shows "No recent activity" (Feb 3, 2026)**: ~~Dashboard's Recent Activity section displaying "No recent activity" even when data should exist.~~

  **Root Cause (Final):** Two modules were writing to the same `recent-activity-list` element:
  - `admin-leads.ts` populated it with leads data
  - `admin-overview.ts` overwrote it with client activities (empty table)

  **Fix in src/features/admin/modules/admin-overview.ts:**
  - Changed `loadRecentActivity()` to fetch from `/api/admin/leads` instead of `/api/clients/activities/recent`
  - Now shows recent leads as the primary activity feed (matching intended dashboard behavior)

  **Status:** ✅ FIXED - User Confirmed Working

- **Invoices search (400)**: Dashboard reported `GET /api/invoices/search?status=sent,overdue` returned 400.

  **Root Cause:** Express route ordering issue. The `/:id` route was defined BEFORE `/search`, causing `/search` to match as `/:id` with `id="search"`. Then `parseInt("search")` returned NaN, triggering the 400 "Invalid invoice ID" error.

  **Fix in server/routes/invoices.ts:**
  - Moved `/search` route definition to BEFORE `/:id` route
  - Added comment explaining why route order matters

  **Status:** ✅ FIXED - User Confirmed Working

- **Sidebar counts (auth/500/403)**: `GET /api/admin/sidebar-counts` returned errors in the dashboard — verify admin auth/permission checks (`authenticateToken` / `requireAdmin`) and that DB queries (`visitor_sessions`, `general_messages`) handle empty or missing data gracefully.

- **Sidebar page order not intuitive (Feb 3, 2026)**: ✅ **FIXED (Feb 5, 2026)** — Reordered to logical grouping: DASHBOARD, LEADS, PROJECTS, CLIENTS, INVOICES, MESSAGES, DOCUMENTS, KNOWLEDGE, ANALYTICS, SYSTEM. Documents now above Analytics, Knowledge after Documents.

- **Reproduce & collect logs (developer steps)**:
  1. Start backend (`npm run dev:server`) and frontend (`npm run dev`).
  2. Login via dev proxy: POST `/api/auth/admin/login` (confirm `Set-Cookie: auth_token`).
  3. Call endpoints: `/api/analytics/quick/revenue?days=180`, `/api/invoices/search?status=pending,overdue`, `/api/admin/sidebar-counts` and save responses.
  4. Tail backend logs while reproducing and capture stack traces (`/tmp/nbc_server.log`).

- **Next action**: After reproducing, create minimal fixes: adjust param parsing/validation in route handlers, handle empty DB results safely, or align frontend request shapes. Add unit tests for parsing and a small E2E reproducer for the admin flow.

- **Documentation accuracy audit (Feb 2, 2026):** README, CONTRIBUTING, docs/README, CONFIGURATION, DEVELOPER_GUIDE, ARCHITECTURE, ADMIN_DASHBOARD, and related docs were checked against the codebase. Corrections: project structure (client pages, server routes/middleware/services), test structure and E2E command, login response (HttpOnly cookie, no token in body), BaseModule hooks (onInit/onDestroy), entry points (main-site.ts, portal.ts), admin modules list, archive 2026-02, CONFIGURATION routes.ts → api.ts, DEVELOPER_GUIDE email env vars (SMTP_*).
- **Deep documentation pass (Feb 2, 2026):** API_DOCUMENTATION: cookie path `/` (not `/api`), login/verify-magic-link response shape (`data.user` with camelCase fields), verify-invitation response `data: { email, name, company }`, set-password response and password rules (12 chars + complexity), refresh endpoint (returns token in body, does not set cookie), logout message "Logout successful". CONFIGURATION: FROM_EMAIL vs SMTP_FROM note, UPLOADS_DIR, pointer to server/config/environment.ts. SYSTEM_DOCUMENTATION: file upload implementation (sanitizeFilename, getUploadsSubdir, allowed types without JS/TS/HTML/CSS). DEVELOPER_GUIDE: clone URL fixed to noellebhaduri/no-bhad-codes.

---

## What's Next - Priority Order

### 1. USER TESTING REQUIRED (Blocking)

Before any new features, existing features need verification. The verification checklist below has ~60 items.

### 2. Front-End Polish (Non-blocking)

- [x] Button design audit - Already well-organized in `portal-buttons.css`
- [x] Badge design audit - Already well-organized in `portal-badges.css`
- [x] Recent activity on dashboard - Wired up to `/api/clients/activities/recent`
- [x] **Frontend-backend wiring review (Feb 2, 2026)** - Fixed 7 mismatches (admin overview revenue, admin files download/delete, admin clients reset-password, admin test-email/run-scheduler endpoints, client notes). Added full client notes backend (migration 046, client-service, clients routes).
- [ ] Time-sensitive tasks view

### 3. API Endpoints Without Frontend UI (Gap)

**Audit (Feb 2026):** Not all API route groups have a corresponding frontend UI. The following are backend-only (no `fetch`/`apiFetch`/`apiPost` etc. from `src/`):

|Route prefix|Purpose|Frontend usage|
|--------------|---------|----------------|
|`/api/approvals`|Approval workflow definitions, steps, instances|None|
|`/api/triggers`|Workflow trigger management|None|
|`/api/document-requests`|Document requests (client + admin), templates|**Client Documents tab** (my requests, view, upload); **Admin Document requests tab** (list, create, from templates, view detail, review/approve/reject/remind/delete)|
|`/api/kb`|Knowledge base categories, articles, search, admin CRUD|**Client Help tab + Admin KB tab**|

All other major route groups (auth, admin, clients, projects, messages, invoices, uploads, intake, proposals, analytics, contact) have at least one frontend interaction point.

**UI plan (design-aligned):** [docs/design/API_UI_PLAN.md](design/API_UI_PLAN.md) plans where each of these fits in the current design:

- **Approvals + Triggers** — Admin: new **Workflows** tab (sub-tabs Approvals | Triggers); table cards, create/edit modals; same patterns as Leads/Projects (`.admin-table-card`, `--portal-*` tokens, Lucide icons).
- **Document requests** — Admin: new **Document requests** tab (list, create/from template, review/approve). Client portal: new **Documents** tab (my requests, upload, status).
- **Knowledge base** — Admin: new **Knowledge base** tab (categories + articles CRUD). Client portal: new **Help** tab (featured, categories, search, article view).

Suggested implementation order: KB client Help → KB admin → Document requests client → Document requests admin → Workflows (Approvals + Triggers). **Admin Document requests tab implemented (Feb 2026).**

### 4. Remaining Expansion Items

**Tier 6 (Admin Tables):** ✅ COMPLETE

- [x] Export Per Table - CSV export with proper escaping
- [x] Pagination UI - Client-side with localStorage persistence
- [x] Bulk Archive/Delete - Bulk selection and actions toolbar

**Tier 8 (Integrations):**

- Webhooks
- Public API
- Third-Party Integrations

---

## Planned: API Versioning (`/api/v1/`)

**Goals:** Add versioned API prefix; keep `/api/` working for backward compatibility; prepare for future v2.

### Phase 1: Backend — Dual Mount (Non-Breaking) ✅ COMPLETE

- [x] Mount all routers under both `/api/` and `/api/v1/` (same handlers).
- [x] Centralize route registration (loop over routers, mount twice).
- [x] Update root `/` endpoint response to include v1 paths in `endpoints`.
- [x] Leave `/health` and `/api-docs` unversioned.

**Status:** Complete (Feb 2, 2026)

### Phase 2: Frontend — Centralized API Prefix

- Add `API_VERSION` / `API_PREFIX` in `src/config/api.ts` (e.g. `API_PREFIX = '/api/v1'`).
- Update `apiConfig.endpoints` to use `API_PREFIX`.
- Ensure `apiFetch` / `apiPost` / `apiPut` / `apiDelete` use prefix.
- Find-and-replace hardcoded `/api/` paths across features (admin, client portal, etc.).

**Effort:** 2–4 hours | **Risk:** Medium (requires testing)

### Phase 3: Documentation

- Update API_DOCUMENTATION.md: state `/api/v1/` as canonical; add Versioning section.
- Update CONFIGURATION.md and ARCHITECTURE.md with versioning notes.
- Add v1 base path to Swagger if applicable.
- Update relevant architecture docs to note API versioning.

**Effort:** ~1 hour | **Risk:** Low

### Phase 4 (Optional): Deprecation Path

- Add `X-API-Deprecated`, `X-API-Sunset` headers for unversioned `/api/` requests.
- Log deprecated usage; set sunset date; later remove `/api/` mounts.

**Effort:** 1–2 hours | **Risk:** Low if clients migrate; High if external clients remain

### Implementation Order

|Step|Task|
|------|------|
|1|Backend: mount all routers at `/api/` and `/api/v1/`|
|2|Update root endpoint response|
|3|Add `API_PREFIX` constant in frontend config|
|4|Update `apiFetch`/`apiPost` etc. to use prefix|
|5|Migrate direct `fetch('/api/...')` callers|
|6|Update API docs and Swagger|
|7|(Optional) Deprecation middleware|

### Files to Touch

- **Backend:** `server/app.ts`
- **Frontend:** `src/config/api.ts`, api-client/utils, all features with `/api/` calls
- **Docs:** API_DOCUMENTATION.md, ARCHITECTURE.md, current_work.md

---

## Planned: Full WCAG 2.1 AA Compliance

**Goal:** Full WCAG 2.1 Level AA compliance across main site, admin dashboard, and client portal.

**Already in place:** Skip link, focus trap (confirm/modal), some ARIA, focus states in UX guidelines, password view toggles.

### Phase 1: Audit

|Tool|Purpose|
|------|---------|
|**@axe-core/playwright**|Automated rules in E2E (images, labels, contrast, landmarks, roles)|
|**Lighthouse (Chrome DevTools)**|Accessibility audit for main site, admin, portal|
|**WAVE** (browser extension)|Visual feedback on issues|

**Pages to audit:** `/`, `/#about`, `/#contact`, `/#portfolio`, `/admin`, `/client/portal`, `/client/intake`, `/client/set-password`.

**Output:** Issue list by page with WCAG criterion (e.g. 1.1.1, 2.1.1), severity, fix guidance.

### Phase 2: Perceivable (WCAG 1.x)

|Criterion|Typical fixes|
|-----------|---------------|
|**1.1.1 Non-text content**|Alt text for images; decorative images `alt=""` or `aria-hidden`|
|**1.3.1 Info and relationships**|Semantic HTML; labels; `aria-describedby` for hints|
|**1.3.2 Meaningful sequence**|Logical DOM order; avoid layout-only tables|
|**1.4.1 Use of color**|Do not rely on color alone; add icons/text|
|**1.4.3 Contrast (minimum)**|4.5:1 text, 3:1 large text; fix low-contrast tokens|
|**1.4.4 Resize text**|Ensure 200% zoom works; avoid fixed px where it breaks layout|
|**1.4.10 Reflow**|No horizontal scroll at 320px|
|**1.4.12 Text spacing**|Support 200% line-height, letter/word spacing adjustments|

### Phase 3: Operable (WCAG 2.x)

|Criterion|Typical fixes|
|-----------|---------------|
|**2.1.1 Keyboard**|All actions keyboard-accessible; remove `tabindex="-1"` where it blocks|
|**2.1.2 No keyboard trap**|Focus trap only for modals; Escape exits|
|**2.2.1 Timing adjustable**|Pause/disable auto-advancing content|
|**2.4.1 Bypass blocks**|Skip link to main content (already present; verify on all pages)|
|**2.4.2 Page titled**|Unique `<title>` per page|
|**2.4.3 Focus order**|Logical tab order; `tabindex` only when necessary|
|**2.4.4 Link purpose**|Descriptive link text; avoid "click here"|
|**2.4.5 Multiple ways**|Sitemap/nav for multi-page flows|
|**2.4.6 Headings and labels**|Clear headings; form labels|
|**2.4.7 Focus visible**|Visible focus ring on all focusable elements|
|**2.5.3 Label in name**|Accessible name includes visible label|

### Phase 4: Understandable (WCAG 3.x)

|Criterion|Typical fixes|
|-----------|---------------|
|**3.1.1 Language of page**|`<html lang="en">` (already set)|
|**3.2.1 On focus**|No automatic context change on focus|
|**3.2.2 On input**|No auto-submit without explicit confirmation|
|**3.3.1 Error identification**|Clear error messages; associate with fields|
|**3.3.2 Labels or instructions**|Labels for all inputs; placeholders as hint, not label|
|**3.3.3 Error suggestion**|Suggest corrections where possible|

### Phase 5: Robust (WCAG 4.x)

|Criterion|Typical fixes|
|-----------|---------------|
|**4.1.1 Parsing**|Valid HTML; no duplicate IDs|
|**4.1.2 Name, role, value**|Custom controls have role/state; dynamic updates announced|
|**4.1.3 Status messages**|Use `role="status"` or `aria-live` for toasts/notifications|

### Phase 6: Screen reader and manual testing

- **VoiceOver (macOS)** and **NVDA (Windows)** on key flows
- Admin: login, switch tabs, open project detail, create invoice
- Portal: login, view project, upload file, send message
- Main: navigation, contact form, business card interactions

### Phase 7: Documentation and CI

- Update `docs/design/UX_GUIDELINES.md` with WCAG patterns
- Add `@axe-core/playwright` to E2E for critical pages
- Document findings and remediation in `docs/design/ACCESSIBILITY_AUDIT.md`

### Implementation order

|Step|Task|
|------|------|
|1|Install @axe-core/playwright; add axe check to admin-flow.spec.ts|
|2|Run Lighthouse on main site, admin, portal; document issues|
|3|Fix critical (Level A) violations first|
|4|Fix Level AA violations (contrast, focus, labels)|
|5|Screen reader manual pass on key flows|
|6|Add reduced-motion support if missing|
|7|Create ACCESSIBILITY_AUDIT.md; update UX_GUIDELINES|

### Files and areas to touch

- **HTML:** index.html, admin/index.html, client/portal.html, client/intake.html, client/set-password.html
- **Components:** confirm-dialog, modal, forms, buttons, tables, dropdowns, tabs
- **Styles:** focus states, contrast tokens, reduced-motion
- **Tests:** tests/e2e/*.spec.ts (axe integration)
- **Docs:** UX_GUIDELINES.md, new ACCESSIBILITY_AUDIT.md

### Effort and risk

**Effort:** 3–5 days (audit 0.5d, fixes 2–3d, testing 0.5–1d, docs 0.5d)  
**Risk:** Low for most items; medium if major reflows needed for zoom/reflow.

---

## Planned: Remaining System Gaps

### Frontend (6.1)

**Real-time updates (WebSockets/SSE)**

- **Goal:** Messages, notifications, or project updates without manual refresh.
- **Options:** (A) SSE for one-way server push (simpler); (B) WebSockets for bidirectional.
- **Phases:** 1) Add SSE endpoint (e.g. `/api/messages/stream`); 2) Client EventSource subscription; 3) Emit on new message/project update. Scope to messages first, then notifications.
- **Effort:** 1–2 days | **Risk:** Medium

**Offline/portal (PWA for client portal)**

- **Goal:** Client portal works offline or with poor connectivity.
- **Phases:** 1) Service worker for portal entry; 2) Cache critical assets; 3) Queue mutations (e.g. messages) when offline; 4) Sync when back online.
- **Effort:** 2–3 days | **Risk:** High (sync conflicts, stale data)

**A11y audit (full WCAG)** — See "Planned: Full WCAG 2.1 AA Compliance" below.

**E2E coverage (admin/portal flows)**

- **Goal:** Playwright tests for login → view project, create invoice, send message.
- **Status:** Admin login → view projects done (`tests/e2e/admin-flow.spec.ts`). Portal login → dashboard done (`tests/e2e/portal-flow.spec.ts`).
- **Phases:** 1) Admin login flow (done); 2) Client portal login + dashboard; 3) One CRUD flow each (e.g. project, invoice).
- **Effort:** 1–2 days | **Risk:** Low

**Visual regression**

- **Goal:** Detect UI drift with screenshot diffs.
- **Options:** Playwright screenshots + Percy/Chromatic, or custom diff job.
- **Phases:** 1) Baseline screenshots for key pages; 2) CI job to compare; 3) Review workflow.
- **Effort:** 0.5–1 day | **Risk:** Low

---

### Backend / API (6.2)

**API versioning** — See "Planned: API Versioning" above.

**Webhooks (outbound events)**

- **Goal:** Emit events (e.g. `project.created`, `invoice.sent`) to configured URLs.
- **Phases:** 1) Webhook config table (url, events, secret); 2) Event emitter service; 3) HTTP POST with retries; 4) Admin UI to manage webhooks.
- **Effort:** 2–3 days | **Risk:** Medium

**Public API keys (server-to-server)**

- **Goal:** API keys for external integrations (no browser/JWT).
- **Phases:** 1) `api_keys` table (key hash, scope, expiry); 2) Middleware: accept `X-API-Key` or `Authorization: Bearer <key>`; 3) Admin UI to create/revoke.
- **Effort:** 1–2 days | **Risk:** Medium (key management, scoping)

**Idempotency (Idempotency-Key)**

- **Goal:** Safe retries for POST/PUT/DELETE.
- **Phases:** 1) Middleware to read `Idempotency-Key` header; 2) Store response for key (TTL 24h); 3) Return cached response on replay.
- **Effort:** 0.5–1 day | **Risk:** Low

**Metrics (Prometheus /metrics)**

- **Goal:** Expose `/metrics` for Prometheus scraping.
- **Phases:** 1) Add `prom-client`; 2) Default metrics (heap, event loop); 3) Custom (request duration, error rate); 4) Route behind auth or allowlist.
- **Effort:** 0.5–1 day | **Risk:** Low

**2FA / SSO**

- **Goal:** TOTP for admin; optional SSO (Google, etc.).
- **Phases:** 1) `speakeasy` for TOTP; 2FA table; 2) Admin enable/disable; 3) SSO: OAuth flow + Passport or similar.
- **Effort:** 2–3 days (2FA), 3–5 days (SSO) | **Risk:** Medium

**Job queue (Redis/Bull vs cron)**

- **Goal:** Async jobs with retries (email, webhooks, PDF).
- **Phases:** 1) Redis + Bull if REDIS_ENABLED; 2) Queue email, webhook, heavy PDF jobs; 3) Fallback to in-process queue if no Redis.
- **Effort:** 2–3 days | **Risk:** Medium

---

### Build & Ops (6.3)

**Database backups (automated)**

- **Goal:** Scheduled SQLite backup to local/remote storage.
- **Phases:** 1) Backup script (copy or `sqlite3 .backup`); 2) Cron or scheduler job (daily); 3) Retention (e.g. 7 daily, 4 weekly); 4) Optional S3/cloud upload.
- **Effort:** 0.5–1 day | **Risk:** Low

---

### Design & Content (6.4)

**Design system docs (live component catalog)**

- **Goal:** Browsable component library with tokens and examples.
- **Options:** Storybook, or static HTML page with iframes.
- **Phases:** 1) Install Storybook (or build simple catalog page); 2) Add stories for buttons, badges, forms, cards; 3) Document tokens; 4) Deploy or add to dev script.
- **Effort:** 1–2 days | **Risk:** Low

**Content/SEO (CMS for marketing)**

- **Goal:** Edit marketing content without code deploys.
- **Options:** Headless CMS (Sanity, Contentful, Strapi) or simple admin-editable JSON/MD.
- **Phases:** 1) Content model for hero, about, FAQ; 2) Fetch at build or runtime; 3) Admin UI to edit; 4) Cache/invalidate.
- **Effort:** 2–4 days | **Risk:** Medium

---

## Front-End Concerns

### UX/UI Implementation Plan

#### Priority 1: Critical Accessibility Fixes

- [x] **Skip links missing** — Added skip link to `client/intake.html` and `client/set-password.html` targeting `#main-content` (Feb 3, 2026)
- [x] **Client portal breadcrumbs** — Updated `portal-navigation.ts` to update breadcrumbs dynamically when switching tabs (Feb 3, 2026)

#### Priority 2: Visual Hierarchy Corrections

- [x] **Admin Overview** — Already has H3 "Recent Activity" section heading (verified Feb 3, 2026)
- [x] **Analytics sub-tabs** — Added H3 tab-section-heading per sub-tab (Overview, Business, Visitors, Reports & Alerts) (Feb 3, 2026)
- [x] **Project/Client detail tabs** — Added H3 tab-section-heading at top of Files/Messages/Invoices/Tasks/Time/Contract tab panels (Feb 3, 2026). CSS added to `portal-tabs.css`.
- [x] **Modal titles** — Standardized all modal titles from H3 to H2; updated CSS selectors in `admin/modals.css` and `admin/files.css` (Feb 3, 2026)

#### Priority 3: Admin Messages Split-View

- [ ] **Left panel** — Client list (scrollable, selection state, unread indicators)
- [ ] **Right panel** — Thread + reply area
- [ ] **Mobile** — Single pane with list/thread swap
- [ ] **Optional** — Resizable divider, URL state (`?client=123`)
- [ ] **A11y** — Focus management, live region announcements

#### Priority 4: Empty State Consistency

- [x] **Shared component** — Empty-state component exists at `src/components/empty-state.ts` with `createEmptyState()` and `renderEmptyState()` functions; exported from `src/components/index.ts`. CSS in `project-detail.css`. (Feb 3, 2026)

#### Priority 5: Expert Decisions Required

- [x] **Sidebar button order** — ✅ FIXED: Admin sidebar reordered to DASHBOARD, LEADS, PROJECTS, CLIENTS, INVOICES, MESSAGES, DOCUMENTS, KNOWLEDGE, ANALYTICS, SYSTEM
- [ ] **Panel button placement** — Need "Panel button placement" guideline document
- [ ] **Badge redesign** — Need new visual system (not just color-dependent for WCAG 1.4.1)
- [ ] **Lead funnel styling** — Current styling looks off; needs redesign

#### Priority 6: WCAG Phase 1 Audit

- [ ] Run axe/Lighthouse/WAVE on: `/`, `/#about`, `/#contact`, `/#portfolio`, `/admin`, `/client/portal`, `/client/intake`, `/client/set-password`

---

### Client + Project Details Reorganization Plan

**Status:** Planning — needs implementation

**Goal:** Create a clear, consistent information architecture for detail views that scales and follows best practices.

#### Current State Analysis

**Client Detail View:**

- **Header:** Client name + Status badge + Account Actions card (Reset Password, Send Invitation, Archive, Delete)
- **Tabs:** Overview | Contacts | Activity | Projects | Invoices | Notes
- **Overview tab cards (7):** Client Overview, Quick Stats, Client Health, CRM Details, Billing Details, Tags, Custom Fields

**Project Detail View:**

- **Header:** Project name + Status dropdown + More menu (Edit, Delete)
- **Tabs:** Overview | Files | Messages | Invoices | Tasks | Time | Contract
- **Overview tab sections (4):** Project Overview Card, Progress, Milestones, Recent Activity

#### Issues Identified

|Issue|Location|Impact|
|-------|----------|--------|
|**Information overload**|Client Detail Overview (7 cards)|Cognitive load; hard to scan|
|**Account Actions buried**|Client Detail — in a card at bottom|Not discoverable; feels disconnected|
|**Inconsistent header actions**|Client vs Project|Client: card. Project: dropdown menu|
|**No clear primary action**|Both detail views|User doesn't know what to do first|
|**Cross-tab heading inconsistency**|Both views|Overview has H3s; other tabs often lack them|
|**Cards vs sections**|Client Detail|Everything in cards creates visual noise|

#### Proposed Reorganization

##### Client Detail View — New Structure

```text
HEADER ROW
├── Back button
├── Client Name (H1 or visible H2)
├── Status Badge
├── Quick Actions: [Send Invitation] [Archive] [...More]
│   └── More menu: Reset Password, Delete Client
└── [Edit Client] button

TABS: Overview | Contacts | Activity | Projects | Invoices | Notes

OVERVIEW TAB (reorganized — 4 sections max)
├── 1. At-a-Glance Card (merged Quick Stats + Health)
│   ├── Health Score (badge)
│   ├── Total Projects | Active | Completed
│   ├── Total Paid | Outstanding
│   └── [Recalculate Health] button
│
├── 2. Client Info Card (merged Overview + CRM)
│   ├── Contact: Email, Phone, Company
│   ├── CRM: Industry, Company Size, Source
│   ├── Follow-up: Last Contact, Next Follow-up
│   └── [Edit] icon button
│
├── 3. Billing Card (keep separate — different concern)
│   ├── Billing contact info
│   └── [Edit] icon button
│
└── 4. Tags + Custom Fields (collapsible or accordion)
    ├── Tags section with tag input
    └── Custom fields grid

CONTACTS TAB
├── H3 "Contacts" (visible heading)
├── Contact cards list
└── [Add Contact] button

ACTIVITY TAB
├── H3 "Activity Timeline"
├── Filter buttons (All | Notes | Emails | Calls | Meetings)
├── Timeline component
└── [Log Activity] button

PROJECTS TAB
├── H3 "Projects"
└── Project cards/list

INVOICES TAB
├── H3 "Invoices"
├── Summary row (Total Invoiced | Total Paid | Outstanding)
└── Invoice list

NOTES TAB
├── H3 "Notes"
├── Add note form
└── Notes list (pinned first)
```

##### Project Detail View — New Structure

```text
HEADER ROW
├── Back button
├── Project Name (H1 or visible H2)
├── Status Dropdown (inline, not in menu)
├── Quick Actions: [Send Message] [Upload File] [...More]
│   └── More menu: Edit Project, Request Signature, Delete
└── Progress indicator (small, inline)

TABS: Overview | Files | Messages | Invoices | Tasks | Time | Contract

OVERVIEW TAB (keep current structure — already good)
├── H3 "Project Overview" (implicit in card)
├── Project Overview Card (client, type, timeline, budget, URLs)
├── H3 "Progress"
├── Progress section
├── H3 "Milestones"
├── Milestones section + [Add Milestone]
├── H3 "Recent Activity"
└── Activity list

FILES TAB
├── H3 "Project Files"
├── Upload dropzone
├── Folder tree + file list
└── File detail modal (Info | Versions | Comments | Access)

MESSAGES TAB
├── H3 "Messages"
├── Thread display
└── Compose area

INVOICES TAB
├── H3 "Invoices"
├── Summary (Outstanding | Paid)
├── Invoice list
└── Actions: Create Invoice, Schedule, Setup Recurring

TASKS TAB
├── H3 "Tasks"
├── Task list or Kanban
└── [Add Task]

TIME TAB
├── H3 "Time Tracking"
├── Time entries list
├── Summary (Total Hours)
└── [Log Time]

CONTRACT TAB
├── H3 "Contract"
├── Status badge (Signed / Not Signed)
├── Preview/Download buttons
├── Signature details (if signed)
└── [Request Signature] button
```

#### Implementation Phases

**Phase 1: Header Actions Consistency**

- [ ] Move Account Actions from card to header row (client detail)
- [ ] Add quick action buttons to both headers
- [ ] Implement consistent "More" dropdown menu pattern
- [ ] Remove `.client-account-actions` card from Overview tab

**Phase 2: Information Consolidation (Client Detail)**

- [ ] Merge Quick Stats + Health into single "At-a-Glance" card
- [ ] Merge Client Overview + CRM Details into single "Client Info" card
- [ ] Make Tags + Custom Fields a collapsible section or move to separate tab
- [ ] Reduce Overview tab from 7 cards to 3-4

**Phase 3: Visual Hierarchy (Both Views)**

- [x] Add visible H3 to each tab panel (not just Overview) — Done in Priority 2 (Feb 3, 2026)
- [x] Ensure consistent heading hierarchy: H2 (page title) → H3 (section) — Done in Priority 2 (Feb 3, 2026)
- [ ] Add section dividers or spacing between logical groups

**Phase 4: Responsive + Mobile**

- [ ] Tab strips: horizontal scroll with fade indicators on mobile
- [ ] Header row: stack on narrow viewports
- [ ] Cards: full-width on mobile

**Phase 5: Cross-View Consistency**

- [ ] Standardize button placement pattern (header for primary, inline for secondary)
- [ ] Standardize empty states (icon + message + CTA)
- [ ] Standardize loading states

#### Files to Modify

- `admin/index.html` — HTML structure for client/project detail views
- `src/features/admin/modules/admin-client-details.ts` — Client detail logic
- `src/features/admin/admin-project-details.ts` — Project detail logic (see refactoring plan below)
- `src/styles/admin/client-detail.css` — Client detail styles
- `src/styles/admin/project-detail.css` — Project detail styles
- `src/styles/shared/details-card.css` — Shared detail card styles

---

### admin-project-details.ts Refactoring Plan

**Status:** ✅ COMPLETE (Feb 3, 2026) — Refactored into 10 modules under `src/features/admin/project-details/`. Main file reduced to ~800 lines.

**Problem (resolved):** `admin-project-details.ts` was 2,888 lines — too large to maintain.

#### Current Structure Analysis

|Section|Lines|Responsibility|
|---------|-------|----------------|
|DOM Cache setup|44-218|Element selectors configuration|
|Class core + populateProjectDetailView|237-569|Main class, detail view population|
|Tab navigation|570-787|Tab switching, module initialization|
|Status dropdown|788-871|Custom status dropdown|
|Edit modal|872-1009|Edit project modal + save|
|Messages|1010-1158|Thread loading, sending messages|
|Files|1159-1212|File list loading|
|Milestones|1213-1432|Milestones CRUD, progress bar|
|Project actions|1433-1565|Delete, archive, duplicate|
|**Invoices**|1566-2707|**1,141 lines** — all invoice operations|
|File upload|2709-2820|Upload handlers, validation|
|Utilities|2821-2888|Helper functions|

#### Proposed File Split

```text
src/features/admin/
├── admin-project-details.ts          (~400 lines) - Main class, core setup, tab navigation
├── project-details/
│   ├── index.ts                      - Re-exports all modules
│   ├── types.ts                      (~50 lines) - Interfaces and types
│   ├── dom-cache.ts                  (~180 lines) - DOM cache configuration
│   ├── messages.ts                   (~150 lines) - Messages functionality
│   ├── files.ts                      (~200 lines) - Files list + upload
│   ├── milestones.ts                 (~220 lines) - Milestones CRUD + progress
│   ├── invoices.ts                   (~600 lines) - Invoice CRUD + display
│   ├── invoice-scheduling.ts         (~300 lines) - Scheduled + recurring invoices
│   ├── invoice-actions.ts            (~250 lines) - Send, remind, late fees, payments
│   └── actions.ts                    (~300 lines) - Delete, archive, duplicate, edit
```

#### Module Dependencies

```text
admin-project-details.ts
├── imports from project-details/dom-cache.ts
├── imports from project-details/types.ts
├── delegates to project-details/messages.ts
├── delegates to project-details/files.ts
├── delegates to project-details/milestones.ts
├── delegates to project-details/invoices.ts (which imports invoice-scheduling, invoice-actions)
└── delegates to project-details/actions.ts
```

#### Implementation Phases

**Phase 1: Extract Types + DOM Cache**

- [x] Create `project-details/types.ts` — move interfaces
- [x] Create `project-details/dom-cache.ts` — move DOM cache setup
- [x] Update imports in main file

**Phase 2: Extract Messages + Files**

- [x] Create `project-details/messages.ts` — extract `loadProjectMessages`, `sendProjectMessage`
- [x] Create `project-details/files.ts` — extract file loading + upload handlers
- [x] Pass context/callbacks as parameters or use dependency injection

**Phase 3: Extract Milestones**

- [x] Create `project-details/milestones.ts` — extract all milestone methods
- [x] Export `loadProjectMilestones`, `toggleMilestone`, `deleteMilestone`, etc.

**Phase 4: Extract Invoices (largest section)**

- [x] Create `project-details/invoices.ts` — core invoice loading + display
- [x] Create `project-details/invoice-scheduling.ts` — scheduled + recurring
- [x] Create `project-details/invoice-actions.ts` — send, remind, payments, late fees
- [x] Wire up re-exports in `invoices.ts`

**Phase 5: Extract Project Actions**

- [x] Create `project-details/actions.ts` — delete, archive, duplicate, edit modal
- [x] Move contract signing logic here or to own file

**Phase 6: Clean Up Main File**

- [x] Main class becomes orchestrator only
- [x] Tab switching delegates to sub-modules
- [x] Remove dead code and unused imports
- [x] Verify all functionality still works

#### Pattern: Module Context

Each sub-module receives a context object:

```typescript
interface ProjectDetailsContext {
  projectId: number;
  project: ProjectResponse;
  showNotification: (msg: string, type: string) => void;
  refreshData: () => Promise<void>;
  switchTab: (tab: string) => void;
}

// Example usage in messages.ts
export async function loadProjectMessages(ctx: ProjectDetailsContext): Promise<void> {
  // ...
}
```

#### Acceptance Criteria

- [x] Main file under 500 lines
- [x] Each sub-module has single responsibility
- [x] No circular dependencies
- [x] All existing functionality preserved
- [x] TypeScript compiles without errors
- [x] Manual testing passes for all tabs

---

#### Acceptance Criteria

- [ ] Client detail header has inline quick actions (no buried card)
- [ ] Client Overview tab has max 4 cards (consolidated)
- [x] All tabs have visible H3 headings — Done in Priority 2 (Feb 3, 2026)
- [ ] Tab strips scroll on mobile
- [ ] Empty states are consistent across both views
- [x] No visual hierarchy skips (H2 → H3 only) — Done in Priority 2 (Feb 3, 2026)

---

### Questions for UX/UI Expert (Remaining)

Items that still need expert input:

- **Sidebar button order** — Current: Dashboard | Leads | Projects | Clients | Messages | Analytics | Knowledge | Documents | System. Recommend reordering based on frequency/workflow.
- **Panel button placement guideline** — Document pattern for all panels (header vs footer vs inline).
- **Badge redesign** — Need visual system that doesn't rely solely on color (WCAG 1.4.1).

### Admin Table Dropdowns (Feb 2, 2026)

Documented concerns and resolutions for table dropdowns (status, pagination per-page) in admin tables.

- [x] **Focus state (closed trigger)** — Focus ring on the closed trigger did not align with the open menu (outline/shadow from global styles). **Fix:** Suppress outline and box-shadow on `.table-dropdown .custom-dropdown-trigger:focus` / `:focus-visible` with `!important`; use 2px red border only (portal-dropdown.css + admin.css). Menu border set to 2px to match.
- [x] **Closed vs open width** — Closed trigger was narrower than the open menu. **Fix:** Trigger uses `width: 100%` from shared styles (no `width: auto` / `min-width: 80px` in admin); wrapper has `min-width: 100px` so trigger and menu share same width.
- [x] **Trigger padding (caret)** — Equal left/right padding around trigger content; caret not cramped. **Fix:** Trigger padding `var(--space-2) var(--space-3)` in shared and admin; pagination dropdown uses same.
- [x] **Status dropdown text alignment** — Trigger label (e.g. "Pending") did not align with menu item text when open. **Fix:** Status dropdowns only (trigger has `.status-dot`): `padding-left: 0` so dot (8px) + gap (space-2) = 24px = menu `padding-left` (space-3). Scoped with `.custom-dropdown-trigger:has(.status-dot)` in admin.css and portal-dropdown.css. Pagination dropdown (no dot) keeps normal left padding.
- [x] **Why triggers are `<button>`** — Table dropdown triggers are `<button type="button">` for semantics and accessibility (focusable, keyboard, screen readers); they are not styled as `.btn` and use `.custom-dropdown-trigger` for compact dropdown appearance.
- [x] **Focus state (all table dropdowns)** — Closed trigger focus ring did not match open menu (contacts/leads/projects). **Fix:** Use border-only focus (no outline) in admin.css so closed trigger size matches open menu.
- [x] **Bottom-most dropdown cut off** — Last-row status dropdown was clipped by container. **Fix:** Flip-up behavior in table-dropdown.ts (open menu above trigger when insufficient space below); CSS for `.table-dropdown.dropdown-open-up.open` in admin.css.

### Details Panels (Leads / Contacts) — Resolved

- [x] **Lead score badge not visible** — Badge in panel header used undefined `--status-active` and low-contrast tint. **Fix:** Solid backgrounds and high-contrast text in leads-pipeline.css (score-hot: green + white; score-warm: amber + dark; score-cold: light gray + light text).
- [x] **Panel header too low** — Details header had too much top padding. **Fix:** `.details-panel` padding changed to `var(--space-4)` top, `var(--space-6)` sides/bottom in project-detail.css.
- [x] **Icon buttons in panels** — Contact/lead panel actions (Reply, Convert, Archive/Restore, Activate, Add Task, Add Note) now use `.icon-btn` only (no `.btn`/`.btn-primary`/`.btn-secondary`) so they match portal icon button styling (36×36, transparent, light icon, red on hover).
- [x] **Icon button tooltips** — Activate, Add Task, Add Note buttons given `title` and `aria-label`; ROCKET and PLUS icons used where appropriate.

### Portal styling (user feedback)

**Capture everything you don't like here; implement when ready.**

**Complete list (every concern — open and done):**  
Message input when disabled | Analytics section headers | Messages search bar | Sidebar button labels too long | "KB" name | Custom checkboxes (reusable, darkest grey) | Shorter date display | Table size when check off | Bulk selection count alignment | Toggle better design | Client table: email under name + company | Name/company/email one column in most tables | Account Actions buttons placement | System tab: caret alignment + padding (reusable details-card) | System tab label "System" not "Status" | Tab styling reusable component (sub-tabs) | Table column order consistency | Analytics page layout (sub-tabs) | **All modals: icon and H3 on same line** | All modal forms use reusable dropdown component | Analytics tab should use reusable components | Table headers get cut off.

- [x] **Message input when disabled** — **Fixed (Feb 3, 2026):** `portal-messages.css` — `.message-compose textarea:disabled` now has `opacity: 1; background-color: var(--portal-bg-medium);` to override the portal-forms.css disabled styles. Only the send button shows disabled state.
- [x] **Analytics page section headers** — Resolved by sub-tabs redesign. Floating headers removed; content now organized into focused sub-tabs.
- [x] **Messages search bar** — Wanted thin border and lighter background. **Fixed:** portal-messages.css: `.messages-search .search-bar-input` — `background: var(--portal-bg-medium)`, `border: 1px solid var(--portal-border-light)`.
- [x] **Sidebar button labels too long** — "KNOWLEDGE BASE" and "DOCUMENT REQUESTS" longer than readable. **Fixed:** admin/index.html — labels shortened to "KB" and "Documents"; aria-labels kept full for a11y. (User later said "KB" is a stupid name — see below.)
- [x] **"KB" is a stupid name** — **Fixed:** Sidebar label already shows "Knowledge" in admin/index.html (verified Feb 3, 2026).
- [x] **Custom checkboxes same size as system** — `.portal-checkbox` (e.g. bulk-select) should be custom-styled but same size as system checkboxes; reusable component with darkest grey bg. **Fixed:** portal-forms.css — shared `.portal-checkbox` 16×16px, bg `var(--portal-bg-darker)`; src/components/portal-checkbox.ts `getPortalCheckboxHTML()`; table-bulk-actions and table-filter use it.
- [x] **Shorter date display** — Dates too long. **Fixed:** format-utils.ts — `formatDate` shows "Jan 28" for current year, "Jan 28, 26" otherwise; `formatDateTime` same logic with time.
- [x] **Table size when check off** — Table should not change size when checking/unchecking rows. **Fixed:** table-features.css — bulk toolbar when `.hidden` uses `visibility: hidden; opacity: 0; pointer-events: none` (not `display: none`) and keeps `min-height: 48px` and margin so space is reserved.
- [x] **Bulk selection count alignment** — "X selected" number should align with the checkbox column. **Fixed:** table-features.css — bulk toolbar uses grid `44px 1fr auto`; `.bulk-toolbar-left` in column 1 so count aligns with table checkbox column; `.bulk-toolbar-actions` in column 3.
- [ ] **Toggle needs better design** — View toggle (e.g. Table/Pipeline, list/card) needs improved styling/UX.
- [ ] **NEW and ON-HOLD status colors are the same** — Both statuses use the same color (`--color-status-pending`), making them indistinguishable. NEW should have a distinct color (currently uses `--color-status-new` only in some places, but ON-HOLD also uses pending color). Review and differentiate these status colors.
- [x] **Client account table: email under name, company name** — **Already done:** Clients table uses `.identity-cell` with stacked `.identity-name`, `.identity-email`, `.identity-company` spans. (Verified Feb 3, 2026)
- [x] **Name, company, email as one column in most tables** — **Already done:** All admin tables (clients, leads, contacts) use the `.identity-cell` pattern with name/email/company stacked in a single column. (Verified Feb 3, 2026)
- [ ] **Account Actions buttons need better placement** — Client detail "Account Actions" (Reset Password, Send Invitation, Archive, Delete Client) are in a `.portal-project-card` and feel disconnected. Need to incorporate these buttons better — e.g. icon buttons in the overview at page top (client name/header area) instead of or in addition to the current card. Selectors: `#cd-btn-reset-password`, `#cd-btn-resend-invite`, `#cd-btn-archive`, `#cd-btn-delete`; container `.client-account-actions`.
- [x] **System tab: fix caret alignment and padding in details** — System tab `<details class="portal-project-card system-details">` cards had caret alignment and inconsistent child padding. **Fixed:** Reusable component in `src/styles/shared/details-card.css`: caret aligned with summary (flex, align-items center, flex-shrink 0 on ::before); summary and child grid use consistent padding (var(--space-4) on summary, 0 var(--space-4) var(--space-4) on .system-info-grid); .system-info-row has uniform padding. Classes .details-card / .details-card-grid / .details-card-row are aliased so .system-details / .system-info-grid / .system-info-row work unchanged. Duplicate styles removed from analytics.css, admin.css, project-detail.css.
- [x] **System tab label: use "System" not "Status"** — Sidebar button for the System tab showed "Status"; user prefers "System". **Fixed:** admin/index.html — `#btn-system` `.btn-text` now "System"; aria-label remains "System Status".
- [x] **Tab styling reusable component** — Analytics sub-tabs (Overview | Business | Visitors | Reports & Alerts) styling is now a reusable component. **Fixed:** `src/styles/shared/portal-tabs.css` — added `.portal-subtabs` / `.portal-subtab` / `.portal-subtab-content` with same look (horizontal strip, border-bottom, pill buttons, active state). Same styles apply to `.analytics-subtabs` / `.analytics-subtab` so existing HTML/JS unchanged. Use `.portal-subtabs` and `.portal-subtab` for any in-page sub-tab strip. Responsive (wrap, min-width) in same file.
- [x] **Table column order consistency** — Tables should follow predictable patterns; date/name/company/email columns were in different order. **Fixed:** Standardized across admin tables (see Tables section below).
- [x] **Analytics page layout** — Better way to present and organize analytics. **Fixed:** Sub-tabs Overview | Business | Visitors | Reports & Alerts (see Analytics section below).
- [x] **All modals: icon and H3 on same line** — **Fixed (Feb 3, 2026):** `confirm-dialog-header` already has `display: flex; align-items: center;`. Fixed `multiPromptDialog` in `confirm-dialog.ts` which was missing the `.confirm-dialog-header` wrapper around icon and title.
- [ ] **All modal forms: use reusable dropdown component** — Every modal form that has a select/dropdown (e.g. Metric, Condition, status picks) should use the shared reusable dropdown component (e.g. portal dropdown / table-dropdown pattern or form-select) instead of native `<select>` or ad-hoc markup, for consistent look and behavior across modals.
- [x] **Dropdown focus state — standardized** — **Fixed (Feb 5, 2026):** All dropdowns now use the same focus pattern as `<details>` cards: `outline: 2px solid var(--color-primary); outline-offset: -2px;`. Inner triggers have their focus rings suppressed (same pattern as summary focus suppression). Updated in `reset.css`: `.custom-dropdown.open:focus-within`, `.table-dropdown.open:focus-within`, `.export-dropdown.open:focus-within`. Consistent with `details-card.css` focus pattern.
- [ ] **Dropdown focus visual limitation** — When dropdowns are open, the focus ring wraps the trigger element via `:focus-within`, but dropdown menus are positioned outside wrapper bounds (fixed/absolute positioning). This means the focus ring can't visually wrap trigger + menu as one unified box. Current implementation is consistent and accessible — the focus ring on the trigger is visible when any element inside the dropdown has focus. May revisit if a visual design change is requested (would require restructuring dropdown to keep menu inside wrapper bounds, or JS to apply focus class to both elements).
- [ ] **Analytics tab: use reusable components** — The Analytics tab (Overview, Business, Visitors, Reports & Alerts) should use shared reusable components (e.g. cards, buttons, dropdowns, sub-tabs, KPI/stat cards, charts wrapper) instead of analytics-only markup and styles, so the tab matches the rest of the portal and stays maintainable.
- [ ] **Analytics page label inconsistency** — Section headings on Analytics page are inconsistently styled. "SAVED REPORTS", "SCHEDULED REPORTS", "METRIC ALERTS" use bold heading style, but "CORE WEB VITALS" and "BUNDLE ANALYSIS" use smaller field-label style. All section headings should use consistent typography.
- [ ] **Non-passive event listeners** — Console shows "[Violation] Added non-passive event listener to a scroll-blocking event". Event listeners for `touchstart`, `touchmove`, `wheel` etc. should use `{ passive: true }` option when they don't call `preventDefault()`. Improves scroll performance. Need to audit: GSAP animations, carousel, dropdown handlers, modal scroll handlers.

### Details/Summary focus state — deep dive & implementation plan

**Reference pattern:** `<details class="portal-project-card portal-shadow system-details">` (System tab Build Information card).

#### How focus currently works

The focus system has three layers:

1. **Global (`reset.css:203-240`):** `:focus { outline: none }` removes all default outlines. `:focus-visible { box-shadow: 0 0 0 2px var(--color-primary) }` adds a 2px ring on keyboard focus. `details:focus-within` wraps the entire `<details>` element in the ring. `details > summary:focus-visible { box-shadow: none }` suppresses the summary's own ring so only the outer card ring shows.

2. **Details-card (`details-card.css:109-121`):** Same `:focus-within` / `:focus-visible` pattern scoped to `[data-page="admin"]` / `[data-page="client-portal"]` for `.details-card` and `.system-details`. Also covers `details.portal-project-card > summary:focus-visible`.

3. **No JavaScript:** Toggle behavior is fully native `<details>`. Caret rotation uses CSS `[open] summary::before { transform: rotate(90deg) }`. No JS event listeners for focus or toggle.

#### Bugs found and fixed

1. **Focus ring replaces card shadow** — When `:focus-within` fired with `box-shadow`, it REPLACED the card's existing `box-shadow: var(--shadow-panel)`. CSS `box-shadow` is a single property — a later declaration wins, it does not stack. **Fixed (Feb 5, 2026):** Changed from `box-shadow` to `outline: 2px solid var(--color-primary); outline-offset: -2px;`. Outline doesn't interfere with box-shadow at all — card keeps depth shadow AND shows focus ring.

2. **Redundant rules between reset.css and details-card.css** — The global `details:focus-within` in reset.css and the scoped `.system-details:focus-within` in details-card.css now both use outline. The scoped version is more specific for portal pages. Global rule remains for any non-portal pages that might use `<details>`.

#### Current `<details>` usage (3 instances, all admin)

| Location | Line | Classes | Summary heading |
|---|---|---|---|
| `admin/index.html` | 527 | `portal-project-card portal-shadow system-details leads-analytics-section` | Lead Analytics & Scoring |
| `admin/index.html` | 1728 | `portal-project-card portal-shadow system-details` | Build Information |
| `admin/index.html` | 1747 | `portal-project-card portal-shadow system-details` | Browser Information |

**Not using `<details>` but could:** No client portal pages use `<details>`. System tab has 3 non-collapsible `portal-project-card` divs (Health Check, Quick Actions, Recent Errors) that could be candidates if collapsible behavior is desired.

#### Implementation plan

- [x] **Phase 1: Fix shadow stacking bug** — **Complete (Feb 5, 2026)**

  - Changed from `box-shadow` to `outline: 2px solid var(--color-primary); outline-offset: -2px;`
  - Updated `src/styles/shared/details-card.css` `:focus-within` rules
  - Updated `src/styles/base/reset.css` global `details:focus-within`
  - Outline doesn't interfere with box-shadow — card keeps depth shadow AND shows focus ring
  - **Also applied to all dropdowns:** `.custom-dropdown`, `.table-dropdown`, `.export-dropdown` in reset.css

- [ ] **Phase 2: Deduplicate focus rules**

  - Evaluate removing global `details:focus-within` from reset.css if only portal pages use `<details>`
  - If kept, both global and scoped rules use the same outline value (already consistent)
  - Document the relationship between reset.css and details-card.css focus rules

- [ ] **Phase 3: Audit portal for `<details>` expansion candidates**

  - Review non-collapsible `portal-project-card` sections that would benefit from collapse
  - Candidates: System tab Health Check, Quick Actions, Recent Errors; any long content cards
  - Conversion pattern: change `<div class="portal-project-card">` to `<details class="portal-project-card portal-shadow system-details">`, wrap heading in `<summary>`, wrap content in grid div
  - Client portal: evaluate if any sections should be collapsible

- [ ] **Phase 4: Verify keyboard navigation flow**

  - Tab through all `<details>` elements, verify: focus ring wraps card (not summary), card shadow persists, caret rotates on Enter/Space, content expands, focus moves to inner interactive elements
  - Test with screen reader (VoiceOver): verify details state announced ("collapsed"/"expanded")
- [ ] **Analytics Business tab: Conversion Funnel + Lead Sources + Lead Scoring Rules broken** — Multiple components have data and layout issues. **Conversion Funnel:** bars are tiny (10% width), stacked vertically with labels crammed inside small red bars, counts overlapping. Layout is strange — should be proper horizontal bars that decrease in width top-to-bottom like an actual funnel, not small centered blocks. All show 0 counts and 100% (placeholder data). **Lead Sources:** shows "undefined leads", "undefined won", 0%, and empty source names — data binding is completely broken. **Lead Scoring Rules:** layout and styling need improvement. All three need: fix data binding, proper empty states, and a complete layout rethink.
- [x] **Table column headings should use field-label styling** — **Fixed (Feb 5, 2026):** Updated `.admin-table th` in `admin.css` to use `0.75rem` font-size, `var(--portal-text-secondary)` color, and `font-weight: 500` (matching field-label pattern). Removed mobile `font-size` override that was resetting the value. Updated project-detail files/invoices `th` font-weight from `600` to `500` for consistency.
- [x] **Table headers get cut off** — In some admin tables (e.g. contacts table `.admin-table.contacts-table`), the thead/th content (column labels and sort icons) gets cut off. **Fixed:** admin.css — `.admin-table-container` set to `overflow: visible`; new inner `.admin-table-scroll-wrapper` with `overflow-x: auto` and `overflow-y: visible` so horizontal scroll doesn’t create a scroll container that clips the header. Added `min-height: 48px` and `vertical-align: middle` on `.admin-table thead th`, and `min-height: 48px` on `.admin-table thead tr`. All 8 admin table containers in admin/index.html now wrap the table in `.admin-table-scroll-wrapper`. `.visitors-table-container` overflow changed from `hidden` to `visible`. Mobile scroll-indicator styles updated to target the scroll wrapper.

### Tables — predictable column patterns

- [x] **Table column order consistency** — Standardized table column order across admin tables following pattern: ☐ | Name (+Context) | Type | Amount | Status | Date | Actions. Updated admin/index.html headers and TypeScript renderers for: Leads (Name+Company | Email | Type | Budget | Status | Date | Actions), Projects (Project+Client | Type | Budget | Timeline | Status | Start | Actions), Clients (Client | Email | Type | Projects | Status | Created | Actions), Proposals (Client | Project | Tier | Price | Status | Date | Actions), Contacts (Name | Email | Company | Message | Status | Date), Document Requests (Title | Client | Type | Status | Due | Actions). Added missing features: Proposals (bulk select, search, export), Document Requests (bulk select, search, export), Knowledge Base (search, export).

### Analytics page — presentation and organization

- [x] **Rethink analytics page layout** — Implemented sub-tabs: Overview | Business | Visitors | Reports & Alerts. Content organized by purpose. See [docs/design/ANALYTICS_UI.md](design/ANALYTICS_UI.md).

### Main Site (Portfolio)

- [ ] **Projects section** — Code complete, needs assets only
  - [ ] CRT TV title cards for each project
  - [ ] Project screenshots
  - [ ] OG images for social (1200x630 PNG)
- [x] **SEO optimization** — Complete (meta tags, JSON-LD, robots.txt, sitemap)

### THE BACKEND (Admin + Client Portal)

#### General

- [x] Sidebar — Collapsed style
- [x] Tabs — Shared component
- [x] **Button design** — Audit for consistency (audit done; implementation consistent)
- [ ] **Badges** — Redesign for clarity (usage audit done; redesign not started)

#### Detail Views Redesign (Client + Project Details)

**Status:** In progress — layout baseline done; UX polish and verification pending.

**Scope**

- **Client detail:** `#tab-client-detail` (admin), header + tabs (Overview | Contacts | Activity | Projects | Invoices | Notes), overview card, Account Actions, CRM/Custom Fields, contacts, activity, projects, invoices, notes.
- **Project detail:** Project detail view (header + tabs: Overview | Files | Messages | Invoices | Tasks | Time | Contract), overview card, status, tasks, time, contract, etc.
- **Key files:** `admin/index.html`, `src/features/admin/modules/admin-client-details.ts`, `src/features/admin/admin-project-details.ts`, `src/styles/admin/client-detail.css`, `src/styles/admin/project-detail.css`, shared `portal-tabs.css` / `portal-project-card` patterns.

---

**Completed (layout baseline)**

- [x] **Issue 1: Overview Card position** — Overview Card is already inside the Overview tab. Structure: Header → Tabs → Tab panels; `#cd-tab-overview` and `#pd-tab-overview` each contain the Overview Card as first content. No HTML change needed.
- [x] **Issue 2: Visual hierarchy / bold values** — `.meta-value` is already `font-weight: 400` in `project-detail.css` (`.project-detail-overview .meta-value` and root `.meta-value`). No change needed.

---

**Remaining work (phased)**

**Phase 1 — UX/layout polish**

- [ ] **Account Actions placement** (client detail) — Move or duplicate Reset Password, Send Invitation, Archive, Delete into the page header (e.g. icon buttons next to client name) so they feel connected to the context. See portal styling: "Account Actions buttons need better placement". Selectors: `#cd-btn-reset-password`, `#cd-btn-resend-invite`, `#cd-btn-archive`, `#cd-btn-delete`; container `.client-account-actions`.
- [ ] **Tabs responsive** — Project and client detail tab strips need overflow/scroll or wrap on small viewports so all tabs are reachable. See "Tabs not responsive" in Admin Portal list. Use or extend shared `.portal-tabs` / `.portal-subtabs` responsive behavior (e.g. horizontal scroll with fade, or wrap).
- [ ] **Button icons in panels** — Improve placement of action buttons in detail panels (e.g. lead/contact panels: Activate, Add Task, Add Note, Reply, Convert, Archive/Restore). See "Button icons in panels" in Admin Portal list.

**Phase 2 — Verification (behavior)**

- Verification checklist items for **Clients** and **Projects** (see Verification Checklist below) must pass: CRM Details, Custom Fields, contacts, activity, invite icon, status dropdown, tasks, time, contract, delete, etc. One checkbox per verifiable piece; check off when confirmed in testing.

**Acceptance (summary)**

- Client detail: Overview, Contacts, Activity, Projects, Invoices, Notes tabs work; CRM/Custom Fields display and edit; invite icon works; Account Actions (reset password, resend invite, archive, delete) work and are discoverable.
- Project detail: Overview, Files, Messages, Invoices, Tasks, Time, Contract tabs work; status dropdown saves; invite icon works; tasks and time entries work; contract preview/sign/status/signature details work; Delete button works.
- Both: Tabs usable on mobile (scroll or wrap); no clipped header or overview; consistent use of shared components (cards, tabs, buttons).

**Reference:** Full verification items → **Verification Checklist** below: **Clients** (Health, tags, CRM, Custom Fields, contacts, activity, invite, convert) and **Projects** (status dropdown, invite, tasks, time, templates, delete, contract tab).

#### Dashboard Overhaul

**Status:** Plan ready — layout choice needed; then implement in phases.

**Scope**

- **Admin Overview tab:** `#tab-overview` (first tab when admin opens the app). Currently: **Today's Snapshot** (4 stat cards: Active Projects, Clients, Revenue MTD, Conversion Rate — clickable to filter/navigate), then **Recent Activity** (list from `/api/clients/activities/recent?limit=10`, rendered in `admin-overview.ts`).
- **Key files:** `admin/index.html` (Overview tab markup), `src/features/admin/modules/admin-overview.ts` (load and render stats + Recent Activity), `src/components/recent-activity.ts`, `src/styles/pages/admin.css` (dashboard section styles), shared `portal-cards.css` (stat cards, recent-activity).

---

**Current state vs gaps**

|Area|Current|Gap|
|------|---------|-----|
|Priority / actionable|None|No "Needs Attention" block (overdue invoices, pending contracts, new leads, unread messages).|
|Stats|Today's Snapshot (4 cards)|Disconnected from a single "business health" story; no outstanding AR or pipeline summary on Overview.|
|Weekly Overview|(N/A on Overview)|Analytics tab has its own overview; avoid duplicating that on dashboard.|
|Business health|Revenue MTD in snapshot|No dedicated business-health strip (revenue + AR + active projects together).|
|Recent Activity|Wired to API, list only|No filtering, grouping, or "view all" context.|

---

**Layout options (choose one to proceed)**

**Option A: Priority-First** — Focus on what needs attention NOW

```text
NEEDS ATTENTION: [Overdue Invoices] [Pending Contracts] [New Leads] [Unread Messages]
TODAY'S SNAPSHOT: [Active Projects] [Clients] [Revenue MTD]
RECENT ACTIVITY: (list)
```

**Option B: Business Health** — Focus on high-level metrics

```text
BUSINESS HEALTH: [Revenue MTD] [Outstanding AR] [Active Projects]
PIPELINE + TASKS DUE: (side by side)
RECENT ACTIVITY: (list)
```

**Option C: Three-Column** — Balance actionable + metrics + activity

```text
NEEDS ATTENTION | KEY METRICS | RECENT ACTIVITY
(vertical list) | (big numbers) | (scrollable)
```

---

**Phased implementation**

**Phase 0 — Decision**

- [ ] **Choose layout** — Pick Option A, B, or C (or a hybrid). Document choice in this section or in a short design note.

**Phase 1 — Needs Attention / time-sensitive (if in chosen layout)**

- [ ] **API** — Endpoints or reuse of existing APIs for: overdue invoices count, pending contracts (e.g. unsigned), new/unread leads count, unread messages count. Aggregate into a single "needs attention" payload or separate calls.
- [ ] **UI** — "Needs Attention" block on Overview: card(s) or buttons linking to Invoices, Contracts, Leads, Messages with counts. Reuse `.stat-card` or similar; place per chosen layout.

**Phase 2 — Layout restructure (if Option B or C)**

- [ ] **Reorder/section** — Add Business Health row (Option B) or Key Metrics column (Option C). Reuse or extend Today's Snapshot stats; add Outstanding AR, Active Projects if not already there.
- [ ] **Responsive** — Ensure dashboard sections stack or reflow on small viewports (existing grid breakpoints in admin.css).

**Phase 3 — Recent Activity polish**

- [ ] **Filtering/grouping** — Optional: filter by type (invoice, lead, message, etc.) or group by date/entity. Depends on API support and product priority.
- [ ] **"View all" / link** — Optional: link to a full activity view or to relevant tab (e.g. Leads, Messaging).

**Phase 4 — Verification**

- [ ] **Dashboard modal** — Focus trapped inside when dashboard modal is open (see Verification Checklist → Modals & Toasts).
- [ ] **Stats** — Today's Snapshot numbers match source tabs; click-through works. Recent Activity loads and displays without errors.

---

**Acceptance (summary)**

- Overview tab reflects chosen layout (A, B, or C).
- If "Needs Attention" is in the choice: counts and links work; data comes from existing or new API as needed.
- Business health / key metrics (if in choice) show revenue, AR, and projects in one place.
- Recent Activity continues to load from `/api/clients/activities/recent`; optional filter/group/link added if scoped.
- Mobile/responsive: sections readable and usable; no regressions on existing stat cards or activity list.

**Reference:** "Recent activity" and "Time-sensitive tasks" in Admin Portal list; Verification Checklist → Modals & Toasts (dashboard modal focus trap). Optional external plan path may vary (e.g. `.claude/plans/`).

#### Admin Portal

- [ ] **Button icons in panels** — Need better location for button icons in details panels (e.g. lead/contact panels: Activate, Add Task, Add Note, Reply, Convert, Archive/Restore)
- [ ] **Tabs not responsive** — Tabs in project and client details pages need responsive behavior (overflow/wrap on small viewports)
- [x] **Date & time formatting** — Standardized to MM/DD/YYYY format across the site. Updated `format-utils.ts` (central formatDate, formatDateTime, formatRelativeTime), `timeline.ts`, `client-portal.ts`, `portal-document-requests.ts`, and `portal-messages.ts`. Chart labels (weekday/month abbreviations) remain short for visualization. Server-side uses long format for formal documents (invoices, contracts, emails).
- [ ] **Badge/status in tables** — Audit and improve badge/status display in admin tables (alignment, truncation, colors)
- [x] **Icon button tooltips** — All icon-only buttons have `title`/tooltip and `aria-label` for accessibility (audit done — no gaps found; use createIconButton for new ones)
- [ ] **Recent activity** — Dashboard Recent Activity section
- [ ] **Time-sensitive tasks** — Dashboard priority view
- [x] **System tab** — Renamed to "System Status". Added Health Check (Database, Email, Storage, Scheduler), Quick Actions (Clear Cache, Test Email, Run Scheduler), Recent Errors display. Build/Browser info moved to collapsible sections.

---

## VERIFICATION CHECKLIST

**Test in order. Check off each item as you verify it works.**

---

### TEST 1: Clients Tab

**Go to:** Admin → Clients

- [ ] **Table displays:** Health badge (green/yellow/red), tags as pills under name
- [ ] **Click a client →** CRM Details and Custom Fields sections display
- [ ] **Edit CRM:** Click edit, change a field, save → updates display
- [ ] **Edit Custom Fields:** Click edit, change a field, save → updates display
- [ ] **Contacts:** Add contact, edit it, set as primary, delete another
- [ ] **Activity tab:** Timeline shows notes/calls/emails/meetings
- [ ] **Tags:** Add a tag, remove a tag, filter table by tag
- [ ] **Health:** Score displays, click Recalculate → updates
- [ ] **Invite:** Uninvited client shows invite icon; click it → works

---

### TEST 2: Contacts → Client Conversion

**Go to:** Admin → Contacts (or a contact panel)

- [ ] **Convert:** Click "Convert to Client" on a contact → creates client
- [ ] **Badge:** Converted contact shows "Converted to Client" badge

---

### TEST 3: Leads Tab

**Go to:** Admin → Leads

- [ ] **Convert:** Click Convert on a lead row → works
- [ ] **Scoring:** Lead score displays and updates when changed
- [ ] **Pipeline:** Switch to Kanban view, drag lead to new stage → saves
- [ ] **Tasks:** Add task to lead, complete it
- [ ] **Analytics:** Lead analytics/reports load without error

---

### TEST 4: Projects Tab

**Go to:** Admin → Projects → Click a project

- [ ] **Status dropdown:** Change status → saves
- [ ] **Invite:** Click invite icon → works
- [ ] **Tasks tab:** Add task, edit it, mark complete
- [ ] **Time tab:** Add time entry, view entries
- [ ] **Templates:** Create project from template → works
- [ ] **Delete:** Click Delete → confirms and removes project

---

### TEST 5: Contracts (Admin + Client)

**Go to:** Admin → Projects → Contract tab

- [ ] **Preview/Download:** Both buttons work
- [ ] **Request Signature:** Click → sends to client
- [ ] **Status:** Shows "Not Signed" before, "Signed" after

**Then as Client:**

- [ ] **Email link:** Click contract link from email → opens signing page
- [ ] **Sign:** Complete signature and submit → success
- [ ] **Confirmation:** Email received after signing
- [ ] **Admin view:** Signature details now display in Contract tab

---

### TEST 6: Invoices

**Go to:** Admin → Projects → Invoices tab (or Invoices main tab)

- [ ] **Mark Paid:** Click → invoice marked paid
- [ ] **Send Reminder:** Click → reminder sent
- [ ] **Apply Late Fees:** Click → fees added to invoice
- [ ] **Schedule Invoice:** Open dialog, set date, save → appears in scheduled list
- [ ] **Cancel Scheduled:** Click Cancel → removes from list
- [ ] **Setup Recurring:** Open dialog, configure, save → appears in recurring list
- [ ] **Pause/Resume Recurring:** Both work
- [ ] **Deposit Invoice:** Create from project → PDF shows correct deposit info

---

### TEST 7: Proposals

**Go to:** Admin → Proposals

- [ ] **Filters:** Rejected and Converted filter buttons work
- [ ] **Templates:** View templates list, create one, use it for new proposal
- [ ] **Versioning:** Create new version of proposal, view versions list
- [ ] **E-signature:** Request signature → client can sign
- [ ] **Custom items:** Add item, delete item
- [ ] **Discounts:** Apply discount, remove discount
- [ ] **Comments:** Add comment → displays
- [ ] **Activity log:** Shows proposal activity

---

### TEST 8: Messaging

**Go to:** Admin → Messages

- [ ] **Threads:** Thread list displays, click to switch between threads
- [ ] **Mentions:** Type @name in composer → mention works
- [ ] **Reactions:** Click emoji on message → reaction displays
- [ ] **Pin:** Click pin icon → message pins/unpins
- [ ] **Notifications:** New message triggers notification

---

### TEST 9: Files

**Go to:** Admin → Projects → Files tab

- [ ] **Filters:** Filter by project, type, category, date → all work
- [ ] **Version history:** Upload new version of file → shows in history
- [ ] **Mobile:** Resize browser narrow → card layout displays

---

### TEST 10: Analytics

**Go to:** Admin → Analytics

- [ ] **KPI cards:** Load with numbers (not errors)
- [ ] **Charts:** Revenue and status charts render
- [ ] **Reports:** Create report, schedule it, delete it
- [ ] **Alerts:** Create metric alert, toggle on/off, delete it

---

### TEST 11: UI/Modals

**Check across the app:**

- [ ] **Sidebar badges:** Notification counts fully visible (not clipped)
- [ ] **Mobile tabs:** Project/client detail tabs scroll horizontally on mobile
- [ ] **Confirmations:** Delete/archive actions use toast or modal (no browser alert)
- [ ] **Multi-step dialogs:** Multi-step flows use proper dialog (not multiple alerts)
- [ ] **Focus trap:** Open any modal → Tab key stays inside modal

---

### TEST 12: Client Portal

**Log in as a client**

- [ ] **Dashboard:** Project cards and stats load
- [ ] **Invoices:** List displays, click one → can view/download PDF
- [ ] **Messages:** See threads, switch between them, send a reply
- [ ] **Files:** See file list, upload a file, use filters
- [ ] **Settings:** Edit profile, change notification preferences, save → persists
- [ ] **Timeline:** View project activity timeline

---

### TEST 13: Proposal Builder (Intake)

**Go to:** Public intake form or test intake flow

- [ ] **Step 1:** Tier selection works
- [ ] **Step 2:** Feature customization works
- [ ] **Step 3:** Maintenance options work
- [ ] **Step 4:** Summary displays, submit works
- [ ] **Admin:** Submitted proposal appears in Admin → Proposals

---

## Known Issues

*No critical known issues at this time.*

---

## Deferred Items

- **Global Event Listeners** — App not true SPA; handlers persist
- **AbortController** — High complexity; current behavior stable
- **Form Placeholders** — UX polish only
- **Stripe Payments** — Cost deferral
- **Real-Time Messages (WebSockets)** — Polling works fine; complexity deferred

---

## Expansion Plans

### TIER 1: Automation & Reminders — COMPLETE

- [x] Scheduled Job System
- [x] Invoice Reminders
- [x] Contract Reminders
- [x] Welcome Sequences — Automated onboarding emails
- [x] Workflow Triggers — Event-driven automation

### TIER 2: Client Portal Data & UX — COMPLETE

- [x] Dashboard from API
- [x] Activity Feed
- [x] Notification Preferences
- [x] Unread Badges
- [x] Knowledge Base
- [x] Client-Facing Timeline

### TIER 3: Messaging & Files — COMPLETE

- [x] Thread List / Thread Switcher
- [x] Dynamic File Filter
- [x] Document Requests
- [ ] Real-Time Messages (WebSockets) — DEFERRED

### TIER 4: Payments & Financial

- [ ] Online Payments (Stripe) — DEFERRED
- [x] Payment Reminders
- [x] Deposit / Payment Plans
- [x] Recurring Invoices

### TIER 5: Approvals & Documents — COMPLETE

- [x] Deliverable Tracking — Draft → Review → Approve
- [x] Approval Workflows — Sequential or parallel
- [x] E-Signatures

### TIER 6: Admin Tables & Actions — COMPLETE

- [x] Proposals Filter (Rejected/Converted)
- [x] Export Per Table — CSV export for Clients, Leads, Projects tables
- [x] Contact Restore
- [x] Project Delete in UI
- [x] Pagination UI — Page size selection, page navigation with localStorage persistence
- [x] Bulk Archive/Delete — Row selection with Select All, bulk action toolbar

### TIER 7: CRM & Reporting — COMPLETE

- [x] Kanban Pipeline View
- [x] Business Metrics Dashboard
- [x] Client Health Metrics
- [x] Lead Scoring

### TIER 8: Integrations & API

- [ ] Webhooks
- [ ] Public API
- [ ] Third-Party Integrations

### TIER 9: Security & Polish

- [ ] MFA / 2FA
- [ ] SSO
- [ ] Virtual Tour / Walkthrough
- [ ] Visual Proofing & Annotations

---

## New API Endpoints (Feb 2, 2026)

### Workflow Triggers (`/api/triggers`)

- `GET /` — Get all triggers
- `GET /options` — Get available event types and action types
- `GET /:id` — Get a specific trigger
- `POST /` — Create a new trigger
- `PUT /:id` — Update a trigger
- `DELETE /:id` — Delete a trigger
- `POST /:id/toggle` — Toggle trigger active state
- `GET /logs/executions` — Get trigger execution logs
- `GET /logs/events` — Get system events
- `POST /test-emit` — Test emit an event

### Document Requests (`/api/document-requests`)

- `GET /my-requests` — Get client's document requests
- `POST /:id/view` — Mark request as viewed
- `POST /:id/upload` — Upload document for request
- `GET /pending` — Get pending requests (admin)
- `GET /for-review` — Get requests needing review (admin)
- `GET /overdue` — Get overdue requests (admin)
- `GET /client/:clientId` — Get client's requests (admin)
- `GET /:id` — Get specific request (admin)
- `POST /` — Create document request (admin)
- `POST /from-templates` — Create from templates (admin)
- `POST /:id/start-review` — Start review (admin)
- `POST /:id/approve` — Approve request (admin)
- `POST /:id/reject` — Reject request (admin)
- `POST /:id/remind` — Send reminder (admin)
- `DELETE /:id` — Delete request (admin)
- `GET /templates/list` — Get templates
- `POST /templates` — Create template
- `PUT /templates/:id` — Update template
- `DELETE /templates/:id` — Delete template

### Knowledge Base (`/api/kb`)

- `GET /categories` — Get all categories
- `GET /categories/:slug` — Get category with articles
- `GET /featured` — Get featured articles
- `GET /search` — Search articles
- `GET /articles/:categorySlug/:articleSlug` — Get article
- `POST /articles/:id/feedback` — Submit feedback
- Admin endpoints for category/article CRUD

### Client Endpoints (`/api/clients`)

- `GET /me/timeline` — Get client activity timeline
- `GET /me/timeline/summary` — Get activity summary for dashboard
- `GET /me/notifications` — Get notification preferences
- `PUT /me/notifications` — Update notification preferences
- `GET /me/notifications/history` — Get notification history

### File Filters (`/api/uploads/client`)

Query params: `projectId`, `fileType`, `category`, `dateFrom`, `dateTo`

---
