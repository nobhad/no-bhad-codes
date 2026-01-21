# Current Work

**Last Updated:** January 21, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## TODOs

### Admin UI Polish (High Priority)

- [ ] **REDESIGN ALL PORTAL BUTTONS** - Full button redesign across admin and client portals

### Main Site Features (Medium Priority)

- [ ] **PROJECTS SECTION REDESIGN** - Sal Costa-style portfolio (see breakdown below)
- [ ] SEO optimization - DO NOT DO THIS UNTIL AFTER I HAVE PROJECTS AND CONTENT COMPLETED (2 PROJECTS)

### Code Quality (Low Priority)

- [x] **Migrate hardcoded media queries** - ✅ All 24 hardcoded media queries migrated to custom media query system
  - Added new custom media queries: `--tablet-down`, `--desktop-down`, `--ultra-wide-down`, `--tablet-to-desktop`
  - Replaced all hardcoded breakpoints across 11 stylesheet files
- [x] **Server `any` types** - ✅ COMPLETE - Fixed all critical `any` types (reduced from 97 to 0, all 97 fixed)
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
- [x] **Consolidate `rgba(0,0,0,...)` shadows** - ✅ All inline rgba box-shadow values replaced with `--shadow-*` tokens
  - Removed var() fallbacks (tokens always defined)
  - Replaced 10+ inline box-shadow values across 3 files
  - Remaining rgba references are in variables.css (token definitions) or non-shadow properties

---

## Projects Section Redesign (Sal Costa Style)

**Reference:** `docs/design/salcosta/` - HTML structure and CSS patterns

**Current State:** Projects section shows placeholder "Work in Progress" sign

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
- [ ] **Write Project Descriptions** - For each project:
  - Title (short, memorable)
  - Category/Type (Web App, Mobile App, Dashboard, etc.)
  - One-line tagline for card view
  - Full description paragraph for detail page
  - Role/Contribution
  - Tools/Technologies used
  - Year completed
- [ ] **Create Project Data Structure** - JSON/TypeScript data file:

  ```typescript
  interface Project {
    id: string;
    title: string;
    tagline: string;
    category: string;
    description: string;
    role: string;
    tools: string[];
    year: number;
    heroImage: string;
    screenshots: string[];
    liveUrl?: string;
    repoUrl?: string;
  }
  ```

### Phase 2: CSS Components (Sal Costa Patterns)

**File:** `src/styles/pages/projects.css`

- [ ] **Work Cards** - Horizontal project list items

  ```css
  .work-card { overflow: hidden; }
  .card-container {
    height: 90px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid var(--color-dark);
  }
  ```

- [ ] **Project Card Title** - With hover slide animation

  ```css
  .project-card-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transform: translate(-30px);
    transition: transform var(--transition-mouse);
  }
  .card-container:hover .project-card-title {
    transform: translate(0);
  }
  ```

- [ ] **Round Labels** - Metadata badges (role, tools, year)

  ```css
  .round-label {
    background-color: var(--color-dark);
    padding: 6px 12px;
    border-radius: 20px;
    color: var(--color-light);
  }
  ```

- [ ] **Project Detail Layout** - `.worksub-*` classes
  - Header with hero image (40px border-radius top)
  - Intro section with two-column layout
  - Info sections with screenshots
  - Back button (fixed left position)

- [ ] **Drop-in/Drop-out Animations**

  ```css
  @keyframes drop-in {
    0% { transform: translateY(-105%); }
    100% { transform: translateY(0); }
  }
  @keyframes drop-out {
    0% { transform: translateY(0); }
    100% { transform: translateY(105%); }
  }
  ```

### Phase 3: HTML Structure

- [ ] **Update Projects Section** - Replace WIP sign with project list

  ```html
  <section class="projects-section">
    <div class="projects-content">
      <div class="heading-wrapper">
        <h2>PROJECTS</h2>
        <hr class="heading-divider" />
      </div>
      <div class="work-half-wrapper">
        <!-- Project cards rendered here -->
      </div>
    </div>
  </section>
  ```

- [ ] **Create Project Detail Template** - For individual project pages

  ```html
  <div class="page-wrapper worksub">
    <div class="worksub-header">
      <figure><img src="..." alt="..." /></figure>
    </div>
    <div class="worksub-intro">
      <h1>Project Title</h1>
      <div class="intro-content">
        <div class="intro-left">
          <div class="intro-left-group">
            <span class="round-label">Role</span>
            <span>Full Stack Developer</span>
          </div>
          <!-- More metadata -->
        </div>
        <p>Project description...</p>
      </div>
      <hr class="worksub-divider" />
    </div>
    <div class="worksub-info">
      <!-- Screenshots and details -->
    </div>
  </div>
  ```

### Phase 4: JavaScript Implementation

**File:** `src/features/main-site/projects.ts` (new)

- [ ] **Project Data Loading** - Import project data
- [ ] **Render Project Cards** - Generate card HTML from data
- [ ] **Card Hover Interactions** - Title slide, scale effects
- [ ] **Project Detail View** - Transition to detail page
- [ ] **Back Navigation** - Return to project list
- [ ] **GSAP Animations** - Drop-in/out, blur transitions

### Phase 5: Assets

- [ ] **Create `/public/projects/` directory**
- [ ] **Store project screenshots** - Naming convention: `{project-id}-{type}.{ext}`
  - `project-name-hero.webp` - Main hero image
  - `project-name-desktop-1.webp` - Desktop screenshots
  - `project-name-mobile-1.webp` - Mobile screenshots
- [ ] **Optimize images** - WebP format, appropriate sizes
- [ ] **Create OG images** - For social sharing (1200x630)

### Phase 6: Integration

- [ ] **Update Navigation** - Projects link behavior
- [ ] **Page Transitions** - Integrate with existing transition system
- [ ] **Mobile Responsiveness** - Cards stack, images scale
- [ ] **Accessibility** - Keyboard navigation, screen reader support

### Known Issues

⚠️ **Page Transition Overlap Issue**
- There's a page transition overlap issue where navigating to project detail pages sometimes shows content from other sections (like the business card) overlapping.
- This is related to how the page transition module handles the dynamic `#/projects/:slug` routes.
- The content renders correctly, but the z-index/visibility management between sections needs refinement.

**Fix Plan:**

#### Problem Statement
When navigating to project detail pages (`#/projects/:slug`), content from other sections (particularly the business card from the intro section) sometimes overlaps with the project detail content. The content renders correctly, but z-index/visibility management between sections needs refinement.

#### Root Cause Analysis

**Issue 1: Dual Page Management**
- `ProjectsModule` manually manages `page-active` and `page-hidden` classes on both `projects-section` and `project-detail-section`
- `PageTransitionModule` also manages page visibility through the same classes
- Both modules respond to hash changes independently, creating a race condition

**Issue 2: Event Format Mismatch**
- `ProjectsModule` dispatches `router:navigate` with `{ section: 'project-detail', slug }`
- `PageTransitionModule` expects `{ pageId: 'project-detail' }` in the event detail
- The mismatch means `PageTransitionModule` may not properly handle project detail transitions

**Issue 3: Incomplete Page Hiding**
- When transitioning to `project-detail`, `PageTransitionModule.transitionTo()` hides the current page but may not ensure ALL other pages (especially intro) are properly hidden
- The intro page has special z-index handling (`z-index: 50` when active) which might cause it to appear above other pages

**Issue 4: Hash Change Handler Race**
- Both `ProjectsModule.handleHashChange()` and `PageTransitionModule.handleHashChange()` listen to `hashchange` events
- They execute independently, potentially conflicting with each other

#### Solution Strategy

**Phase 1: Centralize Page Visibility Management**
- Remove manual `page-active`/`page-hidden` class toggling from `ProjectsModule.showProjectDetail()` and `ProjectsModule.hideProjectDetail()`
- Keep only content rendering logic in `ProjectsModule`
- Ensure `ProjectsModule` dispatches correct event format for `PageTransitionModule`
- **Files:** `src/modules/ui/projects.ts`

**Phase 2: Fix Event Coordination**
- Update `ProjectsModule` to dispatch `router:navigate` with `{ pageId: 'project-detail' }` format
- Ensure `PageTransitionModule` properly handles project detail routes
- Add explicit page hiding logic in `PageTransitionModule.transitionTo()` to hide ALL non-target pages
- **Files:** `src/modules/ui/projects.ts`, `src/modules/animation/page-transition.ts`

**Phase 3: Strengthen Page Hiding Logic**
- In `PageTransitionModule.transitionTo()`, explicitly hide ALL pages in the `pages` Map before showing the target page
- Add defensive check to ensure intro page gets `page-hidden` class even if it's not the current page
- Ensure z-index is properly managed - intro should have lower z-index when not active
- **Files:** `src/modules/animation/page-transition.ts`, `src/styles/components/page-transitions.css`

**Phase 4: Remove Duplicate Hash Change Handlers**
- Remove `ProjectsModule.handleHashChange()` - let `PageTransitionModule` handle all hash changes
- Update `ProjectsModule` to listen for `page-changed` events from `PageTransitionModule` instead
- When `page-changed` event fires with `pageId: 'project-detail'`, extract slug from hash and render content
- **Files:** `src/modules/ui/projects.ts`, `src/modules/animation/page-transition.ts`

#### Implementation Steps

1. **Update ProjectsModule Event Handling**
   - Remove hash change listener
   - Remove handleHashChange method
   - Add page-changed event listener
   - Update showProjectDetail to not manage classes
   - Update hideProjectDetail to not manage classes

2. **Fix PageTransitionModule Transition Logic**
   - In transitionTo(), before showing target page:
   - Hide ALL pages in pages Map (not just currentPage)
   - Ensure intro page gets page-hidden class
   - Then show target page

3. **Update Event Dispatch Format**
   - In ProjectsModule.navigateToProject():
   - Dispatch router:navigate with `{ pageId: 'project-detail' }`
   - Let PageTransitionModule handle the hash change

4. **Add Defensive CSS Rules**
   ```css
   /* Ensure intro page is hidden when project-detail is active */
   section#intro.page-hidden,
   section.business-card-section.page-hidden {
     display: none !important;
     visibility: hidden !important;
     opacity: 0 !important;
     z-index: -1 !important;
   }
   
   /* Ensure project-detail has higher z-index than intro */
   section.project-detail-section.page-active {
     z-index: 100;
   }
   ```

#### Testing Checklist

- [ ] Navigate from intro to project detail - intro should be completely hidden
- [ ] Navigate from projects list to project detail - projects list should be hidden
- [ ] Navigate from project detail back to projects list - project detail should be hidden
- [ ] Navigate from project detail to intro - project detail should be hidden
- [ ] Navigate directly to `#/projects/:slug` on page load - only project detail should be visible
- [ ] Browser back/forward navigation works correctly
- [ ] No visual overlap or flickering during transitions
- [ ] All page transitions use blur animation correctly

#### Estimated Time

- **Phase 1:** 30 minutes
- **Phase 2:** 45 minutes
- **Phase 3:** 30 minutes
- **Phase 4:** 45 minutes
- **Testing:** 30 minutes
- **Total:** ~3 hours

#### Success Criteria

1. No visual overlap between sections during transitions
2. Intro page (business card) never appears on top of project detail
3. All page transitions are smooth and consistent
4. Browser navigation (back/forward) works correctly
5. Direct navigation to `#/projects/:slug` shows only project detail

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
| Console logs | 225 | ⚠️ High (many intentional logging) |
| `any` types (frontend) | 41 | ✅ Reduced from 71 to 41 (30 fixed, 41 intentional) |
| `any` types (server) | 0 | ✅ COMPLETE - All 97 fixed, 0 TypeScript errors |
| ESLint disables | 4 | ✅ Low |
| Hardcoded media queries | 0 | ✅ Complete - All migrated to custom media queries |
| Inline rgba box-shadows | 0 | ✅ Complete - All replaced with shadow tokens |

### Findings

**Opportunities:**
- All completed improvements have been moved to archived work

---

## System Status

**Last Updated:** January 21, 2026

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
