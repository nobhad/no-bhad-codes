# CSS Architecture

**Last Updated:** February 27, 2026

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

---

## File Organization

```text
src/
├── design-system/
│   └── tokens/
│       ├── colors.css      # Color variables
│       └── spacing.css     # Spacing variables
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
