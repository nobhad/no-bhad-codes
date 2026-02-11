# Current Work

**Last Updated:** February 10, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-02.md`.

## DESIGN SYSTEM COMPLIANCE - MANDATORY FOR ALL IMPLEMENTATIONS

All features MUST follow these guidelines from `docs/design/UX_GUIDELINES.md` and `docs/design/CSS_ARCHITECTURE.md`.  Must use reusable components and design tokens, and adhere to the specified patterns for consistency across the portal.

### Icons and Visual Elements

- **NO EMOJIS** - Use Lucide icons only (see icon mappings in UX_GUIDELINES.md)
- Icon sizes: `--icon-size-sm` (14px), `--icon-size-md` (16px), `--icon-size-lg` (20px), `--icon-size-xl` (24px)
- Status indicators: 8px dot + text, gap: `--space-1`
- Enable/disable toggles: Eye icon (active) / EyeOff icon (inactive)
- View toggles: Always include SVG icons alongside text labels

### Colors and Theming

- **NEVER hardcode colors** - use CSS variables only
- Portal backgrounds: `--portal-bg-darker`, `--portal-bg-dark`, `--portal-bg-medium`, `--portal-bg-light`
- Portal text: `--portal-text-light`, `--portal-text-secondary`, `--portal-text-muted`
- Status colors: `--color-status-*` variables (new, active, pending, on-hold, completed, cancelled)
- Brand primary: `var(--color-brand-primary)` - theme-aware (crimson red)
- Borders: Use `#000000` for card borders (not variables)
- Shadows: Use `var(--shadow-md)`, `var(--shadow-lg)`, `var(--shadow-panel)` - no raw values

### Typography

- Font families: `--font--acme` (headers, uppercase labels), `--font-body` (body text)
- Font sizes: `--font-size-xs` through `--font-size-3xl` (fluid clamp values)
- Font weights: 400 (body), 600 (emphasis, buttons), 700 (headers, stat numbers)
- Text transform: UPPERCASE for card headers, buttons, badges, nav items
- Letter spacing: `--letter-spacing-label` (0.05em) for labels and headings

### Button Standards

| Type | Class | Usage |
|------|-------|-------|
| Primary | `.btn-primary` | Main CTA (one per section) |
| Secondary | `.btn-secondary` | Cancel, back, other actions |
| Icon-only | `.icon-btn` | Toolbars, compact UI |
| Destructive | `.btn-danger` | Delete, remove actions |

- Button text: UPPERCASE, font-weight 600
- Sidebar nav: Link-style (no bg/border/shadow)
- Button order in footer: Cancel/Close > Primary Action

### Form Standards

- Inputs: `.portal-input`, `.form-input` - 100% width, `padding: 0.75rem`, `border-radius: 4px`
- Focus state: `border-color: var(--color-primary)` + `box-shadow: 0 0 0 3px rgba(...)`
- Labels: Above input, `--font-size-sm`, font-weight 600, sentence case
- Password fields: MUST include visibility toggle (`.cp-password-wrapper` + `.cp-password-toggle`)
- Validation: Error = `--color-error-500`, Success = `--color-success-500`

### Component Patterns

- **Cards**: `.portal-card`, `.admin-table-card` with `.portal-shadow`
- **Modals**: Use `createPortalModal()` - NEVER custom modal HTML
- **View toggles**: Use `createViewToggle()` in unified header with `data-for-tab`
- **Dropdowns**: Table dropdowns (32px), Modal dropdowns (48px)
- **Status badges**: `padding: 0.25rem 0.75rem`, `border-radius: 999px`, UPPERCASE

### Table Structure (4-Layer Hierarchy)

```text
.admin-table-card.portal-shadow
  .admin-table-header (title + action buttons)
  .table-filters (optional: search + filter chips)
  .admin-table-container
    .admin-table-scroll-wrapper
      table.admin-table
  .table-pagination (OUTSIDE scroll-wrapper, INSIDE card)
```

- Pagination MUST be outside `.admin-table-scroll-wrapper`
- Corner radius: scroll-wrapper gets bottom radius (or pagination if present)

### Layout Patterns

- **Unified portal header**: Breadcrumbs + dynamic page title + optional controls
- **No redundant titles**: Page titles only in unified header
- **Action button order**: Export > Refresh > Add (always this order)
- **Tag placement**: Bottom of header card, before tabs (full-width row)
- **View toggle placement**: In unified header, not buried in content

### Z-Index Token System

| Context | Variable | Value |
|---------|----------|-------|
| Portal base | `--z-index-portal-base` | 9000 |
| Portal header | `--z-index-portal-header` | 9100 |
| Portal sidebar | `--z-index-portal-sidebar` | 9200 |
| Portal overlay | `--z-index-portal-overlay` | 9500 |
| Portal modal | `--z-index-portal-modal` | 9600 |
| Portal dropdown | `--z-index-portal-dropdown` | 9700 |
| Portal toast | `--z-index-portal-toast` | 9800 |

### Spacing

- Design tokens: `--space-0-5` (4px), `--space-1` (8px), `--space-2` (16px), `--space-3` (24px), `--space-4` (32px)
- Card padding: `--space-3` (24px)
- Component gaps: `--space-2` (16px)
- Status dot to text: `--space-1` (8px)

### Animations

- **Complex animations**: Use GSAP (not CSS animations)
- **Simple transitions**: `var(--transition-fast)` (0.2s) or `var(--transition-medium)` (0.3s)
- **Reduced motion**: Always respect `prefers-reduced-motion`
- Easing: `--cubic-default` for standard easing

### Accessibility

- Color contrast: 4.5:1 minimum (3:1 for large text)
- Focus states: Visible on all interactive elements
- Keyboard nav: All functionality accessible via keyboard
- ARIA labels: Required for icon-only buttons
- Screen readers: Meaningful alt text, proper heading hierarchy

### Naming Conventions

- Class names: Lowercase with hyphens (`stat-card`, `message-thread`)
- Portal prefix: `portal-` for portal-only components
- BEM-like: `block__element--modifier` where appropriate
- CSS variables: `--portal-*` for portal-only tokens
- Page scoping: `[data-page="admin"]` or `[data-page="client-portal"]`

### Shadow Hierarchy

- **Main containers** (dark bg): Use `--shadow-panel`
- **Child elements** (lighter grey bg): NO shadow
- Rule: Shadows on main dark container, not on lighter child elements

### Responsive Design

- Breakpoints: Use `@custom-media` variables (not hardcoded px)
- Mobile card view: Tables transform at 479px
- Column stacking: Progressive at 1280px, 1100px breakpoints
- Grid patterns: 3 > 2 > 1 columns (settings), 4 > 1 columns (invoices)

## Post-Task Documentation Checklist

After completing any task:

- [ ] Move fully completed tasks from current_work to archive
- [ ] Add entry to ARCHIVED_WORK_2026-02.md
- [ ] Update feature docs (docs/features/*.md) if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [ ] Update relevant audit file (current state only, no fix logs)
- [ ] Verify no markdown violations

---

## Database Normalization

**Full Documentation:** See `docs/architecture/DATABASE_SCHEMA.md` and `docs/architecture/DATABASE_NORMALIZATION_PLAN.md`

**Phase 1-3:** ✅ COMPLETE (Feb 10, 2026) - Migrations 067-074 applied

**Phase 4 - High Risk:** DEFERRED

- [ ] Consolidate lead/intake overlap (single source of truth)
- [ ] Unify message tables (messages vs general_messages)
- [ ] Add soft-delete to all core entities
- [ ] Slim invoices table (remove redundant columns) - `075_slim_invoices_table.sql.bak`

---

## Open Issues

### Uncommitted Changes

The following changes were made in recent sessions and need to be committed:

- [ ] **Data isolation security fix** - `server/routes/projects.ts` - Added `isUserAdmin()` verification
- [ ] **Recent activity consolidation (Client Portal)** - `server/routes/clients.ts`, `src/features/client/client-portal.ts`
- [ ] **Recent activity consolidation (Admin Portal)** - `server/routes/admin.ts`, `src/features/admin/modules/admin-overview.ts`
- [ ] **Theme toggle CSS fix** - `src/styles/shared/portal-layout.css` - Fixed icon positioning
- [ ] **Documentation updates** - DATABASE_SCHEMA.md, API_DOCUMENTATION.md, UX_GUIDELINES.md, QUESTIONNAIRES.md (new)

### Minor Documentation Issues

Identified during documentation audit (low priority):

- [ ] ANIMATIONS.md has outdated date (January 2026) DATE IS DATE LAST UPDATED, JAN MAKES SENSE
- [ ] Missing `/docs/features/README.md` index file
- [ ] Hardcoded localhost URLs in some documentation
- [ ] Emojis in main README.md (violates "NO EMOJIS" design rule)

### Pending Testing

- [ ] Verify recent activity shows all types (invoices, documents, contracts, messages) in both portals
- [x] Verify theme toggle icon positioned correctly in global header

---

## Portfolio Assets Needed (for Noelle not Claude)

**Status:** Waiting on assets

- [ ] Project screenshots
- [ ] CRT TV title cards for each project
- [ ] OG images for social sharing (1200x630 PNG)

**Location:** public/images/portfolio/

---

## Deferred Items

- **Stripe Payments** - Cost deferral
- **Real-Time Messages (WebSockets)** - Polling works fine
- **MFA/2FA, SSO** - Single admin user
- **Virtual Tour/Walkthrough** - Nice to have

---
