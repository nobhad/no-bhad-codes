# Complete Table Audit - Portal

**Last Updated:** 2026-02-05

## Table of Contents

- [Display Name Reference](#display-name-reference)
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
- [Cross-Table Consistency Analysis](#cross-table-consistency-analysis)
  - [Shared Infrastructure Adoption Gap](#tier-1-shared-infrastructure-adoption-gap)
  - [Toolbar Button Order Inconsistency](#tier-2-toolbar-button-order-inconsistency)
  - [Dead/Orphaned UI Elements](#tier-3-deadorphaned-ui-elements)
  - [Feature Parity Gaps](#tier-4-feature-parity-gaps)
  - [HTML Structure Inconsistencies](#tier-5-html-structure-inconsistencies)
  - [Empty State Message Inconsistencies](#tier-6-empty-state-message-inconsistencies)
  - [Loading State Inconsistencies](#tier-7-loading-state-inconsistencies)
  - [DOM Caching Inconsistencies](#tier-8-dom-caching-inconsistencies)
  - [Export Config Inconsistencies](#tier-9-export-config-inconsistencies)
  - [Filter Config Inconsistencies](#tier-10-filter-config-inconsistencies)
  - [Detail View Pattern Inconsistencies](#tier-11-detail-view-pattern-inconsistencies)
  - [Stat Cards Inconsistency](#tier-12-stat-cards-inconsistency)
  - [localStorage Key Naming](#tier-13-localstorage-key-naming)
  - [Priority Order](#summary-priority-order)

---

## Display Name Reference

All tables with their UI display names, source locations, and header columns.

| # | Display Name (UI) | Internal Name | HTML Source | Module File |
|---|-------------------|---------------|-------------|-------------|
| 1 | Intake Submissions | Leads | `admin/index.html:462` | `admin-leads.ts` |
| 2 | Client Accounts | Clients | `admin/index.html:683` | `admin-clients.ts` |
| 3 | Contact Form Submissions | Contacts | `admin/index.html:539` | `admin-contacts.ts` |
| 4 | Projects | Projects | `admin/index.html:608` | `admin-projects.ts` |
| 5 | All Invoices | Invoices | `admin/index.html:757` | `admin-invoices.ts` |
| 6 | Proposal Requests | Proposals | `admin-proposals.ts:388` | `admin-proposals.ts` |
| 7 | Time Entries | Time Tracking | `admin-time-tracking.ts:215` | `admin-time-tracking.ts` |
| 8 | Requests | Document Requests | `admin/index.html:1499` | `admin-document-requests.ts` |
| 9a | Categories | KB Categories | `admin/index.html:1614` | `admin-knowledge-base.ts` |
| 9b | Articles | KB Articles | `admin/index.html:1646` | `admin-knowledge-base.ts` |
| 10 | Tasks | Tasks | Dynamic (Kanban) | `admin-tasks.ts` |
| 11 | (no heading) | Visitors | `admin/index.html:1365` | `admin-analytics.ts` |
| 12 | Files | Project Files | `admin-projects.ts:1143` | `admin-projects.ts` |
| 13 | Invoices | Project Invoices | `admin-projects.ts:1592` | `admin-projects.ts` |

### Table Header Quick Reference

```text
Leads:            ☐ | Project | Lead | Type | Budget | Status | Date | Actions
Clients:          ☐ | Client | Type | Projects | Status | Created | Actions
Contacts:         Contact | Message | Status | Date
Projects:         ☐ | Project | Type | Budget | Timeline | Status | Start
Invoices:         ☐ | Invoice # | Client | Project | Amount | Status | Due Date | Actions
Proposals:        ☐ | Client | Project | Tier | Price | Status | Date | Actions
Time Tracking:    Date | Description | Task | Duration | Billable | Actions
Doc Requests:     ☐ | Title | Client | Type | Status | Due | Actions
KB Categories:    Name | Slug | Articles | Active | Actions
KB Articles:      Title | Category | Slug | Featured | Published | Updated | Actions
Visitors:         Session ID | Started | Duration | Pages | Device | Location
Project Files:    File | Size | Uploaded | Actions
Project Invoices: Invoice # | Amount | Due Date | Status | Actions
```

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
 │   └── .admin-table-scroll-wrapper    ← Horizontal scroll on mobile
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

**Function:** `getPortalCheckboxHTML(config)` - Returns an HTML string

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
  dataAttributes?: Record  // data-* attributes (e.g. { rowId: "123" })
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
| Proposals | Header select-all + per-row | `bulk-select-all` / `proposals-row-select` |
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

| Value | Label |
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
| `on_hold` | `.status-on-hold` | Paused (normalized) |
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

**File:** `src/utils/table-filter.ts`

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
 │    └── div.filter-search-dropdown.search-bar
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

#### State Persistence

- All filter state saved to `localStorage` under `config.storageKey`
- Loaded on module init via `loadFilterState(storageKey)`
- Saved on every state change via `saveFilterState(storageKey, state)`

#### Dynamic Status Options

`updateFilterStatusOptions(filterContainer, options, label, state, config, onStateChange)` - Replaces status section in existing filter UI with new options. Used by Knowledge Base (categories loaded from API).

#### Pre-Configured Filter Configs

| Config | Table | searchFields | statusOptions | dateField | Sortable Columns | storageKey |
|--------|-------|-------------|---------------|-----------|-----------------|------------|
| `LEADS_FILTER_CONFIG` | Leads | contact_name, email, company_name, project_type | 8 statuses (new -> cancelled) | created_at | 6 columns | `admin_leads_filter` |
| `CONTACTS_FILTER_CONFIG` | Contacts | name, email, company, message | 4 (new, read, responded, archived) | created_at | 5 columns | `admin_contacts_filter` |
| `PROJECTS_FILTER_CONFIG` | Projects | project_name, contact_name, project_type | 5 (active -> cancelled) | created_at | 8 columns | `admin_projects_filter` |
| `CLIENTS_FILTER_CONFIG` | Clients | name, email, company_name | 2 (active, inactive) | created_at | 5 columns | `admin_clients_filter` |
| `DOCUMENT_REQUESTS_FILTER_CONFIG` | Doc Requests | title, client_name, document_type, description | 6 (requested -> rejected) | created_at | 5 columns | `admin_document_requests_filter` |
| `KNOWLEDGE_BASE_FILTER_CONFIG` | KB | title, category_name, slug, summary | Dynamic (loaded from API) | updated_at | 3 columns | `admin_kb_filter` |

#### Used In

| Table | Uses createFilterUI | Uses createSortableHeaders | Uses applyFilters |
|-------|:-------------------:|:--------------------------:|:-----------------:|
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
      │    └── div.pagination-page-size-dropdown
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

- `getTotalPages(state)` - `Math.ceil(totalItems / pageSize)`
- `getPageSlice(state)` - `{ start, end }` indices
- `applyPagination(data, state)` - Returns `data.slice(start, end)`
- `getVisiblePages(currentPage, totalPages)` - Page numbers with `-1` for ellipsis (shows 2 pages on each side of current)

#### State Persistence

- Only `pageSize` is saved to localStorage (not `currentPage`)
- Loaded on init: `loadPaginationState(storageKey)`
- Saved on change: `savePaginationState(storageKey, state)`

#### Live Update

`updatePaginationUI(containerId, state)` - Updates existing pagination DOM in-place (range text, button disabled states, page buttons) without recreating.

#### Used In

| Table | Config |
|-------|--------|
| Leads | `tableId: 'leads'`, default 25, storage `admin_leads_pagination` |
| Clients | `tableId: 'clients'`, default 25, storage `admin_clients_pagination` |
| Contacts | `tableId: 'contacts'`, default 25, storage `admin_contacts_pagination` |
| Projects | `tableId: 'projects'`, default 25, storage `admin_projects_pagination` |
| Invoices | Not used |
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
 └── div.bulk-toolbar-actions
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
4. On success -> resetSelection(tableId)
5. On error -> console.error, selection preserved
```

#### Pre-Built Action Factories

| Factory | id | variant | confirmMessage | HTTP Method |
|---------|-----|---------|---------------|-------------|
| `createArchiveAction(url, onSuccess)` | `'archive'` | `warning` | "Archive {count} selected items? They can be restored later." | POST |
| `createDeleteAction(url, onSuccess)` | `'delete'` | `danger` | "Permanently delete {count} selected items? This cannot be undone." | DELETE |
| `createStatusUpdateAction(label, status, url, onSuccess)` | `'status-{status}'` | `default` | none | POST |

#### State Management

- In-memory Map: `selectionStates: Map<string, BulkSelectionState>`
- Per table keyed by `tableId`
- Not persisted to localStorage (resets on page reload)

#### Used In

| Table | Actions | Custom or Pre-built |
|-------|---------|-------------------|
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
|--------|-------|---------|
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
|-------|-------------|-------------|
| Leads | `LEADS_EXPORT_CONFIG` | Export toolbar button |
| Clients | `CLIENTS_EXPORT_CONFIG` | Export toolbar button |
| Contacts | `CONTACTS_EXPORT_CONFIG` | Export toolbar button |
| Projects | `PROJECTS_EXPORT_CONFIG` | Export toolbar button |
| Invoices | `INVOICES_EXPORT_CONFIG` | Export toolbar button |
| Proposals | `PROPOSALS_EXPORT_CONFIG` | Export toolbar button |
| Document Requests | `DOCUMENT_REQUESTS_EXPORT_CONFIG` | Export toolbar button |
| Knowledge Base | `KNOWLEDGE_BASE_EXPORT_CONFIG` | Export toolbar button |
| Time Tracking | Not used | - |
| Tasks | Not used | - |

---

### 8. View Toggle

**File:** `src/components/view-toggle.ts`

**Scope:** Shared - used by Leads, Tasks, Files, Proposals

**Function:** `createViewToggle(config)` - Returns HTMLDivElement

#### Interface

```text
ViewToggleOption {
  value: string        // Passed to onChange
  label: string        // Visible text
  title?: string       // Tooltip
  ariaLabel?: string   // Accessibility label
  iconSvg?: string     // Optional SVG icon markup
}

ViewToggleConfig {
  options: ViewToggleOption[]
  value: string                   // Currently selected
  onChange: (value: string) => void
  id?: string
  className?: string
  ariaLabel?: string              // Group label
}
```

#### DOM Structure

```text
div.view-toggle [role="group"] [aria-label]
 ├── button [data-value] [.active]
 │    ├── span.view-toggle-icon (if iconSvg)
 │    │    └── {svg}
 │    └── span "{label}"
 ├── button [data-value]
 │    └── span "{label}"
 └── ...
```

#### Behavior

1. One button active at a time (segmented control pattern)
2. Click non-active button -> removes `.active` from all, adds to clicked, calls `onChange(value)`
3. Click active button -> no-op (stays active)

#### Styling

- Inactive buttons: darker background
- Active button: primary color
- CSS in admin styles

#### Used In

| Table | Options |
|-------|---------|
| Leads | "Table" / "Pipeline" (Kanban) |
| Tasks | "Board" (Kanban) / "List" |
| Files | View mode toggle |
| Proposals | View mode toggle |

---

### 9. Filter Select

**File:** `src/components/filter-select.ts`

**Scope:** Shared - native `<select>` dropdown for filter bars and forms

**Function:** `createFilterSelect(config)` - Returns `{ element: HTMLSelectElement, setOptions }`

#### Interface

```text
FilterSelectConfig {
  id?: string
  ariaLabel: string               // REQUIRED
  emptyOption?: string            // First option label (e.g. "All categories")
  options: FilterSelectOption[]   // { value, label }
  value: string                   // Currently selected
  onChange?: (value: string) => void
  className?: string              // Default: "admin-filter-select"
  required?: boolean
  name?: string                   // For form submission
}
```

#### DOM Output

```html
<select class="admin-filter-select" id="{id}" aria-label="{ariaLabel}">
  <option value="">{emptyOption}</option>
  <option value="{value}">{label}</option>
  ...
</select>
```

#### Dynamic Update

`setOptions(options, selectedValue?)` - Rebuilds `<option>` elements. Used when data loads from API (e.g. KB categories, project clients).

#### Used In

| Table | What For |
|-------|---------|
| Clients | Client type filter in detail view |
| Projects | Client filter, type filter in modals |
| Knowledge Base | Category filter (dynamic options from API) |

---

### 10. Kanban Board

**File:** `src/components/kanban-board.ts`

**Scope:** Shared - used by Leads (Pipeline view) and Tasks (Board view)

**Function:** `createKanbanBoard(config)` - Returns `{ refresh, destroy }`

#### Interface

```text
KanbanColumn {
  id: string
  title: string
  color?: string
  items: KanbanItem[]
}

KanbanItem {
  id: string | number
  title: string
  subtitle?: string
  badges?: KanbanBadge[]
  metadata?: Record<string, unknown>
}

KanbanBadge {
  text: string
  color?: string
  icon?: string
}

KanbanConfig {
  containerId: string
  columns: KanbanColumn[]
  onItemMove?: (itemId, fromColumn, toColumn) => Promise<void>
  onItemClick?: (item: KanbanItem) => void
  renderItem?: (item: KanbanItem) => string
  emptyColumnText?: string
}
```

#### DOM Structure

```text
div#containerId
 └── div.kanban-board
      ├── div.kanban-column [data-column-id]
      │    ├── div.kanban-column-header
      │    │    ├── span.kanban-column-title "{title}"
      │    │    └── span.kanban-column-count "{items.length}"
      │    └── div.kanban-column-body [droppable]
      │         ├── div.kanban-card [draggable] [data-item-id]
      │         │    ├── div.kanban-card-title
      │         │    ├── div.kanban-card-subtitle
      │         │    └── div.kanban-card-badges
      │         │         └── span.kanban-badge
      │         └── ...
      └── ...
```

#### Behavior

1. **Drag and drop** between columns using native HTML drag events
2. **onItemMove** callback for API updates on column change
3. **onItemClick** callback for opening details
4. **Custom renderer** via `renderItem` for table-specific card content
5. **refresh(columns)** - Re-renders with new data
6. **destroy()** - Cleanup

#### Used In

| Table | Columns |
|-------|---------|
| Leads (Pipeline view) | Pipeline stages (New, Contacted, Qualified, etc.) |
| Tasks (Board view) | Task statuses (To Do, In Progress, Done, etc.) |

---

### 11. Copy Email Button

**File:** `src/utils/copy-email.ts`

**Scope:** Shared across tables displaying email addresses

**Functions:**

- `getCopyEmailButtonHtml(email)` - Returns button HTML string
- `getEmailWithCopyHtml(email, displayEmail?)` - Returns email text + copy button HTML
- `initCopyEmailDelegation(root?)` - Call once at app init, sets up delegated click handler

#### DOM Output

```html
<!-- getCopyEmailButtonHtml -->
<button type="button" class="icon-btn copy-email-btn"
        data-copy-email="{escaped email}"
        title="Copy email" aria-label="Copy email address">
  {copy icon svg}
</button>

<!-- getEmailWithCopyHtml -->
<span class="meta-value-with-copy">
  {display email}
  <button ...copy button.../>
</span>
```

#### Behavior

1. **Delegated listener** on document (set up once via `initCopyEmailDelegation`)
2. Click `.copy-email-btn` -> reads `data-copy-email` attribute
3. Copies to clipboard via `navigator.clipboard.writeText()`
4. Shows `showToast('Email copied to clipboard', 'success')` on success
5. Shows `showToast('Failed to copy email', 'error')` on failure
6. `e.stopPropagation()` prevents row click navigation

#### Used In

| Table | Placement |
|-------|-----------|
| Leads | Identity cell (email display) |
| Clients | Identity cell (email display) + detail panel |
| Contacts | Identity cell (email display) |
| Projects | Detail view (client email) |
| Proposals | Detail view (client email) |
| Client Details | Email fields in meta section |

---

### 12. Loading / Empty / Error States

**File:** `src/utils/loading-utils.ts`

**Scope:** Shared across all tables

**Functions:**

| Function | Returns | DOM Output |
|----------|---------|-----------|
| `getTableLoadingRow(colspan, message?)` | HTML string | `<tr><td class="loading-row loading-state">` with spinner + message |
| `getTableEmptyRow(colspan, message)` | HTML string | `<tr><td class="loading-row empty-state">` with message |
| `showTableLoading(tableBody, colspan, message?)` | void | Sets `innerHTML` of tbody |
| `showTableEmpty(tableBody, colspan, message)` | void | Sets `innerHTML` of tbody |
| `showContainerLoading(container, message?)` | void | Sets `innerHTML` with spinner |
| `getInlineLoadingHTML()` | HTML string | `<span class="loading-spinner loading-spinner--small">` |
| `getListSkeletonHTML(count?)` | HTML string | Skeleton loader items |
| `getCardSkeletonHTML(count?)` | HTML string | Skeleton card placeholders |
| `getChartSkeletonHTML()` | HTML string | Skeleton bar chart |
| `withLoading(container, loadingHTML, asyncFn)` | Promise | Wraps async with loading state |

#### CSS Classes

- `.loading-row` - Table row container for loading/empty states
- `.loading-state` - Loading variant (with spinner)
- `.empty-state` - Empty variant (just message)
- `.loading-spinner` - CSS animated spinner
- `.loading-spinner--small` - Inline size variant
- `.loading-spinner--large` - Full container size variant
- `.loading-container` - Container variant with `role="status"` + `aria-live="polite"`
- `.skeleton-item`, `.skeleton-card`, `.skeleton-chart` - Skeleton loader variants

#### Used In

| Table | Loading | Empty | Error |
|-------|:-------:|:-----:|:-----:|
| Leads | Yes | Yes | - |
| Clients | Yes | Yes | Yes (via error-utils) |
| Contacts | - | Yes | - |
| Projects | Yes | Yes | Yes (via error-utils) |
| Invoices | Yes | Yes | Yes (via error-utils) |
| Document Requests | Yes | Yes | - |
| Knowledge Base | Yes | Yes | - |
| Analytics | Yes (chart skeleton) | - | Yes (via error-utils) |
| Tasks | - | - | - |
| Time Tracking | - | - | - |
| Proposals | - | - | - |

---

### 13. Confirm Dialog

**File:** `src/utils/confirm-dialog.ts`

**Scope:** Shared across all tables and features

**Functions:**

| Function | Returns | Purpose |
|----------|---------|---------|
| `confirmDialog(options)` | `Promise<boolean>` | Two-button confirm (Cancel/Confirm) |
| `confirmDanger(message, confirmText?, title?)` | `Promise<boolean>` | Shorthand for destructive confirms (red button) |
| `alertDialog(options)` | `Promise<void>` | Single-button alert |
| `alertError(message, title?)` | `Promise<void>` | Error alert shorthand |
| `alertSuccess(message, title?)` | `Promise<void>` | Success alert shorthand |
| `alertInfo(message, title?)` | `Promise<void>` | Info alert shorthand |
| `alertWarning(message, title?)` | `Promise<void>` | Warning alert shorthand |
| `promptDialog(options)` | `Promise<string\|null>` | Single input prompt |
| `multiPromptDialog(options)` | `Promise<Record\|null>` | Multi-field form dialog |

#### Confirm Dialog DOM

```text
div.confirm-dialog-overlay [role="dialog"] [aria-modal="true"]
 └── div.confirm-dialog
      ├── div.confirm-dialog-header
      │    ├── div.confirm-dialog-icon.{type}  (SVG icon)
      │    └── h3.confirm-dialog-title
      ├── p.confirm-dialog-message
      └── div.confirm-dialog-actions
           ├── button.confirm-dialog-btn.confirm-dialog-cancel
           └── button.confirm-dialog-btn.confirm-dialog-confirm [.danger]
```

#### Multi-Prompt Dialog DOM (used for bulk status updates)

```text
div.confirm-dialog-overlay
 └── div.confirm-dialog.prompt-dialog.multi-prompt-dialog
      ├── div.confirm-dialog-header
      ├── form.multi-prompt-form
      │    ├── div.prompt-dialog-field
      │    │    ├── label.prompt-dialog-label
      │    │    └── input/textarea/select.prompt-dialog-input.form-input
      │    └── div.confirm-dialog-actions
      └── ...
```

#### Behavior

1. **Modal overlay** covers viewport
2. **Focus trap** - Tab cycles between Cancel and Confirm only
3. **Escape key** closes (resolves false/null)
4. **Outside click** (on overlay) closes
5. **Closing animation** - `.closing` class added, 150ms delay before removal
6. **Focus restore** - Returns focus to previously active element
7. **Multi-prompt validation** - Required fields show `.field--invalid` class

#### Icon Types

| Icon | Usage |
|------|-------|
| `danger` (trash) | Delete confirmations |
| `warning` (triangle) | Archive, risky actions |
| `success` (checkmark circle) | Success alerts |
| `info` (info circle) | Information alerts |
| `question` / `folder-plus` | Default / project conversion |

#### Used In

- **Bulk actions** (all tables with bulk) -> `confirmDanger` for delete/archive
- **Leads** -> `multiPromptDialog` for bulk status update, `confirmDialog` for convert
- **Clients** -> `confirmDanger` for delete, `confirmDialog` for edit
- **Contacts** -> `confirmDialog` for archive/convert
- **Projects** -> `alertWarning`, `multiPromptDialog` for milestones
- **Time Tracking** -> `confirmDanger` for delete, `multiPromptDialog` for edit/create
- **Tasks** -> `confirmDanger` for delete, `multiPromptDialog` for edit/create
- **Document Requests** -> `confirmDanger` for delete, `alertSuccess`/`alertError` for actions
- **Knowledge Base** -> `confirmDanger` for delete category/article
- **Analytics** -> `confirmDialog`, `alertDialog` for scoring rules

---

### Component Usage Map (by Table)

```text
                          Checkbox  Dropdown  Badge  Filter  Pagination  Bulk    Export  ViewToggle  FilterSelect  Kanban  CopyEmail  Loading  Confirm
                          ────────  ────────  ─────  ──────  ──────────  ────    ──────  ──────────  ────────────  ──────  ─────────  ───────  ───────
Leads                        X         X              X         X         X        X        X                       X        X          X        X
Clients                      X                  X     X         X         X        X                    X                    X          X        X
Contacts                               X              X         X                  X                                         X          X        X
Projects                     X         X              X         X         X        X                    X                    X          X        X
Invoices                     X                  X                                   X                                                    X
Proposals                    X         X                                  X        X        X                                X                   X
Time Tracking                                                                                                                                    X
Document Requests            X                        X                   X        X                                                    X        X
Knowledge Base                                        X                            X                    X                               X        X
Tasks                                           X                                          X                       X                            X
Files                                                                                      X
Analytics                                                                                                                               X        X
```

#### Exact Import Sources per Table

| Table Module | Imports From |
|-------------|-------------|
| **admin-leads.ts** | table-dropdown (`createTableDropdown`, `LEAD_STATUS_OPTIONS`), table-bulk-actions (`createRowCheckbox`, `createBulkActionToolbar`, `setupBulkSelectionHandlers`, `resetSelection`), table-filter (via separate config), table-pagination (via separate config), table-export (`exportToCsv`, `LEADS_EXPORT_CONFIG`), loading-utils (`showTableEmpty`), copy-email (`getCopyEmailButtonHtml`), kanban-board (`createKanbanBoard`), view-toggle (`createViewToggle`), confirm-dialog (`confirmDialog`, `multiPromptDialog`), toast-notifications, modal-dropdown |
| **admin-clients.ts** | filter-select (`createFilterSelect`), table-export (`exportToCsv`, `CLIENTS_EXPORT_CONFIG`), loading-utils (`showTableLoading`, `showTableEmpty`), confirm-dialog (`confirmDialog`, `confirmDanger`), error-utils (`showTableError`), dom-cache (`createDOMCache`, `batchUpdateText`, `getElement`), button-loading (`withButtonLoading`), focus-trap, status-badge (`getStatusBadgeHTML`), copy-email (`getCopyEmailButtonHtml`, `getEmailWithCopyHtml`) |
| **admin-contacts.ts** | table-dropdown (`createTableDropdown`, `CONTACT_STATUS_OPTIONS`), table-filter (via separate config), table-pagination (via separate config), table-export (`exportToCsv`, `CONTACTS_EXPORT_CONFIG`), loading-utils (`showTableEmpty`), copy-email (`getCopyEmailButtonHtml`, `getEmailWithCopyHtml`), confirm-dialog (`confirmDialog`) |
| **admin-projects.ts** | table-dropdown (`createTableDropdown`, `PROJECT_STATUS_OPTIONS`), table-bulk-actions (`createRowCheckbox`, `createBulkActionToolbar`, `setupBulkSelectionHandlers`, `resetSelection`), filter-select (`createFilterSelect`), loading-utils (`showTableLoading`, `showTableEmpty`), error-utils (`showTableError`), dom-cache (`createDOMCache`, `batchUpdateText`), copy-email (`getEmailWithCopyHtml`), confirm-dialog (`alertWarning`, `multiPromptDialog`), focus-trap, modal-dropdown, toast-notifications |
| **admin-invoices.ts** | loading-utils (`showTableLoading`, `showTableEmpty`), error-utils (`showTableError`), status-badge (`getStatusBadgeHTML`), portal-checkbox (`getPortalCheckboxHTML`) |
| **admin-proposals.ts** | table-dropdown (`createTableDropdown`), table-export (`exportToCsv`, `PROPOSALS_EXPORT_CONFIG`), view-toggle (`createViewToggle`), search-bar (`createSearchBar`), copy-email (`getEmailWithCopyHtml`), confirm-dialog (`confirmDialog`, `alertSuccess`, `alertError`, `multiPromptDialog`), modal-dropdown, toast-notifications |
| **admin-time-tracking.ts** | confirm-dialog (`confirmDanger`, `alertSuccess`, `alertError`, `multiPromptDialog`), chart-simple (`createBarChart`) |
| **admin-document-requests.ts** | loading-utils (`showTableLoading`, `showTableEmpty`), table-export (`exportToCsv`, `DOCUMENT_REQUESTS_EXPORT_CONFIG`), portal-checkbox (`getPortalCheckboxHTML`), confirm-dialog (`confirmDanger`, `alertError`, `alertSuccess`), focus-trap, modal-dropdown |
| **admin-knowledge-base.ts** | loading-utils (`showTableLoading`, `showTableEmpty`), table-export (`exportToCsv`, `KNOWLEDGE_BASE_EXPORT_CONFIG`), filter-select (`createFilterSelect`), portal-modal (`createPortalModal`), confirm-dialog (`confirmDanger`, `alertError`, `alertSuccess`), focus-trap |
| **admin-tasks.ts** | kanban-board (`createKanbanBoard`), view-toggle (`createViewToggle`), status-badge (`getStatusBadgeHTML`), confirm-dialog (`confirmDanger`, `alertSuccess`, `alertError`, `multiPromptDialog`) |
| **admin-files.ts** | view-toggle (`createViewToggle`), confirm-dialog (`confirmDialog`, `alertSuccess`, `alertError`) |
| **admin-analytics.ts** | loading-utils (`showTableLoading`, `getChartSkeletonHTML`), error-utils (`showTableError`), confirm-dialog (`multiPromptDialog`, `alertDialog`, `confirmDialog`), toast-notifications |

---

## Admin Tables

### 1. Leads Table

**Display Name:** "Intake Submissions" (mobile: "Leads")

**Module:** `src/features/admin/modules/admin-leads.ts`

**HTML Source:** `admin/index.html:462-477` (static `<thead>`)

**CSS Class:** `.admin-table .leads-table`

**Nav Tab:** `data-tab="leads"` (sidebar button `#btn-leads`)

**Components Used:** All shared utilities

**Dual View:** Table view + Pipeline (Kanban) view via `createKanbanBoard()`

#### Table Headers (`<th>` in order)

```text
☐ (checkbox) | Project | Lead | Type | Budget | Status | Date | Actions
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Checkbox | `<input type="checkbox">` | Bulk select |
| 2 | Project | Text / Link | Blue link when in-progress or converted |
| 3 | Lead | Identity cell (company OR name, email) | Primary: company_name fallback contact_name |
| 4 | Type | Text | Capitalized project_type |
| 5 | Budget | Text | Formatted budget_range |
| 6 | Status | Dropdown | Custom `createTableDropdown()` |
| 7 | Date | Formatted date | created_at |
| 8 | Actions | Icon button | Convert to Project (conditional) |

#### Toolbar Buttons (above table)

- **Add Lead** (+) - Opens create modal
- **Export** (download icon) - CSV export via `LEADS_EXPORT_CONFIG`
- **View Toggle** - Table / Pipeline segmented control
- **Search** (magnifying glass) - Expandable search input, debounced 200ms
- **Status Filter** (funnel icon) - Multi-select checkboxes with count badge
- **Date Range Filter** - Start/end date inputs

#### Checkboxes and Bulk Actions

- **Has checkboxes:** Yes (header select-all + per-row)
- **Indeterminate state:** Yes (partial selection)
- **Bulk toolbar actions when checked:**

| Action | Variant | Backend | Payload |
|--------|---------|---------|---------|
| Update Status | default | `POST /api/admin/leads/bulk/status` | `{ ids, status }` |
| Bulk Assign | default | `POST /api/admin/leads/bulk/assign` | `{ ids, assignee }` |
| Bulk Move Stage | default | `POST /api/admin/leads/bulk/move-stage` | `{ ids, stage }` |

#### Row-Level Actions

| Action | Icon | Selector | Condition | Backend |
|--------|------|----------|-----------|---------|
| Convert Lead | blue icon | `btn-convert-lead` | Only for convertible statuses | `POST /api/leads/{id}/convert-to-project` |
| Status Change | dropdown | In status cell | Always | `PUT /api/leads/{id}` with `{ status }` |

#### Dropdowns

| Location | Type | Options |
|----------|------|---------|
| Status column (each row) | Status dropdown with colored dot | new, contacted, qualified, in-progress, converted, lost, on-hold, cancelled |
| Filter bar | Multi-select checkbox dropdown | Same statuses as above |
| Pagination | Per-page dropdown | 10, 25, 50, 100 |

#### Pagination

- **Has pagination:** Yes
- **Type:** Client-side numbered pages
- **Config:** `tableId: 'leads'`, default 25, options `[10, 25, 50, 100]`
- **Storage:** `localStorage: 'admin_leads_pagination'`
- **Controls:** First / Prev / Page numbers (with ellipsis) / Next / Last + "Showing X-Y of Z"

#### Filter Config

- **Search fields:** contact_name, email, company_name, project_type
- **Status field:** status
- **Date field:** created_at
- **Sortable columns:** created_at, contact_name, company_name, project_type, budget_range, status
- **Storage:** `localStorage: 'admin_leads_filter'`

#### Backend Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/leads` | Load all leads |
| PUT | `/api/leads/{id}` | Update single lead |
| POST | `/api/admin/leads/bulk/status` | Bulk status update |
| POST | `/api/admin/leads/bulk/assign` | Bulk assign |
| POST | `/api/admin/leads/bulk/move-stage` | Bulk move stage |
| POST | `/api/leads/{id}/convert-to-project` | Convert to project |
| GET | `/api/admin/leads/analytics` | Lead analytics |
| GET | `/api/admin/leads/pipeline` | Pipeline data |
| GET | `/api/admin/leads/pipeline/stats` | Pipeline statistics |
| POST | `/api/admin/leads/:id/tasks` | Add task to lead |
| GET | `/api/admin/leads/:id/tasks` | Get lead tasks |
| POST | `/api/admin/leads/:id/notes` | Add note to lead |
| GET | `/api/admin/leads/:id/notes` | Get lead notes |

#### Responsiveness

- **Desktop:** All columns visible, min-width 800px
- **Mobile (<480px):** Hides Company (col 3) and Email (col 4) via `:nth-child()` display:none
- **Horizontal scroll:** Yes via `.admin-table-scroll-wrapper`
- **Bulk select column:** Hidden on small mobile

---

### 2. Clients Table

**Display Name:** "Client Accounts" (mobile: "Clients")

**Module:** `src/features/admin/modules/admin-clients.ts`

**HTML Source:** `admin/index.html:683-696` (static `<thead>`)

**CSS Class:** `.admin-table .clients-table`

**Nav Tab:** `data-tab="clients"` (sidebar button `#btn-clients`)

**Components Used:** All shared utilities + `createDOMCache()` optimization

#### Table Headers (`<th>` in order)

```text
☐ (checkbox) | Client | Type | Projects | Status | Created | Actions
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Checkbox | `<input type="checkbox">` | Bulk select |
| 2 | Client | Identity cell (name, secondary info, email) | Company for business, contact for personal |
| 3 | Type | Text label | "Personal" / "Business" |
| 4 | Projects | Number | Project count |
| 5 | Status | Badge + optional invite button | active/pending/inactive |
| 6 | Created | Formatted date | created_at |
| 7 | Actions | Icon button | View (eye icon) |

#### Toolbar Buttons

- **Add Client** (+) - Opens create modal
- **Export** (download icon) - CSV via `CLIENTS_EXPORT_CONFIG`
- **Refresh** (refresh icon) - Reloads from API
- **Search** (magnifying glass) - Expandable
- **Status Filter** (funnel) - Multi-select
- **Date Range Filter** - Start/end

#### Checkboxes and Bulk Actions

- **Has checkboxes:** Yes
- **Bulk toolbar actions:**

| Action | Variant | Confirmation | Backend |
|--------|---------|--------------|---------|
| Archive | warning | "Archive {count} selected clients? They can be restored later." | `POST /api/admin/clients/bulk/archive` with `{ ids }` |
| Delete | danger | "Permanently delete {count} selected clients? This cannot be undone." | `DELETE /api/admin/clients/bulk/delete` with `{ ids }` |

#### Row-Level Actions

| Action | Icon | Selector | Condition | Backend |
|--------|------|----------|-----------|---------|
| Invite | envelope | `icon-btn-invite` | Only when status is "Not Invited" | `POST /api/admin/clients/{id}/send-invitation` |
| View Client | eye | `btn-view-client` | Always | Opens client detail panel |
| Row click | - | - | Except checkbox and invite | Navigates to client details |

#### Dropdowns

| Location | Type | Options |
|----------|------|---------|
| Filter bar | Multi-select checkbox | active, inactive |
| Pagination | Per-page | 10, 25, 50, 100 |

#### Pagination

- **Has pagination:** Yes
- **Config:** `tableId: 'clients'`, default 25
- **Storage:** `localStorage: 'admin_clients_pagination'`

#### Filter Config

- **Search fields:** name, email, company_name
- **Status options:** active, inactive
- **Sortable columns:** name, client_type, email, status, created_at
- **Storage:** `localStorage: 'admin_clients_filter'`

#### Backend Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/clients` | Load all clients |
| POST | `/api/clients` | Create client |
| PUT | `/api/clients/{id}` | Update client |
| DELETE | `/api/clients/{id}` | Delete client |
| POST | `/api/admin/clients/{id}/send-invitation` | Send invite |
| POST | `/api/admin/clients/bulk/archive` | Bulk archive |
| DELETE | `/api/admin/clients/bulk/delete` | Bulk delete |
| GET | `/api/clients/{id}/projects` | Get client projects |
| GET | `/api/clients/{id}/invoices` | Get client invoices |
| PUT | `/api/admin/clients/{id}/billing` | Update billing info |

#### Responsiveness

- **Desktop:** All columns visible, min-width 800px
- **Mobile (<480px):** Hides Email (col 4) and Created (col 8)
- **Bulk select column:** Hidden on small mobile

---

### 3. Contacts Table

**Display Name:** "Contact Form Submissions" (mobile: "Contacts")

**Module:** `src/features/admin/modules/admin-contacts.ts`

**HTML Source:** `admin/index.html:539-545` (static `<thead>`)

**CSS Class:** `.admin-table .contacts-table`

**Nav Tab:** `data-tab="leads"` (within Leads section, below Intake Submissions)

**Components Used:** Shared filter, pagination, dropdown

#### Table Headers (`<th>` in order)

```text
Contact | Message | Status | Date
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Contact | Identity cell (name, company, email) | Capitalized |
| 2 | Message | Truncated text | max-width 200px, ellipsis, title tooltip |
| 3 | Status | Dropdown | Custom `createTableDropdown()` |
| 4 | Date | Formatted date | created_at |

#### Toolbar Buttons

- **Export** (download icon) - CSV via `CONTACTS_EXPORT_CONFIG`
- **Search** (magnifying glass)
- **Status Filter** (funnel)
- **Date Range Filter**

#### Checkboxes and Bulk Actions

- **Has checkboxes:** No
- **No bulk toolbar**

#### Row-Level Actions (in detail panel, not inline)

| Action | Icon | Selector | Backend |
|--------|------|----------|---------|
| Convert to Client | user-plus | `convert-to-client-btn` | `POST /api/admin/convert-contact-to-client` with `{ email, name }` |
| Archive | archive | `archive-contact-btn` | `PUT /api/admin/contact-submissions/{id}` with `{ status: 'archived' }` |
| Restore | rotate | `restore-contact-btn` | `PUT /api/admin/contact-submissions/{id}` with `{ status: 'new' }` |

#### Dropdowns

| Location | Type | Options |
|----------|------|---------|
| Status column (each row) | Status dropdown | new, read, responded, archived |
| Filter bar | Multi-select checkbox | Same statuses |
| Pagination | Per-page | 10, 25, 50, 100 |

#### Pagination

- **Has pagination:** Yes
- **Config:** `tableId: 'contacts'`, default 25
- **Storage:** `localStorage: 'admin_contacts_pagination'`

#### Filter Config

- **Search fields:** name, email, company, message
- **Status options:** new, read, responded, archived
- **Sortable columns:** created_at, name, email, company, status
- **Storage:** `localStorage: 'admin_contacts_filter'`

#### Backend Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/contact-submissions` | Load contacts |
| PUT | `/api/admin/contact-submissions/{id}` | Update status |
| POST | `/api/admin/convert-contact-to-client` | Convert to client |

#### Responsiveness

- **Desktop:** All columns visible
- **Mobile (<480px):** Hides Company (col 4)
- **Message cell:** 200px max-width with ellipsis at all sizes

---

### 4. Projects Table

**Display Name:** "Projects"

**Module:** `src/features/admin/modules/admin-projects.ts`

**HTML Source:** `admin/index.html:608-621` (static `<thead>`)

**CSS Class:** `.admin-table .projects-table`

**Nav Tab:** `data-tab="projects"` (sidebar button `#btn-projects`)

**Components Used:** All shared utilities

**Note:** Also has two nested sub-tables in project detail view (see below)

#### Table Headers (`<th>` in order)

```text
☐ (checkbox) | Project | Type | Budget | Timeline | Status | Start
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Checkbox | `<input type="checkbox">` | Bulk select |
| 2 | Project | Identity cell (project name, contact, company) | Multi-line |
| 3 | Type | Text | Formatted project type |
| 4 | Budget | Text | Formatted budget_range |
| 5 | Timeline | Text | Formatted timeline |
| 6 | Status | Dropdown | Custom `createTableDropdown()` |
| 7 | Start Date | Formatted date | start_date |

#### Toolbar Buttons

- **Add Project** (+) - Opens create modal
- **Export** (download icon) - CSV via `PROJECTS_EXPORT_CONFIG`
- **Search** (magnifying glass)
- **Status Filter** (funnel)
- **Date Range Filter**

#### Checkboxes and Bulk Actions

- **Has checkboxes:** Yes
- **Bulk actions:** Framework configured but no specific bulk operations currently active

#### Row-Level Actions

| Action | Icon | Selector | Backend |
|--------|------|----------|---------|
| Status Change | dropdown | In status cell | `PUT /api/projects/{id}` with `{ status }` |
| Row click | - | - | Navigates to project details |

#### Dropdowns

| Location | Type | Options |
|----------|------|---------|
| Status column (each row) | Status dropdown | pending, active, in-progress, on-hold, completed, cancelled |
| Filter bar | Multi-select checkbox | active, in-progress, on-hold, completed, cancelled |
| Pagination | Per-page | 10, 25, 50, 100 |

#### Pagination

- **Has pagination:** Yes
- **Config:** `tableId: 'projects'`, default 25
- **Storage:** `localStorage: 'admin_projects_pagination'`

#### Filter Config

- **Search fields:** project_name, contact_name, project_type
- **Status options:** active, in-progress, on-hold, completed, cancelled
- **Sortable columns:** project_name, contact_name, project_type, budget_range, timeline, start_date, end_date, status
- **Storage:** `localStorage: 'admin_projects_filter'`

#### Backend Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/projects` | Load projects |
| POST | `/api/admin/projects` | Create project |
| GET | `/api/admin/projects/{id}` | Get single project |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project |
| POST | `/api/projects/{id}/milestones` | Add milestone |
| DELETE | `/api/projects/{id}/files/{fileId}` | Delete file |

#### Responsiveness

- **Desktop:** All columns visible, min-width 800px
- **Mobile (<480px):** Hides Type (col 3), Timeline (col 5), Start Date (col 6), End Date (col 7)
- **Effectively mobile shows:** Checkbox, Project, Budget, Status only

---

### 5. Invoices Table

**Display Name:** "All Invoices" (mobile: "Invoices")

**Module:** `src/features/admin/modules/admin-invoices.ts`

**HTML Source:** `admin/index.html:757-770` (static `<thead>`)

**CSS Class:** `.admin-table .invoices-table`

**Nav Tab:** `data-tab="invoices"` (sidebar button `#btn-invoices`)

**Components Used:** Partial shared utilities

#### Table Headers (`<th>` in order)

```text
☐ (checkbox) | Invoice # | Client | Project | Amount | Status | Due Date | Actions
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Checkbox | `<input type="checkbox">` | Bulk select |
| 2 | Invoice # | Strong text | invoice_number or INV-{id} |
| 3 | Client | Text | client_name |
| 4 | Project | Text | project_name or "-" |
| 5 | Amount | Currency | Formatted with `formatCurrency()` |
| 6 | Status | Badge | paid/pending/overdue (computed) |
| 7 | Due Date | Formatted date or "-" | due_date |
| 8 | Actions | Icon buttons | View (eye) + Edit (pencil) |

#### Toolbar Buttons

- **Add Invoice** (+) - Opens create modal
- **Export** (download icon) - CSV via `INVOICES_EXPORT_CONFIG`

#### Checkboxes and Bulk Actions

- **Has checkboxes:** Yes
- **Bulk actions:** Selection available, no specific bulk operations implemented

#### Row-Level Actions

| Action | Icon | Selector | Backend |
|--------|------|----------|---------|
| View | eye | `data-action="view"` | Shows invoice details |
| Edit | pencil | `data-action="edit"` | Opens edit modal |

#### Dropdowns

- None in table cells

#### Pagination

- **Has pagination:** No
- All invoices rendered at once

#### Special Logic

- Overdue status computed: if status !== 'paid' AND due_date < today, badge shows "overdue"

#### Backend Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/invoices` | Load invoices |
| POST | `/api/invoices` | Create invoice |
| GET | `/api/invoices/{id}` | View single |
| PUT | `/api/invoices/{id}` | Update invoice |
| DELETE | `/api/invoices/{id}` | Delete invoice |

#### Responsiveness

- No column hiding configured
- Horizontal scroll on mobile via wrapper

---

### 6. Proposals Table

**Display Name:** "Proposal Requests"

**Module:** `src/features/admin/modules/admin-proposals.ts`

**HTML Source:** `admin-proposals.ts:388-403` (dynamically rendered via `renderProposalsLayout()`)

**CSS Class:** `.admin-table .proposals-table`

**Nav Tab:** `proposals` (no sidebar button; navigated to programmatically)

**Note:** Unlike other tables, the entire HTML including `<thead>` is generated dynamically by the TypeScript module, not defined in `admin/index.html`.

#### Table Headers (`<th>` in order)

```text
☐ (checkbox) | Client | Project | Tier | Price | Status | Date | Actions
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Checkbox | `<input type="checkbox">` | Bulk select |
| 2 | Client | Text | client name or company |
| 3 | Project | Text | project_name |
| 4 | Tier | Text | good/better/best |
| 5 | Price | Currency | finalPrice formatted |
| 6 | Status | Dropdown | Proposal status |
| 7 | Date | Formatted date | Created/reviewed |
| 8 | Actions | Icon buttons | View, Edit, Delete |

#### Toolbar Buttons

- **Search bar** - Text input
- **Filter buttons** - Segmented: all, pending, reviewed, accepted, rejected, converted
- **Export** - CSV via `PROPOSALS_EXPORT_CONFIG`

#### Checkboxes and Bulk Actions

- **Has checkboxes:** Yes
- **Bulk action:** Update Status

#### Row-Level Actions

| Action | Icon | Backend |
|--------|------|---------|
| View | eye | Opens detail view |
| Edit | pencil | Opens edit modal |
| Delete | trash | `DELETE /api/proposals/{id}` |

#### Pagination

- **Has pagination:** No

#### Backend Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/proposals` | Load proposals |
| PUT | `/api/proposals/{id}` | Update proposal |
| DELETE | `/api/proposals/{id}` | Delete proposal |

#### Responsiveness

- No column hiding configured
- Horizontal scroll on mobile via wrapper

---

### 7. Time Tracking Table

**Display Name:** "Time Entries"

**Module:** `src/features/admin/modules/admin-time-tracking.ts`

**HTML Source:** `admin-time-tracking.ts:215-224` (dynamically rendered in project detail view)

**CSS Class:** `.time-entries-table`

**Location:** Project Detail view > Time Tracking sub-tab

**Note:** This table renders inside the project detail panel, not as a standalone admin section.

#### Table Headers (`<th>` in order)

```text
Date | Description | Task | Duration | Billable | Actions
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Date | Formatted date | entry date |
| 2 | Description | Escaped text | description |
| 3 | Task | Text or "-" | task title |
| 4 | Duration | Formatted time | "2h 30m" from duration_minutes |
| 5 | Billable | Badge | "Yes" / "No" |
| 6 | Actions | Icon buttons | Edit (pencil) + Delete (trash) |

#### Toolbar Buttons

- Summary cards above table: Total Hours, This Week, Billable Hours, Billable Amount
- Weekly chart visualization above table

#### Checkboxes and Bulk Actions

- **Has checkboxes:** No
- **No bulk toolbar**

#### Row-Level Actions

| Action | Icon | Backend |
|--------|------|---------|
| Edit | pencil | Opens edit modal |
| Delete | trash | Confirmation dialog then delete |

#### Dropdowns

- None

#### Pagination

- **Has pagination:** No

#### Responsiveness

- No column hiding configured
- Horizontal scroll on mobile via wrapper

---

### 8. Document Requests Table

**Display Name:** "Requests"

**Module:** `src/features/admin/modules/admin-document-requests.ts`

**HTML Source:** `admin/index.html:1499-1511` (static `<thead>`)

**CSS Class:** `.admin-table` (with `aria-label="Document requests"`)

**Nav Tab:** `data-tab="document-requests"` (sidebar button `#btn-document-requests`)

#### Table Headers (`<th>` in order)

```text
☐ (checkbox) | Title | Client | Type | Status | Due | Actions
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Checkbox | `<input type="checkbox">` | Bulk select |
| 2 | Title | Text | Document title |
| 3 | Client | Text | client_name |
| 4 | Type | Text | document_type |
| 5 | Status | Badge | Multi-status |
| 6 | Due | Formatted date | due_date |
| 7 | Actions | Icon buttons | Contextual based on status |

#### Checkboxes and Bulk Actions

- **Has checkboxes:** Yes
- **Bulk actions:**

| Action | Backend |
|--------|---------|
| Send Reminders | `POST /api/document-requests/bulk/remind` |
| Delete | Bulk delete |

#### Row-Level Actions (contextual based on status)

| Action | Icon | Selector | Backend |
|--------|------|----------|---------|
| View | eye | `dr-view` | Opens detail |
| Start Review | checkmark | `dr-start-review` | `POST /api/document-requests/{id}/review` |
| Approve | success | `dr-approve` | `PUT /api/document-requests/{id}` with `{ status: 'approved', review_notes }` |
| Reject | danger | `dr-reject` | `PUT /api/document-requests/{id}` with `{ status: 'rejected', rejection_reason }` |
| Send Reminder | bell | `dr-remind` | `POST /api/document-requests/{id}/remind` |
| Delete | trash | `dr-delete` | `DELETE /api/document-requests/{id}` |

#### Dropdowns

| Location | Type | Options |
|----------|------|---------|
| Filter bar | Status filter | requested, viewed, uploaded, under_review, approved, rejected |

#### Pagination

- **Has pagination:** No

#### Filter Config

- **Search fields:** title, client_name, document_type, description
- **Status options:** requested, viewed, uploaded, under_review, approved, rejected
- **Sortable columns:** title, client_name, status, due_date, created_at

#### Backend Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/document-requests` | Load requests |
| POST | `/api/document-requests/{id}/review` | Start review |
| PUT | `/api/document-requests/{id}` | Update (status, notes) |
| POST | `/api/document-requests/{id}/remind` | Send reminder |
| DELETE | `/api/document-requests/{id}` | Delete request |
| POST | `/api/document-requests/bulk/remind` | Send bulk reminders |

#### Responsiveness

- No column hiding configured
- Horizontal scroll on mobile via wrapper

---

### 9. Knowledge Base Tables

**Display Name:** "Categories" and "Articles" (two separate tables in one section)

**Module:** `src/features/admin/modules/admin-knowledge-base.ts`

**HTML Source (Categories):** `admin/index.html:1614-1621` (static `<thead>`)

**HTML Source (Articles):** `admin/index.html:1646-1655` (static `<thead>`)

**CSS Class:** `.admin-table` (with `aria-label="Knowledge base categories"` / `aria-label="Knowledge base articles"`)

**Nav Tab:** `data-tab="knowledge-base"` (sidebar button `#btn-knowledge-base`)

#### Categories Table Headers (`<th>` in order)

```text
Name | Slug | Articles | Active | Actions
```

#### Categories Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Name | Text | Category name |
| 2 | Slug | Text | URL slug |
| 3 | Articles | Number | Article count |
| 4 | Active | Badge | Yes/No |
| 5 | Actions | Icon buttons | Edit, Delete |

#### Articles Table Headers (`<th>` in order)

```text
Title | Category | Slug | Featured | Published | Updated | Actions
```

#### Articles Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Title | Text | Article title |
| 2 | Category | Text | category_name |
| 3 | Slug | Text | URL slug |
| 4 | Featured | Badge | Yes/No |
| 5 | Published | Badge | Yes/No |
| 6 | Updated | Formatted date | updated_at |
| 7 | Actions | Icon buttons | Edit, Delete |

#### Row-Level Actions

| Action | Icon | Selector | Backend |
|--------|------|----------|---------|
| Edit Category | pencil | `kb-edit-category` | Opens edit modal |
| Delete Category | trash | `kb-delete-category` | `DELETE /api/kb-categories/{id}` |
| Edit Article | pencil | `kb-edit-article` | Opens edit modal |
| Delete Article | trash | `kb-delete-article` | `DELETE /api/kb-articles/{id}` |

#### Checkboxes and Bulk Actions

- **Has checkboxes:** No
- **No bulk toolbar**

#### Filter Config

- **Search fields:** title, category_name, slug, summary
- **Sortable columns:** title, category_name, updated_at

#### Pagination

- **Has pagination:** No

#### Backend Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/kb-categories` | Load categories |
| GET | `/api/kb-articles` | Load articles |
| PUT | `/api/kb-categories/{id}` | Update category |
| DELETE | `/api/kb-categories/{id}` | Delete category |
| PUT | `/api/kb-articles/{id}` | Update article |
| DELETE | `/api/kb-articles/{id}` | Delete article |

#### Responsiveness

- No column hiding configured
- Horizontal scroll on mobile via wrapper

---

### 10. Tasks (Kanban + List)

**Display Name:** "Tasks"

**Module:** `src/features/admin/modules/admin-tasks.ts`

**Location:** Project Detail view > Tasks sub-tab

**Primary View:** Kanban board via `createKanbanBoard()`

**Secondary View:** List view

#### List View Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Title | Text | task title |
| 2 | Priority | Badge | low/medium/high/urgent (task-priority-* class) |
| 3 | Status | Text | task status |
| 4 | Assignee | Text | assigned user |
| 5 | Due Date | Formatted date + icon | "overdue" class if past due |
| 6 | Checklist | Progress | completed/total |

#### Checkboxes and Bulk Actions

- **Has checkboxes:** No
- **No bulk toolbar**

#### Pagination

- **Has pagination:** No

#### Responsiveness

- Kanban view collapses columns on mobile
- List view uses horizontal scroll

---

### 11. Visitors Table (Analytics)

**Display Name:** No heading (appears within Analytics > Visitors sub-tab)

**Module:** `src/features/admin/modules/admin-analytics.ts`

**HTML Source:** `admin/index.html:1365-1373` (static `<thead>`)

**CSS Class:** `.admin-table .visitors-table`

**Location:** Analytics tab > Visitors sub-tab (`#analytics-subtab-visitors`)

#### Table Headers (`<th>` in order)

```text
Session ID | Started | Duration | Pages | Device | Location
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Session ID | Text | Visitor session identifier |
| 2 | Started | Formatted date/time | Session start time |
| 3 | Duration | Formatted time | Session duration |
| 4 | Pages | Number | Pages viewed in session |
| 5 | Device | Text | Device type (desktop/mobile/tablet) |
| 6 | Location | Text | Geographic location |

#### Checkboxes and Bulk Actions

- **Has checkboxes:** No
- **No bulk toolbar**

#### Pagination

- **Has pagination:** No

#### Dropdowns

- None

#### Responsiveness

- No column hiding configured
- Horizontal scroll on mobile via wrapper

---

### 12. Project Detail - Files Sub-Table

**Display Name:** "Files" (within Upload Files for Client section)

**Module:** `src/features/admin/modules/admin-projects.ts`

**HTML Source:** `admin-projects.ts:1143-1149` (dynamically rendered in project detail)

**CSS Class:** `.files-table`

**Location:** Project Detail view > Files sub-tab

#### Table Headers (`<th>` in order)

```text
File | Size | Uploaded | Actions
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | File | Text + icon | original_filename with file type icon |
| 2 | Size | Formatted size | `formatFileSize()` output |
| 3 | Uploaded | Formatted date | upload timestamp |
| 4 | Actions | Icon buttons | Download, Delete |

#### Checkboxes and Bulk Actions

- **Has checkboxes:** No
- **No bulk toolbar**

#### Pagination

- **Has pagination:** No

---

### 13. Project Detail - Invoices Sub-Table

**Display Name:** "Invoices" (within project detail)

**Module:** `src/features/admin/modules/admin-projects.ts`

**HTML Source:** `admin-projects.ts:1592-1600` (dynamically rendered in project detail)

**CSS Class:** `.invoices-table` (nested in project detail)

**Location:** Project Detail view > Invoices sub-tab

#### Table Headers (`<th>` in order)

```text
Invoice # | Amount | Due Date | Status | Actions
```

#### Columns (in order)

| # | Column | Data Type | Notes |
|---|--------|-----------|-------|
| 1 | Invoice # | Text | invoice_number |
| 2 | Amount | Currency | `Intl.NumberFormat` formatted |
| 3 | Due Date | Formatted date | due_date |
| 4 | Status | Badge | paid/pending/overdue |
| 5 | Actions | Icon buttons | View, Edit |

#### Checkboxes and Bulk Actions

- **Has checkboxes:** No
- **No bulk toolbar**

#### Pagination

- **Has pagination:** No

---

## Client Portal Tables

### 14. Portal Invoices

**File:** `src/features/client/modules/portal-invoices.ts`

- Client-facing invoice list (read-only view of their invoices)
- Simplified columns, no bulk actions, no checkboxes

### 15. Portal Projects

**File:** `src/features/client/modules/portal-projects.ts`

- Client-facing project list (status, progress)
- No bulk actions, no checkboxes

### 16. Portal Files

**File:** `src/features/client/modules/portal-files.ts`

- Client-facing file list (download, view)
- No bulk actions, no checkboxes

### 17. Portal Document Requests

**File:** `src/features/client/modules/portal-document-requests.ts`

- Client-facing document requests (upload, view status)
- No bulk actions, no checkboxes

### 18. Proposal Comparison Table

**File:** `src/features/client/proposal-builder-ui.ts`

**CSS Class:** `.comparison-table`

- Static HTML table comparing proposal tiers (good/better/best)
- Feature comparison rows with pricing
- No interactivity (read-only)
- No checkboxes, no pagination, no filters

---

## Styling and Responsiveness

### CSS Variables Used for Tables

#### Colors

- `--portal-bg-dark` - Dark background for table/header
- `--portal-bg-medium` - Medium shade background
- `--portal-bg-darker` - Darkest shade for controls
- `--portal-text-light` - Light text (primary content)
- `--portal-text-secondary` - Secondary text (headers, labels)
- `--portal-text-muted` - Muted text (tertiary content)
- `--portal-border-medium` - Medium border color
- `--portal-border-dark` - Dark border color
- `--color-primary` - Brand color (accents, active states)
- `--color-error-500` - Error/hover link color

#### Spacing

- `--space-1` - 4px
- `--space-2` - 8px
- `--space-3` - 12px
- `--space-4` - 16px
- `--space-8` - 32px
- `--portal-spacing-sm` / `--portal-spacing-md` / `--portal-spacing-lg` / `--portal-spacing-xl`

#### Border Radius

- `--portal-radius-sm` - 4px
- `--portal-radius-md` - 8px
- `--portal-radius-lg` - 12px
- `--border-radius-card` - 4px

### Table Cell Styling

| Property | Desktop | Mobile (<480px) |
|----------|---------|-----------------|
| Cell Padding | `var(--space-3) var(--space-4)` (12px 16px) | `var(--space-2) var(--space-3)` (8px 12px) |
| Row Height | 48px min | 48px min |
| Header Font | 0.75rem uppercase, 500 weight, 0.05em spacing | Same |
| Body Font | `var(--font-size-sm)` (~14px) | Same |
| Header Background | `var(--portal-bg-dark)` | Same |
| Row Hover | `rgba(255, 255, 255, 0.08)` | Same |
| Row Active | `rgba(255, 255, 255, 0.1)` | Same |
| Borders | 1px solid `var(--portal-border-medium)` header only | Same |
| Card Shadow | `var(--shadow-panel)` | Same |
| Checkbox Column Width | 56px | Hidden on small mobile |
| Identity Cell Min-Width | 180px | Auto |
| Message Cell Max-Width | 200px (with ellipsis) | Same |

### Responsive Breakpoints

```text
BREAKPOINT MAP
-------------------------------------------------------------
  320    480    640    768    992    1024   1200   1400   1536
   |      |      |      |      |      |      |      |      |
   |  xs  |  sm  |  md  |      |  lg  |      |  xl  | 2xl  |
   |      |      |      |      |      |      |      |      |
   |------|      |      |      |      |      |      |      |
   |small |      |      |      |      |      |      |      |
   |mobile|      |      |      |      |      |      |      |
   |      |------|      |      |      |      |      |      |
   |      |compact      |      |      |      |      |      |
   |      |mobile|      |      |      |      |      |      |
   |      |      |------|      |      |      |      |      |
   |      |      |mobile|      |      |      |      |      |
   |      |      |      |------+------|      |      |      |
   |      |      |      |tablet|tablet|      |      |      |
   |      |      |      |      | down |      |      |      |
   |      |      |      |      |      |------+------+------|
   |      |      |      |      |      |     desktop         |
```

#### Custom Media Queries Used

- `--small-mobile` - max-width: 479px
- `--compact-mobile` - max-width: 600px
- `--mobile` - max-width: 767px
- `--tablet` - min-width: 768px
- `--tablet-only` - 768px to 991px
- `--tablet-down` - max-width: 991px
- `--desktop` - min-width: 992px
- `--desktop-down` - max-width: 1023px

### Column Hiding per Table (Mobile <480px)

| Table | Hidden Columns | Visible Columns |
|-------|---------------|-----------------|
| Leads | Company (3), Email (4) | Checkbox, Project, Lead(name), Type, Budget, Status, Date, Actions |
| Clients | Email (4), Created (8) | Checkbox, Client, Type, Projects, Status, Actions |
| Contacts | Company (4) | Contact, Message, Status, Date |
| Projects | Type (3), Timeline (5), Start (6), End (7) | Checkbox, Project, Budget, Status |
| Invoices | None configured | All columns (horizontal scroll) |
| Proposals | None configured | All columns (horizontal scroll) |
| Time Tracking | None configured | All columns (horizontal scroll) |
| Document Requests | None configured | All columns (horizontal scroll) |
| Knowledge Base | None configured | All columns (horizontal scroll) |
| Visitors | None configured | All columns (horizontal scroll) |
| Project Files | None configured | All columns (horizontal scroll) |
| Project Invoices | None configured | All columns (horizontal scroll) |

### Mobile-Specific Behavior

- **No card/list transformation** - Tables remain as tables; columns hide instead
- **Horizontal scroll** enabled via `.admin-table-scroll-wrapper` with `overflow-x: auto`
- **iOS momentum scrolling** via `-webkit-overflow-scrolling: touch`
- **Scroll gradient indicator** on right edge (fades when not scrollable)
- **Min-width:** 800px desktop, 400px mobile
- **Pagination hides:** Page size selector and page number buttons on mobile (<768px)
- **Bulk toolbar:** Changes from grid to flex-column layout on mobile
- **Title variants:** `.title-full` hidden / `.title-mobile` shown on mobile
- **Checkbox column:** Hidden on small mobile
- **Filter controls:** Wrap to full width, search expands to fill row

### CSS File Locations

| File | Purpose | Approx Lines |
|------|---------|-------------|
| `src/styles/pages/admin.css` | Main table + admin page styles | ~2922 |
| `src/styles/admin/table-features.css` | Pagination, bulk actions, export | ~410 |
| `src/styles/shared/portal-cards.css` | Card/stat grid layouts | - |
| `src/styles/shared/portal-layout.css` | Layout and spacing | - |
| `src/styles/shared/portal-components.css` | Shared components | - |
| `src/styles/shared/portal-dropdown.css` | Portal dropdown styles | - |
| `src/styles/variables.css` | CSS variables + breakpoints | - |
| `src/design-system/tokens/breakpoints.css` | Responsive utility classes | - |
| `src/design-system/tokens/colors.css` | Color system | - |

---

## Comparison Matrix

### Feature Support by Table

| Feature | Leads | Clients | Contacts | Projects | Invoices | Proposals | Time | Doc Requests | KB | Visitors |
|---------|:-----:|:-------:|:--------:|:--------:|:--------:|:---------:|:----:|:------------:|:--:|:--------:|
| Checkboxes | Yes | Yes | No | Yes | Yes | Yes | No | Yes | No | No |
| Bulk Actions | Yes (3) | Yes (2) | No | Framework | No | Yes (1) | No | Yes (2) | No | No |
| Pagination | Yes | Yes | Yes | Yes | No | No | No | No | No | No |
| Search | Yes | Yes | Yes | Yes | No | Yes | No | Yes | Yes | No |
| Status Filter | Yes | Yes | Yes | Yes | No | Yes | No | Yes | No | No |
| Date Filter | Yes | Yes | Yes | Yes | No | No | No | No | No | No |
| Sortable Cols | Yes | Yes | Yes | Yes | No | No | No | Yes | Yes | No |
| Status Dropdown | Yes | No | Yes | Yes | No | Yes | No | No | No | No |
| CSV Export | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes | Yes | No |
| Row Click Nav | Yes | Yes | Yes | Yes | No | No | No | No | No | No |
| Dual View | Yes (Kanban) | No | No | No | No | No | No | No | No | No |
| Identity Cell | Yes | Yes | Yes | Yes | No | No | No | No | No | No |
| Email Copy | Yes | Yes | Yes | No | No | No | No | No | No | No |
| Column Hiding | Yes | Yes | Yes | Yes | No | No | No | No | No | No |

### Pagination Details

| Table | Has Pagination | Default Size | Size Options | Storage Key |
|-------|:--------------:|:------------:|:------------:|-------------|
| Leads | Yes | 25 | 10, 25, 50, 100 | `admin_leads_pagination` |
| Clients | Yes | 25 | 10, 25, 50, 100 | `admin_clients_pagination` |
| Contacts | Yes | 25 | 10, 25, 50, 100 | `admin_contacts_pagination` |
| Projects | Yes | 25 | 10, 25, 50, 100 | `admin_projects_pagination` |
| Invoices | No | - | - | - |
| Proposals | No | - | - | - |
| Time Tracking | No | - | - | - |
| Doc Requests | No | - | - | - |
| Knowledge Base | No | - | - | - |

### All Backend API Endpoints

#### Leads

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/leads` | Load all leads with stats |
| PUT | `/api/leads/{id}` | Update single lead |
| POST | `/api/admin/leads/:id/status` | Update single lead status |
| POST | `/api/admin/leads/:id/assign` | Assign lead to user |
| POST | `/api/admin/leads/:id/move-stage` | Move lead to pipeline stage |
| POST | `/api/admin/leads/bulk/status` | Bulk update status |
| POST | `/api/admin/leads/bulk/assign` | Bulk assign leads |
| POST | `/api/admin/leads/bulk/move-stage` | Bulk move to stage |
| POST | `/api/leads/{id}/convert-to-project` | Convert to project |
| GET | `/api/admin/leads/:id/duplicates` | Find duplicate leads |
| GET | `/api/admin/leads/duplicates` | Get all pending duplicates |
| POST | `/api/admin/leads/duplicates/:id/resolve` | Resolve duplicate |
| GET | `/api/admin/leads/analytics` | Get lead analytics |
| GET | `/api/admin/leads/conversion-funnel` | Get conversion funnel |
| GET | `/api/admin/leads/source-performance` | Get source performance |
| GET | `/api/admin/leads/scoring-rules` | Get scoring rules |
| POST | `/api/admin/leads/scoring-rules` | Create scoring rule |
| PUT | `/api/admin/leads/scoring-rules/:id` | Update scoring rule |
| DELETE | `/api/admin/leads/scoring-rules/:id` | Delete scoring rule |
| POST | `/api/admin/leads/:id/calculate-score` | Calculate lead score |
| POST | `/api/admin/leads/recalculate-all` | Recalculate all scores |
| GET | `/api/admin/leads/pipeline/stages` | Get pipeline stages |
| GET | `/api/admin/leads/pipeline` | Get pipeline data |
| GET | `/api/admin/leads/pipeline/stats` | Get pipeline statistics |
| GET | `/api/admin/leads/my-leads` | Get assigned leads |
| GET | `/api/admin/leads/unassigned` | Get unassigned leads |
| POST | `/api/admin/leads/:id/tasks` | Add task |
| GET | `/api/admin/leads/:id/tasks` | Get tasks |
| POST | `/api/admin/leads/:id/notes` | Add note |
| GET | `/api/admin/leads/:id/notes` | Get notes |

#### Contacts

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/contact-submissions` | Get all contact submissions |
| PUT | `/api/admin/contact-submissions/{id}` | Update contact status |
| POST | `/api/admin/convert-contact-to-client` | Convert contact to client |

#### Clients

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/clients` | Get all clients |
| GET | `/api/clients/{id}` | Get single client |
| POST | `/api/clients` | Create client |
| PUT | `/api/clients/{id}` | Update client |
| DELETE | `/api/clients/{id}` | Delete client |
| GET | `/api/clients/{id}/projects` | Get client projects |
| GET | `/api/clients/{id}/invoices` | Get client invoices |
| PUT | `/api/admin/clients/{id}/billing` | Update billing info |
| POST | `/api/admin/clients/{id}/send-invitation` | Send invitation |
| POST | `/api/admin/clients/bulk/archive` | Bulk archive |
| DELETE | `/api/admin/clients/bulk/delete` | Bulk delete |

#### Projects

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/projects` | Get all projects |
| POST | `/api/admin/projects` | Create project |
| GET | `/api/admin/projects/{id}` | Get single project |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project |
| POST | `/api/projects/{id}/milestones` | Add milestone |
| DELETE | `/api/projects/{id}/files/{fileId}` | Delete file |

#### Invoices

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/invoices` | Get all invoices |
| POST | `/api/invoices` | Create invoice |
| GET | `/api/invoices/{id}` | Get single invoice |
| PUT | `/api/invoices/{id}` | Update invoice |
| DELETE | `/api/invoices/{id}` | Delete invoice |

#### Proposals

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/proposals` | Load proposals |
| PUT | `/api/proposals/{id}` | Update proposal |
| DELETE | `/api/proposals/{id}` | Delete proposal |

#### Document Requests

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/document-requests` | Load requests |
| POST | `/api/document-requests/{id}/review` | Start review |
| PUT | `/api/document-requests/{id}` | Update (status, notes) |
| POST | `/api/document-requests/{id}/remind` | Send reminder |
| DELETE | `/api/document-requests/{id}` | Delete request |
| POST | `/api/document-requests/bulk/remind` | Send bulk reminders |

#### Knowledge Base

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/kb-categories` | Load categories |
| GET | `/api/kb-articles` | Load articles |
| PUT | `/api/kb-categories/{id}` | Update category |
| DELETE | `/api/kb-categories/{id}` | Delete category |
| PUT | `/api/kb-articles/{id}` | Update article |
| DELETE | `/api/kb-articles/{id}` | Delete article |

---

## Shared vs Custom Components

### Fully Shared (reusable utilities)

- `createFilterUI()` - Search, status filter, date range
- `createPaginationUI()` - Page controls + per-page dropdown
- `createBulkActionToolbar()` - Selection + action buttons
- `createTableDropdown()` - Status dropdown in cells
- `createSortableHeaders()` - Column header sort behavior
- `exportToCsv()` / `exportToJson()` - Data export
- `getStatusBadgeHTML()` - Status badge rendering
- `getPortalCheckboxHTML()` - Custom checkbox
- `getEmailWithCopyHtml()` - Email with copy button
- `showTableLoading()` / `showTableEmpty()` / `showTableError()` - State displays
- `confirmDialog()` / `confirmDanger()` / `multiPromptDialog()` - Confirmation dialogs

### Custom Per Table

- **HTML table structure** (columns, row rendering) - Each module builds its own
- **Column definitions** - Hardcoded in each module's render function
- **Row click handlers** - Custom per module
- **Action button configurations** - Custom per module
- **Filter/Pagination/Bulk config objects** - Custom per module but use shared interfaces

### Pre-Configured Export Configs

| Config Constant | Module | Exported Columns |
|----------------|--------|-----------------|
| `CLIENTS_EXPORT_CONFIG` | Clients | ID, Contact Name, Email, Company, Type, Phone, Status, Projects, Health Score, Created, Billing fields |
| `LEADS_EXPORT_CONFIG` | Leads | ID, Contact Name, Email, Company, Project Type, Budget, Timeline, Status, Source, Phone, Description, Features, Lead Score, Created |
| `PROJECTS_EXPORT_CONFIG` | Projects | ID, Name, Client, Company, Type, Status, Budget, Timeline, Start, End, Created |
| `CONTACTS_EXPORT_CONFIG` | Contacts | ID, Name, Email, Company, Phone, Status, Message, Created |
| `INVOICES_EXPORT_CONFIG` | Invoices | ID, Invoice Number, Client, Project, Status, Total Amount, Due Date, Paid Date, Created |
| `PROPOSALS_EXPORT_CONFIG` | Proposals | ID, Client Name, Company, Email, Project Name, Type, Tier, Final Price, Status, Maintenance, Created |
| `DOCUMENT_REQUESTS_EXPORT_CONFIG` | Doc Requests | ID, Title, Client, Type, Status, Due Date, Created |
| `KNOWLEDGE_BASE_EXPORT_CONFIG` | Knowledge Base | ID, Title, Category, Slug, Featured, Published, Updated |

### State Management Pattern

All tables follow the same state pattern:

- **Data:** Module-level variable (e.g., `leadsData`, `clientsData`)
- **Filter state:** `FilterState` object persisted to localStorage
- **Pagination state:** `PaginationState` object, pageSize persisted to localStorage
- **Selection state:** In-memory via `getSelectionState(tableId)`
- **View preference:** localStorage (leads only - table vs pipeline)

### Loading / Empty / Error States

- `showTableLoading(container, colCount, message)` - Spinner while fetching
- `showTableEmpty(container, colCount, message)` - "No items found" message
- `showTableError(container, colCount, message)` - Error message display
- Loading row: centered, italic, 32px padding
- Pagination buttons disabled at boundaries
- Action buttons disabled during async operations

### Accessibility

- Checkboxes: `aria-label="Select all rows"`, `aria-label="Select row"`
- Dropdowns: `aria-label="Change status, current: {value}"`
- Buttons: `aria-label="View"`, `aria-label="Edit"`, etc.
- Pagination: `aria-label="Page X"`, `aria-label="Go to first page"`, etc.
- Escape key closes dropdowns and modals
- Enter key on search closes search dropdown
- Tab navigation through pagination and action buttons

### Server-Side vs Client-Side

- **All pagination:** Client-side only (backend returns all data at once)
- **All filtering:** Client-side only
- **All sorting:** Client-side only
- **Bulk operations:** Server-side endpoints exist for status updates, archive, delete
- **No server-side pagination, filtering, or sorting**

---

## Cross-Table Consistency Analysis

This section documents every inconsistency between tables and recommends changes to make the portal cohesive. Intentional differences (e.g., no checkboxes on Contacts because bulk actions aren't needed for form submissions) are noted as such and excluded from recommendations.

### Tier 1: Shared Infrastructure Adoption Gap

Three tables completely bypass all shared table utilities. This is the single biggest consistency problem.

| Table | `table-filter.ts` | `table-pagination.ts` | `table-bulk-actions.ts` | `table-export.ts` | `createSortableHeaders` |
|-------|:-:|:-:|:-:|:-:|:-:|
| Leads | Yes | Yes | Yes | **No** (button exists, no handler) | Yes |
| Clients | Yes | Yes | Yes | Yes | Yes |
| Contacts | Yes | Yes | No (intentional) | Yes | Yes |
| Projects | Yes | Yes | Yes | Yes | Yes |
| **Invoices** | **No** | **No** | **No** (orphaned checkbox) | **No** (custom CSV) | **No** |
| **Proposals** | **No** (custom buttons) | **No** | Yes (partial) | Yes | **No** |
| **Time Tracking** | **No** | **No** | No (intentional) | **No** (custom CSV) | **No** |
| Document Requests | Yes | No | Yes | Yes | Yes |
| Knowledge Base | Yes | No | No (intentional) | Yes | Yes |

**Concern:** Invoices, Proposals, and Time Tracking were built independently of the shared table system. They lack search, sortable headers, filter persistence, and standardized pagination that the other tables have.

**Recommendations:**

- [ ] **Invoices:** Adopt `table-filter.ts` (add `INVOICES_FILTER_CONFIG` with search by invoice_number, client_name, project_name; status filter for draft/sent/paid/overdue; date filter on due_date; sortable columns). Adopt `table-pagination.ts`. Wire the existing `export-invoices-btn` to use shared `exportToCsv()`. Remove orphaned checkbox or wire bulk toolbar.
- [ ] **Proposals:** Replace custom segmented filter buttons with `createFilterUI()` for consistency, or at minimum add `createSortableHeaders()` for column sorting. Add `table-pagination.ts` if proposal count grows.
- [ ] **Time Tracking:** Add `createSortableHeaders()` for column sorting (Date, Duration at minimum). Consider adding search.

---

### Tier 2: Toolbar Button Order Inconsistency

Buttons in the `.admin-table-actions` toolbar appear in different orders across tables. Users should see buttons in the same predictable position on every table.

#### Current Button Order (left to right, per table)

```text
Leads:          View Toggle → Export → Refresh
Contacts:       Export → Refresh
Projects:       Add → Export → Refresh
Clients:        Add → Export → Refresh
Invoices:       Create → Export → Refresh
Doc Requests:   Export → Add → Refresh          ← Add is AFTER Export
KB Categories:  Add → Refresh                   ← Missing Export
KB Articles:    Export → Add → Refresh           ← Add is AFTER Export
Proposals:      Filters → Search → Export → Refresh (entirely custom layout)
```

#### Issues

| Issue | Tables Affected |
|-------|----------------|
| **Add/Create button position varies**: first in some, second in others | Doc Requests, KB Articles put Add AFTER Export |
| **KB Categories missing Export** | KB Categories |
| **Add button verb inconsistent**: "Add Project" vs "Create Invoice" vs "New request" vs "Add category" | All tables with Add button |
| **Icon wrapper inconsistent**: some use `<span class="icon-btn-svg">`, others put SVG directly in button | Doc Requests, KB use wrapper; Leads, Clients, Projects, Invoices do not |
| **Proposals uses entirely different toolbar pattern** | Proposals (filter buttons + text "Refresh" button instead of icon) |

#### Standard Button Order (Approved)

All tables follow this order when buttons are present. Omit buttons that don't apply, but never reorder:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Search  │  Filter  │  View Toggle  │  Export  │  Refresh  │  Add/Create    │
│  (find   │  (refine │  (if dual     │  (CSV    │  (always  │  (primary CTA, │
│   data)  │   data)  │   view)       │   export)│   present)│   last/right)  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Position order: **1. Search → 2. Filter → 3. View Toggle → 4. Export → 5. Refresh → 6. Add**

Flow logic: **find → refine → view → act → create**

#### Changes Required

| Table | Current Order | Change Needed |
|-------|--------------|---------------|
| Leads | View Toggle → Export → Refresh | **Move Search and Filter before View Toggle** (injected by JS — verify DOM order) |
| Contacts | Export → Refresh | **No change** (no Add, no View Toggle) |
| Projects | Add → Export → Refresh | **Move Add to LAST position** (after Refresh) |
| Clients | Add → Export → Refresh | **Move Add to LAST position** (after Refresh) |
| Invoices | Create → Export → Refresh | **Move Add to LAST position** + rename to "Add Invoice" |
| Doc Requests | Export → Add → Refresh | **Move Add to LAST position** (after Refresh) |
| KB Categories | Add → Refresh | **Move Add to LAST position** (after Refresh) |
| KB Articles | Export → Add → Refresh | **Move Add to LAST position** (after Refresh) |
| Proposals | Custom layout | Migrate to standard toolbar pattern, Add last |

#### Add Button Verb Standardization

All "create new item" buttons should use the same verb pattern: **"Add {entity}"**

| Table | Current Title | Recommended Title |
|-------|--------------|-------------------|
| Projects | "Add Project" | No change |
| Clients | "Add Client" | No change |
| Invoices | "Create Invoice" | **"Add Invoice"** |
| Doc Requests | "New request" | **"Add Request"** |
| KB Categories | "Add category" | **"Add Category"** (capitalize) |
| KB Articles | "Add article" | **"Add Article"** (capitalize) |

#### Icon Wrapper Standardization

All toolbar buttons should use the same inner structure. Currently two patterns exist:

```html
<!-- Pattern A (Leads, Clients, Projects, Invoices): SVG directly in button -->
<button class="icon-btn" id="export-leads-btn" title="Export to CSV">
  <svg ...></svg>
</button>

<!-- Pattern B (Doc Requests, KB): SVG wrapped in span -->
<button type="button" class="icon-btn" id="dr-export" title="Export to CSV">
  <span class="icon-btn-svg"><svg ...></svg></span>
</button>
```

**Recommendation:** Standardize on Pattern B (`icon-btn-svg` wrapper). It provides a consistent hook for icon styling and is already used by newer tables.

---

### Tier 3: Dead/Orphaned UI Elements

These are buttons or features that exist in the HTML but have no functional handler.

| Issue | Location | Details |
|-------|----------|---------|
| **Leads export button has no handler** | `admin/index.html:446` (`#export-leads-btn`) | Button renders but `admin-leads.ts` never imports `exportToCsv` or references the button ID. Despite `LEADS_EXPORT_CONFIG` existing in `table-export.ts`, it is never used. |
| **Invoices checkbox column has no bulk toolbar** | `admin/index.html:758-761` | Checkbox `<th>` and per-row checkboxes render, but no bulk toolbar container exists and no bulk actions are wired. Selecting rows does nothing. |

**Recommendations:**

- [ ] **Leads:** Wire `#export-leads-btn` to `exportToCsv(filteredLeads, LEADS_EXPORT_CONFIG)` in `admin-leads.ts`, matching the pattern used in `admin-clients.ts:358-363`.
- [ ] **Invoices:** Either remove the checkbox column from the HTML and CSS, or add a bulk toolbar with actions (e.g., Bulk Mark Paid, Bulk Send, Bulk Delete).

---

### Tier 4: Feature Parity Gaps

Features that some tables have and others reasonably should.

#### Pagination

| Table | Has Pagination | Row Count Likely to Need It |
|-------|:-:|---|
| Leads | Yes | Yes (can grow) |
| Clients | Yes | Yes |
| Contacts | Yes | Yes |
| Projects | Yes | Yes |
| Invoices | **No** | **Yes** (invoices accumulate over time) |
| Proposals | **No** | Possibly (depends on volume) |
| Document Requests | **No** | **Yes** (will accumulate) |
| Knowledge Base | **No** | Lower priority |

**Recommendations:**

- [ ] **Invoices:** Add pagination. Invoices accumulate indefinitely; rendering all at once will degrade performance.
- [ ] **Document Requests:** Add pagination for the same reason.

#### Search and Sortable Headers

| Table | Search | Sortable Headers | Should Have Both |
|-------|:-:|:-:|---|
| Leads | Yes | Yes | - |
| Clients | Yes | Yes | - |
| Contacts | Yes | Yes | - |
| Projects | Yes | Yes | - |
| Invoices | **No** | **No** | **Yes** - users need to find specific invoices by number, client, amount |
| Proposals | Custom search | **No** | Sorting by price/date would be useful |
| Time Tracking | **No** | **No** | Sorting by date/duration would be useful |
| Document Requests | Yes | Yes | - |
| Knowledge Base | Yes | Yes | - |

**Recommendations:**

- [ ] **Invoices:** Add search (by invoice number, client name, project name) and sortable headers (amount, due date, status).
- [ ] **Proposals:** Add `createSortableHeaders()` for column sorting.
- [ ] **Time Tracking:** Add sortable headers for Date and Duration columns.

#### Date Range Filter

| Table | Has Date Filter |
|-------|:-:|
| Leads | Yes |
| Clients | Yes |
| Contacts | Yes |
| Projects | Yes |
| Invoices | **No** |
| Document Requests | **No** |

**Recommendations:**

- [ ] **Invoices:** Add date range filter (on `due_date`) - critical for filtering to specific billing periods.
- [ ] **Document Requests:** Add date range filter (on `due_date` or `created_at`).

---

### Tier 5: HTML Structure Inconsistencies

These are naming and structural inconsistencies in `admin/index.html`.

#### Tbody ID Naming

Two patterns exist:

```text
CONSISTENT:   {entity}-table-body     (leads, contacts, projects, clients, invoices, visitors)
INCONSISTENT: {prefix}-tbody          (dr-tbody, kb-categories-tbody, kb-articles-tbody)
```

**Recommendation:**

- [ ] Rename `dr-tbody` to `document-requests-table-body`.
- [ ] Rename `kb-categories-tbody` to `kb-categories-table-body`.
- [ ] Rename `kb-articles-tbody` to `kb-articles-table-body`.
- [ ] Update all TypeScript references to match.

#### Card and Container ID Naming

```text
leads:              intake-submissions-card    (uses display name, not entity name)
clients:            clients-table-card
invoices:           invoices-table-card
projects:           projects-card              (missing "-table" suffix)
document requests:  (no card ID)
KB:                 (no card ID)
visitors:           (no card class at all)
```

**Recommendation:**

- [ ] Standardize all card IDs to `{entity}-table-card`.
- [ ] Add `.admin-table-card` class to Visitors table container.
- [ ] Add card IDs to Document Requests and Knowledge Base.

#### Missing Loading Rows

Document Requests, KB Categories, and KB Articles have empty `<tbody>` elements with no initial loading row.

**Recommendation:**

- [ ] Add `<tr><td colspan="N" class="loading-row">Loading...</td></tr>` to Document Requests, KB Categories, and KB Articles tbody elements.

---

### Tier 6: Empty State Message Inconsistencies

Current messages vary in tone, specificity, and helpfulness:

| Table | Empty State Message |
|-------|-------------------|
| Leads | "No leads yet. New form submissions will appear here." |
| Clients | "No clients yet." |
| Contacts | "No contact form submissions yet." |
| Projects (none) | "No projects yet. Convert leads to start projects." |
| Projects (filtered) | "No projects match the current filters. Try adjusting your filters." |
| Invoices | "No invoices found" |
| Proposals | "No proposals found" |
| Time Tracking | "No time entries yet. Log your first entry above." |
| Document Requests | "No document requests match the filter." |
| KB Categories | "No categories yet. Add one to get started." |
| KB Articles | "No articles yet. Add one to get started." |

**Pattern recommendation:** All tables should follow the same two-state pattern:

1. **No data at all:** "No {entity} yet." + optional guidance
2. **No filtered results:** "No {entity} match the current filters."

**Recommendations:**

- [ ] Standardize "no data" messages: "No {entity} yet." with optional next-step guidance.
- [ ] Standardize "no filter results" messages: "No {entity} match the current filters."
- [ ] Add filtered-empty states to tables that only have a single empty message (Invoices, Proposals).

---

### Tier 7: Loading State Inconsistencies

| Table | Uses `showTableLoading()` | Uses `showTableEmpty()` |
|-------|:-:|:-:|
| Leads | **No** (manual HTML) | Yes |
| Clients | Yes | Yes |
| Contacts | **No** | Yes |
| Projects | Yes | Yes |
| Invoices | Yes | Yes |
| Proposals | **No** (manual `loading-row` HTML) | **No** (manual HTML) |
| Time Tracking | **No** | **No** |
| Document Requests | Yes | Yes |
| Knowledge Base | Yes | Yes |

**Recommendations:**

- [ ] **Leads:** Replace manual loading HTML with `showTableLoading()`.
- [ ] **Contacts:** Add `showTableLoading()` before fetch.
- [ ] **Proposals:** Replace manual `loading-row` HTML with `showTableLoading()`.
- [ ] **Time Tracking:** Add `showTableLoading()` and `showTableEmpty()`.

---

### Tier 8: DOM Caching Inconsistencies

Only 2 of 9 modules use the shared `createDOMCache()` utility:

| Table | Uses `createDOMCache()` | DOM Access Pattern |
|-------|:-:|---|
| Clients | Yes | `domCache.get('key')` |
| Projects | Yes | `domCache.get('key')` with `batchUpdateText` |
| Leads | No | Simple `Map<string, HTMLElement>` |
| Contacts | No | Simple `Map` |
| Proposals | No | `getElement()` helper (simple Map) |
| Invoices | No | Direct `document.getElementById()` |
| Time Tracking | No | Direct `document.getElementById()` |
| Document Requests | No | `el()` helper function |
| Knowledge Base | No | `el()` helper function |

**Pattern:** Three different approaches exist (createDOMCache, custom Map wrappers, direct getElementById). The `el()` helper used by Document Requests and Knowledge Base is a third pattern.

**Recommendation:**

- [ ] Standardize on `createDOMCache()` for all modules, or at minimum use the same helper function pattern. Not blocking but improves maintainability.

---

### Tier 9: Export Config Inconsistencies

#### Data Key Naming Convention

```text
STANDARD (snake_case):  contact_name, company_name, project_type, created_at
PROPOSALS (camelCase):  projectType, selectedTier, finalPrice, createdAt
PROPOSALS (nested):     client.name, client.company, project.name
```

Proposals is the only module using camelCase data keys and nested object access in its export config. Every other module uses flat snake_case keys.

#### Export Label Inconsistency

The same concept is labeled differently across export configs:

```text
CLIENTS export:   "Contact Name" (from contact_name)
PROJECTS export:  "Client Name"  (from contact_name)
```

**Recommendations:**

- [ ] **Proposals:** Normalize export config data keys to snake_case to match all other modules. Use a data transformer before export if the API returns camelCase.
- [ ] Standardize the label: pick either "Contact Name" or "Client Name" and use it everywhere.

---

### Tier 10: Filter Config Inconsistencies

#### Date Field

All filter configs use `created_at` as the date field except Knowledge Base which uses `updated_at`.

```text
Leads:     dateField: 'created_at'
Contacts:  dateField: 'created_at'
Projects:  dateField: 'created_at'
Clients:   dateField: 'created_at'
DocReqs:   dateField: 'created_at'
KB:        dateField: 'updated_at'  ← Different
```

This is likely intentional (KB articles are more about last update than creation). Document this as intentional.

#### Search Field Naming

Different field names for the same concept:

```text
Name field:    'name' (Contacts, Clients) vs 'contact_name' (Leads, Projects)
Company field: 'company' (Contacts) vs 'company_name' (Leads, Clients)
```

**Recommendation:**

- [ ] **Contacts:** Consider using `contact_name` and `company_name` to match the pattern used by Leads/Clients/Projects. This depends on the actual data key names in the API response.

#### Missing Search Fields

Projects filter config doesn't include `email` in `searchFields` despite having contact email data available. Clients doesn't include `contact_name`.

**Recommendations:**

- [ ] **Projects:** Add `email` or `contact_email` to searchFields.
- [ ] **Clients:** Add `contact_name` to searchFields if the data contains it.

---

### Tier 11: Detail View Pattern Inconsistencies

Four different patterns are used to show row details:

| Pattern | Tables | How It Works |
|---------|--------|---|
| **Side Panel** | Leads, Contacts | Overlay panel slides in from right |
| **Full Tab Switch** | Clients | Switches to `tab-client-detail` (entirely different view) |
| **In-Page Panel Toggle** | Proposals | Hides table, shows detail panel in same area |
| **Modal Dialog** | Document Requests | Opens modal overlay |
| **No Detail View** | Invoices, Time Tracking, KB | Row click does nothing or only action buttons |

**Recommendation:**

- [ ] Pick one primary pattern for detail views and migrate toward it. The side panel pattern (Leads, Contacts) is the most common and least disruptive to table context. Consider it for Document Requests (currently modal) and Proposals (currently in-page toggle).

---

### Tier 12: Stat Cards Inconsistency

Stat cards (clickable filter cards above tables) exist for some tables but not others:

| Table | Has Stat Cards | Card Filters |
|-------|:-:|---|
| Leads | Yes | all, pending, in_progress, completed |
| Projects | Yes | all, active, completed, on_hold |
| Clients | Yes | all, active, pending, inactive |
| Invoices | Yes | all, pending, paid, overdue |
| Contacts | **No** | - |
| Document Requests | **No** | - |
| Knowledge Base | **No** | - |

**Recommendations:**

- [ ] **Contacts:** Add stat cards (All, New, Read, Responded, Archived).
- [ ] **Document Requests:** Add stat cards (All, Requested, Uploaded, Under Review, Approved, Rejected).

---

### Tier 13: localStorage Key Naming

Two patterns exist for storage keys:

```text
STANDARD:      admin_{module}_filter, admin_{module}_pagination
DOCUMENT REQS: admin_document_requests_filter (no pagination key)
KB:            admin_kb_filter (abbreviated, no pagination key)
```

`admin_kb_filter` uses "kb" abbreviation while `admin_document_requests_filter` spells it out. Minor inconsistency.

**Recommendation:**

- [ ] Consider `admin_knowledge_base_filter` for consistency, or document the abbreviation as intentional.

---

### Summary: Priority Order

#### Must Fix (broken/misleading behavior)

1. Wire Leads export button to `exportToCsv()` (dead button)
2. Fix Invoices orphaned checkbox (shows selection UI that does nothing)

#### Should Fix (feature parity gaps)

3. Add search + sortable headers + pagination to Invoices
4. Add sortable headers to Proposals
5. Add pagination to Document Requests
6. Add date range filter to Invoices
7. Add stat cards to Contacts and Document Requests

#### Should Standardize (consistency)

8. Standardize tbody ID naming (`{entity}-table-body`)
9. Standardize empty state messages (two-state pattern)
10. Standardize loading states (use `showTableLoading()` everywhere)
11. Standardize card/container ID naming
12. Normalize Proposals export config to snake_case
13. Add missing loading rows to Document Requests, KB Categories, KB Articles HTML
14. Add `.admin-table-card` class to Visitors table

#### Nice to Have (polish)

15. Standardize DOM caching pattern across modules
16. Add sortable headers to Time Tracking
17. Standardize search field naming across filter configs
18. Standardize detail view pattern (prefer side panel)
