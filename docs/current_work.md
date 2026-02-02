# Current Work

**Last Updated:** February 2, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-02.md`.

---

## Recently Completed (Feb 2, 2026)

All backend features now have frontend UI:

- Analytics Advanced Features UI (reports, schedules, alerts)
- Lead Pipeline Advanced Features UI (scoring rules, tasks, notes, funnel, sources)
- Proposal Advanced Features UI (custom items, discounts, comments, activity log)

---

## Front-End Concerns

### Main Site (NO BHAD CODES — Main Portfolio Site)

- [ ] **Projects section — 100% complete**
  - See `docs/design/salcosta/`; code implementation complete, needs assets only.
  - Screenshots of main site and add to projects page.
  - **Title cards for each project:**
    - [ ] My portfolio site
    - [ ] THE BACKEND
    - [ ] Creator content management platform
  - **Pending assets:**
    - [ ] CRT TV title cards (Looney Tunes style, 4:3) → `/public/projects/{project-id}-title.png`
    - [ ] Project screenshots → `{project-id}-hero.webp`, `{project-id}-desktop-1.webp`, etc.
    - [ ] Update `portfolio.json` with heroImage and screenshots paths
    - [ ] Optimize images (WebP, appropriate sizes)
    - [ ] OG images for social (1200×630)

- [ ] **SEO optimization → push to main**
  - Optimize SEO for main portfolio site.
  - Do after 2 projects completed, then push to main.

---

### THE BACKEND (Client + Admin Portal)

Client portal section of the portfolio site.

#### General

- [x] **Sidebar** — Collapsed is cleaner than expanded; treat as links (no buttons) like collapsed state.
- [ ] **Button design** — Cleaner design for rest of portal; define where buttons should look different. **Doc:** `docs/design/PORTAL_BUTTON_DESIGN.md`. Focus: (1) ensure primary/secondary/icon-only/destructive match doc everywhere; (2) optional: adopt ButtonComponent with portal tokens for new/dynamic buttons; (3) audit stat-card-as-button, send-message, header toggle for consistency.
- [ ] **Badges** — Redesign for clarity and easier scanning.
- [x] **Tabs (reusable component)** — Shared tab strip/panel styles in `src/styles/shared/portal-tabs.css`.
- [x] **Design applied to main site** — All design and front-end changes are applied directly to the main admin and client portal.

#### Front-end work (on main site)

The following are implemented on the **main admin and client portal**:

- **Navigation** — Sidebar and tab switching in both portals; same layout.
- **Tabs** — Shared tab strip/panel (project detail and client detail); one consistent look.
- **Sidebar count badge** — Leads/Messages count as separate pill; does not shift icon/button.
- **Page header** — Per-tab title + sidebar toggle.
- **Search bar** — Reusable inline search (icon + input + optional clear).

*Still open:* Sidebar as links (not buttons), button design pass, badge redesign beyond sidebar count, recent activity, time-sensitive tasks, system tab clarity.

**Reusable components:** Breadcrumbs, TabRouter, QuickStats, RecentActivity, PageHeader, and SearchBar are in `src/components/` and documented in `docs/design/WIREFRAME_AND_COMPONENTS.md`.

#### Admin Portal

- [ ] **Recent activity** — All recent activity in dashboard Recent Activity.
- [ ] **Time-sensitive tasks** — Clear view of most important / time-sensitive tasks on dashboard.

#### Analytics

- [x] **Clear breakdown** — Separate breakdown: main portfolio site vs "THE BACKEND" client portal.
- [x] **Card styling** — New cards match existing card styling.
- [x] **Presentation** — Decide best way to present all of this information.
- [x] **Analytics grid and empty state** — Grid uses full-width 2x2 layout.

#### System

- [ ] **System tab** — Clarify purpose; document or simplify so it's understandable.

#### Style consistency

- [x] **Style consistency deep dive** — Report in `docs/design/STYLE_CONSISTENCY_REPORT.md`.

---

## VERIFICATION CHECKLIST

One checkbox per verifiable piece. Check off with `[x]` when confirmed.

---

### Admin Portal

#### Clients

- [ ] Client table shows Health column with correct badge (green/yellow/red)
- [ ] Client table shows tags as pills under client name
- [ ] Client details: CRM Details section displays (industry, company size, acquisition source, website, follow-up dates)
- [ ] Client details: Edit CRM dialog opens, saves, and updates display
- [ ] Client details: Custom Fields section displays field values
- [ ] Client details: Edit Custom Fields dialog opens, saves, and updates display
- [ ] Client: multiple contacts; add/edit/delete; set primary
- [ ] Client: Activity timeline shows notes, calls, emails, meetings; can add activity
- [ ] Client: Tags can be added/removed; filter by tag works
- [ ] Client: Health score displays; recalculate works
- [ ] Clients table: invite icon appears for uninvited clients; click sends invite
- [ ] Client detail page: invite icon appears when client not invited; click sends invite
- [ ] Contact detail panel: "Convert to Client" button present and clickable
- [ ] After convert: "Converted to Client" badge shows on contact

#### Leads

- [ ] Lead row: "Convert" button visible for pending/qualified/contacted; click converts
- [ ] Leads: scoring displays and updates as expected
- [ ] Leads: pipeline/Kanban view; drag to change stage
- [ ] Leads: tasks on lead; add/complete task
- [ ] Leads: analytics/reports load and show data

#### Projects

- [ ] Project list/detail: status is a dropdown (not plain text); change saves
- [ ] Project detail: invite icon shows when client not invited; click sends invite
- [ ] Project: tasks list or Kanban; add/edit/complete task
- [ ] Project: time tracking entries; add/view time
- [ ] Project: templates (create from template or apply template)
- [ ] Project Contract tab: Preview button opens contract preview
- [ ] Project Contract tab: Download button downloads PDF
- [ ] Project Contract tab: Request Signature button sends email with link
- [ ] Project Contract tab: status shows "Signed" or "Not signed"
- [ ] Project Contract tab: when signed, signature details (signer, date) display
- [ ] After client signs: admin sees signature recorded (audit/status updated)

#### Invoices

- [ ] Invoice: "Mark Paid" quick action works from project/invoice context
- [ ] Invoice: "Send Reminder" quick action works
- [ ] Invoice: "Apply Late Fees" runs and updates invoice
- [ ] Invoice: "Schedule Invoice" dialog; schedule saves; scheduled list shows entry
- [ ] Invoice: scheduled list: "Cancel" removes scheduled invoice
- [ ] Invoice: "Setup Recurring" dialog; recurring saves; recurring list shows entry
- [ ] Invoice: recurring list: Pause and Resume work
- [ ] Deposit invoice: can create from project details
- [ ] Deposit invoice: PDF shows "DEPOSIT INVOICE" and deposit percentage
- [ ] Deposit invoice: credits apply to standard invoices; PDF shows credit lines
- [ ] Payment plans: templates (e.g. 50/50) work
- [ ] Recurring invoice: frequency options save; scheduler generates invoices

#### Proposals

- [ ] Proposals: templates list; create/use template
- [ ] Proposals: versioning (versions list; create new version)
- [ ] Proposals: e-signature request and signing flow

#### Messaging

- [ ] Messaging: thread list; switch between threads
- [ ] Messaging: mentions work in composer
- [ ] Messaging: notifications for new messages

#### Files

- [ ] Files: version history; upload new version; view/download version
- [ ] Files: organization (folders or project filter) works
- [ ] Files table (admin): on mobile, card-style layout with labels

#### Analytics (Admin Portal)

- [ ] Analytics dashboard: KPI cards load with correct numbers
- [ ] Analytics dashboard: revenue/status charts render
- [ ] Analytics: reports section loads; create/schedule/delete reports
- [ ] Analytics: metric alerts section loads; create/toggle/delete alerts

#### UI / Layout

- [ ] Sidebar: notification badges are fully visible (not clipped)
- [ ] Project detail tabs: on mobile, tabs scroll horizontally

#### Modals & Toasts

- [ ] Confirmations/errors use toast or modal (no native alert())
- [ ] Multi-step flows use multiPromptDialog() (no native prompt())
- [ ] Dashboard detail modal: focus stays trapped inside while open

---

### Client Portal

#### Contract signing (public link from email)

- [ ] Client can open contract signing link from email (token link works)
- [ ] Signing page: signer can sign; submit succeeds
- [ ] After signing: client receives confirmation email

#### Portal (logged-in client)

- [ ] Dashboard: project cards and/or stats load
- [ ] Invoices: list and view/download PDF
- [ ] Messages: view thread(s), send reply
- [ ] Files: view list; upload file
- [ ] Settings/Profile: update name, company, phone; save and display updates

---

## Known Issues

*No critical known issues at this time.*

---

## Deferred Items

Low-priority items deferred for future work:

### Global Event Listeners - DEFERRED

**Reason:** App is not a true SPA - handlers are added once during init and persist.

### AbortController - DEFERRED

**Reason:** High complexity, requires careful refactoring. Current behavior is stable.

### Form Placeholders - DEFERRED

**Reason:** UX polish task, not functional issue.

---

## Tiered Proposal Builder - Pending Testing

**Status:** IMPLEMENTED - Awaiting User Testing

- [ ] Database Migration - Run migration to create proposal tables
- [ ] Intake Flow Integration - Complete intake and verify proposal builder appears
- [ ] Tier Selection (Step 1) - Verify tier cards display correctly
- [ ] Feature Customization (Step 2) - Verify add-ons work
- [ ] Maintenance Options (Step 3) - Verify maintenance cards
- [ ] Summary & Submit (Step 4) - Verify final review and submission
- [ ] Admin Proposals Panel - Verify admin can manage proposals

---

## TODOs

### Code Quality

- [ ] **Component Refactoring Opportunities** - Replace manual DOM manipulation with reusable components
  - See: [COMPONENT_REFACTORING_OPPORTUNITIES.md](./COMPONENT_REFACTORING_OPPORTUNITIES.md)

### UX Wins (Pending)

- [ ] **Contact Quick Reply** - Inline "Reply" button opens small modal from contacts table
- [ ] **Client Action Menu** - "..." menu for active clients with Reset Password, Resend Invite, View Projects
- [ ] **File Batch Operations** - Checkboxes for multi-select + "Download All" button
- [ ] **Milestone Inline Toggle** - Checkbox to mark complete directly from list
- [ ] **Visual "Action Required" Badges** - Red/yellow badges for overdue items
- [ ] **Quick Search on Tables** - Search box above each table (leads, projects, clients)

---

## Reference Documents

- [CRM_CMS_DEEP_DIVE.md](./CRM_CMS_DEEP_DIVE.md) - Gap analysis vs state-of-the-art CRM/CMS
- [CLIENT_PORTAL_DEEP_DIVE.md](./CLIENT_PORTAL_DEEP_DIVE.md) - Whole-portal audit
- [TABLES_ARCHIVE_DELETE_AUDIT.md](./TABLES_ARCHIVE_DELETE_AUDIT.md) - Tables, archive & delete audit
- [COMPONENT_REFACTORING_OPPORTUNITIES.md](./COMPONENT_REFACTORING_OPPORTUNITIES.md) - Component refactoring

---

## Expansion Plans

**Priority Focus:** Tier 1, Tier 5, Tier 6, Tier 7

### TIER 1: Automation & Reminders ⭐ PRIORITY

- [x] Scheduled Job System - COMPLETE
- [x] Invoice Reminders - COMPLETE
- [ ] Contract Reminders - Remind clients to sign contracts
- [ ] Welcome Sequences - Automated onboarding emails
- [ ] Workflow Triggers - Formalize events and actions

### TIER 2: Client Portal Data & UX

- [ ] Dashboard from API - Replace static project cards with real data
- [ ] Activity Feed - Aggregate messages, file uploads, project updates
- [ ] Notification Preferences (API-backed)
- [ ] Unread Badges - Badges on Messages, Invoices, Files in sidebar
- [ ] Knowledge Base - Searchable help in portal
- [ ] Client-Facing Timeline - Visual timeline of milestones

### TIER 3: Messaging & Files

- [ ] Thread List / Thread Switcher
- [ ] Real-Time Messages - WebSockets or SSE
- [ ] Dynamic File Filter - Populate dropdown from API
- [ ] Document Requests - Admin requests specific docs from client

### TIER 4: Payments & Financial

- [ ] Online Payments (Stripe) - "Pay Now" button on invoices - don't want to pay for Stripe yet
- [x] Payment Reminders - COMPLETE
- [x] Deposit / Payment Plans - COMPLETE
- [x] Recurring Invoices - COMPLETE

### TIER 5: Approvals & Documents ⭐ PRIORITY

- [ ] Deliverable Tracking - Draft → Review → Approve workflow
- [ ] Approval Workflows - Sequential or parallel approvals
- [x] E-Signatures - Contract signing (public page implemented)

### TIER 6: Admin Tables & Actions ⭐ PRIORITY

- [ ] Proposals Filter - Add "Rejected" and "Converted" to filter tabs
- [ ] Export Per Table - Wire leads/contacts/projects export into UI
- [ ] Contact Restore - "Restore" button when status = archived
- [ ] Project Delete in UI - Delete button using existing endpoint
- [ ] Pagination UI - Server-side pagination for large tables
- [ ] Bulk Archive/Delete - Row checkboxes + bulk actions

### TIER 7: CRM & Reporting ⭐ PRIORITY

- [x] Kanban Pipeline View - Lead pipeline implemented
- [x] Business Metrics Dashboard - Analytics dashboard with KPIs
- [x] Client Health Metrics - Health score on clients
- [x] Lead Scoring - Lead scoring with rules management

### TIER 8: Integrations & API

- [ ] Webhooks - Outbound events
- [ ] Public API - Documented REST API
- [ ] Third-Party Integrations - Email, Calendar, Accounting

### TIER 9: Security & Polish

- [ ] MFA / 2FA
- [ ] SSO
- [ ] Virtual Tour / Walkthrough
- [ ] Visual Proofing & Annotations
