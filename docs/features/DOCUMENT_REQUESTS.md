# Document Requests System

**Status:** Complete
**Last Updated:** February 8, 2026

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

## Files

| File | Purpose |
|------|---------|
| `src/features/admin/modules/admin-document-requests.ts` | Admin module |
| `src/features/client/modules/portal-document-requests.ts` | Client module |
| `server/routes/document-requests.ts` | API endpoints |
| `src/utils/table-filter.ts` | Filter configuration |
| `src/utils/table-bulk-actions.ts` | Bulk action utilities |
