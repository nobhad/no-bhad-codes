# Current Work - March 16, 2026

## Current System Status

**Last Updated**: March 16, 2026

### Server

- **Command**: `npm run dev:full`
- **Local**: `http://localhost:3000`

### Build

- TypeScript: 0 errors
- ESLint: 0 errors, 0 warnings
- Vite build: passing (156 chunks)

---

## Completed - Proposal Tier Milestones, Receipt Hardening, Validation, JSON Import/Export (March 16, 2026)

**Status:** COMPLETE

Four interconnected improvements to proposals, receipts, validation, and admin tooling.

### Part 1: Tier-Driven Milestone & Task Generation

- [x] New `server/config/tier-milestones.ts` — milestone templates for 5 project types x 3 tiers (good/better/best)
- [x] New `server/config/tier-tasks.json` — tier-specific task templates scaled by tier complexity
- [x] New `server/services/tier-milestone-generator.ts` — generates milestones/tasks from tier config, falls back to defaults
- [x] Modified `workflow-automations.ts` `handleProposalAccepted()` to use tier-aware generator
- [x] Addon features from `proposal_feature_selections` auto-create tasks on development milestone

### Part 2: Receipt Hardening

- [x] Receipt PDFs use billing-preferred fields via `COALESCE(billing_name, contact_name)` etc.
- [x] Billing address rendered in receipt PDF "RECEIVED FROM" section
- [x] Email notification sent automatically when receipt is generated
- [x] Payment schedule `mark-paid` auto-generates receipt when installment has linked `invoice_id`

### Part 3: Input Validation

- [x] Added `validateRequest()` schemas to `PUT /me/billing` (billing fields with length limits)
- [x] Added validation to 6 contact endpoints (`POST/PUT` for `/me/contacts`, admin contacts, CRM contacts)
- [x] Email normalization (trim + lowercase) applied before all contact/billing storage calls
- [x] Added `normalizeEmail()` and `isValidEmail()` shared utilities

### Part 4: JSON Import/Export

- [x] `GET/POST /api/projects/:id/export-milestones` and `/import-milestones`
- [x] `GET /api/proposals/:id/export` — full proposal data export
- [x] `GET /api/contracts/:contractId/export` — contract + signature log export
- [x] `GET/POST /api/admin/config/tier-milestones` — tier config export
- [x] `GET/POST /api/admin/config/default-tasks` and `/tier-tasks` — task config round-trip with backup

### Files Changed/Created

- **New:** `server/config/tier-milestones.ts`, `server/config/tier-tasks.json`, `server/services/tier-milestone-generator.ts`, `server/routes/admin/config.ts`
- **Modified:** `server/routes/clients/helpers.ts`, `server/routes/clients/me.ts`, `server/routes/admin/contacts.ts`, `server/routes/clients/crm.ts`, `server/services/receipt-service.ts`, `server/routes/payment-schedules/admin.ts`, `server/services/workflow-automations.ts`, `server/routes/projects/core.ts`, `server/routes/proposals/core.ts`, `server/routes/contracts/crud.ts`, `server/routes/admin/index.ts`

---

## Completed - Design System Audit and Documentation Restructure (March 16, 2026)

**Status:** COMPLETE

Full audit of the design system implementation vs documentation, followed by restructure and fixes.

### Documentation Restructure

- [x] Separated portal and main site into dedicated documents
- [x] Created `PORTAL_DESIGN.md` (759 lines) -- portal theme, components, layout, dropdowns, wrappers
- [x] Created `MAIN_SITE_DESIGN.md` -- page architecture, GSAP animations, business card, navigation, responsive
- [x] Rewrote `DESIGN_SYSTEM.md` (1211 -> 168 lines) -- now a concise index linking to specialist docs
- [x] Rewrote `COMPONENT_LIBRARY.md` (200 -> 343 lines) -- full catalog of 29 portal components, 10 UI primitives, 28 hooks
- [x] Rewrote `ANIMATIONS.md` (565 -> 327 lines) -- accurate inventory separated by portal/main site
- [x] Trimmed `CSS_ARCHITECTURE.md` (1111 -> 806 lines) -- shared concerns only, portal sections moved out
- [x] Deleted `BACKGROUND_COLORS.md` -- entirely obsolete (referenced non-existent `--portal-bg-*` variables)
- [x] Updated dropdown outlier status -- all 5 raw `<select>` elements already converted to `FormDropdown`

### Hardcoded Animation Duration Fixes (14 instances)

- [x] Added 5 new animation tokens to `src/design-system/tokens/animations.css`
- [x] Fixed 4 portal spinner durations (workflows, inline-edit, layout, micro-components)
- [x] Fixed portal pulse (cards), typing-bounce (messages), pulse-skeleton (tasks), skeleton-loading (interactive)
- [x] Fixed 6 instances in `loading.css` (3 spinner, 3 skeleton-shimmer)
- [x] Zero hardcoded animation durations remain in CSS

### GSAP Migration (6 CSS keyframes removed)

- [x] Migrated `project-drop-in/out` stagger to GSAP `gsap.to()` + `stagger` in `projects.ts`
- [x] Migrated `scale-in-left` heading divider to GSAP `gsap.to()` scaleX
- [x] Migrated `back-button-slide-in/out` to GSAP `gsap.fromTo()` in `projects.ts`
- [x] Migrated `header-img-fade-in/out` to GSAP `gsap.fromTo()`
- [x] Migrated `worksub-fade-in/out` to GSAP `gsap.fromTo()`
- [x] Migrated `slide-in-right` error toast to GSAP dynamic import in `error-utils.ts`
- [x] TypeScript: 0 errors, ESLint: 0 errors, Build: passing

---

## Completed - Portal HTML Wrapper Standardization (March 14, 2026)

**Status:** COMPLETE

Unified HTML wrapper structure across all admin and client portal components.

### Changes

- [x] Every top-level route renders `.section` as outermost wrapper
- [x] Every nested content wrapper uses `.subsection` (no nested `.section`)
- [x] `TableLayout` component: `nested` prop controls `.section` (default) vs `.subsection`
- [x] Admin hubs migrated from `subtab-content-wrapper` to `.section` (dead CSS removed)
- [x] Admin detail subtabs (8 files) changed from `.section` to `.subsection`
- [x] Custom wrapper classes (`analytics-view`, `overview-linear`, etc.) paired with `.section`/`.subsection`
- [x] `PortalViewLayout` updated from `portal-main-container` to `.section`
- [x] GSAP `useGsap.ts` hooks: added `clearProps: 'all'` to remove inline styles after animation
- [x] `.section` gets `padding-bottom: var(--portal-page-bottom)` (2x top padding)
- [x] Gutter CSS updated: `.subsection` excluded from Tier 1 and Tier 3 gutter rules
- [x] Documentation updated: CSS_ARCHITECTURE.md, COMPONENT_LIBRARY.md

### Rules (see CSS_ARCHITECTURE.md for full docs)

- `.section` = top-level route wrapper (gutter + bottom padding)
- `.subsection` = nested wrapper (layout only, no gutter)
- `<TableLayout>` = standalone route (renders `.section`)
- `<TableLayout nested>` = inside hub/detail page (renders `.subsection`)

---

## Completed - Universal Dropdown Unification

**Status:** COMPLETE

- [x] All native `<select>` elements converted to `FormDropdown` (admin + portal)
- [x] Radix Select in DeliverablesTab converted to `FormDropdown`
- [x] QuestionnaireForm hand-rolled select converted to `FormDropdown`
- [x] ContactsTab role dropdown: hide-selected-option filter + `dropdown-trigger--form` classes
- [x] ClientDetail status dropdown: `StatusBadge` + `dropdown-caret--status`
- [x] ProjectDetail status dropdown: `dropdown-caret--status` (was `dropdown-caret`)
- [x] Absolute caret positioning for ALL dropdown types (status, form, custom, table, modal, pagination)
- [x] `text-transform: none` universal rule for all dropdown triggers and items
- [x] Normalized value comparison in `FormDropdown` and `InlineSelect` (handles DB format mismatches)
- [x] Removed orphaned CSS: `.qform-select-*`, `.inline-select-trigger`
- [x] All 5 outliers (O9-O14) converted
- [x] Pagination page-size dropdown open state fixes
- [ ] Caret position -- awaiting visual confirmation

---

## Completed - Backend Enhancements (March 13, 2026)

**Status:** COMPLETE

### Payment Schedule System

- [x] Migration 107: `payment_schedule_installments` table
- [x] Entity mapper, service, routes (admin CRUD + client read-only)
- [x] SSOT: constants, types, filter configs
- [x] Portal view: `PaymentScheduleView.tsx`

### Content Request System

- [x] Migration 108: 3 tables + seeded "Website Build" template
- [x] Migration 110: `content_request_history` audit trail
- [x] Migration 111: priority column
- [x] Entity, service, routes (admin + client submissions)
- [x] Audit history logging on all submissions and reviews
- [x] Rejection state + bulk operations
- [x] Portal view: `ContentChecklistView.tsx`

### Lead Scoring Enhancements

- [x] Auto-score on intake submission
- [x] Fixed rule thresholds (business-site, web-app)
- [x] Expanded scoring fields (feature_count, design_level, source_type)

### Project Template Enhancement

- [x] Migration 109: 4 new JSON columns (content requests, payment schedule, contract template, tiers)
- [x] `createProjectFromTemplate()` auto-generates content checklists, payment schedules, contracts

### SSOT & Request Systems Refinement

- [x] Fixed `DOCUMENT_REQUEST_STATUSES` mismatch in constants.ts
- [x] Added shared `PRIORITY_LEVELS`, `REQUEST_CATEGORIES`, `QUESTIONNAIRE_RESPONSE_STATUSES`
- [x] Added `DOCUMENT_REQUEST_STATUS_CONFIG`, `QUESTIONNAIRE_RESPONSE_STATUS_CONFIG` to frontend types
- [x] Replaced hardcoded filter options with `configToFilterOptions()` derivations
- [x] Entity mappers: `questionnaire.ts`, `document-request.ts`

### Portal UI

- [x] `PortalRequestsHub` — unified tabbed view (Questionnaires, Doc Requests, Content)
- [x] `ContentChecklistView` — checklist with type-specific submission UI
- [x] `PaymentScheduleView` — installments with summary card
- [x] Routes: `/requests-hub`, `/content-requests`, `/payment-schedule`

---

## Upcoming - PDF Deep Dive

**Status:** TODO

- [ ] Formatting review (contracts, proposals, invoices, intake, receipts, SOW) — spacing, table layouts, typography consistency
- [ ] SOW header — currently separate (`sowLogoHeight = 50`) — review if it should adopt the standard 100pt header or stay compact

---

## Completed — ADD Button Create Modals (March 15, 2026)

**Status:** COMPLETE

12 ADD buttons had no onClick handler. Built create modals for 11 entities (2 have no POST endpoint).

- [x] Identified all 21 ADD button instances (8 working, 13 broken)
- [x] Created `CreateEntityModals.tsx` with 11 modal components following AddClientModal pattern
- [x] Wired all 11 tables with modal state, API POST handlers, and refetch
- [x] Dropdown options derived from existing table data where available
- [x] 2 entities without POST endpoints: Contacts (standalone) shows info notification, Design Reviews keeps "Coming Soon"
- [x] TypeScript: 0 errors, ESLint: 0 errors, Build: passing

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

Build a service that maps completed questionnaire responses into proposal builder pre-population data. When all questionnaires are completed, auto-generate a draft proposal with:

- [ ] **Tier suggestion** — based on budget (intake), page count (content questionnaire), feature complexity (type-specific questionnaire)
- [ ] **Feature auto-selection** — map questionnaire answers to feature IDs (e.g., "blog needed: yes" → `blog-setup`, integrations checklist → matching features)
- [ ] **Custom items auto-generation** — "need logo: yes" → add "Logo Design" line item, "help with domain: yes" → add "Domain Registration" item, low tech comfort → add "Training & Documentation"
- [ ] **Maintenance recommendation** — tech comfort level + update frequency answers → suggest DIY/essential/standard/premium
- [ ] **Scope section pre-fill** — page list from content questionnaire populates scope of work, service descriptions from business-site questionnaire populate deliverables
- [ ] **Admin notes enrichment** — inspiration sites, brand values, competitor info, design preferences aggregated into structured admin notes for proposal review
- [ ] **Timeline/validity inference** — timeline answer drives proposal `validity_days`
- [ ] **Service**: `server/services/proposal-prefill-service.ts` — takes `projectId`, fetches all completed questionnaire responses, returns `ProposalPrefillData` object
- [ ] **Route**: `GET /api/proposals/prefill/:projectId` — admin endpoint returning prefill data
- [ ] **Frontend**: proposal builder reads prefill data and pre-checks features, suggests tier, shows recommendations

---

## Archived Work

Previous work moved to: [ARCHIVED_WORK_2026-03.md](./docs/archive/work-logs/ARCHIVED_WORK_2026-03.md)
