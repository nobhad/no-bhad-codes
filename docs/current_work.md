# Current Work

**Last Updated:** March 2, 2026

This file tracks active development work and TODOs. Completed items are archived in `archive/ARCHIVED_WORK_2026-03.md`.

---

## Active TODOs

### Portal Architecture Consolidation - Phase 4 Cleanup

**Status:** BLOCKED - Awaiting User Testing

Phase 4 cleanup tasks remaining:

- [ ] Test new PortalShell architecture in browser
- [ ] Delete deprecated modules (after testing confirms PortalShell works)
- [ ] Remove old navigation configs
- [ ] Update tests
- [ ] Update documentation

**Note:** The deprecated modules (`admin-dashboard.ts`, `client-portal.ts`) are still actively imported in `modules-config.ts`. They cannot be deleted until the new PortalShell system is fully tested and confirmed working.

---

### Brutalist Design System - Pending User Testing

- [ ] Test React Overview on admin dashboard
- [ ] Verify brutalist styling applies correctly

**Feature Flag:**

- `localStorage.setItem('feature_react_overview', 'true')` - Enable React Overview
- `localStorage.setItem('feature_react_overview', 'false')` - Use vanilla fallback
- `?vanilla_overview=true` URL param - Force vanilla fallback

---

## Deferred Tasks (Lower Priority)

### Input Validation Hardening - Remaining Phases

**Started:** February 27, 2026

Phases 1-5 complete (auth, invoices, clients, uploads). Remaining phases are lower priority:

- [ ] Phase 6: Project routes (large file, many routes)
- [ ] Phase 7: Admin routes
- [ ] Phase 8: Message routes

**Note:** Pre-existing test failure in `email-service.test.ts` (nodemailer mock issue) - 9 tests failing, unrelated to validation changes.

---

### Backend Design Consistency Audit - Deferred Tasks

These tasks require substantial effort and are documented for future work:

- [ ] Split `proposals.ts` (2,118 lines) into modules: `core.ts`, `templates.ts`, `versions.ts`, `signatures.ts`, `pdf.ts`
- [ ] Split `messages.ts` (1,289 lines) into modules
- [ ] Implement input validation library (Zod)
- [ ] Standardize error handling pattern across all services
- [ ] Create response builder utility (deferred - api-response.ts already comprehensive)
- [ ] Standardize service singleton pattern (deferred - low priority)

---

### Large File Refactoring - Deferred

Identified in March 2026 audit. Large files that should be split:

| File | Lines | Priority |
|------|-------|----------|
| `admin-projects.ts` | 3,862 | Medium |
| `api.ts` (types) | 3,284 | Low |
| `admin-dashboard.ts` | 3,102 | Medium |
| `admin-proposals.ts` | 3,044 | Medium |
| `admin-workflows.ts` | 2,713 | Low |

---

### Remaining Type Safety Improvements - Deferred

45 `any` type instances remain, mostly in:

- Window extensions for dynamic global state
- State management with dynamic keys
- Third-party library integrations (GSAP)
- Service factories with flexible arguments

---

### Transitive Dependency Vulnerabilities - Monitoring

23 npm vulnerabilities remain in transitive dependencies:

- AWS SDK nested clients
- sqlite3 → node-gyp → tar
- Requires upstream fixes, not actionable locally

---

## Post-Task Documentation Checklist

- [ ] Update feature docs if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [x] Verify no markdown violations

---

## DO NOT REMOVE OR EDIT ANYTHING BELOW THIS LINE

### Design System Reference

- Design System: docs/design/DESIGN_SYSTEM.md

Key rules:

- NO EMOJIS - Use Lucide icons only
- NEVER hardcode colors - use CSS variables
- Use `createPortalModal()` for modals
- Complex animations use GSAP, not CSS animations
