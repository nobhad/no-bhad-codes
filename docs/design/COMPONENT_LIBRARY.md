# Component Library Documentation

**Last Updated:** March 9, 2026

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
