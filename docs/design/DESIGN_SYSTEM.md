# Design System

**Last Updated:** March 16, 2026

This document is the index for the project's design system. Detailed specifications live in specialist documents linked below.

---

## Philosophy

### Dieter Rams' Ten Principles of Good Design

1. **Good design is innovative** -- Original designs in tandem with improving technology.
2. **Good design makes a product useful** -- Functional, psychological, and aesthetic criteria.
3. **Good design is aesthetic** -- Integral to usefulness; well-executed objects can be beautiful.
4. **Good design makes a product understandable** -- Clarifies structure, expresses function intuitively.
5. **Good design is unobtrusive** -- Neutral and restrained, room for user self-expression.
6. **Good design is honest** -- No false promises.
7. **Good design is long-lasting** -- Avoids being fashionable.
8. **Good design is thorough down to the last detail** -- Respect towards the consumer.
9. **Good design is environmentally friendly** -- Conserves resources.
10. **Good design is as little design as possible** -- Less but better.

### Core Rules

- **NO EMOJIS** -- Use Lucide icons only
- **NO HARDCODED COLORS** -- Always use CSS variables
- **GSAP FOR COMPLEX ANIMATIONS** -- Not CSS keyframes
- **SEMANTIC CLASS NAMES** -- Describe purpose, not appearance

---

## Documentation Map

### Shared (applies to both portal and main site)

| Document | Purpose |
|----------|---------|
| [CSS Architecture](./CSS_ARCHITECTURE.md) | Design tokens, file organization, cascade layers, variable naming, bundle system |
| [Animations](./ANIMATIONS.md) | Animation tokens, GSAP guidelines, CSS transition rules, performance standards |

### Portal (admin dashboard + client portal)

| Document | Purpose |
|----------|---------|
| [Portal Design](./PORTAL_DESIGN.md) | Theme system, buttons, forms, cards, tables, dropdowns, modals, layout wrappers, gutter system |
| [Component Library](./COMPONENT_LIBRARY.md) | Complete React component catalog (29 portal components, 10 UI primitives, hooks) |
| [UX Guidelines](./UX_GUIDELINES.md) | UX rules: file uploads, icon usage, action buttons, password fields |
| [Status System](./STATUS_SYSTEM.md) | Status workflows, color mappings, TypeScript types for all entity statuses |
| [Factory System](./FACTORY_SYSTEM.md) | UI factory system: actions, icons, button sets, React hooks |

### Main Site

| Document | Purpose |
|----------|---------|
| [Main Site Design](./MAIN_SITE_DESIGN.md) | Page architecture, GSAP animations, business card, navigation, responsive |
| [Terminal Design Patterns](./TERMINAL_DESIGN_PATTERNS.md) | Terminal portfolio design analysis and implementation plan |

### Reference / Historical

| Document | Purpose |
|----------|---------|
| [Admin Portal Linear Redesign](./ADMIN_PORTAL_LINEAR_REDESIGN.md) | Linear design system inspiration for admin portal |
| [Analytics UI](./ANALYTICS_UI.md) | Analytics page UI documentation |
| [Coyote Paw Animation](./COYOTE_PAW_ANIMATION.md) | Intro animation specification |
| [Wireframe and Components](./WIREFRAME_AND_COMPONENTS.md) | Wireframe mode and reusable component audit |

---

## Quick Reference

### Design Tokens

All tokens live in `src/design-system/tokens/` (11 files). See [CSS Architecture](./CSS_ARCHITECTURE.md) for full details.

| Category | Token Prefix | Source File |
|----------|-------------|-------------|
| Colors | `--color-*` | `colors.css` |
| Portal theme | `--portal-*` | `portal-theme.css` |
| Status | `--status-*` | `colors.css` |
| Typography | `--font-*` | `typography.css` |
| Spacing | `--space-*` | `spacing.css` |
| Shadows | `--shadow-*` | `shadows.css` |
| Borders | `--border-*` | `borders.css` |
| Animations | `--duration-*`, `--easing-*` | `animations.css` |
| Z-Index | `--z-index-*` | `z-index.css` |
| Buttons | `--portal-btn-*` | `buttons.css` |
| Dimensions | `--sidebar-*`, `--icon-btn-*` | `dimensions.css` |
| Breakpoints | `--small-mobile`, `--mobile`, etc. | `breakpoints.css` |

### Variable Naming Precedence

| Priority | Prefix | Usage | New Code? |
|----------|--------|-------|-----------|
| 1 | `--color-*` | Semantic colors (1,811 uses) | Yes -- default |
| 2 | `--portal-*` | Portal extensions (431 uses) | Yes -- portal layout/sizing |
| 3 | `--status-*` | Status colors | Yes -- status badges |
| 4 | `--app-color-*` | Legacy aliases (31 uses) | No -- avoid |

### CSS File Organization

```text
src/
  design-system/tokens/    # 11 token files (colors, typography, spacing, etc.)
  styles/
    bundles/               # Entry points: site.css, client.css, admin.css
    base/                  # Reset, fonts, typography, layout, utilities
    components/            # Shared components (forms, loading, nav)
    portal/
      shared/              # Shared portal components (35+ files)
      admin/               # Admin-only styles (20+ files)
      client/              # Client portal styles (6 files)
    pages/                 # Main site page-specific styles
    mobile/                # Mobile overrides
```

### Typography

| Variable | Font | Usage |
|----------|------|-------|
| `--font--acme` | Acme | Headers, card titles, uppercase labels |
| `--font-body` | System fonts | Body text, paragraphs, form inputs |
| Portal | Inconsolata (monospace) | All portal text |

### Icon Sizing

| Variable | Value | Usage |
|----------|-------|-------|
| `--icon-size-xs` | 12px | Compact mobile icons |
| `--icon-size-sm` | 14px | Small icons (view toggles, search) |
| `--icon-size-md` | 16px | Standard icons (table actions) |
| `--icon-size-lg` | 20px | Large icons (dropdown triggers) |
| `--icon-size-xl` | 24px | Extra large icons (clear buttons) |
| `--icon-size-2xl` | 32px | Dialog/modal icons |

### Z-Index System

| Layer | Range | Variables |
|-------|-------|-----------|
| Main site | 0-999 | `--z-index-dropdown` (100), `--z-index-modal` (500), `--z-index-toast` (800) |
| Portal | 9000-9900 | `--z-index-portal-base` (9000) through `--z-index-portal-confirm` (9900) |

---

## User Preferences

1. **No emojis in design** -- Use Lucide icons
2. **All password fields need view toggle button**
3. **GSAP for complex animations** -- Not CSS
4. **No hardcoded colors** -- CSS variables only
5. **Semantic class names** -- Purpose, not appearance
6. **No file upload dropzones on mobile**

---

## Audit History

### March 16, 2026 -- Documentation Restructure

Separated portal and main site documentation. Created `PORTAL_DESIGN.md`, rewrote `COMPONENT_LIBRARY.md` with full catalog (29 portal components, 10 UI primitives, 28 hooks), rewrote `ANIMATIONS.md` with accurate inventory separated by portal/main site. Deleted obsolete `BACKGROUND_COLORS.md` (referenced non-existent `--portal-bg-*` variables). Slimmed `DESIGN_SYSTEM.md` to index document.

### February 14, 2026 -- Portal Consistency Audit

Fixed `--color-success-500` fallback (`#22c55e` -> `#10b981`), unified `--color-danger` fallback to `#dc2626`.

### February 9, 2026 -- Comprehensive CSS Audit

93 CSS files audited. Compliance improved 85% -> 92%.
