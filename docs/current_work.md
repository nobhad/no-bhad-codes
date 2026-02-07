# Current Work

**Last Updated:** February 7, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-02.md`.

---

## Post-Task Documentation Checklist

After completing any task:

- [ ] Move completed item from current_work to archive
- [ ] Add entry to `ARCHIVED_WORK_2026-02.md`
- [ ] Update feature docs (`docs/features/*.md`) if API/features changed
- [ ] Update `API_DOCUMENTATION.md` if endpoints changed
- [ ] Update relevant audit file (current state only, no fix logs)
- [ ] Verify no markdown violations

---

## Open Issues (active)

### Needs User Verification

- **Analytics Page KPI Cards (Feb 3)**: Fixed but awaiting user testing to confirm KPI cards display correctly.

- **Sidebar counts**: `GET /api/admin/sidebar-counts` — endpoint exists and looks correct, needs verification it works without errors.

---

## Outstanding Tasks

### 1. Documentation Audit

**Status:** TODO

#### Feature Docs (`docs/features/`)

- [ ] Audit existing feature docs for completeness
- [ ] Create missing feature docs
- [ ] Update outdated feature docs
- [ ] Cross-reference with actual implemented features

#### CSS Design Docs (`docs/design/`)

- [x] Verify `CSS_ARCHITECTURE.md` reflects current file structure (Feb 6)
- [x] Verify `CSS_AUDIT.md` metrics are accurate (90 files after split) (Feb 6)
- [x] Update `PORTAL_CSS_DESIGN.md` file lists (21 admin files) (Feb 6)
- [x] CSS variables documented in `CSS_ARCHITECTURE.md` (layout, typography, spacing, animations, z-index, theme)
- [x] Reusable component classes documented in `CSS_ARCHITECTURE.md` (card, buttons, inputs, badges) and `PORTAL_CSS_DESIGN.md` (button hierarchy)
- [x] CSS inconsistencies resolved (Feb 6): labels, border-radius, shadows

### 2. Portfolio Assets Needed

**Status:** Waiting on assets

The portfolio section code is complete but needs images:

- [ ] Project screenshots
- [ ] CRT TV title cards for each project
- [ ] OG images for social sharing (1200x630 PNG)

**Location:** `public/images/portfolio/` (directory needs to be created)

### 3. Front-End Polish

- [x] Time-sensitive tasks view on dashboard (Upcoming Tasks widget - Feb 6)
- [ ] Lead funnel styling improvements
- [ ] Analytics tab: use reusable components instead of analytics-only markup

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

## Audit Tasks (from design audits)

### Medium Priority

| Task | Source | Effort | Notes |
|------|--------|--------|-------|
| Text-based foreign keys | DATABASE_AUDIT | High | Replace `assigned_to`, `user_name` TEXT with proper FK references |
| Timestamp inconsistency | DATABASE_AUDIT | Medium | Standardize TEXT vs DATETIME across tables |
| Payment terms history | DATABASE_AUDIT | Medium | Preserve history when updating presets |
| Lead/Intake overlap | DATABASE_AUDIT | High | Consolidate duplicate intake/lead tracking |

### Low Priority - PDF Enhancements

| Task | Notes |
|------|-------|
| Draft watermark | Visual indicator for unpaid/draft invoices |
| PDF/A compliance | Requires XMP metadata library |
| Password protection | For sensitive documents |
| Thumbnails/previews | Show preview before download |
| Digital signatures | For legally binding contracts |

### Low Priority - Database

| Task | Notes |
|------|-------|
| Redundant fields | Remove `is_read` where `read_at` exists |
| Audit triggers | Add automatic timestamp triggers |
| Row-level security | Add tenant_id enforcement |

### Low Priority - Accessibility

| Task | Notes |
|------|-------|
| High contrast focus | Enhanced focus indicators for high contrast mode |

### Do Last - CSS Refactoring

| File | Lines | Status |
|------|-------|--------|
| `pages/admin.css` | 2,064 | DONE - Split: table-dropdowns, tooltips, table-filters, sidebar-badges |
| `admin/project-detail.css` | 1,645 | DONE - Split: pd-contract, pd-invoices |
| `pages/projects.css` | 1,120 | SPLIT: projects-detail.css (547 lines) |
| `pages/client.css` | 739 | SPLIT: client-auth.css (666 lines) |
| `admin/client-detail.css` | 805 | DONE - Split: cd-crm.css (497 lines) |

### CSS Consistency Fixes (Feb 6) - COMPLETE

- [x] Label font size: All `0.6875rem` → `0.75rem`
- [x] Label font size: All `0.625rem` → `0.75rem` (client-detail.css - 10 instances)
- [x] Border radius: All `--border-radius-card` → `--portal-radius-md`
- [x] Border radius: Hardcoded values tokenized (projects.css, client.css)
- [x] Status colors: projects.css hardcoded rgba/rgb → `--color-status-*` variables
- [x] Fixed heights: client.css auth container → responsive min-height/max-height
- [x] Filter dropdown padding: `1rem` → `var(--space-3)`
- [x] Search bar fallback chain simplified

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
- [ ] Upcoming tasks displays on dashboard
- [ ] Recent activity shows leads
- [ ] All sidebar tabs load (Tasks first after Dashboard)
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

## New API Endpoints Reference

### Global Tasks (`/api/admin/tasks`) - Feb 6

- `GET /` — Get all tasks across all active projects (params: status, priority, limit)

### Deleted Items (`/api/admin/deleted-items`) - Feb 6

- `GET /` — List all soft-deleted items with stats
- `GET /stats` — Get counts by entity type
- `POST /:type/:id/restore` — Restore a soft-deleted item
- `DELETE /:type/:id/permanent` — Permanently delete an item
- `POST /cleanup` — Run manual cleanup of expired items

### Workflow Triggers (`/api/triggers`) - Feb 2

- `GET /` — Get all triggers
- `POST /` — Create a new trigger
- `PUT /:id` — Update a trigger
- `DELETE /:id` — Delete a trigger
- `POST /:id/toggle` — Toggle trigger active state

### Document Requests (`/api/document-requests`) - Feb 2

- `GET /my-requests` — Get client's document requests
- `POST /:id/upload` — Upload document for request
- Admin endpoints for CRUD, review, approve, reject

### Knowledge Base (`/api/kb`) - Feb 2

- `GET /categories` — Get all categories
- `GET /featured` — Get featured articles
- `GET /search` — Search articles

---
