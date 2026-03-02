# Current Work

**Last Updated:** March 2, 2026

This file tracks active development work and TODOs. Completed items are archived in `archive/ARCHIVED_WORK_2026-02.md`.

---

## Active TODOs

### Comprehensive Codebase Conflict Resolution - COMPLETE

**Completed:** March 2, 2026

Resolved all conflicts identified in deep dive audit across CSS, components, API endpoints, and utilities.

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

### Portal Audit Security Fixes - IN PROGRESS

**Started:** February 28, 2026

Comprehensive audit of portal codebase identified and fixed critical security and stability issues.

**Completed Fixes:**

1. **JSON.parse Safety (Task #1) - COMPLETE**
   - Created `server/utils/safe-json.ts` utility with `safeJsonParse`, `safeJsonParseArray`, `safeJsonParseObject`, `safeJsonParseOrNull`, `parseIfString` functions
   - Updated 12+ service files to use safe JSON parsing:
     - `analytics-service.ts` - 12 JSON.parse calls fixed
     - `audit-logger.ts` - 4 JSON.parse calls fixed
     - `invoice-service.ts` - 2 JSON.parse calls fixed
     - `questionnaire-service.ts` - 2 JSON.parse calls fixed
     - `email-template-service.ts` - 2 JSON.parse calls fixed
     - `notification-preferences-service.ts` - 1 JSON.parse call fixed
     - `deliverable-service.ts` - 1 JSON.parse call fixed
     - `workflow-trigger-service.ts` - 2 JSON.parse calls fixed
     - `client-info-service.ts` - 1 JSON.parse call fixed
     - `recurring-service.ts` - 4 JSON.parse calls fixed
     - `webhook-service.ts` - 2 JSON.parse calls fixed

2. **Authorization Bypass Fix (Task #3) - COMPLETE**
   - Fixed IDOR vulnerability in `server/routes/deliverables.ts`
   - Added validation that `commentId` belongs to specified `deliverableId` before operations
   - Added validation that `elementId` belongs to specified `deliverableId` before operations
   - Prevents users from manipulating resources they don't have access to

3. **Rate Limiting (Task #2) - COMPLETE**
   - Added rate limiting to `/me/password` endpoint in `clients.ts` (5 attempts/hour per user)
   - Added rate limiting to `/reset-password` endpoint in `auth.ts` (10 attempts/15 min per IP)
   - Added rate limiting to `/set-password` endpoint in `auth.ts` (10 attempts/15 min per IP)

**Remaining Tasks:**

- Task #4: Create CSS z-index scale design tokens
- Task #5: Standardize API response formats
- Task #6: Move hardcoded colors to design tokens
- Task #7: Fix React component issues (accessibility, error handling)
- Task #8: Fix service type safety and logging

---

### Inline Style Refactoring to CSS Classes - IN PROGRESS

**Started:** February 28, 2026

Refactoring inline `style={{}}` attributes in React components to CSS classes for better maintainability and consistency.

**Progress:**

- Starting count: 733 inline styles
- Current count: 74 inline styles
- Removed: 659 (90% reduction)

**CSS Classes Added to:**

- `src/styles/shared/portal-components.css` - Overview dashboard, tasks, deliverables, files, questionnaire, client detail, contract, messages, contacts, invoices, notes, ad-hoc requests component classes
- `src/styles/shared/portal-forms.css` - Questionnaire form classes
- `src/styles/shared/portal-messages.css` - Messaging panel classes
- `src/styles/client-portal/projects.css` - Portal project detail and list classes

**Files Refactored:**

- MessagingPanel.tsx
- QuestionnaireForm.tsx
- SystemStatusPanel.tsx
- PerformanceMetrics.tsx
- AdHocAnalytics.tsx
- AnalyticsDashboard.tsx
- OverviewTab.tsx (project detail)
- OverviewTab.tsx (client detail)
- PortalProjectDetail.tsx
- PortalQuestionnairesView.tsx
- TasksTab.tsx
- DeliverablesTab.tsx
- FilesTab.tsx
- ContractTab.tsx
- OverviewDashboard.tsx
- ProjectsTab.tsx (client detail)
- ActivityTab.tsx
- PortalMessagesView.tsx
- MessagesTab.tsx (project detail)
- ContactsTab.tsx
- PortalProjectsList.tsx
- InvoicesTab.tsx
- NotesTab.tsx (project detail)
- PortalAdHocRequests.tsx

**Remaining:** ~74 inline styles (mostly dynamic styles for progress bars, conditional colors, grid column counts)

---

### React Subtab Support for Knowledge Base & Workflows - COMPLETE

**Completed:** February 28, 2026

Updated React components to support subtab navigation (matching vanilla implementation behavior).

**Problem:**
React components for Knowledge Base and Workflows were single-view implementations that didn't respond to header subtab clicks. When clicking "Categories" vs "Articles" in Knowledge Base, or "Approvals"/"Triggers"/"Email Templates" in Workflows, the content didn't change.

**Solution:**
Updated both React components to:
1. Listen for custom subtab change events from the header
2. Maintain internal subtab state
3. Render different content based on active subtab

**Files Modified:**

- `src/react/features/admin/knowledge-base/KnowledgeBase.tsx` - Added subtab support (categories/articles)
- `src/react/features/admin/workflows/WorkflowsManager.tsx` - Added subtab support (approvals/triggers/email-templates)
- `src/features/admin/modules/admin-knowledge-base.ts` - Re-enabled React flag
- `src/features/admin/modules/admin-workflows.ts` - Re-enabled React flag

**Events Handled:**

- `knowledgeBaseSubtabChange` → switches between Categories table and Articles table
- `workflowsSubtabChange` → switches between Approvals table, Triggers table, and Email Templates

---

### React Component Race Condition Fix - COMPLETE

**Completed:** February 28, 2026

Fixed critical race condition where pages failed to load on first visit but worked on subsequent loads.

**Root Cause:**

React component registration (`admin-entry.tsx`, `portal-entry.tsx`) was happening AFTER the admin dashboard and client portal tried to use them. The module import order was:
1. `admin.ts` → `core/app.ts` → AdminDashboard init → tries `getReactComponent()` → **FAILS** (components not registered yet)
2. Eventually `admin-entry.tsx` loads and registers components

**Fix:**

Added explicit imports of React entry files at the TOP of both entry points, before `app` is imported:

```typescript
// CRITICAL: Register React components BEFORE app initialization
import './react/admin-entry';  // in admin.ts
import './react/portal-entry'; // in portal.ts
```

This ensures components are registered BEFORE the initialization chain starts.

**Files Modified:**

- `src/admin.ts` - Added `import './react/admin-entry'` as first import
- `src/portal.ts` - Added `import './react/portal-entry'` as first import

---

### Additional Bulk API Endpoints - COMPLETE

**Completed:** February 28, 2026

Added 13 missing bulk/action API endpoints that frontend React components were calling but didn't exist on backend.

**Endpoints Added:**

| Endpoint | File | Description |
|----------|------|-------------|
| `POST /api/admin/tasks/bulk-delete` | misc.ts | Bulk delete tasks |
| `POST /api/admin/workflows/bulk-delete` | workflows.ts | Bulk delete workflow triggers |
| `POST /api/admin/workflows/bulk-status` | workflows.ts | Bulk update workflow status |
| `POST /api/admin/deliverables/bulk-delete` | misc.ts | Bulk delete deliverables |
| `POST /api/admin/proposals/bulk-delete` | misc.ts | Soft delete proposals |
| `POST /api/admin/deleted-items/bulk-delete` | misc.ts | Permanently delete multiple items |
| `POST /api/admin/deleted-items/bulk-restore` | misc.ts | Restore multiple items |
| `POST /api/contracts/bulk-delete` | contracts.ts | Cancel multiple contracts |
| `POST /api/contracts/:contractId/send` | contracts.ts | Send contract for signature |
| `POST /api/ad-hoc-requests/bulk-delete` | ad-hoc-requests.ts | Soft delete multiple requests |
| `POST /api/document-requests/bulk-delete` | document-requests.ts | Delete multiple document requests |
| `POST /api/questionnaires/bulk-delete` | questionnaires.ts | Delete multiple questionnaires |
| `GET /api/document-requests` | document-requests.ts | Get all document requests (admin) |

**Files Modified:**

- `server/routes/admin/misc.ts` - Tasks, deliverables, proposals, deleted-items bulk endpoints
- `server/routes/admin/workflows.ts` - Workflow bulk delete and status endpoints
- `server/routes/contracts.ts` - Contract bulk delete and send endpoints
- `server/routes/ad-hoc-requests.ts` - Bulk delete endpoint
- `server/routes/document-requests.ts` - Bulk delete and GET / endpoint
- `server/routes/questionnaires.ts` - Bulk delete endpoint
- `server/services/document-request-service.ts` - Added getAllRequests() and getAdminStats()

---

### Portal Architecture Consolidation - PHASE 3 COMPLETE

**Started:** February 27, 2026

Consolidated two separate portals (admin + client) into a single shell with dynamically rendered navigation, features, and capabilities based on user role.

**Phase 1: Foundation - COMPLETE**

- [x] Created `/server/config/unified-navigation.ts` - Single source of truth for all tabs, subtabs, features, and capabilities
- [x] Created `/src/features/shared/types.ts` - Shared type definitions for portal context
- [x] Created `/src/features/shared/PortalFeatureModule.ts` - Base class with capability-driven rendering
- [x] Created `/src/features/shared/index.ts` - Module exports
- [x] Verified CSS already uses variables with fallbacks - no hardcoded colors to fix
- [x] Theme toggle already exists in portal-header.ejs

**Phase 2: Portal Shell - COMPLETE**

- [x] Created `PortalShell.ts` - Main controller with role-based config
- [x] Created `PortalModuleLoader.ts` - Dynamic module loading with caching
- [x] Created `/src/features/portal/index.ts` - Module exports
- [x] Updated `navigation.ts` to use unified-navigation.ts as source of truth
- [ ] Update EJS templates to use unified navigation rendering (optional - backward compatible)

**Phase 3: Consolidate Modules - COMPLETE**

All role-adaptive portal modules created:

- [x] PortalMessaging - Thread list (admin) / simple view (client)
- [x] PortalFiles - Folder management (admin) / upload only (client)
- [x] PortalInvoices - Full CRUD (admin) / view & pay (client)
- [x] PortalProjects - Full management (admin) / view status (client)
- [x] PortalRequests - Manage all (admin) / submit & track (client)
- [x] PortalDashboard - Metrics & activity (admin) / project overview (client)
- [x] PortalSettings - System settings (admin) / profile & preferences (client)
- [x] PortalQuestionnaires - Templates & assignments (admin) / complete questionnaires (client)

**Phase 4: Cleanup - IN PROGRESS**

- [x] Integrate portal shell with main entry point (`modules-config.ts`)
- [x] Added `PortalShellModule` registration for both admin and client pages
- [x] Added `getPortalModules()` function
- [x] Fixed all ESLint errors in portal files
- [ ] Delete deprecated modules (requires user confirmation - see note below)
- [ ] Remove old navigation configs (backward compatible - can be done later)
- [ ] Update tests
- [ ] Update documentation

**Note on Deprecated Modules:**

The new portal architecture is ready but runs alongside the existing system. The following modules can be deprecated once the new system is fully tested:

- `src/features/admin/admin-dashboard.ts` - Replaced by PortalShell
- `src/features/client/client-portal.ts` - Replaced by PortalShell
- Individual module files in `admin/modules/` and `client/modules/` that duplicate shared modules

To use the new portal architecture, use `getPortalModules()` instead of `getAdminModules()` or `getClientPortalModules()` in the entry points.

**Files Created:**

| Path | Description |
|------|-------------|
| `server/config/unified-navigation.ts` | Single source of truth for navigation |
| `src/features/shared/types.ts` | Shared portal types |
| `src/features/shared/PortalFeatureModule.ts` | Base class with capability-driven UI |
| `src/features/shared/PortalMessaging.ts` | Role-adaptive messaging |
| `src/features/shared/PortalFiles.ts` | Role-adaptive file management |
| `src/features/shared/PortalInvoices.ts` | Role-adaptive invoices |
| `src/features/shared/PortalProjects.ts` | Role-adaptive projects |
| `src/features/shared/PortalRequests.ts` | Role-adaptive requests |
| `src/features/shared/PortalDashboard.ts` | Role-adaptive dashboard |
| `src/features/shared/PortalSettings.ts` | Role-adaptive settings |
| `src/features/shared/PortalQuestionnaires.ts` | Role-adaptive questionnaires |
| `src/features/shared/index.ts` | Module exports |
| `src/features/portal/PortalShell.ts` | Main controller |
| `src/features/portal/PortalModuleLoader.ts` | Dynamic module loading |
| `src/features/portal/index.ts` | Module exports |

**Files Modified:**

| Path | Description |
|------|-------------|
| `src/core/modules-config.ts` | Added PortalShellModule and getPortalModules() |

---

### CSS Separation: Main Site vs Portal - COMPLETE

**Completed:** February 27, 2026

Fixed critical CSS bleed where DISCOTHÈQUE portal theme (black background, white text) was incorrectly applied to the main site. Main site and portals now have completely separate color systems.

**Root Cause:**

The `colors.css` design tokens were setting DISCOTHÈQUE dark theme colors in `:root`, which applied globally. The main site should have light colors; only portals use the dark DISCOTHÈQUE theme.

**Fix:**

1. Restored main site light theme in `:root` (light gray background, dark text, crimson brand color)
2. Scoped DISCOTHÈQUE dark theme to `[data-page="admin"]` and `[data-page="client-portal"]` only
3. Fixed legacy variable aliases to use light values for main site
4. Updated `variables.css` body styles to use light fallbacks and portal-specific font override

**Files Modified:**

- `src/design-system/tokens/colors.css` - Separated main site and portal color tokens
- `src/styles/variables.css` - Fixed body background/text fallbacks, added portal font override

---

### Button SVG Icon Color Fix - COMPLETE

**Completed:** February 27, 2026

Fixed SVG icons in buttons appearing grey while button text was white. Icons now properly inherit the button's text color.

**Root Cause:**

SVG elements don't automatically inherit the `color` property from their parent elements. Even though Lucide icons use `stroke="currentColor"`, the SVG element's own `color` property wasn't set, causing `currentColor` to resolve to the browser's default color (grey) instead of the button's white text color.

**Fix:**

Added root-level CSS rules to make SVGs inside buttons inherit the button's text color:

1. Added `button svg { color: inherit; }` to `reset.css` (most root-level fix)
2. Added specific selectors in `form-buttons.css` for `.btn svg`, `.btn-primary svg`, `.btn-secondary svg`
3. Did NOT override `fill` or `stroke` to preserve Lucide icon styling (`fill="none"`)

**Files Modified:**

- `src/styles/base/reset.css` - Added root-level rule for SVG color inheritance in buttons
- `src/styles/components/form-buttons.css` - Added specific button SVG color inheritance rules

---

### Portal Spacing Uniformity - COMPLETE

**Completed:** February 27, 2026

Fixed inconsistent spacing throughout the admin/client portal. All icon-text gaps and section heading padding now use design tokens from `spacing.css` for single source of truth.

**Root Cause:**

Multiple CSS files had hardcoded pixel values for gaps instead of using the `--icon-gap-*` design tokens. This caused inconsistent spacing between icons and text across different components (sidebar buttons, loading spinners, section headings).

**Fix:**

1. Updated `--icon-gap-lg` from 10px to 12px for 20-24px icons (sidebar nav, spinners)
2. Added `--portal-section-gap` and `--portal-section-heading-padding` tokens
3. Fixed `.loading-state`, `.empty-state`, `.error-state` to use `var(--icon-gap-lg, 12px)`
4. Fixed `.empty-state-content` backwards compatibility wrapper to use `var(--icon-gap-lg, 12px)`
5. Fixed small state variants (`.loading-state-small`, etc.) to use `var(--icon-gap-xs, 4px)`
6. Fixed inline-edit components to use `var(--icon-gap-xs, 4px)`
7. Updated sidebar button gap to `var(--icon-gap-lg)`

**Files Modified:**

- `src/design-system/tokens/spacing.css` - Increased icon-gap values, added portal section spacing tokens
- `src/styles/components/loading.css` - Fixed all hardcoded gaps to use CSS variables
- `src/styles/components/inline-edit.css` - Fixed hardcoded gaps to use CSS variables
- `src/styles/shared/portal-buttons.css` - Changed sidebar button gap to `--icon-gap-lg`
- `src/styles/shared/portal-cards.css` - Added base section heading styles
- `src/styles/variables.css` - Added portal section spacing variables

---

### Client Portal Login Route Fix - COMPLETE

**Completed:** February 27, 2026

Fixed POST /client/login 404 error caused by ClientPortalModule not loading on auth pages.

**Root Cause:**

The `ClientPortalModule` factory in `modules-config.ts` had an overly restrictive path check that only matched `/client`, `/client/`, `/client/index*`, `/client/portal*`. This excluded `/client/login`, `/client/forgot-password`, etc.

**Fix:**

Changed path check to match all `/client/*` pages except `/client/intake`:

```typescript
const isClientPage =
  currentPath.startsWith('/client') && !currentPath.includes('/client/intake');
```

**Files Modified:**

- `src/core/modules-config.ts` - Broadened ClientPortalModule path matching

---

### Messages Styling Uniformity - COMPLETE

**Completed:** February 27, 2026

Stripped `src/styles/shared/portal-messages.css` down to minimal layout-only CSS. Removed all hardcoded overrides to let base portal styles handle fonts, colors, spacing.

**Changes Made:**

- [x] Removed all hardcoded `padding` declarations
- [x] Removed all hardcoded `margin` declarations
- [x] Removed all hardcoded `font-size` declarations
- [x] Removed all hardcoded `font-weight` declarations
- [x] Removed all hardcoded `color` declarations (except essential icon/highlight colors)
- [x] Removed all hardcoded `gap` declarations
- [x] Removed all hardcoded `line-height` declarations
- [x] Removed all hardcoded `background` declarations
- [x] Changed all borders to use `var(--portal-border)`
- [x] Kept only essential layout properties (display, flex, grid, overflow, positioning)
- [x] Reduced file from ~855 lines to ~95 lines

**Files Modified:**

- `src/styles/shared/portal-messages.css`

---

### Subtab Spacing Uniformity - COMPLETE

**Completed:** February 27, 2026

Made `.content-wrapper` a flex container with gap so spacing between subtabs (Leads/Contacts/Messages/Clients) and tab content is consistent across all tabs using the `--portal-section-gap` variable.

**Root Cause:**

The `.content-wrapper` element only had `width: 100%` and no flex layout, causing inconsistent spacing between the subtabs (`portal-header-subtabs`) and the tab content below.

**Fix:**

Added flex container with gap to `.portal .content-wrapper`:

```css
.portal .content-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--portal-section-gap);
  width: 100%;
}
```

**File Modified:**

- `src/styles/shared/portal-layout.css`

---

### Messages Layout Consistency - COMPLETE

**Completed:** February 27, 2026

Fixed inconsistent spacing and borders in the messages layout. Unified structure for both admin and client portal.

**Root Cause:**

The universal gap rule in `portal-layout.css` applied `gap: var(--portal-section-gap)` to all elements matching `[class*="-layout"]`, which included `.messages-layout`. This created unwanted spacing between the search bar and columns.

**Changes Made:**

- [x] Excluded `.messages-layout` from universal gap rule using `:not(.messages-layout)`
- [x] Added `.messages-columns` wrapper to client portal HTML (matching admin structure)
- [x] Fixed empty-state icon to use CSS variable via mask-image (was hardcoded gray)
- [x] Removed unnecessary `.messages-thread-header` from client portal
- [x] Removed padding from `.messages-thread-header` CSS
- [x] Added Contact & Tips card styling for client portal

**Files Modified:**

- `src/styles/shared/portal-layout.css` - Excluded messages-layout from universal gap
- `src/styles/shared/portal-messages.css` - Layout-only CSS, no hardcoded values
- `src/styles/client-portal/layout.css` - Added gap:0 rule for messages-layout
- `src/styles/components/loading.css` - Fixed empty-state icon to use mask-image
- `src/features/client/modules/portal-views.ts` - Fixed HTML structure, removed thread header

---

### Client Portal Settings Inline Edit - COMPLETE

**Completed:** February 27, 2026

Converted client portal settings from traditional form inputs to inline-edit pattern matching admin panel. Click on a field value to edit it in place, Enter/blur to save, Escape to cancel.

**Changes Made:**

- [x] Created `InlineEditField` React component for text/email/phone inputs
- [x] Created `InlineEditSelect` React component for dropdown selections
- [x] Converted `ProfileForm` to use inline-edit fields
- [x] Converted `BillingForm` to use inline-edit fields
- [x] Updated `NotificationsForm` to save immediately on toggle (removed Save button)
- [x] Added CSS styles for inline-edit rows in portal settings
- [x] Simplified `PortalSettings` header (removed redundant heading)

**Files Created:**

- `src/react/components/portal/InlineEditField.tsx` - React inline-edit components

**Files Modified:**

- `src/react/features/portal/settings/ProfileForm.tsx` - Converted to inline-edit
- `src/react/features/portal/settings/BillingForm.tsx` - Converted to inline-edit
- `src/react/features/portal/settings/NotificationsForm.tsx` - Instant save on toggle
- `src/react/features/portal/settings/PortalSettings.tsx` - Simplified header
- `src/styles/components/inline-edit.css` - Added portal settings inline-edit styles

---

### Portal Code Audit - COMPLETE

**Completed:** February 27, 2026

Full audit of portal CSS, TypeScript, and React code. Fixed CSS conflicts affecting main site, security vulnerabilities, added error handling, and improved mobile responsiveness.

**CSS Conflicts Fixed:**

- [x] **Reverted typography.css** - Headings back to Acme font (was incorrectly changed to Cormorant Garamond)
- [x] **Reverted reset.css** - Removed global `border-radius: 0` (portal-only style was leaking to main site)
- [x] **Added portal-scoped overrides** - Typography and border-radius now properly scoped to `[data-page="client-portal"]` and `[data-page="admin"]` in `layout.css`

**Completed Tasks:**

- [x] **Fix XSS vulnerability** - Replaced unsafe `innerHTML` with DOM methods in `portal-navigation.ts:343`
- [x] **Fix innerHTML clearing** - Removed redundant clearing in React mount files (React's `unmount()` handles this)
- [x] **Add React Error Boundaries** - Created `ErrorBoundary.tsx` component with fallback UI and retry functionality
- [x] **Export escapeHtml utility** - Made centralized utility available for import from `format-utils.ts`
- [x] **Add mobile responsive styles** - Added `@media (--mobile)` and `@media (--compact-mobile)` rules to:
  - `client-portal/projects.css`
  - `client-portal/documents.css`
  - `client-portal/requests.css`
  - `admin/ad-hoc-requests.css`

**Files Modified:**

- `src/features/client/modules/portal-navigation.ts` - XSS fix
- `src/react/features/portal/navigation/mount.tsx` - innerHTML fix + ErrorBoundary
- `src/react/features/portal/files/mount.tsx` - ErrorBoundary integration
- `src/react/components/portal/ErrorBoundary.tsx` - New component
- `src/styles/shared/portal-components.css` - Error boundary CSS
- `src/utils/format-utils.ts` - Exported escapeHtml
- Multiple CSS files - Mobile responsive styles

**Note:** 30+ files still have local copies of `escapeHtml`, `formatDate`, `formatCurrency`. These can be migrated incrementally to use centralized imports.

---

### Backend Documentation Audit - COMPLETE

**Completed:** February 27, 2026

Full audit of backend documentation for accuracy. Fixed inconsistencies across 4 major documentation files.

**DATABASE_SCHEMA.md Fixes:**

- [x] Updated table count: 118 → 129
- [x] Updated migration count: 89 → 90
- [x] Documented messaging consolidation (Migration 085) - unified `messages` table with `context_type`
- [x] Documented intake archival (Migration 086) - `client_intakes` now a backward-compatible VIEW
- [x] Added 5 missing deliverable tables
- [x] Added 3 new sections: Email Sequences, System/Notifications, Saved Reports
- [x] Marked "Dual Message Systems" issue as RESOLVED
- [x] Updated column counts for clients (48+), projects (44+)

**BACKEND_PATTERNS.md Fixes:**

- [x] Documented middleware default export deviations (audit.ts, cache.ts, rate-limiter.ts, sanitization.ts)
- [x] Noted email-template-service.ts boolean return as exception

**THE_BACKEND.md Fixes:**

- [x] Added full technology stack (SQLite3, Express.js, Nodemailer, Stripe, Sentry, Redis)
- [x] Added Backend Routes section with 26 route files documented
- [x] Documented 7 previously undocumented routes (receipts, approvals, triggers, email-templates, client-info, intake, health)

**API_DOCUMENTATION.md Fixes:**

- [x] Added Receipts API section
- [x] Added Approvals API section
- [x] Added Triggers API section
- [x] Added Email Templates API section
- [x] Added Health Check API section
- [x] Added placeholder section for undocumented APIs (data-quality, admin, intake, client-info)
- [x] Removed outdated date note in Authentication section

**Files Modified:**

- `docs/architecture/DATABASE_SCHEMA.md`
- `docs/architecture/BACKEND_PATTERNS.md`
- `docs/THE_BACKEND.md`
- `docs/API_DOCUMENTATION.md`

---

### Admin API Bulk Delete Endpoints - COMPLETE

**Completed:** February 28, 2026

Added missing bulk delete endpoints for leads and projects that frontend components were calling but backend didn't have.

**Endpoints Added:**

| Endpoint | Method | Request Body | Response |
|----------|--------|--------------|----------|
| `/api/admin/leads/bulk/delete` | POST | `{ leadIds: number[] }` | `{ success: true, data: { deleted: number } }` |
| `/api/admin/projects/bulk/delete` | POST | `{ projectIds: number[] }` | `{ success: true, data: { deleted: number } }` |

**Implementation Details:**

- Both endpoints use soft delete (30-day recovery via deleted items trash)
- Projects endpoint uses `softDeleteService.softDeleteProject()` for cascade behavior
- Leads endpoint directly updates projects table (leads are stored as projects)
- Both validate array input and handle string/number ID coercion
- Both require admin authentication

**Files Modified:**

- `server/routes/admin/leads.ts` - Added `/leads/bulk/delete` endpoint (lines 1273-1313)
- `server/routes/admin/projects.ts` - Added `/projects/bulk/delete` endpoint and imports

---

### Comprehensive Codebase Audit Fixes - COMPLETE

**Completed:** February 28, 2026

Full audit across admin API routes, client portal routes, CSS, navigation, TypeScript, and database layer. Fixed all critical and high priority issues.

**1. SQL Injection Fixes:**

- `server/services/soft-delete-service.ts:122-132` - Replaced `${projectIds.join(',')}` with parameterized queries using placeholders
- `server/services/invoice/recurring-service.ts:343-357` - Replaced unsafe CASE WHEN SQL construction with individual parameterized updates

**2. Missing API Endpoints Created:**

| Endpoint | File | Description |
|----------|------|-------------|
| `GET /api/admin/clients` | misc.ts | List all clients with stats |
| `POST /api/admin/contacts/bulk-delete` | misc.ts | Bulk delete contacts |
| `PUT /api/admin/tasks/:taskId` | misc.ts | Update global task |
| `GET /api/admin/files` | misc.ts | List all files |
| `DELETE /api/admin/files/:fileId` | misc.ts | Delete a file |
| `GET /api/admin/deliverables` | misc.ts | List all deliverables |
| `GET /api/admin/analytics` | misc.ts | Get analytics with date range |
| `GET /api/portal/projects` | app.ts | Portal projects alias |

**3. CSS Fixes:**

- `src/styles/bundles/admin.css` - Fixed light mode: replaced hardcoded `#000000` with proper gray scale variables
- `src/styles/shared/portal-layout.css` - Removed `!important` overrides, using CSS variables for text colors
- `src/styles/components/nav-portal.css` - Fixed z-index 20000/20001 to use `--z-index-portal-overlay`/`--z-index-portal-modal`
- `src/styles/bundles/portal.css` - Fixed z-index 9999 to use `--z-index-portal-confirm`
- `src/styles/bundles/admin.css` - Fixed z-index 9999 to use `--z-index-portal-confirm`
- `src/styles/base/utilities.css` - Fixed z-index 9999 to use `--z-index-portal-confirm`
- `src/styles/main.css` - Fixed z-index 9999 to use `--z-index-portal-confirm`
- `src/styles/components/command-palette.css` - Fixed z-index 9999 to use `--z-index-portal-confirm`
- `src/styles/admin/modals.css` - Fixed z-index 9999/1000 to use design tokens
- `src/styles/base/layout.css` - Fixed z-index 10000 to use `--z-index-fixed`
- `src/styles/shared/portal-dropdown.css` - Fixed z-index 1000 to use `--z-index-portal-dropdown`
- `src/styles/shared/portal-sidebar.css` - Fixed z-index 1000 to use `--z-index-portal-dropdown`

**4. Route Ordering Fixes:**

- `server/routes/admin/leads.ts` - Moved `/leads/duplicates` route BEFORE `/leads/:id/duplicates` to prevent incorrect matching

**Files Modified:**

- `server/services/soft-delete-service.ts`
- `server/services/invoice/recurring-service.ts`
- `server/routes/admin/misc.ts` (added 8 new endpoints)
- `server/routes/admin/leads.ts` (route ordering)
- `server/app.ts` (portal route alias)
- 12 CSS files (z-index and color fixes)

---

### Console Statements → Logger Refactoring - COMPLETE

**Completed:** February 28, 2026

Refactored frontend services to use the centralized logger utility instead of raw console statements for consistent logging behavior.

**Services Updated:**

| File | Changes |
|------|---------|
| `src/services/performance-service.ts` | Replaced 7 `console.warn`/`console.error` with `logger.warn`/`logger.error` |
| `src/services/visitor-tracking.ts` | Added logger import, replaced 3 `console.log`/`console.warn` calls |
| `src/services/base-service.ts` | Updated to use `createLogger` pattern instead of raw console |
| `src/services/router-service.ts` | Removed duplicate `console.error`, now uses inherited `this.error()` |

**Note:** React hooks retain `console.error` for API error logging - these are intentional error handlers that should always be visible regardless of debug mode.

**Files Modified:**

- `src/services/performance-service.ts`
- `src/services/visitor-tracking.ts`
- `src/services/base-service.ts`
- `src/services/router-service.ts`

---

### Portal Consistency Plan - STATUS

**Reviewed:** February 28, 2026

The plan at `/Users/noellebhaduri/.claude/plans/logical-moseying-bengio.md` has been reviewed. Most items are already complete:

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Generic Mount Factory | ✅ Complete | Mount files already use `createTableMount` (~10-15 lines each) |
| Phase 2: Theme Bleed | ✅ Complete | Light mode properly scoped to `[data-page]`, gray scale correct |
| Phase 3: Navigation Fixes | ⏸️ Deferred | ID renaming would affect 42+ files, high risk |
| Phase 4: Wrapper Standardization | ⏸️ Deferred | `[data-page]` already in use |
| Phase 5: Dashboard Spacing | ✅ Complete | Tokens exist in spacing.css, sidebar font already correct |

---

### Knowledge Base & Workflows Subtabs Fix - COMPLETE

**Completed:** February 28, 2026

Fixed subtab buttons not displaying when clicking on Knowledge Base or Workflows tabs in the admin dashboard.

**Root Cause:**

CSS specificity issue. The hide rule had higher specificity than the show rules:

```css
/* Hide rule (specificity 0,4,0): */
.portal .portal-header-subtabs .header-subtabs .header-subtab-group {
  display: none;
}

/* Show rules (specificity 0,4,0 - same, but missing .portal ancestor): */
[data-page="admin"][data-active-group="support"] .header-subtab-group[data-for-tab="support"] {
  display: flex;
}
```

Both rules had equal specificity, but due to CSS layer ordering, the hide rule was winning.

**Fix:**

Added `.portal` to all show rule selectors to increase specificity:

```css
[data-page="admin"][data-active-group="support"] .portal .header-subtab-group[data-for-tab="support"] {
  display: flex;
}
```

**Files Modified:**

- `src/styles/shared/portal-layout.css` - Added `.portal` to all subtab visibility rules (lines 333-346)

---

### Input Validation Hardening - Remaining Phases (Lower Priority)

**Started:** February 27, 2026

Phases 1-5 complete (auth, invoices, clients, uploads). Remaining phases are lower priority:

- [ ] Phase 6: Project routes (large file, many routes)
- [ ] Phase 7: Admin routes
- [ ] Phase 8: Message routes

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

### React Component Auth Headers Audit - COMPLETE

**Completed:** February 28, 2026

Comprehensive audit ensuring all React components in admin portal properly use authentication headers for API calls.

**Root Cause:**

Many React table components were making fetch requests without Authorization headers, causing API calls to fail for authenticated endpoints. The `createTableMount` factory base interface didn't include `getAuthToken` or `showNotification` props.

**Fixes Applied:**

1. **Updated createTableMount factory** (`src/react/factories/createTableMount.tsx`):
   - Added `getAuthToken?: () => string | null` to `TableMountOptions`
   - Added `showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void`

2. **Updated TasksManager.tsx**:
   - Added `useCallback` import
   - Added `getAuthToken` and `showNotification` to props
   - Added `getHeaders()` helper with Authorization header
   - Updated fetch call to use headers

3. **Updated PortalInvoicesTable.tsx** (client portal):
   - Added `useCallback` import
   - Added `getHeaders()` helper
   - Updated 3 fetch calls for PDF downloads to use auth headers

**Auth Pattern Used:**

```typescript
const getHeaders = useCallback(() => {
  const token = getAuthToken?.();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}, [getAuthToken]);

// Usage:
const response = await fetch(url, {
  headers: getHeaders(),
  credentials: 'include',
});
```

**Components Already Properly Configured:**

- GlobalTasksTable.tsx
- SystemStatusPanel.tsx
- AdHocAnalytics.tsx
- OverviewDashboard.tsx
- PerformanceMetrics.tsx
- TimeTrackingPanel.tsx
- ProjectDetail.tsx (via useProjectDetail hook)
- ClientDetail.tsx (via useClientDetail hook)
- All other admin table components

**Files Modified:**

- `src/react/factories/createTableMount.tsx`
- `src/react/features/admin/tasks/TasksManager.tsx`
- `src/react/features/portal/invoices/PortalInvoicesTable.tsx`

---

### React Table Vanilla CSS Conversion - COMPLETE

Converted React tables to use vanilla CSS classes. Added all required tw-* utility classes directly to brutalist.css so they work without Tailwind generation.

**Completed (Feb 24-27, 2026):**

- [x] Fixed LeadsTable structure - stats outside admin-table-card, added title
- [x] Fixed LeadsTable filter - converted from native `<select>` to PortalDropdown
- [x] Fixed ContactsTable - added title "CONTACT FORM SUBMISSIONS"
- [x] Fixed greeting spacing - now matches subtabs
- [x] Fixed theme toggle button - added visible background
- [x] Added `.filter-dropdown-trigger` styling with flex layout for chevron icon
- [x] Fixed TypeScript error - removed non-existent `portalButtonVariants` export
- [x] Fixed InvoicesTable to match vanilla pattern
- [x] Standardized AdminTable loading/error/empty states
- [x] Added `AdminTableError` component
- [x] Fixed GlobalTasksTable structure inconsistency
- [x] Unified table headers with compact stats summary
- [x] Converted all main tables to icon-only buttons
- [x] Removed click-to-filter on stat cards
- [x] **Added all tw-* utility classes to brutalist.css** - Layout, flexbox, grid, spacing, typography, colors, transitions, transforms

**Utility Classes Added to brutalist.css:**

| Category | Classes |
|----------|---------|
| Flexbox | `tw-flex`, `tw-flex-col`, `tw-items-center`, `tw-justify-between`, etc. |
| Grid | `tw-grid`, `tw-grid-cols-*`, `tw-gap-*`, `tw-col-span-*` |
| Spacing | `tw-m-*`, `tw-p-*`, `tw-px-*`, `tw-py-*`, `tw-space-y-*` |
| Sizing | `tw-w-*`, `tw-h-*` (1-12, full, fit, px) |
| Typography | `tw-text-*`, `tw-font-*`, `tw-whitespace-*` |
| Colors | Status colors (green, yellow, blue, etc.), text colors |
| Borders | `tw-border-*`, `tw-ring-*` |
| Positioning | `tw-fixed`, `tw-absolute`, `tw-relative`, `tw-z-50` |
| Transitions | `tw-transition-*`, `tw-duration-*`, `tw-animate-spin` |

**Files Modified:**

- `src/react/styles/brutalist.css` - Added ~150 utility class definitions

---

### CSS Consolidation - COMPLETE

Consolidated all tw-* component classes from brutalist.css and globals.css into the main portal-*.css stylesheets.

**Completed (Feb 28, 2026):**

- [x] Moved tw-btn-* button classes to `portal-buttons.css`
- [x] Moved tw-input, tw-select, tw-textarea, tw-checkbox to `portal-forms.css`
- [x] Moved tw-tab-list, tw-tab, tw-tab-active to `portal-tabs.css`
- [x] Moved tw-empty-state, tw-loading, tw-error, tw-modal-*, tw-dropdown-*, tw-badge, tw-status-dot to `portal-components.css`
- [x] Moved tw-stat-card, tw-stat-value, tw-stat-label to `portal-stat-cards.css`
- [x] Moved tw-dropzone-* to `portal-files.css`
- [x] Moved all tw-* layout/typography utilities to `portal-layout.css`
- [x] Trimmed globals.css to only Tailwind/Shadcn setup
- [x] Deleted brutalist.css (content consolidated)

**Files Modified:**

- `src/styles/shared/portal-buttons.css` - Added tw-btn-* classes
- `src/styles/shared/portal-forms.css` - Added tw-input, tw-select, tw-textarea, tw-checkbox
- `src/styles/shared/portal-tabs.css` - Added tw-tab-list, tw-tab, tw-tab-active
- `src/styles/shared/portal-components.css` - Added tw-empty-state, tw-loading, tw-modal-*, tw-dropdown-*, tw-badge
- `src/styles/shared/portal-stat-cards.css` - Added tw-stat-card, tw-stat-value, tw-stat-label
- `src/styles/shared/portal-files.css` - Added tw-dropzone-*
- `src/styles/shared/portal-layout.css` - Added tw-container, tw-section, tw-card, typography, colors, dividers, grids, scrolling, borders
- `src/react/styles/globals.css` - Trimmed to only Tailwind/Shadcn setup (~60 lines)
- `src/react/styles/brutalist.css` - DELETED

---

### Brutalist Design System - COMPLETE

Implemented a brutalist/minimalist design system for React components inspired by discothequefragrances.com.

**Design Principles:**

- Transparent backgrounds
- No border-radius (squared edges)
- Monospace font (Inconsolata)
- High contrast white on black
- Minimal borders

**Completed (Feb 25-28, 2026):**

- [x] Created tw-* component class library (now in portal-*.css files)
- [x] Updated `tailwind.config.js` with brutalist tokens (no border-radius, no shadows)
- [x] Added Inconsolata font family to Tailwind config
- [x] Modified `admin-overview.ts` to mount React OverviewDashboard with feature flag
- [x] Made `renderOverviewTab` async and pass context for navigation
- [x] Added `/api/admin/dashboard` endpoint
- [x] Added comprehensive utility classes (layout, spacing, typography, colors)
- [x] Consolidated all tw-* classes into portal-*.css files
- [x] Removed duplicate code from globals.css and brutalist.css

**Pending User Testing:**

- [ ] Test React Overview on admin dashboard
- [ ] Verify brutalist styling applies correctly

**Feature Flag:**

- `localStorage.setItem('feature_react_overview', 'true')` - Enable React Overview
- `localStorage.setItem('feature_react_overview', 'false')` - Use vanilla fallback
- `?vanilla_overview=true` URL param - Force vanilla fallback

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
