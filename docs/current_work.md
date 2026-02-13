# Current Work

**Last Updated:** February 12, 2026

This file tracks active development work and TODOs. Completed items are archived in `archive/ARCHIVED_WORK_2026-02-12.md`.

---

## ACTIVE PROJECT: Portal Rebuild + Backend Cleanup

### Backend Cleanup

**Goal:** Complete ALL backend/database work, then rebuild portals with unified reusable components

**Execution Order:** Backend First, Frontend Second

---

### Backend Cleanup - COMPLETE

All 4 backend phases completed. See `archive/ARCHIVED_WORK_2026-02-12.md` for details.

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Slim Invoices Table | COMPLETE |
| 2 | Remove Dual-Write Patterns | COMPLETE |
| 3 | Message Table Consolidation | COMPLETE |
| 4 | Lead/Intake Table Consolidation | COMPLETE |

**Migration Note:** Run `npm run migrate` to apply migrations 085 and 086.

---

### Portal Rebuild

**Goal:** Complete ALL backend/database work, then rebuild portals with unified reusable components

**Execution Order:** Backend First, Frontend Second

---

#### Phase 1: Reusable Component Library

**Status:** READY TO START

**Priority:** HIGH

**Objective:** Create complete shared component library (55 patterns identified)

---

#### ALREADY BUILT - Components

| Component | File | Status |
|-----------|------|--------|
| Modal | `portal-modal.ts` | Complete |
| Status Badge | `status-badge.ts` | Complete |
| Checkbox | `portal-checkbox.ts` | Complete |
| Form Select | `form-select.ts` | Complete |
| Table Dropdown | `table-dropdown.ts` | Complete |
| Modal Dropdown | `modal-dropdown.ts` | Complete |
| Password Toggle | `password-toggle.ts` | Complete |
| Tab Router | `tab-router.ts` | Complete |
| Secondary Sidebar | `secondary-sidebar.ts` | Complete |
| Empty State | `empty-state.ts` | Complete |
| Quick Stats | `quick-stats.ts` | Complete |
| View Toggle | `view-toggle.ts` | Complete |

#### ALREADY BUILT - Utilities

| Utility | File | Status |
|---------|------|--------|
| Toast Notifications | `toast-notifications.ts` | Complete |
| Confirm Dialog | `confirm-dialog.ts` | Complete |
| Table Filter | `table-filter.ts` | Complete |
| Table Pagination | `table-pagination.ts` | Complete |
| Bulk Actions | `table-bulk-actions.ts` | Complete |
| Loading Utils | `loading-utils.ts` | Complete |

---

#### FILTERS (5 components to build)

**SearchFilter** - Icon button expands to search input, collapses on blur, debounced onChange
**StatusFilter** - Multi-select dropdown for status values with configurable options:

- Invoice: draft, sent, pending, paid, overdue, cancelled
- Project: active, on-hold, completed, archived
- Task: pending, in-progress, completed
- Lead: new, contacted, qualified, proposal, won, lost

**DateRangeFilter** - Start/end date inputs with presets (Today, This Week, This Month)
**SortableHeader** - Clickable column header with sort direction indicator
**PerPageSelect** - Dropdown with page size options (10, 25, 50, 100)

---

#### BUTTONS (8 components to build)

**Button** - Variants: primary, secondary, danger, ghost, link; Sizes: sm, md, lg; States: loading, disabled; With icon (left/right)
**IconButton** - Icon-only square button; Variants: default, success, danger, muted; Sizes: sm (24px), md (32px), lg (40px); Tooltip; aria-label required
**Icons needed:** View, Edit, Delete, Download, Send, Lock, Unlock, Share, Comment, Copy, Archive, Restore, Plus, Minus, Check, X, ChevronDown, ChevronRight, MoreVertical, MoreHorizontal, Search, Filter, Refresh
**ButtonGroup** - Horizontal group, connected styling, optional dividers
**DropdownButton** - Button with chevron that opens menu, keyboard navigation
**ToggleButton** - Two-state button (on/off) with icon/label changes
**SplitButton** - Primary action + dropdown for alternatives
**ButtonWithBadge** - Button with notification count badge
**LinkButton** - `<a>` styled as button

---

#### FORM ELEMENTS (11 components to build)

**TextInput** - Standard input; Variants: default, error, success, disabled; With icon; Clear button; Character count
**TextArea** - Multi-line; Auto-resize; Character count; Min/max rows
**Select** - Native styled + custom searchable; Single/multi-select; Option groups
**Checkbox** - Single with label; Indeterminate state; Checkbox group
**RadioGroup** - Horizontal/vertical layout; With descriptions
**FileUpload** - Click/drag-drop; File type restrictions; Size limit; Preview; Progress; Multiple files
**DatePicker** - Calendar popup; Min/max constraints; Range mode
**NumberInput** - With +/- buttons; Min/max/step; Format display (currency, %)
**FormGroup** - Label + Input + Error wrapper; Required indicator; Help text
**FormRow** - Horizontal layout for multiple fields; Responsive stacking
**FormSection** - Group of related fields with heading; Collapsible

---

#### DATA DISPLAY (9 components to build)

**DataTable** - Columns, sorting, filtering, pagination, bulk selection, row actions, empty/loading states, responsive
**Card** - Variants: basic, stats, details, action; Header/body/footer; Expandable
**StatCard** - Large value, label, change indicator (+/-%), trend icon, sparkline
**InfoRow** - Label + Value pair; Copy button; Link value
**InfoList** - Vertical list of InfoRows; Two-column option
**StatusBadge** (enhance) - Dot, label, pill variants; With icon
**ProgressBar** - Horizontal; Percentage label; Color variants; Indeterminate mode
**Timeline** - Vertical event list; Timestamps; Icons; Connector lines
**ActivityFeed** - Recent activities; Avatar + action + timestamp; Grouped by date

---

#### FEEDBACK (5 components to build)

**Toast** (enhance) - Variants; Auto-dismiss; Stack; Action button
**Alert** - Inline box; Variants; Dismissible; With icon
**Spinner** - Sizes: sm, md, lg; Centered; With message
**Skeleton** - Text, row, card, avatar; Animated shimmer
**EmptyState** (enhance) - Icon, title, description, action button

---

#### NAVIGATION (6 components to build)

**Tabs** - Horizontal/vertical; With icons; With badges; Underline/pill style
**Breadcrumbs** (enhance) - Links; Current page; Truncation; Home icon
**Pagination** - Prev/Next; Page numbers; Go to page; Items per page
**Sidebar** - Menu items; Nested sections; Active state; Badges; Collapse to icons
**NavItem** - Icon + Label; Active state; Badge; Submenu indicator
**StepIndicator** - Numbered steps; Current/completed/upcoming; Horizontal/vertical; Clickable

---

#### OVERLAYS (4 components to build)

**Modal** (enhance) - Sizes: sm, md, lg, fullscreen; Header/body/footer; Focus trapping; Escape/click outside
**Dropdown** - Trigger; Menu; Position options; Close behaviors
**Tooltip** - Hover-triggered; Position; Delay; Arrow
**Popover** - Click-triggered; Rich content; Close button; Position

---

#### COMPLEX PATTERNS (7 components to build)

**BulkActionToolbar** - Shows on selection; Count; Actions; Clear; Sticky
**LineItemEditor** - Editable rows; Add/remove; Drag reorder; Totals; Fields: Description, Qty, Rate, Amount
**FileIcon** - Icon by mime type (PDF, Image, Video, Audio, Archive, Document, Spreadsheet, Code)
**InlineEdit** - Click to edit; Save/Cancel; Enter/Escape; Validation
**ConfirmDialog** (enhance) - Danger variant; Input to confirm
**FilterBar** - Search + Status + Date Range + Clear All; Responsive collapse
**TableToolbar** - Filters; Bulk actions; View toggle; Export; Refresh

---

#### IMPLEMENTATION PRIORITY

**CRITICAL (build first):**

1. Button (all variants)
2. IconButton
3. TextInput
4. Select
5. FormGroup
6. DataTable
7. SearchFilter
8. StatusFilter
9. Pagination

**HIGH (build second):**

1. Card
2. StatCard
3. Tabs
4. DropdownButton
5. FilterBar
6. TableToolbar
7. InfoRow/InfoList
8. Alert
9. Skeleton

**MEDIUM (build third):**

1. DateRangeFilter
2. FileUpload
3. LineItemEditor
4. BulkActionToolbar
5. Timeline
6. ProgressBar
7. InlineEdit

**LOW (build last):**

1. Tooltip
2. Popover
3. StepIndicator
4. SplitButton
5. Remaining components

---

#### Task 1.55: Document Component Library

Location: `docs/design/COMPONENT_LIBRARY.md`

- [ ] Component inventory with visual examples
- [ ] API reference for each component
- [ ] CSS variable dependencies
- [ ] Accessibility notes (ARIA, keyboard)
- [ ] Migration guide from inline patterns

**Estimated Effort:** 15-20 hours

---

#### Phase 2: Admin Portal Dynamic Rebuild

**Status:** PENDING (blocked by Phase 1)

**Priority:** HIGH

**Objective:** Convert admin from pre-built HTML to dynamic JS rendering

### Task 2.1: Strip admin/index.html to shell

- [ ] Keep: sidebar, header, main content container
- [ ] Remove: all pre-built section HTML
- [ ] Add: `<div id="admin-content"></div>` mounting point

### Task 2.2: Convert admin modules (priority order)

Each module uses shared components from Phase 1:

- [ ] `admin-overview.ts` - Dashboard with stats cards, recent activity
- [ ] `admin-projects.ts` - DataTable with filters, status badges
- [ ] `admin-invoices.ts` - DataTable with bulk actions
- [ ] `admin-clients.ts` - DataTable with action menus
- [ ] `admin-files.ts` - DataTable with file type badges
- [ ] `admin-messages.ts` - Thread list, conversation view

**Estimated Effort:** 6-8 hours

---

#### Phase 3: Unify Admin + Client Portal Styling

**Status:** PENDING (blocked by Phase 2 completion)

**Priority:** HIGH

**Objective:** Client portal matches admin as much as possible

**NOTE:** Client login page styling is BETTER than admin login - use client login as reference for admin

#### Task 3.1: Shared CSS architecture

- [ ] Audit CSS variables for consistency
- [ ] Document shared component classes
- [ ] Create design tokens file

#### Task 3.2: Update admin login

- [ ] Match client login styling (client login is better)
- [ ] Consistent form styling
- [ ] Same visual polish

#### Task 3.3: Update client portal

- [ ] Replace manual HTML with shared components
- [ ] Match admin layouts where appropriate
- [ ] Permission-based content hiding (not separate views)

#### Task 3.4: Visual polish

- [ ] Consistent hover/focus states
- [ ] Mobile responsive verification
- [ ] Accessibility audit

**Estimated Effort:** 4-6 hours

---

## Summary: Remaining Work

| Phase | Description | Status | Priority | Est. Hours |
|-------|-------------|--------|----------|------------|
| 1 | Reusable Component Library | READY | HIGH | 8-12 |
| 2 | Admin Portal Dynamic Rebuild | PENDING | HIGH | 6-8 |
| 3 | Unify Portal Styling | PENDING | HIGH | 4-6 |

**Total Estimated:** 18-26 hours (frontend work)

---

## Deferred (Not In Scope)

- Projects assigned_to FK migration (solo freelancer - no team assignments)
- i18n/Localization
- Large file splitting
- Payment terms snapshot migration
- Row-level security / multi-tenancy

---

## DO NOT REMOVE OR EDIT ANYTHING BELOW THIS LINE

### Design System Reference

- `docs/design/UX_GUIDELINES.md` - Icons, typography, spacing, accessibility
- `docs/design/CSS_ARCHITECTURE.md` - CSS variables, component classes

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
