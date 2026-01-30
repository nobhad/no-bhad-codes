# Current Work

**Last Updated:** January 30, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## Pending Verification

Recent fixes that need user testing:

### High Priority

- [ ] **Intake PDF Preview** - Test intake JSON files open as branded PDF
  - Navigate to a project with intake form data
  - Click Preview on the JSON file
  - Verify it opens as a branded PDF (not raw JSON)
  - Check logo, headers, and formatting match contract PDFs

- [ ] **Contract PDF Generation** - Test `GET /api/projects/:id/contract/pdf`
  - Navigate to a project with contract data
  - Download contract PDF and verify branding/content

- [ ] **Edit Project Modal Dropdowns** - Verify dropdowns populate on re-open
  - Open Edit Project modal
  - Close without saving
  - Re-open the modal
  - Verify Type and Status dropdowns show correct values

### Medium Priority

- [ ] **Client Budget Display** - Verify budget ranges show proper formatting
  - Navigate to project details in admin
  - Verify budget shows "Under $2k" (not "Under 2k")
  - Verify ranges show en-dashes: "$2k-$5k"

- [ ] **Client Portal Profile Settings** - Test profile update refresh
  - Update contact name, company, or phone in client portal settings
  - Save and verify values refresh immediately (no page reload needed)

- [ ] **Client Portal Project Request** - Test project list refresh
  - Submit a new project request in client portal
  - Verify new project appears in dashboard immediately (no page reload needed)

### Lower Priority

- [ ] **Account Activation Welcome Flow** - Test welcome email + portal message
  - Invite a new client (or use existing pending invitation)
  - Click invitation link and set password
  - Verify welcome email received with "Add Billing Info" CTA
  - Verify system message appears in portal inbox

- [ ] **Client Invitation UX** - Test create client without inviting, then invite later
  - Create a new client in admin (without checking "Send invitation email")
  - Verify "Not Invited" status badge appears with small send icon button next to it
  - Verify same icon button appears on Client Details page next to Status
  - Click the icon button and verify invitation is sent
  - Verify icon button disappears after invitation sent (status updates to "Invited")
  - **January 29 Update:** Changed from purple text button to icon-only button matching `.icon-btn` pattern

---

## Completed - January 30, 2026

### PDF Generation & File Naming Overhaul

**Status:** COMPLETE

Replaced PDFKit with pdf-lib for reliable PDF generation, and implemented consistent file naming conventions with NoBhadCodes branding.

**PDF Generation:**

- Switched from PDFKit to pdf-lib for intake PDF generation
- Fixed footer positioning issue (was appearing on page 2)
- Added PDF metadata (title, author, subject) for proper browser tab titles
- Direct URL preview instead of blob URL for proper download filenames

**File Naming Convention:**

- All uploaded files now prefixed with `nobhadcodes_`
- Underscores instead of spaces in filenames
- Uses client name OR company name (company takes priority)
- Timestamp suffix for uniqueness
- Format: `nobhadcodes_{description}_{timestamp}.{ext}`

**Intake Files:**

- JSON files: `nobhadcodes_intake_{client_name}_{date}.json`
- PDF downloads: `nobhadcodes_intake_{client_name}.pdf`

**Project Names:**

- Auto-generated format: `{Company/Client Name} {Type} Site`
- Example: "Hedgewitch Horticulture Business Site" (no dash)

**Files Modified:**

- `server/config/uploads.ts` - Added `sanitizeFilename()` function
- `server/routes/projects.ts` - Rewrote PDF generation with pdf-lib
- `server/routes/intake.ts` - Updated intake file naming
- `server/routes/admin.ts` - Updated admin project file naming
- `src/features/admin/modules/admin-projects.ts` - Direct URL preview for intake PDFs

---

### Complete pdf-lib Migration for All PDFs

**Status:** COMPLETE

Migrated all PDF generation from PDFKit to pdf-lib for consistency and better control. Increased logo size by 50% for better visibility.

**Changes:**

- **Invoice PDF** - Migrated to pdf-lib with 75pt logo
- **Contract PDF** - Migrated to pdf-lib with 75pt logo
- **Intake PDF** - Updated to 75pt logo (already used pdf-lib)
- **Proposal PDF** - Migrated to pdf-lib with 75pt logo
- Removed all PDFKit imports from codebase

**Header Template (all PDFs):**

| Element | Size | Y-Offset |
|---------|------|----------|
| Logo | 75pt height | 0 (preserves aspect ratio) |
| Business Name | 16pt bold | 0 |
| Owner | 10pt | -20pt |
| Tagline | 9pt | -36pt |
| Email | 9pt | -50pt |
| Website | 9pt | -64pt |
| Title | 28pt bold | -25pt (right-aligned) |

**Files Modified:**

- `server/routes/invoices.ts` - Removed PDFKit, uses pdf-lib exclusively
- `server/routes/projects.ts` - Contract PDF now uses pdf-lib
- `server/routes/proposals.ts` - Proposal PDF now uses pdf-lib

**Documentation:**

- Created [PDF_GENERATION.md](./features/PDF_GENERATION.md) - Complete PDF system documentation
- Updated [INVOICES.md](./features/INVOICES.md) - References new PDF docs

---

### Wireframe Preview System

**Status:** COMPLETE (Documentation Only)

Implemented a wireframe preview system using screenshots uploaded via the existing Files system. No code changes required.

**Approach:**

- Use existing file upload and preview infrastructure
- Screenshots of wireframes with naming convention: `{project-slug}_{page}_{tier}.png`
- Use `wf_` or `wireframe_` prefix to group files

**Documentation:**

- Created [WIREFRAMES.md](./features/WIREFRAMES.md) feature documentation

---

## In Progress - January 29, 2026

### Client Invitation Icon Button

**Status:** IMPLEMENTED - Awaiting Verification

Changed the "Invite" button in clients table from purple text button to icon-only button:

**Changes Made:**

- Clients table: Replaced `.btn-invite-inline` with `.icon-btn .icon-btn-invite` (icon-only)
- Added `.status-cell-wrapper` for inline display of status + icon button
- Client Details page: Added invite icon button next to Status field (if not invited)
- Project Details page: Added invite icon button next to Client name (if not invited)
- Icon button disappears once client is invited
- Consistent styling with other admin icon buttons

**Files Modified:**

- `src/features/admin/modules/admin-clients.ts` - Table render + details page
- `src/features/admin/admin-project-details.ts` - Project detail client info
- `src/styles/pages/admin.css` - New `.icon-btn-invite` styles
- `src/styles/admin/project-detail.css` - Positioning for project detail invite button

---

## Known Issues (Unfixed)

*No critical known issues at this time.*

### Recently Fixed

- **Detail Modal Focus Trap** - FIXED January 30, 2026
  - Added `manageFocusTrap()` to detail modal in `admin-dashboard.ts`
  - Proper keyboard navigation (Tab/Shift+Tab cycles through focusable elements)
  - Focus restoration when modal closes
  - Escape key closes modal via focus trap handler

---

## Tiered Proposal Builder - Pending Testing

**Status:** IMPLEMENTED - Awaiting User Testing

### Testing Checklist

- [ ] **Database Migration** - Run migration to create proposal tables
- [ ] **Intake Flow Integration** - Complete intake and verify proposal builder appears
- [ ] **Tier Selection (Step 1)** - Verify tier cards display correctly
- [ ] **Feature Customization (Step 2)** - Verify add-ons work
- [ ] **Maintenance Options (Step 3)** - Verify maintenance cards
- [ ] **Summary & Submit (Step 4)** - Verify final review and submission
- [ ] **Admin Proposals Panel** - Verify admin can manage proposals

---

## Deferred Items

Low-priority items deferred for future work:

### Global Event Listeners - DEFERRED

**Reason:** App is not a true SPA - handlers are added once during init and persist. No hot-reload or navigation-based re-initialization that would cause handler accumulation.

**If Revisited:** Track handler references and remove them during module/component teardown.

### AbortController - DEFERRED

**Reason:** High complexity, requires careful refactoring. Current behavior is stable; race conditions rare in practice.

**If Revisited:** Use `AbortController` to cancel in-flight fetches when newer requests supersede them.

### Form Placeholders - DEFERRED

**Reason:** UX polish task, not functional issue. Forms work correctly.

**If Revisited:** Audit all forms and add descriptive placeholders and format hints.

---

## TODOs

### UI/CSS Fixes

- [x] **Sidebar Badge Clipping** - FIXED January 30, 2026
  - Added `overflow: visible` to sidebar buttons and badges
  - File: `src/styles/pages/admin.css`

- [x] **Project Detail Tabs Not Responsive** - FIXED January 30, 2026
  - Added horizontal scroll on mobile with styled scrollbar
  - Added reduced padding on mobile tabs and tab content
  - File: `src/styles/admin/project-detail.css`

- [x] **Files Table Not Responsive** - FIXED January 30, 2026
  - Added card-style layout on mobile (stacked rows with labels)
  - Added `data-label` attributes to table cells
  - Files: `src/styles/admin/project-detail.css`, `src/features/admin/modules/admin-projects.ts`

### Code Quality

- [ ] **Component Refactoring Opportunities** - Replace manual DOM manipulation with reusable components
  - See: [COMPONENT_REFACTORING_OPPORTUNITIES.md](./COMPONENT_REFACTORING_OPPORTUNITIES.md)

### Features

- [x] **Convert Contact to Client** - IMPLEMENTED January 30, 2026
  - Added `client_id` and `converted_at` columns to `contact_submissions` table (migration 026)
  - Added "Convert to Client" button in contact detail panel
  - Created endpoint `POST /api/admin/contact-submissions/:id/convert-to-client`
  - Sends invitation email when converting
  - Shows "Converted to Client" badge after conversion

### Main Site (Last Priority)

- [ ] **Projects Section Redesign** - Sal Costa-style portfolio
  - See: `docs/design/salcosta/`
  - Code implementation COMPLETE - just needs assets
  - **Pending Assets:**
    - [ ] Create CRT TV title cards (Looney Tunes style, 4:3 aspect ratio) for `/public/projects/{project-id}-title.png`
    - [ ] Store project screenshots: `{project-id}-hero.webp`, `{project-id}-desktop-1.webp`, etc.
    - [ ] Update `portfolio.json` with heroImage and screenshots paths
    - [ ] Optimize images (WebP format, appropriate sizes)
    - [ ] Create OG images for social sharing (1200x630)

- [ ] **SEO Optimization** - DO NOT DO UNTIL AFTER 2 PROJECTS COMPLETED

---

## Future Plans

### Reference Documents

- [CRM_CMS_DEEP_DIVE.md](./CRM_CMS_DEEP_DIVE.md) - Gap analysis vs state-of-the-art CRM/CMS
- [CLIENT_PORTAL_DEEP_DIVE.md](./CLIENT_PORTAL_DEEP_DIVE.md) - Whole-portal audit
- [TABLES_ARCHIVE_DELETE_AUDIT.md](./TABLES_ARCHIVE_DELETE_AUDIT.md) - Tables, archive & delete audit
- [COMPONENT_REFACTORING_OPPORTUNITIES.md](./COMPONENT_REFACTORING_OPPORTUNITIES.md) - Component refactoring

---

### TIER 0: Quick UX Wins (Admin Portal)

**Status:** Partially Complete - January 29, 2026

**Completed:**

- [x] **Project Status Inline Dropdown** - Replace plain text with dropdown (like leads)
- [x] **Invoice Quick Actions** - "Mark Paid" and "Send Reminder" buttons
- [x] **Lead Convert Button** - "Convert" button for pending/qualified/contacted leads
- [x] **Client Invite Icon Button** - Icon button in table + detail pages for uninvited clients
- [x] **Project Detail Invite Cue** - Invite icon on project detail page for uninvited clients

**Pending (Medium Priority):**

- [ ] **Contact Quick Reply** - Inline "Reply" button opens small modal from contacts table
  - Location: `admin-dashboard.ts` contacts rendering
  - Shows message preview on hover

- [ ] **Client Action Menu** - "..." menu for active clients with Reset Password, Resend Invite, View Projects
  - Location: `admin-clients.ts` table rendering
  - Replace single invite button with menu when status is "Active"

- [ ] **File Batch Operations** - Checkboxes for multi-select + "Download All" button
  - Location: `portal-files.ts`
  - Add checkbox column, batch action bar

**Pending (Lower Priority):**

- [ ] **Milestone Inline Toggle** - Checkbox to mark complete directly from list
  - Location: `admin-project-details.ts` milestone rendering

- [ ] **Visual "Action Required" Badges** - Red/yellow badges for overdue items
  - Show on projects with: overdue milestones, unpaid invoices, unread messages
  - Locations: Project cards, project table, sidebar

- [ ] **Quick Search on Tables** - Search box above each table (leads, projects, clients)
  - Instant filter as you type
  - Preserve existing filter state

---

### TIER 1: Automation & Reminders (Foundation)

**Gap:** No scheduled jobs, no reminder system, no workflow triggers

- [ ] **1.1 Scheduled Job System** (Prerequisite for all automation)
  - Add `node-cron` or similar for recurring tasks
  - Create `server/services/scheduler-service.ts`
  - Add job tracking table for status/history

- [ ] **1.2 Invoice Reminders**
  - Auto-send reminder emails for overdue invoices
  - Configurable reminder intervals (3 days, 7 days, etc.)

- [ ] **1.3 Contract Reminders**
  - Remind clients to sign contracts
  - Escalation if not signed within X days

- [ ] **1.4 Welcome Sequences**
  - Automated onboarding emails for new clients
  - Introduce portal features, next steps

- [ ] **1.5 Workflow Triggers**
  - Formalize events (`intake.completed`, `proposal.accepted`, etc.)
  - Define actions for each trigger

---

### TIER 2: Client Portal Data & UX (P0 - Fix Placeholders)

**Gap:** Dashboard project cards, stats, and recent activity are STATIC (not API-driven)

- [ ] **2.1 Dashboard from API**
  - Add `GET /api/client/dashboard` endpoint
  - Return project count, pending invoice count, unread message count
  - Replace static project cards with real data
  - Replace static quick stats with real data

- [ ] **2.2 Activity Feed**
  - Aggregate messages, file uploads, project updates, invoice events
  - Replace static "Recent Activity" with real data

- [ ] **2.3 Notification Preferences (API-backed)**
  - Always load/save via `PUT/GET …/me/notifications`
  - Remove sessionStorage-only paths

- [ ] **2.4 Unread Badges**
  - Badges on Messages, Invoices, Files in sidebar
  - Update counts from API

- [ ] **2.5 Knowledge Base**
  - Searchable help (FAQs, how-to) in portal
  - Self-service support

- [ ] **2.6 Client-Facing Timeline**
  - Visual timeline/Gantt view of milestones
  - Show project progress

---

### TIER 3: Messaging & Files

- [ ] **3.1 Thread List / Thread Switcher**
  - List all threads (general + project-specific)
  - Allow switching between threads (currently shows first thread only)

- [ ] **3.2 Real-Time Messages**
  - WebSockets or SSE for new messages
  - Optional toast when not on Messages tab

- [ ] **3.3 Dynamic File Filter**
  - Populate "Files by project" dropdown from API (currently hardcoded)

- [ ] **3.4 Document Requests**
  - Admin requests specific docs from client
  - Client sees "requested" vs "received" status
  - Reminders for missing documents

---

### TIER 4: Payments & Financial

- [ ] **4.1 Online Payments (Stripe)**
  - "Pay Now" button on invoices in portal
  - Webhook for payment confirmation

- [ ] **4.2 Payment Reminders**
  - Use reminder engine + email
  - Include link to portal invoices

- [ ] **4.3 Deposit / Payment Plans**
  - Schedule deposit + installments
  - Link payments to milestones

- [ ] **4.4 Recurring Invoices**
  - For retainers, maintenance plans

---

### TIER 5: Approvals & Documents

- [ ] **5.1 Deliverable Tracking**
  - Draft → Review → Approve / Request Revision workflow
  - Per-deliverable status

- [ ] **5.2 Approval Workflows**
  - Sequential or parallel approvals
  - Due dates and audit trail

- [ ] **5.3 E-Signatures**
  - Contract (and optionally proposal) signing in-portal
  - Integrate provider (DocuSign, Adobe Sign) or lighter widget

---

### TIER 6: Admin Tables & Actions (from TABLES_ARCHIVE_DELETE_AUDIT.md)

**Quick Wins:**

- [ ] **6.1 Proposals Filter** - Add "Rejected" and "Converted" to filter tabs
- [ ] **6.2 Export Per Table** - Wire leads/contacts/projects export into UI (service exists)
- [ ] **6.3 Contact Restore** - "Restore" button when status = archived
- [ ] **6.4 Project Delete in UI** - Delete button using existing `DELETE /api/projects/:id`
- [ ] **6.5 Proposals Search** - Simple client/project name search

**Medium:**

- [ ] **6.6 Pagination UI** - Server-side pagination for large tables
- [ ] **6.7 "Show Archived" Toggle** - Include archived contacts in list
- [ ] **6.8 Bulk Archive** - Row checkboxes + "Archive selected"
- [ ] **6.9 Bulk Delete** - Row selection + bulk delete
- [ ] **6.10 Column Visibility** - Hide/show columns

---

### TIER 7: CRM & Reporting

- [ ] **7.1 Kanban Pipeline View**
  - Visual project/lead pipeline
  - Drag-and-drop status changes

- [ ] **7.2 Business Metrics Dashboard**
  - Revenue, pipeline, active projects, client counts
  - Pipeline value + conversion rates

- [ ] **7.3 Client Health Metrics**
  - Payment behavior, response time, engagement

- [ ] **7.4 Lead Scoring**
  - Score leads from behavior and attributes
  - Prioritize outreach

---

### TIER 8: Integrations & API

- [ ] **8.1 Webhooks**
  - Outbound events (`project.status_changed`, `invoice.paid`, etc.)
  - Enable Zapier, internal tools

- [ ] **8.2 Public API**
  - Documented REST API for clients, projects, invoices
  - Enables integrations and automation

- [ ] **8.3 Third-Party Integrations**
  - Email (Gmail/Outlook)
  - Calendar
  - Accounting (QuickBooks/Xero)

---

### TIER 9: Security & Polish

- [ ] **9.1 MFA / 2FA**
  - Two-factor authentication for admin and client

- [ ] **9.2 SSO**
  - Single sign-on integration

- [ ] **9.3 Virtual Tour / Walkthrough**
  - First-time user onboarding in portal

- [ ] **9.4 Visual Proofing & Annotations**
  - Annotations on preview iframe
  - "Request changes" from preview

- [ ] **9.5 Profile Refresh After Save**
  - Update header/sidebar name immediately after profile save

---

### Component Refactoring (from COMPONENT_REFACTORING_OPPORTUNITIES.md)

**Status:** Focus trap complete, button/modal refactoring deferred

**Completed:**

- [x] Replace `alert()` with `showToast()` and `alertDialog()` utilities
- [x] Replace `prompt()` with `multiPromptDialog()` utility
- [x] Add `manageFocusTrap()` to detail modal in `admin-dashboard.ts` - January 30, 2026

**Deferred (Low Priority):**

- [ ] Replace manual button creation with `ButtonComponent` (5 files, 10+ instances)
  - **Reason:** Buttons use specific classes and structures (status dots, carets) tightly coupled to dropdown/chat systems. Refactoring carries risk of breaking existing functionality with marginal benefit.
- [ ] Replace manual modal handling with `ModalComponent` (2 files, 3 instances)
  - **Reason:** Existing modals work correctly. Full refactor would require updating HTML templates and all content injection code.

---

## Reference

### Files Modified Today (January 30, 2026)

**UI/CSS Responsive Fixes:**

- `src/styles/admin/project-detail.css` - Added responsive media queries for tabs, files table, overview grids
- `src/features/admin/modules/admin-projects.ts` - Added `data-label` attributes to files table cells for mobile
- `src/styles/pages/admin.css` - Fixed sidebar badge clipping with `overflow: visible`

**PDF Generation & File Naming:**

- `server/config/uploads.ts` - Added `sanitizeFilename()` with NoBhadCodes branding
- `server/routes/projects.ts` - Rewrote intake PDF generation with pdf-lib
- `server/routes/intake.ts` - Updated intake file naming with client/company name
- `server/routes/admin.ts` - Updated admin project file naming
- `src/features/admin/modules/admin-projects.ts` - Direct URL preview for proper download filenames
- `src/features/admin/modules/admin-leads.ts` - Changed Convert button to icon button

**Accessibility - Focus Trap:**

- `src/features/admin/admin-dashboard.ts` - Added `manageFocusTrap()` to detail modal for proper keyboard navigation and focus restoration

---

### Files Modified (January 29, 2026)

**Intake PDF Feature:**

- `server/routes/projects.ts` - Added `GET /api/projects/:id/intake/pdf` endpoint
- `src/features/admin/modules/admin-projects.ts` - Updated `openFilePreview()` to detect intake files

**Edit Modal Fix:**

- `src/features/admin/modules/admin-projects.ts` - Fixed class name check from `modal-dropdown` to `custom-dropdown`

**Elastic Bounce Fix:**

- `src/styles/shared/portal-layout.css` - Added `overscroll-behavior: none` to html/body for admin and client portal

**Client Invitation Icon Button:**

- `src/features/admin/modules/admin-clients.ts` - Changed invite button to icon-only, added to details page
- `src/features/admin/admin-project-details.ts` - Added invite icon button next to client name
- `src/styles/pages/admin.css` - Added `.icon-btn-invite` and `.status-cell-wrapper` styles
- `src/styles/admin/project-detail.css` - Positioning for project detail invite button

**CSS Pattern Compliance:**

- `src/features/admin/modules/admin-messaging.ts` - Replaced hardcoded `#666` with `var(--portal-text-muted)`
- `src/features/admin/admin-dashboard.ts` - Replaced hardcoded `#666` with `var(--portal-text-muted)`

**UX Improvements - Inline Actions:**

- `src/features/admin/modules/admin-projects.ts` - Added inline status dropdown (like leads table)
- `src/features/admin/admin-project-details.ts` - Added "Mark Paid" and "Send Reminder" invoice buttons
- `src/features/admin/admin-dashboard.ts` - Added delegate methods for invoice actions
- `src/features/admin/modules/admin-leads.ts` - Added "Convert" button for qualified leads
- `src/utils/table-dropdown.ts` - Added PROJECT_STATUS_OPTIONS
- `admin/index.html` - Added Actions column to leads table
