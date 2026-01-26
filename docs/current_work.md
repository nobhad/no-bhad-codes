# Current Work

**Last Updated:** January 26, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## Known Concerns

### Analytics - Average Session Calculation Still Off

**Status:** FIXED - January 26, 2026

Average session duration was showing extremely high values (~27 hours) due to sessions with tabs left open accumulating time indefinitely.

**Root cause:**

- `totalTimeOnSite` accumulates as long as a session is active
- Users leaving browser tabs open for hours/days created outlier sessions
- AVG query included these outliers, skewing the average

**Fix applied:**

- Modified AVG query to exclude sessions > 1 hour (3,600,000 ms) as outliers
- Sessions longer than 1 hour are likely tabs left open, not active usage

**File modified:** `server/routes/analytics.ts` line 251

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

### Project Details Missing Original Intake File

**Status:** TODO
**Observed:** January 26, 2026

The Files section in project details is not showing the original intake form submission file. When a lead is activated into a project, the intake form data should be saved and visible as a downloadable/previewable file in the project's files.

**Expected behavior:**

- Intake form submission automatically saved as a file when lead is activated
- File appears in Project Details > Files section
- File should be downloadable/previewable

---

### Project Details Tabs Styling - Gap and Shadows

**Status:** FIXED - January 26, 2026

Tabs now properly connected to content with unified shadow and no gap.

**Root cause:**

- `admin.css` rule `.tab-content.active > * + *` was adding `margin-top` to all content divs

**Fixes applied:**

- Added `margin-top: 0` to `.pd-tab-content` to override the spacing rule
- Removed individual shadows from inactive tabs (content shadow provides elevation)
- Active tab extends into content with `margin-bottom: -1px`
- Overview content (`#pd-tab-overview.active`) has square top-left corner
- Other tab contents keep all rounded corners (correct - they're not in corner position)

**File modified:** `src/styles/admin/project-detail.css`

---

### Terminal Styling in Client Portal

**Status:** VERIFIED - January 26, 2026

Terminal intake in client portal displays correctly without overflow issues.

**Fix applied:**

- Portal-specific overrides in `terminal-intake.css`
- Width constraint (90%, max 900px) on `.terminal-intake`
- Reset `min-width: auto` on child elements

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

**Current State:** Code implementation COMPLETE. Portfolio displays WIP sign until you add screenshots to your projects. Once screenshots are added, the project cards will automatically appear.

**Target:** Interactive portfolio showcasing custom software projects with:

- Horizontal project cards with hover animations
- Project detail pages with hero images
- Metadata labels (role, tools, year)
- Drop-in/drop-out page transitions

### Phase 1-4: COMPLETE

All code implementation phases are complete. See archived work for details.

### Phase 4.5: CRT TV Preview Feature - ✅ COMPLETE (January 21, 2026)

**Feature:** Retro Panasonic CRT TV displays project title cards on hover (desktop only, 768px+)

**Pending:**

- [ ] **Create title card images** for each project (4:3 aspect ratio, Looney Tunes style)
  - Title cards go in `/public/projects/{project-id}-title.png`

### Phase 5: Assets - ⏳ PENDING (User Action Required)

- [x] **Create `/public/projects/` directory** - COMPLETE
- [x] **Create placeholder image** - COMPLETE (`/images/project-placeholder.svg`)
- [ ] **Create CRT TV title cards** - Looney Tunes style, 4:3 aspect ratio
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

---

## Future Plans

- [ ] **Kanban Board & Timeline View** - Visual management for projects
- [ ] **Eisenhower Matrix** - Priority management (urgent/important quadrants)

---

## System Status

**Last Updated:** January 26, 2026

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
