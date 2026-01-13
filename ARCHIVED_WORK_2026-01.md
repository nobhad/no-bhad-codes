# Archived Work - January 2026

This file contains completed work from January 2026. Items are moved here from `current_work.md` once fully verified and operational.

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

## Previous December 2025 Work

All December 2025 completed work has been archived to `ARCHIVED_WORK_2025-12.md`.
