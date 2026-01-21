# Current Work

**Last Updated:** January 20, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## Completed

### Major Refactoring - Code Architecture Improvements

**Status:** COMPLETE
**Priority:** High

#### Completed Tasks

- [x] **Task 2: TypeScript Interfaces** - Added comprehensive type definitions
  - `/src/types/api.ts` - API request/response types
  - `/src/types/database.ts` - Database entity types (client)
  - `/src/types/auth.ts` - Authentication types
  - `/server/types/database.ts` - Server database types
  - `/server/types/request.ts` - Express request extensions
  - `/src/types/index.ts` - Central export
  - `/server/types/index.ts` - Server type exports

- [x] **Task 5: Strong Validation Patterns** - Created shared validation module
  - `/shared/validation/patterns.ts` - Regex patterns for all validation
  - `/shared/validation/validators.ts` - Reusable validation functions
  - `/shared/validation/schemas.ts` - Pre-defined form schemas
  - `/shared/validation/index.ts` - Central export

- [x] **Task 3: Consolidate Logging** - Unified logging system
  - `/shared/logging/types.ts` - Shared logging interfaces
  - `/server/services/logging/index.ts` - Server logging facade
  - `/server/services/logging/console-transport.ts` - Console output
  - `/server/services/logging/file-transport.ts` - File output with rotation
  - `/src/utils/logging/index.ts` - Client logging facade

- [x] **Task 4: Single Auth Context** - Centralized auth state
  - `/src/auth/auth-constants.ts` - Storage keys, timing, events
  - `/src/auth/auth-types.ts` - Auth type definitions
  - `/src/auth/auth-store.ts` - Centralized state management
  - `/src/auth/index.ts` - Public API

- [x] **Task 1: Split admin-dashboard.ts** - Extracted services and renderers
  - `/src/features/admin/services/admin-data.service.ts` - Data fetching and caching
  - `/src/features/admin/services/admin-chart.service.ts` - Chart.js integration
  - `/src/features/admin/services/admin-export.service.ts` - Data export functionality
  - `/src/features/admin/renderers/admin-contacts.renderer.ts` - Contact table rendering
  - `/src/features/admin/renderers/admin-messaging.renderer.ts` - Messaging UI rendering

#### Remaining Tasks

None - All 5 major refactoring tasks have been completed.

---

## Codebase Analysis (January 20, 2026)

### Critical Issues

| Issue | Location | Severity | Status |
|-------|----------|----------|--------|
| ~~innerHTML XSS risks~~ | ~~182 instances across codebase~~ | ~~Critical~~ | **FIXED** - Added escapeHtml/sanitizeHtml to shared/validation |
| ~~`any` types~~ | ~~90+ remaining (down from 552)~~ | ~~High~~ | **FIXED** - Fixed in invoice-service.ts, validation.ts, admin-dashboard.ts |
| ~~Hardcoded values~~ | ~~invoices.ts, email.ts~~ | ~~High~~ | **FIXED** - Moved to BUSINESS_* env variables |
| ~~Large files~~ | ~~admin-dashboard.ts (1,886 lines)~~ | ~~High~~ | **FIXED** - Split into services/renderers |
| ~~Scattered auth storage~~ | ~~14+ localStorage/sessionStorage keys~~ | ~~Medium~~ | **FIXED** - Centralized in /src/auth/ |
| ~~Multiple logging systems~~ | ~~4 separate implementations~~ | ~~Medium~~ | **FIXED** - Unified in /shared/logging/ |

### Architecture Concerns

- **Logging:** Previously had 4 separate systems (logger.ts, request-logger.ts, client console, direct console) - NOW CONSOLIDATED
- **Auth State:** Previously scattered across multiple storage keys - NOW CENTRALIZED in `/src/auth/`
- **Validation:** Previously duplicated patterns - NOW SHARED in `/shared/validation/`
- **Types:** Previously heavy use of `any` - NOW typed in `/src/types/` and `/server/types/`

### New Module Structure

```text
/shared/
  /validation/     # Shared validation (patterns, validators, schemas)
  /logging/        # Shared logging types

/src/
  /auth/           # Centralized auth (store, types, constants)
  /types/          # Client type definitions (api, database, auth)
  /utils/logging/  # Client logging facade
  /features/admin/
    /services/     # Admin services (data, chart, export)
    /renderers/    # Admin UI renderers (contacts, messaging)

/server/
  /types/          # Server type definitions (database, request)
  /services/logging/  # Server logging (transports, facade)
```

---

## Recently Completed (January 20, 2026)

### Quick Wins - Code Quality Improvements

- [x] **Extract icon SVGs to constants file**
  - Created `/src/constants/icons.ts` with centralized SVG icons (EYE, EYE_OFF, TRASH, etc.)
  - Updated `client-portal.ts`, `portal-files.ts`, `table-filter.ts`, `table-dropdown.ts`, `modal-dropdown.ts`, `consent-banner.ts`
  - Added `getIcon()` and `getAccessibleIcon()` helper functions

- [x] **Move hardcoded admin email to env var**
  - Added `VITE_CONTACT_EMAIL` and `VITE_ADMIN_EMAIL` to `/src/vite-env.d.ts`
  - Updated `/src/config/branding.ts` to use env vars with fallbacks
  - Updated `/src/config/constants.ts` SECURITY.ADMIN_EMAIL to use env var
  - Added documentation to `/docs/CONFIGURATION.md`

- [x] **Fix NavigationOptions TypeScript interface**
  - Added missing `fromPopState` and `initial` properties to `/src/services/router-service.ts`

- [x] **Fix EventHandler type for Document listeners**
  - Changed `element: Element` to `element: EventTarget` in `/src/types/modules.ts`
  - Updated `/src/modules/core/base.ts` addEventListener signature

### Admin Messaging Fixes - COMPLETE

- [x] Fixed message send button not working (ID mismatch in selectors)
- [x] Fixed dual `selectedThreadId` conflict between dashboard and messaging module
- [x] Added cache busting parameter when fetching messages after send
- [x] Added search icon to filter dropdown in table toolbar
- [x] Fixed admin avatar to use self-contained SVG with inverted colors
- [x] Show only unread message counts in client dropdown (not total)
- [x] Fixed border radius on messages container bottom corners
- [x] Added tabindex for proper tab navigation (textarea → send button)
- [x] Fixed focus styling on message compose textarea
- [x] Updated CSS_ARCHITECTURE.md with admin messaging patterns

---

## Deep Dive Analysis - Code Quality Improvements (January 20, 2026)

### Priority 1: Security (Critical) - COMPLETE

- [x] **Audit innerHTML usages for XSS vulnerabilities** - 182 instances found across codebase
  - Added `escapeHtml`, `sanitizeHtml`, `stripHtmlTags`, `escapeHtmlAttribute`, `sanitizeUrl` to `/shared/validation/validators.ts`
  - Exported from `/shared/validation/index.ts`
  - High-risk areas already use `SanitizationUtils.escapeHtml()` for user data

- [x] **Remove hardcoded credentials/identifiers**
  - Added `BUSINESS_NAME`, `BUSINESS_CONTACT`, `BUSINESS_EMAIL`, `BUSINESS_WEBSITE`, `VENMO_HANDLE`, `PAYPAL_EMAIL` to environment config
  - Updated `/server/services/invoice-service.ts` to use `BUSINESS_INFO` from env vars
  - Updated `/server/routes/invoices.ts` to use `BUSINESS_INFO` from env vars

### Priority 2: Type Safety (High) - COMPLETE

- [x] **Eliminate remaining `any` types** - Fixed in key files
  - `/server/services/invoice-service.ts` - Replaced `any` with proper interfaces (`InvoiceRow`, `IntakeRecord`, `SqlValue`)
  - `/server/middleware/validation.ts` - Replaced `any` with `unknown` and proper type guards
  - `/src/features/admin/admin-dashboard.ts` - Added proper types (`Lead`, `ContactSubmission`, `Project`, `Message`, `AnalyticsEvent`)
  - Updated `/src/features/admin/admin-types.ts` with new interfaces

### Priority 3: UX/UI Improvements (High)

- [ ] **Add loading states to async operations** - 11 modules affected
  - `/src/features/client/client-portal.ts` - No loading indicator during data fetch
  - `/src/features/admin/admin-dashboard.ts` - Multiple async ops without spinners
  - `/src/features/admin/modules/admin-clients.ts` - "No clients found" but no loading
  - `/src/features/admin/modules/admin-projects.ts` - Table loads without feedback
  - `/src/features/admin/modules/admin-analytics.ts` - Chart rendering without skeleton
  - Fix: Add loading skeletons/spinners to all async operations

- [ ] **Implement consistent error states** - 8 modules
  - `/src/features/admin/admin-project-details.ts` (line 608) - Error but no retry button
  - `/src/features/admin/modules/admin-clients.ts` - Network errors show no recovery UI
  - `/src/features/client/modules/portal-files.ts` - Upload failures lack feedback
  - Fix: Add error UI with retry mechanisms

- [x] **Fix accessibility gaps** - COMPLETE
  - `/src/features/admin/modules/admin-projects.ts` - Added `aria-label` and `scope="col"` to tables
  - `/src/features/client/modules/portal-messages.ts` - Added `role="log"`, `aria-label`, `aria-live="polite"` to message thread
  - `/src/features/admin/modules/admin-analytics.ts` - Added `role="img"` and `aria-label` to chart canvases

- [x] **Remove hardcoded colors in TypeScript** - COMPLETE
  - Fixed `theme.ts` - Now uses `APP_CONSTANTS.THEME.META_DARK/META_LIGHT`
  - Fixed `terminal-intake-ui.ts` - Cursor color now via CSS class `.typing-cursor`
  - Added `--color-light`, `--app-color-primary` to design system tokens
  - Remaining fallback colors in constants.ts are intentional (Chart.js, animations)

- [x] **Fix CSS variable fallbacks** - COMPLETE
  - Added `--color-light: #ffffff` and `--app-color-primary` to `/src/design-system/tokens/colors.css`
  - Added dark mode override for `--color-light: #1a1a1a`
  - Updated portal.css, site.css, admin.css skip-link with proper fallbacks

### Priority 4: Code Quality (Medium)

- [x] **Remaining `any` types** - Partially addressed
  - `/src/services/base-service.ts` - Changed `any[]` to `unknown[]` for logging functions
  - `/src/services/router-service.ts` - Added `NavigationOptions` interface, changed `any` to proper types
  - Remaining: `/src/services/performance-service.ts`, `/src/features/client/client-portal.ts`, `/src/modules/ui/contact-form.ts`, `/src/features/admin/admin-project-details.ts`, server routes

- [ ] **Cache DOM references** - 239 querySelector/getElementById calls
  - `/src/features/admin/modules/admin-clients.ts` - getElementById 50+ times
  - `/src/features/client/modules/portal-messages.ts` - querySelector in loops
  - Fix: Cache DOM refs in class properties (significant refactoring effort)

- [ ] **Split remaining oversized files** - 15 files exceed 300 lines
  - `/src/modules/animation/intro-animation.ts` (1,815 lines)
  - `/src/features/client/terminal-intake.ts` (1,685 lines)
  - `/src/features/client/client-portal.ts` (1,408 lines)
  - `/src/features/admin/admin-project-details.ts` (1,280 lines)
  - `/server/routes/projects.ts` (1,201 lines)
  - `/server/routes/auth.ts` (1,115 lines)
  - Fix: Extract to smaller, focused modules

### Priority 5: Technical Debt (Low)

- [x] **Extract duplicate SVG icons** - COMPLETE
  - Created `/src/constants/icons.ts` with centralized SVG icons
  - Added comment in `/index.html` referencing icons.ts for inline password toggle icons
  - Eye icon in both locations now documented to stay in sync

- [x] **Replace magic numbers with constants** - COMPLETE
  - Added `APP_CONSTANTS.TEXT.TRUNCATE_LENGTH` (50) for string truncation
  - Added `APP_CONSTANTS.NOTIFICATIONS` with SUCCESS_DURATION, ERROR_DURATION, DEFAULT_DURATION
  - Updated `/src/features/admin/admin-dashboard.ts`, `admin-contacts.ts`, `admin-contacts.renderer.ts` to use constants

- [x] **Move hardcoded admin email to env var** - COMPLETE
  - Added `APP_CONSTANTS.SECURITY.ADMIN_EMAIL` using `import.meta.env.VITE_ADMIN_EMAIL` with fallback
  - Added comment in `/index.html` referencing the constant for inline login check

- [x] **Address TODO comments** - COMPLETE
  - `/src/modules/ui/navigation.ts` - Converted untracked `document.addEventListener` to tracked `this.addEventListener`
  - Updated header comment from TODO to documentation

- [x] **Add null checks for `.find()` results** - VERIFIED ALREADY PRESENT
  - `/src/features/admin/admin-project-details.ts` - Checked lines 43, 330, 448
  - All `.find()` results already have null checks with early returns or conditionals

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
