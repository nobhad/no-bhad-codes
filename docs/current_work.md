# Current Work

**Last Updated:** January 28, 2026 (UX Utilities Integration + Bug Fixes)

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## Pending Verification

Recent fixes that need user testing:

- [ ] **Contract PDF Generation** - Test `GET /api/projects/:id/contract/pdf`
  - Navigate to a project with contract data
  - Download contract PDF and verify branding/content

- [ ] **File Upload - Files Appear After Upload**
  - Go to project details > Files tab
  - Upload a file
  - Verify file appears immediately (no page refresh needed)

- [ ] **File Preview** - Test preview for different file types
  - JSON files: Should open in modal with formatted JSON
  - Text/MD files: Should open in modal with text content
  - Images: Should open in modal with image display
  - PDFs: Should open in new tab

- [ ] **File Download** - Test download button
  - Click Download on any project file
  - File should download with correct filename

- [ ] **Edit Project Modal - All Fields** - Test editing all project fields
  - Open a project > Click Edit (pencil icon)
  - Verify all fields are populated: name, type, status, timeline, dates, description, budget, price, deposit, contract date, URLs, admin notes
  - Modify values and save
  - Verify changes appear in project overview immediately

- [ ] **Client Budget Display** - Verify budget ranges show proper formatting
  - Navigate to project details in admin
  - Verify budget shows "Under $2k" (not "Under 2k")
  - Verify ranges show en-dashes: "$2k–$5k" (not "$2k-$5k")
  - Verify decimal budgets display correctly: "$2.5k–$5k" (not "2.5k 5k")

- [ ] **Target End Date Display** - Verify dates show correctly (no timezone offset)
  - Set a target end date (e.g., March 1)
  - Save and verify it displays as March 1 (not February 28)

- [ ] **HTML Entity Decoding** - Verify special characters display correctly
  - Check client names with "&" show correctly (not "&amp;")
  - Check URLs with "/" show correctly (not "&#x2F;")

- [ ] **URL Links Styling** - Verify URL links are red and clickable
  - Check Preview URL, Repository URL, Production URL links
  - Links should be red (primary color)
  - Links should open in new tab

- [ ] **Empty Values Display** - Verify missing data shows empty (no dashes)
  - View a project with some fields unpopulated
  - Empty fields should show blank, not "-"

- [ ] **Client Portal Profile Settings** - Test profile update refresh
  - Update contact name, company, or phone in client portal settings
  - Save and verify values refresh immediately (no page reload needed)

- [ ] **Admin Proposals Notes Save** - Test notes refresh after save
  - Open a proposal in admin panel
  - Add or modify admin notes
  - Save and verify notes display updates immediately

- [ ] **Client Portal Project Request** - Test project list refresh
  - Submit a new project request in client portal
  - Verify new project appears in dashboard immediately (no page reload needed)

- [ ] **Account Activation Welcome Flow** - Test welcome email + portal message
  - Invite a new client (or use existing pending invitation)
  - Click invitation link and set password
  - Verify:
    - [ ] Welcome email received with "Add Billing Info" CTA
    - [ ] System message appears in portal inbox ("Welcome to Your Client Portal!")
    - [ ] Message contains instructions to add billing info in Settings
  - Check audit log for `account_activated` event

- [ ] **Client Invitation UX** - Test create client without inviting, then invite later
  - Create a new client in admin (without checking "Send invitation email")
  - Verify client appears in table with:
    - [ ] "Not Invited" status badge (gray/muted)
    - [ ] Inline "Invite" button next to status
  - Click the "Invite" button
  - Verify:
    - [ ] Invitation email is sent
    - [ ] Status updates to "Invited" (yellow/pending)
    - [ ] "Invite" button disappears
  - Files modified: `server/routes/clients.ts`, `src/features/admin/modules/admin-clients.ts`, `src/styles/pages/admin.css`

---

## Known Concerns

### PDFs & Documents

- [ ] #### PDF Branding Logo - Proposal & Website Audit
**Status:** PARTIAL - Proposal PDF Complete, Audit PDF TODO
**Observed:** January 27, 2026
**Updated:** January 28, 2026

Need to make sure branding logo from invoice PDFs goes on top of:
- [x] Project proposal PDFs - COMPLETE
- [x] Project contract PDFs - COMPLETE (January 28, 2026)
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

**Contract PDF Implementation (January 28, 2026):**

Added `GET /api/projects/:id/contract/pdf` endpoint to `server/routes/projects.ts` that generates branded PDF contracts with:
- Logo at top (centered, 60px width)
- Business header line (name, contact, email, website)
- Contract title
- Client info / Service provider sections
- Project scope (name, type, description, features)
- Timeline (start date, target completion, estimated timeline)
- Payment terms (total cost, deposit amount)
- Terms and conditions (5 standard clauses)
- Signature areas for client and service provider
- Footer with contact info

**Reference:** Invoice PDF logo implementation in `server/routes/invoices.ts` (lines 925-930)
- Logo path: `public/images/avatar_pdf.png`
- Logo is centered at top of PDF with 60px width

**Deep Dive Investigation (January 28, 2026):**

- **Save Handler:** `saveProjectChanges()` in `src/features/admin/modules/admin-projects.ts` lines 771-815
- **Save Flow:** 
  1. Collects form values (lines 774-794)
  2. Calls `apiPut('/api/projects/${projectId}', updates)` (line 797)
  3. On success: Shows toast notification (line 800)
  4. Calls `loadProjects()` to reload projects list (line 802)
  5. Finds updated project and calls `populateProjectDetailView(project)` (lines 803-806)
- **Issue:** `populateProjectDetailView()` is called with project from `projectsData` array, but this array is populated by `loadProjects()` which may not have the latest data yet
- **API Response:** Update endpoint (`server/routes/projects.ts` line 437) returns `updatedProject` but save handler doesn't use it
- **Details View Module:** `admin-project-details.ts` has its own `populateProjectDetailView()` method (line 280) but it's not called after save
- **Root Cause:** Save handler calls `populateProjectDetailView()` from `admin-projects.ts` module, but if the details view is open via `admin-project-details.ts` module, that view isn't refreshed. The save handler should either:
  1. Use the updated project from API response instead of re-fetching
  2. Call the details view module's refresh method if it exists
  3. Trigger a custom event that both modules listen to

- [x] #### Project Description - Weird Line Breaks

**Status:** FIXED (via Description Line Breaks fix)
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

This was fixed as part of the "Description Field - Line Breaks Not Rendering" fix:

- Added `formatTextWithLineBreaks()` utility to `src/utils/format-utils.ts`
- Updated `admin-project-details.ts` to use `innerHTML` with `formatTextWithLineBreaks()`
- Newlines (`\n`) are now converted to `<br>` tags with proper HTML escaping

- [x] #### Admin Notes - Save, Edit, and Visibility

**Status:** FIXED (edit form now populates and saves admin notes)
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/features/admin/modules/admin-projects.ts`:

1. Added `notesInput` to `openEditProjectModal()` to populate admin notes field with existing value
2. Added `admin_notes` to `saveProjectChanges()` updates object to save the field

**Note:** The HTML form already had the admin notes textarea (`#edit-project-notes`). The JavaScript wasn't populating or saving it.

**Remaining:** Verify client portal shows admin_notes for admin users (separate issue if needed).

- [x] #### Edit Project Modal - All Fields Editable + Logical Organization

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**User Request:**

- Need to be able to edit ALL project details
- Everything editable needs to appear in overview
- All URLs should be grouped

**Fix Applied:**

1. **Added missing fields to edit modal populate/save:**
   - Deposit Amount
   - Contract Signed Date
   - Repository URL
   - Production URL

2. **Reorganized project detail overview (logical grouping):**
   - Client Info: Client, Company, Email
   - Timeline: Project Type, Timeline, Start Date, Target End
   - Description: Full project description
   - Financial: Budget, Quoted Price, Deposit, Contract Signed
   - URLs: Preview URL, Repository URL, Production URL (grouped together)
   - Admin Notes: Internal notes (shown only if populated)

3. **Reorganized edit modal form (matching order):**
   - Project Basics: Name, Type + Status (row)
   - Timeline: Timeline, Start Date + End Date (row)
   - Description
   - Financial: Budget + Price (row), Deposit + Contract Date (row)
   - URLs: Preview, Repository, Production (grouped)
   - Admin Notes

4. **Updated project type options** to match intake form types

**Files Modified:**

- `admin/index.html` - Reorganized edit modal form, updated project overview HTML
- `src/features/admin/modules/admin-projects.ts` - Added fields to `openEditProjectModal()` and `saveProjectChanges()`, updated `populateProjectDetailView()` to display all fields
- `server/routes/projects.ts` - Added field mappings for frontend-to-database translation
- `server/routes/admin.ts` - Added all fields to `/api/admin/leads` query with proper aliases

- [x] #### Target End Date - Timezone Issue (Off By One Day)

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Issue:** Selecting March 1 displayed as February 28 due to JavaScript Date parsing YYYY-MM-DD as UTC.

**Fix Applied:** Created `formatDateForDisplay()` that parses date components directly. Added server field mappings: `end_date` → `estimated_end_date`, `repo_url` → `repository_url`, `contract_signed_date` → `contract_signed_at`.

- [x] #### HTML Entity - Double Encoding Issue

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Issue:** Double-encoded data (`&amp;#x2F;` instead of `/`).

**Fix Applied:** Updated `decodeHtmlEntities()` in `sanitization-utils.ts` to recursively decode until stable.

- [x] #### URL Links - Red Styling and Clickable

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:** Added CSS for `.meta-value a` with `color: var(--color-primary, #dc2626)`. Updated `updateUrlLink()` to decode HTML entities.

- [x] #### Missing Data Display - Empty Instead of Dash

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:** Updated all format functions in `format-utils.ts` to return empty string instead of `-`.

- [ ] #### Project Type - Inconsistent Throughout Codebase

**Status:** TODO
**Observed:** January 28, 2026

Project type is not consistent throughout the codebase (different labels, values, or sources in different places).

**Expected behavior:**

- Single source of truth for project types (e.g. enum, config, or shared constant).
- Same labels and values in: intake, proposal builder, admin project details, admin edit, client portal, APIs.

**Files to investigate:**

- Intake and proposal builder type lists.
- Admin project create/edit and project details.
- Client portal project display.
- `server/` routes and DB schema for project_type.

**Deep Dive Investigation (January 28, 2026):**

- **Intake Form Types:** `server/middleware/validation.ts` lines 693-701 shows: `'simple-site', 'business-site', 'portfolio', 'e-commerce', 'web-app', 'browser-extension', 'other'`
- **Proposal Builder Types:** `src/features/client/proposal-builder-data.ts` uses `ProjectType` from types - need to check definition
- **Admin Display:** `admin-dashboard.ts` lines 1482-1492 has type mapping: `'simple-site': 'Simple Website', 'business-site': 'Business Website', 'portfolio': 'Portfolio', 'ecommerce': 'E-commerce', 'web-app': 'Web Application', 'browser-extension': 'Browser Extension', 'other': 'Other'`
- **Inconsistency Found:** Intake uses `'e-commerce'` (with hyphen) but admin mapping uses `'ecommerce'` (no hyphen)
- **Home Page Form:** `templates/pages/home.ejs` lines 70-76 shows different labels: "Simple Site", "Small Business Website", "Portfolio Website", "E-commerce Store", "Web Application", "Browser Extension", "Other"
- **Root Cause:** Multiple sources of truth:
  1. Intake validation uses kebab-case values
  2. Admin display uses different mapping
  3. Home page form uses different labels
  4. Need single source of truth (shared constant/enum) for both values and labels

- [x] #### Client Budget - Missing Hyphen

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `formatDisplayValue()` in three files:
- `src/features/admin/modules/admin-projects.ts`
- `src/features/admin/admin-project-details.ts`
- `src/features/admin/modules/admin-leads.ts`

Changes:
1. Removed unnecessary `.replace(/-/g, '')` from "under" handler
2. Changed range hyphens to proper en-dashes (–) for typography
3. Fixed regex `(\d)-(\d)` to `(\d+)-(\d+)` to properly match multi-digit numbers
4. Fixed regex to handle decimals: `[\d.]+` instead of `\d+` (handles "2.5k-5k")
5. Fixed regex to handle corrupted space-separated data: `[-\s]+` pattern (handles "2.5k 5k")

**Additional Update (January 28, 2026):**

Centralized `formatDisplayValue()` to `src/utils/format-utils.ts` as the single shared utility. Local duplicate functions removed from individual modules.

- [x] #### Description Field - Line Breaks Not Rendering (Multiple Locations)

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Added `formatTextWithLineBreaks()` utility function to `src/utils/format-utils.ts` that:
1. Escapes HTML entities to prevent XSS
2. Converts `\n` to `<br>` tags

Updated all locations to use `innerHTML` with the new formatter:
- `src/features/admin/modules/admin-projects.ts` - populateProjectDetailView()
- `src/features/admin/admin-project-details.ts` - populateProjectDetailView()
- `src/features/client/client-portal.ts` - showProjectDetails()
- `src/modules/ui/projects.ts` - showProjectDetail()
- `src/features/client/modules/portal-projects.ts` - populateProjectDetails()

- [x] #### Client Portal Profile Settings - Not Refreshing After Save

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/features/client/client-portal.ts` in `saveProfileSettings()`:

1. After successful save, update `this.currentUser` with new values (contact_name, company_name, phone)
2. Added `await this.loadUserSettings()` call after success alert to refresh the display

**Files Modified:**

- `src/features/client/client-portal.ts` - Updated `saveProfileSettings()` method

- [x] #### Home Page Contact Form - Project Type Value Mismatch

**Status:** NOT APPLICABLE - Reverted
**Observed:** January 28, 2026
**Updated:** January 28, 2026

**Note:** This form is a general contact form (Netlify), not the intake validation form. The display-style values are intentional and do not need to match the intake validation schema. Changes reverted per user request.

- [x] #### Home Page Contact Form - Budget Range Value Mismatch

**Status:** NOT APPLICABLE - Reverted
**Observed:** January 28, 2026
**Updated:** January 28, 2026

**Note:** This form is a general contact form (Netlify), not the intake validation form. The display-style values are intentional and do not need to match the intake validation schema. Changes reverted per user request.

- [x] #### Home Page Contact Form - Timeline Value Mismatch

**Status:** NOT APPLICABLE - Reverted
**Observed:** January 28, 2026
**Updated:** January 28, 2026

**Note:** This form is a general contact form (Netlify), not the intake validation form. The display-style values are intentional and do not need to match the intake validation schema. Changes reverted per user request.

- [x] #### Admin Leads - formatDisplayValue Same Hyphen Issue

**Status:** FIXED (included in Client Budget - Missing Hyphen fix)
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Same fix as "Client Budget - Missing Hyphen" - updated `formatDisplayValue()` in `src/features/admin/modules/admin-leads.ts` along with the other two files.

- [x] #### Admin Project Details - formatDisplayValue Same Hyphen Issue

**Status:** FIXED (included in Client Budget - Missing Hyphen fix)
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Same fix as "Client Budget - Missing Hyphen" - updated `formatDisplayValue()` in `src/features/admin/admin-project-details.ts` along with the other two files.

**Note:** All three modules now use the shared utility function `formatDisplayValue()` from `src/utils/format-utils.ts`. Local duplicate functions have been removed.

- [ ] #### Project Status - Inconsistent Format (in-progress vs in_progress)

**Status:** TODO
**Observed:** January 28, 2026

Project status values are inconsistent throughout the codebase - some places use hyphens (`in-progress`, `on-hold`) and others use underscores (`in_progress`, `on_hold`).

**Locations Found:**
- Database schema (`server/database/migrations/001_initial_schema.sql` line 24): Uses hyphens `'in-progress', 'on-hold'`
- TypeScript types (`src/types/client.ts` line 10): Uses hyphens `'in-progress', 'on-hold'`
- Admin types (`src/features/admin/admin-types.ts` line 119): Uses underscores `'in_progress', 'on_hold'`
- Admin projects module (`src/features/admin/modules/admin-projects.ts` line 158): Uses underscores `'in_progress', 'on_hold'`
- Admin projects module (`src/features/admin/modules/admin-projects.ts` line 407): Status labels use underscores `in_progress: 'In Progress'`
- Table filter (`src/utils/table-filter.ts` lines 496, 540): Uses underscores `{ value: 'in_progress', label: 'In Progress' }`
- Table dropdown (`src/utils/table-dropdown.ts` line 180): Uses underscores `in_progress: 'In Progress'`
- CSS classes (`src/styles/pages/admin.css`): Supports both formats (lines 909-910, 1111-1112)
- API types (`src/types/api.ts` line 221): Uses underscores `'in_progress'`
- Shared validation (`shared/validation/schemas.ts` line 462): Uses underscores `'in_progress'`

**Expected behavior:**
- Single consistent format throughout codebase (preferably hyphens to match database schema)
- All status comparisons, filters, and displays use the same format
- Normalization function should handle conversion if needed

**Root Cause:** Mixed usage of hyphen and underscore formats. Database uses hyphens, but many TypeScript types and utilities use underscores. Need to standardize on one format (preferably hyphens to match database) and update all references.

- [x] #### Admin Project Save - Not Using API Response Data

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/features/admin/modules/admin-projects.ts` in `saveProjectChanges()`:

1. Parse the API response to get the updated project data
2. Update `projectsData` array directly with response data (preserving computed fields like file_count, message_count, unread_count)
3. Call `populateProjectDetailView()` with the updated project immediately
4. No longer calls `loadProjects()` to reload all projects

Also added `file_count`, `message_count`, `unread_count` fields to `LeadProject` interface to support computed fields.

- [x] #### Admin Proposals Notes Save - Not Refreshing Display

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/features/admin/modules/admin-proposals.ts` in `updateProposalNotes()`:

Added `await refreshProposals(ctx)` after successful save to refresh the proposals list and details panel.

**Files Modified:**

- `src/features/admin/modules/admin-proposals.ts` - Added refresh call after notes save

- [x] #### Admin Clients Edit - Not Using API Response Data

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/features/admin/modules/admin-clients.ts` in `handleSubmit()`:

1. Parse the API response to get the updated client data
2. Update `clientsData` array directly with response data (preserving computed fields like project_count)
3. Call `showClientDetails()` to refresh the view immediately
4. No longer calls `loadClients()` to reload all clients

- [x] #### Client Portal Project Request - Not Refreshing Projects List

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/features/client/client-portal.ts`:

1. Added `currentUserData` property to store full user object (id, email, name)
2. Set `currentUserData` on login and auth validation
3. Clear `currentUserData` on logout
4. In `submitProjectRequest()`, added `await this.loadRealUserProjects(this.currentUserData)` after form clear to refresh projects list

**Files Modified:**

- `src/features/client/client-portal.ts` - Added user data storage and projects reload after submission

- [ ] #### Date Formatting - Inconsistent Formats Across Codebase

**Status:** UTILITIES CREATED - Integration TODO
**Observed:** January 28, 2026
**Utilities Created:** January 28, 2026

**Utilities Created:**

Added date formatting utilities to `src/utils/format-utils.ts`:

- `formatDate(dateString)` - Returns "Jan 28, 2026" format
- `formatDateTime(dateString)` - Returns "Jan 28, 2026, 2:30 PM" format
- `formatDateForInput(dateString)` - Returns "YYYY-MM-DD" for input fields
- `formatRelativeTime(dateString)` - Returns "2 hours ago", "3 days ago", etc.

**Next Steps:**

Replace all local date formatting throughout the codebase with these utilities.

Date formatting is inconsistent throughout the codebase - different modules use different date formatting methods and formats.

**Locations Found:**
- `src/features/admin/modules/admin-projects.ts` line 236: `formatDate()` function returns `MM/DD/YYYY` format
- `src/features/admin/modules/admin-projects.ts` line 504: Uses `toLocaleDateString()` (browser default format)
- `src/features/admin/modules/admin-projects.ts` line 931: Uses `toLocaleString()` (includes time)
- `src/features/admin/modules/admin-projects.ts` line 994: Uses `toLocaleDateString()` 
- `src/features/admin/modules/admin-projects.ts` line 1283: Uses `toLocaleDateString()`
- `src/features/admin/modules/admin-proposals.ts` lines 251, 416: Uses `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`
- `src/features/admin/admin-project-details.ts` line 311: Uses `toLocaleDateString()`
- `src/features/admin/admin-project-details.ts` line 473: Uses `toLocaleString()` (includes time)
- `src/features/client/client-portal.ts` line 1253: `formatDate()` function returns `MM/DD/YYYY` format
- `src/features/admin/modules/admin-leads.ts` line 214: Uses `toLocaleDateString()`
- `src/features/admin/modules/admin-leads.ts` line 568: Uses `toLocaleString()` (includes time)
- `src/features/admin/modules/admin-clients.ts` line 306: Uses `toLocaleDateString()`
- `src/features/admin/modules/admin-clients.ts` line 400: Uses `toLocaleString()` (includes time)

**Expected behavior:**
- Consistent date formatting across all modules
- Dates should use same format (e.g., `MM/DD/YYYY` for dates, `MM/DD/YYYY, HH:MM AM/PM` for date+time)
- Shared date formatting utility function to avoid duplication

**Root Cause:** Multiple different date formatting approaches. Some modules have custom `formatDate()` functions, others use native `toLocaleDateString()`/`toLocaleString()` which can vary by browser locale. Should consolidate into shared utility functions.

- [ ] #### Error Handling - Inconsistent Error Message Display

**Status:** TODO
**Observed:** January 28, 2026

Error handling is inconsistent - some catch blocks show user-friendly messages, others show technical error messages or don't show anything.

**Locations Found:**
- `src/features/admin/modules/admin-projects.ts` line 815: Shows `error.message` or generic message
- `src/features/admin/modules/admin-projects.ts` line 1514: Shows `error.message || 'Unknown error'` 
- `src/features/admin/modules/admin-projects.ts` line 1713: Shows `error.message` or generic message
- `src/features/admin/modules/admin-projects.ts` line 1264: Only logs to console, shows generic "Failed to load milestones" message
- `src/features/admin/modules/admin-leads.ts` line 349: Shows `error.message` or generic message
- `src/features/admin/modules/admin-leads.ts` line 712: Shows `error.message` or generic message
- `src/features/admin/modules/admin-leads.ts` line 732: Shows `error.message` or generic message

**Issues:**
- Some errors show `error.message` which might contain technical details
- Some errors only log to console without user notification
- Error messages may not be user-friendly
- Inconsistent error handling patterns

**Expected behavior:**
- All errors should show user-friendly messages
- Technical details should only be logged, not displayed to users
- Consistent error handling pattern across all modules
- API error responses should be parsed and displayed appropriately

**Root Cause:** Inconsistent error handling. Some places show raw error messages, others show generic messages. Need standardized error handling utility that extracts user-friendly messages from API errors.

- [ ] #### API Calls - Missing Response OK Checks Before JSON Parsing

**Status:** TODO
**Observed:** January 28, 2026

Some API calls parse JSON responses without checking if the response is OK first, which can cause errors when the API returns error responses.

**Locations Found:**
- `src/features/admin/modules/admin-projects.ts` line 1330-1337: `fetch()` call doesn't check `response.ok` before using response, only catches errors
- `src/features/admin/admin-project-details.ts` line 1091: `apiPut()` call doesn't check `response.ok` before proceeding (uses `.catch()` only)
- Multiple places call `response.json()` without checking `response.ok` first (though many are in `if (response.ok)` blocks)

**Issues:**
- Non-OK responses (4xx, 5xx) might be parsed as JSON, causing confusing errors
- Error responses might not be handled properly
- Silent failures possible if error responses aren't caught

**Expected behavior:**
- Always check `response.ok` before parsing JSON
- Handle error responses appropriately
- Show user-friendly error messages for failed requests

**Root Cause:** Some API calls don't verify response status before parsing JSON. Should always check `response.ok` or use a helper function that handles this automatically.

- [x] #### Progress Save - Fire and Forget Without Error Handling

**Status:** PARTIALLY FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/features/admin/modules/admin-projects.ts` in `updateProgressBar()`:

1. Changed from raw `fetch()` to `apiPut()` for consistent API calls
2. Added `.then()` to check `response.ok` and log errors
3. Kept `.catch()` for network errors

**Note:** Still fire-and-forget but now uses consistent API client and checks response status. User notifications for progress save failures could be added in a future iteration.

- [x] #### Object URL (Blob) Leaks - Preview/Download Not Revoking URLs

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/features/admin/modules/admin-projects.ts`:

- Image preview: Already handled - `showImagePreviewModal()` revokes blob URL on modal close
- Download file: Already handled - `downloadFile()` revokes blob URL after click
- PDF preview: Added `setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)` after opening in new tab (revokes after 60s delay to allow browser to load PDF)

- [x] #### Uploads - Potentially Dangerous File Types Allowed (JS/HTML/CSS)

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `server/routes/uploads.ts` file filter to remove dangerous code file types:

- Removed: `.js`, `.ts`, `.html`, `.css`
- Kept safe: `.json`, `.xml` (served with safe content-type via authenticated endpoint)
- Added: `.svg` (images), `.rtf` (documents), `.7z` (archives)

Files are already served via authenticated endpoint `/api/uploads/file/:fileId` which prevents direct execution.

- [x] #### SanitizationUtils.decodeHtmlEntities - Uses innerHTML (XSS Footgun)

**Status:** NOT A SECURITY ISSUE - Documented
**Observed:** January 28, 2026
**Reviewed:** January 28, 2026

**Analysis:**

The textarea-based HTML entity decoding is a **well-known SAFE pattern** because:

1. Setting `innerHTML` on a `<textarea>` does NOT execute scripts
2. The `textarea.value` property returns plain decoded text safely
3. This is a standard browser-based entity decoding technique

**Action Taken:**

Added detailed security comment in `src/utils/sanitization-utils.ts` explaining why this pattern is safe, with reference to Stack Overflow documentation.

- [x] #### Uploads Delete - Inconsistent Path Resolution vs Download Route

**Status:** ALREADY FIXED
**Observed:** January 28, 2026
**Verified:** January 28, 2026

**Current Implementation:**

The delete handler now uses the same `resolveFilePath()` function as other routes (line 675):
1. Validates path with `isPathSafe()` before deletion
2. Uses `resolveFilePath()` for consistent path resolution
3. Logs path traversal attempts

No fix needed - code is already using the centralized path resolution method.

- [x] #### Auth/User State - sessionStorage Contains User Data (XSS Exposure)

**Status:** ACCEPTABLE RISK - Architecture Already Secure
**Observed:** January 28, 2026
**Reviewed:** January 28, 2026

**Analysis:**

The auth architecture is already secure:

1. **Auth token is in HttpOnly cookie** - Cannot be stolen via XSS
2. **sessionStorage contains only UI data** - user id, email, name, role (for display)
3. **Session validated with server** - sessionStorage alone cannot impersonate a user
4. **Cookies use `sameSite: 'strict'`** - CSRF protection

**Risk Assessment:**

- An XSS attack could read the sessionStorage data
- BUT they could not impersonate the user without the HttpOnly token
- The stored data (email, name) is low-sensitivity display information

**Recommendation:** No code changes needed. Current architecture follows best practices with JWT token in HttpOnly cookie.

- [x] #### CSRF / Security Headers - Likely Missing Hardening

**Status:** FIXED - Hardened
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Existing Protections Found:**

1. **CSRF:** Cookies already use `sameSite: 'strict'` (in `server/utils/auth-constants.ts`)
2. **CSP:** Already configured via helmet (in `server/app.ts`)

**Fix Applied:**

Enhanced helmet configuration in `server/app.ts` with additional security headers:

- Added `baseUri: ['\'self\'']` - Prevents base tag hijacking
- Added `formAction: ['\'self\'']` - Prevents form submission to external sites
- Added `frameguard: { action: 'deny' }` - Explicit clickjacking protection
- Added `hidePoweredBy: true` - Hide X-Powered-By header
- Added `noSniff: true` - Prevent MIME type sniffing
- Added `xssFilter: true` - XSS filter for legacy browsers
- Added `referrerPolicy: { policy: 'strict-origin-when-cross-origin' }` - Control referrer leakage
- Added `blob:` to imgSrc for blob URL support

**Note:** `unsafe-inline` and `unsafe-eval` kept in scriptSrc as GSAP may require them. Could be removed with nonce-based CSP in future.

- [x] #### Modal Event Listeners - Not Cleaned Up, Added Multiple Times

**Status:** PARTIALLY FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/features/admin/modules/admin-projects.ts`:

Added `{ once: true }` to modal overlay click listeners in preview modals to prevent accumulation:
- `showJsonPreviewModal()` - modal click listener now uses `{ once: true }`
- `showTextPreviewModal()` - modal click listener now uses `{ once: true }`
- `showImagePreviewModal()` - modal click listener now uses `{ once: true }`

**Note:** The close button listeners don't need `{ once: true }` since the innerHTML is replaced each time (old elements are destroyed). The edit modal (lines 707-711) was not changed as it requires more complex refactoring to track listener state.
- Some modals use `{ once: true }` option, others don't

**Expected behavior:**
- Remove event listeners when modal is closed
- Use `{ once: true }` option for one-time handlers
- Or store listener references and remove them explicitly
- Consistent pattern across all modals

**Root Cause:** Modals add event listeners on each open without cleanup. Should remove listeners on close or use `{ once: true }` option for one-time handlers.

- [ ] #### Global Event Listeners - Added Without Teardown (Admin + Client Portal)

**Status:** TODO
**Observed:** January 28, 2026

There are document/window-level event listeners that are added during module init and never removed, which can leak handlers across navigation/module re-inits (especially in SPA-ish flows or hot reload).

**Locations Found:**
- `src/features/admin/admin-dashboard.ts` (document-level click/keydown handlers for session extension + modal escape handling)
- `src/features/client/client-portal.ts` (`setupDashboardEventListeners()` adds listeners without teardown)
- `src/components/button-component.ts` (window-level keyup handler lifecycle edge case)

**Expected behavior:**
- Track handler references and remove them during module/component teardown (or ensure modules initialize exactly once for the app lifetime).

**Root Cause:** Missing teardown pattern for global listeners.

- [ ] #### Request Cancellation - No AbortController (Race Conditions / Stale UI)

**Status:** TODO
**Observed:** January 28, 2026

Several modules fire multiple concurrent loads (projects/leads/contacts, per-project milestone fetches, etc.) without cancellation. This can lead to stale UI (late responses overwriting newer state) and wasted work.

**Locations Found:**
- `src/features/admin/admin-dashboard.ts` (multiple parallel loads on init; repeated refresh triggers)
- `src/features/client/client-portal.ts` (`loadRealUserProjects()` and per-project milestone fetches)

**Expected behavior:**
- Use `AbortController` to cancel in-flight fetches when a newer request supersedes them, or ignore stale responses via request IDs.

**Root Cause:** No cancellation/guarding against stale responses.

- [x] #### Form Validation - No Debounce (Excess Work on Keystroke)

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/utils/form-validation.ts`:

1. Import `debounce` utility from `gsap-utilities.ts`
2. Added `VALIDATION_DEBOUNCE_MS` constant (150ms)
3. Wrapped `input` event handler with debounce
4. Left `change` events immediate (they're infrequent - select, checkbox)

Now form validation only runs after user pauses typing, reducing DOM updates and improving performance on slower devices.

- [x] #### Admin Dashboard - Duplicate loadProjects() Calls

**Status:** NOT A BUG
**Observed:** January 28, 2026
**Verified:** January 28, 2026

**Investigation Result:**

The original description was incorrect. Looking at the code:
- Line 545-547: Sets up a click handler for the refresh button (only executes on click)
- Line 551: Direct call to `loadProjects()` during init

The click handler does NOT execute during initialization - it only runs when the user clicks the refresh button. There is only ONE call to `loadProjects()` during initialization (line 551). No fix needed.

- [x] #### Project Save - Redundant Data Reloading

**Status:** FIXED (Same fix as "Admin Project Save - Not Using API Response Data")
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Note:** This was the same issue as "Admin Project Save - Not Using API Response Data" above. Both are now resolved by the same fix that uses the API response data directly instead of reloading all projects.

- [ ] #### E-commerce vs E-commerce Inconsistency - Additional Instances

**Status:** PARTIALLY FIXED
**Observed:** January 28, 2026
**Partial Fix:** January 28, 2026

**Partial Fix Applied:**

- Fixed `admin/index.html` line 1299: Changed `value="ecommerce"` to `value="e-commerce"` to match validation schema
- Fixed display label capitalization (E-commerce → E-Commerce with capital C):
  - `src/features/admin/admin-dashboard.ts`: PROJECT_TYPE_MAP updated to `'E-Commerce'`
  - `src/features/admin/modules/admin-proposals.ts`: projectTypeLabels updated to `'E-Commerce'`

**Remaining Work:** This is a larger refactor requiring updates to TypeScript types and backend constants. The validation schema uses `'e-commerce'` (with hyphen) which should be the standard.

**Additional Locations Found:**
- ~~`admin/index.html` line 1299: FIXED~~
- `admin/index.html` line 1462: `<option value="e-commerce">E-Commerce</option>` (with hyphen in value)
- `server/routes/proposals.ts` line 37: Uses `'ecommerce'` (no hyphen)
- `server/routes/admin.ts` line 1049: Mapping uses `ecommerce: 'E-commerce Store'` (no hyphen)
- `src/features/admin/modules/admin-proposals.ts` line 697: Uses `'ecommerce': 'E-commerce'` (no hyphen)
- `src/features/client/proposal-builder-data.ts` line 316: Uses `ECOMMERCE_TIERS` and `ECOMMERCE_FEATURES` constants
- `src/features/client/proposal-builder-types.ts` line 23: Type uses `'ecommerce'` (no hyphen)
- `src/types/client.ts` line 15: Type uses `'ecommerce'` (no hyphen)
- `src/types/project.ts` line 88: Uses `id: 'ecommerce'` (no hyphen)
- `server/routes/intake.ts` line 501: Mapping uses `ecommerce: 'E-commerce Store'` (no hyphen)
- `server/routes/intake.ts` line 596: Condition checks `if (projectType === 'ecommerce')` (no hyphen)
- `server/services/invoice-service.ts` line 531: Case uses `'e-commerce'` (with hyphen)
- `server/services/invoice-service.ts` line 534: Description uses `'E-commerce Platform Development'`
- `server/services/project-generator.ts` line 149: Uses `ecommerce:` key (no hyphen)
- `server/services/invoice-generator.ts` line 108: Uses `ecommerce:` key (no hyphen)
- `server/services/invoice-generator.ts` line 237: Uses `ecommerce: 1.3` (no hyphen)
- `server/services/invoice-generator.ts` line 508: Uses `ecommerce: 'E-commerce Store'` (no hyphen)
- `server/models/ClientIntake.ts` line 22: Type uses `'e-commerce'` (with hyphen)
- `server/models/ClientIntake.ts` line 211: Uses `'e-commerce': 4` (with hyphen)
- `server/models/ClientIntake.ts` line 250: Uses `'e-commerce': 80` (with hyphen)
- `server/models/ClientIntake.ts` line 271: Uses `'e-commerce': 1.2` (with hyphen)
- `server/models/ClientIntake.ts` line 422: Uses `'e-commerce'` (with hyphen)
- `src/types/api.ts` line 188: Type uses `'e-commerce'` (with hyphen)
- `shared/validation/schemas.ts` line 318: Uses `'e-commerce'` (with hyphen)
- `shared/validation/schemas.ts` line 370: Uses `'e-commerce'` (with hyphen)

**Root Cause:** Inconsistent usage throughout codebase. Some places use `'e-commerce'` (with hyphen, matches validation), others use `'ecommerce'` (no hyphen). Need to standardize on one value (preferably `'e-commerce'` to match validation schema) and update all instances.

---

## UX/UI Issues

- [x] #### Native Browser Dialogs (alert/prompt/confirm) - Poor UX

**Status:** COMPLETE
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fixes Applied:**

1. **Admin `prompt()` dialogs** - Replaced with `multiPromptDialog()`:
   - `src/features/admin/admin-project-details.ts`: Milestone and invoice creation
   - `src/features/admin/modules/admin-projects.ts`: Milestone and invoice creation

2. **Client portal `alert()` dialogs** - Replaced with `showToast()`:
   - `src/features/client/client-portal.ts`: All 21 alert() calls replaced with toast notifications
   - `src/features/client/modules/portal-messages.ts`: Error message
   - `src/features/client/modules/portal-invoices.ts`: Error message

3. **Admin `confirm()` dialogs** - Already using custom `confirmDialog()` / `confirmDanger()`

**Issues:**
- Native dialogs block the entire UI
- Cannot be styled to match application design
- Poor accessibility (screen reader support varies)
- No way to customize appearance or behavior
- Interrupts user flow
- Cannot show rich content or formatting

**Expected behavior:**
- Replace all native dialogs with custom modal/dialog components
- Use toast notifications for non-critical feedback
- Use custom modals for confirmations and input prompts
- Consistent styling across all user feedback

**Root Cause:** Quick implementation using native dialogs. Should use custom UI components for better UX and consistency.

- [x] #### Form Submission - Missing Loading States and Button Disabling

**Status:** COMPLETE - Utility Created and Integrated
**Observed:** January 28, 2026
**Utility Created:** January 28, 2026
**Integrated:** January 28, 2026

**Utility Created:**

Created `src/utils/button-loading.ts` with:

- `setButtonLoading(button, loadingText)` - Shows spinner, disables button
- `clearButtonLoading(button)` - Restores original state
- `withButtonLoading(button, asyncFn)` - Wrapper for async operations

Added CSS in `src/styles/components/loading.css` for button loading states.

**Integration Complete:**

- `src/features/admin/modules/admin-clients.ts`: Edit client info, edit billing, add client forms

- [ ] #### Empty States - Generic or Unhelpful Messages

**Status:** TODO
**Observed:** January 28, 2026

Many empty states show generic messages that don't guide users on what to do next.

**Locations Found:**
- `src/features/admin/admin-project-details.ts`: Multiple "No messages yet", "No files uploaded yet", "No milestones yet", "No invoices created yet"
- `src/features/admin/modules/admin-projects.ts`: "No projects yet. Convert leads to start projects.", "No files uploaded yet", "No milestones yet", "No invoices yet"
- `src/features/admin/modules/admin-leads.ts`: "No leads found", "No leads match the current filters"

**Issues:**
- Generic messages don't explain why the state is empty
- No call-to-action buttons to help users take next steps
- Missing helpful guidance or examples
- Doesn't differentiate between "no data exists" vs "filtered out all data"

**Expected behavior:**
- Contextual empty states with helpful messages
- Action buttons to create/add items when appropriate
- Clear distinction between "no data" vs "filtered results"
- Visual icons or illustrations for better UX

**Root Cause:** Basic empty state implementation. Should provide actionable guidance and differentiate between different empty state scenarios.

- [x] #### Form Validation - Missing Inline Error Display

**Status:** UTILITY CREATED - Ready for Integration
**Observed:** January 28, 2026
**Utility Created:** January 28, 2026

**Utility Created:**

Created `src/utils/form-errors.ts` with:

- `showFieldError(field, message)` - Shows error below field with ARIA
- `clearFieldError(field)` - Clears error and styling
- `showFieldErrors(errors, form)` - Show multiple errors at once
- `validateField(field, validator)` - Validate with error display
- `validators` - Common validators (required, email, minLength, etc.)

Added CSS in `src/styles/components/form-validation.css`:

- `.field-error` / `.field-error--visible` - Error message styling
- `.field--invalid` - Invalid field border styling

**Next Steps:**

Import and use in form validation:

```typescript
import { showFieldError, clearFieldError, validators } from '../../utils/form-errors';

// Validate on blur or submit:
if (!validateField(emailInput, validators.email)) {
  return; // Error already shown
}
```
- Admin forms: May not show inline validation errors

**Issues:**
- Errors shown in alerts instead of next to fields
- No visual indication of which fields have errors
- Users must remember error messages from alerts
- No `aria-invalid` or `aria-describedby` for accessibility

**Expected behavior:**
- Show validation errors inline next to each field
- Use `aria-invalid="true"` and `aria-describedby` for accessibility
- Highlight fields with errors visually
- Show errors as user types (with debouncing)
- Clear errors when field is corrected

**Root Cause:** Validation feedback not integrated into form fields. Should use inline error display with proper ARIA attributes.

- [x] #### Modal Focus Management - Inconsistent Implementation

**Status:** COMPLETE - Utility Created and Integrated
**Observed:** January 28, 2026
**Utility Created:** January 28, 2026
**Integrated:** January 28, 2026

**Utility Created:**

Created `src/utils/focus-trap.ts` with:

- `createFocusTrap(container, options)` - Traps Tab/Shift+Tab within container
- `removeFocusTrap(container)` - Removes trap and restores previous focus
- `hasFocusTrap(container)` - Check if trap is active
- `manageFocusTrap(modal, options)` - Higher-level helper with ARIA attributes

**Features:**

- Stores previously focused element for restoration
- Handles Escape key to close modal
- Supports custom initial focus element
- Sets `role="dialog"` and `aria-modal="true"`

**Integration Complete:**

- `src/features/admin/modules/admin-clients.ts`: Edit client info, edit billing, add client modals

**Existing Proper Focus Management:**

- `src/components/modal-component.ts`: Has proper focus management (lines 326-341, 368-383)

- [ ] #### Button Accessibility - Missing ARIA Labels

**Status:** PARTIALLY FIXED
**Observed:** January 28, 2026
**Partial Fix:** January 28, 2026

Many buttons, especially icon-only buttons, are missing `aria-label` attributes for screen reader users.

**Partial Fix Applied:**

Added `aria-label="Close panel"` to close buttons in:

- `src/features/admin/modules/admin-contacts.ts` - Contact details panel close button
- `src/features/admin/modules/admin-leads.ts` - Lead details panel close button

**Locations Found:**
- `src/features/admin/modules/admin-projects.ts` lines 957-958: Preview/Download buttons have `aria-label` (good)
- `src/features/admin/modules/admin-projects.ts` lines 1082, 1124, 1166: Modal close buttons have `aria-label` (good)
- `src/features/admin/modules/admin-contacts.ts`: Close button now has `aria-label` (fixed)
- `src/features/admin/modules/admin-leads.ts`: Close button now has `aria-label` (fixed)
- Many other buttons throughout admin/client portals may be missing labels
- Icon-only buttons likely missing labels

**Issues:**
- Screen reader users can't understand button purpose
- Icon-only buttons are inaccessible
- Buttons with only visual text need descriptive labels

**Expected behavior:**
- All buttons should have `aria-label` if text is not descriptive
- Icon-only buttons must have `aria-label`
- Buttons with descriptive text can use text as label
- Use `aria-describedby` for additional context if needed

**Root Cause:** Missing accessibility attributes. Should audit all buttons and add appropriate ARIA labels.

- [x] #### Client Portal Forms - No Loading States During Save

**Status:** COMPLETE
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Updated `src/features/client/client-portal.ts` `setupSettingsFormHandlers()` to use `withButtonLoading()`:

- Profile form: "Saving..." loading state
- Password form: "Updating..." loading state
- Notifications form: "Saving..." loading state
- Billing form: "Saving..." loading state
- New project form: "Submitting..." loading state

All forms now disable submit button and show loading text during save.

- [ ] #### Admin Modals - No Focus Trap or Restoration

**Status:** TODO
**Observed:** January 28, 2026

Admin modals (edit project, edit client, add project) don't implement focus trapping, making them inaccessible for keyboard users.

**Locations Found:**
- `src/features/admin/modules/admin-projects.ts`: Edit project modal (lines 660-695)
- `src/features/admin/modules/admin-clients.ts`: Edit client modals
- `src/features/admin/admin-dashboard.ts`: Detail modal

**Issues:**
- Keyboard users can tab outside modal
- Focus not restored when modal closes
- No focus trap within modal
- Escape key handling may be inconsistent

**Expected behavior:**
- Trap focus within modal
- Restore focus to trigger element
- Handle Tab/Shift+Tab navigation
- Close on Escape key
- Focus first element when opened

**Root Cause:** Admin modals use basic implementation without focus management. Should use same pattern as `ModalComponent` or add focus management to existing modals.

- [ ] #### Error Messages - Not Associated with Form Fields

**Status:** TODO
**Observed:** January 28, 2026

Form validation errors are not properly associated with form fields using ARIA attributes, making them hard to discover for screen reader users.

**Locations Found:**
- `src/features/client/client-portal.ts`: Validation errors shown in alerts, not associated with fields
- `src/utils/form-validation.ts`: Only checks completion, doesn't set ARIA attributes
- Admin forms: May not use `aria-invalid` or `aria-describedby`

**Issues:**
- Screen reader users may not hear error messages
- Errors not visually connected to fields
- No `aria-invalid="true"` on invalid fields
- No `aria-describedby` linking errors to fields

**Expected behavior:**
- Set `aria-invalid="true"` on fields with errors
- Use `aria-describedby` to link error messages to fields
- Show error messages near fields (not just in alerts)
- Announce errors to screen readers

**Root Cause:** Missing ARIA attributes for form validation. Should implement proper error association using `aria-invalid` and `aria-describedby`.

- [x] #### Prompt() Dialogs - Poor UX for Data Input

**Status:** COMPLETE
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Implementation:**

Created `multiPromptDialog()` in `src/utils/confirm-dialog.ts` and replaced all admin `prompt()` calls:

- `src/features/admin/admin-project-details.ts`: Milestone and invoice creation now use `multiPromptDialog()`
- `src/features/admin/modules/admin-projects.ts`: Milestone and invoice creation now use `multiPromptDialog()`

**Features:**

- Multi-field form dialogs with proper labels
- Input type support (text, number, date, textarea)
- Required field validation
- Tab trap for keyboard navigation
- Escape to cancel
- Focus management
- ARIA attributes for accessibility
- Matches portal theme styling

- [ ] #### Admin Tables - May Not Be Fully Responsive on Mobile

**Status:** TODO
**Observed:** January 28, 2026

Admin tables (projects, leads, clients) may not be fully responsive on mobile devices, potentially causing horizontal scrolling or poor usability.

**Locations Found:**
- `src/features/admin/modules/admin-projects.ts`: Projects table with many columns
- `src/features/admin/modules/admin-leads.ts`: Leads table with 8 columns
- `src/features/admin/modules/admin-clients.ts`: Clients table
- `src/styles/pages/admin.css`: Has some responsive styles but may need more

**Issues:**
- Tables with many columns may overflow on mobile
- Text may be truncated or hard to read
- Horizontal scrolling required on small screens
- Touch targets may be too small

**Expected behavior:**
- Responsive table design (stack columns, card view, or horizontal scroll with proper indicators)
- Mobile-optimized layouts for small screens
- Adequate touch target sizes
- Readable text without excessive truncation

**Root Cause:** Tables designed for desktop may not adapt well to mobile. Should implement responsive table patterns or mobile-specific layouts.

- [ ] #### Toast Notifications - Good Implementation, But Inconsistent Usage

**Status:** TODO
**Observed:** January 28, 2026

Toast notification system exists (`src/utils/toast-notifications.ts`) with proper `aria-live` attributes, but many places still use `alert()` instead of toasts.

**Locations Found:**
- `src/utils/toast-notifications.ts`: Good implementation with `aria-live="polite"`/`"assertive"` and `role="alert"`
- `src/features/client/client-portal.ts`: Many `alert()` calls instead of toasts
- `src/features/admin/modules/admin-projects.ts`: Uses `showNotification()` which may use toasts
- `src/features/admin/modules/admin-leads.ts`: Uses `showNotification()` which may use toasts

**Issues:**
- Inconsistent user feedback (some alerts, some toasts)
- Alerts block UI, toasts don't
- Mixed patterns make UX inconsistent

**Expected behavior:**
- Replace all `alert()` calls with toast notifications
- Use toasts for non-critical feedback
- Use modals only for critical confirmations
- Consistent feedback pattern across application

**Root Cause:** Toast system exists but not fully adopted. Should migrate all `alert()` calls to use toast notifications for better UX.

- [ ] #### Form Inputs - Missing Placeholder Text or Help Text

**Status:** TODO
**Observed:** January 28, 2026

Some form inputs may be missing placeholder text or help text, making it unclear what users should enter.

**Locations Found:**
- Admin forms: May have placeholders but need verification
- Client portal forms: Some inputs may lack helpful placeholders
- Terminal intake: Has placeholders (good)

**Issues:**
- Users may not understand what to enter
- No formatting hints (e.g., date format)
- No examples or guidance

**Expected behavior:**
- All inputs should have descriptive placeholders
- Format hints where needed (e.g., "YYYY-MM-DD")
- Help text for complex fields
- Examples for unclear inputs

**Root Cause:** Incomplete form design. Should audit all forms and add helpful placeholders and guidance.

---
---

### Project Files

- [x] #### File Upload Success - Files Section Not Updating

**Status:** ✅ FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Root cause:** Upload was calling `/api/uploads/multiple` which doesn't save files to the database with project association. Fixed to use `/api/uploads/project/:projectId` endpoint.

**Fix applied:**

- Changed upload endpoint from `/api/uploads/multiple` to `/api/uploads/project/${currentProjectId}`
- Changed form field from `files` to `project_file` (expected by the endpoint)
- Files are now properly saved to database and appear immediately after upload

**Files modified:**

- `src/features/admin/modules/admin-projects.ts` - Fixed `uploadProjectFiles()` function

---

- [x] #### Project Files Download/Preview Not Working

**Status:** ✅ FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Root cause:** Frontend used direct file paths (`/uploads/projects/...`) instead of authenticated API endpoint (`/api/uploads/file/:fileId`).

**Fix applied:**

- Changed URL construction to use `/api/uploads/file/${file.id}` for both preview and download
- Preview and download now use authenticated `apiFetch()` instead of direct links
- Added blob URL handling for images and PDFs (creates blob, opens in modal/tab)
- Added `downloadFile()` function for authenticated downloads via fetch+blob
- Added `showTextPreviewModal()` and `showImagePreviewModal()` for text/image previews
- Changed download `<a href>` to `<button>` with JavaScript handler (needed for auth)

**Files modified:**

- `src/features/admin/modules/admin-projects.ts`
  - `renderProjectFiles()` - Uses API URL, download button instead of link
  - `openFilePreview()` - Uses authenticated fetch, handles different file types
  - Added `downloadFile()`, `showTextPreviewModal()`, `showImagePreviewModal()`

---

- [x] #### Files Preview and Download Buttons - Styling

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Fix Applied:**

Added specific styles for `.download-btn` in `src/styles/pages/admin.css`:
- Background uses `--portal-bg-medium`
- Hover state uses primary color with dark text
- Matches styling of other action buttons in admin panel

---

- [x] #### Files Not Found (404) on Preview

**Status:** ✅ FIXED (Same fix as "Project Files Download/Preview Not Working")
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

Fixed by updating preview and download to use authenticated API endpoint `/api/uploads/file/:fileId` instead of direct file paths. See "Project Files Download/Preview Not Working" section above for full details.

---

### Admin UI

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

### Code Quality & Refactoring

- [ ] **COMPONENT REFACTORING OPPORTUNITIES** - Replace manual DOM manipulation with reusable components
  - **Documentation:** [COMPONENT_REFACTORING_OPPORTUNITIES.md](./COMPONENT_REFACTORING_OPPORTUNITIES.md)
  - **Priority:** Medium-High
  - **Impact:** 20+ alert() calls, 5 prompt() calls, 10+ manual button creations, 3 manual modal handlers
  - **Benefits:** Consistent UX, better accessibility, easier maintenance

### Admin UI Polish (High Priority)

- [x] **REDESIGN ALL PORTAL BUTTONS** - Full button redesign across admin and client portals (January 26, 2026)

### Contact Management

- [ ] **Convert Contact to Client** - Add ability to convert contact submissions to clients
  - Add `client_id` column to `contact_submissions` table (nullable FK to clients)
  - Add "converted" to status enum (`new`, `read`, `replied`, `archived`, `converted`)
  - Add "Convert to Client" button in contact submission detail panel
  - Create endpoint `POST /api/admin/contact-submissions/:id/convert-to-client`
  - Endpoint creates client from contact info (name, email, company)
  - Links contact submission to new client (sets client_id)
  - Updates contact status to "converted"
  - Contacts remain searchable/viewable even after conversion

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

### CMS Enhancement Plan (Competitive Research - January 28, 2026)

Based on research of HoneyBook, Dubsado, Bonsai, Moxo + analysis of existing codebase.

**Philosophy:** Enhance existing features first, build new only when necessary.

---

#### TIER 1: Automation & Reminders (Foundation for Everything Else)

**You Have:** Email service, project generator, invoice generator (all fire-and-forget)

**Gap:** No scheduled jobs, no reminder system, no workflow triggers

- [ ] **1.1 Scheduled Job System** (Prerequisite for all automation)
  - Add `node-cron` or similar for recurring tasks
  - Create `server/services/scheduler-service.ts`
  - Job types: daily digest, reminder checks, overdue detection
  - Admin UI to view/manage scheduled jobs
  - **Files to modify:** `server/app.ts` (init scheduler on startup)

- [ ] **1.2 Reminder Engine** (Builds on 1.1)
  - Create `server/services/reminder-service.ts`
  - Reminder types:
    - Client silent (no response in X days) - uses existing `messages` table
    - Invoice overdue (past due_date) - uses existing `invoices` table
    - Milestone approaching (X days before target_date) - uses existing `milestones`
    - Document missing (requested but not received) - needs new table
  - Add `reminder_settings` table: thresholds, enabled flags, templates
  - Add `reminder_log` table: track sent reminders (prevent spam)
  - **Enhances:** `email-service.ts` (add reminder templates)

- [x] **1.3 Account Activation Welcome Flow** (Quick Win - uses existing email service)
  - Trigger: Client sets password via magic link (account activation)
  - Actions:
    - Send welcome message to portal inbox (system message)
    - Email with "Welcome to your portal" + prompt to add billing info
    - Create "Add billing information" task/reminder
  - Welcome message content:
    - Greeting with client name
    - Quick overview of what they can do in portal
    - CTA: "Please add your billing information for invoices"
    - Link to settings/billing section
  - **Files modified:** `server/routes/auth.ts`, `server/services/email-service.ts`
  - **Uses:** `general_messages` table (sender_type: 'system'), existing email service
  - **Status:** COMPLETE (January 28, 2026)

- [ ] **1.4 Workflow Triggers** (Builds on 1.1, 1.2)
  - Create `server/services/workflow-service.ts`
  - Event-driven triggers:
    - `intake.completed` → create project, send welcome, generate invoice (exists, formalize)
    - `account.activated` → send welcome message, billing prompt (1.3)
    - `invoice.overdue` → send reminder, flag in admin
    - `proposal.accepted` → convert to project, send contract
    - `milestone.completed` → notify client, update progress
    - `file.uploaded` → notify admin, check if completes document request
  - Store workflow definitions in `workflow_templates` table
  - **Enhances:** `intake.ts`, `invoices.ts`, `proposals.ts`, `auth.ts` (emit events)

---

#### TIER 2: Client Portal Enhancements (High Visibility, Uses Existing Data)

**You Have:** Portal with projects, files, messages, invoices, settings

**Gap:** No activity feed, no visual timeline, no notifications

- [ ] **2.1 Activity Feed** (Quick Win - queries existing tables)
  - Add to portal dashboard: "Recent Activity" section
  - Query last 10 items from: `messages`, `project_updates`, `files`, `invoices`
  - Unified timeline sorted by `created_at`
  - **Files to modify:** `portal-projects.ts`, add `GET /api/client/activity`
  - **No new tables needed** - aggregates existing data

- [ ] **2.2 Client-Facing Timeline** (Medium - enhances existing milestones)
  - Visual roadmap in portal showing milestones
  - Status: upcoming, in-progress, completed
  - Estimated dates with confidence note (ties into Smart Scheduling)
  - **Enhances:** `portal-projects.ts` (add timeline view)
  - **Uses:** Existing `milestones` table + `project_updates`

- [ ] **2.3 Notification Preferences** (Quick Win - table already exists)
  - You have `notification_preferences` table (migration 005)
  - Build UI in portal settings to toggle: email on message, email on status change
  - **Enhances:** `portal-settings.ts`, `email-service.ts` (check prefs before sending)

- [ ] **2.4 Unread/New Badges** (Quick Win)
  - Show "New" badge on portal sections with unread items
  - Messages: already have `read` field
  - Files: add `viewed_by_client` flag
  - Invoices: already have `viewed` status
  - **Enhances:** `portal-navigation.ts`, sidebar badges

- [ ] **2.5 Self-Service Knowledge Base** (Low effort, high value)
  - Add `knowledge_base` table:
    - `id`, `title`, `slug`, `content` (markdown), `category`
    - `order`, `published`, `created_at`, `updated_at`
  - Categories: Getting Started, Files & Documents, Invoices & Payments, FAQs
  - Admin UI: Simple CRUD for articles (markdown editor)
  - Client UI: Searchable help section in portal sidebar
  - Pre-populate with common questions:
    - "How do I upload files?"
    - "How do I approve a deliverable?"
    - "When is payment due?"
  - **Reduces:** Support questions, "how do I..." messages
  - **Low effort:** Static content, no complex logic

---

#### TIER 3: Document Collection (Transforms File Sharing)

**You Have:** File upload/download per project (passive storage)

**Gap:** No way to request specific documents, no status tracking

- [ ] **3.1 Document Request System**
  - Add `document_requests` table:
    - `id`, `project_id`, `title`, `description`, `required` (bool)
    - `status`: requested, received, approved, rejected
    - `due_date`, `reminded_at`, `file_id` (link to uploaded file)
  - Admin UI: "Request Document" button on project files tab
  - Client UI: Checklist showing required vs received
  - **Integrates with:** Tier 1.2 (auto-remind for missing docs)

- [ ] **3.2 Document Templates**
  - Pre-built checklists per project type:
    - `business-site`: Logo, Brand guidelines, Content, Hosting credentials
    - `e-commerce`: Product images, Inventory CSV, Payment gateway keys
    - `web-app`: API specs, User stories, Wireframes
  - Auto-create requests when project created
  - **Enhances:** `project-generator.ts` (add document request generation)

---

#### TIER 4: Approval & Revision Tracking (Builds on Proposals)

**You Have:** Proposal system with status (pending, reviewed, accepted, rejected)

**Gap:** No revision history, no multi-stage approval, no deliverable tracking

- [ ] **4.1 Deliverable Tracking** (Extends milestones)
  - Add `deliverables` table:
    - `id`, `milestone_id`, `title`, `description`, `file_id`
    - `status`: draft, internal_review, client_review, revision_requested, approved
    - `revision_count`, `approved_at`, `approved_by`
  - Each milestone can have multiple deliverables
  - Client can approve/request changes per deliverable
  - **Enhances:** `portal-projects.ts` (deliverable approval UI)

- [ ] **4.2 Revision History**
  - Add `deliverable_revisions` table:
    - `id`, `deliverable_id`, `version`, `file_id`, `notes`
    - `uploaded_at`, `uploaded_by`
  - Track each version of a deliverable
  - Side-by-side comparison link
  - **Integrates with:** File upload system

- [ ] **4.3 Approval Workflow States**
  - Update `deliverables.status` flow:
    - Draft → Internal Review → Client Review → Approved (or → Revision Requested)
  - Auto-update milestone progress when deliverables approved
  - **Integrates with:** Tier 1.3 workflow triggers

---

#### TIER 5: Financial Enhancements (Builds on Invoice System)

**You Have:** Invoice generation, status tracking, payment method fields

**Gap:** No recurring, no deposits, no payment reminders, no expense tracking

- [ ] **5.1 Payment Reminders** (Quick Win - uses Tier 1.2)
  - Add invoice reminder templates to `email-service.ts`
  - Trigger: 3 days before due, on due date, 3 days after, 7 days after
  - Track in `reminder_log` to prevent spam
  - **Enhances:** `invoice-service.ts`, `reminder-service.ts`

- [ ] **5.2 Deposit/Payment Plans**
  - Add to `invoices` table: `is_deposit` (bool), `parent_invoice_id`
  - Add `payment_schedule` table:
    - `id`, `project_id`, `total_amount`, `schedule_type` (milestone, percentage)
    - `installments` (JSON: [{amount, due_date, invoice_id}])
  - Auto-generate milestone-linked invoices
  - **Enhances:** `invoice-generator.ts`

- [ ] **5.3 Recurring Invoices**
  - Add `recurring_invoices` table:
    - `id`, `client_id`, `template` (JSON), `frequency` (monthly, quarterly)
    - `next_due_date`, `last_generated_at`, `active`
  - Scheduler job (Tier 1.1) generates invoices on schedule
  - **Enhances:** `scheduler-service.ts`, `invoice-service.ts`

- [ ] **5.4 Expense Tracking** (New feature)
  - Add `expenses` table:
    - `id`, `project_id`, `description`, `amount`, `category`
    - `billable` (bool), `invoice_id` (if passed through)
    - `receipt_file_id`, `created_at`
  - Admin UI: Log expenses per project
  - Option to add to client invoice as line item

- [ ] **5.5 Time Tracking** (Enables profitability reporting)
  - Add `time_entries` table:
    - `id`, `project_id`, `milestone_id` (optional), `description`
    - `start_time`, `end_time`, `duration_minutes`
    - `billable` (bool), `hourly_rate`, `invoice_id`
    - `created_by`, `created_at`
  - Admin UI: Timer widget (start/stop) or manual entry
  - Per-project time summary: total hours, billable vs non-billable
  - Compare actual time vs estimated (from project timeline)
  - **Enables:** Profitability reporting in Tier 6 (actual cost vs revenue)
  - **Optional:** Client-visible time log (transparency feature)

---

#### TIER 6: Analytics & Reporting (Enhances Existing)

**You Have:** Visitor tracking, page views, basic project metrics

**Gap:** No business metrics, no client health scores, no revenue forecasting

- [ ] **6.1 Business Metrics Dashboard**
  - New admin panel section: "Business Overview"
  - Metrics from existing data:
    - Active projects count, completed this month
    - Revenue: invoices paid this month/quarter/year
    - Pipeline: proposals pending value
    - Client count: active vs inactive
  - **New endpoint:** `GET /api/admin/business-metrics`
  - **Uses:** Existing `projects`, `invoices`, `proposals`, `clients` tables

- [ ] **6.2 Client Health Score** (Builds on At-Risk Flagging)
  - Computed score per client based on:
    - Response time (avg days to reply)
    - Payment history (on-time %)
    - Project completion rate
    - Engagement (file uploads, messages)
  - Display in admin clients list
  - **Integrates with:** Tier 1 reminder engine

- [ ] **6.3 Revenue Forecasting**
  - Project pipeline value by status
  - Expected revenue by month (based on invoice due dates)
  - Recurring revenue projection (if Tier 5.3 implemented)
  - **Enhances:** `admin-analytics.ts`

---

#### TIER 7: Security Enhancements

**You Have:** JWT auth, bcrypt passwords, audit logs (already!), rate limiting

**Note:** Audit logs already exist (migration 012) - no need to build

- [ ] **7.1 Session Management** (Quick Win)
  - Track active sessions in `sessions` table
  - Show "Active Sessions" in admin settings
  - "Log out all sessions" button
  - Auto-expire inactive sessions
  - **Enhances:** `auth.ts`, `auth-store.ts`

- [ ] **7.2 Multi-Factor Authentication (MFA)**
  - TOTP-based (Google Authenticator compatible)
  - Add `users.mfa_secret`, `users.mfa_enabled` fields
  - Enrollment flow: generate secret, show QR, verify code
  - Login flow: if MFA enabled, require code after password
  - **New files:** `server/services/mfa-service.ts`

- [ ] **7.3 OAuth/SSO** (Future - higher complexity)
  - Google Sign-In for clients
  - Passport.js integration
  - **Deferred:** Evaluate need based on client requests

---

#### TIER 8: Polish & Delight (Final Touch)

**Build last - everything else should be solid first**

- [ ] **8.1 Virtual Tour / First-Time Walkthrough**
  - Interactive guided tour for new users on first portal login
  - Highlight key areas: Dashboard, Projects, Files, Messages, Invoices
  - Step-by-step tooltips with "Next" / "Skip" buttons
  - Track completion in `users.onboarding_completed` flag
  - Only shows once (or "Show tour again" in settings)
  - **Implementation options:**
    - Library: `intro.js`, `shepherd.js`, or `driver.js` (all lightweight)
    - Custom: GSAP-animated tooltips with focus highlights
  - **Triggers:** First login after account creation
  - **Enhances:** `client-portal.ts` (check flag, init tour)
  - **Priority:** P4 (final polish after core features complete)

- [ ] **8.2 Visual Proofing & Annotation**
  - Allow clients to pin comments directly on design images/PDFs
  - Click on image → place marker → add comment
  - Threaded replies per annotation
  - Resolve/unresolve annotations
  - Add `annotations` table:
    - `id`, `deliverable_id`, `file_id`, `x_percent`, `y_percent`
    - `comment`, `resolved`, `created_by`, `created_at`
  - Add `annotation_replies` table for threads
  - **Implementation options:**
    - Library: `annotorious`, `markerjs`, or custom canvas overlay
    - PDF: `pdf.js` with custom annotation layer
  - **Complexity:** High - requires canvas/SVG overlay, coordinate tracking
  - **Depends on:** 4.1 Deliverable Tracking
  - **Priority:** P4 (nice-to-have, evaluate after core approval workflow)

- [ ] **8.3 Visual Workflow Builder**
  - Drag-and-drop UI for creating automation workflows
  - Node-based editor: Trigger → Conditions → Actions
  - Trigger types: intake, proposal accepted, invoice overdue, milestone complete
  - Action types: send email, create task, update status, notify admin
  - Conditions: if project type = X, if budget > Y
  - Store as JSON in `workflow_templates` table
  - **Implementation options:**
    - Library: `rete.js`, `react-flow`, `flowy`, or custom SVG
    - Simpler: Form-based builder (dropdown triggers/actions) before full visual
  - **Complexity:** High - significant UI work, state management
  - **Depends on:** 1.4 Workflow Triggers (backend must exist first)
  - **Priority:** P4 (build form-based version first, visual later)

- [ ] **8.4 Mobile App / Push Notifications**
  - Native mobile experience for client portal
  - Push notifications for: new messages, status changes, invoice due
  - **Options (in order of complexity):**
    1. **PWA Enhancement** (Low effort) - Improve existing PWA, add push via service worker
    2. **React Native wrapper** (Medium) - Wrap web app in native shell
    3. **Native app** (High) - Full iOS/Android apps
  - Push notification service: Firebase Cloud Messaging (FCM) or OneSignal
  - Add `push_subscriptions` table:
    - `id`, `user_id`, `endpoint`, `keys`, `created_at`
  - **Recommendation:** Start with PWA push notifications, evaluate native later
  - **Priority:** P4 (PWA push is achievable, native app is major undertaking)

---

#### IMPLEMENTATION PRIORITY MATRIX

| Feature | Effort | Impact | Dependencies | Priority |
|---------|--------|--------|--------------|----------|
| 1.1 Scheduler | Low | High | None | **P0** |
| 2.1 Activity Feed | Low | High | None | **P0** |
| 2.4 Unread Badges | Low | Medium | None | **P0** |
| 1.2 Reminder Engine | Medium | High | 1.1 | **P1** |
| 1.3 Welcome Flow | Low | High | None | **P1** |
| 5.1 Payment Reminders | Low | High | 1.2 | **P1** |
| 3.1 Document Requests | Medium | High | 1.2 | **P1** |
| 2.2 Client Timeline | Medium | High | None | **P1** |
| 6.1 Business Metrics | Medium | High | None | **P1** |
| 2.5 Knowledge Base | Low | Medium | None | **P1** |
| 4.1 Deliverable Tracking | Medium | High | None | **P2** |
| 5.2 Deposits/Plans | Medium | Medium | None | **P2** |
| 1.4 Workflow Triggers | High | High | 1.1, 1.2 | **P2** |
| 4.2 Revision History | Medium | Medium | 4.1 | **P2** |
| 5.3 Recurring Invoices | Medium | Medium | 1.1 | **P2** |
| 7.1 Session Management | Low | Medium | None | **P2** |
| 5.5 Time Tracking | Medium | High | None | **P2** |
| 6.2 Client Health Score | Medium | Medium | 1.2 | **P3** |
| 5.4 Expense Tracking | Medium | Low | None | **P3** |
| 7.2 MFA | High | Medium | None | **P3** |
| 6.3 Revenue Forecasting | Medium | Medium | 6.1, 5.5 | **P3** |
| 8.1 Virtual Tour | Medium | Medium | All core features | **P4** |
| 8.2 Visual Proofing | High | Medium | 4.1 | **P4** |
| 8.3 Workflow Builder UI | High | Medium | 1.4 | **P4** |
| 8.4 Mobile/Push | Medium-High | Medium | None | **P4** |

---

#### QUICK START: P0 Items (Can Build This Week)

1. **Scheduler Service** - Add `node-cron`, create service, run daily job
2. **Activity Feed** - Single API endpoint aggregating recent items, simple portal UI
3. **Unread Badges** - Query counts, add badges to portal nav

These three unlock everything else and provide immediate visible value.

---

- [ ] **Kanban Board & Timeline View** - Visual management for projects

**Status:** PLANNING
**Observed:** January 28, 2026

### Deep Dive Investigation (January 28, 2026)

#### Current State Analysis

**Current Project Management:**
- Projects displayed in table format (`admin/index.html` lines 425-484)
- Table columns: Project Name, Client, Type, Budget, Timeline, Start Date, End Date, Status
- Status values: `pending`, `in-progress`, `in-review`, `completed`, `on-hold`
- Priority values: `low`, `medium`, `high`, `urgent`
- Progress: 0-100 integer
- Dates: `start_date`, `estimated_end_date`, `actual_end_date`
- API endpoint: `GET /api/projects/` returns projects with stats (file_count, message_count, unread_count)
- Module: `src/features/admin/modules/admin-projects.ts` handles project rendering and management

**Database Schema:**
- `projects` table has all necessary fields for Kanban/Timeline
- `project_updates` table exists for timeline entries (id, project_id, title, description, update_type, author, created_at)
- Update types: `progress`, `milestone`, `issue`, `resolution`, `general`

**Tech Stack:**
- Vanilla TypeScript (no heavy UI frameworks)
- CSS with CSS Variables and cascade layers
- Chart.js for charts (could be useful for timeline visualization)
- Modular architecture with dynamic imports
- Admin dashboard uses tab-based navigation

#### Requirements

**Kanban Board Features:**
1. **Column-Based Organization**
   - Columns: Pending → In Progress → In Review → Completed (with optional On Hold column)
   - Drag-and-drop to move projects between columns
   - Visual status indicators (color-coded cards)
   - Card displays: Project name, client, priority badge, progress bar, due date, unread messages count

2. **Card Information**
   - Project name (clickable to open details)
   - Client name/company
   - Priority indicator (color-coded badge: urgent=red, high=orange, medium=yellow, low=gray)
   - Progress percentage with visual bar
   - Due date (estimated_end_date) with overdue highlighting
   - Unread messages badge
   - File count indicator
   - Quick actions: View Details, Edit, Quick Status Change

3. **Filtering & Sorting**
   - Filter by: Client, Priority, Project Type, Budget Range
   - Sort by: Due Date, Priority, Progress, Created Date
   - Search by project name or client
   - Toggle between Kanban and Table view

**Timeline View Features:**
1. **Gantt-Style Timeline**
   - Horizontal timeline showing project durations
   - Projects as bars positioned by start_date and end_date
   - Color-coding by status or priority
   - Milestones as markers on timeline
   - Today indicator line
   - Zoom levels: Month, Quarter, Year view

2. **Project Bars**
   - Bar length represents duration (start_date to estimated_end_date)
   - Progress shown as filled portion of bar
   - Hover shows: Project name, client, progress %, days remaining
   - Click to open project details
   - Drag to reschedule (update start_date/end_date)

3. **Milestones & Updates**
   - Display project_updates as markers on timeline
   - Milestone type updates shown as special markers
   - Group updates by project
   - Click milestone to see update details

4. **Overlap Detection**
   - Visual indication when projects overlap
   - Resource allocation view (shows workload)
   - Warning for projects exceeding capacity

#### Implementation Plan

**Phase 1: Foundation & Data Layer**

1. **API Enhancements**
   - Add `GET /api/projects/timeline` endpoint
     - Returns projects with calculated durations, overlaps, and milestones
     - Supports date range filtering
   - Add `PUT /api/projects/:id/position` endpoint
     - Updates project status (for Kanban drag-drop)
     - Updates start_date/end_date (for Timeline drag)
   - Add `GET /api/projects/milestones` endpoint
     - Returns all milestones grouped by project
     - Includes update_type='milestone' from project_updates table

2. **Database Considerations**
   - No schema changes needed (all fields exist)
   - Consider adding index on `status` and `start_date` for performance
   - Verify `project_updates` table has proper indexes

**Phase 2: Kanban Board Implementation**

1. **File Structure**
   ```
   src/features/admin/modules/
   ├── admin-projects.ts (existing - extend)
   └── admin-projects-kanban.ts (new)
   
   src/features/admin/components/
   └── kanban-board.ts (new - reusable component)
   
   src/styles/admin/
   └── kanban-board.css (new)
   ```

2. **Kanban Component Architecture**
   - `KanbanBoard` class manages board state
   - `KanbanColumn` class for each status column
   - `KanbanCard` class for project cards
   - Drag-and-drop using HTML5 Drag API (no external library)
   - State management: track dragged card, target column, position

3. **UI Integration**
   - Add view toggle button in projects tab header (Table/Kanban/Timeline)
   - Replace table container with Kanban board container when Kanban view selected
   - Maintain existing filter/search functionality
   - Stats cards remain at top (Total, Active, Completed, On Hold)

4. **Drag-and-Drop Implementation**
   - Use native HTML5 drag events (dragstart, dragover, drop)
   - Visual feedback: ghost image, drop zones highlight
   - API call on drop: `PUT /api/projects/:id` with updated status
   - Optimistic UI update with rollback on error
   - Toast notification on success

**Phase 3: Timeline View Implementation**

1. **File Structure**
   ```
   src/features/admin/modules/
   └── admin-projects-timeline.ts (new)
   
   src/features/admin/components/
   └── timeline-view.ts (new - reusable component)
   
   src/styles/admin/
   └── timeline-view.css (new)
   ```

2. **Timeline Component Architecture**
   - `TimelineView` class manages timeline state
   - `TimelineProjectBar` class for each project bar
   - `TimelineMilestone` class for milestone markers
   - Canvas or SVG for rendering (consider using Chart.js or custom SVG)
   - Date calculation utilities for positioning bars

3. **Timeline Rendering**
   - Calculate date range from all projects (min start_date to max end_date)
   - Convert dates to pixel positions based on zoom level
   - Render project bars as SVG rectangles or divs with absolute positioning
   - Progress shown as gradient or filled portion
   - Today line as vertical indicator
   - Milestones as markers positioned by created_at date

4. **Interactions**
   - Click bar → open project details
   - Drag bar → reschedule project (updates start_date/end_date)
   - Hover → tooltip with project info
   - Zoom controls: Month/Quarter/Year buttons
   - Scroll horizontally to navigate timeline
   - Vertical scroll for multiple projects

**Phase 4: Integration & Polish**

1. **View Switching**
   - Add view selector in projects tab header
   - Persist view preference in localStorage
   - Maintain filter state across view switches
   - Ensure all views use same data source

2. **Performance Optimization**
   - Virtual scrolling for Kanban (if many projects)
   - Lazy loading for timeline (load projects in viewport)
   - Debounce drag operations
   - Cache project data with TTL (already exists in API)

3. **Accessibility**
   - Keyboard navigation for Kanban (arrow keys to move cards)
   - ARIA labels for drag-and-drop
   - Screen reader announcements for status changes
   - Focus management when switching views

4. **Mobile Responsiveness**
   - Kanban: Stack columns vertically on mobile, horizontal scroll
   - Timeline: Horizontal scroll with zoom controls
   - Touch-friendly drag-and-drop (touch events)

#### Technical Decisions

**Drag-and-Drop Library:**
- **Decision:** Use native HTML5 Drag API
- **Rationale:** No external dependencies, lightweight, good browser support
- **Alternative considered:** SortableJS or dnd-kit (rejected to keep bundle size small)

**Timeline Rendering:**
- **Decision:** Custom SVG-based rendering
- **Rationale:** Full control, no external dependencies, performant
- **Alternative considered:** Chart.js timeline plugin (rejected - overkill for this use case)

**State Management:**
- **Decision:** Module-level state with event-driven updates
- **Rationale:** Consistent with existing admin module pattern
- **No global state library needed** (keep it simple)

**View Persistence:**
- **Decision:** localStorage for view preference
- **Rationale:** Simple, no backend changes needed
- **Key:** `admin-projects-view-preference` = `'table' | 'kanban' | 'timeline'`

#### File Changes Summary

**New Files:**
- `src/features/admin/modules/admin-projects-kanban.ts` (~500 lines)
- `src/features/admin/modules/admin-projects-timeline.ts` (~600 lines)
- `src/features/admin/components/kanban-board.ts` (~400 lines)
- `src/features/admin/components/timeline-view.ts` (~500 lines)
- `src/styles/admin/kanban-board.css` (~300 lines)
- `src/styles/admin/timeline-view.css` (~400 lines)

**Modified Files:**
- `admin/index.html` - Add view toggle buttons, containers for Kanban/Timeline
- `src/features/admin/modules/admin-projects.ts` - Add view switching logic
- `src/features/admin/modules/index.ts` - Register new modules
- `server/routes/projects.ts` - Add timeline endpoint, position update endpoint

**Estimated Implementation Time:**
- Phase 1 (API): 4-6 hours
- Phase 2 (Kanban): 12-16 hours
- Phase 3 (Timeline): 16-20 hours
- Phase 4 (Integration): 6-8 hours
- **Total: 38-50 hours** (~1-1.5 weeks of focused work)

#### Success Criteria

1. ✅ Projects can be dragged between Kanban columns
2. ✅ Status updates persist via API
3. ✅ Timeline shows all projects with correct dates
4. ✅ Timeline milestones display correctly
5. ✅ View switching works smoothly
6. ✅ Filters work in all views
7. ✅ Mobile responsive
8. ✅ Accessible (keyboard navigation, screen readers)
9. ✅ Performance: <100ms drag response, <500ms timeline render for 50 projects

#### Next Steps

1. Review and approve implementation plan
2. Create feature branch: `feature/kanban-timeline-view`
3. Start with Phase 1 (API endpoints)
4. Implement Kanban board (Phase 2)
5. Implement Timeline view (Phase 3)
6. Integration and testing (Phase 4)
7. User testing and feedback
8. Polish and optimize

- [ ] **Smart Scheduling** - Based on real data of how long it takes me to complete tasks, schedule projects and milestones accordingly.

**Status:** PLANNING
**Observed:** January 28, 2026

### Deep Dive Investigation (January 28, 2026)

#### What “Smart Scheduling” Means (in this system)

Goal: use **your actual historical throughput** to produce a **best-effort schedule** for:
- Projects (start → estimated end)
- Milestones (target dates)
- Optional “capacity” planning (don’t overbook)

This is expected to be **inaccurate at first** (cold start). The system should be honest about confidence and improve over time.

#### Current State Analysis (what we can leverage today)

- **Project fields already exist** in DB: `start_date`, `estimated_end_date`, `actual_end_date`, `status`, `priority`, `progress` (`server/database/migrations/001_initial_schema.sql`).
- **Timeline data structure already exists**: `project_updates` table (can be used as “events”, but not a structured plan).
- **Admin UI already has a Projects module** and (planned) Kanban/Timeline views where scheduling outputs can be visualized.
- **Missing today**:
  - No structured “milestone plan” entity in DB (milestones list appears in UI, but needs consistent storage for scheduling).
  - No notion of “work logs” / “time to complete” per milestone.
  - No capacity model (hours/week) or calendar constraints.

#### Data Model Needed (minimum viable → evolving)

**Phase 1 (MVP, low risk): infer duration from history**
- Store “what was planned” vs “what happened”:
  - milestone: `created_at`, `target_date` (planned), `completed_at` (actual)
  - project: existing `start_date`, `estimated_end_date`, `actual_end_date`
- Store derived metrics (can be computed, but caching helps):
  - median lead time per milestone type/category
  - per-project-type baseline durations

**Phase 2 (better predictions): add features**
- Add “complexity” / “size” input (very small/small/medium/large) at project + milestone level.
- Add “work type” label (design, dev, copy, QA, deploy).
- Add “blocked” windows (pause time shouldn’t count as effort time).

**Phase 3 (capacity-aware): model your time**
- Weekly capacity (default, editable): e.g. 20–30 focused hours/week.
- Optional working days/time off (simple overrides, not full calendar integration initially).

#### Scheduling Approach (start simple, then improve)

**Cold start (expected inaccurate):**
- Use fixed defaults per project type:
  - e.g. `business-site` baseline = 2–4 weeks, `web-app` baseline = 6–10 weeks, etc.
- Or use one global default + wide uncertainty band.
- Show **confidence: low** until there are enough completed items.

**After some history exists:**
- Use **robust statistics** (median + IQR) to avoid outliers:
  - milestone lead time = `completed_at - created_at` (or `completed_at - started_at` if tracked)
  - project lead time = `actual_end_date - start_date`
- Predict:
  - `estimated_end_date = start_date + sum(predicted milestone durations)` (bounded)
- Show **confidence bands**:
  - low/medium/high confidence based on sample size + variance

**Capacity-aware scheduling (later):**
- Convert durations into “work units” and place sequentially onto a weekly capacity timeline.
- Allow priorities to reorder the queue.

#### UI/UX Outputs (what the user sees)

**In Projects UI (Table/Kanban/Timeline):**
- **Suggested end date** (and range) for each project
- **Suggested milestone target dates**
- **Confidence badge** (Low/Med/High) + "based on N similar items"
- "Why" tooltip:
  - "Based on median 9 days for 'Milestone: Design Review' over 12 completed milestones"

**At-Risk Indicators:**
- **Risk badge** on project cards/rows (Warning/Critical)
- **Risk icon** with tooltip explaining the trigger:
  - "Client hasn't responded in 12 days"
  - "Progress stalled - no updates in 9 days"
  - "Deadline in 5 days, only 30% complete"
- **At-Risk Projects panel** in admin dashboard:
  - Filtered view showing only flagged projects
  - Sorted by severity (Critical first)
  - Quick actions: Send reminder, Update status, Extend deadline
- **Daily/Weekly digest** (optional email):
  - Summary of at-risk projects
  - Suggested actions

**Controls:**
- Set weekly capacity (simple number)
- Toggle: "Include weekends" / "Workdays only"
- Override per project: "Hard deadline" (warn if predicted miss)
- **Risk threshold settings:**
  - Days without client response (default: 7)
  - Days without progress update (default: 5)
  - Deadline proximity warning (default: 7 days)
  - Completion % threshold for deadline risk (default: 50%)

#### API + Storage Plan

**New endpoints (admin-only):**
- `GET /api/projects/schedule`:
  - returns projects + computed schedule fields (suggested dates, confidence, assumptions)
- `POST /api/projects/:id/milestones` / `PUT /api/projects/:id/milestones/:mid`:
  - create/update milestones with target/completed dates and type/size
- `PUT /api/settings/scheduling`:
  - store global scheduling prefs (capacity, workdays, etc.)
- `GET /api/projects/at-risk`:
  - returns projects with active risk flags
  - includes: risk_type, severity, triggered_at, reason
- `PUT /api/settings/risk-thresholds`:
  - update risk detection thresholds
- `POST /api/projects/:id/send-reminder`:
  - quick action to nudge client (uses existing email system)

**DB changes (proposed):**
- Add `project_milestones` table (if not already present in schema):
  - `id`, `project_id`, `title`, `type`, `size`, `target_date`, `completed_at`, `created_at`, `updated_at`
- Add `scheduling_settings` table (single row keyed by admin user or global):
  - `weekly_capacity_hours`, `workdays_mask`, `updated_at`
- Add `risk_settings` table (global thresholds):
  - `id`, `silent_days_warning` (default 7), `silent_days_critical` (default 14)
  - `stalled_days_warning` (default 5), `stalled_days_critical` (default 10)
  - `deadline_proximity_days` (default 7), `deadline_completion_threshold` (default 50)
  - `updated_at`
- Add computed fields to projects query (or cache):
  - `last_client_activity_at` (derived from messages, file uploads)
  - `last_progress_update_at` (derived from project_updates or progress changes)
  - `risk_flags` (JSON array of active flags with reasons)

#### Implementation Plan

**Build Order Flexibility:**
- Phase 2.5 (At-Risk Flagging) can be built **first** - no dependencies on scheduling
- Phases 1-4 should be built in order
- At-Risk Flagging provides immediate value with minimal complexity

**Phase 1: MVP (honest + useful, even if inaccurate)**
- Add milestones storage (if missing) + basic CRUD
- Implement `/api/projects/schedule` returning:
  - naive estimates + wide ranges + confidence=low
- UI: show "Suggested end date" + confidence in projects table + timeline overlay

**Phase 2: Learning from real completion**
- Record milestone completion timestamps
- Compute rolling medians by:
  - milestone type
  - project type
  - (optional) size
- Update schedule endpoint to use learned medians + variance bands

**Phase 2.5: At-Risk Project Flagging (can build early, rule-based)**
- **Note:** This phase can be implemented independently, even before Phase 1/2
- No ML or historical data required - pure rule-based detection
- Implementation steps:
  1. Add `risk_settings` table + API endpoint
  2. Create `RiskDetectionService` that queries:
     - Last message from client per project
     - Last progress update per project
     - Days until deadline vs completion %
  3. Add `GET /api/projects/at-risk` endpoint
  4. Add risk badges to project table/cards
  5. Add At-Risk Projects panel to admin dashboard
  6. (Optional) Add daily digest email via existing email system
- Proactive alerts before problems escalate
- Rule-based triggers (no ML needed):
  - **Client Gone Silent**: No client response/activity in X days (configurable, default 7)
  - **Progress Stalled**: No status updates or progress change in X days
  - **Deadline Risk**: Approaching deadline with low completion % (e.g., 7 days left, <50% done)
  - **Overdue**: Past estimated_end_date and not completed
  - **Budget Burn Risk**: If tracking hours, burn rate exceeds budget pace
  - **Pending Approvals**: Items waiting for client approval > X days
- Risk severity levels: Warning (yellow), Critical (red)
- Configurable thresholds per project or global defaults

**Phase 3: Capacity-aware scheduling**
- Add scheduling settings (weekly capacity)
- Implement simple queueing:
  - order by priority, then start dates
  - allocate predicted work onto weeks
- UI: warnings for over-capacity weeks and missed deadlines

**Phase 4: Quality + trust**
- “Explain this schedule” panel per project
- Backtesting view:
  - show last N completed projects predicted vs actual
- Guardrails:
  - never silently overwrite user-set dates; always suggest vs apply

#### Success Criteria

**Scheduling:**
1. ✅ Produces a schedule even with zero history (explicitly low confidence)
2. ✅ Improves estimates automatically once completions exist
3. ✅ Shows "why" + confidence (trust-building)
4. ✅ Never overrides user-entered dates without confirmation
5. ✅ Integrates into Timeline view cleanly (suggested bars/ranges)

**At-Risk Flagging:**
6. ✅ Flags projects meeting risk criteria within 1 hour of trigger condition
7. ✅ Risk badges visible in Table, Kanban, and Timeline views
8. ✅ Configurable thresholds (not hardcoded)
9. ✅ "Why flagged" explanation always available
10. ✅ Quick actions to resolve risk (send reminder, update status)
11. ✅ At-Risk panel shows all flagged projects in one place
12. ✅ Flags auto-clear when condition resolves (client responds, progress updates)

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
