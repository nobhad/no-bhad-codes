# Current Work - December 21, 2025

---

## Recent Updates (December 21, 2025)

### Phase 3: Code Organization - IN PROGRESS

**Goal:** Split large files and extract duplicate logic to improve maintainability and code organization.

**Completed:**

1. **Admin Dashboard Split (Partial)**
   - ✅ Created `src/features/admin/admin-auth.ts` (197 lines) - Extracted AdminAuth class
   - ✅ Created `src/features/admin/admin-project-details.ts` (850+ lines) - Extracted project detail handling
   - ✅ Updated `admin-dashboard.ts` to use extracted classes
   - 📊 Reduced `admin-dashboard.ts` from 2,879 to 2,679 lines (~200 lines removed)
   - ⏳ Still need to remove duplicate project detail methods (delegate to handler)

2. **Duplicate Hero Logic Extraction - COMPLETE**
   - ✅ Created `src/modules/animation/base-hero-animation.ts` (299 lines) - Shared base class
   - ✅ Refactored `page-hero.ts`: 470 → 338 lines (saved 132 lines)
   - ✅ Refactored `about-hero.ts`: 427 → 301 lines (saved 126 lines)
   - ✅ Extracted ~400 lines of duplicate code into shared base class
   - ✅ Shared methods: `createTimelines()`, `handleWheelAnimation()`, `revealHeroContent()`, `resetHeroAnimation()`
   - ✅ Improved maintainability - animation logic changes in one place

**Benefits:**
- Eliminated code duplication
- Single source of truth for hero animations
- Easier maintenance and testing
- Consistent behavior across modules

**Files Created:**
- `src/features/admin/admin-auth.ts`
- `src/features/admin/admin-project-details.ts`
- `src/modules/animation/base-hero-animation.ts`

**Files Modified:**
- `src/features/admin/admin-dashboard.ts`
- `src/modules/animation/page-hero.ts`
- `src/modules/animation/about-hero.ts`

**Remaining Work:**
- [ ] Complete admin-dashboard.ts split (remove duplicate methods)
- [ ] Split `intro-animation.ts` (1,569 lines → 3 files)
- [ ] Split `client-portal.ts` (2,376 lines → multiple files)
- [ ] Split `terminal-intake.ts` (1,617 lines → multiple files)
- [ ] Split `contact-animation.ts` (880 lines → multiple files)
- [ ] Split `visitor-tracking.ts` (836 lines → multiple files)

---

## Recent Updates (December 21, 2025)

### SVG Proportion Fix & Pixel-Perfect Alignment - COMPLETE

Fixed SVG warping issue in coyote paw animation and implemented pixel-perfect alignment with business card.

**Issue Fixed:**
- SVG proportions were getting warped due to `preserveAspectRatio: 'none'`
- Card alignment was not pixel-perfect with actual business card element

**Solution:**
1. **Aspect Ratio Preservation:**
   - Changed `preserveAspectRatio` from `'none'` to `'xMidYMid meet'` in all animation files
   - Prevents non-uniform stretching regardless of viewport aspect ratio
   - Maintains original SVG proportions (2331.1 x 1798.6)

2. **Pixel-Perfect Alignment:**
   - Rewrote `calculateSvgAlignment()` to account for `preserveAspectRatio` behavior
   - Calculates actual SVG display area (accounting for letterboxing/pillarboxing)
   - Maps SVG coordinates to screen pixels accurately
   - Calculates transforms in SVG coordinate space for precise alignment
   - Uses original SVG viewBox instead of viewport dimensions

3. **Unified Alignment Function:**
   - All animation modules now use shared `SvgBuilder.calculateSvgAlignment()`
   - Consistent pixel-perfect alignment across desktop and mobile
   - Centralized calculation logic for maintainability

**Technical Details:**
- SVG viewBox: `0 0 2331.1 1798.6` (matches original SVG file)
- Accounts for preserveAspectRatio 'meet' behavior which scales SVG to fit viewport
- Transform calculation: `translate(tx, ty) scale(s)` applied in SVG coordinate space
- Calculates viewBox-to-pixel scale factor based on actual display area

**Files Modified:**
- `src/modules/animation/intro/svg-builder.ts` - Rewrote `calculateSvgAlignment()` for pixel-perfect alignment
- `src/modules/animation/intro-animation.ts` - Updated to use shared alignment function (2 places)
- `src/modules/animation/intro-animation-mobile.ts` - Updated to use shared alignment function
- `src/config/intro-animation-config.ts` - Fixed `SVG_VIEWBOX` to match actual SVG (2331.1 x 1798.6)

**Result:**
- ✅ SVG maintains correct proportions (no warping)
- ✅ Business card aligns pixel-perfectly with SVG card
- ✅ Works correctly across all viewport sizes and aspect ratios
- ✅ Consistent behavior on desktop and mobile

---

### Phase 4: Performance Optimization - COMPLETE

Comprehensive performance optimizations for animation modules:

**Memory Leak Fixes:**
- Fixed event listener cleanup in all animation modules
- Ensured proper removal of event listeners in `destroy()` methods
- Fixed event listener removal using bound function references
- All GSAP timelines are now properly killed to prevent memory leaks

**Throttling/Debouncing:**
- Added debounced resize handlers (100ms) in:
  - `PageTransitionModule`
  - `SectionTransitionsModule`
- Added throttled mousemove handler (10ms) in `ContactAnimationModule` for card tilt effect
- All scroll/resize handlers now use performance-optimized utilities

**SVG Assembly Optimization:**
- Implemented caching for parsed SVG documents
- Cache extracted SVG element references to avoid repeated DOM queries
- Cache path data (d attributes) to prevent repeated attribute reads
- Added `clearSvgCaches()` utility function for memory management
- Shared cache across intro, exit, and entry animations

**Path Data Parsing Caching:**
- Path data extraction now uses cache keys based on SVG path
- Prevents repeated DOM attribute reads during animation setup
- Significant performance improvement for repeated animations

**Performance Improvements:**
- Reduced DOM queries through element caching
- Reduced parsing overhead with document caching
- Better event handler performance with throttling/debouncing
- Memory leak prevention through proper cleanup

**Files Modified:**
- `src/modules/animation/intro/svg-builder.ts` - Added comprehensive caching system
- `src/modules/animation/intro-animation.ts` - Updated to use cached SVG data
- `src/modules/animation/page-transition.ts` - Added debounced resize handler
- `src/modules/animation/section-transitions.ts` - Added debounced resize handler
- `src/modules/animation/contact-animation.ts` - Added throttled mousemove handler

**Commit:** `a483506` - perf: phase 4 performance optimization

---

### Animation Optimization - COMPLETE

Comprehensive optimization of GSAP animations and page transitions:

**CSS-GSAP Conflict Resolution:**

- Removed CSS `transition` properties that conflicted with GSAP animations:
  - `.business-card-inner` - was conflicting with rotationY flip
  - `.intro-card-flipper` - removed transition
  - `.intro-card-element` - removed transition

**Legacy CSS Keyframes Removed:**

- Removed unused keyframes from `contact.css`:
  - `drop-in`, `drop-out`, `blur-in`, `blur-out`
  - `submit-button-slide-in`, `submit-button-slide-out`
- All animations now handled exclusively by GSAP

**Unified Page Hero Animation (NEW):**

- Created `src/modules/animation/page-hero.ts` - unified module for About and Contact pages
- Same wheel-driven animation for both pages (consistent UX)
- Animation: Left/Right groups skew and scale while text slides in
- Dispatches `revealed` event when animation completes
- Replaces `about-hero.ts` with unified solution

**Contact Page Hero Integration:**

- Added hero SVG to contact page HTML
- Added `.contact-hero-desktop` and `.contact-content` wrapper
- Contact form animation waits for hero reveal event before playing
- CSS ensures content starts hidden until hero animation completes

**Files Modified:**

- `src/styles/components/business-card.css` - removed CSS transitions
- `src/styles/pages/contact.css` - added hero styles, removed legacy keyframes
- `src/modules/animation/page-hero.ts` - NEW unified hero module
- `src/modules/animation/contact-animation.ts` - waits for hero reveal
- `src/core/modules-config.ts` - replaced AboutHeroModule with PageHeroModule
- `index.html` - added hero SVG and content wrapper to contact section

---

## Known Issues

### Header White Flash in Dark Mode

**Status:** Under Investigation
**Priority:** Medium

**Issue:** When clicking the home button to navigate back to the intro page in dark mode, the header area briefly flashes white.

**Attempted Fixes:**

- Added `.paw-exit .header` CSS rule with `opacity: 1`, `visibility: visible`, `transition: none` - did not resolve
- Adding `background-color: var(--color-neutral-300)` to `html` element - testing needed

**Root Cause (Suspected):**

- Browser default white background showing during page transition
- The `html` element doesn't have a background color set, so the white default shows briefly
- The paw entry animation triggers class changes that may cause a brief repaint

**Files to Investigate:**

- `src/modules/animation/intro-animation.ts` - playEntryAnimation()
- `src/modules/animation/page-transition.ts` - transitionTo()
- `src/styles/main.css` - html/body background colors

---

## Previous Updates (December 20, 2025)

### Documentation Overhaul - COMPLETE

- ✅ Updated all design documentation dates to December 20, 2025
- ✅ Documented crimson (#dc2626) as light mode primary brand color
- ✅ Documented matrix green (#00ff41) as dark mode primary brand color
- ✅ Marked INFINITE_SCROLL.md as deprecated (module disabled in favor of virtual page transitions)
- ✅ Updated CSS_ARCHITECTURE.md with current color system
- ✅ Updated UX_GUIDELINES.md with theme-aware color usage
- ✅ Updated ANIMATIONS.md date

### Color System Update

**Current Brand Colors:**

- **Light Mode**: Crimson red (#dc2626) for primary actions and interactive elements
- **Dark Mode**: Matrix green (#00ff41) for primary actions and interactive elements
- Theme-aware color tokens properly configured in `src/design-system/tokens/colors.css`

---

## Completed Work

### ✅ Infinite Scroll Removal

- InfiniteScrollModule disabled in modules-config.ts (line 169)
- Replaced with virtual page transitions (PageTransitionModule)
- Uses standard page scrolling with blur-in transitions
- Documentation marked as deprecated

---

## TODOs

### Features

- [ ] Add animated section between about and contact to balance spacing

### Code Quality (In Progress - Phase 3)

- [x] Extract duplicate hero logic from `page-hero.ts` and `about-hero.ts` (~400 lines)
- [x] Split `admin-dashboard.ts` (2,879 lines) - Partially complete (auth & project details extracted)
- [ ] Complete `admin-dashboard.ts` split (remove duplicate methods, create UI handlers file)
- [ ] Split `intro-animation.ts` (1,569 lines → 3 files)
- [ ] Split `client-portal.ts` (2,376 lines → multiple files)
- [ ] Split `terminal-intake.ts` (1,617 lines → multiple files)
- [ ] Split `contact-animation.ts` (880 lines → multiple files)
- [ ] Split `visitor-tracking.ts` (836 lines → multiple files)

---

## System Status

**Last Updated**: December 21, 2025 (Phase 3 Code Organization - Hero logic extraction completed)

### Build Status

- **TypeScript**: 0 errors
- **ESLint**: 0 errors
- **Tests**: 195 passing (all tests pass)
- **Build**: Success

### Codebase Health

| Metric | Value | Status |
|--------|-------|--------|
| Critical Issues | 0 | All resolved |
| Files Needing Attention | 3 | Large files / code quality |
| CSS Token Usage | Consistent | Legacy --fg/--bg migrated |
| Server Code | Excellent | Production-ready |
| Lint Warnings | 0 | Clean |
| TypeScript Errors | 0 | Clean |

### Development Server

Run `npm run dev:full` to start both frontend and backend

**Development URLs:**

- Frontend: http://localhost:4000
- Backend API: http://localhost:4001
- API Docs: http://localhost:4001/api-docs

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `src/features/client/client-portal.ts` | Main client portal module (~2,376 lines) |
| `src/features/client/terminal-intake.ts` | Terminal intake main module (~1,617 lines) |
| `src/features/admin/admin-dashboard.ts` | Admin dashboard module (~2,679 lines, being split) |
| `src/features/admin/admin-auth.ts` | Admin authentication (197 lines, extracted) |
| `src/features/admin/admin-project-details.ts` | Project detail handling (850+ lines, extracted) |
| `src/modules/animation/base-hero-animation.ts` | Shared hero animation base class (299 lines, new) |
| `src/modules/animation/intro-animation.ts` | Intro animation module (~1,569 lines) |
| `src/services/visitor-tracking.ts` | Client-side visitor tracking (~836 lines) |
| `server/routes/analytics.ts` | Analytics API endpoints (~655 lines) |

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
