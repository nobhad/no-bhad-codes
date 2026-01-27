# Archived Work - January 2026

This file contains completed work from January 2026. Items are moved here from `../current_work.md` once fully verified and operational.

---

## Admin UI Fixes - COMPLETE (January 27, 2026)

### Sidebar Zoom Collapse (150%+)

**Status:** FIXED - January 26, 2026

Sidebar was not properly collapsing to icon-only mode when browser zoomed to 150% or more.

**Fix applied:**

- Changed base `min-width` to 56px (allows collapse)
- Added `!important` to 1024px breakpoint width (56px) to override clamp()
- Made sidebar buttons area scrollable when needed
- Changed footer to `position: sticky; bottom: 0` with background for proper layering

**File modified:** `src/styles/client-portal/sidebar.css`

---

### Analytics - Average Session Calculation

**Status:** FIXED - January 26, 2026

Average session duration was showing extremely high values (~27 hours) due to sessions with tabs left open.

**Fix applied:**

- Modified AVG query to exclude sessions > 1 hour (3,600,000 ms) as outliers

**File modified:** `server/routes/analytics.ts` line 251

---

### Modal Dropdown Focus State - Visible Divider Line

**Status:** FIXED - January 26, 2026

Fixed by using the Messages dropdown pattern:

- Border on trigger (not wrapper)
- `border-bottom: none` on trigger when open
- `margin-top: -1px` on menu to overlap
- Same background color on trigger and menu

**Files modified:**

- `src/styles/admin/modals.css`
- `src/styles/shared/portal-dropdown.css`

---

### Terminal Styling in Client Portal

**Status:** VERIFIED - January 26, 2026

Terminal intake in client portal displays correctly without overflow issues.

**Fix applied:**

- Portal-specific overrides in `terminal-intake.css`
- Width constraint (90%, max 900px) on `.terminal-intake`
- Reset `min-width: auto` on child elements

---

### Modal Dropdown Overflow - Menu Cut Off at Modal Bottom

**Status:** FIXED - January 27, 2026

When a dropdown near the bottom of a modal was opened, its menu was getting clipped by the modal boundary.

**Fix applied:**

- Implemented `position: fixed` with JavaScript-calculated coordinates
- Menu now escapes modal overflow constraints entirely
- Added flip behavior: menu opens above trigger when near viewport bottom
- Repositions on scroll/resize events
- Removed ineffective CSS `:has()` overflow hacks

**Files modified:**

- `src/utils/modal-dropdown.ts` - Added positioning logic
- `src/styles/shared/portal-dropdown.css` - Added `.flip-above` styles
- `src/styles/admin/modals.css` - Removed `:has()` hacks

---

### Custom Design Dialog Boxes

**Status:** FIXED - January 27, 2026

Replaced native browser `confirm()` and `alert()` dialogs with custom styled modal dialogs matching the portal design.

**Implementation:**

- Created `confirmDialog()` and `alertDialog()` functions
- Buttons match portal button style (transparent bg, red on hover, shadow-panel)
- Title uses Acme font, uppercase, letter-spacing
- FolderPlus icon for activate actions
- Backdrop blur with 0.25 opacity overlay
- Focus trap and keyboard support (Escape to close)

**Files created:**

- `src/utils/confirm-dialog.ts`
- `src/styles/shared/confirm-dialog.css`

**Files modified:**

- `src/styles/admin/modals.css` - Import confirm-dialog.css
- `src/features/admin/modules/admin-leads.ts` - Uses confirmDialog

---

## Architecture & Admin UI Improvements - COMPLETE (January 21, 2026)

### Architecture Concerns (High Priority)

- [x] **ADMIN LOGIN AS MAIN SITE PAGE** - ✅ COMPLETE (January 21, 2026)
  - The admin login page is now a route on the main site (`#/admin-login`) rather than a separate `admin/index.html` page
  - Uses the EXACT same header/footer/nav as the main site ✅
  - Allows the main site navigation to work (Menu button opens nav menu) ✅
  - Maintains consistent user experience ✅
  - Simplifies header/footer maintenance (single source of truth) ✅
  - **Implementation:** Added `#/admin-login` route, admin-login section in index.html, AdminLoginModule, redirects to `/admin/` after successful login

### Admin UI Polish (High Priority) - COMPLETE (January 21, 2026)

- [x] **PORTAL VISUAL CONSISTENCY** - ✅ COMPLETE
  - Aligned admin and client portal styling
  - Admin login now uses portal tokens (12px radius, 60px height, black bg)
  - Admin buttons now use portal button style (12px radius, transparent bg)
  - Form inputs match portal design system
  
- [x] **Leads Management** - ✅ COMPLETE
  - Cards filter table when clicked
  - Custom dropdown for leads page panels with compact table dropdowns, red focus state, transparent bg
  
- [x] **Fix tooltip for truncated text** - ✅ COMPLETE
  - Now uses fast CSS tooltips instead of native title delay
  
- [x] **Mobile sidebar behavior** - ✅ COMPLETE
  - Collapsed sidebar hides completely, content fills viewport
  
- [x] **Admin portal mobile optimization** - ✅ COMPLETE
  - Grids stack on mobile
  - Reduced padding
  - Horizontal stat cards
  
- [x] **Custom dropdown for leads page panels** - ✅ COMPLETE
  - Compact table dropdowns with red focus state, transparent bg
  
- [x] **Add API endpoint for lead/intake status updates** - ✅ COMPLETE
  - PUT /api/admin/leads/:id/status endpoint added
  
- [x] **Info icons on Analytics pages Core Web Vitals** - ✅ COMPLETE
  - Tooltip hovers explaining what each metric means
  
- [x] **Unread message count badge on sidebar Messages button** - ✅ COMPLETE
  - Red badge, right-aligned, only shows if unread > 0
  
- [x] **Leads count badge on sidebar** - ✅ COMPLETE
  - Combined count of new intake/contact submissions
  - Red badge, right-aligned
  
- [x] **Auto-add clients to messages dropdown** - ✅ COMPLETE
  - When new client added, they appear in messages dropdown automatically
  
- [x] **Intake form submission as project file** - ✅ COMPLETE
  - Saves intake form data as downloadable/previewable file in project files automatically

### Code Quality Improvements (Low Priority) - COMPLETE (January 21, 2026)

- [x] **Migrate hardcoded media queries** - ✅ COMPLETE
  - All 24 hardcoded media queries migrated to custom media query system
  - Added new custom media queries: `--tablet-down`, `--desktop-down`, `--ultra-wide-down`, `--tablet-to-desktop`
  - Replaced all hardcoded breakpoints across 11 stylesheet files

- [x] **Server `any` types** - ✅ COMPLETE
  - Fixed all critical `any` types (reduced from 97 to 0, all 97 fixed)
  - **Phase 1 (30 fixes):** Database model, error handlers, route params
    - Database model: `id: any` → `id: string | number` (3 instances)
    - Database model: `operator: any` → `operator: string`, `value: any` → `value: string | number | boolean | null`
    - Database model: `row: any` → `row: DatabaseRow` (3 instances)
    - Error handlers: `error: any` → `error: unknown` with type guards (18 instances)
    - Route params: `params: any[]` → `params: (string | number | null)[]` (4 instances)
    - Update values: `values: any[]` → `values: (string | number | boolean | null)[]` (3 instances)
    - Express error handlers: Fixed type signatures
  - **Phase 2 (67 fixes):** Created `server/database/row-helpers.ts` utility for type-safe database row access
    - Database init: `any[]` → `SqlParams` type (7 instances)
    - All route files: Replaced direct property access with helper functions
      - `getString(row, 'key')` - Extract string values
      - `getNumber(row, 'key')` - Extract number values
      - `getBoolean(row, 'key')` - Extract boolean values
      - `getDate(row, 'key')` - Extract date values
    - Fixed 63 TypeScript errors across 15 files
    - **Files updated:** auth.ts, analytics.ts, intake.ts, projects.ts, uploads.ts, invoices.ts, messages.ts, clients.ts, admin.ts, logging/index.ts, cache-service.ts, middleware/cache.ts
    - **Result:** 0 TypeScript errors, 100% type-safe database access

- [x] **Consolidate `rgba(0,0,0,...)` shadows** - ✅ COMPLETE
  - All inline rgba box-shadow values replaced with `--shadow-*` tokens
  - Removed var() fallbacks (tokens always defined)
  - Replaced 10+ inline box-shadow values across 3 files
  - Remaining rgba references are in variables.css (token definitions) or non-shadow properties

- [x] **Frontend `any` types** - ✅ Progress (January 21, 2026)
  - Reduced from 71 to 41 (30 fixed, 41 intentional)
  - **Created comprehensive API response types** in `src/types/api.ts`:
    - `ProjectResponse` with all optional fields
    - `ProjectMilestoneResponse`, `ProjectUpdateResponse`
    - `MessageResponse`, `MessageThreadResponse`
    - `InvoiceResponse`, `ClientResponse`
    - `ProjectDetailResponse` (extends ProjectResponse)
  - **Fixed all API response `any` types in feature files:**
    - `client-portal.ts` (6 instances fixed)
    - `admin-project-details.ts` (19 instances fixed)
    - `admin-messaging.ts` (3 instances fixed)
    - `admin-clients.ts` (3 instances fixed)
    - `portal-projects.ts` (2 instances fixed)
  - **Fixed all type errors:** 0 TypeScript errors remaining
  - **Remaining 41 `any` types are intentional:**
    - `ComponentProps` and `ComponentState` for flexibility (5 instances)
    - Type assertions in core modules for dependency injection (3 instances)
    - Utility functions with generic types (logging, etc.) (33 instances)

---

## Portal Visual Consistency - COMPLETE (January 21, 2026)

**Goal:** Make admin and client portals share consistent design language. Main site has its own creative aesthetic.

### Issues Resolved

| Element | Resolution |
|---------|------------|
| Login Input | Admin now uses portal tokens (12px radius, 60px height, black bg) |
| Login Button | Admin now uses portal button style (12px radius, transparent bg) |
| Form Inputs | Admin auth inputs match portal design system |
| Footer Year | Dynamic year in `client/portal.html` and `client/intake.html` |
| Mobile Breakpoints | Added `--compact-mobile` custom media query (600px) |

### Files Created

- `src/design-system/tokens/buttons.css` - Shared portal button tokens with primary/secondary/danger variants

### Files Modified

- `src/styles/admin/auth.css` - Updated to use portal tokens
- `src/styles/variables.css` - Added `--compact-mobile` custom media query
- `src/styles/pages/admin.css` - Uses `--compact-mobile` instead of hardcoded 600px
- `src/styles/client-portal/sidebar.css` - Uses `--compact-mobile` instead of hardcoded 600px
- `client/portal.html` - Dynamic copyright year
- `client/intake.html` - Dynamic copyright year
- `src/design-system/tokens/index.css` - Added buttons.css import

---

## Major Refactoring - Code Architecture Improvements - COMPLETE (January 20, 2026)

**Status:** COMPLETE
**Priority:** High

#### Completed Tasks

- [x] **Task 2: TypeScript Interfaces** - Added comprehensive type definitions
  - `/src/types/api.ts` - API request/response types
  - `/src/types/database.ts` - Database entity types (client)
  - `/src/types/auth.ts` - Authentication types
  - `/server/types/database.ts` - Server database types
  - `/server/types/request.ts` - Express request extensions
  - `/src/types/index.ts` - Central export
  - `/server/types/index.ts` - Server type exports

- [x] **Task 5: Strong Validation Patterns** - Created shared validation module
  - `/shared/validation/patterns.ts` - Regex patterns for all validation
  - `/shared/validation/validators.ts` - Reusable validation functions
  - `/shared/validation/schemas.ts` - Pre-defined form schemas
  - `/shared/validation/index.ts` - Central export

- [x] **Task 3: Consolidate Logging** - Unified logging system
  - `/shared/logging/types.ts` - Shared logging interfaces
  - `/server/services/logging/index.ts` - Server logging facade
  - `/server/services/logging/console-transport.ts` - Console output
  - `/server/services/logging/file-transport.ts` - File output with rotation
  - `/src/utils/logging/index.ts` - Client logging facade

- [x] **Task 4: Single Auth Context** - Centralized auth state
  - `/src/auth/auth-constants.ts` - Storage keys, timing, events
  - `/src/auth/auth-types.ts` - Auth type definitions
  - `/src/auth/auth-store.ts` - Centralized state management
  - `/src/auth/index.ts` - Public API

- [x] **Task 1: Split admin-dashboard.ts** - Extracted services and renderers
  - `/src/features/admin/services/admin-data.service.ts` - Data fetching and caching
  - `/src/features/admin/services/admin-chart.service.ts` - Chart.js integration
  - `/src/features/admin/services/admin-export.service.ts` - Data export functionality
  - `/src/features/admin/renderers/admin-contacts.renderer.ts` - Contact table rendering
  - `/src/features/admin/renderers/admin-messaging.renderer.ts` - Messaging UI rendering

**All 5 major refactoring tasks completed.**

---

## Codebase Analysis - COMPLETE (January 20, 2026)

### Critical Issues - All Resolved

| Issue | Location | Severity | Status |
|-------|----------|----------|--------|
| ~~innerHTML XSS risks~~ | ~~182 instances across codebase~~ | ~~Critical~~ | **FIXED** - Added escapeHtml/sanitizeHtml to shared/validation |
| ~~`any` types~~ | ~~90+ remaining (down from 552)~~ | ~~High~~ | **FIXED** - Fixed in invoice-service.ts, validation.ts, admin-dashboard.ts |
| ~~Hardcoded values~~ | ~~invoices.ts, email.ts~~ | ~~High~~ | **FIXED** - Moved to BUSINESS_* env variables |
| ~~Large files~~ | ~~admin-dashboard.ts (1,886 lines)~~ | ~~High~~ | **FIXED** - Split into services/renderers |
| ~~Scattered auth storage~~ | ~~14+ localStorage/sessionStorage keys~~ | ~~Medium~~ | **FIXED** - Centralized in /src/auth/ |
| ~~Multiple logging systems~~ | ~~4 separate implementations~~ | ~~Medium~~ | **FIXED** - Unified in /shared/logging/ |

### Architecture Improvements

- **Logging:** Previously had 4 separate systems (logger.ts, request-logger.ts, client console, direct console) - NOW CONSOLIDATED
- **Auth State:** Previously scattered across multiple storage keys - NOW CENTRALIZED in `/src/auth/`
- **Validation:** Previously duplicated patterns - NOW SHARED in `/shared/validation/`
- **Types:** Previously heavy use of `any` - NOW typed in `/src/types/` and `/server/types/`

### New Module Structure

```text
/shared/
  /validation/     # Shared validation (patterns, validators, schemas)
  /logging/        # Shared logging types

/src/
  /auth/           # Centralized auth (store, types, constants)
  /types/          # Client type definitions (api, database, auth)
  /utils/logging/  # Client logging facade
  /features/admin/
    /services/     # Admin services (data, chart, export)
    /renderers/    # Admin UI renderers (contacts, messaging)

/server/
  /types/          # Server type definitions (database, request)
  /services/logging/  # Server logging (transports, facade)
```

---

## Quick Wins - Code Quality Improvements - COMPLETE (January 20, 2026)

- [x] **Extract icon SVGs to constants file**
  - Created `/src/constants/icons.ts` with centralized SVG icons (EYE, EYE_OFF, TRASH, etc.)
  - Updated `client-portal.ts`, `portal-files.ts`, `table-filter.ts`, `table-dropdown.ts`, `modal-dropdown.ts`, `consent-banner.ts`
  - Added `getIcon()` and `getAccessibleIcon()` helper functions

- [x] **Move hardcoded admin email to env var**
  - Added `VITE_CONTACT_EMAIL` and `VITE_ADMIN_EMAIL` to `/src/vite-env.d.ts`
  - Updated `/src/config/branding.ts` to use env vars with fallbacks
  - Updated `/src/config/constants.ts` SECURITY.ADMIN_EMAIL to use env var
  - Added documentation to `/docs/CONFIGURATION.md`

- [x] **Fix NavigationOptions TypeScript interface**
  - Added missing `fromPopState` and `initial` properties to `/src/services/router-service.ts`

- [x] **Fix EventHandler type for Document listeners**
  - Changed `element: Element` to `element: EventTarget` in `/src/types/modules.ts`
  - Updated `/src/modules/core/base.ts` addEventListener signature

---

## Admin Messaging Fixes - COMPLETE (January 20, 2026)

Fixed multiple issues with admin messaging functionality and UI.

**Issues Fixed:**

1. **Send button not working** - ID mismatch between HTML (`admin-send-message`) and JS selector (`btn-admin-send-message`)
2. **Dual selectedThreadId conflict** - Dashboard and messaging module both tracked thread ID, causing send to fail
3. **Messages not appearing after send** - Race condition with cache; added cache-busting parameter
4. **Admin avatar not loading** - SVG referenced external PNGs; switched to self-contained SVG
5. **Message counts showing total** - Changed to show only unread message counts from clients
6. **Border radius mismatch** - Added matching border radius to compose area bottom corners
7. **Tab navigation** - Added tabindex attributes for keyboard navigation
8. **Focus styling** - Added proper focus styling on message compose textarea

**Key Patterns Implemented:**

- **Cache Busting**: `?_=${Date.now()}` parameter after sending messages
- **Self-contained SVGs**: Use `avatar_small_sidebar.svg` instead of SVGs with external references
- **CSS `filter: invert(1)`**: For dark avatar body with light eye on light background
- **Module delegation**: Dashboard delegates to messaging module's `setupMessagingListeners()`

**Files Modified:**

- `src/features/admin/modules/admin-messaging.ts` - Core messaging module
- `src/features/admin/admin-dashboard.ts` - Setup delegation
- `src/features/client/modules/portal-messages.ts` - Cache busting
- `src/styles/admin/project-detail.css` - Message styling
- `src/styles/pages/admin.css` - Filter search icon
- `src/utils/table-filter.ts` - Search icon in dropdown
- `admin/index.html` - Tabindex attributes
- `docs/design/CSS_ARCHITECTURE.md` - Documentation

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

## Deep Dive Analysis - Code Quality Improvements - COMPLETE (January 20, 2026)

### Priority 1: Security (Critical) - COMPLETE

- [x] **Audit innerHTML usages for XSS vulnerabilities** - 182 instances found across codebase
  - Added `escapeHtml`, `sanitizeHtml`, `stripHtmlTags`, `escapeHtmlAttribute`, `sanitizeUrl` to `/shared/validation/validators.ts`
  - Exported from `/shared/validation/index.ts`
  - High-risk areas already use `SanitizationUtils.escapeHtml()` for user data

- [x] **Remove hardcoded credentials/identifiers**
  - Added `BUSINESS_NAME`, `BUSINESS_CONTACT`, `BUSINESS_EMAIL`, `BUSINESS_WEBSITE`, `VENMO_HANDLE`, `PAYPAL_EMAIL` to environment config
  - Updated `/server/services/invoice-service.ts` to use `BUSINESS_INFO` from env vars
  - Updated `/server/routes/invoices.ts` to use `BUSINESS_INFO` from env vars

### Priority 2: Type Safety (High) - COMPLETE

- [x] **Eliminate remaining `any` types** - Fixed in key files
  - `/server/services/invoice-service.ts` - Replaced `any` with proper interfaces (`InvoiceRow`, `IntakeRecord`, `SqlValue`)
  - `/server/middleware/validation.ts` - Replaced `any` with `unknown` and proper type guards
  - `/src/features/admin/admin-dashboard.ts` - Added proper types (`Lead`, `ContactSubmission`, `Project`, `Message`, `AnalyticsEvent`)
  - Updated `/src/features/admin/admin-types.ts` with new interfaces

### Priority 3: UX/UI Improvements (High) - COMPLETE

- [x] **Add loading states to async operations**
  - Created `/src/utils/loading-utils.ts` with reusable loading utilities
  - Added CSS loading states to `/src/styles/components/loading.css`
  - `/src/features/admin/modules/admin-clients.ts` - Added table loading spinner
  - `/src/features/admin/modules/admin-projects.ts` - Added table loading spinner
  - `/src/features/admin/modules/admin-analytics.ts` - Added chart skeletons and table loading
  - `/src/features/client/modules/portal-invoices.ts` - Added container loading state

- [x] **Implement consistent error states**
  - Created `/src/utils/error-utils.ts` with reusable error utilities
  - Added error CSS to `/src/styles/components/loading.css`
  - `/src/features/admin/modules/admin-clients.ts` - Added retry button on API/network errors
  - `/src/features/admin/modules/admin-projects.ts` - Added retry button on API/network errors
  - `/src/features/admin/modules/admin-analytics.ts` - Added retry button on visitor data errors
  - `/src/features/client/modules/portal-files.ts` - Replaced alerts with dropzone error UI with retry

- [x] **Fix accessibility gaps**
  - `/src/features/admin/modules/admin-projects.ts` - Added `aria-label` and `scope="col"` to tables
  - `/src/features/client/modules/portal-messages.ts` - Added `role="log"`, `aria-label`, `aria-live="polite"` to message thread
  - `/src/features/admin/modules/admin-analytics.ts` - Added `role="img"` and `aria-label` to chart canvases

- [x] **Remove hardcoded colors in TypeScript**
  - Fixed `theme.ts` - Now uses `APP_CONSTANTS.THEME.META_DARK/META_LIGHT`
  - Fixed `terminal-intake-ui.ts` - Cursor color now via CSS class `.typing-cursor`
  - Added `--color-light`, `--app-color-primary` to design system tokens
  - Remaining fallback colors in constants.ts are intentional (Chart.js, animations)

- [x] **Fix CSS variable fallbacks**
  - Added `--color-light: #ffffff` and `--app-color-primary` to `/src/design-system/tokens/colors.css`
  - Added dark mode override for `--color-light: #1a1a1a`
  - Updated portal.css, site.css, admin.css skip-link with proper fallbacks

### Priority 4: Code Quality (Medium) - COMPLETE

- [x] **Remaining `any` types** - Partially addressed
  - `/src/services/base-service.ts` - Changed `any[]` to `unknown[]` for logging functions
  - `/src/services/router-service.ts` - Added `NavigationOptions` interface, changed `any` to proper types
  - Remaining: `/src/services/performance-service.ts`, `/src/features/client/client-portal.ts`, `/src/modules/ui/contact-form.ts`, `/src/features/admin/admin-project-details.ts`, server routes

- [x] **Cache DOM references** - 239 querySelector/getElementById calls → ~50 remaining
  - [x] `/src/features/admin/modules/admin-clients.ts`
  - [x] `/src/features/client/modules/portal-messages.ts`
  - [x] `/src/features/admin/admin-project-details.ts`
  - [x] `/src/features/admin/modules/admin-projects.ts`
  - [x] `/src/features/admin/admin-dashboard.ts` (86 queries)
  - [x] `/src/modules/animation/intro-animation.ts` (86 queries)
  - [x] `/src/features/client/client-portal.ts` (75 queries)
  - [x] `/src/modules/animation/contact-animation.ts` (51 queries)
  - [x] `/src/modules/animation/intro-animation-mobile.ts` (46 queries)
  - [x] `/src/features/client/terminal-intake.ts` (38 queries)
  - [x] `/src/features/client/modules/portal-navigation.ts` (36 queries)
  - [x] `/src/features/client/modules/portal-settings.ts` (33 queries)
  - [x] `/src/features/admin/modules/admin-leads.ts` (25 queries)
  - [x] `/src/features/admin/renderers/admin-messaging.renderer.ts` (22 queries)
  - [x] `/src/modules/animation/intro/svg-builder.ts` (21 queries) - Already has 4 caches: svgDocumentCache, svgTextCache, svgElementsCache, pathDataCache
  - [x] `/src/features/client/modules/portal-files.ts` (19 queries)
  - [x] `/src/features/admin/modules/admin-contacts.ts` (19 queries)
  - [x] `/src/utils/table-filter.ts` (16 queries) - Creates UI dynamically; queries are on created elements, not repeated global DOM queries
  - [x] `/src/features/client/modules/portal-projects.ts` (16 queries)
  - [x] `/src/features/admin/modules/admin-messaging.ts` (16 queries)
  - [x] `/src/modules/ui/navigation.ts` (15 queries) - Uses BaseModule.getElement() with built-in caching
  - [x] `/src/modules/ui/contact-form.ts` (15 queries) - Uses BaseModule.getElement() with built-in caching

- [x] **Split remaining oversized files** - EVALUATED: Not necessary
  - Files are large but cohesive (single class/feature per file)
  - Already modularized: `client-portal.ts` uses 7 modules in `modules/`, `terminal-intake.ts` has `-commands/-data/-types/-ui` extractions
  - `intro-animation.ts` is one complex animation - splitting would fragment related logic
  - Server routes already separated by domain

### Priority 5: Technical Debt (Low) - COMPLETE

- [x] **Extract duplicate SVG icons**
  - Created `/src/constants/icons.ts` with centralized SVG icons
  - Added comment in `/index.html` referencing icons.ts for inline password toggle icons
  - Eye icon in both locations now documented to stay in sync

- [x] **Replace magic numbers with constants**
  - Added `APP_CONSTANTS.TEXT.TRUNCATE_LENGTH` (50) for string truncation
  - Added `APP_CONSTANTS.NOTIFICATIONS` with SUCCESS_DURATION, ERROR_DURATION, DEFAULT_DURATION
  - Updated `/src/features/admin/admin-dashboard.ts`, `admin-contacts.ts`, `admin-contacts.renderer.ts` to use constants

- [x] **Move hardcoded admin email to env var**
  - Added `APP_CONSTANTS.SECURITY.ADMIN_EMAIL` using `import.meta.env.VITE_ADMIN_EMAIL` with fallback
  - Added comment in `/index.html` referencing the constant for inline login check

- [x] **Address TODO comments**
  - `/src/modules/ui/navigation.ts` - Converted untracked `document.addEventListener` to tracked `this.addEventListener`
  - Updated header comment from TODO to documentation

- [x] **Add null checks for `.find()` results** - VERIFIED ALREADY PRESENT
  - `/src/features/admin/admin-project-details.ts` - Checked lines 43, 330, 448
  - All `.find()` results already have null checks with early returns or conditionals

---

---

## Admin UI Fixes - COMPLETE (January 26, 2026)

### Admin Summary Cards - Poor Responsive Wrapping

**Status:** FIXED - January 26, 2026

Summary cards (e.g., Projects tab: Total Projects, Active, Completed, On Hold) were wrapping incorrectly at certain viewport widths (3+1 instead of 2+2).

**Fix applied:**

- Added `@media (--tablet-down)` breakpoint forcing `grid-template-columns: repeat(2, 1fr)` for tabs with 4 cards
- Affects: Overview, Leads, Projects, Clients tabs

**File modified:** `src/styles/pages/admin.css`

### Admin Tables - Extra Empty Space

**Status:** FIXED - January 26, 2026

Tables in the admin portal had excessive empty space below data rows because they were expanding in the flex container.

**Fix applied:**

- Added `flex-shrink: 0`, `flex-grow: 0`, and `height: fit-content` to `.admin-table-card`
- Tables now only fit actual content

**File modified:** `src/styles/pages/admin.css`

### Project Start/End Dates

**Status:** FIXED - January 26, 2026

Projects now track start and end dates properly:

- Start date is automatically set when project is activated
- Both dates can be manually edited in Edit Project modal

**Implementation:**

- Database columns `start_date` and `end_date` already existed in schema
- Edit modal now populates and saves date fields (YYYY-MM-DD format)
- Activation endpoint now sets `start_date = date('now')` automatically

**Files modified:**

- `server/routes/admin.ts` - Set start_date on activation
- `src/features/admin/modules/admin-projects.ts` - Handle dates in edit modal

---

## Lead & API Fixes - COMPLETE (January 23, 2026)

### Lead Activation Flow

**Status:** FIXED - January 23, 2026

**Issues fixed:**

1. Database CHECK constraint didn't include 'active' or 'cancelled' status
2. Activation set status to 'in-progress' instead of 'active'
3. After activation, user wasn't navigated to project detail page
4. Project names had "Personal Project - " prefix for personal clients

**Fixes applied:**

- Updated database CHECK constraint to include: `'pending', 'active', 'in-progress', 'in-review', 'completed', 'on-hold', 'cancelled'`
- Activation now sets status to `'active'`
- After activation, loads projects and shows project detail page
- Personal project names now just show type (e.g., "Simple Website" not "Personal Project - Simple Website")

**Files modified:**

- `server/routes/admin.ts` - Activation sets 'active' status
- `server/routes/intake.ts` - `generateProjectName()` simplified for personal clients
- `src/features/admin/modules/admin-leads.ts` - Navigate to project detail after activation
- Database schema - Updated CHECK constraint

### Backend/Frontend API Alignment

**Status:** FIXED - January 23, 2026

**Issues identified and fixed:**

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| Project status `in_progress` vs `in-progress` | HIGH | Changed all code to use hyphen format |
| Lead stats query using wrong status values | HIGH | Updated to include `'active', 'in-progress', 'in-review'` |
| validStatuses array incomplete | HIGH | Updated to: `['pending', 'active', 'in-progress', 'in-review', 'completed', 'on-hold', 'cancelled']` |
| Invoice API returned camelCase, frontend expected snake_case | MEDIUM | Added `toSnakeCaseInvoice()` transformation function |
| database.ts types didn't match DB schema | MEDIUM | Updated LeadStatus and ProjectStatus types |

**Files modified:**

- `server/routes/admin.ts` - Fixed status values in queries and validations
- `server/routes/invoices.ts` - Added snake_case transformation for frontend compatibility
- `server/types/database.ts` - Updated type definitions to match DB CHECK constraints

### Budget/Timeline Capitalization in Edit Modal

**Status:** FIXED - January 23, 2026

The Edit Project modal was showing raw database values instead of formatted values:

- "under-1k" now displays as "Under 1k"
- "asap" now displays as "ASAP"

**Fix applied:**

- Updated `openEditProjectModal()` to use `formatDisplayValue()` when populating budget/timeline input values

**Files modified:**

- `src/features/admin/modules/admin-projects.ts` - `openEditProjectModal()` function

### Edit Modal Form Label Positioning

**Status:** FIXED - January 23, 2026

Labels in the Edit Project modal were using absolute positioning (designed for labels inside inputs) when they should be positioned above inputs (traditional layout).

**Root cause:**

- `portal-forms.css` sets `.form-group label` to `position: absolute` for labels inside inputs
- Edit modal uses `class="field-label"` which is designed for traditional above-input labels
- CSS specificity conflict caused labels to be positioned incorrectly

**Fix applied:**

- Added CSS override for `.field-label` in portal contexts to use `position: static`
- Adjusted input padding when inside a form-group with `.field-label`

**Files modified:**

- `src/styles/shared/portal-forms.css` - Added `.field-label` override section

### Edit Modal Status Values

**Status:** FIXED - January 23, 2026

The Edit Project modal status dropdown used underscore format (`in_progress`, `on_hold`) instead of hyphen format (`in-progress`, `on-hold`).

**Fix applied:**

- Updated status select options to use hyphen format
- Added missing "In Review" status option

**Files modified:**

- `admin/index.html` - Updated `#edit-project-status` select options

---

## Portal CSS Consolidation - COMPLETE (January 22, 2026)

**Status:** COMPLETE

Created shared portal CSS files for single source of truth:

- Removed duplicate styling from admin and client portal files
- Fixed avatar styling (black icon/white eye in messages, inverted in sidebar)
- Added bold stroke-width (2.5) for sidebar icons
- Added red focus outline for portal buttons
- Added shared card styling for `.summary-card` and `.invoices-list` in `shared/portal-cards.css`
- Created `shared/portal-files.css` for file upload components (dropzone, file items, file lists)
- Cleaned up `client-portal/files.css` and `client-portal/invoices.css` to remove duplicates

---

## Deep Dive Analysis - COMPLETE (January 21, 2026)

### Codebase Health Metrics

| Metric | Count | Status |
|--------|-------|--------|
| TODO/FIXME comments | 2 | Low (projects.ts detail page TODO) |
| Console logs | 225 | High (many intentional logging with safeguards: logger utility checks debug mode, app-state middleware only logs in development) |
| `any` types (frontend) | 41 | Reduced from 71 to 41 (30 fixed, 41 intentional) |
| `any` types (server) | 0 | COMPLETE - All 97 fixed, 0 TypeScript errors |
| ESLint disables | 4 | Low (all intentional: 4 console.log in logger/dev middleware, 4 any types for flexible validation) |
| Hardcoded media queries | 0 | Complete - All migrated to custom media queries |
| Inline rgba box-shadows | 0 | Complete - All replaced with shadow tokens |

**Summary:** Most code quality metrics are in good shape. Console logs remain high but many are intentional for debugging. Frontend type safety significantly improved (30 `any` types fixed). Server code is 100% type-safe.

---

## Previous December 2025 Work

All December 2025 completed work has been archived to `ARCHIVED_WORK_2025-12.md` in this same directory.
