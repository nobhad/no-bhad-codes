# Current Work

**Last Updated:** January 28, 2026 (Proposal PDF Generation Added)

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## Known Concerns

### PDFs & Documents

- [ ] #### PDF Branding Logo - Proposal & Website Audit
**Status:** PARTIAL - Proposal PDF Complete, Audit PDF TODO
**Observed:** January 27, 2026
**Updated:** January 28, 2026

Need to make sure branding logo from invoice PDFs goes on top of:
- [x] Project proposal PDFs - COMPLETE
- [ ] Current website audit PDFs - TODO

**Proposal PDF Implementation (January 28, 2026):**

Added `GET /api/proposals/:id/pdf` endpoint to `server/routes/proposals.ts` that generates branded PDF proposals with:
- Logo at top (centered, 60px width)
- Business header line (name, contact, email, website)
- Proposal title
- Prepared For / Prepared By sections
- Project details (name, description, type)
- Selected package tier with base price
- Included features list
- Add-ons with prices
- Maintenance plan (if selected)
- Pricing summary table with total
- Client notes (if any)
- Footer with validity notice

**Reference:** Invoice PDF logo implementation in `server/routes/invoices.ts` (lines 925-930)
- Logo path: `public/images/avatar_pdf.png`
- Logo is centered at top of PDF with 60px width

**Deep Dive Investigation (January 28, 2026):**

- **Website Audit PDF:** No website audit PDF generation route found in codebase. Searched for "website audit", "audit pdf", "audit website" - no matches found in `server/` directory.
- **Conclusion:** Website audit PDF feature does not exist yet. This is a new feature to be implemented, not an existing feature missing branding.

- [ ] #### Contract PDF Generation with Branding

**Status:** TODO
**Observed:** January 27, 2026

Need to generate contract PDFs with the same branding header as invoice PDFs.

**Requirements:**

- Contract PDF should include logo at top (same as invoices)
- Follow invoice PDF pattern in `server/routes/invoices.ts`
- Logo path: `public/images/avatar_pdf.png`
- Logo centered at top with 60px width

**Reference:** Invoice PDF logo implementation in `server/routes/invoices.ts` (lines 925-930)

**Deep Dive Investigation (January 28, 2026):**

- **Contract PDF Route:** Found at `server/routes/projects.ts` lines 1227-1477 - `GET /api/projects/:id/contract/pdf`
- **Current Logo Implementation:** Line 1286 uses `avatar_small-1.png` instead of `avatar_pdf.png`
  ```typescript
  const logoPath = join(process.cwd(), 'public/images/avatar_small-1.png');
  ```
- **Logo Position:** Logo is already implemented (line 1288) - centered at top with 60px width, matching invoice pattern
- **Root Cause:** Logo path is incorrect - should be `avatar_pdf.png` not `avatar_small-1.png`
- **Fix Required:** Update line 1286 to use `avatar_pdf.png` path

---

### Project Details

- [ ] #### Project Details Missing Original Intake File

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

**Deep Dive Investigation (January 28, 2026):**

- **Function Location:** `saveIntakeAsFile()` exists in `server/routes/intake.ts` lines 28-97
- **Function Call:** Called at line 331 after intake submission: `await saveIntakeAsFile(intakeData, projectId, projectName);`
- **Error Handling:** Function is wrapped in try-catch that silently catches errors (line 331-333 area)
- **File Creation:** Function creates JSON file with intake data and inserts into `files` table
- **File Path:** Uses `getUploadsSubdir(UPLOAD_DIRS.INTAKE)` and `getRelativePath()` for path construction
- **Database Insert:** Inserts into `files` table with `file_type='document'`, `description='Original project intake form submission'`
- **Potential Issues:**
  1. Silent error catching may hide failures
  2. Directory may not exist (though code creates it)
  3. Database transaction may rollback if file write fails
  4. No verification that file was actually saved
- **Testing Needed:** Verify new intake submissions create files and appear in project details

- [ ] #### Project Details & Edit - Layout and Consistency

**Status:** TODO
**Observed:** January 28, 2026

Project details view and edit features need to align and be organized logically.

**Issues:**

- Project details section and edit UI don't match (fields/layout inconsistent between view and edit).
- Section needs to be organized logically (grouping, order, which fields are editable where).

**Expected behavior:**

- View and edit should show the same fields in a consistent order.
- Layout should be logical (e.g. overview vs details vs files).

**Files to investigate:**

- `src/features/admin/admin-project-details.ts` - Project details panel
- `src/features/admin/modules/admin-projects.ts` - Project edit modal / forms
- Admin project details HTML/templates

**Deep Dive Investigation (January 28, 2026):**

- **Project Details View:** `src/features/admin/admin-project-details.ts` - `populateProjectDetailView()` method (line 280) displays project data
- **Edit Modal:** `src/features/admin/modules/admin-projects.ts` - `openEditProjectModal()` (line 660) populates edit form
- **Field Mapping Issues Found:**
  1. **Edit Form Fields:** Lines 669-684 populate: name, budget, price, timeline, preview_url, start_date, end_date
  2. **Details View Fields:** `admin-project-details.ts` lines 280-400 display: name, client, status, type, budget, timeline, dates, description, preview_url, repo_url, production_url, deposit, contract_date, admin_notes
  3. **Mismatch:** Edit form missing: description, project_type, repo_url, production_url, deposit, contract_date, admin_notes
  4. **Details view missing from edit:** Several fields shown in details are not editable
- **Layout Structure:** Details view uses tabs (Overview, Messages, Files, Milestones, Invoices) - edit modal is separate
- **Root Cause:** Edit modal and details view are not synchronized - edit form doesn't include all fields shown in details view

- [ ] #### Project Details Save - Overview Not Updating

**Status:** TODO
**Observed:** January 28, 2026

After saving project details, a toast success message says the project details were saved, but the changes are not reflected in the project overview (panel/view still shows old data).

**Issues:**

- Save appears to succeed (toast shown).
- Project overview does not refresh or re-fetch after save, so edited values don’t appear until page/tab is reloaded or re-opened.

**Expected behavior:**

- On successful save, project overview (and any other visible project-detail views) should update with the new data (e.g. re-fetch project or update local state from save response).

**Files to investigate:**

- `src/features/admin/modules/admin-projects.ts` - Save handler and any post-save refresh of project details/overview.
- `src/features/admin/admin-project-details.ts` - How overview is populated and whether it’s refreshed after edit save.

---

### Project Files

- [ ] #### File Upload Success - Files Section Not Updating

**Status:** TODO
**Observed:** January 28, 2026

After uploading files, a toast success message says the upload succeeded, but the Files section does not update (new files don’t appear until the page/tab is reloaded or re-opened).

**Issues:**

- Upload appears to succeed (toast shown).
- Files section does not refresh or re-fetch after upload, so the new files don’t appear in the list.

**Expected behavior:**

- On successful upload, the Files section should refresh (e.g. re-fetch project files or append the new files from the upload response) so the new files appear immediately.

**Files to investigate:**

- `src/features/admin/modules/admin-projects.ts` - File upload handler and any post-upload refresh of the Files section (e.g. `renderProjectFiles`, `loadProjectDetails`).
- `src/features/admin/admin-project-details.ts` - How the Files section is populated and whether it’s refreshed after upload.

---

- [ ] #### Project Files Download/Preview Not Working

**Status:** TODO (not fixed)
**Observed:** January 28, 2026
**Updated:** User reports still not working despite previous fixes

Project file download and preview are still not working. Previous fixes (file_path, size alias, Preview button) were applied but issues remain.

**Issues (still occurring):**

- Preview fails: request goes to `/uploads/projects/...` and returns 404 ("Route not found" / "Cannot GET /uploads/projects/..."). Preview should use the file API (e.g. `/api/uploads/file/:fileId`) instead of a direct path.
- Download may still fail or file may not be available.
- "0 B" size and wrong URLs were addressed in code but behavior may still be broken (wrong URL construction, or API not serving files correctly).

**Previous fixes applied (insufficient):**

- Added `file_path` to `/api/projects/:id/files` endpoint
- Added `size` alias in API response
- Added Preview button and JSON preview modal
- Download URL was updated to use `file_path`—verify it uses API route, not direct `/uploads/` path

**Expected behavior:**

- Preview and download should load the file via the correct API endpoint (authenticated). Files should resolve from database and be served by the uploads API.
- File list should show correct sizes and working Preview/Download buttons.

**Files to investigate:**

- `src/features/admin/modules/admin-projects.ts` - Preview/download URL construction (e.g. around line 1031 for preview error)
- `server/routes/uploads.ts` - File download/preview route
- `server/app.ts` - Static vs API routes for uploads

**Deep Dive Investigation (January 28, 2026):**

- **File URL Construction:** `renderProjectFiles()` line 989-990: `const filePath = file.file_path || `uploads/projects/${file.filename}`; const downloadUrl = `/${filePath}`;`
- **Preview Handler:** `openFilePreview()` line 1029: `fetch(filePath)` - uses direct path, not API endpoint
- **Error Location:** Line 1031 throws error when fetch fails with 404
- **Static Route:** `server/app.ts` line 117: `app.use('/uploads', express.static(resolve(__dirname, '../uploads')));`
- **API Route:** `server/routes/uploads.ts` has file download route but need to check exact path
- **Issue:** Preview uses `/${filePath}` which becomes `/uploads/projects/...` - this should work with static route, but 404 suggests:
  1. File doesn't exist at that path
  2. Static route not serving correctly
  3. File path in database is incorrect
- **API Endpoint:** Need to check if `/api/uploads/file/:fileId` exists for authenticated file access
- **Root Cause:** Preview uses direct file path instead of API endpoint. Should use authenticated API route like `/api/uploads/file/:fileId` or `/api/uploads/project/:projectId/file/:fileId` to ensure proper access control and path resolution.

---

- [ ] #### Files Preview and Download Buttons - Styling

**Status:** TODO
**Observed:** January 28, 2026

Preview and Download buttons in the project Files section do not match the rest of the admin/portal button styling.

**Expected behavior:**

- Buttons should use the same styles as other portal buttons (e.g. action buttons, table controls)
- Consistent padding, border-radius, font, and hover/focus states

**Files to modify:**

- `src/features/admin/modules/admin-projects.ts` - Where file action buttons are rendered
- `src/styles/pages/admin.css` or `src/styles/shared/portal-buttons.css` - Button styles for file actions

**Deep Dive Investigation (January 28, 2026):**

- **Button Rendering:** `renderProjectFiles()` line 1000-1001 creates buttons:
  - Preview button: `<button class="action-btn preview-btn" ...>Preview</button>`
  - Download link: `<a href="${downloadUrl}" class="action-btn" download="...">Download</a>`
- **CSS Classes:** Both use `action-btn` class
- **Styling Location:** Need to check if `action-btn` is defined in admin CSS or shared CSS
- **Other Buttons:** Need to compare with other portal buttons (e.g., table action buttons, modal buttons) to see styling differences
- **Root Cause:** Buttons use `action-btn` class but may not match styling of other portal buttons. Need to verify CSS and ensure consistent styling.

---

- [ ] #### Files Not Found (404) on Preview

**Status:** TODO
**Observed:** January 28, 2026

Preview fails with "Failed to load file" and console shows 404 when loading project files.

**Console/network details:**

- Request: `GET /uploads/projects/admin_project_7_Hedgewitch_Horticulture___Business_Website_1769621531581.json`
- Response: 404, `{"error":"Route not found","message":"Cannot GET /uploads/projects/..."}`
- Preview error thrown at `admin-projects.ts:1031`

**Likely cause:**

- Preview may be using a direct file path (`/uploads/projects/...`) instead of the file API (e.g. `/api/uploads/file/:fileId` or equivalent).
- Static serving of `uploads/` may not be mounted at `/uploads`, or route takes precedence.

**Expected behavior:**

- Preview should load the file via the correct API endpoint (authenticated) so the file is resolved from database and served.
- Download should use the same pattern so both work for project files.

**Files to investigate:**

- `src/features/admin/modules/admin-projects.ts` - Preview URL construction (around line 1031)
- `server/routes/uploads.ts` - File download/preview route
- `server/app.ts` - Static routes vs API routes for uploads

**Deep Dive Investigation (January 28, 2026):**

- **Preview URL:** `openFilePreview()` line 1029 uses `fetch(filePath)` where `filePath` comes from button's `data-file-path` attribute
- **URL Construction:** Line 990: `const downloadUrl = `/${filePath}`;` where `filePath = file.file_path || `uploads/projects/${file.filename}``
- **404 Error:** Request goes to `/uploads/projects/...` and returns 404 "Route not found"
- **Static Route:** `server/app.ts` line 117 mounts static files at `/uploads` from `../uploads` directory
- **Issue:** Static route should serve files, but 404 suggests:
  1. File path in database (`file_path`) may be incorrect
  2. File doesn't exist at expected location
  3. Static route path resolution issue
- **API Alternative:** Should use API endpoint like `/api/uploads/file/:fileId` which:
  - Authenticates request
  - Resolves file path from database
  - Serves file securely
- **Root Cause:** Same as "Project Files Download/Preview Not Working" - using direct file paths instead of API endpoints. Need to implement proper file serving API route.

---

### Admin UI

- [x] #### Project Details Tabs Styling - Seamless Shadow

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
