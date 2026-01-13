# Current Work - January 13, 2026

---

## Active Issues

### Page Transition Animation Issues - IN PROGRESS

**Status:** Actively debugging
**Priority:** High

**Issues Reported:**

1. **HR element shows before rest of content** - Contact page HR appears briefly before the blur animation starts, despite using `page-entering` CSS class as bridge during class transitions.

2. **Button visibility problems** - Submit button on contact page has had various issues:
   - Was showing early before page animation
   - Then wasn't showing at all after fixes
   - Root cause approach needed (not workarounds)

3. **Intro/coyote paw animation issues** - When navigating back to home page:
   - Business card section may fade in before coyote paw animation completes
   - Animation timing needs coordination between PageTransitionModule and IntroAnimationModule

**Current Implementation:**

```typescript
// page-transition.ts - transitionTo()
targetPage.element.classList.add('page-entering');  // CSS !important keeps hidden
targetPage.element.classList.remove('page-hidden');
targetPage.element.classList.add('page-active');
gsap.set(targetPage.element, { opacity: 0, visibility: 'hidden', filter: 'blur(12px)' });
targetPage.element.classList.remove('page-entering');  // GSAP takes over
await this.animateIn(targetPage);
```

**Root Cause Analysis Needed:**

- CSS `!important` rules vs GSAP inline styles timing
- Browser paint timing between class changes
- Possible specificity conflicts with child elements (HR, button)

**Files Involved:**

- `src/modules/animation/page-transition.ts`
- `src/modules/animation/intro-animation.ts`
- `src/styles/components/page-transitions.css`
- `src/styles/pages/contact.css`

**Recent Commits:**

- `4e1a758` - refactor: simplify page transitions to uniform blur animation

---

### Header White Flash in Dark Mode

**Status:** Under Investigation
**Priority:** Medium

**Issue:** When clicking home button to navigate back to intro page in dark mode, header area briefly flashes white.

**Suspected Root Cause:** Browser default white background showing during page transition. The `html` element doesn't have background color set.

**Files to Investigate:**

- `src/modules/animation/intro-animation.ts` - playEntryAnimation()
- `src/modules/animation/page-transition.ts` - transitionTo()
- `src/styles/main.css` - html/body background colors

---

## Completed Work (Ready to Archive)

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

### Phase 3: Code Organization

**Goal:** Split large files to improve maintainability.

**Large Files Remaining:**

| File | Lines | Priority | Notes |
|------|-------|----------|-------|
| `client-portal.ts` | 2,293 | High | Largest file, needs splitting |
| `admin-dashboard.ts` | 1,917 | Medium | Already has 9 extracted modules |
| `intro-animation.ts` | 1,815 | Medium | Animation logic |
| `terminal-intake.ts` | 1,685 | Medium | Terminal UI logic |
| `page-transition.ts` | 580 | Low | Recently simplified |
| `admin-project-details.ts` | 1,024 | Low | Recently extracted |

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

- [ ] Split `client-portal.ts` (2,429 lines)
- [ ] CSS !important cleanup (650+ uses - architectural issue)

### CSS Cleanup Plan

**Problem:** 650+ `!important` declarations indicate specificity wars.

**Root Causes Identified:**

| File | Count | Root Cause |
|------|-------|------------|
| mobile/contact.css | 85 | Mobile overriding desktop |
| admin.css | 64 | Admin overriding portal styles |
| mobile/layout.css | 55 | Mobile overriding desktop |
| page-transitions.css | 47 | Animation states forcing visibility |
| client-portal/sidebar.css | 47 | Sidebar overriding global nav |

**Architectural Solutions (Future):**

1. Mobile-First Refactor - Write base styles for mobile, add desktop in media queries
2. CSS Cascade Layers - Use `@layer` to control cascade order
3. Scoped Styles - Use `[data-page="admin"]` prefix to avoid conflicts

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
