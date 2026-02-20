# Current Work

**Last Updated:** February 19, 2026

This file tracks active development work and TODOs. Completed items are archived in `archive/ARCHIVED_WORK_2026-02-12.md`.

---

## Session Summary - February 19, 2026 (Code Audit)

Comprehensive codebase audit to identify CSS and rendering consolidation opportunities.

### Code Audit Findings

**Overall Architecture Score: 7.5/10**

| Area | Status | Notes |
|------|--------|-------|
| CSS Organization | Good (7/10) | Well-structured, some large files |
| Design Token Usage | Excellent (9/10) | Comprehensive system, 85% utilized |
| Component Extraction | Good (7/10) | Major components extracted |
| Rendering Patterns | Fair (5/10) | 28 modules repeat 80% identical code |
| Entry Points | Excellent (10/10) | Unified portal bundle approach |

### Critical Issue: Module Initialization Duplication

**28 admin modules** repeat ~140 lines of identical initialization code:

- Filter UI creation (~60 lines)
- Pagination state management (~25 lines)
- Bulk action toolbar setup (~20 lines)
- Export button wiring (~15 lines)
- DOM element caching (~8 lines)

**Total duplicated code:** ~3,920 lines across modules

### Solution: Table Module Factory

Created `src/utils/table-module-factory.ts` - a factory function that eliminates the duplicated initialization code.

**Before (per module):**

```typescript
// ~140 lines of boilerplate per module
let data: T[] = [];
let storedContext: AdminDashboardContext | null = null;
let filterState = loadFilterState(CONFIG.storageKey);
let paginationState = { ... };
const cachedElements = new Map();

function initializeFilterUI(ctx) { /* 60 lines */ }
function renderPaginationUI(total, ctx) { /* 25 lines */ }
// ... more boilerplate
```

**After (using factory):**

```typescript
const module = createTableModule({
  moduleId: 'contacts',
  filterConfig: CONTACTS_FILTER_CONFIG,
  paginationConfig: createPaginationConfig('contacts'),
  columnCount: 7,
  apiEndpoint: '/api/admin/contact-submissions',
  extractData: (json) => ({ data: json.submissions, stats: json.stats }),
  renderRow: (item, ctx, helpers) => { /* module-specific row */ },
  renderStats: (stats, ctx) => { /* module-specific stats */ }
});

export const loadContacts = module.load;
export const getContactsData = module.getData;
```

**Impact:**

- ~200 lines eliminated per module
- 28 modules × 200 lines = ~5,600 lines reduction potential
- Single source of truth for initialization patterns
- Easier maintenance and consistent behavior

### Files Created

- `src/utils/table-module-factory.ts` - Factory function (380 lines)

### Other Findings

**Dropdown Systems (3 separate implementations):**

| System | Height | Purpose |
|--------|--------|---------|
| Table dropdowns | 32px | Status in table cells |
| Modal dropdowns | 48px | Form inputs |
| Filter dropdowns | varies | Search/filter controls |

**Recommendation:** Keep table/modal separate (intentional size difference), document in CSS_ARCHITECTURE.md

**Large CSS Files:**

- `project-detail.css` - 1,500+ lines (should split)
- `modals.css` - 730 lines (review for consolidation)

### Migrations Complete

#### 1. admin-contacts.ts

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Lines of code | 904 | 738 | **-166 (18%)** |
| Import statements | 18 | 13 | -5 |
| State variables | 5 | 0 (in factory) | -5 |

#### 2. admin-leads.ts

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Lines of code | 2,086 | 1,575 | **-511 (24.5%)** |
| Import statements | 21 | 16 | -5 |
| State variables | 6 | 2 (view-specific only) | -4 |

This module is more complex (table + pipeline view toggle, analytics, scoring rules, tasks, notes), but the factory still eliminated significant boilerplate.

#### 3. admin-clients.ts

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Lines of code | 1,726 | 1,542 | **-184 (10.7%)** |
| Import statements | 20 | 15 | -5 |
| State variables | 5 | 1 (currentClientId only) | -4 |

Smaller reduction because this module has significant module-specific code for client detail views (projects, billing, invoices), multiple modal handlers (edit info, edit billing, add client), inline editing, and invitation handling.

#### 4. admin-invoices.ts

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Lines of code | 1,209 | 1,057 | **-152 (12.6%)** |
| Import statements | 15 | 11 | -4 |
| State variables | 4 | 0 (in factory) | -4 |

This module has view/edit invoice modals, PDF download, inline due date editing - all module-specific code preserved.

#### 5. admin-contracts.ts

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Lines of code | 690 | 652 | **-38 (5.5%)** |
| Import statements | 11 | 10 | -1 |
| State variables | 3 | 2 (listenersInitialized, filterContainerEl) | -1 |

Smaller reduction because admin-contracts.ts was already lean - primarily detail modal and activity features, less boilerplate to eliminate.

#### 6. admin-ad-hoc-requests.ts

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Lines of code | 917 | 835 | **-82 (8.9%)** |
| Import statements | 13 | 7 | -6 |
| State variables | 5 | 1 (listenersInitialized only) | -4 |

This module has detail modals, time entry UI, invoice generation modal - all module-specific code preserved.

**Total lines saved:** 1,133 lines across 6 modules

**Files Modified:**

- `src/utils/table-module-factory.ts` - Created (380 lines)
- `src/features/admin/modules/admin-contacts.ts` - Refactored (904 → 738)
- `src/features/admin/modules/admin-leads.ts` - Refactored (2,086 → 1,575)
- `src/features/admin/modules/admin-clients.ts` - Refactored (1,726 → 1,542)
- `src/features/admin/modules/admin-invoices.ts` - Refactored (1,209 → 1,057)
- `src/features/admin/modules/admin-contracts.ts` - Refactored (690 → 652)
- `src/features/admin/modules/admin-ad-hoc-requests.ts` - Refactored (917 → 835)

### Next Steps

- [x] Migrate admin-contacts.ts to use factory
- [x] Migrate admin-leads.ts to use factory
- [x] Migrate admin-clients.ts to use factory
- [x] Migrate admin-invoices.ts to use factory
- [ ] Migrate remaining modules (optional - can be done incrementally)
- [ ] Consider splitting `project-detail.css` into smaller files
- [ ] Document dropdown systems in CSS_ARCHITECTURE.md

---

## Session Summary - February 19, 2026 (Continued)

Comprehensive card styling consolidation to match overview-layout design pattern.

**Card Styling Consolidation:**

Updated all card components to use consistent flat design matching `overview-layout.css`:

- Removed shadows from all cards (`.portal-project-card`, `.stat-card`, `.summary-card`, etc.)
- Changed border-radius from `--portal-radius-lg/md` to `--portal-radius-sm, 8px`
- Changed padding to compact `13px 14px` (outer) and `11px 14px` (nested)
- Added `overflow: hidden` and `transition: background 0.15s` to cards
- Changed nested items to use `--portal-bg-medium` with hover to `--portal-bg-light`

**Analytics HTML Update:**

Updated `admin-analytics.ts` to use proper class names:

- Changed `card-grid-4` → `kpi-cards-row`
- Changed `portal-project-card portal-shadow` → `analytics-section`
- Applied to all 16+ sections in analytics tab

**Health Check Fix:**

Fixed styling mismatch in System Status → Health Check section:

- Changed `.health-item` from `--portal-bg-dark` to `--portal-bg-medium`
- Now matches `.system-info-row` styling in Build Information

**CSS Consolidation:**

Added common list-item pattern to `portal-cards.css`:

- `.list-item`, `.data-item`, `.report-item`, `.alert-item`, `.bundle-item`
- All use `--portal-bg-medium` base with `--portal-bg-light` hover
- Stripped down `analytics.css` from 870+ lines to ~380 lines
- Removed duplicate card/item patterns now in shared files

**Files Modified:**

- `src/styles/shared/portal-cards.css` - Updated card bases, added common list-item pattern
- `src/styles/pages/admin.css` - Removed shadows, updated overview tab styling
- `src/styles/admin/analytics.css` - Major cleanup, stripped to essentials
- `src/features/admin/modules/admin-analytics.ts` - Updated HTML class names

---

## Session Summary - February 19, 2026 (Earlier)

CSS consolidation session - added comprehensive utility classes and `:has()` rules, then removed duplicates from 15+ files.

**Project Tasks Page Button Fix:**

Fixed button not appearing in top right of Tasks tab in project details:

- Added CSS rule for `.view-toggle-container` when it's the only child of `.card-header-with-action`
- Rule makes container take `width: 100%` with `justify-content: space-between`
- File: `src/styles/shared/portal-cards.css`

**Analytics → Overview Styling Alignment:**

Updated analytics pages to match the Linear-inspired `overview-layout.css` styling:

- Changed backgrounds from `--portal-bg-dark` to `--portal-bg-darker` for cards/panels
- Changed border-radius from `--portal-radius-md` to `--portal-radius-sm, 8px`
- Changed padding from `var(--space-4)` to compact `13px 14px`
- Removed `box-shadow: var(--shadow-panel)` and `box-shadow: var(--shadow-card)`
- Changed gaps from `var(--space-*)` to `var(--portal-section-gap)` for consistency
- Added hover states with `transition: background 0.15s` and `background: var(--portal-bg-hover)`
- Added subtle gradient overlay to KPI cards (matching stat-card styling)
- Changed nested items (data-item, health-item, etc.) to use `--portal-bg-dark` with hover
- Updated chart containers to use `--portal-bg-dark` for nested elements
- Fixed font sizes to match overview (11.5px, 12px patterns)

**Chart Visual Alignment:**

Updated chart elements across analytics to match overview panels:

- `.chart-canvas-wrapper` and `.chart`: Changed from `--portal-bg-medium` to `--portal-bg-dark`
- Updated ad-hoc analytics widgets in `ad-hoc-requests.css`
- Updated lead analytics columns in `leads-pipeline.css`
- All chart containers now use consistent `--portal-bg-darker` outer / `--portal-bg-dark` inner pattern

**Key Changes:**

- **Comprehensive audit** - Found 54 files with duplicated `display: flex; flex-direction: column; gap:` pattern
- **Utility classes added to portal-components.css:**
  - Flex column: `.flex-col-gap-0` through `.flex-col-gap-4`
  - Flex row: `.flex-row-gap-0-5` through `.flex-row-gap-3`
  - Flex wrap: `.flex-wrap-gap-0-5` through `.flex-wrap-gap-3`
  - Flex alignment: `.flex-center`, `.flex-between`, `.flex-start`, `.items-center`, etc.
  - Grid fixed columns: `.grid-2col`, `.grid-3col`, `.grid-4col`
  - Grid auto-fit: `.grid-auto-150` through `.grid-auto-350`
  - Gap utilities: `.gap-0` through `.gap-4`
  - Spacing utilities: `.mt-0`, `.pt-sm`, `.pb-lg`, etc.
  - Text utilities: `.text-muted`, `.text-secondary`, `.text-primary`, etc.
- **`:has()` rules for automatic styling:**
  - `:has(> .status-item)` - auto gap
  - `:has(> .meta-item)` - auto gap
  - `:has(> .form-group)` - auto column layout
  - `:has(> .badge)` - auto row wrap
  - `[class$="-list"]:has(> [class$="-item"])` - auto flex-column gap-1-5
  - `[class$="-cards"]:has(> [class$="-card"])` - auto flex-column gap-2
  - Named containers: `.signature-details`, `.signature-info`, `.lead-tab-section`, `.time-entry-form`, `.contract-tab-content`, `.checkbox-group`, `.modal-form`, `.deliverables-modal-content`, `.deliverables-container`
  - Tighter gap-1 lists: `.help-accordion`, `.help-featured-list`, `.help-results-list`, `.notes-list`, `.tasks-list`, `.activity-list`
- **Removed duplicate CSS from 15 files:**
  - `admin/project-detail.css` - removed `.milestones-list`, `#pd-tab-invoices .portal-project-card`
  - `admin/pd-contract.css` - removed `.contract-tab-content`, `.signature-details`
  - `admin/pd-invoices.css` - removed `#pd-tab-invoices .portal-project-card`
  - `admin/leads-pipeline.css` - removed `.lead-tab-section`
  - `admin/proposals.css` - removed `.signature-info`
  - `admin/tasks.css` - removed `.time-entry-form`
  - `client-portal/dashboard.css` - removed `.milestones-list`
  - `client-portal/invoices.css` - removed `.invoices-list`
  - `client-portal/settings.css` - removed `.checkbox-group` (kept `flex: 1`)
  - `client-portal/help.css` - removed `.help-accordion`, `.help-featured-list`, `.help-results-list`
  - `deliverables.css` - removed `.deliverables-modal-content`, `.deliverables-container`, `.modal-form`

**Files Modified:**

- `src/styles/shared/portal-components.css` - Added comprehensive utility classes and :has() rules
- `src/styles/admin/project-detail.css` - Removed 2 duplicate flex rules
- `src/styles/admin/pd-contract.css` - Removed 2 duplicate flex rules
- `src/styles/admin/pd-invoices.css` - Removed 1 duplicate flex rule
- `src/styles/admin/leads-pipeline.css` - Removed 1 duplicate flex rule
- `src/styles/admin/proposals.css` - Removed 1 duplicate flex rule
- `src/styles/admin/tasks.css` - Removed 1 duplicate flex rule
- `src/styles/client-portal/dashboard.css` - Removed 1 duplicate flex rule
- `src/styles/client-portal/invoices.css` - Removed 1 duplicate flex rule
- `src/styles/client-portal/settings.css` - Simplified `.checkbox-group`
- `src/styles/client-portal/help.css` - Removed 3 duplicate flex rules
- `src/styles/deliverables.css` - Removed 3 duplicate flex rules
- `docs/design/CSS_ARCHITECTURE.md` - Documented all new utility classes

**Additional Consolidation (Phase 2):**

Added more universal patterns for cohesive design:

- **Text utilities:** `.truncate`, `.truncate-2`, `.truncate-3`
- **List utilities:** `.list-reset`, universal list reset for `[class$="-list"]`
- **List item styling:** Universal `li` styling for `.activity-list`, `.notes-list`, `.files-list`, `.tasks-list`
- **Padding utilities:** `.pad-compact`, `.pad-standard`, `.pad-card`, `.pad-section`
- **Border radius utilities:** `.rounded-sm`, `.rounded-md`, `.rounded-lg`, `.rounded-full`
- **Background utilities:** `.bg-darker`, `.bg-dark`, `.bg-medium`, `.bg-light`
- **List item component:** `.list-item`, `.list-item-compact` with hover states

**Removed more duplicates:**

- `shared/portal-cards.css` - Removed `.activity-list` reset, `.activity-list li` styling, clickable states

**Additional Consolidation (Phase 3):**

Deep analysis found 15 more patterns. Added to portal-components.css:

- **Font weight:** `.font-semibold`, `.font-medium`, `.font-bold`, `.font-normal` (300+ instances)
- **Transitions:** `.transition-colors`, `.transition-opacity`, `.transition-transform`, `.transition-all` (31+ instances)
- **Borders:** `.border-bottom`, `.border-top`, `.border-all`, `.border-none` + variants (87+ instances)
- **Icon sizes:** `.icon-xs/sm/md/lg/xl` (12-32px) (20+ instances)
- **Focus states:** `.focus-primary`, `.focus-ring` (87+ instances)
- **Hover states:** `.hover-primary`, `.hover-bg-light`, `.hover-bg-medium` (20+ instances)
- **Interactive:** `.interactive` (combines cursor + transition + hover)
- **Disabled:** `.disabled` with pointer-events: none
- **Position:** `.relative`, `.absolute`, `.fixed`, `.sticky`, `.absolute-fill`, `.absolute-center`
- **Overflow:** `.overflow-hidden/auto`, `.overflow-x-auto`, `.overflow-y-auto`
- **Spacers:** `.spacer-left/right/top/bottom` (margin auto)
- **Header section:** `.header-section`, `.header-section-compact`, `.header-section-title`, `.header-section-actions`
- **Footer section:** `.footer-section`, `.footer-section-spread`

`portal-components.css` now has 1417 lines - single source of truth for all common patterns.

---

## Session Summary - February 18, 2026 (Continued)

Extended CSS consolidation session. Fixed spacing, row hover, sidebar nav, inline styles, and viewport height issues.

**Key Fixes:**

- **Spacing consistency**: Removed conflicting margin rules in workflows.css, admin.css (visitors-dashboard, overview-grid), admin-questionnaires.ts
- **Sidebar nav highlight**: Fixed selector mismatch (`.sidebar-buttons .btn` → `.sidebar-nav-item`)
- **Avatar size**: Added min/max dimensions to prevent size change when sidebar collapses
- **Row hover consolidation**: Created `shared/portal-tables.css` with universal hover styles, removed duplicates from 6 files
- **Inline styles cleanup**: Added utility classes (`.loading-message`, `.empty-state-message`, `.grid-2col`) to portal-components.css
- **Grey bar at bottom fix**: Separated admin/client-portal height rules - admin uses full 100vh (no global header), client-portal uses calc(100vh - 56px)
- **Collapsed avatar alignment**: Fixed centering with proper margin auto and width: 100%

**Files Created:**

- `src/styles/shared/portal-tables.css` - Universal table row hover/active/focused styles

**Files Modified:**

- `src/styles/admin/workflows.css` - Removed margin-bottom from approval-dashboard-section
- `src/styles/pages/admin.css` - Removed margin-top from visitors-dashboard, margin-bottom from overview-grid, duplicate hover rules, fixed collapsed avatar alignment
- `src/styles/admin/project-detail.css` - Removed duplicate hover rules
- `src/styles/admin/tasks.css` - Removed duplicate hover rule
- `src/styles/admin/pd-invoices.css` - Removed duplicate hover rule
- `src/styles/shared/portal-files.css` - Removed duplicate hover rule
- `src/styles/shared/portal-layout.css` - Added min/max dimensions to logo img, separated admin/client-portal height rules for sidebar and dashboard-content
- `src/styles/shared/portal-components.css` - Added utility classes
- `src/styles/bundles/admin.css` - Added height: 100vh and overflow: hidden to body for admin logged-in state
- `src/features/admin/admin-dashboard.ts` - Fixed sidebar nav selector, replaced inline styles
- `src/features/admin/modules/admin-messaging.ts` - Replaced inline styles with CSS classes
- `src/features/admin/modules/admin-questionnaires.ts` - Removed inline margin-top style

---

## Session Summary - February 18, 2026 (Earlier)

CSS consolidation session. Moved admin-specific overrides to shared stylesheets, fixed spacing inconsistencies between tabs.

**Key Changes:**

- Consolidated stat-card and page-header styles to shared files
- Fixed flex gap vs margin-top conflicts causing double spacing
- Removed duplicate breadcrumb, grid gap, and typography rules
- Identified Tasks tab as needing design review (not cohesive with rest)

---

## Session Summary - February 17, 2026

Major admin portal redesign session. All changes awaiting testing.

### Files Added This Session

| File | Purpose |
|------|---------|
| `src/styles/admin/overview-layout.css` | Overview tab layout redesign |
| `src/styles/admin/sidebar-refinements.css` | Mobile drawer, tooltips, accent bar |
| `src/styles/admin/visual-fixes.css` | Shadow reduction, page header fix, task priority fix |
| `src/styles/shared/modal-system.css` | Unified modal system |

### Files Deleted (Consolidated to Shared)

| File | Moved To |
|------|----------|
| `src/styles/admin/page-header-refinements.css` | `shared/portal-layout.css` |
| `src/styles/admin/stat-card-refinements.css` | `shared/portal-cards.css` |

### Files Modified This Session

| File | Changes |
|------|---------|
| `src/styles/admin/index.css` | Added 6 new CSS imports |
| `src/styles/client-portal/index.css` | Added modal-system.css import |
| `src/styles/admin/detail-header.css` | Fixed dropdown focus state |
| `src/features/admin/modules/admin-projects.ts` | Fixed dropdown click handlers |
| `src/features/admin/admin-dashboard.ts` | Added mobile drawer toggle logic |
| `admin/index.html` | Added sidebar overlay div |

---

## Integrated - Awaiting Testing

### 1. Overview Tab Layout Redesign

Compact stats strip + side-by-side tasks/activity panels.

**Before:**

```text
[STAT][STAT][STAT][STAT]     <- row 1
[STAT][STAT][STAT][STAT]     <- row 2
─────────────────────────
UPCOMING TASKS               <- scroll
─────────────────────────
RECENT ACTIVITY              <- scroll more
```

**After:**

```text
[S][S][S][S][S][S][S][S]     <- compact single row
┌──────────────┬─────────────┐
│ TASKS        │ ACTIVITY    │
│ (scrolls)    │ (scrolls)   │
└──────────────┴─────────────┘
```

- Responsive: stacks on tablet/mobile
- Both panels scroll independently

---

### 2. Sidebar Refinements

- Mobile drawer pattern (<768px): slides in as overlay
- Dim overlay behind drawer, closes on click or navigation
- Tooltips on collapsed sidebar items (using `aria-label`)
- Left accent bar on active nav item
- Smooth collapse transitions

---

### 3. Stat Card Refinements

- Subtle top accent line (becomes red on hover)
- Better typography hierarchy
- `.stat-secondary`, `.stat-change`, `.stat-meta` classes

---

### 4. Page Header Refinements

- Breadcrumb styling (lighter, navigational feel)
- Tab refinements with red underline
- Mobile: header stacks, tabs scroll horizontally

---

### 5. Unified Modal System

Unified `.modal-overlay` and `.admin-modal-overlay` into single consistent system.

**Size scale (via contentClassName):**

| Class | Max Width | Use Case |
|-------|-----------|----------|
| (none) | 560px | Default forms |
| `modal-content-sm` | 400px | Confirms, quick actions |
| `modal-content-lg` | 760px | Invoice view, task detail |
| `modal-content-xl` | 960px | Workflows, KB articles |
| `modal-content-full` | 100% - 4rem | Large previews |

**Features:**

- Consistent header/body/footer padding
- Red top accent border (brand consistency)
- Mobile: bottom sheets that slide up
- Existing `contentClassName` values mapped to size scale

---

### 6. Project Detail Dropdown Fixes

- **Focus state**: Changed from red border to subtle `--portal-border-light`
- **Click handling**: Direct listeners on each item (was event delegation)

---

### 7. Visual Fixes

**Shadow reduction:**

- `--shadow-panel` overridden to single subtle shadow (was 6 layered shadows)
- `--shadow-card` lightened
- Stat cards and content panels: no box-shadow (background color difference sufficient)

**Page header:**

- Title + subtabs unified as one row
- h1 title size reduced (1.4rem)
- Subtab groups: only 4 groups have subtabs (work, crm, documents, support)

**Task priority:**

- Left border instead of solid background (readable text)
- Priority badges: subtle background with colored border

---

## Linear-Style Admin Portal Redesign - Full Plan

**Goal:** Transform the admin portal to match Linear's design philosophy - fast, keyboard-driven, minimal, opinionated.

**Full spec:** `docs/design/ADMIN_PORTAL_LINEAR_REDESIGN.md`

---

### Phase 1: Foundation - COMPLETE

- [x] Command palette component (Cmd+K / Ctrl+K)
- [x] Fuzzy search across navigation items
- [x] Keyboard navigation (arrows, Enter, Escape)
- [x] Sidebar keyboard shortcuts (1-8 keys)
- [x] Subtle hover-reveal shortcut hints
- [x] Table keyboard navigation module (J/K, Enter, X/Space, G/Shift+G)
- [x] Focused/selected row CSS styles

**Files created:**

- `src/components/command-palette.ts`
- `src/styles/components/command-palette.css`
- `src/features/admin/admin-command-palette.ts`
- `src/components/table-keyboard-nav.ts`

---

### Phase 2: Tables - COMPLETE

- [x] Compact table rows (40px instead of 48px)
- [x] Minimal header borders (subtle bottom border only)
- [x] Action buttons hidden by default, shown on row hover
- [x] J/K keyboard navigation on all 5 main tables
- [x] Shift+Click bulk selection (select range of rows)
- [x] Inline editing component
- [x] Inline editing across all admin tables (budget, names, dates)

**Note:** Red dropdown borders are intentional design - do not change.

**Files created:**

- `src/components/inline-edit.ts`
- `src/styles/components/inline-edit.css`

**Files modified:**

- `src/styles/pages/admin.css` - Compact rows, hover-reveal actions
- `src/features/admin/modules/admin-clients.ts` - J/K nav + inline editing
- `src/features/admin/modules/admin-projects.ts` - J/K nav + inline budget/timeline edit
- `src/features/admin/modules/admin-invoices.ts` - J/K nav + inline due_date edit
- `src/features/admin/modules/admin-leads.ts` - J/K nav + inline name/company edit
- `src/features/admin/modules/admin-contracts.ts` - J/K nav + inline expires_at edit
- `src/utils/table-bulk-actions.ts` - Shift+Click range selection

---

### Phase 3: Detail Views - PENDING

- [ ] Refactor detail page layouts (metadata sidebar + main content)
- [ ] Implement inline editing throughout detail views
- [ ] Add keyboard shortcuts for common actions
- [ ] Remove unnecessary modals (prefer inline editing)

---

### Phase 4: Polish - PENDING

- [ ] Performance audit and optimization
- [ ] Skeleton loading states (no spinners)
- [ ] Animation refinement (subtle, fast)
- [ ] Keyboard shortcut help panel (`?` key)

---

### Success Metrics

| Metric | Target |
|--------|--------|
| Clicks to create client | 2 (Cmd+K -> "create client" -> Enter) |
| Time to navigate sections | < 500ms with keyboard |
| Mouse usage | < 50% for power users |
| Loading spinners shown | Zero (skeleton states only) |

---

## Active Concerns

### Tasks Tab Styling Not Cohesive with Rest of Admin Portal

**Status:** Needs Design Review
**Priority:** Medium

The Tasks tab (Work > Tasks) has a visually different layout compared to other tabs:

1. **No stat cards** - Projects/Leads/Clients have stat cards at top; Tasks jumps straight to kanban
2. **Kanban board takes full width** - Other tabs use table layouts with consistent card styling
3. **Colored top borders on columns** - Red/yellow/green borders feel visually different from the rest of the portal
4. **"ALL TASKS" heading style** - Different from other section headings

**Possible solutions:**

- [ ] Add stat cards to Tasks tab (To Do, In Progress, Blocked, Done counts) for consistency
- [ ] Review kanban column styling to match portal card system
- [ ] Consider if Tasks should have same structure as other Work subtabs
- [ ] Evaluate if colored column borders align with Linear-inspired design

**Reference:** Screenshot shows the visual disconnect between Tasks kanban and other tabs.

---

## TODOs

### Future Considerations (Low Priority)

- Comprehensive WCAG accessibility audit

---

## DO NOT REMOVE OR EDIT ANYTHING BELOW THIS LINE

### Design System Reference

- UX Guidelines: docs/design/UX_GUIDELINES.md
- CSS Architecture: docs/design/CSS_ARCHITECTURE.md

Key rules:

- NO EMOJIS - Use Lucide icons only
- NEVER hardcode colors - use CSS variables
- Use `createPortalModal()` for modals
- Complex animations use GSAP, not CSS animations

### Post-Task Documentation Checklist

- [ ] Update feature docs if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [ ] Move completed tasks to archive
- [ ] Verify no markdown violations
