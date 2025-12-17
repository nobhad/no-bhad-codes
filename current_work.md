# Current Work - December 12, 2025

---

## Assets to Add

### paw.svg

Red paw print SVG icon - needs to be added to project assets.

**Note:** Contains hardcoded color `#d11818` - should be updated to use CSS variable or `currentColor` for theme compatibility.

---

## CSS Variable System Consolidation - COMPLETE (December 12, 2025)

### Summary

Consolidated dual CSS variable systems into single source of truth.

**Changes Made:**

| Change | Details |
|--------|---------|
| Legacy aliases added | Added 140+ legacy variable aliases to `design-system/tokens/colors.css` |
| Duplicates removed | Removed duplicate color definitions from `variables.css` |
| Form styles consolidated | Merged duplicate `.form-textarea` definitions in `client-portal.css` |

**Architecture:**

- **Primary source**: `src/design-system/tokens/colors.css` - Contains all color tokens
- **Legacy support**: Legacy variable names (`--color-neutral-*`, `--fg`, `--bg`, `--color-terminal-*`, etc.) are now aliases pointing to design-system values
- **Form styles**: `src/styles/components/form.css` is the base; page-specific overrides in `client-portal.css` and `terminal-intake.css`

**Results:**

- CSS bundle size reduced from 242.97 KB to 239.71 KB (~3 KB savings)
- Zero breaking changes - all legacy variable names still work
- Single source of truth for color definitions

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
- [x] Consolidate dual CSS variable systems (December 12, 2025)
- [x] Consolidate form styles (December 12, 2025)

---

## Active Work

### GSAP MorphSVG Intro Animation - IN PROGRESS

**Status**: In Progress
**Date**: December 15, 2025
**Branch**: `feature/intro-animation-svgs`

**Summary**: Implementing a paw print morph animation for the intro sequence using GSAP MorphSVG plugin.

**SVG Assets** (saved in `public/images/`):

| File | ViewBox | Contains |
|------|---------|----------|
| `intro_paw_1.svg` | 0 0 1969.78 1562.3 | Card group + paw1 path |
| `intro_paw_2.svg` | 0 0 1969.86 1204.74 | Card group + Paw2 path |

**SVG Structure Analysis**:

- Both SVGs contain identical card content (`<g id="card">`) positioned at x≈915, y=600.24
- Card dimensions: 1050x600 (matches `business-card_front.svg`)
- Each SVG has a unique paw path (`#paw1` / `#Paw2`) for morphing
- Card text includes: "Noelle Bhaduri", "Have Brain Will Travel", contact info

**Implementation Plan**:

1. **Create Intro Overlay Container**
   - Full-screen SVG container for animation
   - Position card content to align with actual business card element
   - Use CSS to ensure perfect alignment

2. **Load GSAP MorphSVG Plugin**
   - Import MorphSVG from GSAP premium plugins
   - Register with GSAP core

3. **Morph Animation Sequence**
   - Display paw1 initially
   - Morph paw1 → paw2 (or reverse)
   - Card remains stationary during morph
   - After morph, fade out overlay to reveal actual business card

4. **Alignment Strategy**
   - Calculate business card position on screen
   - Apply transform to SVG container to match
   - Card in SVG must perfectly overlay the real card

5. **Cleanup**
   - Remove overlay after animation completes
   - Hand off to existing card flip animation

**Files to Modify**:

- `src/modules/intro-animation.ts` - Add morph animation logic
- `src/styles/components/intro-animation.css` (new) - Overlay styles
- `index.html` - Add overlay container if needed

**Dependencies**:

- GSAP MorphSVG plugin (premium - requires license/Club membership)

---

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

**Concerns**:

- [ ] **Infinite scroll needs to work on mobile** - Currently disabled, needs implementation
- [ ] **Loop-trigger-zone awkward space** - Need to figure out what content/design to fill the gap between contact section and loop trigger

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

### GSAP Scroll Snap Module - COMPLETE

**Status**: Complete
**Date**: December 12, 2025

**Summary**: GSAP-based scroll snapping - sections lock into place on desktop.

**Features**:

- Sections snap to center when scrolling stops
- Viewport center calculation accounts for header/footer heights
- Desktop only - disabled on mobile for free scrolling
- Respects reduced motion preferences

**Implementation**:

- [x] Created `ScrollSnapModule` in `src/modules/scroll-snap.ts`
- [x] Uses GSAP ScrollTrigger and ScrollToPlugin
- [x] Added to `mainSiteModules` in app.ts for initialization
- [x] Detects window vs container scroll mode
- [x] Reads CSS variables for header/footer heights
- [x] Tested on desktop - works great
- [x] Mobile disabled (free scrolling)

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

### Hero Section Animation - HOLD NEEDED

**Status**: Concern
**Date**: December 17, 2025

**Concern**: Hero section animation needs a HOLD on mobile.

**Notes**: The hero section (text animation) needs to pause/hold during the animation sequence on mobile.

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
