# Tables, Archive & Delete: Small-Feature Audit

**Date:** January 28, 2026  
**Purpose:** Audit **granular** features—tables (filter, sort, export, pagination, bulk), archive (soft delete, restore, “show archived”), and delete (hard delete, confirm, bulk)—across admin and portal. What’s implemented, what’s missing.

**Related:** [CRM_CMS_DEEP_DIVE.md](./CRM_CMS_DEEP_DIVE.md), [CLIENT_PORTAL_DEEP_DIVE.md](./CLIENT_PORTAL_DEEP_DIVE.md).

---

## 1. Table Features (Admin)

### 1.1 Tables Using `table-filter` (Leads, Contacts, Projects, Clients)

| Feature | Implemented | Notes |
|--------|-------------|--------|
| **Search** | Yes | Expandable search input; searches configurable `searchFields` |
| **Status filter** | Yes | Multi-select checkboxes (status dropdown) |
| **Date range** | Yes | `dateStart` / `dateEnd`; uses `dateField` from config |
| **Sort** | Yes | Sortable column headers; `sortableColumns` per table |
| **Clear All** | Yes | Resets search, status, dates, sort |
| **Filter persistence** | Yes | `localStorage` via `storageKey` per table |
| **Filter badge** | Yes | Count of active filters when dropdown open |

**Configs:** `LEADS_FILTER_CONFIG`, `CONTACTS_FILTER_CONFIG`, `PROJECTS_FILTER_CONFIG`, `CLIENTS_FILTER_CONFIG` in `table-filter.ts`.

### 1.2 Proposals Table

| Feature | Implemented | Notes |
|--------|-------------|--------|
| **Filter** | Partial | Buttons: All, Pending, Reviewed, Accepted. **No Rejected or Converted** in filter tabs |
| **Search** | No | — |
| **Sort** | No | — |
| **Date range** | No | — |
| **Table-filter integration** | No | Uses its own filter buttons + API `?status=` |

### 1.3 Table Features Missing Everywhere

| Feature | Status | Notes |
|--------|--------|--------|
| **Pagination (UI)** | No | All data loaded; filter/sort client-side. Proposals API has `limit`/`offset`; visitors API has pagination; **no pagination UI** in admin tables |
| **Page size** | No | — |
| **Row selection** | No | No checkboxes, no “select all” |
| **Bulk actions** | No | No bulk archive, delete, export, or status change |
| **Column visibility** | No | No hide/show columns |
| **Export per table** | Partial | `AdminExportService` has leads/contacts/projects (JSON); **not wired in UI**. Dashboard export = analytics/visitors/performance (System tab / Overview) only |
| **CSV export** | Partial | `exportCsv()` exists in admin-export service; **not exposed** for leads/contacts/projects |
| **Inline row actions** | Yes | Status dropdown (all), Activate/Invite (leads), Archive (contacts), Delete (clients). See §2–3 |

---

## 2. Archive

### 2.1 Implemented

| Entity | What exists | Notes |
|--------|-------------|--------|
| **Contacts** | Archive | Status → `archived`; “Archive” button in detail panel. Status filter includes “Archived.” |
| **Contacts** | Archive removal | Archive btn removed from detail UI once archived |

### 2.2 Missing

| Feature | Status | Notes |
|--------|--------|--------|
| **Restore from archived** | No | No “Restore” or “Unarchive” for contacts (or anything else) |
| **“Show archived” toggle** | No | Archived contacts appear only when “Archived” status filter selected; no global “include archived” toggle |
| **Archive for Leads** | No | Leads have status workflow; no archive |
| **Archive for Clients** | No | Clients are hard-deleted only |
| **Archive for Projects** | No | No archive; delete only via API |
| **Archive for Proposals** | No | Rejected/converted; no archive |
| **Trash / Archive view** | No | No dedicated “Archived” or “Trash” view |

---

## 3. Delete

### 3.1 Implemented

| Entity | What exists | Notes |
|--------|-------------|--------|
| **Clients** | Hard delete | `DELETE /api/clients/:id`; confirm dialog (“cannot be undone”) |
| **Milestones** | Hard delete | `DELETE /api/projects/:id/milestones/:mid`; confirm in project details |
| **Files (uploads)** | Hard delete | Portal: own files only; confirm. Admin: project files deletable |
| **Lead** | No delete | Activate, Invite only; no delete |

### 3.2 Missing

| Feature | Status | Notes |
|--------|--------|--------|
| **Project delete (UI)** | No | `DELETE /api/projects/:id` exists; **no delete button** in admin projects UI |
| **Lead delete** | No | No delete action |
| **Contact delete** | No | Archive only; no hard delete |
| **Proposal delete** | No | Reject / Convert only; no delete |
| **Convert contact → client** | No | Planned in `current_work.md`; would add “Convert to Client” in contact details |
| **Bulk delete** | No | No row selection → bulk delete |
| **Soft delete** | No | No soft-delete flag; deletes are hard |
| **Undo delete** | No | No “Undo” or restore-after-delete |

---

## 4. Confirmations & Dialogs

| Feature | Implemented | Notes |
|--------|-------------|--------|
| **Confirm dialog** | Yes | `confirm-dialog.ts`: custom styled, `confirmDialog` / `confirmDanger` |
| **Danger variant** | Yes | Red confirm for destructive actions |
| **Focus trap** | Yes | Restores focus on close |
| **Used for** | — | Client delete, milestone delete, file delete, proposal reject/convert, clear data, reset analytics, lead activate cancel, etc. |

---

## 5. Export

| Export | Implemented | Wired in UI | Format |
|--------|-------------|------------|--------|
| **Analytics** | Yes | Yes (Overview / System) | JSON |
| **Visitors** | Yes | Yes | JSON |
| **Performance** | Yes | Yes | JSON |
| **Leads** | Yes | **No** | JSON (admin-export); CSV available in service |
| **Contacts** | Yes | **No** | JSON; CSV available |
| **Projects** | Yes | **No** | JSON; CSV available |
| **Proposals** | No | — | — |

**Clear old data / Reset analytics:** Buttons exist (`#clear-old-data`, `#reset-analytics`); confirm flows in place. Logic for “clear”/“reset” is mostly placeholder (e.g. “Clear old data” toast success without backend clear).

---

## 6. Visitors Table (Analytics)

| Feature | Implemented | Notes |
|--------|-------------|--------|
| **List** | Yes | Visitor sessions |
| **API pagination** | Yes | `limit` / `offset` |
| **Pagination UI** | Partial | `.visitors-pagination` in CSS; **verify if used** |
| **Export** | Yes | Via System/Overview export |
| **Search / filter** | Unknown | Check analytics tab |

---

## 7. Summary: Implemented vs Missing

### Tables

- **Done:** Search, status filter, date range, sort, Clear All, persistence, filter badge (Leads, Contacts, Projects, Clients). Inline actions (status, activate, invite, archive, delete where applicable).
- **Missing:** Pagination UI, page size, row selection, bulk actions, column visibility. **Per-table export in UI** (leads/contacts/projects). Proposals: search, sort, date range, **Rejected/Converted** in filters.

### Archive

- **Done:** Contact archive (status + button).
- **Missing:** Restore, “show archived” toggle, archive for other entities, trash/archive view.

### Delete

- **Done:** Client, milestone, file delete with confirm.
- **Missing:** Project delete in UI, lead/contact/proposal delete, bulk delete, soft delete, undo.

### Export

- **Done:** Analytics, visitors, performance export (JSON) in UI; admin-export has leads/contacts/projects (JSON + CSV) but **not in UI**.
- **Missing:** Wire leads/contacts/projects export into UI (e.g. per-tab Export). Proposals export.

---

## 8. Suggested Priorities (Small Wins)

### Quick

1. **Proposals filter** — Add “Rejected” and “Converted” to filter tabs.
2. **Export per table** — Add Export (JSON or CSV) for Leads, Contacts, Projects tabs using `AdminExportService`.
3. **“Clear All” includes search** — Already does; verify and document.

### Small

4. **Contact restore** — “Restore” when status = archived (revert to e.g. “read” or “responded”).
5. **Project delete in UI** — Delete button in project details or list; use existing `DELETE /api/projects/:id` + confirm.
6. **Proposals search** — Simple client/project name search (client- or API-side).

### Medium

7. **Pagination (admin tables)** — Optional server-side pagination for Leads/Contacts/Projects/Clients; add limit/offset + “Load more” or prev/next.
8. **“Show archived” toggle** — Global or per-table toggle to include archived contacts (and later others) in lists.
9. **Bulk archive** — Row checkboxes + “Archive selected” for contacts (and optionally others).

---

## 9. References

- **Table filter:** `src/utils/table-filter.ts`, `LEADS_FILTER_CONFIG`, etc.
- **Table dropdown:** `src/utils/table-dropdown.ts` (status dropdowns).
- **Confirm dialogs:** `src/utils/confirm-dialog.ts`.
- **Export:** `src/features/admin/services/admin-export.service.ts`.
- **Archive (contacts):** `admin-contacts.ts` (Archive button, `updateContactStatus(..., 'archived')`).
- **Delete (clients):** `admin-clients.ts` (`deleteClient`, `DELETE /api/clients/:id`).
- **Delete (milestones):** `admin-project-details.ts` → `deleteMilestone` → `DELETE /api/projects/:id/milestones/:id`.
- **Delete (files):** `portal-files.ts` (client); uploads routes (admin).
