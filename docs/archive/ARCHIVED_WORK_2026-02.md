# Archived Work - February 2026

This file contains completed work from February 2026. Items are moved here from `../current_work.md` once fully verified and operational.

---

## Completed - February 10, 2026

### Backend System Comprehensive Improvement Plan - Completed Sections

**Status:** ✅ COMPLETE - All sections except Database Normalization Phase 3-4

The following systems were fully implemented with comprehensive test coverage (284 unit tests total).

#### System Overview

| Feature Area | Status | Test Coverage |
|--------------|--------|---------------|
| Proposal Creator | 100% | 46 tests |
| Ad Hoc Features | 100% | 47 tests |
| Client Info Collection | 100% | 40 tests |
| Approval/Feedback | 100% | 56 tests |
| Contract System | 100% | 49 tests |
| System Integration | 100% | 24 tests (webhooks) |
| Analytics & Reporting | 100% | Integrated |

#### 1. PROJECT PROPOSAL CREATOR - Complete

- Template management admin UI (view, edit, create templates)
- Feature library and pricing rule editors
- Proposal builder with discounts, custom line items, tax configuration
- Proposal collaboration (threaded comments, activity history, version comparison)
- E-signature integration (draw/type signature, IP/timestamp capture)
- PDF enhancements (branding, signature blocks, watermarks)

#### 2. AD HOC FEATURES - Complete

- Ad hoc request system with types (feature, change, bug_fix, enhancement, support)
- Client request portal with file attachments
- Admin request management (quote builder, task conversion)
- Time tracking integration with billing
- Invoice generation (single and bundled)
- Revenue analytics dashboard widget (47 unit tests)

#### 3. CLIENT INFORMATION COLLECTION - Complete

- Unified 5-step onboarding wizard with progress save/resume
- Document collection portal with required/optional checklists
- Pre-defined document request templates by category
- Client questionnaires with conditional logic
- Information status dashboard with completeness tracking (40 unit tests)

#### 4. CLIENT APPROVAL/FEEDBACK SYSTEM - Complete

- Approval workflow admin UI (builder, step configuration, preview)
- Approval dashboard (admin and client views, bulk operations)
- Deliverable approval system with version tracking
- Design review system (annotation tools, design rounds, per-element approval)
- Automated approval reminders with escalation (56 unit tests)

#### 5. CONTRACT CREATION AND SIGNING - Complete

- Contract template system with variable substitution
- Contract builder UI (template selection, section editor, preview)
- PDF generation with branding and multi-party signature blocks
- E-signature flow (client signing, admin countersign)
- Contract management dashboard (lifecycle, amendments, renewals) (49 unit tests)

#### 6. SYSTEM INTEGRATION AND AUTOMATION - Complete

- Workflow trigger UI (event types, conditions, actions)
- Email template editor with variable insertion and preview
- Webhook system with HMAC-SHA256 signatures, retry logic, delivery logs (24 unit tests)
- Integration points: Stripe, Google Calendar/iCal, Slack/Discord, Zapier

#### 7.2 Duplicate Detection - Complete

- Automatic lead duplicate detection algorithm (Levenshtein distance)
- Similarity scoring (name, email, company matching with weighted fields)
- Merge duplicate records API
- Prevent duplicate creation at submission (check endpoint)
- Duplicate detection/resolution logging

#### 7.3 Data Validation - Complete

- Input validation service (email, phone, URL formats)
- Text input sanitization (XSS prevention)
- SQL injection pattern detection
- File upload validation (type, size, extension checks)
- Rate limiting middleware on all endpoints
- IP blocking system for repeat offenders
- Data quality metrics tracking

#### 8. ANALYTICS AND REPORTING - Complete

- Business intelligence dashboard (revenue charts, pipeline, acquisition funnel)
- Client insights (lifetime value, activity scores, churn risk, upsell opportunities)
- Operational reports (overdue invoices, pending approvals, document requests, project health)

#### Comprehensive Test Coverage Summary

**Total:** 284 Unit Tests across 7 test files

| System | Test File | Count | Coverage Areas |
|--------|-----------|-------|-----------------|
| Proposal System | `proposals.test.ts` | 46 | Templates, builder, PDF, e-signature, versioning |
| Contract System | `contracts.test.ts` | 49 | Templates, creation, PDF, e-signature, lifecycle |
| Client Info Collection | `client-information.test.ts` | 40 | Onboarding, documents, questionnaires, status |
| Approval & Feedback | `approvals.test.ts` | 56 | Workflows, decisions, reminders, bulk operations |
| Ad Hoc Requests | `ad-hoc-requests.test.ts` | 47 | Time tracking, invoicing, bundling, analytics |
| Webhook System | `webhooks.test.ts` | 24 | CRUD, delivery tracking, retry logic, signatures |
| Deliverable & Design Review | `deliverables.test.ts` | 22 | Upload, versioning, comments, annotations, approvals |

**Test Location:** `tests/unit/server/`

**Documentation:** Each feature doc in `docs/features/` includes a "Test Coverage" section with detailed test breakdowns.

---

### Documentation Audit - Complete

**Status:** ✅ COMPLETE (Feb 10, 2026)

#### Feature Docs (docs/features/)

- 34 feature docs complete with test coverage information
- Created: CONTRACTS.md, AD_HOC_REQUESTS.md, CLIENT_INFORMATION.md, DELIVERABLES.md
- Updated: PROPOSAL_BUILDER.md, WORKFLOWS.md, INTEGRATIONS.md with cross-references and test coverage

#### CSS Design Docs (docs/design/)

- CSS_ARCHITECTURE.md reflects current file structure
- CSS_AUDIT.md metrics accurate (93 files)
- PORTAL_CSS_DESIGN.md file lists updated (21 admin files)
- CSS variables and reusable component classes documented

---

### Database Normalization Phase 1-2 - Complete

**Status:** ✅ COMPLETE (Feb 10, 2026)

**Migrations Applied:**

- Migration 067: Remove redundant boolean fields
- Migration 068: Create users table + add INTEGER FK columns
- Migration 069: Remove duplicate notification preference columns
- Migration 070: Remove redundant TEXT columns, keep only user_id FKs

**Tables Normalized (TEXT → INTEGER FK):**

| Table | Removed Column | New Column |
|-------|----------------|------------|
| project_tasks | assigned_to | assigned_to_user_id |
| lead_tasks | assigned_to | assigned_to_user_id |
| time_entries | user_name | user_id |
| project_updates | author | author_user_id |
| task_comments | author | author_user_id |
| client_notes | author | author_user_id |
| lead_notes | author | author_user_id |
| client_activities | created_by | created_by_user_id |

**Services Updated:** project-service.ts, lead-service.ts, client-service.ts, file-service.ts, questionnaire-service.ts, analytics-service.ts, knowledge-base-service.ts, ad-hoc-request-service.ts

**Routes Updated:** intake.ts, admin.ts, projects.ts, data-quality.ts

---

### New API Endpoints (Feb 2026)

#### Milestones (/api/admin/milestones)

- POST /backfill - Generate default milestones for existing projects

#### Task Priority (/api/projects/:id/tasks)

- POST /escalate-priorities - Auto-escalate task priorities based on due date

#### Global Tasks (/api/admin/tasks)

- GET / - Get all tasks across all active projects

#### Deleted Items (/api/admin/deleted-items)

- GET / - List all soft-deleted items
- GET /stats - Get counts by entity type
- POST /:type/:id/restore - Restore item
- DELETE /:type/:id/permanent - Permanently delete
- POST /cleanup - Manual cleanup of expired items

#### Integrations (/api/integrations)

- Stripe: payment-link, webhook
- Calendar: events, sync, export
- Slack/Discord: status, send
- Zapier: samples, events, create

#### Data Quality (/api/data-quality)

- Duplicates: scan, check, merge, dismiss, history
- Validation: email, phone, url, file, object
- Security: sanitize, check (XSS/SQL injection)
- Metrics: get, calculate, history
- Rate limits: stats, block, unblock

#### Analytics (/api/analytics)

- BI: revenue, pipeline, funnel, project-stats
- Clients: ltv, activity-scores, upsell
- Reports: overdue-invoices, pending-approvals, document-requests, project-health

---

### Contracts Feature Documentation

**Status:** ✅ COMPLETE - Documentation Created

**Implementation:** Created comprehensive CONTRACTS.md feature documentation for the contracts system, which was implemented but not documented.

#### Files Created

- `docs/features/CONTRACTS.md` - Full contracts system documentation

#### Files Updated

- `docs/features/PROPOSAL_BUILDER.md` - Added cross-reference to PROPOSALS.md
- `docs/features/PROPOSALS.md` - Added Related Documentation section
- `docs/features/PDF_GENERATION.md` - Added contracts reference
- `docs/design/UX_GUIDELINES.md` - Added Contracts to feature list

#### Documentation Covers

- Contract templates and template types
- Database schema (contract_templates, contracts tables)
- API endpoints for PDF generation and e-signatures
- Admin UI components (Contract tab in project details)
- Variable system for template placeholders
- E-signature flow (client signing, admin countersigning)
- PDF generation with signature embedding

---

## Completed - February 9, 2026 (Late Night)

### Section Toggles in Unified Header

**Status:** ✅ COMPLETE - 100% Operational

**Implementation:** Added section toggles to Leads and Knowledge Base pages for switching between related content views, using the unified portal header pattern established by Analytics/Workflows subtabs.

#### Leads Page Toggle

- Toggle switches between Intake Submissions and Contact Form Submissions cards
- Mount point: `leads-section-toggle-mount` in unified header
- Created `setupSectionToggle()` function in `admin-leads.ts`
- Icons: Intake (document with plus), Contacts (users)
- Card IDs: `intake-submissions-card`, `contact-submissions-card`

#### Knowledge Base Page Toggle

- Toggle switches between Categories and Articles cards
- Mount point: `kb-section-toggle-mount` in unified header
- Created `setupKBSectionToggle()` function in `admin-knowledge-base.ts`
- Icons: Categories (grid), Articles (document with lines)
- Card IDs: `kb-categories-card`, `kb-articles-card`

#### CSS Conditional Visibility

- Added CSS `:has()` selectors for conditional toggle visibility
- Leads toggle shows only when `#tab-leads.active`
- KB toggle shows only when `#tab-knowledge-base.active`
- Follows same pattern as Tasks/Analytics/Workflows controls

#### Technical Implementation

**Pattern:** Mount point in unified header → `createViewToggle()` component → show/hide target cards

```typescript
function setupSectionToggle(): void {
  const mountPoint = document.getElementById('section-toggle-mount');
  if (!mountPoint || mountPoint.dataset.initialized) return;
  mountPoint.dataset.initialized = 'true';

  const toggleEl = createViewToggle({
    id: 'section-toggle',
    options: [/* ... */],
    value: currentSection,
    onChange: (value) => {
      currentSection = value;
      applySection(currentSection);
    }
  });

  mountPoint.appendChild(toggleEl);
  applySection(currentSection);
}
```

#### Files Modified

- `admin/index.html` - Added toggle mount points in unified header, added card IDs
- `src/styles/client-portal/layout.css` - Added `:has()` selectors for conditional visibility
- `src/features/admin/modules/admin-leads.ts` - Added section toggle logic
- `src/features/admin/modules/admin-knowledge-base.ts` - Added section toggle logic
- `docs/design/LAYOUT_CONSISTENCY_AUDIT.md` - Documented implementation
- `docs/current_work.md` - Added completion entry

**Visual Result:** Both Leads and Knowledge Base pages now have consistent section toggles in unified header matching the pattern used across all admin pages.

### Milestones & Tasks Auto-Generation System

**Status:** ✅ COMPLETE - 100% Operational

**Implementation:** Complete system for automatically generating both milestones and tasks when projects are created.

#### Backend Implementation

- **Task Templates Configuration** - COMPLETE
  - Created `server/config/default-tasks.ts` with task templates for all 6 project types
  - Simple Site: ~21 tasks, Business Site: ~42 tasks, E-commerce: ~49 tasks, Web App: ~64 tasks, Maintenance: ~27 tasks, Other: ~18 tasks

- **Task Generator Service** - COMPLETE
  - Created `server/services/task-generator.ts`
  - Functions: `generateMilestoneTasks`, `generateAllMilestoneTasksForProject`, `backfillMilestoneTasks`
  - Smart due date distribution (tasks spread evenly before milestone due date)

- **Milestone Generator Integration** - COMPLETE
  - Updated `server/services/milestone-generator.ts` to call task generator after creating each milestone
  - Returns both `milestonesCreated` and `tasksCreated` counts
  - Updated all dependent code in `server/routes/projects.ts` and `server/routes/admin.ts`

- **Progress Calculator Service** - COMPLETE
  - Created `server/services/progress-calculator.ts`
  - Functions: `calculateMilestoneProgress`, `calculateProjectProgress`, `checkAndUpdateMilestoneCompletion`
  - Auto-completes milestones when all tasks are done
  - Updates project progress based on task completion

- **API Endpoint Updates** - COMPLETE
  - GET `/api/projects/:id/milestones` - Now includes `task_count`, `completed_task_count`, `progress_percentage`
  - Task update/delete operations trigger milestone and project progress recalculation
  - Updated `server/services/project-service.ts` with automatic progress updates

- **Backfill Endpoints** - COMPLETE
  - POST `/api/admin/milestones/backfill` - Now creates both milestones and tasks
  - POST `/api/admin/tasks/backfill` - Creates tasks for existing milestones (NEW)

#### Frontend Implementation

- **Milestone View Enhancements** - COMPLETE
  - Updated `src/features/admin/project-details/milestones.ts`
  - Display task counts and progress percentages in milestone cards
  - Visual progress bars for each milestone
  - Expandable task lists (click to show/hide tasks)
  - Toggle task completion directly from milestone view
  - Auto-reload after task status changes

- **Task Kanban Updates** - COMPLETE
  - Updated `src/features/admin/modules/admin-tasks.ts`
  - Milestone tags on task cards in Kanban view
  - "Standalone" tag for tasks not linked to milestones
  - Added `milestone_title` to task interface

- **CSS Styling** - COMPLETE
  - Updated `src/styles/admin/project-detail.css` - Milestone progress bars, task lists, expandable containers
  - Updated `src/styles/admin/tasks.css` - Milestone tags, standalone tags

#### Key Features

- **Automatic Generation**: Creating a project generates milestones AND tasks
- **Smart Due Dates**: Tasks distributed evenly between today and milestone due date
- **Progress Tracking**: Milestone progress calculated from task completion (e.g., "5/12 tasks, 42%")
- **Auto-Completion**: Milestones auto-mark complete when all tasks done
- **Visual Progress**: Progress bars show completion at a glance
- **Expandable Tasks**: Click any milestone to see its tasks inline
- **Quick Actions**: Toggle task completion from milestone view
- **Task Organization**: Clear distinction between milestone tasks and standalone tasks

#### Files Modified

**Backend:**

- `server/config/default-tasks.ts` (NEW)
- `server/services/task-generator.ts` (NEW)
- `server/services/progress-calculator.ts` (NEW)
- `server/services/milestone-generator.ts` (MODIFIED)
- `server/services/project-service.ts` (MODIFIED)
- `server/routes/projects.ts` (MODIFIED)
- `server/routes/admin.ts` (MODIFIED)

**Frontend:**

- `src/features/admin/project-details/milestones.ts` (MODIFIED)
- `src/features/admin/modules/admin-tasks.ts` (MODIFIED)
- `src/features/admin/admin-project-details.ts` (MODIFIED)
- `src/features/admin/admin-dashboard.ts` (MODIFIED)
- `src/styles/admin/project-detail.css` (MODIFIED)
- `src/styles/admin/tasks.css` (MODIFIED)

#### Documentation Updates

- `docs/features/MILESTONES.md` - Updated with task auto-generation documentation
- `docs/API_DOCUMENTATION.md` - Updated milestones endpoints, added tasks backfill endpoint

### Tasks Page Desktop Layout & Styling

- **Kanban Board Horizontal Layout** - COMPLETE
  - Fixed columns stacking vertically on desktop (now display side-by-side)
  - Changed flex from `flex: 1` to `flex: 1 1 0` for equal column widths
  - Added `!important` overrides for `flex-direction: row` to enforce horizontal layout
  - Used standard `@media (max-width: 767px)` instead of custom media query
  - Files: `src/styles/shared/portal-components.css`, `src/styles/admin/tasks.css`

- **List View Table Styling** - COMPLETE
  - Changed from non-existent `admin-table-wrapper` to proper `admin-table-scroll-wrapper`
  - Changed table class from `data-table` to `admin-table` per CSS documentation
  - Added proper column classes (`.type-col`, `.status-col`, `.date-col`)
  - Added border-radius styles for table within `.tasks-main-container`
  - Files: `src/features/admin/modules/admin-global-tasks.ts`, `src/styles/admin/tasks.css`

- **Shadow Styling Added** - COMPLETE
  - Added `box-shadow: var(--portal-shadow)` to kanban columns and task list container
  - Added `.portal-shadow` class to main container in HTML
  - Files: `src/styles/shared/portal-components.css`, `admin/index.html`

- **View Toggle Inside Main Card** - COMPLETE
  - Restructured HTML to wrap toggle and content in `.tasks-main-container`
  - Added `.tasks-header` for toggle placement with border-bottom separator
  - File: `admin/index.html`, `src/styles/admin/tasks.css`

- **"TO DO" Column Color Strip** - COMPLETE
  - Added `pending` status to the selector for column header accent border
  - Color strip now matches other status tiers (In Progress, Blocked, Done)
  - File: `src/styles/shared/portal-components.css`

### Header Subtabs & Controls Implementation

- **Analytics & Workflows Subtabs Moved to Header** - COMPLETE
  - Moved subtabs from content area into `.portal-header-title`
  - Aligned with page title using flexbox
  - CSS `:has()` selector shows subtabs only when respective tab is active
  - Responsive: stacks vertically on mobile
  - Files: `admin/index.html`, `src/styles/client-portal/layout.css`, `src/styles/admin/analytics.css`

- **Tasks View Toggle Moved to Header** - COMPLETE
  - Moved view toggle from `.tasks-header` div to unified portal header
  - Uses same pattern as Analytics/Workflows subtabs
  - Shows only when Tasks tab is active (`:has(#tab-tasks.active)`)
  - Removed old `.page-header` and `.tasks-header` divs
  - Files: `admin/index.html`, `src/styles/client-portal/layout.css`, `src/styles/admin/tasks.css`

- **Tasks List View Table Structure** - COMPLETE
  - Added proper `.admin-table-card` wrapper (matches Leads, Projects, etc.)
  - Added `.admin-table-header` with title and refresh button
  - Added `.admin-table-container` wrapper for scroll handling
  - Now has proper card shadow and border styling
  - Refresh button reloads tasks on click
  - File: `src/features/admin/modules/admin-global-tasks.ts`

### Layout Consistency Audit

**Full Audit Report:** `docs/design/LAYOUT_CONSISTENCY_AUDIT.md`

**Purpose:** Analyze layout patterns across admin portal pages to identify inconsistencies and standardize component placement.

**Key Findings:**

- **Inconsistent Page Headers:** 7 pages don't use unified portal header (Leads, Projects, Clients, Invoices, Messages, Tasks)
- **View Toggle Placement:** Tasks page had toggle buried in content instead of header
- **Tags Placement:** Inconsistent across entity types (Leads, Projects, Clients)
- **Filter Patterns:** Mostly consistent, some inline vs above-table variations

**Fixes Completed:**

- ✅ **Tasks Page View Toggle** - Moved to unified portal header (same pattern as Analytics/Workflows)
- ✅ **Removed Legacy Headers** - Eliminated old `.page-header` and `.tasks-header` divs from Tasks page
- ✅ **Project Details Notes Tab** - Added missing Notes tab to match Client Details pattern (view/edit internal project notes)
- ✅ **Unified Portal Header Cleanup** - Removed 12 redundant `.page-title` divs from all admin pages (unified header already working)

**Phase 2 Audits Completed:**

- ✅ **Action Button Order** - All 10 tables compliant with Export → Refresh → Add pattern
- ⚠️ **Filter Structure** - CSS exists, HTML implementation pending
- ⚠️ **Tag Placement** - Client Detail complete, Project/Lead Detail missing tags

**Phase 3 Documentation:**

- ✅ **UX_GUIDELINES.md Updated** - Added comprehensive "Layout Patterns" section with HTML templates, CSS patterns, and implementation rules

**Remaining Work:**

- [ ] Add tags to Project Detail (match Client Detail pattern)
- [ ] Add tags to Lead Detail (dynamic generation in secondary sidebar)
- [ ] Implement filter structure on key tables (Leads, Projects, Clients, Invoices)

**Files Modified:**

- `admin/index.html` - Moved Tasks view toggle to header, removed old header divs, added Notes tab to Project Details, removed 12 redundant `.page-title` divs
- `src/styles/client-portal/layout.css` - Added `:has()` selector for Tasks controls
- `src/styles/admin/tasks.css` - Removed `.tasks-header` styles
- `src/styles/admin/project-detail.css` - Added Notes tab display styles
- `src/features/admin/admin-project-details.ts` - Added Notes tab setup, edit modal, and display logic
- `docs/design/LAYOUT_CONSISTENCY_AUDIT.md` - Complete audit report

### Design System Audit

**Full Audit Report:** `docs/design/CSS_AUDIT_2026-02-09.md`

**Scope:** 93 CSS files (admin + client-portal + shared styles)

**Compliance Improvement:** 85% → 92%

**Files Modified:** 16 files, ~150 lines changed

#### Fixes Completed

- **CRITICAL: Defined `--portal-bg-lighter`** - COMPLETE
  - Added missing variable to `variables.css` (8 usages were broken)
  - Value: `#666666`

- **HIGH: Replaced Hardcoded `#fff` Colors** - COMPLETE (4 files)
  - Changed to `var(--color-white)` from design system
  - Files: `secondary-sidebar.css`, `sidebar-badges.css`, `admin.css`, `projects-detail.css`

- **HIGH: Replaced Hardcoded `#000` Colors** - COMPLETE (1 file)
  - Changed to `var(--color-black)` from design system
  - File: `projects-detail.css`

- **MEDIUM: Replaced Hardcoded Border-Radius (2-4px)** - COMPLETE (15 locations)
  - Changed to `var(--portal-radius-xs)` (4px token)
  - Files: `files.css`, `client-detail.css`, `tasks.css`, `leads-pipeline.css`, `project-detail.css`, `cd-crm.css`

- **MEDIUM: Replaced Hardcoded Padding (2px 6px)** - COMPLETE (20+ locations)
  - Changed to `var(--space-0-5) var(--space-1)` (4px 8px)
  - Files: `files.css`, `client-detail.css`, `tasks.css`, `leads-pipeline.css`, `cd-crm.css`, `modals.css`, `pd-invoices.css`, `proposals.css`

- **MEDIUM: Replaced Hardcoded Primary RGBA** - COMPLETE (6 locations)
  - Changed `rgba(0, 175, 240, 0.x)` to `rgba(var(--color-primary-rgb), 0.x)`
  - Files: `files.css`, `portal-components.css`, `portal-messages.css`

- **MEDIUM: Fixed Set Password Form Styling** - COMPLETE
  - Changed hardcoded RGBA to `rgba(var(--color-error-rgb/success-rgb), 0.1)`
  - Changed `--color-bg-*` to `--portal-bg-*` tokens
  - Changed `--color-text-*` to `--portal-text-*` tokens
  - Changed `--border-radius-*` to `--portal-radius-*` tokens
  - Changed `color: white` to `var(--color-white)`
  - Changed hardcoded transition to `var(--transition-fast)`
  - File: `admin.css`

#### Documentation Updates

- **Updated CSS_ARCHITECTURE.md** - COMPLETE
  - Added "Design System Audits" section
  - Removed "Set password form" from intentional exceptions
  - Linked to full audit report

- **Updated UX_GUIDELINES.md** - COMPLETE
  - Added Component Usage section with all reusable classes
  - Added Status Colors & Badges reference
  - Added links to all 28 feature documentation files

- **Created CSS_AUDIT_2026-02-09.md** - COMPLETE
  - Comprehensive audit report with findings by category
  - Priority-based recommendations
  - Search patterns used for reproducibility

### Admin Dashboard Design Cohesion

- **Analytics Subtabs Card Styling** - COMPLETE
  - Added card containment to `.analytics-subtabs` (background, border-radius, padding, shadow)
  - Removed border-bottom in favor of proper dark card styling
  - File: `src/styles/admin/analytics.css`

- **Tab Section Heading Styling** - COMPLETE
  - Updated `.tab-section-heading` with Acme font, uppercase, proper letter-spacing
  - Changed from large font (1.25rem) to subtle label style (0.875rem)
  - Added left padding for visual alignment with content
  - File: `src/styles/shared/portal-tabs.css`

- **Content Section Card Utility** - COMPLETE
  - Added `.content-section-card` class for wrapping loose content in cards
  - Includes dark background, border-radius, padding, shadow
  - Includes `.section-title` child class for consistent card headings
  - File: `src/styles/shared/portal-cards.css`

### Assignee Column Removal

- **Removed Assignee from Tasks** - One-person company, no need for assignee field
  - Removed from global tasks list view (header and rows)
  - Removed from project tasks list view (header and rows)
  - Removed from kanban cards (both global and project-specific)
  - Removed from task detail modals
  - Updated CSS grid from 5 columns to 4 columns
  - Files: `src/features/admin/modules/admin-global-tasks.ts`, `src/features/admin/modules/admin-tasks.ts`, `src/styles/admin/tasks.css`

### Dashboard Tasks API Fix

- **Multiple Status Filter Support** - COMPLETE
  - Fixed `getAllTasks` in project-service.ts to support comma-separated status values
  - Dashboard calls API with `status=pending,in_progress,blocked`
  - Previous code only handled single status (`AND t.status = ?`)
  - Fixed with SQL `IN` clause for multiple statuses
  - File: `server/services/project-service.ts`

### Dashboard Kanban Layout Fix

- **Horizontal Layout for Dashboard Tasks** - COMPLETE
  - Added CSS to ensure dashboard kanban displays columns horizontally
  - Used same `!important` pattern as global tasks page
  - File: `src/styles/shared/portal-cards.css`

### Modal Standardization Refactoring

- **Dynamic Modals Converted to `createPortalModal()`** - COMPLETE
- **CSS Cleanup Deferred** - PARTIAL (static modals still use `.admin-modal-*` classes)

---

## Completed - February 8, 2026

### Contact Page Responsiveness Fix

**Status:** COMPLETE

Fixed multiple responsive layout issues on the main site contact page.

**Breakpoint Coverage:**

- Fixed breakpoint gap (601px-767px) causing layout issues
- Changed mobile/contact.css from `@media (--compact-mobile)` to `@media (--mobile)` (0-767px)

**Two-Column Layout:**

- Desktop two-column layout (form + business card) only appears at 1300px+
- Tablet portrait (768px-1100px) and wide tablets (1100px-1300px) use single-column layout
- Business card hidden on smaller screens, contact options text shown instead

**Field Error Elements:**

- Fixed `.field-error` elements appearing as red bars when empty
- Changed display to `none` by default, shown with `:not(:empty)` selector

**Form Field Alignment:**

- Fixed alignment where heading, text, and fields were not on same left edge
- Submit button always right-aligned using `justify-content: flex-end`

**Desktop Field Widths:**

- Input fields (Name, Company, Email) use `--contact-input-width: min(460px, 100%)`
- Message textarea uses `--contact-textarea-width: min(640px, 100%)`
- Input fields are shorter than message area as designed

**Files Modified:**

- `src/styles/pages/contact.css`
- `src/styles/mobile/contact.css`

---

### Document Requests Integration into Project Files

**Status:** COMPLETE

Integrated document requests with file uploads in project details.

**Upload Confirmation Modal:**

- Files no longer upload immediately on selection
- Modal appears with file preview showing name and size
- User must click "Upload" button to confirm

**File Type Labeling:**

- Added file type dropdown using reusable `createModalDropdown` component
- 11 predefined file types: Project Proposal, Contract, Intake Form, Invoice, Receipt, Wireframe, Design Mockup, Brand Asset, Content/Copy, Reference Material, Other
- File type label stored in `description` column on upload

**Pending Request Linking:**

- Optional dropdown to link uploaded file to a pending document request
- Dropdown only shown when project has pending requests
- After upload, calls `/api/document-requests/:id/upload` to link file
- Request status updates to 'uploaded' when linked

**Backend API Additions:**

- `GET /api/document-requests/project/:projectId/pending` - Returns pending requests for a project
- Added `label` and `file_type` fields to file upload endpoint

**Files Modified:**

- `admin/index.html` - Upload modal HTML structure
- `src/features/admin/project-details/files.ts` - Upload modal logic, dropdown integration
- `src/features/admin/modules/admin-projects.ts` - Removed duplicate upload handlers
- `server/routes/projects.ts` - Added label/file_type to upload endpoint
- `server/routes/document-requests.ts` - Added pending requests endpoint
- `src/styles/admin/files.css` - Upload preview styling

---

### Modal Dropdown Component

**Status:** COMPLETE

Created dedicated modal dropdown component separate from table dropdowns.

**New Component:**

- `src/components/modal-dropdown.ts` - Modal dropdown factory
- `src/styles/admin/modal-dropdown.css` - Modal dropdown styling

**Features:**

- 48px height matching form inputs (vs 32px for table dropdowns)
- Transparent border by default (blends with modal background)
- Primary color border on hover/focus/open
- Black background with caret rotation on open

**Replaced Native Selects:**

- Edit Project modal: Project Type and Status dropdowns
- Edit Client Info modal: Status dropdown
- Create Task modal: Priority dropdown
- Upload Confirmation modal: File Type and Link to Request dropdowns

**Files Modified:**

- `src/features/admin/modules/admin-projects.ts`
- `src/features/admin/modules/admin-clients.ts`
- `src/features/admin/modules/admin-tasks.ts`
- `src/features/admin/project-details/files.ts`

---

### Sidebar Spacing Consistency

**Status:** COMPLETE

Fixed uneven spacing in admin sidebar.

**Changes:**

- Avatar/logo spacing made symmetric: 1.5rem above = 1.5rem below
- Sign Out button removed from absolute positioning, uses `margin-top: auto`
- Sign Out gap matches nav item gap (0.5rem via padding-top)
- Collapsed logo also uses margin-bottom: 1.5rem

**File Modified:** `src/styles/pages/admin.css`

---

### Table Column Stacking Fixes (1760px breakpoint)

**Status:** COMPLETE

Fixed CSS selectors for responsive column hiding.

**Changes:**

- Changed `th.date-col:last-of-type` to `th.target-col` (Projects) and `th.last-active-col` (Clients)
- Added specific header classes: `start-col`, `target-col`, `created-col`, `last-active-col`

**Files Modified:** `admin/index.html`, `src/styles/pages/admin.css`

---

### Table Column Width & Spacing Refinements

**Status:** COMPLETE

Multiple table styling improvements.

**Actions Column:** Changed from fixed 140px to fit-content (`width: 1%`), left-aligned

**Checkbox Column:** Fixed at 48px width, consistent padding

**Column Padding:** Added padding adjustments to status, type, budget, timeline, date, and count columns

**Projects Table:** Identity column min-width 180px, max-width 260px

**File Modified:** `src/styles/pages/admin.css`

---

### Design Token Migration (Phase 1)

**Status:** COMPLETE

Migrated hardcoded values to design tokens.

**New Tokens Added:**

- `--portal-radius-xl: 16px` and `--portal-radius-full: 50%`
- `--transition-faster: 0.15s ease` and `--transition-slower: 0.5s ease`
- Duration-only tokens: `--duration-faster/fast/medium/slow/slower`

**Files Tokenized:**

- `pages/admin.css` - Border-radius, transitions, font sizes, letter-spacing
- `admin/leads-pipeline.css` - Border radius, transitions, letter-spacing
- `shared/portal-forms.css` - Border radius and transitions
- `shared/portal-buttons.css` - Border-radius and transitions

---

### Backend Documentation Update

**Status:** COMPLETE

"The Backend" terminology added to documentation.

**Changes:**

- "The Backend" now refers to entire portal system (Admin Dashboard + Client Portal)
- Updated docs: ADMIN_DASHBOARD.md, CLIENT_PORTAL.md, README.md, ARCHITECTURE.md, SYSTEM_DOCUMENTATION.md

---

### Portfolio Tech Stack Audit

**Status:** COMPLETE

Fixed incorrect tech stack entries.

**Changes:**

- Removed "React" from nobhad.codes and The Backend (both use Vanilla TypeScript)
- Replaced "PDFKit" with "pdf-lib" (actual dependency used)
- Expanded tech stacks with complete tool lists

**Files Modified:** `public/data/portfolio.json`, `docs/features/PROPOSAL_BUILDER.md`, `docs/features/CLIENT_PORTAL.md`

---

### Project Detail Page Enhancements

**Status:** COMPLETE

Enhanced portfolio project detail pages.

**Changes:**

- Added tagline display (italic, muted color)
- Added status badge (In Progress, Completed, Planned)
- Added next/previous navigation between projects
- Fixed PDFKit → pdf-lib in About section tech stack

**Files Modified:** `index.html`, `projects.ts`, `projects-detail.css`

---

### Case Study Sections Added

**Status:** COMPLETE

Added full case study structure to project detail pages.

**New Fields:**

- challenge, approach, results[], keyFeatures[], duration in portfolio.json

**Content Written:**

- nobhad.codes, The Backend, Recycle Content, Linktrees - all with Challenge/Approach/Results/Features

**Files Modified:** `public/data/portfolio.json`, `index.html`, `projects.ts`, `projects-detail.css`

---

### Global Tasks Kanban Feature

**Status:** COMPLETE

Added global tasks view across all projects.

**Backend:**

- `GET /api/admin/tasks` endpoint in `server/routes/admin.ts`
- `getAllTasks()` method in `server/services/project-service.ts`

**Frontend:**

- `src/features/admin/modules/admin-global-tasks.ts` - Kanban + List views
- View toggle between Kanban/List

**Dashboard Integration:**

- Sidebar button and tab content in `admin/index.html`
- Module loader and switch case in admin-dashboard.ts

**Documentation:** `docs/features/TASKS.md`, `docs/API_DOCUMENTATION.md`

---

## Completed - February 7, 2026

### Table & Card Styling Cohesion

- **Table Bottom Corner Fixes** - COMPLETE
  - Fixed border-radius clipping on table bottom corners across all admin tables
  - Issue: Tables with/without pagination had inconsistent corner handling AND inconsistent HTML structure
  - Solution:
    - Pagination must be OUTSIDE `.admin-table-scroll-wrapper`, sibling of `.admin-table-container`
    - `.admin-table-scroll-wrapper` gets bottom radius when no pagination
    - `.table-pagination` handles bottom corners when present
    - `:has()` selector removes scroll-wrapper radius when pagination exists
  - Made `.admin-table` background transparent (cells have background)
  - Fixed HTML structure for Document Requests and KB Articles tables to match Leads/Projects pattern
  - Files: `src/styles/pages/admin.css`, `src/styles/admin/table-features.css`, `admin/index.html`

- **Light Grey Card Shadow Removal** - COMPLETE
  - Removed shadows from `--portal-bg-medium` elements for visual consistency
  - Rule: Main dark containers get shadows, child light grey elements have NO shadow
  - Elements fixed: `.data-item`, `.vital-card`, `.bundle-item`
  - Files: `src/styles/admin/analytics.css`, `src/styles/pages/admin.css`

- **Visitors Table Structure Fix** - COMPLETE
  - Restructured Analytics visitors table to use standard `.admin-table-card` wrapper
  - Added proper header with `<h3>Recent Sessions</h3>`
  - Now matches structure of all other admin tables
  - File: `admin/index.html`

- **CSS_ARCHITECTURE.md Documentation Updated** - COMPLETE
  - Added `.data-item`, `.vital-card`, `.bundle-item` to shadow hierarchy examples
  - Added new "Admin Table Structure" section with HTML pattern and CSS rules
  - Documented corner radius handling for tables with/without pagination

### CSS Audit & Consistency Fixes

- **Icon Size Tokens Added** - COMPLETE
  - Created standardized icon size tokens in `variables.css`
  - Tokens: `--icon-size-xs` (12px) through `--icon-size-2xl` (32px)
  - Updated all hardcoded icon sizes to use tokens
  - Files: `variables.css`, `view-toggle.css`, `search-bar.css`, `workflows.css`, `detail-header.css`, `confirm-dialog.css`, `sidebar-badges.css`

- **Letter-Spacing Tokens Added** - COMPLETE
  - Created standardized letter-spacing tokens in `variables.css`
  - Tokens: `--letter-spacing-label` (0.05em), `--letter-spacing-title` (0.02em), `--letter-spacing-wide` (0.08em)
  - Updated all hardcoded `letter-spacing: 1px` to use tokens
  - Files: `variables.css`, `portal-cards.css`, `confirm-dialog.css`

- **Focus States Added (Accessibility)** - COMPLETE
  - Added `:focus-visible` to view toggle buttons
  - Added focus ring to search input (`box-shadow`)
  - Added `:focus-visible` to search clear button
  - Files: `view-toggle.css`, `search-bar.css`

- **Font Sizes Fixed (Accessibility)** - COMPLETE
  - Changed all `0.65rem` and `9px` font sizes to `0.75rem` minimum
  - Affected: filter badges, priority badges, sidebar badges
  - Files: `table-filters.css`, `portal-cards.css`, `sidebar-badges.css`

- **Hardcoded Values Tokenized** - COMPLETE
  - Replaced hardcoded `px` spacing with `--space-*` tokens
  - Replaced hardcoded border-radius with `--portal-radius-*` tokens
  - Replaced hardcoded transitions with `--transition-fast`
  - Files: `view-toggle.css`, `search-bar.css`, `tooltips.css`, `table-filters.css`, `portal-cards.css`, `workflows.css`, `sidebar-badges.css`, `confirm-dialog.css`

- **Duplicate Declarations Removed** - COMPLETE
  - Removed duplicate `padding`, `list-style`, `margin` in dropdown menu
  - File: `detail-header.css`

- **CSS_AUDIT.md Updated** - COMPLETE
  - Documented all fixes applied
  - Updated common patterns with new tokens
  - Reflects current compliant state

### Messaging Pin Icons

- **Pin/Unpin Icons Updated** - COMPLETE
  - Replaced custom SVG with Lucide `pin` icon (for unpinned messages)
  - Replaced custom SVG with Lucide `pin-off` icon (for pinned messages)
  - Fixed API endpoints for pin/unpin actions
  - Added `is_pinned` to messages query via JOIN with `pinned_messages` table
  - Files: `src/features/admin/modules/admin-messaging.ts`, `server/routes/messages.ts`

### Workflows Table Fixes

- **Default Indicator Styling** - COMPLETE
  - Replaced status badge with purple star icon for default workflows
  - Added `.default-indicator` class with `--color-admin-purple`
  - Files: `src/features/admin/modules/admin-workflows.ts`, `src/styles/admin/workflows.css`

- **Workflows Table Cell Classes** - COMPLETE
  - Added `type-cell`, `status-cell`, `date-cell` classes to match other tables
  - Wrapped action buttons in `table-actions` div for proper flex layout
  - Added outer column padding rules
  - Files: `src/features/admin/modules/admin-workflows.ts`, `src/styles/admin/workflows.css`

- **Trigger Toggle Icon** - COMPLETE
  - Replaced custom sun icon with eye/eye-off pattern (matches leads module)
  - Eye = active, Eye-off = inactive
  - File: `src/features/admin/modules/admin-workflows.ts`

- **Subtab Navigation Styling Fixed** - COMPLETE
  - Added `.portal-subtab` class to Approvals/Triggers buttons
  - Changed container from `analytics-subtabs` to `portal-subtabs`
  - File: `admin/index.html`

- **Name Column Styling Fixed** - COMPLETE
  - Removed `<strong>` tag wrapping from name cells
  - Added `.name-cell` class for consistent table styling
  - Added `.name-col` class to table headers
  - Files: `src/features/admin/modules/admin-workflows.ts`, `admin/index.html`

### Dashboard Shadow Styling

- **Child Element Shadows Added** - COMPLETE
  - Added `box-shadow: var(--shadow-card)` to `.task-item` elements
  - Added `box-shadow: var(--shadow-card)` to `.attention-icon` elements
  - Added `box-shadow: var(--shadow-card)` to `.activity-icon` elements
  - Added `box-shadow: var(--shadow-card)` to `.kanban-card` elements
  - File: `src/styles/shared/portal-cards.css`, `src/styles/shared/portal-components.css`

- **Lead Analytics Background Fixed** - COMPLETE
  - Changed `.analytics-column` background from `var(--portal-bg-light)` to `var(--portal-bg-medium)`
  - Added `box-shadow: var(--shadow-card)` to analytics columns
  - File: `src/styles/admin/leads-pipeline.css`

- **Chart Canvas Wrapper Shadows Added** - COMPLETE
  - Added `box-shadow: var(--shadow-card)` to `.chart-canvas-wrapper`
  - File: `src/styles/admin/analytics.css`

- **Scoring Rules List Container Styled** - COMPLETE
  - Added background, padding, border-radius, and shadow to `.scoring-rules-list`
  - File: `src/styles/admin/leads-pipeline.css`

### Status Badge Conversion

- **Converted All Status Badges to Dot-Style** - COMPLETE
  - Project invoices list
  - Contact detail modals
  - Files: `src/features/admin/project-details/invoices.ts`, `src/features/admin/renderers/admin-contacts.renderer.ts`, `src/features/admin/admin-dashboard.ts`

- **Status Dot Spacing Standardized** - COMPLETE
  - Changed status indicator gap from hardcoded `0.5rem` to `var(--space-1)`
  - Changed table dropdown dot margin from `var(--space-0-5)` (4px) to `var(--space-1)` (8px)
  - Now consistent across status indicators and table dropdowns
  - Files: `src/styles/shared/portal-badges.css`, `src/styles/admin/table-dropdowns.css`

- **Toggle Button Styling Standardized** - COMPLETE
  - Changed text-based toggle buttons (Pause/Resume) to eye/eye-off icon buttons
  - Matches the leads table scoring rules pattern
  - Updated: Analytics schedules, Analytics alerts, Recurring invoices
  - Files: `src/features/admin/modules/admin-analytics.ts`, `src/features/admin/project-details/invoice-scheduling.ts`

- **View Toggle Icons Standardized** - COMPLETE
  - All view toggles now have SVG icons (matching leads pattern)
  - Tasks: Board/List icons
  - Global Tasks: Board/List icons
  - Dashboard Tasks: Board/List icons
  - Proposals: Document/Template icons
  - Files (already had icons): List/Grid icons
  - Files: `admin-tasks.ts`, `admin-global-tasks.ts`, `admin-overview.ts`, `admin-proposals.ts`

### Design Documentation Updates

- **UX_GUIDELINES.md Updated** - COMPLETE
  - Added Enable/Disable Toggle Pattern section (eye/eye-off icons)
  - Added View Toggle Pattern section with icon table
  - Documented icon button usage and locations

- **CSS_ARCHITECTURE.md Updated** - COMPLETE
  - Added spacing note to Status Dots section (`var(--space-1)` standard)

- **REUSABLE_COMPONENTS_AUDIT.md Updated** - COMPLETE
  - Added View Toggles section (section 6)
  - Documented `createViewToggle` component and icon requirements
  - Updated summary table with view toggle status

### Table Column & Dropdown Refinements

- **Column Spacing Adjustments** - COMPLETE
  - Date columns: extra `padding-right: var(--space-6)` for breathing room
  - Contact columns: `min-width: 200px` for client names
  - Email columns: extra `padding-right: var(--space-12)`
  - Name columns: `padding-right: var(--space-8)`
  - Type/Budget/Timeline columns: `padding-right: var(--space-8)`
  - Count columns: centered text
  - Actions columns: right-aligned (cells only, header left-aligned)
  - File: `src/styles/pages/admin.css`

- **Table Dropdown Min-Width** - COMPLETE
  - Set min-width to 115px (fits longest status "Responded" + caret)
  - Changed from `width: 100%` to `width: fit-content`
  - Files: `src/styles/pages/admin.css`, `src/styles/shared/portal-dropdown.css`

- **Status Cell Padding Reduced** - COMPLETE
  - Changed from `padding: var(--space-2) var(--space-4)` to `padding: var(--space-2)`
  - Tighter fit around dropdown
  - File: `src/styles/pages/admin.css`

- **Sortable Header Icons Right-Aligned** - COMPLETE
  - Sort icons now positioned at right edge of column headers using absolute positioning
  - Added `position: relative` and extra `padding-right` to sortable headers
  - Files: `src/styles/pages/admin.css`, `src/styles/admin/table-filters.css`

### Clients Table Enhancements

- **Invite Button Moved to Actions Column** - COMPLETE
  - Removed inline invite button from status cell
  - Added invite button to actions column (appears for "Not Invited" clients)
  - File: `src/features/admin/modules/admin-clients.ts`

- **Last Active Column Added** - COMPLETE
  - Added "Last Active" column showing last login date
  - Shows "Never" for clients who haven't logged in
  - Files: `admin/index.html`, `src/features/admin/modules/admin-clients.ts`

- **Status Indicator Styling Fixed** - COMPLETE
  - Added `status-not-invited` variant to status indicator styles
  - Scoped `.status-not-invited` badge styles to `.status-badge` only (prevents conflict)
  - Fixed status label not being passed to `getStatusDotHTML`
  - Files: `src/styles/shared/portal-badges.css`, `src/styles/pages/admin.css`, `src/features/admin/modules/admin-clients.ts`

### Table & Mobile Fixes

- **Mobile Horizontal Scroll Fix** - COMPLETE
  - Added `min-width: 0` to flex children for proper horizontal scrolling
  - Files: `src/styles/pages/admin.css` (`.dashboard-content`, `.admin-table-container`, `.admin-table-card`)

- **Table Cell Padding Standardized** - COMPLETE
  - Changed cell padding from `var(--space-3) var(--space-4)` to `var(--space-3)` (24px uniform)
  - Applies to both mobile and desktop
  - File: `src/styles/pages/admin.css`

- **Fit-Content Column Classes** - COMPLETE
  - Added CSS classes for columns that should only be as wide as their content
  - Classes: `.status-col`, `.date-col`, `.actions-col`, `.type-col`, `.budget-col`, `.timeline-col`, `.count-col`, `.email-col`
  - Pattern: `width: 1%; white-space: nowrap;`
  - Files modified:
    - `src/styles/pages/admin.css` - CSS class definitions
    - `admin/index.html` - Added classes to all table headers
    - `src/features/admin/modules/admin-leads.ts` - Cell classes
    - `src/features/admin/modules/admin-projects.ts` - Cell classes
    - `src/features/admin/modules/admin-clients.ts` - Cell classes
    - `src/features/admin/modules/admin-contacts.ts` - Cell classes

- **Contacts Table Email Column** - COMPLETE
  - Added separate Email column to Contact Form Submissions table
  - Files: `admin/index.html`, `src/features/admin/modules/admin-contacts.ts`

- **Email Copy Icon Spacing Fix** - COMPLETE
  - Fixed spacing for emails with copy icons in lead details panel
  - File: `src/styles/admin/leads-pipeline.css`

### Responsive Table Column Stacking

- **Column Stacking at Breakpoints** - COMPLETE
  - Tables progressively stack columns at smaller viewports to prevent horizontal scroll
  - Stacked data is duplicated in HTML (hidden by default, shown via CSS at breakpoints)
  - Breakpoints:
    - `1280px`: Leads/Projects hide Budget column, stack under Type
    - `1280px`: Contacts hide Email column, stack under Contact
    - `1100px`: Leads hide Date column, stack above Status
  - Files: `admin.css`, `admin-leads.ts`, `admin-contacts.ts`, `admin-projects.ts`

- **Mobile Card View Duplicate Data Fix** - COMPLETE
  - Issue: On mobile (375px), stacked elements showed alongside original cells (duplicate budget)
  - Cause: 1280px breakpoint rule applies to mobile (375px < 1280px), showing `budget-stacked`
  - Mobile card view also shows `budget-cell` as block, creating duplicates
  - Fix: Added `display: none !important` for stacked elements within `@media (--small-mobile)`
  - File: `src/styles/pages/admin.css`

- **Sortable Column Labels Fixed** - COMPLETE
  - Updated filter configs so sortable column labels match header text
  - Leads: "Project Type" → "Type", "Contact" → "Lead"
  - Contacts: "Name" → "Contact"
  - Projects: "Project Name" → "Project", "Start Date" → "Start"
  - Clients: "Name" → "Client"
  - File: `src/utils/table-filter.ts`

- **Table Sorting Infinite Click Fix** - COMPLETE
  - Fixed bug where table sorting only worked once then stopped
  - Root cause: Click handler captured stale `state` object in closure
  - Solution: Store sort state in DOM data attributes on `thead`, read fresh values on each click
  - File: `src/utils/table-filter.ts`

- **Mobile Card Layout Streamlining** - COMPLETE
  - Deep dive audit of mobile table styling across all admin tables
  - Added explicit CSS `order` values for consistent cell display order on mobile cards:
    - Order -2: Identity cells (primary name/email/company)
    - Order 1: Type cells
    - Order 2: Budget/Count cells
    - Order 3: Timeline/Email cells
    - Order 4: Message cells
    - Order 5: Status cells
    - Order 6: Date cells
    - Order 10: Actions cells
  - Added missing mobile styling for `timeline-cell` and `count-cell`
  - Standardized color scheme: light for primary, secondary for metadata, muted for dates/counts
  - Updated TABLE_AUDIT.md with comprehensive mobile styling documentation
  - File: `src/styles/pages/admin.css`

- **Unified Table Column Order** - COMPLETE
  - Standardized column order across all admin tables: ☐ → Identity → Type → Status → Details → Date(s) → Actions
  - Status column moved earlier (position 3-4) for quick scanning
  - Added checkbox column to Contacts table with bulk actions (Mark Read, Mark Responded, Archive, Delete)
  - Added Actions column to Projects table with View button
  - Updated mobile CSS order values to match desktop order
  - Files modified:
    - `admin/index.html` - Reordered headers for Leads, Contacts, Projects, Clients
    - `admin-leads.ts` - Reordered cells
    - `admin-contacts.ts` - Added checkbox, bulk actions, reordered cells
    - `admin-projects.ts` - Added Actions column, reordered cells
    - `admin-clients.ts` - Reordered cells
    - `admin.css` - Updated mobile order values
    - `TABLE_AUDIT.md` - Updated column order reference

### Bulk Actions & Table Improvements

- **Bulk Action Icon Buttons** - COMPLETE
  - Converted bulk action toolbar buttons from text+icon to icon-only
  - Added `.bulk-action-icon-btn` class with proper styling
  - Files: `src/utils/table-bulk-actions.ts`, `src/styles/admin/table-features.css`

- **Bulk Status Update Dropdown** - COMPLETE
  - Replaced modal dialog with inline dropdown for bulk status updates
  - Added `dropdownOptions` support to `BulkAction` interface
  - Created `createBulkActionDropdown` function for dropdown-style bulk actions
  - Files: `src/utils/table-bulk-actions.ts`, `src/features/admin/modules/admin-leads.ts`, `src/styles/admin/table-features.css`

- **Contacts Table Actions Column** - COMPLETE
  - Added Actions column to Contact Form Submissions table
  - Action buttons: Convert to Client, Archive, Restore
  - Styled consistently with other table action columns
  - Files: `admin/index.html`, `src/features/admin/modules/admin-contacts.ts`

- **Table Header Button Order Standardized** - COMPLETE
  - All tables now use consistent order: Export → Refresh → Add
  - Fixed Projects and Clients tables to match pattern
  - File: `admin/index.html`

- **Table Action Buttons Styling** - COMPLETE
  - All action column buttons now neutral color (not red)
  - Turn red on hover (matches other icon buttons)
  - Added `table-actions` wrapper to leads table
  - Removed special `.icon-btn-convert` red styling
  - Files: `src/styles/pages/admin.css`, `src/features/admin/modules/admin-leads.ts`

- **Sidebar Sign Out Hover Effect** - COMPLETE
  - Sign out button now has same hover effect as nav buttons (turns red)
  - File: `src/styles/shared/portal-buttons.css`

- **Bulk Toolbar Selection Count Alignment** - COMPLETE
  - Selection count number aligned above checkboxes (24px width)
  - Added spacing between number and "selected" text
  - File: `src/styles/admin/table-features.css`

---

## Completed - February 2, 2026

### Analytics Advanced Features UI

**Status:** COMPLETE

Added frontend UI for advanced analytics features including scheduled reports and metric alerts.

**New Features:**

- Create Report dialog with name, type, description fields
- Schedule Report dialog for automated report generation
- Scheduled reports list with enable/disable and delete actions
- Metric Alerts section with create, toggle, and delete
- Alert configuration: metric type, condition, threshold, notification

**Files Modified:**

- `admin/index.html` - Added scheduled reports and metric alerts sections
- `src/features/admin/modules/admin-analytics.ts` - Added CRUD for reports, schedules, alerts
- `src/styles/admin/analytics.css` - Added alerts list styling

---

### Invoice Advanced Features UI

**Status:** COMPLETE

Added frontend UI for advanced invoice features.

**New Features:**

- Apply Late Fees button to process overdue invoices
- Schedule Invoice dialog for future invoice generation
- Setup Recurring dialog for recurring invoice patterns
- Scheduled invoices list with cancel action
- Recurring invoices list with pause/resume actions

**Files:**

- `admin/index.html` - Payment Plans & Recurring section
- `src/features/admin/admin-project-details.ts` - Handlers and UI
- `src/styles/admin/project-detail.css` - Scheduling/recurring styles

---

### Client CRM Details UI

**Status:** COMPLETE

Added CRM Details and Custom Fields sections to client overview.

**New Features:**

- CRM Details section: Industry, Company Size, Acquisition Source, Website, Last Contact, Next Follow-up
- Edit CRM dialog with dropdown selections
- Custom Fields section displaying client-specific field values
- Edit Custom Fields dialog with dynamic field types

**Files:**

- `admin/index.html` - CRM and Custom Fields sections
- `src/features/admin/modules/admin-client-details.ts` - Load/render/edit functions

---

### Client CRM Table Enhancements

**Status:** COMPLETE

Added health score badges and tags display to client table.

**Changes:**

- Updated `GET /api/clients` to return `health_score` and `tags` for each client
- Added Health column to clients table with color-coded badges (green/yellow/red)
- Display client tags as pill badges under client name
- Updated Client interface with CRM fields

**Files:**

- `server/routes/clients.ts` - Updated query to include health and tags
- `src/features/admin/modules/admin-clients.ts` - Table rendering
- `admin/index.html` - Added Health column header

---

### Contract E-Signature System

**Status:** COMPLETE

Implemented complete contract e-signature system with client-facing signing page, email notifications, and audit logging.

**Frontend:**

- Contract tab in project details with Preview, Download, Request Signature buttons
- Status card showing signed/not signed status
- Signature details card (shown when signed)

**Backend Endpoints:**

- `GET /api/projects/:id/contract/pdf` - Generate contract PDF
- `POST /api/projects/:id/contract/request-signature` - Request client signature (sends email)
- `GET /api/projects/contract/by-token/:token` - Public: get contract details
- `POST /api/projects/contract/sign-by-token/:token` - Public: sign contract
- `GET /api/projects/:id/contract/signature-status` - Get signature status

**Client Signing Page:**

- `/public/sign-contract.html` - Canvas-based signature capture
- Records signer name, email, IP, user agent
- Validates token expiration
- Prevents duplicate signing

**Database (Migration 037):**

- Signature tracking columns on `projects` table
- `contract_signature_log` audit table

**Files:**

- `server/database/migrations/037_contract_signatures.sql`
- `server/routes/projects.ts`
- `public/sign-contract.html`
- `admin/index.html` - Contract tab
- `src/features/admin/admin-project-details.ts` - Contract tab logic
- `src/styles/admin/project-detail.css` - Contract tab styling

---

## Completed - February 1, 2026

### State-of-the-Art Feature Enhancement Plan - BACKEND COMPLETE

Enhancing ALL core features to professional, enterprise-grade level comparable to industry leaders (HubSpot, Salesforce, Monday.com, PandaDoc, Proposify).

**Implementation Order:**

1. [x] **Phase 1: Client Management** - CRM-grade contact management (COMPLETE)
2. [x] **Phase 4: Leads/Intake** - Scoring, pipeline, assignment (COMPLETE)
3. [x] **Phase 2: Project Management** - Tasks, time tracking, templates (COMPLETE)
4. [x] **Phase 3: Proposals** - Templates, versioning, e-signatures (COMPLETE)
5. [x] **Phase 5: Messaging** - Threads, mentions, notifications (COMPLETE)
6. [x] **Phase 6: Files** - Versioning, organization (COMPLETE)
7. [x] **Phase 7: Analytics** - Comprehensive dashboards (COMPLETE)

**ALL PHASES COMPLETE** - State-of-the-art feature enhancement plan fully implemented.

---

### Frontend Integration Plan - VERIFIED COMPLETE

**Status:** All 7 phases verified complete on February 2, 2026.

**Phases (All Complete):**

1. [x] **Phase 1: Client CRM UI** - Health badges, tags, contacts, activity, notes tabs
2. [x] **Phase 2: Project Tasks & Time Tracking UI** - Kanban/List views, time entries, charts
3. [x] **Phase 3: Proposal Enhancements UI** - Templates, versions, e-signatures
4. [x] **Phase 4: Lead Pipeline UI** - Pipeline Kanban with drag-and-drop, scoring
5. [x] **Phase 5: Enhanced Messaging UI** - Reactions, pinning, read receipts
6. [x] **Phase 6: File Management UI** - Folders, versions, comments
7. [x] **Phase 7: Analytics Dashboard UI** - KPI cards, revenue/status charts, reports

**Key Frontend Modules:**

- `src/features/admin/modules/admin-client-details.ts` - Client CRM tabs
- `src/features/admin/modules/admin-tasks.ts` - Task management
- `src/features/admin/modules/admin-time-tracking.ts` - Time entries
- `src/features/admin/modules/admin-leads.ts` - Lead pipeline
- `src/features/admin/modules/admin-files.ts` - File management
- `src/features/admin/modules/admin-messaging.ts` - Enhanced messaging
- `src/features/admin/modules/admin-proposals.ts` - Proposal management
- `src/features/admin/modules/admin-analytics.ts` - Analytics dashboard

**Shared Components Created:**

- `src/components/kanban-board.ts` - Reusable Kanban board for tasks and leads
- `src/components/tag-input.ts` - Tag input with autocomplete
- `src/components/timeline.ts` - Activity timeline component
- `src/components/chart-simple.ts` - Simple Chart.js wrapper

**Files Created/Modified:**

Phase 7 - Analytics:

- `src/features/admin/modules/admin-analytics.ts` - Business KPIs, charts, funnel, reports
- `src/styles/admin/analytics.css` - KPI cards, funnel, reports styling

Phase 6 - Files:

- `src/features/admin/modules/admin-files.ts` - NEW: Complete file management module
- `src/styles/admin/files.css` - NEW: File management styling

Phase 5 - Messaging:

- `src/features/admin/modules/admin-messaging.ts` - Reactions, read receipts, pins
- `src/styles/shared/portal-messages.css` - Messaging enhancements styling

Phase 3 - Proposals:

- `src/features/admin/modules/admin-proposals.ts` - Templates, versions, signatures
- `src/styles/admin/proposals.css` - NEW: Proposal enhancements styling

**HTML Updates:**

- `admin/index.html` - Added containers for analytics KPIs, files tab, messaging features

---

### Phase 1: Client Management Enhancement - COMPLETE

Implemented CRM-grade client management with contacts, activities, custom fields, tags, and health scoring.

**New Features:**

- **Multi-Contact Management** - Multiple contacts per client organization with roles (primary, billing, technical, decision_maker)
- **Activity Timeline** - Automatic and manual activity tracking (notes, calls, emails, meetings)
- **Custom Fields** - Define custom fields (text, number, date, select, boolean, url, email, phone)
- **Tags & Segmentation** - 8 default tags for client categorization (VIP, Referral, New, Returning, etc.)
- **Health Scoring** - Automatic health calculation (payment history, engagement, project success, communication)
- **CRM Fields** - Industry, company size, acquisition source, website, follow-up dates, notes
- **Client Statistics** - Comprehensive stats (projects, invoices, lifetime value, etc.)

**Database Changes (Migration 030):**

- Created `client_contacts` table for multiple contacts per client
- Created `client_activities` table for activity timeline
- Created `client_custom_fields` table for custom field definitions
- Created `client_custom_field_values` table for field values
- Created `tags` table for tag definitions
- Created `client_tags` junction table
- Added CRM columns to clients: `health_score`, `health_status`, `lifetime_value`, `acquisition_source`, `industry`, `company_size`, `website`, `last_contact_date`, `next_follow_up_date`, `notes`, `preferred_contact_method`
- Seeded 8 default tags and 4 default custom fields

**New API Endpoints (25+):**

Contact Management:

- `GET/POST /api/clients/:id/contacts` - Contact CRUD
- `PUT/DELETE /api/clients/contacts/:contactId` - Update/delete contact
- `POST /api/clients/:id/contacts/:contactId/set-primary` - Set primary contact

Activity Timeline:

- `GET/POST /api/clients/:id/activities` - Activity CRUD
- `GET /api/clients/activities/recent` - Recent activities (all clients)

Custom Fields:

- `GET/POST /api/clients/custom-fields` - Field definitions
- `PUT/DELETE /api/clients/custom-fields/:fieldId` - Update/delete field
- `GET/PUT /api/clients/:id/custom-fields` - Client field values

Tags:

- `GET/POST /api/clients/tags` - Tag CRUD
- `PUT/DELETE /api/clients/tags/:tagId` - Update/delete tag
- `GET /api/clients/:id/tags` - Client tags
- `POST/DELETE /api/clients/:id/tags/:tagId` - Add/remove tag
- `GET /api/clients/by-tag/:tagId` - Clients by tag

Health & Stats:

- `GET /api/clients/:id/health` - Health score
- `POST /api/clients/:id/health/recalculate` - Recalculate health
- `GET /api/clients/at-risk` - At-risk clients
- `GET /api/clients/:id/stats` - Comprehensive stats

CRM:

- `PUT /api/clients/:id/crm` - Update CRM fields
- `GET /api/clients/follow-up` - Clients due for follow-up

**Files Created:**

- `server/database/migrations/030_client_enhancements.sql`
- `server/services/client-service.ts`
- `docs/features/CLIENTS.md`

**Files Modified:**

- `server/routes/clients.ts` - Added 25+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for CRM types

---

### Phase 4: Leads/Intake Enhancement - COMPLETE

Implemented enterprise-grade lead scoring, pipeline management, task tracking, and analytics.

**New Features:**

- **Lead Scoring** - Configurable rules with operators (equals, contains, in, greater_than, not_empty)
- **Pipeline Management** - 7 default stages with win probability, kanban view
- **Task Management** - Follow-ups, calls, emails, meetings with due dates and reminders
- **Notes System** - Pinnable notes with author tracking
- **Lead Sources** - 9 default sources (Website, Referral, Social Media, etc.)
- **Duplicate Detection** - Automatic similarity scoring based on email, company, contact name
- **Bulk Operations** - Bulk status update, assignment, stage move
- **Analytics** - Conversion funnel, source performance, score distribution

**Database Changes (Migration 033):**

- Created `lead_scoring_rules` table with 9 default rules
- Created `pipeline_stages` table with 7 default stages
- Created `lead_tasks` table for follow-ups
- Created `lead_notes` table for notes
- Created `lead_sources` table with 9 default sources
- Created `lead_duplicates` table for duplicate tracking
- Added lead columns to projects: `lead_score`, `lead_score_breakdown`, `pipeline_stage_id`, `lead_source_id`, `assigned_to`, `expected_value`, `expected_close_date`, `lost_reason`, `lost_at`, `won_at`, `competitor`, `last_activity_at`, `next_follow_up_at`

**New API Endpoints (35+):**

Scoring:

- `GET/POST /api/admin/leads/scoring-rules` - Scoring rule CRUD
- `PUT/DELETE /api/admin/leads/scoring-rules/:id` - Update/delete rule
- `POST /api/admin/leads/:id/calculate-score` - Calculate score
- `POST /api/admin/leads/recalculate-all` - Recalculate all

Pipeline:

- `GET /api/admin/leads/pipeline/stages` - Get stages
- `GET /api/admin/leads/pipeline` - Pipeline kanban view
- `GET /api/admin/leads/pipeline/stats` - Pipeline statistics
- `POST /api/admin/leads/:id/move-stage` - Move to stage

Tasks:

- `GET/POST /api/admin/leads/:id/tasks` - Task CRUD
- `PUT /api/admin/leads/tasks/:taskId` - Update task
- `POST /api/admin/leads/tasks/:taskId/complete` - Complete task
- `GET /api/admin/leads/tasks/overdue` - Overdue tasks
- `GET /api/admin/leads/tasks/upcoming` - Upcoming tasks

Notes:

- `GET/POST /api/admin/leads/:id/notes` - Note CRUD
- `POST /api/admin/leads/notes/:noteId/toggle-pin` - Pin/unpin
- `DELETE /api/admin/leads/notes/:noteId` - Delete note

Sources & Assignment:

- `GET /api/admin/leads/sources` - Lead sources
- `POST /api/admin/leads/:id/source` - Set source
- `POST /api/admin/leads/:id/assign` - Assign lead
- `GET /api/admin/leads/my-leads` - My assigned leads
- `GET /api/admin/leads/unassigned` - Unassigned leads

Duplicates:

- `GET /api/admin/leads/:id/duplicates` - Find duplicates
- `GET /api/admin/leads/duplicates` - All pending duplicates
- `POST /api/admin/leads/duplicates/:id/resolve` - Resolve duplicate

Bulk:

- `POST /api/admin/leads/bulk/status` - Bulk status update
- `POST /api/admin/leads/bulk/assign` - Bulk assign
- `POST /api/admin/leads/bulk/move-stage` - Bulk move

Analytics:

- `GET /api/admin/leads/analytics` - Lead analytics
- `GET /api/admin/leads/conversion-funnel` - Conversion funnel
- `GET /api/admin/leads/source-performance` - Source performance

**Files Created:**

- `server/database/migrations/033_lead_enhancements.sql`
- `server/services/lead-service.ts`
- `docs/features/LEADS.md`

**Files Modified:**

- `server/routes/admin.ts` - Added 35+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for lead types

---

### Phase 2: Project Management Enhancement - COMPLETE

Implemented enterprise-grade project management with tasks, time tracking, templates, dependencies, and project health metrics.

**New Features:**

- **Task Management** - Tasks with subtasks, priorities (low/medium/high/urgent), status (pending/in_progress/completed/blocked/cancelled)
- **Task Dependencies** - finish_to_start, start_to_start, finish_to_finish, start_to_finish with cyclic dependency detection
- **Task Comments** - Threaded comments on tasks with author tracking
- **Task Checklists** - Checklist items within tasks with completion tracking
- **Time Tracking** - Log hours against projects/tasks, billable vs non-billable, hourly rates, automatic project/task hour updates
- **Project Templates** - 3 default templates (Simple Website, Business Website, E-commerce Store) with milestones and tasks
- **Project Health** - Automatic health calculation (on_track/at_risk/off_track) based on schedule, budget, tasks, milestones
- **Burndown Charts** - Visual burndown data (planned vs actual vs remaining hours)
- **Velocity Tracking** - Weekly hours/tasks completed, average velocity
- **Project Tags** - 8 default tags (Rush, Maintenance, Redesign, New Build, Complex, Simple, Fixed Price, Hourly)
- **Project Archiving** - Archive/unarchive projects

**Database Changes (Migration 031):**

- Created `project_tasks` table with subtask support (parent_task_id)
- Created `task_dependencies` table for dependency tracking
- Created `task_comments` table for task discussions
- Created `time_entries` table for time tracking
- Created `project_templates` table with 3 default templates
- Created `project_tags` junction table
- Created `task_checklist_items` table
- Added columns to projects: `hourly_rate`, `estimated_hours`, `actual_hours`, `template_id`, `archived_at`, `project_health`, `health_notes`
- Added columns to milestones: `sort_order`, `estimated_hours`, `actual_hours`, `status`
- Seeded 3 project templates and 8 project tags

**New API Endpoints (30+):**

Task Management:

- `GET/POST /api/projects/:id/tasks` - Task CRUD
- `GET/PUT/DELETE /api/projects/tasks/:taskId` - Single task operations
- `POST /api/projects/tasks/:taskId/complete` - Complete task
- `POST /api/projects/tasks/:taskId/move` - Move task position

Dependencies:

- `POST /api/projects/tasks/:taskId/dependencies` - Add dependency
- `DELETE /api/projects/tasks/:taskId/dependencies/:dependsOnTaskId` - Remove dependency
- `GET /api/projects/:id/tasks/blocked` - Get blocked tasks

Comments & Checklists:

- `GET/POST /api/projects/tasks/:taskId/comments` - Comments
- `DELETE /api/projects/tasks/comments/:commentId` - Delete comment
- `POST /api/projects/tasks/:taskId/checklist` - Add checklist item
- `POST /api/projects/tasks/checklist/:itemId/toggle` - Toggle item
- `DELETE /api/projects/tasks/checklist/:itemId` - Delete item

Time Tracking:

- `GET/POST /api/projects/:id/time-entries` - Time entries
- `PUT/DELETE /api/projects/time-entries/:entryId` - Update/delete entry
- `GET /api/projects/:id/time-stats` - Project time statistics
- `GET /api/projects/reports/team-time` - Team time report

Templates:

- `GET /api/projects/templates` - Get all templates
- `GET /api/projects/templates/:templateId` - Get single template
- `POST /api/projects/templates` - Create template
- `POST /api/projects/from-template` - Create project from template

Health & Analytics:

- `GET /api/projects/:id/health` - Project health
- `GET /api/projects/:id/burndown` - Burndown chart data
- `GET /api/projects/:id/velocity` - Velocity data

Tags & Archive:

- `GET /api/projects/:id/tags` - Get project tags
- `POST/DELETE /api/projects/:id/tags/:tagId` - Add/remove tag
- `POST /api/projects/:id/archive` - Archive project
- `POST /api/projects/:id/unarchive` - Unarchive project

**Files Created:**

- `server/database/migrations/031_project_enhancements.sql`
- `server/services/project-service.ts`
- `docs/features/PROJECTS.md`

**Files Modified:**

- `server/routes/projects.ts` - Added 30+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for project management types

---

### Phase 3: Proposal System Enhancement - COMPLETE

Implemented professional-grade proposal management with templates, versioning, e-signatures, collaboration, and activity tracking.

**New Features:**

- **Proposal Templates** - 3 default templates (Simple Website, Business Website, E-commerce) with tier structures and default line items
- **Versioning** - Create, view, compare, and restore proposal versions with change tracking
- **E-Signatures** - Request signatures via email, capture drawn/typed/uploaded signatures, IP tracking
- **Comments/Collaboration** - Client and admin comments with threading, internal (admin-only) comments
- **Activity Tracking** - Comprehensive activity log (viewed, commented, signed, status changes, etc.)
- **Custom Line Items** - Add service/product/discount/fee items with quantity, unit price, taxable/optional flags
- **Discounts** - Percentage or fixed discounts with reason tracking, automatic total recalculation
- **Expiration & Reminders** - Custom expiration dates, automatic expiration processing, reminder tracking
- **Access Tokens** - Generate unique tokens for client viewing without login

**Database Changes (Migration 032):**

- Created `proposal_templates` table with 3 default templates
- Created `proposal_versions` table for version history
- Created `proposal_signatures` table for e-signatures
- Created `proposal_comments` table for collaboration
- Created `proposal_activities` table for activity tracking
- Created `proposal_custom_items` table for custom line items
- Created `signature_requests` table for signature request tracking
- Added columns to proposal_requests: `template_id`, `expiration_date`, `view_count`, `last_viewed_at`, `signed_at`, `version_number`, `discount_type`, `discount_value`, `discount_reason`, `tax_rate`, `subtotal`, `tax_amount`, `sent_at`, `sent_by`, `accepted_at`, `rejected_at`, `rejection_reason`, `validity_days`, `requires_signature`, `access_token`

**New API Endpoints (35+):**

Templates:

- `GET/POST /api/proposals/templates` - Template CRUD
- `GET/PUT/DELETE /api/proposals/templates/:templateId` - Single template operations

Versioning:

- `GET/POST /api/proposals/:id/versions` - Version CRUD
- `POST /api/proposals/:id/versions/:versionId/restore` - Restore version
- `GET /api/proposals/versions/compare` - Compare versions

E-Signatures:

- `POST /api/proposals/:id/request-signature` - Request signature
- `POST /api/proposals/:id/sign` - Record signature
- `GET /api/proposals/:id/signature-status` - Get status
- `GET /api/proposals/sign/:token` - Get by token
- `POST /api/proposals/sign/:token/decline` - Decline

Comments:

- `GET/POST /api/proposals/:id/comments` - Comment CRUD
- `DELETE /api/proposals/comments/:commentId` - Delete comment

Activities:

- `GET /api/proposals/:id/activities` - Get activities
- `POST /api/proposals/:id/track-view` - Track view

Custom Items:

- `GET/POST /api/proposals/:id/custom-items` - Item CRUD
- `PUT/DELETE /api/proposals/custom-items/:itemId` - Update/delete item

Discounts:

- `POST /api/proposals/:id/discount` - Apply discount
- `DELETE /api/proposals/:id/discount` - Remove discount

Expiration & Send:

- `PUT /api/proposals/:id/expiration` - Set expiration
- `POST /api/proposals/:id/send` - Mark as sent
- `POST /api/proposals/:id/access-token` - Generate token
- `GET /api/proposals/view/:token` - Get by access token
- `POST /api/proposals/process-expired` - Process expired
- `GET /api/proposals/due-for-reminder` - Due for reminder
- `POST /api/proposals/:id/reminder-sent` - Mark reminder sent

**Files Created:**

- `server/database/migrations/032_proposal_enhancements.sql`
- `server/services/proposal-service.ts`
- `docs/features/PROPOSALS.md`

**Files Modified:**

- `server/routes/proposals.ts` - Added 35+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for proposal types

---

### Phase 5: Messaging Enhancement - COMPLETE

Implemented professional-grade messaging system with mentions, reactions, read receipts, pinned messages, internal notes, and search.

**New Features:**

- **Message Mentions** - Parse and track @user, @team, @all mentions with notification tracking
- **Message Reactions** - Add/remove emoji reactions with grouped summaries
- **Message Subscriptions** - Per-project notification preferences (all/mentions/replies) with mute/unmute
- **Read Receipts** - Individual and bulk read tracking, unread counts per user/thread
- **Pinned Messages** - Pin important messages to threads (admin only)
- **Message Editing** - Edit sent messages with timestamp tracking
- **Message Deletion** - Soft delete with who/when tracking
- **Internal Messages** - Admin-only messages not visible to clients
- **Thread Archiving** - Archive/unarchive threads (admin only)
- **Message Search** - Full-text search with project/thread filtering

**Database Changes (Migration 034):**

- Created `message_mentions` table for tracking @mentions
- Created `message_reactions` table for emoji reactions (unique per user/reaction)
- Created `message_subscriptions` table for per-project notification preferences
- Created `message_read_receipts` table for read tracking
- Created `pinned_messages` table for important messages
- Added columns to general_messages: `parent_message_id`, `is_internal`, `edited_at`, `deleted_at`, `deleted_by`, `reaction_count`, `reply_count`, `mention_count`
- Added columns to message_threads: `pinned_count`, `participant_count`, `archived_at`, `archived_by`

**New API Endpoints (25+):**

Mentions:

- `GET /api/messages/messages/:messageId/mentions` - Get message mentions
- `GET /api/messages/mentions/me` - Get my mentions

Reactions:

- `GET /api/messages/messages/:messageId/reactions` - Get reactions
- `POST /api/messages/messages/:messageId/reactions` - Add reaction
- `DELETE /api/messages/messages/:messageId/reactions/:reaction` - Remove reaction

Subscriptions:

- `GET /api/messages/projects/:projectId/subscription` - Get subscription
- `PUT /api/messages/projects/:projectId/subscription` - Update subscription
- `POST /api/messages/projects/:projectId/mute` - Mute project
- `POST /api/messages/projects/:projectId/unmute` - Unmute project

Read Receipts:

- `POST /api/messages/messages/:messageId/read` - Mark as read
- `POST /api/messages/messages/read-bulk` - Bulk mark as read
- `GET /api/messages/messages/:messageId/read-receipts` - Get receipts (admin)
- `GET /api/messages/unread-count` - Get unread count
- `GET /api/messages/threads/:threadId/unread-count` - Get thread unread count

Pinned Messages:

- `GET /api/messages/threads/:threadId/pinned` - Get pinned messages
- `POST /api/messages/messages/:messageId/pin` - Pin message (admin)
- `DELETE /api/messages/messages/:messageId/pin` - Unpin message (admin)

Edit/Delete:

- `PUT /api/messages/messages/:messageId` - Edit message
- `DELETE /api/messages/messages/:messageId` - Delete message

Thread Archiving:

- `POST /api/messages/threads/:threadId/archive` - Archive thread (admin)
- `POST /api/messages/threads/:threadId/unarchive` - Unarchive thread (admin)
- `GET /api/messages/threads/archived` - Get archived threads (admin)

Search & Internal:

- `GET /api/messages/search` - Search messages
- `POST /api/messages/threads/:threadId/internal` - Send internal message (admin)
- `GET /api/messages/threads/:threadId/internal` - Get internal messages (admin)

**Files Created:**

- `server/database/migrations/034_messaging_enhancements.sql`
- `server/services/message-service.ts`
- `docs/features/MESSAGING.md`

**Files Modified:**

- `server/routes/messages.ts` - Added 25+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for messaging types

---

### Phase 6: File Management Enhancement - COMPLETE

Implemented professional-grade file management with versioning, folders, tags, access tracking, comments, archiving, expiration, locking, and search.

**New Features:**

- **File Versioning** - Upload new versions, automatic numbering, version comments, restore previous versions
- **Folder Organization** - Hierarchical folders, nested subfolders, custom colors/icons, move files/folders
- **File Tags** - 8 default tags (Final, Draft, Review, Approved, Revision, Archive, Confidential, Client Provided)
- **Access Tracking** - Log views/downloads/previews, access counts, IP/user agent tracking, access statistics
- **File Comments** - Threaded comments, internal (admin-only) comments, author tracking
- **Archiving & Expiration** - Archive/restore files, set expiration dates, auto-archive expired files
- **File Locking** - Lock files for editing, track locker, admin force unlock
- **File Categories** - 7 categories (general, deliverable, source, asset, document, contract, invoice)
- **Search & Stats** - Full-text search, filter by folder/category, comprehensive file statistics

**Database Changes (Migration 035):**

- Created `file_versions` table for version history
- Created `file_folders` table with hierarchical structure
- Created `file_tags` junction table
- Created `file_access_log` table for tracking
- Created `file_comments` table for collaboration
- Added columns to files: `folder_id`, `version`, `is_archived`, `archived_at`, `archived_by`, `expires_at`, `access_count`, `last_accessed_at`, `download_count`, `checksum`, `is_locked`, `locked_by`, `locked_at`, `category`
- Seeded 8 default file tags

**New API Endpoints (30+):**

Versions:

- `GET /api/projects/files/:fileId/versions` - Get versions
- `POST /api/projects/files/:fileId/versions` - Upload new version
- `POST /api/projects/files/:fileId/versions/:versionId/restore` - Restore version

Folders:

- `GET /api/projects/:id/folders` - Get folders
- `POST /api/projects/:id/folders` - Create folder
- `PUT /api/projects/folders/:folderId` - Update folder
- `DELETE /api/projects/folders/:folderId` - Delete folder
- `POST /api/projects/files/:fileId/move` - Move file
- `POST /api/projects/folders/:folderId/move` - Move folder

Tags:

- `GET /api/projects/files/:fileId/tags` - Get file tags
- `POST/DELETE /api/projects/files/:fileId/tags/:tagId` - Add/remove tag
- `GET /api/projects/:id/files/by-tag/:tagId` - Files by tag

Access Tracking:

- `POST /api/projects/files/:fileId/access` - Log access
- `GET /api/projects/files/:fileId/access-log` - Get log (admin)
- `GET /api/projects/files/:fileId/access-stats` - Get stats

Comments:

- `GET/POST /api/projects/files/:fileId/comments` - Comments
- `DELETE /api/projects/files/comments/:commentId` - Delete comment

Archiving & Expiration:

- `POST /api/projects/files/:fileId/archive` - Archive
- `POST /api/projects/files/:fileId/restore` - Restore
- `GET /api/projects/:id/files/archived` - Archived files
- `PUT /api/projects/files/:fileId/expiration` - Set expiration
- `GET /api/projects/files/expiring-soon` - Expiring files
- `POST /api/projects/files/process-expired` - Process expired

Locking & Category:

- `POST /api/projects/files/:fileId/lock` - Lock file
- `POST /api/projects/files/:fileId/unlock` - Unlock file
- `PUT /api/projects/files/:fileId/category` - Set category
- `GET /api/projects/:id/files/by-category/:category` - By category

Stats & Search:

- `GET /api/projects/:id/files/stats` - File statistics
- `GET /api/projects/:id/files/search` - Search files

**Files Created:**

- `server/database/migrations/035_file_enhancements.sql`
- `server/services/file-service.ts`

**Files Modified:**

- `server/routes/projects.ts` - Added 30+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for file management types
- `docs/features/FILES.md` - Updated with Phase 6 documentation

---

### Phase 7: Analytics & Reporting Enhancement - COMPLETE

Implemented comprehensive analytics and reporting system with saved reports, scheduling, dashboards, KPIs, and metric alerts.

**New Features:**

- **Saved Reports** - Create, save, and share report configurations with filters, columns, and chart types
- **Report Scheduling** - Schedule automatic report generation (daily/weekly/monthly/quarterly) with email delivery
- **Dashboard Widgets** - Customizable dashboard with drag-and-drop widgets (metrics, charts, lists, tables)
- **Dashboard Presets** - 3 default presets: Executive Overview, Sales Dashboard, Project Manager
- **KPI Snapshots** - Historical tracking of key metrics (revenue, pipeline, clients, projects, conversion)
- **KPI Trends** - Trend analysis with change percentages over time
- **Metric Alerts** - Threshold-based alerts (above/below/equals/change) with email notifications
- **Quick Analytics** - Pre-built analytics for revenue, pipeline, projects, clients, and team
- **Report Run History** - Track report executions with status and results

**Database Changes (Migration 036):**

- Created `saved_reports` table for report configurations
- Created `report_schedules` table for automated scheduling
- Created `dashboard_widgets` table for user widget configurations
- Created `kpi_snapshots` table for historical KPI tracking
- Created `report_runs` table for execution history
- Created `dashboard_presets` table with 3 default presets
- Created `metric_alerts` table for threshold-based alerts
- Added comprehensive indexes for performance

**New API Endpoints (30+):**

Saved Reports:

- `GET/POST /api/analytics/reports` - Report CRUD
- `GET/PUT/DELETE /api/analytics/reports/:id` - Single report operations
- `POST /api/analytics/reports/:id/favorite` - Toggle favorite
- `POST /api/analytics/reports/:id/run` - Run report

Report Schedules:

- `GET/POST /api/analytics/reports/:reportId/schedules` - Schedule CRUD
- `PUT/DELETE /api/analytics/schedules/:id` - Update/delete schedule
- `POST /api/analytics/schedules/process` - Process due schedules

Dashboard Widgets:

- `GET/POST /api/analytics/widgets` - Widget CRUD
- `PUT/DELETE /api/analytics/widgets/:id` - Update/delete widget
- `PUT /api/analytics/widgets/layout` - Update widget layout
- `GET /api/analytics/widgets/presets` - Get presets
- `POST /api/analytics/widgets/presets/:id/apply` - Apply preset

KPI Snapshots:

- `POST /api/analytics/kpis/snapshot` - Capture snapshot
- `GET /api/analytics/kpis/latest` - Get latest KPIs
- `GET /api/analytics/kpis/:type/trend` - Get KPI trend

Metric Alerts:

- `GET/POST /api/analytics/alerts` - Alert CRUD
- `PUT/DELETE /api/analytics/alerts/:id` - Update/delete alert
- `POST /api/analytics/alerts/check` - Check triggers

Quick Analytics:

- `GET /api/analytics/quick/revenue` - Revenue analytics
- `GET /api/analytics/quick/pipeline` - Pipeline analytics
- `GET /api/analytics/quick/projects` - Project analytics
- `GET /api/analytics/quick/clients` - Client analytics
- `GET /api/analytics/quick/team` - Team analytics
- `GET /api/analytics/report-runs` - Report run history

**Files Created:**

- `server/database/migrations/036_analytics_enhancements.sql`
- `server/services/analytics-service.ts`
- `docs/features/ANALYTICS.md`

**Files Modified:**

- `server/routes/analytics.ts` - Added 30+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for analytics types

---

### State-of-the-Art Invoice System - COMPLETE

Implemented comprehensive, professional-grade invoice system with automation, scheduling, and advanced financial features comparable to industry leaders (Stripe, QuickBooks, FreshBooks).

**Core Invoice Features:**

- **Payment Plan Templates** - Reusable payment structures (50/50, 30/30/40, quarterly, etc.)
- **Milestone-Linked Invoices** - Link invoices to project milestones
- **Invoice Scheduling** - Schedule future invoice generation
- **Recurring Invoices** - Automated weekly/monthly/quarterly invoices
- **Payment Reminders** - Automated reminder emails based on due date
- **Scheduler Service** - Background job processing with node-cron
- **Delete/Void Invoice** - Delete drafts, void sent invoices
- **Duplicate Invoice** - Clone existing invoices as new drafts
- **Record Payment** - Record partial/full payments with method tracking
- **Invoice Search** - Filter by client, project, status, dates, amounts with pagination
- **Auto-Mark Overdue** - Scheduler daily checks and updates overdue status
- **Manual Send Reminder** - Send payment reminder email on demand

**Advanced Financial Features (NEW):**

- **Tax Support** - Invoice-level and line-item tax rates with automatic calculation
- **Discounts** - Percentage or fixed discounts at invoice or line level
- **Late Fees** - Automatic late fee calculation (flat, percentage, daily percentage)
- **Payment Terms Presets** - Net 15, Net 30, Net 60, Due on Receipt + custom terms
- **Payment History** - Full payment history tracking per invoice
- **A/R Aging Report** - Accounts receivable aging by bucket (current, 1-30, 31-60, 61-90, 90+)
- **Internal Notes** - Admin-only notes not visible to clients
- **Custom Invoice Numbers** - Custom prefix and sequential numbering (e.g., WEB-202602-0001)
- **Comprehensive Stats** - Revenue, outstanding, averages, status breakdown, monthly trends

**Database Changes (Migration 028 + 029):**

Migration 028:

- Created `payment_plan_templates` table with 5 default templates
- Created `invoice_reminders` table for reminder tracking
- Created `scheduled_invoices` table for future invoices
- Created `recurring_invoices` table for recurring patterns
- Added `milestone_id` and `payment_plan_id` columns to invoices

Migration 029:

- Created `invoice_payments` table for payment history tracking
- Created `payment_terms_presets` table with 8 default presets
- Added tax columns: `tax_rate`, `tax_amount`, `subtotal`
- Added discount columns: `discount_type`, `discount_value`, `discount_amount`
- Added late fee columns: `late_fee_rate`, `late_fee_type`, `late_fee_amount`, `late_fee_applied_at`
- Added `payment_terms_id`, `payment_terms_name` columns
- Added `internal_notes` column
- Added `invoice_prefix`, `invoice_sequence` columns

**New API Endpoints:**

Core Endpoints:

- `GET/POST/DELETE /api/invoices/payment-plans` - Template management
- `POST /api/invoices/generate-from-plan` - Generate from template
- `GET/POST /api/invoices/milestone/:id` - Milestone invoices
- `PUT /api/invoices/:id/link-milestone` - Link to milestone
- `GET/POST/DELETE /api/invoices/schedule[d]` - Scheduling
- `GET/POST/PUT/DELETE /api/invoices/recurring` - Recurring patterns
- `POST /api/invoices/recurring/:id/pause|resume` - Pause/resume
- `GET /api/invoices/:id/reminders` - View reminders
- `POST /api/invoices/reminders/:id/skip` - Skip reminder
- `DELETE /api/invoices/:id` - Delete/void invoice
- `POST /api/invoices/:id/duplicate` - Clone invoice
- `POST /api/invoices/:id/record-payment` - Record payment
- `POST /api/invoices/:id/send-reminder` - Manual reminder
- `GET /api/invoices/search` - Search with filters
- `POST /api/invoices/check-overdue` - Manual overdue check

Advanced Endpoints (NEW):

- `GET/POST /api/invoices/payment-terms` - Payment terms presets
- `POST /api/invoices/:id/apply-terms` - Apply terms to invoice
- `PUT /api/invoices/:id/tax-discount` - Update tax/discount
- `GET /api/invoices/:id/late-fee` - Calculate late fee
- `POST /api/invoices/:id/apply-late-fee` - Apply late fee
- `POST /api/invoices/process-late-fees` - Batch process late fees
- `GET /api/invoices/:id/payments` - Payment history
- `POST /api/invoices/:id/record-payment-with-history` - Record with history
- `GET /api/invoices/all-payments` - All payments report
- `GET /api/invoices/aging-report` - A/R aging report
- `PUT /api/invoices/:id/internal-notes` - Update internal notes
- `GET /api/invoices/comprehensive-stats` - Full statistics
- `POST /api/invoices/with-custom-number` - Custom invoice number

**Files Created:**

- `server/database/migrations/028_invoice_enhancements.sql`
- `server/database/migrations/029_invoice_advanced_features.sql`
- `server/services/scheduler-service.ts`

**Files Modified:**

- `server/services/invoice-service.ts` - Added ~35 new methods
- `server/routes/invoices.ts` - Added 25+ new endpoints
- `server/app.ts` - Integrated scheduler service
- `src/types/api.ts` - Added new TypeScript interfaces
- `docs/features/INVOICES.md` - Updated feature documentation
- `docs/API_DOCUMENTATION.md` - Added all new endpoints

---

## Completed - February 3, 2026

### Lead Panel UX Improvements

- **Status position** — Status badge and label moved above tabs in lead details panel; spacing tightened with `.panel-status-row` in `leads-pipeline.css`.
- **Project name clickable** — Project name in lead panel and table row now links to project details page when lead status is `in-progress` or `converted` (not just `converted`). Updated condition in `admin-leads.ts`.
- **Removed "View Project" button** — Project name link is sufficient; removed redundant button from lead details template.

### Table Icon Buttons

Converted all table action columns from text buttons to icon buttons for consistency:

- **Time Tracking** (`admin-time-tracking.ts`) — Edit/Delete buttons → icon buttons
- **Knowledge Base** (`admin-knowledge-base.ts`) — Edit/Delete buttons for categories and articles → icon buttons
- **Document Requests** (`admin-document-requests.ts`) — View/Start review/Approve/Reject/Remind/Delete → icon buttons

Added CSS variants in `admin.css`:

- `.icon-btn.icon-btn-danger:hover` — red hover state for destructive actions
- `.icon-btn.icon-btn-success:hover` — green hover state for approve actions

### Card Grid Consistency Fix

Fixed inconsistent card grid behavior where 4-card grids (`.quick-stats`, `.attention-grid`) would sometimes display as 3+1 instead of 4 across → 2×2 → 1 column.

- **Root cause:** `.attention-grid` was missing from responsive media query overrides in `admin.css`
- **Fix:** Added `.attention-grid` to all three responsive breakpoints (1200px, 1024px, 768px) alongside `.quick-stats`
- All 4-card grids now behave identically across the portal

### Dropdown Overflow Fix

Added overflow handling for project/client detail header dropdowns:

- `detail-header.css` — Added `overflow: visible; position: relative; z-index: 10;` to `.detail-title-row`
- `detail-header.css` — Added `overflow: visible; position: relative;` to `.detail-actions`

### Field Label Color Consistency

Updated all field labels on dark backgrounds to use `--portal-text-secondary` variable for consistent styling:

- **Root fix** — Changed `--label-color` in `variables.css` from `var(--color-gray-400)` to `var(--portal-text-secondary)`
- **Removed light theme rule** — Deleted unused `[data-theme="light"] .field-label` rule from `form-fields.css`
- **High specificity overrides** — Added `[data-page="admin"]` and `[data-page="client-portal"]` prefixes to field label rules in `project-detail.css`
- **Span exclusion** — Updated broad `#tab-project-detail span` color rule to exclude `.field-label` and `.meta-label` classes

### Table Alignment & Consistency Fixes

**Checkbox column alignment:**

- Increased `.bulk-select-cell` width from 44px to 56px
- Changed left padding to match text columns: `var(--space-4)` (32px)
- Updated bulk toolbar grid from 44px to 56px to match

**Invoices table checkbox column:**

- Added checkbox column header to invoices table HTML
- Updated `admin-invoices.ts` to render checkboxes in each row using `getPortalCheckboxHTML`
- Updated colspan from 7 to 8

**Table header alignment:**

- Changed `.admin-table-header` padding from `var(--space-2) var(--space-5)` to `var(--space-3) var(--space-4)` to align with table cell padding

**Table border radius (root fix):**

- Added `border-bottom-radius` and `overflow: hidden` to `.admin-table-container` by default
- When pagination follows, border-radius is removed via `:has(.table-pagination)` selector

### Files Modified (Feb 3)

- `src/features/admin/modules/admin-leads.ts` — Project name link, status position
- `src/features/admin/modules/admin-time-tracking.ts` — Icon buttons
- `src/features/admin/modules/admin-knowledge-base.ts` — Icon buttons
- `src/features/admin/modules/admin-document-requests.ts` — Icon buttons
- `src/features/admin/modules/admin-invoices.ts` — Checkbox column, colspan updates
- `src/styles/admin/leads-pipeline.css` — Status row styling
- `src/styles/pages/admin.css` — Icon button variants, card grid fixes, table alignment, border radius
- `src/styles/admin/detail-header.css` — Dropdown overflow fixes
- `src/styles/admin/table-features.css` — Bulk toolbar grid width
- `src/styles/variables.css` — Label color variable
- `src/styles/components/form-fields.css` — Field label rules
- `src/styles/admin/project-detail.css` — Field label specificity fixes
- `src/styles/admin/client-detail.css` — Field label color updates
- `admin/index.html` — Invoices table checkbox header

---

## Completed - February 5, 2026

### Table Audit Documentation

**Status:** COMPLETE

Created and updated comprehensive `docs/design/TABLE_AUDIT.md` with all 18 tables. Added UI display names (e.g., "Intake Submissions", "Client Accounts", "Contact Form Submissions"), exact `<th>` header text, HTML source locations, TypeScript module paths, nav tab identifiers. Added 3 previously missing tables: Visitors (Analytics), Project Detail Files sub-table, Project Detail Invoices sub-table. Fixed column discrepancies in Proposals and Document Requests. Added Display Name Reference quick-lookup section and Table Header Quick Reference.

---

### Table Audit Column Order Reference

**Status:** COMPLETE

Added comprehensive "Column Order Reference (All Tables)" section to TABLE_AUDIT.md with numbered columns for all 14 tables showing exact left-to-right display order, header names, and data sources. Replaces the previous condensed text format with clear numbered tables for each: Leads, Clients, Contacts, Projects, Invoices, Proposals, Time Tracking, Document Requests, KB Categories, KB Articles, Visitors, Project Files, Project Invoices, and Tasks List View.

---

### Cross-Module Consistency Standardization

**Status:** COMPLETE

Standardized notification and variable naming patterns across all admin modules for consistency.

**Notifications Standardized to `showToast()`:**

- `admin-document-requests.ts`: Replaced all `alertSuccess()`/`alertError()` with `showToast()`
- `admin-knowledge-base.ts`: Replaced all `alertSuccess()`/`alertError()`/`ctx.showNotification()` with `showToast()`
- `admin-contacts.ts`: Replaced all `ctx.showNotification()`/`storedContext.showNotification()` with `showToast()`
- `admin-clients.ts`: Replaced all `ctx.showNotification()`/`storedContext?.showNotification()` with `showToast()`

**Variable Naming Standardized (removed prefixes):**

- `admin-document-requests.ts`: `drFilterState` → `filterState`, `drPaginationState` → `paginationState`, `drFilterUIContainer` → `filterUIContainer`
- `admin-knowledge-base.ts`: `kbFilterState` → `filterState`, `kbArticlesPaginationState` → `paginationState`, `kbFilterUIContainer` → `filterUIContainer`

**Files Modified:**

- `src/features/admin/modules/admin-document-requests.ts`
- `src/features/admin/modules/admin-knowledge-base.ts`
- `src/features/admin/modules/admin-contacts.ts`
- `src/features/admin/modules/admin-clients.ts`

---

### Table Column Order Analysis

**Status:** COMPLETE

Comprehensive analysis of all 14 admin tables verifying column headers match data sources.

**Created:** `docs/design/TABLE_COLUMN_ANALYSIS.md` - Full analysis document

**Discrepancies Fixed in TABLE_AUDIT.md:**

- **Tasks List View**: Removed non-existent Checklist column (6→5 cols), fixed header "Title"→"Task", corrected column order (Due Date before Assignee)
- **Project Files**: Fixed Actions from "Download + Delete" to "Preview (conditional) + Download"
- **Project Invoices**: Fixed Actions from "View + Edit" to full list of 5 conditional buttons

**Naming Inconsistency Documented:**

- Document Requests uses "Due" while all other tables use "Due Date"

**Verified All Tables Match:** Leads, Clients, Contacts, Projects, Invoices, Proposals, Time Tracking, Document Requests, KB Categories, KB Articles, Visitors

---

### Cross-Table Consistency Fix

**Status:** COMPLETE

Implemented comprehensive standardization across all admin dashboard tables based on TABLE_AUDIT.md findings.

**Phase 1 - Fixed Dead/Orphaned UI:**

- Wired Leads export button to `exportToCsv()` with LEADS_EXPORT_CONFIG
- Wired Invoices bulk actions (Mark Paid, Send, Delete) with checkbox selection

**Phase 2-4 - Shared Infrastructure:**

- Invoices: Added filter UI (`createFilterUI`), pagination, replaced custom export with shared utility
- Proposals: Replaced custom filter buttons with `createFilterUI()`, added sortable headers
- Time Tracking: Replaced custom CSV export with shared `exportToCsv()` utility

**Phase 5 - HTML Structure Normalization:**

- Renamed tbody IDs: `dr-tbody` → `document-requests-table-body`, `kb-categories-tbody` → `kb-categories-table-body`, `kb-articles-tbody` → `kb-articles-table-body`
- Fixed KB localStorage key: `admin_kb_filter` → `admin_knowledge_base_filter`
- Added loading placeholder rows to Document Requests, KB Categories, KB Articles

**Phase 6 - Toolbar Standardization:**

- Reordered buttons: Search → Filter → View Toggle → Export → Refresh → Add (last)
- Standardized labels: "Create Invoice" → "Add Invoice", "New request" → "Add Request"
- Wrapped SVGs in `<span class="icon-btn-svg">` for consistency

**Phase 8-9 - State Standardization:**

- Empty state messages: "No {entity} yet." (zero data) / "No {entity} match the current filters." (filtered empty)
- Loading states: Added `showTableLoading()` to admin-leads.ts and admin-contacts.ts

**Phase 10 - Added Pagination:**

- Document Requests: Added pagination with `createPaginationUI()`
- KB Articles: Added pagination with `createPaginationUI()`

**Phase 11 - Filter Config Consistency:**

- Added `email` to Projects filter searchFields
- Added `contact_name` to Clients filter searchFields
- Documented intentional camelCase in Proposals config (API returns camelCase)

**Final Fixes:**

- Proposals: Added pagination (`createPaginationUI`, pagination state, container)
- Document Requests: Added sortable headers (`createSortableHeaders`)
- Projects: Wired export button to `exportToCsv()`
- Empty values: Updated `formatDisplayValue()` to return `-` instead of blank
- Proposals: Changed `btn-icon` to `icon-btn` class, added row click navigation
- Leads: Changed 14px icons to 16px for consistency

**Files Modified:**

- `admin/index.html`
- `src/features/admin/modules/admin-leads.ts`
- `src/features/admin/modules/admin-contacts.ts`
- `src/features/admin/modules/admin-projects.ts`
- `src/features/admin/modules/admin-clients.ts`
- `src/features/admin/modules/admin-invoices.ts`
- `src/features/admin/modules/admin-proposals.ts`
- `src/features/admin/modules/admin-time-tracking.ts`
- `src/features/admin/modules/admin-document-requests.ts`
- `src/features/admin/modules/admin-knowledge-base.ts`
- `src/utils/table-filter.ts`
- `src/utils/table-export.ts`
- `docs/design/TABLE_AUDIT.md`

---

### PDF Generation Audit & High Priority Fixes

**Status:** COMPLETE

Completed comprehensive PDF_AUDIT.md documentation and resolved all high priority issues.

**Added Missing Documentation:**

- Contract PDF endpoint (`GET /api/projects/:id/contract/pdf`) - was completely undocumented
- Contract signature request system (token generation, email notification, audit logging)
- PDF metadata settings (`setTitle`, `setAuthor`, `setSubject`, `setCreator`)
- IntakeDocument interface and helper functions with exact mapping values
- Line items table structure and column positions for Invoice PDF
- Page constants and font sizes for markdown-to-pdf script
- Code line counts for all PDF-generating files

**High Priority Fixes Applied:**

- **Consolidated BUSINESS_INFO**: Created `server/config/business.ts` as single source of truth
- **Removed unused pdfkit**: Removed `pdfkit` and `@types/pdfkit` from package.json (only pdf-lib used)
- **Fixed inconsistent website default**: All files now use `nobhad.codes`
- **Updated environment.ts**: Added missing fields (BUSINESS_OWNER, BUSINESS_TAGLINE, ZELLE_EMAIL)
- Deposit invoice title: Changed from "DEPOSIT INVOICE" to "INVOICE"

**Medium Priority Fixes Applied:**

- **Line item word wrapping**: Invoice bullet point details now wrap within column bounds
- **Centralized logo loading**: Added `getPdfLogoBytes()` with fallback paths to business.ts
- **Contract terms configurable**: Moved to `CONTRACT_TERMS` in business.ts (env override: `CONTRACT_TERMS`)

**Files Modified:**

- `server/config/business.ts` - Centralized business info, logo helper, contract terms
- `server/config/environment.ts` - Added missing business fields to schema
- `server/routes/invoices.ts` - Word-wrapped details, centralized logo, shared config
- `server/routes/proposals.ts` - Centralized logo, shared config
- `server/routes/projects.ts` - Centralized logo, contract terms from config
- `server/services/invoice-service.ts` - Import from shared config
- `scripts/markdown-to-pdf.ts` - Updated defaults to match shared config
- `package.json` - Removed pdfkit and @types/pdfkit
- `docs/design/PDF_AUDIT.md` - Comprehensive documentation update

---

### Admin UI Fixes

**Status:** COMPLETE

Fixed dropdown alignment and sidebar order issues.

**Changes:**

- **Dropdown alignment**: Table dropdowns now align left with trigger (`left: 0; right: auto; min-width: 100%`)
- **Dropdown overflow**: Changed `.admin-table-container` from `overflow: hidden` to `overflow: visible` so dropdowns overlay table
- **Sidebar order**: Reordered to logical grouping: DASHBOARD, LEADS, PROJECTS, CLIENTS, INVOICES, MESSAGES, DOCUMENTS, KNOWLEDGE, ANALYTICS, SYSTEM

**Files Modified:**

- `src/styles/shared/portal-dropdown.css` - Dropdown menu positioning
- `src/styles/pages/admin.css` - Dropdown positioning and table overflow
- `admin/index.html` - Sidebar button order

---

## Completed - February 6, 2026

### Error Handling Audit

**Status:** COMPLETE

Comprehensive audit of error handling patterns across the codebase (641 try/catch blocks total).

**Created:** `docs/design/ERROR_HANDLING_AUDIT.md`

**Issues Found & Fixed:**

- Fixed suppressed errors in `admin-system-status.ts` (4 blocks) - added console.error with module context
- Fixed suppressed errors in `admin-client-details.ts` (10 blocks) - added console.error with module context
- Fixed silent catch in `admin-auth.ts:146` - added console.warn for legacy session validation
- Fixed silent catch in `auth-store.ts:392` - added console.warn for logout API failure

**Error Logging Standards Established:**

- All catch blocks must log errors with `console.error('[ModuleName]', error)` or `console.warn` for expected failures
- Module context prefix `[ModuleName]` required for all error logs
- User-facing errors must show toast notification

**Files Modified:**

- `src/features/admin/modules/admin-system-status.ts`
- `src/features/admin/modules/admin-client-details.ts`
- `src/features/admin/admin-auth.ts`
- `src/auth/auth-store.ts`
- `docs/design/ERROR_HANDLING_AUDIT.md` (new)

---

### Messages Page Color Fix

**Status:** COMPLETE

Fixed white text on light background issue in messages page.

**Root Cause:** `--color-neutral-*` variables invert in dark theme (900 becomes light), causing white-on-white text.

**Fix:** Changed all text colors from `--color-neutral-*` to `--color-gray-*` which maintains proper contrast in all themes.

**Elements Fixed:**

- Thread list header, items, contact, preview, time
- Message content, body, sender, time
- Search input (added dark background with light text)

**Files Modified:**

- `src/styles/shared/portal-messages.css`

---

### TABLE_COLUMN_ANALYSIS Merged into TABLE_AUDIT

**Status:** COMPLETE

Merged content from TABLE_COLUMN_ANALYSIS.md into TABLE_AUDIT.md to consolidate documentation.

**Sections Added:**

- Column Verification Summary
- Column Count Quick Reference table
- Naming Conventions reference

**Files Modified:**

- `docs/design/TABLE_AUDIT.md`

**Files Deleted:**

- `docs/design/TABLE_COLUMN_ANALYSIS.md`

---

### PDF Caching & Utilities

**Status:** COMPLETE

Added in-memory PDF caching and utility functions for all PDF endpoints.

**New File Created:**

- `server/utils/pdf-utils.ts` — Shared utilities for PDF generation

**Caching Implementation:**

- TTL-based in-memory cache (default 5 minutes, configurable via `PDF_CACHE_TTL_MS`)
- LRU eviction when max entries reached (default 100, configurable via `PDF_CACHE_MAX_ENTRIES`)
- Cache key format: `{type}:{id}:{updatedAt}` — auto-invalidates when source data changes
- Response header `X-PDF-Cache: HIT|MISS` for debugging

**Utility Functions Added:**

- `getPdfCacheKey()`, `getCachedPdf()`, `cachePdf()`, `invalidatePdfCache()`, `clearPdfCache()`
- Multi-page helpers: `createPdfContext()`, `ensureSpace()`, `drawWrappedText()`, `addPageNumbers()`
- PDF/A metadata: `setPdfMetadata()` with title, author, subject, keywords, dates

**Endpoints Updated:**

- `GET /api/invoices/:id/pdf` — Invoice PDF with caching
- `GET /api/proposals/:id/pdf` — Proposal PDF with caching
- `GET /api/projects/:id/contract/pdf` — Contract PDF with caching
- `GET /api/projects/:id/intake/pdf` — Intake PDF with caching

**Files Modified:**

- `server/routes/invoices.ts` — Added pdf-utils import and caching
- `server/routes/proposals.ts` — Added pdf-utils import and caching
- `server/routes/projects.ts` — Added pdf-utils import and caching
- `docs/design/PDF_AUDIT.md` — Updated with PDF Utilities section, marked issues resolved

---

### CSS Architecture Audit

**Status:** COMPLETE

Comprehensive audit of 83 CSS files (33,555 lines).

**Created:** `docs/design/CSS_AUDIT.md`

**Current State:**

| Metric | Status |
| -------- | -------- |
| Hardcoded colors | 0 critical (3 acceptable fallbacks) |
| Z-index values | All portal files use `--z-index-portal-*` tokens |
| Standard breakpoints | All use `@custom-media` (`--mobile`, `--small-mobile`) |
| `.hidden` selector | Single source in `base/layout.css` |
| `.password-toggle` | Base styles in `shared/portal-forms.css` |
| `!important` declarations | 51 instances (most legitimate for GSAP/print) |

**Remaining (lower priority):**

- Non-standard breakpoints (900px, 1024px, 1300px) need evaluation
- Large files: `admin.css` (2,922 lines), `project-detail.css` (2,127 lines)
- Duplicate utility classes (`.text-*`, `.overview-grid`)

---

### Modals & Dialogs Audit

**Status:** COMPLETE

Comprehensive audit of all modals, dialogs, and overlay components.

**Created:** `docs/design/MODALS_AUDIT.md`

**Findings:**

- 7 modal implementation types
- 47+ files with modal code
- 20+ confirm/alert dialog instances
- 15+ form modal instances
- 3 z-index layers (9999, 10002, 10100)

**Modal Types:**

- ModalComponent (base class)
- PortalModal (lightweight factory)
- ConfirmDialog (Promise-based utilities)
- FocusTrap (accessibility utilities)
- ModalDropdown (select converter)
- Invoice modals (feature-specific)
- Admin module modals (dynamic)

---

### Forms Audit

**Status:** COMPLETE

Comprehensive audit of all forms, validation patterns, and accessibility.

**Created:** `docs/design/FORMS_AUDIT.md`

**Findings:**

- 9 major HTML forms across the codebase
- 11 field types (text, email, password, tel, number, date, url, checkbox, radio, textarea, select)
- 30+ validation functions in 3 layers (HTML5, client-side, server-side)
- 10 pre-defined validation schemas
- 7 CSS files dedicated to form styling

---

### Database Schema Audit

**Status:** COMPLETE

Comprehensive audit of database tables, relationships, and indexes.

**Created:** `docs/design/DATABASE_AUDIT.md`

**Statistics:**

- 44+ tables across 47 migrations
- 600+ columns total
- 180+ indexes
- 60+ foreign key relationships

---

### Form Label Associations Fix

**Status:** COMPLETE

Fixed accessibility issue from Forms Audit.

- Fixed missing label association in `admin/index.html` line 2067
- Added `<label for="file-comment-input" class="sr-only">` and `aria-label` to file comment textarea
- All other forms already had proper associations

---

### Audit Critical & High Priority Fixes

**Status:** COMPLETE

Implemented fixes for all critical and high priority issues from the database, forms, and modals audits.

**Phase 1 - Database Critical Fixes:**

- Removed deprecated `users` table and dead code
  - Deleted unused `/auth/register` endpoint from `api.ts`
  - Fixed avatar upload to use `clients` table instead of `users`
  - Fixed status metrics endpoint to query `clients` instead of `users`
  - Deleted unused `server/models/User.ts`
  - Created migration `048_drop_deprecated_users_table.sql`
- Fixed project status CHECK constraint
  - Created migration `049_fix_project_status_constraint.sql`
  - Added 'active' and 'cancelled' to allowed status values

**Phase 2 - Database High Priority Fixes:**

- Fixed boolean handling in `row-helpers.ts`
  - Updated `getBoolean()` and `getBooleanOrNull()` to handle SQLite's 0/1 representation
  - Removed unused `sqliteBoolToJs/jsBoolToSqlite` from `database.ts`

**Phase 3 - Forms High Priority Fixes:**

- Created reusable password toggle component
  - New file: `src/components/password-toggle.ts`
  - Features: icon updates (eye/eye-off), ARIA labels, `initPasswordToggle()` and `initAllPasswordToggles()`
  - Updated `admin-login.ts` to use new component
  - Updated `client/set-password.html` with toggle buttons and component import
  - Exported from `src/components/index.ts`

**Files Modified:**

- `server/routes/api.ts` - Removed dead registration code, fixed status metrics
- `server/routes/uploads.ts` - Fixed avatar upload table reference
- `server/database/row-helpers.ts` - Fixed boolean handling
- `server/types/database.ts` - Removed unused boolean helpers
- `src/features/main-site/admin-login.ts` - Use password toggle component
- `client/set-password.html` - Added toggle buttons, use component
- `src/components/index.ts` - Export password toggle

**Files Created:**

- `server/database/migrations/048_drop_deprecated_users_table.sql`
- `server/database/migrations/049_fix_project_status_constraint.sql`
- `src/components/password-toggle.ts`

**Files Deleted:**

- `server/models/User.ts`

---

### Soft Delete Documentation Update

**Status:** COMPLETE

Updated all documentation to reflect soft delete system.

**Documentation Updated:**

- `docs/API_DOCUMENTATION.md` - Added Soft Delete & Recovery System section with 5 new endpoints
- `docs/ARCHITECTURE.md` - Added soft-delete-service.ts and query-helpers.ts to file listings
- `docs/features/CLIENTS.md` - Added soft delete behavior section and change log entry
- `docs/features/PROJECTS.md` - Added soft delete behavior section and change log entry
- `docs/features/INVOICES.md` - Added soft delete behavior section (paid invoice protection)
- `docs/features/PROPOSALS.md` - Added soft delete behavior section and DELETE endpoint documentation
- `docs/features/LEADS.md` - Added soft delete behavior section
- `docs/design/DATABASE_AUDIT.md` - Added migrations 048, 049, 050

---

### 30-Day Soft Delete Recovery System

**Status:** COMPLETE

Implemented soft delete with 30-day recovery.

**Core Pattern:**

- Added `deleted_at` and `deleted_by` columns to: clients, projects, invoices, client_intakes, proposal_requests
- Converted DELETE endpoints to soft delete via `softDeleteService`
- Added `WHERE deleted_at IS NULL` to all SELECT queries using `notDeleted()` helper
- Added admin API endpoints for viewing/restoring deleted items
- Added scheduled cleanup job (daily at 2 AM) to permanently delete items older than 30 days

**Cascade Behavior:**

- Deleting client cascades to: projects, proposals, voids unpaid invoices (keeps paid)
- Deleting project cascades to: proposals (keeps invoices)
- Paid invoices cannot be deleted

**Files Created:**

- `server/database/migrations/050_soft_delete_system.sql`
- `server/services/soft-delete-service.ts`
- `server/database/query-helpers.ts`

**Files Modified:**

- `server/routes/clients.ts` - Soft delete endpoint, query updates
- `server/routes/projects.ts` - Soft delete endpoint, query updates
- `server/routes/invoices.ts` - Soft delete endpoint
- `server/routes/proposals.ts` - New DELETE endpoint, query updates
- `server/routes/admin.ts` - New deleted items management endpoints
- `server/services/scheduler-service.ts` - Daily cleanup job

**Admin API Endpoints:**

- `GET /api/admin/deleted-items` - List deleted items (optional ?type= filter)
- `GET /api/admin/deleted-items/stats` - Get counts by entity type
- `POST /api/admin/deleted-items/:type/:id/restore` - Restore a deleted item
- `DELETE /api/admin/deleted-items/:type/:id/permanent` - Force permanent delete
- `POST /api/admin/deleted-items/cleanup` - Manual cleanup trigger

---

### Audit Re-do: Accessibility & Reusable Components

**Status:** COMPLETE

Re-audited and completed all remaining issues.

**Accessibility Audit:**

- WCAG 1.4.1 (Use of Color): PASS - All badges include text labels as non-color indicator
- WCAG 1.4.3 (Contrast): REVIEWED - All badge colors pass AA (4.5:1+), purple/gray borderline but acceptable
- Skip links: Already implemented on all pages

**Reusable Components - Status Badges:**

- Migrated inline badge markup to `getStatusBadgeHTML()` in admin-contacts, admin-projects, project-details/invoices
- Added invoice-specific status CSS (draft, sent, viewed, partial, paid, overdue)

**Reusable Components - Dropdowns:**

- Verified all form selects already use `initModalDropdown()`
- Project details status dropdown marked as intentional exception (custom auto-save behavior)

**Color Contrast Analysis:**

- Blue/Yellow/Green/Red badges: 4.6-12.5:1 ✅ PASS
- Purple/Gray badges: 4.4-4.5:1 ⚠️ Borderline (acceptable with semibold weight)

**Files Modified:**

- `src/features/admin/modules/admin-contacts.ts`
- `src/features/admin/modules/admin-projects.ts`
- `src/features/admin/project-details/invoices.ts`
- `src/styles/shared/portal-badges.css`
- `docs/design/ACCESSIBILITY_AUDIT.md`
- `docs/design/REUSABLE_COMPONENTS_AUDIT.md`

---

### Modal Audit Fixes Completed

**Status:** COMPLETE

Implemented all modal audit recommendations.

**Changes:**

- Centralized modal sizes via `--modal-width-*` variables
- Unified overlay open/close lifecycle with `modal-utils` across admin modules
- Added `.closing` animation for admin/portal overlays
- Added `aria-describedby` to confirm/alert/prompt dialogs
- Standardized portal modal show/hide to use shared utilities

**Resolved Issues:**

- Auto-opening admin modals blocking login
- Hardcoded z-index values (now tokenized via `--z-index-portal-*`)
- Mixed modal patterns (standardized via `modal-utils`)
- Inconsistent close animation timing (standardized with `.closing`)
- Dropdown positioning (aligned to shared portal dropdown tokens)
- Missing `aria-describedby` in dialogs
- Inconsistent modal sizing (centralized with `--modal-width-*`)

**Files Modified:**

- `src/utils/modal-utils.ts`
- `src/components/portal-modal.ts`
- `src/utils/confirm-dialog.ts`
- `src/styles/admin/modals.css`
- `src/styles/shared/confirm-dialog.css`
- `src/styles/variables.css`
- `src/features/admin/admin-dashboard.ts`
- `src/features/admin/modules/admin-projects.ts`
- `src/features/admin/modules/admin-clients.ts`
- `src/features/admin/modules/admin-document-requests.ts`
- `src/features/admin/modules/admin-files.ts`
- `src/features/admin/modules/admin-leads.ts`
- `src/features/admin/modules/admin-contacts.ts`
- `src/features/admin/project-details/actions.ts`

---

### Admin Modals Safety Guard + Overlay Fixes

**Status:** COMPLETE

Prevented auto-opening modals from blocking the admin login.

**Changes:**

- Call `hideAllAdminModals()` once on page load to clear any open modals
- Forced `.hidden` to win over modal display rules
- Ensured preview modal starts hidden by default
- Fixed `/api/admin/leads` 500 by removing non-existent `projects.features` column

**Note:** Removed MutationObserver-based modal guard - it caused infinite loops and page crashes.

**Files Modified:**

- `src/features/admin/admin-dashboard.ts`
- `src/styles/admin/modals.css`
- `src/features/admin/modules/admin-projects.ts`
- `server/routes/admin.ts`

---

### Edit Project Modal Dropdown Fix

**Status:** COMPLETE

Fixed missing dropdowns in edit project modal.

**Root Cause:** `initProjectModalDropdowns()` was called before `setupEditProjectModalHandlers()` which creates the dropdown elements. The type dropdown was also being double-wrapped with `initModalDropdown`.

**Changes:**

- Reordered function calls: `setupEditProjectModalHandlers()` now runs before `initProjectModalDropdowns()`
- Simplified `initProjectModalDropdowns()` to directly set value on the select created by `createFilterSelect`
- Removed unnecessary `initModalDropdown` wrapping logic for type dropdown

**Files Modified:**

- `src/features/admin/modules/admin-projects.ts`

---

### Page Heading Structure Fix

**Status:** COMPLETE

WCAG accessibility fix - converted all page-title H2 to H1.

**Issue:** WCAG 2.4.1 requires each page/view to have exactly one H1 as the primary heading. All main tabs in admin and portal were using H2.

**Changes:**

- Converted 10 `.page-title h2` to `h1` in admin/index.html (Dashboard, Leads, Projects, Clients, Invoices, Messages, Analytics, Document Requests, Knowledge Base, System Status)
- Converted 9 `.page-title h2` to `h1` in client/portal.html (Dashboard, Files, Messages, Invoices, Document Requests, Help, Settings, New Project, Project Preview)
- Updated CSS to support both h1 and h2 in `.page-title` selectors

**Files Modified:**

- `admin/index.html`
- `client/portal.html`
- `src/styles/admin/project-detail.css`
- `src/styles/client-portal/layout.css`
- `docs/design/UX_UI_IMPLEMENTATION_PLAN.md`

---

### Audit Outstanding Tasks

**Status:** COMPLETE

Completed multiple audit fixes.

**Tasks Completed:**

1. **Composite Database Indexes** - Added migration `051_composite_indexes.sql` with 11 new indexes for common query patterns (projects, time_entries, client_activities, audit_logs, invoices, general_messages, page_views, interaction_events)

2. **Analytics Data Retention** - Added scheduled cleanup job to `scheduler-service.ts` that deletes page_views and interaction_events older than 365 days (configurable via `analyticsRetentionDays`)

3. **Form Required Attributes** - Updated `contact-form.ts` to use HTML5 `required` attribute instead of `data-required` for consistency with existing forms

4. **Modal Fieldset/Legend** - Added fieldset/legend elements to Add Client modal and Add Project modal for screen reader accessibility. Added CSS styling for fieldset/legend in `admin/modals.css`

**Files Modified:**

- `server/database/migrations/051_composite_indexes.sql` (new)
- `server/services/scheduler-service.ts`
- `src/modules/ui/contact-form.ts`
- `src/styles/admin/modals.css`
- `admin/index.html`
- `docs/design/DATABASE_AUDIT.md`
- `docs/design/FORMS_AUDIT.md`
- `docs/design/ACCESSIBILITY_AUDIT.md`

---

### Accessibility & Validation Enhancements

**Status:** COMPLETE

Completed remaining audit tasks.

**Tasks Completed:**

1. **aria-activedescendant for Listboxes** - Added unique IDs to thread items and aria-activedescendant updates on selection in both `admin-messaging.ts` and `portal-messages.ts` for enhanced screen reader support

2. **JSON Schema Validation** - Added comprehensive JSON validators to `shared/validation/validators.ts` for complex database fields (tier_data, features_data, pricing_data, line_items). Applied validation in `proposal-service.ts`

**Files Modified:**

- `src/features/admin/modules/admin-messaging.ts`
- `src/features/client/modules/portal-messages.ts`
- `shared/validation/validators.ts`
- `shared/validation/index.ts`
- `server/services/proposal-service.ts`
- `docs/design/DATABASE_AUDIT.md`

---

### Admin UI for Deleted Items

**Status:** COMPLETE

Created admin UI module for viewing and managing soft-deleted items.

**Files Created:**

- `src/features/admin/modules/admin-deleted-items.ts` - Admin module for deleted items management

**Files Modified:**

- `src/features/admin/modules/index.ts` - Added module loader
- `server/routes/admin.ts` - Added API endpoints for deleted items

**API Endpoints Added:**

- `GET /api/admin/deleted-items` - List all soft-deleted items (optional type filter)
- `GET /api/admin/deleted-items/stats` - Get counts by entity type
- `POST /api/admin/deleted-items/:type/:id/restore` - Restore a soft-deleted item
- `DELETE /api/admin/deleted-items/:type/:id/permanent` - Permanently delete an item

**Features:**

- Table view of all deleted items
- Filter by entity type (client, project, invoice, lead, proposal)
- Days until permanent deletion column with urgency indicators
- Restore button per row
- Permanent delete with confirmation dialog

---

### PDF Multi-Page Support

**Status:** COMPLETE

Added multi-page overflow handling to invoice and proposal PDF generation.

**Files Modified:**

- `server/routes/invoices.ts` - Integrated PdfPageContext for page break detection
- `server/routes/proposals.ts` - Integrated PdfPageContext for page break detection

**Features:**

- Automatic page breaks when content exceeds page height
- Continuation headers on subsequent pages
- Page numbers for multi-page documents
- Maintained existing PDF layout and styling

---

### Form Error Display Unification

**Status:** COMPLETE

Unified contact form error display to use inline errors instead of popup errors.

**Files Modified:**

- `src/modules/ui/contact-form.ts` - Changed from showTemporaryFieldError (popups) to showFieldError (inline)

**Features:**

- Inline error messages with ARIA attributes for accessibility
- Focus management on first error field
- Consistent error pattern across all forms

---

### Status Color Differentiation

**Status:** COMPLETE

Fixed NEW vs ON-HOLD/PENDING using same color.

**Files Modified:**

- `src/design-system/tokens/colors.css` - Added `--status-new: #06b6d4` (cyan)
- `src/styles/shared/portal-badges.css` - Separated NEW badge styling

**Result:**

- NEW badges are now cyan
- PENDING/ON-HOLD badges remain yellow

---

### PDF Batch Export

**Status:** COMPLETE

Added bulk PDF export for invoices as ZIP file.

**Files Created:**

- None (feature added to existing files)

**Files Modified:**

- `server/routes/invoices.ts` - Added `POST /api/invoices/export-batch` endpoint
- `src/features/admin/modules/admin-invoices.ts` - Added "Download PDFs" bulk action
- `package.json` - Added `archiver` dependency

**Features:**

- Select multiple invoices via checkboxes
- Click "Download PDFs" bulk action
- Generates ZIP file with all selected invoice PDFs
- Includes manifest.json with export summary
- Maximum 100 invoices per export

**API Endpoint:**

- `POST /api/invoices/export-batch` - Body: `{ invoiceIds: number[] }`

---

### Audit Documentation Cleanup

**Status:** COMPLETE

Cleaned up all audit files to reflect current state only (no fix logs).

**Files Modified:**

- `docs/design/FORMS_AUDIT.md` - Added validation layer usage guide, removed resolved issues
- `docs/design/ACCESSIBILITY_AUDIT.md` - Moved completed items to "Completed Enhancements"
- `docs/design/DATABASE_AUDIT.md` - Removed resolved issues log, consolidated open issues
- `docs/design/PDF_AUDIT.md` - Removed completed batch export from improvements

---

### Lint Fix: admin-deleted-items.ts

**Status:** COMPLETE

Removed unused `storedContext` variable that was declared but never read.

**Files Modified:**

- `src/features/admin/modules/admin-deleted-items.ts` - Removed unused variable and its assignments

**Changes:**

- Removed `storedContext` module-level variable
- Updated `setDeletedItemsContext()` to be a no-op (context passed directly to functions)
- Removed assignment from `cleanupDeletedItems()`

---

### Analytics Label Consistency Verification

**Status:** VERIFIED - No Issue

Verified that analytics page headings are consistent (was listed as potential issue).

**Finding:**

- Section titles correctly use `tab-section-heading` class
- Card titles correctly use plain `h3` elements
- No inconsistency exists - removed from current_work.md

---

### Global Tasks Kanban Tab

**Status:** COMPLETE

Added dedicated Tasks tab to admin dashboard showing Kanban board of tasks across ALL projects.

**Files Created:**

- `src/features/admin/modules/admin-global-tasks.ts` - Global tasks module with Kanban/List views

**Files Modified:**

- `server/services/project-service.ts` - Added `getAllTasks()` method
- `server/routes/admin.ts` - Added `GET /api/admin/tasks` endpoint
- `src/features/admin/modules/index.ts` - Added `loadGlobalTasksModule()` loader
- `src/features/admin/admin-dashboard.ts` - Added tasks tab case and breadcrumb
- `admin/index.html` - Added sidebar button and tab content container

**Features:**

- Kanban board with columns: To Do, In Progress, Blocked, Done
- List view alternative with sortable table
- Tasks ordered by priority (urgent > high > medium > low) then due date
- Drag-and-drop status updates
- Click-to-view task detail modal with "View Project" navigation
- Full accessibility: focus trap, keyboard nav, ARIA attributes

**API Endpoint:**

- `GET /api/admin/tasks` - Query params: status, priority, limit (default 100, max 500)

---

### Empty Cell Convention Standardization

**Status:** COMPLETE

Standardized all table cells to display empty for null/missing values instead of "-".

**Files Modified:**

- `src/utils/format-utils.ts` - Updated `formatDisplayValue()`, `formatDate()`, `formatDateTime()` to return `''`
- `src/utils/sanitization-utils.ts` - Updated phone formatter fallback
- `src/features/admin/modules/*.ts` - All admin modules updated (clients, contacts, projects, invoices, etc.)
- `src/features/admin/admin-dashboard.ts` - Updated fallback patterns
- `src/features/admin/admin-project-details.ts` - Updated display setters
- `src/features/admin/renderers/admin-contacts.renderer.ts` - Updated row rendering

**Standard:**

- All `|| '-'` patterns replaced with `|| ''`
- `formatDisplayValue()` returns `''` for empty values
- `formatDate()`/`formatDateTime()` return `''` for null/invalid dates

---

### Workflows UI (Approvals + Triggers)

**Status:** COMPLETE

Added new Workflows tab to admin dashboard with UI for managing approval workflows and event triggers.

**Features - Approvals:**

- List all approval workflow definitions
- Create/edit workflows with entity type (proposal, invoice, contract, deliverable, project)
- Select workflow type (sequential, parallel, any-one)
- Manage approval steps (add/remove approvers)
- Support for optional steps and auto-approve timeouts

**Features - Triggers:**

- List all event triggers
- Create/edit triggers with 31 event types
- Configure 5 action types: send_email, create_task, update_status, webhook, notify
- JSON configuration for action settings and conditions
- Toggle triggers active/inactive
- Priority ordering

**Files Created:**

- `src/features/admin/modules/admin-workflows.ts` - Complete module
- `src/styles/admin/workflows.css` - Module styling

**Files Modified:**

- `admin/index.html` - Added Workflows sidebar button and tab content
- `src/features/admin/admin-dashboard.ts` - Tab routing and breadcrumbs
- `src/features/admin/modules/index.ts` - Export loader
- `src/styles/admin/index.css` - Import workflows.css

**API Endpoints Used:**

- `GET /api/approvals/workflows` - List workflows
- `POST /api/approvals/workflows` - Create workflow
- `GET /api/approvals/workflows/:id` - Get workflow with steps
- `POST /api/approvals/workflows/:id/steps` - Add step
- `DELETE /api/approvals/workflows/:id` - Delete workflow
- `GET /api/triggers` - List triggers
- `GET /api/triggers/options` - Get event/action types
- `POST /api/triggers` - Create trigger
- `PUT /api/triggers/:id` - Update trigger
- `POST /api/triggers/:id/toggle` - Toggle active
- `DELETE /api/triggers/:id` - Delete trigger

---

### CSS File Splitting - Admin Styles

**Status:** COMPLETE

Split large CSS files into focused modules for maintainability.

**From `pages/admin.css` (2,920 → 2,064 lines):**

- `admin/table-dropdowns.css` (350 lines) - Inline table status dropdowns with color-coded dots
- `admin/tooltips.css` (118 lines) - CSS-only tooltips using data-tooltip attribute
- `admin/table-filters.css` (314 lines) - Filter controls, sortable headers, mobile responsive
- `admin/sidebar-badges.css` (110 lines) - Sidebar notification badges

**From `admin/project-detail.css` (2,129 → 1,645 lines):**

- `admin/pd-contract.css` (161 lines) - Contract tab styles
- `admin/pd-invoices.css` (377 lines) - Invoice tab and modal styles

**Files Created:**

- `src/styles/admin/table-dropdowns.css`
- `src/styles/admin/tooltips.css`
- `src/styles/admin/table-filters.css`
- `src/styles/admin/sidebar-badges.css`
- `src/styles/admin/pd-contract.css`
- `src/styles/admin/pd-invoices.css`

**Files Modified:**

- `src/styles/admin/index.css` - Added imports for 6 new files
- `src/styles/pages/admin.css` - Removed extracted sections, added redirect comments
- `src/styles/admin/project-detail.css` - Removed extracted sections, added redirect comments

**Documentation Updated:**

- `docs/design/CSS_AUDIT.md` - Updated metrics, marked files as split
- `docs/design/CSS_ARCHITECTURE.md` - Updated file counts and structure
- `docs/design/PORTAL_CSS_DESIGN.md` - Updated admin file count (15 → 21)

---

### CSS Consistency Fixes

**Status:** COMPLETE

Resolved all CSS inconsistencies documented in CSS_AUDIT.md.

**Label Font Size (0.6875rem → 0.75rem):**

- `admin/client-detail.css` - field-label, meta-label
- `admin/pd-contract.css` - contract field-label
- `admin/project-detail.css` - overview labels
- `admin/leads-pipeline.css` - funnel labels, source stats, rule conditions, panel labels (5 instances)

**Border Radius (--border-radius-card → --portal-radius-md):**

- `admin/analytics.css` (5 occurrences)
- `admin/modals.css` (3 occurrences)
- `admin/project-detail.css` (1 occurrence)
- `admin/table-filters.css` (1 occurrence)
- `shared/portal-cards.css` (11 occurrences)
- `shared/portal-files.css` (2 occurrences)
- `shared/portal-messages.css` (2 occurrences)
- `shared/search-bar.css` (1 occurrence)
- `client-portal/components.css` (1 occurrence)
- `client-portal/documents.css` (1 occurrence)
- `client-portal/help.css` (2 occurrences)
- `client-portal/settings.css` (2 occurrences)
- `pages/admin.css` (8 occurrences)

**Other Fixes:**

- Filter dropdown padding: `1rem` → `var(--space-3)`
- Search bar fallback chain simplified to `var(--portal-radius-lg)`

**Documentation Updated:**

- `docs/design/CSS_AUDIT.md` - Marked inconsistencies as resolved
- `docs/current_work.md` - Updated CSS refactoring status

---

### CSS Audit - Smaller Files Consistency (Feb 7)

**Status:** COMPLETE

Audited smaller CSS files (<500 lines) for inconsistencies and applied fixes.

**New Tokens Added to variables.css:**

- `--icon-size-xs` through `--icon-size-2xl` (12px-32px)
- `--letter-spacing-label` (0.05em), `--letter-spacing-title` (0.02em), `--letter-spacing-wide` (0.08em)

**Focus States Added (Accessibility):**

- `shared/view-toggle.css` - Added `:focus-visible` to toggle buttons
- `shared/search-bar.css` - Added focus ring to input, `:focus-visible` to clear button

**Font Sizes Fixed (Accessibility - minimum 0.75rem):**

- `admin/table-filters.css` - filter count badge
- `shared/portal-cards.css` - task priority badges
- `admin/sidebar-badges.css` - collapsed badge font size

**Icon Sizes Tokenized:**

- `shared/view-toggle.css` - 14px/12px → `--icon-size-sm`/`--icon-size-xs`
- `shared/search-bar.css` - 14px/24px → `--icon-size-sm`/`--icon-size-xl`
- `admin/workflows.css` - 14px → `--icon-size-sm`
- `admin/detail-header.css` - 18px/16px → `--icon-size-lg`/`--icon-size-md`
- `shared/confirm-dialog.css` - 32px → `--icon-size-2xl`
- `admin/sidebar-badges.css` - 16px → `--icon-size-md`

**Hardcoded Values Replaced:**

- Gap/margin `4px`/`6px` → `var(--space-0-5)`
- Padding `8px 12px` → `var(--space-1) var(--space-1-5)`
- Border-radius `4px` → `var(--portal-radius-sm)`
- Letter-spacing `1px` → `var(--letter-spacing-label)`
- Transitions `0.15s ease` → `var(--transition-fast)`

**Duplicate Declarations Removed:**

- `admin/detail-header.css` - Removed duplicate padding/list-style/margin

**Documentation Updated:**

- `docs/design/CSS_AUDIT.md` - Updated with fixes applied, current compliant state
- `docs/design/CSS_ARCHITECTURE.md` - Added Icon Sizes and Letter Spacing sections
- `docs/current_work.md` - Added CSS Audit completion entry

---

## Completed - February 9, 2026

### General UI/UX Enhancements

**Status:** COMPLETE

Four interconnected features to improve project management workflow.

#### Secondary Sidebar for Multi-Tab Pages

**Status:** COMPLETE (disabled per user preference)

Created reusable secondary sidebar component for vertical tab navigation on detail pages.

**Implementation:**

- Created `src/styles/admin/secondary-sidebar.css` with vertical tab styling
- Created `src/components/secondary-sidebar.ts` with reusable component
- Features: collapsible to icon-only mode, localStorage state persistence, horizontal fallback on mobile
- Responsive: shows at >1300px, collapses at 1024-1300px, hidden <1024px with horizontal tabs fallback

**Files Created:**

- `src/styles/admin/secondary-sidebar.css`
- `src/components/secondary-sidebar.ts`
- `docs/features/SECONDARY_SIDEBAR.md`

**Note:** Feature complete but disabled per user preference. Documentation preserved for future re-enablement.

#### Project Milestones Auto-Population

**Status:** COMPLETE

Milestones are now auto-generated when projects are created.

**Implementation:**

- Created `server/config/default-milestones.ts` with milestone templates per project type
- Created `server/services/milestone-generator.ts` for auto-generation logic
- Integrated into `POST /api/projects` and `POST /api/admin/projects` routes
- Added `POST /api/admin/milestones/backfill` endpoint for existing projects

**Project Type Templates:**

- `simple-site`: Discovery & Planning (3d), Design & Development (7d), Testing & Launch (4d)
- `business-site`: Discovery (5d), Design (7d), Development (10d), Content (5d), Launch (5d)
- `ecommerce-site`: Discovery (5d), Design (7d), Development (14d), Product Setup (7d), Launch (5d)
- `web-app`: Discovery (7d), Architecture (7d), Development (21d), Testing (7d), Launch (5d)
- `maintenance`: Assessment (3d), Implementation (varies), Documentation (2d)
- `other`: Phase 1 (7d), Phase 2 (14d), Phase 3 (7d)

**Files Created:**

- `server/config/default-milestones.ts`
- `server/services/milestone-generator.ts`
- `docs/features/MILESTONES.md`

**Files Modified:**

- `server/routes/projects.ts` - Added milestone generation on project create
- `server/routes/admin.ts` - Added milestone generation and backfill endpoint

#### Task Priority Auto-Update

**Status:** COMPLETE

Task priorities automatically escalate based on due date proximity.

**Escalation Rules:**

- ≤1 day until due → `urgent`
- ≤3 days until due → `high`
- ≤7 days until due → `medium`
- >7 days → no change

**Implementation:**

- Created `server/services/priority-escalation-service.ts` with escalation logic
- Only escalates UP (never downgrades priority)
- Excludes completed and cancelled tasks
- Added scheduled job running daily at 6 AM
- Added API endpoint: `POST /api/projects/:id/tasks/escalate-priorities`

**Files Created:**

- `server/services/priority-escalation-service.ts`

**Files Modified:**

- `server/routes/projects.ts` - Added escalation endpoint
- `server/services/scheduler-service.ts` - Added daily escalation job

#### Project Detail Page Restructure

**Status:** COMPLETE

Redesigned project detail overview tab with two-column layout and header card.

**Header Card:**

- Added above tabs (matches client detail pattern)
- Shows: project name, status badge, client info, type, dates, budget
- Quick actions accessible from header

**Overview Tab Layout:**

- Two-column grid layout (60/40 split)
- Left column: Project Details card, Milestones card
- Right column: Progress ring, Financial summary, Quick stats
- Recent Activity section at bottom (full width)

**Sidebar Stats:**

- Files count, Messages count, Tasks count, Invoices count
- Financial totals: Invoiced, Paid, Outstanding

**Responsive Behavior:**

- Stacks to single column on tablet (<1024px)
- Optimized card order for mobile viewing

**Files Modified:**

- `admin/index.html` - Added header card and overview structure
- `src/styles/admin/project-detail.css` - Two-column grid, responsive styles
- `src/features/admin/modules/admin-projects.ts` - Data loading and rendering

---

### Bug Fixes - February 9, 2026

#### Intake PDF HTML Entity Decoding

**Status:** COMPLETE

Fixed HTML entities appearing in generated intake PDFs (e.g., `&amp;` instead of `&`).

**Issue:**

- Client names like "Emily Gold & Abigail Wolf" displayed as "Emily Gold &amp; Abigail Wolf"
- Other fields could also contain encoded entities

**Solution:**

- Applied `decodeHtml()` function to all user-input text fields in PDF generation
- Fields updated: client name, company name, project name, description, features, technical info

**Files Modified:**

- `server/routes/projects.ts` - Added decodeHtml wrapping to PDF text fields

#### Intake PDF Newline Encoding Error

**Status:** COMPLETE

Fixed "WinAnsi cannot encode \n" error when generating intake PDFs.

**Issue:**

- Description fields containing newlines caused pdf-lib encoding error
- Error: `WinAnsi cannot encode "\n" (0x000a)`

**Solution:**

- Created `sanitizeForPdf()` helper function
- Replaces newlines, tabs, and multiple spaces with single spaces
- Applied to all text fields before rendering to PDF

**Files Modified:**

- `server/routes/projects.ts` - Added sanitizeForPdf helper, applied to all text fields

#### Client Proposal Preview Modal Fix

**Status:** COMPLETE

Fixed two issues with client proposal preview modal.

**Issue 1 - Close Button:**

- Modal couldn't be closed after opening
- `onClose` callback wasn't calling `modal.hide()`

**Issue 2 - Markdown Rendering:**

- `.md` files displayed raw markdown instead of rendered HTML
- Styling didn't match rest of site

**Solution:**

- Added `modal.hide()` call in `onClose` callback
- Created `renderMarkdown()` function for basic markdown-to-HTML conversion
- Created `showMarkdownPreviewModal()` for `.md` file previews
- Added `.md-preview` CSS styles for rendered markdown

**Files Modified:**

- `src/features/admin/modules/admin-projects.ts` - Fixed close handler, added markdown rendering
- `src/styles/admin/modals.css` - Added markdown preview styles

#### URL Field HTML Entity Decoding

**Status:** COMPLETE

Fixed URL fields showing encoded entities in edit modal.

**Issue:**

- URLs displayed as `amp;amp;#x2F;hedgewitchhorticulture.com&amp;amp;a` instead of normal text
- Affected: preview_url, repo_url, production_url fields

**Solution:**

- Applied `SanitizationUtils.decodeHtmlEntities()` when loading URLs into edit form

**Files Modified:**

- `src/features/admin/modules/admin-projects.ts` - Added entity decoding to URL field loading

#### Quoted Price Display Fix

**Status:** COMPLETE

Fixed quoted price showing as $0.00 when saved with comma formatting.

**Issue:**

- Price saved as "4,500" displayed as "$0.00"
- `Number("4,500")` returns NaN due to comma

**Solution:**

- Created `parseNumericValue()` helper to strip commas before parsing
- Applied to price and deposit display
- Also strip commas when saving to database

**Files Modified:**

- `src/features/admin/modules/admin-projects.ts` - Added parseNumericValue helper, fixed save logic

---
