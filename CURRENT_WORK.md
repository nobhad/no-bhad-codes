# Current Work - March 16, 2026

## Current System Status

**Last Updated**: March 16, 2026

### Server

- **Command**: `npm run dev:full`
- **Local**: `http://localhost:3000`

### Build

- TypeScript: 0 errors
- ESLint: 0 errors, 0 warnings
- Vite build: passing (166 chunks)

---

## State of the Art Roadmap

**Status:** PLANNING
**Full plan:** [docs/STATE_OF_THE_ART_ROADMAP.md](./docs/STATE_OF_THE_ART_ROADMAP.md)

Gap analysis + codebase audit. 8 phases, 13 migrations (118-130).

### Phase 0: Foundation Fixes (MUST DO FIRST)

**Critical (blocks Phase 1):**

- [ ] 0A. Wire 4 orphaned services to API routes (prefill, dynamic questionnaire, intake checklist, project completion)
- [ ] 0B. Client proposal detail view + acceptance UI (backend exists, zero frontend)
- [ ] 0C. Maintenance tier activation (4 tiers stored but never acted on — no recurring billing, no contracts, no post-project automation)
- [ ] 0D. Contract signing flow verification (ContractSignModal exists — verify end-to-end)
- [ ] 0G. Payment schedule installments auto-generate invoices when due

**High (broken integrations):**

- [ ] 0E. Webhook dispatch for Slack/Discord (configs stored, messages never sent)
- [ ] 0F. Automations use DB email templates instead of hardcoded HTML
- [ ] 0K. Admin invoice management endpoint (frontend expects /api/admin/invoices, doesn't exist)
- [ ] 0L. Create modal backend gaps (Design Review, Questionnaire, Workflow, Deliverable — verify endpoints)

**Medium (UI fixes):**

- [ ] 0H. Admin delete button wiring (verify which are actually broken)
- [ ] 0I. Portal prop passing fixes + console cleanup
- [ ] 0J. Export/CSV buttons on ALL 22 admin tables (none functional)
- [ ] 0M. LeadDetailPanel built but not imported by LeadsTable
- [ ] 0P. Add proposal prefill endpoint to frontend constants + builder integration

**Low (docs + security):**

- [ ] 0N. Create CSS_ARCHITECTURE.md + UX_GUIDELINES.md (mandated by CLAUDE.md, missing)
- [ ] 0O. Security hardening (remove demo scripts, standardize bcrypt rounds, form label a11y)

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

## Archived Work

Previous work moved to: [ARCHIVED_WORK_2026-03.md](./docs/archive/work-logs/ARCHIVED_WORK_2026-03.md)
