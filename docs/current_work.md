# Current Work

**Last Updated:** February 10, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-02.md`.

## DESIGN SYSTEM COMPLIANCE - MANDATORY FOR ALL IMPLEMENTATIONS

All features MUST follow these guidelines from `docs/design/UX_GUIDELINES.md` and `docs/design/CSS_ARCHITECTURE.md`.

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

- [ ] Move completed item from current_work to archive
- [ ] Add entry to ARCHIVED_WORK_2026-02.md
- [ ] Update feature docs (docs/features/*.md) if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [ ] Update relevant audit file (current state only, no fix logs)
- [ ] Verify no markdown violations

---

## Database Normalization (Remaining Work)

**Full Documentation:** See `docs/architecture/DATABASE_SCHEMA.md` and `docs/architecture/DATABASE_NORMALIZATION_PLAN.md`

**Phase 1-2:** ✅ COMPLETE (Feb 10, 2026) - Migrations 067-070 applied

**Phase 3 - Medium-High Risk:** PLANNED

- [ ] Normalize invoice table (52 cols → ~25 cols)
- [ ] Extract line_items from JSON to proper table
- [ ] Consolidate signature systems (contracts only)

**Phase 4 - High Risk:** DEFERRED

- [ ] Consolidate lead/intake overlap (single source of truth)
- [ ] Unify message tables (messages vs general_messages)
- [ ] Add soft-delete to all core entities

---

## Open Issues

### Design Concerns

- [x] **Project Detail Page - Pill Label Styling**: Fixed - converted pill labels to smaller caps without background
  - Changed ROLE, YEAR, DURATION, TOOLS labels from pill styling to uppercase muted text
  - Updated `projects-detail.css` with transparent background, no shadow, no border-radius
  - Added dark mode support

### Needs User Verification

- **Analytics Page KPI Cards**: Fixed but awaiting user testing
- **Sidebar counts**: GET /api/admin/sidebar-counts - needs verification

---

## Outstanding Tasks

### Portfolio Assets Needed

**Status:** Waiting on assets

- [ ] Project screenshots
- [ ] CRT TV title cards for each project
- [ ] OG images for social sharing (1200x630 PNG)

**Location:** public/images/portfolio/

### Front-End Polish

- [x] Lead funnel styling improvements (Feb 10)
  - Fixed hardcoded hex colors in pipeline stages (#f59e0b, #8b5cf6 → CSS variables)
  - Fixed error color used for link hovers → brand primary
  - Removed duplicate .lead-task-item CSS definitions
- [ ] Analytics tab: use reusable components instead of analytics-only markup (partial - hardcoded colors fixed)

### Client + Project Details Reorganization (Optional)

- [ ] Merge Quick Stats + Health into single card
- [ ] Merge Client Overview + CRM Details into single card
- [ ] Reduce Overview tab from 7 cards to 3-4

---

## Deferred Items

- **Stripe Payments** - Cost deferral
- **Real-Time Messages (WebSockets)** - Polling works fine
- **MFA/2FA, SSO** - Single admin user
- **Virtual Tour/Walkthrough** - Nice to have

---
