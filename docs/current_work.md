# Current Work

**Last Updated:** March 3, 2026

This file tracks active development work and TODOs. Completed items are archived in `archive/ARCHIVED_WORK_2026-03.md`.

---

## Active TODOs

### Client Portal Security Audit & Fixes - March 3, 2026

**Status:** CRITICAL FIXES COMPLETE

**Issue:** Full audit of client portal security, data isolation, bidirectional messaging, and file sharing.

**Critical Fixes Completed:**

1. **File Access Control - FIXED**
   - `shared_with_client` flag was NOT enforced during file downloads
   - Clients could access any file in their project even if admin hadn't shared it
   - Fixed in: `server/routes/uploads.ts`, `server/utils/access-control.ts`
   - Now: Clients can only access files they uploaded OR files explicitly shared by admin

2. **Admin Messaging Query Filters - FIXED**
   - Admin panel message queries didn't filter by `context_type` or `is_internal`
   - Could expose internal admin notes in conversation views
   - Fixed in: `server/routes/admin/messages.ts`, `server/routes/messages.ts`
   - Now: Messages properly filtered, client never sees internal messages

3. **Message Type Mismatches - FIXED**
   - Backend returned `message` field, frontend expected `content`
   - Backend didn't return `sender_id`, frontend types expected it
   - Fixed in: `src/react/features/portal/messages/types.ts`, `usePortalMessages.ts`, `MessageThread.tsx`
   - Now: Types aligned with actual API responses

4. **Bidirectional File Visibility - IMPLEMENTED**
   - Admin can now share/unshare files with clients via toggle button
   - Admin files list shows "Shared" column with status
   - Client portal properly shows only shared files
   - Files: `server/routes/admin/misc.ts`, `src/react/features/admin/files/FilesManager.tsx`

5. **Client Data Isolation - VERIFIED**
   - All client-facing API endpoints verified for proper `client_id` filtering
   - Admin endpoints protected by `requireAdmin` middleware
   - Access control functions properly check ownership

**Files Modified:**

- `server/routes/uploads.ts` - Fixed canAccessFile, file download access check
- `server/utils/access-control.ts` - Updated canAccessFile to check shared_with_client
- `server/routes/admin/messages.ts` - Added context_type and is_internal filters
- `server/routes/messages.ts` - Added is_internal filter to client queries
- `server/routes/admin/misc.ts` - Added shared fields to admin files query
- `src/react/features/admin/files/FilesManager.tsx` - Added share/unshare functionality
- `src/react/factories/IconButton.tsx` - Added share/unshare icons
- `src/react/features/portal/messages/*.ts` - Fixed type mismatches

**Remaining Tasks (Lower Priority):**

- [ ] Standardize `uploaded_by` field type (sometimes ID, sometimes email)
- [ ] Add PDF generation for intakes and deliverables
- [ ] Add explicit field whitelisting for all database queries

**Verification:** TypeScript passes, build successful

---

### Tab/Subtab Standardization with Overview Dashboards - March 3, 2026

**Status:** COMPLETE

**Issue:** User requested that all tab groups (Work, Workflows, CRM, Documents, Knowledge Base) have an "Overview" tab similar to Analytics. Required standardizing the tab/subtab architecture. User also specified Overview tabs should show ALL tables stacked with pagination of 10 (not KPI cards).

**Changes Made:**

1. **Created Parent Dashboard Components (showing stacked tables, not cards):**
   - `WorkDashboard.tsx` - Shows ProjectsTable, GlobalTasksTable, AdHocRequestsTable
   - `CRMDashboard.tsx` - Shows LeadsTable, ContactsTable, ClientsTable, MessagingPanel
   - `DocumentsDashboard.tsx` - Shows InvoicesTable, ContractsTable, DocumentRequestsTable, QuestionnairesTable
   - Each listens for `{groupName}SubtabChange` events and handles internal view switching
   - Overview shows all tables stacked with `defaultPageSize={10}`
   - Individual subtabs show single table with `defaultPageSize={25}` (default)

2. **Added defaultPageSize prop to ALL table components:**
   - ProjectsTable, GlobalTasksTable, AdHocRequestsTable
   - LeadsTable, ContactsTable, ClientsTable
   - InvoicesTable, ContractsTable, DocumentRequestsTable, QuestionnairesTable
   - All tables default to 25 items per page, but accept optional prop for overview (10 items)

3. **Added CSS for Overview Tables Layout:**
   - `.overview-tables` - Flex column layout with gap
   - `.overview-table-section` - Full width sections
   - Added to `src/styles/pages/admin.css`

4. **Registered Dashboard Components:**
   - Created index.ts export files for work, crm, documents directories
   - Added imports and registrations in `admin-entry.tsx`
   - Added registry entries for `workDashboard`, `crmDashboard`, `documentsDashboard` in `registry.ts`

5. **Updated ReactModuleLoader.ts:**
   - Added module entries for 'work', 'crm', 'documents' groups

6. **Updated admin-dashboard.ts:**
   - Added `GROUPS_WITH_PARENT_COMPONENT` constant
   - Modified `resolveAdminTab()` to return group name (not 'overview') for groups with parent components
   - Updated `loadTabData()` to try both container ID formats (`tab-${name}` and `${name}-tab`)

**Architecture Pattern:**
- All tab groups now use the same internal view pattern as Analytics
- Parent component mounts when group is selected
- Overview shows ALL child tables stacked with 10 items each
- Individual subtabs show single table with 25 items
- Parent dispatches and listens for `{groupName}SubtabChange` events
- Child components are lazily loaded when their subtab is selected

**Files Created:**

- `src/react/features/admin/work/WorkDashboard.tsx`
- `src/react/features/admin/work/mount.tsx`
- `src/react/features/admin/work/index.ts`
- `src/react/features/admin/crm/CRMDashboard.tsx`
- `src/react/features/admin/crm/mount.tsx`
- `src/react/features/admin/crm/index.ts`
- `src/react/features/admin/documents/DocumentsDashboard.tsx`
- `src/react/features/admin/documents/mount.tsx`
- `src/react/features/admin/documents/index.ts`

**Files Modified:**

- `src/react/features/admin/projects/ProjectsTable.tsx` - Added defaultPageSize prop
- `src/react/features/admin/global-tasks/GlobalTasksTable.tsx` - Added defaultPageSize prop
- `src/react/features/admin/ad-hoc-requests/AdHocRequestsTable.tsx` - Added defaultPageSize prop
- `src/react/features/admin/leads/LeadsTable.tsx` - Added defaultPageSize prop
- `src/react/features/admin/contacts/ContactsTable.tsx` - Added defaultPageSize prop
- `src/react/features/admin/clients/ClientsTable.tsx` - Added defaultPageSize prop
- `src/react/features/admin/invoices/InvoicesTable.tsx` - Added defaultPageSize prop
- `src/react/features/admin/contracts/ContractsTable.tsx` - Added defaultPageSize prop
- `src/react/features/admin/document-requests/DocumentRequestsTable.tsx` - Added defaultPageSize prop
- `src/react/features/admin/questionnaires/QuestionnairesTable.tsx` - Added defaultPageSize prop
- `src/react/admin-entry.tsx` - Added dashboard imports and registrations
- `src/react/registry.ts` - Added dashboard registry entries
- `src/features/admin/ReactModuleLoader.ts`
- `src/features/admin/admin-dashboard.ts`
- `src/styles/pages/admin.css` - Added .overview-tables CSS
- `server/config/navigation.ts`
- `server/views/layouts/portal.ejs`

**Verification:** TypeScript passes, build successful

---

### Root-Level UI Consistency Fixes - March 3, 2026

**Status:** IN PROGRESS

**Issues:**

1. **Status Dropdown Alignment** - Status dots in dropdown items not aligned with trigger's status dot
2. **Actions Cell Hover State** - Actions column had different hover background from rest of row
3. **Font Mismatch** - Dropdown items had different font styling than trigger

**Root Cause (React PortalDropdown):**

- `.portal-dropdown-content` has `padding: 4px` which shifts ALL items right
- `.portal-dropdown-item` has `padding: 4px 8px` but trigger has `padding: var(--space-1)` (4px)
- Combined: Items have 4px (content) + 8px (item) = 12px left offset vs trigger's 4px
- This causes status dots in items to be shifted 8px to the right of trigger's dot

**Fixes Applied (all at ROOT level):**

1. **`.portal-dropdown-content:has(.status-indicator)`** - Remove content padding (set to 0)
2. **`.portal-dropdown-item:has(.status-indicator)`** - Set padding to `var(--space-1)` to match trigger
3. **Added `--status-dot-size` and `--status-dot-gap` variables** in `variables.css`
4. **Actions cell hover** - Strengthened selector to cover all contexts

**Files Modified:**

- `src/styles/variables.css` - Added `--status-dot-size`, `--status-dot-gap` variables
- `src/styles/shared/portal-dropdown.css` - Fixed portal-dropdown-item and portal-dropdown-content padding for status dropdowns
- `src/styles/shared/portal-tables.css` - Strengthened actions cell hover rule

---

### Admin Dashboard Consolidation - COMPLETE

**Completed:** March 3, 2026

**Issue:** Admin had both Dashboard and Overview tabs - needed consolidation for consistency with client portal.

**Changes:**

1. **Unified Navigation** - Removed duplicate 'overview' entry, kept 'dashboard' for both admin and client roles
2. **Tab ID Standardization** - Renamed all 'overview' references to 'dashboard' in admin codebase
3. **Analytics Subtabs** - Fixed to use `.header-subtab-group` + `.portal-subtab` classes (was using different classes than other tabs)
4. **Icon Sizes** - Standardized PENCIL icon to 18x18 (was 16x16), back button icon to 18x18

**Files Modified:**

- `server/config/unified-navigation.ts` - Removed overview entry, updated getDefaultTabForRole
- `src/features/admin/admin-dashboard.ts` - Changed all 'overview' to 'dashboard'
- `src/features/admin/ReactModuleLoader.ts` - Changed 'overview' key to 'dashboard'
- `src/features/admin/admin-command-palette.ts` - Updated shortcuts and actions
- `src/react/features/admin/analytics/AnalyticsDashboard.tsx` - Fixed subtab CSS classes
- `src/constants/icons.ts` - Changed PENCIL from 16x16 to 18x18
- `src/components/secondary-sidebar.ts` - Changed back icon to 18x18
- `src/styles/admin/secondary-sidebar.css` - Updated back icon size to 18px

**Verification:** TypeScript passes, ESLint clean, build successful

---

### Analytics Dashboard Data Mismatch - COMPLETE

**Completed:** March 2, 2026

**Issue:** Stats and analytics never loaded because the backend `/api/admin/analytics` endpoint returned a different data structure than what the frontend `AnalyticsDashboard.tsx` component expected.

**Root Cause:**

- Backend returned: `{ range, summary, revenue: [], projects: [], clients: [] }`
- Frontend expected: `{ kpis: {...}, revenueChart, projectsChart, leadsChart, sourceBreakdown }`

**Fix:** Rewrote the `/api/admin/analytics` endpoint to return the correct structure with:

- KPIs: revenue, clients, projects, invoices, conversionRate, avgProjectValue (each with value and change %)
- Chart data: revenueChart, projectsChart, leadsChart (formatted for chart visualization)
- Source breakdown: lead sources with counts and percentages

**File Modified:** `server/routes/admin/misc.ts` (lines 876-1068)

---

### Database Type Mismatches - COMPLETE

**Completed:** March 2, 2026

**Issues Fixed:**

1. **Added `getFloat()` and `getFloatOrNull()` helpers** - Handles SQLite DECIMAL fields that may return as strings
2. **Fixed Row type definitions** - Removed `string | number` from numeric fields, now just `number`
3. **Replaced defensive `typeof` checks** - Services now use `getFloat()` helper consistently
4. **Fixed `Boolean()` casts** - Services now use `getBoolean()` helper for SQLite 0/1 booleans
5. **Updated entity-mapper** - Now uses new float helpers for consistent parsing

**Files Modified:**

- `server/database/row-helpers.ts` - Added `getFloat()` and `getFloatOrNull()` helpers
- `server/database/entity-mapper.ts` - Updated to use new helpers
- `server/types/invoice-types.ts` - Fixed `InvoiceRow`, `InvoicePaymentRow`, `InvoiceCreditRow` types
- `server/database/entities/project.ts` - Fixed `TaskRow`, `TimeEntryRow`, `TemplateRow` types
- `server/services/invoice-service.ts` - Use `getFloat()` for numeric fields
- `server/services/invoice/payment-service.ts` - Use `getFloat()` for amount
- `server/services/receipt-service.ts` - Use `getFloat()` for amount
- `server/services/message-service.ts` - Use `getBoolean()` for boolean fields
- `server/services/progress-calculator.ts` - Use `getBoolean()` for is_completed

**Verification:**

- TypeScript: No errors
- Build: Successful

---

### Comprehensive Codebase Conflict Resolution - Phases 3-5 COMPLETE

**Completed:** March 3, 2026

**Phase 3: API Endpoint Centralization**

- Added `NOTES` and `MILESTONES` endpoints to `src/constants/api-endpoints.ts`
- Refactored 4 hooks to use centralized API_ENDPOINTS:
  - `useInvoices.ts`, `useClientDetail.ts`, `useProjectDetail.ts`, `usePortalInvoices.ts`

**Phase 4: Utility Consolidation** - Already complete (formatDate.ts and cardFormatters.ts already re-export from canonical source)

**Phase 5: Tailwind Color Class Migration**

- Replaced `tw-text-white` with `tw-text-primary` in 19+ React components
- Replaced `tw-border-white` with `tw-border-primary`
- Both classes map to `var(--portal-text-light)` in CSS

**Phase 6: Magic Number Constants** - Already complete (TIMING constants created in Phase 1 audit at `src/constants/timing.ts`)

**Additional Cleanup:**

- Integrated `decodeHtmlEntities()` into 10 React components for XSS-safe text display
- Deleted 3 unused utility files (712 lines of dead code):
  - `src/utils/safe-dom.ts` (334 lines)
  - `src/utils/form-errors.ts` (190 lines)
  - `src/utils/gsap-animations.ts` (188 lines)

**Verification:** Build successful

---

### Project Detail CSS Cleanup - COMPLETE

**Completed:** March 3, 2026

**Issues Fixed:**

1. **Duplicate `.milestone-description` rule** - Removed conflicting duplicate at line 731 (kept rule at line 528)
2. **Wrong variable name** - Fixed `--color-text-secondary` → `--portal-text-secondary` in `.milestone-deliverables`

**File Modified:** `src/styles/admin/project-detail.css`

---

### Admin Portal URL Routing - COMPLETE

**Completed:** March 3, 2026

**Issue:** URL stayed at `/admin/login` regardless of which tab was selected.

**Fix:** Updated `admin-dashboard.ts`:

- Added URL updates to `switchTab` method using `history.pushState()`
- Added `switchTabInternal` method for popstate handling
- Added popstate event listener for browser back/forward navigation
- Fixed `handleInitialNavigation` to redirect from `/admin/login` to `/admin`

**File Modified:** `src/features/admin/admin-dashboard.ts`

---

### Admin Table Column Consolidation - COMPLETE

**Completed:** March 3, 2026

**Issue:** Tables had too many columns, needed permanent consolidation (not just responsive).

**Changes:**

1. **LeadsTable** - Merged CONTACT + COMPANY into single Contact column (colSpan 8→7)
2. **ContactsTable** - Merged Name, Email, Phone, Company into single Contact column (colSpan 9→6)
3. **ProjectsTable** - Merged Timeline, Start Date, Target Date into single Timeline column (colSpan 9→7)
4. **ProposalsTable** - Merged Proposal + Client, Valid Until + Created dates (colSpan 8→6)

**Files Modified:**

- `src/react/features/admin/leads/LeadsTable.tsx`
- `src/react/features/admin/contacts/ContactsTable.tsx`
- `src/react/features/admin/projects/ProjectsTable.tsx`
- `src/react/features/admin/proposals/ProposalsTable.tsx`

---

### Dashboard Visual Consistency - COMPLETE

**Completed:** March 3, 2026

**Issue:** Stat card labels (ACTIVE PROJECTS, TOTAL CLIENTS, etc.) were smaller than section headings.

**Fix:** Updated CSS to unify heading/label sizes:

1. **Dashboard section titles** - Updated to use `--font-size-base` with consistent styling
2. **Stat card labels** - Updated to use `--font-size-sm` with matching `font-weight: 500`, `text-transform: uppercase`, `letter-spacing: 0.05em`

**Files Modified:**

- `src/styles/shared/portal-dashboard-widgets.css`
- `src/styles/shared/portal-stat-cards.css`

---

### Root-Level CSS Variable Migration - COMPLETE

**Completed:** March 3, 2026

**Issue:** Hardcoded pixel values (12px, 16px, 18px, etc.) scattered across CSS files instead of using CSS variables.

**Approach:** All fixes at ROOT level - no scattered overrides:

1. **SVG Stroke-Width** - Single global rule at `portal-components.css:21-26` with `!important` to override inline Lucide attributes
2. **Error States** - Error banner now renders inside table body (same location as loading/empty states)
3. **Icon Sizing Utilities** - Updated `.icon-xs` through `.icon-xl` to use CSS variables
4. **Font Size Migration** - Replaced hardcoded `font-size: 0.75rem`, `18px`, etc. with `--font-size-*` variables
5. **Icon Size Migration** - Replaced hardcoded `width: 32px; height: 32px;` with `--icon-size-*` variables
6. **Letter Spacing** - Replaced hardcoded `letter-spacing: 0.05em` with `--letter-spacing-*` variables
7. **Spacing Migration** - Replaced hardcoded `2px`, `8px` with `--space-*` variables
8. **Search Input Overlap Fix** - Universal rule for search containers to prevent placeholder overlapping icons

**CSS Variables Used (from variables.css):**

- Icon sizes: `--icon-size-xs` (12px), `--icon-size-sm` (14px), `--icon-size-md` (16px), `--icon-size-lg` (20px), `--icon-size-xl` (24px), `--icon-size-2xl` (32px)
- Font sizes: `--font-size-2xs` (10px), `--font-size-xs` (12px), `--font-size-sm` (14px), `--font-size-base` (16px), `--font-size-lg` (18px), `--font-size-xl` (20px)
- Letter spacing: `--letter-spacing-label` (0.05em), `--letter-spacing-title` (0.02em), `--letter-spacing-wide` (0.08em)
- Button sizes: `--btn-portal-icon-size` (32px), `--btn-portal-icon-size-sm` (28px)

**Files Modified:**

- `src/styles/shared/portal-components.css` - Icon utility classes, global SVG stroke-width
- `src/styles/shared/portal-badges.css` - Status dots, sidebar badges, dropdown carets
- `src/styles/shared/portal-layout.css` - Header avatars, toggle buttons, breadcrumbs, tooltips
- `src/styles/shared/portal-sidebar.css` - Sidebar badges, shortcuts, toggle button
- `src/styles/shared/portal-forms.css` - Search input padding, input-with-icon pattern
- `src/styles/shared/portal-dropdown.css` - Icon sizes, font sizes
- `src/styles/shared/portal-buttons.css` - Removed scattered stroke-width overrides

**Verification:** TypeScript passes, ESLint clean

---

### Table Cell Icon Alignment - COMPLETE

**Completed:** March 3, 2026

**Issue:** Icons in table cells were appearing ABOVE the text instead of to the LEFT (aligned with checkboxes).

**Root Cause:** `.cell-with-icon` and `.cell-icon` classes had no CSS defined - they were relying on browser defaults.

**Fix:** Added root-level CSS in `portal-tables.css`:

- `.cell-with-icon` - Flex row layout with `align-items: flex-start` and `gap: var(--space-2)`
- `.cell-icon` - Fixed size using `--icon-size-md`, muted color, slight top margin for alignment
- `.cell-icon-sm` - Smaller variant using `--icon-size-sm`
- `.cell-with-icon-inline` - Inline variant for smaller patterns

**Files Modified:**

- `src/styles/shared/portal-tables.css` - Added cell-with-icon root styles (lines 431-468)

**Tables Affected (all now fixed at root):**

- WorkflowsManager, GlobalTasksTable, EmailTemplatesManager, DesignReviewPanel
- TasksManager, QuestionnairesTable, ContractsTable, DeletedItemsTable
- FilesManager, AdHocRequestsTable, DeliverablesTable, DocumentRequestsTable
- KnowledgeBase (and others using the pattern)

---

### Codebase Audit - March 2026 Session

**Completed:** March 3, 2026

**Issues Investigated:**

1. **Drag & Drop File Styling** - FIXED
   - Border was not visible (white on black with no contrast change on hover)
   - Added proper background colors and improved border visibility
   - Default: `--portal-text-muted` (#999999) border, subtle background
   - Hover/Active: `--portal-text-light` (white) border, highlighted background

2. **Dashboard vs Overview Tabs** - CONSOLIDATED
   - Renamed 'overview' to 'dashboard' for consistency across admin and client portals
   - Single 'dashboard' tab now serves as the landing page for both roles
   - Updated: unified-navigation.ts, admin-dashboard.ts, ReactModuleLoader.ts, admin-command-palette.ts

3. **Filter Config Standardization** - FIXED
   - LeadsTable and ProjectsTable were defining duplicate local configs
   - Updated `filterConfigs.ts` with complete configs (status + source/type)
   - Refactored tables to use shared `LEADS_FILTER_CONFIG` and `PROJECTS_FILTER_CONFIG`

4. **Database Type Safety** - DOCUMENTED FOR FUTURE
   - 45+ service files use unsafe `as unknown as` pattern
   - Type-safe helpers exist in `row-helpers.ts` but inconsistently used
   - Requires comprehensive refactoring (lead-service, client-service, project-service)

**Files Modified:**

- `src/styles/shared/portal-files.css` - Fixed dropzone styling
- `src/react/features/admin/shared/filterConfigs.ts` - Added source/type to configs
- `src/react/features/admin/leads/LeadsTable.tsx` - Use shared filter config
- `src/react/features/admin/projects/ProjectsTable.tsx` - Use shared filter config

---

### Comprehensive Codebase Audit - Phase 2 COMPLETE

**Updated:** March 3, 2026

**Current Score:** 7.8/10 (improved from 6.2/10)

**Phase 1 Completed (March 2):**

1. Hardcoded Hex Color Fallbacks - Removed 92 fallbacks from 16 CSS files
2. Type Safety - Reduced `any` from 61 to 6 instances (90% reduction)
3. Magic Number Timeouts - Created `TIMING` and `PERFORMANCE_THRESHOLDS` constants
4. Global Mutable State - Encapsulated in `moduleState` object
5. Memory Leak Potential - Added `clearListeners()` and `getListenerCount()` to StateManager
6. Hardcoded Redirect Paths - Created `ROUTES` constant in api-endpoints.ts
7. HTML Entity Double-Encoding - Created `src/react/utils/decodeText.ts` utility
8. Logger Service - Enhanced with log levels, configurable output, silencing for tests
9. TODO Comments - Resolved or converted to documented deferrals
10. Test Coverage - Fixed failing tests, set realistic coverage thresholds

**Phase 2 Completed (March 3):**

11. **Console.* Replacement** - Comprehensive migration to centralized logger
    - console.log: Reduced to 15 instances (all intentional: security services, JSDoc, build tools)
    - console.warn: Reduced to 4 instances (all intentional: security services, build tools)
    - console.error: Reduced to 4 instances (all intentional: logger internals, ErrorBoundary)
    - 30+ files updated across React, vanilla TS, and module systems
    - BaseModule now uses centralized logger with inherited log/warn/error methods
    - All admin tables use EventManager for proper cleanup
    - Fixed missing Lucide icon imports in 8 portal components

12. **!important Removal** - Removed 108 !important declarations from CSS
    - Reduced from 141 to 33 instances (76% reduction)
    - Remaining 33 are in accessibility media queries (prefers-reduced-motion, print, prefers-contrast: high)
    - 26 CSS files modified

13. **EventManager Utility** - Added to src/utils/dom-helpers.ts
    - Tracks event listeners for proper cleanup
    - Prevents memory leaks from orphaned listeners
    - Provides cleanup() method for component teardown

**Remaining Issues (for future sprints):**

- Console statements: 23 remaining (all intentional - security services, JSDoc, build tools)
- Large files: 29 files over 500 lines
- Test coverage: ~10% (target: 80%)
- addEventListener: 920 calls, 101 removeEventListener calls, EventManager pattern adopted

**Verification:**

- TypeScript: ✅ No errors
- ESLint: ✅ No errors/warnings
- Build: ✅ Successful

---

### CSP Inline Event Handler Fixes - COMPLETE

**Completed:** March 2, 2026

Fixed all Content Security Policy violations caused by inline `onclick` handlers.

**Files Modified:**

- `src/react/factories/createMountWrapper.tsx` - Replaced inline onclick with data-action and addEventListener
- `src/react/factories/createTableMount.tsx` - Replaced inline onclick with data-action and addEventListener
- `src/features/admin/admin-dashboard.ts` - Replaced inline onclick with data-action and addEventListener
- `src/features/client/modules/portal-files.ts` - Replaced inline onclick with data-action and addEventListener
- `src/features/client/modules/portal-settings.ts` - Replaced inline onclick with data-action and addEventListener

---

### Chart.js Canvas Reuse Fix - COMPLETE

**Completed:** March 2, 2026

Fixed Chart.js "Canvas is already in use" errors by implementing proper chart cleanup.

**Changes:**

- Added `Chart.getChart(canvas)` checks before creating new charts
- Updated `destroyCharts()` to clean up orphaned chart instances on known canvas elements

**File Modified:** `src/features/admin/modules/admin-analytics.ts`

---

### Portal Architecture Consolidation - Phase 4 Cleanup

**Status:** BLOCKED - Awaiting User Testing

Phase 4 cleanup tasks remaining:

- [ ] Test new PortalShell architecture in browser
- [ ] Delete deprecated modules (after testing confirms PortalShell works)
- [ ] Remove old navigation configs
- [ ] Update tests
- [ ] Update documentation

**Note:** The deprecated modules (`admin-dashboard.ts`, `client-portal.ts`) are still actively imported in `modules-config.ts`. They cannot be deleted until the new PortalShell system is fully tested and confirmed working.

---

### Brutalist Design System - Pending User Testing

- [ ] Test React Overview on admin dashboard
- [ ] Verify brutalist styling applies correctly

**Feature Flag:**

- `localStorage.setItem('feature_react_overview', 'true')` - Enable React Overview
- `localStorage.setItem('feature_react_overview', 'false')` - Use vanilla fallback
- `?vanilla_overview=true` URL param - Force vanilla fallback

---

## Deferred Tasks (Lower Priority)

### Database Type Safety Refactoring - DEFERRED

**Identified:** March 3, 2026

45+ service files use unsafe `as unknown as Type` pattern instead of type-safe helpers from `row-helpers.ts`.

**High Priority Files (most unsafe casts):**

- `server/services/lead-service.ts` - 28 instances
- `server/services/client-service.ts` - 25 instances
- `server/services/project-service.ts` - 20 instances
- `server/services/document-request-service.ts` - 20 instances

**Available Helpers (in `server/database/row-helpers.ts`):**

- `getString()`, `getStringOrNull()`
- `getNumber()`, `getNumberOrNull()`
- `getFloat()`, `getFloatOrNull()`
- `getBoolean()`, `getBooleanOrNull()`
- `getDate()`

**Recommendation:** Refactor services incrementally to use helpers, starting with financial services (invoices, payments).

---

### Input Validation Hardening - COMPLETE

**Completed:** March 2, 2026

All phases complete:

- [x] Phase 6: Project routes (applied `projectRequest`, `projectCreate` validation)
- [x] Phase 7: Admin routes (applied `task` validation)
- [x] Phase 8: Message routes (applied `messageThread`, `message` validation)

**Note:** Pre-existing test failure in `email-service.test.ts` (nodemailer mock issue) - 9 tests failing, unrelated to validation changes.

---

### Backend Design Consistency Audit - Deferred Tasks

These tasks require substantial effort and are documented for future work:

- [ ] Split `proposals.ts` (2,118 lines) into modules: `core.ts`, `templates.ts`, `versions.ts`, `signatures.ts`, `pdf.ts`
- [ ] Split `messages.ts` (1,289 lines) into modules
- [ ] Implement input validation library (Zod)
- [ ] Standardize error handling pattern across all services
- [ ] Create response builder utility (deferred - api-response.ts already comprehensive)
- [ ] Standardize service singleton pattern (deferred - low priority)

---

### Large File Refactoring - Deferred

Identified in March 2026 audit. Large files that should be split:

| File | Lines | Priority |
|------|-------|----------|
| `admin-projects.ts` | 3,862 | Medium |
| `api.ts` (types) | 3,284 | Low |
| `admin-dashboard.ts` | 3,102 | Medium |
| `admin-proposals.ts` | 3,044 | Medium |
| `admin-workflows.ts` | 2,713 | Low |

---

### Remaining Type Safety Improvements - COMPLETE

**Completed:** March 2, 2026

Reduced from 61 to 6 `any` type instances (90% reduction). Created `src/types/global.d.ts` with proper browser API types.

Remaining 6 `any` instances are justified:

- State manager generic selectors (type system limitation)
- Service factory arguments (DI pattern requirement)
- Dynamic import loaders (vary by component)
- Prop/state watchers (generic callbacks)
- Mount function options (vary by component)

---

### Transitive Dependency Vulnerabilities - Monitoring

23 npm vulnerabilities remain in transitive dependencies:

- AWS SDK nested clients
- sqlite3 → node-gyp → tar
- Requires upstream fixes, not actionable locally

---

## Post-Task Documentation Checklist

- [ ] Update feature docs if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [x] Verify no markdown violations

---

## DO NOT REMOVE OR EDIT ANYTHING BELOW THIS LINE

### Design System Reference

- Design System: docs/design/DESIGN_SYSTEM.md

Key rules:

- NO EMOJIS - Use Lucide icons only
- NEVER hardcode colors - use CSS variables
- Use `createPortalModal()` for modals
- Complex animations use GSAP, not CSS animations
