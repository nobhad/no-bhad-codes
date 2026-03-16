# CSS Architecture

**Last Updated:** March 16, 2026

Shared CSS architecture, design tokens, naming conventions, and file organization used across both the main site and portals. For portal-specific design (theme, components, layout wrappers), see [Portal Design](./PORTAL_DESIGN.md).

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

Defined in `src/design-system/tokens/portal-theme.css`. Scoped to `body[data-page="admin"]` and `body[data-page="client"]` selectors. These override the global `--color-*` tokens for portal UI.

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
    portal/
      shared/                    # Shared portal components (35+ files)
        portal-accordion.css     # Accordion components
        portal-analytics.css     # Analytics UI
        portal-auth.css          # Auth page portal styles
        portal-badges.css        # Status badges
        portal-buttons.css       # Portal button styles
        portal-cards.css         # Card components
        portal-command-palette.css # Command palette
        portal-components.css    # Shared portal utilities (copy-email, etc.)
        portal-confirm-dialog.css # Confirmation dialog
        portal-copy-email.css    # Copy-email component
        portal-dashboard-widgets.css # Dashboard widget components
        portal-details-card.css  # Detail view cards
        portal-dropdown.css      # Dropdown menus
        portal-error-states.css  # Error state displays
        portal-field-label-spacing.css # Field-label gap utilities
        portal-files.css         # File manager components
        portal-forms.css         # Portal form overrides
        portal-inline-edit.css   # Inline edit
        portal-kanban.css        # Kanban board
        portal-keyboard-shortcuts.css # Keyboard shortcut display
        portal-layout.css        # Portal layout (sidebar, header, content)
        portal-message-thread.css # Message thread UI
        portal-messages.css      # Message/chat components
        portal-modal-system.css  # Shared modal framework
        portal-notification-bell.css # Notification bell icon
        portal-performance.css   # Performance metrics display
        portal-react-components.css # React-specific portal components
        portal-sidebar.css       # Sidebar navigation
        portal-stat-cards.css    # Stat card widgets
        portal-status-panel.css  # Status panel
        portal-tab-components.css # Tab navigation components
        portal-table-filters.css # Table filter UI
        portal-tables.css        # Table components
        portal-tabs.css          # Tab navigation
        portal-toast-notifications.css # Toast messages
        portal-tooltips.css      # Tooltip styles
        portal-utilities.css     # Portal utility classes
      admin/                     # Admin-only styles (20+ files)
        index.css                # Admin styles entry
        modal-system.css         # Admin modal overrides
        analytics.css            # Analytics page styles
        audit-log.css            # Audit log styles
        client-detail.css        # Client detail page
        client-detail-crm.css    # CRM tab styles
        configuration.css        # Configuration page
        dashboard-layout.css     # Admin dashboard layout
        detail-page-controls.css # Detail page control bar
        leads-pipeline.css       # Leads pipeline view
        project-detail.css       # Project detail page
        project-detail-invoices.css # Invoice tab in project detail
        proposals.css            # Proposals page
        questionnaires.css       # Questionnaires page
        system-status.css        # System status display
        table-controls.css       # Table control bar
        tasks.css                # Tasks page
        workflows.css            # Workflows page
      client/                    # Client portal styles
        index.css                # Client portal styles entry
        documents.css            # Documents page
        help.css                 # Help page
        layout.css               # Client portal layout
        projects.css             # Projects page
        requests.css             # Requests page
        settings.css             # Settings page
    components/
      form-fields.css            # Form input/select/textarea
      form-buttons.css           # Form submit/cancel buttons
      form-validation.css        # Validation error styles
      loading.css                # Loading spinners/skeletons
      nav-base.css               # Navigation base
      nav-animations.css         # Navigation animations
      nav-responsive.css         # Navigation responsive
      nav-portal.css             # Navigation portal variant
      footer.css                 # Footer
      business-card.css          # Business card (main site)
      intro-morph.css            # Intro morph animation (main site)
      intro-nav.css              # Intro navigation (main site)
      page-transitions.css       # Page transition states
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
6. `pages` - Page-specific styles (admin, client, main site pages)
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

Client portal. Adds navigation, footer, client styles, light mode overrides.

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

For portal-specific component details (theme, dropdowns, layout wrappers, gutter system), see [Portal Design](./PORTAL_DESIGN.md).

### Buttons

Defined in `src/styles/portal/shared/portal-buttons.css` and `src/styles/components/form-buttons.css`.

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

Defined in `src/styles/portal/shared/portal-badges.css`.

```css
.status-badge             /* Base badge */
.status-badge-active      /* Blue */
.status-badge-pending     /* Yellow */
.status-badge-completed   /* Green */
.status-badge-cancelled   /* Red */
.status-badge-error       /* Red */
```

### Layout

Defined in `src/styles/portal/shared/portal-layout.css` and `src/styles/portal/shared/portal-cards.css`.

```css
.section           /* Top-level page wrapper (flex column + gap + bottom padding) */
.subsection        /* Nested content wrapper (flex column + gap, no gutter/bottom padding) */
.panel             /* Bordered content container */
.table-layout      /* Table wrapper (inside TableLayout component) */
.data-table-card   /* Data table card container */
.portal-card       /* Card with padding */
.detail-grid       /* Detail view grid */
.detail-row        /* Detail view row */
```

### Tables

Defined in `src/styles/portal/shared/portal-tables.css`.

```css
.data-table                   /* Base table */
.data-table th / .data-table td
.col-actions                  /* Actions column cell (EJS tables) */
.action-group                 /* Row action button container (EJS tables) */
.data-table-row-actions       /* Row action button container (React DataTable) */
```

Both `.action-group` and `.data-table-row-actions` scope `--portal-btn-icon-size` to
`--icon-size-sm` (16px) so icon buttons in table rows are smaller than the default 36px.
Gap between row action buttons is controlled by `--table-actions-gap` (8px).

Icon buttons in tables should be bare `<button class="icon-btn">` — no extra wrapper gap needed
since the scoped `--portal-btn-icon-size` token keeps buttons compact.

### Forms

Defined in `src/styles/components/form-fields.css` and `src/styles/portal/shared/portal-forms.css`.

```css
.form-group
.field-label
.form-input
.form-textarea
.form-select
.form-row
```

### Modals

Defined in `src/styles/portal/shared/portal-modal-system.css` and `src/styles/portal/admin/modal-system.css`.

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

## Portal Theme and Tailwind

For the portal theme system (light/dark mode, color derivation, scoping), Tailwind vs Portal CSS rules, and portal layout wrappers, see [Portal Design](./PORTAL_DESIGN.md).

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
4. **Scope portal styles** - Use `[data-page="admin"]` or `[data-page="client"]`
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
| Shared portal components | `src/styles/portal/shared/` |
| Admin-only styles | `src/styles/portal/admin/` |
| Client portal styles | `src/styles/portal/client/` |
| Form components | `src/styles/components/` |
| Layout patterns | `src/styles/layouts/` |
| Interactive/visibility states | `src/styles/states/` |
| Responsive overrides | `src/styles/responsive/` |
| Mobile fixes | `src/styles/mobile/` |
| Page-specific (main site) | `src/styles/pages/` |

---

## Intentional Deviations from Standard Patterns

These are places where the code deliberately breaks a stated rule. Each entry explains what the deviation is, why it exists, and how to recognize it as intentional rather than a mistake.

### 1. Hardcoded hex values in `portal-theme.css`

**Rule broken:** No hardcoded colors — use CSS variables.

**Where:** `src/design-system/tokens/portal-theme.css` lines 46–47 (light mode) and 480–481 (dark mode).

```css
--color-text-primary: #333333;
--color-bg-primary: #e0e0e0;
```

**Why:** These two values ARE the design tokens — the entire portal theme derives from them via `color-mix()`. They cannot reference other variables because they ARE the source. Every other portal color is computed from these two. This is the only place in the entire codebase where hex values are correct.

---

### 2. Runtime-injected CSS variable with no definition in token files

**Rule broken:** All `var(--x)` references must be defined in `src/design-system/tokens/`.

**Where:** `src/styles/portal/shared/portal-dropdown.css` line 173.

```css
width: var(--radix-dropdown-menu-trigger-width, var(--portal-dropdown-min-width));
```

**Why:** `--radix-dropdown-menu-trigger-width` is injected at runtime by Radix UI onto each dropdown trigger element. It cannot be pre-defined — it's computed from the rendered DOM. The fallback `var(--portal-dropdown-min-width)` ensures the rule degrades safely if Radix is not present.

---

### 3. `--color-brand-hover` intentional undefined primary

**Rule broken:** Use the defined token, not a fallback chain.

**Where:** `src/styles/portal/shared/portal-buttons.css` lines 152–154.

```css
background: var(--color-brand-hover, var(--color-interactive-primary-hover));
border-color: var(--color-brand-hover, var(--color-interactive-primary-hover));
```

**Why:** `--color-brand-hover` is a customization slot — it's undefined by design so specific portals or themes can define it to override the button hover color without modifying the token files. The fallback `--color-interactive-primary-hover` (#b91c1c) is the actual operative value until a theme defines `--color-brand-hover`.

---

### 4. Dropdown context variables — defined only at component scope

**Rule broken:** Tokens should be defined at `:root` or `body[data-page]` level.

**Where:** `src/styles/portal/shared/portal-dropdown.css` and `src/styles/portal/shared/portal-modal-system.css`.

```css
/* Modal context sets these */
.portal-modal .custom-dropdown[data-modal-dropdown] {
  --dropdown-bg: var(--color-black);
  --dropdown-border-color: var(--color-border-primary);
  --dropdown-border-width: 1px;
  --dropdown-radius: var(--border-radius-lg);
}
```

**Why:** `--dropdown-bg`, `--dropdown-border-color`, `--dropdown-border-width`, and `--dropdown-radius` are intentional context variables — they exist to be overridden per-usage-site. The `.custom-dropdown` component reads them from its nearest ancestor scope. Defaults are defined in `portal-theme.css` so they always resolve, but the point of these tokens is that callers customize them.

---

### 5. `!important` on `white-space: nowrap`

**Rule broken:** No `!important`.

**Where:** `src/styles/portal/shared/portal-field-label-spacing.css` line 36.

```css
.field-label, .meta-label {
  white-space: nowrap !important;
}
```

**Why:** Field labels must never wrap — wrapping breaks the two-column label/value layout across all portal pages. Without `!important`, downstream component CSS (particularly table cell constraints and flex containers) overrides `white-space` and causes label text to break onto multiple lines. This was an explicit design decision after encountering layout bugs. Do not remove.

---

### 6. ~~Unlayered portal CSS beats all `@layer` declarations~~ — RESOLVED

**Original deviation:** Most portal CSS files had no `@layer` wrapper, relying on unlayered CSS's automatic cascade precedence over all `@layer` declarations.

**Resolution (March 2026):** All portal CSS files wrapped in appropriate `@layer` blocks (`@layer components`, `@layer utilities`, or `@layer responsive`). The deviation no longer exists. See deviation #10 for the remaining multiple-blocks-per-file pattern that emerged from this migration.

---

### 7. `color-scheme: dark` on date inputs

**Rule broken:** No browser-specific properties without a comment.

**Where:** `src/styles/portal/shared/portal-inline-edit.css` line 229 and `portal-forms.css`.

```css
.portal .inline-edit-input-compact--date {
  color-scheme: dark;
}
```

**Why:** Without this, browsers render the native date picker UI (calendar popup, spinner) in light mode even when the portal is in dark mode. `color-scheme: dark` tells the browser to use its dark-mode native controls. This is the only supported cross-browser mechanism for this.

---

### 8. `left: -9999px` in portal-auth.css

**Rule broken:** No magic numbers — use tokens.

**Where:** `src/styles/portal/shared/portal-auth.css`.

```css
left: -9999px;
```

**Why:** This is the canonical CSS technique for screen-reader-only (visually hidden) content — moving an element far off-screen while keeping it in the accessibility tree. `-9999px` is an industry-standard idiom. Tokenizing it (e.g., `--sr-only-offset`) would obscure the intent. It is not a design value.

---

### 9. `body[data-page]` specificity over `:root`

**Rule broken:** Token definitions belong at `:root`.

**Where:** All of `src/design-system/tokens/portal-theme.css`.

```css
body[data-page="admin"],
body[data-page="client"] {
  --color-text-primary: #333333; /* Overrides :root definition from colors.css */
}
```

**Why:** Portal token overrides intentionally use `body[data-page]` rather than `:root` because they must beat the `:root` definitions in `colors.css` without using `!important`. CSS specificity ensures portal pages always use portal colors, and main-site pages always use main-site colors, without any import-order fragility.

---

### 10. Multiple `@layer` blocks in the same file

**Rule broken:** Each file should have one cohesive `@layer` block.

**Where:**

- `src/styles/portal/shared/portal-tables.css` — 15 separate `@layer` blocks
- `src/styles/portal/shared/portal-buttons.css` — interleaved `@layer components` and `@layer utilities` blocks
- `src/styles/portal/shared/portal-modal-system.css` — two `@layer components` blocks around a `@layer utilities` block
- `src/styles/portal/shared/portal-sidebar.css` — two `@layer components` blocks around a `@layer responsive` block
- `src/styles/portal/admin/tasks.css` — two `@layer components` blocks around `@layer utilities` and `@layer responsive` blocks
- `src/styles/portal/admin/index.css` — `@layer components` block followed by two `@layer utilities` blocks and a closing `@layer utilities` block

**Why:** Files containing content that must live in different cascade layers (e.g., base component rules in `@layer components` alongside functional overrides in `@layer utilities`) cannot use a single contiguous wrapper. CSS requires separate `@layer` blocks for different layer types. CSS correctly merges all same-named layer blocks — multiple `@layer components` blocks in one file behave identically to one large block. The split blocks keep related rules co-located by feature while still declaring correct cascade priority.

---

## Recent Changes

Portal-specific changes are documented in [Portal Design -- Recent Changes](./PORTAL_DESIGN.md#recent-changes).

### March 16, 2026 -- Documentation Restructure

Separated portal and main site documentation. Created `PORTAL_DESIGN.md`. Moved portal-specific sections (theme, layout wrappers, component classes, Tailwind rules, recent portal changes) out of this file.

### SVG Color Baseline (reset.css)

All portal SVGs default to `--color-text-primary` via `src/styles/base/reset.css`. Interactive elements (buttons, links) inherit parent's hover/active color.

### Avatar CSS Mask Technique

Header avatar uses CSS mask instead of `<img>` to respond to `--color-text-primary` in both themes. React renders `<span className="header-avatar" aria-hidden="true" />`.

### Primary Border Variable

`--color-border-primary` is defined as `var(--color-text-primary)` in `portal-theme.css`, so borders match text color in both themes automatically.
