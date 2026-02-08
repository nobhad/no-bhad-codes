# Contact Form Submissions

**Status:** Complete
**Last Updated:** February 8, 2026

## Overview

The Contacts module manages submissions from the main website's contact form. Admins can view, respond to, and convert submissions to clients or leads.

**Location:** Admin Dashboard → Contacts tab
**File:** `src/features/admin/modules/admin-contacts.ts`

## Submission Statuses

| Status | Description | Color |
|--------|-------------|-------|
| `new` | Unread submission | Warning |
| `read` | Viewed but not responded | Info |
| `responded` | Reply sent | Success |
| `archived` | Archived submission | Muted |
| `spam` | Marked as spam | Danger |

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
- **Convert to Lead**: Create lead from submission
- **Reply**: Open email client with pre-filled recipient
- **Archive**: Move to archived status
- **Delete**: Permanently remove

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
| `phone` | TEXT | Phone number (optional) |
| `company` | TEXT | Company name (optional) |
| `subject` | TEXT | Message subject |
| `message` | TEXT | Full message |
| `status` | TEXT | Submission status |
| `source` | TEXT | Form source (contact, intake) |
| `ip_address` | TEXT | Submitter IP |
| `user_agent` | TEXT | Browser info |
| `read_at` | TEXT | When first viewed |
| `responded_at` | TEXT | When responded |
| `created_at` | TEXT | Submission time |
| `updated_at` | TEXT | Last update |

## API Endpoints

```text
GET /api/contacts
  Query: status, search, limit, offset
  Returns: paginated submissions with stats

GET /api/contacts/:id
  Returns: single submission

PUT /api/contacts/:id
  Body: { status }
  Returns: updated submission

POST /api/contacts/:id/convert-to-client
  Body: { sendInvite?: boolean }
  Returns: created client

POST /api/contacts/:id/convert-to-lead
  Returns: created lead

DELETE /api/contacts/:id
  Returns: success message

POST /api/contacts (public)
  Body: { name, email, phone?, company?, subject, message }
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
| `src/features/admin/modules/admin-contacts.ts` | Contacts module |
| `src/features/admin/renderers/admin-contacts.renderer.ts` | Detail modal renderer |
| `server/routes/contacts.ts` | API endpoints |
| `src/utils/table-filter.ts` | Filter configuration |
| `src/utils/table-dropdown.ts` | Status dropdown |
| `src/modules/ui/contact-form.ts` | Public contact form |
