# Current Work

**Last Updated:** February 20, 2026

This file tracks active development work and TODOs. Completed items are archived in `archive/ARCHIVED_WORK_2026-02.md`.

---

## Active TODOs

### CSS DRY Reduction - ONGOING

Reduced CSS codebase using utility classes and consolidation patterns.

**Current Status:**

- Total CSS: ~51,719 lines (src/styles: 50,109 + src/design-system: 1,610)
- Created `src/styles/base/utilities.css` with atomic utility classes
- Consolidated portal-tables.css using `:is()` selector (886→652 lines)
- Migrated 39+ pure utility patterns to utility classes
- Documented two-tier utility system in CSS_ARCHITECTURE.md

**February 20, 2026 Consolidation:**

- [x] Unified stat-card/content-card patterns (portal-cards.css)
- [x] Consolidated empty-message italic rule (loading.css)
- [x] Replaced hardcoded border-radius with CSS variables (design-review.css, deliverables.css)
- [x] Replaced hardcoded colors with semantic tokens (deliverables.css, design-review.css)
- [x] Consolidated .tab-content base rule (portal-tabs.css)
- [x] Removed duplicate annotation tool styles from design-review.css
- [x] Removed duplicate utility classes (.sr-only, .truncate-text)

**Icon Styling Unification (Feb 20):**

- [x] Consolidated .icon-btn definitions to portal-buttons.css (82 lines removed)
- [x] Removed stat-icon background colors from tasks.css (transparent icons)
- [x] Removed duplicate .stat-card-icon from overview-layout.css
- [x] Removed duplicate .panel-icon from overview-layout.css

**Design System Token Cleanup:**

- [x] Removed duplicate utilities from design-system/index.css (502 lines)
- [x] Removed orphaned utilities from breakpoints.css (421 lines)
- [x] Removed orphaned utilities from animations.css (219 lines)
- [x] Removed orphaned utilities from spacing.css (394 lines)
- [x] Removed orphaned utilities from typography.css (128 lines)
- [x] Removed orphaned utilities from z-index.css (128 lines)
- [x] Removed orphaned utilities from shadows.css (120 lines)
- [x] Removed orphaned utilities from borders.css (141 lines)

**Keyframe Consolidation:**

- [x] Consolidated duplicate @keyframes spin definitions (84 lines across 4 files)
- [x] Consolidated loading-spin → spin in loading.css
- [x] Consolidated cp-spin → spin in questionnaires.css

**Component Pattern Consolidation:**

- [x] Created shared .toggle-group/.toggle-btn in portal-buttons.css
- [x] Consolidated .kpi-card with .stat-card pattern in portal-cards.css
- [x] Consolidated list-item patterns (.history-request-item, etc.) in portal-cards.css
- [x] Created modal scroll utilities (.modal-scroll-sm/md/lg) in modal-system.css
- [x] Moved badge patterns (.system-badge, .category-badge) to portal-badges.css
- [x] Consolidated .tier-select-btn/.maintenance-select-btn in proposal-builder.css

**Previous Cleanup:**

- [x] Removed orphaned channel-loading code (113 lines)
- [x] Removed orphaned grid/position/overflow utilities (258 lines)
- [x] Removed orphaned semantic utilities (46 lines)

### Linear Admin Portal Redesign - COMPLETE

All phases of the Linear-inspired admin portal redesign are complete:

- [x] Phase 1: Foundation (command palette, keyboard shortcuts, sidebar nav)
- [x] Phase 2: Tables (compact rows, hover actions, J/K nav, inline editing)
- [x] Phase 3: Detail Views (keyboard nav, inline editing for key fields)
- [x] Phase 4: Polish (performance audit, skeleton loading infrastructure)

### Future Considerations (Low Priority)

- Animation refinement (24 CSS keyframes exist, most are simple/appropriate)
- Modal consolidation (current UX works well)
- Comprehensive WCAG accessibility audit
- Bundle optimization via `manualChunks` (642KB dashboard chunk is acceptable)

---

## Post-Task Documentation Checklist

- [ ] Update feature docs if API/features changed
- [ ] Update API_DOCUMENTATION.md if endpoints changed
- [x] Verify no markdown violations

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
