# Reusable Components Audit

**Date:** February 6, 2026
**Scope:** Admin and Client Portal — identify UI that should use shared components but currently uses native elements or duplicate implementations.

---

## 1. Dropdowns / selects

**Two reusable dropdown components:**

- **Table dropdown:** `createTableDropdown()` in `src/components/table-dropdown.ts` (re-exported from `src/utils/table-dropdown.ts`) — for **tables only**: table cells (status, actions) and table header filters (e.g. pagination “Per page”). Compact custom trigger + menu; uses `.table-dropdown.custom-dropdown`, `.custom-dropdown-trigger`, `.custom-dropdown-menu`, `.custom-dropdown-item`.
- **Form select:** `createFormSelect()` in `src/components/form-select.ts` — for **forms only**: modals and inline forms (client, category, type, status). Native `<select>` with `form-input` styling; mount in a div, call `setOptions()` when data loads.

**Legacy / alternative:**

- **Modal dropdown:** `initModalDropdown(selectElement, options)` in `src/utils/modal-dropdown.ts` — wraps an existing native `<select>` in custom dropdown UI for modals. Prefer `createFormSelect` for new form fields (no static HTML select).

### Not using reusable dropdown

|Location|Current|Should use|
|----------|---------|------------|
|**Admin Dashboard – Contact submissions table**|Native `<select class="contact-status-select">` in table cell|`createTableDropdown()` with contact status options (same as Contacts tab).|
|**Admin Contacts renderer**|Native `<select class="contact-status-select">` in table cell|`createTableDropdown()` — align with admin-contacts module which already uses it.|
|**Client Portal – Files page**|Native `<select id="files-project-filter">`, `#files-type-filter`, `#files-category-filter` in `client/portal.html`|Either `initModalDropdown()` (wrap existing selects in portal-files.ts) or build dropdowns with `createTableDropdown()` (no status dot) for consistent portal look.|
|**Admin Leads – Cancel reason**|Native `<select id="cancel-reason">` in panel/modal|`initModalDropdown()` or `createTableDropdown()` with reason options.|
|**Admin Proposals – Template form**|Native `<select id="template-project-type">`, `#template-tier">`|`initModalDropdown()` when form is in a modal/panel.|
|**Admin Projects – Invoice / deposit modals**|Native `<select id="invoice-type-select">`, `#deposit-credit-select">`|`initModalDropdown()` (same pattern as other modal selects in admin-projects).|
|**Admin Project Details – Invoice type**|Native `<select id="invoice-type-select">`|`initModalDropdown()`.|
|**Confirm dialog – Multi-prompt**|Native `<select>` for field type “select” in `confirm-dialog.ts`|Optional: use custom dropdown inside dialog for consistency; native select is acceptable for one-off dialogs.|

**Already using reusable dropdown:** Leads/Contacts/Projects table status (createTableDropdown), Proposals status (createTableDropdown), Add/Edit project modals – client/type/budget/timeline/status (initModalDropdown), Edit client status (initModalDropdown), Pagination “Per page” (createTableDropdown).

---

## 2. Project Details – Status dropdown (duplicate implementation)

**Location:** `src/features/admin/admin-project-details.ts`

**Current:** Custom inline implementation: `setupCustomStatusDropdown()` with `.custom-dropdown-trigger`, `.custom-dropdown-option` (different class than `.custom-dropdown-item`), and manual open/close/update logic.

**Should use:** Either:

- **Modal dropdown:** Replace the project-details status UI with a hidden `<select>` and `initModalDropdown(select, { placeholder: 'Select status...' })`, then sync with existing hidden input / save logic, or  
- **Table dropdown:** Build the dropdown with `createTableDropdown({ options: PROJECT_STATUS_OPTIONS, currentValue, onChange, showStatusDot: true })` and wire `onChange` to update the hidden input and save.

This removes duplicate dropdown behavior and keeps one implementation (table-dropdown or modal-dropdown) for status selects.

---

## 3. Status badges

**Reusable component:** `createStatusBadge(label, variant)` and `getStatusBadgeHTML(label, variant)` in `src/components/status-badge.ts` — uses `.status-badge` and `.status-{variant}` (shared CSS: `portal-badges.css`).

**Using reusable (CURRENT):**

- admin-clients (getStatusBadgeHTML)
- admin-contacts (getStatusBadgeHTML) ✅ Migrated
- admin-projects (getStatusBadgeHTML) ✅ Migrated
- admin-invoices (getStatusBadgeHTML)
- admin-dashboard (getStatusBadgeHTML)
- admin-contacts.renderer (getStatusBadgeHTML)
- admin-tasks (getStatusBadgeHTML)
- admin-system-status (getStatusBadgeHTML)
- page-title (createStatusBadge)
- project-details/invoices (getStatusBadgeHTML) ✅ Migrated

**Status:** Most admin modules now use the reusable badge component. Invoice-specific statuses (draft, sent, viewed, partial, paid, overdue) added to `portal-badges.css`.

---

## 4. Buttons

**Reusable:** Portal button classes in `src/styles/shared/portal-buttons.css` (`.btn`, `.btn-primary`, `.btn-secondary`, `.icon-btn`, etc.) and design doc in PORTAL_CSS_DESIGN.md.

**Audit:** No full audit done here. Worth checking that all admin/portal actions use these classes (e.g. no one-off `.button` or inline styles) so hierarchy (primary/secondary/destructive/icon-only) stays consistent.

---

## 5. Modals

**Reusable:** `ModalComponent` in `src/components/modal-component.ts` (used via component store). Confirmations use `confirm-dialog.ts` (shared).

**Current:** Admin modals (add project, edit project, edit client, invoice, etc.) are mostly ad-hoc: HTML in `admin/index.html`, show/hide and wiring in feature TS. They don’t use `ModalComponent`.

**Recommendation:** Lower priority. Migrating admin modals to a shared modal component would improve consistency and accessibility but is a larger refactor. Optional follow-up.

---

## 6. Summary

|Category|Reusable component|Status|
|----------|--------------------|----------------------------|
|**Status badges**|createStatusBadge, getStatusBadgeHTML|✅ COMPLETE - All admin modules migrated to use reusable component. Invoice statuses added to CSS.|
|**Dropdowns**|createTableDropdown, initModalDropdown|⚠️ PENDING - Dashboard contact status, Client portal file filters, Leads cancel reason, Proposals template selects, Projects invoice/deposit selects need migration.|
|**Project details status**|table-dropdown or modal-dropdown|⚠️ PENDING - Custom setupCustomStatusDropdown with different class names.|
|**Modals**|ModalComponent, confirm-dialog|📝 LOW PRIORITY - Admin feature modals are ad-hoc HTML + JS. Large refactor, optional.

**Remaining work:**

1) Replace native contact status selects (dashboard + contacts renderer) with `createTableDropdown`.
2) Replace project-details status custom dropdown with table-dropdown or modal-dropdown.
3) Convert remaining native selects (files filters, cancel reason, template, invoice/deposit) to reusable dropdown.
