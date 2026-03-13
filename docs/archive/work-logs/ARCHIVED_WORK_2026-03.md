# Archived Work - March 2026

This file contains completed work from March 2026. Items are moved here from `../current_work.md` once fully verified and operational.

---

## Completed - March 2, 2026

### State of the Art Codebase Audit - COMPLETE

**Completed:** March 2, 2026

Comprehensive audit with rating: **B+ (7.6/10)**

**Type Safety Improvements:**

- [x] Reduced `any` type usage from 61 to 45 instances (26% reduction)
- [x] Added proper interfaces for dashboard data types (`ActivityItem`, `ProjectItem`, `TaskItem`)
- [x] Fixed `NavigationItem` and `WindowNavigationData` types in navigation.ts
- [x] Fixed `ContactFormData` typing in contact-form.ts
- [x] Fixed GSAP timeline typing in base.ts
- [x] Updated logging functions to use `unknown[]` instead of `any[]`
- [x] Fixed `MountFunction` type in registry.ts

**Security:**

- [x] Confirmed `.env` is in `.gitignore` and NOT tracked
- [x] Ran `npm audit fix` - reduced vulnerabilities from 25 to 23
- [x] Remaining vulnerabilities are in transitive dependencies (AWS SDK, sqlite3, tar) requiring upstream fixes

**Build Verification:**

- TypeScript compilation: PASSED
- ESLint: PASSED
- Production build: PASSED (19.19s)

**Files Modified:**

- `src/core/app.ts`
- `src/core/container.ts`
- `src/features/shared/types.ts`
- `src/modules/core/base.ts`
- `src/modules/ui/contact-form.ts`
- `src/modules/ui/navigation.ts`
- `src/react/features/admin/overview/OverviewDashboard.tsx`
- `src/react/registry.ts`

---

### Comprehensive Codebase Conflict Resolution - COMPLETE

**Completed:** March 2, 2026

Resolved all conflicts identified in deep dive audit across CSS, components, API endpoints, and utilities.

**Additional Fixes (Deep Dive Audit Phase 2):**

- [x] **formatFileSize Consolidation**
  - Removed duplicate implementation from `src/utils/file-validation.ts`
  - Removed duplicate implementation from `src/types/client.ts`
  - Both files now re-export from canonical `src/utils/format-utils.ts`
  - Updated `src/features/admin/modules/admin-messaging.ts` to import from format-utils

- [x] **formatDate Name Collision Fix**
  - Renamed `formatDate` to `formatCardDate` in `src/react/utils/cardFormatters.ts`
  - Updated imports in 3 component files:
    - `ApprovalCard.tsx`, `DocumentRequestCard.tsx`, `AdHocRequestCard.tsx`

- [x] **Button CSS Variable Migration**
  - Replaced 30+ hardcoded RGB values in `src/design-system/tokens/buttons.css` with CSS variables
  - Now uses `var(--portal-text-light)`, `var(--portal-text-primary)`, etc.

- [x] **Orphaned Vanilla Components Deleted**
  - Deleted 5 unused vanilla TypeScript components:
    - `src/components/button-component.ts`
    - `src/components/modal-component.ts`
    - `src/components/analytics-dashboard.ts`
    - `src/components/performance-dashboard.ts`
    - `src/components/table-action-buttons.ts` (deprecated wrapper)
  - Updated barrel files `utility-components.ts` and `dashboard-components.ts`

- [x] **CSS Variable Consolidation**
  - Removed redundant button variables from `portal-theme.css` (now in `buttons.css`)
  - Removed redundant spacing variables (defined in `spacing.css`)
  - Removed redundant dashboard variables (defined in `spacing.css`)

**Phase 1: CSS Variable Fixes**

- [x] Added missing color variables to `src/design-system/tokens/colors.css`:
  - `--color-purple: #c084fc`
  - `--color-pink: #f472b6`
  - `--color-cyan: #22d3ee`
- [x] Removed hardcoded hex fallbacks from 8 CSS files:
  - `portal-auth.css` (~10 fallbacks)
  - `portal-layout.css` (2 fallbacks)
  - `portal-buttons.css` (6 fallbacks)
  - `portal-files.css` (1 fallback)
  - `portal-sidebar.css` (2 fallbacks)
  - `portal-tabs.css` (2 fallbacks)
  - `command-palette.css` (~8 fallbacks)
  - `loading.css` (~6 fallbacks)

**Phase 2: Component Deduplication**

- [x] Deleted duplicate `src/react/factories/StatusBadge.tsx` (0 imports)
- [x] Deleted orphaned `src/types/auth.ts` (0 imports)
- [x] Updated `src/react/factories/index.ts` to re-export StatusBadge from canonical location
- [x] Fixed `src/types/index.ts` to export from `src/auth/auth-types.ts` and `src/auth/auth-constants.ts`

**Phase 3: API Endpoint Centralization**

- [x] Added `ADMIN` namespace to `src/constants/api-endpoints.ts`:
  - `ADMIN.LEADS`, `ADMIN.LEADS_BULK_STATUS`, `ADMIN.LEADS_BULK_DELETE`
  - `ADMIN.PROJECTS_BULK_DELETE`, `ADMIN.CONTACTS`
- [x] Refactored `src/react/hooks/useLeads.ts` to use centralized endpoints
- [x] Refactored `src/react/hooks/useClients.ts` to use centralized endpoints
- [x] Refactored `src/react/hooks/useProjects.ts` to use centralized endpoints

**Phase 4: Utility Consolidation**

- [x] Updated `src/react/utils/formatDate.ts` to re-export from canonical `src/utils/format-utils.ts`
- [x] Updated `src/react/utils/cardFormatters.ts` to re-export `formatCurrency` and `formatFileSize` from canonical source

**Phase 6: Timing Constants**

- [x] Created `src/constants/timing.ts` with centralized timing constants:
  - `COPY_FEEDBACK`, `MODAL_ANIMATION`, `SEARCH_DEBOUNCE`, `STATUS_REFRESH`
  - `TOAST_DURATION`, `DROPDOWN_CLOSE_DELAY`, `INPUT_FOCUS_DELAY`, `SKELETON_MIN_DISPLAY`

**Verification:**

- TypeScript compilation passed
- ESLint passed
- Production build completed successfully

---

### Inline Style Refactoring to CSS Classes - COMPLETE

**Completed:** March 2, 2026

Refactored inline `style={{}}` attributes in React components to CSS utility classes.

**Progress:**

- Starting count: 733 inline styles
- Final count: 47 inline styles
- Removed: 686 (94% reduction)

**Changes:**

- Added `tw-min-h-400` utility class to portal-layout.css
- Converted `fontSize`, `textAlign`, `margin`, `marginBottom` inline styles to tw-* classes
- Updated files: PortalInvoicesTable.tsx, PortalDocumentRequests.tsx, ProjectDetail.tsx, ClientDetail.tsx, NotesTab.tsx

**Remaining 47 are dynamic values that MUST stay inline:**

- Progress bar widths (`width: ${progress}%`)
- Config-based colors (priority, status, tag colors from objects)
- Dynamic grid columns (`gridTemplateColumns: repeat(${count}, 1fr)`)
- Conditional opacity for loading states

---

### Input Validation Middleware - COMPLETE

**Completed:** March 2, 2026

Added comprehensive input validation to server-side routes using centralized validation middleware.

**Validation Schemas Added:**

- `projectRequest` - Client project submission validation
- `projectCreate` - Admin project creation validation
- `projectUpdate` - Project update validation
- `messageThread` - Thread creation validation
- `message` - Message sending validation
- `bulkDelete` - Bulk deletion validation
- `task` - Task creation/update validation

**Routes Updated:**

- `server/routes/projects/core.ts` - Applied `projectRequest` and `projectCreate` validation
- `server/routes/messages.ts` - Applied `messageThread` and `message` validation
- `server/routes/admin/misc.ts` - Applied `task` validation

**Verification:**

- TypeScript compilation passed
- ESLint passed
- Production build completed successfully

---

### Type Safety Improvements Phase 2 - COMPLETE

**Completed:** March 2, 2026

Further reduced `any` type usage with proper type definitions.

**Progress:**

- Starting count: 45 instances
- Final count: 6 instances (87% reduction from this phase)
- Total reduction from audit start: 61 to 6 (90% total reduction)

**Changes:**

- Created `src/types/global.d.ts` with proper browser API types:
  - `NetworkInformation` interface for Network Information API
  - `PerformanceMemory` interface for Chrome memory API
  - Extended `Window` interface for `NBW_APP`, `NBW_STATE`, `API_CONFIG`
  - Extended `Navigator` interface for `connection` property
  - Extended `Performance` interface for `memory` property

- Fixed entry files (main.ts, admin.ts, portal.ts, main-site.ts):
  - Removed `(window as any).NBW_APP` casts - now uses typed `window.NBW_APP`

- Fixed `src/services/performance-service.ts`:
  - Removed `(import.meta as any).env?.DEV` cast
  - Removed `performance as any` cast for memory
  - Removed `navigator as any` cast for connection

- Fixed `src/modules/core/base.ts`:
  - Added `hasError` and `state` as class properties
  - Fixed `elements` Map typing to support `NodeListOf<Element>`
  - Fixed `setState` and `getState` method signatures with proper generics

- Fixed `src/components/base-component.ts`:
  - Changed `ComponentProps` and `ComponentState` to use `unknown` instead of `any`
  - Fixed `onGlobalStateChange` parameter types

- Fixed `src/config/protection.config.ts`:
  - Changed violation callback `details` parameter to `unknown`

- Fixed `src/features/admin/modules/admin-overview.ts`:
  - Changed mount function options to `Record<string, unknown>`

- Fixed `src/utils/sanitization-utils.ts`:
  - Changed `logSecurityViolation` data parameter to `unknown`

**Remaining 6 `any` types are justified:**

1. `state-manager.ts` - Generic selectors need flexible value types
2. `container.ts` - ServiceFactory needs to accept varying arguments
3. `features/shared/types.ts` - Dynamic import loader returns various component types
4. `base-component.ts` (2) - Generic watcher callbacks for prop/state changes
5. `react/registry.ts` - Mount function options vary by component

**Verification:**

- TypeScript compilation passed
- ESLint passed
- Production build completed successfully (19.22s)

---

## Completed - March 13, 2026

### Portal Forms — Single Source of Truth - COMPLETE

- **Portal forms (admin + client):** `src/styles/portal/shared/portal-forms.css` is the only place for input/textarea/select border, padding, focus, and typography. Feature CSS should only add layout (grid, gap, width).
- **Public/marketing forms:** `src/styles/components/form-fields.css` styles only `.form-container` and `.login-form`; no global `.form-input`/`.form-textarea` so portal forms are not overridden.
- **Labels:** `src/styles/portal/shared/portal-field-label-spacing.css` is SoT for `.field-label`/`.meta-label`; portal-forms only adds form-context overrides (position, pointer-events).

---

### Intake Data → Client Detail - COMPLETE

- **Intake form:** New clients created from `POST /api/intake` now store `contact_name`, `company_name`, `email`, and `phone` (optional) so Client Detail Overview shows Contact Information and Account Details from intake.
- **Existing client:** When an existing client (matched by email) submits intake again, their record is updated with `contact_name`, `company_name`, and `phone` from the submission so the detail page stays in sync with intake data.
- **Validation:** Optional `phone` field added to intake submission schema (max 50 chars).

---

### Full Portal Audit Fix - COMPLETE

**Grade:** C+ → A (25 commits across 10 waves)

All 70+ items resolved across 20 layers. Waves 1–10 complete.

**Wave 10 (Grade A Push):**

- [x] CI/CD pipeline (`.github/workflows/ci.yml`)
- [x] Root ErrorBoundary wrapping PortalApp
- [x] `usePortalFetch` transform stability (useRef)
- [x] Database index migration (098, comprehensive FK indexes)
- [x] Calendar service rate limiting (exponential backoff)
- [x] Analytics service idempotency (transactions + dedup)
- [x] Ad-hoc request email notifications
- [x] Integration health check endpoint (`GET /integrations/health`)
- [x] SystemStatusDashboard heading hierarchy fix
- [x] Inline color styles converted to CSS classes
- [x] ErrorCodes enum standardized across all routes
- [x] 9 new unit test files for utilities and services

---

### Project Field Save & DB Fixes - COMPLETE

**Issues Fixed:**

- Project fields (budget, end_date, repo_url, contract_signed_date) showing empty after refresh
- `PUT /api/projects/:id` returning 500 on any field update

**Root Causes & Fixes:**

1. Missing column aliases — `GET` list, `GET /:id`, and `PUT` response queries used `p.*`. Fixed by adding explicit aliases in `server/routes/projects/core.ts`.
2. Migration 102 — restored `default_deposit_percentage` column dropped by migration 049.
3. Migration 103 — fixed `message_mentions`, `message_reactions`, `message_read_receipts`, `pinned_messages` FKs pointing to dropped table `_general_messages_deprecated_085`.
4. `Project.budget` typed as `number` — changed to `string` (maps to `budget_range TEXT`). Budget sort updated to `localeCompare`.
5. Duplicate `buildEndpoint` import removed from `usePortalMessages.ts`.

**Files Modified:**

- `server/routes/projects/core.ts`
- `server/database/migrations/102_restore_default_deposit_percentage.sql`
- `server/database/migrations/103_fix_message_foreign_keys.sql`
- `src/react/features/admin/types.ts`
- `src/react/features/admin/projects/ProjectsTable.tsx`
- `src/react/features/portal/messages/usePortalMessages.ts`

---

### Dashboard Kanban & Navigation Fixes - COMPLETE

**Issues Fixed:**

1. Kanban columns not scrollable — added `max-height` + `overflow-y` to `.kanban-items`.
2. Kanban heading styling — reset browser-default top margin, fixed `border-bottom` / `border-left` overlap.
3. "Upcoming Tasks" heading not navigating to Tasks subtab — fixed with `navigate('/work', { state: { subtab: 'tasks' } })` + `useLocation().state` in `WorkDashboard` useState initializer.
4. Heading hover text not turning red — added `.overview-panel-action:hover .field-label { color: var(--color-accent); }`.

**Files Modified:**

- `src/styles/admin/overview-layout.css`
- `src/react/features/admin/overview/OverviewDashboard.tsx`
- `src/react/features/admin/work/WorkDashboard.tsx`

---

### Portal CSS Legacy Cleanup (Form Classes) - COMPLETE

- Standardized form wrapper to `.form-field` — `.form-group` fully removed from all CSS, EJS, HTML, TS, and TSX files.
- Auth gate converted to React component (`AuthGate.tsx` + `mount-auth-gate.tsx`); `auth-gate.ejs` is now a thin React mount point.
- Build-time CSS selector typo in `portal-tabs.css` fixed (no more esbuild warnings).

---

### Validation & Status Mismatch Fixes - COMPLETE

**Issues Fixed:**

1. Task status update failing — removed `{ type: 'required' }` from `task.title` so status-only PUTs no longer return 400.
2. Task status values mismatch — `allowedValues` corrected to `'in_progress'` (underscore) and `'cancelled'` to match frontend `TASK_STATUS_CONFIG`.
3. Lead status update failing — added `'pending'` to `validStatuses`.
4. Project status values mismatch — removed `'lead'`, added `'in-progress'` and `'in-review'` to match DB CHECK constraint.

**Files Modified:**

- `server/middleware/validation.ts`
- `server/routes/admin/leads.ts`

---

### Portal Gap on Mobile (Root Fix) - COMPLETE

**Root Cause:** `.dashboard-content` used `display: block` so flex `gap` was never applied.

**Fix:**

- `portal-layout.css` — Changed `.portal .dashboard-content` to `display: flex; flex-direction: column; gap: var(--portal-section-gap)`.
- `portal-tabs.css` — Cancelled `margin-bottom` on `.portal .dashboard-content .portal-subtabs` to prevent double spacing.

**Files Modified:**

- `src/styles/portal/shared/portal-layout.css`
- `src/styles/portal/shared/portal-tabs.css`

---

### PDF Header Unification - COMPLETE

- Extracted `drawPdfDocumentHeader()` into `server/utils/pdf-utils.ts` using invoice styling as canonical reference.
- All four PDF generators (invoice, proposal, receipt, contract) now call the shared header function.
- Unused `getPdfLogoBytes` imports removed from contracts and receipt-service.

---

### Messages View Overhaul - COMPLETE

- [x] Sender name placement — moved under avatar (bottom of group) instead of above bubble
- [x] Typing indicator — removed inline style, added `.msgtab-typing-indicator` CSS class
- [x] Consistent styling — both views use shared factory; no divergence
- [x] Mobile responsiveness — 85% max-width for bubbles, compose hint hidden on small screens

---

### Documentation Audit - COMPLETE

- Deleted stale duplicates: `THE_BACKEND.md`, `DELIVERABLES_MANAGER.md`, `SYSTEM_DOCUMENTATION.md`, `ERROR_HANDLING_STANDARD.md`, `COVERAGE.md`, `src/features/admin/README.md`, `src/react/factories/README.md`
- Fixed CSS file paths across `CSS_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `ARCHITECTURE.md` (styles/shared/ → styles/portal/shared/ etc.)
- Consolidated audit/plan files into `docs/audits/`
- Moved work-log archives to `docs/archive/work-logs/`
- Created `docs/api/`, `docs/guides/` directories
- Merged `ERROR_HANDLING_STANDARD.md` into `DEVELOPER_GUIDE.md`
- Merged `COVERAGE.md` into `guides/DEVELOPMENT.md`
