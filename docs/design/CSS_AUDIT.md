# CSS Architecture Audit

**Last Updated:** 2026-02-06

## Current State

| Metric | Value |
|--------|-------|
| Total CSS Files | 83 |
| Total Lines | 33,555 |
| Largest File | admin.css (2,922 lines) |

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

## Remaining Issues

### Large Files (Splitting Candidates)

| File | Lines | Recommendation |
|------|-------|----------------|
| `pages/admin.css` | 2,922 | Split by component (tables, sidebar, modals) |
| `admin/project-detail.css` | 2,127 | Split by tab (files, messages, tasks, invoices) |
| `pages/projects.css` | 1,662 | Split by section |
| `pages/client.css` | 1,403 | Split by feature |
| `admin/client-detail.css` | 1,283 | Split by section |

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
├── admin/           # Admin portal (15 files)
├── base/            # Foundation (5 files)
├── bundles/         # Entry points (3 files)
├── client-portal/   # Client portal (10 files)
├── components/      # Reusable (14 files)
├── design-system/   # Tokens (3 files)
├── mobile/          # Mobile-specific (3 files)
├── pages/           # Page-specific (10 files)
├── shared/          # Shared portal (16 files)
└── variables.css    # CSS variables
```
