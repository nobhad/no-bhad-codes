# Current Work - December 12, 2025

---

## Assets to Add

### paw.svg

Red paw print SVG icon - needs to be added to project assets.

**Note:** Contains hardcoded color `#d11818` - should be updated to use CSS variable or `currentColor` for theme compatibility.

---

## Admin Dashboard Module Extraction - COMPLETE (December 12, 2025)

### Summary

Extracted 3 new modules from admin-dashboard.ts and replaced mock data with real data fetching:

**New Modules Created:**

| Module | Lines | Purpose |
|--------|-------|---------|
| `admin-overview.ts` | 239 | Real visitor tracking data from localStorage |
| `admin-performance.ts` | 388 | Real Core Web Vitals from browser Performance API |
| `admin-system-status.ts` | 341 | Real service/module health checks |

**Key Changes:**

- Overview dashboard now fetches real visitor data from VisitorTrackingService (localStorage)
- Performance metrics use browser Performance API for real LCP, FID, CLS, TTFB
- System status performs actual health checks (API, storage, tracking)
- Removed hardcoded mock data that showed fake statistics
- All modules use dynamic imports for code splitting

**Build Results:**

- `admin-overview.js`: 7.05 KB
- `admin-performance.js`: 11.20 KB
- `admin-system-status.js`: 8.46 KB
- `admin-dashboard.js`: 93.03 KB (down from 95.02 KB)

**Verification:**

- TypeScript: 0 errors
- Build: Success (42 JS chunks obfuscated)

---

## Critical Error Handling Fixes - COMPLETE (December 12, 2025)

Fixed 3 issues that could crash the application:

| Issue | File | Fix |
|-------|------|-----|
| Contact service throws error | `contact-service.ts:141` | Graceful error return |
| StateManager redo() not implemented | `state.ts:553-580` | Full redo stack implementation |
| Admin export unknown type | `admin-dashboard.ts:2917` | Graceful notification |

---

## TODOs

### Features

- [ ] Add infinite scroll
- [ ] Add animated section between about and contact to balance spacing

### Code Quality

- [x] Add HTTPS enforcement in production (December 12, 2025)
- [x] Split `client-portal.ts` - reduced from 3,084 to 2,381 lines (December 12, 2025)
- [x] Lazy load code-protection-service when disabled (December 12, 2025)
- [x] Configure Redis caching (December 12, 2025)

### Feature Organization

- [ ] Make `TerminalIntakeModule` extend `BaseModule` (currently breaks pattern)
- [ ] Organize 14 flat modules into subdirectories by concern (UI, animation, utilities)
- [ ] Document cross-feature dependencies

### CSS Cleanup (Low Priority)

- [ ] Split large CSS files (admin.css 1820 lines, navigation.css 1647 lines)
- [ ] Consolidate dual CSS variable systems (legacy `variables.css` vs modern `design-system/tokens/colors.css`)
- [ ] Consolidate form styles (defined in 3 locations)

---

## Active Work

### Infinite Scroll Implementation - IN PROGRESS

**Status**: In Progress
**Date**: December 11, 2025

**Summary**: Implementing infinite scroll that loops back to the top when reaching the bottom of the page.

**Current Implementation**:

- Created `InfiniteScrollModule` in `src/modules/infinite-scroll.ts`
- Desktop only (disabled on mobile)
- Detects when user scrolls to bottom of main container
- Instant jump back to top (no overlay/fade)
- Added empty buffer section after contact for smoother transition

**Problem**: After loop, business card starts centered and scrolls up - doesn't feel seamless.

**Options to Consider**:

1. Clone ending content at top
2. Start scrolled partway down after loop
3. Add buffer section at TOP
4. Reverse scroll direction
5. Fade transition on business card only

**Current Approach**: Trying Option 2 first.

**Files Modified**:

- `src/modules/infinite-scroll.ts`
- `src/core/app.ts`
- `src/styles/base/layout.css`
- `index.html`

---

### GSAP Scroll Snap Module - IN PROGRESS

**Status**: In Progress
**Date**: December 9, 2025

**Summary**: Implementing GSAP-based scroll snapping so sections lock into place.

**Requirements**:

- Sections should snap to center when scrolling stops
- Viewport center calculation must account for header and footer heights
- Should work on all pages EXCEPT client portal
- Must use GSAP (not CSS scroll-snap)

**Implementation**:

- [x] Created `ScrollSnapModule` in `src/modules/scroll-snap.ts`
- [x] Uses GSAP ScrollTrigger and ScrollToPlugin
- [x] Added to `mainSiteModules` in app.ts for initialization
- [x] Detects window vs container scroll mode (mobile vs desktop)
- [x] Reads CSS variables for header/footer heights
- [ ] Test scroll snap on desktop
- [ ] Test scroll snap on mobile

**Files Modified**:

- `src/modules/scroll-snap.ts`
- `src/core/app.ts`

---

### Client Portal Auth Container - IN PROGRESS

**Status**: In Progress
**Date**: December 9, 2025

**Summary**: Restructured client portal login page with unified auth container design.

**Completed**:

- [x] Unified auth container for desktop/mobile
- [x] Password/Magic Link toggle buttons
- [x] Password visibility toggle with icons
- [x] Fixed button text color (black on green)
- [x] Form inputs match contact form styling
- [x] Button loader hidden by default
- [x] Auth container width increased to 480px
- [x] Made container responsive with min-height (not fixed height)
- [x] Reserved space for error messages to prevent layout shift

**Known Issues**:

| Issue | Priority | Notes |
|-------|----------|-------|
| VH calculations not accounting for footer | Medium | Client portal layout uses VH but doesn't subtract footer height properly |

---

### Mobile Intro Animation - Card Flip - IN PROGRESS

**Goal**: On mobile, the business card should show back first, then flip to front. Header should be visible immediately (no overlay).

**Implementation**:

- [x] Created `runMobileCardFlip()` method in `intro-animation.ts`
- [x] Immediately removes `intro-loading` class (header visible from page load)
- [x] Sets card to `rotateY(180)` (back showing)
- [x] After 1s pause, flips to front (`rotateY(0)`)
- [x] Created `completeMobileIntro()` for simpler cleanup
- [x] No overlay on mobile - just in-place card flip
- [x] Added CSS rule to start card showing back on mobile

**Files Modified**:

- `src/modules/intro-animation.ts`
- `src/styles/components/business-card.css`

---

### Desktop Card Alignment - KNOWN ISSUE

**Status**: Known Issue (DO NOT FIX YET)

**Concern**: Card alignment is off on desktop during intro animation.

**Notes**: Focus is on mobile fixes first. Will address desktop alignment after mobile is working.

---

### Mobile Navigation Styling - IN PROGRESS

**Concerns Raised**:

- [x] "NO BHAD CODES" logo should be same size as "MENU" text
- [x] Add padding above first link in mobile nav
- [x] Links should take up more room (taller) on mobile

**Fixes Applied**:

- Changed `.nav-logo-row` font-size from 16px to 14px (matches MENU text)
- Changed mobile `.nav-logo-row` font-size from 12px to 14px
- Added `.menu-list { padding-top: 2rem }` for first link spacing
- Increased `.menu-list-item min-height` to `clamp(4rem, 10vw, 5.5rem)`
- Increased `.menu-link` padding on mobile
- Increased `--menu-heading-size` to `clamp(2.5rem, 8vw, 4.5rem)`

**Files Modified**:

- `src/styles/components/navigation.css`

---

## System Status

**Last Updated**: December 12, 2025

### Build Status

- **TypeScript**: 0 errors
- **ESLint**: 0 errors
- **Tests**: 259 passing (all tests pass)
- **Build**: Success

### Codebase Health

| Metric | Value | Status |
|--------|-------|--------|
| Total Issues Found | 108 | ~100 fixed |
| Critical Issues | 0 | ALL FIXED |
| Hardcoded Colors | 0 remaining | ALL FIXED |
| Oversized Files | 1 remaining | client-portal.ts (2,381 - reduced 23%) |
| Backend Hardcoded Values | 0 remaining | ALL FIXED |
| CSS Variables Added | 50+ new tokens | Complete |
| Lint Warnings | 0 | ALL FIXED |
| TypeScript Errors | 0 | Clean |

### Development Server

Run `npm run dev:full` to start both frontend and backend

**Development URLs:**

- Frontend: http://localhost:4000
- Backend API: http://localhost:4001
- API Docs: http://localhost:4001/api-docs

---

## Known Issues

### Redis Caching - CONFIGURED

**Status**: FIXED (December 12, 2025)

**Solution**: Redis is now installed and running via Homebrew.

**Configuration** (in `.env`):

```text
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Commands**:

- Start: `brew services start redis`
- Stop: `brew services stop redis`
- Status: `redis-cli ping` (should return PONG)

---

### DataService Portfolio Load Error

**Status**: Known

**Issue**: Console error when loading main page - DataService trying to fetch JSON from URL that returns HTML.

**Impact**: Navigation data fails to load, portfolio data unavailable

**Next Steps**:

- [ ] Verify the portfolio JSON endpoint exists on the server
- [ ] Add proper 404 handling to return JSON error responses
- [ ] Add fallback data in DataService when fetch fails

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `src/features/client/client-portal.ts` | Main client portal module (~2,381 lines) |
| `src/features/client/terminal-intake.ts` | Terminal intake main module (~1,446 lines) |
| `src/features/admin/admin-dashboard.ts` | Admin dashboard module (~3,032 lines) |
| `server/routes/uploads.ts` | File upload API endpoints |
| `server/routes/clients.ts` | Client profile/settings API |
| `server/routes/projects.ts` | Project/request API |
| `server/routes/invoices.ts` | Invoice API + PDF generation |
| `server/routes/messages.ts` | Messaging API |

### Development Commands

```bash
# Start full development environment
npm run dev:full

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run tests
npm run test:run

# Build for production
npm run build
```

---

## Archived Work

Previous work has been completed and verified. See [ARCHIVED_WORK_2025-12.md](./ARCHIVED_WORK_2025-12.md) for details.
