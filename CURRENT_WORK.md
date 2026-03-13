# Current Work - March 11, 2026

## Portal forms — single source of truth

- **Portal forms (admin + client):** `src/styles/shared/portal-forms.css` is the only place for input/textarea/select border, padding, focus, and typography. Feature CSS should only add layout (grid, gap, width).
- **Public/marketing forms:** `src/styles/components/form-fields.css` styles only `.form-container` and `.login-form`; no global `.form-input`/`.form-textarea` so portal forms are not overridden.
- **Labels:** `src/styles/shared/field-label-spacing.css` is SoT for `.field-label`/`.meta-label`; portal-forms only adds form-context overrides (position, pointer-events).

---

## Intake data → Client Detail

- **Intake form:** New clients created from `POST /api/intake` now store `contact_name`, `company_name`, `email`, and `phone` (optional) so Client Detail Overview shows Contact Information and Account Details from intake.
- **Existing client:** When an existing client (matched by email) submits intake again, their record is updated with `contact_name`, `company_name`, and `phone` from the submission so the detail page stays in sync with intake data.
- **Validation:** Optional `phone` field added to intake submission schema (max 50 chars).

---

## Current System Status

**Last Updated**: March 12, 2026

### Server

- **Command**: `npm run dev:full`
- **Local**: `http://localhost:3000`

### Build

- TypeScript: 0 errors
- ESLint: 0 errors, 0 warnings
- Vite build: passing (156 chunks)

---

## Completed - Full Portal Audit Fix

**Status:** 70+ items COMPLETE (all 20 layers at grade A)
**Grade:** C+ to A (25 commits across 10 waves)
**Reference:** [FULL_PORTAL_AUDIT.md](./docs/FULL_PORTAL_AUDIT.md)

### Waves 1-9 - ALL COMPLETE

All 56 original v1+v2 items resolved. See audit doc for full breakdown.

### Wave 10 - COMPLETE (Grade A Push)

- [x] CI/CD pipeline (.github/workflows/ci.yml)
- [x] Root ErrorBoundary wrapping PortalApp
- [x] usePortalFetch transform stability (useRef)
- [x] Database index migration (098, comprehensive FK indexes)
- [x] Calendar service rate limiting (exponential backoff)
- [x] Analytics service idempotency (transactions + dedup)
- [x] Ad-hoc request email notifications
- [x] Integration health check endpoint (GET /integrations/health)
- [x] SystemStatusDashboard heading hierarchy fix
- [x] Inline color styles converted to CSS classes
- [x] ErrorCodes enum standardized across all routes
- [x] 9 new unit test files for utilities and services

---

## Completed - Project Field Save & DB Fixes

**Status:** COMPLETE

### Issues Fixed

- Project fields (budget, end_date, repo_url, contract_signed_date) showing empty after refresh
- `PUT /api/projects/:id` returning 500 on any field update

### Root Causes & Fixes

**1. Missing column aliases in SELECT queries**

GET list, GET /:id, and PUT response queries used `p.*` — returning raw DB column names.
Frontend `Project` type reads `budget`, `end_date`, `repo_url`, `contract_signed_date` but DB stores
them as `budget_range`, `estimated_end_date`, `repository_url`, `contract_signed_at`.
Fixed by adding explicit aliases to all three query sites in `server/routes/projects/core.ts`.

**2. Migration 102 — restore `default_deposit_percentage`**

Migration 049 rebuilt the `projects` table and silently dropped the `default_deposit_percentage` column
(added in migration 027). `PROJECT_COLUMNS` SELECT in the PUT route's auth check threw
`SQLITE_ERROR: no such column: default_deposit_percentage`, aborting every update.
Fixed: `server/database/migrations/102_restore_default_deposit_percentage.sql`

**3. Migration 103 — fix message sub-table foreign keys**

`message_mentions`, `message_reactions`, `message_read_receipts`, `pinned_messages` had FKs pointing to
`_general_messages_deprecated_085` (dropped by migration 093). With `PRAGMA foreign_keys = ON`, every
INSERT to these tables failed with "no such table" 500 errors.
Fixed: `server/database/migrations/103_fix_message_foreign_keys.sql`

**4. TypeScript type fix**

`Project.budget` typed as `number` — changed to `string` (maps to `budget_range TEXT` column).
Budget sort in `ProjectsTable.tsx` updated from arithmetic to `localeCompare`.

**5. Duplicate import fix**

`usePortalMessages.ts` imported `buildEndpoint` twice (lines 16 and 19), causing TS2300.
Removed duplicate import.

### Files Modified

- `server/routes/projects/core.ts` — column aliases added to all SELECT/PUT queries
- `server/database/migrations/102_restore_default_deposit_percentage.sql` — new migration
- `server/database/migrations/103_fix_message_foreign_keys.sql` — new migration
- `src/react/features/admin/types.ts` — `budget` type: `number` → `string`
- `src/react/features/admin/projects/ProjectsTable.tsx` — budget sort fix
- `src/react/features/portal/messages/usePortalMessages.ts` — removed duplicate import

---

## Completed - Dashboard Kanban & Navigation Fixes

**Status:** COMPLETE

### Issues Fixed

1. **Kanban columns not scrollable** — `.kanban-items` had no `max-height` or `overflow-y`. Columns were cut off when tasks exceeded visible height.
2. **Kanban heading styling** — Column headings had browser-default top margin and a `border-bottom` that intersected with `border-left` from `portal-kanban.css`. Heading and border visually overlapped.
3. **"Upcoming Tasks" heading not navigating to Tasks subtab** — Clicking the heading navigated to Work overview instead of the Tasks subtab. Three approaches failed (setTimeout dispatch, sessionStorage, module-level variable) due to React Strict Mode. Fixed with `navigate('/work', { state: { subtab: 'tasks' } })` + `useLocation().state` in `WorkDashboard` `useState` initializer.
4. **Heading hover text not turning red** — Added `.overview-panel-action:hover .field-label { color: var(--color-accent); }`.

### Files Modified

- `src/styles/admin/overview-layout.css` — kanban padding, h4 margin reset, `max-height`/`overflow-y` on `.kanban-items`, hover color rule
- `src/react/features/admin/overview/OverviewDashboard.tsx` — "Upcoming Tasks" title converted to `<button>` using `navigate` with location state
- `src/react/features/admin/work/WorkDashboard.tsx` — `useState` initializer reads `location.state.subtab` via `useLocation`

---

## Completed - Portal CSS Legacy Cleanup (Form classes)

**Status:** COMPLETE

- Standardized form wrapper to `.form-field` — `.form-group` fully removed from all CSS, EJS, HTML, TS, and TSX files.
- Auth gate converted to React component (`AuthGate.tsx` + `mount-auth-gate.tsx`); `auth-gate.ejs` is now a thin React mount point.
- Build-time CSS selector typo in `portal-tabs.css` fixed (no more esbuild warnings).

## Completed - Validation & Status Mismatch Fixes

**Status:** COMPLETE

### Issues Fixed

1. **Task status update failing** — `validateRequest(ValidationSchemas.task)` required `title`; status-only PUTs (`{ status: 'in_progress' }`) returned 400. Removed `{ type: 'required' }` from `task.title`.
2. **Task status values mismatch** — Server `allowedValues` had `'in-progress'` (hyphen) and `'review'`, but frontend/DB uses `'in_progress'` (underscore) and `'cancelled'`. Fixed to match frontend `TASK_STATUS_CONFIG`.
3. **Lead status update failing** — Server `validStatuses` array was missing `'pending'`; frontend `LEAD_STATUS_CONFIG` includes it.
4. **Project status values mismatch** — Both `projectCreate` and `projectUpdate` schemas had `'lead'` (nonexistent) and were missing `'in-progress'` and `'in-review'`. Fixed to match DB CHECK constraint.

### Files Modified

- `server/middleware/validation.ts` — task title required removed; task/project status `allowedValues` corrected
- `server/routes/admin/leads.ts` — added `'pending'` to `validStatuses`

---

## Completed - Portal Gap on Mobile (Root Fix)

**Status:** COMPLETE

### Issue

Gap not properly applied on mobile in portal dashboard layout.

### Root Cause

`.dashboard-content` used `display: block`, so spacing between its children (subtabs, route content) relied on margins. Flex `gap` only works in flex/grid containers, so gap was never applied at the content root.

### Fix (at root)

1. **`portal-layout.css`** — Changed `.portal .dashboard-content` from `display: block` to `display: flex; flex-direction: column; gap: var(--portal-section-gap)`. Gap is now the single source of truth for spacing between subtabs and route content on all viewports including mobile.

2. **`portal-tabs.css`** — Cancel `margin-bottom` on `.portal .dashboard-content .portal-subtabs` so the parent’s gap handles spacing (no double spacing).

### Files Modified

- `src/styles/shared/portal-layout.css`
- `src/styles/shared/portal-tabs.css`

---

## In Progress - Universal Dropdown Unification

**Status:** ACTIVE

### Completed

- [x] All native `<select>` elements converted to `FormDropdown` (admin + portal)
- [x] Radix Select in DeliverablesTab converted to `FormDropdown`
- [x] QuestionnaireForm hand-rolled select converted to `FormDropdown`
- [x] ContactsTab role dropdown: hide-selected-option filter + `form-dropdown-trigger` classes
- [x] ClientDetail status dropdown: `StatusBadge` + `status-dropdown-caret`
- [x] ProjectDetail status dropdown: `status-dropdown-caret` (was `dropdown-caret`)
- [x] Absolute caret positioning for ALL dropdown types (status, form, custom, table, modal, pagination)
- [x] `text-transform: none` universal rule for all dropdown triggers and items
- [x] Normalized value comparison in `FormDropdown` and `InlineSelect` (handles DB format mismatches)
- [x] Removed orphaned CSS: `.qform-select-*`, `.inline-select-trigger`
- [x] Design docs updated (DESIGN_SYSTEM.md, CSS_ARCHITECTURE.md)

### Remaining Outliers (native `<select>` not yet converted)

- [x] `admin/help/HelpCenter.tsx` — category filter
- [x] `admin/data-quality/ValidationErrorsTab.tsx` — error type filter
- [x] `admin/webhooks/WebhookFormModal.tsx` — HTTP method select
- [x] `admin/integrations/NotificationFormModal.tsx` — channel + event selects

### Pagination Page-Size Dropdown (Open State)

- [x] Divider line visible between menu and trigger when open — fixed with `margin-bottom: -1px` on menu
- [x] Menu item numbers don't align horizontally with trigger text — fixed `justify-content: flex-start`
- [x] Menu and trigger seamless piece — resolved by margin-bottom overlap approach
- [ ] Caret position — awaiting visual confirmation

---

## Completed - PDF Header Unification

**Status:** COMPLETE

- Extracted `drawPdfDocumentHeader()` into `server/utils/pdf-utils.ts` using invoice styling as canonical reference
- All four PDF generators (invoice, proposal, receipt, contract) now call the shared header function — no duplication
- Unused `getPdfLogoBytes` imports removed from contracts and receipt-service

## Upcoming - PDF Deep Dive

**Status:** TODO

- [ ] Formatting review (contracts, proposals, invoices, intake, receipts, SOW) — spacing, table layouts, typography consistency
- [ ] SOW header — currently separate (`sowLogoHeight = 50`) — review if it should adopt the standard 100pt header or stay compact

## Completed - Messages View Overhaul

**Status:** COMPLETE

- [x] Sender name placement — moved under avatar (bottom of group) instead of above bubble
- [x] Typing indicator — removed inline style, added `.msgtab-typing-indicator` CSS class
- [x] Consistent styling — both views use shared factory; no divergence
- [x] Mobile responsiveness — 85% max-width for bubbles, compose hint hidden on small screens

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

---

## Archived Work

Previous work moved to: [ARCHIVED_WORK_2026-03.md](./docs/archive/ARCHIVED_WORK_2026-03.md)
