# Current Work - March 9, 2026

## Current System Status

**Last Updated**: March 9, 2026

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

## Remaining (Future Enhancements)

- [ ] Increase test coverage (~15% currently, target 70%)
- [ ] Docker setup for deployment
- [ ] RBAC (granular admin permissions beyond binary requireAdmin)

---

## Archived Work

Previous work moved to: [ARCHIVED_WORK_2026-03.md](./docs/archive/ARCHIVED_WORK_2026-03.md)
