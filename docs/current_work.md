# Current Work

**Last Updated:** February 18, 2026

This file tracks active development work and TODOs. Completed items are archived in `archive/ARCHIVED_WORK_2026-02-12.md`.

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
