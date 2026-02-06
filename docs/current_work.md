# Current Work

**Last Updated:** February 6, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-02.md`.

## Recently Completed

### Admin UI for Deleted Items - COMPLETE (Feb 6, 2026)

**Status:** Complete

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

### PDF Multi-Page Support - COMPLETE (Feb 6, 2026)

**Status:** Complete

Added multi-page overflow handling to invoice and proposal PDF generation.

**Files Modified:**

- `server/routes/invoices.ts` - Integrated PdfPageContext for page break detection
- `server/routes/proposals.ts` - Integrated PdfPageContext for page break detection

**Features:**

- Automatic page breaks when content exceeds page height
- Continuation headers on subsequent pages
- Page numbers for multi-page documents
- Maintained existing PDF layout and styling

### Form Error Display Unification - COMPLETE (Feb 6, 2026)

**Status:** Complete

Unified contact form error display to use inline errors instead of popup errors.

**Files Modified:**

- `src/modules/ui/contact-form.ts` - Changed from showTemporaryFieldError (popups) to showFieldError (inline)

**Features:**

- Inline error messages with ARIA attributes for accessibility
- Focus management on first error field
- Consistent error pattern across all forms

---

## Open Issues (active)

The items below are active and require immediate attention or follow-up testing.

- **Admin dashboard auth / dev-proxy wiring**: Frontend previously used absolute backend URLs for admin auth endpoints which bypassed the Vite `/api` proxy and caused HttpOnly cookie problems in development. `src/config/api.ts` was adjusted to use relative `/api/...` admin auth endpoints — verify in-browser admin login sets the `auth_token` cookie and that proxied requests include it.

- **Admin Dashboard Overview Stats Not Displaying (Feb 3, 2026)**: Active Projects, Clients, Revenue MTD, and Conversion Rate show "-" instead of actual counts.

  **Root Causes Identified & Fixed:**

  1. **admin-dashboard.ts** - Initial load and tab switch not calling overview module:
     - `loadDashboardData()` (initial load) only called `analyticsModule` - missing `overviewModule`
     - `switchTab('overview')` was only calling `analyticsModule.loadOverviewData()` (charts)
     - FIXED: Both now call `overviewModule.loadOverviewData()` for stats AND `analyticsModule.loadOverviewData()` for charts
  2. **admin-analytics.ts** - Invalid invoice status value (caused 400 error):
     - Called `/api/invoices/search?status=pending,overdue` but "pending" is not valid
     - Valid statuses: `draft, sent, viewed, partial, paid, overdue, cancelled`
     - FIXED: Changed to `/api/invoices/search?status=sent,overdue`
  3. **analytics-service.ts** - SQL column name mismatches:
     - Changed `paid_at` → `paid_date` (invoices table)
     - Changed `total_amount` → `amount_total` (invoices table)
     - Changed project status check `'in_progress'` → `'active', 'in-progress'`
  4. **admin-overview.ts** - API response parsing mismatches:
     - Leads API returns `{ success, leads, stats }` - frontend expected raw array
     - Clients API returns `{ clients }` - frontend expected raw array
     - Projects API returns `{ projects }` - frontend expected raw array
     - Messages unread API returns `{ unread_count }` - frontend expected `{ count }`
     - Project status filter used `'in_progress'` but DB uses `'in-progress'` (hyphenated)

  **Files Modified:**

  - `server/services/analytics-service.ts` - Fixed SQL column names
  - `src/features/admin/admin-dashboard.ts` - Fixed initial load AND tab switch to load both modules
  - `src/features/admin/modules/admin-analytics.ts` - Fixed invalid status value
  - `src/features/admin/modules/admin-overview.ts` - Fixed response parsing and status checks

  **Status:** ✅ FIXED - User Confirmed Working

- **Analytics Page KPI Cards Not Displaying (Feb 3, 2026)**: KPI cards (Revenue, Pipeline, Projects, Invoices) showing incorrect/empty values.

  **Root Cause:** Frontend expected different response format than backend returns.

  **Fixes in admin-analytics.ts:**

  1. **Revenue KPI**: Used `revenueData.summary.total_revenue` instead of `revenueData.currentMonth`
  2. **Pipeline KPI**: Used `pipelineData.summary.total_pipeline_value` and `total_leads` instead of `totalValue` and `activeLeads`
  3. **Projects KPI**: Used `projectsData.summary.active_projects` instead of `activeProjects`
  4. **Invoices KPI**: Used `inv.amount_total` (snake_case) instead of `inv.total`
  5. **Revenue Chart**: Used `result.data` with `total_revenue` field instead of `result.monthly` with `revenue` field
  6. **Project Status Chart**: Built chart from `summary.active_projects` and `completed_projects` instead of non-existent `byStatus` object

  **Status:** FIXED - Awaiting User Testing

- **Recent Activity Shows "No recent activity" (Feb 3, 2026)**: ~~Dashboard's Recent Activity section displaying "No recent activity" even when data should exist.~~

  **Root Cause (Final):** Two modules were writing to the same `recent-activity-list` element:

  - `admin-leads.ts` populated it with leads data
  - `admin-overview.ts` overwrote it with client activities (empty table)

  **Fix in src/features/admin/modules/admin-overview.ts:**

  - Changed `loadRecentActivity()` to fetch from `/api/admin/leads` instead of `/api/clients/activities/recent`
  - Now shows recent leads as the primary activity feed (matching intended dashboard behavior)

  **Status:** ✅ FIXED - User Confirmed Working

- **Invoices search (400)**: Dashboard reported `GET /api/invoices/search?status=sent,overdue` returned 400.

  **Root Cause:** Express route ordering issue. The `/:id` route was defined BEFORE `/search`, causing `/search` to match as `/:id` with `id="search"`. Then `parseInt("search")` returned NaN, triggering the 400 "Invalid invoice ID" error.

  **Fix in server/routes/invoices.ts:**

  - Moved `/search` route definition to BEFORE `/:id` route
  - Added comment explaining why route order matters

  **Status:** ✅ FIXED - User Confirmed Working

- **Sidebar counts (auth/500/403)**: `GET /api/admin/sidebar-counts` returned errors in the dashboard — verify admin auth/permission checks (`authenticateToken` / `requireAdmin`) and that DB queries (`visitor_sessions`, `general_messages`) handle empty or missing data gracefully.

- **Sidebar page order not intuitive (Feb 3, 2026)**: ✅ **FIXED (Feb 5, 2026)** — Reordered to logical grouping: DASHBOARD, LEADS, PROJECTS, CLIENTS, INVOICES, MESSAGES, DOCUMENTS, KNOWLEDGE, ANALYTICS, SYSTEM. Documents now above Analytics, Knowledge after Documents.

- **Reproduce & collect logs (developer steps)**:

  1. Start backend (`npm run dev:server`) and frontend (`npm run dev`).
  2. Login via dev proxy: POST `/api/auth/admin/login` (confirm `Set-Cookie: auth_token`).
  3. Call endpoints: `/api/analytics/quick/revenue?days=180`, `/api/invoices/search?status=pending,overdue`, `/api/admin/sidebar-counts` and save responses.
  4. Tail backend logs while reproducing and capture stack traces (`/tmp/nbc_server.log`).

- **Next action**: After reproducing, create minimal fixes: adjust param parsing/validation in route handlers, handle empty DB results safely, or align frontend request shapes. Add unit tests for parsing and a small E2E reproducer for the admin flow.

- **Documentation accuracy audit (Feb 2, 2026):** README, CONTRIBUTING, docs/README, CONFIGURATION, DEVELOPER_GUIDE, ARCHITECTURE, ADMIN_DASHBOARD, and related docs were checked against the codebase. Corrections: project structure (client pages, server routes/middleware/services), test structure and E2E command, login response (HttpOnly cookie, no token in body), BaseModule hooks (onInit/onDestroy), entry points (main-site.ts, portal.ts), admin modules list, archive 2026-02, CONFIGURATION routes.ts → api.ts, DEVELOPER_GUIDE email env vars (SMTP_*).
- **Deep documentation pass (Feb 2, 2026):** API_DOCUMENTATION: cookie path `/` (not `/api`), login/verify-magic-link response shape (`data.user` with camelCase fields), verify-invitation response `data: { email, name, company }`, set-password response and password rules (12 chars + complexity), refresh endpoint (returns token in body, does not set cookie), logout message "Logout successful". CONFIGURATION: FROM_EMAIL vs SMTP_FROM note, UPLOADS_DIR, pointer to server/config/environment.ts. SYSTEM_DOCUMENTATION: file upload implementation (sanitizeFilename, getUploadsSubdir, allowed types without JS/TS/HTML/CSS). DEVELOPER_GUIDE: clone URL fixed to noellebhaduri/no-bhad-codes.

---

## What's Next - Priority Order

### 1. USER TESTING REQUIRED (Blocking)

Before any new features, existing features need verification. The verification checklist below has ~60 items.

### 2. Front-End Polish (Non-blocking)

- [x] Button design audit - Already well-organized in `portal-buttons.css`
- [x] Badge design audit - Already well-organized in `portal-badges.css`
- [x] Recent activity on dashboard - Wired up to `/api/clients/activities/recent`
- [x] **Frontend-backend wiring review (Feb 2, 2026)** - Fixed 7 mismatches (admin overview revenue, admin files download/delete, admin test-email/run-scheduler endpoints, client notes). Added full client notes backend (migration 046, client-service, clients routes).
- [ ] Time-sensitive tasks view

### 3. API Endpoints Without Frontend UI (Gap)

**Audit (Feb 2026):** Not all API route groups have a corresponding frontend UI. The following are backend-only (no `fetch`/`apiFetch`/`apiPost` etc. from `src/`):

| Route prefix | Purpose | Frontend usage |
| -------------- | --------- | ---------------- |
| `/api/approvals` | Approval workflow definitions, steps, instances | None |
| `/api/triggers` | Workflow trigger management | None |
| `/api/document-requests` | Document requests (client + admin), templates | **Client Documents tab** (my requests, view, upload); **Admin Document requests tab** (list, create, from templates, view detail, review/approve/reject/remind/delete) |
| `/api/kb` | Knowledge base categories, articles, search, admin CRUD | **Client Help tab + Admin KB tab** |

All other major route groups (auth, admin, clients, projects, messages, invoices, uploads, intake, proposals, analytics, contact) have at least one frontend interaction point.

**UI plan (design-aligned):** [docs/design/API_UI_PLAN.md](design/API_UI_PLAN.md) plans where each of these fits in the current design:

- **Approvals + Triggers** — Admin: new **Workflows** tab (sub-tabs Approvals | Triggers); table cards, create/edit modals; same patterns as Leads/Projects (`.admin-table-card`, `--portal-*` tokens, Lucide icons).
- **Document requests** — Admin: new **Document requests** tab (list, create/from template, review/approve). Client portal: new **Documents** tab (my requests, upload, status).
- **Knowledge base** — Admin: new **Knowledge base** tab (categories + articles CRUD). Client portal: new **Help** tab (featured, categories, search, article view).

Suggested implementation order: KB client Help → KB admin → Document requests client → Document requests admin → Workflows (Approvals + Triggers). **Admin Document requests tab implemented (Feb 2026).**

### 4. Remaining Expansion Items

**Tier 6 (Admin Tables):** ✅ COMPLETE

- [x] Export Per Table - CSV export with proper escaping
- [x] Pagination UI - Client-side with localStorage persistence
- [x] Bulk Archive/Delete - Bulk selection and actions toolbar

**Tier 8 (Integrations):**

- Webhooks
- Public API
- Third-Party Integrations

---

## Planned: API Versioning (`/api/v1/`)

**Goals:** Add versioned API prefix; keep `/api/` working for backward compatibility; prepare for future v2.

### Phase 1: Backend — Dual Mount (Non-Breaking) ✅ COMPLETE

- [x] Mount all routers under both `/api/` and `/api/v1/` (same handlers).
- [x] Centralize route registration (loop over routers, mount twice).
- [x] Update root `/` endpoint response to include v1 paths in `endpoints`.
- [x] Leave `/health` and `/api-docs` unversioned.

**Status:** Complete (Feb 2, 2026)

### Phase 2: Frontend — Centralized API Prefix

- Add `API_VERSION` / `API_PREFIX` in `src/config/api.ts` (e.g. `API_PREFIX = '/api/v1'`).
- Update `apiConfig.endpoints` to use `API_PREFIX`.
- Ensure `apiFetch` / `apiPost` / `apiPut` / `apiDelete` use prefix.
- Find-and-replace hardcoded `/api/` paths across features (admin, client portal, etc.).

**Effort:** 2–4 hours | **Risk:** Medium (requires testing)

### Phase 3: Documentation

- Update API_DOCUMENTATION.md: state `/api/v1/` as canonical; add Versioning section.
- Update CONFIGURATION.md and ARCHITECTURE.md with versioning notes.
- Add v1 base path to Swagger if applicable.
- Update relevant architecture docs to note API versioning.

**Effort:** ~1 hour | **Risk:** Low

### Phase 4 (Optional): Deprecation Path

- Add `X-API-Deprecated`, `X-API-Sunset` headers for unversioned `/api/` requests.
- Log deprecated usage; set sunset date; later remove `/api/` mounts.

**Effort:** 1–2 hours | **Risk:** Low if clients migrate; High if external clients remain

### Implementation Order

| Step | Task |
| ------ | ------ |
| 1 | Backend: mount all routers at `/api/` and `/api/v1/` |
| 2 | Update root endpoint response |
| 3 | Add `API_PREFIX` constant in frontend config |
| 4 | Update `apiFetch`/`apiPost` etc. to use prefix |
| 5 | Migrate direct `fetch('/api/...')` callers |
| 6 | Update API docs and Swagger |
| 7 | (Optional) Deprecation middleware |

### Files to Touch

- **Backend:** `server/app.ts`
- **Frontend:** `src/config/api.ts`, api-client/utils, all features with `/api/` calls
- **Docs:** API_DOCUMENTATION.md, ARCHITECTURE.md, current_work.md

---

## Planned: Full WCAG 2.1 AA Compliance

**Goal:** Full WCAG 2.1 Level AA compliance across main site, admin dashboard, and client portal.

**Already in place:** Skip link, focus trap (confirm/modal), some ARIA, focus states in UX guidelines, password view toggles.

### Phase 1: Audit

| Tool | Purpose |
| ------ | --------- |
| **@axe-core/playwright** | Automated rules in E2E (images, labels, contrast, landmarks, roles) |
| **Lighthouse (Chrome DevTools)** | Accessibility audit for main site, admin, portal |
| **WAVE** (browser extension) | Visual feedback on issues |

**Pages to audit:** `/`, `/#about`, `/#contact`, `/#portfolio`, `/admin`, `/client/portal`, `/client/intake`, `/client/set-password`.

**Output:** Issue list by page with WCAG criterion (e.g. 1.1.1, 2.1.1), severity, fix guidance.

### Phase 2: Perceivable (WCAG 1.x)

| Criterion | Typical fixes |
| ----------- | --------------- |
| **1.1.1 Non-text content** | Alt text for images; decorative images `alt=""` or `aria-hidden` |
| **1.3.1 Info and relationships** | Semantic HTML; labels; `aria-describedby` for hints |
| **1.3.2 Meaningful sequence** | Logical DOM order; avoid layout-only tables |
| **1.4.1 Use of color** | Do not rely on color alone; add icons/text |
| **1.4.3 Contrast (minimum)** | 4.5:1 text, 3:1 large text; fix low-contrast tokens |
| **1.4.4 Resize text** | Ensure 200% zoom works; avoid fixed px where it breaks layout |
| **1.4.10 Reflow** | No horizontal scroll at 320px |
| **1.4.12 Text spacing** | Support 200% line-height, letter/word spacing adjustments |

### Phase 3: Operable (WCAG 2.x)

| Criterion | Typical fixes |
| ----------- | --------------- |
| **2.1.1 Keyboard** | All actions keyboard-accessible; remove `tabindex="-1"` where it blocks |
| **2.1.2 No keyboard trap** | Focus trap only for modals; Escape exits |
| **2.2.1 Timing adjustable** | Pause/disable auto-advancing content |
| **2.4.1 Bypass blocks** | Skip link to main content (already present; verify on all pages) |
| **2.4.2 Page titled** | Unique `<title>` per page |
| **2.4.3 Focus order** | Logical tab order; `tabindex` only when necessary |
| **2.4.4 Link purpose** | Descriptive link text; avoid "click here" |
| **2.4.5 Multiple ways** | Sitemap/nav for multi-page flows |
| **2.4.6 Headings and labels** | Clear headings; form labels |
| **2.4.7 Focus visible** | Visible focus ring on all focusable elements |
| **2.5.3 Label in name** | Accessible name includes visible label |

### Phase 4: Understandable (WCAG 3.x)

| Criterion | Typical fixes |
| ----------- | --------------- |
| **3.1.1 Language of page** | `<html lang="en">` (already set) |
| **3.2.1 On focus** | No automatic context change on focus |
| **3.2.2 On input** | No auto-submit without explicit confirmation |
| **3.3.1 Error identification** | Clear error messages; associate with fields |
| **3.3.2 Labels or instructions** | Labels for all inputs; placeholders as hint, not label |
| **3.3.3 Error suggestion** | Suggest corrections where possible |

### Phase 5: Robust (WCAG 4.x)

| Criterion | Typical fixes |
| ----------- | --------------- |
| **4.1.1 Parsing** | Valid HTML; no duplicate IDs |
| **4.1.2 Name, role, value** | Custom controls have role/state; dynamic updates announced |
| **4.1.3 Status messages** | Use `role="status"` or `aria-live` for toasts/notifications |

### Phase 6: Screen reader and manual testing

- **VoiceOver (macOS)** and **NVDA (Windows)** on key flows
- Admin: login, switch tabs, open project detail, create invoice
- Portal: login, view project, upload file, send message
- Main: navigation, contact form, business card interactions

### Phase 7: Documentation and CI

- Update `docs/design/UX_GUIDELINES.md` with WCAG patterns
- Add `@axe-core/playwright` to E2E for critical pages
- Document findings and remediation in `docs/design/ACCESSIBILITY_AUDIT.md`

### Implementation order

| Step | Task |
| ------ | ------ |
| 1 | Install @axe-core/playwright; add axe check to admin-flow.spec.ts |
| 2 | Run Lighthouse on main site, admin, portal; document issues |
| 3 | Fix critical (Level A) violations first |
| 4 | Fix Level AA violations (contrast, focus, labels) |
| 5 | Screen reader manual pass on key flows |
| 6 | Add reduced-motion support if missing |
| 7 | Create ACCESSIBILITY_AUDIT.md; update UX_GUIDELINES |

### Files and areas to touch

- **HTML:** index.html, admin/index.html, client/portal.html, client/intake.html, client/set-password.html
- **Components:** confirm-dialog, modal, forms, buttons, tables, dropdowns, tabs
- **Styles:** focus states, contrast tokens, reduced-motion
- **Tests:** tests/e2e/*.spec.ts (axe integration)
- **Docs:** UX_GUIDELINES.md, new ACCESSIBILITY_AUDIT.md

### Effort and risk

**Effort:** 3–5 days (audit 0.5d, fixes 2–3d, testing 0.5–1d, docs 0.5d)
**Risk:** Low for most items; medium if major reflows needed for zoom/reflow.

---

## Planned: Remaining System Gaps

### Frontend (6.1)

#### Real-time updates (WebSockets/SSE)

- **Goal:** Messages, notifications, or project updates without manual refresh.
- **Options:** (A) SSE for one-way server push (simpler); (B) WebSockets for bidirectional.
- **Phases:** 1) Add SSE endpoint (e.g. `/api/messages/stream`); 2) Client EventSource subscription; 3) Emit on new message/project update. Scope to messages first, then notifications.
- **Effort:** 1–2 days | **Risk:** Medium

#### Offline/portal (PWA for client portal)

- **Goal:** Client portal works offline or with poor connectivity.
- **Phases:** 1) Service worker for portal entry; 2) Cache critical assets; 3) Queue mutations (e.g. messages) when offline; 4) Sync when back online.
- **Effort:** 2–3 days | **Risk:** High (sync conflicts, stale data)

**A11y audit (full WCAG)** — See "Planned: Full WCAG 2.1 AA Compliance" below.

#### E2E coverage (admin/portal flows)

- **Goal:** Playwright tests for login → view project, create invoice, send message.
- **Status:** Admin login → view projects done (`tests/e2e/admin-flow.spec.ts`). Portal login → dashboard done (`tests/e2e/portal-flow.spec.ts`).
- **Next:** Admin create invoice, admin create proposal, portal file upload, portal message send.
- **Effort:** 1–2 days | **Risk:** Low

### Backend (6.2)

#### Rate limiting

- **Goal:** Prevent abuse of API endpoints.
- **Current:** No rate limiting in place.
- **Plan:** Use `express-rate-limit` with sliding window; stricter limits on auth endpoints.
- **Effort:** 0.5 day | **Risk:** Low

#### Request validation (Zod/Joi)

- **Goal:** Consistent schema validation on all incoming requests.
- **Current:** Mixed: some manual checks, some validation middleware.
- **Plan:** Adopt Zod for request validation; validate body, params, query.
- **Effort:** 1–2 days | **Risk:** Low

#### Caching layer (Redis)

- **Goal:** Cache expensive queries (analytics, reports).
- **Current:** No caching layer.
- **Plan:** Redis for session storage, query caching; invalidate on write.
- **Effort:** 1–2 days | **Risk:** Medium (operational complexity)

### DevOps (6.3)

#### CI/CD pipeline

- **Current:** Manual deployment.
- **Plan:** GitHub Actions for lint, type-check, test on PR; deploy to staging on merge to main.
- **Effort:** 0.5–1 day | **Risk:** Low

#### Staging environment

- **Current:** Local dev only.
- **Plan:** Deploy to Railway/Render staging environment; mirror production config.
- **Effort:** 0.5 day | **Risk:** Low

#### Database backups

- **Current:** Manual SQLite file backup.
- **Plan:** Automated daily backup to cloud storage (S3/B2); retention policy.
- **Effort:** 0.5 day | **Risk:** Low

---

## Planned: Analytics Design Cohesion

**Plan file:** `/Users/noellebhaduri/.claude/plans/hashed-fluttering-sprout.md`

**Goal:** Make Analytics tab styling consistent with System tab (the most cohesive).

**Issues Identified:**

| Issue | System Tab | Analytics Tab |
| ------- | ----------- | --------------- |
| Card wrapper | Always `.portal-project-card .portal-shadow` | Mixed: `.chart-container`, `.analytics-section`, `.kpi-card` |
| Card titles | `h3` with Acme font, uppercase, letter-spacing | Inconsistent - some Acme, some not |
| Backgrounds | `portal-bg-dark` for cards, `portal-bg-medium` for inner rows | Inconsistent mixing |
| Shadows | Only top-level cards have shadows | Nested shadows (chart-container + inner chart) |
| Grids | Consistent naming and spacing | Multiple patterns: `.charts-grid`, `.business-charts-grid`, `.analytics-grid` |
| Data rows | `.system-info-row` pattern | Various custom patterns per section |

**Status:** Plan created, awaiting implementation.

---

## Verification Checklist

### Admin Dashboard

- [ ] Login works (cookie set)
- [ ] Overview stats display correctly
- [ ] Recent activity shows leads
- [ ] All sidebar tabs load
- [ ] Project list displays
- [ ] Project detail opens
- [ ] Client list displays
- [ ] Client detail opens
- [ ] Invoice list displays
- [ ] Invoice actions work (send, mark paid)
- [ ] Lead pipeline loads
- [ ] Lead drag-and-drop works
- [ ] Messages thread list loads
- [ ] Messages compose works
- [ ] Analytics charts render
- [ ] System status loads
- [ ] Document requests list
- [ ] Knowledge base CRUD

### Client Portal

- [ ] Login works (cookie set)
- [ ] Dashboard displays project list
- [ ] Project detail opens
- [ ] Files tab shows files
- [ ] File upload works
- [ ] Messages load
- [ ] Message compose works
- [ ] Invoices display
- [ ] Invoice PDF download
- [ ] Document requests show
- [ ] Help articles load

### Main Site

- [ ] Homepage loads
- [ ] Navigation works
- [ ] Contact form submits
- [ ] Portfolio section displays

---

## Front-End Concerns

### UX/UI Implementation Plan

#### Priority 3: Admin Messages Split-View

- [ ] **Left panel** — Client list (scrollable, selection state, unread indicators)
- [ ] **Right panel** — Thread + reply area
- [ ] **Mobile** — Single pane with list/thread swap
- [ ] **Optional** — Resizable divider, URL state (`?client=123`)
- [ ] **A11y** — Focus management, live region announcements

#### Priority 5: Expert Decisions Required

- [ ] **Panel button placement** — Need "Panel button placement" guideline document
- [ ] **Badge redesign** — Need new visual system (not just color-dependent for WCAG 1.4.1)
- [ ] **Lead funnel styling** — Current styling looks off; needs redesign

#### Priority 6: WCAG Phase 1 Audit

- [ ] Run axe/Lighthouse/WAVE on: `/`, `/#about`, `/#contact`, `/#portfolio`, `/admin`, `/client/portal`, `/client/intake`, `/client/set-password`

---

### Client + Project Details Reorganization Plan

**Status:** Planning — needs implementation

#### Implementation Phases — Detail View IA

##### Phase 1: Header Actions Consistency

- [ ] Move Account Actions from card to header row (client detail)
- [ ] Add quick action buttons to both headers
- [ ] Implement consistent "More" dropdown menu pattern
- [ ] Remove `.client-account-actions` card from Overview tab

##### Phase 2: Information Consolidation (Client Detail)

- [ ] Merge Quick Stats + Health into single "At-a-Glance" card
- [ ] Merge Client Overview + CRM Details into single "Client Info" card
- [ ] Make Tags + Custom Fields a collapsible section or move to separate tab
- [ ] Reduce Overview tab from 7 cards to 3-4

##### Phase 3: Visual Hierarchy (Both Views)

- [ ] Add section dividers or spacing between logical groups

##### Phase 4: Responsive + Mobile

- [ ] Tab strips: horizontal scroll with fade indicators on mobile
- [ ] Header row: stack on narrow viewports
- [ ] Cards: full-width on mobile

##### Phase 5: Cross-View Consistency

- [ ] Standardize button placement pattern (header for primary, inline for secondary)
- [ ] Standardize empty states (icon + message + CTA)
- [ ] Standardize loading states

#### Acceptance Criteria — Detail Views Redesign

- [ ] Client detail header has inline quick actions (no buried card)
- [ ] Client Overview tab has max 4 cards (consolidated)
- [ ] Tab strips scroll on mobile
- [ ] Empty states are consistent across both views

---

### Portal styling (user feedback)

- [ ] **Toggle needs better design** — View toggle (e.g. Table/Pipeline, list/card) needs improved styling/UX.
- [ ] **NEW and ON-HOLD status colors are the same** — Both statuses use the same color, making them indistinguishable.
- [ ] **Account Actions buttons need better placement** — Client detail "Account Actions" are in a card and feel disconnected.
- [ ] **All modal forms: use reusable dropdown component** — Every modal form with a select should use the shared dropdown component.
- [ ] **Analytics tab: use reusable components** — Should use shared reusable components instead of analytics-only markup.
- [ ] **Analytics page label inconsistency** — Section headings inconsistently styled.
- [ ] **Non-passive event listeners** — Console shows scroll-blocking event warnings.
- [ ] **Analytics Business tab: Conversion Funnel + Lead Sources + Lead Scoring Rules broken** — Multiple components have data and layout issues.

---

### Main Site (Portfolio)

- [ ] **Projects section** — Code complete, needs assets only
  - [ ] CRT TV title cards for each project
  - [ ] Project screenshots
  - [ ] OG images for social (1200x630 PNG)

---

### THE BACKEND (Admin + Client Portal)

#### Detail Views Redesign

##### Phase 1 — UX/layout polish

- [ ] **Account Actions placement** (client detail) — Move or duplicate into the page header
- [ ] **Tabs responsive** — Project and client detail tab strips need overflow/scroll or wrap
- [ ] **Button icons in panels** — Improve placement of action buttons in detail panels

#### Dashboard Overhaul

##### Phase 0 — Decision

- [ ] **Choose layout** — Pick Option A, B, or C (Priority-First, Business Health, or Three-Column)

##### Phase 1 — Needs Attention

- [ ] **API** — Endpoints for overdue invoices, pending contracts, new leads, unread messages
- [ ] **UI** — "Needs Attention" block on Overview

##### Phase 2-4 — Layout, Activity, Verification

- [ ] Layout restructure
- [ ] Recent Activity polish
- [ ] Dashboard modal focus trap verification

#### Admin Portal

- [ ] **Button icons in panels** — Need better location for button icons in details panels
- [ ] **Tabs not responsive** — Tabs in project and client details pages need responsive behavior
- [ ] **Badge/status in tables** — Audit and improve badge/status display
- [ ] **Recent activity** — Dashboard Recent Activity section
- [ ] **Time-sensitive tasks** — Dashboard priority view

---

## VERIFICATION CHECKLIST (Detailed)

### TEST 1: Clients Tab

- [ ] Table displays health badge, tags as pills
- [ ] CRM Details and Custom Fields display
- [ ] Edit CRM and Custom Fields
- [ ] Contacts: add, edit, set primary, delete
- [ ] Activity tab timeline
- [ ] Tags: add, remove, filter
- [ ] Health score and Recalculate
- [ ] Invite icon works

### TEST 2: Contacts → Client Conversion

- [ ] Convert to Client works
- [ ] Converted badge displays

### TEST 3: Leads Tab

- [ ] Convert lead works
- [ ] Lead scoring displays
- [ ] Kanban drag-and-drop
- [ ] Tasks on leads
- [ ] Lead analytics

### TEST 4: Projects Tab

- [ ] Status dropdown saves
- [ ] Invite icon works
- [ ] Tasks tab
- [ ] Time tab
- [ ] Templates
- [ ] Delete project

### TEST 5: Contracts

- [ ] Preview/Download
- [ ] Request Signature
- [ ] Status shows signed/unsigned
- [ ] Client can sign via email
- [ ] Confirmation email
- [ ] Signature details in admin

### TEST 6: Invoices

- [ ] Mark Paid
- [ ] Send Reminder
- [ ] Apply Late Fees
- [ ] Schedule Invoice
- [ ] Cancel Scheduled
- [ ] Setup Recurring
- [ ] Pause/Resume Recurring
- [ ] Deposit Invoice PDF

### TEST 7: Proposals

- [ ] Rejected/Converted filters
- [ ] Templates
- [ ] Versioning
- [ ] E-signature
- [ ] Custom items
- [ ] Discounts
- [ ] Comments
- [ ] Activity log

### TEST 8: Messaging

- [ ] Thread list and switching
- [ ] Mentions
- [ ] Reactions
- [ ] Pin messages
- [ ] Notifications

### TEST 9: Files

- [ ] Filters work
- [ ] Version history
- [ ] Mobile card layout

### TEST 10: Analytics

- [ ] KPI cards load
- [ ] Charts render
- [ ] Reports CRUD
- [ ] Alerts CRUD

### TEST 11: UI/Modals

- [ ] Sidebar badges visible
- [ ] Mobile tabs scroll
- [ ] Delete/archive uses toast/modal
- [ ] Multi-step dialogs proper
- [ ] Focus trap in modals

### TEST 12: Client Portal

- [ ] Dashboard loads
- [ ] Invoices display and PDF download
- [ ] Messages work
- [ ] Files and upload
- [ ] Settings save
- [ ] Timeline view

### TEST 13: Proposal Builder

- [ ] All 4 steps work
- [ ] Admin sees submitted proposal

---

## Known Issues

*No critical known issues at this time.*

---

## Deferred Items

- **Global Event Listeners** — App not true SPA; handlers persist
- **AbortController** — High complexity; current behavior stable
- **Form Placeholders** — UX polish only
- **Stripe Payments** — Cost deferral
- **Real-Time Messages (WebSockets)** — Polling works fine; complexity deferred

---

## Expansion Plans

### TIER 8: Integrations & API

- [ ] Webhooks
- [ ] Public API
- [ ] Third-Party Integrations

### TIER 9: Security & Polish

- [ ] MFA / 2FA
- [ ] SSO
- [ ] Virtual Tour / Walkthrough
- [ ] Visual Proofing & Annotations

---

## New API Endpoints (Feb 2, 2026)

### Workflow Triggers (`/api/triggers`)

- `GET /` — Get all triggers
- `GET /options` — Get available event types and action types
- `GET /:id` — Get a specific trigger
- `POST /` — Create a new trigger
- `PUT /:id` — Update a trigger
- `DELETE /:id` — Delete a trigger
- `POST /:id/toggle` — Toggle trigger active state
- `GET /logs/executions` — Get trigger execution logs
- `GET /logs/events` — Get system events
- `POST /test-emit` — Test emit an event

### Document Requests (`/api/document-requests`)

- `GET /my-requests` — Get client's document requests
- `POST /:id/view` — Mark request as viewed
- `POST /:id/upload` — Upload document for request
- Admin endpoints for CRUD, review, approve, reject, remind

### Knowledge Base (`/api/kb`)

- `GET /categories` — Get all categories
- `GET /categories/:slug` — Get category with articles
- `GET /featured` — Get featured articles
- `GET /search` — Search articles
- Admin endpoints for category/article CRUD

### Client Endpoints (`/api/clients`)

- `GET /me/timeline` — Get client activity timeline
- `GET /me/timeline/summary` — Get activity summary
- `GET /me/notifications` — Get notification preferences
- `PUT /me/notifications` — Update notification preferences

---
