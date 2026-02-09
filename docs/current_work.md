# Current Work

**Last Updated:** February 9, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-02.md`.

---

## ✅ Completed - February 9, 2026

### Modal Standardization Refactoring

- **Dynamic Modals Converted to `createPortalModal()`** - COMPLETE
  - All dynamically-created modals in admin modules now use the reusable `createPortalModal()` component
  - Consistent overlay lifecycle via `modal.show()` / `modal.hide()` with body scroll lock
  - Focus trap handled internally by portal modal component
  - Files refactored:
    - `admin-tasks.ts` - `showTaskDetailModal()`, `showCreateTaskModal()` converted
    - `admin-global-tasks.ts` - `showTaskDetailModal()` converted, removed manual focus trap
    - `admin-leads.ts` - `showCancelledByDialog()` converted
    - `invoice-modals.ts` - `showCreateInvoicePrompt()` converted
    - `admin-projects.ts` - Preview modals (`showPreviewModal()`, etc.) converted
    - `admin-proposals.ts` - Template editor modal converted to dynamic creation
  - Pattern: Import `createPortalModal`, create modal, set `body.innerHTML`, set `footer.innerHTML`, append to DOM, call `show()`
  - All modals verified: `npm run typecheck` passes, `npm run lint` passes (1 unrelated warning)

- **CSS Cleanup Deferred** - PARTIAL
  - Issue: Static HTML modals in `admin/index.html` still use `.admin-modal-*` classes
  - Affected modals: dr-create-modal, dr-detail-modal, file-upload-modal, detail-modal, add-client-modal, add-project-modal, edit-client-info-modal, edit-billing-modal, edit-project-modal
  - CSS classes cannot be removed until static modals are also migrated
  - Current state: Both `.modal-*` (portal modal) and `.admin-modal-*` (legacy) classes coexist

---

## ✅ Completed - February 7, 2026

### Table & Card Styling Cohesion

- **Table Bottom Corner Fixes** - COMPLETE
  - Fixed border-radius clipping on table bottom corners across all admin tables
  - Issue: Tables with/without pagination had inconsistent corner handling AND inconsistent HTML structure
  - Solution:
    - Pagination must be OUTSIDE `.admin-table-scroll-wrapper`, sibling of `.admin-table-container`
    - `.admin-table-scroll-wrapper` gets bottom radius when no pagination
    - `.table-pagination` handles bottom corners when present
    - `:has()` selector removes scroll-wrapper radius when pagination exists
  - Made `.admin-table` background transparent (cells have background)
  - Fixed HTML structure for Document Requests and KB Articles tables to match Leads/Projects pattern
  - Files: `src/styles/pages/admin.css`, `src/styles/admin/table-features.css`, `admin/index.html`

- **Light Grey Card Shadow Removal** - COMPLETE
  - Removed shadows from `--portal-bg-medium` elements for visual consistency
  - Rule: Main dark containers get shadows, child light grey elements have NO shadow
  - Elements fixed: `.data-item`, `.vital-card`, `.bundle-item`
  - Files: `src/styles/admin/analytics.css`, `src/styles/pages/admin.css`

- **Visitors Table Structure Fix** - COMPLETE
  - Restructured Analytics visitors table to use standard `.admin-table-card` wrapper
  - Added proper header with `<h3>Recent Sessions</h3>`
  - Now matches structure of all other admin tables
  - File: `admin/index.html`

- **CSS_ARCHITECTURE.md Documentation Updated** - COMPLETE
  - Added `.data-item`, `.vital-card`, `.bundle-item` to shadow hierarchy examples
  - Added new "Admin Table Structure" section with HTML pattern and CSS rules
  - Documented corner radius handling for tables with/without pagination

### CSS Audit & Consistency Fixes

- **Icon Size Tokens Added** - COMPLETE
  - Created standardized icon size tokens in `variables.css`
  - Tokens: `--icon-size-xs` (12px) through `--icon-size-2xl` (32px)
  - Updated all hardcoded icon sizes to use tokens
  - Files: `variables.css`, `view-toggle.css`, `search-bar.css`, `workflows.css`, `detail-header.css`, `confirm-dialog.css`, `sidebar-badges.css`

- **Letter-Spacing Tokens Added** - COMPLETE
  - Created standardized letter-spacing tokens in `variables.css`
  - Tokens: `--letter-spacing-label` (0.05em), `--letter-spacing-title` (0.02em), `--letter-spacing-wide` (0.08em)
  - Updated all hardcoded `letter-spacing: 1px` to use tokens
  - Files: `variables.css`, `portal-cards.css`, `confirm-dialog.css`

- **Focus States Added (Accessibility)** - COMPLETE
  - Added `:focus-visible` to view toggle buttons
  - Added focus ring to search input (`box-shadow`)
  - Added `:focus-visible` to search clear button
  - Files: `view-toggle.css`, `search-bar.css`

- **Font Sizes Fixed (Accessibility)** - COMPLETE
  - Changed all `0.65rem` and `9px` font sizes to `0.75rem` minimum
  - Affected: filter badges, priority badges, sidebar badges
  - Files: `table-filters.css`, `portal-cards.css`, `sidebar-badges.css`

- **Hardcoded Values Tokenized** - COMPLETE
  - Replaced hardcoded `px` spacing with `--space-*` tokens
  - Replaced hardcoded border-radius with `--portal-radius-*` tokens
  - Replaced hardcoded transitions with `--transition-fast`
  - Files: `view-toggle.css`, `search-bar.css`, `tooltips.css`, `table-filters.css`, `portal-cards.css`, `workflows.css`, `sidebar-badges.css`, `confirm-dialog.css`

- **Duplicate Declarations Removed** - COMPLETE
  - Removed duplicate `padding`, `list-style`, `margin` in dropdown menu
  - File: `detail-header.css`

- **CSS_AUDIT.md Updated** - COMPLETE
  - Documented all fixes applied
  - Updated common patterns with new tokens
  - Reflects current compliant state

### Messaging Pin Icons

- **Pin/Unpin Icons Updated** - COMPLETE
  - Replaced custom SVG with Lucide `pin` icon (for unpinned messages)
  - Replaced custom SVG with Lucide `pin-off` icon (for pinned messages)
  - Fixed API endpoints for pin/unpin actions
  - Added `is_pinned` to messages query via JOIN with `pinned_messages` table
  - Files: `src/features/admin/modules/admin-messaging.ts`, `server/routes/messages.ts`

### Workflows Table Fixes

- **Default Indicator Styling** - COMPLETE
  - Replaced status badge with purple star icon for default workflows
  - Added `.default-indicator` class with `--color-admin-purple`
  - Files: `src/features/admin/modules/admin-workflows.ts`, `src/styles/admin/workflows.css`

- **Workflows Table Cell Classes** - COMPLETE
  - Added `type-cell`, `status-cell`, `date-cell` classes to match other tables
  - Wrapped action buttons in `table-actions` div for proper flex layout
  - Added outer column padding rules
  - Files: `src/features/admin/modules/admin-workflows.ts`, `src/styles/admin/workflows.css`

- **Trigger Toggle Icon** - COMPLETE
  - Replaced custom sun icon with eye/eye-off pattern (matches leads module)
  - Eye = active, Eye-off = inactive
  - File: `src/features/admin/modules/admin-workflows.ts`

- **Subtab Navigation Styling Fixed** - COMPLETE
  - Added `.portal-subtab` class to Approvals/Triggers buttons
  - Changed container from `analytics-subtabs` to `portal-subtabs`
  - File: `admin/index.html`

- **Name Column Styling Fixed** - COMPLETE
  - Removed `<strong>` tag wrapping from name cells
  - Added `.name-cell` class for consistent table styling
  - Added `.name-col` class to table headers
  - Files: `src/features/admin/modules/admin-workflows.ts`, `admin/index.html`

### Dashboard Shadow Styling

- **Child Element Shadows Added** - COMPLETE
  - Added `box-shadow: var(--shadow-card)` to `.task-item` elements
  - Added `box-shadow: var(--shadow-card)` to `.attention-icon` elements
  - Added `box-shadow: var(--shadow-card)` to `.activity-icon` elements
  - Added `box-shadow: var(--shadow-card)` to `.kanban-card` elements
  - File: `src/styles/shared/portal-cards.css`, `src/styles/shared/portal-components.css`

- **Lead Analytics Background Fixed** - COMPLETE
  - Changed `.analytics-column` background from `var(--portal-bg-light)` to `var(--portal-bg-medium)`
  - Added `box-shadow: var(--shadow-card)` to analytics columns
  - File: `src/styles/admin/leads-pipeline.css`

- **Chart Canvas Wrapper Shadows Added** - COMPLETE
  - Added `box-shadow: var(--shadow-card)` to `.chart-canvas-wrapper`
  - File: `src/styles/admin/analytics.css`

- **Scoring Rules List Container Styled** - COMPLETE
  - Added background, padding, border-radius, and shadow to `.scoring-rules-list`
  - File: `src/styles/admin/leads-pipeline.css`

### Status Badge Conversion

- **Converted All Status Badges to Dot-Style** - COMPLETE
  - Project invoices list
  - Contact detail modals
  - Files: `src/features/admin/project-details/invoices.ts`, `src/features/admin/renderers/admin-contacts.renderer.ts`, `src/features/admin/admin-dashboard.ts`

- **Status Dot Spacing Standardized** - COMPLETE
  - Changed status indicator gap from hardcoded `0.5rem` to `var(--space-1)`
  - Changed table dropdown dot margin from `var(--space-0-5)` (4px) to `var(--space-1)` (8px)
  - Now consistent across status indicators and table dropdowns
  - Files: `src/styles/shared/portal-badges.css`, `src/styles/admin/table-dropdowns.css`

- **Toggle Button Styling Standardized** - COMPLETE
  - Changed text-based toggle buttons (Pause/Resume) to eye/eye-off icon buttons
  - Matches the leads table scoring rules pattern
  - Updated: Analytics schedules, Analytics alerts, Recurring invoices
  - Files: `src/features/admin/modules/admin-analytics.ts`, `src/features/admin/project-details/invoice-scheduling.ts`

- **View Toggle Icons Standardized** - COMPLETE
  - All view toggles now have SVG icons (matching leads pattern)
  - Tasks: Board/List icons
  - Global Tasks: Board/List icons
  - Dashboard Tasks: Board/List icons
  - Proposals: Document/Template icons
  - Files (already had icons): List/Grid icons
  - Files: `admin-tasks.ts`, `admin-global-tasks.ts`, `admin-overview.ts`, `admin-proposals.ts`

### Design Documentation Updates

- **UX_GUIDELINES.md Updated** - COMPLETE
  - Added Enable/Disable Toggle Pattern section (eye/eye-off icons)
  - Added View Toggle Pattern section with icon table
  - Documented icon button usage and locations

- **CSS_ARCHITECTURE.md Updated** - COMPLETE
  - Added spacing note to Status Dots section (`var(--space-1)` standard)

- **REUSABLE_COMPONENTS_AUDIT.md Updated** - COMPLETE
  - Added View Toggles section (section 6)
  - Documented `createViewToggle` component and icon requirements
  - Updated summary table with view toggle status

### Table Column & Dropdown Refinements

- **Column Spacing Adjustments** - COMPLETE
  - Date columns: extra `padding-right: var(--space-6)` for breathing room
  - Contact columns: `min-width: 200px` for client names
  - Email columns: extra `padding-right: var(--space-12)`
  - Name columns: `padding-right: var(--space-8)`
  - Type/Budget/Timeline columns: `padding-right: var(--space-8)`
  - Count columns: centered text
  - Actions columns: right-aligned (cells only, header left-aligned)
  - File: `src/styles/pages/admin.css`

- **Table Dropdown Min-Width** - COMPLETE
  - Set min-width to 115px (fits longest status "Responded" + caret)
  - Changed from `width: 100%` to `width: fit-content`
  - Files: `src/styles/pages/admin.css`, `src/styles/shared/portal-dropdown.css`

- **Status Cell Padding Reduced** - COMPLETE
  - Changed from `padding: var(--space-2) var(--space-4)` to `padding: var(--space-2)`
  - Tighter fit around dropdown
  - File: `src/styles/pages/admin.css`

- **Sortable Header Icons Right-Aligned** - COMPLETE
  - Sort icons now positioned at right edge of column headers using absolute positioning
  - Added `position: relative` and extra `padding-right` to sortable headers
  - Files: `src/styles/pages/admin.css`, `src/styles/admin/table-filters.css`

### Clients Table Enhancements

- **Invite Button Moved to Actions Column** - COMPLETE
  - Removed inline invite button from status cell
  - Added invite button to actions column (appears for "Not Invited" clients)
  - File: `src/features/admin/modules/admin-clients.ts`

- **Last Active Column Added** - COMPLETE
  - Added "Last Active" column showing last login date
  - Shows "Never" for clients who haven't logged in
  - Files: `admin/index.html`, `src/features/admin/modules/admin-clients.ts`

- **Status Indicator Styling Fixed** - COMPLETE
  - Added `status-not-invited` variant to status indicator styles
  - Scoped `.status-not-invited` badge styles to `.status-badge` only (prevents conflict)
  - Fixed status label not being passed to `getStatusDotHTML`
  - Files: `src/styles/shared/portal-badges.css`, `src/styles/pages/admin.css`, `src/features/admin/modules/admin-clients.ts`

### Table & Mobile Fixes

- **Mobile Horizontal Scroll Fix** - COMPLETE
  - Added `min-width: 0` to flex children for proper horizontal scrolling
  - Files: `src/styles/pages/admin.css` (`.dashboard-content`, `.admin-table-container`, `.admin-table-card`)

- **Table Cell Padding Standardized** - COMPLETE
  - Changed cell padding from `var(--space-3) var(--space-4)` to `var(--space-3)` (24px uniform)
  - Applies to both mobile and desktop
  - File: `src/styles/pages/admin.css`

- **Fit-Content Column Classes** - COMPLETE
  - Added CSS classes for columns that should only be as wide as their content
  - Classes: `.status-col`, `.date-col`, `.actions-col`, `.type-col`, `.budget-col`, `.timeline-col`, `.count-col`, `.email-col`
  - Pattern: `width: 1%; white-space: nowrap;`
  - Files modified:
    - `src/styles/pages/admin.css` - CSS class definitions
    - `admin/index.html` - Added classes to all table headers
    - `src/features/admin/modules/admin-leads.ts` - Cell classes
    - `src/features/admin/modules/admin-projects.ts` - Cell classes
    - `src/features/admin/modules/admin-clients.ts` - Cell classes
    - `src/features/admin/modules/admin-contacts.ts` - Cell classes

- **Contacts Table Email Column** - COMPLETE
  - Added separate Email column to Contact Form Submissions table
  - Files: `admin/index.html`, `src/features/admin/modules/admin-contacts.ts`

- **Email Copy Icon Spacing Fix** - COMPLETE
  - Fixed spacing for emails with copy icons in lead details panel
  - File: `src/styles/admin/leads-pipeline.css`

### Responsive Table Column Stacking

- **Column Stacking at Breakpoints** - COMPLETE
  - Tables progressively stack columns at smaller viewports to prevent horizontal scroll
  - Stacked data is duplicated in HTML (hidden by default, shown via CSS at breakpoints)
  - Breakpoints:
    - `1280px`: Leads/Projects hide Budget column, stack under Type
    - `1280px`: Contacts hide Email column, stack under Contact
    - `1100px`: Leads hide Date column, stack above Status
  - Files: `admin.css`, `admin-leads.ts`, `admin-contacts.ts`, `admin-projects.ts`

- **Mobile Card View Duplicate Data Fix** - COMPLETE
  - Issue: On mobile (375px), stacked elements showed alongside original cells (duplicate budget)
  - Cause: 1280px breakpoint rule applies to mobile (375px < 1280px), showing `budget-stacked`
  - Mobile card view also shows `budget-cell` as block, creating duplicates
  - Fix: Added `display: none !important` for stacked elements within `@media (--small-mobile)`
  - File: `src/styles/pages/admin.css`

- **Sortable Column Labels Fixed** - COMPLETE
  - Updated filter configs so sortable column labels match header text
  - Leads: "Project Type" → "Type", "Contact" → "Lead"
  - Contacts: "Name" → "Contact"
  - Projects: "Project Name" → "Project", "Start Date" → "Start"
  - Clients: "Name" → "Client"
  - File: `src/utils/table-filter.ts`

- **Table Sorting Infinite Click Fix** - COMPLETE
  - Fixed bug where table sorting only worked once then stopped
  - Root cause: Click handler captured stale `state` object in closure
  - Solution: Store sort state in DOM data attributes on `thead`, read fresh values on each click
  - File: `src/utils/table-filter.ts`

- **Mobile Card Layout Streamlining** - COMPLETE
  - Deep dive audit of mobile table styling across all admin tables
  - Added explicit CSS `order` values for consistent cell display order on mobile cards:
    - Order -2: Identity cells (primary name/email/company)
    - Order 1: Type cells
    - Order 2: Budget/Count cells
    - Order 3: Timeline/Email cells
    - Order 4: Message cells
    - Order 5: Status cells
    - Order 6: Date cells
    - Order 10: Actions cells
  - Added missing mobile styling for `timeline-cell` and `count-cell`
  - Standardized color scheme: light for primary, secondary for metadata, muted for dates/counts
  - Updated TABLE_AUDIT.md with comprehensive mobile styling documentation
  - File: `src/styles/pages/admin.css`

- **Unified Table Column Order** - COMPLETE
  - Standardized column order across all admin tables: ☐ → Identity → Type → Status → Details → Date(s) → Actions
  - Status column moved earlier (position 3-4) for quick scanning
  - Added checkbox column to Contacts table with bulk actions (Mark Read, Mark Responded, Archive, Delete)
  - Added Actions column to Projects table with View button
  - Updated mobile CSS order values to match desktop order
  - Files modified:
    - `admin/index.html` - Reordered headers for Leads, Contacts, Projects, Clients
    - `admin-leads.ts` - Reordered cells
    - `admin-contacts.ts` - Added checkbox, bulk actions, reordered cells
    - `admin-projects.ts` - Added Actions column, reordered cells
    - `admin-clients.ts` - Reordered cells
    - `admin.css` - Updated mobile order values
    - `TABLE_AUDIT.md` - Updated column order reference

### Bulk Actions & Table Improvements

- **Bulk Action Icon Buttons** - COMPLETE
  - Converted bulk action toolbar buttons from text+icon to icon-only
  - Added `.bulk-action-icon-btn` class with proper styling
  - Files: `src/utils/table-bulk-actions.ts`, `src/styles/admin/table-features.css`

- **Bulk Status Update Dropdown** - COMPLETE
  - Replaced modal dialog with inline dropdown for bulk status updates
  - Added `dropdownOptions` support to `BulkAction` interface
  - Created `createBulkActionDropdown` function for dropdown-style bulk actions
  - Files: `src/utils/table-bulk-actions.ts`, `src/features/admin/modules/admin-leads.ts`, `src/styles/admin/table-features.css`

- **Contacts Table Actions Column** - COMPLETE
  - Added Actions column to Contact Form Submissions table
  - Action buttons: Convert to Client, Archive, Restore
  - Styled consistently with other table action columns
  - Files: `admin/index.html`, `src/features/admin/modules/admin-contacts.ts`

- **Table Header Button Order Standardized** - COMPLETE
  - All tables now use consistent order: Export → Refresh → Add
  - Fixed Projects and Clients tables to match pattern
  - File: `admin/index.html`

- **Table Action Buttons Styling** - COMPLETE
  - All action column buttons now neutral color (not red)
  - Turn red on hover (matches other icon buttons)
  - Added `table-actions` wrapper to leads table
  - Removed special `.icon-btn-convert` red styling
  - Files: `src/styles/pages/admin.css`, `src/features/admin/modules/admin-leads.ts`

- **Sidebar Sign Out Hover Effect** - COMPLETE
  - Sign out button now has same hover effect as nav buttons (turns red)
  - File: `src/styles/shared/portal-buttons.css`

- **Bulk Toolbar Selection Count Alignment** - COMPLETE
  - Selection count number aligned above checkboxes (24px width)
  - Added spacing between number and "selected" text
  - File: `src/styles/admin/table-features.css`

---

## Post-Task Documentation Checklist

After completing any task:

- [ ] Move completed item from current_work to archive
- [ ] Add entry to `ARCHIVED_WORK_2026-02.md`
- [ ] Update feature docs (`docs/features/*.md`) if API/features changed
- [ ] Update `API_DOCUMENTATION.md` if endpoints changed
- [ ] Update relevant audit file (current state only, no fix logs)
- [ ] Verify no markdown violations

---

## Open Issues (active)

### Design Concerns

- **Project Detail Page - Pill Label Styling**: The "ROLE", "YEAR", "DURATION", "TOOLS" labels use pill/rounded styling that looks awkward. Consider alternative styling (e.g., plain text labels, underlined labels, or smaller caps without background).

### Needs User Verification

- **Analytics Page KPI Cards (Feb 3)**: Fixed but awaiting user testing to confirm KPI cards display correctly.

- **Sidebar counts**: `GET /api/admin/sidebar-counts` — endpoint exists and looks correct, needs verification it works without errors.

### TODO - Status Badge Conversion - COMPLETE (Feb 7)

- [x] Convert all status badges to dot-style indicators (status dot + text instead of pill badges)
- [x] Project details page - invoice status displays
- [x] Contact detail modals - status displays
- [x] All remaining tables converted from `getStatusBadgeHTML` to `getStatusDotHTML`
- Files updated:
  - `src/features/admin/project-details/invoices.ts`
  - `src/features/admin/renderers/admin-contacts.renderer.ts`
  - `src/features/admin/admin-dashboard.ts`

---

## Outstanding Tasks

### General UI/UX - COMPLETE (Feb 9)

- [x] **Secondary Sidebar for Multi-Tab Pages** - COMPLETE (disabled per user preference)
  - Created `src/styles/admin/secondary-sidebar.css` with vertical tab styling
  - Created `src/components/secondary-sidebar.ts` with reusable component
  - Documented in `docs/features/SECONDARY_SIDEBAR.md` for future re-enablement
  - Features: collapsible, localStorage persistence, horizontal fallback on mobile

- [x] **Project Milestones Auto-Population** - COMPLETE
  - Created `server/config/default-milestones.ts` with templates per project type
  - Created `server/services/milestone-generator.ts` for auto-generation
  - Integrated into project creation routes (projects.ts, admin.ts)
  - Supports: simple-site, business-site, ecommerce-site, web-app, maintenance, other
  - Added `POST /api/admin/milestones/backfill` endpoint for existing projects
  - Backfill run: 8 milestones created for 2 existing projects
  - Documented in `docs/features/MILESTONES.md`

- [x] **Task Priority Auto-Update** - COMPLETE
  - Created `server/services/priority-escalation-service.ts` with escalation logic
  - Rules: ≤1 day = urgent, ≤3 days = high, ≤7 days = medium
  - Only escalates UP (never downgrades), excludes completed/cancelled tasks
  - Added daily 6 AM scheduled job in scheduler-service.ts
  - Added API endpoint: `POST /api/projects/:id/tasks/escalate-priorities`

- [x] **Project Detail Page Restructure** - COMPLETE
  - Added header card above tabs (matches client detail pattern)
  - Header shows: project name, status, client info, type, dates, budget
  - Restructured overview tab with two-column grid layout
  - Left column: Project details, Milestones, Recent Activity
  - Right column: Progress ring, Financial summary, Quick stats
  - Added sidebar stats: Files, Messages, Tasks, Invoices counts
  - Added financial stats: Invoiced, Paid, Outstanding totals
  - Fully responsive: stacks to single column on tablet, optimized for mobile
  - Files modified: `admin/index.html`, `project-detail.css`, `admin-projects.ts`

### 1. Documentation Audit

**Status:** IN PROGRESS (Feb 7)

#### Feature Docs (`docs/features/`)

- [x] Audit existing feature docs for completeness (Feb 7)
- [x] Create missing feature docs (Feb 8) - All 6 missing docs created
- [ ] Update outdated feature docs
- [x] Cross-reference with actual implemented features (Feb 7)

**Status (Feb 8):** All 25 feature docs now complete.

**All feature docs now complete (Feb 8):**

- `TASKS.md` - Project and global tasks (Kanban + List views)
- `TIME_TRACKING.md` - Time entries for projects
- `DOCUMENT_REQUESTS.md` - Client document collection
- `KNOWLEDGE_BASE.md` - Help articles/KB system
- `CONTACTS.md` - Contact form submissions
- `WORKFLOWS.md` - Approval workflows and event triggers

**API Documentation:** Complete - all endpoints documented in `API_DOCUMENTATION.md`

#### CSS Design Docs (`docs/design/`)

- [x] Verify `CSS_ARCHITECTURE.md` reflects current file structure (Feb 6)
- [x] Verify `CSS_AUDIT.md` metrics are accurate (93 files) (Feb 7)
- [x] Update `PORTAL_CSS_DESIGN.md` file lists (21 admin files) (Feb 6)
- [x] CSS variables documented in `CSS_ARCHITECTURE.md` (layout, typography, spacing, animations, z-index, theme)
- [x] Reusable component classes documented in `CSS_ARCHITECTURE.md` (card, buttons, inputs, badges) and `PORTAL_CSS_DESIGN.md` (button hierarchy)
- [x] CSS inconsistencies resolved (Feb 6-7): labels, border-radius, shadows, icon sizes, letter-spacing, focus states
- [x] Icon size tokens added to `variables.css` (Feb 7)
- [x] Letter-spacing tokens added to `variables.css` (Feb 7)
- [x] Focus states documented in `CSS_ARCHITECTURE.md` (Feb 7)

### 2. Portfolio Assets Needed

**Status:** Waiting on assets

The portfolio section code is complete but needs images:

- [ ] Project screenshots
- [ ] CRT TV title cards for each project
- [ ] OG images for social sharing (1200x630 PNG)

**Location:** `public/images/portfolio/` (directory needs to be created)

### 3. Front-End Polish

- [x] Time-sensitive tasks view on dashboard (Upcoming Tasks widget - Feb 6)
- [ ] Lead funnel styling improvements
- [ ] Analytics tab: use reusable components instead of analytics-only markup

### 4. Client + Project Details Reorganization

**Status:** Planning — optional UX improvements

- [ ] Merge Quick Stats + Health into single card
- [ ] Merge Client Overview + CRM Details into single card
- [ ] Reduce Overview tab from 7 cards to 3-4

### 5. Analytics Design Cohesion

**Goal:** Make Analytics tab styling consistent with System tab.

**Issues:** Mixed card wrappers, inconsistent titles, nested shadows, multiple grid patterns.

**Plan file:** `/Users/noellebhaduri/.claude/plans/hashed-fluttering-sprout.md`

---

## Audit Tasks (from design audits)

### Medium Priority

| Task | Source | Effort | Notes |
|------|--------|--------|-------|
| Text-based foreign keys | DATABASE_AUDIT | High | Replace `assigned_to`, `user_name` TEXT with proper FK references |
| Timestamp inconsistency | DATABASE_AUDIT | Medium | Standardize TEXT vs DATETIME across tables |
| Payment terms history | DATABASE_AUDIT | Medium | Preserve history when updating presets |
| Lead/Intake overlap | DATABASE_AUDIT | High | Consolidate duplicate intake/lead tracking |

### Low Priority - PDF Enhancements

| Task | Notes |
|------|-------|
| Draft watermark | Visual indicator for unpaid/draft invoices |
| PDF/A compliance | Requires XMP metadata library |
| Password protection | For sensitive documents |
| Thumbnails/previews | Show preview before download |
| Digital signatures | For legally binding contracts |

### Low Priority - Database

| Task | Notes |
|------|-------|
| Redundant fields | Remove `is_read` where `read_at` exists |
| Audit triggers | Add automatic timestamp triggers |
| Row-level security | Add tenant_id enforcement |

### Low Priority - Accessibility

| Task | Notes |
|------|-------|
| High contrast focus | Enhanced focus indicators for high contrast mode |

### Do Last - CSS Refactoring

| File | Lines | Status |
|------|-------|--------|
| `pages/admin.css` | 2,064 | DONE - Split: table-dropdowns, tooltips, table-filters, sidebar-badges |
| `admin/project-detail.css` | 1,645 | DONE - Split: pd-contract, pd-invoices |
| `pages/projects.css` | 1,120 | SPLIT: projects-detail.css (547 lines) |
| `pages/client.css` | 739 | SPLIT: client-auth.css (666 lines) |
| `admin/client-detail.css` | 805 | DONE - Split: cd-crm.css (497 lines) |

### CSS Consistency Fixes (Feb 6-7) - COMPLETE

- [x] Label font size: All `0.6875rem` → `0.75rem`
- [x] Label font size: All `0.625rem` → `0.75rem` (client-detail.css - 10 instances)
- [x] Border radius: All `--border-radius-card` → `--portal-radius-md`
- [x] Border radius: Hardcoded values tokenized (projects.css, client.css)
- [x] Status colors: projects.css hardcoded rgba/rgb → `--color-status-*` variables
- [x] Fixed heights: client.css auth container → responsive min-height/max-height
- [x] Filter dropdown padding: `1rem` → `var(--space-3)`
- [x] Search bar fallback chain simplified
- [x] Icon sizes: Created `--icon-size-*` tokens, updated all hardcoded icon sizes
- [x] Letter-spacing: Created `--letter-spacing-*` tokens, updated all `1px` values
- [x] Focus states: Added to view-toggle, search-bar buttons (accessibility)
- [x] Min font size: All `0.65rem` and `9px` → `0.75rem` (accessibility)
- [x] Transitions: Replaced hardcoded `0.15s ease` with `var(--transition-fast)`

---

## Planned: API Versioning (`/api/v1/`)

### Phase 1: Backend ✅ COMPLETE

Already mounts routers at both `/api/` and `/api/v1/`.

### Phase 2-4: Frontend + Docs (Optional)

- Add `API_PREFIX` constant in frontend config
- Update docs to state `/api/v1/` as canonical

**Decision needed:** Is this worth doing? Current `/api/` works fine.

---

## Planned: Full WCAG 2.1 AA Compliance

**Already in place:** Skip link, focus trap, ARIA, focus states, password toggles.

**Remaining:**

- [ ] Run axe/Lighthouse audit on all pages
- [ ] Fix any critical/high violations found
- [ ] Screen reader manual pass on key flows

---

## Planned: System Gaps (Future)

### Not Currently Needed

| Item | Reason to Defer |
|------|-----------------|
| WebSockets/SSE | Polling works fine |
| PWA/Offline | Clients have connectivity |
| Redis caching | SQLite is fast enough |
| CI/CD | Manual deploy works |
| Zod validation | Current validation works |

### Consider Later

- [ ] Database backups automation (currently manual SQLite copy)
- [ ] E2E test expansion (admin create invoice, portal file upload)

---

## Verification Checklist

### Admin Dashboard

- [ ] Login works (cookie set)
- [ ] Overview stats display correctly
- [ ] Upcoming tasks displays on dashboard
- [ ] Recent activity shows leads
- [ ] All sidebar tabs load (including Global Tasks tab)
- [ ] Project list displays
- [ ] Project detail opens
- [ ] Client list displays
- [ ] Client detail opens
- [ ] Invoice list displays
- [ ] Invoice actions work (send, mark paid)
- [ ] Lead pipeline loads
- [ ] Lead drag-and-drop works
- [ ] Messages thread list loads
- [ ] Messages compose works
- [ ] Analytics charts render
- [ ] System status loads
- [ ] Document requests list
- [ ] Knowledge base CRUD

### Client Portal

- [ ] Login works (cookie set)
- [ ] Dashboard displays project list
- [ ] Project detail opens
- [ ] Files tab shows files
- [ ] File upload works
- [ ] Messages load
- [ ] Message compose works
- [ ] Invoices display
- [ ] Invoice PDF download
- [ ] Document requests show
- [ ] Help articles load

### Main Site

- [ ] Homepage loads
- [ ] Navigation works
- [ ] Contact form submits
- [ ] Portfolio section displays

---

## Deferred Items

- **Stripe Payments** — Cost deferral
- **Real-Time Messages (WebSockets)** — Polling works fine
- **Webhooks/Public API** — No external integrations needed
- **MFA/2FA, SSO** — Single admin user
- **Virtual Tour/Walkthrough** — Nice to have, not essential

---

## New API Endpoints Reference

### Global Tasks (`/api/admin/tasks`) - Feb 6

- `GET /` — Get all tasks across all active projects (params: status, priority, limit)

### Deleted Items (`/api/admin/deleted-items`) - Feb 6

- `GET /` — List all soft-deleted items with stats
- `GET /stats` — Get counts by entity type
- `POST /:type/:id/restore` — Restore a soft-deleted item
- `DELETE /:type/:id/permanent` — Permanently delete an item
- `POST /cleanup` — Run manual cleanup of expired items

### Workflow Triggers (`/api/triggers`) - Feb 2

- `GET /` — Get all triggers
- `POST /` — Create a new trigger
- `PUT /:id` — Update a trigger
- `DELETE /:id` — Delete a trigger
- `POST /:id/toggle` — Toggle trigger active state

### Document Requests (`/api/document-requests`) - Feb 2

- `GET /my-requests` — Get client's document requests
- `POST /:id/upload` — Upload document for request
- Admin endpoints for CRUD, review, approve, reject

### Knowledge Base (`/api/kb`) - Feb 2

- `GET /categories` — Get all categories
- `GET /featured` — Get featured articles
- `GET /search` — Search articles

---
