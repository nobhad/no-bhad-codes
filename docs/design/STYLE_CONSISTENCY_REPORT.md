# Style Consistency Report (Deep Dive)

**Date:** February 2026  
**Scope:** Design tokens, portal theme, admin and client-portal UI. Covers `src/design-system`, `src/styles`, and alignment between project detail and client detail.

This is a **deep-dive audit** of where styles are defined, how admin and portal stay consistent, and what to fix or extend. For portal CSS structure and bundles, see [PORTAL_CSS_DESIGN.md](./PORTAL_CSS_DESIGN.md).

---

## 1. Canonical sources

| Concern | Source | Notes |
|--------|--------|--------|
| **Primitive & semantic colors** | `src/design-system/tokens/colors.css` | Brand, grays, success/warning/error/info, overlay tokens (`--color-overlay-*`). |
| **Portal theme (admin + client-portal)** | `src/styles/variables.css` | Block `[data-page="client-portal"], [data-page="admin"]`: all `--portal-*` (text, bg, border, radius, spacing). Admin overrides a few (e.g. `--portal-text-secondary`). |
| **Shadows (elevation)** | `src/design-system/tokens/shadows.css` | `--shadow-xs` … `--shadow-2xl`, `--shadow-card-rest`, `--shadow-modal`, etc. |
| **Shadows (legacy/portal)** | `src/styles/variables.css` | `--shadow-card`, `--shadow-panel`, `--shadow-dropdown`, `--shadow-terminal`, etc. Used by admin/portal cards and panels. |
| **Spacing (fixed 8px)** | `src/design-system/tokens/spacing.css` | `--space-0` … `--space-32`, `--space-1-5`, etc. |
| **Spacing (fluid)** | `src/styles/variables.css` | `--space-fluid-xs` … `--space-fluid-2xl`. |
| **Portal spacing** | Portal theme in `variables.css` | `--portal-spacing-xs` … `--portal-spacing-2xl`. Prefer in portal UI. |
| **Typography scale** | `src/styles/variables.css` | `--font-size-xs` … `--font-size-3xl` (clamp-based). |
| **Font family (Acme)** | `src/styles/variables.css` | `:root`: `--font--acme`, `--font-family-acme: var(--font--acme)`. |
| **Breakpoints** | `src/styles/variables.css` | Custom media: `--mobile`, `--tablet`, `--desktop`, `--small-mobile`, etc. |

---

## 2. Portal theme at a glance

Under `[data-page="client-portal"], [data-page="admin"]`:

- **Text:** `--portal-text-light`, `--portal-text-secondary`, `--portal-text-muted`, `--portal-text-dark`
- **Backgrounds:** `--portal-bg-darker` … `--portal-bg-readonly`, `--portal-bg-hover`
- **Borders:** `--portal-border-dark`, `--portal-border-medium`, `--portal-border-light`
- **Radius:** `--portal-radius-xs|sm|md|lg|pill`; `--border-radius-card` aliased to `--portal-radius-md`
- **Spacing:** `--portal-spacing-xs` … `--portal-spacing-2xl`

Use these in admin and client-portal CSS so both surfaces stay visually aligned.

---

## 3. Admin vs client-portal alignment

### 3.1 Project detail and client detail (very similar)

Both views share the same structure and styling so they feel like one pattern:

- **Shared in `project-detail.css` (applies to both `#tab-project-detail` and `#tab-client-detail`):**
  - **Page title:** Same margin and h2 (Acme, clamp size, `--portal-text-light`).
  - **Overview card:** Same `.project-detail-overview` (one dark card with `--portal-bg-dark`), `.project-detail-client-row`, `.project-detail-meta` (same grid, labels, values).
  - **Tab content:** All section cards inside tabs are **transparent** for both: `[id^="pd-tab-"]` and `[id^="cd-tab-"]` so `.portal-project-card` has no background, border, or shadow.
  - **Section h3s:** Same style for `[id^="pd-tab-"] h3` and `[id^="cd-tab-"] h3` (Acme, 1.2rem, uppercase, margin).
  - **Text and empty state:** Same `--portal-text-light` for body/h3/h4 and `--portal-text-secondary` for empty/muted in both tabs; main name heading (`#pd-project-name`, `#cd-client-name`) uses Acme.

- **Client detail only (`client-detail.css`):**
  - Tab panel padding/gap matches project detail (e.g. `4rem 2rem`, `gap: 4rem`).
  - Invoices tab: redundant h3 hidden (tab label is enough).
  - Account Actions block: **transparent** (no card box), like a final section.
  - CRM/billing grids, client project list, client invoice list, tags, modals — all use same tokens and list row style (`--portal-bg-medium`, no border) as project detail list items.

### 3.2 Tables (admin)

- **Table cards:** `.admin-table-card` uses `--portal-bg-dark`, no border, `--border-radius-card`, `--shadow-panel`.
- **Pagination:** `.table-pagination .pagination-inner` uses `--portal-bg-dark`, no top border; text/controls use `--portal-text-light`; borders use `--portal-border-light`. Matches table card background.
- **Leads analytics (Conversion Funnel, Lead Sources):** Cards use `--portal-bg-dark`, no border, `--shadow-panel`; headings and content use `--portal-text-light`; funnel/source text and empty state use readable tokens.

**Table empty and loading states (consistent across Leads, Projects, Clients, Contacts):**

- **Loading:** Use `showTableLoading(tableBody, colspan, 'Loading [entity]...')` from `src/utils/loading-utils.ts` with the correct column count (e.g. 9 for leads/projects, 8 for clients, 6 for contacts).
- **Empty (no data):** Use `showTableEmpty(tableBody, colspan, message)`. Message: `"No [entities] yet."` with an optional short hint (e.g. "Convert leads to start projects.").
- **Empty (filtered):** Use `showTableEmpty(tableBody, colspan, 'No [entities] match the current filters. Try adjusting your filters.')` so wording is the same in every table.
- **Colspan:** Must match the table’s column count (including bulk-select column when present) so the empty/loading row spans the full width.
- This keeps presentation and copy consistent so users can expect the same behavior and messaging in every admin table.

### 3.3 Messages

- **Messages container:** `--color-neutral-200` (shared).
- **Messages header** (search, pinned): Background set to `--color-neutral-200` so it matches the main messages container and doesn’t read as a separate bar.

### 3.4 Contract status (project detail)

- **Contract status block:** `.contract-status-info .status-item` is styled like overview meta-items: no card (transparent, no padding/radius/shadow); `.contract-status-info .field-label` matches `.project-detail-overview .field-label`; status badge uses 1rem, font-weight 600 for value prominence.

### 3.5 Button icon order (admin and client portal)

- **Icon before text (all button types):** Icons always appear **before** (left of) the label in **all** buttons—`.btn`, `.icon-btn`, tab buttons, portal/theme/menu buttons with `.icon-wrap`, and any button with direct-child `svg`. Enforced in `portal-buttons.css` via: (1) `button:has(> svg)` gets `display: inline-flex` so flex order applies consistently across table toolbars, bulk action buttons, and view toggles; (2) `order: -1` on `.btn` (etc.) `> svg`, `> .btn-icon`; `.icon-btn > svg`, `> .icon-btn-svg`; `button > .icon-wrap`, `> .tab-icon`, `> svg` for `[data-page="admin"]` and `[data-page="client-portal"]`. Exception: `.custom-dropdown-trigger` caret stays **after** the value (`order: 1`). Prefer markup order icon-then-text for accessibility.
- **Toolbar / action row order:** When a row has Add, Export, and/or Refresh (or similar actions), use the same sequence everywhere: **Add** (if applicable) → **Export** (if applicable) → **Refresh**. This applies to admin table headers, client portal sections, and any other toolbar; not only admin tables.

---

## 4. Tokens to prefer (and avoid)

### 4.1 Colors

- **Use:** `--portal-*` in admin/portal; `--color-*` from `design-system/tokens/colors.css` for semantic (e.g. `--color-success-500`, `--color-warning-500`, `--color-overlay-*`). For body text and meta values on dark admin/portal backgrounds use `--portal-text-light` (good contrast).
- **Avoid:** Hardcoded hex for brand/status in new or touched code; redundant fallbacks when tokens are always loaded (e.g. `var(--color-danger, #ef4444)`). **Do not use `--color-text-inverse` for body text in admin/portal:** in the dark theme it is set to `--color-gray-900` (#171717), which has poor contrast on dark backgrounds; use `--portal-text-light` instead.

### 4.2 Shadows

- **Use:** `--shadow-panel` for tab panels and main cards; `--shadow-card` for smaller cards/summary blocks where appropriate; design-system `--shadow-*` for new components.
- **Avoid:** Inline `rgba(0,0,0,…)` for elevation when a token exists.

### 4.3 Spacing

- **Use:** `--portal-spacing-*` in portal UI; `--space-*` (design-system) or `--space-fluid-*` (variables.css) elsewhere.
- **Avoid:** Mixing arbitrary `rem`/`px` in portal sections when a token exists.

### 4.4 Typography

- **Use:** `--font-size-xs` … `--font-size-3xl` for size; `--font-family-acme` for display/headings in portal.
- **Avoid:** Raw `font-size` values in new portal/admin code when the scale covers the need.

### 4.5 Border radius

- **Use:** `--portal-radius-*` in portal; `--border-radius-card` where already aliased to portal.
- **Avoid:** Hardcoded `px` for radius in shared portal components.

---

## 5. File layout (styles)

- **`src/design-system/`** — Tokens only (colors, shadows, spacing, typography, etc.).
- **`src/styles/variables.css`** — Root variables, custom media, shadow set, **portal theme block**.
- **`src/styles/shared/`** — Portal-agnostic or shared portal components (portal-badges, portal-buttons, portal-tabs, portal-messages, confirm-dialog, etc.).
- **`src/styles/admin/`** — Admin-only (project-detail, client-detail, leads-pipeline, table-features, etc.).
- **`src/styles/client-portal/`** — Client portal only (dashboard, sidebar, etc.).
- **`src/styles/pages/admin.css`** — Admin page-level overrides and scoping.

New portal or admin UI should pull from tokens and portal theme and avoid one-off hex/shadow/spacing unless necessary.

---

## 6. Recommendations

1. **New or touched admin/portal CSS:** Use `--portal-*` and design-system tokens; no new hardcoded hex for brand/status.
2. **New cards/panels:** Prefer `--shadow-panel` or `--shadow-card` and `--portal-bg-dark` (or transparent for “sections” inside a panel).
3. **Empty and secondary text:** Use `--portal-text-secondary` or `--portal-text-muted` so they stay readable on dark backgrounds.
4. **List rows (admin):** Use `--portal-bg-medium`, no border, consistent padding/margin (e.g. `--portal-spacing-md`, `margin-bottom: var(--portal-spacing-sm)`) so tables, project lists, and client lists feel the same.
5. **Section headings in tabs:** Keep one shared pattern (e.g. Acme, 1.2rem, uppercase, `margin: 0 0 var(--portal-spacing-lg) 0`) for both project and client detail.
6. **Pagination and analytics:** Keep background and text aligned with the table/card (e.g. `--portal-bg-dark`, `--portal-text-light`) and avoid extra divider borders unless needed.
7. **Buttons with icon + text (admin and client portal):** Put the icon first in markup everywhere; CSS in `portal-buttons.css` enforces icon-before-text visually. In any toolbar or action row, use order Add → Export → Refresh where applicable.

---

## 7. Related docs

- [PORTAL_CSS_DESIGN.md](./PORTAL_CSS_DESIGN.md) — Portal CSS architecture and bundles.
- [STATUS_SYSTEM.md](./STATUS_SYSTEM.md) — Status badges and colors.
- [UX_GUIDELINES.md](./UX_GUIDELINES.md) — UX and accessibility.
