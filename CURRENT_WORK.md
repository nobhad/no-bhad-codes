# Current Work - March 8, 2026

## Current System Status

**Last Updated**: March 8, 2026

### Server

- **Command**: `npm run dev:full`
- **Local**: `http://localhost:3000`

### Build

- TypeScript: 0 errors
- Vite build: passing (13.6s, 156 chunks)

---

## Completed - Full Portal Audit Fix

**Status:** 41/41 items COMPLETE
**Reference:** [FULL_PORTAL_AUDIT.md](./docs/FULL_PORTAL_AUDIT.md)

### Wave 1-4 (30 Priority Items) - ALL COMPLETE

- [x] CSRF timing-safe comparison
- [x] Hardcoded admin email removed
- [x] URL scheme validation in links
- [x] Rate limiter middleware ordering
- [x] Prettier/ESLint config alignment
- [x] `buildAuthHeaders` shared utility (92 duplicates eliminated)
- [x] AbortController in all fetch hooks
- [x] `useFormState<T>` generic hook
- [x] Dead code removal (modules, stores, components)
- [x] Visitor tracking event listener cleanup
- [x] Named constants (health scores, time, keyboard keys, GSAP staggers)
- [x] Centralized `getBaseUrl()`/`getPortalUrl()` helpers
- [x] Deep import conversion (73 files to `@/` aliases)
- [x] Format utilities consolidation
- [x] Route error boundary + per-tab error isolation
- [x] OverviewTab split (633 to 84 lines + 4 sub-components)
- [x] TasksTab split (495 to 160 lines + 2 sub-components)
- [x] Portal API fetch standardization
- [x] Filter config deduplication
- [x] CSS `!important` removal (4 from shared files)
- [x] CSS duplicate class resolution
- [x] CSS hardcoded color replacements
- [x] CSS Architecture doc rewrite
- [x] Legacy `.eslintrc.json` removed
- [x] Unused UI component re-exports removed
- [x] `npm audit fix` (3/10 fixed, 7 are sqlite3 transitive deps)
- [x] Unused packages removed (quill, handlebars)
- [x] Hardcoded keyboard keys replaced with KEYS constants
- [x] Route validation schemas (30 to 87 validated handlers)
- [x] Dead database tables (migration pending)

### Wave 5 - COMPLETE

- [x] `useClientDetail.ts` split (707 to ~80 + 4 sub-hooks)
- [x] `useProjectDetail.ts` split (579 to ~120 + 5 sub-hooks)
- [x] `portal-components.css` split (1,794 to 51 barrel + 8 modules)
- [x] Stripe webhook idempotency (in-memory event map + 24h TTL)
- [x] Email retry queue (3 retries, exponential backoff, wired to scheduler)

### Wave 6 - COMPLETE

- [x] Route validation schemas added to 10 route files
- [x] Structured JSON logging (production JSON, dev text)
- [x] Token rotation on refresh (silent rotation at 50% lifetime)

### Wave 7 - COMPLETE

- [x] Remove unnecessary `!important` declarations (33 removed, 85 justified remaining)
- [x] Email verification flow (migration 095, token generation, verify/resend endpoints)
- [x] 2FA support (TOTP, migration 096, setup/verify/login/disable/status endpoints)
- [x] Dead database table cleanup (migration 097, 10 unused tables dropped)

---

## Files Modified (Audit Waves 1-6)

### Server

- `server/middleware/security.ts` - CSRF timing-safe fix
- `server/middleware/auth.ts` - Token rotation
- `server/middleware/logger.ts` - Structured logging
- `server/services/logger.ts` - JSON format support
- `server/services/email-service.ts` - Retry queue
- `server/services/scheduler-service.ts` - Email retry integration
- `server/services/integrations/stripe-service.ts` - Webhook idempotency
- `server/config/environment.ts` - URL helpers + LOG_FORMAT
- `server/config/constants.ts` - Stripe idempotency constants
- `server/utils/auth-constants.ts` - Token rotation constants
- `server/app.ts` - Rate limiter ordering
- `server/routes/` - 10 files with validation schemas
- `server/views/partials/auth-gate.ejs` - Removed hardcoded email
- `server/views/partials/table/cells/link.ejs` - URL validation

### React Hooks

- `src/react/hooks/useClientDetail.ts` - Thin orchestrator (was 707 lines)
- `src/react/hooks/client-detail/` - 4 sub-hooks + types + barrel
- `src/react/hooks/useProjectDetail.ts` - Thin orchestrator (was 579 lines)
- `src/react/hooks/project-detail/` - 5 sub-hooks + types + barrel
- `src/react/hooks/useFormState.ts` - New generic form state hook
- `src/react/hooks/useClients.ts` - buildAuthHeaders + AbortController
- `src/react/hooks/useProjects.ts` - buildAuthHeaders + AbortController
- `src/react/hooks/useInvoices.ts` - buildAuthHeaders + AbortController
- `src/react/hooks/useLeads.ts` - buildAuthHeaders + AbortController

### React Components

- `src/react/features/admin/project-detail/tabs/OverviewTab.tsx` - Orchestrator
- `src/react/features/admin/project-detail/tabs/overview/` - 4 sub-components
- `src/react/features/admin/project-detail/tabs/TasksTab.tsx` - Orchestrator
- `src/react/features/admin/project-detail/tabs/tasks/` - 2 sub-components
- `src/react/features/admin/client-detail/tabs/ContactsTab.tsx` - useFormState
- `src/react/features/admin/client-detail/tabs/NotesTab.tsx` - useFormState
- `src/react/components/portal/RouteErrorBoundary.tsx` - New
- `src/react/app/PortalLayout.tsx` - Error boundary wrapper
- `src/react/app/LazyTabRoute.tsx` - Per-tab error boundary

### CSS

- `src/styles/shared/portal-components.css` - Barrel file (was 1,794 lines)
- `src/styles/shared/portal-utilities.css` - New (427 lines)
- `src/styles/shared/portal-copy-email.css` - New (71 lines)
- `src/styles/shared/portal-error-states.css` - New (151 lines)
- `src/styles/shared/portal-react-components.css` - New (90 lines)
- `src/styles/shared/portal-status-panel.css` - New (198 lines)
- `src/styles/shared/portal-performance.css` - New (163 lines)
- `src/styles/shared/portal-analytics.css` - New (164 lines)
- `src/styles/shared/portal-tab-components.css` - New (574 lines)
- `src/styles/bundles/portal.css` - Hardcoded color fixes
- `src/styles/bundles/admin.css` - Hardcoded color fixes
- `src/styles/admin/detail-header.css` - Removed !important

### Utilities and Constants

- `src/utils/api-client.ts` - `buildAuthHeaders()` shared utility
- `src/utils/format-utils.ts` - Consolidated formatting
- `src/constants/index.ts` - Updated exports
- `src/constants/keyboard.ts` - New KEYS constants
- `src/constants/thresholds.ts` - New named constants

### Documentation

- `docs/FULL_PORTAL_AUDIT.md` - Updated with fix status
- `docs/design/CSS_ARCHITECTURE.md` - Complete rewrite

---

## Archived Work

Previous work moved to: [ARCHIVED_WORK_2026-03.md](./docs/archive/ARCHIVED_WORK_2026-03.md)
