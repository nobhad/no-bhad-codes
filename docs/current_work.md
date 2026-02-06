# Current Work

**Last Updated:** February 6, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-02.md`.

## Recently Completed

### Status Color Differentiation (Feb 6, 2026)

Fixed NEW vs ON-HOLD/PENDING using same color.

- Added `--status-new: #06b6d4` (cyan) to `design-system/tokens/colors.css`
- Separated NEW badge from PENDING/ON-HOLD in `portal-badges.css`
- NEW is now cyan, PENDING/ON-HOLD remains yellow

### Admin UI for Deleted Items (Feb 6, 2026)

Created admin UI module for viewing and managing soft-deleted items.

- `src/features/admin/modules/admin-deleted-items.ts`
- Table view with filter by entity type
- Days until permanent deletion with urgency indicators
- Restore and permanent delete actions

### PDF Multi-Page Support (Feb 6, 2026)

Added multi-page overflow handling to invoice and proposal PDF generation.

### Form Error Display Unification (Feb 6, 2026)

Unified contact form error display to use inline errors instead of popup errors.

---

## Verified as Already Implemented

Based on code audit (Feb 6, 2026), these items were listed as TODO but are already done:

- [x] **Rate limiting** — Already implemented in `server/middleware/security.ts`, applied to auth and analytics routes
- [x] **Tab responsiveness** — Already implemented with scroll + fade indicators in `portal-tabs.css`
- [x] **Modal dropdowns** — 35 usages of `initModalDropdown` across codebase
- [x] **Non-passive event listeners** — 16 files already use `{ passive: true }`
- [x] **Empty state component** — Exists in `src/components/empty-state.ts`
- [x] **Loading states** — 82 usages of loading utilities across codebase
- [x] **Account Actions in header** — Already in detail header with icon buttons (line 768)

---

## Open Issues (active)

### Needs User Verification

- **Analytics Page KPI Cards (Feb 3)**: Fixed but awaiting user testing to confirm KPI cards display correctly.

- **Sidebar counts**: `GET /api/admin/sidebar-counts` — endpoint exists and looks correct, needs verification it works without errors.

### Already Fixed (can be archived)

- ✅ **Admin Dashboard Overview Stats** — FIXED, User Confirmed Working
- ✅ **Recent Activity** — FIXED, User Confirmed Working
- ✅ **Invoices search (400)** — FIXED, User Confirmed Working
- ✅ **Sidebar page order** — FIXED (Feb 5, 2026)
- ✅ **NEW vs ON-HOLD same color** — FIXED (Feb 6, 2026)

---

## Outstanding Tasks

### 1. Portfolio Assets Needed

**Status:** Waiting on assets

The portfolio section code is complete but needs images:

- [ ] Project screenshots
- [ ] CRT TV title cards for each project
- [ ] OG images for social sharing (1200x630 PNG)

**Location:** `public/images/portfolio/` (directory needs to be created)

### 2. API Endpoints Without Frontend UI

| Route prefix | Purpose | Status |
|--------------|---------|--------|
| `/api/approvals` | Approval workflow definitions | Backend only, no UI |
| `/api/triggers` | Workflow trigger management | Backend only, no UI |

**Decision needed:** Do you want UI for Approvals/Triggers workflows?

### 3. Front-End Polish

- [ ] Time-sensitive tasks view on dashboard
- [ ] Lead funnel styling improvements
- [ ] Analytics tab: use reusable components instead of analytics-only markup
- [ ] Analytics page label inconsistency — Section headings inconsistently styled

### 4. Client + Project Details Reorganization

**Status:** Planning — optional UX improvements

- [ ] Merge Quick Stats + Health into single card
- [ ] Merge Client Overview + CRM Details into single card
- [ ] Reduce Overview tab from 7 cards to 3-4

### 5. Analytics Design Cohesion

**Goal:** Make Analytics tab styling consistent with System tab.

**Issues:** Mixed card wrappers, inconsistent titles, nested shadows, multiple grid patterns.

**Plan file:** `/Users/noellebhaduri/.claude/plans/hashed-fluttering-sprout.md`

---

## Planned: API Versioning (`/api/v1/`)

### Phase 1: Backend ✅ COMPLETE

Already mounts routers at both `/api/` and `/api/v1/`.

### Phase 2-4: Frontend + Docs (Optional)

- Add `API_PREFIX` constant in frontend config
- Update docs to state `/api/v1/` as canonical

**Decision needed:** Is this worth doing? Current `/api/` works fine.

---

## Planned: Full WCAG 2.1 AA Compliance

**Already in place:** Skip link, focus trap, ARIA, focus states, password toggles.

**Remaining:**

- [ ] Run axe/Lighthouse audit on all pages
- [ ] Fix any critical/high violations found
- [ ] Screen reader manual pass on key flows

---

## Planned: System Gaps (Future)

### Not Currently Needed

| Item | Reason to Defer |
|------|-----------------|
| WebSockets/SSE | Polling works fine |
| PWA/Offline | Clients have connectivity |
| Redis caching | SQLite is fast enough |
| CI/CD | Manual deploy works |
| Zod validation | Current validation works |

### Consider Later

- [ ] Database backups automation (currently manual SQLite copy)
- [ ] E2E test expansion (admin create invoice, portal file upload)

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

## Deferred Items

- **Stripe Payments** — Cost deferral
- **Real-Time Messages (WebSockets)** — Polling works fine
- **Webhooks/Public API** — No external integrations needed
- **MFA/2FA, SSO** — Single admin user
- **Virtual Tour/Walkthrough** — Nice to have, not essential

---

## New API Endpoints Reference (Feb 2, 2026)

### Workflow Triggers (`/api/triggers`)

- `GET /` — Get all triggers
- `POST /` — Create a new trigger
- `PUT /:id` — Update a trigger
- `DELETE /:id` — Delete a trigger
- `POST /:id/toggle` — Toggle trigger active state

### Document Requests (`/api/document-requests`)

- `GET /my-requests` — Get client's document requests
- `POST /:id/upload` — Upload document for request
- Admin endpoints for CRUD, review, approve, reject

### Knowledge Base (`/api/kb`)

- `GET /categories` — Get all categories
- `GET /featured` — Get featured articles
- `GET /search` — Search articles

---
