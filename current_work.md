# Current Work - January 15, 2026

---

## Recently Completed

### CSS Cleanup & Code Organization - January 15, 2026

**CSS File Optimization (-499 lines total):**

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| client.css | 1716 | 1403 | -313 lines (18%) - Removed unused LEGACY portal styles |
| contact.css | 1000 | 902 | -98 lines (10%) - Trimmed excessive header docs |
| business-card.css | 743 | 655 | -88 lines (12%) - Extracted intro-nav to separate module |

**Files Created:**

- `src/styles/components/intro-nav.css` - Navigation links below business card

**Files Modified:**

- `src/styles/main.css` - Added intro-nav.css import

**Client Portal Code Consolidation (-185 lines):**

- Removed duplicate file upload handlers from `client-portal.ts`
- Now uses module version in `portal-files.ts`
- Main file reduced from 1855 to 1670 lines

---

### CSS Consolidation - January 15, 2026

**Terminal CSS:**
Merged `src/styles/components/terminal.css` into `src/styles/pages/terminal-intake.css` since the terminal component is only used for the intake form.

**Admin CSS (2899 → 1846 lines, -1053 lines, 36% reduction):**

Phase 1 - Consolidated duplicate table styles to use `.admin-table` base class:
- Created `.admin-table-container` for common container styles
- Extended `.admin-table` with all common table styles (th, td, hover, links)
- Removed duplicate `.leads-table`, `.visitors-table`, `.clients-table`, `.contacts-table`, `.projects-table` definitions
- Simplified status dropdown selectors from ~110 lines to ~90 lines

Phase 2 - Split into modules:
- Created `src/styles/admin/auth.css` (266 lines) - Auth gate, login form, password toggle
- Created `src/styles/admin/modals.css` (251 lines) - Modal overlay, body, footer, dropdowns
- Created `src/styles/admin/analytics.css` (231 lines) - Charts, vitals, performance metrics

**Files Modified:**

- `src/styles/pages/terminal-intake.css` - Now contains all terminal styles
- `src/styles/pages/admin.css` - Consolidated tables, extracted modules (1846 lines)
- `src/styles/admin/index.css` - Added imports for new modules
- `src/styles/main.css` - Removed terminal.css import

**Files Created:**

- `src/styles/admin/auth.css` - Authentication styles
- `src/styles/admin/modals.css` - Modal styles
- `src/styles/admin/analytics.css` - Analytics/charts styles

**Files Deleted:**

- `src/styles/components/terminal.css` - Merged into terminal-intake.css

---

### Admin Portal Mobile Optimization - January 14, 2026

**Mobile-specific styles added to `src/styles/pages/admin.css`:**

- All grids stack to single column on mobile (600px breakpoint)
- System page: reduced padding, removed grey backgrounds from status items, text wraps properly
- Analytics page: reduced chart padding/height, 2x2 grid for chart legends
- Stat cards: horizontal layout (number + label on same row) to save vertical space
- Page background matches content area for consistent appearance

**Files Modified:**

- `src/styles/pages/admin.css` - Added 113 lines of mobile-specific styles
- `src/styles/client-portal/layout.css` - Added body background color
- `src/styles/client-portal/sidebar.css` - Mobile sidebar collapse behavior

---

### API Fixes - January 14, 2026

**Fixed 404 Errors:**

- Added `GET /api/projects/:id/files` endpoint to return project files
- Added `GET /api/projects/:id/messages` endpoint to return project messages

**Fixed 401 Token Expiration Handling:**

- Created `src/utils/api-client.ts` - centralized API client with automatic token expiration handling
- Updated `admin-leads.ts` to use new API client
- Updated `admin-contacts.ts` to use new API client
- Updated `admin-analytics.ts` to use new API client
- Configured API client in `admin-dashboard.ts` to show notification on session expiry
- When token expires, user now sees "Your session has expired. Please log in again." message and is redirected to login

**Files Modified:**

- `server/routes/projects.ts` - Added GET endpoints for files and messages
- `src/utils/api-client.ts` - New centralized API client
- `src/features/admin/admin-dashboard.ts` - API client configuration
- `src/features/admin/modules/admin-leads.ts` - Use apiFetch
- `src/features/admin/modules/admin-contacts.ts` - Use apiFetch
- `src/features/admin/modules/admin-analytics.ts` - Use apiFetch

---

## In Progress

### Phase 3: Code Organization

**Goal:** Split large files to improve maintainability.

**Large Files Status:**

| File | Lines | Priority | Status |
|------|-------|----------|--------|
| `client-portal.ts` | 1,405 | High | DONE - login, auth, animations consolidated to modules |
| `admin-dashboard.ts` | 1,917 | Medium | Already has 9 extracted modules |
| `intro-animation.ts` | 1,815 | Medium | Animation logic |
| `terminal-intake.ts` | 1,685 | Medium | Terminal UI logic |
| `page-transition.ts` | 580 | Low | Recently simplified |
| `admin-project-details.ts` | 1,250+ | Low | Recently extended with new fields |

**Client Portal Refactor Progress:**

New modules created (total 7 modules now):

- `portal-navigation.ts` (357 lines) - Navigation, views, sidebar, mobile menu
- `portal-projects.ts` (308 lines) - Project loading, display, preview
- `portal-auth.ts` (308 lines) - Login, logout, session management, helper functions
- `portal-files.ts` (397 lines) - File management + upload handlers
- `portal-invoices.ts` (208 lines) - Invoice management
- `portal-messages.ts` (207 lines) - Messaging
- `portal-settings.ts` (261 lines) - Settings forms

Main file reduced from 2,293 to 1,405 lines (~888 lines removed/extracted).

---

## TODOs

### Admin UI Polish (High Priority)

- [ ] **REDESIGN ALL PORTAL BUTTONS** - Full button redesign across admin and client portals
- [x] Leads Management - cards should filter table
- [x] Fix tooltip for truncated text - now uses fast CSS tooltips instead of native title delay
- [x] Mobile sidebar behavior - collapsed sidebar hides completely, content fills viewport
- [x] Admin portal mobile optimization - grids stack, reduced padding, horizontal stat cards
- [x] Custom dropdown for leads page panels - compact table dropdowns with red focus state, transparent bg
- [x] Add API endpoint for lead/intake status updates - PUT /api/admin/leads/:id/status
- [x] Info icons on Analytics pages Core Web Vitals - tooltip hovers explaining what each metric means
- [x] Unread message count badge on sidebar Messages button - red badge, right-aligned, only shows if unread > 0
- [x] Leads count badge on sidebar - combined count of new intake/contact submissions, red badge, right-aligned
- [x] Auto-add clients to messages dropdown - when new client added, they should appear in messages dropdown automatically
- [x] Intake form submission as project file - save intake form data as downloadable/previewable file in project files automatically

### Main Site Features (Medium Priority)

- [ ] **PROJECTS SECTION REDESIGN** - Sal Costa-style portfolio (see breakdown below)
- [ ] SEO optimization

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

### Implementation Order

1. Content first (screenshots, descriptions)
2. CSS components (can test with placeholder data)
3. HTML structure updates
4. JavaScript logic
5. Animation polish
6. Testing and refinement

### Code Quality (Ongoing)

- [x] Split `client-portal.ts` - Phase 1 complete (1,952 lines, 3 new modules)
- [x] **CSS !important cleanup** - 58 instances remain (all legitimate - accessibility, print, utilities)
- [x] Admin project editing - All fields working
- [x] Additional project tracking fields - Added notes, URLs, financial fields
- [x] Three-tier animation system - Desktop/Tablet/Mobile breakpoints aligned with CSS
- [x] Remove dead ScrollSnapModule code - 873 lines deleted

### CSS Cleanup Plan

**Problem:** Started with 650+ `!important` declarations indicating specificity wars.

**Progress:**

| File | Before | After | Status |
|------|--------|-------|--------|
| mobile/contact.css | 85 | 0 | DONE |
| mobile/layout.css | 61 | 3 | DONE |
| client-portal/sidebar.css | 47 | 0 | DONE |
| admin/project-detail.css | 45 | 0 | DONE |
| page-transitions.css | 44 | 2 | DONE (accessibility rules kept) |
| admin.css | 29 | 4 | DONE |
| terminal-intake.css | 41 | 0 | DONE |
| client.css | 32 | 0 | DONE |
| client-portal-section.css | 30 | 1 | DONE (reduced motion kept) |
| contact.css | 24 | 7 | DONE (autofill, high contrast, reduced motion kept) |
| business-card.css | 20 | 3 | DONE (reduced motion, print kept) |
| projects.css | 13 | 0 | DONE |
| nav-portal.css | 13 | 0 | DONE |
| reset.css | 10 | 10 | DONE (all accessibility/print - kept) |

**Architectural Solutions Implemented:**

1. CSS Cascade Layers - `@layer` in main.css controls cascade order
2. Scoped Styles - `[data-page="admin"]` prefix for admin-specific overrides
3. High-specificity selectors - `section[data-page].page-hidden` instead of !important
4. GSAP inline styles first - Apply before class changes for animation states
5. Page-states layer - Added `page-states` layer after `pages` for transition state overrides
6. Section prefixes - `section.client-portal-section`, `.contact-section` for component isolation
7. Parent context selectors - `.contact-section .contact-business-card .business-card-container` for nested overrides
8. Doubled class selectors - `.intake-modal.intake-modal` for modal override specificity
9. Element type prefixes - `section.page-hero-desktop`, `div.page-hero-desktop` for hidden elements

---

## Plan for Remaining Work

### Short Term

1. **Continue client-portal.ts split** - Extract more modules
2. **Admin UI polish** - Leads filtering, tooltips, mobile view

### Medium Term

3. **CSS !important cleanup** - COMPLETE (58 remaining, all legitimate)
4. **SEO optimization** - Meta tags, sitemap, structured data

---

## System Status

**Last Updated:** January 15, 2026

### Build Status

- **TypeScript:** 0 errors
- **ESLint:** 2 warnings (unused variables)
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
