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

## Completed - Detail Panel Factory + 8 Entity Panels (March 16, 2026)

**Status:** COMPLETE

Built a reusable `DetailPanel` factory and 8 entity-specific slide-in detail panels. All admin tables with unused clickable rows now open detail panels on row click.

### Factory Created

- `src/react/factories/createDetailPanel.tsx` -- `DetailPanel`, `MetaItem`, `MetaGrid`, `Timeline`
- Exported from `@react/factories` index

### Entity Panels Built (all using factory)

- [x] `contracts/ContractDetailPanel.tsx` -- Overview, Timeline
- [x] `proposals/ProposalDetailPanel.tsx` -- Overview, Timeline
- [x] `document-requests/DocumentRequestDetailPanel.tsx` -- Overview, Timeline
- [x] `contacts/ContactDetailPanel.tsx` -- Overview
- [x] `questionnaires/QuestionnaireDetailPanel.tsx` -- Overview, Progress
- [x] `design-review/DesignReviewDetailPanel.tsx` -- Overview, Timeline
- [x] `workflows/WorkflowDetailPanel.tsx` -- Overview, Stats
- [x] `email-templates/EmailTemplateDetailPanel.tsx` -- Overview, Variables

### Tables Wired

- [x] ContractsTable -- row click opens ContractDetailPanel
- [x] ProposalsTable -- row click opens ProposalDetailPanel
- [x] DocumentRequestsTable -- row click opens DocumentRequestDetailPanel
- [x] ContactsTable -- row click opens ContactDetailPanel
- [x] QuestionnairesTable -- row click opens QuestionnaireDetailPanel
- [x] DesignReviewTable -- row click opens DesignReviewDetailPanel
- [x] WorkflowsTable -- row click opens WorkflowDetailPanel
- [x] EmailTemplatesManager -- row click opens EmailTemplateDetailPanel

---

## Completed - Design System Audit + Fixes (March 16, 2026)

**Status:** COMPLETE

Comprehensive design system audit with fixes: heading tier tokens, animation tokens, gutter-on-children pattern, dropdown border unification, detail panel redesign (leads), inline editing for 5 tables, dead edit button removal from 4 tables, portal header restyle, migration fix (SQLite UNIQUE constraint), icon size consistency fix.

---

## Completed - Full Project Pipeline Implementation (March 16, 2026)

**Status:** COMPLETE

Built the complete project lifecycle pipeline from initial contact through project completion.

### Pipeline Automations Built

- [x] Contact form auto-response email to submitter
- [x] Questionnaire auto-assignment after project creation (based on project type)
- [x] Proposal prefill service — maps questionnaire answers to suggested tier, features, and maintenance
- [x] Budget-relative proposal template system (Good=45%, Better=80%, Best=130% of budget)
- [x] Feature catalog with 155 features + 63 addons across 6 project types
- [x] Maintenance inclusion per tier (Good=none, Better=optional, Best=3mo included)
- [x] Client proposal acceptance endpoint (POST /proposals/:id/accept)
- [x] Auto-contract generation after proposal acceptance (from default template)
- [x] Auto-payment schedule creation (tier-based splits: 50/50, 40/30/30, or 25x4)
- [x] Project completion detection + automated completion endpoint
- [x] Intake checklist / missing info tracker for email-initiated projects
- [x] Admin "request info" email endpoint for missing project data
- [x] Dynamic questionnaire generation — auto-creates personalized questionnaire from missing project info
- [x] All questions shown with pre-filled data from admin entry — client can review and edit
- [x] Only missing essential fields are required; everything else optional but visible
- [x] Intake checklist service — tracks collected vs missing intake data per project
- [x] Admin "request info" email — sends targeted email asking client for specific missing fields

### New Services Created

- `server/services/proposal-prefill-service.ts` — questionnaire to proposal data mapping
- `server/services/project-completion-service.ts` — completion detection + workflow
- `server/services/intake-checklist-service.ts` — missing info tracking + email requests
- `server/services/dynamic-questionnaire-service.ts` — auto-generates custom questionnaires from missing info
- `server/config/proposal-templates.json` — master feature catalog (700+ lines)
- `server/config/proposal-templates.ts` — budget calculator + feature resolver

### New API Endpoints

- `GET /api/proposals/prefill/:projectId` — proposal prefill from questionnaires
- `POST /api/proposals/:id/accept` — client accepts proposal
- `POST /api/proposals/from-template` — create proposal from template + budget
- `GET /api/projects/:id/completion-status` — check completion readiness
- `POST /api/projects/:id/complete` — mark project complete (with blocker detection)
- `GET /api/projects/:id/intake-checklist` — missing information tracker
- `POST /api/projects/:id/request-info` — email client for missing info
- `POST /api/projects/:id/generate-questionnaire` — generate custom questionnaire from gaps
- `GET/POST /api/admin/config/proposal-templates` — proposal template CRUD

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

## Concern — In-Portal Contract Signing Missing

**Status:** NOT STARTED

`sign-contract.html` is the only way to sign a contract (token-based, via email link). Clients in the portal cannot see or sign contracts — `/contracts` route redirects clients to `/documents`.

### What's Missing

- Clients have no way to see their contracts in the portal
- No in-portal signing UI (signature pad, PDF preview)
- No authenticated signing API endpoint (only token-based public endpoint exists)

### What Needs to Happen

- [ ] New API endpoint — `POST /api/contracts/:id/sign` using session cookie auth
- [ ] React `ContractSignature` component — reusable signature pad (draw/type modes, canvas → PNG)
- [ ] Portal contract view for clients — stop redirecting `/contracts`, show contracts with status + "Sign" button
- [ ] Signing modal/page — contract PDF preview + signature form inline in the portal
- [ ] Keep `sign-contract.html` for email-link signing (unauthenticated flow)

---

## Remaining (Future Enhancements)

- [ ] Increase test coverage (~15% currently, target 70%)
- [ ] Docker setup for deployment
- [ ] RBAC (granular admin permissions beyond binary requireAdmin)

### Questionnaire → Proposal Pre-Population

Built as part of the Full Project Pipeline (see Completed section above).

- [x] **Tier suggestion** — based on budget (intake), page count (content questionnaire), feature complexity (type-specific questionnaire)
- [x] **Feature auto-selection** — map questionnaire answers to feature IDs
- [x] **Custom items auto-generation** — logo, domain, training items based on answers
- [x] **Maintenance recommendation** — tech comfort level + update frequency answers → suggest tier
- [x] **Scope section pre-fill** — page list from content questionnaire populates deliverables
- [x] **Admin notes enrichment** — inspiration sites, brand values, design preferences aggregated
- [x] **Timeline/validity inference** — timeline answer drives proposal `validity_days`
- [x] **Service**: `server/services/proposal-prefill-service.ts`
- [x] **Route**: `GET /api/proposals/prefill/:projectId`
- [ ] **Frontend**: proposal builder reads prefill data and pre-checks features, suggests tier, shows recommendations

---

## Archived Work

Previous work moved to: [ARCHIVED_WORK_2026-03.md](./docs/archive/work-logs/ARCHIVED_WORK_2026-03.md)
