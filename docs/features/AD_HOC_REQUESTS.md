# Ad Hoc Requests System

**Status:** Complete
**Last Updated:** 2026-06-25

## Overview

The Ad Hoc Requests System enables clients to submit custom feature requests, change orders, and support tickets outside the original project scope. It provides complete lifecycle management from request submission through invoicing.

**Key Capabilities:**

- Client request submission with file attachments
- Admin quote builder and approval workflow
- Time tracking integration for billable work
- Invoice generation (single and bundled)
- Revenue analytics and reporting

**Access:**

- Admin: Dashboard > Requests tab
- Client: Portal > Requests section

---

## Features

### 1. Request Types

| Type | Description |
|------|-------------|
| `feature` | New functionality request |
| `change` | Modification to existing features |
| `bug_fix` | Bug report requiring fix |
| `enhancement` | Improvement to existing feature |
| `support` | General support request |

### 2. Urgency Levels

| Level | Description | Typical Response |
|-------|-------------|------------------|
| `normal` | Standard priority | 3-5 business days |
| `priority` | Elevated priority | 1-2 business days |
| `urgent` | High priority | Same day |
| `emergency` | Critical/blocking | Immediate |

### 3. Request Status Lifecycle

```text
submitted → reviewing → quoted → approved → in_progress → completed
                ↘ declined
```

| Status | Description |
|--------|-------------|
| `submitted` | Client submitted request |
| `reviewing` | Admin reviewing request |
| `quoted` | Quote sent to client |
| `approved` | Client approved quote |
| `in_progress` | Work has begun |
| `completed` | Work finished |
| `declined` | Request was declined |

---

## Database Schema

### ad_hoc_requests Table

```sql
CREATE TABLE ad_hoc_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'reviewing', 'quoted', 'approved', 'in_progress', 'completed', 'declined'
  )),
  request_type TEXT NOT NULL CHECK (request_type IN (
    'feature', 'change', 'bug_fix', 'enhancement', 'support'
  )),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('normal', 'priority', 'urgent', 'emergency')),
  estimated_hours REAL,
  flat_rate REAL,
  hourly_rate REAL,
  quoted_price REAL,
  attachment_file_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by TEXT
);
```

*Attachments use the `attachment_file_id` column (migration 060), not a separate table.*

### ad_hoc_request_invoices Table

```sql
CREATE TABLE ad_hoc_request_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES ad_hoc_requests(id) ON DELETE CASCADE,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Request Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ad-hoc-requests` | List all requests (admin) |
| GET | `/api/ad-hoc-requests/:requestId` | Get request details |
| POST | `/api/ad-hoc-requests` | Create new request |
| PUT | `/api/ad-hoc-requests/:requestId` | Update request |
| DELETE | `/api/ad-hoc-requests/:requestId` | Delete request |
| POST | `/api/ad-hoc-requests/:requestId/convert-to-task` | Convert request to task |
| POST | `/api/ad-hoc-requests/bulk-delete` | Bulk delete requests |

### Client Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ad-hoc-requests/my-requests` | Get client's requests |
| POST | `/api/ad-hoc-requests/my-requests` | Submit new request (client) |
| POST | `/api/ad-hoc-requests/my-requests/:requestId/approve` | Approve quote |
| POST | `/api/ad-hoc-requests/my-requests/:requestId/decline` | Decline request |

### Quote & Approval

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ad-hoc-requests/:requestId/send-quote` | Send quote to client |

### Time Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ad-hoc-requests/:requestId/time-entries` | Get time entries for request |
| POST | `/api/ad-hoc-requests/:requestId/time-entries` | Log time entry |

### Invoicing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ad-hoc-requests/:requestId/invoice` | Generate invoice for single request |
| POST | `/api/ad-hoc-requests/invoice/bundle` | Generate bundled invoice for multiple requests |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ad-hoc-requests/summary/monthly` | Monthly revenue summary |

---

## Admin UI Components

### Requests List View

- Filter by status, type, urgency, client
- Search by title/description
- Status badge with color coding
- Action menu (view, edit, delete)

### Request Detail Modal

**Sections:**

1. **Request Information** - Title, description, type, urgency
2. **Client Context** - Client name, project, submission date
3. **Quote Builder** - Pricing strategy, hours, rates
4. **Time Entries** - Logged work hours with summary
5. **Attachments** - Uploaded files/screenshots
6. **Actions** - Convert to task, generate invoice

### Time Entry Form

- Hours input (decimal)
- Date picker
- Description field
- Billable/non-billable toggle
- Custom hourly rate option

### Invoice Generation Modal

- Single request or bundle mode
- Request selection checkboxes
- Due date picker
- Notes field
- Preview before generation

### Analytics Widget

Located on Analytics > Business tab:

- MTD revenue card
- Invoice count card
- Average amount card
- Largest invoice card
- Monthly trend list
- Top clients list

---

## Client Portal UI

### Request Submission

- Title and description fields
- Type dropdown
- Urgency selector
- File attachment upload
- Submit button

### Request History

- List of submitted requests
- Status indicators
- Quote details when available
- Accept/decline buttons for quotes

---

## File Locations

| File | Purpose |
|------|---------|
| `server/routes/ad-hoc-requests.ts` | API routes |
| `server/services/ad-hoc-request-service.ts` | Business logic |
| `server/database/migrations/056_ad_hoc_requests.sql` | Database schema |
| `src/react/features/admin/ad-hoc-requests/` | Admin UI module |
| `src/react/features/portal/ad-hoc-requests/` | Client portal UI |
| `src/styles/client-portal/requests.css` | Request styling |

---

## Test Coverage

**Test File:** `tests/unit/server/ad-hoc-requests.test.ts`
**Total Tests:** 47

### Coverage Areas

| Area | Tests | Description |
|------|-------|-------------|
| Time Entry Endpoints | 11 | GET/POST time entries, validation |
| Invoice Generation | 14 | Single request and bundled invoices |
| Analytics Endpoints | 10 | Monthly summary, revenue calculations |
| Error Handling | 12 | Validation, status checks, DB errors |

### Test Categories

**Time Entry Tests:**

- Fetch time entries for request
- Create billable time entry
- Create non-billable time entry
- Handle custom hourly rates
- Validate positive hours required
- Handle missing request

**Invoice Tests:**

- Generate invoice from single request
- Generate bundled invoice from multiple requests
- Validate request status (must be completed)
- Validate same project for bundle
- Include line items per request
- Calculate totals correctly

**Analytics Tests:**

- Monthly summary calculation
- Client grouping
- Date range filtering
- Revenue trend calculation
- Top clients by revenue

---

## Related Documentation

- [Time Tracking](./TIME_TRACKING.md) - Time entry integration
- [Invoices](./INVOICES.md) - Invoice generation
- [Projects](./PROJECTS.md) - Project context
- [Client Portal](./CLIENT_PORTAL.md) - Client-facing interface

---

## Change Log

### February 10, 2026 - Documentation Created

- Created comprehensive AD_HOC_REQUESTS.md
- Documented database schema, API endpoints, UI components
- Added test coverage section with 47 tests

### February 9, 2026 - System Complete

- Time entry logging UI
- Invoice generation (single and bundled)
- Analytics widget on dashboard
- Test suite completed
