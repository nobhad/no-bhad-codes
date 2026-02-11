# CSS Architecture

**Last Updated:** February 11, 2026 (Login mobile transparent bg, Help page two-column layout)

## Table of Contents

1. [Overview](#overview)
2. [Portal CSS](#portal-css)
3. [Current Metrics](#current-metrics)
4. [Common Patterns](#common-patterns)
5. [Design System](#design-system)
6. [Standardized Components](#standardized-components)
7. [CSS Variables](#css-variables)
8. [Theme System](#theme-system)
9. [Client Portal Classes](#client-portal-classes)
10. [Utility Classes](#utility-classes)
11. [Responsive Design](#responsive-design)
12. [Naming Conventions](#naming-conventions)
13. [File Organization](#file-organization)
14. [Best Practices](#best-practices)
15. [!important Usage Policy](#important-usage-policy)
16. [Portal Button Design](#portal-button-design)
17. [Admin Messaging Component](#admin-messaging-component)
18. [Focus States](#focus-states)
19. [Intentional Non-Standard Patterns](#intentional-non-standard-patterns)

---

## Overview

The project uses a CSS variable-based architecture for consistent theming across light and dark modes. The Client Portal uses the `portal-` prefix for portal-specific classes to avoid conflicts with main site styles.

**Compliance Status:**

- All colors use CSS variables
- All z-index values use token system
- All breakpoints use `@custom-media` variables
- All spacing uses design-system tokens (`--space-*`)
- Typography utilities consolidated to `base/typography.css`
- Password toggle styles consolidated to `shared/portal-forms.css`
- Hidden selector has single source at `base/layout.css`
- All `!important` declarations are legitimate (GSAP, print, reduced motion, collapsed sidebar)

---

## Portal CSS

This section covers the Admin and Client Portal CSS, which is separate from the main marketing site.

### Scope

**In scope (portal-only):**

- **Admin dashboard** — `admin/index.html`, served with `src/styles/bundles/admin.css`
- **Client portal** — `client/portal.html`, `client/set-password.html`, served with `src/styles/bundles/portal.css`

**Out of scope (main site):**

- Marketing pages (home, about, contact, projects)
- Main site typography, hero, footer, navigation marketing styles
- `src/styles/bundles/site.css` and main-site-specific tokens

Portals share a **dark UI** and a common set of `--portal-*` variables. They do **not** use the same visual system as the public site.

### Entry Points (Bundles)

| Bundle | Served On | Contents |
| ------ | --------- | -------- |
| `src/styles/bundles/admin.css` | Admin dashboard (`admin/index.html`) | Shared base + nav + admin pages + admin modules |
| `src/styles/bundles/portal.css` | Client portal (`client/portal.html`, set-password) | Shared base + nav-portal only + client-portal modules |

Both bundles:

1. Import **shared.css** (reset, design-system tokens, variables, base typography/layout, form components, loading, progress, toasts).
2. Use **cascade layers**: `reset`, `tokens`, `base`, `components`, then either `admin` or `portal`, then `utilities`.
3. Import **wireframe.css** for `data-wireframe="true"` greyscale mode.
4. Define a **skip-link** in the `utilities` layer.

**Admin-only:** full nav (`nav-base.css`, `nav-portal.css`), then `pages/admin.css` and `admin/index.css`.

**Portal-only:** `nav-portal.css` only, then `client-portal/index.css`.

### Portal Theme Variables

Portal-specific variables are defined in **`src/styles/variables.css`** inside:

```css
[data-page="client-portal"],
[data-page="admin"] { ... }
```

The HTML for admin and client portal pages must set `data-page="admin"` or `data-page="client-portal"` on `<body>` (or a wrapper) so these variables apply.

#### Shared by both portals

| Category | Variables |
| -------- | --------- |
| **Base overrides** | `--color-neutral-100` … `--color-neutral-400`, `--color-dark`, `--color-text-primary`, `--color-border` |
| **Portal text** | `--portal-text-light`, `--portal-text-secondary`, `--portal-text-muted`, `--portal-text-dark` |
| **Portal backgrounds** | `--portal-bg-darker`, `--portal-bg-dark`, `--portal-bg-medium`, `--portal-bg-light`, `--portal-bg-hover`, `--portal-bg-readonly` |
| **Portal borders** | `--portal-border-dark`, `--portal-border-medium`, `--portal-border-light`, `--portal-border`, `--portal-border-light-style` |
| **Border radius** | `--portal-radius-xs` (4px), `--portal-radius-sm` (6px), `--portal-radius-md` (8px), `--portal-radius-lg` (12px), `--portal-radius-pill` (50px); `--border-radius-card` → `--portal-radius-md` |
| **Spacing** | Use design-system tokens: `--space-0-5` (4px) … `--space-4` (32px) from `tokens/spacing.css` |
| **Labels** | `--label-font-size`, `--label-color`, `--label-font-weight`, `--label-text-transform`, `--label-letter-spacing` |

#### Admin-only overrides

```css
[data-page="admin"] {
  --color-text-primary: var(--color-gray-100);
  --color-text-secondary: var(--color-gray-300);
  --portal-text-secondary: var(--color-gray-400);
}
```

Use **`--portal-*`** (and these overrides) for all portal UI so portal CSS stays independent from main-site tokens.

### Design Tokens Used by Portals

Portals load the full design system via `shared.css` → `design-system/index.css`. In portal styles, prefer:

- **Colors:** Portal theme variables above; for status/semantic use tokens from `src/design-system/tokens/colors.css` (e.g. `--color-success-500`, `--color-error-500`) where appropriate.
- **Shadows:** `var(--shadow-md)`, `var(--shadow-lg)` from `tokens/shadows.css` — avoid raw `box-shadow` values.
- **Spacing (fixed scale):** From `tokens/spacing.css` use `--space-0-5`, `--space-1`, `--space-1-5`, `--space-2`, `--space-3`, `--space-4`, etc. for the 8px-based scale. Portal-specific spacing vars have been migrated to these tokens.
- **Z-index:** `tokens/z-index.css` for modals, overlays, nav.

Overlay/backdrop tokens are defined **only** in `design-system/tokens/colors.css`; do not redefine them in `variables.css`.

---

## Current Metrics

| Metric | Value |
| ------ | ----- |
| Total CSS Files | 94 |
| Total Lines | ~34,200 |
| Design System | `src/design-system/` (11 files, ~3,600 lines) |
| Styles Directory | `src/styles/` (91 files, ~34,200 lines) |
| Largest File | admin.css (2,064 lines) |

---

## Common Patterns

### Shadow Hierarchy

**Main containers** (parent cards with dark backgrounds) use `--shadow-panel`:

```css
/* Main container - dark background with shadow */
background: var(--portal-bg-dark);
border: none;
border-radius: var(--portal-radius-md);
box-shadow: var(--shadow-panel);
padding: var(--space-3);
```

**Child elements** with lighter grey backgrounds (`--portal-bg-medium`) should have **NO shadow**:

```css
/* Child element - lighter grey, no shadow */
background: var(--portal-bg-medium);
border-radius: var(--portal-radius-sm);
padding: var(--space-2) var(--space-3);
/* NO box-shadow */
```

Examples of elements that follow this pattern:

- `.activity-list li` - Recent activity items
- `.task-item` - Task list items
- `.system-info-row` - System info rows
- `.scoring-rules-list` - Scoring rules container
- `.chart-canvas-wrapper` - Chart containers
- `.analytics-column` - Analytics section columns
- `.kanban-card` - Kanban board cards
- `.data-item` - Analytics data rows (scheduled reports, metric alerts)
- `.vital-card` - Core web vitals cards
- `.bundle-item` - Bundle analysis items

**Rule:** Shadows appear on the main dark container, not on the lighter grey child elements inside.

### Spacing Hierarchy (Admin + Client Portal)

Both admin and client portal use **identical spacing** for consistency:

#### Container Padding

```css
.dashboard-content {
  padding: 0 clamp(0.75rem, 2vw, 1.5rem) clamp(0.75rem, 2vw, 1.5rem);
}
```

#### Section-Level Spacing (`--space-3` = 24px)

All major sections/cards on a page use `--space-3` gap:

```css
/* Tab content children spacing */
.tab-content.active > * + * {
  margin-top: var(--space-3);
}

/* Portal view content container */
[data-page="client-portal"] #portal-view-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
```

**Files using `--space-3` section gap:**

- `layout.css` - `#portal-view-content`, `.tab-content.active`
- `dashboard.css` - `.project-progress-section`, `.loading-state`
- `settings.css` - `.settings-grid`
- `requests.css` - `.requests-grid`
- `invoices.css` - `.invoice-summary`
- `files.css` - `.files-container`
- `questionnaires.css` - `.cp-questionnaires-grid`

#### Internal Spacing (`--space-2` = 16px)

Within sections, between related items:

```css
.card-content > * + * {
  margin-top: var(--space-2);
}
```

#### Tight Spacing (`--space-1` = 8px)

Within components, minimal gaps:

```css
.button-group {
  gap: var(--space-1);
}
```

#### Mobile Reduced Padding (400px and below)

```css
@media (max-width: 400px) {
  .dashboard-content {
    padding-left: var(--space-1);
    padding-right: var(--space-1);
  }
}
```

**CRITICAL:** Do NOT add extra horizontal padding to individual views. All views inherit `.dashboard-content` padding.

### Admin Table Structure

Admin tables follow a consistent wrapper hierarchy for proper styling and corner radius handling:

```html
<!-- Standard table structure (no pagination) -->
<div class="admin-table-card portal-shadow">
  <div class="admin-table-header">
    <h3>Table Title</h3>
  </div>
  <div class="admin-table-container">
    <div class="admin-table-scroll-wrapper">
      <table class="admin-table">...</table>
    </div>
  </div>
</div>

<!-- With pagination (pagination OUTSIDE scroll-wrapper, sibling of container) -->
<div class="admin-table-card portal-shadow">
  <div class="admin-table-header">...</div>
  <div class="admin-table-container">
    <div class="admin-table-scroll-wrapper">
      <table class="admin-table">...</table>
    </div>
  </div>
  <!-- Pagination is sibling of admin-table-container -->
  <div class="table-pagination">...</div>
</div>
```

**Corner radius handling:**

- `.admin-table-card` - Gets shadow via `.portal-shadow`, top corners from header
- `.admin-table-container` - Transparent background, handles overflow
- `.admin-table-scroll-wrapper` - Gets `--border-radius-card` on bottom corners (when no pagination)
- `.table-pagination` - Gets `--border-radius-card` on bottom corners when present
- When pagination exists, scroll-wrapper loses bottom radius via `:has()` selector

**IMPORTANT:** Pagination must be OUTSIDE `.admin-table-scroll-wrapper` and OUTSIDE `.admin-table-container`, but INSIDE `.admin-table-card`. This ensures proper border-radius rendering.

```css
/* Scroll-wrapper handles bottom corners */
.admin-table-scroll-wrapper {
  background: var(--portal-bg-dark);
  border-bottom-left-radius: var(--border-radius-card);
  border-bottom-right-radius: var(--border-radius-card);
}

/* When pagination exists, it handles bottom corners instead */
.admin-table-card:has(.table-pagination) .admin-table-scroll-wrapper {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.table-pagination {
  border-radius: 0 0 var(--border-radius-card) var(--border-radius-card);
}

/* Table itself is transparent (cells have background) */
.admin-table {
  background: transparent;
}
```

### Portal Modal Structure

All dynamically-created modals use `createPortalModal()` from `src/components/portal-modal.ts`. This provides consistent structure and behavior.

**CSS Classes (active):**

```css
.modal-overlay      /* Fixed backdrop, z-index: var(--z-index-portal-modal) */
.modal-content      /* Modal container, max-width: var(--modal-width-md) */
.modal-header       /* Title and close button */
.modal-body         /* Scrollable content area */
.modal-footer       /* Action buttons */
.modal-close        /* Close button */
```

**CSS Classes (deprecated - pending removal):**

```css
.admin-modal-overlay  /* Legacy - still used by static HTML modals */
.admin-modal          /* Legacy - still used by static HTML modals */
.admin-modal-*        /* Legacy - will be removed after static modal migration */
```

**Pattern:** Use `createPortalModal()` for all new modals. See `MODALS_AUDIT.md` for full documentation.

### Labels (meta-label, field-label)

```css
font-size: 0.75rem;
color: var(--portal-text-secondary);
text-transform: uppercase;
letter-spacing: 0.05em;
font-weight: 500;
```

### Table Cells

```css
padding: var(--space-3) var(--space-4);
background: var(--portal-bg-dark);
font-size: var(--font-size-sm);
height: 48px;
/* Hover: rgba(255, 255, 255, 0.08) */
```

### Status Dots

```css
width: 8px;
height: 8px;
border-radius: 50%;
background-color: var(--color-status-*);
```

**Spacing:** Use `gap: var(--space-1)` (8px) between dot and text in all status indicators (`.status-indicator`) and table dropdowns.

### Icon Buttons

```css
/* Desktop */
width: 36px; height: 36px;
/* Icon: 18x18 */

/* Mobile */
width: 28px; height: 28px;
/* Icon: 16x16 */

background: transparent;
/* Hover: color: var(--color-primary) */
```

### Dropdown Triggers

**Table Dropdowns** (32px compact, for table cells):

```css
display: flex;
justify-content: space-between;
padding: var(--space-2) var(--space-3);
height: 32px;
border: 2px solid transparent;
border-radius: var(--portal-radius-lg);
/* Hover/Focus/Open: border-color: var(--color-primary) */
```

**Modal Dropdowns** (48px, matches form inputs):

```css
display: flex;
justify-content: space-between;
padding: 0 16px;
height: 48px;
background-color: var(--color-black);
border: 1px solid transparent;
border-radius: var(--portal-radius-lg);
/* Hover/Focus/Open: border-color: var(--color-primary) */
/* Open: top corners rounded, bottom flat, connects to menu */
```

**Key Difference:** Table dropdowns are compact (32px) with transparent background. Modal dropdowns are taller (48px) with black background to match form input styling.

### Section Headings (h3 in tabs)

```css
font-family: var(--font-family-acme);
font-size: 1.2rem;
text-transform: uppercase;
letter-spacing: 0.05em;
color: var(--portal-text-light);
```

---

## Design System

The design system provides the foundational tokens for the entire application.

### Token Architecture

| Token File | Lines | Purpose |
| ---------- | ----- | ------- |
| `tokens/colors.css` | 381 | Complete color system with semantic tokens |
| `tokens/typography.css` | 283 | Type scale with fluid `clamp()` values |
| `tokens/spacing.css` | 437 | Spacing scale and utility classes |
| `tokens/animations.css` | 455 | Duration, easing, and keyframes |
| `tokens/shadows.css` | 218 | Elevation system with component shadows |
| `tokens/borders.css` | 200 | Border radius values |
| `tokens/breakpoints.css` | 536 | Responsive breakpoints |
| `tokens/z-index.css` | 305 | Stacking context tokens |

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
@import './styles/components/form-fields.css';

/* Then client portal (modular directory) */
@import './styles/client-portal/index.css';

/* Finally mobile overrides */
@import './styles/mobile/index.css';
```

---

## Standardized Components

The Client Portal CSS defines standardized component classes in `src/styles/client-portal/components.css` using the `.portal-` prefix for consistency across all views.

### Component: Card

Use for any content container/section:

```css
/* src/styles/client-portal/components.css */
.portal-card {
  background: var(--color-neutral-200);
  border: 4px solid #000000;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.portal-card:last-child {
  margin-bottom: 0;
}
```

### Component: Card Header

Use for section titles within cards:

```css
/* src/styles/client-portal/components.css */
.portal-card-header {
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

Button classes are defined in `shared/portal-buttons.css`:

```css
/* src/styles/shared/portal-buttons.css */
.portal-btn {
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

.portal-btn:hover {
  background: var(--color-primary);
  color: var(--color-dark);
}
```

### Component: Form Input

Standardized form inputs:

```css
/* src/styles/client-portal/components.css */
.portal-input {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-neutral-100);
  border: 2px solid var(--color-dark);
  border-radius: 4px;
  color: var(--color-dark);
  font-size: 1rem;
}

.portal-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}
```

### Component: Badge/Status

Status indicators:

```css
/* src/styles/client-portal/components.css */
.portal-badge {
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
/* src/styles/client-portal/components.css */
.portal-stat {
  background: var(--color-neutral-100);
  border: 4px solid #000000;
  padding: 1.5rem;
  text-align: center;
}

.portal-stat-number {
  font-size: 2rem;
  font-weight: 700;
  display: block;
}

.portal-stat-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
```

---

## CSS Variables

### Core Variables (defined in `variables.css`)

#### Layout

| Variable | Purpose | Default |
| -------- | ------- | ------- |
| `--size-container` | Max container width | `min(1200px, 100vw - 2rem)` |
| `--container-padding` | Container padding | `clamp(1rem, 4vw, 2rem)` |
| `--gap` | Default spacing | `clamp(0.75rem, 3vw, 1.5rem)` |
| `--section-padding` | Section padding | `clamp(1rem, 5vw, 2rem)` |
| `--header-height` | Header height | `60px` |
| `--footer-height` | Footer height | `40px` |

#### Typography

| Variable | Purpose | Default |
| -------- | ------- | ------- |
| `--font-size-xs` | Extra small text | `clamp(0.75rem, 2vw, 0.875rem)` |
| `--font-size-sm` | Small text | `clamp(0.875rem, 2.5vw, 1rem)` |
| `--font-size-base` | Base text | `clamp(1rem, 3vw, 1.125rem)` |
| `--font-size-lg` | Large text | `clamp(1.125rem, 3.5vw, 1.25rem)` |
| `--font-size-xl` | Extra large text | `clamp(1.25rem, 4vw, 1.5rem)` |
| `--font-size-2xl` | 2x large text | `clamp(1.5rem, 5vw, 2rem)` |
| `--font-size-3xl` | 3x large text | `clamp(2rem, 6vw, 3rem)` |

#### Icon Sizes

Standardized icon dimensions for consistent sizing:

| Variable | Value | Usage |
| -------- | ----- | ----- |
| `--icon-size-xs` | 12px | Compact mobile icons |
| `--icon-size-sm` | 14px | Small icons (view toggles, search) |
| `--icon-size-md` | 16px | Standard icons (table actions) |
| `--icon-size-lg` | 20px | Large icons (dropdown triggers) |
| `--icon-size-xl` | 24px | Extra large icons (clear buttons) |
| `--icon-size-2xl` | 32px | Dialog/modal icons |

#### Letter Spacing

Standardized tracking values:

| Variable | Value | Usage |
| -------- | ----- | ----- |
| `--letter-spacing-label` | 0.05em | Labels, headings, buttons |
| `--letter-spacing-title` | 0.02em | Titles, card headers |
| `--letter-spacing-wide` | 0.08em | Wide tracking (section titles) |

#### Spacing

Design tokens from `src/design-system/tokens/spacing.css` (8px base grid):

| Variable | Value | Pixels |
| -------- | ----- | ------ |
| `--space-0-5` | `calc(var(--space-base) * 0.5)` | 4px |
| `--space-1` | `var(--space-base)` | 8px |
| `--space-1-5` | `calc(var(--space-base) * 1.5)` | 12px |
| `--space-2` | `calc(var(--space-base) * 2)` | 16px |
| `--space-3` | `calc(var(--space-base) * 3)` | 24px |
| `--space-4` | `calc(var(--space-base) * 4)` | 32px |
| `--space-6` | `calc(var(--space-base) * 6)` | 48px |
| `--space-8` | `calc(var(--space-base) * 8)` | 64px |

Fluid variants available: `--space-fluid-xs` through `--space-fluid-2xl` with `clamp()` values.

#### Animations

| Variable | Purpose | Default |
| -------- | ------- | ------- |
| `--cubic-default` | Default easing | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-fast` | Fast transition | `0.2s ease` |
| `--transition-medium` | Medium transition | `0.3s ease` |
| `--transition-slow` | Slow transition | `0.6s ease` |

#### Z-Index Token System

**Main site (0-999):**

| Variable | Value |
| -------- | ----- |
| `--z-index-dropdown` | 100 |
| `--z-index-modal` | 500 |
| `--z-index-toast` | 800 |
| `--z-index-max` | 999 |

**Portal/Admin (9000-9900):**

| Variable | Value |
| -------- | ----- |
| `--z-index-portal-base` | 9000 |
| `--z-index-portal-header` | 9100 |
| `--z-index-portal-sidebar` | 9200 |
| `--z-index-portal-overlay` | 9500 |
| `--z-index-portal-modal` | 9600 |
| `--z-index-portal-dropdown` | 9700 |
| `--z-index-portal-toast` | 9800 |
| `--z-index-portal-confirm` | 9900 |

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

#### Client Portal Components (`portal-` prefix)

Classes for the authenticated client portal use the `portal-` prefix. Located in `src/styles/client-portal/components.css`.

#### Navigation Portal (`portal-` prefix with nav scope)

Classes for the header portal dropdown (login/register toggle) are scoped within navigation. Located in `src/styles/components/nav-portal.css`.

#### Intake Modal (`intake-` prefix)

Classes for the terminal intake modal use the `intake-` prefix. Also in `nav-portal.css`.

### Client Portal Component Classes (`portal-`)

| Class | Purpose |
| ----- | ------- |
| `.portal-shadow` | Intense multi-layer shadow utility |
| `.portal-panel` | Content panel container |
| `.portal-card` | Content container card |
| `.portal-card-header` | Section title in card |
| `.portal-input` | Form input field |
| `.portal-form-group` | Form field wrapper |
| `.portal-form-row` | Horizontal form layout |
| `.portal-password-wrapper` | Password field with toggle |
| `.portal-password-toggle` | Password visibility button |
| `.portal-list-item` | List item container |
| `.portal-item-actions` | Action buttons for list items |
| `.portal-badge` | Status badge |
| `.portal-badge-pending` | Pending status variant |
| `.portal-badge-success` | Success status variant |
| `.portal-stat` | Stat card |
| `.portal-stat-number` | Stat value display |
| `.portal-stat-label` | Stat description |
| `.portal-empty-message` | Empty state message |

### Navigation Portal Classes (`portal-`)

| Class | Purpose |
| ----- | ------- |
| `.portal-button` | Header portal trigger button |
| `.portal-backdrop` | Semi-transparent overlay behind dropdown |
| `.portal-dropdown` | Login/register dropdown panel |
| `.portal-dropdown-header` | Dropdown title area |
| `.portal-toggle-btn` | Login/register tab toggle |
| `.portal-dropdown-form` | Form container in dropdown |

### Intake Modal Classes (`intake-`)

| Class | Purpose |
| ----- | ------- |
| `.intake-modal-backdrop` | Full-screen modal overlay |
| `.intake-modal` | Terminal intake modal container |
| `.intake-modal-close` | Modal close button |
| `.intake-modal-container` | Inner content wrapper |

### Shadow Utility Class

```css
/* src/styles/client-portal/components.css */
.portal-shadow {
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

Project cards in the client portal use scoped classes to avoid conflicts with `.project-card` in `pages/projects.css`:

```css
/* src/styles/client-portal/dashboard.css */
/* Project cards use portal-prefixed classes */
.portal-project-cards {
  display: block;
  margin-bottom: 1rem;
}

.portal-project-card {
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
| ----- | ----- |
| `.btn` | Base button styles |
| `.btn-primary` | Primary actions |
| `.btn-secondary` | Secondary actions |
| `.btn-outline` | Outlined buttons |
| `.btn-sm` | Small button size |

### Form Classes

| Class | Usage |
| ----- | ----- |
| `.form-input` | Text inputs |
| `.form-select` | Dropdown selects |
| `.form-textarea` | Text areas |
| `.form-group` | Form field wrapper |
| `.form-label` | Field labels |

### Layout Classes

| Class | Usage |
| ----- | ----- |
| `.container` | Max-width centered container |
| `.container-fluid` | Full-width container |
| `.grid` | CSS Grid container |
| `.flex` | Flexbox container |

### Status Classes

| Class | Usage | Colors |
| ----- | ----- | ------ |
| `.status-badge` | Status indicator base | - |
| `.status-pending` | Yellow pending status | `#fef3c7` / `#92400e` |
| `.status-paid` | Green paid status | `#d1fae5` / `#065f46` |
| `.status-overdue` | Red overdue status | `#fee2e2` / `#991b1b` |
| `.status-draft` | Gray draft status | neutral-200 |

### Table Filter Components

| Class | Usage |
| ----- | ----- |
| `.table-filter-controls` | Container for filter controls |
| `.filter-search` | Search input wrapper |
| `.filter-search-icon` | Search icon inside dropdown (positioned absolute left) |
| `.filter-search-input` | Search input field (padding-left for icon) |
| `.filter-dropdown-menu` | Dropdown menu for filter options |
| `.filter-date-group` | Date range filter wrapper |

#### Filter Search with Icon Pattern

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

### Table Column Sizing Classes

Column classes control width and spacing for consistent table layouts.

| Class | Purpose | Width/Spacing |
| ----- | ------- | ------------- |
| `.status-col` / `.status-cell` | Status dropdown columns | fit-content |
| `.date-col` / `.date-cell` | Date columns | fit-content + `padding-right: var(--space-6)` |
| `.actions-col` / `.actions-cell` | Action button columns | 140px fixed, right-aligned (cells only) |
| `.type-col` / `.type-cell` | Type indicator columns | fit-content + `padding-right: var(--space-8)` |
| `.budget-col` / `.budget-cell` | Budget/amount columns | fit-content + `padding-right: var(--space-8)` |
| `.timeline-col` / `.timeline-cell` | Timeline display columns | fit-content + `padding-right: var(--space-8)` |
| `.count-col` / `.count-cell` | Numeric count columns | fit-content, centered |
| `.email-col` / `.email-cell` | Email address columns | fit-content + `padding-right: var(--space-12)` |
| `.contact-col` / `.contact-cell` | Contact/client name columns | min-width: 200px |
| `.name-col` / `.name-cell` | Name columns | `padding-right: var(--space-8)` |

#### Fit-Content Pattern

```css
/* Apply to both header and cells */
.admin-table .status-cell,
.admin-table th.status-col {
  width: 1%;
  white-space: nowrap;
}
```

**Why `width: 1%`?** This forces the column to shrink to the minimum width needed to display content. Combined with `white-space: nowrap`, the column fits its content exactly without wrapping.

**Usage:** Add `.status-col` (etc.) to `<th>` elements in HTML, and `.status-cell` (etc.) to `<td>` elements in TypeScript row rendering.

### Table Dropdown Sizing

Table dropdowns (status selectors, filters) have a minimum width of 115px to accommodate the longest status text plus caret icon.

```css
.table-dropdown {
  min-width: 115px;
  width: fit-content;
}
```

### Sortable Header Icons

Sort icons in table headers are right-aligned using absolute positioning:

```css
.admin-table th.sortable {
  position: relative;
  padding-right: calc(var(--space-4) + 20px); /* Space for icon */
}

.admin-table th.sortable .sort-icon {
  position: absolute;
  right: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
}
```

---

## Responsive Design

### Breakpoint Variables

```css
@custom-media --small-mobile (max-width: 479px);
@custom-media --compact-mobile (max-width: 600px);
@custom-media --mobile (max-width: 767px);
@custom-media --tablet (min-width: 768px);
@custom-media --tablet-landscape (max-width: 900px);
@custom-media --tablet-down (max-width: 991px);
@custom-media --desktop (min-width: 992px);
@custom-media --laptop (max-width: 1024px);
@custom-media --wide (min-width: 1200px);
@custom-media --wide-down (max-width: 1300px);
@custom-media --ultra-wide (min-width: 1400px);
```

### Responsive Table Column Stacking

To prevent horizontal scroll on admin tables at smaller viewports, columns are progressively stacked:

**Pattern:** Data is duplicated in HTML (one visible column, one hidden stacked element). CSS shows/hides based on breakpoint.

**Breakpoints:**

| Width | Tables Affected | Action |
|-------|-----------------|--------|
| `1280px` | Leads, Projects | Hide Budget column, show stacked under Type |
| `1280px` | Contacts | Hide Email column, show stacked under Contact |
| `1100px` | Leads | Hide Date column, show stacked above Status |

**HTML Pattern (TypeScript renderer):**

```html
<!-- Type cell with stacked budget (hidden by default) -->
<td class="type-cell">
  <span class="type-value">Business-site</span>
  <span class="budget-stacked">$2.5k-$5k</span>
</td>
<!-- Separate budget cell (hidden at smaller breakpoints) -->
<td class="budget-cell">$2.5k-$5k</td>
```

**CSS Pattern:**

```css
/* Hidden by default */
.admin-table .budget-stacked,
.admin-table .email-stacked,
.admin-table .date-stacked {
  display: none;
  font-size: var(--font-size-sm);
  color: var(--portal-text-muted);
}

/* Show stacked, hide separate column at breakpoint */
@media (max-width: 1280px) {
  .leads-table th.budget-col,
  .leads-table td.budget-cell {
    display: none;
  }
  .leads-table .type-cell .budget-stacked {
    display: block;
  }
}
```

**Mobile Override (479px and below):**

On mobile, tables transform to card view showing all cells as blocks. Stacked elements must be hidden to prevent duplicates:

```css
@media (--small-mobile) {
  [data-page="admin"] .admin-table .budget-stacked,
  [data-page="admin"] .admin-table .email-stacked,
  [data-page="admin"] .admin-table .date-stacked {
    display: none !important;  /* Override 1280px/1100px rules */
  }
}
```

**Mobile Card Cell Ordering:**

On mobile (479px and below), table rows transform into stacked cards using CSS flexbox with `order` property. Order matches desktop column layout for consistency.

| Order | Cell Types | Color | Purpose |
| :---: | ---------- | ----- | ------- |
| -2 | `.identity-cell`, `.contact-cell`, `.name-cell` | `--portal-text-light` | Primary name |
| 1 | `.type-cell` | `--portal-text-secondary` | Category |
| 2 | `.status-cell` | - | Status dropdown |
| 3 | `.budget-cell`, `.count-cell` | `--portal-text-secondary` | Financial/count |
| 4 | `.timeline-cell`, `.message-cell` | `--portal-text-muted` / `--portal-text-secondary` | Details |
| 5 | `.email-cell` | `--portal-text-muted` | Contact info |
| 6 | `.date-cell` | `--portal-text-muted` | Dates |
| 10 | `.actions-cell` | - | Action buttons |

**Files:**

- CSS: `src/styles/pages/admin.css`
- TypeScript: `admin-leads.ts`, `admin-contacts.ts`, `admin-projects.ts`, `admin-clients.ts`

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

### Login Page Mobile Styles

On mobile (≤600px), login containers use transparent backgrounds and no shadows for seamless integration with the page background:

```css
/* Both admin and client portal login pages */
@media (max-width: 600px) {
  .auth-gate-container {
    max-width: 100%;
    width: 100%;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
}
```

**Files:**

- `src/styles/admin/auth.css` - Admin login
- `src/styles/client-portal/login.css` - Client portal login

---

## Naming Conventions

### General Rules

1. **Lowercase with hyphens**: `stat-card`, `message-thread`
2. **BEM-like structure**: `block__element--modifier`
3. **Prefix for scoped styles**: `portal-` for portal components

### Portal Naming Conventions

- **Class prefix:** Use **`portal-`** for portal-only components (e.g. `.portal-card`, `.portal-btn`, `.portal-badge`) to avoid clashes with main site.
- **CSS variables:** Use **`--portal-*`** for portal-only tokens (text, background, border, radius, spacing) defined under `[data-page="client-portal"], [data-page="admin"]`.
- **Scoping:** For page-specific overrides, scope under `[data-page="admin"]` or `[data-page="client-portal"]` (e.g. in `pages/admin.css` or admin/portal modules).
- **Icons:** Use Lucide icons only; no emojis in UI (per project rules).

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

/* Portal scoped */
.portal-project-card { }
```

---

## File Organization

### Directory Structure

```text
src/styles/
├── admin/           # Admin portal (22 files)
├── base/            # Foundation (6 files)
├── bundles/         # Entry points (4 files)
├── client-portal/   # Client portal (12 files)
├── components/      # Reusable (14 files)
├── mobile/          # Mobile-specific (3 files)
├── pages/           # Page-specific (9 files)
├── shared/          # Shared portal (19 files)
└── variables.css    # CSS variables
```

### Client Portal Files (`src/styles/client-portal/`) — 12 files

| File | Purpose |
| ---- | ------- |
| `index.css` | Orchestrator: shared portal CSS + base components + layout + views |
| `components.css` | `.portal-*` reusable components (cards, inputs, badges, stats, etc.) |
| `layout.css` | Dashboard layout, containers |
| `sidebar.css` | Sidebar navigation (shared with admin) |
| `login.css` | Login form |
| `dashboard.css` | Stats, activity, project cards |
| `documents.css` | Document requests |
| `files.css` | File upload/management |
| `help.css` | Help/knowledge base articles |
| `invoices.css` | Invoice display |
| `projects.css` | Project navigation, details |
| `settings.css` | Settings, account views |

### Admin Files (`src/styles/admin/`) — 22 files

| File | Purpose |
| ---- | ------- |
| `index.css` | Orchestrator: shared portal CSS + client-portal layout/sidebar + admin modules |
| `analytics.css` | Analytics dashboard |
| `auth.css` | Admin authentication |
| `client-detail.css` | Client detail views |
| `detail-header.css` | Shared detail page headers |
| `document-requests.css` | Document requests management |
| `files.css` | Admin file management |
| `knowledge-base.css` | Knowledge base management |
| `leads-pipeline.css` | Leads pipeline |
| `modal-dropdown.css` | Modal form dropdowns (48px height, matches form inputs) |
| `modals.css` | Admin modals (`.modal-*` active, `.admin-modal-*` deprecated) |
| `pd-contract.css` | Project detail: contract tab styles |
| `pd-invoices.css` | Project detail: invoices tab styles |
| `project-detail.css` | Project detail (including messaging UI) |
| `proposals.css` | Proposals |
| `sidebar-badges.css` | Sidebar notification badges |
| `table-dropdowns.css` | Inline table status dropdowns (32px compact) |
| `table-features.css` | Table row features (actions, selection) |
| `table-filters.css` | Table filter controls + sortable headers |
| `tasks.css` | Task list / project tasks |
| `tooltips.css` | CSS-only tooltips using data-tooltip |
| `workflows.css` | Approvals and triggers |

### Shared Portal Styles (`src/styles/shared/`) — 19 files

Used by both admin and client portal:

| File | Purpose |
| ---- | ------- |
| `confirm-dialog.css` | Confirmation dialogs |
| `copy-email.css` | Copy email button component |
| `details-card.css` | Detail view card styles |
| `field-label-spacing.css` | Form field label spacing |
| `portal-badges.css` | Status badges |
| `portal-buttons.css` | Button hierarchy (sidebar link-style, primary, secondary, icon-only, destructive) |
| `portal-cards.css` | Card / stat card styles |
| `portal-components.css` | Extra shared components |
| `portal-dropdown.css` | Dropdown menus |
| `portal-files.css` | File upload components |
| `portal-forms.css` | Form styles |
| `portal-layout.css` | Portal layout utilities |
| `portal-messages.css` | Messaging UI |
| `portal-tabs.css` | Tabs |
| `progress.css` | Progress indicators |
| `search-bar.css` | Search bar component |
| `toast-notifications.css` | Toast notifications |
| `view-toggle.css` | View toggle (Kanban/List) |
| `wireframe.css` | Wireframe mode (greyscale) |

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
- Prefix scoped styles with `portal-` to avoid conflicts
- Use semantic class names
- Group related styles together
- Add comments for complex selectors
- Use the standardized portal- component classes defined in `client-portal/components.css`

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

## !important Usage Policy

All `!important` declarations in the codebase are legitimate and necessary. Current count: ~65 instances.

### Legitimate Use Categories

#### 1. Accessibility - Reduced Motion

Users who prefer reduced motion must have animations disabled regardless of other CSS rules. Found in:

- `design-system/tokens/shadows.css`
- `design-system/tokens/animations.css`
- `base/reset.css`
- `variables.css`
- `components/page-transitions.css`
- `components/business-card.css`
- `components/portfolio-carousel.css`
- `components/nav-animations.css`
- `components/nav-base.css`
- `pages/contact.css`
- `pages/client-portal-section.css`

#### 2. Print Styles

Print media requires overriding all screen styles for clean output. Found in:

- `design-system/tokens/breakpoints.css`
- `base/reset.css`
- `variables.css`
- `components/nav-responsive.css`

#### 3. Accessibility - Focus Visibility

Keyboard focus must be visible regardless of component styling.

#### 4. Accessibility - High Contrast

High contrast mode requires enhanced visual boundaries.

#### 5. Browser Autofill Override

Browsers apply inline styles for autofilled inputs that can only be overridden with `!important`.

#### 6. Utility Classes

Global utility classes (`.hidden`, `.no-transition`, `.force-transition`) must win over any component styles.

#### 7. Animation State Lock

GSAP animation requires initial state to be locked during intro.

#### 8. Modal Scroll Lock

`body.modal-open { overflow: hidden }` prevents scroll behind modals.

#### 9. Chart.js Inline Style Overrides

Chart.js sets inline styles on legend elements that require `!important` to override.

#### 10. Collapsed Sidebar Text Hiding

When sidebar is collapsed (manually via `.collapsed` class or via media query auto-collapse), button text must be hidden regardless of base styles. Found in:

- `shared/portal-buttons.css` - `.btn-text { display: none !important }` ensures text is always hidden when:
  - `.sidebar.collapsed` class is present (manual collapse)
  - `@media (--wide-down)` auto-collapse triggers (viewport ≤1300px)
  - `@media (--compact-mobile)` mobile auto-collapse triggers (viewport ≤600px)

**Why `!important`:** The base button styles set `overflow: visible` and flex properties that could allow text to overflow and show truncated. The `!important` ensures text is completely hidden regardless of any inherited or competing styles.

### Specificity Solutions Reference

When avoiding `!important`, use these techniques:

1. **CSS Cascade Layers** - `@layer` in main.css controls cascade order
2. **Scoped Styles** - `body[data-page="admin"]` prefix for page-specific overrides
3. **Element Type Prefixes** - `section.class-name`, `div.class-name` for +1 specificity
4. **Doubled Class Selectors** - `.modal.modal` for +1 class specificity
5. **Parent Context Selectors** - `.section .wrapper .element` for nested overrides
6. **Page-States Layer** - `page-states` layer for transition state overrides

---

## Portal Button Design

Portal buttons follow a clear hierarchy so the sidebar reads as links and content actions are scannable.

**Implementation:** `src/styles/shared/portal-buttons.css`

### 1. Sidebar navigation — link-style (no buttons)

**Where:** `.sidebar-buttons .btn`, `.sidebar-footer .btn-logout` (admin + client portal)

**Look:** No background, no shadow, no border. Icon + text (or icon-only when collapsed). Hover and active = primary color on text and icon. Same clean look in both expanded and collapsed states.

**Why:** Collapsed state was already minimal; expanded is now consistent so the sidebar reads as navigation links, not a stack of buttons.

**Implementation:** `portal-buttons.css` — "SIDEBAR NAV - LINK STYLE" and "LOGOUT BUTTON" sections.

### 2. Primary action — one per screen or section

**Where:** Main submit / CTA per view (e.g. "Save", "Create project", "Send message").

**Look:** Transparent background, primary-colored text. On hover: primary background, dark text. Single clear CTA so it stands out.

**Classes:** `.btn-primary`, `button[type="submit"]` (in portals).

**Use:** One primary action per form or section. Avoid multiple primary buttons in the same block.

### 3. Secondary / default — content actions

**Where:** Cancel, back, secondary actions, table row actions that are not primary.

**Look:** Same base as primary but not emphasized; transparent, light text; hover = primary background. Visually lighter than primary.

**Classes:** `.btn`, `.btn-secondary` (in portals).

**Use:** All other actionable buttons in content (cards, modals, tables) that are not the single primary CTA.

### 4. Icon-only — toolbars and compact UI

**Where:** Table header (filter, search, export), message compose actions, inline row actions.

**Look:** Icon only, no label. Minimal padding, no heavy shadow. Hover = primary color on icon.

**Classes:** `.icon-btn` (and variants like `.filter-search-trigger`, `.filter-dropdown-trigger`).

**Use:** Toolbars, filters, search triggers, repeat actions where space is tight or the icon is well understood.

### 5. Destructive — remove or delete

**Where:** Delete project, remove item, revoke access.

**Look:** Danger color (red) on hover or as accent; optional light danger background. Clearly distinct from primary.

**Use:** Any action that removes data or is hard to undo. Prefer icon + label ("Delete") or at least an explicit label.

### Button Usage Summary

| Context | Style | Example |
| ------- | ----- | ------- |
| Sidebar nav | Link-style | Dashboard, Leads, Projects, Sign out |
| Page/section CTA | Primary | Save settings, Create project |
| Cancel / back / other | Secondary | Cancel, Back, View details |
| Table header / tools | Icon-only | Filter, Search, Export |
| Delete / remove | Destructive | Delete project, Remove item |

### Button implementation notes

- **Single source of truth:** Portal button and sidebar styles live in `src/styles/shared/portal-buttons.css`.
- **Design tokens:** Use `--color-primary`, `--portal-bg-dark`, `--portal-text-light`, and shadow variables from the design system.
- **No duplicate rules:** Avoid defining button look in page-specific CSS; override only when a documented exception is needed.

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
  padding: var(--space-2);
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

## Focus States

Focus states provide visual feedback for keyboard navigation and accessibility. The portal uses consistent focus patterns across components.

### Standard Focus Pattern

```css
/* Primary focus indicator - used on most interactive elements */
:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}
```

### Portal Input Focus

```css
.portal-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}
```

### Table Dropdown Focus

Table dropdowns use a red border on focus as an intentional visual indicator (not an error state):

```css
/* admin/table-dropdowns.css */
.table-dropdown:focus,
.table-dropdown:focus-within {
  border-color: var(--color-primary);
  outline: none;
}
```

### Button Focus

```css
/* Portal buttons */
.portal-btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.3);
}

/* Icon buttons */
.icon-btn:focus {
  outline: none;
  color: var(--color-primary);
}
```

### Focus-Visible (Keyboard Only)

For elements where focus rings should only appear on keyboard navigation:

```css
/* base/reset.css */
:focus-visible {
  box-shadow: 0 0 0 2px inset var(--color-brand-primary) !important;
}
```

### Focus State Guidelines

| Component Type | Focus Style |
| -------------- | ----------- |
| Text inputs | Red border + subtle glow (`box-shadow: 0 0 0 3px rgba(...)`) |
| Dropdowns | Red border, no glow |
| Buttons | Glow only (no border change) |
| Icon buttons | Color change to primary |
| Links | Underline + color change |
| Table rows | Background highlight |

---

## Intentional Non-Standard Patterns

These components use non-standard styling **by design**. Do NOT attempt to standardize.

| Component | File | Reason |
| --------- | ---- | ------ |
| Sidebar spacing | `pages/admin.css` | Tighter gaps (0.5rem buttons, 1rem content) to fit all nav items without overflow |
| Sidebar buttons | `shared/portal-buttons.css` | Link-style (no bg/border/shadow) differs from standard buttons |
| Messages layout | `shared/portal-messages.css` | Unique two-panel layout with light backgrounds; differs from dark portal theme |
| Lead details email copy | `admin/leads-pipeline.css` | Uses `display: inline` for `.meta-value-with-copy` to match vertical alignment of other meta-values |
| Breadcrumb spacing | `client-portal/layout.css` | Extra padding on `.primary-header-row` for visual breathing room |
| Dropdown focus state | `admin/table-dropdowns.css` | Red border on focus is intentional visual indicator (not an error state) |
| Client portal status badge | `client-portal/dashboard.css` | Text-only badges in project cards (scoped to `.project-status .status-badge`) |
| Admin form inputs | `admin/project-detail.css` | Adds `background-color: var(--color-black)` and thicker focus borders on top of shared base styles |

---

## Design System Audits

### Latest Audit: February 9, 2026

**Full Report:** [CSS_AUDIT_2026-02-09.md](./CSS_AUDIT_2026-02-09.md)

**Summary:** Comprehensive audit of 93 CSS files for design system compliance.

**Key Findings:**

| Issue | Count | Status |
|-------|-------|--------|
| Hardcoded `white`/`black` keywords | 15 | ✅ HIGH priority - fix immediately |
| Hardcoded transitions | 120+ | 🔄 MEDIUM priority - systematic replacement |
| Hardcoded border-radius | 40+ | 🔄 MEDIUM priority - token migration |
| Hardcoded rgba() UI colors | 12 | 🔄 MEDIUM priority - variable replacement |
| Non-portal tokens in portal context | 10+ | 🔄 MEDIUM priority - audit portal pages |

**Compliance Status:**

- ✅ All CSS variables properly defined
- ✅ Critical `--portal-bg-lighter` variable added
- ✅ All `#fff`/`#000` hardcoded colors replaced
- ✅ Set password form refactored to use portal tokens
- 🔄 Transition tokens migration in progress
- 🔄 Border-radius tokens migration in progress

**Files Modified (2026-02-09):** 16 files, ~150 lines changed

**Compliance Improvement:** 85% → 92%

**Next Steps:**

1. Replace remaining `color: white` with `var(--color-white)` (15 instances)
2. Systematic transition token replacement (120+ instances)
3. Border-radius token migration (40+ instances)
4. Document intentional exceptions (2px, 3px radius values)

---

## Related Documentation

- [Client Portal](../features/CLIENT_PORTAL.md) - Uses these styles
- [Messages](../features/MESSAGES.md) - Emoji picker styling
- [Settings](../features/SETTINGS.md) - Settings grid layout
- [All Feature Docs](../features/README.md) - Feature-specific styling
