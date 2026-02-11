# Wireframe Mode and Reusable Components

**Last updated:** February 2, 2026 (full scan of admin + client portals for reusable-component candidates)

**This doc is not the site-feature wireframes doc.** For the **site feature** (client-facing wireframe previews: upload screenshots to project Files, clients view in Files tab), see [WIREFRAMES.md](../features/WIREFRAMES.md).

Design and front-end changes are applied **directly to the main site** (admin and client portal). No separate wireframe build is required. This doc covers (1) **optional greyscale mode** (`?wireframe=1`) for ad-hoc layout review, and (2) what should be **reusable components** but currently is not.

---

## Wireframe Mode (Greyscale) — Optional

**Not required for workflow.** The main admin and client portal are the source of truth. Greyscale mode is available only for ad-hoc layout review, accessibility checks, or design handoff without color.

### How to enable

- **URL:** Add `?wireframe=1` to the page. Examples (dev host on port 4000):
  - Admin: `http://<frontend-host>:4000/admin/?wireframe=1`
  - Client portal: `http://<frontend-host>:4000/client/portal.html?wireframe=1`
- **Persist:** With `?wireframe=1` once, wireframe state is stored in `localStorage` and stays on until you clear it or disable (see below).
- **Disable:** Open the same page with `?wireframe=0` or run in console: `localStorage.removeItem('wireframe'); document.documentElement.removeAttribute('data-wireframe'); location.reload();`

### What it does

- Applies **greyscale** to the dashboard area (sidebar + content) so the UI is entirely greyscale.
- **Navigation is unchanged:** sidebar tabs, tab content, mobile menu, and all existing behavior keep working.
- Uses current structure and shared layout; no separate wireframe pages.

**What it shows:** The same UI as the main site (shared tabs, sidebar badge, navigation). See `docs/current_work.md` “Front-end work (on main site)” for the full list.

### Technical details

- Wireframe is toggled by `data-wireframe="true"` on `html` (set synchronously in head so greyscale applies as soon as CSS loads).
- Styles live in `src/styles/shared/wireframe.css`, imported by both admin and portal CSS bundles.
- A small inline script in each portal HTML reads `?wireframe=1` or `localStorage.wireframe` and sets `data-wireframe` on `document.documentElement` before any other scripts run.

---

## What Should Be Reusable But Is Not Using Components

The codebase has a **component system** (`src/components/`: `BaseComponent`, `ButtonComponent`, `ModalComponent`, `componentStore`, etc.) and **shared portal styles** (`src/styles/shared/portal-layout.css`, `portal-cards.css`, `portal-components.css`). The admin and client portals use the **same layout patterns** (sidebar, tab content, page header, stat cards) but implement them with **duplicated HTML and logic** instead of shared components.

Below is what **should** be reusable components (or shared modules) but currently is **not** using the component system or shared TS components.

### 1. **Sidebar (layout + nav)**

- **Admin:** Inline in `admin/index.html` (aside.sidebar, logo, `.sidebar-buttons` with `data-tab`, footer with Sign Out).
- **Client:** Inline in `client/portal.html` (same structure: aside.sidebar, logo, `.sidebar-buttons`, optional footer).
- **Gap:** Same DOM pattern and classes in both; no shared `Sidebar` component. Each portal owns its own HTML and relies on shared CSS (`nav-portal.css`, `portal-layout.css`). A reusable **Sidebar** component (or shared template/factory) could accept config (tabs, badges, show logout) and render one structure for both.

### 2. **Page header (per-tab title + sidebar toggle)**

- **Pattern:** `.page-header` with `.header-sidebar-toggle` + `h2` (and sometimes breadcrumbs on client).
- **Admin:** Repeated in every tab in `admin/index.html` (Overview, Leads, Projects, etc.).
- **Client:** Repeated in every tab in `client/portal.html` / client-portal.ejs.
- **Implemented:** `createPageHeader(config)` in `src/components/page-header.ts`; use when building tabs in JS.

### 3. **Stat cards / Quick stats grid**

- **Pattern:** `.quick-stats` grid of `.stat-card` (optional `.stat-card-clickable`) with `.stat-number` and `.stat-label`.
- **Admin:** Used on Overview and on Leads/Projects tabs; HTML duplicated.
- **Client:** Used on dashboard; same structure.
- **Implemented:** `createQuickStats(items)` in `src/components/quick-stats.ts`; use when building tabs in JS.

### 4. **Tab content switching**

- **Admin:** `AdminDashboard.switchTab()` in `admin-dashboard.ts`; toggles `.tab-content.active` and `.sidebar-buttons .btn[data-tab].active`.
- **Client:** `switchTab()` in `portal-navigation.ts`; same idea with different tab IDs and callbacks.
- **Implemented:** `setupTabRouter(config)` in `src/components/tab-router.ts`; both portals can use it for main tab DOM + `onChange(tabName)` for data loading. Horizontal tab strips (project detail, client detail) share `shared/portal-tabs.css` (`.portal-tabs`, `.portal-tab-panel`).

### 5. **Tables (admin)**

- **Pattern:** `.admin-table-card` > `.admin-table-header` (title + actions) + `.admin-table-container` > `<table class="admin-table">`.
- **Used in:** Leads, Contacts, Projects, Clients, Messaging, etc.; each module builds its own table HTML and header/actions.
- **Gap:** No **TableCard** or **DataTable** component. There is shared styling and utilities (`table-dropdown.ts`, `table-filter.ts`) but no shared component for “card + header + table + optional filters.” Each feature builds DOM manually.

### 6. **Modals**

- **Existing:** `ModalComponent` and `createModal()` in `src/components/` and component store.
- **Usage:** **Not used** by admin or client features. Admin modules (e.g. leads, projects, clients) build modal HTML as strings and inject into the DOM.
- **Gap:** Modals should use `ModalComponent` (or a thin wrapper) for consistency, accessibility, and behavior (focus, escape, backdrop). Right now they are ad-hoc.

### 7. **Buttons**

- **Existing:** `ButtonComponent` and `createButton()` in `src/components/`.
- **Usage:** **Not used** in admin or client code. Both use raw `<button class="btn btn-secondary">` (and variants) in HTML/JS.
- **Gap:** For complex buttons (loading, icons, disabled state), using `ButtonComponent` would standardize behavior. For simple links/buttons, raw HTML is fine; the gap is where behavior is duplicated (e.g. loading state) instead of using the component.

### 8. **Breadcrumbs (client)**

- **Current:** `updateBreadcrumbs()` in `portal-navigation.ts` builds breadcrumb DOM by hand (list items, links, separators).
- **Implemented:** `renderBreadcrumbs(container, items)` and `BreadcrumbItem` in `src/components/breadcrumbs.ts`; client portal uses it in `updateBreadcrumbs()`.

### 9. **Recent activity block**

- **Pattern:** `.recent-activity.portal-shadow` (or `.cp-shadow`) with `h3` and `.activity-list` (ul/li).
- **Admin:** In Overview and elsewhere; list filled in JS.
- **Client:** Same structure on dashboard.
- **Gap:** Styling shared; markup and “list of items” rendering duplicated. A **RecentActivity** component (or shared template) with `items: { text, date? }[]` would be reusable.

### 10. **Message bubbles / thread UI**

- **Admin:** Message HTML built in `admin-dashboard.ts`, `admin-messaging.ts`, and `admin-messaging.renderer.ts` (avatar, header, body).
- **Client:** Message HTML in portal template and in messages module.
- **Gap:** Same “message row” pattern (avatar, sender, time, body) in multiple places. A **MessageBubble** or **ThreadMessage** component would reduce duplication and keep layout/aria consistent.

---

## Full scan: additional reusable-component candidates

Below is a scan of **admin and client portals** for patterns that **should be reusable components** (shared factory or component) but are currently duplicated or ad-hoc. Use this list when refactoring or adding features.

### 11. **Primary header row (toggle + breadcrumbs)**

- **Pattern:** One shared row at top of content: sidebar toggle button + breadcrumb nav. Per-tab content then has only `.page-title` (e.g. `<h2>`).
- **Where:** `admin/index.html` and `client/portal.html` each have a single `.page-header.primary-header-row` with `.header-sidebar-toggle.header-toggle-button` and `#breadcrumb-list`. Breadcrumbs are updated in JS (admin: `admin-dashboard.ts`; client: `portal-navigation.ts`).
- **Gap:** Structure is duplicated in two HTML files; no shared **PrimaryHeader** component or template. Shared CSS in `client-portal/layout.css`. A shared factory could render the row from config (tabs/breadcrumb callback) so both portals use one implementation.

### 12. **Empty states**

- **Pattern:** “No X yet”, “Loading…”, “No data” messages inside list/table containers. Classes: `.empty-state`, `.no-files`, `.no-projects`, `.loading-row`, `.report-empty`.
- **Where:** Many modules set `container.innerHTML = '<p class="empty-state">...'` or similar: `admin-project-details.ts`, `admin-client-details.ts`, `admin-clients.ts`, `admin-analytics.ts`, `admin-dashboard.ts`, `portal-files.ts`, `client-portal.ts`, etc. Also in HTML: `admin/index.html` (e.g. “No custom fields configured”, “No invoices found”).
- **Gap:** No **EmptyState** component. A small factory `createEmptyState(message, options?: { icon?, ctaLabel?, ctaHref? })` would standardize copy, styling, and optional CTA.

### 13. **Status badges**

- **Pattern:** `<span class="status-badge status-${variant}">...</span>`. Variants: status (active, pending, etc.), health (healthy, at-risk, critical), sidebar count, contract (signed, pending, not-signed).
- **Where:** Built by hand in: `admin-project-details.ts`, `admin-clients.ts`, `admin-client-details.ts`, `admin-dashboard.ts`, `client-portal.ts`, `table-filter.ts` (filter count badge). Shared CSS: `shared/portal-badges.css`, `admin/client-detail.css`, `admin/project-detail.css`.
- **Gap:** No **StatusBadge** component. A `renderStatusBadge(label, variant)` (or similar) would ensure consistent markup and class names and make redesigns (e.g. badge clarity) one-place.

### 14. **Detail / meta cards (label + value rows)**

- **Pattern:** Card with `.overview-header` (title + optional icon button) and rows of `.meta-item` (`.field-label` + `.meta-value`), e.g. Client, Company, Email, Status. Same structure for project detail, client detail, lead detail, contact detail.
- **Where:** `admin-project-details.ts` (project overview), `admin-client-details.ts` (client overview, CRM section), `admin-leads.ts` (lead details panel), `admin-contacts.ts` (contact details), `admin/index.html` (static shells). Client: `portal-projects.ts`, project cards.
- **Gap:** No **DetailCard** or **MetaGrid** component. Each feature builds `.project-detail-overview`, `.meta-item` HTML manually. A factory `createDetailCard({ title, editAction?, rows: { label, value }[] })` would unify structure and accessibility.

### 15. **Form modals (edit / add dialogs)**

- **Pattern:** Overlay + modal with title, form body, Cancel/Submit. Close on overlay click, Escape; focus trap; `modal-open` on body.
- **Where:** Implemented ad-hoc in many places: `admin-project-details.ts` (edit project), `admin-project-details.ts` (create invoice), `admin-clients.ts` (edit client info, edit billing, add client), `admin-projects.ts` (edit project, add project, file preview modal), `admin-tasks.ts` (task detail, create task, edit task), `admin-time-tracking.ts` (log time, edit time), `admin-files.ts` (file detail), `admin-proposals.ts` (template editor), `admin-dashboard.ts` (contact submission detail). Each implements its own overlay, close handlers, and often `manageFocusTrap`.
- **Gap:** **ModalComponent** exists but is not used. Every form modal reimplements overlay + close + focus. A **FormModal** wrapper (or adoption of `ModalComponent`) with consistent title/body/footer and `onClose`/`onSubmit` would reduce duplication and standardize a11y.

### 16. **Icon buttons**

- **Pattern:** Small square/round button with SVG icon only (edit, invite, close, etc.). Class: `.icon-btn`.
- **Where:** Inline in HTML and JS: `admin/index.html`, `admin-project-details.ts`, `admin-client-details.ts`, `admin-files.ts`, etc. Same “button + SVG + aria-label” pattern repeated.
- **Gap:** No **IconButton** component. A `createIconButton({ icon, label, onClick })` (or similar) would standardize markup, size, and a11y.

### 17. **Table loading / error states**

- **Pattern:** “Loading…”, “No X found”, “Error loading…” rows or full-table replacement. `showTableLoading`, `showTableError`, `.loading-row`.
- **Where:** `admin-clients.ts`, `admin-leads.ts`, `admin-projects.ts`, `admin-contacts.ts`, `admin-analytics.ts`, `admin-dashboard.ts`, etc. Each module calls `showTableLoading(tableBody, n)` or sets `innerHTML` with loading/error message.
- **Gap:** Utilities exist (`loading-utils.ts`) but no shared **TableState** component for “loading | empty | error” that slots into `.admin-table-container`. Standardizing would keep messaging and layout consistent.

### 18. **Confirm / alert dialogs**

- **Pattern:** Short confirmation or alert (title, message, Cancel/Confirm or OK). Styled to match portal; replaces `confirm()`/`alert()`.
- **Where:** `confirm-dialog.ts` provides `confirmDialog()`, `confirmDanger()`, `alertError()`, `alertSuccess()`, `alertInfo()`. Used widely in admin (and some client) for delete confirmations and toasts.
- **Gap:** **Implemented** and used. Not using `ModalComponent`; confirm-dialog builds its own overlay. Could eventually be refactored to use ModalComponent for one modal system, but not required for “reusable component” scan.

### 19. **Secondary tab strips (detail views)**

- **Pattern:** Horizontal tabs inside a detail view (e.g. Project: Overview, Files, Messages, Invoices, Tasks, Time, Contract; Client: Overview, Projects, Contacts, etc.). Same DOM pattern: `.portal-tabs` / `.portal-tab-panel` or `.project-detail-tabs` / `#pd-tab-*`.
- **Where:** Admin project detail and client detail; client portal project view. CSS shared (`shared/portal-tabs.css`); JS is per-module (each wires click + show/hide).
- **Gap:** **TabRouter** exists but these detail views don’t use it. Using `setupTabRouter()` (or a variant) for detail tabs would unify behavior and reduce duplicated tab-switch logic.

### 20. **Page title with optional badge**

- **Pattern:** `.page-title` with `<h2>` and optional right-aligned badge (e.g. status). Used on project detail: “Project Details” + status badge.
- **Where:** `admin/index.html` uses `.page-title.page-title-with-badge` for project detail; CSS in `admin/project-detail.css`.
- **Gap:** Small pattern; could be a **PageTitle** factory `createPageTitle(title, options?: { badge?: string, badgeVariant? })` so any tab can add a title + badge without duplicating structure.

---

## Implemented

The following are now **reusable** and available for admin and client portals. Wireframes (greyscale view) use the same structure, so these apply there too.

|Area|Implementation|Usage|
|-----------------|----------------|-------|
|**Breadcrumbs**|`src/components/breadcrumbs.ts`: `renderBreadcrumbs(container, items)`, `BreadcrumbItem`|Client portal: `portal-navigation.ts` uses it. Admin: `admin-dashboard.ts` uses it in `updateAdminBreadcrumbs()` for section + project name.|
|**Tab switching**|`src/components/tab-router.ts`: `setupTabRouter(config)` with `buttonSelector`, `contentIdPrefix`, `onChange`|Available for admin and client; portals can call it to share tab DOM logic.|
|**Stat cards**|`src/components/quick-stats.ts`: `createQuickStats(items)`, `QuickStatItem`|Factory for `.quick-stats` grid; use when building tabs dynamically.|
|**Recent activity**|`src/components/recent-activity.ts`: `createRecentActivity(items, title?, listId?)`, `RecentActivityItem`|Factory for `.recent-activity` block; use when building tabs dynamically.|
|**Page header**|`src/components/page-header.ts`: `createPageHeader(config)` with `title`, `showToggle`, `toggleAriaLabel`|Factory for `.page-header`; use when building tabs dynamically.|
|**Search bar**|`src/components/search-bar.ts`: `createSearchBar(config)`; `src/styles/shared/search-bar.css`: `.search-bar`, `.search-bar-icon`, `.search-bar-input`, `.search-bar-clear`|Reusable inline search: icon + input + optional clear. Shared padding so placeholder/text do not overlap the icon. Used by table filter dropdown and messages search.|
|**Empty state**|`src/components/empty-state.ts`: `createEmptyState(message, options?)`, `renderEmptyState(container, message, options?)`|Admin: `admin-project-details.ts` uses it for messages/files empty and error states. Use for any "No X yet" or loading/error message.|
|**Status badge**|`src/components/status-badge.ts`: `createStatusBadge(label, variant)`, `getStatusBadgeHTML(label, variant)`|Admin: `admin-clients.ts` uses `getStatusBadgeHTML` for client table status cells. Use for status pills (active, pending, healthy, etc.).|
|**Icon button**|`src/components/icon-button.ts`: `createIconButton(config)` with `iconSvg`, `label`, `onClick`, `className`|Admin: `admin-project-details.ts` uses it for the project overview "Send invitation" button. Use for edit, close, invite, etc.|
|**Page title**|`src/components/page-title.ts`: `createPageTitle(config)` with `title`, optional `badge`, `badgeVariant`|Factory for `.page-title` and `.page-title-with-badge`; use when building tab titles with optional status badge.|
|**Table empty**|`src/utils/loading-utils.ts`: `showTableEmpty(tableBody, colspan, message)`|Admin: `admin-clients.ts` uses it for "No clients found" and "No clients match the current filters". Use with `showTableLoading` and `showTableError` (error-utils) for full table states.|

All are exported from `src/components/index.ts` (or loading-utils/error-utils). Existing static HTML in admin/client can stay; new or refactored views can use these so the main site stays consistent.

---

## Summary

|Area|Should be reusable|Status|
|---------------------|--------------------|--------|
|Breadcrumbs|Breadcrumbs component|**Done:** `breadcrumbs.ts`; client + admin use it.|
|Tab switching|TabRouter / shared module|**Done:** `tab-router.ts`; available for both portals.|
|Stat cards|QuickStats factory|**Done:** `quick-stats.ts`; use for dynamic tabs.|
|Recent activity|RecentActivity factory|**Done:** `recent-activity.ts`; use for dynamic tabs.|
|Page header|PageHeader factory|**Done:** `page-header.ts`; use for dynamic tabs.|
|Search bar|SearchBar factory + shared CSS|**Done:** `search-bar.ts` + `search-bar.css`; table filter and messages use it.|
|Sidebar|Sidebar component|Inline HTML in each portal; shared CSS only.|
|Primary header row|PrimaryHeader (toggle + breadcrumbs)|Inline HTML in admin + client; shared CSS only.|
|Admin tables|TableCard / DataTable|Per-feature HTML; table-filter/table-dropdown are utils only.|
|Empty states|EmptyState component|**Done:** `empty-state.ts`; admin-project-details uses it for messages/files.|
|Status badges|StatusBadge component|**Done:** `status-badge.ts`; admin-clients uses `getStatusBadgeHTML`.|
|Detail / meta cards|DetailCard / MetaGrid|Per-feature HTML; no shared component.|
|Form modals|FormModal / ModalComponent|Exists but not used; ad-hoc modal HTML in many features.|
|Icon buttons|IconButton component|**Done:** `icon-button.ts`; admin-project-details uses it for invite button.|
|Table loading/empty/error|loading-utils + error-utils|**Done:** `showTableLoading`, `showTableEmpty` (loading-utils), `showTableError` (error-utils); admin-clients uses showTableEmpty.|
|Confirm/alert|confirm-dialog.ts|**Done:** used widely; could later use ModalComponent.|
|Secondary tab strips|TabRouter for detail views|Shared CSS; per-module JS; TabRouter not used here.|
|Page title + badge|PageTitle factory|**Done:** `page-title.ts`; use when building tab titles with optional badge.|
|Modals (generic)|ModalComponent|Exists but not used; ad-hoc modal HTML in features.|
|Buttons|ButtonComponent|Exists but not used; raw buttons everywhere.|
|Message bubbles|MessageBubble / ThreadMessage|Built in multiple admin/client modules.|

Using the implemented components (and adopting them where tabs/headers are built in JS) keeps the main site consistent and makes future changes easier.
