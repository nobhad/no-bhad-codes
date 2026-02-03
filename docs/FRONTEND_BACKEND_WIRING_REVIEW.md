# Frontend-Backend Wiring Review

**Date:** February 2, 2026

This document summarizes the review of frontend API calls against backend endpoints to ensure correct wiring.

---

## Summary

| Status | Count |
|--------|-------|
| Correct | Most endpoints |
| Fixed | 7 |
| Outstanding | 0 |

---

## Fixes Applied

### 1. Admin Overview - Revenue Metrics
- **Issue:** Frontend called `/api/admin/metrics/revenue` which does not exist.
- **Backend:** Revenue analytics live at `/api/analytics/quick/revenue`.
- **Fix:** Updated `admin-overview.ts` to call `/api/analytics/quick/revenue?days=30` and parse `summary.total_revenue`.

### 2. Admin Files - File Download
- **Issue:** Frontend used `/api/projects/${projectId}/files/${fileId}/download` which does not exist.
- **Backend:** File download is served by `/api/uploads/file/:fileId`.
- **Fix:** Updated `admin-files.ts` to use `/api/uploads/file/${currentFileId}` for downloads.

### 3. Admin Files - File Delete
- **Issue:** Frontend called `DELETE /api/projects/${projectId}/files/${fileId}` which does not exist.
- **Backend:** File delete is at `DELETE /api/uploads/file/:fileId`.
- **Fix:** Updated `admin-files.ts` to use `/api/uploads/file/${currentFileId}` for deletes.

### 4. Admin Clients - Reset Password
- **Issue:** Frontend called `POST /api/clients/:id/reset-password` which does not exist.
- **Backend:** Clients have `POST /:id/send-invite` which sends a link to set/change password.
- **Fix:** Wired "Reset Password" to use `send-invite` (same outcome: client receives email to set/change password).

### 5. Admin System Status - Test Email
- **Issue:** Frontend called `POST /api/admin/test-email` which did not exist.
- **Fix:** Added `POST /api/admin/test-email` endpoint in `server/routes/admin.ts` to send a test email to ADMIN_EMAIL or the logged-in admin.

### 6. Admin System Status - Run Scheduler
- **Issue:** Frontend called `POST /api/admin/run-scheduler` which did not exist.
- **Fix:** Added `POST /api/admin/run-scheduler` endpoint that triggers `checkOverdueInvoices`, `triggerReminderProcessing`, and `triggerInvoiceGeneration`.

---

## Outstanding Item (Resolved Feb 2, 2026)

### Admin Client Details - Client Notes
- **Issue:** Frontend called `GET /api/clients/:id/notes`, `POST /api/clients/:id/notes`, `PUT /api/clients/notes/:noteId`, `DELETE /api/clients/notes/:noteId` with no backend support.
- **Fix:** Added full backend support:
  - Migration `046_client_notes.sql` - `client_notes` table (id, client_id, author, content, is_pinned, created_at, updated_at)
  - `client-service.ts` - `getNotes`, `addNote`, `updateNote`, `deleteNote` methods
  - `clients.ts` routes - GET /:id/notes, POST /:id/notes, PUT /notes/:noteId, DELETE /notes/:noteId
- **Status:** Resolved.

---

## Verified Correct Wiring

The following API usage was verified against backend routes:

| Frontend Call | Backend Route | Status |
|---------------|---------------|--------|
| `POST /api/auth/login` | Auth login | OK |
| `POST /api/auth/admin/login` | Admin login | OK |
| `GET /api/clients/me` | Clients /me | OK |
| `PUT /api/clients/me/password` | Clients /me/password | OK |
| `GET /api/clients/me/dashboard` | Clients /me/dashboard | OK |
| `GET /api/clients/me/notifications` | Clients /me/notifications | OK |
| `PUT /api/clients/me/notifications` | Clients /me/notifications | OK |
| `PUT /api/clients/me/billing` | Clients /me/billing | OK |
| `GET /api/projects` | Projects / | OK |
| `POST /api/projects/request` | Projects /request | OK |
| `GET /api/projects/:id` | Projects /:id | OK |
| `GET /api/projects/:id/milestones` | Projects /:id/milestones | OK |
| `GET /api/uploads/project/:id` | Uploads /project/:projectId | OK |
| `GET /api/uploads/file/:id` | Uploads /file/:fileId | OK |
| `GET /api/messages/threads` | Messages /threads | OK |
| `GET /api/messages/threads/:id/messages` | Messages /threads/:threadId/messages | OK |
| `PUT /api/messages/threads/:id/read` | Messages /threads/:threadId/read | OK |
| `GET /api/messages/unread-count` | Messages /unread-count | OK |
| `GET /api/document-requests/my-requests` | Document requests /my-requests | OK |
| `POST /api/document-requests/:id/view` | Document requests /:id/view | OK |
| `POST /api/document-requests/:id/upload` | Document requests /:id/upload | OK |
| `GET /api/kb/categories` | Knowledge base /categories | OK |
| `GET /api/invoices/project/:id` | Invoices project endpoint | OK |
| `GET /api/admin/leads` | Admin /leads | OK |
| `GET /api/clients/activities/recent` | Clients /activities/recent | OK |
| `GET /api/clients/:id/notes` | Clients /:id/notes | OK |
| `POST /api/clients/:id/notes` | Clients /:id/notes | OK |
| `PUT /api/clients/notes/:noteId` | Clients /notes/:noteId | OK |
| `DELETE /api/clients/notes/:noteId` | Clients /notes/:noteId | OK |

---

## Files Modified

- `src/features/admin/modules/admin-overview.ts` – Revenue endpoint and response parsing
- `src/features/admin/modules/admin-files.ts` – File download and delete endpoints
- `src/features/admin/modules/admin-clients.ts` – Reset password wired to send-invite
- `server/routes/admin.ts` – Added test-email and run-scheduler endpoints
