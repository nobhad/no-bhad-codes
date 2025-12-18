# Current Work - December 17, 2025

---

## Comprehensive Code Review - December 17, 2025

### Summary

Full codebase review completed across all TypeScript and CSS files.

### Critical Issues Found

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| `src/modules/navigation.ts` | 15+ console.log calls, untracked event listeners | CRITICAL | FIXED |
| `src/modules/intro-animation.ts` | 400+ lines, hardcoded SVG paths | CRITICAL | Pending |
| `src/services/code-protection-service.ts` | Event listener cleanup will fail, memory leaks | CRITICAL | FIXED |
| `src/features/admin/admin-security.ts` | localStorage for auth data, bypassable devtools detection | CRITICAL | FIXED (all modules migrated to HttpOnly cookies) |

### Files Needing Attention

| File | Issue | Lines |
|------|-------|-------|
| `src/core/app.ts` | Exceeds size guidelines, hardcoded values | 992 |
| `src/core/state.ts` | Large file, complex state management | 788 |
| `src/services/visitor-tracking.ts` | Large file | 730 |
| `src/features/admin/admin-dashboard.ts` | Type duplication, mixed concerns | 600+ |
| `src/features/admin/admin-performance.ts` | Hardcoded thresholds, excessive type casting | 393 |
| `src/features/admin/admin-projects.ts` | Extensive `any` type usage | 150+ |

### CSS Architecture Review

**Status**: Token system is excellent, usage is inconsistent

**Issues**:

- Hardcoded colors in `form.css`, `contact.css` despite token availability
- `navigation.css` at 900+ lines needs splitting
- `form.css` at 374 lines handles too many concerns
- Legacy variable system (`--fg`, `--bg`) still in active use alongside new tokens

### Server Code Review

**Status**: Excellent - production-ready with minor cleanup needed

### Recommendations

1. **Short-term**: Split intro-animation.ts into smaller modules
2. **Short-term**: Migrate hardcoded CSS values to tokens

---

## Assets to Add

### paw.svg

Red paw print SVG icon - needs to be added to project assets.

**Note:** Contains hardcoded color `#d11818` - should be updated to use CSS variable or `currentColor` for theme compatibility.

---

## Concerns

- [ ] Intro animation not displaying with coyote paw
- [ ] **Loop-trigger-zone awkward space** - Plan: Add decorative content (pattern, gradient, or brand element) to fill the 100vh gap

---

## TODOs

### Critical

- [ ] Refactor `intro-animation.ts` - extract hardcoded SVG paths to config

### Features

- [ ] Add animated section between about and contact to balance spacing

### Code Quality

- [ ] Split `app.ts` (992 lines) into smaller modules
- [ ] Split `state.ts` (788 lines) into domain-specific state managers

### Feature Organization

- [ ] Make `TerminalIntakeModule` extend `BaseModule` (currently breaks pattern)
- [ ] Organize 14 flat modules into subdirectories by concern (UI, animation, utilities)
- [ ] Document cross-feature dependencies

### CSS Cleanup

- [ ] Split `navigation.css` (900+ lines) into nav-base, nav-animations, nav-mobile
- [ ] Split `form.css` (374 lines) into form-fields, form-buttons, form-validation
- [ ] Remove legacy `--fg`, `--bg` variables - migrate to semantic tokens

---

## Active Work

### GSAP MorphSVG Intro Animation - IN PROGRESS

**Status**: In Progress
**Date**: December 15, 2025
**Branch**: `feature/intro-animation-svgs`

**Summary**: Implementing a paw print morph animation for the intro sequence using GSAP MorphSVG plugin.

**SVG Assets** (saved in `public/images/`):

| File | ViewBox | Contains |
|------|---------|----------|
| `intro_paw_1.svg` | 0 0 1969.78 1562.3 | Card group + paw1 path |
| `intro_paw_2.svg` | 0 0 1969.86 1204.74 | Card group + Paw2 path |

**Implementation Plan**:

1. Create Intro Overlay Container
2. Load GSAP MorphSVG Plugin
3. Morph Animation Sequence (paw1 → paw2)
4. Alignment Strategy (overlay real card)
5. Cleanup and handoff to card flip

**Dependencies**: GSAP MorphSVG plugin (premium)

---

### Client Portal Auth Container - IN PROGRESS

**Status**: In Progress
**Date**: December 9, 2025

**Summary**: Restructured client portal login page with unified auth container design.

**Known Issues**:

| Issue | Priority | Notes |
|-------|----------|-------|
| VH calculations not accounting for footer | Medium | Client portal layout uses VH but doesn't subtract footer height properly |

---

### Mobile Intro Animation - Card Flip - IN PROGRESS

**Goal**: On mobile, the business card should show back first, then flip to front.

**Implementation**: Complete - card flips from back to front on mobile, header visible immediately.

---

### Desktop Card Alignment - KNOWN ISSUE

**Status**: Known Issue (DO NOT FIX YET)

**Concern**: Card alignment is off on desktop during intro animation.

**Notes**: Focus is on mobile fixes first. Will address desktop alignment after mobile is working.

---

### Mobile Navigation Styling - IN PROGRESS

**Status**: Fixes applied, awaiting verification.

**Files Modified**: `src/styles/components/navigation.css`

---

## System Status

**Last Updated**: December 17, 2025

### Build Status

- **TypeScript**: 0 errors
- **ESLint**: 0 errors
- **Tests**: 259 passing (all tests pass)
- **Build**: Success

### Codebase Health

| Metric | Value | Status |
|--------|-------|--------|
| Critical Issues | 1 | intro-animation.ts pending |
| Files Needing Attention | 6 | Large files / code quality |
| CSS Token Usage | Inconsistent | Hardcoded values remain |
| Server Code | Excellent | Production-ready |
| Lint Warnings | 0 | Clean |
| TypeScript Errors | 0 | Clean |

### Development Server

Run `npm run dev:full` to start both frontend and backend

**Development URLs:**

- Frontend: http://localhost:4000
- Backend API: http://localhost:4001
- API Docs: http://localhost:4001/api-docs

---

## Known Issues

### DataService Portfolio Load Error

**Status**: Known

**Issue**: Console error when loading main page - DataService trying to fetch JSON from URL that returns HTML.

**Next Steps**:

- [ ] Verify the portfolio JSON endpoint exists on the server
- [ ] Add proper 404 handling to return JSON error responses
- [ ] Add fallback data in DataService when fetch fails

---

### Intake Form Text Size

**Status**: Known

**Issue**: Text in the terminal intake form is too small for older users.

**Next Steps**:

- [ ] Increase base font size for intake form inputs and labels
- [ ] Ensure minimum 16px font size on mobile (prevents iOS zoom)

---

### Terminal Intake Close Button

**Status**: Known

**Issue**: Close button should use the design from the mockup and be positioned on the LEFT side.

**Next Steps**:

- [ ] Move close button from right to left side
- [ ] Update button styling to match design mockup

---

### Terminal Intake SVG Animation

**Status**: Known

**Issue**: The SVG should animate line-by-line (typewriter style) instead of appearing all at once.

**Next Steps**:

- [ ] Implement line-by-line reveal animation for terminal SVG
- [ ] Use GSAP for animation timing

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `src/features/client/client-portal.ts` | Main client portal module (~2,381 lines) |
| `src/features/client/terminal-intake.ts` | Terminal intake main module (~1,446 lines) |
| `src/features/admin/admin-dashboard.ts` | Admin dashboard module (~3,032 lines) |
| `src/services/visitor-tracking.ts` | Client-side visitor tracking (~760 lines) |
| `server/routes/analytics.ts` | Analytics API endpoints (~655 lines) |

### Development Commands

```bash
# Start full development environment
npm run dev:full

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run tests
npm run test:run

# Build for production
npm run build
```

---

## Archived Work

Previous work has been completed and verified. See [ARCHIVED_WORK_2025-12.md](./ARCHIVED_WORK_2025-12.md) for details.
