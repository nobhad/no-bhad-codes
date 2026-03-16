# Design System

**Last Updated:** March 11, 2026

This document is the single source of truth for the project's design system, combining CSS architecture, UX guidelines, and component standards.

---

## Table of Contents

1. [Philosophy & Principles](#philosophy--principles)
2. [Design Tokens](#design-tokens)
3. [CSS Architecture](#css-architecture)
4. [Components](#components)
5. [Layout Patterns](#layout-patterns)
6. [Utility Classes](#utility-classes)
7. [Responsive Design](#responsive-design)
8. [Accessibility & States](#accessibility--states)
9. [Icon Usage](#icon-usage)
10. [User Preferences & Policies](#user-preferences--policies)
11. [File Organization](#file-organization)
12. [Audit History](#audit-history)

---

## Philosophy & Principles

### Dieter Rams' Ten Principles of Good Design

1. **Good design is innovative** — Developing new opportunities for original designs in tandem with improving technology.

2. **Good design makes a product useful** — Satisfies functional, psychological, and aesthetic criteria.

3. **Good design is aesthetic** — Integral to product usefulness; well-executed objects can be beautiful.

4. **Good design makes a product understandable** — Clarifies structure and expresses function intuitively.

5. **Good design is unobtrusive** — Neutral and restrained, leaving room for user self-expression.

6. **Good design is honest** — Does not manipulate consumers with false promises.

7. **Good design is long-lasting** — Avoids being fashionable; lasts many years.

8. **Good design is thorough down to the last detail** — Shows respect towards the consumer.

9. **Good design is environmentally friendly** — Conserves resources and minimizes pollution.

10. **Good design is as little design as possible** — Less but better; simple as possible but not simpler.

### Core Rules

- **NO EMOJIS** — Use Lucide icons only
- **NO HARDCODED COLORS** — Always use CSS variables
- **GSAP FOR ANIMATIONS** — Complex animations use GSAP, not CSS
- **SEMANTIC CLASS NAMES** — Describe purpose, not appearance

---

## Design Tokens

### Color System

**Semantic Color Tokens:**

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
--color-success-500    /* #10b981 */
--color-error-500      /* #dc2626 */
--color-warning-500
--color-info-500
```

**Brand Colors (Theme-Aware):**

```css
/* Light Mode */
--color-brand-primary: #dc2626;   /* Crimson red */
--color-brand-primary-rgb: 220, 38, 38;

/* Dark Mode */
--color-brand-primary: #dc2626;   /* Same */
```

**Portal Theme Variables** (defined in `src/design-system/tokens/portal-theme.css`,
scoped to `body[data-page="admin"]` and `body[data-page="client"]`):

The portal overrides the same semantic `--color-*` tokens that the main site defines.
All portal colors derive from two primary variables:

| Category | Variables |
|----------|-----------|
| Primaries | `--color-text-primary`, `--color-bg-primary` (all other colors derived from these) |
| Text | `--color-text-secondary`, `--color-text-tertiary`, `--color-text-inverse` |
| Backgrounds | `--color-bg-secondary/tertiary/raised/elevated/prominent/readonly/hover` |
| Borders | `--color-border-primary`, `--color-border-secondary`, `--portal-border` (shorthand) |
| Alpha | `--portal-alpha-white-*`, `--portal-alpha-black-*`, `--portal-alpha-primary-*` |
| Radius | `--portal-radius-pill: 0` (brutalist — all border radii are 0) |
| Layout | `--portal-card-padding`, `--portal-panel-padding-x`, `--portal-section-gap` |
| Action gaps | `--action-btn-gap` (8px), `--table-actions-gap` (8px) |

### Typography

**Font Families:**

| Variable | Font | Usage |
|----------|------|-------|
| `--font--acme` | Acme | Headers, card titles, uppercase labels |
| `--font-body` | System fonts | Body text, paragraphs, form inputs |

**Font Sizes (Fluid):**

| Token | Value | Usage |
|-------|-------|-------|
| `--font-size-xs` | `clamp(0.75rem, 2vw, 0.875rem)` | Fine print, captions |
| `--font-size-sm` | `clamp(0.875rem, 2.5vw, 1rem)` | Secondary text, labels |
| `--font-size-base` | `clamp(1rem, 3vw, 1.125rem)` | Body text |
| `--font-size-lg` | `clamp(1.125rem, 3.5vw, 1.25rem)` | Emphasis text |
| `--font-size-xl` | `clamp(1.25rem, 4vw, 1.5rem)` | Section headers |
| `--font-size-2xl` | `clamp(1.5rem, 5vw, 2rem)` | Page headers |
| `--font-size-3xl` | `clamp(2rem, 6vw, 3rem)` | Hero text |

**Font Weights:**

| Weight | Usage |
|--------|-------|
| 400 | Body text |
| 600 | Emphasis, buttons, labels |
| 700 | Headers, stat numbers |

**Text Transform:**

- **UPPERCASE**: Card headers, buttons, status badges, navigation items
- **Sentence case**: Body text, descriptions, form labels

### Spacing

Design tokens from `src/design-system/tokens/spacing.css` (8px base grid):

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--space-0-5` | `calc(var(--space-base) * 0.5)` | 4px | Minimal spacing |
| `--space-1` | `var(--space-base)` | 8px | Tight spacing, button groups |
| `--space-1-5` | `calc(var(--space-base) * 1.5)` | 12px | Form gaps |
| `--space-2` | `calc(var(--space-base) * 2)` | 16px | Internal card spacing |
| `--space-3` | `calc(var(--space-base) * 3)` | 24px | Section gaps (standard) |
| `--space-4` | `calc(var(--space-base) * 4)` | 32px | Large section gaps |
| `--space-6` | `calc(var(--space-base) * 6)` | 48px | Page section spacing |
| `--space-8` | `calc(var(--space-base) * 8)` | 64px | Major sections |

**Spacing Hierarchy (Admin + Client Portal):**

| Context | Token | Pixels | Usage |
|---------|-------|--------|-------|
| Container padding | `clamp(0.75rem, 2vw, 1.5rem)` | 12-24px | `.dashboard-content` |
| Section gaps | `--space-3` | 24px | Between cards/sections |
| Internal gaps | `--space-2` | 16px | Within sections |
| Tight spacing | `--space-1` | 8px | Within components |
| Mobile reduced | `--space-1` | 8px | Under 400px |

**Rules:**

- ✅ All views inherit `.dashboard-content` padding — do NOT add extra horizontal padding
- ✅ Use `--space-3` gap between major sections
- ✅ Use `--space-2` gap within sections

### Shadows

**Shadow Tokens:**

```css
--shadow-sm
--shadow-md
--shadow-lg
--shadow-panel      /* Main containers */
--shadow-dropdown-xl
--shadow-elevated-md
```

**Shadow Hierarchy:**

- **Main containers** (parent cards with dark backgrounds) use `--shadow-panel`
- **Child elements** with lighter grey backgrounds (`--portal-bg-medium`) have **NO shadow**

```css
/* Main container */
background: var(--portal-bg-dark);
box-shadow: var(--shadow-panel);

/* Child element - NO shadow */
background: var(--portal-bg-medium);
/* NO box-shadow */
```

**Multi-layer shadow for depth:**

```css
box-shadow:
  20px 6px 30px rgba(0, 0, 0, 0.6),
  8px 8px 16px rgba(0, 0, 0, 0.8),
  3px 3px 6px rgba(0, 0, 0, 0.9);
```

### Icon Sizes

| Variable | Value | Usage |
|----------|-------|-------|
| `--icon-size-xs` | 12px | Compact mobile icons |
| `--icon-size-sm` | 14px | Small icons (view toggles, search) |
| `--icon-size-md` | 16px | Standard icons (table actions) |
| `--icon-size-lg` | 20px | Large icons (dropdown triggers) |
| `--icon-size-xl` | 24px | Extra large icons (clear buttons) |
| `--icon-size-2xl` | 32px | Dialog/modal icons |

### Z-Index System

**Main site (0-999):**

| Variable | Value |
|----------|-------|
| `--z-index-dropdown` | 100 |
| `--z-index-modal` | 500 |
| `--z-index-toast` | 800 |
| `--z-index-max` | 999 |

**Portal/Admin (9000-9900):**

| Variable | Value |
|----------|-------|
| `--z-index-portal-base` | 9000 |
| `--z-index-portal-header` | 9100 |
| `--z-index-portal-sidebar` | 9200 |
| `--z-index-portal-overlay` | 9500 |
| `--z-index-portal-modal` | 9600 |
| `--z-index-portal-dropdown` | 9700 |
| `--z-index-portal-toast` | 9800 |
| `--z-index-portal-confirm` | 9900 |

### Animations

| Variable | Value | Usage |
|----------|-------|-------|
| `--cubic-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default easing |
| `--transition-fast` | `0.2s ease` | Fast transition |
| `--transition-medium` | `0.3s ease` | Medium transition |
| `--transition-slow` | `0.6s ease` | Slow transition |

---

## CSS Architecture

### Portal CSS Scope

**In scope (portal-only):**

- **Admin dashboard** — `admin/index.html`, served with `src/styles/bundles/admin.css`
- **Client portal** — `client/portal.html`, served with `src/styles/bundles/portal.css`

**Out of scope (main site):**

- Marketing pages (home, about, contact, projects)
- `src/styles/bundles/site.css` and main-site-specific tokens

### Entry Points (Bundles)

| Bundle | Served On | Contents |
|--------|-----------|----------|
| `admin.css` | Admin dashboard | Shared base + nav + admin pages + admin modules |
| `portal.css` | Client portal | Shared base + nav-portal only + client modules |

Both bundles:

1. Import **shared.css** (reset, design-system tokens, variables, base typography/layout, form components)
2. Use **cascade layers**: `reset`, `tokens`, `base`, `components`, then `admin` or `portal`, then `utilities`
3. Wireframe mode: Use `data-wireframe="true"` attribute for greyscale mode (styles consolidated in shared components)

### Import Order

```css
/* 1. Fonts first */
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

/* 6. Page-specific */
@import './portal/client/index.css';

/* 7. Mobile overrides (last) */
@import './mobile/index.css';
```

### Naming Conventions

1. **Lowercase with hyphens**: `stat-card`, `message-thread`
2. **BEM-like structure**: `block__element--modifier`
3. **Prefix for scoped styles**: `portal-` for portal components

**Portal Naming:**

- **Class prefix**: `portal-` for portal-only components (e.g., `.portal-card`, `.portal-btn`)
- **CSS variables**: `--portal-*` for portal-only tokens
- **Scoping**: `[data-page="admin"]` or `[data-page="client"]` for page-specific overrides

### Theme System

**Light Theme (Default):**

```css
:root,
html[data-theme="light"] {
  --color-brand-primary: #dc2626;
  --color-neutral-100: var(--color-gray-100);
  --color-dark: #333333;
}
```

**Dark Theme:**

```css
html[data-theme="dark"] {
  --color-brand-primary: #dc2626;
  --color-neutral-100: #3a3a3a;
  --color-dark: #e0e0e0;
}
```

---

## Components

### Buttons

**Hierarchy:**

| Type | Class | Usage |
|------|-------|-------|
| Primary | `.btn-primary` | Main actions (Submit, Save, Confirm) |
| Secondary | `.btn-secondary` | Secondary actions (Cancel, Back) |
| Danger | `.btn-danger` | Destructive actions (Delete) |
| Outline | `.btn-outline` | Tertiary actions |
| Icon-only | `.icon-btn` | Toolbars, table actions |

**Sizing:**

| Size | Class | Dimensions |
|------|-------|------------|
| Default | `.btn` | `padding: 0.75rem 1.5rem` |
| Small | `.btn-sm` | `padding: 0.5rem 1rem` |
| Icon Desktop | `.icon-btn` | 36×36px, icon 18×18 |
| Icon Mobile | `.icon-btn` | 28×28px, icon 16×16 |

**States:**

- **Default**: Neutral background with dark border
- **Hover**: Primary color background
- **Active/Pressed**: Slightly darker primary
- **Disabled**: Reduced opacity, no pointer events

**Button Text**: Always UPPERCASE, font-weight 600

**Portal Button Design:**

| Context | Style | Example |
|---------|-------|---------|
| Sidebar nav | Link-style (no bg/border) | Dashboard, Leads, Sign out |
| Page/section CTA | Primary | Save settings, Create project |
| Cancel / back | Secondary | Cancel, Back, View details |
| Table header / tools | Icon-only | Filter, Search, Export |
| Delete / remove | Destructive | Delete project |

### Forms

**Input Fields:**

- **Width**: 100% of container
- **Padding**: `0.75rem`
- **Border**: `2px solid var(--color-dark)`
- **Border radius**: `4px`
- **Focus state**: Primary color border with subtle shadow

**Password Fields — All MUST have view toggle:**

```html
<div class="cp-password-wrapper">
  <input type="password" class="cp-input" />
  <button type="button" class="cp-password-toggle">
    <!-- Lucide Eye/EyeOff icon -->
  </button>
</div>
```

**Labels:**

Primary semantic classes:

| Class | Purpose |
|-------|---------|
| `.field-label` | Form field labels |
| `.section-label` | Section headers, filter labels |
| `.stat-label` | Statistic/metric labels |

Style:

```css
font-size: var(--label-font-size); /* 0.6875rem / 11px */
font-weight: var(--label-font-weight); /* 400 */
color: var(--portal-text-secondary);
text-transform: uppercase;
letter-spacing: var(--label-letter-spacing); /* 0.05em */
```

**Validation States:**

| State | Border Color | Message Color |
|-------|--------------|---------------|
| Default | `var(--color-dark)` | - |
| Focus | `var(--color-primary)` | - |
| Error | `var(--color-error-500)` | `var(--color-error-500)` |
| Success | `var(--color-success-500)` | `var(--color-success-500)` |

### Cards

**Portal Card:**

```css
.portal-card {
  background: var(--color-bg-primary);
  border: var(--border-width) solid var(--color-border-primary);
  padding: var(--portal-card-padding);
}
```

**Admin Table Card:**

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

**Corner Radius Handling:**

- `.admin-table-card` — Gets shadow via `.portal-shadow`, top corners from header
- `.admin-table-scroll-wrapper` — Gets `--border-radius-card` on bottom corners (when no pagination)
- `.table-pagination` — Gets `--border-radius-card` on bottom corners when present

### Tables

**Table Cells:**

```css
padding: var(--space-3) var(--space-4);
background: var(--portal-bg-dark);
font-size: var(--font-size-sm);
height: 48px;
```

**Column Classes (Unified Standard):**

| Header Class | Cell Class | Purpose | Width | Alignment |
|--------------|------------|---------|-------|-----------|
| `.col-checkbox` | `.col-checkbox` | Checkbox column | 48px fixed | center |
| `.identity-col` | `.identity-cell` | Stacked name/email (primary identity) | auto, min 140px | left |
| `.name-col` | `.name-cell` | Simple name/title fields | auto | left |
| `.type-col` | `.type-cell` | Type/category badges | fit-content | left |
| `.status-col` | `.status-cell` | Status dropdown/badge | fit-content | left |
| `.date-col` | `.date-cell` | Date values | fit-content | left |
| `.amount-col` | `.amount-cell` | Currency/amounts (monospace) | fit-content | right |
| `.count-col` | `.count-cell` | Numeric counts | fit-content | center |
| `.email-col` | `.email-cell` | Standalone email | fit-content | left |
| `.timeline-col` | `.timeline-cell` | Progress/timeline bars | min 100px | left |
| `.col-actions` | `.col-actions` | Action buttons | fit-content | right |

**Aliases (backwards compatibility):**

- `.budget-col` / `.budget-cell` → same as `.amount-col` / `.amount-cell`
- `.contact-col` → same as `.identity-col`

### Dropdowns

#### Reference Standard: PortalDropdown Status Pattern

The **ProjectsTable status dropdown** is the gold standard. ALL dropdowns across the portal must follow this general design unless they are an action menu (three-dot) or modal form context.

**Required anatomy (trigger):**

- `PortalDropdown` (Radix DropdownMenu) wrapper
- `PortalDropdownTrigger` with `button.dropdown-trigger--status`
- Content: status indicator (colored dot via `StatusBadge`) + label text + `ChevronDown` caret
- Caret MUST be on the RIGHT via `className="dropdown-caret--status"`

**Required anatomy (content):**

- `PortalDropdownContent` with `sideOffset={0} align="start"`
- Dropdown panel MUST match the trigger width (`min-width: var(--status-dropdown-width)`)
- Items use the same `StatusBadge` styling for visual consistency

```tsx
{/* CORRECT: Reference pattern */}
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

#### Dropdown Size Tiers

| Context | Height | Min Width | Background | Component |
|---------|--------|-----------|------------|-----------|
| Table cells | 32px | `var(--status-dropdown-width)` (115px) | Transparent | `PortalDropdown` |
| Inline selectors | 36px | `var(--status-dropdown-width)` | Transparent | `PortalDropdown` |
| Modal form inputs | 48px | 100% | `--color-black` | `ModalDropdown` |
| Filter controls | 36px | auto | `--portal-bg-dark` | `PortalDropdown` |

#### Universal Dropdown Rules (NO EXCEPTIONS)

These rules apply to ALL dropdowns across the entire portal -- admin AND client-facing. No dropdown is exempt.

**Caret Positioning:**

- Caret (`ChevronDown`) MUST be absolutely positioned on the RIGHT edge
- Caret distance from right border MUST equal content distance from left border (symmetric `--dropdown-padding-x`)
- CSS pattern: `position: absolute; right: var(--dropdown-padding-x); top: 50%; transform: translateY(-50%)`
- Trigger MUST have `position: relative` and `padding-right: calc(var(--dropdown-padding-x) + var(--dropdown-caret-size) + var(--icon-gap))`
- NEVER use `margin-left: auto` or `justify-content: space-between` for caret placement

**Selected Option Hiding:**

- The currently selected option MUST NOT appear in the open dropdown list
- Use `.filter()` before `.map()` to exclude the selected value
- Use normalized comparison (`normalizeValue()`) to handle DB value format mismatches (hyphens vs spaces vs title case)

**Capitalization:**

- `text-transform: none` on ALL dropdown triggers and items -- labels display exactly as provided
- NEVER inherit text-transform from parent elements (avoids uppercase labels bleeding into dropdown text)
- The `text-transform: none` rule is set universally in `portal-dropdown.css` for all trigger/item classes

**Component Rules:**

- NEVER use raw HTML `<select>` elements -- always use `PortalDropdown` or `FormDropdown`
- NEVER use Radix `Select` from `ui/select.tsx` -- use `PortalDropdown` instead
- Open dropdown content MUST match the trigger width
- Status dropdowns MUST use `StatusBadge` with colored dot
- Action menus (three-dot) are exempt from status styling but must use `PortalDropdown`

**Dropdown Trigger CSS Classes:**

| Context | Trigger Class | Caret Class |
|---------|--------------|-------------|
| Table status cells | `dropdown-trigger--status` | `dropdown-caret--status` |
| Form selects / filters | `dropdown-trigger--form` | `dropdown-caret--form` |
| Inline edit selects | `dropdown-trigger--form` | `dropdown-caret--form` |
| Button triggers (analytics, filters) | `dropdown-trigger` | `dropdown-caret` |
| Custom table dropdowns | `dropdown-trigger--custom` | `dropdown-caret--custom` |
| Modal form selects | `dropdown-trigger--custom` | `dropdown-caret--custom` |

#### Compliance Audit (March 11, 2026)

**COMPLIANT -- Converted to PortalDropdown/FormDropdown:**

- 11 table status dropdowns (Projects, Clients, Leads, Contacts, Proposals, Contracts, Deliverables, Tasks, Requests, Workflows, Lead Detail)
- 5 action menus (Client Detail, Project Detail, Contacts Tab, Invoices Tab, Bulk Actions)
- 6 filter/selector dropdowns (Analytics, Files category, Invoice filter, Contact role, Tags, InlineEdit)
- O1: NewRequestForm -- converted to `FormDropdown`
- O2-O4: PortalFilesManager -- 3x converted to `FormDropdown`
- O5-O6: ProjectOverviewStep -- 2x converted to `FormDropdown`
- O7: BasicInfoStep -- converted to `FormDropdown`
- O8: ContactsSection -- converted to `FormDropdown`
- O15-O16: DataTable -- 2x converted to `FormDropdown`
- O18: createFormField SelectField -- now uses `FormDropdown` internally
- O19: DeliverablesTab -- converted from Radix Select to `FormDropdown`
- O33: ClientDetail -- fixed to use `StatusBadge` + `dropdown-caret--status`
- O34: ProjectDetail -- fixed CSS classes to `dropdown-trigger--status` + `dropdown-caret--status`
- QuestionnaireForm SelectInput -- converted from hand-rolled select to `FormDropdown`

**REMAINING OUTLIERS:**

| ID | File | Issue |
|----|------|-------|
| O9 | `admin/help/HelpCenter.tsx` | Raw `<select>` for category filter |
| O10 | `admin/data-quality/ValidationErrorsTab.tsx` | Raw `<select>` for error type filter |
| O11-O12 | `admin/webhooks/WebhookFormModal.tsx` | 2x raw `<select>` for HTTP method and event |
| O13-O14 | `admin/integrations/NotificationFormModal.tsx` | 2x raw `<select>` for channel and event |

### Modals

Portal modals use CSS classes from `src/styles/portal/shared/portal-modal-system.css` and
`src/styles/portal/admin/modal-system.css`. The React portal uses `PortalModal` components
defined in `src/react/components/portal/`.

**Structure:**

```html
<div class="modal-overlay">
  <div class="modal-content portal-shadow">
    <div class="modal-header">
      <h2>Title</h2>
      <button class="modal-close icon-btn">×</button>
    </div>
    <div class="modal-body"><!-- Scrollable --></div>
    <div class="modal-footer"><!-- Actions --></div>
  </div>
</div>
```

**Rules:**

- ✅ Always use `createPortalModal()` — never create custom modal HTML
- ✅ Button order: Cancel/Close → Primary Action
- ✅ Body is scrollable, header and footer are fixed

### Status Badges

**Universal Pattern:**

```css
padding: 0.25rem 0.75rem;
border-radius: 999px;
font-size: 0.75rem;
font-weight: 600;
text-transform: uppercase;
```

**Status Colors:**

| Status | Background | Text |
|--------|------------|------|
| New | `#dbeafe` | `#1e40af` |
| Active/In Progress | `#3b82f6` | `#ffffff` |
| Pending | `#fef3c7` | `#92400e` |
| On Hold | `#fed7aa` | `#9a3412` |
| Completed | `#d1fae5` | `#065f46` |
| Cancelled | `#fee2e2` | `#991b1b` |

**Status Dots:**

```css
width: 8px;
height: 8px;
border-radius: 50%;
background-color: var(--color-status-*);
```

### Focus States

**Standard Focus:**

```css
:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}
```

| Component Type | Focus Style |
|----------------|-------------|
| Text inputs | Primary border + subtle glow |
| Dropdowns | Primary border, no glow |
| Buttons | Glow only (no border change) |
| Icon buttons | Color change to primary |

---

## Layout Patterns

### Standard Page Structure

All admin pages follow a consistent three-tier hierarchy:

1. **Unified Portal Header** — Breadcrumbs + dynamic page title + optional controls
2. **Tab Content** — Main content area
3. **No Redundant Titles** — Page titles only appear in the unified header

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

### Admin Table Structure

```html
<div class="admin-table-card portal-shadow">
  <!-- Layer 1: Header -->
  <div class="admin-table-header">
    <h3>Table Title</h3>
    <div class="admin-table-actions"><!-- Buttons --></div>
  </div>

  <!-- Layer 2: Optional filters -->
  <div class="table-filters">...</div>

  <!-- Layer 3: Table container -->
  <div class="admin-table-container">
    <div class="admin-table-scroll-wrapper">
      <table class="admin-table">...</table>
    </div>
  </div>

  <!-- Layer 4: Pagination (OUTSIDE scroll wrapper) -->
  <div class="table-pagination">...</div>
</div>
```

### Action Button Order

**Standard Order (Left to Right):**

1. **Export** → 2. **Refresh** → 3. **Add/Create**

```html
<div class="admin-table-actions">
  <button class="icon-btn" id="*-export"><!-- Download --></button>
  <button class="icon-btn" id="*-refresh"><!-- Refresh --></button>
  <button class="icon-btn" id="*-add"><!-- Plus --></button>
</div>
```

### View Toggle Placement

View toggles belong in the unified portal header, NOT in content:

```html
<div class="portal-header-title">
  <h1 id="admin-page-title">Page Name</h1>
  <div class="header-controls" data-for-tab="tab-name">
    <div id="*-view-toggle-mount"></div>
  </div>
</div>
```

CSS for conditional visibility:

```css
[data-page="admin"]:has(#tab-tasks.active) .header-controls[data-for-tab="tasks"] {
  display: flex;
}
```

### Tab Structure

**Top-Level Tabs:**

```html
<div class="tab-content" id="tab-name">
  <!-- No page title div, content starts immediately -->
</div>
```

**Entity Detail Tabs:**

```html
<div class="*-detail-tabs portal-tabs">
  <button class="active" data-*-tab="overview">Overview</button>
  <button data-*-tab="files">Files</button>
</div>

<div class="portal-tab-panel active" id="*-tab-overview">...</div>
<div class="portal-tab-panel" id="*-tab-files">...</div>
```

---

## Utility Classes

### Atomic Utilities

**Location:** `src/styles/base/utilities.css`

| Category | Classes |
|----------|---------|
| Display | `.flex`, `.grid`, `.block`, `.hidden`, `.inline-flex` |
| Flex Direction | `.flex-row`, `.flex-col` |
| Flex Sizing | `.flex-1`, `.flex-auto`, `.flex-none`, `.grow`, `.shrink-0` |
| Align Items | `.items-start`, `.items-center`, `.items-end` |
| Justify | `.justify-start`, `.justify-center`, `.justify-end`, `.justify-between` |
| Gap | `.gap-0`, `.gap-0-5`, `.gap-1`, `.gap-1-5`, `.gap-2`, `.gap-3`, `.gap-4` |
| Padding | `.p-1` thru `.p-4`, `.px-*`, `.py-*` |
| Text Align | `.text-left`, `.text-center`, `.text-right` |
| Text Size | `.text-xs`, `.text-sm`, `.text-base`, `.text-lg` |
| Font Weight | `.font-normal`, `.font-medium`, `.font-semibold`, `.font-bold` |
| Overflow | `.overflow-hidden`, `.overflow-auto`, `.truncate` |

### Semantic Utilities

| Class | CSS |
|-------|-----|
| `.flex-center` | `display: flex; align-items: center` |
| `.flex-center-gap` | `display: flex; align-items: center; gap: var(--space-1)` |
| `.flex-between` | `display: flex; align-items: center; justify-content: space-between` |
| `.flex-stack` | `display: flex; flex-direction: column` |
| `.sr-only` | Screen reader only (visually hidden but accessible) |

### Grid Utilities

| Class | CSS |
|-------|-----|
| `.grid-2col` | `grid-template-columns: 1fr 1fr` |
| `.grid-3col` | `grid-template-columns: repeat(3, 1fr)` |
| `.grid-auto-200` | `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` |
| `.grid-auto-300` | `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` |

---

## Responsive Design

### Breakpoint Variables

```css
@custom-media --small-mobile (max-width: 479px);
@custom-media --compact-mobile (max-width: 600px);
@custom-media --mobile (max-width: 767px);
@custom-media --tablet (min-width: 768px);
@custom-media --tablet-down (max-width: 991px);
@custom-media --desktop (min-width: 992px);
@custom-media --wide (min-width: 1200px);
@custom-media --wide-down (max-width: 1300px);
```

### Responsive Table Column Stacking

Columns are progressively stacked to prevent horizontal scroll:

| Width | Action |
|-------|--------|
| 1280px | Hide Budget column, show stacked under Type |
| 1100px | Hide Date column, show stacked above Status |
| 479px | Mobile card view, all cells as blocks |

**Pattern:**

```html
<td class="type-cell">
  <span class="type-value">Business-site</span>
  <span class="budget-stacked">$2.5k-$5k</span>
</td>
<td class="budget-cell">$2.5k-$5k</td>
```

```css
.budget-stacked { display: none; }

@media (max-width: 1280px) {
  .budget-cell { display: none; }
  .budget-stacked { display: block; }
}
```

### Mobile Card Cell Ordering

On mobile (479px and below), table rows transform into stacked cards:

| Order | Cell Types | Purpose |
|:-----:|------------|---------|
| -2 | `.name-cell`, `.contact-cell` | Primary name |
| 1 | `.type-cell` | Category |
| 2 | `.status-cell` | Status dropdown |
| 3 | `.budget-cell` | Financial |
| 6 | `.date-cell` | Dates |
| 10 | `.col-actions` | Action buttons |

---

## Accessibility & States

### Color Contrast

- Text on background: minimum 4.5:1 ratio
- Large text (18px+): minimum 3:1 ratio
- Interactive elements: clearly distinguishable

### Keyboard Navigation

- All functionality accessible via keyboard
- Logical tab order
- Skip links for main content

### Screen Readers

- Meaningful alt text for images
- ARIA labels for icon-only buttons
- Proper heading hierarchy

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Loading States

**Standard Pattern:** All loading states use spinner + message format.

```html
<div class="loading-state">
  <span class="loading-spinner" aria-hidden="true"></span>
  <span class="loading-message">Loading...</span>
</div>
```

**Utilities (from `loading-utils.ts`):**

| Function | Purpose |
|----------|---------|
| `showTableLoading(tbody, colspan, msg)` | Loading state in table body |
| `showContainerLoading(container, msg)` | Loading state in container |
| `getTableLoadingRow(colspan, msg)` | Get table loading row HTML |
| `getContainerLoadingHTML(msg)` | Get container loading HTML |

**Rules:**

- Use spinner animation for async operations
- Show skeleton loaders for content areas
- Disable interactive elements during loading
- Always use utility functions for consistency

### Empty States

**Standard Pattern:** All empty states use a consistent icon + message format.

```html
<div class="empty-state">
  <svg class="empty-icon"><!-- Lucide inbox icon --></svg>
  <span class="empty-state-message">No items found.</span>
</div>
```

**Utilities (from `loading-utils.ts`):**

| Function | Purpose |
|----------|---------|
| `showTableEmpty(tbody, colspan, msg)` | Empty state in table body |
| `showContainerEmpty(container, msg)` | Empty state in non-table container |
| `getTableEmptyRow(colspan, msg)` | Get table empty row HTML |
| `getContainerEmptyHTML(msg)` | Get container empty HTML |

**Styling:**

- `.empty-state` — Centered flex container, muted text color
- `.empty-icon` — 24x24px, 60% opacity, Lucide inbox icon
- `.empty-state-message` — `--font-size-sm`, `--portal-text-secondary`

**Rules:**

- Always use utility functions, never inline HTML
- Icon is automatically included by utilities
- Message should be clear and actionable when possible

### Feedback

| Type | Behavior |
|------|----------|
| Success | Brief toast, green indicator, auto-dismiss 3-5s |
| Error | Persistent until dismissed, red indicator, clear explanation |

---

## Icon Usage

### Critical Rule

All icons must use the Lucide icon library. Never use emojis as visual elements in the UI.

### Icon Sizing

| Size | Pixels | Usage |
|------|--------|-------|
| Small | 16px | Inline with text, form field icons |
| Medium | 20px | Buttons, navigation items |
| Large | 24px | Section headers, feature cards |
| XL | 32px | Hero sections, empty states |

### Common Icon Mappings

| Purpose | Lucide Icon |
|---------|-------------|
| Close/Cancel | `X` |
| Edit | `Pencil` |
| Delete | `Trash2` |
| Add/Create | `Plus` |
| Settings | `Settings` |
| Search | `Search` |
| Check/Success | `Check` |
| Warning | `AlertTriangle` |
| Error | `AlertCircle` |
| Eye (show) | `Eye` |
| Eye (hide) | `EyeOff` |

### Enable/Disable Toggle Pattern

- **Eye icon** = Active/Enabled (click to disable)
- **Eye-off icon** = Inactive/Disabled (click to enable)
- Use `.icon-btn` class with proper `title` and `aria-label`

**Locations:** Leads scoring rules, Workflows triggers, Analytics schedules, Recurring invoices

### View Toggle Pattern

| View Type | Icon Description |
|-----------|------------------|
| Board/Kanban | 3 vertical rectangles |
| List | 3 horizontal lines |
| Table | Grid rectangle |
| Grid | 2×2 squares |

---

## User Preferences & Policies

### Explicit User Preferences

1. **No emojis in design** — Use Lucide icons instead
2. **All password fields need view toggle button**
3. **GSAP for complex animations** — Not CSS animations
4. **No hardcoded colors** — Always use CSS variables
5. **Semantic class names** — Describe purpose, not appearance

### !important Usage Policy

All `!important` declarations are legitimate. Current count: ~65 instances.

**Legitimate Use Categories:**

1. **Accessibility — Reduced Motion**: Users who prefer reduced motion must have animations disabled
2. **Print Styles**: Print media requires overriding all screen styles
3. **Accessibility — Focus Visibility**: Keyboard focus must be visible
4. **Browser Autofill Override**: Browsers apply inline styles that can only be overridden with `!important`
5. **Utility Classes**: `.hidden`, `.no-transition` must win over component styles
6. **Modal Scroll Lock**: `body.modal-open { overflow: hidden }`
7. **Collapsed Sidebar Text Hiding**: Ensures text is hidden when sidebar is collapsed

### Intentional Non-Standard Patterns

| Component | Reason |
|-----------|--------|
| Sidebar spacing | Tighter gaps to fit all nav items |
| Sidebar buttons | Link-style differs from standard buttons |
| Messages layout | Unique two-panel layout with light backgrounds |
| Dropdown focus state | Red border is intentional visual indicator |

### Best Practices

**Do's:**

- Use CSS variables for colors, spacing, and sizing
- Use `clamp()` for fluid responsive values
- Prefix scoped styles with `portal-`
- Use semantic class names
- Add comments for complex selectors

**Don'ts:**

- Don't use `!important` unless in approved categories
- Don't use inline styles
- Don't hardcode colors
- Don't create overly specific selectors

---

## File Organization

### Directory Structure

```text
src/styles/
├── portal/
│   ├── admin/       # Admin-only styles (20+ files)
│   ├── client/      # Client portal styles (7 files)
│   └── shared/      # Shared portal components (35+ files)
├── base/            # Foundation (6 files)
├── bundles/         # Entry points (4 files)
├── components/      # Reusable components (14 files)
├── mobile/          # Mobile-specific (3 files)
├── pages/           # Page-specific (11 files)
└── variables.css    # CSS variables
```

### Key Files

**Admin (`src/styles/portal/admin/`):**

| File | Purpose |
|------|---------|
| `index.css` | Orchestrator |
| `table-controls.css` | Table filter controls + sortable headers |
| `project-detail.css` | Project detail (including messaging UI) |
| `workflows.css` | Approvals and triggers |

**Shared (`src/styles/portal/shared/`):**

| File | Purpose |
|------|---------|
| `portal-buttons.css` | Button hierarchy |
| `portal-cards.css` | Card / stat card styles |
| `portal-forms.css` | Form styles |
| `portal-badges.css` | Status badges |
| `portal-messages.css` | Messaging UI |

### Current Metrics

| Metric | Value |
|--------|-------|
| Total CSS Files | 112 |
| Total Lines | ~38,000 |
| Design System | `src/design-system/` (11 files, ~3,600 lines) |
| Largest File | admin.css (~3,750 lines) |

---

## Audit History

### Latest Audit: February 14, 2026

**Focus:** Portal consistency audit for Phase 3 unification

**Critical Fixes Applied:**

| Issue | Before | After |
|-------|--------|-------|
| `--color-success-500` fallback | `#22c55e` (wrong) | `#10b981` (correct) |
| `--color-danger` fallback | `#e74c3c`, `#dc3545` (mixed) | `#dc2626` (unified) |

**Design Token Coverage:**

| Token Category | Utilized |
|----------------|----------|
| Colors | ~85% |
| Spacing | ~20% (gap — 1,057 hardcoded px values) |
| Shadows | ~70% |
| Border Radius | ~60% |

### Previous Audit: February 9, 2026

**Summary:** Comprehensive audit of 93 CSS files for design system compliance.

**Compliance Improvement:** 85% → 92%

---

## Related Documentation

- [Animations](./ANIMATIONS.md) — Animation standards and GSAP usage
- [Feature Docs](../features/README.md) — Feature-specific styling
