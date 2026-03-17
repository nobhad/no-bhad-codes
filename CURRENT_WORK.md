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

All items verified against actual code. ~~0A~~, ~~0H~~, ~~0I~~ removed (proved false on re-audit).

**Critical (blocks Phase 1):**

- [ ] 0B. Client proposal detail view + acceptance UI (route redirects to /documents, no ProposalDetail.tsx)
- [ ] 0C. Maintenance tier activation (4 tiers stored then ignored — no recurring billing, no post-project automation)
- [ ] 0D. Portal contract signing missing event emission (saves signature but never emits `contract.signed` — 1-line fix)
- [ ] 0G. Payment schedule installments auto-generate invoices when due (no cascade exists)

**High (broken integrations):**

- [ ] 0E. Webhook dispatch for Slack/Discord (send functions exist in slack-service.ts but never called from automations)
- [ ] 0F. Automations use DB email templates (7 notification handlers hardcode HTML, ignore email_templates table)
- [ ] 0K. Admin invoice management endpoint (/api/admin/invoices missing, no admin barrel mount)
- [ ] 0L. Create modal backends — Design Reviews (no POST endpoint) + Workflows (no POST endpoint)

**Medium (UI completeness):**

- [ ] 0J. Export/CSV missing onClick on ~15 admin tables (InvoicesTable works, others don't)
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
