# CSS Architecture

**Last Updated:** January 29, 2026

## Table of Contents

1. [Overview](#overview)
2. [Design System](#design-system)
3. [Standardized Components](#standardized-components)
4. [CSS Variables](#css-variables)
5. [Theme System](#theme-system)
6. [Client Portal Classes](#client-portal-classes)
7. [Utility Classes](#utility-classes)
8. [Responsive Design](#responsive-design)
9. [Naming Conventions](#naming-conventions)
10. [File Organization](#file-organization)
11. [Best Practices](#best-practices)
12. [!important Usage Policy](#important-usage-policy)
13. [Admin Messaging Component](#admin-messaging-component)
14. [Known Issues](#known-issues)

---

## Overview

The project uses a CSS variable-based architecture for consistent theming across light and dark modes. The Client Portal uses the `cp-` prefix for portal-specific classes to avoid conflicts with main site styles.

**Design System:** `src/design-system/` (11 files, ~2,300 lines)
**Styles Directory:** `src/styles/` (25 files, ~4,200 lines)

---

## Design System

The design system provides the foundational tokens for the entire application.

### Token Architecture

| Token File | Lines | Purpose |
|------------|-------|---------|
| `tokens/colors.css` | 307 | Complete color system with semantic tokens |
| `tokens/typography.css` | 284 | Type scale with fluid `clamp()` values |
| `tokens/spacing.css` | 438 | Spacing scale and utility classes |
| `tokens/animations.css` | 408 | Duration, easing, and keyframes |
| `tokens/shadows.css` | 219 | Elevation system with component shadows |
| `tokens/borders.css` | ~50 | Border radius values |
| `tokens/breakpoints.css` | ~30 | Responsive breakpoints |
| `tokens/z-index.css` | ~20 | Stacking context tokens |

### Color Token System

**Semantic Color Tokens** (Recommended usage):

```css
/* Background colors */
--color-bg-primary
--color-bg-secondary
--color-bg-tertiary

/* Text colors */
--color-text-primary
--color-text-secondary
--color-text-tertiary

/* Interactive colors */
--color-interactive-primary
--color-interactive-primary-hover

/* Border colors */
--color-border-primary
--color-border-focus

/* Status colors */
--color-success-500
--color-error-500
--color-warning-500
--color-info-500
```

**Brand Colors** (Theme-Aware):

```css
/* Light Mode */
--color-brand-primary: #dc2626   /* Crimson red */
--color-brand-primary-rgb: 220, 38, 38
--color-brand-secondary: #ff6b6b
--color-brand-accent: #ffd93d

/* Dark Mode */
--color-brand-primary: #dc2626   /* Crimson red (same as light mode) */
--color-brand-primary-rgb: 220, 38, 38
```

### Import Order

```css
/* Design system must be imported first */
@import './design-system/index.css';

/* Then base styles */
@import './styles/base/reset.css';
@import './styles/base/typography.css';

/* Then components */
@import './styles/components/form.css';

/* Then pages */
@import './styles/pages/client-portal.css';

/* Finally mobile overrides */
@import './styles/mobile/index.css';
```

---

## Standardized Components

The Client Portal CSS defines standardized component classes documented at the top of the file for consistency across all views.

### Component: Card

Use for any content container/section:

```css
/* src/styles/pages/client-portal.css:25-34 */
.cp-card {
  background: var(--color-neutral-200);
  border: 4px solid #000000;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.cp-card:last-child {
  margin-bottom: 0;
}
```

### Component: Card Header

Use for section titles within cards:

```css
/* src/styles/pages/client-portal.css:40-48 */
.cp-card-header {
  font-family: var(--font--acme);
  font-size: 1.1rem;
  color: var(--color-dark);
  margin: 0 0 1rem 0;
  text-transform: uppercase;
  border-bottom: 2px solid var(--color-dark);
  padding-bottom: 0.5rem;
}
```

### Component: Buttons

Standard button classes with consistent styling:

```css
/* src/styles/pages/client-portal.css:55-98 */
.cp-btn,
.client-portal-main .btn,
.client-portal-main .btn-primary,
.client-portal-main .btn-secondary,
.client-portal-main .btn-outline,
.client-portal-main button[type="submit"] {
  padding: 0.75rem 1.5rem;
  background: var(--color-neutral-300);
  color: var(--color-dark);
  border: 4px solid var(--color-dark);
  border-radius: 0;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  font-family: inherit;
  line-height: 1.2;
}

/* Primary/Submit button */
.cp-btn-primary,
.client-portal-main .btn-primary,
.client-portal-main button[type="submit"] {
  background: var(--color-neutral-300);
}

/* Small button */
.cp-btn-sm,
.client-portal-main .btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  border-width: 3px;
}

/* Hover state */
.cp-btn:hover,
.client-portal-main .btn:hover {
  background: var(--color-primary);
  color: var(--color-dark);
}
```

### Component: Form Input

Standardized form inputs:

```css
.cp-input,
.client-portal-main .form-input,
.client-portal-main .form-select,
.client-portal-main .form-textarea {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-neutral-100);
  border: 2px solid var(--color-dark);
  border-radius: 4px;
  color: var(--color-dark);
  font-size: 1rem;
}

.cp-input:focus,
.client-portal-main .form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}
```

### Component: Badge/Status

Status indicators:

```css
.cp-badge {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 999px;
  display: inline-block;
}
```

### Component: Stat Card

Quick stats display:

```css
.cp-stat {
  background: var(--color-neutral-100);
  border: 4px solid #000000;
  padding: 1.5rem;
  text-align: center;
}

.cp-stat-number {
  font-size: 2rem;
  font-weight: 700;
  display: block;
}

.cp-stat-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
```

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
  /* Brand colors - Crimson red */
  --color-brand-primary: #dc2626;
  --color-brand-primary-rgb: 220, 38, 38;

  /* Legacy aliases (map to brand) */
  --color-neutral-100: var(--color-gray-100);
  --color-neutral-200: var(--color-gray-200);
  --color-neutral-300: #e0e0e0;
  --color-neutral-800: var(--color-gray-800);
  --color-dark: #333333;
  --color-primary: var(--color-brand-primary);
  --color-primary-rgb: var(--color-brand-primary-rgb);
  --color-shadow: rgba(0, 0, 0, 0.2);

  /* Form Variables */
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
  /* Brand colors - Crimson red (same as light mode) */
  --color-brand-primary: #dc2626;
  --color-brand-primary-rgb: 220, 38, 38;

  /* Legacy aliases */
  --color-neutral-100: #3a3a3a;
  --color-neutral-200: #3a3a3a;
  --color-neutral-300: #2a2a2a;
  --color-neutral-800: #f0f0f0;
  --color-dark: #e0e0e0;
  --color-shadow: rgba(0, 0, 0, 1);

  /* Form Variables */
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

The project uses distinct prefixes for different portal-related features:

**Client Portal Dashboard (`cp-` prefix):**
Classes for the authenticated client portal dashboard use the `cp-` prefix to avoid conflicts with main site CSS (especially `projects.css`).

**Navigation Portal (`portal-` prefix):**
Classes for the header portal dropdown (login/register toggle) use the `portal-` prefix. Located in `src/styles/components/nav-portal.css`.

**Intake Modal (`intake-` prefix):**
Classes for the terminal intake modal use the `intake-` prefix. Also in `nav-portal.css`.

### Client Portal Dashboard Classes (`cp-`)

| Class | Purpose |
|-------|---------|
| `.cp-shadow` | Intense multi-layer shadow utility |
| `.cp-card` | Content container card |
| `.cp-card-header` | Section title in card |
| `.cp-btn` | Standard button |
| `.cp-btn-primary` | Primary action button |
| `.cp-btn-sm` | Small button |
| `.cp-input` | Form input field |
| `.cp-badge` | Status badge |
| `.cp-stat` | Stat card |
| `.cp-project-cards` | Project cards container |
| `.cp-project-card` | Individual project card |
| `.cp-password-wrapper` | Password field with toggle |
| `.cp-password-toggle` | Password visibility button |

### Navigation Portal Classes (`portal-`)

| Class | Purpose |
|-------|---------|
| `.portal-button` | Header portal trigger button |
| `.portal-backdrop` | Semi-transparent overlay behind dropdown |
| `.portal-dropdown` | Login/register dropdown panel |
| `.portal-dropdown-header` | Dropdown title area |
| `.portal-toggle-btn` | Login/register tab toggle |
| `.portal-dropdown-form` | Form container in dropdown |

### Intake Modal Classes (`intake-`)

| Class | Purpose |
|-------|---------|
| `.intake-modal-backdrop` | Full-screen modal overlay |
| `.intake-modal` | Terminal intake modal container |
| `.intake-modal-close` | Modal close button |
| `.intake-modal-container` | Inner content wrapper |

### Shadow Utility Class

```css
/* src/styles/pages/client-portal.css:18-23 */
.cp-shadow {
  box-shadow:
    20px 6px 30px rgba(0, 0, 0, 0.6),
    8px 8px 16px rgba(0, 0, 0, 0.8),
    3px 3px 6px rgba(0, 0, 0, 0.9);
}
```

### Portal Layout (Client Landing Page)

The `.portal-layout` system provides a two-column grid for the client landing page:

```css
/* src/styles/pages/client.css */
.portal-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  width: 80vw;
  max-width: 1000px;
  margin-top: 1rem;
  align-items: stretch;
  grid-auto-rows: 1fr;
}

.portal-layout.desktop-only {
  display: grid;
}

.portal-form-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0;
  width: 100%;
  height: 100%;
}

.portal-form-area .login-form {
  width: 100%;
  height: 100%;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
```

### Project Card (Avoiding Conflicts)

The `.cp-project-card` class was created because `.project-card` in `projects.css` had conflicting rules:

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

| Class | Usage | Colors |
|-------|-------|--------|
| `.status-badge` | Status indicator base | - |
| `.status-pending` | Yellow pending status | `#fef3c7` / `#92400e` |
| `.status-paid` | Green paid status | `#d1fae5` / `#065f46` |
| `.status-overdue` | Red overdue status | `#fee2e2` / `#991b1b` |
| `.status-draft` | Gray draft status | neutral-200 |

### Table Filter Components

| Class | Usage |
|-------|-------|
| `.table-filter-controls` | Container for filter controls |
| `.filter-search` | Search input wrapper |
| `.filter-search-icon` | Search icon inside dropdown (positioned absolute left) |
| `.filter-search-input` | Search input field (padding-left for icon) |
| `.filter-dropdown-menu` | Dropdown menu for filter options |
| `.filter-date-group` | Date range filter wrapper |

**Filter Search with Icon Pattern:**

```css
.filter-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.filter-search-input {
  padding: 0.5rem 2.5rem 0.5rem 2.25rem;  /* Left padding for icon */
}
```

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

### Settings Grid (3 → 2 → 1 columns)

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

### Invoice Summary Grid (2 → 1 columns)

```css
.invoice-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

@media (max-width: 576px) {
  .invoice-summary {
    grid-template-columns: 1fr;
  }
}
```

### Invoice Item Grid (4 → 1 columns)

```css
.invoice-item {
  display: grid;
  grid-template-columns: 2fr 1fr auto auto;
  gap: 1rem;
}

@media (max-width: 768px) {
  .invoice-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
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

```text
src/styles/
├── main.css                    # Main entry point (imports all modules)
├── variables.css               # CSS variables and theme
├── base/
│   ├── fonts.css              # @font-face definitions (imported first)
│   ├── reset.css              # CSS reset
│   ├── layout.css             # Layout utilities
│   ├── typography.css         # Typography styles
│   ├── site-globals.css       # Site-wide global styles
│   └── site-utilities.css     # Site utility classes
├── components/
│   ├── form-fields.css        # Form input styling
│   ├── form-buttons.css       # Button styles
│   ├── form-validation.css   # Validation states
│   ├── nav-base.css           # Navigation base styles
│   ├── nav-animations.css     # Navigation animations
│   ├── nav-responsive.css     # Navigation responsive/mobile
│   ├── nav-portal.css         # Client portal navigation
│   ├── intro-nav.css          # Intro navigation links
│   ├── footer.css             # Footer styles
│   ├── loading.css            # Loading indicators
│   ├── portfolio-carousel.css # Portfolio carousel
│   ├── business-card.css      # Business card component
│   ├── intro-morph.css        # Intro animation overlay
│   └── page-transitions.css   # Virtual page transition styles
├── client-portal/             # Client Portal (modular - 10 files)
│   ├── index.css              # Import orchestrator
│   ├── components.css         # cp- prefixed reusable components
│   ├── layout.css             # Dashboard layout, containers
│   ├── sidebar.css            # Sidebar navigation
│   ├── login.css              # Login form
│   ├── dashboard.css          # Stats, activity, project cards
│   ├── files.css              # File upload/management
│   ├── invoices.css           # Invoice display
│   ├── settings.css           # Settings, account views
│   └── projects.css           # Project navigation, details
├── admin/                     # Admin Dashboard styles
│   ├── index.css              # Admin import orchestrator
│   ├── auth.css               # Admin authentication
│   ├── analytics.css          # Analytics dashboard
│   ├── client-detail.css      # Client detail views
│   ├── modals.css             # Admin modals
│   └── project-detail.css     # Project detail views
├── shared/                    # Shared portal components
│   ├── confirm-dialog.css     # Confirmation dialogs
│   ├── portal-buttons.css     # Portal button styles
│   ├── portal-cards.css       # Portal card components
│   ├── portal-dropdown.css    # Portal dropdown menus
│   ├── portal-files.css       # File upload components
│   ├── portal-forms.css       # Portal form styles
│   ├── portal-layout.css      # Portal layout utilities
│   ├── portal-messages.css    # Messaging UI
│   ├── progress.css           # Progress indicators
│   └── toast-notifications.css # Toast notifications
├── bundles/                   # Pre-compiled CSS bundles
│   ├── admin.css              # Admin bundle
│   ├── portal.css             # Portal bundle
│   ├── shared.css             # Shared bundle
│   └── site.css               # Site bundle
├── pages/
│   ├── client.css             # Client landing page
│   ├── terminal-intake.css    # Terminal-style intake form
│   ├── client-dashboard.css   # Client dashboard
│   ├── client-portal-section.css # Portal section on main page
│   ├── projects.css           # Projects page
│   ├── proposal-builder.css   # Proposal builder page
│   ├── admin.css              # Admin dashboard
│   ├── contact.css            # Contact page
│   └── about.css              # About page
└── mobile/
    ├── index.css              # Mobile orchestration
    ├── layout.css             # Mobile layout overrides
    └── contact.css            # Mobile contact styles
```

### Import Order

```css
/* 1. Fonts first (must be before design system) */
@import './base/fonts.css';

/* 2. Design system tokens */
@import '../design-system/index.css';

/* 3. Variables and theme */
@import './variables.css';

/* 4. Base styles */
@import './base/reset.css';
@import './base/typography.css';
@import './base/layout.css';

/* 5. Components */
@import './components/form-fields.css';
@import './components/form-buttons.css';
@import './components/nav-base.css';
@import './components/nav-animations.css';
/* ... other components */

/* 6. Page-specific */
@import './client-portal/index.css';  /* Modular client portal */
@import './pages/client.css';
/* ... other pages */

/* 7. Mobile overrides (last) */
@import './mobile/index.css';
```

**Critical**: `fonts.css` must be imported FIRST so `@font-face` definitions are available when design system tokens reference font families.

---

## Best Practices

### Do's

- Use CSS variables for colors, spacing, and sizing
- Use `clamp()` for fluid responsive values
- Prefix scoped styles with `cp-` to avoid conflicts
- Use semantic class names
- Group related styles together
- Add comments for complex selectors
- Use the standardized cp- component classes defined in `client-portal/components.css`

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
| `src/styles/pages/client-portal.css` | Client Portal specific (3050 lines) |
| `src/styles/components/*.css` | Reusable components |

---

## !important Usage Policy

**Last Updated:** January 15, 2026

This section documents all legitimate `!important` declarations in the codebase. As of January 15, 2026, we have reduced from 313 to 58 instances through specificity refactoring.

### Legitimate Uses (Do Not Remove)

The following categories of `!important` are **intentional and necessary**:

#### 1. Accessibility - Reduced Motion (32 instances)

Users who prefer reduced motion must have animations disabled regardless of other CSS rules.

| File | Lines | Rules |
|------|-------|-------|
| `design-system/tokens/shadows.css` | 207 | `transition: box-shadow 0.01ms` |
| `design-system/tokens/animations.css` | 450-453 | animation-duration, iteration-count, transition-duration, scroll-behavior |
| `base/reset.css` | 245-248 | animation-duration, iteration-count, transition-duration, scroll-behavior |
| `variables.css` | 507-510 | animation-duration, iteration-count, transition-duration, scroll-behavior |
| `components/page-transitions.css` | 321-322 | `transition: none`, `animation: none` |
| `components/business-card.css` | 575, 581, 623 | `transition: none`, `transform: none` (2x) |
| `components/portfolio-carousel.css` | 298 | `transition: none` |
| `components/nav-animations.css` | 121-122 | `transform: none`, `transition: none` |
| `components/nav-base.css` | 770-773 | animation-duration, iteration-count, scroll-behavior |
| `pages/contact.css` | 983-984 | `transition: none`, `animation: none` |
| `pages/client-portal-section.css` | 311 | `transition: none` |

#### 2. Print Styles (15 instances)

Print media requires overriding all screen styles for clean output.

| File | Lines | Rules |
|------|-------|-------|
| `design-system/tokens/breakpoints.css` | 491-494, 522 | background, color, box-shadow, text-shadow, max-width |
| `base/reset.css` | 268-271, 280 | background, color, box-shadow, text-shadow, `.no-print` display |
| `variables.css` | 524-527, 536 | background, color, box-shadow, text-shadow, `.no-print` display |

#### 3. Accessibility - Focus Visibility (1 instance)

Keyboard focus must be visible regardless of component styling.

| File | Line | Rule |
|------|------|------|
| `base/reset.css` | 228 | `:focus-visible { box-shadow: 0 0 0 2px inset var(--color-brand-primary) }` |

#### 4. Accessibility - High Contrast (1 instance)

High contrast mode requires enhanced visual boundaries.

| File | Line | Rule |
|------|------|------|
| `pages/contact.css` | 969 | `border-width: 3px` (in `@media (prefers-contrast: high)`) |

#### 5. Browser Autofill Override (4 instances)

Browsers apply inline styles for autofilled inputs that can only be overridden with `!important`.

| File | Lines | Rules |
|------|-------|-------|
| `pages/contact.css` | 626-629 | color, -webkit-text-fill-color, box-shadow, -webkit-box-shadow |

#### 6. Utility Classes (8 instances)

Global utility classes must win over any component styles.

| File | Lines | Class | Rules |
|------|-------|-------|-------|
| `main.css` | 203-206 | `.hidden` | display, visibility, opacity, pointer-events |
| `components/form-fields.css` | 17, 22-24 | `.honeypot-field` | display, opacity, position, z-index |

#### 7. Animation State Lock (2 instances)

GSAP animation requires initial state to be locked during intro.

| File | Lines | Rules |
|------|-------|-------|
| `components/footer.css` | 6 | `.intro-loading footer { display: none }` |

### Remaining Legitimate Uses (Not Technical Debt)

The following `!important` declarations are **intentional** and should remain:

#### Utility Classes (6 instances)

| File | Lines | Class | Reason |
|------|-------|-------|--------|
| `components/nav-base.css` | 758 | `.no-transition` | Utility class must override all transitions |
| `components/nav-base.css` | 762 | `.force-transition` | Utility class must force transitions |
| `pages/admin.css` | 2144 | `.hidden` | Utility class must hide elements |

#### Modal Scroll Lock (1 instance)

| File | Line | Reason |
|------|------|--------|
| `pages/admin.css` | 720 | `body.modal-open { overflow: hidden }` - Prevents scroll behind modals |

#### Chart.js Inline Style Overrides (2 instances)

| File | Lines | Reason |
|------|-------|--------|
| `pages/admin.css` | 2272, 2279 | Chart.js sets inline styles on legend elements |

#### Print Styles (1 instance)

| File | Line | Reason |
|------|------|--------|
| `components/nav-responsive.css` | 272 | Print media hides navigation |

### Specificity Solutions Reference

When removing `!important`, use these techniques:

1. **CSS Cascade Layers** - `@layer` in main.css controls cascade order
2. **Scoped Styles** - `body[data-page="admin"]` prefix for page-specific overrides
3. **Element Type Prefixes** - `section.class-name`, `div.class-name` for +1 specificity
4. **Doubled Class Selectors** - `.modal.modal` for +1 class specificity
5. **Parent Context Selectors** - `.section .wrapper .element` for nested overrides
6. **Page-States Layer** - `page-states` layer for transition state overrides

### Progress Tracking

| Date | Total | Removed | Notes |
|------|-------|---------|-------|
| Start | 650+ | - | Initial audit |
| Jan 14 | 313 | 337 | First cleanup pass |
| Jan 15 | 58 | 255 | Specificity refactoring complete |

**Files Cleaned (Before → After):**

| File | Before | After | Status |
|------|--------|-------|--------|
| mobile/contact.css | 85 | 0 | DONE |
| mobile/layout.css | 61 | 3 | DONE |
| client-portal/sidebar.css | 47 | 0 | DONE |
| admin/project-detail.css | 45 | 0 | DONE |
| page-transitions.css | 44 | 2 | DONE (accessibility kept) |
| terminal-intake.css | 41 | 0 | DONE |
| client.css | 32 | 0 | DONE |
| client-portal-section.css | 30 | 1 | DONE (reduced motion kept) |
| admin.css | 29 | 4 | DONE (modal scroll, utility, Chart.js kept) |
| contact.css | 24 | 7 | DONE (autofill, accessibility kept) |
| business-card.css | 20 | 3 | DONE (reduced motion, print kept) |
| projects.css | 13 | 0 | DONE |
| nav-portal.css | 13 | 0 | DONE |
| reset.css | 10 | 10 | DONE (all accessibility/print - kept) |
| client-portal/invoices.css | 2 | 0 | DONE |
| client-portal/settings.css | 2 | 0 | DONE |
| client-portal/dashboard.css | 8 | 0 | DONE |
| nav-animations.css | 4 | 0 | DONE |
| nav-responsive.css | 4 | 1 | DONE (print kept) |
| nav-base.css | 7 | 6 | DONE (utility classes, accessibility kept) |
| about.css | 1 | 0 | DONE |

---

## Admin Messaging Component

**Location:** `src/styles/admin/project-detail.css` (lines 864-1730)

The admin messaging component uses a light background with dark text, styled as a chat interface.

### Message Thread Container

```css
/* Light background container with rounded corners */
[data-page="admin"] .messages-thread {
  max-height: 400px;
  overflow-y: auto;
  padding: var(--portal-spacing-lg);
  background: var(--color-neutral-200);
  border-radius: var(--portal-radius-md) var(--portal-radius-md) 0 0;
}
```

### Message Bubbles

```css
/* Received messages - left aligned with avatar on left */
.messages-thread .message-received {
  align-self: flex-start;
  flex-direction: row;
}

/* Sent messages - right aligned with avatar on right */
.messages-thread .message-sent {
  align-self: flex-end;
  flex-direction: row;  /* Avatar follows message content */
}

.messages-thread .message-sent .message-content {
  background: var(--color-neutral-100);  /* Lighter than white */
  color: var(--portal-text-dark);
}
```

### Avatar Image Usage

For SVG avatars loaded via `<img>` tags, use self-contained SVGs (not SVGs that reference external resources):

```css
/* Invert colors for dark body with light features */
.messages-thread .message-avatar .avatar-img {
  display: block;
  width: 48px;
  height: 48px;
  object-fit: contain;
  filter: invert(1);  /* Flips colors - use when SVG is light on dark */
}
```

**Important:** SVGs with external `<image>` references (e.g., `xlink:href="file.png"`) will NOT load when used in `<img>` tags. Use self-contained SVGs like `avatar_small_sidebar.svg` instead.

### Message Compose Area

```css
/* Compose area matches thread background */
[data-page="admin"] .message-compose {
  background: var(--color-neutral-200);
  border-radius: 0 0 var(--portal-radius-lg) var(--portal-radius-lg);
}

/* Focus state for textarea */
[data-page="admin"] .message-compose textarea:focus {
  border-color: var(--color-primary);
  outline: none;
}
```

### Client Dropdown (Custom)

The client selector uses a custom dropdown component with unread message counts:

```css
/* Only show unread count badge when > 0 */
.dropdown-item-count.has-unread {
  /* Badge styling for unread messages */
}
```

---

## Known Issues

**Updated January 29, 2026**

### Resolved Issues (December 2025 - January 2026)

The following issues from the December 17 code review have been addressed:

| Issue | Status | Resolution |
|-------|--------|------------|
| Navigation CSS oversized (900+ lines) | FIXED | Split into `nav-base.css`, `nav-animations.css`, `nav-responsive.css`, `nav-portal.css` |
| Form CSS oversized (374 lines) | FIXED | Split into `form-fields.css`, `form-buttons.css`, `form-validation.css` |
| Legacy `--fg`/`--bg` variables | FIXED | Migrated 65+ instances to semantic tokens |
| Hardcoded `#000` values | FIXED | Migrated 27 instances to `var(--color-black)` |
| Font loading issues | FIXED | Created `fonts.css` with `@font-face` definitions (imported first) |

### Remaining Issues

#### Components Not Using Shared Styles (Medium Priority)

**Audit Date:** January 29, 2026

The following components duplicate shared style patterns instead of using the reusable component classes from `src/styles/shared/`:

| File | Lines | Issue | Shared Component |
|------|-------|-------|-----------------|
| `pages/admin.css` | 805-816 | `.stat-card` duplicates shared definition | `shared/portal-cards.css` `.stat-card` |
| `pages/admin.css` | 1521-1586 | `.set-password-form` defines custom form/button styles | `shared/portal-forms.css`, `shared/portal-buttons.css` |

**`.stat-card` Duplication (lines 805-816):**

The `pages/admin.css` file has an unscoped `.stat-card` definition that duplicates the scoped version in `shared/portal-cards.css`. The shared version already targets `[data-page="admin"], [data-page="client-portal"]` and provides the same styling.

**Recommendation:** Remove the duplicate `.stat-card` from `pages/admin.css` or ensure it only contains admin-specific overrides.

**`.set-password-form` Custom Styles (lines 1521-1586):**

This form defines its own `.form-input`, `.form-group`, and `.btn-primary` styles instead of using the shared portal-forms.css and portal-buttons.css. The custom styles use different values (smaller border-radius, different padding, different color scheme).

**Recommendation:** Either:

1. Update the set-password-form to use shared components with CSS variable overrides, OR
2. Document this as intentional deviation for the specific use case (unauthenticated password reset page may need different styling)

#### Hardcoded Colors (Low Priority)

Some files still contain hardcoded color values that could be tokenized:

| File | Issue |
|------|-------|
| `pages/contact.css` | Some hex values for specific styling |
| `pages/admin.css` | Admin-specific color overrides |

#### Legacy Variables Still in Use

The Client Portal (`cp-` prefixed classes) still uses legacy variable naming for backwards compatibility:

```css
/* Still in use for Client Portal */
--color-neutral-100 through --color-neutral-800
--color-dark

/* These work alongside semantic tokens */
--color-text-primary
--color-bg-primary
```

This is intentional to maintain Client Portal styling consistency.

### File Size Status

| File | Lines | Status |
|------|-------|--------|
| `pages/admin.css` | 1820+ | Could be split by section (low priority) |
| `client-portal/` | ~2000 | Split into 10 modular files (all <300 lines) |

All navigation, form, and client portal CSS files are now properly sized (<300 lines each).

**Client Portal Modular Structure (January 2026):**

| File | Purpose |
|------|---------|
| `index.css` | Import orchestrator |
| `components.css` | cp- prefixed reusable components |
| `layout.css` | Dashboard layout, containers |
| `sidebar.css` | Sidebar navigation |
| `login.css` | Login form |
| `dashboard.css` | Stats, activity, project cards |
| `files.css` | File upload/management |
| `invoices.css` | Invoice display |
| `settings.css` | Settings, account views |
| `projects.css` | Project navigation, details |

---

## Related Documentation

- [Client Portal](../features/CLIENT_PORTAL.md) - Uses these styles
- [Messages](../features/MESSAGES.md) - Emoji picker styling
- [Settings](../features/SETTINGS.md) - Settings grid layout
- [All Feature Docs](../features/README.md) - Feature-specific styling
