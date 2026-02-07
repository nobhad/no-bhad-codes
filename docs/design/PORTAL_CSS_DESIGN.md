# Portal CSS Design (Admin & Client Portal)

**Last Updated:** February 6, 2026

This document describes the **CSS design for the Admin and Client Portals only**. It is separate from the main marketing site. For overall CSS architecture and main-site styling, see [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md).

---

## Table of Contents

1. [Scope](#scope)
2. [Entry Points (Bundles)](#entry-points-bundles)
3. [Portal Theme Variables](#portal-theme-variables)
4. [Design Tokens Used by Portals](#design-tokens-used-by-portals)
5. [File Structure](#file-structure)
6. [Naming Conventions](#naming-conventions)
7. [Button Hierarchy](#button-hierarchy)
8. [Related Docs](#related-docs)

---

## Scope

**In scope (portal-only):**

- **Admin dashboard** — `admin/index.html`, served with `src/styles/bundles/admin.css`
- **Client portal** — `client/portal.html`, `client/set-password.html`, served with `src/styles/bundles/portal.css`

**Out of scope (main site):**

- Marketing pages (home, about, contact, projects)
- Main site typography, hero, footer, navigation marketing styles
- `src/styles/bundles/site.css` and main-site-specific tokens

Portals share a **dark UI** and a common set of `--portal-*` variables. They do **not** use the same visual system as the public site.

---

## Entry Points (Bundles)

|Bundle|Served On|Contents|
|--------|-----------|----------|
|`src/styles/bundles/admin.css`|Admin dashboard (`admin/index.html`)|Shared base + nav + admin pages + admin modules|
|`src/styles/bundles/portal.css`|Client portal (`client/portal.html`, set-password)|Shared base + nav-portal only + client-portal modules|

Both bundles:

1. Import **shared.css** (reset, design-system tokens, variables, base typography/layout, form components, loading, progress, toasts).
2. Use **cascade layers**: `reset`, `tokens`, `base`, `components`, then either `admin` or `portal`, then `utilities`.
3. Import **wireframe.css** for `data-wireframe="true"` greyscale mode.
4. Define a **skip-link** in the `utilities` layer.

**Admin-only:** full nav (`nav-base.css`, `nav-portal.css`), then `pages/admin.css` and `admin/index.css`.

**Portal-only:** `nav-portal.css` only, then `client-portal/index.css`.

---

## Portal Theme Variables

Portal-specific variables are defined in **`src/styles/variables.css`** inside:

```css
[data-page="client-portal"],
[data-page="admin"] { ... }
```

The HTML for admin and client portal pages must set `data-page="admin"` or `data-page="client-portal"` on `<body>` (or a wrapper) so these variables apply.

### Shared by both portals

|Category|Variables|
|----------|-----------|
|**Base overrides**|`--color-neutral-100` … `--color-neutral-400`, `--color-dark`, `--color-text-primary`, `--color-border`|
|**Portal text**|`--portal-text-light`, `--portal-text-secondary`, `--portal-text-muted`, `--portal-text-dark`|
|**Portal backgrounds**|`--portal-bg-darker`, `--portal-bg-dark`, `--portal-bg-medium`, `--portal-bg-light`, `--portal-bg-hover`, `--portal-bg-readonly`|
|**Portal borders**|`--portal-border-dark`, `--portal-border-medium`, `--portal-border-light`, `--portal-border`, `--portal-border-light-style`|
|**Border radius**|`--portal-radius-xs` (4px), `--portal-radius-sm` (6px), `--portal-radius-md` (8px), `--portal-radius-lg` (12px), `--portal-radius-pill` (50px); `--border-radius-card` → `--portal-radius-md`|
|**Spacing**|Use design-system tokens: `--space-0-5` (4px) … `--space-4` (32px) from `tokens/spacing.css`|
|**Labels**|`--label-font-size`, `--label-color`, `--label-font-weight`, `--label-text-transform`, `--label-letter-spacing`|

### Admin-only overrides

```css
[data-page="admin"] {
  --color-text-primary: var(--color-gray-100);
  --color-text-secondary: var(--color-gray-300);
  --portal-text-secondary: var(--color-gray-400);
}
```

Use **`--portal-*`** (and these overrides) for all portal UI so portal CSS stays independent from main-site tokens.

---

## Design Tokens Used by Portals

Portals load the full design system via `shared.css` → `design-system/index.css`. In portal styles, prefer:

- **Colors:** Portal theme variables above; for status/semantic use tokens from `src/design-system/tokens/colors.css` (e.g. `--color-success-500`, `--color-error-500`) where appropriate.
- **Shadows:** `var(--shadow-md)`, `var(--shadow-lg)` from `tokens/shadows.css` — avoid raw `box-shadow` values.
- **Spacing (fixed scale):** From `tokens/spacing.css` use `--space-0-5`, `--space-1`, `--space-1-5`, `--space-2`, `--space-3`, `--space-4`, etc. for the 8px-based scale. Portal-specific spacing vars have been migrated to these tokens.
- **Z-index:** `tokens/z-index.css` for modals, overlays, nav.

Overlay/backdrop tokens are defined **only** in `design-system/tokens/colors.css`; do not redefine them in `variables.css`.

---

## File Structure

### Client Portal (`src/styles/client-portal/`) — 12 files

|File|Purpose|
|------|---------|
|`index.css`|Orchestrator: shared portal CSS + base components + layout + views|
|`components.css`|`.portal-*` reusable components (cards, inputs, badges, stats, etc.)|
|`layout.css`|Dashboard layout, containers|
|`sidebar.css`|Sidebar navigation (shared with admin)|
|`login.css`|Login form|
|`dashboard.css`|Stats, activity, project cards|
|`documents.css`|Document requests|
|`files.css`|File upload/management|
|`help.css`|Help/knowledge base articles|
|`invoices.css`|Invoice display|
|`projects.css`|Project navigation, details|
|`settings.css`|Settings, account views|

### Admin (`src/styles/admin/`) — 21 files

|File|Purpose|
|------|---------|
|`index.css`|Orchestrator: shared portal CSS + client-portal layout/sidebar + admin modules|
|`analytics.css`|Analytics dashboard|
|`auth.css`|Admin authentication|
|`client-detail.css`|Client detail views|
|`detail-header.css`|Shared detail page headers|
|`document-requests.css`|Document requests management|
|`files.css`|Admin file management|
|`knowledge-base.css`|Knowledge base management|
|`leads-pipeline.css`|Leads pipeline|
|`modals.css`|Admin modals|
|`pd-contract.css`|Project detail: contract tab styles|
|`pd-invoices.css`|Project detail: invoices tab styles|
|`project-detail.css`|Project detail (including messaging UI)|
|`proposals.css`|Proposals|
|`sidebar-badges.css`|Sidebar notification badges|
|`table-dropdowns.css`|Inline table status dropdowns|
|`table-features.css`|Table row features (actions, selection)|
|`table-filters.css`|Table filter controls + sortable headers|
|`tasks.css`|Task list / project tasks|
|`tooltips.css`|CSS-only tooltips using data-tooltip|
|`workflows.css`|Approvals and triggers|

### Shared portal styles (`src/styles/shared/`) — 19 files

Used by both admin and client portal:

|File|Purpose|
|------|---------|
|`confirm-dialog.css`|Confirmation dialogs|
|`copy-email.css`|Copy email button component|
|`details-card.css`|Detail view card styles|
|`field-label-spacing.css`|Form field label spacing|
|`portal-badges.css`|Status badges|
|`portal-buttons.css`|Button hierarchy (sidebar link-style, primary, secondary, icon-only, destructive)|
|`portal-cards.css`|Card / stat card styles|
|`portal-components.css`|Extra shared components|
|`portal-dropdown.css`|Dropdown menus|
|`portal-files.css`|File upload components|
|`portal-forms.css`|Form styles|
|`portal-layout.css`|Portal layout utilities|
|`portal-messages.css`|Messaging UI|
|`portal-tabs.css`|Tabs|
|`progress.css`|Progress indicators|
|`search-bar.css`|Search bar component|
|`toast-notifications.css`|Toast notifications|
|`view-toggle.css`|View toggle (Kanban/List)|
|`wireframe.css`|Wireframe mode (greyscale)|

---

## Naming Conventions

- **Class prefix:** Use **`portal-`** for portal-only components (e.g. `.portal-card`, `.portal-btn`, `.portal-badge`) to avoid clashes with main site.
- **CSS variables:** Use **`--portal-*`** for portal-only tokens (text, background, border, radius, spacing) defined under `[data-page="client-portal"], [data-page="admin"]`.
- **Scoping:** For page-specific overrides, scope under `[data-page="admin"]` or `[data-page="client-portal"]` (e.g. in `pages/admin.css` or admin/portal modules).
- **Icons:** Use Lucide icons only; no emojis in UI (per project rules).

---

## Button Hierarchy

Defines where buttons should look different in the admin and client portals. Sidebar is link-style; content area uses clear hierarchy. **Implementation:** `src/styles/shared/portal-buttons.css`.

### 1. Sidebar navigation — link-style (no buttons)

**Where:** `.sidebar-buttons .btn`, `.sidebar-footer .btn-logout` (admin + client portal)

**Look:** No background, no shadow, no border. Icon + text (or icon-only when collapsed). Hover and active = primary color on text and icon. Same clean look in both expanded and collapsed states.

**Why:** Collapsed state was already minimal; expanded is now consistent so the sidebar reads as navigation links, not a stack of buttons.

**Implementation:** `portal-buttons.css` — "SIDEBAR NAV - LINK STYLE" and "LOGOUT BUTTON" sections.

### 2. Primary action — one per screen or section

**Where:** Main submit / CTA per view (e.g. "Save", "Create project", "Send message").

**Look:** Transparent background, primary-colored text. On hover: primary background, dark text. Single clear CTA so it stands out.

**Classes:** `.btn-primary`, `button[type="submit"]` (in portals).

**Use:** One primary action per form or section. Avoid multiple primary buttons in the same block.

### 3. Secondary / default — content actions

**Where:** Cancel, back, secondary actions, table row actions that are not primary.

**Look:** Same base as primary but not emphasized; transparent, light text; hover = primary background. Visually lighter than primary.

**Classes:** `.btn`, `.btn-secondary` (in portals).

**Use:** All other actionable buttons in content (cards, modals, tables) that are not the single primary CTA.

### 4. Icon-only — toolbars and compact UI

**Where:** Table header (filter, search, export), message compose actions, inline row actions.

**Look:** Icon only, no label. Minimal padding, no heavy shadow. Hover = primary color on icon.

**Classes:** `.icon-btn` (and variants like `.filter-search-trigger`, `.filter-dropdown-trigger`).

**Use:** Toolbars, filters, search triggers, repeat actions where space is tight or the icon is well understood.

### 5. Destructive — remove or delete

**Where:** Delete project, remove item, revoke access.

**Look:** Danger color (red) on hover or as accent; optional light danger background. Clearly distinct from primary.

**Use:** Any action that removes data or is hard to undo. Prefer icon + label ("Delete") or at least an explicit label.

### 6. Where each is used (summary)

|Context|Style|Example|
|----------------------|-------------|-----------------------------------|
|Sidebar nav|Link-style|Dashboard, Leads, Projects, Sign out|
|Page/section CTA|Primary|Save settings, Create project|
|Cancel / back / other|Secondary|Cancel, Back, View details|
|Table header / tools|Icon-only|Filter, Search, Export|
|Delete / remove|Destructive|Delete project, Remove item|

### Button implementation notes

- **Single source of truth:** Portal button and sidebar styles live in `src/styles/shared/portal-buttons.css`.
- **Design tokens:** Use `--color-primary`, `--portal-bg-dark`, `--portal-text-light`, and shadow variables from the design system.
- **No duplicate rules:** Avoid defining button look in page-specific CSS; override only when a documented exception is needed.

---

## Related Docs

- **[CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md)** — Full CSS architecture, main site, design system, utilities, and best practices.
