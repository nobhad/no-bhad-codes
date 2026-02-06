# API-Only Features: UI Plan (Design-Aligned)

**Last Updated:** February 2, 2026

This document plans how the four API-only route groups (approvals, triggers, document-requests, knowledge base) get frontend UI that **fits the current design**. It follows [UX_GUIDELINES.md](./UX_GUIDELINES.md), [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md), [PORTAL_CSS_DESIGN.md](./PORTAL_CSS_DESIGN.md), and [REUSABLE_COMPONENTS_AUDIT.md](./REUSABLE_COMPONENTS_AUDIT.md).

---

## Design Alignment Summary

|Principle|Application|
|-----------|-------------|
|**Portal theme**|All new UI uses `[data-page="admin"]` or `[data-page="client-portal"]` and `--portal-*` tokens (text, bg, border, spacing).|
|**Layout**|Admin: sidebar tab + `.page-header` + `.admin-table-card` (or section cards). Client: sidebar tab + same header/card patterns from portal layout.|
|**Reusable components**|**Must** use shared components from `src/components/` and `src/utils/` (see table below). No inline native `<select>`, custom modal markup, or one-off dropdown logic.|
|**Icons**|Lucide only; no emojis. Use icon-before-text on buttons. Toolbar actions: icon-only buttons via `createIconButton` (or `.icon-btn` with Lucide SVG) and `aria-label` / `title`.|
|**Tables**|`.admin-table`, `.admin-table-header` (title + Add/Export/Refresh), loading/empty via `showTableLoading` / `showTableEmpty` from `src/utils/loading-utils.ts`.|
|**Empty states**|Use `createEmptyState` from `src/components/empty-state.ts` where applicable; otherwise centered, large icon (32px+), short message, primary action button.|
|**Modals**|Use `createPortalModal` from `src/components/portal-modal.ts` for form modals (shell: overlay, header, body, footer). Mount form markup into `.body`, buttons into `.footer`. Close via instance `.hide()` and optional focus trap.|
|**Dropdowns**|**Two components:** (1) **Tables:** use `createTableDropdown` from `src/components/table-dropdown.ts` for table cells (status, actions) and table header filters (e.g. per page). (2) **Forms:** use `createFormSelect` from `src/components/form-select.ts` for form fields in modals and inline forms (client, category, type, status). Mount in a div (e.g. `id="-mount"`); call `setOptions()` when data loads. No static `<select>` in HTML.|
|**View toggles**|Use `createViewToggle` from `src/components/view-toggle.ts` for Table/Pipeline or List/Cards switches.|
|**Status badges**|Use `createStatusBadge` or `getStatusBadgeHTML` from `src/components/status-badge.ts`; shared CSS in `portal-badges.css`.|
|**Buttons**|`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`, `.icon-btn`; UPPERCASE text labels; order Add → Export → Refresh in toolbars.|

### Reusable components quick reference

|Use case|Component / util|Location|
|----------|------------------|----------|
|**Table dropdown** (cells, header filter, per page)|`createTableDropdown`|`src/components/table-dropdown.ts`|
|**Form dropdown** (modals, inline forms)|`createFormSelect`|`src/components/form-select.ts`|
|Form modal (add/edit)|`createPortalModal`|`src/components/portal-modal.ts`|
|Toolbar icon-only button|`createIconButton` or `.icon-btn` + Lucide SVG|`src/components/icon-button.ts`|
|Table row status / pipeline stage|`createStatusBadge`, `getStatusBadgeHTML`|`src/components/status-badge.ts`|
|Table vs pipeline / list vs cards toggle|`createViewToggle`|`src/components/view-toggle.ts`|
|Modal form select (wrap existing select)|`initModalDropdown`|`src/utils/modal-dropdown.ts`|
|Loading / empty table state|`showTableLoading`, `showTableEmpty`|`src/utils/loading-utils.ts`|
|Focus trap in modal|`manageFocusTrap`|`src/utils/focus-trap.ts`|

---

## 1. Approvals (`/api/approvals`)

**Audience:** Admin only.

**Placement:** New admin sidebar tab **Workflows** (or **Settings** sub-area) that contains both **Approvals** and **Triggers** (see §2) to keep automation in one place.

### 1.1 Admin: Workflows tab (Approvals section)

- **Route:** Same SPA as rest of admin; new `data-tab="workflows"` (or `settings` with sub-tabs).
- **Reusable components (required):** Sub-tabs via shared tab pattern (e.g. `.portal-tabs` or `tab-router`). Table header actions: icon buttons via `createIconButton` (Add workflow, Refresh). Entity type / workflow type dropdowns: `createFormSelect` in a mount div; entity type options from API. Create/Edit workflow modal: `createPortalModal` with form in body, Save/Cancel in footer; dropdowns inside the form use `createFormSelect` (mount divs in modal body). Row actions: `createTableDropdown` for Edit/Duplicate/Delete. No static `<select>` or custom modal markup.
- **Structure:**
  - **Page header:** "Workflows" (or "Approvals" if Workflows is the parent tab label), with sidebar toggle already in primary header row.
  - **Sub-navigation (horizontal):** "Approvals" | "Triggers" (same tab content area, switch via sub-tabs).
  - **Approvals content:**
    - **Table card:** List of workflow definitions (e.g. Name, Entity type, Workflow type, Steps count, Default). Use `.admin-table-card` > `.admin-table-header` with Add workflow (icon) + Refresh (icon). No export needed initially.
    - **Row actions:** Edit, Duplicate, Delete (dropdown or icon buttons). View → detail view or slide-over.
  - **Detail view (workflow definition + steps):** Either inline below table (expand row) or second view with back button. Show steps as ordered list with approver role, required action; Edit steps button.
  - **Create/Edit workflow modal:** Form: name, description, entity type (dropdown from `createFormSelect`), workflow type (sequential / parallel / any_one via `createFormSelect`), is_default (checkbox). Steps: repeatable rows (approver role, order). Primary "Save", secondary "Cancel".
- **API usage:** `GET /api/approvals/workflows`, `GET /api/approvals/workflows/:id`, `POST /api/approvals/workflows`, `PUT /api/approvals/workflows/:id`, `DELETE`; steps endpoints as needed.
- **Icons (Lucide):** Workflow → `GitBranch` or `Workflow`; Add → `Plus`; Edit → `Pencil`; Delete → `Trash2`; Refresh → `RefreshCw`.

### 1.2 Tokens and styles

- Reuse `--portal-bg-dark`, `--portal-text-light`, `--portal-border-*`, and design-system spacing tokens (`--space-*`).
- Table: same as Leads/Clients/Projects (`.admin-table`, header with `--portal-text-light`).
- New file: `src/styles/admin/workflows.css` (or under `admin/` with a name that covers approvals + triggers). Import in `admin/index.css` / bundle.

---

## 2. Triggers (`/api/triggers`)

**Audience:** Admin only.

**Placement:** Under same **Workflows** tab as Approvals (§1), sub-tab **Triggers**.

### 2.1 Admin: Workflows tab (Triggers section)

- **Reusable components (required):** Table header: icon buttons via `createIconButton` (Add trigger, Refresh). Create/Edit trigger modal: `createPortalModal` with form in body; event_type and action_type dropdowns use `createFormSelect` (mount divs in modal body), options populated from `GET /api/triggers/options`. Row actions: `createTableDropdown` for Edit, Toggle active, Delete. Status/active indicators: `createStatusBadge` or shared badge classes. No static `<select>` or custom modal markup.
- **Structure:**
  - **Table card:** Triggers list (Name, Event type, Action type, Active, Priority). Header: Add trigger (icon), Refresh (icon).
  - **Row actions:** Edit, Toggle active, Delete.
  - **Create/Edit trigger modal:** Name, description, event_type (dropdown from `createFormSelect` + `GET /api/triggers/options`), conditions (e.g. JSON or key-value list), action_type (dropdown), action_config, is_active, priority. Save / Cancel.
- **Optional:** "Execution log" link or section (read-only list from `GET /api/triggers/logs/executions`) so admins can debug.
- **API usage:** `GET /api/triggers`, `GET /api/triggers/options`, `GET /api/triggers/:id`, `POST /api/triggers`, `PUT /api/triggers/:id`, `DELETE /api/triggers/:id`, `POST /api/triggers/:id/toggle`.
- **Icons (Lucide):** Trigger → `Zap`; Add → `Plus`; Edit → `Pencil`; Toggle → `ToggleLeft` / `ToggleRight`; Delete → `Trash2`; Logs → `List`.

### 2.2 Shared with Approvals

- Same tab container and sub-tab strip (e.g. `.portal-tabs` from `shared/portal-tabs.css`).
- Same token usage and `workflows.css` (or split `workflows-approvals.css`, `workflows-triggers.css` if preferred).

---

## 3. Document Requests (`/api/document-requests`)

**Audience:** Admin (create/manage requests, templates); Client (view my requests, upload documents).

### 3.1 Admin UI

- **Placement:** New sidebar tab **Document requests** (or under **Clients** as a sub-view: "Document requests" list scoped by client). Prefer dedicated tab for parity with API and future growth.
- **Reusable components (implemented):** Status filter: `createTableDropdown` or `createFilterSelect` in `#dr-filter-mount` (options: All, Pending, For review, Overdue). Create request modal: client dropdown via `createFormSelect` in `#dr-create-client-mount`. From-templates modal: client dropdown via `createFormSelect` in `#dr-templates-client-mount`. Header actions: icon buttons (Add request, From templates, Refresh). Table loading/empty: `showTableLoading` / `showTableEmpty`. Any new modals must use `createPortalModal`; any new form dropdowns must use `createFormSelect`; table dropdowns use `createTableDropdown`.
- **Structure:**
  - **Page header:** "Document requests".
  - **Table card:** Requests list (Client, Title, Status, Due date, Created). Filter by status via reusable filter select. Header: Create request (icon), From template (icon), Refresh (icon).
  - **Row actions:** View, Start review, Approve/Reject (when in review), Send reminder, Delete.
  - **Create request modal:** Client (`createFormSelect`), title, description, due date; optional "From template" prefill. Save / Cancel.
  - **Templates (optional sub-section or modal):** List templates; create/edit/delete. `GET/POST /api/document-requests/templates`, etc.
- **API usage:** Admin endpoints for list, create, from-templates, get one, history, start-review, approve, reject, reminder, delete; templates CRUD.
- **Icons (Lucide):** Document request → `FileText`; Create → `Plus`; Upload → `Upload`; Remind → `Bell`; Approve → `Check`; Reject → `X`.

### 3.2 Client portal UI

- **Placement:** New sidebar tab **Documents** (or **Requests**).
- **Reusable components:** Status badges via `createStatusBadge` / `getStatusBadgeHTML`; form dropdowns via `createFormSelect`; shared portal card and button classes. No static `<select>` in HTML.
- **Structure:**
  - **Page header:** "Document requests" (or "Documents we need").
  - **List/cards:** Requests for the authenticated client (`GET /api/document-requests/my-requests`). Each card: title, due date, status badge (reusable), "View" / "Upload" button.
  - **Detail view:** Single request: description, status, due date, list of uploaded files (if any). "Upload document" button → use existing portal file upload pattern or link to Files tab with context.
  - **Mark viewed:** Call `POST /api/document-requests/:id/view` when client opens a request.
- **Tokens:** Same as rest of client portal (`--portal-*`, `--portal-bg-dark` for cards, `--portal-text-light`).
- **Styles:** Extend `src/styles/client-portal/` (e.g. `documents.css` or `requests.css`); import in portal bundle.

---

## 4. Knowledge Base (`/api/kb`)

**Audience:** Admin (categories + articles CRUD); Client (browse, search, read articles — Tier 2.5 self-service KB).

### 4.1 Admin UI

- **Placement:** New sidebar tab **Knowledge base** (or **Help** / **Content**).
- **Reusable components (implemented):** Articles filter: `createFilterSelect` or `createTableDropdown` in `#kb-articles-filter-mount`. Category modal: `createPortalModal` (form in body, Cancel/Save in footer). Article modal: `createPortalModal` with `createFormSelect` for category in `#kb-article-category-mount`. Header actions: icon buttons (Add category, Refresh, Add article, Refresh). Table loading/empty: `showTableLoading` / `showTableEmpty`. Any new form dropdowns use `createFormSelect`; table dropdowns use `createTableDropdown`.
- **Structure:**
  - **Sub-tabs or left rail:** "Categories" | "Articles" (or single view with category filter).
  - **Categories:** Table of categories (Name, Slug, Article count, Published). Add category (icon), Edit, Delete. Create/Edit modal via `createPortalModal`: name, slug, description, sort order.
  - **Articles:** Table (Title, Category, Slug, Published, Updated). Filter by category via table/form dropdown. Add article (icon), Edit, Delete. Create/Edit modal via `createPortalModal`: title, slug, category (`createFormSelect`), content (rich text or markdown), featured, published.
  - **Search:** Optional admin search to test `GET /api/kb/search?q=` (use shared search bar component if added).
- **API usage:** Admin CRUD for categories and articles; `GET /api/kb/categories`, `GET /api/kb/articles/...`, etc. (see API_DOCUMENTATION for exact paths).
- **Icons (Lucide):** KB → `BookOpen`; Category → `Folder`; Article → `FileText`; Add → `Plus`; Edit → `Pencil`; Delete → `Trash2`; Search → `Search`.

### 4.2 Client portal UI (Help / FAQ)

- **Placement:** New sidebar tab **Help** (or **FAQ**).
- **Reusable components:** Search bar via shared component if available (`search-bar.ts`); otherwise consistent input + Lucide Search icon. Cards use shared portal card classes; no one-off markup. Category/article lists use same list/card patterns as rest of portal.
- **Structure:**
  - **Page header:** "Help" (or "FAQ").
  - **Featured articles:** Horizontal list or cards from `GET /api/kb/featured`. Each card: title, short excerpt, link to article.
  - **Categories:** List from `GET /api/kb/categories`. Click category → `GET /api/kb/categories/:slug` → show category name + article list. Click article → `GET /api/kb/articles/:categorySlug/:articleSlug` → full article view (in same tab or expand).
  - **Search:** Search input (reusable search bar or consistent styling); on submit, `GET /api/kb/search?q=...`; show results (title, category, snippet). Use Lucide `Search` icon.
  - **Article view:** Title, category breadcrumb, body (sanitized HTML or markdown-rendered). Optional feedback widget if API supports it.
- **Tokens:** Same portal theme; cards use `--portal-bg-dark`, `--shadow-panel`; text `--portal-text-light`, `--portal-text-secondary`.
- **Styles:** `src/styles/client-portal/help.css` (or `knowledge-base.css`); import in portal bundle.

---

## Implementation Order (Suggested)

|Order|Feature|Surface|Status|
|-------|---------|---------|--------|
|1|Knowledge base (client)|Client portal – Help tab|**Done**|
|2|Knowledge base (admin)|Admin – KB tab|**Done**|
|3|Document requests (client)|Client portal – Documents tab|**Done**|
|4|Document requests (admin)|Admin – Document requests tab|**Done**|
|5|Approvals + Triggers|Admin – Workflows tab|Pending|

---

## Files to Add / Touch

|Area|New files|Touch|
|------|-----------|--------|
|**Admin – Workflows**|`src/features/admin/modules/admin-workflows.ts` (or `admin-approvals.ts` + `admin-triggers.ts`), `src/styles/admin/workflows.css`|`admin/index.html` (sidebar button + tab content), `src/features/admin/admin-dashboard.ts` (register tab, load data), `src/styles/bundles/admin.css` (import workflows.css)|
|**Admin – Document requests**|`src/features/admin/modules/admin-document-requests.ts`, `src/styles/admin/document-requests.css`|`admin/index.html`, `admin-dashboard.ts`, admin bundle|
|**Admin – Knowledge base**|`src/features/admin/modules/admin-knowledge-base.ts`, `src/styles/admin/knowledge-base.css`|`admin/index.html`, `admin-dashboard.ts`, admin bundle|
|**Client – Documents**|`src/features/client/modules/portal-document-requests.ts`, `src/styles/client-portal/documents.css`|`client/portal.html`, portal navigation, portal bundle|
|**Client – Help**|`src/features/client/modules/portal-help.ts` (or `portal-knowledge-base.ts`), `src/styles/client-portal/help.css`|`client/portal.html`, portal navigation, portal bundle|

---

## Related Documentation

- [UX_GUIDELINES.md](./UX_GUIDELINES.md) — Icons, buttons, forms, spacing.
- [PORTAL_CSS_DESIGN.md](./PORTAL_CSS_DESIGN.md) — Portal bundles and theme variables.
- [REUSABLE_COMPONENTS_AUDIT.md](./REUSABLE_COMPONENTS_AUDIT.md) — What should use shared components; migration status for dropdowns, modals, status badges.
- [WIREFRAME_AND_COMPONENTS.md](./WIREFRAME_AND_COMPONENTS.md) — Wireframe mode, sidebar/layout reuse, component system overview.
- [current_work.md](../current_work.md) — API Endpoints Without Frontend UI (Gap) and tier priorities.
- **Components:** `src/components/` (filter-select, portal-modal, icon-button, status-badge, view-toggle, empty-state, etc.); `src/utils/` (table-dropdown, modal-dropdown, loading-utils, focus-trap).
