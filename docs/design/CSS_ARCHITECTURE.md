# CSS Architecture

**Last Updated:** March 9, 2026

This document defines the CSS architecture, naming conventions, and design token system used throughout the application.

---

## Design Token System

All design tokens live in `src/design-system/tokens/`. The token index file (`src/design-system/tokens/index.css`) imports them in order:

1. `colors.css` - Color palette and semantic color tokens
2. `portal-theme.css` - Portal dark/light mode overrides (must follow colors)
3. `typography.css` - Font families, sizes, weights, line heights
4. `spacing.css` - Spacing scale (8px base grid), icon gaps, section spacing
5. `shadows.css` - Elevation system and component shadows
6. `borders.css` - Border widths, radius, and styles
7. `animations.css` - Easing curves, durations, component animation tokens
8. `breakpoints.css` - Responsive breakpoint tokens
9. `z-index.css` - Z-index layering scale
10. `buttons.css` - Portal button tokens (sizing, typography, colors)
11. `dimensions.css` - Sidebar widths, icon button sizes, content constraints

Additional variables live in `src/styles/variables.css`, which extends tokens with custom media queries, fluid spacing, shadow presets, and responsive breakpoints.

---

## CSS Variable Naming Conventions

The codebase uses several naming scopes, each with a distinct purpose.

### Shared / Global: `--color-*`

Defined in `src/design-system/tokens/colors.css`. Used across the entire application (main site and portals).

```css
/* Primitive palette */
--color-gray-50 through --color-gray-950
--color-brand-primary: #dc2626;

/* Semantic tokens - main site */
--color-bg-primary, --color-bg-secondary, --color-bg-tertiary
--color-text-primary, --color-text-secondary, --color-text-tertiary
--color-surface-primary, --color-surface-secondary
--color-border-primary, --color-border-secondary
--color-interactive-primary, --color-interactive-primary-hover

/* Functional colors */
--color-success-500, --color-warning-500, --color-error-500, --color-info-500

/* Shadow colors */
--color-shadow-sm, --color-shadow-md, --color-shadow-lg

/* Overlay colors */
--color-overlay-subtle, --color-overlay-light, --color-overlay-medium
```

### Portal: `--color-*` (portal-scoped overrides)

Defined in `src/design-system/tokens/portal-theme.css`. Scoped to `body[data-page="admin"]` and `body[data-page="client-portal"]` selectors. These override the global `--color-*` tokens for portal UI.

The entire portal theme derives from two primary variables:

```css
--color-text-primary   /* Dark: #ffffff / Light: #333333 */
--color-bg-primary     /* Dark: #000000 / Light: var(--color-off-white) */
```

All other portal colors are derived from these two using `color-mix()`:

```css
/* Text */
--color-text-secondary     /* Same as primary */
--color-text-tertiary      /* 60% text mixed into bg */
--color-text-inverse       /* Same as bg-primary */

/* Background ramp */
--color-bg-secondary       /* ~4% text into bg */
--color-bg-tertiary        /* ~10% text into bg */
--color-bg-elevated        /* ~16.5% text into bg */
--color-bg-input           /* ~23% text into bg */
--color-bg-hover           /* ~29% text into bg */

/* Borders */
--color-border-primary     /* Same as color-text-primary */
--color-border-secondary   /* 8% text mixed into transparent */

/* Alpha channels */
--portal-alpha-white-02 through --portal-alpha-white-50  /* color-mix derived */
--portal-alpha-black-04 through --portal-alpha-black-80  /* color-mix derived */
--portal-alpha-primary-08, --portal-alpha-primary-10, --portal-alpha-primary-20

/* Neutral scale */
--color-neutral-100 through --color-neutral-900  /* color-mix derived */

/* Hover/focus states */
--hover-bg-color, --hover-text-color, --hover-icon-color
--focus-ring-color, --focus-ring-width
```

### Status: `--status-*`

Defined in `src/design-system/tokens/colors.css`. Single source of truth for status colors used across both admin and client portals.

```css
--status-active: #3b82f6;         /* Blue - Active/In Progress */
--status-active-rgb: 59, 130, 246;
--status-active-bg: rgba(59, 130, 246, 0.15);

--status-pending: #fbbf24;        /* Yellow - Pending */
--status-completed: #10b981;      /* Green - Completed */
--status-cancelled: #ef4444;      /* Red - Cancelled */
--status-qualified: #8b5cf6;      /* Purple - Qualified/Review */
--status-inactive: #6b7280;       /* Gray - Inactive */
--status-new: #06b6d4;            /* Cyan - New */
--status-on-hold: #f97316;        /* Orange - On Hold */
```

Each status also has `--status-*-rgb` and `--status-*-bg` variants.

### Portal Buttons: `--portal-btn-*`

Defined in `src/design-system/tokens/buttons.css`. Scoped to portal pages.

```css
/* Sizing */
--portal-btn-padding, --portal-btn-min-height, --portal-btn-sm-*

/* Typography */
--portal-btn-font-family, --portal-btn-font-size, --portal-btn-text-transform

/* Colors (auto-invert in light mode) */
--portal-btn-bg, --portal-btn-color, --portal-btn-border
--portal-btn-hover-bg, --portal-btn-hover-color, --portal-btn-hover-border
--portal-btn-danger-bg, --portal-btn-danger-color, --portal-btn-danger-border
```

### App-Level Aliases: `--app-color-*`

Defined as aliases in `src/design-system/tokens/colors.css` (legacy section) and overridden in `portal-theme.css`. These bridge legacy code that references `--app-color-*` names.

```css
--app-color-primary     /* Maps to --color-brand-primary on main site, inverted in portal */
--app-color-primary-hover
--app-color-success, --app-color-warning, --app-color-danger, --app-color-info
```

New code should use the semantic tokens (`--color-*`, `--portal-*`, `--status-*`) directly.

### Other Token Prefixes

```css
/* Spacing (src/design-system/tokens/spacing.css) */
--space-0 through --space-32          /* Fixed 8px grid scale */
--icon-gap-xs through --icon-gap-xl   /* Icon-to-text gap scale */
--portal-section-gap                  /* 24px — gap between sections */
--dashboard-section-gap               /* 48px — dashboard major section gap */
--dashboard-grid-gap                  /* 24px — gap between dashboard cards */
--dashboard-card-gap                  /* 16px — gap within dashboard cards */
--dashboard-panel-gap                 /* 28px — gap between content areas */

/* Action button gaps (src/design-system/tokens/portal-theme.css) */
--action-btn-gap                      /* 8px — icon/action button cluster gap */
--table-actions-gap                   /* 8px — table row action button gap */

/* Typography (src/design-system/tokens/typography.css) */
--font-family-sans, --font-family-serif, --font-family-mono
--font-size-2xs through --font-size-5xl
--font-weight-light through --font-weight-extrabold
--line-height-none through --line-height-relaxed
--letter-spacing-tightest through --letter-spacing-widest

/* Z-Index (src/design-system/tokens/z-index.css) */
--z-index-dropdown: 100 through --z-index-max: 999
--z-index-portal-base: 9000 through --z-index-portal-confirm: 9900

/* Shadows (src/design-system/tokens/shadows.css) */
--shadow-xs through --shadow-2xl
--shadow-card-rest, --shadow-button-rest, --shadow-modal

/* Borders (src/design-system/tokens/borders.css) */
--border-width-0 through --border-width-8
--border-radius-none through --border-radius-full (all 0 for brutalist design)

/* Animations (src/design-system/tokens/animations.css) */
--easing-smooth, --easing-bounce, --easing-spring
--animation-button-hover, --animation-modal-enter

/* Dimensions (src/design-system/tokens/dimensions.css) */
--sidebar-width-open, --sidebar-width-collapsed
--icon-btn-size-sm through --icon-btn-size-xl
--tooltip-max-width, --form-container-max-width

/* Variables.css extends (src/styles/variables.css) */
--space-fluid-xs through --space-fluid-2xl   /* Responsive clamp() spacing */
--transition-faster through --transition-slower
--shadow-card, --shadow-content, --shadow-sidebar  /* Legacy shadow presets */
--modal-width-sm, --modal-width-md, --modal-width-lg
```

---

## File Organization

```text
src/
  design-system/
    index.css                    # Design system entry (imports tokens + base resets)
    tokens/
      index.css                  # Token import order
      colors.css                 # Primitive palette + semantic color tokens + status colors
      portal-theme.css           # Portal dark/light mode variable overrides
      typography.css             # Font families, sizes, weights, line heights
      spacing.css                # 8px grid scale, icon gaps, section spacing
      shadows.css                # Elevation system + component shadows
      borders.css                # Border widths and radius (brutalist: all 0)
      animations.css             # Easing curves, durations, component animations
      breakpoints.css            # Responsive breakpoint tokens
      z-index.css                # Z-index layering scale
      buttons.css                # Portal button tokens
      dimensions.css             # Sidebar, icon button, content constraint sizes
  styles/
    variables.css                # Custom media queries, fluid spacing, legacy shadow presets
    core/
      layer-order.css            # Cascade layer order (single source of truth)
    base/
      reset.css                  # CSS reset
      fonts.css                  # @font-face definitions
      typography.css             # HTML element typography rules
      layout.css                 # Base layout (container, hidden)
      utilities.css              # Utility classes (spacing, display, flex, text)
      components.css             # Base shared component styles
      site-globals.css           # Main site unlayered overrides
    bundles/
      foundation.css             # Shared foundation (layer-order + reset + tokens + base + forms)
      site.css                   # Main marketing site bundle
      portal.css                 # Client portal bundle
      admin.css                  # Admin dashboard bundle
    shared/
      portal-badges.css          # Status badges
      portal-buttons.css         # Portal button styles
      portal-cards.css           # Card components
      portal-components.css      # Shared portal utilities (progress, copy-email, etc.)
      portal-charts.css          # Chart styling
      portal-dashboard-widgets.css # Dashboard widget components
      portal-dropdown.css        # Dropdown menus
      portal-files.css           # File manager components
      portal-forms.css           # Portal form overrides
      portal-kanban.css          # Kanban board
      portal-layout.css          # Portal layout (sidebar, header, content)
      portal-messages.css        # Message/chat components
      portal-progress.css        # Progress bars
      portal-sidebar.css         # Sidebar navigation
      portal-stat-cards.css      # Stat card widgets
      portal-tables.css          # Table components
      portal-tabs.css            # Tab navigation
      portal-tags.css            # Tag/label components
      portal-tooltips.css        # Tooltip styles
      confirm-dialog.css         # Confirmation dialog
      details-card.css           # Detail view cards
      field-label-spacing.css    # Field-label gap utilities
      modal-system.css           # Modal framework
      notification-bell.css      # Notification bell icon
      portal-auth.css            # Auth page portal styles
      table-filters.css          # Table filter UI
      toast-notifications.css    # Toast messages
    components/
      form-fields.css            # Form input/select/textarea
      form-buttons.css           # Form submit/cancel buttons
      form-validation.css        # Validation error styles
      loading.css                # Loading spinners/skeletons
      command-palette.css        # Command palette (admin)
      inline-edit.css            # Inline edit (admin)
      nav-base.css               # Navigation base
      nav-animations.css         # Navigation animations
      nav-responsive.css         # Navigation responsive
      nav-portal.css             # Navigation portal variant
      footer.css                 # Footer
      business-card.css          # Business card (main site)
      intro-morph.css            # Intro morph animation (main site)
      intro-nav.css              # Intro navigation (main site)
      page-transitions.css       # Page transition states
    admin/
      index.css                  # Admin styles entry
      (22 feature-specific CSS files)
    client-portal/
      index.css                  # Client portal styles entry
      (11 feature-specific CSS files)
    layouts/
      index.css                  # Layout entry
      flex-patterns.css          # Flex layout patterns
      grid-systems.css           # Grid layout systems
    states/
      index.css                  # States entry
      interactive.css            # Hover/active/focus states
      visibility.css             # Show/hide states
    responsive/
      breakpoints.css            # Responsive media query overrides
    mobile/
      index.css                  # Mobile entry
      layout.css                 # Mobile layout
      contact.css                # Mobile contact page
      responsive-fixes.css       # Mobile fixes
    pages/
      admin.css                  # Admin page overrides
      about.css, contact.css, projects.css, etc.  # Main site pages
```

---

## Cascade Layer System

Defined once in `src/styles/core/layer-order.css`. All bundles import this first via `foundation.css`.

**Layer priority (lowest to highest):**

1. `reset` - Browser resets
2. `tokens` - CSS custom properties
3. `base` - HTML element defaults, typography
4. `components` - Reusable UI components (buttons, forms, cards, nav)
5. `layouts` - Grid/flex layout systems
6. `pages` - Page-specific styles (admin, client-portal, main site pages)
7. `states` - Visibility and interactive states
8. `responsive` - Media query overrides
9. `utilities` - Final overrides (highest priority)

Unlayered styles (at the bottom of bundle files) have the highest cascade priority and are used for critical overrides like portal background colors.

---

## Bundle Architecture

Each app has its own CSS entry point in `src/styles/bundles/`.

### Foundation Bundle (`foundation.css`)

Shared by all three apps. Imports in order:

1. `layer-order.css` - Cascade layer declaration
2. `fonts.css` - Font face definitions (unlayered, must be first)
3. `reset.css` - CSS reset (reset layer)
4. `design-system/index.css` + `variables.css` - All tokens (tokens layer)
5. `typography.css` + `layout.css` - Base styles (base layer)
6. `utilities.css` - Utility classes
7. Form components + loading + toasts (components layer)

### Site Bundle (`site.css`)

Main marketing site. Adds navigation, business card, intro, portfolio, page styles, mobile overrides.

### Portal Bundle (`portal.css`)

Client portal. Adds navigation, footer, client-portal styles, light mode overrides.

### Admin Bundle (`admin.css`)

Admin dashboard. Adds navigation, command palette, inline edit, admin styles, light mode overrides.

### Light Mode

Light mode is handled entirely by 2–3 variable overrides directly in `src/design-system/tokens/portal-theme.css`. No separate `light-mode.css` file exists. Since all other portal colors derive from `--color-text-primary` and `--color-bg-primary` via `color-mix()`, changing these two values automatically re-derives the entire theme.

---

## Naming Conventions

### CSS Variable Naming

**Pattern:** `--[scope]-[category]-[variant]`

```css
/* Shared colors */
--color-bg-primary
--color-text-secondary
--color-border-focus

/* Portal-scoped */
--portal-bg-dark
--portal-text-muted
--portal-border-color

/* Status */
--status-active
--status-completed-bg

/* Spacing */
--space-3
--icon-gap-sm

/* Portal buttons */
--portal-btn-hover-bg
```

**Never use:**

- Color names in variables (e.g., `--blue-500`)
- Hardcoded hex values in component CSS
- Tailwind color classes

### Class Naming

**Pattern:** Semantic names that describe purpose, not appearance.

```css
/* Good */
.btn-primary
.message-table
.status-badge-active
.portal-card

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

Defined in `src/styles/shared/portal-buttons.css` and `src/styles/components/form-buttons.css`.

```css
.btn               /* Base button */
.btn-primary       /* Primary action */
.btn-secondary     /* Secondary/cancel */
.btn-danger        /* Destructive action */
.btn-ghost         /* Minimal style */
.btn-sm            /* Small variant */
.btn-icon          /* Icon-only button */
```

### Status Badges

Defined in `src/styles/shared/portal-badges.css`.

```css
.status-badge             /* Base badge */
.status-badge-active      /* Blue */
.status-badge-pending     /* Yellow */
.status-badge-completed   /* Green */
.status-badge-cancelled   /* Red */
.status-badge-error       /* Red */
```

### Layout

Defined in `src/styles/shared/portal-layout.css` and `src/styles/shared/portal-cards.css`.

```css
.portal-container
.portal-section
.portal-card
.detail-grid
.detail-row
```

### Tables

Defined in `src/styles/shared/portal-tables.css`.

```css
.data-table                   /* Base table */
.data-table th / .data-table td
.col-actions                  /* Actions column cell (EJS tables) */
.table-actions                /* Row action button container (EJS tables) */
.data-table-row-actions       /* Row action button container (React DataTable) */
```

Both `.table-actions` and `.data-table-row-actions` scope `--portal-btn-icon-size` to
`--icon-size-sm` (16px) so icon buttons in table rows are smaller than the default 36px.
Gap between row action buttons is controlled by `--table-actions-gap` (8px).

Icon buttons in tables should be bare `<button class="icon-btn">` — no extra wrapper gap needed
since the scoped `--portal-btn-icon-size` token keeps buttons compact.

### Forms

Defined in `src/styles/components/form-fields.css` and `src/styles/shared/portal-forms.css`.

```css
.form-group
.field-label
.form-input
.form-textarea
.form-select
.form-row
```

### Modals

Defined in `src/styles/shared/modal-system.css` and `src/styles/admin/modals.css`.

```css
.admin-modal-overlay
.admin-modal-content
.admin-modal-header
.admin-modal-body
```

### States

```css
.loading-state
.empty-state
.error-state
```

---

## Portal Theme System

The portal uses a "DISCOTHEQUE" brutalist design with two modes:

### Light Mode (Default)

- Off-white background (`--color-bg-primary: #e0e0e0`)
- Near-black text (`--color-text-primary: #333333`)
- Dark borders (`--color-border-primary` = same as text primary)
- 0 border-radius everywhere (sharp corners)
- Monospace font (Inconsolata)
- All other colors automatically derived via `color-mix()` from these two values

### Dark Mode

Activated by `html[data-theme="dark"]`. Only two variables change on the body:

```css
html[data-theme="dark"] body[data-page="admin"],
html[data-theme="dark"] body[data-page="client-portal"] {
  --color-text-primary: #ffffff;
  --color-bg-primary: #171717;
}
```

All other portal colors automatically re-derive from the updated primaries. No element-level overrides needed.

### Portal Scoping

Portal styles are scoped using `data-page` attribute selectors:

```css
[data-page="admin"] { }
[data-page="client-portal"] { }
```

---

## Tailwind (`tw-`) vs Portal CSS Classes

The codebase uses **two CSS systems** with clear boundaries.

### Portal CSS Classes (Primary)

Used in EJS templates and vanilla TS orchestrators:

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

## Custom Media Queries

Defined in `src/styles/variables.css`. Use these instead of hardcoded breakpoints:

```css
@media (--mobile) { }          /* max-width: 767px */
@media (--tablet) { }          /* min-width: 768px */
@media (--tablet-down) { }     /* max-width: 991px */
@media (--desktop) { }         /* min-width: 992px */
@media (--wide) { }            /* min-width: 1200px */
@media (--ultra-wide) { }      /* min-width: 1400px */
@media (--compact-mobile) { }  /* max-width: 600px (portal sidebar collapse) */
```

Additional granular breakpoints are available. See `src/styles/variables.css` for the full list.

---

## Rules

### Required

1. **Use CSS variables for all colors** - Never hardcode hex/rgb in component CSS
2. **Use spacing tokens** - Use `--space-*` and `--icon-gap-*` instead of raw pixels
3. **Semantic class names** - Describe purpose, not appearance
4. **Scope portal styles** - Use `[data-page="admin"]` or `[data-page="client-portal"]`
5. **Use cascade layers** - All new styles must be placed in the correct layer

### Forbidden

1. **No inline styles** - Use classes
2. **No `!important`** - Fix specificity instead (exception: unlayered overrides)
3. **No hardcoded pixels for spacing** - Use variables
4. **No color names in variables** - Use semantic names
5. **No `@layer` order declarations** - Only `layer-order.css` declares order

---

## Adding New Styles

### Checklist

- [ ] Are colors using CSS variables?
- [ ] Are spacings using design tokens?
- [ ] Is the class name semantic?
- [ ] Is the file in the correct directory?
- [ ] Are portal styles properly scoped?
- [ ] Is the style placed in the correct cascade layer?

### Where to Add

| Type | Location |
|------|----------|
| Design tokens | `src/design-system/tokens/` |
| Base styles | `src/styles/base/` |
| Shared portal components | `src/styles/shared/` |
| Admin-only styles | `src/styles/admin/` |
| Client portal styles | `src/styles/client-portal/` |
| Form components | `src/styles/components/` |
| Layout patterns | `src/styles/layouts/` |
| Interactive/visibility states | `src/styles/states/` |
| Responsive overrides | `src/styles/responsive/` |
| Mobile fixes | `src/styles/mobile/` |
| Page-specific (main site) | `src/styles/pages/` |

---

## Recent Changes

### March 9, 2026 — Action Button Gaps, Icon Sizing, Dead CSS Removal

**New tokens** added to `portal-theme.css`:

- `--action-btn-gap: var(--space-1)` (8px) — use on all icon/action button cluster containers
  (`.panel-actions`, `.note-actions`, `.message-actions`, `.inline-edit-actions`, etc.)
- `--table-actions-gap: var(--space-1)` (8px) — row-level table action buttons specifically

**Table row action buttons** — `.table-actions` and `.data-table-row-actions` now scope
`--portal-btn-icon-size: var(--icon-size-sm)` directly on the container. This means the `.icon-btn`
base rule reads the scoped token and renders at 16px without needing separate size overrides.

**Icon sizes** — All SVG icon width/height declarations in portal CSS files changed from
`var(--icon-size-sm)` / `var(--icon-size-xs)` to `1em`. This lets icons scale proportionally
with their parent's `font-size`, making them context-aware.

**Redundant styles removed** — Labels (`font-size`, `text-transform`, `letter-spacing`),
`background: transparent`, `color: var(--color-text-primary)`, and `margin: 0` declarations
removed from 20+ files where they were already covered by portal-theme.css or portal-cards.css.

**portal-cards.css** `.portal-section` rule extended to also cover `.analytics-chart-card`
and `.kpi-card` so those get `border + transparent bg` without per-file declarations.

### CSS Class Renames

| Old Class | New Class | Location |
|-----------|-----------|----------|
| `.empty-state-icon` | `.empty-icon` | `src/styles/components/loading.css` |
| `.tw-relative` (reaction anchor) | `.msgtab-reaction-anchor` | `portal-messages.css` |

### SVG Color Baseline (reset.css)

All portal SVGs default to `--color-text-primary` via a rule in `src/styles/base/reset.css`:

```css
/* All portal SVGs inherit primary text color */
.portal svg {
  color: var(--color-text-primary);
}

/* Interactive elements override to inherit parent context */
.portal button svg,
.portal a svg {
  color: inherit;
}
```

This ensures standalone icons (empty states, headings, stat cards) always render at the correct text color. Interactive elements (buttons, links) still pick up their parent's hover/active color.

### Avatar CSS Mask Technique (portal-layout.css)

The header avatar uses a CSS mask instead of `<img>` so it responds to `--color-text-primary` in both themes:

```css
.portal-global-header .header-avatar {
  display: inline-block;
  background-color: var(--color-text-primary);
  mask-image: url('/images/avatar_small_sidebar.svg');
  mask-size: contain;
  -webkit-mask-image: url('/images/avatar_small_sidebar.svg');
  -webkit-mask-size: contain;
}
```

The React component renders `<span className="header-avatar" aria-hidden="true" />` rather than an `<img>`.

### Primary Border Variable

`--color-border-primary` is defined in `portal-theme.css` as:

```css
--color-border-primary: var(--color-text-primary);
```

This ensures borders always match text color in both themes without a separate light-mode override.
