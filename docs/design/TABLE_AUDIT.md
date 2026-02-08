# Complete Table Audit - Portal

**Last Updated:** 2026-02-08

## Table of Contents

- [Display Name Reference](#display-name-reference)
  - [Column Order Reference](#column-order-reference-all-tables)
- [Architecture Overview](#architecture-overview)
- [Component Deep-Dive](#component-deep-dive)
  - [Portal Checkbox](#1-portal-checkbox)
  - [Table Dropdown](#2-table-dropdown)
  - [Status Badge](#3-status-badge)
  - [Filter System](#4-filter-system-search--status--date)
  - [Pagination System](#5-pagination-system)
  - [Bulk Actions System](#6-bulk-actions-system)
  - [Export System](#7-export-system)
  - [View Toggle](#8-view-toggle)
  - [Filter Select](#9-filter-select)
  - [Kanban Board](#10-kanban-board)
  - [Copy Email Button](#11-copy-email-button)
  - [Loading States](#12-loading--empty--error-states)
  - [Confirm Dialog](#13-confirm-dialog)
  - [Component Usage Map](#component-usage-map-by-table)
- [Admin Tables](#admin-tables)
  - [Leads Table](#1-leads-table)
  - [Clients Table](#2-clients-table)
  - [Contacts Table](#3-contacts-table)
  - [Projects Table](#4-projects-table)
  - [Invoices Table](#5-invoices-table)
  - [Proposals Table](#6-proposals-table)
  - [Time Tracking Table](#7-time-tracking-table)
  - [Document Requests Table](#8-document-requests-table)
  - [Knowledge Base Tables](#9-knowledge-base-tables)
  - [Tasks (Kanban + List)](#10-tasks-kanban--list)
  - [Visitors Table (Analytics)](#11-visitors-table-analytics)
  - [Project Detail - Files Sub-Table](#12-project-detail---files-sub-table)
  - [Project Detail - Invoices Sub-Table](#13-project-detail---invoices-sub-table)
- [Client Portal Tables](#client-portal-tables)
  - [Portal Invoices](#14-portal-invoices)
  - [Portal Projects](#15-portal-projects)
  - [Portal Files](#16-portal-files)
  - [Portal Document Requests](#17-portal-document-requests)
  - [Proposal Comparison Table](#18-proposal-comparison-table)
- [Styling and Responsiveness](#styling-and-responsiveness)
  - [CSS Variables](#css-variables-used-for-tables)
  - [Table Cell Styling](#table-cell-styling)
  - [Responsive Breakpoints](#responsive-breakpoints)
  - [Column Hiding per Table](#column-hiding-per-table-mobile-480px)
  - [Mobile-Specific Behavior](#mobile-specific-behavior)
  - [CSS File Locations](#css-file-locations)
- [Comparison Matrix](#comparison-matrix)
- [Shared vs Custom Components](#shared-vs-custom-components)
- [Cross-Table Consistency Analysis](#cross-table-consistency-analysis) (All resolved)

<!-- TOC anchors -->
<a id="display-name-reference"></a>
<a id="column-order-reference-all-tables"></a>
<a id="architecture-overview"></a>
<a id="component-deep-dive"></a>
<a id="1-portal-checkbox"></a>
<a id="2-table-dropdown"></a>
<a id="3-status-badge"></a>
<a id="4-filter-system-search--status--date"></a>
<a id="5-pagination-system"></a>
<a id="6-bulk-actions-system"></a>
<a id="7-export-system"></a>
<a id="8-view-toggle"></a>
<a id="9-filter-select"></a>
<a id="10-kanban-board"></a>
<a id="11-copy-email-button"></a>
<a id="12-loading--empty--error-states"></a>
<a id="13-confirm-dialog"></a>
<a id="component-usage-map-by-table"></a>
<a id="admin-tables"></a>
<a id="1-leads-table"></a>
<a id="2-clients-table"></a>
<a id="3-contacts-table"></a>
<a id="4-projects-table"></a>
<a id="5-invoices-table"></a>
<a id="6-proposals-table"></a>
<a id="7-time-tracking-table"></a>
<a id="8-document-requests-table"></a>
<a id="9-knowledge-base-tables"></a>
<a id="10-tasks-kanban--list"></a>
<a id="11-visitors-table-analytics"></a>
<a id="12-project-detail---files-sub-table"></a>
<a id="13-project-detail---invoices-sub-table"></a>
<a id="client-portal-tables"></a>
<a id="14-portal-invoices"></a>
<a id="15-portal-projects"></a>
<a id="16-portal-files"></a>
<a id="17-portal-document-requests"></a>
<a id="18-proposal-comparison-table"></a>
<a id="styling-and-responsiveness"></a>
<a id="css-variables-used-for-tables"></a>
<a id="table-cell-styling"></a>
<a id="responsive-breakpoints"></a>
<a id="column-hiding-per-table-mobile-480px"></a>
<a id="mobile-specific-behavior"></a>
<a id="css-file-locations"></a>
<a id="comparison-matrix"></a>
<a id="shared-vs-custom-components"></a>
<a id="cross-table-consistency-analysis"></a>

---

## Display Name Reference

All tables with their UI display names, source locations, and header columns.

| # | Display Name (UI) | Internal Name | HTML Source | Module File |
| --- | --- | --- | --- | --- |
| 1 | Intake Submissions | Leads | `admin/index.html:462` | `admin-leads.ts` |
| 2 | Client Accounts | Clients | `admin/index.html:683` | `admin-clients.ts` |
| 3 | Contact Form Submissions | Contacts | `admin/index.html:539` | `admin-contacts.ts` |
| 4 | Projects | Projects | `admin/index.html:608` | `admin-projects.ts` |
| 5 | All Invoices | Invoices | `admin/index.html:757` | `admin-invoices.ts` |
| 6 | Proposal Requests | Proposals | `admin-proposals.ts:388` | `admin-proposals.ts` |
| 7 | Time Entries | Time Tracking | `admin-time-tracking.ts:215` | `admin-time-tracking.ts` |
| 8 | Requests | Document Requests | `admin/index.html:1499` | `admin-document-requests.ts` |
| 9a | Categories | KB Categories | `admin/index.html:1614` | `admin-k-k-base.ts` |
| 9b | Articles | KB Articles | `admin/index.html:1646` | `admin-knowledge-base.ts` |
| 10 | Tasks | Tasks | Dynamic (Kanban) | `admin-tasks.ts` |
| 11 | (no heading) | Visitors | `admin/index.html:1365` | `admin-analytics.ts` |
| 12 | Files | Project Files | `admin-projects.ts:1143` | `admin-projects.ts` |
| 13 | Invoices | Project Invoices | `admin-projects.ts:1592` | `admin-projects.ts` |

### Column Order Reference (All Tables)

Each table's columns listed in exact left-to-right display order.

**Unified Column Order Pattern:** ☐ → Identity → Type → Status → Details → Date(s) → Actions

#### Leads Table

| # | Header | Data Source |
| --- | --- | --- |
| 1 | ☐ (checkbox) | Bulk select |
| 2 | Lead | `company_name` OR `contact_name` + `email` |
| 3 | Type | `project_type` (formatted) |
| 4 | Status | `status` (dropdown) |
| 5 | Budget | `budget_range` (formatted) |
| 6 | Date | `created_at` |
| 7 | Actions | Convert button (conditional) |

#### Contacts Table

| # | Header | Data Source |
| --- | --- | --- |
| 1 | ☐ (checkbox) | Bulk select |
| 2 | Contact | `name` + `company` |
| 3 | Email | `email` |
| 4 | Message | `message` (truncated) |
| 5 | Status | `status` (dropdown) |
| 6 | Date | `created_at` |
| 7 | Actions | Convert, Archive, Restore buttons |

#### Projects Table

| # | Header | Data Source |
| --- | --- | --- |
| 1 | ☐ (checkbox) | Bulk select |
| 2 | Project | `project_name` + `contact_name` + `company_name` |
| 3 | Type | `project_type` (formatted) |
| 4 | Status | `status` (dropdown) |
| 5 | Budget | `budget_range` (formatted) |
| 6 | Timeline | `timeline` (formatted) |
| 7 | Start | `start_date` |
| 8 | Target | `end_date` |
| 9 | Actions | View button |

#### Clients Table

| # | Header | Data Source |
| --- | --- | --- |
| 1 | ☐ (checkbox) | Bulk select |
| 2 | Client | `company_name` OR `name` + `email` |
| 3 | Type | `client_type` ("Personal" / "Business") |
| 4 | Status | `status` (badge) |
| 5 | # | Project count |
| 6 | Created | `created_at` |
| 7 | Last Active | `last_login_at` |
| 8 | Actions | Invite, View buttons |

#### Invoices Table

| # | Header | Data Source |
| --- | --- | --- |
| 1 | ☐ (checkbox) | Bulk select |
| 2 | Invoice # | `invoice_number` or "INV-{id}" |
| 3 | Client | `client_name` |
| 4 | Project | `project_name` or "-" |
| 5 | Amount | `amount` (formatted currency) |
| 6 | Status | `status` (badge, computed overdue) |
| 7 | Due Date | `due_date` or "-" |
| 8 | Actions | View + Edit buttons |

#### Proposals Table

| # | Header | Data Source |
| --- | --- | --- |
| 1 | ☐ (checkbox) | Bulk select |
| 2 | Client | `client_name` or `company_name` |
| 3 | Project | `project_name` |
| 4 | Tier | `tier` (good/better/best) |
| 5 | Price | `finalPrice` (formatted) |
| 6 | Status | `status` (dropdown) |
| 7 | Date | `created_at` |
| 8 | Actions | View + Edit + Delete |

#### Time Tracking Table

| # | Header | Data Source |
| --- | --- | --- |
| 1 | Date | `entry_date` |
| 2 | Description | `description` |
| 3 | Task | `task_title` or "-" |
| 4 | Duration | `duration_minutes` (formatted "Xh Ym") |
| 5 | Billable | `is_billable` (Yes/No badge) |
| 6 | Actions | Edit + Delete buttons |

#### Document Requests Table

| # | Header | Data Source |
| --- | --- | --- |
| 1 | ☐ (checkbox) | Bulk select |
| 2 | Title | `title` |
| 3 | Client | `client_name` |
| 4 | Type | `documenttype` |
| 5 | Status | `status` (badge) |
| 6 | Due | `due_date` |
| 7 | Actions | Contextual (View, Review, Approve, etc.) |

#### KB Categories Table

| # | Header | Data Source |
| --- | --- | --- |
| 1 | Name | `name` |
| 2 | Slug | `slug` |
| 3 | Articles | Article count |
| 4 | Active | `is_active` (Yes/No) |
| 5 | Actions | Edit + Delete |

#### KB Articles Table

| # | Header | Data Source |
| --- | --- | --- |
| 1 | Title | `title` |
| 2 | Category | `category_name` |
| 3 | Slug | `slug` |
| 4 | Featured | `is_featured` (Yes/No) |
| 5 | Published | `is_published` (Yes/No) |
| 6 | Updated | `updated_at` |
| 7 | Actions | Edit + Delete |

#### Visitors Table (Analytics)

| # | Header | Data Source |
| --- | --- | --- |
| 1 | Session ID | Session identifier |
| 2 | Started | Session start time |
| 3 | Duration | Session duration |
| 4 | Pages | Pages viewed count |
| 5 | Device | Device type |
| 6 | Location | Geographic location |

#### Project Files Table (Sub-table)

| # | Header | Data Source |
| --- | --- | --- |
| 1 | File | `original_filename` + icon |
| 2 | Size | `file_size` (formatted) |
| 3 | Uploaded | Upload timestamp |
| 4 | Actions | Preview (conditional) + Download |

#### Project Invoices Table (Sub-table)

| # | Header | Data Source |
| --- | --- | --- |
| 1 | Invoice # | `invoice_number` |
| 2 | Amount | `amount_total` (formatted) |
| 3 | Due Date | `due_date` |
| 4 | Status | `status` (badge) |
| 5 | Actions | Send (draft) + Edit (draft) + Mark Paid (sent/viewed/partial/overdue) + Preview + Download |

#### Tasks List View (Sub-table)

| # | Header | Data Source |
| --- | --- | --- |
| 1 | Task | `title` + `description` (truncated) |
| 2 | Priority | `priority` (badge) |
| 3 | Status | `status` (badge) |
| 4 | Due Date | `due_date` + overdue indicator |
| 5 | Assignee | `assignee_name` or "-" |

### Column Verification Summary

**Status:** All tables verified and aligned.

| Table | Header/Data Match | Notes |
| ----- | :-----------------:| ------- |
| Leads | MATCH | 8 columns |
| Clients | MATCH | 7 columns |
| Contacts | MATCH | 5 columns (no Actions - row click) |
| Projects | MATCH | 7 columns (no Actions - row click) |
| Invoices | MATCH | 8 columns |
| Proposals | MATCH | 8 columns |
| Time Tracking | MATCH | 6 columns |
| Document Requests | MATCH | 7 columns |
| KB Categories | MATCH | 5 columns |
| KB Articles | MATCH | 7 columns |
| Visitors | MATCH | 6 columns (no Actions - read-only) |
| Project Files | MATCH | 4 columns |
| Project Invoices | MATCH | 5 columns with contextual actions |
| Tasks List | MATCH | 5 columns |

### Column Count Quick Reference

| Table | Total Cols | Has Checkbox | Has Actions |
| --- | :---: | :---: | :---: |
| Leads | 8 | Yes | Yes |
| Clients | 7 | Yes | Yes |
| Contacts | 5 | No | No |
| Projects | 7 | Yes | No |
| Invoices | 8 | Yes | Yes |
| Proposals | 8 | Yes | Yes |
| Time Tracking | 6 | No | Yes |
| Document Requests | 7 | Yes | Yes |
| KB Categories | 5 | No | Yes |
| KB Articles | 7 | No | Yes |
| Visitors | 6 | No | No |
| Project Files | 4 | No | Yes |
| Project Invoices | 5 | No | Yes |
| Tasks List | 5 | No | No |

### Naming Conventions

| Pattern | Examples |
| --------- | ---------- |
| Date columns | "Date", "Created", "Updated", "Start", "Due Date" |
| Status columns | Always use dropdown or badge |
| Identity cells | Name + email + company in single cell |
| Action columns | Icon buttons (view, edit, delete) |

### Empty Cell Convention

**Standard:** All empty/null values display as **empty cells** (not dashes or placeholder text).

| Value State | Display |
| ----------- | ------- |
| `null`, `undefined`, `''` | Empty cell (no content) |
| Valid value | Formatted value |

---

## Architecture Overview

### Shared Table Infrastructure

```text
src/
├── utils/
│   ├── table-filter.ts            ← Filter/search/sort (shared)
│   ├── table-pagination.ts        ← Pagination controls (shared)
│   ├── table-bulk-actions.ts      ← Checkbox selection + bulk toolbar (shared)
│   ├── table-export.ts            ← CSV/JSON export (shared)
│   ├── loading-utils.ts           ← showTableLoading / showTableEmpty (shared)
│   ├── copy-email.ts              ← Email copy button (shared)
│   ├── confirm-dialog.ts          ← Confirmation dialogs (shared)
│   └── dom-cache.ts               ← DOM caching for perf (shared)
├── components/
│   ├── table-dropdown.ts          ← Status dropdown in cells (shared)
│   ├── status-badge.ts            ← Status badge rendering (shared)
│   └── portal-checkbox.ts         ← Custom checkbox component (shared)
```

### DOM Structure (Every Table)

```text
.admin-table-card
 ├── .admin-table-header            ← Title, toolbar buttons, filter controls
 ├── .bulk-action-toolbar           ← Appears when rows checked (conditional)
 ├── .admin-table-container
 │   └── .admin-table-table-wrapper    ← Horizontal scroll on mobile
 │       └── table.admin-table          ← <table> element
 │           ├── <thead>                ← Sortable headers
 │           └── <tbody>               ← Data rows
 └── .table-pagination              ← Page controls (if enabled)
```

### Table CSS Classes

- `.admin-table-card` - Wrapper card containing table and pagination
- `.admin-table-container` - Container with overflow handling
- `.admin-table-scroll-wrapper` - Horizontal scroll wrapper
- `.admin-table` - Base table element
- `.bulk-select-cell` - Checkbox column for bulk actions
- `.identity-cell` - Consolidated name/email/company column
- `.meta-value-with-copy` - Cells with copy email button
- `.sortable` - Sortable headers

### Table-Specific CSS Classes

- `.leads-table` - Leads table
- `.clients-table` - Clients table
- `.projects-table` - Projects table
- `.contacts-table` - Contacts table
- `.proposals-table` - Proposals table
- `.files-table` - Files table (in project details)
- `.invoices-table` - Invoices table (in project details)
- `.time-entries-table` - Time entries table
- `.visitors-table-container` - Visitors analytics table
- `.message-table` - Messages table
- `.comparison-table` - Proposal tier comparison

---

## Component Deep-Dive

Every interactive element in the tables is built from shared, reusable components. This section documents each one completely: what it does, its interface, its DOM structure, its behavior, its CSS classes, and exactly which tables use it.

---

### 1. Portal Checkbox

**File:** `src/components/portal-checkbox.ts`

**Scope:** Shared across all admin and client portal tables

**Function:** `getPortalCheckboxHTML)` - Returns an HTML string

#### Interface

```text
PortalCheckboxConfig {
  id?: string              // Input id (e.g. "clients-select-all")
  name?: string            // Input name for form submission
  checked?: boolean        // Whether checked (default: false)
  ariaLabel: string        // REQUIRED - accessible label
  inputClassName?: string  // CSS class on input (e.g. "bulk-select-all")
  wrapperClassName?: string // CSS class on wrapper div
  value?: string           // Input value (for filter options)
  dataAttributes?: Record  // data-* attributes ( e.g. { rowId: "123" })
}
```

#### DOM Output

```html
<div class="portal-checkbox {wrapperClassName}">
  <input type="checkbox"
         id="{id}"
         name="{name}"
         value="{value}"
         class="{inputClassName}"
         aria-label="{ariaLabel}"
         data-row-id="{rowId}"
         {checked} />
</div>
```

#### Styling

- Size: 16px system checkbox
- Styles defined in: `src/styles/shared/portal-forms.css`
- Unchecked background: darkest grey (`var(--portal-bg-darker)`)

#### Used In

| Table | Usage | inputClassName |
|-------|-------|---------------|
| Leads | Header select-all + per-row | `bulk-select-all` / `leads-row-select` |
| Clients | Header select-all + per-row | `bulk-select-all` / `clients-row-select` |
| Projects | Header select-all + per-row | `bulk-select-all` / `projects-row-select` |
| Invoices | Header select-all + per-row | `bulk-select-all` / `invoices-row-select` |
| Proposals | Header select-all + per-row | `bulk-select-all` / ` proposals-row-select` |
| Document Requests | Header select-all + per-row | `bulk-select-all` / `document-requests-row-select` |
| Filter Dropdown | Status filter checkboxes | (none) |
| Contacts | Not used (no checkboxes) | - |
| Time Tracking | Not used (no checkboxes) | - |
| Knowledge Base | Not used (no checkboxes) | - |
| Tasks | Not used (no checkboxes) | - |

---

### 2. Table Dropdown

**File:** `src/components/table-dropdown.ts`

**Scope:** Shared across all tables needing inline status changes or compact dropdowns

**Function:** `createTableDropdown(config)` - Returns an HTMLElement (not a string)

#### Table DropdownInterface

```text
TableDropdownConfig {
  options: TableDropdownOption[]    // { value, label } pairs
  currentValue: string             // Currently selected value
  onChange: (value: string) => void // Callback on selection
  showStatusDot?: boolean          // Color dot next to label (default: true)
  ariaLabelPrefix?: string         // e.g. "Per page" -> "Per page, current: 25"
  showAllWithCheckmark?: boolean   // Show all options with checkmark on selected
}
```

#### DOM Structure

```text
div.table-dropdown.custom-dropdown [data-status="{value}"]
 ├── button.custom-dropdown-trigger
 │    ├── span.status-dot              (if showStatusDot=true)
 │    ├── span.custom-dropdown-text    "{current label}"
 │    └── svg (caret down icon)
 └── ul.custom-dropdown-menu
      └── li.custom-dropdown-item [data-value] [data-status]
           ├── span.status-dot         (if showStatusDot=true, status mode)
           │   OR
           ├── span.filter-dropdown-check  (if showAllWithCheckmark, checkmark mode)
           └── span.dropdown-item-name / span.custom-dropdown-text
```

#### Two Modes

| Mode | showStatusDot | showAllWithCheckmark | Hides Current | Visual |
|------|:------------:|:--------------------:|:-------------:|--------|
| **Status** (default) | true | false | Yes (only shows other options) | Color dot + label |
| **Filter/Pagination** | false | true | No (shows all with checkmark) | Checkmark + label |

#### Behavior

1. **Click trigger** -> toggles `.open` class
2. **Closes all other** `.table-dropdown.open` when one opens
3. **Viewport flip** -> if menu would be cut off below, adds `.dropdown-open-up` to show above
4. **Click option** -> updates trigger text, rebuilds menu, calls `onChange(value)`
5. **Outside click** -> closes dropdown
6. **Escape key** -> closes (handled by parent, not built in)
7. **Status normalization** -> underscores converted to hyphens (legacy DB format)

#### Pre-Configured Status Option Sets

**LEAD_STATUS_OPTIONS:**

| Value | label |
|-------|-------|
| new | New |
| contacted | Contacted |
| qualified | Qualified |
| in-progress | In Progress |
| converted | Converted |
| lost | Lost |
| on-hold | On Hold |
| cancelled | Cancelled |

**CONTACT_STATUS_OPTIONS:**

| Value | Label |
|-------|-------|
| new | New |
| read | Read |
| responded | Responded |
| archived | Archived |

**PROJECT_STATUS_OPTIONS:**

| Value | Label |
|-------|-------|
| pending | Pending |
| active | Active |
| in-progress | In Progress |
| on-hold | On Hold |
| completed | Completed |
| cancelled | Cancelled |

#### Helper Function

`getStatusLabel(status)` - Maps status value to display label (includes legacy mappings like `pending` -> `'New'`, `active` -> `'In Progress'`)

#### Dynamic Update

`setOptions(newOptions, selectedValue?)` - Available on filter/checkmark dropdown instances. Rebuilds menu with new options in place.

#### Used In

| Table | Mode | Options Used |
|-------|------|-------------|
| Leads | Status (colored dot) | `LEAD_STATUS_OPTIONS` |
| Contacts | Status (colored dot) | `CONTACT_STATUS_OPTIONS` |
| Projects | Status (colored dot) | `PROJECT_STATUS_OPTIONS` |
| Proposals | Status (colored dot) | Custom proposal statuses |
| Pagination (all tables) | Filter (no dot, checkmark) | `[10, 25, 50, 100]` as strings |
| Clients | Not used in cells | - |
| Invoices | Not used (badge only) | - |

---

### 3. Status Badge

**File:** `src/components/status-badge.ts`

**Scope:** Shared across all admin and client portal tables

**Functions:**

- `createStatusBadge(label, variant)` - Returns HTMLElement (span)
- `getStatusBadgeHTML(label, variant)` - Returns HTML string

#### DOM Output

```html
<span class="status-badge status-{variant}">{label}</span>
```

#### Variants

| Variant | CSS Class | Typical Usage |
|---------|-----------|---------------|
| `active` | `.status-active` | Active clients/items |
| `pending` | `.status-pending` | Default, awaiting action |
| `in-progress` | `.status-in-progress` | Work underway |
| `onon` | `.status-on-hold` | Paused (normalized) |
| `completed` | `.status-completed` | Done |
| `healthy` | `.status-healthy` | Client health score |
| `at-risk` | `.status-at-risk` | Client health score |
| `critical` | `.status-critical` | Client health score |
| `signed` | `.status-signed` | Contract status |
| `not-signed` | `.status-not-signed` | Contract status |
| any string | `.status-{value}` | Auto-generated class |

#### Styling

- Defined in: `src/styles/shared/portal-badges.css`
- Pill-shaped (`border-radius` rounded)
- Each variant has its own background/text color via CSS variables

#### Used In

| Table | What For |
|-------|---------|
| Clients | Status column (active/pending/inactive) + health score |
| Invoices | Status column (paid/pending/overdue) |
| Tasks | Priority badges (low/medium/high/urgent) |
| System Status | Application status indicators |
| Time Tracking | Billable Yes/No badge |

---

### 4. Filter System (Search + Status + Date)

**File:** `srcsrc/table-filter.ts`

**Scope:** Shared across 6 tables with pre-configured configs

**Function:** `createFilterUI(config, state, onStateChange)` - Returns HTMLElement

#### Interface

```text
TableFilterConfig {
  tableId: string
  searchFields: string[]           // Fields to search (e.g. ['name', 'email'])
  statusField: string              // Field name for status filter
  statusOptions: StatusOption[]    // { value, label } pairs
  dateField: string                // Field for date range filter
  sortableColumns: SortableColumn[] // { key, label, type } for sortable headers
  storageKey: string               // localStorage key for persistence
}

FilterState {
  searchTerm: string
  statusFilters: string[]          // Empty = show all
  dateStart: string
  dateEnd: string
  sortColumn: string
  sortDirection: 'asc' | 'desc'
}
```

#### DOM Structure

```text
div.table-filter-controls
 ├── div.filter-search-wrapper
 │    ├── button.icon-btn.filter-search-trigger [.has-value]
 │    │    └── svg (search icon)
 │    └── div.filter-search-dropdown.search search
 │         ├── span.filter-search-icon.search-bar-icon
 │         │    └── svg (small search icon)
 │         ├── input.filter-search-input.search-bar-input [type=text]
 │         └── button.filter-search-clear.search-bar-clear
 │              └── svg (X icon)
 │
 └── div.filter-dropdown-wrapper
      ├── button.filter-dropdown-trigger.icon-btn
      │    ├── svg (filter/funnel icon)
      │    └── span.filter-count-badge [.visible]  "{count}"
      └── div.filter-dropdown-menu
           ├── div.filter-section                  (Status section)
           │    ├── span.filter-section-label       "Status"
           │    └── div.filter-checkbox-group
           │         ├── label.filter-checkbox.filter-all-option
           │         │    ├── [PortalCheckbox value="all"]
           │         │    └── span "All"
           │         ├── label.filter-checkbox
           │         │    ├── [PortalCheckbox value="{status}"]
           │         │    └── span "{Status Label}"
           │         └── ...
           ├── div.filter-section                  (Date section)
           │    ├── span.filter-section-label       "Date Range"
           │    └── div.filter-date-group
           │         ├── input.filter-date-input [type=date, data-filter="start"]
           │         ├── span.filter-date-separator "to"
           │         └── input.filter-date-input [type=date, data-filter="end"]
           └── button.filter-clear-btn             "Clear All"
```

#### Search Behavior

1. Icon button (magnifying glass) toggles search dropdown open/closed
2. Input is **non-focusable when closed** (`tabIndex = -1`)
3. Typing debounces at **200ms** before applying
4. **Enter key** closes the search dropdown
5. **Clear button** (X) clears input, removes `has-value` class
6. Icon shows `has-value` indicator when search term is active
7. Clicking outside closes dropdown

#### Status Filter Behavior

1. Icon button (funnel) toggles filter dropdown
2. Count badge shows number of active filters (status count + date range)
3. "All" checkbox -> unchecks all status checkboxes, shows all data
4. Checking any status -> unchecks "All"
5. Unchecking all statuses -> auto-checks "All"
6. Checkbox state uses the `PortalCheckbox` component

#### Date Range Behavior

1. Two date inputs: start and end
2. Inclusive range (start at 00:00:00, end at 23:59:59)
3. Either can be set independently
4. "Clear All" button resets search, status, and date filters

#### Filter Application Order

```text
1. Search text filter    (case-insensitive substring match across searchFields)
2. Status filter         (multi-select, normalized to hyphens)
3. Date range filter     (inclusive, on dateField)
4. Sort                  (by selected column + direction)
5. Secondary sort        (archived items always pushed to bottom)
```

#### Sorting

- `createSortableHeaders(config, state, onSort)` - Makes `<th>` elements clickable
- Matches header text to `sortableColumns` by label (case-insensitive)
- Adds `.sortable` class and `.sort-icon` span to each matched `<th>`
- Click toggles direction: `desc` -> `asc` -> `desc`
- Sort types: `string` (localeCompare), `number` (parseFloat), `date` (timestamp)
- Status sorting uses `statusOptions` order for priority ranking
- **State Storage:** Sort state stored in DOM data attributes (`thead.dataset.sortColumn`, `thead.dataset.sortDirection`) to avoid stale closure issues - click handlers read fresh values on each click

#### State Persistence

- All filter state saved to `localStorage` under `config.storageKey`
- Loaded on module init via `loadFilterState(storageKey)`
- Saved on every state change via `saveFilterState(storageKey, state)`

#### Dynamic Status Options

`updateFilterStatusOptions(filterContainer, options, label, state, config, onStateChange)` - Replaces status section in existing filter UI with new options. Used by Knowledge Base (categories loaded from API).

#### Pre-Configured Filter Configs

| Config | Table | searchFields | status status | dateField | Sortable Columns | storageKey |
| -------- | ------- | ------------- | --------------- | ----------- | ----------------- | ------------ |
| `LEADS_FILTER_CONFIG` | Leads | contact_name, email, company_name, project_type | 8 statuses (new -> cancelled) | created_at | 6 columns | `admin_leads_filter` |
| `CONTACTS_FILTER_CONFIG` | Contacts | name, email, company, message | 4 (new, read, responded, archived) | created_at | 5 columns | `admin_contacts_filter` |
| `PROJECTS_FILTER_CONFIG` | Projects | project_name,contact_name, project_type | 5 (active -> cancelled) | created_at | 8 columns | `admin_projects_filter` |
| `CLIENTS_FILTER_CONFIG` | Clients | name, email, company_name | 2 (active, inactive) | created_at | 5 columns | `admin_clients_filter` |
| `DOCUMENT_REQUESTS_FILTER_CONFIG` | Doc Requests | title, client_name, document_type, description | 6 (requested -> rejected) | created_at | 5 columns | `admin_document_requests_filter` |
| `KNOWLEDGE_BASE_FILTER_CONFIG` | KB | title, category_name, slug, summary | Dynamic (loaded from API) | updated_at | 3 columns | `admin_kb_filter` |

#### Used In

| Table | Uses createFilterUI | Uses createSortableHeaders | Uses applyFilters |
| -------- | :-------------------: | :--------------------------: | :-----------------: |
| Leads | Yes | Yes | Yes |
| Clients | Yes | Yes | Yes |
| Contacts | Yes | Yes | Yes |
| Projects | Yes | Yes | Yes |
| Document Requests | Yes | Yes | Yes |
| Knowledge Base | Yes (dynamic options) | Yes | Yes |
| Invoices | No | No | No |
| Proposals | No (uses custom search bar) | No | No |
| Time Tracking | No | No | No |
| Tasks | No | No | No |

---

### 5. Pagination System

**File:** `src/utils/table-pagination.ts`

**Scope:** Shared across 4 tables

**Function:** `createPaginationUI(config, state, onStateChange)` - Returns HTMLElement

#### Interface

```text
PaginationConfig {
  tableId: string
  pageSizeOptions?: number[]      // Default: [10, 25, 50, 100]
  defaultPageSize?: number        // Default: 25
  storageKey?: string             // For localStorage persistence
}

PaginationState {
  currentPage: number             // 1-based
  pageSize: number                // Items per page
  totalItems: number              // Total data count
}
```

#### DOM Structure

```text
div.pagination-inner
 ├── div.pagination-info
 │    └── span.pagination-range
 │         "Showing {start}-{end} of {total}"
 └── div.pagination-controls
      ├── div.pagination-size
      │    ├── label "Per page:"
      │    └── div div-page-size-dropdown
      │         └── [TableDropdown - filter mode, no status dot]
      └── div.pagination-nav
           ├── button.pagination-btn.pagination-first  (chevrons left)
           ├── button.pagination-btn.pagination-prev   (chevron left)
           ├── div.pagination-pages
           │    ├── button.pagination-page-btn [.active] [data-page]
           │    ├── span.pagination-ellipsis "..."
           │    └── ...
           ├── button.pagination-btn.pagination-next   (chevron right)
           └── button.pagination-btn.pagination-last   (chevrons right)
```

#### Behavior

1. **Per-page dropdown** uses `createTableDropdown` (filter mode, no status dot, checkmark on selected)
2. **Page buttons** show `getVisiblePages()` with ellipsis for large page counts
3. **Nav buttons** disabled at boundaries (first/prev at page 1, next/last at last page)
4. **Page size change** recalculates total pages, adjusts current page if needed
5. **State update** calls `onStateChange(newState)` which triggers table re-render

#### Data Slicing Functions

- `getTotalPages(state)` - `Math.ceil(total(total / pageSize)`
- `getPageSlice(state)` - `{ start, end }` indices
- `applyPagination(data, state)` - Returns `data.slice(start, end)`
- `getVisiblePages(currentPage, totalPages)` - Page numbers with `-1` for ellipsis (shows 2 pages on each side of current)

#### State Persistence

- Only `pageSize` is saved to localStorage (not `currentPage`)
- Loaded on init: `loadPaginationState(storageKey)`
- Saved on change: `savePaginationState(storageKey, state)`

#### Live Update

`updatePaginationUI(containerId, state)` - Updates existing instance DOM in-place (range text, button disabled states, page buttons) without recreating.

#### Used In

| Table | Config |
| ------- | -------- |
| Leads | `tableId: 'leads'`, default 25, storage `admin_leads_pagination` |
| Clients | `tableId: 'clients'`, default 25, storage `admin_clients_pagination` |
| Contacts | `tableId: 'contacts'`, default 25, storage `admin_contacts_pagination` |
| Projects | `tableId: 'projects'`, default 25, storage `admin_projects_pagination` |
| In Ground | Not used |
| Proposals | Not used |
| Time Tracking | Not used |
| Document Requests | Not used |
| Knowledge Base | Not used |
| Tasks | Not used |

---

### 6. Bulk Actions System

**File:** `src/utils/table-bulk-actions.ts`

**Scope:** Shared across tables with checkboxes

**Functions:**

- `createBulkActionToolbar(config)` - Returns toolbar HTMLElement
- `createHeaderCheckbox(tableId)` - Returns `<th>` HTML string
- `createRowCheckbox(tableId, rowId)` - Returns `<td>` HTML string
- `setupBulkSelectionHandlers(config, allRowIds)` - Attaches event listeners
- `resetSelection(tableId)` - Clears all selections and hides toolbar
- `getSelectedIds(tableId)` - Returns `number[]` of selected IDs
- `getSelectionState(tableId)` - Returns `{ selectedIds: Set, allSelected: boolean }`

#### Interface

```text
BulkAction {
  id: string
  label: string
  icon?: string                    // SVG icon HTML
  variant?: 'default' | 'danger' | 'warning'
  handler: (selectedIds: number[]) => Promise<void> | void
  confirmMessage?: string         // If set, shows confirm dialog first
}

BulkActionConfig {
  tableId: string
  actions: BulkAction[]
  onSelectionChange?: (selectedIds: number[]) => void
}
```

#### Toolbar DOM Structure

```text
div.bulk-action-toolbar.hidden [id="{tableId}-bulk-toolbar"]
 ├── div.bulk-toolbar-left
 │    ├── span.bulk-selection-count
 │    │    ├── strong [id="{tableId}-selected-count"] "0"
 │    │    └── " selected"
 │    └── button.btn-link.bulk-clear-selection "Clear"
 └── div div-toolbar-actions
      ├── button.btn.btn-sm.{btn-variant} [data-action="{id}"]
      │    ├── {icon svg}
      │    └── span "{label}"
      └── ...
```

#### Header Checkbox DOM

```html
<th class="bulk-select-cell" style="width: 40px;">
  <div class="portal-checkbox">
    <input type="checkbox" id="{tableId}-select-all"
           class="bulk-select-all" aria-label="Select all rows" />
  </div>
</th>
```

#### Row Checkbox DOM

```html
<td class="bulk-select-cell">
  <div class="portal-checkbox">
    <input type="checkbox" class="{tableId}-row-select"
           aria-label="Select row" data-row-id="{rowId}" />
  </div>
</td>
```

#### Selection Behavior

1. **Header checkbox checked** -> selects all visible row IDs, checks all row checkboxes
2. **Header checkbox unchecked** -> deselects all, unchecks all
3. **Row checkbox checked** -> adds ID to `selectedIds` Set
4. **Row checkbox unchecked** -> removes ID, unchecks header if was "all"
5. **Indeterminate state** -> header shows indeterminate when some (not all/none) selected
6. **Toolbar visibility** -> appears when `selectedIds.size > 0`, hides when `0`
7. **Selection count** -> updates `{tableId}-selected-count` element text
8. **Clear button** -> calls `resetSelection(tableId)`, hides toolbar

#### Action Execution Flow

```text
1. User clicks action button
2. If confirmMessage exists -> show confirmDanger dialog
3. If confirmed (or no confirm needed) -> call handler(selectedIds)
4. On success -> reset selection(tableId)
5. On error -> console.error, selection preserved
```

#### Pre-Built Action Factories

| Factory | id | variant | confirmMessage | HTTP Method |
| -------- | ----- | --------- | --------------- | ------------- |
| `createArchiveAction(url, onSuccess)` | `'archive'` | `warning` | "Archive {count} selected items? They can be restored later." | POST |
| `createDeleteAction(url, onSuccess)` | `'delete'` | `danger` | "Permanently delete {count} selected items? This cannot be undone." | DELETE |
| `createStatusUpdateUpdate(label, status, url, onSuccess)` | `'status-{status}'` | `default` | none | POST |

#### State Management

- In-memory Map: `selectionStates: Map<string, BulkSelectionState>`
- Per table keyed by `tableId`
- Not persisted to localStorage (resets on page reload)

#### Used In

| Table | Actions | Custom or Pre-built |
| ------- | --------- | ------------------- |
| Leads | Update Status, Assign, Move Stage | Custom handlers with `multiPromptDialog` |
| Clients | Archive, Delete | Pre-built `createArchiveAction` + `createDeleteAction` |
| Projects | (Framework configured, no active actions) | - |
| Invoices | (Checkbox exists, no toolbar actions) | - |
| Proposals | Update Status | Custom handler |
| Document Requests | Send Reminders, Delete | Custom handlers |
| Contacts | Not used | - |
| Time Tracking | Not used | - |
| Knowledge Base | Not used | - |
| Tasks | Not used | - |

---

### 7. Export System

**File:** `src/utils/table-export.ts`

**Scope:** Shared across 8 tables

**Functions:**

- `exportToCsv(data, config)` - Generates CSV and triggers browser download
- `exportToJson(data, filename)` - Generates JSON and triggers browser download

#### Interface

```text
ExportColumn {
  key: string                     // Field path (supports dot notation: 'client.name')
  label: string                   // Column header in CSV
  formatter?: (value, row) => string  // Custom value formatter
}

ExportConfig {
  filename: string                // Base filename (date appended: '{name}_{YYYY-MM-DD}.csv')
  columns: ExportColumn[]
}
```

#### Built-in Formatters

- `formatDate(value)` - ISO date string `YYYY-MM-DD`
- `formatCurrency(value)` - Two decimal places `"123.45"`

#### CSV Handling

- Escapes commas, quotes, newlines in values
- Downloads via Blob URL + temporary `<a>` element
- Exports currently filtered data (respects active filters)

#### Pre-Configured Export Configs

| Config | Table | Columns |
| -------- | ------- | --------- |
| `CLIENTS_EXPORT_CONFIG` | Clients | ID, Contact Name, Email, Company, Type, Phone, Status, Projects, Health Score, Created Date, Billing Email, Billing Address, City, State, ZIP, Country |
| `LEADS_EXPORT_CONFIG` | Leads | ID, Contact Name, Email, Company, Project Type, Budget Range, Timeline, Status, Source, Phone, Description, Features, Lead Score, Created Date |
| `PROJECTS_EXPORT_CONFIG` | Projects | ID, Project Name, Client Name, Company, Project Type, Status, Budget, Timeline, Start Date, End Date, Created Date |
| `CONTACTS_EXPORT_CONFIG` | Contacts | ID, Name, Email, Company, Phone, Status, Message, Created Date |
| `INVOICES_EXPORT_CONFIG` | Invoices | ID, Invoice Number, Client, Project, Status, Total Amount, Due Date, Paid Date, Created Date |
| `PROPOSALS_EXPORT_CONFIG` | Proposals | ID, Client Name, Company, Client Email, Project Name, Project Type, Tier, Final Price, Status, Maintenance Option, Created Date |
| `DOCUMENT_REQUESTS_EXPORT_CONFIG` | Doc Requests | ID, Title, Client, Type, Status, Due Date, Created Date |
| `KNOWLEDGE_BASE_EXPORT_CONFIG` | KB | ID, Title, Category, Slug, Featured, Published, Updated Date |

#### Used In

| Table | Export Config | Triggered By |
| ----- | ------------- | ------------ |
| Leads | `LEADS_EXPORT_CONFIG` | Export button in toolbar |
| Clients | `CLIENTS_EXPORT_CONFIG` | Export button in toolbar |
| Contacts | `CONTACTS_EXPORT_CONFIG` | Export button in toolbar |
| Projects | `PROJECTS_EXPORT_CONFIG` | Export button in toolbar |
| Invoices | `INVOICES_EXPORT_CONFIG` | Export button in toolbar |
| Proposals | `PROPOSALS_EXPORT_CONFIG` | Export button in toolbar |
| Document Requests | `DOCUMENT_REQUESTS_EXPORT_CONFIG` | Export button in toolbar |
| Knowledge Base | `KNOWLEDGE_BASE_EXPORT_CONFIG` | Export button in toolbar |

---

## Styling and Responsiveness

### CSS Variables Used for Tables

```css
/* Table Layout */
--space-0-5: 0.125rem;
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;

/* Text Colors */
--portal-text-light: #ffffff;
--portal-text-secondary: #9ca3af;
--portal-text-muted: #6b7280;

/* Backgrounds */
--portal-bg-medium: #2a2a2a;
--portal-bg-darker: #1a1a1a;

/* Font Sizes */
--font-size-sm: 0.875rem;
```

### Table Cell Styling

| Cell Class | Purpose | Desktop Width | Font Size |
| ---------- | ------- | ------------- | --------- |
| `.identity-cell` | Primary name/email/company | Auto | 1rem |
| `.type-cell` | Category type | Fit-content | 0.875rem |
| `.budget-cell` | Financial info | Fit-content | 0.875rem |
| `.timeline-cell` | Timeline info | Fit-content | 0.875rem |
| `.count-cell` | Numeric count | Fit-content | 0.875rem |
| `.status-cell` | Status dropdown | Fit-content | 0.875rem |
| `.date-cell` | Date values | Fit-content | 0.875rem |
| `.email-cell` | Email addresses | Fit-content | 0.875rem |
| `.message-cell` | Message content | Auto | 0.875rem |
| `.actions-cell` | Action buttons | 140px | - |

### Responsive Breakpoints

| Breakpoint | Behavior |
| ---------- | -------- |
| 1760px | Target stacks under Start (Projects); Last Active stacks under Created (Clients) |
| 1550px | Email stacks under Contact (Contacts) |
| 1280px | Budget stacks under Type (Leads, Projects) |
| 1100px | Date stacks above Status (Leads only) |
| 480px (small-mobile) | Full mobile card layout - table rows become stacked cards |

### Column Stacking at Breakpoints

Desktop columns can stack to reduce horizontal scroll before mobile card layout kicks in.

#### 1760px Breakpoint

| Table | Stacking | Implementation |
| ----- | -------- | -------------- |
| Projects | Target stacks under Start | `.start-cell .target-stacked` shown, `th.target-col` + `.target-cell` hidden |
| Clients | Last Active stacks under Created | `.created-cell .last-active-stacked` shown, `th.last-active-col` + `.last-active-cell` hidden |

#### 1550px Breakpoint

| Table | Stacking | Implementation |
| ----- | -------- | -------------- |
| Contacts | Email stacks under Contact | `.contact-cell .email-stacked` shown, `th.email-col` + `.email-cell` hidden |

#### 1280px Breakpoint

| Table | Stacking | Implementation |
| ----- | -------- | -------------- |
| Leads | Budget stacks under Type | `.type-cell .budget-stacked` shown, `th.budget-col` + `.budget-cell` hidden |
| Projects | Budget stacks under Type | `.type-cell .budget-stacked` shown, `th.budget-col` + `.budget-cell` hidden |

#### 1100px Breakpoint

| Table | Stacking | Implementation |
| ----- | -------- | -------------- |
| Leads | Date stacks above Status | `.status-cell .date-stacked` shown, `th.date-col` + `.date-cell` hidden |

**Important:** Stacked elements (`.budget-stacked`, `.email-stacked`, `.date-stacked`) are hidden on mobile card view to prevent duplicate data display.

### Mobile Card Layout (480px and below)

On mobile, table rows transform into stacked card blocks using CSS flexbox with `order` property for consistent cell ordering.

#### Cell Order Values

All tables use consistent CSS `order` values for mobile card display:

| Order | Cell Type | Color | Size | Purpose |
| :---: | --------- | ----- | ---- | ------- |
| -2 | `.identity-cell`, `.contact-cell`, `.name-cell` | `--portal-text-light` | 1rem/600 | Primary identifier |
| -1 | `.project-cell` | `--portal-text-light` | 0.9rem/500 | Project name |
| 1 | `.type-cell` | `--portal-text-secondary` | 0.8rem | Category |
| 2 | `.budget-cell`, `.count-cell` | `--portal-text-secondary` | 0.85rem/500 | Financial/count info |
| 3 | `.timeline-cell`, `.email-cell` | `--portal-text-muted` | 0.8rem | Timeline/email |
| 4 | `.message-cell` | `--portal-text-secondary` | 0.85rem | Message content |
| 5 | `.status-cell` | - | - | Status dropdown |
| 6 | `.date-cell` | `--portal-text-muted` | 0.8rem | Date values |
| 10 | `.actions-cell` | - | - | Action buttons |

#### Mobile Card Structure

```text
┌─────────────────────────────────────┐
│ IDENTITY (name, company, email)     │ ← order: -2
│ Type                                │ ← order: 1
│ Budget / Count                      │ ← order: 2
│ Timeline / Email                    │ ← order: 3
│ Message                             │ ← order: 4
│ [Status Dropdown]                   │ ← order: 5
│ Date                                │ ← order: 6
│ [Action Buttons]                    │ ← order: 10
└─────────────────────────────────────┘
```

#### Mobile-Specific Behavior

1. **Header hidden**: `<thead>` is `display: none` on mobile
2. **Rows become cards**: Each `<tr>` is `display: block` with card styling
3. **Cells become blocks**: Each `<td>` is `display: block` with consistent ordering
4. **Checkbox hidden**: `.bulk-select-cell` is hidden on mobile
5. **Full-width dropdowns**: Status dropdowns expand to 100% width
6. **Stacked elements hidden**: `.budget-stacked`, `.email-stacked`, `.date-stacked` are hidden via `display: none !important` since all cells are visible as blocks

#### Color Consistency Rules

| Priority | Color Variable | Used For |
| -------- | -------------- | -------- |
| Primary | `--portal-text-light` | Identity name, primary content |
| Secondary | `--portal-text-secondary` | Type, budget, message content |
| Muted | `--portal-text-muted` | Dates, timeline, email, count |

### CSS File Locations

| File | Purpose |
| ---- | ------- |
| `src/styles/pages/admin.css` | Admin table styles, mobile card layout, responsive breakpoints |
| `src/styles/shared/portal-forms.css` | Checkbox, input styling |
| `src/styles/shared/portal-badges.css` | Status badge colors |
| `src/styles/variables.css` | CSS custom properties |

---

## Comparison Matrix

| Feature | Leads | Clients | Contacts | Projects | Invoices | Proposals |
| ------- | :---: | :-----: | :------: | :------: | :------: | :-------: |
| Checkbox | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| Search | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Status Filter | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Date Filter | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Sortable | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Pagination | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Bulk Actions | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Export CSV | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Status Dropdown | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ |
| Mobile Cards | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Shared vs Custom Components

### Fully Shared (Used by 3+ tables)

- Portal Checkbox
- Table Dropdown
- Status Badge
- Filter System
- Pagination
- Export

### Partially Shared

- Bulk Actions (4 tables)
- Copy Email (3 tables)

### Table-Specific

- View Toggle (Leads only - table/pipeline)
- Kanban Board (Tasks/Leads)

---

## Cross-Table Consistency Analysis

**Status:** All issues resolved as of 2026-02-08.

### Resolved Issues

1. **Column stacking inconsistency** - Fixed with explicit CSS order values for all cell types
2. **Mobile duplicate data** - Fixed by hiding stacked elements on mobile card view
3. **Color inconsistency** - Standardized to three-tier color system (light/secondary/muted)
4. **Missing cell styling** - Added `timeline-cell` and `count-cell` mobile styles
5. **Sort state closure** - Fixed by storing sort state in DOM data attributes
