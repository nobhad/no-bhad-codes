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

---

## Projects Section Redesign (Sal Costa Style)

**Reference:** `docs/design/salcosta/` - HTML structure and CSS patterns

**Current State:** Portfolio data updated in `public/data/portfolio.json`. Two projects marked as documented for testing (nobhad.codes, The Backend). WIP sign will display until screenshots added.

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
- [x] **Write Project Descriptions** - For each project: ✅ COMPLETE (January 20, 2026)
  - Title (short, memorable)
  - Category/Type (Web App, Mobile App, Dashboard, etc.)
  - One-line tagline for card view
  - Full description paragraph for detail page
  - Role/Contribution
  - Tools/Technologies used
  - Year completed
- [x] **Create Project Data Structure** - JSON data file: ✅ COMPLETE (January 20, 2026)

  **File:** `public/data/portfolio.json`

  **Projects Added:**

  | Project | Category | Status |
  |---------|----------|--------|
  | nobhad.codes | Website | In Progress (2026) |
  | The Backend | Application | In Progress (2026) |
  | Recycle Content | Application | In Progress (2026) |

  **Note:** First two projects set to `isDocumented: true` for testing. Set back to `false` until screenshots are added.

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
