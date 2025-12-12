# Archived Work - December 2025

This file contains completed work from December 2025. Items are moved here from `current_work.md` once fully verified and operational.

---

## Code Quality Improvements & Security - COMPLETE (December 12, 2025)

### Summary

Completed 4 code quality and security tasks.

| Task | Result |
|------|--------|
| Split `client-portal.ts` | Reduced from 3,084 to 2,381 lines (23%) |
| Lazy load CodeProtectionService | Only loads when protection is enabled |
| Add HTTPS enforcement | Auto-redirects HTTP to HTTPS in production |
| Configure Redis caching | Installed and running via Homebrew |

### client-portal.ts Module Extraction

**Before**: 3,084 lines
**After**: 2,381 lines
**Reduction**: 703 lines (23%)

**Delegated to modules**:

- Invoice methods → `portal-invoices.ts`
- Message methods → `portal-messages.ts`
- Settings methods → `portal-settings.ts`

### CodeProtectionService Lazy Loading

Added `isProtectionEnabled()` helper in `protection.config.ts`. Service skipped when protection is disabled (saves ~15KB in development).

### HTTPS Enforcement

Added `shouldEnforceHttps()` and `redirectToHttps()` methods in Application class. Skips localhost, private IPs, and .local domains.

### Redis Configuration

```text
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Admin Modules Integration & Codebase Cleanup - COMPLETE (December 12, 2025)

### Admin Dashboard Code Splitting - RESOLVED

Integrated orphaned admin modules into `admin-dashboard.ts` for proper code splitting:

**Modules Now Active:**

- `src/features/admin/modules/admin-leads.ts` - Lead management (10.39 KB)
- `src/features/admin/modules/admin-contacts.ts` - Contact submissions (9.55 KB)
- `src/features/admin/modules/admin-projects.ts` - Project management (23.17 KB)
- `src/features/admin/modules/admin-messaging.ts` - Client messaging (10.05 KB)
- `src/features/admin/modules/admin-analytics.ts` - Analytics/performance (20.76 KB)
- `src/features/admin/modules/index.ts` - Barrel file with dynamic loaders

**Changes to admin-dashboard.ts:**

- Added imports for module loaders from `./modules`
- Created `moduleContext` property implementing `AdminDashboardContext`
- Updated `loadTabData()` to use dynamic module imports
- Updated `loadDashboardData()` to use analytics module
- Added `showNotification()` method for module callbacks

**Result:** Modules are now dynamically loaded for each tab, enabling proper code splitting. File reduced from 3,564 to 3,032 lines (15% reduction).

### Duplicate Code Removal - RESOLVED

Removed 532 lines of duplicate code from admin-dashboard.ts:

**Removed Methods:**

- `updateLeadsDisplay` - moved to admin-leads module
- `updateProjectsDisplay` - moved to admin-projects module
- `populateClientDropdown` - moved to admin-messaging module
- `populateLeadsTable` - moved to admin-leads module
- `populateVisitorsTable` - moved to admin-analytics module
- `getAnalyticsData`, `formatAnalyticsData`, `formatPageUrl`, `formatInteractionType` - analytics helpers

**Results:**

- File: 3564 → 3032 lines (15% reduction)
- Bundle: 114.94 KB → 95.02 KB (17% reduction)

### Unused Code Cleanup - RESOLVED

**Deleted Files:**

- `archive/` folder (6 files) - Retired client landing page files
- `src/modules/portfolio-carousel.ts` - Never imported
- `src/services/error-tracking.ts` - Never registered/used
- `src/config/routes.ts` - All exports unused
- `public/images/avatar_cyan.svg` - Not referenced
- `public/images/avatar_shadow_icon.svg` - Not referenced
- `public/images/avatar_shadow_layer.svg` - Not referenced
- `public/images/avatar_shadow_layer.ai` - Source file, not needed
- `public/images/avatar-hover.svg` - Not referenced
- `public/images/favicon_shadow.svg` - Not referenced

---

## Critical API Issues - RESOLVED (December 12, 2025)

All 3 critical issues from the deep dive have been fixed:

1. **Standardized API Response Format** - Created `server/utils/response.ts`
   - `sendSuccess()`, `sendBadRequest()`, `sendUnauthorized()`, `sendForbidden()`, `sendNotFound()`, `sendServerError()`
   - `ErrorCodes` enum for consistent error identification

2. **Centralized Auth Configuration** - Created `server/utils/auth-constants.ts`
   - `PASSWORD_CONFIG` - Salt rounds (12), min length (12), complexity requirements
   - `JWT_CONFIG` - User token expiry (7d), admin token expiry (1h)
   - `TIME_MS` - Time constants (MINUTE, FIFTEEN_MINUTES, HOUR, DAY, WEEK, MONTH)
   - `RATE_LIMIT_CONFIG` - Centralized rate limiting for all endpoints
   - `validatePassword()` - Centralized password validation

3. **Refactored auth.ts** - Updated all endpoints to use new utilities

**Files Created:**

- `server/utils/response.ts`
- `server/utils/auth-constants.ts`

---

## Backend Hardcoded Values - RESOLVED (December 12, 2025)

Fixed all 4 remaining hardcoded values:

1. **auth.ts:735** - Removed fallback email, now requires `ADMIN_EMAIL` env var
2. **clients.ts:419** - Uses `CLIENT_PORTAL_URL` or `FRONTEND_URL`, `SUPPORT_EMAIL` or `ADMIN_EMAIL`
3. **invoices.ts:871** - Uses `COMPANY_NAME`, `SUPPORT_EMAIL` or `ADMIN_EMAIL` env vars
4. **swagger.ts:446-447** - Uses `BRAND_COLOR` and `DARK_BG_COLOR` env vars with sensible defaults

---

## Domain & Email Corrections - RESOLVED (December 12, 2025)

Fixed incorrect domain `nobhadcodes.com` to `nobhad.codes` and standardized all emails to `nobhaduri@gmail.com`.

**Files Modified:** Config files, server files, client files, and documentation (bulk sed replacement).

---

## CSS Color Variable Cleanup - COMPLETE (December 12, 2025)

Major refactor complete:

- Added 50+ new CSS color variables to `variables.css`
- Fixed `client-portal.css` - 40+ hardcoded colors replaced
- Fixed `client.css` - 15+ hardcoded colors replaced (including status badges)
- Fixed `terminal-intake.css` - 50+ hardcoded colors replaced
- Fixed `admin.css` - 40+ hardcoded colors replaced
- Fixed `form.css`, `form-validation.css`, `contact.css`, `navigation.css`, etc.
- Only fallback values in `var()` functions remain (correct pattern)

---

## CSS Cleanup - COMPLETE (December 12, 2025)

- [x] Delete unused CSS files in root styles/ - VERIFIED: All files in use
- [x] Standardize breakpoints - Fixed 28 instances: 768px→767px, 480px→479px
- [x] Consolidate font-face definitions - VERIFIED: Only 1 definition exists
- [x] Remove duplicate video-responsive styles from variables.css
- [x] Replace hardcoded error colors with `var(--color-error-500)` in form-validation.css
- [x] Replace hardcoded success colors with `var(--color-success-500)` in form-validation.css
- [x] Standardize dark mode selectors - replaced `.dark-mode` with `html[data-theme="dark"]`

---

## Test Suite Cleanup - COMPLETE (December 12, 2025)

- [x] Remove `.js` extensions from test imports (8 files fixed)
- [x] Consolidate duplicate setup files - removed unused `tests/setup.ts` and `tests/setup/global.ts`
- [x] Standardize import patterns - converted 4 test files from `@/` to relative paths

---

## Accessibility Improvements - COMPLETE (December 12, 2025)

- [x] Add ARIA labels to messaging module buttons/icons
- [x] Add keyboard support to business card flip
- [x] Make file upload dropzone keyboard accessible

---

## Code Quality Fixes - COMPLETE (December 12, 2025)

- [x] Replace 50+ instances of `any` type with proper interfaces
  - Added `WorkItem`, `NavigatorWithConnection` interfaces to state.ts
  - Added `PortalFile`, `PortalInvoice`, `PortalProject`, `PortalMessage` interfaces to client-portal.ts
  - Typed reducers with proper payload casting
- [x] Fix N+1 query in `server/routes/projects.ts:87-104` - FIXED (subquery JOINs)
- [x] Standardize API response format across all endpoints - Created `server/utils/response.ts`

---

## Terminal Intake Splitting - COMPLETE (December 12, 2025)

Split `terminal-intake.ts` into 4 files:

- `terminal-intake.ts` - Main module (1,446 lines)
- `terminal-intake-types.ts` - TypeScript interfaces
- `terminal-intake-data.ts` - Question data
- `terminal-intake-ui.ts` - UI helper functions

Removed legacy `client-intake.ts` file.

---

## Documentation Fixes - COMPLETE (December 12, 2025)

- [x] Fix broken `server/routes/users.ts` reference in SETTINGS.md
- [x] Fix CSS_ARCHITECTURE cross-reference in docs/README.md
- [x] Add missing `REDIS_ENABLED` to CONFIGURATION.md
- [x] Create INFINITE_SCROLL.md feature doc
- [x] Create SCROLL_SNAP.md feature doc
- [x] Create /docs/design/ directory with UX_GUIDELINES.md, ANIMATIONS.md
- [x] Move CSS_ARCHITECTURE.md to /docs/design/
- [x] Fix admin README outdated port (3000 -> 4000)
- [x] Fix admin README outdated file paths
- [x] Fix 5 broken CSS_ARCHITECTURE.md links in feature docs
- [x] Create src/features/client/README.md

---

## Security Fixes - ALL COMPLETE (December 4, 2025)

### Critical Fixes

1. **XSS Vulnerabilities** - Added SanitizationUtils.escapeHtml() to messaging.ts, admin-dashboard.ts, client-portal.ts
2. **Hardcoded Admin Email** - Removed fallback, now requires ADMIN_EMAIL env var
3. **CSRF Protection** - N/A (JWT-based auth with Bearer tokens)
4. **Password Reset Rate Limiting** - Added 3 requests per 15 minutes per IP
5. **Path Traversal Risk** - Added `isPathSafe()` validation function
6. **Email Validation** - Added email format validation before forgot-password DB query

### High Priority Fixes

- Backend security fixes (parameterized queries, rate limiting, password complexity)
- Frontend security fixes (env var for admin hash, sanitization)
- Memory leak fixes (all modules have proper cleanup methods)

---

## Theme Toggle Fixes - COMPLETE (December 11, 2025)

- Added `transition: color 0.2s ease` to `.nav-logo-row`, `.theme-button`, `.menu-button`
- Changed `transition: none !important` to `transition: opacity 0s, visibility 0s !important`
- Changed `display: none !important` to `display: flex` with proper sizing for mobile

---

## Client Portal Header Dropdown & Intake Modal - COMPLETE (December 11, 2025)

Header Portal Dropdown:

- Portal button icon in header (circle-user icon)
- Dropdown with Password/Magic Link toggle
- Password form with visibility toggle
- Forgot password flow with reset confirmation
- Button turns green when form requirements met
- Backdrop overlay when open
- Close on backdrop click or Escape key
- Mobile responsive (slides up from bottom)

Intake Form Modal:

- "intake form" link in contact section opens modal
- Modal loads terminal intake form dynamically
- Close button (X) in top-right
- Backdrop overlay with close on click
- Mobile responsive (full screen on mobile)
- Lazy loads TerminalIntakeModule on first open

---

## Contact Form Styling - COMPLETE (December 11, 2025)

- Contact section width set to 80vw with centered alignment
- H2 underline changed to soft black (#333333), increased to 3px thickness
- Input border-radius with top-left pinched: `0 22px 22px 22px`
- Dark mode form text uses `--color-neutral-300`
- Dark mode SVG stroke uses `--color-neutral-300`
- Business card shadow deepened for dark mode
- Form validation updated to use `name`, `email`, `message` fields

---

## Hardcoding Elimination & Documentation Update - COMPLETE (December 4, 2025)

**Configuration Files Created:**

- `src/config/branding.ts` - Company identity, emails, meta info, terminal branding
- `src/config/routes.ts` - Centralized route path definitions
- `src/vite-env.d.ts` - TypeScript definitions for Vite environment variables
- `docs/CONFIGURATION.md` - Comprehensive configuration guide

**Changes Made:**

- EmailJS IDs now from env vars
- Formspree ID now from env var
- Demo credentials from env vars
- Copyright year dynamically set via JS

---

## Static Assets & API Proxy Fixes - COMPLETE (December 4, 2025)

- Fixed `.gitignore` (removed `public`, changed `data/` to `/data/`)
- Fixed Node.js version in package.json (`>=20` → `20.x`)
- Made all component imports static in app.ts
- Set `profilesSampleRate: 0` in Sentry config
- Added API proxy to Railway in vercel.json

---

## Cookie Consent & Intake Form Fixes - COMPLETE (December 4, 2025)

Cookie Consent:

- Added `waitForIntroComplete()` - waits for `intro-complete` class
- Changed cookie SVG to black
- Set `border-radius: 0` (sharp corners)
- Set `border: 3px solid #000000` on all buttons

Intake Form:

- Fixed multiselect edit loop with `e.stopPropagation()`
- Added `skipTyping` param to `askCurrentQuestion()`
- Added `scrollToQuestion()` method

---

## Tech Stack Update - COMPLETE (December 4, 2025)

Added: Sentry, Playwright, Vitest, PostgreSQL (via Supabase), Railway/Vercel, SQLite, Redis, JWT Auth, Storybook, Chart.js, PDFKit, Nodemailer, Handlebars

Removed: JSON, AJAX, XML, Bootstrap Vue

---

## Consent Banner Styling Update - COMPLETE (December 4, 2025)

- Replaced cookie emoji with Lucide cookie SVG icon
- Uses `--color-neutral-300` background
- Typography uses `--font-family-display` (Acme) with uppercase styling
- Uses design system CSS variables throughout
- Proper dark theme support

---

## Magic Link Login + Mobile Nav + Intake Form Improvements - COMPLETE (December 4, 2025)

**Magic Link Login:**

- Added "Sign in with Magic Link" button below password login
- `handleMagicLinkRequest()` sends email to `/api/auth/magic-link`
- Shows success message regardless of email existence (security)

**Mobile Navigation Fixes:**

- Added `@media (hover: none)` with `:active` states
- JavaScript toggles `.touch-active` class on first tap
- Second tap navigates
- Fixed rolling text effect for mobile

**Intake Form Improvements:**

- Conditional company question (asks "Is this for a company?" first)
- Number key support (1/2 keys on company questions)
- Modal opens at full width immediately (no expansion animation)

---

## Terminal Intake Form Enhancements - COMPLETE (December 3, 2025)

**Global Input Sanitization:**

- Created `server/middleware/sanitization.ts`
- `sanitizeString()`, `sanitizeObject()`, `sanitizeInputs()`, `stripDangerousPatterns()`
- Applied globally in `server/app.ts` after body parsing

**Terminal Intake Navigation:**

- Click to Edit: Users can click on previous answers to go back and edit
- Arrow Key Navigation: Press Up Arrow to go back to previous question
- Navigation removes subsequent messages and answers

**Terminal Intake Review Summary:**

- `generateReviewSummary()` to format all answers for review
- `showReviewAndConfirm()` to display review before submission
- `waitForReviewConfirmation()` for yes/no confirmation
- `waitForChangeDecision()` for restart/submit decision

**Additional Questions:**

- `customFeatures`, `hasDomain`, `domainName`, `hosting`, `hostingProvider`
- Fixed `dependsOn` logic to handle array values from multiselect fields

---

## Mobile Layout Restructure & UX Improvements - COMPLETE (December 3, 2025)

**Mobile Layout Restructure:**

- 4-Section Mobile Layout: Intro (business card), About, Tech Stack, Contact
- Business card section fills viewport and is centered
- Scroll snap enabled for smooth section transitions
- Header and footer scroll with content on mobile (not fixed)

**Contact Form Fixes:**

- Fixed error messages showing HTML `<br>` tags as literal text
- Updated `showFormMessage()` to create proper DOM elements for multi-line errors
- Removed `businessSize` field from contact service

**Intro Animation Improvements:**

- Removed card transform positioning
- Card now centered via flexbox in overlay
- Added `window.scrollTo(0, 0)` after intro completes

---

## Client Portal Mobile Responsiveness - COMPLETE (December 2, 2025)

**Mobile Navigation:**

- Fixed header bar with hamburger menu on mobile
- Sidebar slides from right side with dark overlay
- Close button inside sidebar when open

**Dashboard:**

- Stack stat cards in single column on mobile
- Move project status cards above quick stats section

**Files Page:**

- Stack file items vertically on mobile
- Hide drag/drop zone on mobile
- Trash icon only appears on client-uploaded files

**Messages Page:**

- Hide emoji picker on mobile
- Fix avatar positioning
- Extend message bubbles to edges of container
- Enable demo message sending

---

## Client Portal Landing Page - Two Card Layout - COMPLETE (December 2, 2025)

- Two-card layout (Intake and Login)
- New Client card links to `/client/intake`
- Existing Client card with inline login form
- Login form with email/password, visibility toggle, loading state, error messages
- Demo mode fallback (demo@example.com / demo123)

---

## Client Portal File Management System - COMPLETE (December 1, 2025)

**Backend Endpoints:**

- `/api/uploads/client` - GET - Get all files for authenticated client
- `/api/uploads/project/:projectId` - GET - Get all files for a specific project
- `/api/uploads/file/:fileId` - GET - Download/preview file with access control
- `/api/uploads/file/:fileId` - DELETE - Delete file (ownership verification)

**Frontend Features:**

- Drag & drop file upload with visual feedback
- File list rendering from API with demo fallback
- File preview and download functionality
- File type icons, size formatting, upload progress

---

## Client Portal Invoice Management System - COMPLETE (December 1, 2025)

**Backend Endpoint:**

- `/api/invoices/me` - GET - Get all invoices for authenticated client with summary stats

**Frontend Features:**

- Invoice list rendering with status badges
- Invoice preview and download functionality
- Currency formatting with Intl.NumberFormat

---

## Client Portal Feature Completion - COMPLETE (December 1, 2025)

**Features:**

- File Delete - Delete button with confirmation
- Settings Save - Profile, password, notifications, billing info save to backend
- New Project - Form submission creates project request with admin notification
- Project Preview - Iframe loads project preview URL from API
- Invoice PDF - Full PDF generation with pdfkit
- Messages - Connected to messaging API with thread support

**Backend Endpoints Added:**

- `/api/clients/me` - GET/PUT - Client profile
- `/api/clients/me/password` - PUT - Change password
- `/api/clients/me/notifications` - PUT - Notification preferences
- `/api/clients/me/billing` - PUT - Billing information
- `/api/projects/request` - POST - Submit new project request
- `/api/invoices/:id/pdf` - GET - Download invoice as PDF

---

## Port Configuration Changed - COMPLETE

Changed all ports to 4000/4001:

- Frontend: 3000 → 4000
- Backend: 3001 → 4001

---

## Footer Not Displaying on Main Page - FIXED (v3)

**Root Cause:** `intro-loading` class hiding footer, intro animation not completing.

**Final Fix (v3):**

- Removed footer from intro-loading CSS rules entirely
- Added `opacity: 1 !important; visibility: visible !important;` to `footer.css`
- Footer is no longer hidden during intro animation

---

## Client Landing Page Loading Unnecessary Modules - FIXED

**Root Cause:** Page type detection only checked for `/client` AND `/portal`, so `/client/landing` was treated as main site page.

**Fix:** Added specific page type detection for `/client/landing` and `/client/intake` with dedicated module lists.
