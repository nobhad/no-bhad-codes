# Reusable Components Audit

**Date:** February 7, 2026
**Scope:** Admin and Client Portal — identify UI that should use shared components but currently uses native elements or duplicate implementations.

---

## 1. Dropdowns / selects

**Two reusable dropdown components:**

- **Table dropdown:** `createTableDropdown()` in `src/components/table-dropdown.ts` (re-exported from `src/utils/table-dropdown.ts`) — for **tables only**: table cells (status, actions) and table header filters (e.g. pagination “Per page”). Compact custom trigger + menu; uses `.table-dropdown.custom-dropdown`, `.custom-dropdown-trigger`, `.custom-dropdown-menu`, `.custom-dropdown-item`.
- **Form select:** `createFormSelect()` in `src/components/form-select.ts` — for **forms only**: modals and inline forms (client, category, type, status). Native `<select>` with `form-input` styling; mount in a div, call `setOptions()` when data loads.

**Legacy / alternative:**

- **Modal dropdown:** `initModalDropdown(selectElement, options)` in `src/utils/modal-dropdown.ts` — wraps an existing native `<select>` in custom dropdown UI for modals. Prefer `createFormSelect` for new form fields (no static HTML select).

### Dropdown Migration Status

✅ **COMPLETE** - All form selects now use `initModalDropdown()`:

| Location | Status |
|----------|--------|
| Admin Leads – Cancel reason | ✅ Wrapped (line 910) |
| Admin Proposals – Template selects | ✅ Wrapped (lines 909, 913) |
| Admin Projects – Invoice/deposit modals | ✅ Wrapped (lines 863, 2052, 2057) |
| Admin Project Details – Invoice type | ✅ Wrapped (line 168) |
| Client Portal – Files filters | ✅ Wrapped (lines 122, 486, 490) |
| Admin Document Requests – Client selects | ✅ Wrapped (lines 447, 456) |

**Table dropdowns (createTableDropdown):** Leads/Contacts/Projects table status, Proposals status, Pagination "Per page".

**Modal dropdowns (initModalDropdown):** All modal form selects listed above, plus Add/Edit project modals, Edit client status.

---

## 2. Project Details – Status dropdown

**Location:** `src/features/admin/admin-project-details.ts`

**Status:** ⚠️ INTENTIONAL EXCEPTION

**Current:** Custom inline implementation: `setupCustomStatusDropdown()` with `.custom-dropdown-trigger`, `.custom-dropdown-option`.

**Why not migrated:** This dropdown has specialized behavior:

- Auto-save on selection change
- Direct API integration with project update
- Status dot color indicators
- Integration with hidden input and page title update

Migrating would require significant refactoring for minimal benefit. The custom implementation is self-contained and works correctly.

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

**Reusable:** Portal button classes in `src/styles/shared/portal-buttons.css` (`.btn`, `.btn-primary`, `.btn-secondary`, `.icon-btn`, etc.) and design doc in CSS_ARCHITECTURE.md.

**Audit:** No full audit done here. Worth checking that all admin/portal actions use these classes (e.g. no one-off `.button` or inline styles) so hierarchy (primary/secondary/destructive/icon-only) stays consistent.

---

## 5. Modals

**Reusable:** `ModalComponent` in `src/components/modal-component.ts` (used via component store). Confirmations use `confirm-dialog.ts` (shared).

**Current:** Admin modals (add project, edit project, edit client, invoice, etc.) are mostly ad-hoc: HTML in `admin/index.html`, show/hide and wiring in feature TS. They don’t use `ModalComponent`.

**Recommendation:** Lower priority. Migrating admin modals to a shared modal component would improve consistency and accessibility but is a larger refactor. Optional follow-up.

---

## 6. View Toggles

**Reusable component:** `createViewToggle(container, options)` in `src/components/view-toggle.ts` — for switching between view modes (Board/List, Table/Pipeline, Proposals/Templates).

**Standard:** All view toggle options MUST include `iconSvg` property with an appropriate SVG icon. Text-only toggles are not allowed.

**Using reusable (CURRENT):**

| Module | Views | Status |
|--------|-------|--------|
| admin-leads | Table / Pipeline | ✅ Has icons |
| admin-tasks | Board / List | ✅ Has icons |
| admin-global-tasks | Board / List | ✅ Has icons |
| admin-overview (tasks) | Board / List | ✅ Has icons |
| admin-proposals | Proposals / Templates | ✅ Has icons |
| admin-files | Grid / List | ✅ Has icons |

**Icon Mapping:**

| View Type | Icon Description |
|-----------|------------------|
| Board/Kanban | 3 vertical rectangles (varying heights) |
| List | 3 horizontal lines with bullet points |
| Table | Rectangle with grid lines |
| Grid | 2x2 squares |
| Proposals | Document with text lines |
| Templates | Layout rectangle with sections |

**Status:** ✅ COMPLETE - All view toggles have icons

---

## 7. Summary

| Category | Reusable component | Status |
|----------|-------------------|--------|
| **Status badges** | createStatusBadge, getStatusBadgeHTML | ✅ COMPLETE - All admin modules use reusable component |
| **Form dropdowns** | initModalDropdown | ✅ COMPLETE - All modal/form selects wrapped |
| **Table dropdowns** | createTableDropdown | ✅ COMPLETE - All table status selects use shared component |
| **View toggles** | createViewToggle | ✅ COMPLETE - All view toggles have icons |
| **Project details status** | Custom implementation | ⚠️ EXCEPTION - Intentionally custom (auto-save behavior) |
| **Modals** | ModalComponent, confirm-dialog | 📝 LOW PRIORITY - Admin modals are ad-hoc HTML + JS |

**Audit Status:** ✅ COMPLETE

All reusable component migrations are done. Only intentional exceptions remain (project details status dropdown, ad-hoc modals).
