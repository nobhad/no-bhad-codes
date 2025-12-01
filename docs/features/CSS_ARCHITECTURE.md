# CSS Architecture

## Table of Contents

1. [Overview](#overview)
2. [CSS Variables](#css-variables)
3. [Theme System](#theme-system)
4. [Client Portal Classes](#client-portal-classes)
5. [Utility Classes](#utility-classes)
6. [Responsive Design](#responsive-design)
7. [Naming Conventions](#naming-conventions)
8. [File Organization](#file-organization)
9. [Best Practices](#best-practices)

---

## Overview

The project uses a CSS variable-based architecture for consistent theming across light and dark modes. The Client Portal uses the `cp-` prefix for portal-specific classes to avoid conflicts with main site styles.

---

## CSS Variables

### Core Variables (defined in `variables.css`)

#### Layout

| Variable | Purpose | Default |
|----------|---------|---------|
| `--size-container` | Max container width | `min(1200px, 100vw - 2rem)` |
| `--container-padding` | Container padding | `clamp(1rem, 4vw, 2rem)` |
| `--gap` | Default spacing | `clamp(0.75rem, 3vw, 1.5rem)` |
| `--section-padding` | Section padding | `clamp(1rem, 5vw, 2rem)` |
| `--header-height` | Header height | `60px` |
| `--footer-height` | Footer height | `40px` |

#### Typography

| Variable | Purpose | Default |
|----------|---------|---------|
| `--font-size-xs` | Extra small text | `clamp(0.75rem, 2vw, 0.875rem)` |
| `--font-size-sm` | Small text | `clamp(0.875rem, 2.5vw, 1rem)` |
| `--font-size-base` | Base text | `clamp(1rem, 3vw, 1.125rem)` |
| `--font-size-lg` | Large text | `clamp(1.125rem, 3.5vw, 1.25rem)` |
| `--font-size-xl` | Extra large text | `clamp(1.25rem, 4vw, 1.5rem)` |
| `--font-size-2xl` | 2x large text | `clamp(1.5rem, 5vw, 2rem)` |
| `--font-size-3xl` | 3x large text | `clamp(2rem, 6vw, 3rem)` |

#### Spacing

| Variable | Purpose | Default |
|----------|---------|---------|
| `--space-xs` | Extra small space | `clamp(0.25rem, 1vw, 0.5rem)` |
| `--space-sm` | Small space | `clamp(0.5rem, 2vw, 1rem)` |
| `--space-md` | Medium space | `clamp(1rem, 3vw, 1.5rem)` |
| `--space-lg` | Large space | `clamp(1.5rem, 4vw, 2rem)` |
| `--space-xl` | Extra large space | `clamp(2rem, 5vw, 3rem)` |
| `--space-2xl` | 2x large space | `clamp(3rem, 6vw, 4rem)` |

#### Animations

| Variable | Purpose | Default |
|----------|---------|---------|
| `--cubic-default` | Default easing | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-fast` | Fast transition | `0.2s ease` |
| `--transition-medium` | Medium transition | `0.3s ease` |
| `--transition-slow` | Slow transition | `0.6s ease` |

#### Z-Index

| Variable | Purpose | Default |
|----------|---------|---------|
| `--z-header` | Header z-index | `10` |
| `--z-nav` | Navigation z-index | `100` |
| `--z-modal` | Modal z-index | `1000` |

---

## Theme System

### Light Theme (Default)

```css
:root,
html[data-theme="light"] {
  --color-neutral-100: #f8f9fa;
  --color-neutral-200: #e0e0e0;
  --color-neutral-300: #e0e0e0;
  --color-neutral-800: #343a40;
  --color-dark: #333333;
  --color-primary: #00ff41;
  --color-primary-rgb: 0, 255, 65;
  --color-shadow: rgba(0, 0, 0, 0.2);

  /* Form Variables */
  --fg: #333333;
  --form-input-border: #333333;
  --form-input-placeholder: #666666;
  --form-btn-bg: #333333;
  --form-btn-fg: #ffffff;
  --form-btn-shadow: rgba(0, 0, 0, 0.2);
}
```

### Dark Theme

```css
html[data-theme="dark"] {
  --color-neutral-100: #3a3a3a;
  --color-neutral-200: #3a3a3a;
  --color-neutral-300: #2a2a2a;
  --color-neutral-800: #f0f0f0;
  --color-dark: #e0e0e0;
  --color-primary: #00ff41;
  --color-shadow: rgba(0, 0, 0, 1);

  /* Form Variables */
  --fg: #e0e0e0;
  --form-input-border: #e0e0e0;
  --form-input-placeholder: #999999;
  --form-btn-bg: #e0e0e0;
  --form-btn-fg: #2a2a2a;
  --form-btn-shadow: rgba(0, 0, 0, 0.3);
}
```

### Theme Toggle Implementation

```typescript
// Toggle theme
function toggleTheme(): void {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';

  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Load saved theme
function loadTheme(): void {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}
```

---

## Client Portal Classes

### Prefix Convention

All Client Portal specific classes use the `cp-` prefix to avoid conflicts with main site CSS (especially `projects.css`):

| Class | Purpose |
|-------|---------|
| `.cp-shadow` | Intense multi-layer shadow utility |
| `.cp-project-cards` | Project cards container |
| `.cp-project-card` | Individual project card |
| `.cp-password-wrapper` | Password field with toggle |
| `.cp-password-toggle` | Password visibility button |

### Shadow Utility Class

```css
.cp-shadow {
  box-shadow:
    20px 6px 30px rgba(0, 0, 0, 0.6),
    8px 8px 16px rgba(0, 0, 0, 0.8),
    3px 3px 6px rgba(0, 0, 0, 0.9);
}
```

### Project Card (Avoiding Conflicts)

The `.cp-project-card` class was created because `.project-card` in `projects.css` had conflicting rules that made the card invisible:

```css
/* WRONG - conflicts with projects.css */
.project-card { ... }

/* CORRECT - namespaced to client portal */
.cp-project-cards {
  display: block;
  margin-bottom: 1rem;
}

.cp-project-card {
  display: block;
  background: var(--color-neutral-100);
  border: 4px solid #000000;
  padding: 1.5rem;
  color: #333333;
}
```

---

## Utility Classes

### Button Classes

| Class | Usage |
|-------|-------|
| `.btn` | Base button styles |
| `.btn-primary` | Primary actions |
| `.btn-secondary` | Secondary actions |
| `.btn-outline` | Outlined buttons |
| `.btn-sm` | Small button size |

### Form Classes

| Class | Usage |
|-------|-------|
| `.form-input` | Text inputs |
| `.form-select` | Dropdown selects |
| `.form-textarea` | Text areas |
| `.form-group` | Form field wrapper |
| `.form-label` | Field labels |

### Layout Classes

| Class | Usage |
|-------|-------|
| `.container` | Max-width centered container |
| `.container-fluid` | Full-width container |
| `.grid` | CSS Grid container |
| `.flex` | Flexbox container |

### Status Classes

| Class | Usage |
|-------|-------|
| `.status-badge` | Status indicator base |
| `.status-pending` | Yellow pending status |
| `.status-paid` | Green paid status |
| `.status-overdue` | Red overdue status |

---

## Responsive Design

### Breakpoint Variables

| Variable | Value |
|----------|-------|
| `--bp-xs` | `320px` |
| `--bp-sm` | `576px` |
| `--bp-md` | `768px` |
| `--bp-lg` | `992px` |
| `--bp-xl` | `1200px` |
| `--bp-2xl` | `1400px` |

### Responsive Grid Example

```css
.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(320px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 1200px) {
  .settings-grid {
    grid-template-columns: repeat(2, minmax(300px, 1fr));
  }
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
```

### Responsive Utilities

```css
/* Hide on mobile */
@media (max-width: 767px) {
  .md\:hidden { display: none; }
  .sm\:block { display: block; }
}

/* Show on tablet+ */
@media (min-width: 768px) {
  .md\:block { display: block; }
  .sm\:hidden { display: none; }
}
```

---

## Naming Conventions

### General Rules

1. **Lowercase with hyphens**: `stat-card`, `message-thread`
2. **BEM-like structure**: `block__element--modifier`
3. **Prefix for scoped styles**: `cp-` for client portal

### Examples

```css
/* Block */
.stat-card { }

/* Element */
.stat-card .stat-number { }
.stat-card .stat-label { }

/* Modifier */
.stat-card-clickable { }

/* State */
.stat-card:hover { }
.stat-card.active { }

/* Client Portal scoped */
.cp-project-card { }
```

---

## File Organization

### Style File Structure

```
src/styles/
├── variables.css           # CSS variables and theme
├── main.css               # Main site styles
├── main-new.css           # New component styles
├── base/
│   ├── reset.css         # CSS reset
│   ├── layout.css        # Layout utilities
│   └── typography.css    # Typography styles
├── components/
│   ├── form.css          # Form components
│   ├── navigation.css    # Navigation styles
│   ├── footer.css        # Footer styles
│   ├── messaging.css     # Messaging components
│   └── ...
└── pages/
    ├── client-portal.css  # Client Portal specific
    ├── client.css         # Client landing page
    ├── projects.css       # Projects page
    ├── admin.css          # Admin dashboard
    └── ...
```

### Import Order

```css
/* 1. Variables first */
@import './variables.css';

/* 2. Base styles */
@import './base/reset.css';
@import './base/typography.css';
@import './base/layout.css';

/* 3. Components */
@import './components/form.css';
@import './components/navigation.css';

/* 4. Page-specific */
@import './pages/client-portal.css';
```

---

## Best Practices

### Do's

- Use CSS variables for colors, spacing, and sizing
- Use `clamp()` for fluid responsive values
- Prefix scoped styles to avoid conflicts
- Use semantic class names
- Group related styles together
- Add comments for complex selectors

### Don'ts

- Don't use `!important` unless absolutely necessary
- Don't use inline styles
- Don't hardcode colors - use variables
- Don't create overly specific selectors
- Don't mix concerns (layout + color in same rule)

### Border Colors

Use actual `#000000` for borders instead of CSS variables to ensure consistent black borders:

```css
/* CORRECT */
border: 4px solid #000000;

/* AVOID - may not be true black */
border: 4px solid var(--color-dark);
```

### Shadow Layers

Use multiple shadow layers for depth:

```css
box-shadow:
  /* Outer diffuse shadow */
  20px 6px 30px rgba(0, 0, 0, 0.6),
  /* Middle shadow */
  8px 8px 16px rgba(0, 0, 0, 0.8),
  /* Inner tight shadow */
  3px 3px 6px rgba(0, 0, 0, 0.9);
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/styles/variables.css` | CSS variables and themes |
| `src/styles/main.css` | Main site styles |
| `src/styles/pages/client-portal.css` | Client Portal specific |
| `src/styles/components/*.css` | Reusable components |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Uses these styles
- [All Feature Docs](./README.md) - Feature-specific styling
