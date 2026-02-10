# Ad Hoc Requests System

**Status:** Complete
**Last Updated:** February 10, 2026

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

### 4. Pricing Strategies

| Strategy | Description |
|----------|-------------|
| `flat_rate` | Fixed price for entire request |
| `hourly_rate` | Per-hour billing |
| `quoted_price` | Custom quoted amount |

---

## Database Schema

### ad_hoc_requests Table

```sql
CREATE TABLE ad_hoc_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  request_type TEXT DEFAULT 'feature',
  urgency TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'submitted',
  estimated_hours DECIMAL(10,2),
  flat_rate DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),
  quoted_price DECIMAL(10,2),
  pricing_strategy TEXT,
  approved_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### ad_hoc_request_attachments Table

```sql
CREATE TABLE ad_hoc_request_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES ad_hoc_requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Request Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ad-hoc-requests` | List all requests (admin) |
| GET | `/api/ad-hoc-requests/:id` | Get request details |
| POST | `/api/ad-hoc-requests` | Create new request |
| PUT | `/api/ad-hoc-requests/:id` | Update request |
| DELETE | `/api/ad-hoc-requests/:id` | Delete request |

### Client Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ad-hoc-requests/client/:clientId` | Get client's requests |
| POST | `/api/ad-hoc-requests/submit` | Submit new request (client) |

### Quote & Approval

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ad-hoc-requests/:id/quote` | Send quote to client |
| POST | `/api/ad-hoc-requests/:id/approve` | Approve quote |
| POST | `/api/ad-hoc-requests/:id/decline` | Decline request |

### Time Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ad-hoc-requests/:id/time-entries` | Get time entries for request |
| POST | `/api/ad-hoc-requests/:id/time-entries` | Log time entry |

### Invoicing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ad-hoc-requests/:id/invoice` | Generate invoice for single request |
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
| `src/features/admin/modules/admin-ad-hoc-requests.ts` | Admin UI module |
| `src/features/client/modules/portal-ad-hoc-requests.ts` | Client portal UI |
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
