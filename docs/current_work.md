# Current Work

**Last Updated:** February 26, 2026

This file tracks active development work and TODOs. Completed items are archived in `archive/ARCHIVED_WORK_2026-02.md`.

---

## Active TODOs

### UI Factory Pattern System - COMPLETE

Implemented a comprehensive factory system for UI components (icons, buttons, badges, states) across vanilla TypeScript and React.

**Completed (Feb 26, 2026):**

- [x] Created `src/factories/` directory structure
- [x] Created core constants (`ICON_SIZES`, `CONTEXT_DEFAULTS`, `UI_CONTEXTS`)
- [x] Created TypeScript interfaces (`IconConfig`, `ButtonConfig`, `BadgeConfig`, etc.)
- [x] Created icon registry with 60+ icons including paths, categories, and aliases
- [x] Created icon factory (`renderIcon`, `getIconSvg`, `createIconElement`)
- [x] Created button actions registry (40+ actions with icons, titles, aria-labels)
- [x] Created button sets for common patterns (CRUD, file actions, approval, etc.)
- [x] Created button factory (`renderButton`, `renderButtonGroup`, `renderActionsCell`)
- [x] Created badge factory (`renderBadge`, `renderDot`)
- [x] Created state factory (`renderEmptyState`, `renderLoadingState`, `renderErrorState`)
- [x] Created React IconButton component with action-based rendering
- [x] Created React hooks (`useButtonFactory`, `useIconSize`, `useTableActions`)
- [x] Created React StatusBadge and StateDisplay components
- [x] Migrated existing components to use factory internally
- [x] Migrated 19 admin React tables to use IconButton
- [x] Added `@factories` path alias to tsconfig.json and vite.config.ts
- [x] Created comprehensive documentation (`docs/design/FACTORY_SYSTEM.md`)

**Directory Structure:**

```text
src/factories/
├── index.ts                    # Central export hub
├── types.ts                    # Shared TypeScript interfaces
├── constants.ts                # UI constants (sizes, contexts)
├── icons/
│   ├── icon-factory.ts         # Core icon rendering
│   └── icon-registry.ts        # Icon definitions (60+ icons)
├── buttons/
│   ├── button-factory.ts       # Core button rendering
│   ├── button-actions.ts       # Action definitions (40+)
│   └── button-sets.ts          # Predefined button combinations
└── components/
    ├── badge-factory.ts        # Status badges
    └── state-factory.ts        # Empty/loading/error states

src/react/factories/
├── index.ts                    # React factory exports
├── IconButton.tsx              # React icon button component
├── useFactory.ts               # React hooks
├── StatusBadge.tsx             # React badge components
└── StateDisplay.tsx            # React state components
```

**Key Features:**

| Feature | Description |
|---------|-------------|
| Context-aware sizing | Tables: 18px icons, Modals: 24px icons |
| Action registry | 40+ predefined actions with icons/titles |
| Button sets | Predefined combinations (CRUD, file, approval) |
| React integration | IconButton component, hooks for tables |

---

### Admin Portal Security Audit - XSS Fixes - COMPLETE

Comprehensive security audit of innerHTML assignments identified and fixed XSS vulnerabilities.

**Completed (Feb 26, 2026):**

- [x] Created `src/utils/safe-dom.ts` - XSS-safe DOM manipulation utilities
- [x] Fixed `admin-dashboard.ts` - Escaped alert.message, suggestions, item.label/value
- [x] Fixed `admin-design-review.ts` - Escaped element.name, currentDeliverable.title
- [x] Fixed `admin-deliverables.ts` - Escaped d.title, d.description
- [x] Fixed `admin-messaging.ts` - Escaped file.name in title attribute and text content
- [x] Fixed `admin-questionnaires.ts` - Escaped error message in catch block
- [x] Fixed `admin-analytics.ts` - Added SanitizationUtils import, escaped item.label/value

**Security Utilities Added (safe-dom.ts):**

| Function | Purpose |
|----------|---------|
| `safeHtml` | Template literal tag for auto-escaping interpolated values |
| `trustHtml` | Wrapper for pre-sanitized HTML |
| `setInnerHTML` | Safe innerHTML setter with XSS detection |
| `setText` | Safe textContent setter |
| `buildTableRow` | DOM-based table row builder |
| `parseHtmlSafe` | Parse HTML removing dangerous elements |

**Audit Results:**

| Metric | Before | After |
|--------|--------|-------|
| Unescaped user data in innerHTML | 12+ instances | 0 |
| Security Grade | B- (72/100) | B+ (85/100) |

---

### CSRF Token Protection - COMPLETE

Implemented full CSRF (Cross-Site Request Forgery) protection for all API state-changing requests.

**Completed (Feb 26, 2026):**

- [x] Added CSRF token cookie middleware to `server/app.ts`
- [x] Applied `csrfProtection` middleware to all `/api` routes
- [x] Updated `src/utils/api-client.ts` with CSRF token extraction and header injection
- [x] Updated CORS config to allow `x-csrf-token` header

**Implementation Details:**

| Component | File | Description |
|-----------|------|-------------|
| Cookie Setter | `server/app.ts` | Sets `csrf-token` cookie (JS-readable) on first request |
| Validation | `server/middleware/security.ts` | Validates `x-csrf-token` header matches cookie |
| Client Extraction | `src/utils/api-client.ts` | `getCsrfToken()` reads cookie value |
| Header Injection | `src/utils/api-client.ts` | `addCsrfHeader()` adds token to POST/PUT/DELETE |

**Endpoints Exempt from CSRF:**

| Endpoint Pattern | Reason |
|------------------|--------|
| `/webhooks/*` | Uses signature verification |
| `/uploads` (POST) | FormData uploads |
| `/intake` | Public form submission |

**Security Flow:**

```text
1. Client makes first request → Server sets csrf-token cookie
2. Client reads csrf-token cookie via JavaScript
3. Client sends x-csrf-token header with POST/PUT/DELETE
4. Server validates header matches cookie → Request proceeds
```

---

### OpenTelemetry Observability Stack - COMPLETE

Added full OpenTelemetry integration for distributed tracing and metrics collection.

**Completed (Feb 26, 2026):**

- [x] Installed OpenTelemetry packages (@opentelemetry/sdk-node, auto-instrumentations, exporters)
- [x] Created `server/observability/index.ts` - Main OTEL initialization
- [x] Created `server/observability/tracing.ts` - Span utilities for database queries
- [x] Created `server/observability/metrics.ts` - HTTP/DB/memory metrics collectors
- [x] Created `server/routes/health.ts` - Comprehensive health check endpoints
- [x] Updated `server/instrument.ts` - Initialize OTEL before Sentry, link trace contexts
- [x] Updated `server/app.ts` - Mount health routes, initialize metrics
- [x] Updated `server/config/environment.ts` - Added OTEL_* env vars

**New Health Endpoints:**

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Full diagnostic (DB, services, memory) |
| `GET /health/live` | Kubernetes liveness probe |
| `GET /health/ready` | Kubernetes readiness probe |
| `GET /health/db` | Database-specific health |

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_ENABLED` | `true` | Enable/disable OpenTelemetry |
| `OTEL_SERVICE_NAME` | `client-portal` | Service name for traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | - | OTLP collector endpoint |
| `OTEL_DEBUG` | `false` | Enable console trace output |

---

### Table Module Factory Enhancements - COMPLETE

Enhanced the factory pattern with multi-source data and view toggle support.

**Completed (Feb 26, 2026):**

- [x] Added `fetchData` config option for custom data fetching (multi-endpoint scenarios)
- [x] Added `viewModes` config for multi-view modules (table, kanban, grid)
- [x] Added view mode persistence to localStorage
- [x] Added `getCurrentViewMode()`, `setViewMode()`, `getViewModes()` to public API

**New Factory Config Options:**

```typescript
interface TableModuleConfig<T, TStats = unknown> {
  // New: Custom data fetcher for complex scenarios
  fetchData?: (ctx: AdminDashboardContext) => Promise<{ data: T[]; stats?: TStats }>;

  // New: View modes for multi-view modules
  viewModes?: ViewModeConfig<T>[];
  defaultViewMode?: string;
}
```

**Module Migration Analysis:**

| Module | Status | Reason |
|--------|--------|--------|
| admin-questionnaires | Not migrated | Two separate tables (questionnaires + responses) |
| admin-time-tracking | Not migrated | Project-scoped with custom summary/chart |
| admin-deleted-items | Not migrated | Button-based filters integrated with stats |
| admin-tasks | Not migrated | Dual Kanban/List views with complex state |

The factory is now ready for future modules. Existing modules were analyzed but kept as-is due to their specialized patterns that would require significant restructuring.

---

### Remove Page-Specific Table CSS - COMPLETE

Removed ALL page-specific table CSS selectors and consolidated to generic utility classes. This ensures ALL tables look identical using ONE source of truth.

**Completed (Feb 26, 2026):**

- [x] Removed `.leads-table`, `.clients-table`, `.contacts-table` class selectors from CSS
- [x] Removed `#triggers-table-body`, `#workflows-table-body`, `#workflows-approvals-content` ID selectors
- [x] Removed `#kb-articles-table-body`, `#tab-knowledge-base` ID selectors
- [x] Removed `#tab-contracts`, `#tab-workflows` specific table overrides
- [x] Created generic responsive stacking utility classes
- [x] Updated TypeScript modules to use generic utility classes
- [x] Added `.date-cell.overdue` styling to portal-tables.css

**Generic Utility Classes for Responsive Stacking:**

| Class | Breakpoint | Purpose |
|-------|------------|---------|
| `.stack-cols-wide` | 1760px | Tables with 7+ columns |
| `.stack-cols-medium` | 1280px | Tables with 5-6 columns |
| `.stack-cols-narrow` | 1100px | Tables with 4 columns |
| `.stack-email` | 1550px | Stack email under contact |
| `.stack-date` | 1118px | Stack date under status |
| `.stack-date-early` | 1200px | Stack date earlier |
| `.stack-date-late` | 1048px | Stack date later |
| `.stack-type-budget` | 1118px | Stack type/budget under identity |
| `.stack-slug` | 1176px | Hide slug column |

**Files Modified:**

- `src/styles/shared/portal-tables.css` - Replaced page-specific selectors with generic utilities
- `src/styles/admin/workflows.css` - Removed `#tab-workflows`, `#workflows-table-body` selectors
- `src/styles/admin/table-features.css` - Removed `#tab-contracts` selectors
- `src/styles/admin/tasks.css` - Already cleaned (`.tasks-table` removed)
- `src/features/admin/modules/admin-clients.ts` - Changed to `stack-cols-wide`
- `src/features/admin/modules/admin-leads.ts` - Changed to `stack-cols-medium stack-cols-narrow`
- `src/features/admin/modules/admin-contacts.ts` - Changed to `stack-email stack-date-late`

---

### Unified Table Structure - COMPLETE

Standardized table HTML structure and column classes across all admin and portal tables.

**Completed (Feb 26, 2026):**

- [x] Defined canonical column class naming convention (header: `-col`, cell: `-cell`)
- [x] Added missing column types to `portal-tables.css`: `identity-col`, `timeline-col`, `email-col`
- [x] Added backwards-compatible aliases: `budget-col` → `amount-col`, `contact-col` → `identity-col`
- [x] Updated all admin table modules to use consistent header classes
- [x] Updated all portal table modules to use consistent header classes
- [x] Updated `DESIGN_SYSTEM.md` with complete column class reference

**Column Class Standard:**

| Header Class | Cell Class | Purpose |
|--------------|------------|---------|
| `.bulk-select-cell` | `.bulk-select-cell` | Checkbox column |
| `.identity-col` | `.identity-cell` | Stacked name/email (primary identity) |
| `.name-col` | `.name-cell` | Simple name/title fields |
| `.type-col` | `.type-cell` | Type/category |
| `.status-col` | `.status-cell` | Status badge/dropdown |
| `.date-col` | `.date-cell` | Date values |
| `.amount-col` | `.amount-cell` | Currency (right-aligned, monospace) |
| `.count-col` | `.count-cell` | Numeric counts (centered) |
| `.actions-col` | `.actions-cell` | Action buttons (right-aligned) |

**Files Modified:**

- `src/styles/shared/portal-tables.css` - Added missing column type definitions
- `src/features/admin/modules/admin-leads.ts` - Added `identity-col` to Lead header
- `src/features/admin/modules/admin-invoices.ts` - Standardized to `amount-col`, `identity-col`
- `src/features/admin/modules/admin-projects.ts` - Added `identity-col`, standardized to `amount-col`
- `src/features/admin/modules/admin-contracts.ts` - Added missing header classes
- `src/features/admin/modules/admin-contacts.ts` - Standardized to `identity-col`
- `src/features/admin/modules/admin-clients.ts` - Standardized to `identity-col`
- `src/features/admin/modules/admin-proposals.ts` - Standardized classes
- `src/features/admin/modules/admin-document-requests.ts` - Added missing header classes
- `src/features/client/modules/portal-files.ts` - Added missing header classes
- `src/features/client/modules/portal-invoices.ts` - Added missing header classes
- `docs/design/DESIGN_SYSTEM.md` - Updated column class reference

---

### Brutalist Design System - IN PROGRESS

Implementing a brutalist/minimalist design system for React components inspired by discothequefragrances.com.

**Design Principles:**

- Transparent backgrounds
- No border-radius (squared edges)
- Monospace font (Inconsolata)
- High contrast white on black
- Minimal borders

**Completed (Feb 25, 2026):**

- [x] Created `src/react/styles/brutalist.css` with complete component class library
- [x] Updated `tailwind.config.js` with brutalist tokens (no border-radius, no shadows)
- [x] Added Inconsolata font family to Tailwind config
- [x] Imported brutalist.css in React entry points (admin-entry.tsx, portal-entry.tsx)
- [x] Modified `admin-overview.ts` to mount React OverviewDashboard with feature flag
- [x] Made `renderOverviewTab` async and pass context for navigation
- [x] Added `/api/admin/dashboard` endpoint to aggregate dashboard data for React component

**Feature Flag:**

- `localStorage.setItem('feature_react_overview', 'true')` - Enable React Overview (default)
- `localStorage.setItem('feature_react_overview', 'false')` - Use vanilla fallback
- `?vanilla_overview=true` URL param - Force vanilla fallback

**Files Modified:**

- `src/react/styles/brutalist.css` - NEW: Brutalist component classes
- `src/react/features/admin/overview/mount.tsx` - Added CSS imports
- `src/features/admin/modules/admin-overview.ts` - React mounting with feature flag
- `src/features/admin/admin-dashboard.ts` - Await async renderOverviewTab
- `server/routes/admin/dashboard.ts` - Added `/dashboard` aggregation endpoint
- `tailwind.config.js` - Brutalist tokens (no border-radius, no shadows, Inconsolata)

**Pending:**

- [ ] Test React Overview on admin dashboard
- [ ] Verify brutalist styling applies correctly
- [ ] Convert remaining React components to use brutalist classes

---

### Unified Header Merge - COMPLETE

Merged the page header and global header into one unified header bar.

**Completed (Feb 24, 2026):**

- [x] Moved page title into global header (between logo and theme toggle)
- [x] Removed separate `.portal-page-header` element
- [x] Subtabs container now appears below unified header in content area
- [x] Showed global header on admin (was previously hidden)
- [x] Hidden sidebar branding text (logo now in header)
- [x] Updated CSS selectors for new structure

**Files Modified:**

- `server/views/partials/portal-header.ejs` - Added page title to global header
- `server/views/layouts/portal.ejs` - Removed page header, kept subtabs in content
- `src/styles/pages/admin.css` - Show global header, adjust portal-body layout
- `src/styles/shared/portal-layout.css` - Updated subtab selectors, hide sidebar logo text
- `src/styles/client-portal/layout.css` - Removed deprecated page header styles

**New Structure:**

```text
portal-global-header (fixed at top)
  ├── header-logo ("NO BHAD CODES")
  ├── header-separator
  ├── header-page-title (dynamic page title)
  └── header-theme-toggle

portal-body (below header)
  ├── sidebar (avatar only, no text branding)
  └── dashboard-content
        ├── portal-header-subtabs (optional subtabs)
        └── tab-content / portal-view-content
```

### Email Protection for Unactivated Accounts - COMPLETE

Implemented protection to prevent sending client-facing emails to unactivated accounts (status != 'active'). Invitation emails are still allowed to enable account activation. Also removed the excessive welcome sequence feature entirely.

**Completed (Feb 24, 2026):**

- [x] Added `isClientActivated()` helper function to check client activation status
- [x] Removed welcome email from intake form submission (new clients are pending)
- [x] Added status check before sending welcome email when admin creates client
- [x] Added status check before sending proposal signed confirmation to client
- [x] Removed welcome sequence feature entirely (was excessive - multiple automated emails over days)
- [x] Preserved invitation email functionality (needed for account activation)

**Files Modified:**

- `server/services/email-service.ts` - Added `isClientActivated()` helper
- `server/routes/intake.ts` - Removed welcome email for pending clients
- `server/routes/clients.ts` - Added status check before welcome email
- `server/services/proposal-service.ts` - Added status check before client confirmation
- `server/services/scheduler-service.ts` - Removed welcome sequence methods and config
- `server/routes/auth.ts` - Removed `startWelcomeSequence` call on account activation

**Email Behavior After Changes:**

| Email Type | Pending Accounts | Active Accounts |
|------------|------------------|-----------------|
| Welcome Email (intake) | BLOCKED | N/A (clients start as pending) |
| Welcome Email (admin create) | BLOCKED | ALLOWED |
| Invitation Email | ALLOWED | N/A |
| Proposal Signed Confirmation | BLOCKED | ALLOWED |
| Admin Notifications | ALLOWED | ALLOWED |

**Removed Features:**

- Welcome sequence (multi-email drip campaign over several days after activation)

---

### React + Shadcn/ui Migration - Phase 0 COMPLETE

Implemented foundation setup for incremental React migration using island architecture.

**Completed (Feb 21, 2026):**

- [x] Installed React dependencies (react, react-dom, @vitejs/plugin-react)
- [x] Installed Shadcn utilities (clsx, tailwind-merge, class-variance-authority, lucide-react)
- [x] Installed state management (zustand)
- [x] Updated vite.config.ts with React plugin and path aliases
- [x] Updated tsconfig.json with JSX support (`jsx: react-jsx`, `moduleResolution: bundler`)
- [x] Created tailwind.config.js with CSS variable bridge (maps existing tokens to Tailwind)
- [x] Updated postcss.config.js with @tailwindcss/postcss
- [x] Created components.json for Shadcn CLI
- [x] Created React directory structure at /src/react/

**Files Created:**

- `/src/react/main.tsx` - React entry point with `mountReactApp()` for island architecture
- `/src/react/App.tsx` - Root component wrapper
- `/src/react/lib/utils.ts` - Shadcn `cn()` utility function
- `/src/react/styles/globals.css` - Tailwind imports for React components
- `/src/react/hooks/useGsap.ts` - GSAP animation hooks (useFadeIn, useSlideIn, etc.)
- `/src/react/stores/admin.ts` - Zustand store for admin dashboard state
- `/src/react/stores/bridge.ts` - Bidirectional state sync with vanilla StateManager
- `/tailwind.config.js` - Tailwind config with CSS variable mapping (tw- prefix)
- `/components.json` - Shadcn CLI configuration

**Files Modified:**

- `vite.config.ts` - Added react plugin, @react alias, .tsx/.jsx extensions
- `tsconfig.json` - Added jsx support, @react/* path alias, bundler resolution
- `postcss.config.js` - Added @tailwindcss/postcss plugin
- `package.json` - Added 24 new dependencies

**Key Architecture Decisions:**

| Decision | Implementation |
|----------|----------------|
| CSS Isolation | Tailwind classes prefixed with `tw-` to avoid conflicts |
| Island Architecture | `mountReactApp()` mounts React into existing DOM elements |
| State Bridge | Bidirectional sync between vanilla StateManager and Zustand |
| GSAP Integration | Custom hooks (useFadeIn, useSlideIn, etc.) for React components |

---

### React + Shadcn/ui Migration - Phase 1 COMPLETE

Installed Shadcn components and created Portal wrapper components.

**Completed (Feb 21, 2026):**

- [x] Installed Shadcn components: button, badge, dialog, dropdown-menu, table, input, select, tabs
- [x] Updated globals.css with Shadcn CSS variables mapped to design tokens
- [x] Created PortalButton component with variants (primary, secondary, danger, ghost, icon)
- [x] Created StatusBadge component with status color variants (active, pending, completed, etc.)
- [x] Created PortalModal component with GSAP animation integration
- [x] Created PortalDropdown component matching portal design
- [x] Created AdminTable component with loading/empty states
- [x] Created component index files for exports

**Files Created:**

- `/src/react/components/ui/button.tsx` - Shadcn button
- `/src/react/components/ui/badge.tsx` - Shadcn badge
- `/src/react/components/ui/dialog.tsx` - Shadcn dialog
- `/src/react/components/ui/dropdown-menu.tsx` - Shadcn dropdown
- `/src/react/components/ui/table.tsx` - Shadcn table
- `/src/react/components/ui/input.tsx` - Shadcn input
- `/src/react/components/ui/select.tsx` - Shadcn select
- `/src/react/components/ui/tabs.tsx` - Shadcn tabs
- `/src/react/components/portal/PortalButton.tsx` - Portal-styled button
- `/src/react/components/portal/StatusBadge.tsx` - Status badge with color mapping
- `/src/react/components/portal/PortalModal.tsx` - Portal-styled modal with GSAP
- `/src/react/components/portal/PortalDropdown.tsx` - Portal-styled dropdown
- `/src/react/components/portal/AdminTable.tsx` - Admin table with states
- `/src/react/components/portal/index.ts` - Portal exports
- `/src/react/components/ui/index.ts` - Shadcn exports
- `/src/react/components/index.ts` - Main exports

**Portal Component → Design System Mapping:**

| Component | Maps To | Notes |
|-----------|---------|-------|
| PortalButton | .btn, .btn-primary, etc. | Variants: primary, secondary, danger, ghost, icon |
| StatusBadge | .status-badge | Maps status strings to colors automatically |
| PortalModal | createPortalModal() | Uses GSAP for animations |
| PortalDropdown | modal-dropdown | Full Radix dropdown with portal styling |
| AdminTable | .admin-table | Includes loading/empty states |

---

### React + Shadcn/ui Migration - Phase 2 COMPLETE

Created React ProjectsTable component with full functionality.

**Completed (Feb 21, 2026):**

- [x] Created admin feature types (Project, ProjectStatus, filters, etc.)
- [x] Created useProjects hook (data fetching, stats, update)
- [x] Created useTableFilters hook (search, filter, sort with localStorage persistence)
- [x] Created usePagination hook (page size options, localStorage persistence)
- [x] Created ProjectsTable component with all features:
  - Stats bar (total, active, completed, on-hold)
  - Search input with icon
  - Filter dropdowns (status, type)
  - Sortable column headers
  - Status dropdown in table (change status inline)
  - Pagination with page size selector
  - Loading skeleton and empty states
  - GSAP fade-in animation
- [x] Created mount function with feature flag support

**Files Created:**

- `/src/react/features/admin/types.ts` - Admin type definitions
- `/src/react/hooks/useProjects.ts` - Projects data hook
- `/src/react/hooks/useTableFilters.ts` - Reusable filter/sort hook
- `/src/react/hooks/usePagination.ts` - Reusable pagination hook
- `/src/react/features/admin/projects/ProjectsTable.tsx` - Main component
- `/src/react/features/admin/projects/mount.tsx` - Island mount function
- `/src/react/features/admin/projects/index.ts` - Feature exports
- `/src/react/features/admin/index.ts` - Admin feature exports

**Usage (Island Architecture):**

```typescript
import { mountProjectsTable, shouldUseReactProjectsTable } from '@react/features/admin/projects';

// In admin-projects.ts
if (shouldUseReactProjectsTable()) {
  mountProjectsTable('#projects-table-container', {
    getAuthToken: ctx.getAuthToken,
    onViewProject: (id) => showProjectDetails(id, ctx),
    showNotification: ctx.showNotification,
  });
} else {
  // Existing vanilla implementation
  renderVanillaProjectsTable();
}
```

**Feature Flag:**

Enable React table via:

- localStorage: `localStorage.setItem('feature_react_projects_table', 'true')`
- URL param: `?react_projects=true`

---

### React + Shadcn/ui Migration - Phase 3 COMPLETE

Integrated React ProjectsTable into existing admin-projects.ts module.

**Completed (Feb 21, 2026):**

- [x] Added React mount imports to admin-projects.ts
- [x] Added feature flag check (shouldUseReactProjectsTable)
- [x] Modified renderProjectsTab to conditionally render React mount container
- [x] Modified loadProjects to mount React table when flag enabled
- [x] Added cleanupProjectsTab function for unmounting React
- [x] Wired up callbacks (getAuthToken, onViewProject, showNotification)

**Files Modified:**

- `src/features/admin/modules/admin-projects.ts` - Added React integration (~40 lines)

**How to Test:**

1. Start dev server: `npm run dev:full`
2. Login to admin dashboard
3. Enable React table:
   - Option A: Add `?react_projects=true` to URL
   - Option B: Run in console: `localStorage.setItem('feature_react_projects_table', 'true')`
4. Navigate to Projects tab
5. Verify table renders with React implementation

**What Works:**

- Project list with all columns
- Search filtering
- Status/type dropdown filters
- Sortable column headers
- Status change via dropdown (updates API)
- Pagination with page size options
- Click row to view project details
- Loading and empty states
- GSAP fade-in animation

**Bundle Impact (Before Code-Split):**

- Before: admin-dashboard ~640KB
- After: admin-dashboard ~1.4MB (includes React + dependencies)

---

### React + Shadcn/ui Migration - Phase 4 COMPLETE

Added inline editing and implemented code-splitting for React components.

**Completed (Feb 21, 2026):**

- [x] Created InlineEdit component for click-to-edit table cells
- [x] Integrated InlineEdit into ProjectsTable for budget/timeline editing
- [x] Implemented dynamic imports for React ProjectsTable (code-splitting)
- [x] Added lazy loading with fallback to vanilla implementation
- [x] Fixed cleanupProjectsTab to handle null unmount function

**Files Created:**

- `/src/react/components/portal/InlineEdit.tsx` - Click-to-edit component with currency formatting

**Files Modified:**

- `/src/react/components/portal/index.ts` - Export InlineEdit and helpers
- `/src/react/features/admin/projects/ProjectsTable.tsx` - Added InlineEdit for budget column
- `/src/features/admin/modules/admin-projects.ts` - Dynamic import for code-splitting

**Code-Splitting Implementation:**

```typescript
// Dynamic import - React bundle loads only when feature flag enabled
type ReactMountFn = typeof import('../../../react/features/admin/projects').mountProjectsTable;
let mountProjectsTable: ReactMountFn | null = null;

async function loadReactProjectsTable(): Promise<boolean> {
  if (mountProjectsTable) return true;
  const module = await import('../../../react/features/admin/projects');
  mountProjectsTable = module.mountProjectsTable;
  return true;
}
```

**Bundle Impact (After Code-Split):**

| Chunk | Size | Notes |
|-------|------|-------|
| admin-dashboard | ~645KB | Back to original size |
| projects (React) | ~13KB | Lazy-loaded on demand |
| React core | ~757KB | Shared in main bundle, only loads when needed |

---

### React + Shadcn/ui Migration - Phase 5 COMPLETE

Added bulk actions toolbar with row selection for ProjectsTable.

**Completed (Feb 21, 2026):**

- [x] Installed Shadcn checkbox component
- [x] Created useSelection hook for managing selection state
- [x] Created BulkActionsToolbar component
- [x] Added checkbox column to ProjectsTable header and rows
- [x] Added bulk status change functionality
- [x] Added "Select All" for current page and entire filtered set
- [x] Visual indication for selected rows

**Files Created:**

- `/src/react/components/ui/checkbox.tsx` - Shadcn checkbox
- `/src/react/components/portal/BulkActionsToolbar.tsx` - Bulk actions toolbar component
- `/src/react/hooks/useSelection.ts` - Reusable selection state hook

**Files Modified:**

- `/src/react/components/portal/index.ts` - Added BulkActionsToolbar export
- `/src/react/features/admin/projects/ProjectsTable.tsx` - Added bulk actions integration

**Bulk Actions Features:**

| Feature | Description |
|---------|-------------|
| Row Selection | Checkbox in each row for individual selection |
| Select All | Header checkbox selects all on current page |
| Select Entire Set | "Select all X" link to select all filtered items |
| Bulk Status Change | Dropdown to change status of all selected projects |
| Selection Count | Shows "X selected" with clear button |
| Visual Highlight | Selected rows have branded background color |

**Usage:**

```typescript
// Selection hook provides all selection management
const selection = useSelection({
  getId: (project) => project.id,
  items: paginatedProjects,
});

// Use in bulk actions toolbar
<BulkActionsToolbar
  selectedCount={selection.selectedCount}
  totalCount={filteredProjects.length}
  onClearSelection={selection.clearSelection}
  onSelectAll={() => selection.selectMany(filteredProjects)}
  allSelected={selection.allSelected}
  statusOptions={bulkStatusOptions}
  onStatusChange={handleBulkStatusChange}
/>
```

---

### React + Shadcn/ui Migration - Phase 6 COMPLETE

Migrated Leads table to React following same patterns as ProjectsTable.

**Completed (Feb 21, 2026):**

- [x] Added Lead types to admin types (LeadStatus, Lead, LeadStats, LEAD_STATUS_CONFIG)
- [x] Created useLeads hook (fetch, update, bulk update)
- [x] Created LeadsTable component with full features:
  - Stats bar (total, new, in progress, converted, lost)
  - Search input
  - Filter dropdowns (status, source)
  - Sortable column headers
  - Status dropdown in table (change status inline)
  - Pagination with page size selector
  - Checkbox selection and bulk actions
  - Loading skeleton and empty states
  - GSAP fade-in animation
- [x] Created mount function with feature flag support
- [x] Integrated into admin-leads.ts with code-splitting

**Files Created:**

- `/src/react/hooks/useLeads.ts` - Leads data hook
- `/src/react/features/admin/leads/LeadsTable.tsx` - Main component
- `/src/react/features/admin/leads/mount.tsx` - Island mount function
- `/src/react/features/admin/leads/index.ts` - Feature exports

**Files Modified:**

- `/src/react/features/admin/types.ts` - Added Lead types
- `/src/react/features/admin/index.ts` - Added leads exports
- `/src/features/admin/modules/admin-leads.ts` - React integration (~50 lines)

**Feature Flag:**

Enable React leads table via:

- localStorage: `localStorage.setItem('feature_react_leads_table', 'true')`
- URL param: `?react_leads=true`

---

### React + Shadcn/ui Migration - Phase 7 COMPLETE

Added bulk delete confirmation modal to both Projects and Leads tables.

**Completed (Feb 21, 2026):**

- [x] Installed Shadcn alert-dialog component
- [x] Created ConfirmDialog portal component with variants (danger, warning, info)
- [x] Created useConfirmDialog hook for managing dialog state
- [x] Added bulkDelete to useProjects hook
- [x] Added bulkDelete to useLeads hook
- [x] Integrated delete button in BulkActionsToolbar for both tables
- [x] Added confirmation dialog before bulk delete

**Files Created:**

- `/src/react/components/ui/alert-dialog.tsx` - Shadcn alert dialog
- `/src/react/components/portal/ConfirmDialog.tsx` - Portal-styled confirmation dialog

**Files Modified:**

- `/src/react/components/portal/index.ts` - Added ConfirmDialog export
- `/src/react/hooks/useProjects.ts` - Added bulkDelete function
- `/src/react/hooks/useLeads.ts` - Added bulkDelete function
- `/src/react/features/admin/projects/ProjectsTable.tsx` - Added delete with confirmation
- `/src/react/features/admin/leads/LeadsTable.tsx` - Added delete with confirmation

**ConfirmDialog Features:**

| Feature | Description |
|---------|-------------|
| Variants | danger (red), warning (yellow), info (blue) |
| Loading State | Shows spinner during async action |
| Icon | Contextual icon based on variant |
| useConfirmDialog | Hook for managing open/loading state |

**Usage:**

```typescript
const deleteDialog = useConfirmDialog();

<BulkActionsToolbar
  onDelete={deleteDialog.open}
  deleteLoading={deleteDialog.isLoading}
/>

<ConfirmDialog
  open={deleteDialog.isOpen}
  onOpenChange={deleteDialog.setIsOpen}
  title="Delete Items"
  description="Are you sure? This cannot be undone."
  confirmText="Delete"
  onConfirm={handleBulkDelete}
  variant="danger"
  loading={deleteDialog.isLoading}
/>
```

---

### React + Shadcn/ui Migration - Phase 8 COMPLETE

Added CSV export functionality to React tables.

**Completed (Feb 21, 2026):**

- [x] Created useExport hook wrapping existing table-export.ts utility
- [x] Added export button to ProjectsTable (Download icon, disabled when no data)
- [x] Added export button to LeadsTable
- [x] Re-exported PROJECTS_EXPORT_CONFIG and LEADS_EXPORT_CONFIG for convenience
- [x] Shows success notification with exported row count

**Files Created:**

- `/src/react/hooks/useExport.ts` - Export hook with loading state

**Files Modified:**

- `/src/react/features/admin/projects/ProjectsTable.tsx` - Added export button
- `/src/react/features/admin/leads/LeadsTable.tsx` - Added export button

**Usage:**

```typescript
import { useExport, PROJECTS_EXPORT_CONFIG } from '@react/hooks/useExport';

const { exportCsv, isExporting } = useExport({
  config: PROJECTS_EXPORT_CONFIG,
  data: filteredProjects,
  onExport: (count) => {
    showNotification?.(`Exported ${count} projects to CSV`, 'success');
  },
});

<PortalButton onClick={exportCsv} loading={isExporting} disabled={data.length === 0}>
  <Download className="tw-h-4 tw-w-4" />
</PortalButton>
```

**Export Features:**

| Feature | Description |
|---------|-------------|
| Filtered Export | Exports currently filtered data, not all data |
| Loading State | Button shows spinner during export |
| Disabled State | Button disabled when no data to export |
| Success Notification | Shows count of exported items |
| Existing Configs | Reuses PROJECTS_EXPORT_CONFIG, LEADS_EXPORT_CONFIG from table-export.ts |

---

### React + Shadcn/ui Migration - Phase 9 COMPLETE

Added Clients table to React following same patterns as Projects and Leads tables.

**Completed (Feb 21, 2026):**

- [x] Added Client types to admin types (ClientStatus, Client, ClientStats, CLIENT_STATUS_CONFIG)
- [x] Created useClients hook (fetch, update, archive, delete, sendInvite)
- [x] Created ClientsTable component with full features:
  - Stats bar (total, active, pending, inactive)
  - Search input
  - Filter dropdowns (status, type)
  - Sortable column headers
  - Status dropdown in table (change status inline)
  - Pagination with page size selector
  - Checkbox selection and bulk actions (archive, delete)
  - Send invitation button for uninvited clients
  - CSV export
  - Loading skeleton and empty states
  - GSAP fade-in animation
- [x] Created mount function with feature flag support
- [x] Integrated into admin-clients.ts with code-splitting

**Files Created:**

- `/src/react/hooks/useClients.ts` - Clients data hook
- `/src/react/features/admin/clients/ClientsTable.tsx` - Main component
- `/src/react/features/admin/clients/mount.tsx` - Island mount function
- `/src/react/features/admin/clients/index.ts` - Feature exports

**Files Modified:**

- `/src/react/features/admin/types.ts` - Added Client types
- `/src/react/features/admin/index.ts` - Added clients exports
- `/src/features/admin/modules/admin-clients.ts` - React integration (~50 lines)

**Feature Flag:**

Enable React clients table via:

- localStorage: `localStorage.setItem('feature_react_clients_table', 'true')`
- URL param: `?react_clients=true`

**Clients Table Features:**

| Feature | Description |
|---------|-------------|
| Display Name Logic | Business: company (contact), Personal: contact (company) |
| Invitation Status | Shows "Not Invited", "Invited", or "Active" based on status |
| Send Invite | Button appears for uninvited clients |
| Bulk Archive | Sets status to inactive (can be restored) |
| Bulk Delete | Permanently deletes clients with confirmation |

---

### React + Shadcn/ui Migration - Phase 10 COMPLETE

Added Invoices table to React following same patterns as other admin tables.

**Completed (Feb 21, 2026):**

- [x] Added Invoice types to admin types (InvoiceStatus, Invoice, InvoiceStats, INVOICE_STATUS_CONFIG)
- [x] Created useInvoices hook (fetch, update, markAsPaid, sendInvoice, downloadPdf, bulk actions)
- [x] Created InvoicesTable component with full features:
  - Stats bar (total, pending, paid, overdue)
  - Search input
  - Filter dropdown (status)
  - Sortable column headers
  - Overdue detection (automatically shows overdue status)
  - Contextual action buttons (Send for drafts, Mark Paid for pending, Download PDF)
  - Pagination with page size selector
  - Checkbox selection and bulk actions (mark paid, send, delete)
  - CSV export
  - Loading skeleton and empty states
  - GSAP fade-in animation
- [x] Created mount function with feature flag support
- [x] Integrated into admin-invoices.ts with code-splitting

**Files Created:**

- `/src/react/hooks/useInvoices.ts` - Invoices data hook
- `/src/react/features/admin/invoices/InvoicesTable.tsx` - Main component
- `/src/react/features/admin/invoices/mount.tsx` - Island mount function
- `/src/react/features/admin/invoices/index.ts` - Feature exports

**Files Modified:**

- `/src/react/features/admin/types.ts` - Added Invoice types
- `/src/react/features/admin/index.ts` - Added invoices exports
- `/src/features/admin/modules/admin-invoices.ts` - React integration (~50 lines)

**Feature Flag:**

Enable React invoices table via:

- localStorage: `localStorage.setItem('feature_react_invoices_table', 'true')`
- URL param: `?react_invoices=true`

**Invoices Table Features:**

| Feature | Description |
|---------|-------------|
| Overdue Detection | Automatically shows "Overdue" status for unpaid invoices past due date |
| Contextual Actions | Different buttons based on status (Draft: Send, Pending: Mark Paid, All: Download PDF) |
| Bulk Mark Paid | Mark multiple invoices as paid with confirmation |
| Bulk Send | Send multiple draft invoices |
| PDF Download | Download invoice as PDF file |

---

### React + Shadcn/ui Migration - Phase 11 COMPLETE

Added date picker support to InlineEdit component and updated InvoicesTable to use inline date editing.

**Completed (Feb 21, 2026):**

- [x] Added `formatDateForDisplay()` helper - formats dates as "Jan 15, 2025"
- [x] Added `formatDateForInput()` helper - formats dates as YYYY-MM-DD for HTML date inputs
- [x] Added `parseDateInput()` helper - parses date input to ISO string
- [x] Updated InlineEdit to support `type="date"` with native date picker
- [x] Date input converts YYYY-MM-DD to ISO string on save
- [x] Updated InvoicesTable due date column to use InlineEdit with date type
- [x] Due date editing disabled for paid invoices

**Files Modified:**

- `/src/react/components/portal/InlineEdit.tsx` - Added date support (~50 lines)
- `/src/react/features/admin/invoices/InvoicesTable.tsx` - Added inline date editing

**InlineEdit Date Features:**

| Feature | Description |
|---------|-------------|
| Native Date Picker | Uses browser's native date input (type="date") |
| Auto-formatting | Display shows "Jan 15, 2025", input uses YYYY-MM-DD |
| ISO Output | Saves dates as ISO strings for API compatibility |
| Min-width | 140px to accommodate calendar icon |

---

### React + Shadcn/ui Migration - Phase 12 COMPLETE

Created shared DataTable component for reusable table abstraction.

**Completed (Feb 21, 2026):**

- [x] Created DataTable types (ColumnConfig, FilterConfig, StatItem, BulkActionConfig, RowActionConfig)
- [x] Created DataTable component with all common features:
  - Stats bar
  - Search and filter dropdowns
  - Sortable column headers
  - Pagination controls
  - Row selection with checkboxes
  - Bulk actions toolbar with delete confirmation
  - Export to CSV
  - Loading and empty states
  - GSAP fade-in animation
- [x] Exported DataTable and types from portal components index
- [x] Exported date formatting helpers from InlineEdit

**Files Created:**

- `/src/react/components/portal/DataTable/types.ts` - Type definitions
- `/src/react/components/portal/DataTable/DataTable.tsx` - Main component (~400 lines)
- `/src/react/components/portal/DataTable/index.ts` - Exports

**Files Modified:**

- `/src/react/components/portal/index.ts` - Added DataTable and date helper exports

**DataTable vs Entity-Specific Tables:**

The existing 4 tables (Projects, Leads, Clients, Invoices) have complex entity-specific rendering that benefits from their full customization:
- Custom status dropdowns with entity-specific configs
- Bulk status change with entity-specific options
- Inline editing (Projects has budget, Invoices has due date)
- Row actions vary by status (Invoices: Send/MarkPaid/Download)
- Complex cell layouts (nested contact+email, company+phone)

The shared DataTable component is ideal for:
- New simpler tables without complex custom cells
- Admin tables with standard rendering
- Tables that don't need inline status dropdowns

**Shared Patterns Across Existing Tables:**

All 4 tables successfully share these hooks (no duplication needed):
- `useTableFilters` - Search, filter, sort with localStorage
- `usePagination` - Page size, navigation
- `useSelection` - Row selection state
- `useExport` - CSV export
- `useFadeIn` - GSAP animation
- `useConfirmDialog` - Confirmation modal state

---

### React + Shadcn/ui Migration - Phase 13 COMPLETE

Added project detail views in React with tabbed interface.

**Completed (Feb 21, 2026):**

- [x] Added project detail types (ProjectMilestone, ProjectTask, ProjectFile, Message, MessageThread)
- [x] Added PROJECT_DETAIL_TABS configuration
- [x] Created useProjectDetail hook with full CRUD operations:
  - Fetch project, milestones, files, invoices, messages
  - Update project
  - Add/update/delete/toggle milestones
  - Upload/delete/toggle sharing for files
  - Send/load messages
  - Computed progress, outstanding balance, total paid
- [x] Created ProjectDetail component with:
  - 8-tab navigation (Overview, Files, Deliverables, Messages, Invoices, Tasks, Contract, Notes)
  - Header with status dropdown, edit button, more menu
  - Archive and delete with confirmation dialogs
- [x] Created all 8 tabs:
  - OverviewTab - Project details, milestones, client info, financials
  - FilesTab - Drag-drop upload, file list, sharing toggle
  - DeliverablesTab - Deliverables grouped by milestone with progress
  - MessagesTab - Thread-based messaging with send functionality
  - InvoicesTab - Invoice list with filtering, send/mark paid/download
  - TasksTab - Milestone management with progress bar
  - ContractTab - Contract status, terms, contract files
  - NotesTab - Internal admin notes with Ctrl+S save
- [x] Created mount function with feature flag support

**Files Created:**

- `/src/react/hooks/useProjectDetail.ts` - Project detail data hook (~560 lines)
- `/src/react/features/admin/project-detail/ProjectDetail.tsx` - Main component (~450 lines)
- `/src/react/features/admin/project-detail/tabs/OverviewTab.tsx` - Overview tab (~400 lines)
- `/src/react/features/admin/project-detail/tabs/FilesTab.tsx` - Files tab (~375 lines)
- `/src/react/features/admin/project-detail/tabs/DeliverablesTab.tsx` - Deliverables tab (~200 lines)
- `/src/react/features/admin/project-detail/tabs/MessagesTab.tsx` - Messages tab (~200 lines)
- `/src/react/features/admin/project-detail/tabs/InvoicesTab.tsx` - Invoices tab (~445 lines)
- `/src/react/features/admin/project-detail/tabs/TasksTab.tsx` - Tasks tab (~425 lines)
- `/src/react/features/admin/project-detail/tabs/ContractTab.tsx` - Contract tab (~280 lines)
- `/src/react/features/admin/project-detail/tabs/NotesTab.tsx` - Notes tab (~125 lines)
- `/src/react/features/admin/project-detail/tabs/index.ts` - Tab exports
- `/src/react/features/admin/project-detail/mount.tsx` - Island mount function
- `/src/react/features/admin/project-detail/index.ts` - Feature exports

**Files Modified:**

- `/src/react/features/admin/types.ts` - Added project detail types (~100 lines)
- `/src/react/features/admin/index.ts` - Added project-detail exports

**Feature Flag:**

Enable React project detail via:

- localStorage: `localStorage.setItem('feature_react_project_detail', 'true')`
- URL param: `?react_project_detail=true`

**Tab Features:**

| Tab | Features |
|-----|----------|
| Overview | Project details, URLs, milestones with progress, client info, financials |
| Files | Drag-drop upload, category selection, sharing toggle, download/delete |
| Deliverables | Deliverables grouped by milestone, completion status, progress bar |
| Messages | Real-time messaging, sender differentiation, Cmd+Enter to send |
| Invoices | Filtering by status, overdue detection, send/mark paid/download PDF |
| Tasks | Milestone management, add/edit/delete, progress tracking |
| Contract | Contract status, value/timeline display, contract files |
| Notes | Internal notes editor, auto-save on Ctrl+S |

---

### React + Shadcn/ui Migration - Phase 14 COMPLETE

Integrated React ProjectDetail into admin-project-details.ts with code-splitting.

**Completed (Feb 21, 2026):**

- [x] Added dynamic import for React ProjectDetail module (code-splitting)
- [x] Added feature flag check function `shouldUseReactProjectDetail()`
- [x] Added lazy load function `loadReactProjectDetail()`
- [x] Added cleanup function `cleanupReactProjectDetail()`
- [x] Modified `renderProjectDetailTab()` to conditionally render React mount container
- [x] Modified `showProjectDetails()` to mount React when feature flag enabled
- [x] Added `mountReactProjectDetail()` method with fallback to vanilla
- [x] Added `unmountProjectDetail` function to mount.tsx for cleanup
- [x] Wired up callbacks (onBack, onEdit, showNotification)

**Files Modified:**

- `/src/features/admin/admin-project-details.ts` - React integration (~100 lines)
- `/src/react/features/admin/project-detail/mount.tsx` - Added unmountProjectDetail
- `/src/react/features/admin/project-detail/index.ts` - Export unmountProjectDetail

**Feature Flag:**

Enable React project detail via:

- localStorage: `localStorage.setItem('feature_react_project_detail', 'true')`
- URL param: `?react_project_detail=true`

**Code-Splitting Implementation:**

```typescript
// Dynamic import - React bundle loads only when feature flag enabled
type ReactMountFn = typeof import('../../react/features/admin/project-detail').mountProjectDetail;
let mountProjectDetail: ReactMountFn | null = null;

async function loadReactProjectDetail(): Promise<boolean> {
  if (mountProjectDetail) return true;
  const module = await import('../../react/features/admin/project-detail');
  mountProjectDetail = module.mountProjectDetail;
  return true;
}
```

**How to Test:**

1. Start dev server: `npm run dev:full`
2. Login to admin dashboard
3. Enable React project detail:
   - Option A: Add `?react_project_detail=true` to URL
   - Option B: Run in console: `localStorage.setItem('feature_react_project_detail', 'true')`
4. Click on a project to view details
5. Verify React implementation renders with all 8 tabs

**What Works:**

- Full project detail view with all 8 tabs
- Tab navigation (Overview, Files, Deliverables, Messages, Invoices, Tasks, Contract, Notes)
- Status dropdown to change project status
- Edit button opens existing edit modal
- Back button returns to projects list
- Archive/delete with confirmation dialogs
- File upload with drag-drop
- Milestone management
- Message sending
- Invoice list with actions
- Notes with auto-save

**Next Steps (Future):**

1. Add remaining features (time tracking tab if needed)
2. Polish and test all tab functionality
3. Consider removing vanilla implementation once React is stable

---

### React + Shadcn/ui Migration - Phase 15 COMPLETE

Added client detail views in React with tabbed interface.

**Completed (Feb 21, 2026):**

- [x] Added client detail types (ClientHealth, ClientContact, ClientActivity, ClientNote, ClientDetailStats, ClientProject, ClientTag)
- [x] Added CLIENT_DETAIL_TABS configuration
- [x] Created useClientDetail hook with full CRUD operations:
  - Fetch client, health, contacts, activities, notes, stats, projects, tags
  - Update client
  - Add/update/delete contacts
  - Add/update/delete notes, toggle pin
  - Add/remove tags
  - Send invitation
- [x] Created ClientDetail component with:
  - 5-tab navigation (Overview, Contacts, Activity, Projects, Notes)
  - Header with status dropdown, edit button, more menu
  - Archive and delete with confirmation dialogs
- [x] Created all 5 tabs:
  - OverviewTab - Health score, stats, tags, client info
  - ContactsTab - Contact management with CRUD, primary contact setting
  - ActivityTab - Activity timeline grouped by date
  - ProjectsTab - Client's projects with status, progress
  - NotesTab - Internal notes with pin/unpin functionality
- [x] Created mount function with feature flag support
- [x] Integrated into admin-client-details.ts with code-splitting
- [x] Created PortalInput component for form inputs
- [x] Fixed Vite React plugin preamble detection error (see Architecture below)
- [x] Fixed CSP for localhost:4001 in development mode
- [x] Fixed getStatusVariant null check for undefined status
- [x] Fixed OverviewTab health.factors conditional guard
- [x] Fixed API response parsing (client, health, stats wrapped in objects)
- [x] Downgraded Tailwind v4 → v3.4 (v4 uses colon prefix which broke all components)
- [x] Fixed Tailwind spacing scale (was using wrong values)
- [x] Pre-generated Tailwind CSS to avoid @layer conflicts with existing CSS
- [x] Hidden vanilla header tabs when React mounts
- [x] Added tailwind:watch script for development

**Files Created:**

- `/src/react/hooks/useClientDetail.ts` - Client detail data hook (~600 lines)
- `/src/react/features/admin/client-detail/ClientDetail.tsx` - Main component (~435 lines)
- `/src/react/features/admin/client-detail/tabs/OverviewTab.tsx` - Overview tab (~390 lines)
- `/src/react/features/admin/client-detail/tabs/ContactsTab.tsx` - Contacts tab (~380 lines)
- `/src/react/features/admin/client-detail/tabs/ActivityTab.tsx` - Activity tab (~180 lines)
- `/src/react/features/admin/client-detail/tabs/ProjectsTab.tsx` - Projects tab (~150 lines)
- `/src/react/features/admin/client-detail/tabs/NotesTab.tsx` - Notes tab (~275 lines)
- `/src/react/features/admin/client-detail/tabs/index.ts` - Tab exports
- `/src/react/features/admin/client-detail/mount.tsx` - Island mount function
- `/src/react/features/admin/client-detail/index.ts` - Feature exports
- `/src/react/components/portal/PortalInput.tsx` - Portal-styled input component
- `/src/react/registry.ts` - Global registry for React mount functions
- `/src/react/admin-entry.tsx` - React entry point loaded via script tag
- `/src/react/styles/tailwind-generated.css` - Pre-generated Tailwind CSS (gitignored)

**Files Modified:**

- `/src/react/features/admin/types.ts` - Added client detail types (~100 lines)
- `/src/features/admin/modules/admin-client-details.ts` - React integration using registry pattern
- `/src/features/admin/modules/admin-clients.ts` - Exported editClientInfo function
- `/server/views/layouts/portal.ejs` - Added React admin entry script tag
- `/vite.config.ts` - Removed React plugin, using esbuild JSX transformation
- `/server/app.ts` - Added localhost:4001 to CSP connect-src in development
- `/src/react/components/portal/StatusBadge.tsx` - Added null check for undefined status

**Architecture: Island Pattern with Global Registry**

The Vite React plugin preamble detection error occurred when dynamically importing React components from vanilla TypeScript files. The Fast Refresh mechanism fails when imports cross the .ts → .tsx boundary.

Solution implemented:

1. **Global Registry** (`/src/react/registry.ts`): Pure TypeScript file that stores React mount functions without importing any React/TSX code.

2. **React Entry Point** (`/src/react/admin-entry.tsx`): Loaded via separate `<script type="module">` tag in portal.ejs. Registers React components to the global registry.

3. **esbuild JSX**: Removed `@vitejs/plugin-react` entirely. Using esbuild's built-in JSX transformation (`jsx: 'automatic'`, `jsxImportSource: 'react'`).

4. **Vanilla Code**: Uses `getReactComponent('clientDetail')` from registry instead of dynamic imports.

```typescript
// registry.ts - Pure TS, no React imports
export function getReactComponent<K extends keyof ReactRegistry>(name: K): ReactRegistry[K] | undefined {
  return window.__REACT_REGISTRY__?.[name];
}

// admin-entry.tsx - Loaded via script tag
import { registerReactComponent } from './registry';
import { mountClientDetail, unmountClientDetail } from './features/admin/client-detail';
registerReactComponent('clientDetail', { mount: mountClientDetail, unmount: unmountClientDetail });

// admin-client-details.ts - Vanilla code
const component = getReactComponent('clientDetail');
if (component) component.mount(container, options);
```

**Feature Flag:**

React detail views are now **enabled by default** for both ClientDetail and ProjectDetail.

To use vanilla implementation:

- ClientDetail: `?vanilla_client_detail=true` or `localStorage.setItem('feature_react_client_detail', 'false')`
- ProjectDetail: `?vanilla_project_detail=true` or `localStorage.setItem('feature_react_project_detail', 'false')`

**Tab Features:**

| Tab | Features |
|-----|----------|
| Overview | Health score with factor breakdown, stats grid, tags management, client info |
| Contacts | CRUD for contacts, set primary contact, role badges |
| Activity | Timeline grouped by date, activity type icons, relative timestamps |
| Projects | Project cards with status, progress bars, click to navigate |
| Notes | Add/edit/delete notes, pin/unpin, sorted by pin status then date |

**How to Test:**

1. Start dev server: `npm run dev:full`
2. Login to admin dashboard
3. React components are enabled by default
4. Click on a client to view details
5. Verify React implementation renders with all 5 tabs

---

### React + Shadcn/ui Migration - Phase 16 COMPLETE

Enabled React tables and detail views by default with vanilla fallback.

**Completed (Feb 21, 2026):**

- [x] Updated admin-projects.ts to enable React table by default
- [x] Updated admin-leads.ts to enable React table by default
- [x] Updated admin-clients.ts to enable React table by default
- [x] Updated admin-invoices.ts to enable React table by default
- [x] Fixed ClientDetail tab styling to match vanilla portal header tabs

**Files Modified:**

- `/src/features/admin/modules/admin-projects.ts` - React enabled by default
- `/src/features/admin/modules/admin-leads.ts` - React enabled by default
- `/src/features/admin/modules/admin-clients.ts` - React enabled by default
- `/src/features/admin/modules/admin-invoices.ts` - React enabled by default
- `/src/react/features/admin/client-detail/ClientDetail.tsx` - Tab styling fix

**Feature Flags:**

All React components are now **enabled by default**. To fall back to vanilla implementation:

| Component | Vanilla Fallback URL Param | localStorage Flag |
|-----------|---------------------------|-------------------|
| Projects Table | `?vanilla_projects=true` | `feature_react_projects_table=false` |
| Leads Table | `?vanilla_leads=true` | `feature_react_leads_table=false` |
| Clients Table | `?vanilla_clients=true` | `feature_react_clients_table=false` |
| Invoices Table | `?vanilla_invoices=true` | `feature_react_invoices_table=false` |
| Project Detail | `?vanilla_project_detail=true` | `feature_react_project_detail=false` |
| Client Detail | `?vanilla_client_detail=true` | `feature_react_client_detail=false` |
| Portal Invoices | `?vanilla_portal_invoices=true` | `feature_react_portal_invoices=false` |

---

### React Component Tailwind Rebuild - COMPLETE

Rebuilt all React components to use pure Tailwind/Shadcn styling instead of vanilla CSS classes.

**Completed (Feb 22, 2026):**

- [x] Updated DataTable component with Tailwind classes for container, stats bar, filters, pagination
- [x] Updated ProjectsTable with Tailwind classes (stats, filters, pagination)
- [x] Updated LeadsTable with Tailwind classes (stats, filters, pagination)
- [x] Updated ClientsTable with Tailwind classes (stats, filters, pagination)
- [x] Updated InvoicesTable with Tailwind classes (stats, filters, pagination)
- [x] Updated BulkActionsToolbar with Tailwind classes
- [x] Updated ProjectDetail with Tailwind classes (header, tabs, content)
- [x] Updated ClientDetail with Tailwind classes (header, tabs, content)
- [x] Updated AdminTable with Tailwind classes (table wrapper, header, rows, cells, empty/loading states)
- [x] Verified all portal components use Tailwind: PortalButton, PortalDropdown, PortalInput, InlineEdit, StatusBadge, ConfirmDialog, PortalModal
- [x] Verified all tab components use Tailwind: OverviewTab, FilesTab, TasksTab, NotesTab, MessagesTab, ContactsTab, etc.
- [x] Converted all table column/cell semantic classes to Tailwind width utilities
- [x] Converted identity-cell layouts (name/email stacking) to Tailwind flex layout
- [x] Converted status-dropdown-trigger to Tailwind transparent button
- [x] Converted table-actions containers to Tailwind flex layout
- [x] Kept existing vanilla CSS files as reference

**Styling Pattern:**

All React components now use inline Tailwind classes with the `tw-` prefix and CSS variables for theming:

```tsx
// Stats bar
<div className="tw-flex tw-items-center tw-gap-6 tw-text-sm tw-text-[var(--portal-text-muted)]">

// Search input
<input className="tw-w-full tw-pl-10 tw-pr-3 tw-py-2 tw-text-sm tw-bg-[var(--portal-bg-dark)] tw-border tw-border-[var(--portal-border)] tw-rounded-md ..." />

// Filter dropdown
<select className="tw-px-3 tw-py-2 tw-text-sm tw-bg-[var(--portal-bg-dark)] tw-border ..." />

// Pagination
<div className="tw-mt-4 tw-py-3 tw-px-4 tw-bg-[var(--portal-bg-medium)] tw-rounded-lg tw-border ..." />

// Tabs
<button className={cn(
  'tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-3 tw-text-sm tw-font-medium tw-border-b-2',
  isActive ? 'tw-border-[var(--color-brand-primary)] tw-text-[var(--color-brand-primary)]' : '...'
)} />

// AdminTable cells
<td className="tw-px-4 tw-py-3 tw-text-sm tw-text-[var(--portal-text-primary)]" />

// AdminTable header
<th className="tw-px-4 tw-py-3 tw-text-left tw-text-xs tw-font-medium tw-text-[var(--portal-text-muted)] tw-uppercase" />

// Table column widths
<AdminTableHead className="tw-w-12" />           // Checkbox column
<AdminTableHead className="tw-min-w-[200px]" />  // Name/identity column
<AdminTableHead className="tw-w-28" />           // Type/date columns
<AdminTableHead className="tw-w-32" />           // Status column
<AdminTableHead className="tw-w-24" />           // Actions column

// Identity cell with stacked name/email
<AdminTableCell className="tw-min-w-[200px]">
  <div className="tw-flex tw-flex-col tw-gap-0.5">
    <span className="tw-font-medium tw-text-[var(--portal-text-primary)]">{name}</span>
    <span className="tw-text-xs tw-text-[var(--portal-text-muted)]">{email}</span>
  </div>
</AdminTableCell>

// Status dropdown trigger
<button className="tw-bg-transparent tw-border-none tw-p-0 tw-cursor-pointer">

// Table actions container
<div className="tw-flex tw-items-center tw-gap-1">
```

**Key Benefits:**

- No dependency on vanilla CSS classes for React components
- Consistent styling using Tailwind utilities
- CSS variables maintain design token integration
- Old CSS files preserved as reference

**Components Fully Converted:**

| Component | Status |
|-----------|--------|
| DataTable | Tailwind |
| ProjectsTable | Tailwind |
| LeadsTable | Tailwind |
| ClientsTable | Tailwind |
| InvoicesTable | Tailwind |
| BulkActionsToolbar | Tailwind |
| ProjectDetail | Tailwind |
| ClientDetail | Tailwind |
| AdminTable | Tailwind |
| PortalButton | Tailwind |
| PortalDropdown | Tailwind |
| PortalInput | Tailwind |
| InlineEdit | Tailwind |
| StatusBadge | Tailwind |
| ConfirmDialog | Tailwind |
| PortalModal | Tailwind |
| All Tab Components | Tailwind |

---

### React + Shadcn/ui Migration - Phase 17 COMPLETE

Completed full client portal React migration with all modules.

**Completed (Feb 24, 2026):**

- [x] Created portal-entry.tsx entry point for client portal React components
- [x] Extended registry.ts to support portal component types
- [x] Updated portal.ejs to load portal-entry.tsx for client portal
- [x] Created portal types (PortalInvoice, PortalFile, PortalProject, etc.)
- [x] Created all 11 portal React modules with island architecture

**Portal Modules Created:**

| Module | Components | Features |
|--------|------------|----------|
| Invoices | PortalInvoicesTable | Summary cards, download PDF/receipt, status badges |
| Projects | PortalProjectsList, PortalProjectDetail | Progress tracking, milestones, project cards |
| Files | PortalFilesManager, FileUploadDropzone | Drag-drop upload, file browser, categories |
| Messages | PortalMessagesView, MessageThread | Thread-based messaging, real-time updates |
| Questionnaires | PortalQuestionnairesView, QuestionnaireForm | Multi-step forms, validation, progress |
| Document Requests | PortalDocumentRequests, DocumentRequestCard | Request tracking, file upload for requests |
| Ad-Hoc Requests | PortalAdHocRequests, AdHocRequestCard, NewRequestForm | Create/track custom requests |
| Approvals | PortalApprovals, ApprovalCard | Approve/reject workflow, comments |
| Settings | PortalSettings, ProfileForm, BillingForm, NotificationsForm | Tabbed settings interface |
| Navigation | PortalSidebar, PortalHeader, NavItem | Responsive sidebar, mobile drawer |
| Onboarding | OnboardingWizard, StepIndicator, 5 step components | Multi-step wizard, progress tracking |

**Files Created:**

- `/src/react/features/portal/projects/` - PortalProjectsList, PortalProjectDetail, mount.tsx
- `/src/react/features/portal/files/` - PortalFilesManager, FileUploadDropzone, mount.tsx
- `/src/react/features/portal/messages/` - PortalMessagesView, MessageThread, usePortalMessages, mount.tsx
- `/src/react/features/portal/questionnaires/` - PortalQuestionnairesView, QuestionnaireForm, mount.tsx
- `/src/react/features/portal/document-requests/` - PortalDocumentRequests, DocumentRequestCard, mount.tsx
- `/src/react/features/portal/ad-hoc-requests/` - PortalAdHocRequests, AdHocRequestCard, NewRequestForm, mount.tsx
- `/src/react/features/portal/approvals/` - PortalApprovals, ApprovalCard, mount.tsx
- `/src/react/features/portal/settings/` - PortalSettings, ProfileForm, BillingForm, NotificationsForm, mount.tsx
- `/src/react/features/portal/navigation/` - PortalSidebar, PortalHeader, NavItem, mount.tsx
- `/src/react/features/portal/onboarding/` - OnboardingWizard, StepIndicator, 5 step components, mount.tsx

**Files Modified:**

- `/src/react/features/portal/index.ts` - Added exports for all 11 modules
- `/src/react/features/portal/types.ts` - Extended with all portal types

**Styling Pattern (Compact - Matching Admin):**

All portal components use Tailwind with `tw-` prefix and compact spacing:

```tsx
// Compact text sizes
tw-text-[12px]  // Base text
tw-text-[11px]  // Secondary text

// Compact spacing
tw-gap-2, tw-gap-3  // Element gaps
tw-p-3, tw-p-4      // Container padding

// Compact icons
tw-h-3.5 tw-w-3.5   // Standard icons
tw-h-4 tw-w-4       // Large icons

// CSS variable theming
var(--portal-text-primary)
var(--portal-bg-dark)
var(--status-active)
```

**Island Architecture Pattern:**

Each module exports:
- `mount(container, options)` - Mount React component
- `unmount(container)` - Cleanup React root
- `shouldUseReact*()` - Feature flag check

---

### React Tables Bug Fixes - COMPLETE

Fixed StatusBadge styling and React table mounting race conditions.

**Completed (Feb 21, 2026):**

- [x] Fixed StatusBadge to use dot + text style (matching vanilla `.status-indicator`)
- [x] Fixed React table mounting race condition in admin-projects.ts
- [x] Fixed React table mounting race condition in admin-leads.ts
- [x] Added `isReactTableActuallyMounted()` check to detect stale mount state
- [x] Regenerated Tailwind CSS

**Files Modified:**

- `/src/react/components/portal/StatusBadge.tsx` - Rewrote to use dot + text style
- `/src/react/components/portal/index.ts` - Updated exports (removed statusBadgeVariants)
- `/src/features/admin/modules/admin-projects.ts` - Added mount container tracking
- `/src/features/admin/modules/admin-leads.ts` - Added mount container tracking

**StatusBadge Style:**

The StatusBadge now renders as a colored dot followed by text, matching the vanilla `.status-indicator` CSS:

```tsx
// Renders: [green dot] Active
<StatusBadge status="active">Active</StatusBadge>
```

**Mount Fix:**

Added `isReactTableActuallyMounted()` function that checks:

1. `reactTableMounted` flag is true
2. Container element still exists in DOM (`isConnected`)
3. Container has child elements (React root rendered)

This fixes intermittent display issues when switching between tabs.

---

### UI Consistency Fixes - COMPLETE

Fixed visual inconsistencies in Settings page and standardized empty/loading states.

**Completed (Feb 20-21, 2026):**

- [x] Fixed Settings page system-info-row background (now uses `--portal-bg-dark` in admin context)
- [x] Added icon to empty states via CSS `::before` (automatic for ALL `.empty-state` elements)
- [x] Empty state icon matches loading state spinner and error state icon patterns
- [x] Created `getContainerEmptyHTML()` and `showContainerEmpty()` utilities (for explicit usage)
- [x] Added `:has()` selector to skip CSS icon when manual SVG already present
- [x] Exported new utilities from components/index.ts

**Files Modified:**

- `src/styles/shared/details-card.css` - Admin-specific darker background override
- `src/utils/loading-utils.ts` - Added icon and container empty state functions
- `src/styles/components/loading.css` - Added `.empty-state::before` with Lucide inbox SVG (automatic icon)
- `src/components/index.ts` - Exported new utilities

**Implementation Pattern:**

```css
/* All three state types use ::before for automatic icons */
.loading-state::before { /* 24x24 spinner */ }
.error-state::before { /* 24x24 warning triangle (red) */ }
.empty-state::before { /* 24x24 inbox icon (gray) */ }

/* Small variants use 16x16 icons */
.empty-state-small::before { /* 16x16 inbox icon */ }

/* Skip if manual icon/SVG present */
.empty-state:has(svg)::before { display: none; }
```

**Standardized Properties:**

| Property | Value |
|----------|-------|
| Icon size | 24x24 (standard), 16x16 (small) |
| Font size | `var(--font-size-xs)` (inherited) |
| Color | `var(--portal-text-muted)` |
| Text style | italic |

**Impact:** ALL loading/error/empty states now have consistent icon + text pattern. CSS handles icons automatically - no code changes needed.

---

### Design Documentation Consolidation - COMPLETE

Consolidated CSS_ARCHITECTURE.md (~2,262 lines) and UX_GUIDELINES.md (~1,087 lines) into single DESIGN_SYSTEM.md.

**Completed (Feb 20, 2026):**

- [x] Created unified `docs/design/DESIGN_SYSTEM.md` with organized sections
- [x] Removed duplicate content between the two files
- [x] Updated all references in feature docs, README.md, ANIMATIONS.md, etc.
- [x] Deleted old `CSS_ARCHITECTURE.md` and `UX_GUIDELINES.md`

**New Structure:**

1. Philosophy & Principles (Dieter Rams)
2. Design Tokens (colors, typography, spacing, shadows, z-index)
3. CSS Architecture (portal scope, bundles, naming, themes)
4. Components (buttons, forms, cards, tables, modals, badges)
5. Layout Patterns (page structure, table structure, action order)
6. Utility Classes (atomic, semantic, grid)
7. Responsive Design (breakpoints, column stacking)
8. Accessibility & States
9. Icon Usage (no emojis rule, mappings)
10. User Preferences & Policies (!important policy)
11. File Organization
12. Audit History

**Impact:** Single source of truth for design system, no duplicate content, easier maintenance.

---

### Tasks Module Unification - COMPLETE

Unified Tasks module to match standard admin table patterns used by other modules.

**Completed (Feb 20, 2026):**

- [x] Converted Tasks list view from custom `.task-list-*` grid to standard `.admin-table`
- [x] Updated `admin-tasks.ts` to use `<table>` with standard column classes
- [x] Updated `admin-global-tasks.ts` to use unified class names
- [x] Updated `admin-overview.ts` to use standard `.empty-state`
- [x] Removed ~114 lines of orphaned CSS from `tasks.css`:
  - Custom `.task-list-container`, `.task-list-header`, `.task-list-item` grid
  - Orphaned `.form-dropdown` styles (now uses `createModalDropdown`)
  - Orphaned responsive rules for removed grid classes
- [x] Tasks now uses event delegation like other table modules

**Files Modified:**

- `src/features/admin/modules/admin-tasks.ts` - Standard table pattern
- `src/features/admin/modules/admin-global-tasks.ts` - Unified class names
- `src/features/admin/modules/admin-overview.ts` - Standard empty-state
- `src/styles/admin/tasks.css` - Removed 99 lines of custom grid CSS

**Impact:** Tasks list view now matches Leads, Contracts, Invoices table patterns. Total CSS: 48,439 lines (down from 51,493).

---

### Email Templates Filter Unification - COMPLETE

Converted Email Templates from custom tab-style category buttons to standard dropdown filter pattern, matching all other admin tables.

**Completed (Feb 20, 2026):**

- [x] Added `EMAIL_TEMPLATES_FILTER_CONFIG` to `table-filter.ts`
- [x] Updated `admin-email-templates.ts` to use `createFilterUI()` and `applyFilters()`
- [x] Replaced custom category tabs HTML with filter container in `admin-workflows.ts`
- [x] Removed 37 lines of custom `.template-category-tabs` CSS from `workflows.css` (including responsive rules)
- [x] Filter state persists to localStorage via standard pattern

**Files Modified:**

- `src/utils/table-filter.ts` - Added EMAIL_TEMPLATES_FILTER_CONFIG
- `src/features/admin/modules/admin-email-templates.ts` - Standard filter integration
- `src/features/admin/modules/admin-workflows.ts` - Replaced tabs with filter container
- `src/styles/admin/workflows.css` - Removed custom tab styles

**Impact:** Consistent UX across all admin tables, reduced custom code, better maintainability.

---

### Portal HTML/CSS Unification - COMPLETE

Unified HTML component patterns across admin and client portal for seamless CSS application.

**Completed (Feb 20, 2026):**

- [x] Converted portal invoices from div-based to table format (`.admin-table.invoices-table`)
- [x] Added `.admin-table` class to portal files table for consistent styling
- [x] Added proper column classes (`.name-col`, `.date-col`, `.actions-col`) and `data-label` attributes
- [x] Removed redundant div-based invoice CSS (invoices.css simplified to ~40 lines)
- [x] Consolidated label aliases with unified label system (3 semantic classes: `.field-label`, `.section-label`, `.stat-label`)
- [x] Removed empty redirect files (table-dropdowns.css, modal-dropdown.css)
- [x] Updated CSS imports in admin/index.css, client-portal/index.css, unified-portal.css
- [x] Updated design system docs with unified label system documentation (now in DESIGN_SYSTEM.md)

**Files Modified:**

- `src/features/client/modules/portal-invoices.ts` - Table-based rendering
- `src/features/client/modules/portal-files.ts` - Added `.admin-table` class
- `src/styles/client-portal/invoices.css` - Simplified to table styles
- `src/styles/shared/portal-cards.css` - Unified label system
- `src/styles/admin/index.css` - Removed empty file imports
- `src/styles/client-portal/index.css` - Removed empty file imports
- `src/styles/bundles/unified-portal.css` - Removed empty file imports
- `docs/design/DESIGN_SYSTEM.md` - Label documentation (consolidated from CSS_ARCHITECTURE.md)

**Deleted Files:**

- `src/styles/admin/table-dropdowns.css` (empty redirect)
- `src/styles/admin/modal-dropdown.css` (empty redirect)

---

### CSS DRY Reduction - ONGOING

Reduced CSS codebase using utility classes and consolidation patterns.

**Current Status:**

- Total CSS: ~48,430 lines (down from 51,493 - ~3,063 lines removed)
- Created `src/styles/base/utilities.css` with atomic utility classes
- Consolidated portal-tables.css using `:is()` selector (886→652 lines)
- Migrated 39+ pure utility patterns to utility classes
- Documented two-tier utility system in DESIGN_SYSTEM.md

**February 20, 2026 Deep Codebase Audit:**

- [x] **CSS: Sidebar button consolidation** (~39 lines saved)
  - Combined `.sidebar-buttons .btn` and `.sidebar-footer .btn-logout` using `:is()`
  - Removed 80 lines of duplicate CSS in portal-buttons.css
- [x] **TypeScript: Removed duplicate debounce/throttle** from gsap-utilities.ts
  - Updated imports in form-validation.ts and page-transition.ts to use dom-utils.ts
  - Single source of truth for timing utilities
- [x] **TypeScript: Added loading state utilities**
  - Added `getLoadingStateHTML()` and `LOADING_STATE_HTML` to loading-utils.ts
  - Standardized pattern for 33+ inline loading state strings
- [x] **TypeScript: Added truncateText utility** to format-utils.ts
  - Consolidated 15+ scattered text truncation patterns

**February 20, 2026 CSS Audit & Consolidation:**

- [x] Invoice stylesheet consolidation (~69 lines saved)
  - Removed 3 duplicate `.invoice-summary` definitions from project-detail.css
  - Removed orphaned `.invoice-summary-item` styles (HTML uses `.summary-card`)
  - Consolidated admin invoice summary styles into pd-invoices.css
- [x] Consolidated collapsed sidebar button duplication (75+ lines saved)
  - Removed triplicate styles from portal-buttons.css (class-based, --wide-down, --compact-mobile)
  - Unified into single `:is()` selector pattern
- [x] Consolidated invoice list containers
  - Removed duplicate `.invoices-list` from client-portal/invoices.css and project-detail.css
  - Single source in pd-invoices.css for admin, portal-cards.css for shared
- [x] Consolidated task priority badge styles (35+ lines saved)
  - Unified `.task-priority` and `.task-priority-badge` in portal-cards.css
  - Removed duplicate from tasks.css
- [x] Created `--portal-card-padding` CSS variable
  - Replaced 10 hardcoded `13px 14px` instances across 4 files
  - Variable defined in variables.css
- [x] Consolidated milestone completed styling
  - Single `.milestone-item.completed` rule in portal-cards.css
  - Removed duplicates from project-detail.css and dashboard.css

**Previous February 20, 2026 Work:**

- [x] Unified stat-card/content-card patterns (portal-cards.css)
- [x] Consolidated empty-message italic rule (loading.css)
- [x] Replaced hardcoded border-radius with CSS variables (design-review.css, deliverables.css)
- [x] Replaced hardcoded colors with semantic tokens (deliverables.css, design-review.css)
- [x] Consolidated .tab-content base rule (portal-tabs.css)
- [x] Removed duplicate annotation tool styles from design-review.css
- [x] Removed duplicate utility classes (.sr-only, .truncate-text)

**Icon Styling Unification (Feb 20):**

- [x] Consolidated .icon-btn definitions to portal-buttons.css (82 lines removed)
- [x] Removed stat-icon background colors from tasks.css (transparent icons)
- [x] Removed duplicate .stat-card-icon from overview-layout.css
- [x] Removed duplicate .panel-icon from overview-layout.css
- [x] Removed duplicate .btn-sm/.btn-danger from admin.css (use portal-buttons.css)

**Utility Class Consolidation (Feb 20):**

- [x] Removed duplicate .status-badge from deliverables.css (use portal-badges.css)
- [x] Removed duplicate status badge variants from admin.css
- [x] Moved .status-not-invited to portal-badges.css
- [x] Removed duplicate .truncate from typography.css and portal-components.css
- [x] Added .truncate-2 and .truncate-3 to utilities.css
- [x] Removed duplicate flex utilities from variables.css and layout.css
- [x] Fixed hardcoded color in portal-dropdown.css (#1A1A1A → var(--portal-bg-darker))

**Design System Token Cleanup:**

- [x] Removed duplicate utilities from design-system/index.css (502 lines)
- [x] Removed orphaned utilities from breakpoints.css (421 lines)
- [x] Removed orphaned utilities from animations.css (219 lines)
- [x] Removed orphaned utilities from spacing.css (394 lines)
- [x] Removed orphaned utilities from typography.css (128 lines)
- [x] Removed orphaned utilities from z-index.css (128 lines)
- [x] Removed orphaned utilities from shadows.css (120 lines)
- [x] Removed orphaned utilities from borders.css (141 lines)

**Keyframe Consolidation:**

- [x] Consolidated duplicate @keyframes spin definitions (84 lines across 4 files)
- [x] Consolidated loading-spin → spin in loading.css
- [x] Consolidated cp-spin → spin in questionnaires.css

**Component Pattern Consolidation:**

- [x] Created shared .toggle-group/.toggle-btn in portal-buttons.css
- [x] Consolidated .kpi-card with .stat-card pattern in portal-cards.css
- [x] Consolidated list-item patterns (.history-request-item, etc.) in portal-cards.css
- [x] Created modal scroll utilities (.modal-scroll-sm/md/lg) in modal-system.css
- [x] Moved badge patterns (.system-badge, .category-badge) to portal-badges.css
- [x] Consolidated .tier-select-btn/.maintenance-select-btn in proposal-builder.css

**Previous Cleanup:**

- [x] Removed orphaned channel-loading code (113 lines)
- [x] Removed orphaned grid/position/overflow utilities (258 lines)
- [x] Removed orphaned semantic utilities (46 lines)

### Linear Admin Portal Redesign - COMPLETE

All phases of the Linear-inspired admin portal redesign are complete:

- [x] Phase 1: Foundation (command palette, keyboard shortcuts, sidebar nav)
- [x] Phase 2: Tables (compact rows, hover actions, J/K nav, inline editing)
- [x] Phase 3: Detail Views (keyboard nav, inline editing for key fields)
- [x] Phase 4: Polish (performance audit, skeleton loading infrastructure)

### Future Considerations (Low Priority)

- Animation refinement (24 CSS keyframes exist, most are simple/appropriate)
- Modal consolidation (current UX works well)
- Comprehensive WCAG accessibility audit
- Bundle optimization via `manualChunks` (642KB dashboard chunk is acceptable)

---

### Admin Table Styling Consolidation - COMPLETE

Consolidated table styling to ensure all admin tables use consistent styling from a single source of truth.

**Completed (Feb 24, 2026):**

- [x] Moved pagination base styles from `table-features.css` to `portal-tables.css`
- [x] Moved sortable header styles from `table-filters.css` to `portal-tables.css`
- [x] Removed duplicate sortable header styles from `admin.css`
- [x] Removed `background: transparent !important` pagination override from `admin.css`
- [x] Added universal checkbox/bulk-select column styling using `:is()` selector
- [x] Added universal sortable header styling using `:is()` selector
- [x] Consolidated pagination-ellipsis style to `portal-tables.css`

**Files Modified:**

- `src/styles/shared/portal-tables.css` - Added universal pagination, sortable headers, checkbox column styles
- `src/styles/admin/table-features.css` - Removed duplicate pagination styles (now in portal-tables.css)
- `src/styles/admin/table-filters.css` - Removed duplicate sortable header styles
- `src/styles/pages/admin.css` - Removed conflicting pagination override, removed duplicate sortable headers

**Single Source of Truth:**

All table styling is now in `portal-tables.css`:

| Style Category | Selector Pattern |
|----------------|------------------|
| Base table styles | `:is(.admin-table, .overview-table, .files-table, .invoices-table, .time-entries-table)` |
| Column headers | Universal `th` styles with sortable support |
| Checkbox columns | `:is(...) :is(.bulk-select-cell, .checkbox-col)` |
| Row hover/selection | Applied to `td` elements |
| Pagination | `.table-pagination`, `.pagination-*` classes |
| Sortable headers | `:is(...) th.sortable` with `.sort-icon` |

**Impact:** CSS changes to table styling now apply universally to all admin tables.

---

### Frontend Refactor - HTML Structure Parity - COMPLETE

Priority 1 from Frontend Refactor Spec. Implemented clean ID-based selectors.

**Completed (Feb 24, 2026):**

1. Updated all JavaScript references to use new IDs
2. Updated HTML templates with spec-compliant IDs
3. Updated all CSS files to use clean ID-based selectors (no backwards compat cruft)

**ID Mapping:**

| Spec ID | Old Selector | Purpose |
|---------|--------------|---------|
| `#app` | `.dashboard-container` | Main dashboard container |
| `#topbar` | `.portal-global-header` | Global header bar |
| `#main-wrapper` | `.portal-body` | Sidebar + content wrapper |
| `#page-content` | `.dashboard-content` | Main content area |
| `.topbar-left` | `.portal-global-header-left` | Header left section |
| `.topbar-right` | `.portal-global-header-right` | Header right section |

**Files Modified:**

HTML:

- `server/views/layouts/portal.ejs` - `#app`, `#main-wrapper`, `#page-content`
- `server/views/partials/portal-header.ejs` - `#topbar`, `.topbar-left`, `.topbar-right`

JavaScript:

- `src/features/admin/admin-dashboard.ts`
- `src/features/admin/admin-project-details.ts`
- `src/features/admin/modules/admin-projects.ts`
- `tests/e2e/admin-flow.spec.ts`
- `tests/e2e/portal-flow.spec.ts`

CSS (8 files updated):

- `src/styles/shared/portal-layout.css`
- `src/styles/pages/admin.css`
- `src/styles/admin/secondary-sidebar.css`
- `src/styles/client-portal/layout.css`
- `src/styles/client-portal/login.css`
- `src/styles/mobile/responsive-fixes.css`
- `src/styles/bundles/portal.css`
- `src/styles/bundles/unified-portal.css`

---

### Frontend Refactor - Shared Component System - COMPLETE

Priority 2 from Frontend Refactor Spec. All React components now registered and available.

**Completed (Feb 24, 2026):**

1. Updated registry.ts with all 28 admin component types
2. Updated admin-entry.tsx to import and register all 28 admin components
3. All 11 portal components were already registered

**Admin Components Registered (28 total):**

- Detail views: `clientDetail`, `projectDetail`
- Tables: `projectsTable`, `clientsTable`, `leadsTable`, `invoicesTable`, `contactsTable`, `contractsTable`, `deliverablesTable`, `documentRequestsTable`, `questionnairesTable`, `adHocRequestsTable`, `proposalsTable`, `globalTasksTable`, `deletedItemsTable`
- Features: `tasksManager`, `workflowsManager`, `filesManager`, `emailTemplatesManager`, `knowledgeBase`, `messagingPanel`, `timeTrackingPanel`, `designReviewPanel`, `systemStatusPanel`
- Analytics: `overviewDashboard`, `analyticsDashboard`, `adHocAnalytics`, `performanceMetrics`

**Portal Components Registered (11 total):**

- `portalInvoices`, `portalFiles`, `portalProjects`, `portalMessages`, `portalQuestionnaires`, `portalDocumentRequests`, `portalApprovals`, `portalSettings`, `portalAdHocRequests`, `portalNavigation`, `portalOnboarding`

**Files Modified:**

- `src/react/registry.ts` - Added 26 new admin component types
- `src/react/admin-entry.tsx` - Imports and registers all 28 admin components
- `src/react/hooks/index.ts` - Exports all 13 hooks

---

### Frontend Refactor - Table Standardization - COMPLETE

Priority 3 from Frontend Refactor Spec. AdminTable component now uses CSS classes.

**Completed (Feb 24, 2026):**

1. Updated AdminTable.tsx to use CSS classes from portal-tables.css
2. Replaced Tailwind utilities with semantic CSS classes
3. Added Lucide icons for sort indicators (ArrowUp, ArrowDown)
4. Used proper CSS state classes (`.empty-row`, `.loading-row`, `.row-selected`)

**AdminTable Component Changes:**

| Component | Old (Tailwind) | New (CSS) |
|-----------|----------------|-----------|
| Container | `tw-w-full tw-overflow-x-auto...` | `.admin-table-container` |
| Table | `tw-w-full tw-border-collapse...` | `.admin-table` |
| Row | `tw-border-b tw-border-[var...]` | Uses CSS defaults |
| Selected Row | `tw-bg-[var(--color-brand...)]` | `.row-selected` |
| Header | `tw-px-3 tw-py-2 tw-text-[11px]...` | `.sortable` |
| Sort Icon | ASCII arrows (`↑` `↓`) | Lucide `ArrowUp`/`ArrowDown` with `.sort-icon` |
| Empty State | Inline Tailwind | `.empty-row`, `.empty-state-content` |
| Loading | Inline Tailwind | `.loading-row`, `.skeleton-bar` |

---

### Frontend Refactor - Light/Dark Theme Toggle - ALREADY COMPLETE

Priority 4 from Frontend Refactor Spec. Theme toggle was already fully implemented.

**Existing Implementation:**

- ThemeModule class at `src/modules/utilities/theme.ts`
- Dual button support (`#header-toggle-theme` and `#dashboard-theme-toggle`)
- localStorage persistence
- CSS variables for both themes in `src/design-system/tokens/colors.css`
- Proper icon visibility (sun/moon) in portal-layout.css
- System preference detection via `prefers-color-scheme`

No changes required.

---

### React Table Vanilla CSS Conversion - IN PROGRESS

Converting React tables to use vanilla CSS classes instead of Tailwind `tw-*` classes.

**Completed (Feb 24, 2026):**

- [x] Fixed LeadsTable structure - stats outside admin-table-card, added title
- [x] Fixed LeadsTable filter - converted from native `<select>` to PortalDropdown
- [x] Fixed ContactsTable - added title "CONTACT FORM SUBMISSIONS"
- [x] Fixed greeting spacing - now matches subtabs (`padding-top: var(--space-3)`, `margin-bottom: var(--space-2)`)
- [x] Fixed theme toggle button - added visible background (`var(--portal-bg-medium)`)
- [x] Added `.filter-dropdown-trigger` styling with flex layout for chevron icon
- [x] Fixed TypeScript error - removed non-existent `portalButtonVariants` export
- [x] **Fixed InvoicesTable to match vanilla pattern** - converted inline search/dropdown to icon-only buttons with collapsible dropdowns (matching Contracts, Document Requests, Questionnaires tabs)
- [x] Standardized AdminTable loading/error/empty states - uses `.loading-state`, `.error-state`, `.empty-state` classes
- [x] Added `AdminTableError` component for consistent error state handling
- [x] Updated loading.css with backwards compatibility for `.empty-state-content` class
- [x] **Fixed GlobalTasksTable structure inconsistency** - was using custom `tasks-main-container`, `tasks-stats-bar` instead of standard `quick-stats` with `stat-card` buttons and `admin-table-card` wrapper
- [x] **Unified table headers with compact stats summary** - Replaced multiple stat cards with inline stats summary that shows key numbers with hover tooltip for details (reduces visual clutter)
- [x] **Converted all main tables to icon-only buttons** - Search and filter now use collapsible dropdowns with icon-only triggers (ClientsTable, LeadsTable, ContactsTable, ProjectsTable, InvoicesTable, GlobalTasksTable)
- [x] **Removed click-to-filter on stat cards** - Stats are now informational only, not interactive (was overkill)
- [x] **Added CSS for compact stats summary** - `.admin-table-title-group`, `.stats-summary`, `.stats-summary-item` styles in admin.css

**Still Remaining:**

Many React files still use `tw-*` Tailwind classes. Background agents hit rate limits before completing:

- 71 files total with `tw-*` classes
- Includes: UI components, admin feature components, portal feature components
- CSS files (globals.css, tailwind-generated.css) legitimately contain Tailwind patterns

**Files Modified:**

- `src/react/features/admin/leads/LeadsTable.tsx` - Fixed structure, PortalDropdown filters
- `src/react/features/admin/invoices/InvoicesTable.tsx` - Icon-only buttons with collapsible search/filter dropdowns
- `src/react/features/admin/contacts/ContactsTable.tsx` - Added title
- `src/react/components/portal/AdminTable.tsx` - Standardized loading/error/empty states
- `src/react/components/portal/index.ts` - Added AdminTableError export
- `src/react/features/admin/global-tasks/GlobalTasksTable.tsx` - Restructured to use `quick-stats`, `admin-table-card`, `admin-table-header`, `admin-table-container`, `admin-table-scroll-wrapper`
- `src/styles/admin/overview-layout.css` - Fixed greeting spacing
- `src/styles/shared/portal-layout.css` - Fixed theme toggle background
- `src/styles/admin/table-filters.css` - Added filter-dropdown-trigger and icon-btn styling
- `src/styles/components/loading.css` - Added backwards compatibility, SVG sizing

---

### React Brutalist/Minimalist Design System - COMPLETE

Implemented brutalist/minimalist design for React components inspired by discothequefragrances.com.

**Completed (Feb 25, 2026):**

- [x] Updated tailwind.config.js with brutalist tokens (no border-radius, no shadows)
- [x] Added Inconsolata monospace font (Google Fonts import)
- [x] Created comprehensive component classes in globals.css using @apply
- [x] Updated Shadcn CSS variables for black/white/transparent theme
- [x] Regenerated tailwind-generated.css

**Design Principles:**

| Principle | Implementation |
|-----------|----------------|
| One background color | `#000000` black, all children transparent |
| No border-radius | All radii set to `0` (except `full` for circles) |
| No shadows | All shadow tokens set to `none` |
| Monospace font | Inconsolata for all React components |
| High contrast | White text (#fff) on black, white borders |
| Minimal borders | `1px solid rgba(255,255,255,0.3)` or `1px solid white` |

**Component Classes Created:**

| Category | Classes |
|----------|---------|
| Layout | `.tw-container`, `.tw-section`, `.tw-panel`, `.tw-card` |
| Typography | `.tw-heading`, `.tw-section-title`, `.tw-label`, `.tw-text-muted` |
| Inputs | `.tw-input`, `.tw-select`, `.tw-textarea`, `.tw-checkbox` |
| Buttons | `.tw-btn`, `.tw-btn-primary`, `.tw-btn-secondary`, `.tw-btn-ghost`, `.tw-btn-icon`, `.tw-btn-close` |
| Tables | `.tw-table`, `.tw-table-header`, `.tw-table-cell`, `.tw-table-row` |
| States | `.tw-empty-state`, `.tw-loading`, `.tw-error` |
| Tabs | `.tw-tab-list`, `.tw-tab`, `.tw-tab-active` |
| Modals | `.tw-modal-overlay`, `.tw-modal`, `.tw-modal-header` |
| Other | `.tw-badge`, `.tw-stat-card`, `.tw-progress-track`, `.tw-divider` |

**Files Modified:**

- `tailwind.config.js` - Brutalist tokens (0 radius, no shadows, Inconsolata font)
- `src/react/styles/globals.css` - Component classes and Shadcn variables
- `src/styles/base/fonts.css` - Added Inconsolata Google Font import
- `src/react/styles/tailwind-generated.css` - Regenerated

**Token Additions:**

Added missing tokens to tailwind.config.js:
- `portal.border` - base border color
- `portal.border-subtle` - subtle border
- `portal.text-light` - light text
- `status.warning`, `status.info`, `status.danger` - additional status colors

---

### Inline Edit UX Pattern - COMPLETE

Established clear UX pattern for inline editing vs modals.

**Completed (Feb 25, 2026):**

- [x] Removed InlineEdit from ProjectsTable (budget, timeline columns now static)
- [x] Removed InlineEdit from InvoicesTable (due date column now static)
- [x] Main tables now click-through to detail view for editing

**UX Pattern:**

| View Type | Edit Pattern |
|-----------|--------------|
| Main overview tables (Projects, Clients, Leads, Invoices) | Click row to navigate to detail view - no inline edit |
| Detail pages & panels (Project detail, Client detail) | Edit-in-place for fields |

**Rationale:**

- Main tables are for scanning/overview - inline editing is distracting
- Detail pages are focused on one item - inline editing is natural and efficient
- Reduces accidental edits when scrolling/clicking in tables

**Files Modified:**

- `src/react/features/admin/projects/ProjectsTable.tsx` - Removed InlineEdit, static display
- `src/react/features/admin/invoices/InvoicesTable.tsx` - Removed InlineEdit, static display

---

## Post-Task Documentation Checklist

- [ ] Update feature docs if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [x] Verify no markdown violations

---

### Documents Tab Unification - COMPLETE

Unified Documents tab to use single container with internal card switching, matching the Knowledge Base (support) tab pattern.

**Completed (Feb 26, 2026):**

- [x] Created `admin-documents.ts` module with unified document tab management
- [x] Implemented `renderDocumentsTab()` to render all four document cards (Invoices, Contracts, Document Requests, Questionnaires)
- [x] Implemented `loadDocuments()` to load all four modules in parallel
- [x] Added `applyDocumentsSection()` to show/hide cards based on selected subtab
- [x] Setup `documentsSubtabChange` event listener for subtab switching
- [x] Added `loadDocumentsModule()` to modules index
- [x] Added `case 'documents':` to loadTabData in admin-dashboard.ts
- [x] Added documents breadcrumb in updateAdminBreadcrumbs
- [x] Build and typecheck passing

**Files Created:**

- `src/features/admin/modules/admin-documents.ts` - Unified documents module

**Files Modified:**

- `src/features/admin/modules/index.ts` - Added loadDocumentsModule export
- `src/features/admin/admin-dashboard.ts` - Added documents case, breadcrumbs, import

**Pattern:**

Documents tab now works exactly like Knowledge Base (support) tab:

1. Single `tab-documents` container rendered by admin-dashboard
2. All four subtab cards rendered inside container (invoices, contracts, document-requests, questionnaires)
3. Subtab clicks dispatch `documentsSubtabChange` event (handled by admin-dashboard setupHeaderGroupNavigation)
4. Event listener calls `applyDocumentsSection()` to show/hide appropriate card
5. Header subtabs styled with `mode="primary"` but NOT in `ADMIN_TAB_GROUPS` (standalone tab with internal switching)

**Impact:**

- Consistent UX across Knowledge Base and Documents tabs
- Single container load instead of separate tab switches
- All document data loads at once for faster subtab switching

---

## DO NOT REMOVE OR EDIT ANYTHING BELOW THIS LINE

### Design System Reference

- Design System: docs/design/DESIGN_SYSTEM.md

Key rules:

- NO EMOJIS - Use Lucide icons only
- NEVER hardcode colors - use CSS variables
- Use `createPortalModal()` for modals
- Complex animations use GSAP, not CSS animations
