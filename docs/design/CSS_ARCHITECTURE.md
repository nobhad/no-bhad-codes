# CSS Architecture

**Last Updated:** March 6, 2026

This document defines the CSS architecture, naming conventions, and design token system used throughout the application.

---

## Design Token System

### Color Variables

All colors must use CSS variables. Never hardcode hex/rgb values.

**Location:** `src/design-system/tokens/colors.css`

#### Main Site Colors (Light Theme)

```css
:root {
  --app-color-background: #f5f5f5;
  --app-color-surface: #ffffff;
  --app-color-text-primary: #1a1a1a;
  --app-color-text-secondary: #666666;
  --app-color-primary: #dc143c;
  --app-color-primary-hover: #b01030;
}
```

#### Portal Colors (DISCOTHÈQUE Dark Theme)

Applied via `[data-page="admin"]` and `[data-page="client-portal"]` selectors:

```css
--portal-background: #0a0a0a;
--portal-surface: #1a1a1a;
--portal-text-primary: #ffffff;
--portal-text-secondary: #a0a0a0;
--portal-border-color: #333333;
```

### Spacing Variables

**Location:** `src/design-system/tokens/spacing.css`

```css
/* Icon gaps - use for icon + text spacing */
--icon-gap-xs: 4px;   /* Small icons (12-14px) */
--icon-gap-sm: 6px;   /* Medium icons (16px) */
--icon-gap-md: 8px;   /* Standard icons (18px) */
--icon-gap-lg: 12px;  /* Large icons (20-24px) */

/* Portal section spacing */
--portal-section-gap: 24px;
--portal-section-heading-padding: 16px 0 8px 0;
```

### Button Tokens

**Location:** `src/design-system/tokens/buttons.css`

Portal button tokens use CSS variables for theming. Never hardcode RGB values.

```css
/* Dark mode (default) */
--portal-btn-color: var(--portal-text-light);
--portal-btn-border: var(--portal-text-light);
--portal-btn-hover-bg: var(--portal-text-light);
--portal-btn-hover-color: var(--portal-background);

/* Light mode - automatically inverted */
--portal-btn-color: var(--portal-text-primary);
--portal-btn-border: var(--portal-text-primary);
```

### Z-Index Tokens

**Location:** `src/design-system/tokens/z-index.css`

Use z-index tokens instead of hardcoded values:

```css
/* Semantic layers */
--z-index-dropdown: 100;
--z-index-sticky: 200;
--z-index-fixed: 300;
--z-index-modal-backdrop: 400;
--z-index-modal: 500;
--z-index-toast: 800;

/* Portal-specific layers */
--z-index-portal-header: 9100;
--z-index-portal-sidebar: 9200;
--z-index-portal-modal: 9600;
--z-index-portal-dropdown: 9700;
--z-index-portal-toast: 9800;
--z-index-portal-confirm: 9900;
```

---

## File Organization

```text
src/
├── design-system/
│   └── tokens/
│       ├── colors.css      # Color variables
│       ├── spacing.css     # Spacing variables
│       ├── buttons.css     # Button tokens (portal)
│       ├── borders.css     # Border radius tokens
│       ├── z-index.css     # Z-index scale tokens
│       └── portal-theme.css # Portal theme overrides
├── styles/
│   ├── base/
│   │   ├── reset.css       # CSS reset
│   │   ├── fonts.css       # Font definitions
│   │   └── typography.css  # Typography rules
│   ├── components/
│   │   ├── form-buttons.css
│   │   ├── inline-edit.css
│   │   └── loading.css
│   ├── shared/
│   │   ├── portal-badges.css
│   │   ├── portal-buttons.css
│   │   ├── portal-cards.css
│   │   ├── portal-components.css
│   │   ├── portal-layout.css
│   │   ├── portal-messages.css
│   │   └── portal-tables.css
│   ├── admin/              # Admin-specific styles
│   ├── client-portal/      # Client portal styles
│   ├── mobile/             # Responsive styles
│   └── variables.css       # Legacy variable aliases
```

---

## Naming Conventions

### CSS Variable Naming

**Pattern:** `--[scope]-[category]-[variant]`

```css
/* Good */
--app-color-primary
--portal-background
--icon-gap-lg

/* Bad */
--blue-500
--large-padding
```

### Class Naming

**Pattern:** Semantic names that describe purpose, not appearance.

```css
/* Good */
.btn-primary
.message-table
.status-badge-active

/* Bad */
.blue-button
.big-text
.red-badge
```

### Component Classes

**Pattern:** `.component-name`, `.component-name--variant`, `.component-name.is-state`

```css
.card { }
.card--elevated { }
.card.is-selected { }
```

---

## Reusable Component Classes

### Buttons

```css
.btn-primary     /* Primary action */
.btn-secondary   /* Secondary/cancel */
.btn-danger      /* Destructive action */
.btn-ghost       /* Minimal style */
```

### Status Badges

```css
.status-badge-active
.status-badge-pending
.status-badge-completed
.status-badge-error
```

### Layout

```css
.portal-container
.portal-section
.portal-card
```

### States

```css
.loading-state
.empty-state
.error-state
```

---

## Rules

### Required

1. **Use CSS variables for all colors** - Never hardcode hex/rgb
2. **Use spacing tokens** - Use `--icon-gap-*` for icon/text spacing
3. **Semantic class names** - Describe purpose, not appearance
4. **Scope portal styles** - Use `[data-page="admin"]` or `[data-page="client-portal"]`

### Forbidden

1. **No inline styles** - Use classes
2. **No `!important`** - Fix specificity instead
3. **No hardcoded pixels for spacing** - Use variables
4. **No color names in variables** - Use semantic names

---

## Tailwind (`tw-`) vs Portal CSS Classes

The codebase uses **two CSS systems** with clear boundaries:

### Portal CSS Classes (Primary)

Used in EJS templates and vanilla TS orchestrators. These are the standard:

```css
/* Forms */
.form-group, .field-label, .form-input, .form-textarea, .form-row, .form-select

/* Buttons */
.btn, .btn-primary, .btn-secondary, .btn-danger, .btn-sm, .btn-icon

/* Tables */
.data-table, .data-table th, .data-table td

/* Layout */
.portal-card, .portal-container, .portal-section, .detail-grid, .detail-row

/* Modals */
.admin-modal-overlay, .admin-modal-content, .admin-modal-header, .admin-modal-body

/* Status */
.status-badge, .status-badge-active, .status-badge-completed
```

### Tailwind (`tw-` prefix) - React Only

All Tailwind classes are prefixed with `tw-` to avoid collisions. Used **only inside React components** for layout utilities:

```tsx
// Correct: tw- prefix in React components
<div className="tw-flex tw-items-center tw-gap-2">

// WRONG: Unprefixed Tailwind
<div className="flex items-center gap-2">

// WRONG: Tailwind in EJS or vanilla TS
```

### When to Use Which

| Context | System | Example |
|---------|--------|---------|
| EJS templates | Portal CSS | `class="form-input"` |
| Vanilla TS (DOM creation) | Portal CSS | `el.className = 'btn btn-primary'` |
| React component layout | Tailwind (`tw-`) | `className="tw-flex tw-gap-2"` |
| React component semantics | Portal CSS | `className="portal-card"` |
| React forms | Portal CSS | `className="form-group"` |

### Rule

**Portal CSS classes take priority.** Only use `tw-` utilities for flex/grid layout, spacing, and positioning within React components. All semantic styling (buttons, forms, tables, cards, badges) must use portal CSS classes.

---

## Adding New Styles

### Checklist

- [ ] Are colors using CSS variables?
- [ ] Are spacings using design tokens?
- [ ] Is the class name semantic?
- [ ] Is the file in the correct directory?
- [ ] Are portal styles properly scoped?

### Where to Add

| Type | Location |
|------|----------|
| Design tokens | `src/design-system/tokens/` |
| Base styles | `src/styles/base/` |
| Shared portal components | `src/styles/shared/` |
| Admin-only styles | `src/styles/admin/` |
| Client portal styles | `src/styles/client-portal/` |
| Component styles | `src/styles/components/` |
