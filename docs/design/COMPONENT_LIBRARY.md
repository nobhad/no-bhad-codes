# Component Library Documentation

**Last Updated:** March 11, 2026

---

## Overview

All portal UI components are React components located under `src/react/`. The legacy
`src/components/` vanilla TS directory no longer exists — it was removed in the March 2026
portal audit.

---

## Factory Components

Reusable building blocks shared across multiple features. Located in `src/react/factories/`.

| Component | File | Purpose |
|-----------|------|---------|
| `MessageThread` | `MessageThread.tsx` | Chat thread rendering (send, edit, react, receipts) |
| `IconButton` / `TableActions` | `IconButton.tsx` | Icon button primitives and table action wrapper |
| `DataTable` | (see DataTable/) | Generic sortable/filterable data table |
| `InlineEdit` | `InlineEdit.tsx` | Click-to-edit inline field |
| `SearchFilter` / `TableFilters` | `TableFilters.tsx` | Table filter bar components |

---

## Portal UI Components

Located in `src/react/components/portal/`.

| Component | File | Purpose |
|-----------|------|---------|
| `PortalButton` | `PortalButton.tsx` | Button with portal design tokens |
| `DataTable` | `DataTable/DataTable.tsx` | Generic data table (React-based tables) |
| `EmptyState` / `LoadingState` | `EmptyState.tsx` | Empty and loading state displays |
| `SearchBar` | `SearchBar.tsx` | Search input with icon |

---

## CSS Classes (Portal Design System)

All component styling uses CSS classes from `src/styles/`. See `docs/design/CSS_ARCHITECTURE.md`
for the full catalog and naming conventions.

### Buttons

```css
.btn            /* Base */
.btn-primary    /* Primary action */
.btn-secondary  /* Secondary/cancel */
.btn-danger     /* Destructive */
.btn-ghost      /* Minimal */
.icon-btn       /* Icon-only (square, uses --portal-btn-icon-size) */
```

### Status Badges

```css
.status-badge
.status-badge-active / -pending / -completed / -cancelled
```

### Tables

```css
.data-table              /* Base table */
.col-actions             /* Actions column (EJS) */
.table-actions           /* Row action container (EJS) */
.data-table-row-actions  /* Row action container (React DataTable) */
```

### Forms

```css
.form-group
.field-label
.form-input / .form-textarea / .form-select
```

### Layout

```css
.portal-section    /* Bordered section container */
.portal-card       /* Card with padding */
.panel             /* Panel container */
.panel-actions     /* Icon button cluster in panel header */
```

---

## InlineEdit Component

File: `src/react/components/portal/InlineEdit.tsx`

### Variants

| Export | Use case |
|--------|----------|
| `InlineEdit` | Text, number, currency, date |
| `InlineSelect` | Single-value dropdown |
| `InlineTextarea` | Multi-line text |

### Props (`InlineEdit`)

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `value` | `string` | — | Current saved value |
| `onSave` | `(v) => Promise<boolean>\|boolean` | — | Called on save; return `false` to stay in edit mode |
| `type` | `'text'\|'number'\|'currency'\|'date'` | `'text'` | Input type |
| `placeholder` | `string` | `'-'` | Shown when value is empty |
| `formatDisplay` | `(v) => string` | — | Custom display formatter |
| `parseInput` | `(v) => string` | — | Transform raw input before saving |
| `disabled` | `boolean` | `false` | Prevents editing |
| `showEditIcon` | `boolean` | `true` | Show Pencil icon on hover (non-date) |

### Date Field Pattern

Date fields (`type="date"`) follow a specific visual pattern — **do not deviate from this**.

**Display state** (not editing):

```text
[Calendar icon]  Set start date
```

The Calendar icon is always visible on the left. Clicking anywhere starts editing.

**Edit state** (active):

```text
[Calendar icon | mm/dd/yyyy        ]  ✓  ✗
```

The Calendar icon is **absolutely positioned inside the input's left edge**. The date picker
opens automatically via `showPicker()` when editing starts. Clicking the Calendar icon also
triggers `showPicker()`.

**Rules:**

- Calendar icon is always on the left — never on the right, never outside the input border when editing
- The browser's native calendar picker indicator is hidden (`-webkit-calendar-picker-indicator: none`)
- Use `<InlineEdit type="date">` — never a raw `<input type="date">` next to a separate Calendar icon
- Do not wrap date InlineEdit in an outer div with a Calendar icon — the icon is managed internally

**CSS classes involved:**

```css
.inline-edit-date-wrapper   /* Relative wrapper for absolute icon positioning */
.inline-edit-date-cal       /* Absolutely positioned Calendar icon (left: 6px) */
.inline-edit-input-compact--date  /* Date input with padding-left for icon clearance */
```

**Usage:**

```tsx
<InlineEdit
  value={project.start_date || ''}
  type="date"
  placeholder="Set start date"
  onSave={(value) => onSaveField('start_date', value)}
/>
```

---

## Accessibility Notes

- All interactive components use ARIA roles and attributes
- `icon-btn` buttons require `title` or `aria-label`
- Modals use `.portal-modal` with `role="dialog"` and focus trap
- Dropdowns use `aria-haspopup="menu"` and `aria-expanded`

---

## Icon Usage

Use Lucide React icons exclusively. No emojis in UI.

```tsx
import { Pencil, Trash2, Check, X } from 'lucide-react';

<button className="icon-btn" title="Edit">
  <Pencil />
</button>
```

SVG icon sizes default to `1em` — set `font-size` on the parent to control icon size.
Within table action containers, `--portal-btn-icon-size` is automatically scoped to
`--icon-size-sm` (16px).
