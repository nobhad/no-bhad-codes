# Table Column Analysis

**Generated:** 2026-02-05

Complete analysis of all admin table columns, verifying header-to-data alignment and identifying inconsistencies.

---

## Summary of Findings

### Status Overview

| Table | Header/Data Match | Discrepancies |
|-------|:-----------------:|---------------|
| Leads | MATCH | None |
| Clients | MATCH | None |
| Contacts | MATCH | No Actions column (intentional - row click only) |
| Projects | MATCH | No Actions column (intentional - row click only) |
| Invoices | MATCH | None |
| Proposals | MATCH | None |
| Time Tracking | MATCH | None |
| Document Requests | MATCH | "Due" instead of "Due Date" |
| KB Categories | MATCH | None |
| KB Articles | MATCH | None |
| Visitors | MATCH | No Actions column (read-only analytics) |
| Project Files | **MISMATCH** | Docs say "Download + Delete", actual is "Preview + Download" |
| Project Invoices | **MISMATCH** | Docs say "View + Edit", actual has 5 conditional buttons |
| Tasks List View | **MISMATCH** | Docs show 6 cols with Checklist, actual has 5 cols (no Checklist) |

### Inconsistencies Found

1. **Due Date Naming**: "Due" (Doc Requests) vs "Due Date" (Invoices, Project Invoices, Tasks)
2. **Tasks List View Column Count**: Documentation shows 6 columns, code has 5
3. **Project Files Actions**: Documentation incorrect about available actions
4. **Project Invoices Actions**: Documentation incomplete (5 conditional buttons not documented)

---

## Verified Column Orders (All Tables)

### 1. Leads Table

**Source:** `admin/index.html:462-477` + `admin-leads.ts:651-673`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | ☐ (checkbox) | `createRowCheckbox('leads', lead.id)` | |
| 2 | Project | `lead.id` (link when active status) | |
| 3 | Lead | `company_name` OR `contact_name` + `email` (identity cell) | |
| 4 | Type | `lead.project_type` | |
| 5 | Budget | `lead.budget_range` | |
| 6 | Status | Status dropdown with `LEAD_STATUS_OPTIONS` | |
| 7 | Date | `lead.created_at` | |
| 8 | Actions | Convert button (conditional) | |

---

### 2. Clients Table

**Source:** `admin/index.html:650-664` + `admin-clients.ts:507-523`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | ☐ (checkbox) | `createRowCheckbox('clients', client.id)` | |
| 2 | Client | `company_name` OR `name` + `email` (identity cell) | |
| 3 | Type | `client_type` ("Personal" / "Business") | |
| 4 | Projects | `client.project_count` | |
| 5 | Status | `status` badge + optional invite button | |
| 6 | Created | `client.created_at` | |
| 7 | Actions | View button (eye icon) | |

---

### 3. Contacts Table

**Source:** `admin/index.html:505-512` + `admin-contacts.ts:227-236`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | Contact | `name` + `company` + `email` (identity cell) | |
| 2 | Message | `message` (truncated, 200px max-width) | |
| 3 | Status | Status dropdown with `CONTACT_STATUS_OPTIONS` | |
| 4 | Date | `submission.created_at` | |

**Note:** No Actions column - row click opens detail panel

---

### 4. Projects Table

**Source:** `admin/index.html:575-589` + `admin-projects.ts:425-434`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | ☐ (checkbox) | `createRowCheckbox('projects', project.id)` | |
| 2 | Project | `project.project_name` (identity cell with contact/company) | |
| 3 | Type | `project.project_type` | |
| 4 | Budget | `project.budget_range` | |
| 5 | Timeline | `project.timeline` | |
| 6 | Status | Status dropdown with `PROJECT_STATUS_OPTIONS` | |
| 7 | Start | `project.start_date` | |

**Note:** No Actions column - row click opens project detail view

---

### 5. Invoices Table

**Source:** `admin/index.html:725-740` + `admin-invoices.ts:336-356`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | ☐ (checkbox) | `getPortalCheckboxHTML()` | |
| 2 | Invoice # | `invoice.invoice_number` or "INV-{id}" | |
| 3 | Client | `invoice.client_name` | |
| 4 | Project | `invoice.project_name` or "-" | |
| 5 | Amount | `formatCurrency(getAmount(invoice))` | |
| 6 | Status | Badge (computed overdue if unpaid + past due) | |
| 7 | Due Date | `invoice.due_date` or "-" | |
| 8 | Actions | View (eye) + Edit (pencil) buttons | |

---

### 6. Proposals Table (Dynamic)

**Source:** `admin-proposals.ts:400-411` (headers) + `admin-proposals.ts:525-549` (data)

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | ☐ (checkbox) | `createRowCheckbox('proposals', proposal.id)` | |
| 2 | Client | `proposal.client.name` or `proposal.client.company` | |
| 3 | Project | `proposal.project.name` + `proposal.projectType` | |
| 4 | Tier | `proposal.selectedTier` (good/better/best) | |
| 5 | Price | `formatPrice(proposal.finalPrice)` + maintenance option | |
| 6 | Status | Status dropdown | |
| 7 | Date | `formatDate(proposal.createdAt)` | |
| 8 | Actions | View + Edit + Delete buttons | |

---

### 7. Time Tracking Table (Dynamic)

**Source:** `admin-time-tracking.ts:218-224` (headers) + `admin-time-tracking.ts:254-274` (data)

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | Date | `formatDate(entry.date)` | |
| 2 | Description | `entry.description` | |
| 3 | Task | `entry.task_title` or "-" | |
| 4 | Duration | `formatDuration(entry.duration_minutes)` | |
| 5 | Billable | `entry.is_billable ? 'Yes' : 'No'` (badge) | |
| 6 | Actions | Edit (pencil) + Delete (trash) buttons | |

---

### 8. Document Requests Table

**Source:** `admin/index.html:1497-1511` + `admin-document-requests.ts:298-323`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | ☐ (checkbox) | `createRowCheckbox('document-requests', r.id)` | |
| 2 | Title | `r.title` | |
| 3 | Client | `r.client_name` or `r.client_id` | |
| 4 | Type | `r.document_type` or "-" | |
| 5 | Status | `statusLabel(r.status)` (badge) | |
| 6 | **Due** | `r.due_date` | |
| 7 | Actions | View + Start Review (conditional) + Approve/Reject (conditional) + Remind (conditional) + Delete | |

**Inconsistency:** Uses "Due" instead of "Due Date" (unlike Invoices, Project Invoices, Tasks)

---

### 9. KB Categories Table

**Source:** `admin/index.html:1618-1626` + `admin-knowledge-base.ts:116-131`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | Name | `c.name` | |
| 2 | Slug | `c.slug` (as `<code>`) | |
| 3 | Articles | `c.article_count ?? 0` | |
| 4 | Active | `c.is_active ? 'Yes' : 'No'` | |
| 5 | Actions | Edit (pencil) + Delete (trash) buttons | |

---

### 10. KB Articles Table

**Source:** `admin/index.html:1654-1664` + `admin-knowledge-base.ts:151-172`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | Title | `a.title` | |
| 2 | Category | `a.category_name` or "-" | |
| 3 | Slug | `a.slug` (as `<code>`) | |
| 4 | Featured | `a.is_featured ? 'Yes' : 'No'` | |
| 5 | Published | `a.is_published ? 'Yes' : 'No'` | |
| 6 | Updated | `formatDate(a.updated_at)` | |
| 7 | Actions | Edit (pencil) + Delete (trash) buttons | |

---

### 11. Visitors Table (Analytics)

**Source:** `admin/index.html:1360-1369` + `admin-analytics.ts`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | Session ID | `session.session_id.substring(0, 8)...` | |
| 2 | Started | Session start time (formatted) | |
| 3 | Duration | `formatDuration(session.total_time_on_site)` | |
| 4 | Pages | `session.page_views` | |
| 5 | Device | `capitalizeFirst(session.device_type)` | |
| 6 | Location | `session.city`, `session.country` or "-" | |

**Note:** No Actions column (read-only analytics data)

---

### 12. Project Files Sub-Table

**Source:** `admin-projects.ts:1153-1197`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | File | `file.original_filename` or `file.filename` | |
| 2 | Size | `formatFileSize(file.file_size)` | |
| 3 | Uploaded | `formatDate(file.created_at)` | |
| 4 | Actions | **Preview (conditional) + Download** | |

**Documentation Discrepancy:** TABLE_AUDIT.md says "Download + Delete" but actual code shows "Preview (conditional) + Download" - NO delete button exists

---

### 13. Project Invoices Sub-Table

**Source:** `admin-projects.ts:1602-1653`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | Invoice # | `invoice.invoice_number` | |
| 2 | Amount | `invoice.amount_total` (formatted currency) | |
| 3 | Due Date | `invoice.due_date` | |
| 4 | Status | `invoice.status` (badge) | |
| 5 | Actions | **Send (conditional) + Edit (conditional) + Mark Paid (conditional) + Preview + Download** | |

**Documentation Discrepancy:** TABLE_AUDIT.md says "View + Edit" but actual code has 5 contextual buttons

---

### 14. Tasks List View

**Source:** `admin-tasks.ts:291-334`

| # | Header | Data Source | Verified |
|---|--------|-------------|:--------:|
| 1 | Task | `task.title` + `task.description` (truncated) | |
| 2 | Priority | `PRIORITY_CONFIG[task.priority].label` (badge) | |
| 3 | Status | `STATUS_CONFIG[task.status].label` (badge) | |
| 4 | Due Date | `task.due_date` (with overdue class) | |
| 5 | Assignee | `task.assignee_name` or "-" | |

**Documentation Discrepancy:** TABLE_AUDIT.md shows 6 columns including "Checklist" but actual code has only 5 columns - NO Checklist column exists

---

## Action Items

### High Priority (Documentation Fixes)

1. **Update TABLE_AUDIT.md - Tasks List View**
   - Remove Checklist column from documentation
   - Change from 6 to 5 columns

2. **Update TABLE_AUDIT.md - Project Files Sub-Table**
   - Change Actions from "Download + Delete" to "Preview (conditional) + Download"

3. **Update TABLE_AUDIT.md - Project Invoices Sub-Table**
   - Change Actions from "View + Edit" to full list: "Send + Edit + Mark Paid + Preview + Download (all conditional)"

### Medium Priority (Consistency Improvements)

4. **Standardize Due Date column naming**
   - Document Requests uses "Due"
   - All others use "Due Date"
   - **Decision needed:** Keep "Due" (shorter) or change to "Due Date" (consistent)

### Low Priority (Intentional Differences - Document Only)

5. **Tables without Actions column** (intentional)
   - Contacts: Uses row click for detail panel
   - Projects: Uses row click for project detail view
   - Visitors: Read-only analytics (no actions needed)

---

## Column Count Summary

| Table | Columns | Has Checkbox | Has Actions |
|-------|:-------:|:------------:|:-----------:|
| Leads | 8 | Yes | Yes |
| Clients | 7 | Yes | Yes |
| Contacts | 4 | No | No |
| Projects | 7 | Yes | No |
| Invoices | 8 | Yes | Yes |
| Proposals | 8 | Yes | Yes |
| Time Tracking | 6 | No | Yes |
| Document Requests | 7 | Yes | Yes |
| KB Categories | 5 | No | Yes |
| KB Articles | 7 | No | Yes |
| Visitors | 6 | No | No |
| Project Files | 4 | No | Yes |
| Project Invoices | 5 | No | Yes |
| Tasks List | 5 | No | No |
