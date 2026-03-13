# Current Work - March 13, 2026

## Current System Status

**Last Updated**: March 13, 2026

### Server

- **Command**: `npm run dev:full`
- **Local**: `http://localhost:3000`

### Build

- TypeScript: 0 errors
- ESLint: 0 errors, 0 warnings
- Vite build: passing (156 chunks)

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
- [x] `admin/help/HelpCenter.tsx` — category filter
- [x] `admin/data-quality/ValidationErrorsTab.tsx` — error type filter
- [x] `admin/webhooks/WebhookFormModal.tsx` — HTTP method select
- [x] `admin/integrations/NotificationFormModal.tsx` — channel + event selects
- [x] Pagination page-size dropdown open state fixes (divider, alignment, seamless trigger)

### Remaining

- [ ] Caret position — awaiting visual confirmation

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

---

## Archived Work

Previous work moved to: [ARCHIVED_WORK_2026-03.md](./docs/archive/work-logs/ARCHIVED_WORK_2026-03.md)
