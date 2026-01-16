# Archived Work - January 2026

This file contains completed work from January 2026. Items are moved here from `../current_work.md` once fully verified and operational.

---

## Page Transition Animation Flash - RESOLVED (January 13, 2026)

**Issue:** HR element and button briefly flashed before content animated in with blur effect.

**Status:** No longer occurring - resolved through previous animation simplification work.

---

## Admin Project Additional Fields - COMPLETE (January 13, 2026)

Added new fields to project management for better tracking and exposed existing date fields in the edit form.

**New Database Columns:**

- `notes` - Internal admin notes (not visible to clients)
- `repository_url` - GitHub/GitLab repository URL
- `staging_url` - Staging environment URL
- `production_url` - Production environment URL
- `deposit_amount` - Deposit amount received
- `contract_signed_at` - Contract signing date

**Existing Fields Now Exposed:**

- `start_date` - Project start date (was hidden)
- `estimated_end_date` - Target completion date (was hidden)

**Files Modified:**

- `server/database/migrations/021_project_additional_fields.sql` - New migration
- `server/database/migrations/020_project_price.sql` - Fixed format
- `server/routes/projects.ts` - Added fields to API field mapping
- `admin/index.html` - Added form fields to edit modal and display elements
- `src/features/admin/admin-project-details.ts` - Updated modal and save logic

---

## Admin Project Edit Button Fix - COMPLETE (January 13, 2026)

Fixed broken project editing functionality in admin dashboard.

**Issues Fixed:**

1. **Edit button not working** - Handler existed in `admin-projects.ts` but wasn't called from detail view
2. **Auth check failing** - Was checking `client_auth_mode` (client portal only) instead of `AdminAuth`
3. **Field name mismatch** - Frontend sent `budget_range` but backend expected `budget`
4. **Missing database columns** - Added `price` column via migration 020
5. **Logout not working** - Server uses HttpOnly cookies, needed server endpoint call

**Files Modified:**

- `src/features/admin/admin-project-details.ts` - Added edit modal methods, fixed auth
- `src/features/admin/admin-auth.ts` - Fixed logout to call server endpoint
- `src/features/admin/modules/admin-projects.ts` - Fixed budget field name
- `server/routes/projects.ts` - Added field mappings
- `server/routes/clients.ts` - Allow creating clients without password

---

## Header White Flash in Dark Mode - FIXED (January 13, 2026)

**Issue:** Header area briefly flashed white when navigating in dark mode.

**Root Cause:** Inline critical CSS in `index.html` had hardcoded color values (`#f8f5f4`) that didn't match the CSS variable `--color-neutral-300` (`#e0e0e0`).

**Solution:** Replaced all hardcoded background colors with `var(--color-neutral-300)` which is theme-aware (light: `#e0e0e0`, dark: `#333333`).

**Files Modified:**

- `index.html` - Use CSS variables instead of hardcoded colors
- `src/styles/components/intro-morph.css` - Updated comment to match actual color value

---

## Terminal Styling Refactor - COMPLETE (January 13, 2026)

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

---

## Client Portal - Real Project Data - COMPLETE (January 13, 2026)

Fixed client portal to fetch real project data from API instead of using hardcoded demo data.

**Issue:** Client portal was using demo data for projects/milestones even for authenticated users. Admin-created milestones didn't appear in client portal.

**Root Cause:** `loadMockUserProjects()` was called for ALL users, not just demo mode.

**Fix Implemented:**

1. Created `loadRealUserProjects()` method that fetches from `/api/projects`
2. For each project, fetches milestones from `/api/projects/:id/milestones`
3. Transforms API data to match `ClientProject` interface
4. Authenticated users now use real method, demo mode still uses mock data
5. Added `fetchProjectDetails()` for on-demand loading of updates/messages when project is selected

**Files Modified:**

- `src/features/client/client-portal.ts` - Added real project loading methods

**Bidirectional Data Flow Now Working:**

| Direction | Data Type | API Endpoint |
|-----------|-----------|--------------|
| Admin → Client | Projects | `/api/projects` |
| Admin → Client | Milestones | `/api/projects/:id/milestones` |
| Admin → Client | Files | `/api/uploads/client` |
| Admin → Client | Messages | `/api/messages/threads` |
| Admin → Client | Invoices | `/api/invoices/me` |
| Client → Admin | Updates/Messages | Via project details view |

---

## Admin Project Details - API Fixes - COMPLETE (January 13, 2026)

Fixed broken API endpoints in admin project details page.

**Fixed Issues:**

1. **Files API** - Changed `/api/files?project_id=X` to `/api/uploads/project/:id`
2. **Messages API** - Changed to thread-based system (`/api/messages/threads`)
3. **File download URL** - Changed to `/api/uploads/file/:id`

**All Buttons Verified Working:**

| Button | API Endpoint | Status |
|--------|--------------|--------|
| Save Settings | `PUT /api/projects/:id` | Works |
| Send Message | `POST /api/messages/threads/...` | Fixed |
| Add Milestone | `POST /api/projects/:id/milestones` | Works |
| Toggle/Delete Milestone | `PUT/DELETE /api/projects/:id/milestones/:id` | Works |
| Create/Send Invoice | `POST /api/invoices`, `POST /api/invoices/:id/send` | Works |
| Upload/Download Files | `POST /api/projects/:id/files`, `GET /api/uploads/file/:id` | Fixed |

**Files Modified:**

- `src/features/admin/admin-project-details.ts` - Fixed API endpoints

---

## CSS Quick Wins - Hardcoded Values Cleanup - COMPLETE (January 13, 2026)

Replaced hardcoded colors and shadows with CSS variables across the codebase.

**Completed:**

1. **Hardcoded Colors Fixed**
   - `admin.css` - Replaced hex colors (`#f5f5f5`, `#cccccc`, `#999999`) with `var(--color-gray-*)` tokens
   - `business-card.css` - Replaced `#333333` with `var(--color-dark)`
   - `client-portal/dashboard.css` - Replaced `#2a2a2a` with `var(--portal-bg-readonly)`
   - `client-portal/components.css` - Replaced `#333333`, `#f5f5f5` with portal variables

2. **Shadow System Standardized**
   - Added new shadow variables to `variables.css`:
     - `--shadow-elevated-sm`: `0 4px 12px rgba(0, 0, 0, 0.15)`
     - `--shadow-elevated-md`: `0 8px 32px rgba(0, 0, 0, 0.1)`
     - `--shadow-elevated-lg`: `0 8px 32px rgba(0, 0, 0, 0.3)`
     - `--shadow-elevated-xl`: `0 12px 40px rgba(0, 0, 0, 0.15)`
     - `--shadow-dropdown`: `4px 0 12px rgba(0,0,0,0.3), -4px 0 12px rgba(0,0,0,0.3), 0 -4px 12px rgba(0,0,0,0.3)`

3. **Hardcoded Shadows Replaced (52 instances)**
   - `admin.css` - 5 shadows replaced
   - `contact.css` - 2 shadows replaced
   - `projects.css` - 2 shadows replaced
   - `client.css` - 2 shadows replaced
   - `mobile/contact.css` - 1 shadow replaced
   - `portfolio-carousel.css` - 4 shadows replaced
   - `project-detail.css` - 1 shadow replaced

**Result:**

- Reduced hardcoded shadows from 78 to 26
- Standardized shadow hierarchy for consistent depth across UI
- All colors now use CSS variable tokens for theme consistency

---

## Contact Section Animation Refactor - COMPLETE (January 13, 2026)

Replaced business card with avatar blurb and unified contact section animations.

**Completed:**

1. **Removed Business Card Animations**
   - Removed card flip animation (rotationY 180)
   - Removed click-to-flip handler
   - Removed 3D tilt effect on mouse move/leave
   - Reduced file from ~850 to 705 lines

2. **Added Avatar Blurb Animation**
   - Avatar blurb scales up from 0.8 with blur clear effect
   - Synced with form fields cascade
   - Uses `back.out(1.4)` ease for subtle pop effect

3. **Unified Animation Timing**
   - Form fields, submit button, and avatar blurb all animate together
   - Cohesive reveal: blur-in phase then synced scale+fade for all content

**Commits:**

- `2e7d097` - refactor: remove business card animations from contact section
- `6c390c0` - feat: add avatar blurb animation synced with contact form

---

## Page Transitions Simplification - COMPLETE (January 13, 2026)

Simplified page transitions from complex page-specific animations to uniform blur effect.

**Changes:**

- Replaced 1,200+ lines of complex animations with ~30 line methods
- Uniform blur animation for all pages (opacity 0->1, blur 12px->0)
- Uses `page-entering` CSS class as bridge during class transitions
- All content animates together as one unit

**Commit:**

- `4e1a758` - refactor: simplify page transitions to uniform blur animation

---

## Coyote Paw Animation Page Restriction - COMPLETE (December 27, 2025)

Fixed issue where coyote paw animation would sometimes play when refreshing non-intro pages.

**Issue:** Mobile intro animation module was missing page check that exists in desktop version.

**Fix:** Added same page check to `MobileIntroAnimationModule.init()`:

```typescript
const hash = window.location.hash;
const isIntroPage = !hash || hash === '#' || hash === '#/' || hash === '#/intro' || hash === '#/home';
if (!isIntroPage) {
  this.skipIntroImmediately();
  return;
}
```

---

## Animation Smoothness Deep Dive - COMPLETE (December 23, 2025)

Comprehensive optimization of GSAP animations for smoother performance.

**Optimizations:**

1. SVG Morph Animations - Linear easing for smoother vertex interpolation
2. GPU Acceleration with force3D on all SVG morphing
3. Blur Animation Optimization - Reduced blur amounts
4. will-change GPU hints added and cleaned up
5. Layout Thrashing Fix - Batched DOM reads before writes
6. ScrollTrigger Refresh after page transitions
7. Mobile Animation Timing optimizations
8. New `SVG_MORPH: 'none'` constant added

---

## Deprecated Code Cleanup - COMPLETE (December 23, 2025)

- Removed `src/modules/animation/infinite-scroll.ts`
- Removed `docs/features/INFINITE_SCROLL.md`
- Cleaned up related comments and CSS

---

## Comprehensive Documentation Update - COMPLETE (December 23, 2025)

- Updated CSS_ARCHITECTURE.md, ARCHITECTURE.md, docs/README.md
- Updated SYSTEM_SUMMARY.md with Animation System section
- Updated ANIMATIONS.md, UX_GUIDELINES.md, INTRO_ANIMATION.md

---

## Hero Animation Extraction - COMPLETE (December 21, 2025)

Created shared base class for hero animations.

- Created `src/modules/animation/base-hero-animation.ts` (299 lines)
- Refactored `page-hero.ts`: 470 -> 338 lines
- Refactored `about-hero.ts`: 427 -> 301 lines
- Extracted ~400 lines of duplicate code

---

## CSS Audit - COMPLETE (January 12, 2026)

Full audit of CSS ID selectors, naming conventions, and !important usage.

**Findings:**

- 58 ID selectors identified across CSS files
- 1 duplicate ID conflict found and fixed (`#btn-logout`)
- 650+ `!important` declarations identified (architectural issue)
- 86 duplicate class names identified for potential extraction

**Fixes Applied:**

- Removed redundant `#btn-logout` ID selectors
- Converted `#pd-messages-list`/`#pd-messages-thread` to `.messages-thread` class

---

---

## Codebase Audit & Consolidation - COMPLETE (January 15, 2026)

**Deep dive audit completed** - Identified and addressed duplicates across CSS, TypeScript, and HTML.

**CSS Duplicates Removed (~70 lines):**

- Removed duplicate scrollbar styling from `reset.css` (kept `main.css` version with design system variables)
- Consolidated `.visually-hidden` and `.sr-only` to single `.sr-only` class in `reset.css`
- Removed duplicate `.sr-only` from `nav-base.css`
- Removed duplicate `.visually-hidden` from `main.css`, `client-portal/components.css`, `admin/auth.css`
- Updated all HTML/TS to use `.sr-only` (WCAG 2.x compliant)

**API Client Migration (COMPLETE):**

All admin feature files now use centralized `api-client.ts` utilities instead of raw `fetch()`:

- `admin-auth.ts` - 2 calls migrated (login, logout)
- `admin-dashboard.ts` - 10 calls migrated
- `admin-project-details.ts` - 14 calls migrated
- `admin-projects.ts` - 8 calls migrated
- `admin-clients.ts` - 8 calls migrated
- `admin-messaging.ts` - 4 calls migrated
- `admin-system-status.ts` - 2 calls migrated

Benefits: Centralized token expiration handling, automatic session management, consistent error handling.

**JWT Utilities (COMPLETE):**

Created `src/utils/jwt-utils.ts` with centralized token handling:

- `decodeJwtPayload(token)` - Parse JWT payload safely
- `isTokenExpired(token)` - Check expiration
- `isAdminPayload(payload)` - Check admin flag
- `isAdminToken(token)` - Combined check
- `getTokenTimeRemaining(token)` - Time until expiration
- `validateToken(token)` - Full validation

Files updated to use jwt-utils:

- `admin-auth.ts` - 4 inline decodes → jwt-utils
- `portal-auth.ts` - 1 inline decode → jwt-utils
- `client-portal.ts` - 1 inline decode → jwt-utils

**Files Modified:**

- `src/styles/base/reset.css` - Removed duplicate scrollbar styles
- `src/styles/main.css` - Removed `.visually-hidden`
- `src/styles/components/nav-base.css` - Removed duplicate `.sr-only`
- `src/styles/client-portal/components.css` - Removed `.visually-hidden`
- `src/styles/admin/auth.css` - Removed `.visually-hidden`
- `src/features/admin/modules/*.ts` - All use api-client utilities
- `src/features/admin/*.ts` - All use api-client utilities
- `index.html`, `admin/index.html`, `client-portal.ts` - Updated to use `.sr-only`

---

## Admin Table Filtering - COMPLETE (January 15, 2026)

**Implemented evergreen-style filtering for all admin tables:**

- Text search across multiple fields (debounced 200ms)
- Status filter dropdown with checkboxes (multi-select)
- Date range filtering (start/end dates)
- Column sorting with direction toggle
- LocalStorage persistence

**Files Created:**

- `src/utils/table-filter.ts` - Core filtering utilities (~500 lines)

**Files Modified:**

- `src/styles/pages/admin.css` - Filter component CSS (~300 lines)
- `admin/index.html` - Filter container IDs
- `src/features/admin/modules/admin-leads.ts` - Filtering integrated
- `src/features/admin/modules/admin-contacts.ts` - Filtering integrated
- `src/features/admin/modules/admin-projects.ts` - Filtering integrated
- `src/features/admin/modules/admin-clients.ts` - Filtering integrated

---

## CSS Cleanup & Code Organization - COMPLETE (January 15, 2026)

**CSS File Optimization (-499 lines total):**

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| client.css | 1716 | 1403 | -313 lines (18%) - Removed unused LEGACY portal styles |
| contact.css | 1000 | 902 | -98 lines (10%) - Trimmed excessive header docs |
| business-card.css | 743 | 655 | -88 lines (12%) - Extracted intro-nav to separate module |

**Files Created:**

- `src/styles/components/intro-nav.css` - Navigation links below business card

**Files Modified:**

- `src/styles/main.css` - Added intro-nav.css import

**Client Portal Code Consolidation (-185 lines):**

- Removed duplicate file upload handlers from `client-portal.ts`
- Now uses module version in `portal-files.ts`
- Main file reduced from 1855 to 1670 lines

---

## CSS Consolidation - COMPLETE (January 15, 2026)

**Terminal CSS:**
Merged `src/styles/components/terminal.css` into `src/styles/pages/terminal-intake.css` since the terminal component is only used for the intake form.

**Admin CSS (2899 → 1846 lines, -1053 lines, 36% reduction):**

Phase 1 - Consolidated duplicate table styles to use `.admin-table` base class:
- Created `.admin-table-container` for common container styles
- Extended `.admin-table` with all common table styles (th, td, hover, links)
- Removed duplicate `.leads-table`, `.visitors-table`, `.clients-table`, `.contacts-table`, `.projects-table` definitions
- Simplified status dropdown selectors from ~110 lines to ~90 lines

Phase 2 - Split into modules:
- Created `src/styles/admin/auth.css` (266 lines) - Auth gate, login form, password toggle
- Created `src/styles/admin/modals.css` (251 lines) - Modal overlay, body, footer, dropdowns
- Created `src/styles/admin/analytics.css` (231 lines) - Charts, vitals, performance metrics

**Files Modified:**

- `src/styles/pages/terminal-intake.css` - Now contains all terminal styles
- `src/styles/pages/admin.css` - Consolidated tables, extracted modules (1846 lines)
- `src/styles/admin/index.css` - Added imports for new modules
- `src/styles/main.css` - Removed terminal.css import

**Files Created:**

- `src/styles/admin/auth.css` - Authentication styles
- `src/styles/admin/modals.css` - Modal styles
- `src/styles/admin/analytics.css` - Analytics/charts styles

**Files Deleted:**

- `src/styles/components/terminal.css` - Merged into terminal-intake.css

---

## Admin Portal Mobile Optimization - COMPLETE (January 14, 2026)

**Mobile-specific styles added to `src/styles/pages/admin.css`:**

- All grids stack to single column on mobile (600px breakpoint)
- System page: reduced padding, removed grey backgrounds from status items, text wraps properly
- Analytics page: reduced chart padding/height, 2x2 grid for chart legends
- Stat cards: horizontal layout (number + label on same row) to save vertical space
- Page background matches content area for consistent appearance

**Files Modified:**

- `src/styles/pages/admin.css` - Added 113 lines of mobile-specific styles
- `src/styles/client-portal/layout.css` - Added body background color
- `src/styles/client-portal/sidebar.css` - Mobile sidebar collapse behavior

---

## API Fixes - COMPLETE (January 14, 2026)

**Fixed 404 Errors:**

- Added `GET /api/projects/:id/files` endpoint to return project files
- Added `GET /api/projects/:id/messages` endpoint to return project messages

**Fixed 401 Token Expiration Handling:**

- Created `src/utils/api-client.ts` - centralized API client with automatic token expiration handling
- Updated `admin-leads.ts` to use new API client
- Updated `admin-contacts.ts` to use new API client
- Updated `admin-analytics.ts` to use new API client
- Configured API client in `admin-dashboard.ts` to show notification on session expiry
- When token expires, user now sees "Your session has expired. Please log in again." message and is redirected to login

**Files Modified:**

- `server/routes/projects.ts` - Added GET endpoints for files and messages
- `src/utils/api-client.ts` - New centralized API client
- `src/features/admin/admin-dashboard.ts` - API client configuration
- `src/features/admin/modules/admin-leads.ts` - Use apiFetch
- `src/features/admin/modules/admin-contacts.ts` - Use apiFetch
- `src/features/admin/modules/admin-analytics.ts` - Use apiFetch

---

## Client Portal Code Refactor - COMPLETE (January 15, 2026)

**Large Files Status:**

| File | Lines | Priority | Status |
|------|-------|----------|--------|
| `client-portal.ts` | 1,405 | High | DONE - login, auth, animations consolidated to modules |
| `admin-dashboard.ts` | 1,917 | Medium | Already has 9 extracted modules |
| `intro-animation.ts` | 1,815 | Medium | Animation logic |
| `terminal-intake.ts` | 1,685 | Medium | Terminal UI logic |
| `page-transition.ts` | 580 | Low | Recently simplified |
| `admin-project-details.ts` | 1,250+ | Low | Recently extended with new fields |

**Client Portal Refactor Progress:**

New modules created (total 7 modules now):

- `portal-navigation.ts` (357 lines) - Navigation, views, sidebar, mobile menu
- `portal-projects.ts` (308 lines) - Project loading, display, preview
- `portal-auth.ts` (308 lines) - Login, logout, session management, helper functions
- `portal-files.ts` (397 lines) - File management + upload handlers
- `portal-invoices.ts` (208 lines) - Invoice management
- `portal-messages.ts` (207 lines) - Messaging
- `portal-settings.ts` (261 lines) - Settings forms

Main file reduced from 2,293 to 1,405 lines (~888 lines removed/extracted).

---

## Code Quality Improvements - COMPLETE (January 15, 2026)

### CSS !important Cleanup

**Problem:** Started with 650+ `!important` declarations indicating specificity wars.

**Progress:**

| File | Before | After | Status |
|------|--------|-------|--------|
| mobile/contact.css | 85 | 0 | DONE |
| mobile/layout.css | 61 | 3 | DONE |
| client-portal/sidebar.css | 47 | 0 | DONE |
| admin/project-detail.css | 45 | 0 | DONE |
| page-transitions.css | 44 | 2 | DONE (accessibility rules kept) |
| admin.css | 29 | 4 | DONE |
| terminal-intake.css | 41 | 0 | DONE |
| client.css | 32 | 0 | DONE |
| client-portal-section.css | 30 | 1 | DONE (reduced motion kept) |
| contact.css | 24 | 7 | DONE (autofill, high contrast, reduced motion kept) |
| business-card.css | 20 | 3 | DONE (reduced motion, print kept) |
| projects.css | 13 | 0 | DONE |
| nav-portal.css | 13 | 0 | DONE |
| reset.css | 10 | 10 | DONE (all accessibility/print - kept) |

**Architectural Solutions Implemented:**

1. CSS Cascade Layers - `@layer` in main.css controls cascade order
2. Scoped Styles - `[data-page="admin"]` prefix for admin-specific overrides
3. High-specificity selectors - `section[data-page].page-hidden` instead of !important
4. GSAP inline styles first - Apply before class changes for animation states
5. Page-states layer - Added `page-states` layer after `pages` for transition state overrides
6. Section prefixes - `section.client-portal-section`, `.contact-section` for component isolation
7. Parent context selectors - `.contact-section .contact-business-card .business-card-container` for nested overrides
8. Doubled class selectors - `.intake-modal.intake-modal` for modal override specificity
9. Element type prefixes - `section.page-hero-desktop`, `div.page-hero-desktop` for hidden elements

---

## Documentation Organization - COMPLETE (January 15, 2026)

**Documentation Consolidation:**

1. **API Documentation Merge** - Merged `API_REFERENCE.md` into `API_DOCUMENTATION.md`
2. **System Documentation Merge** - Merged `SYSTEM_SUMMARY.md` and `IMPLEMENTATION_GUIDE.md` into `SYSTEM_DOCUMENTATION.md`
3. **Documentation Organization** - Moved all documentation files to `docs/` directory:
   - `CODEBASE_REVIEW.md` → `docs/CODEBASE_REVIEW.md`
   - `COVERAGE.md` → `docs/COVERAGE.md`
   - `current_work.md` → `docs/current_work.md`
   - `DOCUMENTATION_ANALYSIS.md` → `docs/DOCUMENTATION_ANALYSIS.md`
   - `ARCHIVED_WORK_2025-12.md` → `docs/archive/ARCHIVED_WORK_2025-12.md`
   - `ARCHIVED_WORK_2026-01.md` → `docs/archive/ARCHIVED_WORK_2026-01.md`
4. **Design Analysis Cleanup** - Deleted external design reference docs:
   - `docs/design/CHRISTINA_KOSIK_DESIGN_ANALYSIS.md` (deleted)
   - `docs/design/SALONI_GARG_DESIGN_ANALYSIS.md` (deleted)

---

## Previous December 2025 Work

All December 2025 completed work has been archived to `ARCHIVED_WORK_2025-12.md` in this same directory.
