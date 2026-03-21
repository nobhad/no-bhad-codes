# UX Guidelines

**Last Updated:** March 21, 2026

User experience rules and patterns for the portal. These are mandatory and must be followed in all implementations. For CSS implementation details, see [Portal Design](./PORTAL_DESIGN.md). For component API reference, see [Component Library](./COMPONENT_LIBRARY.md).

---

## Table of Contents

1. [Typography](#typography)
2. [Spacing and Layout](#spacing-and-layout)
3. [Status System](#status-system)
4. [Tables](#tables)
5. [Detail Panels](#detail-panels)
6. [Dropdowns](#dropdowns)
7. [Icons](#icons)
8. [Action Buttons](#action-buttons)
9. [Inline Editing](#inline-editing)
10. [Forms](#forms)
11. [Loading and Empty States](#loading-and-empty-states)
12. [Confirmation Dialogs](#confirmation-dialogs)
13. [Notifications](#notifications)
14. [File Uploads](#file-uploads)
15. [Navigation](#navigation)
16. [Dark Mode](#dark-mode)
17. [Responsive Behavior](#responsive-behavior)

---

## Typography

### Heading Tier System

Portal headings follow a 4-tier hierarchy. Never skip tiers.

| Tier | Use | Size | Weight | Example |
|------|-----|------|--------|---------|
| 1 | Page titles | `--font-size-xl` (18px) | Semibold | "PROJECTS", "SETTINGS" |
| 2 | Card/entity titles | `--font-size-lg` (16px) | Regular | "PROJECT DETAILS", "CLIENT" |
| 3 | Section/table headers | `--font-size-base` (15px) | Medium | "RECENT ACTIVITY", "CONTACTS" |
| 4 | Form labels | `--font-size-sm` (14px) | Medium | "EMAIL", "STATUS" |

### Font Families

- **Body text**: `--font-family-mono` (Inconsolata) -- all portal body text
- **Headings**: `--font-family-sans` -- section titles, table headers
- **Display names**: `--font-family-serif` (Cormorant Garamond) -- entity names in detail panels (client names, project titles)

### Text Color Hierarchy

- `--color-text-primary` -- Main content text
- `--color-text-secondary` -- Supporting text, labels
- `--color-text-tertiary` -- Muted text, timestamps, metadata

### Rules

- All text is uppercase in portal UI (via `text-transform: uppercase`)
- Never hardcode font sizes -- use design token variables
- Labels always use Tier 4 styling (`field-label` class)

---

## Spacing and Layout

### Gutter-on-Children Rule

**CRITICAL:** Padding is applied to CHILDREN of containers, never on the wrapper itself. This ensures borders span the full width of the container.

```text
WRONG: .panel { padding: 16px; }
RIGHT: .panel > * { padding: 0 16px; }
```

This applies to: `.dashboard-content`, `.data-table-card`, `.panel`, `.portal-card`, all header rows.

### Layout Hierarchy

| Wrapper | Owner | Padding | Gap |
|---------|-------|---------|-----|
| `.section` | `PortalLayout.tsx` only | 24px top, 16px sides, 64px bottom | `--portal-section-gap` (24px) |
| `.subsection` | Route components | None | `--content-gutter` (16px) |
| `.panel` | Content containers | Children get gutter | `--content-gutter` |

**Rules:**

- `.section` is NEVER used by route components -- only `PortalLayout.tsx`
- Route components use `.subsection` or `<TableLayout>` (defaults to `.subsection`)
- Never nest `.section` inside `.section`

### Content Gutter

`--content-gutter` = 16px. Applied horizontally to content children by the gutter system in `portal-gutter.css`.

---

## Status System

### Status Colors

| Status | Variable | Color | Used For |
|--------|----------|-------|----------|
| New | `--status-new` | Cyan | New leads, fresh items |
| Active / In Progress | `--status-active` | Blue | Active projects, ongoing work |
| Pending | `--status-pending` | Yellow | Awaiting action |
| On Hold | `--status-on-hold` | Orange | Paused items |
| Completed | `--status-completed` | Green | Finished, approved |
| Cancelled | `--status-cancelled` | Red | Cancelled, rejected, lost |
| Qualified | `--status-qualified` | Purple | Qualified leads, in review |
| Inactive | `--status-inactive` | Gray | Disabled, read |

### Display Patterns

- **Status badge** (`.status-badge`): Colored text, no background. Used in tables and cards.
- **Status indicator** (`.status-indicator`): Colored dot + text. Used in dropdown triggers.
- **Status dot**: 6px circle. Used for compact binary indicators (billable, active).

### Rules

- Status colors are semantic -- always use the variable, never hardcode hex values
- Status dropdowns use `<StatusDropdown>` component -- never custom select elements
- All status configs must be defined as `Record<Status, { label: string }>` objects

---

## Tables

### Row Click Behavior

- Clickable rows open a **slide-in detail panel** on click
- Hover shows subtle background change (`--color-bg-hover`)
- Cursor changes to pointer on clickable rows

### Column Patterns

- **Primary cell**: Bold text with optional subtitle (`.primary-cell` > `.cell-title` + `.cell-subtitle`)
- **Date columns**: Use `formatDateShort()`, class `.date-col` for consistent width
- **Currency columns**: Right-aligned, monospace font (`.text-right .mono-text`)
- **Actions column**: Right-aligned, fixed width (`.col-actions`)

### Inline Editing

Tables support inline editing for appropriate fields. See [Inline Editing](#inline-editing).

### Pagination

- Default page size: 25 items
- Page size options: 10, 25, 50, 100
- Pagination persisted to localStorage per table

### Sorting

- Click column header to sort
- Sort direction indicator shows ascending/descending
- Default sort varies by entity (usually date descending)

---

## Detail Panels

### Behavior

- **Open**: Click a table row -- panel slides in from the right
- **Close**: Press Escape, click overlay backdrop, or click close button
- **Overlay**: Blurred backdrop covering the full viewport

### Structure

Every panel follows the same layout:

1. **Header**: Entity type label (h3) + close button
2. **Title row**: Entity name (h1) + status dropdown + action buttons
3. **Subtitle**: Secondary info (e.g., client name under company)
4. **Meta row**: Key metadata fields (Source, Created date)
5. **Tabbed content**: Overview tab + entity-specific tabs

### Rules

- Use the `<DetailPanel>` factory -- never build panels from scratch
- Single-tab panels hide the tab bar automatically
- Actions are right-aligned in the title row
- Use `<MetaGrid>` for overview fields, `<Timeline>` for date sequences

---

## Dropdowns

### Seamless Border Behavior

The trigger and dropdown content must look like ONE continuous bordered box when open. No visible gap or double border at the join edge.

- **Default (closed)**: Border color matches background (`--color-bg-primary`) -- visually borderless
- **Hover**: Border becomes visible (`--color-border-primary`)
- **Open/Active**: Full border around combined trigger+content shape
- **Opens downward**: Trigger hides bottom border, content hides top border (join is seamless)
- **Opens upward**: Trigger hides top border, content hides bottom border (join is seamless)
- **CSS implementation**: Uses `body:has(.portal-dropdown-content[data-side="top"])` to detect upward opening and flip which trigger border is hidden. Content uses `[data-side]` attribute from Radix.
- **Inside tables/panels**: Use thin `1px` border (`--border-width-px`), not the default thicker portal border

### Selection Rules

- **No double representation**: The currently selected value must NEVER appear both in the trigger AND in the dropdown list. Filter it out of the list.
- **Default text**: When no selection is made, show a descriptive placeholder (e.g., "Select type", "Select status") -- never show "None" as the default unless "None" is a meaningful choice the user can toggle back to.
- **"None" option**: Only show a "None" item in the list when a selection exists and the user needs a way to clear it.

### General Rules

- **No shadows** on any portal dropdown -- flat design
- Dropdown content width matches trigger width (seamless connection)
- Caret rotates on open (use `.dropdown-caret` class)
- Content aligns flush with trigger (no gap)
- All selection-style triggers must use `.dropdown-trigger` CSS class
- All selection-style triggers must include a `ChevronDown` caret icon

---

## Icons

### No Emojis

**RULE:** Never use emojis in the UI. Use Lucide icons for all iconography.

### Icon Sizing

Icons use `1em` sizing by default -- parent font-size controls the icon size. Within table action containers, `--portal-btn-icon-size` scopes to `--icon-size-sm` (16px).

---

## Action Buttons

### Universal Icon Button Rules

All icon-only action buttons must use `.icon-btn` class or `<IconButton>` factory component. This ensures:

- Consistent 36px hit area (`--portal-btn-icon-size`)
- Transparent background, no border
- Accent color on hover
- Proper focus ring for accessibility
- Icon sizing controlled by CSS variables

### Button Clusters

- Use `.action-group` class for rows of action buttons
- Gap: `var(--action-btn-gap)` (8px) between adjacent buttons
- Actions right-aligned in headers and title rows (`margin-left: auto`)

### Shared Class Rule

Never create component-prefixed action classes. Use `.action-group` everywhere:

```text
WRONG: .portal-card-actions, .form-actions, .payment-item-actions
RIGHT: .action-group
```

---

## Inline Editing

### When to Use

- **Inline edit**: Simple field changes that don't need context (name, email, phone, priority, date)
- **Modal/page edit**: Complex changes needing multiple fields or validation

### Behavior

- **Click cell**: Switches to edit mode with input field
- **Enter**: Saves the value
- **Escape**: Cancels editing, reverts to original value
- **Blur**: Saves (for text fields) or cancels (for selects)

### Components

- `<InlineEdit>` -- text, date fields
- `<InlineSelect>` -- dropdown selection
- `<InlineTextarea>` -- multi-line text

---

## Forms

### Password Fields

**RULE:** All password input fields must include a visibility toggle button (show/hide password).

### Label Styling

All form labels use the `.field-label` class: uppercase, small font, secondary color, wider letter-spacing.

### Validation

- Error messages appear below the field in red (`--color-danger`)
- Required fields show red asterisk after label
- Validate on blur, not on keystroke

---

## Loading and Empty States

### Loading Patterns

| Pattern | When to Use |
|---------|------------|
| Skeleton rows | Table data loading (use `<PortalTableLoading>`) |
| Spinner | Async operations, button loading state |
| Loading text | Page-level loading ("Loading settings...") |

### Empty States

Use `<EmptyState>` component. Never create component-specific empty state classes.

| Modifier | Use |
|----------|-----|
| Default | Standard centered empty message |
| `--compact` | Inline contexts (kanban columns, small panels) |
| `--full` | Fill available flex space (split-pane layouts) |

---

## Confirmation Dialogs

### When to Use

Only for **destructive or irreversible actions**:

- Deleting items
- Cancelling active processes
- Overwriting existing data
- Bulk operations on multiple items

### Layout

- Title + description explaining consequences
- Cancel button (left) + Confirm button (right)
- Destructive confirms use danger variant (red)
- Use `<ConfirmDialog>` + `useConfirmDialog()` hook

### Rules

- Never use confirmation for non-destructive actions (save, create, send)
- Dialog must explain what will happen, not just ask "Are you sure?"

---

## Notifications

### Toast Notifications

- Position: fixed top-right
- Auto-dismiss after timeout
- Types: success, error, info, warning
- No shadows (flat design, border only)

### Rules

- Success: show briefly for completed actions
- Error: show with retry action when possible
- Never use alerts/modals for notifications -- always toast

---

## File Uploads

### No Dropzones on Mobile

**RULE:** On mobile/touch devices, file upload areas must never show a drag-and-drop dropzone.

**Show instead:** Upload button + file type/size hints.

**Hide on mobile:** Dashed border container, "Drag and drop" text, upload icon.

**Implementation:** CSS handles this automatically via `@media (--mobile)` rules in `portal-files.css`.

**Applies to:** All file upload areas (client files, document requests, avatars, attachments, admin files).

---

## Navigation

### Sidebar

- Collapsible: full width (with labels) or icon-only (56px)
- Active item: accent color text + left border indicator
- Hover: text color changes to accent
- Collapse state persisted to localStorage

### Breadcrumbs

- Single row, inline with header
- Format: `DASHBOARD > WORK > PROJECTS`
- Clickable segments navigate to parent routes

### Subtabs

- Admin hub pages (Work, CRM, Documents, etc.) have subtab groups
- Client portal pages do not have subtabs
- Subtabs rendered by `PortalLayout.tsx` via `<PortalSubtabs>`
- Route components with internal tabs (Settings, Detail pages) use `<TabList>` inside their `.subsection`

### View All Links

When an overview/summary section links to a full detail tab, use the established "View All" pattern:

- **Class**: `panel-action` on a `<button>` element
- **Icon**: `ArrowRight` with `className="panel-icon"` after the text
- **Placement**: Right side of `data-table-header` or `panel-header-row`, inside `data-table-actions`
- **Text**: "View All" (always these exact words)

```tsx
<button className="panel-action" onClick={onNavigateToTab}>
  View All <ArrowRight className="panel-icon" />
</button>
```

Do NOT use `btn-secondary`, `btn-sm`, `table-link`, or any other button class for View All links. The `panel-action` class provides the correct subtle text-link style with hover accent color.

**Used in**: OverviewDashboard (Active Projects), ClientDetail OverviewTab (Contacts), ProjectDetail OverviewTab (Milestones)

### Milestone & Task Status Icons

Consistent icon pattern across Overview and Deliverables views:

| Element | Not Started | In Progress | Completed |
|---------|-------------|-------------|-----------|
| **Milestone header** | `Box` (gray) | `Clock` (gray) | `CheckCircle` (green) |
| **Task (Overview tab)** | `Clock` (gray) | — | `CheckCircle` (green) |
| **Task (Deliverables tab)** | `Checkbox` (unchecked) | — | `Checkbox` (checked) |

- Gray color: `var(--color-text-tertiary)`
- Green color: `var(--color-success)`
- Milestone state is derived from task completion: 0 done = Not Started, some done = In Progress, all done = Completed
- Completed milestones load collapsed, show completion date in header
- Overview tab: read-only (no editing), links to Deliverables via "View All"
- Deliverables tab: checkboxes toggle task completion status

---

## Dark Mode

### How It Works

Only two primary CSS variables change between modes:

- `--color-bg-primary`: light (#e0e0e0) / dark (#171717)
- `--color-text-primary`: light (#333333) / dark (#ffffff)

All other colors are derived via `color-mix()` from these two values. Status colors, accent colors, and semantic colors remain constant across modes.

### Toggle

- `html[data-theme="dark"]` activates dark mode (default)
- `html[data-theme="light"]` activates light mode
- Toggle button in portal header

---

## Responsive Behavior

### Breakpoints

| Token | Width | Usage |
|-------|-------|-------|
| `--xs-mobile` | < 360px | Extra small phones |
| `--small-mobile` | < 480px | Small phones |
| `--narrow-mobile` | < 576px | Narrow layouts |
| `--compact-mobile` | < 640px | Compact mobile |
| `--mobile` | < 768px | Mobile |
| `--tablet` | >= 768px | Tablet and up |
| `--tablet-landscape` | >= 1024px | Tablet landscape and up |

### Rules

- Grids collapse from multi-column to single column on mobile
- Sidebar hides on mobile, toggle button appears in header
- Tables convert to card layout on compact mobile
- Card padding reduces on mobile
- No horizontal scrolling -- content wraps

---

## Related Documentation

- [Portal Design](./PORTAL_DESIGN.md) -- CSS implementation details, theme system
- [Component Library](./COMPONENT_LIBRARY.md) -- React component catalog and API
- [CSS Architecture](./CSS_ARCHITECTURE.md) -- Token system, file organization
- [Animations](./ANIMATIONS.md) -- GSAP animation standards
