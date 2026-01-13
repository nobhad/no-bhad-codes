# Current Work - January 13, 2026

---

## Active Issues

### Page Transition Animation Issues - OPEN

**Status:** Open - Fix attempted but reverted
**Priority:** High

**Issue:**
HR element and button briefly flash/appear before the rest of the content animates in with blur effect.

**Root Cause Identified:**
Race condition between CSS class changes and GSAP inline styles:

- Adding `page-active` makes element display:grid/flex
- Browser paint cycle occurs before GSAP sets visibility:hidden
- Child elements (HR, button) flash during this window

**Fix Attempted (REVERTED):**
Tried applying GSAP inline styles FIRST before class changes, and removing `!important` from page-transitions.css. This broke:

- Header/footer colors (showed wrong background)
- Business card positioning
- Overlay colors

**Changes were reverted** - both `page-transition.ts` and `page-transitions.css` are back to original state.

**Next Approach Needed:**
Need to find a solution that prevents the flash without breaking the layout. Possible approaches:

1. Use `requestAnimationFrame` to ensure atomic class + style changes
2. Keep `!important` but fix the animation timing differently
3. Use CSS `content-visibility: hidden` before animation starts

---

## Completed Work (Ready to Archive)

### Header White Flash in Dark Mode - FIXED

**Status:** Complete
**Date:** January 13, 2026

**Issue:** Header area briefly flashed white when navigating in dark mode.

**Root Cause:** Inline critical CSS in `index.html` had hardcoded color values (`#f8f5f4`) that didn't match the CSS variable `--color-neutral-300` (`#e0e0e0`).

**Solution:** Replaced all hardcoded background colors with `var(--color-neutral-300)` which is theme-aware (light: `#e0e0e0`, dark: `#333333`).

**Files Modified:**

- `index.html` - Use CSS variables instead of hardcoded colors
- `src/styles/components/intro-morph.css` - Updated comment to match actual color value

### Terminal Styling Refactor - COMPLETE

**Status:** Complete
**Date:** January 13, 2026

**Changes Made:**

1. **Created reusable terminal component** (`src/styles/components/terminal.css`)
   - Extracted base terminal styles (window, header, input, scrollbar)
   - Added CSS custom properties for terminal font settings
   - Consistent styling across all terminal instances

2. **Removed green glow from terminal**
   - Removed `box-shadow` glow effects from `.terminal-window`
   - Removed glow from `.progress-fill`
   - Terminal now has clean drop shadow only

3. **Fixed terminal width on open**
   - Terminal now appears at full 900px width immediately
   - Added `min-width: 100%` to prevent content-based sizing
   - No more "skinny" initial state

4. **Added shadows to client portal**
   - Added `box-shadow: var(--shadow-card)` to match admin portal
   - Components updated: `.portal-card`, `.portal-project-card`, `.stat-card`, `.overview-card`, `.recent-activity`, `.progress-bar`, `.update-item`, `.timeline-content`, `.content-section`, `.content-item`, `.new-project-form`

**Files Modified:**

- `src/styles/components/terminal.css` (NEW)
- `src/styles/pages/terminal-intake.css`
- `src/styles/components/nav-portal.css`
- `src/styles/pages/client.css`
- `src/styles/client-portal/components.css`
- `src/styles/client-portal/dashboard.css`
- `src/styles/client-portal/views.css`
- `src/styles/main.css`

### Client Portal - Real Project Data - COMPLETE

### Admin Project Details - API Fixes - COMPLETE

See [ARCHIVED_WORK_2026-01.md](./ARCHIVED_WORK_2026-01.md) for details.

---

### Phase 3: Code Organization - IN PROGRESS

**Goal:** Split large files to improve maintainability.

**Large Files Status:**

| File | Lines | Priority | Status |
|------|-------|----------|--------|
| `client-portal.ts` | 1,952 | High | IN PROGRESS - 3 new modules extracted |
| `admin-dashboard.ts` | 1,917 | Medium | Already has 9 extracted modules |
| `intro-animation.ts` | 1,815 | Medium | Animation logic |
| `terminal-intake.ts` | 1,685 | Medium | Terminal UI logic |
| `page-transition.ts` | 580 | Low | Recently simplified |
| `admin-project-details.ts` | 1,024 | Low | Recently extracted |

**Client Portal Refactor Progress:**

New modules created (total 7 modules now):

- `portal-navigation.ts` (398 lines) - Navigation, views, sidebar, mobile menu
- `portal-projects.ts` (497 lines) - Project loading, display, preview
- `portal-auth.ts` (346 lines) - Login, logout, session management
- `portal-files.ts` (455 lines) - File management (existing)
- `portal-invoices.ts` (250 lines) - Invoice management (existing)
- `portal-messages.ts` (268 lines) - Messaging (existing)
- `portal-settings.ts` (261 lines) - Settings forms (existing)

Main file reduced from 2,293 to 1,952 lines (~340 lines extracted).

**Files Approaching 1000 Lines:**

- `admin-projects.ts` (976), `intro-animation-mobile.ts` (855), `admin-clients.ts` (851)

---

## TODOs

### Admin UI Polish (Medium Priority)

- [ ] Leads Management - cards should filter table
- [ ] Fix tooltip for truncated text
- [ ] Better button design for portal sidebar
- [ ] Fix mobile view for portal

### Main Site Features (Medium Priority)

- [ ] SEO optimization

### Code Quality (Ongoing)

- [x] Split `client-portal.ts` - Phase 1 complete (1,952 lines, 3 new modules)
- [x] CSS !important cleanup - Phase 3 complete (336 → 289, ~14% reduction)
  - Phase 1: Added CSS cascade layers (`@layer`) to main.css
  - Phase 1: Cleaned mobile/contact.css (85 → 0)
  - Phase 1: Cleaned mobile/layout.css (61 → 3)
  - Phase 1: Cleaned client-portal/sidebar.css (47 → 0)
  - Phase 2: Cleaned admin/project-detail.css (45 → 0)
  - Phase 3: Cleaned page-transitions.css (47 → 0)

### CSS Cleanup Plan

**Problem:** Started with 650+ `!important` declarations indicating specificity wars.

**Progress:**

| File | Before | After | Status |
|------|--------|-------|--------|
| mobile/contact.css | 85 | 0 | DONE |
| mobile/layout.css | 61 | 3 | DONE |
| client-portal/sidebar.css | 47 | 0 | DONE |
| admin/project-detail.css | 45 | 0 | DONE |
| page-transitions.css | 47 | 0 | DONE |
| admin.css | 64 | - | Pending |

**Architectural Solutions Implemented:**

1. CSS Cascade Layers - `@layer` in main.css controls cascade order
2. Scoped Styles - `[data-page="admin"]` prefix for admin-specific overrides
3. High-specificity selectors - `section[data-page].page-hidden` instead of !important
4. GSAP inline styles first - Apply before class changes for animation states

---

## Plan for Remaining Work

### Immediate (This Week)

1. **Fix page transition animation issues** - Root cause the HR/button flash
2. **Fix header white flash** - Add background color to html element

### Short Term

3. **Split client-portal.ts** - Extract modules similar to admin-dashboard
4. **Admin UI polish** - Leads filtering, tooltips, mobile view

### Medium Term

5. **CSS !important cleanup** - Implement mobile-first approach for mobile/* files
6. **SEO optimization** - Meta tags, sitemap, structured data

---

## System Status

**Last Updated:** January 13, 2026

### Build Status

- **TypeScript:** 0 errors
- **ESLint:** 4 warnings (unused variables)
- **Build:** Success

### Development Server

```bash
npm run dev:full
```

- Frontend: http://localhost:4000
- Backend: http://localhost:4001

---

## Archived Work

- January 2026: [ARCHIVED_WORK_2026-01.md](./ARCHIVED_WORK_2026-01.md)
- December 2025: [ARCHIVED_WORK_2025-12.md](./ARCHIVED_WORK_2025-12.md)
