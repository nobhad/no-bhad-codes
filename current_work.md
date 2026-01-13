# Current Work - December 27, 2025

---

## Recent Updates (December 27, 2025)

### Coyote Paw Animation Page Restriction - COMPLETE

Fixed issue where coyote paw animation would sometimes play when refreshing non-intro pages (about, contact, projects).

**Issue:** The mobile intro animation module (`intro-animation-mobile.ts`) was missing the page check that exists in the desktop version. When refreshing a page like `/about` or `/contact`, the module would incorrectly trigger the paw animation.

**Fix:** Added the same page check to `MobileIntroAnimationModule.init()` that already exists in `IntroAnimationModule.init()`:

```typescript
const hash = window.location.hash;
const isIntroPage = !hash || hash === '#' || hash === '#/' || hash === '#/intro' || hash === '#/home';
if (!isIntroPage) {
  this.log(`Not on intro page (hash: ${hash}) - skipping coyote paw animation`);
  this.skipIntroImmediately();
  return;
}
```

**Files Modified:**

- `src/modules/animation/intro-animation-mobile.ts` - Added page check in init()

---

## Previous Updates (December 23, 2025)

### Animation Smoothness Deep Dive - COMPLETE

Comprehensive optimization of GSAP animations for smoother, more seamless performance.

**Optimizations Completed:**

1. **SVG Morph Animations - Linear Easing**
   - Changed SVG morphing from `power2.inOut`/`power1.out` to `linear` easing
   - Linear easing provides smoother vertex interpolation for SVG paths
   - Updated all morph animations in:
     - `intro/morph-timeline.ts` (Phase 2 + Phase 3b morphs)
     - `intro-animation.ts` (exit and entry animations)
     - `intro-animation-mobile.ts` (Phase 2 + Phase 3 morphs)

2. **GPU Acceleration with force3D**
   - Added `force3D: true` to all SVG morphing animations
   - Enables hardware-accelerated 3D transforms for smoother rendering
   - Applied to all finger and thumb morphs across all animation modules

3. **Blur Animation Optimization**
   - Reduced `BLUR_AMOUNT` from 20px to 10px in `page-transition.ts` for better GPU performance
   - Reduced blur from 8px to 6px in `contact-animation.ts`
   - Changed blur easing from `power2.in` to `sine.in` for smoother blur effect

4. **will-change GPU Hints**
   - Added `willChange: 'filter, opacity, transform'` before blur animations
   - Cleaned up will-change to 'auto' after animations complete
   - Applied to: `page-transition.ts`, `contact-animation.ts`, `section-transitions.ts`

5. **Layout Thrashing Fix**
   - Batched DOM reads before DOM writes in `contact-animation.ts`
   - Organized code into: DOM queries → Layout reads → Calculations → DOM writes
   - Prevents forced reflow/repaint during animation setup

6. **ScrollTrigger Refresh**
   - Added `ScrollTrigger.refresh()` after page transitions complete in `page-transition.ts`
   - Uses `requestAnimationFrame` to ensure DOM has updated before refresh
   - Fixes scroll-based animations recalculating positions after content changes

7. **Mobile Animation Timing**
   - Mobile blur uses 50% of desktop blur amount (5px instead of 10px)
   - Mobile animations use shorter durations (0.4s vs 0.7s for blur clear)
   - Reduced stagger delays on mobile for faster perceived performance

8. **New Animation Constant**
   - Added `SVG_MORPH: 'none'` to `animation-constants.ts` for linear SVG easing
   - Centralized easing constant for consistent SVG morphing behavior

**Files Modified:**

- `src/config/animation-constants.ts` - Added SVG_MORPH easing constant
- `src/modules/animation/intro/morph-timeline.ts` - Linear easing + force3D
- `src/modules/animation/intro-animation.ts` - Linear easing + force3D for exit/entry
- `src/modules/animation/intro-animation-mobile.ts` - Linear easing + force3D
- `src/modules/animation/page-transition.ts` - Reduced blur, will-change, ScrollTrigger refresh
- `src/modules/animation/contact-animation.ts` - Reduced blur, will-change, layout thrashing fix
- `src/modules/animation/section-transitions.ts` - will-change for blur animations

**Result:**

- Smoother SVG morphing with linear vertex interpolation
- Better GPU utilization with force3D and will-change hints
- Reduced layout thrashing for faster animation setup
- Lighter blur for better mobile performance
- ScrollTrigger properly refreshes after page transitions

---

### Deprecated Code Cleanup - COMPLETE

Removed deprecated infinite scroll module and related code.

**Deleted Files:**

- `src/modules/animation/infinite-scroll.ts` - Deprecated module removed
- `docs/features/INFINITE_SCROLL.md` - Documentation removed

**Cleaned Up:**

- Removed infinite scroll comments from `modules-config.ts`
- Removed loop-trigger-zone checks from `scroll-snap.ts`
- Removed loop-spacer/trigger-zone CSS from `mobile/layout.css`
- Updated `MODULE_DEPENDENCIES.md` with current module list
- Updated `docs/README.md` to remove INFINITE_SCROLL link

---

### Comprehensive Documentation Update - COMPLETE

Deep dive codebase analysis and documentation update across all /docs/ files.

**Completed:**

- Updated CSS_ARCHITECTURE.md with current file structure and resolved issues
- Updated ARCHITECTURE.md with current codebase health (December 23, 2025)
- Updated docs/README.md with current navigation and animation modules
- Updated SYSTEM_SUMMARY.md with Animation System section
- Updated ANIMATIONS.md, UX_GUIDELINES.md, INTRO_ANIMATION.md dates

**Codebase Summary (from analysis):**

- **Frontend**: 2.7MB, 40,000+ lines TypeScript
- **Backend**: 752KB, 10 route files, 11 middleware files
- **CSS Files**: 25 files (~4,200 lines)
- **Design System**: 11 files (~2,300 lines)
- **npm Dependencies**: 58 total (38 dev, 20 production)

---

## Recent Updates (December 22, 2025)

### Contact Form Layout Fix - COMPLETE

Fixed contact form field widths for flex containers and resolved centering/clipping issues.

**Completed:**

1. **Form Field Fixed Widths**
   - Added CSS variables: `--contact-input-width: 460px`, `--contact-textarea-width: 640px`
   - Set explicit widths on `.input-item` elements (460px for inputs, 640px for message)
   - Changed `.contact-row` and `.contact-left` from CSS Grid to Flexbox
   - Added `flex-shrink: 0` to prevent fields from shrinking

2. **Centering Fixes**
   - Changed `.contact-section` overflow from `hidden` to `visible`
   - Changed `.contact-content` width from `100%` to `auto` (sizes to content)
   - Changed `.contact-layout` grid columns from `1fr 1fr` to `auto auto`
   - Set `.contact-form-column` width to match widest element (640px)

3. **Clipping Fixes**
   - Merged duplicate `.input-wrapper` rules (removed conflicting `overflow: hidden`)
   - Set `.input-wrapper` and `.input-item` to `overflow: visible`
   - Removed legacy CSS animations from `.input-item` (GSAP handles all animations)

4. **Animation Constants Sync**
   - Added `FORM_MESSAGE_WIDTH_FULL: 640` constant to match CSS variable
   - Updated `contact-animation.ts` to use constant instead of hardcoded value

**Files Modified:**

- `src/styles/pages/contact.css` - Fixed widths, flexbox layout, centering, overflow
- `src/config/animation-constants.ts` - Added message width constant
- `src/modules/animation/contact-animation.ts` - Use constant for message width

**Result:**

- Form fields have explicit fixed widths for flex containers
- Contact section properly centered in viewport
- No clipping of form fields or focus outlines
- Animation values synced with CSS variables

---

### GSAP Animation Cleanup and Contact Blur Fix - COMPLETE

Cleaned up page transition code, removed excessive console.logs, fixed intro nav link animations to use GSAP, and fixed contact section blur animation on entry.

**Completed:**

1. **Page Transition Cleanup**
   - Removed 70+ console.log statements from page-transition.ts
   - Extracted helper methods: `hideIntroPageImmediately()`, `prepareTargetPage()`, `showIntroPageFallback()`
   - Simplified `transitionTo()` from ~200 lines to ~75 lines
   - Consolidated `initializePageStates()` and `listenForIntroComplete()`
   - Simplified `animateIn()` and `animateOut()` methods

2. **Intro Animation Cleanup**
   - Removed 30+ console.log statements from intro-animation.ts
   - Added `getSvgText()` helper for cached SVG fetching
   - Added `showIntroFallback()` helper for fallback display
   - Simplified `playExitAnimation()` and `playEntryAnimation()` methods

3. **Contact Animation Blur Fix**
   - Fixed contact section blur animation on entry
   - h2, contactOptions, and cardColumn now blur in first (fade while blurred, then clear blur)
   - Changed from drop animation to blur animation for these elements
   - Form field cascade animation starts AFTER blur phase completes
   - Updated `resetAnimatedElements()` to use blur state instead of y-transform

4. **CSS Fixes for GSAP Blur Animation**
   - Removed `opacity: 1` from `.page-active` CSS rules in page-transitions.css
   - CSS was overriding GSAP's initial `opacity: 0` state for blur animations
   - GSAP now has full control over opacity during blur transitions

5. **Intro Nav Links Animation Fix**
   - Removed CSS `drop-in` animation from `.intro-nav-link` (was using CSS keyframes)
   - Changed to GSAP fade-in animation (opacity 0 -> 1, duration 0.8s)
   - Updated `completeIntro()` to fade in nav with GSAP
   - Updated `skipIntroImmediately()` to set nav visible with GSAP
   - Entry animation already uses GSAP fade for nav links

**Files Modified:**

- `src/modules/animation/page-transition.ts` - Cleaned up, extracted helpers, removed console.logs
- `src/modules/animation/intro-animation.ts` - Cleaned up, added helpers, fixed nav fade
- `src/modules/animation/contact-animation.ts` - Changed h2/card to blur animation, updated reset method
- `src/styles/components/business-card.css` - Removed CSS animation, GSAP handles nav links
- `src/styles/components/page-transitions.css` - Removed opacity:1 from page-active rules (GSAP controls opacity)

**Result:**

- Cleaner, more maintainable animation code
- Contact section h2 and card blur in first, then form animation starts
- Intro nav links fade in slowly via GSAP (not drop animation)
- Coyote paw animation plays on initial load and when returning to home page
- All pages (about/contact/projects) use same blur/fade transitions

---

### Coyote Paw Animation Scope and Entry Animation Fix - COMPLETE

Fixed coyote paw intro/exit animations to only play on home page and fixed entry animation not playing when navigating to home.

**Completed:**

1. **Scoped Coyote Paw Animations to Home Page Only**
   - ✅ Added explicit documentation that animations are ONLY for home page / business card section
   - ✅ Removed unnecessary element checks that were preventing animations
   - ✅ Simplified logic: if `pageId === 'intro'`, play coyote paw animation
   - ✅ Added clear comments in page-transition.ts, intro-animation.ts, and intro-animation-mobile.ts

2. **Fixed Entry Animation Not Playing**
   - ✅ Fixed entry animation to ensure overlay is accessible (removes `hidden` class)
   - ✅ Creates SVG element if it doesn't exist during entry animation
   - ✅ Added better console logging for debugging entry animation issues
   - ✅ Ensures overlay is visible before attempting animation

3. **Fixed Overlay Z-Index**
   - ✅ Changed overlay z-index from 9999 to 50
   - ✅ Overlay now appears above main content but below navigation (nav is 100)
   - ✅ Matches design system z-index tokens

**Files Modified:**
- `src/modules/animation/page-transition.ts` - Simplified entry/exit logic, added logging, removed unnecessary checks
- `src/modules/animation/intro-animation.ts` - Fixed entry animation to ensure overlay accessible, create SVG if missing
- `src/modules/animation/intro-animation-mobile.ts` - Added documentation about scope
- `src/styles/components/intro-morph.css` - Changed z-index from 9999 to 50

**Commits:**
- `1d2968f` - refactor: scope coyote paw animations to home page only
- `774afe2` - fix: ensure coyote paw entry animation works and fix overlay z-index

**Result:**
- ✅ Coyote paw animations only play on home page / business card section
- ✅ Entry animation works when navigating to home page
- ✅ Overlay positioned correctly (above content, below nav)
- ✅ Better debugging with console logs
- ✅ Clear documentation about animation scope

---

## Recent Updates (December 22, 2025)

### Font Loading and Section Visibility Fixes - COMPLETE

Fixed Acme font not displaying and resolved about/contact sections not being visible.

**Completed:**

1. **Font Loading Root Cause Fix**
   - ✅ Created `src/styles/base/fonts.css` with all `@font-face` definitions
   - ✅ Imported `fonts.css` FIRST in `main.css` (before design system tokens)
   - ✅ Removed `@font-face` from `typography.css` (moved to `fonts.css`)
   - ✅ Changed `font-display` from `optional` to `swap` for both fonts
   - ✅ **Root cause**: `@font-face` was defined AFTER design tokens that referenced "Acme"
   - ✅ Browser couldn't find font when tokens were parsed, causing fallback to system font

2. **Section Visibility Fixes**
   - ✅ Fixed CSS specificity conflicts between base `section` rule and `.page-active` rules
   - ✅ Removed inline `display` settings from GSAP (let CSS handle via `.page-active` class)
   - ✅ Added `min-height: 100%` to virtual pages rules to override base `min-height: 0`
   - ✅ Ensured contact/about sections use `display: grid` via CSS (not inline styles)
   - ✅ **Root cause**: GSAP's `clearProps: 'all'` was clearing inline styles, and CSS rules weren't specific enough

3. **CSS Architecture Improvements**
   - ✅ Removed all `!important` flags from `.page-active` rules
   - ✅ Used CSS specificity properly (`.contact-section.page-active` beats base `section` rule)
   - ✅ CSS rules now persist even when GSAP clears inline styles
   - ✅ Proper cascade: base `section` → `.page-active` → `.contact-section.page-active`

**Files Created:**
- `src/styles/base/fonts.css` - All `@font-face` definitions (imported first)

**Files Modified:**
- `src/styles/main.css` - Import `fonts.css` before design system tokens
- `src/styles/base/typography.css` - Removed `@font-face` definitions (moved to `fonts.css`)
- `src/styles/base/layout.css` - Added override rules for contact/about sections when active
- `src/styles/components/page-transitions.css` - Fixed specificity, added `min-height: 100%`, removed `!important`
- `src/modules/animation/page-transition.ts` - Removed inline `display` settings (let CSS handle it)

**Result:**
- ✅ Acme font displays correctly (registered before design tokens reference it)
- ✅ About and contact sections visible when navigated to
- ✅ CSS rules persist even when GSAP clears inline styles
- ✅ No `!important` flags - proper CSS cascade used
- ✅ Root causes fixed instead of workarounds

---

## Recent Updates (December 22, 2025)

### Animation Header Visibility and CSS Refactoring - COMPLETE

Refactored intro animations to keep header visible and removed all `!important` declarations by fixing root causes.

**Completed:**

1. **Header Visibility During Animations**
   - ✅ Updated `animateHeaderIn` methods in both intro-animation.ts and intro-animation-mobile.ts
   - ✅ Removed logic that hid header children with opacity: 0
   - ✅ Header now stays visible throughout all animations
   - ✅ Method now only removes inline styles that might hide header

2. **Overlay Positioning**
   - ✅ Updated intro-morph-overlay to cover main area only (not full viewport)
   - ✅ Positioned below header: `top: var(--header-height)`
   - ✅ Positioned above footer: `height: calc(100vh - var(--header-height) - var(--footer-height))`
   - ✅ Header and footer remain visible during animations

3. **Removed All !important Declarations**
   - ✅ Removed `!important` from layout.css header visibility rules
   - ✅ Removed `!important` from footer.css positioning and visibility rules
   - ✅ Fixed root causes by setting proper base styles
   - ✅ Used specific selectors (`.intro-loading .header`, etc.) instead of forcing with `!important`

4. **CSS Architecture Improvements**
   - ✅ Added base visibility to `.header`: `opacity: 1; visibility: visible;`
   - ✅ Added base visibility to `.footer`: `opacity: 1; visibility: visible;`
   - ✅ Used CSS cascade properly with specific selectors for intro states
   - ✅ JavaScript no longer sets conflicting inline styles

**Files Modified:**
- `src/modules/animation/intro-animation.ts` - Removed header hiding logic from animateHeaderIn
- `src/modules/animation/intro-animation-mobile.ts` - Removed header hiding logic from animateHeaderIn
- `src/styles/base/layout.css` - Removed !important, added base styles, used specific selectors
- `src/styles/components/footer.css` - Removed !important, added base styles and intro state selectors
- `src/styles/components/intro-morph.css` - Updated overlay positioning to main area only

**Commit:**
- `8d1e3b8` - refactor: keep header visible and remove !important

**Result:**
- ✅ Header stays visible during all intro animations
- ✅ Overlay covers only main content area (header/footer visible)
- ✅ No `!important` declarations - proper CSS cascade used
- ✅ Cleaner, more maintainable CSS architecture
- ✅ Root causes fixed instead of forcing styles

---

## Recent Updates (December 22, 2025)

### Projects Page SVG Enhancements and UI Polish - COMPLETE

Enhanced projects page SVG styling, fixed mobile alignment, and improved visual consistency across the site.

**Completed:**

1. **Projects Page SVG Improvements**
   - ✅ Made SVG larger and centered using viewport width units (90vw desktop, 98vw/100vw mobile)
   - ✅ Fixed left alignment issue on mobile with proper container breakout using calc()
   - ✅ Inlined SVG in HTML to support CSS variables for dynamic theming
   - ✅ Changed "404!" text color to use primary brand color variable (crimson red/lime green by theme)

2. **Font Loading Fix**
   - ✅ Added @font-face definition for KCAcmeHandInked font in typography.css
   - ✅ Font now loads properly for SVG text rendering
   - ✅ Points to `/fonts/KCAcmeHand/KCSimpleSans-Inked.otf`

3. **Mobile Paw Animation Shadows**
   - ✅ Applied same shadow filters from desktop to mobile paw animation
   - ✅ Uses `SvgBuilder.createShadowFilter()` for consistency
   - ✅ Shadows applied to behindCardGroup, aboveCardGroup, and card elements

4. **Navigation UI Polish**
   - ✅ Removed text-shadow drop shadows from navigation eyebrows
   - ✅ Removed text-shadow from submenu eyebrows
   - ✅ Cleaner, flatter appearance for eyebrow numbers

**Files Modified:**
- `index.html` - Inlined SVG with CSS variable support, changed color to primary brand color
- `src/styles/pages/projects.css` - Enhanced SVG sizing and mobile alignment
- `src/styles/base/typography.css` - Added KCAcmeHandInked @font-face definition
- `src/modules/animation/intro-animation-mobile.ts` - Added shadow filters to match desktop
- `src/styles/components/nav-base.css` - Removed eyebrow text-shadow
- `src/styles/components/nav-responsive.css` - Removed submenu eyebrow text-shadow

**Commits:**
- `4495d8c` - feat(projects): enhance SVG sizing and mobile paw animation shadows
- `8c18def` - fix(ui): update SVG colors and remove eyebrow shadows

**Result:**
- ✅ Projects page SVG is larger, centered, and responsive
- ✅ SVG colors adapt to theme (crimson red in light mode, lime green in dark mode)
- ✅ Custom font loads correctly for SVG text
- ✅ Mobile paw animation matches desktop visual quality with shadows
- ✅ Cleaner navigation appearance without eyebrow shadows

---

## Recent Updates (December 22, 2025)

### Login Form Fixes and Accessibility Improvements - COMPLETE

Fixed login form validation, error handling, and added proper form field attributes for accessibility.

**Completed:**

1. **Form Field Accessibility**
   - ✅ Added `id` and `name` attributes to all portal login form fields
   - ✅ Email field: `id="portal-email" name="email"`
   - ✅ Password field: `id="portal-password" name="password"`
   - ✅ Forgot password email: `id="portal-forgot-email" name="email"`
   - ✅ Magic link email: `id="portal-magic-email" name="email"`
   - ✅ Resolves accessibility warnings and improves browser autofill support

2. **Error Handling Improvements**
   - ✅ Added null checks for all form element queries before accessing `.value`
   - ✅ Improved error messages for different HTTP status codes (401, 429, etc.)
   - ✅ Better distinction between network errors and HTTP errors
   - ✅ Prevents "Cannot read properties of null" errors

3. **Login Response Parsing Fix**
   - ✅ Fixed response data structure parsing (`responseData.data?.user` vs `responseData.user`)
   - ✅ Added fallback to handle both response formats for compatibility
   - ✅ Validates user object exists before storing in sessionStorage

4. **Demo User Setup**
   - ✅ Created `server/scripts/create-demo-user.ts` script for easy demo account setup
   - ✅ Demo credentials: `demo@example.com` / `nobhadDemo123`
   - ✅ Script creates user with active status and sample project

**Files Modified:**
- `index.html` - Added id/name attributes, improved error handling, fixed response parsing
- `server/scripts/create-demo-user.ts` - NEW script for creating demo user account

**Commit:**
- `2899956` - fix: login form validation and error handling

**Result:**
- ✅ Login form fully functional with proper error handling
- ✅ All form fields accessible for autofill and screen readers
- ✅ Better user experience with clear error messages
- ✅ Easy demo account setup for testing

---

## Recent Updates (December 21, 2025)

### Virtual Pages on Mobile & Projects/Portfolio Pages - COMPLETE

Enabled virtual pages on mobile devices and created projects/portfolio pages with WIP sign.

**Completed:**

1. **Virtual Pages on Mobile**
   - ✅ Enabled PageTransitionModule on mobile devices (`enableOnMobile: true`)
   - ✅ Updated RouterService to use virtual pages on all devices (removed desktop-only check)
   - ✅ Changed mobile layout from scroll-based to virtual pages (position: absolute)
   - ✅ Mobile now matches desktop behavior with blur-in/blur-out page transitions

2. **Projects and Portfolio Pages**
   - ✅ Created projects section with WIP sign (wile_404_sign.svg)
   - ✅ Created portfolio section with same WIP sign
   - ✅ Added routes for #/projects and #/portfolio
   - ✅ Registered pages in PageTransitionModule
   - ✅ Layout: heading centered on top, large SVG below (1600px max-width)

3. **Navigation Updates**
   - ✅ Updated hamburger menu order: home (00), about (01), contact (02), projects (03)
   - ✅ Removed portfolio from navigation (keeping only projects)
   - ✅ Business card navigation: ABOUT, CONTACT

4. **Visual Adjustments**
   - ✅ Increased hero text size from 120px to 180px for better visibility
   - ✅ Projects/portfolio heading: clamp(2.5rem, 8vw, 5rem) - smaller than before
   - ✅ WIP sign SVG: max-width 1600px - much larger than before
   - ✅ Vertical column layout (heading above, SVG below)

**Technical Details:**

- Mobile layout uses same virtual pages system as desktop
- PageTransitionModule handles blur-in/blur-out transitions
- RouterService dispatches navigate events for PageTransitionModule
- Mobile sections positioned absolutely with overflow-y: auto for scrolling within pages
- Dynamic viewport height (dvh) for mobile Safari compatibility

**Files Created:**

- `public/images/wile_404_sign.svg` - WIP/404 sign graphic
- `public/images/wile_404_sign.png` - PNG version

**Files Modified:**

- `index.html` - Added projects and portfolio sections, updated navigation order
- `src/core/modules-config.ts` - Enabled PageTransitionModule on mobile
- `src/modules/animation/page-transition.ts` - Added projects/portfolio pages, removed unused imports
- `src/services/router-service.ts` - Updated to use virtual pages on all devices
- `src/styles/base/layout.css` - Increased hero text size to 180px
- `src/styles/base/reset.css` - Added dvh fallback for mobile Safari
- `src/styles/mobile/layout.css` - Changed from scroll to virtual pages (overflow: hidden)
- `src/styles/pages/projects.css` - Created projects/portfolio sections with column layout
- `src/features/admin/admin-project-details.ts` - Fixed unused import and TypeScript error

**Commits:**

- `e80410c` - feat: enable virtual pages on mobile and add projects/portfolio pages
- `541c52b` - fix: align projects/portfolio headings left on mobile
- `06876b4` - docs: update current_work.md with virtual pages on mobile section
- `f041bc5` - refactor: remove deprecated tech-stack section and section ordering

---

### Mobile Layout Cleanup - COMPLETE

Removed deprecated mobile-specific sections and styles after implementing virtual pages.

**Completed:**

1. **Tech Stack Consolidation**
   - ✅ Removed separate tech-stack-section (mobile-only duplicate)
   - ✅ Tech stack now only appears within about section on all devices
   - ✅ Simplified HTML structure - eliminated redundant content

2. **Deprecated CSS Removal**
   - ✅ Removed section ordering CSS (order: 1, 2, 3, 5)
   - ✅ Section ordering not needed with virtual pages (position: absolute)
   - ✅ Cleaned up mobile-specific overrides

3. **Hero Section on Mobile**
   - ✅ Hidden hero-section on mobile (display: none)
   - ✅ Removed complex hero positioning CSS for mobile
   - ✅ Simplified mobile layout without scroll-driven hero animation

4. **Heading Alignment**
   - ✅ Projects/portfolio headings aligned left on all devices (mobile and desktop)
   - ✅ Consistent alignment across breakpoints

**Files Modified:**

- `index.html` - Removed tech-stack-section duplicate
- `src/modules/animation/page-transition.ts` - Updated comment (removed tech-stack reference)
- `src/styles/mobile/layout.css` - Removed section ordering, simplified hero styles
- `src/styles/pages/projects.css` - Fixed heading alignment on mobile
- `src/features/admin/admin-dashboard.ts` - Added currentProjectId getter/setter for compatibility

**Result:**

- ✅ Cleaner HTML structure without duplicate content
- ✅ Simplified mobile CSS without deprecated positioning
- ✅ Consistent UX across desktop and mobile with virtual pages
- ✅ Eliminated confusion around separate mobile-only sections

---

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

## TODOs (Prioritized)

### Phase 1: Core Admin Functionality (High Priority)

1. [x] Leads need to be responded to and USER needs to turn into projects (added /api/admin/leads/:id/activate endpoint)
2. [x] Build out project view page (exists, removed inline status dropdown from table)
3. [x] Status needs to be changed on individual project page (works via Settings tab, uses notifications)

### Phase 2: Admin UI Polish (Medium Priority)

4. [ ] Leads Management - cards should filter table
5. [ ] Fix tooltip for truncated text
6. [ ] Better button design for portal sidebar
7. [ ] Fix mobile view for portal

### Phase 3: Main Site Features (Medium Priority)

8. [ ] SEO optimization

### Phase 4: Code Quality (Ongoing - can be done alongside other work)

- [x] Deep dive to identify inconsistencies with admin portal and make uniform
- [x] Font size for sidebar should match current size of signout button in sidebar
- [x] Extract duplicate hero logic from `page-hero.ts` and `about-hero.ts` (~400 lines)
- [x] Split `admin-dashboard.ts` (2,879 lines) - Partially complete (auth & project details extracted)
- [ ] Complete `admin-dashboard.ts` split (remove duplicate methods, create UI handlers file)
- [ ] Split `intro-animation.ts` (1,569 lines → 3 files)
- [ ] Split `client-portal.ts` (2,376 lines → multiple files)
- [ ] Split `terminal-intake.ts` (1,617 lines → multiple files)
- [ ] Split `contact-animation.ts` (880 lines → multiple files)
- [ ] Split `visitor-tracking.ts` (836 lines → multiple files)
- [ ] **CSS ID Inconsistencies & Conflicts Cleanup** - See plan below

### CSS ID/Class Cleanup Plan

**Problem:** CSS has inconsistent naming conventions, potential ID conflicts, and needs to be cleaner and more consistent.

**Plan:**

1. **Audit Phase** - COMPLETE
   - [x] Scan all CSS files for ID selectors (`#id`)
   - [x] Identify duplicate IDs across HTML files
   - [x] List all naming convention patterns currently in use
   - [x] Document conflicts between admin, portal, and main site CSS

---

## CSS Audit Results (January 12, 2026)

### ID Selectors by Scope

**Admin Dashboard (20 IDs in admin.css):**

| ID | Usage | Issue |
|----|-------|-------|
| `#pd-messages-thread` | 20 | Should be class, heavy styling |
| `#pd-messages-list` | 20 | Should be class, heavy styling |
| `#tab-project-detail` | 16 | Tab content, OK as ID |
| `#pd-tab-settings` | 11 | Should be class |
| `#pd-setting-status` | 7 | Should be class |
| `#tab-analytics` | 6 | Tab content, OK as ID |
| `#pd-status-dropdown` | 6 | Should be class |
| `#pd-files-list` | 6 | Should be class |
| `#pd-upload-dropzone` | 4 | OK as ID (unique) |
| `#pd-tab-messages` | 3 | Should be class |
| `#tab-client-detail` | 3 | Tab content, OK as ID |
| `#projects-card` | 2 | Should be class |
| `#intake-submissions-card` | 2 | Should be class |
| `#contact-submissions-card` | 2 | Should be class |
| `#btn-pd-send-message` | 2 | OK as ID (unique button) |
| `#btn-logout` | 2 | CONFLICT - also in portal |
| `#admin-send-message` | 2 | OK as ID |
| `#visitors-chart` | 1 | OK as ID (chart container) |
| `#sources-chart` | 1 | OK as ID (chart container) |
| `#pd-project-name` | 1 | OK as ID |

**Client Portal (2 IDs):**

| ID | Issue |
|----|-------|
| `#tab-system` | OK as ID |
| `#btn-logout` | CONFLICT - same ID as admin |

**Main Site (6 IDs):**

| ID | Issue |
|----|-------|
| `#intro` | OK - section ID |
| `#about` | OK - section ID |
| `#morph-card` | OK - unique element |
| `#contact-business-card` | OK - unique element |
| `#card-shadow-light` | OK - SVG filter |
| `#card-shadow-dark` | OK - SVG filter |

**Terminal Intake (5 IDs - SVG parts):**

| ID | Note |
|----|------|
| `#Ear`, `#Eye`, `#Head`, `#Nose` | SVG element IDs |
| `#main-content` | Section container |

### Duplicate ID Conflicts

| ID | Location 1 | Location 2 | Severity |
|----|------------|------------|----------|
| `#btn-logout` | admin.css | client-portal/sidebar.css | **HIGH** |
| `#toggle-theme` | index.html | blob-animation-mockup.html | Low (test file) |
| `#copyright-year` | index.html | blob-animation-mockup.html | Low (test file) |

### Naming Convention Patterns Identified

**Current patterns in use (inconsistent):**

1. **`pd-*`** - Project detail elements (admin): `pd-messages-list`, `pd-tab-settings`
2. **`tab-*`** - Tab content containers: `tab-analytics`, `tab-project-detail`
3. **`btn-*`** - Buttons: `btn-logout`, `btn-pd-send-message`
4. **`stat-*`** - Statistics displays: `stat-visitors`, `stat-total-leads`
5. **`cd-*`** - Client detail elements: `cd-email`, `cd-company`
6. **`sys-*`** - System info: `sys-version`, `sys-build-date`
7. **Kebab-case cards** - `projects-card`, `intake-submissions-card`
8. **No prefix** - Section IDs: `intro`, `about`, `contact`

**Recommended standard:** `[scope]-[component]-[element]`

- Admin: `admin-project-title`, `admin-messages-list`
- Portal: `portal-nav-link`, `portal-sidebar`
- Site: Unprefixed section IDs OK (`intro`, `about`, `contact`)

### !important Usage (Red Flags for Conflicts)

| File | Count | Priority |
|------|-------|----------|
| mobile/contact.css | 85 | **CRITICAL** |
| pages/admin.css | 64 | **HIGH** |
| mobile/layout.css | 55 | **HIGH** |
| components/page-transitions.css | 47 | **HIGH** |
| client-portal/sidebar.css | 47 | **HIGH** |
| pages/terminal-intake.css | 41 | Medium |
| pages/client.css | 35 | Medium |
| pages/client-portal-section.css | 30 | Medium |
| pages/contact.css | 28 | Medium |
| **TOTAL** | **~650** | - |

### Priority Issues to Fix

1. ~~**`#btn-logout` conflict**~~ - FIXED: Removed redundant ID selectors
2. ~~**Heavy ID styling**~~ - FIXED: Converted `#pd-messages-list`/`#pd-messages-thread` to `.messages-thread` class
3. **!important abuse** - 650+ uses indicate specificity wars (see analysis below)
4. **Inconsistent prefixes** - Mix of `pd-`, `cd-`, `tab-`, `btn-`, etc.

### !important Root Cause Analysis

**Why so many !important?**

| File | Count | Root Cause |
|------|-------|------------|
| mobile/contact.css | 85 | Mobile overriding desktop in media queries |
| admin.css | 64 | Admin overriding portal/form base styles |
| mobile/layout.css | 55 | Mobile overriding desktop in media queries |
| page-transitions.css | 47 | Animation states forcing visibility |
| client-portal/sidebar.css | 47 | Sidebar overriding global nav styles |

**Architectural Solutions (Future Work):**

1. **Mobile-First Refactor** - Write base styles for mobile, add desktop in media queries
2. **CSS Cascade Layers** - Use `@layer` to control cascade order
3. **Scoped Styles** - Use `[data-page="admin"]` prefix consistently to avoid conflicts
4. **Component Isolation** - Each component's styles shouldn't leak or conflict

**Recommended Approach:**
- Phase 1: Add `[data-page]` scoping to reduce cross-page conflicts
- Phase 2: Gradually refactor to mobile-first for mobile/* files
- Phase 3: Use CSS layers for animation/transition states

### Shared Component Analysis (86 classes duplicated)

**Reusable Components to Extract:**

| Component | Classes | Target File |
|-----------|---------|-------------|
| **Buttons** | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-icon`, `.btn-sm`, `.btn-logout` | `shared/buttons.css` |
| **Forms** | `.form-group`, `.form-input`, `.form-row`, `.form-select`, `.password-*` | `shared/forms.css` |
| **Sidebar** | `.sidebar`, `.sidebar-footer`, `.sidebar-toggle`, `.collapsed` | `shared/sidebar.css` |
| **Messages** | `.message`, `.message-*`, `.messages-thread`, `.message-compose` | `shared/messages.css` |
| **Files** | `.file-item`, `.file-*`, `.files-*-section` | `shared/files.css` |
| **Invoices** | `.invoice-item`, `.invoice-*` | `shared/invoices.css` |
| **Status** | `.status-badge`, `.status-active`, `.status-pending`, etc. | `shared/status.css` |
| **Stats/Cards** | `.stat-card`, `.stat-*`, `.portal-project-card`, `.portal-shadow` | `shared/cards.css` |
| **Progress** | `.progress-bar`, `.progress-fill` | `shared/progress.css` |
| **Layout** | `.page-header`, `.dashboard-content`, `.tab-content` | `shared/layout.css` |
| **Utilities** | `.hidden`, `.active`, `.visually-hidden` | `shared/utilities.css` |

**Current State:**
- `client-portal/components.css` already serves as shared components (has `[data-page="admin"]` selectors)
- `admin.css` is 4,194 lines (100KB) - needs to be split

**admin.css Split Plan:**

| New File | ~Lines | Content |
|----------|--------|---------|
| `admin/tables.css` | 400 | `.leads-table`, `.projects-table`, `.clients-table`, `.contacts-table` |
| `admin/project-detail.css` | 1000 | Project detail view, tabs, messages, files, invoices |
| `admin/client-detail.css` | 300 | Client detail view, billing, projects list |
| `admin/status.css` | 200 | Status badges, status select, status dropdown |
| `admin/modals.css` | 100 | `.admin-modal`, overlays |
| `admin/analytics.css` | 300 | Analytics tab, charts, stats grid |
| `admin/base.css` | 1500 | Core layout, sidebar, buttons, forms |

**Separation Strategy:**
1. Keep `client-portal/components.css` as shared base (already working)
2. Split admin.css into modular files in `/src/styles/admin/`
3. Create `admin/index.css` to import all modules
4. Keep page-specific overrides in respective files

---

2. **Standardize Naming Convention**
   - [ ] Define naming convention: `[scope]-[component]-[element]` (e.g., `admin-project-title`, `portal-nav-link`)
   - [ ] Prefix admin-specific IDs with `admin-`
   - [ ] Prefix portal-specific IDs with `portal-` or `client-`
   - [ ] Prefix main site IDs with `site-` or leave unprefixed

3. **Refactor IDs to Classes Where Appropriate**
   - [ ] Convert styling IDs to classes (IDs should only be for JS hooks)
   - [ ] Use BEM-like naming for component classes
   - [ ] Keep IDs only for: form labels, JS element selection, anchor links

4. **Consolidate Duplicate Styles**
   - [ ] Identify duplicate style definitions across CSS files
   - [ ] Extract shared styles into common component classes
   - [ ] Remove redundant/unused selectors

5. **File Organization**
   - [ ] Ensure clear separation: `admin.css`, `portal.css`, `main-site.css`
   - [ ] Move shared styles to `components/` directory
   - [ ] Document CSS architecture in `CSS_ARCHITECTURE.md`

6. **Validation**
   - [ ] Run HTML validator to catch duplicate IDs
   - [ ] Test all pages after refactoring
   - [ ] Verify no broken styles or JS functionality

### Phase 5: Documentation (After CMS complete)

9. [ ] Take screenshots of CMS for projects on main site (once complete)

---

## System Status

**Last Updated**: December 23, 2025 (Documentation update complete)

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
