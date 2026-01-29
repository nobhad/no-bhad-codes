# Current Work

**Last Updated:** January 29, 2026 (CSS Shared Component Consolidation)

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## Pending Verification

Recent fixes that need user testing:

- [ ] **Contract PDF Generation** - Test `GET /api/projects/:id/contract/pdf`
  - Navigate to a project with contract data
  - Download contract PDF and verify branding/content

- [ ] **File Preview** - Test preview for different file types
  - [x]  JSON files: Should open in modal with formatted JSON
  **ISSUE:** does work correctly, but it should look more like the email that I get from INAKE  bc a client never needs to see
  - [x]  Text/MD files: Should open in modal with text content
  - [x]  Images: Should open in modal with image display (scaled to fit via .file-preview-image, max-height 50vh; fixed January 28, 2026)
  - [x]  PDFs: Should open in new tab

- [x] **Edit Project Modal - All Fields** - Test editing all project fields
  - Open a project > Click Edit (pencil icon)
  - Verify all fields are populated: name, type, status, timeline, dates, description, budget, price, deposit, contract date, URLs, admin notes
  - Modify values and save
  - Verify changes appear in project overview immediately
  **ISSUE:** when i open edit modal, all fields that have info should be populated and editable.

- [ ] **Client Budget Display** - Verify budget ranges show proper formatting
  - Navigate to project details in admin
  - Verify budget shows "Under $2k" (not "Under 2k")
  - Verify ranges show en-dashes: "$2k–$5k" (not "$2k-$5k")
  - Verify decimal budgets display correctly: "$2.5k–$5k" (not "2.5k 5k")

- [x] **HTML Entity Decoding** - FIXED January 29, 2026
  - Check client names with "&" show correctly (not "&amp;")
  - Check URLs with "/" show correctly (not "&#x2F;")
  **Fixed:** Added `decodeHtmlEntities()` before `escapeHtml()` in all user-facing data rendering:
  - `admin-clients.ts` - billing fields
  - `admin-messaging.renderer.ts` - thread client name, subject, message content
  - `admin-contacts.renderer.ts` - contact table and modal
  - `admin-contacts.ts` - contact table and detail view
  - `admin-dashboard.ts` - contact submissions table and modal, messages
  - `admin-messaging.ts` - messages
  - `admin-proposals.ts` - client name, company, project name, features, notes

- [x] **URL Links Styling** - Verify URL links are red and clickable
  - Check Preview URL, Repository URL, Production URL links
  - Links should be red (primary color)
  - Links should open in new tab
  - External-link icon added next to each URL to indicate new-tab (fixed January 28, 2026)

- [ ] **Client Portal Profile Settings** - Test profile update refresh
  - Update contact name, company, or phone in client portal settings
  - Save and verify values refresh immediately (no page reload needed)

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
  - **Issue:** Nothing on project detail page / client details page indicates that the user has not yet been invited.
  - Files modified: `server/routes/clients.ts`, `src/features/admin/modules/admin-clients.ts`, `src/styles/pages/admin.css`

---

## Known Concerns

### PDFs & Documents

- [x] #### PDF Branding Logo - All Existing PDFs Complete
**Status:** COMPLETE (for existing PDF types)
**Observed:** January 27, 2026
**Updated:** January 29, 2026

All existing PDF types now have branding logo:

- [x] Invoice PDFs - Already had logo
- [x] Project proposal PDFs - COMPLETE (January 28, 2026)
- [x] Project contract PDFs - COMPLETE (January 28, 2026)

**Note:** "Website Audit PDF" feature does not exist in codebase - would need to be built as a new feature if needed.

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
- **Fixed (January 28, 2026):** Contract PDF and Proposal PDF routes now use `avatar_pdf.png` (were `avatar_small-1.png`).

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

- [x] #### Client Name / Billing Name - Ampersand Double-Encoded (&amp;amp; instead of &)

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Issue:** Client names (and billing names) containing "&" displayed as "&amp;amp;" instead of "&". Example: "Emily Gold & Abigail Wolf" showed as "Emily Gold &amp;amp; Abigail Wolf" in Client Details and Billing Details (admin dashboard).

**Fix Applied:** Decode before escape when rendering: use `decodeHtmlEntities()` then `escapeHtml()` (or `capitalizeName`) for contact_name, company_name, billing_name in admin-clients (table + detail) and for contact_name in admin-leads (table, detail, recent activity).

**Files modified:** `src/features/admin/modules/admin-clients.ts`, `src/features/admin/modules/admin-leads.ts`

**Expected:** Display "&" correctly (e.g. "Emily Gold & Abigail Wolf").

- [x] #### Client Edit - Email Update Not Working (Clients Page)

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

**Issue:** Updating a client's email from the admin Clients page did not work. Updating name, company, and phone did work; only email failed to save/update.

**Fix Applied:** `PUT /api/clients/:id` did not accept or persist `email`. Added `email` to the handler: admins can update email; validate format and uniqueness (excluding current client); normalize to lowercase. Also set `updated_at = CURRENT_TIMESTAMP` on update.

**Files modified:** `server/routes/clients.ts`

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

- [x] #### Project Type - Inconsistent Throughout Codebase

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 29, 2026

Created single source of truth for project type display labels in `src/utils/format-utils.ts`.

**Fix Applied:**

1. Added `PROJECT_TYPE_LABELS` constant and `formatProjectType()` function to `format-utils.ts`
2. Removed duplicate local `formatProjectType` functions from:
   - `src/features/admin/admin-dashboard.ts`
   - `src/features/admin/modules/admin-projects.ts`
   - `src/features/admin/modules/admin-proposals.ts`
3. All modules now import and use the shared function

**Standardized Labels:**

```typescript
export const PROJECT_TYPE_LABELS: Record<string, string> = {
  'simple-site': 'Simple Website',
  'business-site': 'Business Website',
  'portfolio': 'Portfolio',
  'e-commerce': 'E-Commerce',
  'ecommerce': 'E-Commerce', // Legacy support
  'web-app': 'Web Application',
  'browser-extension': 'Browser Extension',
  'website': 'Website',
  'mobile-app': 'Mobile App',
  'branding': 'Branding',
  'other': 'Other'
};
```

**Note:** Home page form uses display-style labels intentionally (it's a Netlify form, not the intake form) and does not need to match this mapping.

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

- [x] #### Project Status - Inconsistent Format (in-progress vs in_progress)

**Status:** FIXED
**Observed:** January 28, 2026
**Fixed:** January 29, 2026

Standardized to hyphens (`in-progress`, `on-hold`) to match database schema. Added backwards compatibility for legacy underscore values.

**Files Updated (January 29, 2026):**

**TypeScript Types:**

- `src/types/api.ts` - LeadStatus and ProjectStatus now use hyphens
- `src/features/admin/admin-types.ts` - Lead and Project interfaces now use hyphens

**Utilities:**

- `src/utils/table-dropdown.ts` - normalizeStatus converts underscores TO hyphens, label map supports both formats, LEAD_STATUS_OPTIONS uses hyphens
- `src/utils/table-filter.ts` - Status filter normalization uses hyphens, LEADS_FILTER_CONFIG and PROJECTS_FILTER_CONFIG use hyphens

**Admin Modules:**

- `src/features/admin/modules/admin-projects.ts` - LeadProject interface uses hyphens, normalizeStatus converts to hyphens, status labels support both formats
- `src/features/admin/modules/admin-leads.ts` - Status comparisons use hyphens
- `src/features/admin/admin-project-details.ts` - Status labels support both formats, CSS class uses normalized hyphen format
- `src/features/admin/services/admin-chart.service.ts` - Chart data interface uses hyphens

**Validation:**

- `shared/validation/schemas.ts` - projectUpdateSchema and leadStatusSchema accept both formats for backwards compatibility

**CSS:**

- `src/styles/pages/admin.css` - Added hyphen versions of status classes (supports both)
- `src/styles/admin/project-detail.css` - Added hyphen versions of status classes (supports both)

**Note:** All status label and CSS class mappings include both hyphen and underscore keys for backwards compatibility with any existing data.

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

- [x] #### Date Formatting - Inconsistent Formats Across Codebase

**Status:** DONE
**Observed:** January 28, 2026
**Utilities Created:** January 28, 2026
**Integration Completed:** January 28, 2026

**Utilities** (`src/utils/format-utils.ts`):

- `formatDate(dateString)` - Returns "Jan 28, 2026" format
- `formatDateTime(dateString)` - Returns "Jan 28, 2026, 2:30 PM" format
- `formatDateForInput(dateString)` - Returns "YYYY-MM-DD" for input fields
- `formatRelativeTime(dateString)` - Returns "2 hours ago", "3 days ago", etc.

**Integration:** All local date formatting has been replaced with these utilities across admin and client code.

**Files updated:** `admin-projects`, `admin-proposals`, `admin-project-details`, `admin-leads`, `admin-clients`, `admin-contacts`, `admin-dashboard`, `admin-messaging`, `admin-analytics` (session start_time), `admin-messaging.renderer`, `admin-contacts.renderer`, `client-portal`. Portal modules (invoices, messages, files) use `ctx.formatDate` from context, which now uses the shared util. Chart weekday labels (`toLocaleDateString('en-US', { weekday: 'short' })`) in admin-analytics left as-is for chart-specific format.

- [x] #### Error Handling - User-Facing Messages Instead of error.message

**Status:** COMPLETE
**Observed:** January 28, 2026
**Fixed:** January 29, 2026

Raw `error.message` and API `error.message` / `err?.message` no longer shown to users in most paths. `console.error` / logger still use the real error for debugging.

**Completed Fixes:**

**Client / Auth (high traffic):**

- [x] `portal-auth.ts` - Login catch: "Login failed. Please check your email and password."
- [x] `client-portal.ts` - Profile save catch: "Failed to save profile. Please try again."
- [x] `client-portal.ts` - Password update catch: "Failed to update password. Please try again."
- [x] `portal-messages.ts` - Send message catch: "Failed to send message. Please try again."

**Admin - Projects:**

- [x] `admin-projects.ts` - Save project (!ok and catch): "Failed to update project. Please try again."
- [x] `admin-projects.ts` - Create invoice (!ok and catch): "Failed to create invoice. Please try again."
- [x] `admin-projects.ts` - File upload catch: "Upload failed. Please try again."
- [x] `admin-projects.ts` - Add project (!ok and catch): "Failed to create project. Please try again."

**Admin - Leads:**

- [x] `admin-leads.ts` - Update status (!ok and catch): "Failed to update status. Please try again."
- [x] `admin-leads.ts` - Activate lead (!ok and catch): "Failed to activate lead. Please try again."
- [x] `admin-leads.ts` - Invite lead (!ok and catch): "Failed to send invitation. Please try again."

**Admin - Clients:**

- [x] `admin-clients.ts` - Send invitation (!ok and catch): "Failed to send invitation. Please try again."
- [x] `admin-clients.ts` - Add client (!ok): "Failed to add client. Please try again."

**Admin - Contacts:**

- [x] `admin-contacts.ts` - Update status (!ok and catch): "Failed to update status. Please try again."

**Admin - Project Details:**

- [x] `admin-project-details.ts` - Save project (!ok and catch): "Failed to save project. Please try again."
- [x] `admin-project-details.ts` - Add milestone (!ok and catch): "Failed to add milestone. Please try again."
- [x] `admin-project-details.ts` - Toggle milestone (!ok and catch): "Failed to update milestone. Please try again."
- [x] `admin-project-details.ts` - Delete milestone (!ok and catch): "Failed to delete milestone. Please try again."
- [x] `admin-project-details.ts` - Create invoice (!ok and catch): "Failed to create invoice. Please try again."
- [x] `admin-project-details.ts` - Upload files (!ok and catch): "Failed to upload files. Please try again."

**Additional Client Portal Fixes (January 29, 2026):**

- [x] `client-portal.ts` - `submitProjectRequest()` catch: "Failed to submit project request. Please try again."
- [x] `client-portal.ts` - `saveNotificationSettings()` catch: "Failed to save preferences. Please try again."
- [x] `client-portal.ts` - `saveBillingSettings()` catch: "Failed to save billing info. Please try again."

- [x] #### API Calls - Missing Response OK Checks Before JSON Parsing

**Status:** FIXED
**Observed:** January 28, 2026
**Partial Fix:** January 28, 2026
**Completed:** January 29, 2026

All identified cases where `response.json()` was called before checking `response.ok` have been fixed.

**Fixes Applied:**

- `admin-projects` `saveProjectChanges`: Check `response.ok` first; on !ok parse error body and `showNotification(err?.error || err?.message || '...', 'error')`; only parse JSON as result when ok.
- `admin-project-details` `toggleMilestone`: Add `else` branch on !ok — parse error body, `alertError(...)`; add `catch` → `alertError`.
- `admin-project-details` `deleteMilestone`: On !ok parse error body and show in `alertError` (was generic message only).
- `admin-dashboard` `inviteLead`: Check `response.ok` before parsing JSON; handle error responses separately.
- `admin-data.service.ts` `inviteLead`: Check `response.ok` before parsing JSON; handle error responses separately.
- `admin-clients` `handleSubmit` (edit client): Check `response.ok` before parsing JSON; handle error responses separately.

**Files Updated (January 29, 2026):**

- `src/features/admin/admin-dashboard.ts` - `inviteLead()` method fixed
- `src/features/admin/services/admin-data.service.ts` - `inviteLead()` method fixed
- `src/features/admin/modules/admin-clients.ts` - Client edit form submit fixed

**Pattern Used:**

```typescript
if (response.ok) {
  const data = await response.json();
  // Handle success
} else {
  const errorData = await response.json().catch(() => ({}));
  // Handle error with errorData.error or generic message
}
```

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

**Status:** DEFERRED - Low Impact
**Observed:** January 28, 2026
**Deferred:** January 29, 2026

**Reason for Deferral:** This issue is mostly theoretical for the current architecture. The app is not a true SPA - handlers are added once during module initialization and persist for the app lifetime. There's no hot-reload or navigation-based re-initialization that would cause handler accumulation. The risk of actual memory leaks or duplicate handlers is minimal.

**Locations Found:**

- `src/features/admin/admin-dashboard.ts` (document-level click/keydown handlers for session extension + modal escape handling)
- `src/features/client/client-portal.ts` (`setupDashboardEventListeners()` adds listeners without teardown)
- `src/components/button-component.ts` (window-level keyup handler lifecycle edge case)

**If Revisited:** Track handler references and remove them during module/component teardown.

- [ ] #### Request Cancellation - No AbortController (Race Conditions / Stale UI)

**Status:** DEFERRED - High Complexity
**Observed:** January 28, 2026
**Deferred:** January 29, 2026

**Reason for Deferral:** Implementing AbortController properly requires careful refactoring across multiple modules. Incorrect implementation could introduce new bugs (cancelled requests that shouldn't be, stale controller references, cleanup issues). The current behavior, while not optimal, is stable. Race conditions are rare in practice since users don't typically trigger rapid repeated loads.

**Locations Found:**

- `src/features/admin/admin-dashboard.ts` (multiple parallel loads on init; repeated refresh triggers)
- `src/features/client/client-portal.ts` (`loadRealUserProjects()` and per-project milestone fetches)

**If Revisited:** Use `AbortController` to cancel in-flight fetches when a newer request supersedes them, or ignore stale responses via request IDs. Requires thorough testing.

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

- [x] #### E-commerce vs Ecommerce Inconsistency - Standardized

**Status:** COMPLETE
**Observed:** January 28, 2026
**Fixed:** January 29, 2026

Standardized to `'e-commerce'` (with hyphen) to match validation schema. Added backwards compatibility for legacy `'ecommerce'` values.

**Files Updated (January 29, 2026):**

**TypeScript Types:**
- `src/types/client.ts` - ProjectType now uses `'e-commerce'`
- `src/types/project.ts` - ProjectCategory now uses `'e-commerce'`, category data uses `'e-commerce'`
- `src/features/client/proposal-builder-types.ts` - ProjectType now uses `'e-commerce'`

**Client Code:**
- `src/features/client/proposal-builder-data.ts` - Config key now `'e-commerce'`
- `src/features/client/terminal-intake-data.ts` - Options and features use `'e-commerce'`
- `src/features/admin/admin-dashboard.ts` - Type map includes both (backwards compat)
- `src/features/admin/modules/admin-proposals.ts` - Type labels include both
- `src/modules/ui/projects.ts` - Category map includes both

**Server Code:**
- `server/services/project-generator.ts` - Templates, multipliers, display names use `'e-commerce'`
- `server/services/invoice-generator.ts` - Pricing, multipliers, display names use `'e-commerce'`
- `server/routes/intake.ts` - Type names include both; condition checks both values
- `server/routes/admin.ts` - Type names include both
- `server/routes/proposals.ts` - Valid types include both

**Tests:**
- `tests/unit/services/invoice-generator.test.ts` - Uses `'e-commerce'`

**Note:** Display label mappings include both `'e-commerce'` and `'ecommerce'` keys for backwards compatibility with any existing database records.
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

- [x] #### Empty States - Generic or Unhelpful Messages

**Status:** COMPLETE
**Observed:** January 28, 2026
**Fixed:** January 29, 2026

Many empty states show generic messages that don't guide users on what to do next.

**Fixes applied:**

- **Milestones:** "No milestones defined yet." / "No milestones yet." → "No milestones yet. Add one to track progress." (admin-projects, admin-project-details)
- **Files:** "No files uploaded yet." → "No files yet. Upload files in the Files tab." / "Upload files above." (project detail)
- **Invoices:** "No invoices yet." / "No invoices created yet." → "No invoices yet. Create one in the Invoices tab." / "Create one above."
- **Leads:** "No leads found" → "No leads yet. New form submissions will appear here."; "No leads match the current filters" → add "Try adjusting your filters."
- **Projects table:** "No projects match the current filters" → add "Try adjusting your filters."
- **Client Portal Projects:** "No projects found." → "No projects yet. Submit a project request to get started!" (January 29, 2026)
- **Client Portal Messages:** "No messages in this thread yet." → "No messages in this thread yet. Send a message below to start the conversation." (January 29, 2026)
- **Client Portal Invoices:** Already had helpful message: "No invoices yet. Your first invoice will appear here once your project begins."

**Locations Found:**

- `src/features/admin/admin-project-details.ts`: Messages, files, milestones, invoices (partial updates above)
- `src/features/admin/modules/admin-projects.ts`: Projects table, files, milestones, invoices (partial updates above)
- `src/features/admin/modules/admin-leads.ts`: Leads table (updated)

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

- [x] #### Button Accessibility - Missing ARIA Labels

**Status:** COMPLETE
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

Many buttons, especially icon-only buttons, were missing `aria-label` attributes for screen reader users.

**Fix Applied:**

- **Admin:** `admin/index.html` – Edit client info, Edit billing, Edit project icon buttons now have `aria-label`. Invite button in `admin-clients.ts` has `aria-label="Send invitation email to client"`.
- **Admin proposals:** `admin-proposals.ts` – View details and Convert to invoice icon buttons have `aria-label`.
- **Table filter:** `table-filter.ts` – Clear All filters button has `aria-label="Clear all filters"`.
- **Client portal files:** `portal-files.ts` – Preview, Download, and Delete buttons use `aria-label` with filename (e.g. `Preview myfile.pdf`, `Delete myfile.pdf`).
- **Client portal preview:** `client/portal.html` – Open in new tab and Refresh preview icon buttons have `aria-label`.
- **Existing:** Contact/lead panel close buttons, admin modal close buttons, admin projects Preview/Download already had `aria-label`.

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

- [x] #### Admin Modals - No Focus Trap or Restoration

**Status:** COMPLETE (edit/add project, edit/add client). Detail modal TODO
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

Admin modals (edit project, add project, edit client, add client) now use focus trapping via `manageFocusTrap` from `src/utils/focus-trap.ts`.

**Fix Applied:**

- **Edit project modal** (`admin-projects.ts`): Focus trap on open, `role="dialog"`, `aria-modal="true"`, `aria-labelledby="edit-project-modal-title"`. Escape closes modal, focus restored on close. `closeEditProjectModal` runs cleanup and removes ARIA when hidden.
- **Add project modal** (`admin-projects.ts`): Same pattern; `aria-labelledby="add-project-modal-title"`, initial focus `#new-project-client`.
- **Edit / Add client modals** (`admin-clients.ts`): Already used `manageFocusTrap` (no change).
- **Focus trap cleanup** (`focus-trap.ts`): Cleanup now also removes `role` (in addition to `aria-modal`).

**Remaining:** Detail modal (`#detail-modal`) in `admin-dashboard.ts` used for leads/contacts still has no focus trap. Consider adding `manageFocusTrap` when that modal is shown.

- [x] #### Error Messages - Not Associated with Form Fields

**Status:** COMPLETE
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

Form validation errors are now associated with form fields using `aria-invalid` and `aria-describedby` where inline errors are shown.

**Fix Applied:**

- **Portal auth** (`portal-auth.ts`): `showFieldError` sets `aria-invalid="true"` on the field, `role="alert"` and `aria-live="polite"` on the error element, and `aria-describedby` linking the field to the error. `clearErrors` removes those attributes.
- **Contact form** (`contact-form.ts`): `showFieldError` adds `aria-invalid`, `aria-describedby`, and gives the error element an `id`, `role="alert"`, and `aria-live="polite"`. `removeErrorMessage` and `clearAllErrors` clear them.
- **form-errors.ts** already provided this pattern; portal-auth and contact-form now implement it.

- [x] #### Additional ARIA fixes (audit Jan 28, 2026)

**Status:** COMPLETE

- **Leads cancellation dialog** (`admin-leads.ts`): `showCancelledByDialog` overlay now has `aria-labelledby="cancel-dialog-title"`; the heading uses `id="cancel-dialog-title"`.
- **Focus trap** (`focus-trap.ts`): Cleanup removes `role` as well as `aria-modal` when the trap is released.
- **Edit / Add project modals:** `h3` titles use `id="edit-project-modal-title"` and `id="add-project-modal-title"` for `aria-labelledby` on the overlay.

**Not changed:** Detail modal (`#detail-modal`), duplicate `id="preview-modal-close"` in admin preview modals (JSON/text/image). Consider unique IDs or a single preview modal for future cleanup.

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

- [x] #### Admin Tables - May Not Be Fully Responsive on Mobile

**Status:** COMPLETE
**Observed:** January 28, 2026
**Fixed:** January 29, 2026

**Fix Applied:**

Added mobile-responsive CSS in `src/styles/pages/admin.css` within `@media (--small-mobile)`:

- **Leads table:** Hide Company (3rd) and Email (4th) columns
- **Projects table:** Hide Type (3rd), Timeline (5th), Start Date (6th), End Date (7th) columns
- **Contacts table:** Hide Company (4th) column
- **Clients table:** Hide Email (3rd) and Created (6th) columns
- Reduced `min-width` to 400px for better mobile fit
- Tighter cell padding on mobile
- Horizontal scroll support with proper touch scrolling

**Files Modified:**

- `src/styles/pages/admin.css` - Added mobile table responsiveness CSS

- [x] #### Toast Notifications - Good Implementation, But Inconsistent Usage

**Status:** COMPLETE (client portal + admin + code-protection)
**Observed:** January 28, 2026
**Fixed:** January 28, 2026

Toast notification system exists (`src/utils/toast-notifications.ts`) with proper `aria-live` attributes.

**Fix applied:**

- **Client Portal:** Replaced all 21 `alert()` calls with `showToast()` in:
  - `src/features/client/client-portal.ts`
  - `src/features/client/modules/portal-messages.ts`
  - `src/features/client/modules/portal-invoices.ts`
- **Admin:** No native `alert()` in admin code. Admin uses `showNotification()` / `showToast()` and custom `alertError` / `alertSuccess` / `alertWarning` (confirm-dialog modals) for feedback.
- **Code protection:** Replaced the only remaining native `alert()` in `src` — `src/services/code-protection-service.ts` devtools message — with `showToast(..., 'warning', { duration: 5000 })`.

**Reference:**

- `src/utils/toast-notifications.ts`: `aria-live="polite"` / `"assertive"`, `role="alert"`
- Admin modules use `showNotification()` (dashboard) or `showToast()` (e.g. admin-projects) and confirm-dialog for modals.

**Expected behavior:**

- Use toasts for non-critical feedback
- Use modals only for critical confirmations
- Consistent feedback pattern across application

- [ ] #### Form Inputs - Missing Placeholder Text or Help Text

**Status:** DEFERRED - Low Priority
**Observed:** January 28, 2026
**Deferred:** January 29, 2026

**Reason for Deferral:** This is a UX polish task rather than a functional issue. Forms work correctly; placeholders would improve discoverability but are not blocking any functionality. Can be addressed during a dedicated UX polish pass.

**Locations Found:**

- Admin forms: May have placeholders but need verification
- Client portal forms: Some inputs may lack helpful placeholders
- Terminal intake: Has placeholders (good)

**If Revisited:** Audit all forms and add descriptive placeholders, format hints (e.g., "YYYY-MM-DD"), and help text for complex fields.

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

- [x] **CSS SHARED COMPONENT CONSOLIDATION** - COMPLETE January 29, 2026
  - **Documentation:** [CSS_ARCHITECTURE.md](./design/CSS_ARCHITECTURE.md)
  - Created `shared/portal-badges.css` for cohesive status badge styling
  - Removed duplicate `.stat-card` from `pages/admin.css` (uses `shared/portal-cards.css`)
  - Removed duplicate `.icon-btn` from `pages/admin.css` (kept scoped version)
  - Removed duplicate `.status-badge` definitions (consolidated to shared file)
  - Client portal retains text-only badge design via scoped override
  - **Result:** 149 lines added, 164 lines removed = net 15 lines reduction

- [ ] **COMPONENT REFACTORING OPPORTUNITIES** - Replace manual DOM manipulation with reusable components
  - **Documentation:** [COMPONENT_REFACTORING_OPPORTUNITIES.md](./COMPONENT_REFACTORING_OPPORTUNITIES.md)
  - **Priority:** Medium-High
  - **Impact:** 20+ alert() calls, 5 prompt() calls, 10+ manual button creations, 3 manual modal handlers
  - **Benefits:** Consistent UX, better accessibility, easier maintenance

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

**Deep dives:**
- [CRM_CMS_DEEP_DIVE.md](./CRM_CMS_DEEP_DIVE.md) — Gap analysis vs state-of-the-art CRM/CMS (features implemented, what's missing, prioritized recommendations).
- [CLIENT_PORTAL_DEEP_DIVE.md](./CLIENT_PORTAL_DEEP_DIVE.md) — **Whole-portal** audit: every view (dashboard, messages, files, invoices, settings, etc.), static vs API-driven, and what's missing for state-of-the-art client portals.
- [TABLES_ARCHIVE_DELETE_AUDIT.md](./TABLES_ARCHIVE_DELETE_AUDIT.md) — **Tables, archive & delete:** filter/sort/export, pagination, bulk actions, archive vs delete, restore, confirm flows. Small-feature gaps and quick wins.

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

#### Build order

Build last - everything else should be solid first.

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
| --- | --- | --- | --- | --- |
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

### Deep Dive Investigation (Kanban)

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

#### Implementation Plan (Kanban)

##### Phase 1: Foundation & Data Layer

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

##### Phase 2: Kanban Board Implementation

1. **File Structure**

   ```text
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

##### Phase 3: Timeline View Implementation

1. **File Structure**

   ```text
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

##### Phase 4: Integration & Polish

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

#### Success Criteria (Kanban)

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

### Deep Dive Investigation (Smart Scheduling)

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

##### Phase 1 (MVP, low risk): infer duration from history

- Store “what was planned” vs “what happened”:
  - milestone: `created_at`, `target_date` (planned), `completed_at` (actual)
  - project: existing `start_date`, `estimated_end_date`, `actual_end_date`
- Store derived metrics (can be computed, but caching helps):
  - median lead time per milestone type/category
  - per-project-type baseline durations

##### Phase 2 (better predictions): add features

- Add “complexity” / “size” input (very small/small/medium/large) at project + milestone level.
- Add “work type” label (design, dev, copy, QA, deploy).
- Add “blocked” windows (pause time shouldn’t count as effort time).

##### Phase 3 (capacity-aware): model your time

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

#### Implementation Plan (Smart Scheduling)

**Build Order Flexibility:**

- Phase 2.5 (At-Risk Flagging) can be built **first** - no dependencies on scheduling
- Phases 1-4 should be built in order
- At-Risk Flagging provides immediate value with minimal complexity

##### Phase 1: MVP (honest + useful, even if inaccurate)

- Add milestones storage (if missing) + basic CRUD
- Implement `/api/projects/schedule` returning:
  - naive estimates + wide ranges + confidence=low
- UI: show "Suggested end date" + confidence in projects table + timeline overlay

##### Phase 2: Learning from real completion

- Record milestone completion timestamps
- Compute rolling medians by:
  - milestone type
  - project type
  - (optional) size
- Update schedule endpoint to use learned medians + variance bands

##### Phase 2.5: At-Risk Project Flagging (can build early, rule-based)

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

##### Phase 3: Capacity-aware scheduling

- Add scheduling settings (weekly capacity)
- Implement simple queueing:
  - order by priority, then start dates
  - allocate predicted work onto weeks
- UI: warnings for over-capacity weeks and missed deadlines

##### Phase 4: Quality + trust

- “Explain this schedule” panel per project
- Backtesting view:
  - show last N completed projects predicted vs actual
- Guardrails:
  - never silently overwrite user-set dates; always suggest vs apply

#### Success Criteria (Smart Scheduling)

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

- Frontend: [http://localhost:4000](http://localhost:4000)
- Backend: [http://localhost:4001](http://localhost:4001)

---

## Archived Work

- January 2026: [ARCHIVED_WORK_2026-01.md](./archive/ARCHIVED_WORK_2026-01.md)
- December 2025: [ARCHIVED_WORK_2025-12.md](./archive/ARCHIVED_WORK_2025-12.md)
