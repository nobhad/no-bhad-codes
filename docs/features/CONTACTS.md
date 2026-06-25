# Contact Form Submissions

**Status:** Complete
**Last Updated:** 2026-06-25

## Overview

The Contacts module manages submissions from the main website's contact form. Admins can view, respond to, and convert submissions to clients or leads.

**Location:** Admin Dashboard → Contacts tab
**File:** `src/react/features/admin/contacts/`

## Submission Statuses

| Status | Description | Color |
|--------|-------------|-------|
| `new` | Unread submission | Warning |
| `read` | Viewed but not replied | Info |
| `replied` | Reply sent | Success |
| `archived` | Archived submission | Muted |

## Features

### Submission Management

- View all contact form submissions
- Filter by status, date range
- Search by name, email, message
- Mark as read/responded
- Archive submissions
- Mark as spam

### Actions

- **Convert to Client**: Create client account from submission
- **Reply**: Open email client with pre-filled recipient (client-side; no reply endpoint)
- **Archive**: Move to archived status
- **Delete**: Bulk delete only (`POST /api/admin/contacts/bulk-delete`; no single-delete endpoint)

### Table Features

- Sortable columns
- Pagination (10, 25, 50, 100 per page)
- Status dropdown for quick updates
- Export to CSV
- Bulk selection and actions

## Database Schema

### contact_submissions

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Submitter name |
| `email` | TEXT | Submitter email |
| `subject` | TEXT | Message subject |
| `message` | TEXT | Full message |
| `status` | TEXT | Submission status |
| `ip_address` | TEXT | Submitter IP |
| `user_agent` | TEXT | Browser info |
| `message_id` | TEXT | Unique message identifier |
| `read_at` | TEXT | When first viewed |
| `replied_at` | TEXT | When replied |
| `created_at` | TEXT | Submission time |
| `updated_at` | TEXT | Last update |

## API Endpoints

```text
GET /api/admin/contacts
  Returns: contacts across all clients with stats

POST /api/admin/contacts
  Body: { clientId, name, email, phone?, title?, isPrimary? }
  Returns: created contact

PUT /api/admin/contacts/:contactId
  Body: { firstName?, lastName?, email?, phone?, role?, isPrimary? }
  Returns: updated contact

POST /api/admin/contacts/bulk-delete
  Body: { contactIds }
  Returns: { deleted }

PUT /api/admin/contact-submissions/:id/status
  Body: { status }
  Returns: success message

POST /api/admin/contact-submissions/:id/convert-to-client
  Body: { sendInvitation?: boolean }
  Returns: created client

POST /api/contact (public)
  Body: { name, email, subject, message }
  Returns: submission confirmation
```

## UI Components

### Submissions Table

| Column | Description |
|--------|-------------|
| Checkbox | Bulk selection |
| Name | Submitter name |
| Email | Email with copy button |
| Subject | Message subject |
| Status | Status dropdown |
| Date | Submission date |
| Actions | View, Convert, Archive, Delete |

### Detail Modal

- Full submission details
- Message content
- Contact information
- Conversion actions
- Reply button

### Stats Bar

- Total submissions
- New (unread)
- Read
- Responded

## Files

| File | Purpose |
|------|---------|
| `src/react/features/admin/contacts/` | Contacts module |
| `server/routes/admin/contacts.ts` | Admin contact endpoints |
| `server/routes/admin/leads/core.ts` | Contact-submission status/convert endpoints |
| `src/modules/ui/contact-form.ts` | Public contact form |
| `src/react/features/admin/contacts/ContactDetailPanel.tsx` | Slide-in detail panel (Overview) |

## Change Log

### March 16, 2026 - Auto-Response + Validation

- Contact form now sends auto-response email to submitter confirming receipt
- HTML escaping applied to all user content in admin notification emails (XSS prevention)
- File modified: `server/routes/api.ts`
