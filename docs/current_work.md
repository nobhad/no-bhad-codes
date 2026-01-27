# Current Work

**Last Updated:** January 27, 2026 (Proposal Builder Added)

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## Known Concerns

### Dialogue Box Shadows - Consistency
**Status:** ✅ COMPLETE
**Observed:** January 27, 2026

Dialogue boxes (modals, confirm dialogs) now use consistent shadow styling with `--shadow-modal` token throughout the application.

**Changes made:**
- Updated modal component to use `--shadow-modal`
- Updated admin modals to use `--shadow-modal` instead of `--shadow-panel`
- Updated confirm dialog to use `--shadow-modal`
- Updated button shadows in confirm dialog to use `--shadow-button-*` tokens

**Files modified:**
- `src/components/modal-component.ts`
- `src/styles/admin/modals.css`
- `src/styles/shared/confirm-dialog.css`

---

### Toast Notifications for Status Changes
**Status:** ✅ COMPLETE
**Observed:** January 27, 2026

Replaced excessive success dialogue boxes with non-intrusive toast notifications for status change confirmations.

**Changes made:**
- Created toast notification system (`src/utils/toast-notifications.ts`)
- Added toast CSS styles (`src/styles/shared/toast-notifications.css`)
- Updated admin dashboard to use toasts for success/info messages
- Updated client portal to use toasts instead of alert dialogs
- Error messages still use dialogs for important errors

**Files created:**
- `src/utils/toast-notifications.ts`
- `src/styles/shared/toast-notifications.css`

**Files modified:**
- `src/features/admin/admin-dashboard.ts`
- `src/features/client/client-portal.ts`
- `src/styles/bundles/shared.css` (added toast import)

---

### Badge Styling Improvements
**Status:** ✅ COMPLETE
**Observed:** January 27, 2026

Replaced full colored badge pills with minimal status dots in table dropdowns.

**Changes made:**
- Added colored status dots (8px circle) before status text
- Removed colored backgrounds and borders from dropdown triggers
- Removed "X New" badge from table headers (status visible via dots in rows)
- Table rows now have fixed 48px height to prevent dropdown height changes
- Dropdown hover background matches row hover (`rgba(255, 255, 255, 0.05)`)
- Details panel dropdowns have transparent borders

**Files modified:**
- `src/styles/pages/admin.css` - Status dot styling, fixed row heights
- `src/utils/table-dropdown.ts` - Added status dot element to trigger

---

### PDF Branding Logo - Proposal & Website Audit
**Status:** TODO
**Observed:** January 27, 2026

Need to make sure branding logo from invoice PDFs goes on top of:
- Project proposal PDFs
- Current website audit PDFs

**Note:** Proposal and website audit PDF generation routes need to be verified. If they don't exist, they may need to be created following the invoice PDF pattern.

**Reference:** Invoice PDF logo implementation in `server/routes/invoices.ts` (lines 925-930)
- Logo path: `public/images/avatar_small-1.png`
- Logo is centered at top of PDF with 60px width

---

### Project Details Missing Original Intake File

**Status:** IN PROGRESS
**Observed:** January 26, 2026
**Updated:** January 27, 2026

The Files section in project details is not showing the original intake form submission file. When a lead is activated into a project, the intake form data should be saved and visible as a downloadable/previewable file in the project's files.

**Investigation findings:**

- `saveIntakeAsFile()` function exists in `server/routes/intake.ts` (lines 28-97)
- Function is called after intake submission but errors are caught silently
- `uploads/intake/` directory was missing (now created)
- `files` table is empty - no intake files were ever saved
- API fixes made: column names corrected in `/api/uploads/project/:projectId`
- Admin access check added to file download endpoint

**Root cause:** The `saveIntakeAsFile()` function may have been failing due to missing directory or other silent errors. Existing projects have no intake files in database.

**Remaining work:**

- [ ] Test new intake submission to verify files are saved
- [ ] Consider backfilling intake files for existing projects from stored project data
- [ ] Add error logging to saveIntakeAsFile for better debugging

**Expected behavior:**

- Intake form submission automatically saved as a file when lead is activated
- File appears in Project Details > Files section
- File should be downloadable/previewable

---

### Contract PDF Generation with Branding

**Status:** TODO
**Observed:** January 27, 2026

Need to generate contract PDFs with the same branding header as invoice PDFs.

**Requirements:**

- Contract PDF should include logo at top (same as invoices)
- Follow invoice PDF pattern in `server/routes/invoices.ts`
- Logo path: `public/images/avatar_small-1.png`
- Logo centered at top with 60px width

**Reference:** Invoice PDF logo implementation in `server/routes/invoices.ts` (lines 925-930)

---

### Unable to Add New Client

**Status:** TODO
**Observed:** January 27, 2026

Unable to add new client in the admin dashboard. The "Add New Client" functionality is not working.

**Expected behavior:**

- Admin should be able to add new clients from the Clients section
- Form should validate required fields
- Client should be saved to database

**Files to investigate:**

- `src/features/admin/modules/admin-clients.ts` - Client management module
- `server/routes/clients.ts` - Client API endpoints

---

### Add New Client in Project Feature - Missing Fields

**Status:** TODO
**Observed:** January 27, 2026

When adding a new project, the "Add New Client" option doesn't work because name and email are required fields but no input fields are present to enter them.

**Issues:**

- Name and email are required for new clients
- No form fields visible to enter client name and email
- Validation fails because required fields are missing

**Expected behavior:**

- When selecting "Add New Client" in project creation, form fields should appear for:
  - Client name (required)
  - Client email (required)
  - Optional: Company name, phone, etc.
- Form should validate before allowing project creation

**Files to investigate:**

- `src/features/admin/modules/admin-projects.ts` - Project creation with client selection
- `src/features/admin/admin-project-details.ts` - Project details and client management

---

### Table Dropdown Styling Inconsistency

**Status:** ✅ COMPLETE
**Observed:** January 26, 2026

Table dropdowns now follow Messages dropdown pattern with consistent styling.

**Changes made:**

- Fixed row heights (48px) to prevent changes when dropdown opens/closes
- Consistent font sizing between trigger and menu items
- Border states: transparent (default), red on hover/focus/open
- Open state has transparent bottom border connecting seamlessly to menu
- Cleaned up CSS - removed all `!important` overrides, proper cascade order

**Files modified:**

- `src/styles/pages/admin.css` - Table dropdown and status dropdown styles

---

### Messages Dropdown - Double Selection Display

**Status:** TODO
**Observed:** January 26, 2026

The Messages dropdown shows the currently selected item twice - once in the trigger and again as the first item in the dropdown menu list.

**Expected behavior:**

- Current selection appears ONLY in the trigger
- Dropdown menu should show other available options (not the current selection)
- OR dropdown menu shows all options with current selection visually distinguished (not highlighted as if hovered)

**Files to modify:**

- `src/features/admin/modules/admin-messages.ts` - Dropdown rendering logic

---

### Project Details Tabs Styling - Seamless Shadow

**Status:** ✅ COMPLETE
**Observed:** January 26, 2026

Active tab + main content div appear as ONE seamless unit with continuous shadows.

**Changes made:**

- Consolidated CSS classes: removed `.pd-tab-btn` and `.pd-tab-content`
- HTML uses `class="active"` for active tabs, `id="pd-tab-*"` for content panels
- JS selectors updated from `.pd-tab-btn` to `.project-detail-tabs button`
- Active tab uses `::after` pseudo-element to cover junction seamlessly
- Shadow continuity achieved with matching right/left shadows

**Files modified:**

- `src/styles/admin/project-detail.css`
- `admin/index.html`
- `src/features/admin/modules/admin-projects.ts`
- `src/features/admin/admin-project-details.ts`

---

## Tiered Proposal Builder - PENDING TESTING

**Status:** IMPLEMENTED - Awaiting User Testing
**Implemented:** January 27, 2026

Post-intake tiered proposal builder with GOOD/BETTER/BEST tiers and mix & match capabilities.

### User Flow

1. User completes terminal intake form
2. Reviews summary and clicks "Continue to package selection"
3. Proposal builder appears with tier selection
4. User customizes features as add-ons
5. Selects optional maintenance plan
6. Reviews summary and submits

### Testing Checklist

- [ ] **Database Migration** - Run migration to create proposal tables
  - `proposal_requests` table created
  - `proposal_feature_selections` table created

- [ ] **Intake Flow Integration** - Complete intake and verify proposal builder appears
  - Terminal intake completes to review
  - "Continue to package selection" button works
  - Proposal builder renders after confirmation

- [ ] **Tier Selection (Step 1)** - Verify tier cards display correctly
  - Three tiers shown (Foundation/Professional/Premium or similar)
  - Recommended tier highlighted
  - Price ranges displayed
  - Features listed per tier
  - Selection updates visually

- [ ] **Feature Customization (Step 2)** - Verify add-ons work
  - Included features shown with checkmarks
  - Available add-ons shown with prices
  - Selecting add-on updates price
  - Price bar updates dynamically

- [ ] **Maintenance Options (Step 3)** - Verify maintenance cards
  - Four options (DIY, Essential, Standard, Premium)
  - Prices and features displayed
  - Selection works correctly

- [ ] **Summary & Submit (Step 4)** - Verify final review
  - Selected tier shown
  - All features listed
  - Add-ons with prices shown
  - Maintenance plan shown
  - Total price calculated
  - Notes textarea works
  - Submit creates proposal

- [ ] **Admin Proposals Panel** - Verify admin can manage proposals
  - Navigate to Proposals section in admin
  - Proposals list displays
  - Filter buttons work
  - Status dropdown updates status
  - View details panel works
  - Accept/Reject buttons work
  - Convert to Invoice works

### Files Created

**Types & Data:**

- `src/features/client/proposal-builder-types.ts`
- `src/features/client/proposal-builder-data.ts`

**Database:**

- `server/database/migrations/025_proposal_requests.sql`

**Backend:**

- `server/routes/proposals.ts`

**Frontend:**

- `src/features/client/proposal-builder.ts`
- `src/features/client/proposal-builder-ui.ts`
- `src/styles/pages/proposal-builder.css`

**Admin:**

- `src/features/admin/modules/admin-proposals.ts`

### Files Modified

- `server/app.ts` - Registered proposals router
- `server/routes/intake.ts` - Added proposal handling
- `src/features/client/terminal-intake.ts` - Integrated proposal builder
- `src/styles/bundles/site.css` - Added CSS import
- `src/features/admin/modules/index.ts` - Added module loader
- `src/features/admin/admin-dashboard.ts` - Added proposals section

---

## TODOs

### Admin UI Polish (High Priority)

- [x] **REDESIGN ALL PORTAL BUTTONS** - Full button redesign across admin and client portals (January 26, 2026)

### Main Site Features (LAST Priority)

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

**Last Updated:** January 27, 2026

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
