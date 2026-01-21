# Current Work

**Last Updated:** January 20, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## TODOs

### Architecture Concerns (High Priority)

- [ ] **ADMIN LOGIN AS MAIN SITE PAGE** - The admin login page should be a route on the main site (`#/admin-login`) rather than a separate `admin/index.html` page. This would:
  - Use the EXACT same header/footer/nav as the main site
  - Allow the main site navigation to work (Menu button opens nav menu)
  - Maintain consistent user experience
  - Simplify header/footer maintenance (single source of truth)
  - Current workaround: Copied header HTML to admin/index.html, but nav menu doesn't function

### Admin UI Polish (High Priority)

- [ ] **REDESIGN ALL PORTAL BUTTONS** - Full button redesign across admin and client portals
- [ ] **PORTAL VISUAL CONSISTENCY** - Align admin and client portal styling (see breakdown below)
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

---

## Portal Visual Consistency (Admin ↔ Client)

**Goal:** Make admin and client portals share consistent design language. Main site has its own creative aesthetic and does NOT need to match portals.

### Current Issues

| Element | Client Portal | Admin Portal | Problem |
|---------|--------------|--------------|---------|
| Login Input | 12px radius, 60px height | 30px pill, 40-48px height | Different shapes |
| Login Button | 6px radius | 30px pill | Different shapes |
| Form Inputs | Black bg, portal tokens | Different padding/border | Mismatch |
| Footer Year | Hardcoded 2025 | Dynamic | Inconsistent |

### Phase 1: Admin Auth Styling

**File:** `src/styles/admin/auth.css`

- [x] Update `.auth-gate .password-input-wrapper input` to use portal tokens
- [x] Update `.auth-submit` to match portal button style
- [x] Ensure consistent height (60px) and border-radius (12px)

### Phase 2: Unified Portal Button Tokens

**File:** `src/design-system/tokens/buttons.css` (created)

- [x] Create shared button tokens for portals:
  - `--btn-portal-radius`, `--btn-portal-padding`, `--btn-portal-font-weight`
  - Primary, secondary, danger variants
  - Small and icon button variants
- [ ] Update portal components to use new tokens (optional - tokens are available for use)

### Phase 3: Minor Fixes

- [x] Fix hardcoded copyright year in `client/portal.html` and `client/intake.html`
- [x] Standardize mobile breakpoints - added `--compact-mobile` custom media query
- [ ] Audit status badge consistency between portals

---

## System Status

**Last Updated:** January 20, 2026

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

- January 2026: [ARCHIVED_WORK_2026-01.md](./archive/ARCHIVED_WORK_2026-01.md)
- December 2025: [ARCHIVED_WORK_2025-12.md](./archive/ARCHIVED_WORK_2025-12.md)
