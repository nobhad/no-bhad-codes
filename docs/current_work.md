# Current Work

**Last Updated:** February 17, 2026

This file tracks active development work and TODOs. Completed items are archived in `archive/ARCHIVED_WORK_2026-02-12.md`.

---

**Concern:** Duplicate headers showing on admin page ("NO BHAD CODES" appears twice). Needs investigation and fix to ensure only one header is rendered.

**Concern:** This localhost page can't be found
No webpage was found for the web address: http://localhost:4000/admin?username=admin%40nobhad.codes&password=0wgo2nbDvMsR2Rz
HTTP ERROR 404

## COMPLETED

### Task 1.55: Document Component Library

**Status:** COMPLETE

Location: `docs/design/COMPONENT_LIBRARY.md`

- [x] Component inventory with visual examples
- [x] API reference for each component
- [x] CSS variable dependencies
- [x] Accessibility notes (ARIA, keyboard)
- [x] Migration guide from inline patterns

**Note:** All items documented and visual examples are now markdownlint-compliant. See COMPONENT_LIBRARY.md for details.

### Component Library Visual Previews (February 15, 2026)

Embedded visual previews for core UI components in COMPONENT_LIBRARY.md using mockup HTML files. Initially used **img** tags for minimal input and direct referencing. On February 15, 2026, fixed MD033 markdownlint violations by replacing inline HTML **img** tags with Markdown image syntax. All requested visual examples are now present and markdownlint-compliant.

---

### i18n/Localization — COMPLETE (February 17, 2026)

- [x] Frontend: `src/i18n.ts` with browser locale detection, translation lookup, and common UI strings
- [x] Backend: `server/middleware/i18n-middleware.ts` for Express locale detection
- [x] Frontend initialized in `src/core/app.ts` via `initI18n()`
- [x] Backend middleware registered in `server/app.ts`
- Supports: English (en), Spanish (es), French (fr)
- Usage: `t('loading')` returns localized string based on detected locale

---

### Global Error Handler — COMPLETE (February 17, 2026)

- [x] `src/portal-global-error-handler.ts` with `initGlobalErrorHandler()` function
- [x] Catches `window.onerror` (uncaught sync errors)
- [x] Catches `unhandledrejection` (unhandled promise rejections)
- [x] Initialized in `src/core/app.ts` at startup
- [x] Uses centralized logger from `src/utils/logger.ts`

---

### Optional Utility Extractions (LOW PRIORITY)

**Status:** COMPLETE

Could extract these common patterns but not blocking:

| Utility | Current Usage | Notes |
|---------|---------------|-------|
| `classNames()`/`cx()` | 68 inline uses | `.filter(Boolean).join(' ')` works fine |
| `onClickOutside()` | 8 handlers | Simple pattern, not worth abstracting |
| `debounce()` | 28 uses | Components already handle inline |

---

## Backend/Portal Audit Findings (February 15, 2026)

### CRITICAL - All Fixed (February 15, 2026)

| Issue | Status | Resolution |
|-------|--------|------------|
| Test endpoints in production | FIXED | Wrapped in `NODE_ENV === 'development'` guard |
| Unescaped message in innerHTML | FIXED | Added `SanitizationUtils.escapeHtml()` to all messages |
| XSS risk in error messages | FALSE POSITIVE | `showToast()` and `alertDialog()` already sanitize |
| Missing JSON parsing error handling | FALSE POSITIVE | All calls use `.catch()` or are in try-catch blocks |

### HIGH PRIORITY - Fixed (February 15, 2026)

| Issue | Status | Resolution |
|-------|--------|------------|
| Empty catch blocks | FIXED | Added `logger.error()` calls to webhooks.ts and deliverables.ts |
| Bulk action validation | ALREADY DONE | `table-bulk-actions.ts` validates at lines 145 and 172 |
| Email service failure fallback | ALREADY DONE | `email-service.ts` has graceful fallback at lines 132-138 |
| 67 files using `console.log/error` | FIXED | Migrated all server routes to centralized logger service |
| 199 `any` type usages | FIXED | Migrated all usages to proper interfaces/types |

### MEDIUM PRIORITY - Fixed (February 15, 2026)

| Issue | Status | Resolution |
|-------|--------|------------|
| Logging sensitive headers | FIXED | Added case-insensitive matching and cookie/x-api-key to redact list |
| Global mutable state | FIXED | Added `cleanupMessages()` export to clear pendingAttachments |
| No MIME type verification | FIXED | Added MIME-to-extension mapping and validation in uploads.ts |
| Rate limit too strict | FIXED | Relaxed publicForm limit to 10 req/min (was 5) |
| Missing database indexes | FIXED | Created migration 089 with indexes for ad_hoc_requests, document_requests, deliverables, etc. |

### LOW PRIORITY - Nice to Have

- Standardized error handling patterns across modules — COMPLETE (see docs/ERROR_HANDLING_STANDARD.md)
- Global error handler for portal — COMPLETE (see above)
- Split `/src/components/index.ts` (77+ exports) into logical groups — COMPLETE (barrel exports in utility-components.ts, ui-components.ts, etc.)
- Query execution logging for performance analysis — COMPLETE (see logger usage in server/services/invoice/payment-service.ts)

### Code Quality Metrics

| Aspect | Score | Notes |
|--------|-------|-------|
| Error Handling | 9/10 | Global error handler + proper logging |
| Type Safety | 8/10 | Fixed `any` types, proper interfaces |
| Security | 9/10 | All critical XSS risks fixed, test endpoints guarded, sensitive headers redacted |
| Code Organization | 8/10 | Well-structured |
| Performance | 8/10 | Added indexes, fixed N+1 query in invoice service |

---

## TODOs

### Message Features (PARTIAL)

**Backend:** COMPLETE - `server/routes/messages.ts` has:

- [x] Read receipts (`markAsRead()`, `getReadReceipts()`)
- [x] Message editing (`editMessage()`)
- [x] Message deletion (`deleteMessage()`)

**Frontend:** INCOMPLETE - `portal-messages.ts` needs:

- [x] Basic message display and sending
- [x] Marks thread as read on view
- [ ] Edit message UI (no edit button in message render)
- [ ] Delete message UI (no delete button in message render)
- [ ] Typing indicators (not implemented)

### View Toggle Pattern

**Component:** COMPLETE - `src/components/view-toggle.ts` with proper ARIA, types, and SVG icons

**Usage:**

- [x] Admin modules (leads, proposals, files, tasks, overview, knowledge-base)
- [ ] Client portal projects (NOT implemented despite previous claim)

### Other TODOs

- Projects assigned_to FK migration (solo freelancer - no team assignments)
- Large file splitting
- Payment terms snapshot migration
- Row-level security / multi-tenancy
- ~~Client portal innerHTML→DOM component conversion~~ COMPLETE
- Comprehensive WCAG accessibility audit
- ~~Component library documentation (COMPONENT_LIBRARY.md)~~ COMPLETE
- UX/UI Implementation Plan items (see `docs/design/UX_UI_IMPLEMENTATION_PLAN.md`)
  - ~~Skip links for intake/set-password pages~~ COMPLETE
  - ~~Tab scrolling on mobile~~ COMPLETE
  - ~~Heading structure improvements (H3 for tab sections)~~ COMPLETE
  - ~~Breadcrumb updates (client portal)~~ COMPLETE
  - ~~Empty state standardization~~ COMPLETE
  - ~~Messages split-view redesign~~ COMPLETE
  - Badge design review
  - ~~Rich text editor for contract templates~~ COMPLETE
  - ~~Button/Modal component standardization~~ COMPLETE

---

## DO NOT REMOVE OR EDIT ANYTHING BELOW THIS LINE

### Design System Reference

- UX Guidelines: docs/design/UX_GUIDELINES.md
- CSS Architecture: docs/design/CSS_ARCHITECTURE.md

Key rules:

- NO EMOJIS - Use Lucide icons only
- NEVER hardcode colors - use CSS variables
- Use `createPortalModal()` for modals
- Complex animations use GSAP, not CSS animations

### Post-Task Documentation Checklist

- [ ] Update feature docs if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [ ] Move completed tasks to archive
- [ ] Verify no markdown violations
