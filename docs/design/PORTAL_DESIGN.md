# Portal Design System

**Last Updated:** March 16, 2026

Portal-specific design standards for the admin dashboard and client portal. For shared design tokens and CSS architecture, see [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md).

---

## Table of Contents

1. [Theme System](#theme-system)
2. [Variable Naming Precedence](#variable-naming-precedence)
3. [Buttons](#buttons)
4. [Forms](#forms)
5. [Cards](#cards)
6. [Tables](#tables)
7. [Dropdowns](#dropdowns)
8. [Modals](#modals)
9. [Status Badges](#status-badges)
10. [Layout Wrapper System](#layout-wrapper-system)
11. [Page Structure](#page-structure)
12. [Gutter System](#gutter-system)
13. [Tailwind vs Portal CSS](#tailwind-vs-portal-css)
14. [Focus States](#focus-states)
15. [Loading and Empty States](#loading-and-empty-states)
16. [Intentional Deviations](#intentional-deviations)
17. [Recent Changes](#recent-changes)

---

## Theme System

The portal uses a brutalist "DISCOTHEQUE" aesthetic: 0 border-radius, monospace font (Inconsolata), uppercase text, thick borders.

### Light Mode (Default)

- Off-white background: `--color-bg-primary: #e0e0e0`
- Near-black text: `--color-text-primary: #333333`
- Dark borders: `--color-border-primary` = same as text primary
- All other colors auto-derived via `color-mix()` from these two values

### Dark Mode

Activated by `html[data-theme="dark"]`. Four variables change:

```css
html[data-theme="dark"] body[data-page="admin"],
html[data-theme="dark"] body[data-page="client"] {
  --color-text-primary: #ffffff;
  --color-bg-primary:   #171717;
  --color-bg-hover:     #000000;
  --form-btn-shadow:    var(--portal-alpha-black-30);
}
```

All other colors (text ramp, background ramp, borders, alpha layers) auto-derive from the updated primaries via `color-mix()`.

### Portal Scoping

Styles scoped using `data-page` attribute selectors:

```css
body[data-page="admin"] { }
body[data-page="client"] { }
```

Defined in `src/design-system/tokens/portal-theme.css`. These use `body[data-page]` specificity to beat the `:root` definitions in `colors.css` without `!important`.

### Color Derivation

The portal background ramp is derived from the two primary variables:

```css
--color-bg-secondary       /* ~4% text into bg */
--color-bg-tertiary        /* ~10% text into bg */
--color-bg-elevated        /* ~16.5% text into bg */
--color-bg-input           /* ~23% text into bg */
--color-bg-hover           /* ~29% text into bg */
```

Alpha channels for overlay/transparency effects:

```css
--portal-alpha-white-02 through --portal-alpha-white-50
--portal-alpha-black-04 through --portal-alpha-black-80
--portal-alpha-primary-08, --portal-alpha-primary-10, --portal-alpha-primary-20
```

---

## Variable Naming Precedence

Three naming conventions coexist. Use this precedence for new code:

| Priority | Prefix | Usage Count | When to Use |
|----------|--------|-------------|-------------|
| 1 | `--color-*` | 1,811 | Default for all semantic colors (backgrounds, text, borders, surfaces) |
| 2 | `--portal-*` | 431 | Portal-specific extensions (alpha channels, button tokens, layout dimensions) |
| 3 | `--app-color-*` | 31 | Legacy aliases -- avoid in new code |

**For new code:**

- Colors: use `--color-*` tokens
- Portal layout/sizing: use `--portal-*` tokens
- Status colors: use `--status-*` tokens
- Never use `--app-color-*` in new code (legacy bridge only)

---

## Buttons

### Hierarchy

| Type | Class | Usage |
|------|-------|-------|
| Primary | `.btn-primary` | Main actions (Submit, Save, Confirm) |
| Secondary | `.btn-secondary` | Secondary actions (Cancel, Back) |
| Danger | `.btn-danger` | Destructive actions (Delete) |
| Outline | `.btn-outline` | Tertiary actions |
| Ghost | `.btn-ghost` | Minimal style |
| Icon-only | `.icon-btn` | Toolbars, table actions |

### Sizing

| Size | Class | Dimensions |
|------|-------|------------|
| Default | `.btn` | `padding: 0.75rem 1.5rem` |
| Small | `.btn-sm` | `padding: 0.5rem 1rem` |
| Icon Desktop | `.icon-btn` | 36x36px, icon 18x18 |
| Icon Mobile | `.icon-btn` | 28x28px, icon 16x16 |

### Button Tokens

Defined in `src/design-system/tokens/buttons.css`:

```css
--portal-btn-padding, --portal-btn-min-height, --portal-btn-sm-*
--portal-btn-font-family, --portal-btn-font-size, --portal-btn-text-transform
--portal-btn-bg, --portal-btn-color, --portal-btn-border
--portal-btn-hover-bg, --portal-btn-hover-color, --portal-btn-hover-border
```

### Button Text

Always UPPERCASE, font-weight 600.

### Context Usage

| Context | Style |
|---------|-------|
| Sidebar nav | Link-style (no bg/border) |
| Page/section CTA | Primary |
| Cancel / back | Secondary |
| Table header / tools | Icon-only |
| Delete / remove | Destructive |

### Action Button Order (Left to Right)

1. **Export** -> 2. **Refresh** -> 3. **Add/Create**

```html
<div class="admin-table-actions">
  <button class="icon-btn" id="*-export"><!-- Download --></button>
  <button class="icon-btn" id="*-refresh"><!-- Refresh --></button>
  <button class="icon-btn" id="*-add"><!-- Plus --></button>
</div>
```

**Button clusters** must use `gap: var(--action-btn-gap)` (8px) between adjacent buttons.

**CSS files:** `src/styles/portal/shared/portal-buttons.css`, `src/styles/components/form-buttons.css`

---

## Forms

### Input Fields

- Width: 100% of container
- Padding: `0.75rem`
- Border: `2px solid var(--color-dark)`
- Border radius: `4px`
- Focus state: Primary color border with subtle shadow

### Password Fields -- View Toggle Required

All password fields MUST have a visibility toggle:

```html
<div class="cp-password-wrapper">
  <input type="password" class="cp-input" />
  <button type="button" class="cp-password-toggle">
    <!-- Lucide Eye/EyeOff icon -->
  </button>
</div>
```

### Labels

| Class | Purpose |
|-------|---------|
| `.field-label` | Form field labels |
| `.section-label` | Section headers, filter labels |
| `.stat-label` | Statistic/metric labels |

Style: `font-size: 0.6875rem`, `font-weight: 400`, `text-transform: uppercase`, `letter-spacing: 0.05em`

### Validation States

| State | Border Color | Message Color |
|-------|--------------|---------------|
| Default | `var(--color-dark)` | - |
| Focus | `var(--color-primary)` | - |
| Error | `var(--color-error-500)` | `var(--color-error-500)` |
| Success | `var(--color-success-500)` | `var(--color-success-500)` |

### CSS Classes

```css
.form-group
.field-label
.form-input / .form-textarea / .form-select
.form-row
```

**CSS files:** `src/styles/components/form-fields.css`, `src/styles/portal/shared/portal-forms.css`

---

## Cards

### Portal Card

```css
.portal-card {
  background: var(--color-bg-primary);
  border: var(--border-width) solid var(--color-border-primary);
  padding: var(--portal-card-padding);
}
```

### Admin Table Card

```html
<div class="admin-table-card portal-shadow">
  <div class="admin-table-header">
    <h3>Table Title</h3>
    <div class="admin-table-actions"><!-- buttons --></div>
  </div>
  <div class="admin-table-container">
    <div class="admin-table-scroll-wrapper">
      <table class="admin-table">...</table>
    </div>
  </div>
  <div class="table-pagination">...</div>
</div>
```

### Corner Radius Handling

- `.admin-table-card` -- Gets shadow via `.portal-shadow`, top corners from header
- `.admin-table-scroll-wrapper` -- Gets `--border-radius-card` on bottom corners (when no pagination)
- `.table-pagination` -- Gets `--border-radius-card` on bottom corners when present

### Shadow Rules

- **Main containers** (parent cards with dark backgrounds) use `--shadow-panel`
- **Child elements** with lighter backgrounds have **NO shadow**

**CSS files:** `src/styles/portal/shared/portal-cards.css`

---

## Tables

### Cell Styling

```css
padding: var(--space-3) var(--space-4);
background: var(--portal-bg-dark);
font-size: var(--font-size-sm);
height: 48px;
```

### Column Classes (Unified Standard)

| Header Class | Cell Class | Purpose | Width | Alignment |
|--------------|------------|---------|-------|-----------|
| `.col-checkbox` | `.col-checkbox` | Checkbox column | 48px fixed | center |
| `.identity-col` | `.identity-cell` | Stacked name/email | auto, min 140px | left |
| `.name-col` | `.name-cell` | Simple name/title | auto | left |
| `.type-col` | `.type-cell` | Type/category badges | fit-content | left |
| `.status-col` | `.status-cell` | Status dropdown/badge | fit-content | left |
| `.date-col` | `.date-cell` | Date values | fit-content | left |
| `.amount-col` | `.amount-cell` | Currency/amounts (monospace) | fit-content | right |
| `.count-col` | `.count-cell` | Numeric counts | fit-content | center |
| `.email-col` | `.email-cell` | Standalone email | fit-content | left |
| `.timeline-col` | `.timeline-cell` | Progress/timeline bars | min 100px | left |
| `.col-actions` | `.col-actions` | Action buttons | fit-content | right |

Aliases (backwards compatibility): `.budget-col` / `.budget-cell` = `.amount-col` / `.amount-cell`, `.contact-col` = `.identity-col`

### Row Action Buttons

`.action-group` and `.data-table-row-actions` scope `--portal-btn-icon-size` to `--icon-size-sm` (16px). Gap between row action buttons is `--table-actions-gap` (8px).

### Responsive Column Stacking

| Width | Action |
|-------|--------|
| 1280px | Hide Budget column, show stacked under Type |
| 1100px | Hide Date column, show stacked above Status |
| 479px | Mobile card view, all cells as blocks |

### Mobile Card Cell Ordering

| Order | Cell Types | Purpose |
|:-----:|------------|---------|
| -2 | `.name-cell`, `.contact-cell` | Primary name |
| 1 | `.type-cell` | Category |
| 2 | `.status-cell` | Status dropdown |
| 3 | `.budget-cell` | Financial |
| 6 | `.date-cell` | Dates |
| 10 | `.col-actions` | Action buttons |

**CSS files:** `src/styles/portal/shared/portal-tables.css`

---

## Dropdowns

### Reference Standard: PortalDropdown Status Pattern

The **ProjectsTable status dropdown** is the gold standard. ALL dropdowns across the portal must follow this pattern unless they are an action menu (three-dot) or modal form context.

```tsx
<PortalDropdown>
  <PortalDropdownTrigger asChild>
    <button className="dropdown-trigger--status">
      <StatusBadge status={currentStatus}>{label}</StatusBadge>
      <ChevronDown className="dropdown-caret--status" />
    </button>
  </PortalDropdownTrigger>
  <PortalDropdownContent sideOffset={0} align="start">
    {options.map((opt) => (
      <PortalDropdownItem key={opt.value} onClick={() => onChange(opt.value)}>
        <StatusBadge status={opt.variant}>{opt.label}</StatusBadge>
      </PortalDropdownItem>
    ))}
  </PortalDropdownContent>
</PortalDropdown>
```

### Size Tiers

| Context | Height | Min Width | Background | Component |
|---------|--------|-----------|------------|-----------|
| Table cells | 32px | `var(--status-dropdown-width)` (115px) | Transparent | `PortalDropdown` |
| Inline selectors | 36px | `var(--status-dropdown-width)` | Transparent | `PortalDropdown` |
| Modal form inputs | 48px | 100% | `--color-black` | `ModalDropdown` |
| Filter controls | 36px | auto | `--portal-bg-dark` | `PortalDropdown` |

### Universal Dropdown Rules (NO EXCEPTIONS)

**Caret Positioning:**

- Caret (`ChevronDown`) MUST be absolutely positioned on the RIGHT edge
- CSS: `position: absolute; right: var(--dropdown-padding-x); top: 50%; transform: translateY(-50%)`
- Trigger MUST have `position: relative` and extra `padding-right`
- NEVER use `margin-left: auto` or `justify-content: space-between`

**Selected Option Hiding:**

- Currently selected option MUST NOT appear in the open dropdown list
- Use `.filter()` before `.map()` to exclude selected value
- Use `normalizeValue()` for fuzzy comparison (DB format mismatches)

**Capitalization:**

- `text-transform: none` on ALL dropdown triggers and items
- NEVER inherit text-transform from parent elements

**Component Rules:**

- NEVER use raw HTML `<select>` elements -- use `PortalDropdown` or `FormDropdown`
- NEVER use Radix `Select` from `ui/select.tsx` -- use `PortalDropdown` instead
- Open dropdown content MUST match the trigger width
- Status dropdowns MUST use `StatusBadge` with colored dot

### Trigger CSS Classes

| Context | Trigger Class | Caret Class |
|---------|--------------|-------------|
| Table status cells | `dropdown-trigger--status` | `dropdown-caret--status` |
| Form selects / filters | `dropdown-trigger--form` | `dropdown-caret--form` |
| Inline edit selects | `dropdown-trigger--form` | `dropdown-caret--form` |
| Button triggers | `dropdown-trigger` | `dropdown-caret` |
| Custom table dropdowns | `dropdown-trigger--custom` | `dropdown-caret--custom` |
| Modal form selects | `dropdown-trigger--custom` | `dropdown-caret--custom` |

### Outlier Status

All previously identified raw `<select>` outliers (O9-O14) have been converted to `FormDropdown`. Zero raw `<select>` elements remain in the portal.

**CSS files:** `src/styles/portal/shared/portal-dropdown.css`

---

## Modals

Portal modals use `PortalModal` React component backed by Radix primitives.

### Structure

```html
<div class="modal-overlay">
  <div class="modal-content portal-shadow">
    <div class="modal-header">
      <h2>Title</h2>
      <button class="modal-close icon-btn">X</button>
    </div>
    <div class="modal-body"><!-- Scrollable --></div>
    <div class="modal-footer"><!-- Actions --></div>
  </div>
</div>
```

### Rules

- Always use `PortalModal` component or `createPortalModal()` -- never custom modal HTML
- Button order: Cancel/Close -> Primary Action
- Body is scrollable, header and footer are fixed
- Size variants: sm, md, lg, xl, full
- GSAP scale-in animation on open

**CSS files:** `src/styles/portal/shared/portal-modal-system.css`, `src/styles/portal/admin/modal-system.css`

---

## Status Badges

### Pattern

```css
padding: 0.25rem 0.75rem;
border-radius: 999px;
font-size: 0.75rem;
font-weight: 600;
text-transform: uppercase;
```

### Status Colors

| Status | Variable | Color |
|--------|----------|-------|
| New | `--status-new` | Cyan `#06b6d4` |
| Active / In Progress | `--status-active` | Blue `#3b82f6` |
| Pending | `--status-pending` | Yellow `#fbbf24` |
| On Hold | `--status-on-hold` | Orange `#f97316` |
| Completed | `--status-completed` | Green `#10b981` |
| Cancelled | `--status-cancelled` | Red `#ef4444` |
| Qualified | `--status-qualified` | Purple `#8b5cf6` |
| Inactive | `--status-inactive` | Gray `#6b7280` |

Each status has `--status-*-rgb` and `--status-*-bg` variants for alpha backgrounds.

### Status Dots

```css
width: 8px;
height: 8px;
border-radius: 50%;
background-color: var(--color-status-*);
```

**CSS files:** `src/styles/portal/shared/portal-badges.css`

---

## Layout Wrapper System

### Wrapper Classes

| Class | Purpose | Gutter | Bottom Padding |
|-------|---------|--------|----------------|
| `.section` | Top-level page wrapper. Direct child of `.dashboard-content`. | Tier 3: children get horizontal gutter | Last child gets `padding-bottom: var(--portal-page-bottom)` |
| `.subsection` | Nested content wrapper inside a `.section`. | None -- gutter comes from deeper tiers | None |

Both provide `display: flex; flex-direction: column; gap: var(--content-gutter)`.

### Rules

1. Every top-level route component must have `.section` as its outermost wrapper
2. Every nested wrapper (inside TabPanel, hub, detail page) must use `.subsection`
3. Never nest `.section` inside `.section` -- inner wrappers must be `.subsection`
4. `TableLayout` component handles this automatically:
   - `<TableLayout>` (default) renders `.section`
   - `<TableLayout nested>` renders `.subsection`

### Component Patterns

```tsx
// Standalone route
<div ref={containerRef} className="section">
  {/* page content */}
</div>

// Hub component
<div ref={containerRef} className="section">
  <TabList tabs={TABS} ... />
  <TabPanel tabId="subtab-a" isActive={...}>
    <SubtabComponent />  {/* must use .subsection or <TableLayout nested> */}
  </TabPanel>
</div>

// Subtab inside a hub
<TableLayout nested containerRef={containerRef} title="TITLE">
  {/* table content */}
</TableLayout>
```

**CSS files:** `src/styles/portal/shared/portal-layout.css`, `src/styles/portal/shared/portal-gutter.css`

---

## Page Structure

All admin pages follow a consistent three-tier hierarchy:

1. **Unified Portal Header** -- Breadcrumbs + dynamic page title + optional controls
2. **Tab Content** -- Main content area
3. **No Redundant Titles** -- Page titles only appear in the unified header

```html
<header class="portal-page-header">
  <div class="portal-header-top">
    <button class="header-sidebar-toggle">...</button>
    <nav class="breadcrumb-nav">...</nav>
  </div>
  <div class="portal-header-title">
    <h1 id="admin-page-title">Page Name</h1>
    <div class="header-subtabs"><!-- Controls --></div>
  </div>
</header>

<div class="tab-content active" id="tab-name">
  <!-- Content starts immediately, no title div -->
</div>
```

### View Toggle Placement

View toggles belong in the unified portal header, NOT in content:

```css
[data-page="admin"]:has(#tab-tasks.active) .header-controls[data-for-tab="tasks"] {
  display: flex;
}
```

### Tab Structure

Top-Level Tabs:

```html
<div class="tab-content" id="tab-name">
  <!-- No page title div, content starts immediately -->
</div>
```

Entity Detail Tabs:

```html
<div class="*-detail-tabs portal-tabs">
  <button class="active" data-*-tab="overview">Overview</button>
  <button data-*-tab="files">Files</button>
</div>
<div class="portal-tab-panel active" id="*-tab-overview">...</div>
```

---

## Gutter System

The gutter system (`portal-gutter.css`) applies horizontal padding at multiple tiers:

- **Tier 1**: Direct children of `.dashboard-content` and tab wrappers (excludes `.section`, `.subsection`, `.table-layout`, `.panel`)
- **Tier 2**: Named content elements (`.data-table-header`, `.settings-fields`, etc.) -- always applied
- **Tier 3**: Children of `.section` -- applies gutter to `.section > *` (excludes structural elements). Does NOT apply to `.subsection > *`
- **Tier 4**: Table cells
- **Tier 5**: Message thread elements

**CSS files:** `src/styles/portal/shared/portal-gutter.css`

---

## Tailwind vs Portal CSS

The codebase uses **two CSS systems** with clear boundaries.

### Portal CSS Classes (Primary)

Used in EJS templates and vanilla TS. All semantic styling:

```css
.form-group, .field-label, .form-input    /* Forms */
.btn, .btn-primary, .btn-secondary         /* Buttons */
.data-table, .col-actions                  /* Tables */
.portal-card, .detail-grid                 /* Layout */
.status-badge                              /* Status */
```

### Tailwind (`tw-` prefix) -- React Only

All Tailwind classes prefixed with `tw-` to avoid collisions. Used **only inside React components** for layout utilities:

```tsx
// Correct: tw- prefix in React components
<div className="tw-flex tw-items-center tw-gap-2">

// WRONG: Unprefixed Tailwind
<div className="flex items-center gap-2">

// WRONG: Tailwind in EJS or vanilla TS
```

### When to Use Which

| Context | System |
|---------|--------|
| EJS templates | Portal CSS |
| Vanilla TS (DOM creation) | Portal CSS |
| React component layout | Tailwind (`tw-`) |
| React component semantics | Portal CSS |
| React forms | Portal CSS |

**Rule:** Portal CSS classes take priority. Only use `tw-` for flex/grid layout, spacing, and positioning within React components.

---

## Focus States

| Component Type | Focus Style |
|----------------|-------------|
| Text inputs | Primary border + subtle glow |
| Dropdowns | Primary border, no glow |
| Buttons | Glow only (no border change) |
| Icon buttons | Color change to primary |

```css
:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}
```

---

## Loading and Empty States

### Loading

```html
<div class="loading-state">
  <span class="loading-spinner" aria-hidden="true"></span>
  <span class="loading-message">Loading...</span>
</div>
```

Use utility functions from `loading-utils.ts`: `showTableLoading()`, `showContainerLoading()`, `getTableLoadingRow()`, `getContainerLoadingHTML()`

### Empty States

```html
<div class="empty-state">
  <svg class="empty-icon"><!-- Lucide inbox icon --></svg>
  <span class="empty-state-message">No items found.</span>
</div>
```

Use utility functions: `showTableEmpty()`, `showContainerEmpty()`, `getTableEmptyRow()`, `getContainerEmptyHTML()`

### Rules

- Always use utility functions, never inline HTML
- Spinner animation for async operations
- Skeleton loaders for content areas
- Disable interactive elements during loading

---

## Intentional Deviations

These are documented deliberately non-standard patterns. Do not "fix" them.

### 1. Hardcoded hex in portal-theme.css

`--color-text-primary: #333333` and `--color-bg-primary: #e0e0e0` ARE the source tokens. Every other portal color derives from them. They cannot reference other variables.

### 2. Runtime-injected Radix variable

`--radix-dropdown-menu-trigger-width` is injected by Radix at runtime. Cannot be pre-defined.

### 3. `--color-brand-hover` intentionally undefined

Customization slot -- undefined so themes can override button hover without modifying tokens. Falls back to `--color-interactive-primary-hover`.

### 4. Component-scoped dropdown variables

`--dropdown-bg`, `--dropdown-border-color` etc. are intentionally overridden per-context (modal vs table vs form).

### 5. `!important` on label white-space

`.field-label { white-space: nowrap !important; }` prevents label wrapping that breaks two-column layouts.

### 6. `color-scheme: dark` on date inputs

Forces browser native date picker to use dark controls in dark mode. Only supported mechanism.

### 7. `left: -9999px` screen-reader technique

Industry-standard CSS technique for visually hidden, accessibility-tree-present content. Not a magic number.

### 8. Multiple `@layer` blocks per file

Files with content in different cascade layers (e.g., `@layer components` + `@layer utilities`) require separate blocks. CSS correctly merges same-named layer blocks.

---

## Recent Changes

### March 14, 2026 -- Portal HTML Wrapper Standardization

Unified all portal page/tab/subtab components to `.section` / `.subsection` two-tier system. Added `nested` prop to `TableLayout`. Removed `.subtab-content-wrapper` class.

### March 11, 2026 -- Universal Dropdown Caret Positioning

All dropdown carets now use absolute positioning. Added `text-transform: none` universally. Created `FormDropdown` component. Added `normalizeValue()` for fuzzy comparison.

### March 9, 2026 -- Action Button Gaps and Icon Sizing

Added `--action-btn-gap` (8px) and `--table-actions-gap` (8px) tokens. SVG icons changed to `1em` sizing for context-aware scaling. Removed redundant label/background declarations from 20+ files.

---

## Related Documentation

- [CSS Architecture](./CSS_ARCHITECTURE.md) -- Shared token system, file organization, cascade layers
- [Component Library](./COMPONENT_LIBRARY.md) -- React component catalog
- [Animations](./ANIMATIONS.md) -- Portal animation standards
- [UX Guidelines](./UX_GUIDELINES.md) -- UX rules (file uploads, icons, passwords)
- [Status System](./STATUS_SYSTEM.md) -- Status workflows and color mappings
- [Factory System](./FACTORY_SYSTEM.md) -- UI factory components
