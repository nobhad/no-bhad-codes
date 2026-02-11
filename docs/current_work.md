# Current Work

**Last Updated:** February 11, 2026 (Help Page Redesign + Password Save Prompt Fix - COMPLETE)

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-02.md`.

---

## Open Issues

### Active - NEEDS DEEP DIVE

- [ ] **Receipts Feature** - Auto-generate PDF receipt for ANY payment (including partial payments), receipt management, download receipts
- [ ] **Project Details - Invoices Tab** - Full invoice management in project details (view, create, edit, send, mark paid - all invoice actions)
- [ ] **Project Details - PDF Creation** - Generate all business doc types (proposals, contracts, receipts, reports, SOWs) from files tab
- [ ] **File Sharing Control** - All generated PDFs auto-save to project files but need "Share with Client" button to make visible to client (applies to ALL file types)
- [ ] **Questionnaires to Files** - On completion: generate PDF of Q&A + keep raw JSON data export available. PDF saves to Forms folder.
- [ ] **Document Requests to Files** - After admin approval: uploaded file MOVES from Doc Requests to Files tab (Forms folder). Original request marked complete.

- [ ] **DIV SPACING** - Help page layout fixed (two-column with Categories LEFT). Remaining pages need verification for consistency
- [ ] **CSS Base Styling** - Partial fix applied but Help page NOT using consistent card/section structure
- [x] **FILES Layout** - Now matches admin portal: CSS Grid two-column layout, project folders in left panel, files table on right, intake PDFs display correctly
- [ ] **Admin global header logo** - Changed from avatar image to "NO BHAD CODES" text - NEEDS TO LOOK LIKE MAIN SITE (not client portal style) AND IN ACME FONT
- [ ] **CLIENT PORTAL HEADERS** - move toggle + breadcrumbs of client portal to page header, hide title
- [x] **Files display** - Client portal files now match admin: folder tree shows projects, clicking project filters files, intake files open as PDF
- [ ] **Dashboard greeting** - Client name  needs to stay together on its own line if full greeting can't fit on one line (e.g., "WELCOME BACK," then "NOELLE BHADURI!").  if full line can fit, should be on one line ("WELCOME BACK, NOELLE BHADURI!")
- [ ] **Logout button** - Transparent background (no permanent light bg),needs to match rest of sidebar
- [x] **Login page mobile** - FIXED: Full width, transparent background, no shadow on mobile (both client portal and admin)
- [x] **Help Page Layout** - COMPLETE: Two-column grid layout with accordion categories, search suggestions, article detail view

### ACTIVE - IN PROGRESS THIS SESSION

- [ ] **Horizontal scroll on mobile** - Fixed `min-width: 320px` to `min-width: 0`, added `overflow-x: hidden` to containers - NEEDS VERIFICATION

### PENDING TESTING - NEEDS VERIFICATION

- [ ] **Client Portal Files Tab** - Verify project folders display correctly, clicking project filters files, all files (including documents) show for each project
- [ ] **Intake PDF Access** - Verify intake files open as PDF (not JSON) for logged-in clients
- [ ] Test hash-based routing: invalid hash `#/invalid` redirects to dashboard
- [ ] Test Messages page two-column layout at various screen sizes
- [ ] hash-based routing: browser back/forward navigates correctly - cant test with vite

### VERIFIED FIXED - NO VERIFICATION NEEDED, CAN BE MOVED TO ARCHIVE

- [x] **Help Page UX Redesign - COMPLETE** (Feb 11, 2026)
  - Two-column layout: Categories LEFT (narrower), Content RIGHT (wider)
  - Hero search with live suggestions and keyboard navigation
  - Collapsible accordion with single-open behavior
  - Quick Start articles grid, clickable to show article detail on right
  - Contact section updated for single person
- [x] **Password Save Prompt Fix - COMPLETE** (Feb 11, 2026)
  - Root cause: Multiple `autocomplete="new-password"` fields caused browsers to show 4 save password prompts
  - Fixed confirm-password fields to use `autocomplete="off"` instead of `autocomplete="new-password"`
  - Added `autocomplete="off"` to password forms
  - Removed dynamic autocomplete manipulation in JavaScript
  - Files fixed: `set-password.html`, `reset-password.html`, `portal-views.ts`, `client-portal.ejs`
- [x] **Module Spec Implementation Plan - COMPLETE** (Feb 11, 2026)
  - [x] Invoice View/Edit Modals - View modal for all invoices, edit modal for drafts only
  - [x] Password Reset Flow - Forgot password page, reset password page, backend endpoints
  - [x] Onboarding Wizard Integration - Shows on first login, triggers from client-portal.ts
  - [x] Notification Center UI - Bell icon, dropdown, mark read, polling
  - [x] Message File Attachments - Paperclip button, file preview chips, drag & drop, download
- [x] **Client Portal Files - Project Folders** - Added `populateFolderTree()` to show projects as folders, `selectFolder()` to filter files by project, intake file PDF preview support
- [x] **Messages Tab Mobile Spacing** - Removed extra padding from `.messages-page-layout`, now matches rest of portal
- [x] **Dashboard API 500 Error** - FIXED: Ambiguous column references in `/me/dashboard` files subquery (added `f.` prefix to `original_filename`, `created_at`, `id`)
- [x] **Admin Recent Activity 500 Error** - FIXED: `client_intakes` table has `first_name`/`last_name` not `contact_name`, updated query to use concatenation
- [x] Verified milestone card layout shows status top-right and date bottom-right
- [x] Tested settings page loads client profile data from database
- [x] Tested hash-based routing: sidebar clicks update URL hash
- [x] Tested sidebar buttons navigate to correct views
- [x] Tested data isolation - login as different clients and verify no data bleed
- [x] Tested collapsed sidebar maintains consistent appearance at all screen sizes
- [x] Tested hash-based routing: direct link to `#/messages` opens messages tab
- [x] **Header Logo** - Changed from avatar image to "no bhad codes" text.
- [x] **Milestone Card Layout** - Status in header, due date in footer.
- [x] **Client Portal Navigation** - Hash-based routing implemented (`#/dashboard`, `#/files`, etc.) with dynamic view rendering via `portal-views.ts`.
- [x] **Sidebar Background Color** - Changed to match global header (`--portal-bg-darker`).
- [x] **"Contact support" email link** - FIXED: Now says "Contact Noelle" with link to messages, red text styling
- [x] **Recent activity "Loading..."** - FIXED: Added `loadDashboard` callback to load stats when dashboard view is rendered
- [x] **Portal 401 Unauthorized Redirect** - FIXED: Added global fetch interceptor that detects 401 responses and redirects to login with "session expired" message.
- [x] **Client Dashboard** - FIXED: Moved stat cards above progress/milestones
- [x] **Client Portal Page Titles** - FIXED: Now shows individual tab titles instead of group titles
- [x] **Settings page form submission** - FIXED: Now calls `setupSettingsForms()` after view is rendered to attach event handlers
- [x] **Messages "No messages yet"** - FIXED: Force refresh DOM cache when loading messages
- [x] **Help page categories on left** - FIXED: Swapped grid columns so categories sidebar is on left
- [x] **Browser tab title** - FIXED: Shows "No Bhad Codes" not "No Bhad Codes - Portfolio"
- [x] **Admin "SUPPORT" to "Knowledge Base"** - FIXED: Updated sidebar button and tab titles
- [x] **Settings Full Name redundancy** - FIXED: Changed billing section label to "Billing Name"
- [x] **Mobile padding** - FIXED: Reduced left/right padding on screens under 400px
- [x] **Portal Greeting** - "Welcome Back" for returning users, "Welcome to the Portal" for first login. Database field `last_login` (migration 076), `isFirstLogin` returned on login.
- [x] **Billing name** - Separate `billing_name` field in database (migration 077), distinct from `contact_name`
- [x] **Tab switching alignment** - Subtabs (Projects, Tasks, Requests, etc.) aligned to far right in page header
- [x] **Knowledge Base toggle** - Removed "Knowledge Base" button from support subtabs, only Categories/Articles toggle shows
- [x] **Mobile menu toggle** - Sidebar panel icon in page header on mobile when sidebar collapsed - opens sidebar
- [x] **Logout button background** - FIXED: Changed `.logout-btn` from `background: var(--portal-bg-light)` to `transparent` so it matches other sidebar buttons
- [x] **Messages mobile padding** - FIXED: Added CSS to remove outer `.dashboard-content` padding on messages tab for screens under 600px
- [x] **Login page menu** - Menu button opens navigation overlay on login page
- [x] **Mobile overflow** - No horizontal scrolling on any page (375px viewport)

---

## Pre-existing Server TypeScript Errors

These errors existed before current session and are not blocking:

- `unknown` type errors in `calendar-service.ts` and `stripe-service.ts`
- `rootDir` configuration issue with `shared/` folder imports

---

## Database Normalization

**Full Documentation:** See `docs/architecture/DATABASE_SCHEMA.md` and `docs/architecture/DATABASE_NORMALIZATION_PLAN.md`

**Phase 1-3:** COMPLETE (Feb 10, 2026) - Migrations 067-074 applied

**Phase 4 - High Risk:** DEFERRED

- [ ] Consolidate lead/intake overlap (single source of truth)
- [ ] Unify message tables (messages vs general_messages)
- [ ] Add soft-delete to all core entities
- [ ] Slim invoices table (remove redundant columns) - `075_slim_invoices_table.sql.bak`

---

## Portfolio Assets Needed (for Noelle not Claude)

**Status:** Waiting on assets

- [ ] Project screenshots
- [ ] CRT TV title cards for each project
- [ ] OG images for social sharing (1200x630 PNG)

**Location:** public/images/portfolio/

---

## Deferred Items

- **Stripe Payments** - Cost deferral
- **Real-Time Messages (WebSockets)** - Polling works fine
- **MFA/2FA, SSO** - Single admin user
- **Virtual Tour/Walkthrough** - Nice to have

---

## Recent Test Runs

- 2026-02-11: `npm run test:run` - 34 files, 847 passed, 1 skipped
- 2026-02-11: `npm run lint` - clean

---

## DO NOT REMOVE OR EDIT ANYTHING BELOW THIS LINE - Used for tracking and documentation purposes

### Design System Reference

For design guidelines, see:

- `docs/design/UX_GUIDELINES.md` - Icons, typography, spacing, accessibility
- `docs/design/CSS_ARCHITECTURE.md` - CSS variables, component classes, naming conventions

Key rules:

- NO EMOJIS - Use Lucide icons only
- NEVER hardcode colors - use CSS variables
- Use `createPortalModal()` for modals - never custom modal HTML
- Complex animations use GSAP, not CSS animations
- BUT MUST REVIEW ALL

### Post-Task Documentation Checklist

After completing any task list:

- [ ] Update feature docs (docs/features/*.md) if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [ ] Update relevant audit file (current state only, no fix logs)
- [ ] Move fully completed tasks from current_work to archive
- [ ] Verify no markdown violations
