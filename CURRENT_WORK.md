# Current Work - March 17, 2026

## Current System Status

**Last Updated**: March 17, 2026

### Server

- **Command**: `npm run dev:full`
- **Local**: `http://localhost:3000`

### Build

- TypeScript: 0 errors
- ESLint: 0 errors, 0 warnings
- Vite build: passing (168 chunks)

---

## State of the Art Roadmap

**Status:** IN PROGRESS — Phase 0 COMPLETE
**Full plan:** [docs/STATE_OF_THE_ART_ROADMAP.md](./docs/STATE_OF_THE_ART_ROADMAP.md)

Gap analysis + codebase audit. 8 phases, 13 migrations (118-130). Phase 0 foundation fixes complete.

### Phase 0: Foundation Fixes (MUST DO FIRST)

All items verified against actual code. ~~0A~~, ~~0H~~, ~~0I~~ removed (proved false on re-audit).

**Critical (blocks Phase 1):**

- [x] 0B. Client proposal detail view + acceptance UI — DONE (PortalProposalDetail.tsx, route /proposals/:id, accept flow with confirmation)
- [x] 0C. Maintenance tier activation — DONE (migration 118, `handleMaintenanceActivation` handler, recurring invoice on project completion, `GET /projects/:id/maintenance` endpoint)
- [x] 0D. Portal contract signing — FIXED (added `workflowTriggerService.emit('contract.signed')` to `contracts/client.ts`)
- [x] 0G. Installment → invoice cascade — FIXED (added `generateDueInvoices()` + scheduler hook)

**High (broken integrations):**

- [x] 0E. Webhook dispatch — DONE (dispatchWebhooks() queries notification_integrations, sends to Slack/Discord, logs to delivery_logs)
- [x] 0F. Email templates — DONE (loadEmailTemplate() checks DB by slug first, falls back to hardcoded; all 7 handlers pass templateSlug)
- [x] 0K. Admin invoices — DONE (server/routes/admin/invoices.ts: GET list+stats, POST bulk-delete, POST bulk-status)
- [x] 0L. Create backends — DONE (POST /api/admin/design-reviews + POST /api/admin/workflows)

**Medium (UI completeness):**

- [x] 0J. Export/CSV — DONE (wired useExport to 9 tables, added 6 new export configs)
- [x] ~~0M. LeadDetailPanel~~ — already wired
- [x] 0P. Prefill + admin invoices in frontend constants — DONE (PROPOSALS_PREFILL, ADMIN.INVOICES added to api-endpoints.ts)

**Low (docs + security):**

- [x] ~~0N. Design docs~~ — already exist (CSS_ARCHITECTURE.md: 836 lines, UX_GUIDELINES.md: 69 lines)
- [x] 0O. Security hardening — DONE (demo/test scripts require env vars, bcrypt standardized to 12 rounds in intake.ts)

### Phase 1: Unified Client Experience

- [ ] 1A. In-Portal Contract Signing (prerequisite)
- [ ] 1B. Embedded Stripe Payments (prerequisite)
- [ ] 1C. Unified Project Agreement Flow (proposal + contract + payment in one step)
- [ ] 1D. Guided Client Onboarding Checklist

### Phase 2: Lead Nurture

- [ ] 2A. Email Drip Sequences (auto follow-up)
- [ ] 2B. Meeting Request System (client proposes times, admin confirms)

### Phase 3: Admin Self-Service

- [ ] 3A. Automation Engine (backend — API + execution engine)
- [ ] 3B. Automation Builder (frontend — visual drag-and-drop UI)

### Phase 4: Revenue Intelligence

- [ ] 4A. Expense Tracking + Project Profitability
- [ ] 4B. Retainer / Recurring Project Management

### Phase 5: Post-Project

- [ ] 5A. Feedback Surveys + Testimonial Collection
- [ ] 5B. Embeddable Widgets (contact form, testimonials, status badge)

### Phase 6: AI-Powered

- [ ] 6A. AI Proposal Drafting
- [ ] 6B. AI Email Response Drafting
- [ ] 6C. Semantic Search (Cmd+K)

### Phase 7: International

- [ ] 7A. Multi-Currency Support
- [ ] 7B. Tax Jurisdiction Handling

---

## Upcoming - PDF Deep Dive

**Status:** TODO

- [ ] Formatting review (contracts, proposals, invoices, intake, receipts, SOW) — spacing, table layouts, typography consistency
- [ ] SOW header — currently separate (`sowLogoHeight = 50`) — review if it should adopt the standard 100pt header or stay compact

---

## Architecture Audit — Deferred Items

**Status:** IN PROGRESS

### Item 2: Business Logic in Routes (Highest Impact)

64 route files bypass the services layer with direct DB queries (`db.get`, `db.all`, `db.run`).
Worst offenders: `search.ts`, `clients/core.ts`, `projects/core.ts`, `contracts.ts`, `document-requests.ts`, `auth/login.ts`.

- [ ] Extract DB queries to service layer, route files become thin controllers

### Item 4: Route Pattern Standardization

22 monolithic route files (1,000-1,468 lines) need barrel+sub-router split like `deliverables/`.
Largest: `uploads.ts` (1,468), `contracts.ts` (1,345), `document-requests.ts` (1,297), `questionnaires.ts` (1,120), `integrations.ts` (1,095), `data-quality.ts` (1,040).

- [ ] Split each into barrel + sub-routers + shared.ts

### Item 5: Service Export Pattern (Cosmetic)

4 different patterns across 45 service files (class singleton 47%, object literal 22%, pure functions 18%, default exports 18%).

- [ ] Standardize to one pattern

### Item 8: Mount/Export Consistency in app.ts (Cosmetic)

Mixed default/named imports for route mounting. Zero runtime impact.

- [ ] Standardize import style

---

## Remaining (Future Enhancements)

- [ ] Increase test coverage (~15% currently, target 70%)
- [ ] Docker setup for deployment
- [ ] RBAC (granular admin permissions beyond binary requireAdmin)
- [ ] **Frontend**: proposal builder reads prefill data and pre-checks features, suggests tier, shows recommendations

---

## Completed - CSS Bloat Cleanup + Layout Spacing (March 17, 2026)

**Status:** COMPLETE

Two rounds of CSS class consolidation plus layout spacing fixes.

### Classes Eliminated (~40 total, ~300 lines removed)

- [x] Payment stat classes → shared `stat-label`/`stat-value`
- [x] Invoice tab classes (`invtab-*`) → shared patterns + `pd-clickable-row`
- [x] Content checklist classes → `portal-card-header`, `<ProgressBar>`
- [x] Empty state variants → `empty-state--compact`, `empty-state--full`
- [x] `portal-card-actions` → `action-group` (7 components)
- [x] `note-card-header`, `project-card-header` → `portal-card-header`
- [x] `form-actions` → `action-group`
- [x] `note-meta` duplicate definition → merged
- [x] `kanban-column-title-wrapper` → `kanban-column-header`
- [x] `task-due-date` + `task-assignee` → `task-meta-item`
- [x] 18 dead classes in requests.css (131 lines)
- [x] detail-list variants consolidated via CSS variable

### Layout Fixes

- [x] `.section` owned exclusively by `PortalLayout.tsx` — route components use `.subsection`
- [x] Fixed double-nesting: PortalSettings, ProjectDetail, ClientDetail, DataQualityDashboard
- [x] `.section` top padding: `var(--portal-section-gap)` (24px uniform)
- [x] `.section` bottom padding: `var(--space-8)` (64px)
- [x] Dropdown shadows removed in admin portal (`--shadow-dropdown: none`)

---

## Archived Work

Previous work moved to: [ARCHIVED_WORK_2026-03.md](./docs/archive/work-logs/ARCHIVED_WORK_2026-03.md)
