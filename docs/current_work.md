# Current Work

**Last Updated:** January 23, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## Known Concerns

### Analytics - Average Session Calculation Still Off

**Status:** Needs Investigation
**Observed:** January 23, 2026

The average session duration is showing extremely high values (e.g., 1663m 47s = ~27 hours) which is not realistic. A previous fix was applied to clear `currentPageView` after `completePageView()` to prevent double-counting on tab switches, but the calculation still appears incorrect.

**Possible causes to investigate:**

- Session data accumulating across days/visits
- Old session data not being properly cleaned up
- Calculation including incomplete/abandoned sessions incorrectly

### Lead Activation Not Working

**Status:** FIXED - January 23, 2026

**Root cause:** Database CHECK constraint mismatch.

The `projects.status` column has a CHECK constraint allowing only: `'pending', 'in-progress', 'in-review', 'completed', 'on-hold'`

But the code was trying to set `status = 'active'` which violated the constraint.

**Fix applied:**

- Changed activation status from `'active'` to `'in-progress'`
- Fixed status check from `'in_progress'` (underscore) to `'in-progress'` (hyphen)

**File:** `server/routes/admin.ts`

---

### Backend/Frontend API Alignment

**Status:** FIXED - January 23, 2026

**Issues identified and fixed:**

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| Project status `in_progress` vs `in-progress` | HIGH | Changed all code to use hyphen format matching DB CHECK constraint |
| Lead stats query using wrong status values | HIGH | Updated to use `'in-progress', 'in-review'` instead of `'active', 'in_progress'` |
| validStatuses array had non-existent values | HIGH | Updated to match DB: `['pending', 'in-progress', 'in-review', 'completed', 'on-hold']` |
| Invoice API returned camelCase, frontend expected snake_case | MEDIUM | Added `toSnakeCaseInvoice()` transformation function |
| database.ts types didn't match DB schema | MEDIUM | Updated LeadStatus and ProjectStatus types |

**Files modified:**

- `server/routes/admin.ts` - Fixed status values in queries and validations
- `server/routes/invoices.ts` - Added snake_case transformation for frontend compatibility
- `server/types/database.ts` - Updated type definitions to match DB CHECK constraints

**Database CHECK constraints (source of truth):**

```sql
-- projects.status
CHECK (status IN ('pending', 'in-progress', 'in-review', 'completed', 'on-hold'))

-- message_threads.status
CHECK (status IN ('active', 'closed', 'archived'))
```

---

### Custom Design Dialog Boxes Needed

**Status:** TODO
**Observed:** January 23, 2026

Currently using native browser `confirm()` and `alert()` dialogs which don't match the site's design aesthetic. Need to create custom styled modal dialogs.

**Affected areas:**

- "Activate this lead as a project?" confirmation
- Other confirmation/alert dialogs throughout admin portal

**Requirements:**

- Custom modal component matching portal dark theme
- Cancel/OK buttons with portal button styling
- Consistent with overall design language

---

### Terminal Styling in Client Portal

**Status:** Needs Review
**Observed:** January 23, 2026

The terminal intake in the client portal (New Project tab) has width/overflow issues.

**Root cause identified:**

- Base terminal styles set `min-width: 100%` on `.terminal` and `.terminal-window`
- This forces full width regardless of `max-width` constraints
- Portal context needs to override with `min-width: auto`

**Current fix applied:**

- Added portal-specific overrides in `terminal-intake.css`
- Set width constraint (90%, max 900px) on `.terminal-intake`
- Reset `min-width: auto` on child elements

**Needs verification:** Confirm terminal displays correctly without overflow on both sides.

---

## TODOs

### Admin UI Polish (High Priority)

- [x] **PORTAL CSS CONSOLIDATION** - Completed January 22, 2026
  - Created shared portal CSS files for single source of truth
  - Removed duplicate styling from admin and client portal files
  - Fixed avatar styling (black icon/white eye in messages, inverted in sidebar)
  - Added bold stroke-width (2.5) for sidebar icons
  - Added red focus outline for portal buttons
  - Added shared card styling for `.summary-card` and `.invoices-list` in `shared/portal-cards.css`
  - Created `shared/portal-files.css` for file upload components (dropzone, file items, file lists)
  - Cleaned up `client-portal/files.css` and `client-portal/invoices.css` to remove duplicates
- [ ] **REDESIGN ALL PORTAL BUTTONS** - Full button redesign across admin and client portals

### Main Site Features (Medium Priority)

- [ ] **PROJECTS SECTION REDESIGN** - Sal Costa-style portfolio (see breakdown below)
- [ ] SEO optimization - DO NOT DO THIS UNTIL AFTER I HAVE PROJECTS AND CONTENT COMPLETED (2 PROJECTS)

---

## Projects Section Redesign (Sal Costa Style)

**Reference:** `docs/design/salcosta/` - HTML structure and CSS patterns

**Current State:** Code implementation COMPLETE. Portfolio displays WIP sign until you add screenshots to your projects. Once screenshots are added, the project cards will automatically appear.

**Target:** Interactive portfolio showcasing custom software projects with:

- Horizontal project cards with hover animations
- Project detail pages with hero images
- Metadata labels (role, tools, year)
- Drop-in/drop-out page transitions

### Phase 1: Content Creation

- [ ] **Screenshot Projects** - Capture high-quality screenshots of each software project
  - Desktop view (hero image, 12:7 aspect ratio)
  - Mobile views if applicable
  - Key feature screenshots for detail pages
- [x] **Write Project Descriptions** - ✅ COMPLETE (January 20, 2026)
- [x] **Create Project Data Structure** - ✅ COMPLETE (January 20, 2026)

  **File:** `public/data/portfolio.json`

  **Projects Added:**

  | Project | Category | Status |
  |---------|----------|--------|
  | nobhad.codes | Website | In Progress (2026) |
  | The Backend | Application | In Progress (2026) |
  | Recycle Content | Application | In Progress (2026) |

  **Note:** First two projects set to `isDocumented: true` for testing. Set back to `false` until screenshots are added.

### Phase 2: CSS Components - ✅ COMPLETE

**File:** `src/styles/pages/projects.css`

- [x] **Work Cards** - Horizontal project list items with drop-in animations
- [x] **Project Card Title** - With hover slide animation (arrow reveals on hover)
- [x] **Round Labels** - Metadata badges (role, tools, year)
- [x] **Project Detail Layout** - `.worksub-*` classes (header, intro, info, links sections)
- [x] **Drop-in/Drop-out Animations** - CSS keyframes with staggered delays
- [x] **Back Button** - Fixed position with slide-in animation
- [x] **Responsive Design** - Mobile/tablet breakpoints
- [x] **Dark Mode** - Full dark mode support

### Phase 3: HTML Structure - ✅ COMPLETE

- [x] **Projects Section** - In `index.html` with WIP sign fallback
- [x] **Project Detail Template** - Full Sal Costa-style layout with:
  - Hero image header (12:7 aspect ratio)
  - Two-column intro (metadata + description)
  - Screenshots section
  - Links section (live URL, GitHub)
  - Back button

### Phase 4: JavaScript Implementation - ✅ COMPLETE

**File:** `src/modules/ui/projects.ts`

- [x] **Project Data Loading** - Fetches from `/data/portfolio.json`
- [x] **Render Project Cards** - Dynamically generates cards from data
- [x] **Card Hover Interactions** - Arrow reveal, right content shift
- [x] **Project Detail View** - Populates detail template from project data
- [x] **Back Navigation** - Hash-based routing back to projects list
- [x] **Page Transitions** - Integrates with PageTransitionModule (blur in/out)

### Phase 4.5: CRT TV Preview Feature - ✅ COMPLETE (January 21, 2026)

**Feature:** Retro Panasonic CRT TV displays project title cards on hover (desktop only, 768px+)

**Files Added:**

- `public/images/crt-tv.png` - TV frame image (transparent screen cutout)
- `public/images/crt-tv-screen.png` - Screen shape layer (for accurate CRT barrel distortion)

**Implementation:**

| Component | Description |
|-----------|-------------|
| TV Rendering | `renderCrtTv()` in `projects.ts` - injects TV HTML into flex layout |
| Hover Events | `setupCardHoverEvents()` - mouseenter/mouseleave on project cards |
| Channel Change | `changeTvChannel()` - GSAP timeline: static flicker → load image → fade in |
| Turn Off | `turnOffTv()` - GSAP animation: vertical shrink effect (classic CRT turn-off) |
| Layered Structure | Screen shape (z-1) → Title card + effects (z-2) → TV frame (z-3) |

**CSS Classes:**

- `.crt-tv` - Container, sticky positioning, 550px width
- `.crt-tv__wrapper` - Relative container for layered elements
- `.crt-tv__screen-bg` - Screen shape image (behind)
- `.crt-tv__screen` - Title card container with scanlines/static/glare
- `.crt-tv__frame` - TV frame image (on top)
- `.projects-flex-row` - Flex container for cards + TV (8rem gap)
- `.projects-list-column` - Column wrapper for heading + cards

**Data:**

- Added `titleCard` property to each project in `portfolio.json`
- Title card images go in `/public/projects/{project-id}-title.png`

**Pending:**

- [ ] Create title card images for each project (4:3 aspect ratio, Looney Tunes style)

### Phase 5: Assets - ⏳ PENDING (User Action Required)

- [x] **Create `/public/projects/` directory** - ✅ COMPLETE
- [x] **Create placeholder image** - ✅ COMPLETE (`/images/project-placeholder.svg`)
- [ ] **Store project screenshots** - Naming convention: `{project-id}-{type}.{ext}`
  - `nobhad-codes-hero.webp` - Main hero image
  - `nobhad-codes-desktop-1.webp` - Desktop screenshots
  - `the-backend-hero.webp` - Main hero image
  - etc.
- [ ] **Update portfolio.json** - Add heroImage and screenshots paths once captured
- [ ] **Optimize images** - WebP format, appropriate sizes
- [ ] **Create OG images** - For social sharing (1200x630)

### Phase 6: Integration - ✅ COMPLETE

- [x] **Navigation** - Projects link navigates to `#/projects`
- [x] **Page Transitions** - Blur in/out with PageTransitionModule
- [x] **Mobile Responsiveness** - Cards stack, images scale, category hidden on small screens
- [x] **Accessibility** - Keyboard navigation (Enter/Space), ARIA labels, focus states

### Known Issues

✅ **Page Transition Overlap Issue** - FIXED (January 21, 2026)

**Problem:** Business card/intro section would appear over project detail pages until refresh.

**Root Causes Identified & Fixed:**

1. **Dual Page Management** - ProjectsModule and PageTransitionModule both managed page visibility classes independently
2. **Event Format Mismatch** - Modules used different event formats for navigation
3. **Incomplete Page Hiding** - Only current page was hidden, not ALL pages
4. **Hash Change Handler Race** - Both modules listened to hashchange events
5. **Initial Route Dispatch** - RouterService dispatched navigation events during initial load, overriding PageTransitionModule's correct initial state
6. **Business Card Enablement** - `enableAfterIntro()` was called unconditionally regardless of current page

**Solution Implemented:**

| Phase | Change | Files |
|-------|--------|-------|
| 1 | Removed manual class management from ProjectsModule | `projects.ts` |
| 2 | ProjectsModule now listens to `page-changed` events | `projects.ts` |
| 3 | Added `hideAllPages()` that hides ALL pages + kills GSAP animations on intro children | `page-transition.ts` |
| 4 | Added inline style hiding for intro elements (display, visibility, opacity) | `page-transition.ts` |
| 5 | Added `admin-login` to PageTransitionModule page configs | `page-transition.ts` |
| 6 | Skip `router:navigate` dispatch during initial page load | `router-service.ts` |
| 7 | Only call `enableAfterIntro()` when on intro page | `app.ts` |
| 8 | Added defensive CSS with `!important` for page-hidden state | `page-transitions.css` |
| 9 | Increased z-index for project-detail to 150 (above intro's 50) | `page-transitions.css` |

**Additional Fixes:**

- Widened projects content container (`max-width: min(1400px, 90vw)`) to prevent title/category overlap
- Removed title scale animation on hover to prevent overlap
- Added `margin-left: 3rem` gap between title and right content
- Added `overflow: hidden` and `text-overflow: ellipsis` to title
- Added `.back-link` styles for project detail page (subtle text link for smaller screens)
- Fixed router to skip project detail routes (handled by PageTransitionModule)

### Implementation Order

1. Content first (screenshots, descriptions)
2. CSS components (can test with placeholder data)
3. HTML structure updates
4. JavaScript logic
5. Animation polish
6. Testing and refinement

---

## Deep Dive Analysis - January 21, 2026

**Status:** Complete

### Codebase Health Metrics

| Metric | Count | Status |
|--------|-------|--------|
| TODO/FIXME comments | 2 | ✅ Low (projects.ts detail page TODO) |
| Console logs | 225 | ⚠️ High (many intentional logging with safeguards: logger utility checks debug mode, app-state middleware only logs in development) |
| `any` types (frontend) | 41 | ✅ Reduced from 71 to 41 (30 fixed, 41 intentional) |
| `any` types (server) | 0 | ✅ COMPLETE - All 97 fixed, 0 TypeScript errors |
| ESLint disables | 4 | ✅ Low (all intentional: 4 console.log in logger/dev middleware, 4 any types for flexible validation) |
| Hardcoded media queries | 0 | ✅ Complete - All migrated to custom media queries |
| Inline rgba box-shadows | 0 | ✅ Complete - All replaced with shadow tokens |

**Summary:** Most code quality metrics are in good shape. Console logs remain high but many are intentional for debugging. Frontend type safety significantly improved (30 `any` types fixed). Server code is 100% type-safe.

---

## System Status

**Last Updated:** January 20, 2026

### Build Status

- **TypeScript:** 0 errors
- **ESLint:** 0 errors, 0 warnings
- **Build:** Success

### Development Server

```bash
npm run dev:full
```

- Frontend: http://localhost:4000
- Backend: http://localhost:4001

---

## Archived Work

- January 2026: [ARCHIVED_WORK_2026-01.md](./archive/ARCHIVED_WORK_2026-01.md)
- December 2025: [ARCHIVED_WORK_2025-12.md](./archive/ARCHIVED_WORK_2025-12.md)
