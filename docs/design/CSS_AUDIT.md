# CSS Architecture Audit

**Last Updated:** 2026-02-07

## Current State

| Metric | Value |
| ------ | ----- |
| Total CSS Files | 93 (styles) + 11 (design-system) = 104 |
| Total Lines | ~36,600 (styles) + ~4,300 (design-system) = ~40,900 |
| Largest File | `pages/admin.css` (3,224 lines) |

### Directory Breakdown

| Directory | Files | Lines |
| --------- | ----- | ----- |
| `src/styles/admin/` | 22 | ~9,900 |
| `src/styles/pages/` | 11 | ~9,500 |
| `src/styles/shared/` | 19 | ~5,400 |
| `src/styles/components/` | 14 | ~4,800 |
| `src/styles/client-portal/` | 12 | ~3,500 |
| `src/styles/base/` | 6 | ~2,000 |
| `src/styles/bundles/` | 4 | ~500 |
| `src/styles/mobile/` | 3 | ~800 |
| `src/design-system/` | 11 | ~4,300 |

---

## Compliance Status

### Compliant

- All colors use CSS variables (defined in `variables.css`)
- All z-index values use token system (`--z-index-*`)
- All breakpoints use `@custom-media` variables
- Most spacing uses design-system tokens (`--space-*`)
- Typography utilities consolidated to `base/typography.css`
- Password toggle styles consolidated to `shared/portal-forms.css`
- Hidden selector has single source at `base/layout.css`
- Icon sizes use `--icon-size-*` tokens (added Feb 2026)
- Letter-spacing uses `--letter-spacing-*` tokens (added Feb 2026)
- Focus states added to interactive elements (Feb 2026)
- Shadow hierarchy enforced (main dark containers get shadows, light grey child elements have no shadow)
- Table structure standardized with `.admin-table-card` wrapper pattern

### Needs Attention

#### Font Size Violations (Accessibility)

Minimum readable font size is `0.75rem` (12px). The following use smaller sizes:

| File | Line | Value | Fix |
| ---- | ---- | ----- | --- |
| `admin/files.css` | 228 | `0.625rem` | Change to `0.75rem` |
| `admin/files.css` | 432 | `0.625rem` | Change to `0.75rem` |
| `admin/tasks.css` | 31 | `0.625rem` | Change to `0.75rem` |
| `admin/tasks.css` | 397 | `0.625rem` | Change to `0.75rem` |
| `admin/pd-invoices.css` | 76 | `0.6rem` | Change to `0.75rem` |
| `admin/leads-pipeline.css` | 65 | `0.625rem` | Change to `0.75rem` |
| `admin/leads-pipeline.css` | 611 | `0.625rem` | Change to `0.75rem` |
| `admin/leads-pipeline.css` | 889 | `0.65rem` | Change to `0.75rem` |
| `admin/proposals.css` | 86 | `0.625rem` | Change to `0.75rem` |
| `admin/proposals.css` | 455 | `0.65rem` | Change to `0.75rem` |
| `shared/portal-badges.css` | 266 | `11px` | Change to `0.75rem` |
| `pages/admin.css` | 1910 | `10px` | Change to `0.75rem` |
| `pages/admin.css` | 2059 | `9px` | Change to `0.75rem` |
| `pages/admin.css` | 2085 | `9px` | Change to `0.75rem` |

#### Letter-Spacing Not Tokenized

These should use `--letter-spacing-label` (0.05em) or `--letter-spacing-wide` (0.08em):

| File | Line | Value | Token |
| ---- | ---- | ----- | ----- |
| `admin/files.css` | 387 | `0.05em` | `--letter-spacing-label` |
| `admin/client-detail.css` | 81 | `0.08em` | `--letter-spacing-wide` |
| `admin/client-detail.css` | 173 | `0.08em` | `--letter-spacing-wide` |
| `admin/client-detail.css` | 228 | `0.05em` | `--letter-spacing-label` |
| `admin/client-detail.css` | 271 | `0.05em` | `--letter-spacing-label` |
| `admin/client-detail.css` | 302 | `0.05em` | `--letter-spacing-label` |
| `admin/client-detail.css` | 346 | `0.05em` | `--letter-spacing-label` |
| `admin/client-detail.css` | 518 | `0.08em` | `--letter-spacing-wide` |
| `admin/client-detail.css` | 729 | `0.05em` | `--letter-spacing-label` |

---

## !important Usage

**Current Count:** 109 instances

All `!important` declarations are legitimate:

| Category | Files | Reason |
| -------- | ----- | ------ |
| Reduced motion | `reset.css`, `animations.css`, `shadows.css`, `variables.css`, component files | Accessibility requirement |
| Print styles | `breakpoints.css`, `reset.css`, `variables.css`, `nav-responsive.css` | Must override screen styles |
| Focus visibility | `reset.css` | Accessibility requirement |
| High contrast | Various | Accessibility requirement |
| Browser autofill | Form files | Override browser inline styles |
| Utility classes | `.hidden`, `.no-transition` | Must win over component styles |
| GSAP animation lock | Component files | Lock initial state during animation |
| Modal scroll lock | `body.modal-open` | Prevent scroll behind modals |
| Chart.js overrides | Analytics files | Override library inline styles |

---

## Tokens Added (February 2026)

### Icon Size Tokens

```css
--icon-size-xs: 12px;
--icon-size-sm: 14px;
--icon-size-md: 16px;
--icon-size-lg: 20px;
--icon-size-xl: 24px;
--icon-size-2xl: 32px;
```

### Letter Spacing Tokens

```css
--letter-spacing-label: 0.05em;
--letter-spacing-title: 0.02em;
--letter-spacing-wide: 0.08em;
```

---

## Common Patterns

### Shadow Hierarchy

**Main containers** (`--portal-bg-dark`) use `--shadow-panel` or `.portal-shadow`:

```css
background: var(--portal-bg-dark);
border-radius: var(--portal-radius-md);
box-shadow: var(--shadow-panel);
```

**Child elements** (`--portal-bg-medium`) have **NO shadow**:

```css
background: var(--portal-bg-medium);
border-radius: var(--portal-radius-sm);
/* NO box-shadow */
```

Elements that follow this pattern:

- `.activity-list li`, `.task-item`, `.system-info-row`
- `.scoring-rules-list`, `.chart-canvas-wrapper`, `.analytics-column`
- `.kanban-card`, `.data-item`, `.vital-card`, `.bundle-item`

### Table Structure

```html
<!-- With pagination -->
<div class="admin-table-card portal-shadow">
  <div class="admin-table-header"><h3>Title</h3></div>
  <div class="admin-table-container">
    <div class="admin-table-scroll-wrapper">
      <table class="admin-table">...</table>
    </div>
  </div>
  <!-- Pagination OUTSIDE scroll-wrapper, INSIDE admin-table-card -->
  <div class="table-pagination">...</div>
</div>
```

Corner radius handling:

- `.admin-table-scroll-wrapper` gets bottom radius (when no pagination)
- When `.table-pagination` exists, scroll-wrapper loses bottom radius via `:has()` selector
- `.table-pagination` handles bottom corners when present
- `.admin-table` is transparent (cells have background)
- **CRITICAL:** Pagination must be sibling of `.admin-table-container`, not inside scroll-wrapper

### Labels

```css
font-size: 0.75rem;
color: var(--portal-text-secondary);
text-transform: uppercase;
letter-spacing: var(--letter-spacing-label);
font-weight: 500;
```

### Table Cells

```css
padding: var(--space-3);
background: var(--portal-bg-dark);
font-size: var(--font-size-sm);
height: 48px;
```

### Status Dots

```css
width: 8px;
height: 8px;
border-radius: 50%;
background-color: var(--color-status-*);
/* Gap between dot and text: var(--space-1) */
```

### Icon Buttons

```css
/* Desktop */
width: 36px;
height: 36px;
/* Icon: var(--icon-size-lg) */

/* Mobile */
width: 28px;
height: 28px;
/* Icon: var(--icon-size-md) */

background: transparent;
/* Hover: color: var(--color-primary) */
```

### Focus States

```css
/* Standard focus-visible */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Input focus */
:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}
```

### Section Headings (h3 in tabs)

```css
font-family: var(--font-family-acme);
font-size: 1.2rem;
text-transform: uppercase;
letter-spacing: var(--letter-spacing-label);
color: var(--portal-text-light);
```

---

## Intentional Non-Standard Patterns

Do NOT attempt to standardize these:

| Component | File | Reason |
| --------- | ---- | ------ |
| Sidebar spacing | `pages/admin.css` | Tighter gaps to fit nav items |
| Sidebar buttons | `shared/portal-buttons.css` | Link-style (no bg/border) |
| Messages layout | `shared/portal-messages.css` | Light backgrounds differ from dark theme |
| Lead details email | `admin/leads-pipeline.css` | Inline display for alignment |
| Breadcrumb spacing | `client-portal/layout.css` | Extra padding for breathing room |
| Dropdown focus | `admin/table-dropdowns.css` | Red border is intentional |
| Set password form | `pages/admin.css` | Different styling for unauth page |
| Terminal intake | `pages/terminal-intake.css` | Custom terminal aesthetic |

---

## Large Files

| File | Lines | Status |
| ---- | ----- | ------ |
| `pages/admin.css` | 3,224 | SPLIT: table-dropdowns, tooltips, table-filters, sidebar-badges |
| `admin/project-detail.css` | 1,659 | SPLIT: pd-contract, pd-invoices |
| `pages/projects.css` | 1,120 | SPLIT: projects-detail.css |
| `admin/leads-pipeline.css` | 981 | Monitor |
| `pages/proposal-builder.css` | 979 | Self-contained, OK |
| `pages/contact.css` | 902 | Self-contained, OK |
| `admin/analytics.css` | 898 | Monitor |
| `shared/portal-messages.css` | 860 | Self-contained, OK |
| `components/nav-base.css` | 848 | Self-contained, OK |
| `admin/client-detail.css` | 844 | SPLIT: cd-crm.css |

---

## Reference

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

### Z-Index Token System

```css
/* Main site (0-999) */
--z-index-dropdown: 100;
--z-index-modal: 500;
--z-index-toast: 800;
--z-index-max: 999;

/* Portal/Admin (9000-9900) */
--z-index-portal-base: 9000;
--z-index-portal-header: 9100;
--z-index-portal-sidebar: 9200;
--z-index-portal-overlay: 9500;
--z-index-portal-modal: 9600;
--z-index-portal-dropdown: 9700;
--z-index-portal-toast: 9800;
--z-index-portal-confirm: 9900;
```

### Directory Structure

```text
src/styles/
├── admin/           # Admin portal (22 files)
├── base/            # Foundation (6 files)
├── bundles/         # Entry points (4 files)
├── client-portal/   # Client portal (12 files)
├── components/      # Reusable (14 files)
├── mobile/          # Mobile-specific (3 files)
├── pages/           # Page-specific (11 files)
├── shared/          # Shared portal (19 files)
└── variables.css    # CSS variables

src/design-system/
└── tokens/          # Design tokens (11 files)
```
