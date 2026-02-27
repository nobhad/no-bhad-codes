# Current Work

**Last Updated:** February 27, 2026

This file tracks active development work and TODOs. Completed items are archived in `archive/ARCHIVED_WORK_2026-02.md`.

---

## Active TODOs

### CSS Separation: Main Site vs Portal - COMPLETE

**Completed:** February 27, 2026

Fixed critical CSS bleed where DISCOTHÈQUE portal theme (black background, white text) was incorrectly applied to the main site. Main site and portals now have completely separate color systems.

**Root Cause:**

The `colors.css` design tokens were setting DISCOTHÈQUE dark theme colors in `:root`, which applied globally. The main site should have light colors; only portals use the dark DISCOTHÈQUE theme.

**Fix:**

1. Restored main site light theme in `:root` (light gray background, dark text, crimson brand color)
2. Scoped DISCOTHÈQUE dark theme to `[data-page="admin"]` and `[data-page="client-portal"]` only
3. Fixed legacy variable aliases to use light values for main site
4. Updated `variables.css` body styles to use light fallbacks and portal-specific font override

**Files Modified:**

- `src/design-system/tokens/colors.css` - Separated main site and portal color tokens
- `src/styles/variables.css` - Fixed body background/text fallbacks, added portal font override

---

### Button SVG Icon Color Fix - COMPLETE

**Completed:** February 27, 2026

Fixed SVG icons in buttons appearing grey while button text was white. Icons now properly inherit the button's text color.

**Root Cause:**

SVG elements don't automatically inherit the `color` property from their parent elements. Even though Lucide icons use `stroke="currentColor"`, the SVG element's own `color` property wasn't set, causing `currentColor` to resolve to the browser's default color (grey) instead of the button's white text color.

**Fix:**

Added root-level CSS rules to make SVGs inside buttons inherit the button's text color:

1. Added `button svg { color: inherit; }` to `reset.css` (most root-level fix)
2. Added specific selectors in `form-buttons.css` for `.btn svg`, `.btn-primary svg`, `.btn-secondary svg`
3. Did NOT override `fill` or `stroke` to preserve Lucide icon styling (`fill="none"`)

**Files Modified:**

- `src/styles/base/reset.css` - Added root-level rule for SVG color inheritance in buttons
- `src/styles/components/form-buttons.css` - Added specific button SVG color inheritance rules

---

### Portal Spacing Uniformity - COMPLETE

**Completed:** February 27, 2026

Fixed inconsistent spacing throughout the admin/client portal. All icon-text gaps and section heading padding now use design tokens from `spacing.css` for single source of truth.

**Root Cause:**

Multiple CSS files had hardcoded pixel values for gaps instead of using the `--icon-gap-*` design tokens. This caused inconsistent spacing between icons and text across different components (sidebar buttons, loading spinners, section headings).

**Fix:**

1. Updated `--icon-gap-lg` from 10px to 12px for 20-24px icons (sidebar nav, spinners)
2. Added `--portal-section-gap` and `--portal-section-heading-padding` tokens
3. Fixed `.loading-state`, `.empty-state`, `.error-state` to use `var(--icon-gap-lg, 12px)`
4. Fixed `.empty-state-content` backwards compatibility wrapper to use `var(--icon-gap-lg, 12px)`
5. Fixed small state variants (`.loading-state-small`, etc.) to use `var(--icon-gap-xs, 4px)`
6. Fixed inline-edit components to use `var(--icon-gap-xs, 4px)`
7. Updated sidebar button gap to `var(--icon-gap-lg)`

**Files Modified:**

- `src/design-system/tokens/spacing.css` - Increased icon-gap values, added portal section spacing tokens
- `src/styles/components/loading.css` - Fixed all hardcoded gaps to use CSS variables
- `src/styles/components/inline-edit.css` - Fixed hardcoded gaps to use CSS variables
- `src/styles/shared/portal-buttons.css` - Changed sidebar button gap to `--icon-gap-lg`
- `src/styles/shared/portal-cards.css` - Added base section heading styles
- `src/styles/variables.css` - Added portal section spacing variables

---

### Client Portal Login Route Fix - COMPLETE

**Completed:** February 27, 2026

Fixed POST /client/login 404 error caused by ClientPortalModule not loading on auth pages.

**Root Cause:**

The `ClientPortalModule` factory in `modules-config.ts` had an overly restrictive path check that only matched `/client`, `/client/`, `/client/index*`, `/client/portal*`. This excluded `/client/login`, `/client/forgot-password`, etc.

**Fix:**

Changed path check to match all `/client/*` pages except `/client/intake`:

```typescript
const isClientPage =
  currentPath.startsWith('/client') && !currentPath.includes('/client/intake');
```

**Files Modified:**

- `src/core/modules-config.ts` - Broadened ClientPortalModule path matching

---

### Messages Styling Uniformity - COMPLETE

**Completed:** February 27, 2026

Stripped `src/styles/shared/portal-messages.css` down to minimal layout-only CSS. Removed all hardcoded overrides to let base portal styles handle fonts, colors, spacing.

**Changes Made:**

- [x] Removed all hardcoded `padding` declarations
- [x] Removed all hardcoded `margin` declarations
- [x] Removed all hardcoded `font-size` declarations
- [x] Removed all hardcoded `font-weight` declarations
- [x] Removed all hardcoded `color` declarations (except essential icon/highlight colors)
- [x] Removed all hardcoded `gap` declarations
- [x] Removed all hardcoded `line-height` declarations
- [x] Removed all hardcoded `background` declarations
- [x] Changed all borders to use `var(--portal-border)`
- [x] Kept only essential layout properties (display, flex, grid, overflow, positioning)
- [x] Reduced file from ~855 lines to ~418 lines

**File Modified:**

- `src/styles/shared/portal-messages.css`

---

### Portal Code Audit - COMPLETE

**Completed:** February 27, 2026

Full audit of portal CSS, TypeScript, and React code. Fixed CSS conflicts affecting main site, security vulnerabilities, added error handling, and improved mobile responsiveness.

**CSS Conflicts Fixed:**

- [x] **Reverted typography.css** - Headings back to Acme font (was incorrectly changed to Cormorant Garamond)
- [x] **Reverted reset.css** - Removed global `border-radius: 0` (portal-only style was leaking to main site)
- [x] **Added portal-scoped overrides** - Typography and border-radius now properly scoped to `[data-page="client-portal"]` and `[data-page="admin"]` in `layout.css`

**Completed Tasks:**

- [x] **Fix XSS vulnerability** - Replaced unsafe `innerHTML` with DOM methods in `portal-navigation.ts:343`
- [x] **Fix innerHTML clearing** - Removed redundant clearing in React mount files (React's `unmount()` handles this)
- [x] **Add React Error Boundaries** - Created `ErrorBoundary.tsx` component with fallback UI and retry functionality
- [x] **Export escapeHtml utility** - Made centralized utility available for import from `format-utils.ts`
- [x] **Add mobile responsive styles** - Added `@media (--mobile)` and `@media (--compact-mobile)` rules to:
  - `client-portal/projects.css`
  - `client-portal/documents.css`
  - `client-portal/requests.css`
  - `admin/ad-hoc-requests.css`

**Files Modified:**

- `src/features/client/modules/portal-navigation.ts` - XSS fix
- `src/react/features/portal/navigation/mount.tsx` - innerHTML fix + ErrorBoundary
- `src/react/features/portal/files/mount.tsx` - ErrorBoundary integration
- `src/react/components/portal/ErrorBoundary.tsx` - New component
- `src/styles/shared/portal-components.css` - Error boundary CSS
- `src/utils/format-utils.ts` - Exported escapeHtml
- Multiple CSS files - Mobile responsive styles

**Note:** 30+ files still have local copies of `escapeHtml`, `formatDate`, `formatCurrency`. These can be migrated incrementally to use centralized imports.

---

### Backend Documentation Audit - COMPLETE

**Completed:** February 27, 2026

Full audit of backend documentation for accuracy. Fixed inconsistencies across 4 major documentation files.

**DATABASE_SCHEMA.md Fixes:**

- [x] Updated table count: 118 → 129
- [x] Updated migration count: 89 → 90
- [x] Documented messaging consolidation (Migration 085) - unified `messages` table with `context_type`
- [x] Documented intake archival (Migration 086) - `client_intakes` now a backward-compatible VIEW
- [x] Added 5 missing deliverable tables
- [x] Added 3 new sections: Email Sequences, System/Notifications, Saved Reports
- [x] Marked "Dual Message Systems" issue as RESOLVED
- [x] Updated column counts for clients (48+), projects (44+)

**BACKEND_PATTERNS.md Fixes:**

- [x] Documented middleware default export deviations (audit.ts, cache.ts, rate-limiter.ts, sanitization.ts)
- [x] Noted email-template-service.ts boolean return as exception

**THE_BACKEND.md Fixes:**

- [x] Added full technology stack (SQLite3, Express.js, Nodemailer, Stripe, Sentry, Redis)
- [x] Added Backend Routes section with 26 route files documented
- [x] Documented 7 previously undocumented routes (receipts, approvals, triggers, email-templates, client-info, intake, health)

**API_DOCUMENTATION.md Fixes:**

- [x] Added Receipts API section
- [x] Added Approvals API section
- [x] Added Triggers API section
- [x] Added Email Templates API section
- [x] Added Health Check API section
- [x] Added placeholder section for undocumented APIs (data-quality, admin, intake, client-info)
- [x] Removed outdated date note in Authentication section

**Files Modified:**

- `docs/architecture/DATABASE_SCHEMA.md`
- `docs/architecture/BACKEND_PATTERNS.md`
- `docs/THE_BACKEND.md`
- `docs/API_DOCUMENTATION.md`

---

### Input Validation Hardening - Remaining Phases (Lower Priority)

**Started:** February 27, 2026

Phases 1-5 complete (auth, invoices, clients, uploads). Remaining phases are lower priority:

- [ ] Phase 6: Project routes (large file, many routes)
- [ ] Phase 7: Admin routes
- [ ] Phase 8: Message routes

**Note:** Pre-existing test failure in `email-service.test.ts` (nodemailer mock issue) - 9 tests failing, unrelated to validation changes.

---

### Backend Design Consistency Audit - Deferred Tasks

These tasks require substantial effort and are documented for future work:

- [ ] Split `proposals.ts` (2,118 lines) into modules: `core.ts`, `templates.ts`, `versions.ts`, `signatures.ts`, `pdf.ts`
- [ ] Split `messages.ts` (1,289 lines) into modules
- [ ] Implement input validation library (Zod)
- [ ] Standardize error handling pattern across all services
- [ ] Create response builder utility (deferred - api-response.ts already comprehensive)
- [ ] Standardize service singleton pattern (deferred - low priority)

---

### React Table Vanilla CSS Conversion - COMPLETE

Converted React tables to use vanilla CSS classes. Added all required tw-* utility classes directly to brutalist.css so they work without Tailwind generation.

**Completed (Feb 24-27, 2026):**

- [x] Fixed LeadsTable structure - stats outside admin-table-card, added title
- [x] Fixed LeadsTable filter - converted from native `<select>` to PortalDropdown
- [x] Fixed ContactsTable - added title "CONTACT FORM SUBMISSIONS"
- [x] Fixed greeting spacing - now matches subtabs
- [x] Fixed theme toggle button - added visible background
- [x] Added `.filter-dropdown-trigger` styling with flex layout for chevron icon
- [x] Fixed TypeScript error - removed non-existent `portalButtonVariants` export
- [x] Fixed InvoicesTable to match vanilla pattern
- [x] Standardized AdminTable loading/error/empty states
- [x] Added `AdminTableError` component
- [x] Fixed GlobalTasksTable structure inconsistency
- [x] Unified table headers with compact stats summary
- [x] Converted all main tables to icon-only buttons
- [x] Removed click-to-filter on stat cards
- [x] **Added all tw-* utility classes to brutalist.css** - Layout, flexbox, grid, spacing, typography, colors, transitions, transforms

**Utility Classes Added to brutalist.css:**

| Category | Classes |
|----------|---------|
| Flexbox | `tw-flex`, `tw-flex-col`, `tw-items-center`, `tw-justify-between`, etc. |
| Grid | `tw-grid`, `tw-grid-cols-*`, `tw-gap-*`, `tw-col-span-*` |
| Spacing | `tw-m-*`, `tw-p-*`, `tw-px-*`, `tw-py-*`, `tw-space-y-*` |
| Sizing | `tw-w-*`, `tw-h-*` (1-12, full, fit, px) |
| Typography | `tw-text-*`, `tw-font-*`, `tw-whitespace-*` |
| Colors | Status colors (green, yellow, blue, etc.), text colors |
| Borders | `tw-border-*`, `tw-ring-*` |
| Positioning | `tw-fixed`, `tw-absolute`, `tw-relative`, `tw-z-50` |
| Transitions | `tw-transition-*`, `tw-duration-*`, `tw-animate-spin` |

**Files Modified:**

- `src/react/styles/brutalist.css` - Added ~150 utility class definitions

---

### Brutalist Design System - MOSTLY COMPLETE

Implemented a brutalist/minimalist design system for React components inspired by discothequefragrances.com.

**Design Principles:**

- Transparent backgrounds
- No border-radius (squared edges)
- Monospace font (Inconsolata)
- High contrast white on black
- Minimal borders

**Completed (Feb 25-27, 2026):**

- [x] Created `src/react/styles/brutalist.css` with complete component class library
- [x] Updated `tailwind.config.js` with brutalist tokens (no border-radius, no shadows)
- [x] Added Inconsolata font family to Tailwind config
- [x] Imported brutalist.css in React entry points
- [x] Modified `admin-overview.ts` to mount React OverviewDashboard with feature flag
- [x] Made `renderOverviewTab` async and pass context for navigation
- [x] Added `/api/admin/dashboard` endpoint
- [x] Added comprehensive utility classes to brutalist.css (layout, spacing, typography, colors)

**Pending User Testing:**

- [ ] Test React Overview on admin dashboard
- [ ] Verify brutalist styling applies correctly

**Feature Flag:**

- `localStorage.setItem('feature_react_overview', 'true')` - Enable React Overview
- `localStorage.setItem('feature_react_overview', 'false')` - Use vanilla fallback
- `?vanilla_overview=true` URL param - Force vanilla fallback

---

## Post-Task Documentation Checklist

- [ ] Update feature docs if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [x] Verify no markdown violations

---

## DO NOT REMOVE OR EDIT ANYTHING BELOW THIS LINE

### Design System Reference

- Design System: docs/design/DESIGN_SYSTEM.md

Key rules:

- NO EMOJIS - Use Lucide icons only
- NEVER hardcode colors - use CSS variables
- Use `createPortalModal()` for modals
- Complex animations use GSAP, not CSS animations
