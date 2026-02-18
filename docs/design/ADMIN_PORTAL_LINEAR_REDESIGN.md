# Admin Portal Redesign: Linear-Inspired

**Goal:** Transform the admin portal to match Linear's design philosophy - fast, keyboard-driven, minimal, opinionated.

**Status:** Complete

**Last Updated:** 2026-02-17

---

## Implementation Status Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Foundation | Complete | 100% |
| Phase 2: Tables | Complete | 100% |
| Phase 3: Detail Views | Complete | 100% |
| Phase 4: Polish | Complete | 100% |

---

## Linear's Core Design Principles

### 1. Keyboard-First Everything ✅ IMPLEMENTED

| Action | Linear Shortcut | Our Implementation | Status |
|--------|----------------|-------------------|--------|
| Command palette | `⌘K` | `⌘K` opens palette | ✅ |
| New item | `C` | Via ⌘K palette | ✅ |
| Search | `⌘/` or `/` | Via ⌘K palette | ✅ |
| Navigate up/down | `↑↓` or `J/K` | `J/K` in tables, `↑↓` in palette | ✅ |
| Open item | `Enter` | Opens selected row/item | ✅ |
| Go back | `Escape` | Closes palette/modal | ✅ |
| Tab navigation | `1-9` | Sidebar shortcuts | ✅ |
| Close modal | `Escape` | All modals | ✅ |
| Select row | `X` or `Space` | Toggle selection | ✅ |
| Bulk select | `Shift+Click` | Range selection | ✅ |

### 2. Command Palette (⌘K) ✅ IMPLEMENTED

Features implemented:
- [x] Navigate to any section (Dashboard, Clients, Projects, etc.)
- [x] Search across entities
- [x] Quick actions (Create client, New invoice, etc.)
- [x] Keyboard navigation within palette
- [x] Section grouping (Recent, Actions, Navigation)

### 3. Minimal, Focused UI ✅ MOSTLY COMPLETE

| Issue | Status |
|-------|--------|
| Too many nested containers | Improved |
| Inconsistent card shadows | Fixed - all shadows removed |
| Dense tables without breathing room | Fixed - compact but readable |
| Multiple action buttons competing | Fixed - hover-reveal pattern |

### 4. Opinionated Workflows ✅ IMPLEMENTED

- [x] Default statuses that make sense
- [x] Clear flow: Lead → Client → Project → Invoice
- [x] Status badges consistent across views

### 5. Performance as a Feature ✅ COMPLETE

| Target | Status |
|--------|--------|
| < 100ms UI interactions | ✅ Achieved |
| Optimistic updates | ✅ Inline editing |
| Lightweight CSS | ✅ No shadows |
| Fast navigation | ✅ Keyboard shortcuts |

---

## Page-by-Page Status

### Sidebar Navigation ✅ COMPLETE

- [x] Collapsible to icons only
- [x] Keyboard shortcuts (1-8 keys)
- [x] Subtle hover states
- [x] Active state: left accent bar
- [x] Section dividers between groups
- [x] Mobile drawer with overlay
- [x] Tooltips on hover when collapsed

### Dashboard ✅ COMPLETE

- [x] Compact stats row (horizontal layout)
- [x] Upcoming tasks section
- [x] Recent activity feed
- [x] Quick actions via ⌘K palette
- [x] No shadows on stat cards

### Tables ✅ COMPLETE

All tables (Clients, Projects, Invoices, Leads, Contracts):
- [x] Minimal borders (row dividers only)
- [x] Compact rows with good typography
- [x] Hover actions (action buttons appear on hover)
- [x] Keyboard navigation (J/K, Enter, X/Space)
- [x] Bulk select with Shift+Click
- [x] Inline editing for editable fields

### Detail Views ✅ COMPLETE

- [x] Secondary sidebar for section navigation
- [x] Consistent header layout
- [x] Inline editing for key fields
- [x] Modals streamlined

### Modals ✅ COMPLETE

- [x] Centered, focused design
- [x] Keyboard-dismissible (Escape)
- [x] No nested modals
- [x] Single column form layout
- [x] Unified modal system CSS

---

## CSS Implementation

### Shadows ✅ COMPLETE

```css
/* All shadows removed from admin backend */
[data-page="admin"] {
  --shadow-panel: none;
  --shadow-card: none;
  --shadow-card-rest: none;
  --shadow-nav: none;
  --shadow-elevated-sm: none;
  --shadow-elevated-md: none;
  --shadow-elevated-lg: none;
  --shadow-sidebar: none;
  --shadow-lg: none;
  --shadow-md: none;
  --shadow-modal: none;
}
```

### Typography ✅ COMPLETE

```css
/* System font for UI elements, Acme for branding only */
[data-page="admin"] #admin-page-title,
[data-page="admin"] .stat-label {
  font-family: var(--font-family-sans);
}
```

### Spacing ✅ IMPLEMENTED

- Compact table rows
- Tighter card padding
- Consistent gap values

---

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE

- [x] Command palette component (⌘K)
- [x] Global keyboard shortcuts
- [x] Sidebar shortcuts (1-8 keys)
- [x] Keyboard navigation module
- [x] Focused/selected row styles

### Phase 2: Tables ✅ COMPLETE

- [x] Redesigned table component
- [x] Hover-reveal action buttons
- [x] J/K navigation all tables
- [x] Bulk selection
- [x] Inline editing component

### Phase 3: Detail Views ✅ COMPLETE

- [x] Secondary sidebar navigation
- [x] Consistent header layout
- [x] Inline editing for key fields
- [x] Keyboard shortcuts for actions

### Phase 4: Polish ✅ COMPLETE

- [x] Remove all shadows
- [x] System font for UI
- [x] Compact stat cards
- [x] Mobile sidebar drawer
- [x] Skeleton loading states (in loading.css)
- [x] Keyboard shortcut help panel (`?` to show)

---

## Files Modified

### CSS Files

| File | Changes |
|------|---------|
| `src/styles/pages/admin.css` | Shadow removal, typography |
| `src/styles/shared/portal-cards.css` | Stat label font |
| `src/styles/shared/portal-layout.css` | Global header shadow |
| `src/styles/client-portal/layout.css` | Page header shadow |
| `src/styles/admin/index.css` | Layout imports |
| `src/styles/admin/keyboard-help.css` | Help panel styles |
| `src/styles/admin/sidebar-refinements.css` | Mobile drawer, tooltips |
| `src/styles/admin/page-header-refinements.css` | Header tabs |
| `src/styles/admin/overview-layout.css` | Dashboard grid |

### TypeScript Files

| File | Changes |
|------|---------|
| `src/features/admin/admin-dashboard.ts` | Keyboard nav, mobile drawer, help panel init |
| `src/modules/ui/keyboard-navigation.ts` | J/K navigation |
| `src/components/command-palette.ts` | ⌘K palette |
| `src/components/keyboard-help.ts` | `?` shortcut help panel |

---

## Design Decisions

1. **No shadows** - Flat design, depth via background color differences
2. **System font for UI** - Acme for branding, system-ui for readability
3. **Red accents** - Primary color for active states, not backgrounds
4. **Compact layouts** - Information density over whitespace
5. **Keyboard-first** - Every action reachable without mouse

---

## References

- [Linear UI Redesign Blog](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Linear Keyboard Shortcuts](https://linear.app/docs/keyboard-shortcuts)
- [Invisible Details - Linear Design](https://medium.com/linear-app/invisible-details-2ca718b41a44)
