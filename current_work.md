# Current Work - January 14, 2026

---

## Recently Completed

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
| `client-portal.ts` | 1,952 | High | IN PROGRESS - 3 new modules extracted |
| `admin-dashboard.ts` | 1,917 | Medium | Already has 9 extracted modules |
| `intro-animation.ts` | 1,815 | Medium | Animation logic |
| `terminal-intake.ts` | 1,685 | Medium | Terminal UI logic |
| `page-transition.ts` | 580 | Low | Recently simplified |
| `admin-project-details.ts` | 1,250+ | Low | Recently extended with new fields |

**Client Portal Refactor Progress:**

New modules created (total 7 modules now):

- `portal-navigation.ts` (398 lines) - Navigation, views, sidebar, mobile menu
- `portal-projects.ts` (497 lines) - Project loading, display, preview
- `portal-auth.ts` (346 lines) - Login, logout, session management
- `portal-files.ts` (455 lines) - File management (existing)
- `portal-invoices.ts` (250 lines) - Invoice management (existing)
- `portal-messages.ts` (268 lines) - Messaging (existing)
- `portal-settings.ts` (261 lines) - Settings forms (existing)

Main file reduced from 2,293 to 1,952 lines (~340 lines extracted).

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

- [ ] SEO optimization

### Code Quality (Ongoing)

- [x] Split `client-portal.ts` - Phase 1 complete (1,952 lines, 3 new modules)
- [ ] **CSS !important cleanup** - 85 instances remain (down from 313)
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

3. **CSS !important cleanup** - 85 remaining across various files
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
