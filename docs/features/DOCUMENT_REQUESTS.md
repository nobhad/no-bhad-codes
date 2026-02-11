# Document Requests System

**Status:** Complete
**Last Updated:** February 11, 2026

## Overview

The Document Requests System allows administrators to request documents from clients, track submission status, and review uploaded files. Clients see pending requests in their portal and can upload documents directly.

## Access Points

### Admin Dashboard

- Sidebar: "Doc Requests" tab
- Shows all requests with filtering and pagination
- **File:** `src/features/admin/modules/admin-document-requests.ts`

### Client Portal

- Dashboard widget showing pending requests
- Upload interface for each request
- **File:** `src/features/client/modules/portal-document-requests.ts`

## Request Statuses

| Status | Description | Color |
|--------|-------------|-------|
| `requested` | Awaiting client action | Warning |
| `viewed` | Client has seen the request | Info |
| `uploaded` | Document uploaded, awaiting review | Primary |
| `under_review` | Admin reviewing document | Purple |
| `approved` | Document accepted | Success |
| `rejected` | Document rejected (re-upload needed) | Danger |

## Features

### Admin Features

- Create single document requests
- Create requests from templates
- Set priority and due dates
- Review uploaded documents
- Approve or reject with comments
- Bulk actions (remind, cancel)
- Filter by status, client, priority
- Export to CSV

### Client Features

- View pending requests with due dates
- Upload documents directly
- See approval status
- Re-upload if rejected

## Database Schema

### document_requests

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `client_id` | INTEGER | FK to clients |
| `project_id` | INTEGER | Optional FK to projects |
| `requested_by` | TEXT | Admin who created request |
| `title` | TEXT | Request title |
| `description` | TEXT | Detailed description |
| `document_type` | TEXT | Type category |
| `priority` | TEXT | low, medium, high, urgent |
| `status` | TEXT | Request status |
| `due_date` | TEXT | Due date (ISO) |
| `file_id` | INTEGER | FK to uploaded file |
| `uploaded_by` | TEXT | Client who uploaded |
| `uploaded_at` | TEXT | Upload timestamp |
| `reviewed_by` | TEXT | Admin who reviewed |
| `reviewed_at` | TEXT | Review timestamp |
| `review_notes` | TEXT | Approval/rejection notes |
| `created_at` | TEXT | Timestamp |
| `updated_at` | TEXT | Timestamp |

### document_request_templates

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Template name |
| `description` | TEXT | Template description |
| `document_type` | TEXT | Default type |
| `default_priority` | TEXT | Default priority |
| `is_active` | BOOLEAN | Active flag |

## API Endpoints

### Admin Endpoints

```text
GET /api/document-requests
  Query: status, clientId, priority, limit, offset
  Returns: paginated requests

POST /api/document-requests
  Body: { clientId, projectId?, title, description, documentType, priority, dueDate }
  Returns: created request

POST /api/document-requests/from-template
  Body: { templateId, clientId, projectId?, dueDate }
  Returns: created request

PUT /api/document-requests/:id
  Body: { title, description, priority, dueDate }
  Returns: updated request

DELETE /api/document-requests/:id
  Returns: success message

POST /api/document-requests/:id/review
  Body: { action: 'approve' | 'reject', notes? }
  Returns: updated request

POST /api/document-requests/:id/remind
  Returns: reminder sent confirmation
```

### Client Endpoints

```text
GET /api/document-requests/my-requests
  Returns: client's pending requests

POST /api/document-requests/:id/upload
  Body: FormData with file
  Returns: upload confirmation
```

## Integration with Project Files

Document requests are integrated with the project Files tab, allowing admins to link uploads to pending requests.

### Admin Files Tab Integration

When uploading files in project details, admins can:

1. Select a file type from predefined options
2. Optionally link the upload to a pending document request
3. Request status automatically updates to 'uploaded' when linked

### API Endpoints

```text
GET /api/document-requests/project/:projectId/pending
  Returns: pending requests for a specific project
  Used by: Admin Files tab upload modal
```

### Upload Flow

1. Admin selects files in project Files tab
2. Upload modal appears with file preview
3. Admin selects file type (optional)
4. Admin selects pending request to link (optional)
5. Files uploaded via `POST /api/projects/:id/files`
6. If request selected, `POST /api/document-requests/:id/upload` called with file ID
7. Request status updates to 'uploaded'

### Files Modified for Integration

- `src/features/admin/project-details/files.ts` - Upload modal with request linking
- `server/routes/document-requests.ts` - Added pending requests endpoint

---

## Move to Files After Approval (Planned)

**Status:** Planned
**Priority:** Medium

Automatically move approved documents to project Files tab.

### Requirements

- After admin approves a document request:
  1. Uploaded file MOVES from Document Requests to project Files tab
  2. File placed in "Forms" folder
  3. Original document request marked as complete
  4. File retains original metadata (uploaded by, date, etc.)
- Document request shows link to file in Files tab after approval

### Workflow

1. Client uploads document to fulfill request
2. Admin reviews uploaded document
3. Admin clicks "Approve"
4. System moves file to project Files tab (Forms folder)
5. Request status changes to "approved"
6. Request shows "View in Files" link

### API Changes (Planned)

Update `POST /api/document-requests/:id/review`:

- When `action: 'approve'`:
  - Move file from document_requests to uploads table
  - Set `folder_id` to Forms folder
  - Update `document_requests.status` to 'approved'
  - Store `file_id` reference in request

### Database Changes (Planned)

Add to `document_requests` table:

| Column | Type | Description |
|--------|------|-------------|
| `moved_to_file_id` | INTEGER | FK to uploads after approval |

---

## Files

| File | Purpose |
|------|---------|
| `src/features/admin/modules/admin-document-requests.ts` | Admin module |
| `src/features/client/modules/portal-document-requests.ts` | Client module |
| `src/features/admin/project-details/files.ts` | Files tab integration |
| `server/routes/document-requests.ts` | API endpoints |
| `src/utils/table-filter.ts` | Filter configuration |
| `src/utils/table-bulk-actions.ts` | Bulk action utilities |
