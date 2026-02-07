# CSS Architecture Audit

**Last Updated:** 2026-02-07

## Current State

| Metric | Value |
| ------ | ----- |
| Total CSS Files | 93 |
| Total Lines | ~34,030 |
| Largest File | admin.css (2,064 lines) |

**Compliant:**

- All colors use CSS variables
- All z-index values use token system
- All breakpoints use `@custom-media` variables
- All spacing uses design-system tokens (`--space-*`)
- Typography utilities consolidated to `base/typography.css`
- Password toggle styles consolidated to `shared/portal-forms.css`
- Hidden selector has single source at `base/layout.css`
- All `!important` declarations are legitimate (GSAP, print, reduced motion)

---

## Common Patterns

### Card Styling

```css
background: var(--portal-bg-dark);
border: none;
border-radius: var(--portal-radius-md);
box-shadow: var(--shadow-card);
padding: var(--space-3);
```

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

```css
display: flex;
justify-content: space-between;
padding: var(--space-2) var(--space-3);
border: 2px solid var(--portal-border-dark);
border-radius: var(--portal-radius-lg);
/* Open: top corners rounded, bottom flat */
```

### Section Headings (h3 in tabs)

```css
font-family: var(--font-family-acme);
font-size: 1.2rem;
text-transform: uppercase;
letter-spacing: 0.05em;
color: var(--portal-text-light);
```

---

## Inconsistencies Resolved

| Pattern | Status | Notes |
| ------- | ------ | ----- |
| Border radius | FIXED | All `--border-radius-card` replaced with `--portal-radius-md`; hardcoded values tokenized |
| Label font size | FIXED | All `0.6875rem` and `0.625rem` labels standardized to `0.75rem` |
| Status colors | FIXED | projects.css hardcoded rgba/rgb replaced with `--color-status-*` variables |
| Fixed heights | FIXED | client.css auth container uses responsive `min-height`/`max-height` |
| Shadow | OK | `--shadow-md` only used for hover states (appropriate) |
| Card padding | DEFER | `var(--space-4)` used intentionally for modals/sections; `var(--space-3)` for cards |

---

## Intentional Non-Standard Patterns

These components use non-standard styling **by design**. Do NOT attempt to standardize.

| Component | File | Reason |
| --------- | ---- | ------ |
| Sidebar spacing | `pages/admin.css` | Tighter gaps (0.5rem buttons, 1rem content) to fit all nav items without overflow |
| Sidebar buttons | `shared/portal-buttons.css` | Link-style (no bg/border/shadow) differs from standard buttons |
| Messages layout | `shared/portal-messages.css` | Unique two-panel layout with light backgrounds; differs from dark portal theme |

---

## Remaining Issues

### Large Files (Splitting Candidates)

| File | Lines | Status |
| ---- | ----- | ------ |
| `pages/admin.css` | 2,064 | SPLIT: table-dropdowns, tooltips, table-filters, sidebar-badges |
| `admin/project-detail.css` | 1,645 | SPLIT: pd-contract, pd-invoices |
| `pages/projects.css` | 1,120 | SPLIT: projects-detail.css (547 lines) |
| `pages/client.css` | 739 | SPLIT: client-auth.css (666 lines) |
| `admin/client-detail.css` | 805 | SPLIT: cd-crm.css (497 lines) |

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
├── pages/           # Page-specific (9 files)
├── shared/          # Shared portal (19 files)
└── variables.css    # CSS variables
```
