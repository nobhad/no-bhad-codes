# API Documentation

## Overview

The No Bhad Codes API provides a RESTful interface for client management, project tracking, and administrative operations. All endpoints use JSON for request and response payloads unless otherwise specified.

**Base URL:** `https://nobhad.codes/api`
**Authentication:** HttpOnly Cookie (JWT) - see below
**Content-Type:** `application/json`

### Request ID

All API responses include an `X-Request-ID` header for request correlation and debugging. Clients may send `X-Request-ID` on requests; if provided, the same ID is echoed. Otherwise the server generates a UUID.

## Authentication

**Updated January 13, 2026:** All authentication uses HttpOnly cookies for enhanced security.

### JWT Token Structure

```typescript
interface JWTPayload {
  id: number;           // User ID
  email: string;        // User email
  type: 'admin' | 'client';  // User role
  iat: number;          // Issued at timestamp
  exp: number;          // Expiration timestamp
}
```

### Cookie-Based Authentication (Primary Method)

The API uses HttpOnly cookies for secure token storage. Tokens are automatically sent with requests:

```http

Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

```

**Cookie Properties:**

|Property|Value|Purpose|
|----------|-------|---------|
|`httpOnly`|`true`|Prevents JavaScript access (XSS protection)|
|`secure`|`true` (production)|Only sent over HTTPS|
|`sameSite`|`strict`|CSRF protection|
|`path`|`/`|Cookie sent to all same-origin requests|
|`maxAge`|1h (admin) / 7d (client)|Token expiration|

### Authorization Header (Fallback)

For API clients that cannot use cookies, Bearer token authentication is still supported:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note:** Cookie authentication takes precedence when both are present.

## Error Responses

All API endpoints return consistent error responses:

```typescript
interface ErrorResponse {
  error: string;        // Human-readable error message
  code: string;         // Machine-readable error code
  details?: any;        // Additional error context (optional)
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `500` - Internal Server Error

### Error Codes

- `NO_TOKEN` - Authorization header missing
- `TOKEN_EXPIRED` - JWT token has expired
- `INVALID_TOKEN` - JWT token is malformed or invalid
- `ACCESS_DENIED` - User lacks required permissions
- `VALIDATION_ERROR` - Request data validation failed
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `DUPLICATE_RESOURCE` - Resource already exists

## Authentication Endpoints

### POST `/auth/login`

Authenticate user credentials. JWT token is set as an HttpOnly cookie.

**Request:**

```json
{
  "email": "client@example.com",
  "password": "securePassword123"
}
```

**Response Headers:**

```http
Set-Cookie: auth_token=eyJhbGciOiJIUzI1NiIs...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
```

**Response Body:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "client@example.com",
      "name": "John Doe",
      "companyName": "Acme Corp",
      "contactName": "John Doe",
      "status": "active",
      "isAdmin": false
    },
    "expiresIn": "7d"
  }
}
```

(Some endpoints may return `user` and `expiresIn` at top level for backward compatibility; the canonical shape uses `data`.)

**Note:** The JWT token is NOT returned in the response body. It is set as an HttpOnly cookie that the browser automatically includes in subsequent requests.

**Error Responses:**

- `400` - Invalid email format
- `401` - Invalid credentials
- `429` - Too many login attempts

### POST `/auth/logout`

Invalidate current authentication token by clearing the HttpOnly cookie.

**Authentication:** Cookie or Bearer token

**Response Headers:**

```http
Set-Cookie: auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0
```

**Response Body:**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

### POST `/auth/refresh`

Refresh JWT token before expiration. Returns a new token in the response body (client must store it or send Cookie for subsequent requests; this endpoint does not set an HttpOnly cookie).

**Authentication:** Cookie or Bearer token

**Response Body:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "7d"
  }
}
```

### POST `/auth/magic-link`

Request a magic link for passwordless login.

**Request:**

```json
{
  "email": "client@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "If an account with that email exists, a login link has been sent."
}
```

**Notes:**

- Always returns success for security (doesn't reveal if email exists)

## Invoices

### GET `/invoices`

Admin endpoint. Returns a JSON array of invoices. Requires authentication as an admin user (HttpOnly cookie or `Authorization: Bearer`).

Query parameters (optional):

- `status` - single status or comma-separated statuses (draft,sent,viewed,partial,paid,overdue,cancelled)
- `clientId` - integer client id to filter
- `projectId` - integer project id to filter
- `search` - text search against invoice number and notes
- `dateFrom`, `dateTo` - ISO date strings to filter issued date
- `dueDateFrom`, `dueDateTo` - ISO date strings to filter due date
- `minAmount`, `maxAmount` - numeric range filter
- `invoiceType` - `standard` or `deposit`
- `limit` - number of results (default 100)
- `offset` - pagination offset (default 0)

Response: Array of invoice objects in snake_case (fields include `id`, `invoice_number`, `client_id`, `project_id`, `amount_total`, `amount_paid`, `status`, `due_date`, `issued_date`, `line_items`, `notes`, `created_at`, `updated_at`, etc.)

Example:

```http
GET /api/invoices?status=pending,overdue&limit=50
Authorization: Bearer <admin-token>
```

```json
[{
  "id": 123,
  "invoice_number": "INV-000123",
  "client_id": 45,
  "project_id": 12,
  "amount_total": 2500,
  "amount_paid": 0,
  "status": "overdue",
  "due_date": "2025-12-01",
  "issued_date": "2025-11-01",
  "line_items": [
    { "description": "Website build", "quantity": 1, "rate": 2500, "amount": 2500 }
  ],
  "notes": "Payment overdue",
  "created_at": "2025-11-01T12:34:56Z",
  "updated_at": "2025-12-02T10:11:12Z"
}]
```

Notes:

- This endpoint is now available at both `/api/invoices` and `/api/v1/invoices` (mounted by the server).
- If filters are omitted the endpoint returns the latest invoices paginated by `limit`/`offset`.
- Magic link expires in 15 minutes
- Rate limited: 3 requests per 15 minutes per IP

### POST `/auth/verify-magic-link`

Verify magic link token and authenticate user. JWT token is set as HttpOnly cookie.

**Request:**

```json
{
  "token": "abc123def456..."
}
```

**Response Headers:**

```http
Set-Cookie: auth_token=eyJhbGciOiJIUzI1NiIs...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
```

**Response Body (Success):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "client@example.com",
      "name": "John Smith",
      "companyName": "Acme Corp",
      "contactName": "John Smith",
      "status": "active",
      "isAdmin": false
    },
    "expiresIn": "7d"
  }
}
```

**Note:** The JWT token is NOT returned in the response body. It is set as an HttpOnly cookie.

**Error Responses:**

- `400` - Invalid or expired token
- `401` - Account inactive

### POST `/auth/verify-invitation`

Verify a client invitation token before password setup.

**Request:**

```json
{
  "token": "abc123def456..."
}
```

**Response (Success):**

```json
{
  "success": true,
  "data": {
    "email": "client@example.com",
    "name": "John Smith",
    "company": "Acme Corp"
  }
}
```

**Response (Invalid/Expired Token):** Returns error response with `success: false`, `error` message, and `code` (e.g. `INVALID_TOKEN`, `TOKEN_EXPIRED`).

**Error Responses:**

- `400` - Missing token
- `401` - Invalid or expired token

### POST `/auth/set-password`

Set password for a new client account using invitation token.

**Request:**

```json
{
  "token": "abc123def456...",
  "password": "NewSecurePassword123!"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Password set successfully. You can now log in.",
  "data": {
    "email": "client@example.com"
  }
}
```

**Error Responses:**

- `400` - Missing token or password
- `400` - Password validation failed (minimum 12 characters; must include uppercase, lowercase, number, and special character)
- `401` - Invalid or expired invitation token

## Admin Endpoints

### GET `/admin/audit-log`

Export audit logs with filters and pagination (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**

|Parameter|Type|Description|
|-----------|------|-------------|
|`action`|string|Filter by action (create, update, delete, login, etc.)|
|`entityType`|string|Filter by entity type (client, project, invoice, etc.)|
|`userEmail`|string|Filter by user email|
|`startDate`|string|Start date (ISO 8601)|
|`endDate`|string|End date (ISO 8601)|
|`limit`|number|Max records (default 100, max 500)|
|`offset`|number|Pagination offset (default 0)|

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "user_email": "admin@example.com",
      "user_type": "admin",
      "action": "create",
      "entity_type": "client",
      "entity_id": "42",
      "entity_name": "Acme Corp",
      "ip_address": "192.168.1.1",
      "created_at": "2024-01-18T11:00:00Z"
    }
  ],
  "count": 1
}
```

### GET `/admin/tasks`

Get all tasks across all active projects, ordered by priority and due date.

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (pending, in_progress, completed, blocked, cancelled) |
| `priority` | string | Filter by priority (low, medium, high, urgent) |
| `limit` | number | Max tasks to return (default 100, max 500) |

**Response (200 OK):**

```json
{
  "success": true,
  "tasks": [
    {
      "id": 1,
      "projectId": 42,
      "projectName": "Website Redesign",
      "clientName": "Acme Corp",
      "title": "Design homepage mockup",
      "description": "Create initial homepage design",
      "status": "in_progress",
      "priority": "high",
      "assignedTo": "admin",
      "dueDate": "2026-02-15",
      "estimatedHours": 8,
      "actualHours": 4,
      "createdAt": "2026-02-01T10:00:00Z",
      "updatedAt": "2026-02-08T14:30:00Z"
    }
  ],
  "count": 1
}
```

**Notes:**

- Returns tasks from all active (non-archived) projects
- Tasks are sorted by: priority (urgent first), then due date (earliest first)
- Used by the Global Tasks Kanban board on the Admin Dashboard

### POST `/admin/leads/:id/invite`

Invite a lead to create a client portal account.

**Headers:** `Authorization: Bearer <admin-token>`

**URL Parameters:**

- `id` - Lead ID to invite

**Response (Success):**

```json
{
  "success": true,
  "message": "Invitation sent successfully",
  "inviteLink": "https://nobhad.codes/client/set-password.html?token=abc123..."
}
```

**Process:**

1. Generates secure 64-character invitation token
2. Creates client account with hashed token
3. Sets token expiration (7 days)
4. Updates lead status to `active`
5. Sends invitation email with magic link

**Error Responses:**

- `400` - Lead already invited
- `404` - Lead not found
- `500` - Failed to send invitation

### Soft Delete & Recovery System

The system implements soft delete with a 30-day recovery window. Deleted items are marked with `deleted_at` timestamp rather than being permanently removed.

#### GET `/admin/deleted-items`

List all soft-deleted items with optional filtering.

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**

|Parameter|Type|Description|
|-----------|------|-------------|
|`type`|string|Filter by entity type: `client`, `project`, `invoice`, `lead`, `proposal`|

**Response (200 OK):**

```json
{
  "success": true,
  "items": [
    {
      "type": "client",
      "id": 42,
      "name": "Acme Corp",
      "deleted_at": "2026-02-01T10:00:00Z",
      "deleted_by": "admin@example.com",
      "days_until_permanent": 25,
      "expires_at": "2026-03-03T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### GET `/admin/deleted-items/stats`

Get counts of deleted items by entity type.

**Headers:** `Authorization: Bearer <admin-token>`

**Response (200 OK):**

```json
{
  "success": true,
  "stats": {
    "client": 2,
    "project": 5,
    "invoice": 1,
    "lead": 3,
    "proposal": 0
  },
  "total": 11
}
```

#### POST `/admin/deleted-items/:type/:id/restore`

Restore a soft-deleted item.

**Headers:** `Authorization: Bearer <admin-token>`

**URL Parameters:**

- `type` - Entity type: `client`, `project`, `invoice`, `lead`, `proposal`
- `id` - Entity ID

**Response (200 OK):**

```json
{
  "success": true,
  "message": "client restored successfully"
}
```

**Notes:**

- Restoring a parent does NOT automatically restore children (cascade deletes are permanent until restored individually)
- Paid invoices cannot be restored if they were voided

#### DELETE `/admin/deleted-items/:type/:id/permanent`

Permanently delete an item (bypasses 30-day recovery window).

**Headers:** `Authorization: Bearer <admin-token>`

**URL Parameters:**

- `type` - Entity type: `client`, `project`, `invoice`, `lead`, `proposal`
- `id` - Entity ID

**Response (200 OK):**

```json
{
  "success": true,
  "message": "client permanently deleted"
}
```

**Warning:** This action is irreversible.

#### POST `/admin/deleted-items/cleanup`

Manually trigger cleanup of expired soft-deleted items (items older than 30 days).

**Headers:** `Authorization: Bearer <admin-token>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Cleanup completed",
  "deleted": 5,
  "errors": 0
}
```

**Notes:**

- Cleanup runs automatically daily at 2 AM
- Use this endpoint to force immediate cleanup

### Soft Delete Cascade Behavior

When deleting entities, the following cascade behavior applies:

|Deleted Entity|Cascade Behavior|
|--------------|----------------|
|Client|Projects soft-deleted, proposals soft-deleted, unpaid invoices voided (paid invoices preserved)|
|Project|Proposals soft-deleted (invoices preserved)|
|Invoice|Paid invoices blocked from deletion; others voided|
|Lead|Standalone deletion (no cascade)|
|Proposal|Standalone deletion (no cascade)|

### Global Tasks

#### GET `/admin/tasks`

Get all tasks across all active projects, ordered by priority and due date.

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**

|Parameter|Type|Required|Description|
|---------|----|--------|-----------|
|`status`|string|No|Filter by status: pending, in_progress, completed, blocked, cancelled|
|`priority`|string|No|Filter by priority: low, medium, high, urgent|
|`limit`|integer|No|Max results to return (default: 100, max: 500)|

**Response (200 OK):**

```json
{
  "success": true,
  "tasks": [
    {
      "id": 1,
      "projectId": 10,
      "projectName": "Website Redesign",
      "clientName": "Acme Corp",
      "title": "Design homepage mockup",
      "description": "Create initial wireframes",
      "status": "in_progress",
      "priority": "high",
      "assignedTo": "Designer",
      "dueDate": "2026-02-10",
      "estimatedHours": 8,
      "actualHours": 4,
      "createdAt": "2026-02-01T10:00:00Z",
      "updatedAt": "2026-02-06T15:30:00Z"
    }
  ],
  "count": 1
}
```

**Notes:**

- Returns tasks from all active projects (not archived, not cancelled/completed)
- Tasks are ordered by: priority (urgent first), then due date (nulls last), then created date
- Use per-project endpoint `GET /projects/:id/tasks` for project-specific tasks

## Client Management Endpoints

### Client Settings API

#### GET `/clients/me`

Get current authenticated client's profile.

**Authentication:** Required (Client only)

**Response (200 OK):**

```json
{
  "success": true,
  "client": {
    "id": 5,
    "name": "John Doe",
    "email": "john@example.com",
    "company": "Acme Corp",
    "phone": "+1 555-0123",
    "notification_messages": 1,
    "notification_status": 1,
    "notification_invoices": 1,
    "notification_weekly": 0,
    "billing_company": "Acme Corp",
    "billing_address": "123 Main St",
    "billing_city": "New York",
    "billing_state": "NY",
    "billing_zip": "10001",
    "billing_country": "USA"
  }
}
```

#### PUT `/clients/me`

Update current client's profile information.

**Authentication:** Required (Client only)

**Request Body:**

```json
{
  "name": "John Doe",
  "company": "Acme Corp",
  "phone": "+1 555-0123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

#### PUT `/clients/me/password`

Change client's password.

**Authentication:** Required (Client only)

**Request Body:**

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error (400 Bad Request):**

```json
{
  "error": "Current password is incorrect"
}
```

#### PUT `/clients/me/notifications`

Update notification preferences.

**Authentication:** Required (Client only)

**Request Body:**

```json
{
  "messages": true,
  "status": true,
  "invoices": true,
  "weekly": false
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Notification preferences updated"
}
```

#### PUT `/clients/me/billing`

Update billing information.

**Authentication:** Required (Client only)

**Request Body:**

```json
{
  "company": "Acme Corp",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zip": "10001",
  "country": "USA"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Billing information updated"
}
```

### Admin Client Management

#### GET `/clients`

Retrieve all clients (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**

- `status` (optional): Filter by client status (`active`, `inactive`, `pending`)
- `limit` (optional): Limit number of results (default: 50)
- `offset` (optional): Skip number of results (default: 0)

**Response:**

```json
{
  "clients": [
    {
      "id": 1,
      "email": "client@example.com",
      "company_name": "Acme Corporation",
      "contact_name": "John Smith",
      "phone": "+1-555-0123",
      "status": "active",
      "project_count": 3,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-20T15:45:00Z"
    }
  ],
  "total": 25,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### GET `/clients/:id`

Get specific client details.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin can view any client; clients can only view their own profile

**Response:**

```json
{
  "client": {
    "id": 1,
    "email": "client@example.com",
    "company_name": "Acme Corporation",
    "contact_name": "John Smith",
    "phone": "+1-555-0123",
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-20T15:45:00Z"
  },
  "projects": [
    {
      "id": 101,
      "name": "Corporate Website Redesign",
      "status": "in-progress",
      "progress": 65,
      "start_date": "2024-01-15",
      "due_date": "2024-03-15",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST `/clients`

Create new client account (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request:**

```json
{
  "email": "newclient@example.com",
  "password": "securePassword123",
  "company_name": "New Company LLC",
  "contact_name": "Jane Doe",
  "phone": "+1-555-9876"
}
```

**Response:**

```json
{
  "message": "Client created successfully",
  "client": {
    "id": 26,
    "email": "newclient@example.com",
    "company_name": "New Company LLC",
    "contact_name": "Jane Doe",
    "phone": "+1-555-9876",
    "status": "active",
    "created_at": "2024-02-01T14:20:00Z"
  }
}
```

**Validation Rules:**

- `email`: Valid email format, unique
- `password`: Minimum 8 characters, must include uppercase, lowercase, number, special character
- `company_name`: Optional, max 255 characters
- `contact_name`: Optional, max 255 characters
- `phone`: Optional, valid phone number format

### PUT `/clients/:id`

Update client information.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin can update any client; clients can update their own profile (except status)

**Request:**

```json
{
  "company_name": "Updated Company Name",
  "contact_name": "Updated Contact",
  "phone": "+1-555-1111",
  "status": "inactive"
}
```

**Response:**

```json
{
  "message": "Client updated successfully",
  "client": {
    "id": 1,
    "email": "client@example.com",
    "company_name": "Updated Company Name",
    "contact_name": "Updated Contact",
    "phone": "+1-555-1111",
    "status": "inactive",
    "updated_at": "2024-02-01T16:30:00Z"
  }
}
```

### DELETE `/clients/:id`

Delete client account (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Response:**

```json
{
  "message": "Client deleted successfully"
}
```

## Project Management Endpoints

### GET `/projects`

List projects for authenticated user.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin sees all projects; clients see only their projects

**Query Parameters:**

- `status` (optional): Filter by status (`pending`, `in-progress`, `in-review`, `completed`, `on-hold`)
- `priority` (optional): Filter by priority (`low`, `medium`, `high`, `urgent`)
- `client_id` (optional, admin only): Filter by client ID

**Response:**

```json
{
  "projects": [
    {
      "id": 101,
      "name": "Corporate Website Redesign",
      "description": "Complete redesign of company website with modern UI/UX",
      "status": "in-progress",
      "priority": "high",
      "progress": 65,
      "client_id": 1,
      "client_name": "Acme Corporation",
      "start_date": "2024-01-15",
      "due_date": "2024-03-15",
      "budget": 15000.00,
      "stats": {
        "file_count": 12,
        "message_count": 28,
        "unread_count": 3
      },
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-02-01T09:15:00Z"
    }
  ]
}
```

### GET `/projects/:id`

Get detailed project information.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin can view any project; clients can view their own projects

**Response:**

```json
{
  "project": {
    "id": 101,
    "name": "Corporate Website Redesign",
    "description": "Complete redesign of company website with modern UI/UX",
    "status": "in-progress",
    "priority": "high",
    "progress": 65,
    "client_id": 1,
    "start_date": "2024-01-15",
    "due_date": "2024-03-15",
    "budget": 15000.00,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-02-01T09:15:00Z"
  },
  "files": [
    {
      "id": 501,
      "filename": "wireframes_v2.pdf",
      "original_name": "Website Wireframes V2.pdf",
      "file_size": 2048576,
      "mime_type": "application/pdf",
      "uploaded_by": "client",
      "created_at": "2024-01-20T14:30:00Z"
    }
  ],
  "messages": [
    {
      "id": 1001,
      "sender_type": "admin",
      "sender_name": "Project Manager",
      "message": "Initial wireframes have been completed and are ready for review.",
      "is_read": true,
      "created_at": "2024-01-18T11:15:00Z"
    }
  ],
  "updates": [
    {
      "id": 201,
      "title": "Wireframe Phase Completed",
      "content": "All initial wireframes have been completed and delivered to client for review.",
      "update_type": "milestone",
      "author": "Project Manager",
      "created_at": "2024-01-18T11:00:00Z"
    }
  ]
}
```

### POST `/projects`

Create new project (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request:**

```json
{
  "client_id": 1,
  "name": "E-commerce Platform Development",
  "description": "Custom e-commerce solution with payment integration",
  "priority": "high",
  "start_date": "2024-02-15",
  "due_date": "2024-06-15",
  "budget": 25000.00
}
```

**Response:**

```json
{
  "message": "Project created successfully",
  "project": {
    "id": 102,
    "client_id": 1,
    "name": "E-commerce Platform Development",
    "description": "Custom e-commerce solution with payment integration",
    "status": "pending",
    "priority": "high",
    "progress": 0,
    "start_date": "2024-02-15",
    "due_date": "2024-06-15",
    "budget": 25000.00,
    "created_at": "2024-02-01T16:45:00Z"
  }
}
```

### PUT `/projects/:id`

Update project details.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin can update any field; clients can only update description

**Request (Admin):**

```json
{
  "name": "Updated Project Name",
  "status": "in-progress",
  "priority": "urgent",
  "progress": 25,
  "due_date": "2024-07-15"
}
```

**Request (Client):**

```json
{
  "description": "Updated project requirements and specifications"
}
```

**Response:**

```json
{
  "message": "Project updated successfully",
  "project": {
    "id": 102,
    "name": "Updated Project Name",
    "status": "in-progress",
    "progress": 25,
    "updated_at": "2024-02-01T17:30:00Z"
  }
}
```

### DELETE `/projects/:id`

Delete project (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Response:**

```json
{
  "message": "Project deleted successfully"
}
```

## Milestone Management Endpoints

### GET `/projects/:id/milestones`

Get all milestones for a project.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "milestones": [
    {
      "id": 301,
      "title": "UI/UX Design Phase",
      "description": "Complete all design mockups and user interface components",
      "due_date": "2024-02-15",
      "completed_date": "2024-02-14",
      "is_completed": true,
      "deliverables": [
        "wireframes.pdf",
        "design_mockups.zip",
        "style_guide.pdf"
      ],
      "task_count": 10,
      "completed_task_count": 10,
      "progress_percentage": 100,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-02-14T16:20:00Z"
    },
    {
      "id": 302,
      "title": "Frontend Development",
      "description": "Implement responsive frontend based on approved designs",
      "due_date": "2024-03-15",
      "completed_date": null,
      "is_completed": false,
      "deliverables": [],
      "task_count": 12,
      "completed_task_count": 5,
      "progress_percentage": 42,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Note:** Milestones now include task progress data:

- `task_count`: Total number of tasks in the milestone
- `completed_task_count`: Number of completed tasks
- `progress_percentage`: Calculated percentage (0-100)
- `is_completed`: Auto-set to true when all tasks are complete

### POST `/projects/:id/milestones`

Create new milestone (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request:**

```json
{
  "title": "Backend API Development",
  "description": "Develop REST API with authentication and data management",
  "due_date": "2024-04-15",
  "deliverables": [
    "api_documentation.pdf",
    "postman_collection.json"
  ]
}
```

**Response:**

```json
{
  "message": "Milestone created successfully",
  "milestone": {
    "id": 303,
    "title": "Backend API Development",
    "description": "Develop REST API with authentication and data management",
    "due_date": "2024-04-15",
    "completed_date": null,
    "is_completed": false,
    "deliverables": [
      "api_documentation.pdf",
      "postman_collection.json"
    ],
    "created_at": "2024-02-01T18:15:00Z"
  }
}
```

### PUT `/projects/:id/milestones/:milestoneId`

Update milestone (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request:**

```json
{
  "title": "Updated Milestone Title",
  "due_date": "2024-04-20",
  "is_completed": true,
  "deliverables": [
    "api_documentation.pdf",
    "postman_collection.json",
    "deployment_guide.md"
  ]
}
```

**Response:**

```json
{
  "message": "Milestone updated successfully",
  "milestone": {
    "id": 303,
    "title": "Updated Milestone Title",
    "due_date": "2024-04-20",
    "completed_date": "2024-02-01T18:30:00Z",
    "is_completed": true,
    "deliverables": [
      "api_documentation.pdf",
      "postman_collection.json",
      "deployment_guide.md"
    ],
    "updated_at": "2024-02-01T18:30:00Z"
  }
}
```

### DELETE `/projects/:id/milestones/:milestoneId`

Delete milestone (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Response:**

```json
{
  "message": "Milestone deleted successfully"
}
```

### POST `/admin/milestones/backfill`

Generate default milestones AND tasks for existing projects that don't have any (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request:** (empty body)

**Response:**

```json
{
  "success": true,
  "message": "Backfill complete: 12 milestones and 87 tasks created for 4 projects",
  "data": {
    "projectsProcessed": 4,
    "milestonesCreated": 12,
    "tasksCreated": 87,
    "errors": []
  }
}
```

**Notes:**

- Only creates milestones for projects with zero existing milestones
- Automatically generates tasks for each milestone created
- Uses project type to determine which milestone and task templates to use
- Falls back to 'other' template for unknown project types
- Task due dates are distributed evenly before milestone due dates

### POST `/admin/tasks/backfill`

Generate tasks for existing milestones that don't have any tasks (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request:** (empty body)

**Response:**

```json
{
  "success": true,
  "message": "Backfill complete: 87 tasks created for 12 milestones",
  "data": {
    "milestonesProcessed": 12,
    "tasksCreated": 87,
    "errors": []
  }
}
```

**Notes:**

- Only creates tasks for milestones with zero existing tasks
- Useful when milestones exist but were created before task auto-generation was implemented
- Uses milestone title and project type to match task templates
- Task due dates are distributed evenly before milestone due dates

## Task Priority Escalation

### POST `/projects/:id/tasks/escalate-priorities`

Automatically escalate task priorities based on due date proximity (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request:** (empty body)

**Response:**

```json
{
  "message": "Priority escalation complete",
  "tasksUpdated": 3
}
```

**Escalation Rules:**

| Days Until Due | Minimum Priority |
|----------------|------------------|
| ≤ 1 (tomorrow/overdue) | urgent |
| ≤ 3 | high |
| ≤ 7 | medium |
| > 7 | no change |

**Notes:**

- Only escalates priority UP (never downgrades)
- Excludes completed and cancelled tasks
- Excludes tasks without due dates
- Runs automatically daily at 6 AM via scheduler

## Project Dashboard Endpoint

### GET `/projects/:id/dashboard`

Get comprehensive project dashboard data.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "project": {
    "id": 101,
    "name": "Corporate Website Redesign",
    "status": "in-progress",
    "progress": 65,
    "client_email": "client@example.com",
    "company_name": "Acme Corporation"
  },
  "stats": {
    "total_milestones": 4,
    "completed_milestones": 2,
    "total_files": 12,
    "total_messages": 28,
    "unread_messages": 3,
    "total_updates": 15
  },
  "progressPercentage": 50,
  "upcomingMilestones": [
    {
      "id": 302,
      "title": "Frontend Development",
      "due_date": "2024-03-15",
      "is_completed": false
    }
  ],
  "recentUpdates": [
    {
      "id": 201,
      "title": "Wireframe Phase Completed",
      "update_type": "milestone",
      "author": "Project Manager",
      "created_at": "2024-01-18T11:00:00Z"
    }
  ],
  "recentMessages": [
    {
      "id": 1001,
      "sender_type": "admin",
      "sender_name": "Project Manager",
      "message": "Initial wireframes have been completed...",
      "is_read": true,
      "created_at": "2024-01-18T11:15:00Z"
    }
  ]
}
```

## File Management Endpoints

### Upload Endpoints

#### POST `/api/uploads/single`

Upload a single file.

**Headers:**

- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Form Data:**

- `file` (file) - The file to upload

#### POST `/api/uploads/multiple`

Upload multiple files (max 5).

**Headers:**

- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Form Data:**

- `files` (file[]) - Array of files to upload

**Response (201 Created):**

```json
{
  "success": true,
  "message": "3 files uploaded successfully",
  "files": [
    {
      "id": 502,
      "filename": "1643728800-design_assets.zip",
      "originalName": "design_assets.zip",
      "size": 5242880,
      "mimeType": "application/zip"
    }
  ]
}
```

**File Upload Limits:**

- Maximum file size: 10MB per file
- Maximum files per request: 5
- Allowed file types: PDF, DOC, DOCX, TXT, PNG, JPG, JPEG, GIF, WEBP, ZIP

### File Retrieval Endpoints

#### GET `/api/uploads/client`

Get all files for authenticated client (across all projects).

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**

```json
{
  "success": true,
  "files": [
    {
      "id": 501,
      "originalName": "Website Wireframes V2.pdf",
      "filename": "1643728800-wireframes.pdf",
      "mimetype": "application/pdf",
      "size": 2048576,
      "projectId": 1,
      "projectName": "Corporate Website",
      "uploadedAt": "2024-01-20T14:30:00Z",
      "uploadedBy": 5
    }
  ],
  "count": 1
}
```

#### GET `/api/uploads/project/:projectId`

Get all files for a specific project.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**

- `projectId` (integer) - Project ID

**Response (200 OK):**

```json
{
  "success": true,
  "files": [...],
  "count": 3
}
```

#### GET `/api/uploads/file/:fileId`

Download or preview a specific file.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**

- `fileId` (integer) - File ID

**Query Parameters:**

- `download` (boolean, optional) - If `true`, forces download; otherwise inline preview

**Response:** File stream with appropriate headers

#### DELETE `/api/uploads/file/:fileId`

Delete a specific file.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**

- `fileId` (integer) - File ID

**Response (200 OK):**

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Legacy Project File Endpoints

#### POST `/projects/:id/files`

Upload files to a specific project.

**Headers:**

- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

#### GET `/projects/:id/files`

List project files.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "files": [
    {
      "id": 501,
      "filename": "wireframes_v2.pdf",
      "original_name": "Website Wireframes V2.pdf",
      "file_size": 2048576,
      "mime_type": "application/pdf",
      "uploaded_by": "client",
      "created_at": "2024-01-20T14:30:00Z"
    }
  ]
}
```

## Messaging Endpoints

### GET `/projects/:id/messages`

Get project messages.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `limit` (optional): Number of messages (default: 50)
- `offset` (optional): Skip messages for pagination

**Response:**

```json
{
  "messages": [
    {
      "id": 1001,
      "sender_type": "admin",
      "sender_name": "Project Manager",
      "message": "Initial wireframes have been completed and are ready for review.",
      "is_read": true,
      "created_at": "2024-01-18T11:15:00Z"
    },
    {
      "id": 1002,
      "sender_type": "client",
      "sender_name": "john@example.com",
      "message": "The wireframes look great! Can we adjust the header section slightly?",
      "is_read": false,
      "created_at": "2024-01-19T09:30:00Z"
    }
  ]
}
```

### POST `/projects/:id/messages`

Send message to project thread.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "message": "Thank you for the update. The revised designs look perfect!"
}
```

**Response:**

```json
{
  "message": "Message sent successfully",
  "messageData": {
    "id": 1003,
    "sender_type": "client",
    "sender_name": "john@example.com",
    "message": "Thank you for the update. The revised designs look perfect!",
    "is_read": false,
    "created_at": "2024-02-01T19:45:00Z"
  }
}
```

### PUT `/projects/:id/messages/read`

Mark messages as read.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "message": "Messages marked as read"
}
```

## Project Updates Endpoint

### POST `/projects/:id/updates`

Add project timeline update (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request:**

```json
{
  "title": "Development Phase Started",
  "description": "Frontend development has begun based on approved designs",
  "update_type": "progress",
  "author": "Lead Developer"
}
```

**Response:**

```json
{
  "message": "Project update added successfully",
  "update": {
    "id": 202,
    "title": "Development Phase Started",
    "description": "Frontend development has begun based on approved designs",
    "update_type": "progress",
    "author": "Lead Developer",
    "created_at": "2024-02-01T20:00:00Z"
  }
}
```

**Update Types:**

- `progress` - General progress updates
- `milestone` - Milestone completions
- `issue` - Problems or blockers
- `resolution` - Issue resolutions
- `general` - General communications

## Client Intake Endpoints

**Base path:** `/intake` (mounted at `/api/intake`)

### POST `/intake`

Submit client intake form (public endpoint).

**Request:**

```json
{
  "client_name": "John Smith",
  "company_name": "Smith Enterprises",
  "email": "john@smithenterprises.com",
  "phone": "+1-555-0199",
  "project_type": "business-website",
  "budget_range": "10000-20000",
  "timeline": "2-3-months",
  "description": "Need a professional website with e-commerce capabilities",
  "features": ["cms", "ecommerce", "analytics", "seo"],
  "pages_needed": 12,
  "hosting_preference": "managed",
  "maintenance_needed": true,
  "additional_info": "Looking for modern design with mobile responsiveness"
}
```

**Response:**

```json
{
  "message": "Intake form submitted successfully",
  "intake_id": "INT-1643745600-A7B9C2",
  "estimated_response_time": "24-48 hours"
}
```

**Validation Rules:**

- `client_name`: Required, max 255 characters
- `email`: Required, valid email format
- `project_type`: Required, must be one of predefined types
- `budget_range`: Required, must be one of predefined ranges
- `timeline`: Required, must be one of predefined timelines
- `features`: Array of valid feature codes
- `pages_needed`: Optional integer, 1-100
- `maintenance_needed`: Boolean

### GET `/intake/status/:projectId`

Get intake status for a project (public or authenticated).

**URL Parameters:** `projectId` - Project ID

**Response:** Intake status and metadata for the project.

---

## Approvals API

**Base path:** `/approvals` (mounted at `/api/approvals`)

Workflow definitions and approval instances for proposals, invoices, contracts, deliverables, and projects.

### Workflow Definitions

|Method|Path|Description|Auth|
|--------|------|-------------|------|
|GET|`/approvals/workflows`|List workflow definitions (optional `entityType` query)|Admin|
|GET|`/approvals/workflows/:id`|Get workflow with steps|Admin|
|POST|`/approvals/workflows`|Create workflow (name, entity_type, workflow_type, etc.)|Admin|
|POST|`/approvals/workflows/:id/steps`|Add step to workflow|Admin|

**Entity types:** `proposal`, `invoice`, `contract`, `deliverable`, `project`  
**Workflow types:** `sequential`, `parallel`, `any_one`

### Workflow Instances

|Method|Path|Description|Auth|
|--------|------|-------------|------|
|POST|`/approvals/start`|Start approval workflow (entity_type, entity_id, workflow_definition_id?, notes?)|Any|
|GET|`/approvals/active`|List active workflows|Admin|
|GET|`/approvals/pending`|Pending approvals for current user|Any|
|GET|`/approvals/entity/:entityType/:entityId`|Workflow for an entity|Any|
|GET|`/approvals/instance/:id`|Workflow instance by ID|Any|
|POST|`/approvals/instance/:id/approve`|Approve step|Any|
|POST|`/approvals/instance/:id/reject`|Reject step|Any|

---

## Workflow Triggers API

**Base path:** `/triggers` (mounted at `/api/triggers`)

Event-driven workflow triggers (admin only for CRUD).

|Method|Path|Description|
|--------|------|-------------|
|GET|`/triggers`|List triggers (optional `eventType` query)|
|GET|`/triggers/options`|Get event types and action types|
|GET|`/triggers/:id`|Get trigger by ID|
|POST|`/triggers`|Create trigger (name, event_type, action_type, action_config, etc.)|
|PUT|`/triggers/:id`|Update trigger|
|DELETE|`/triggers/:id`|Delete trigger|
|POST|`/triggers/:id/toggle`|Toggle active state|
|GET|`/triggers/logs/executions`|Execution logs (optional `triggerId`, `limit`)|
|GET|`/triggers/logs/events`|System events (optional `eventType`, `limit`)|
|POST|`/triggers/test-emit`|Emit test event (event_type, context)|

**Authentication:** All trigger management endpoints require Admin.

---

## Document Requests API

**Base path:** `/document-requests` (mounted at `/api/document-requests`)

Request and collect documents from clients; admin review and templates.

### Client

|Method|Path|Description|
|--------|------|-------------|
|GET|`/document-requests/my-requests`|Client's requests and stats (optional `status` query)|
|POST|`/document-requests/:id/view`|Mark request as viewed|
|POST|`/document-requests/:id/upload`|Attach file (body: `fileId`)|

### Admin (Document Requests)

|Method|Path|Description|
|--------|------|-------------|
|GET|`/document-requests/pending`|Pending requests|
|GET|`/document-requests/for-review`|Requests needing review|
|GET|`/document-requests/overdue`|Overdue requests|
|GET|`/document-requests/client/:clientId`|Requests for a client|
|GET|`/document-requests/:id`|Single request with history|
|POST|`/document-requests`|Create request|
|POST|`/document-requests/from-templates`|Create from templates|
|POST|`/document-requests/:id/start-review`|Start review|
|POST|`/document-requests/:id/approve`|Approve|
|POST|`/document-requests/:id/reject`|Reject|
|POST|`/document-requests/:id/remind`|Send reminder|
|DELETE|`/document-requests/:id`|Delete request|
|GET|`/document-requests/templates/list`|List templates|
|POST|`/document-requests/templates`|Create template|
|PUT|`/document-requests/templates/:id`|Update template|
|DELETE|`/document-requests/templates/:id`|Delete template|

---

## Knowledge Base API

**Base path:** `/kb` (mounted at `/api/kb`)

Public and admin endpoints for help articles and categories.

### Public (no auth or optional auth)

|Method|Path|Description|
|--------|------|-------------|
|GET|`/kb/categories`|Active categories with article counts|
|GET|`/kb/categories/:slug`|Category and its articles|
|GET|`/kb/featured`|Featured articles (optional `limit` query)|
|GET|`/kb/search`|Search articles (query `q`, optional `limit`)|
|GET|`/kb/articles/:categorySlug/:articleSlug`|Get article (increments view count)|
|POST|`/kb/articles/:id/feedback`|Submit feedback (body: `isHelpful`, `comment?`)|

### Admin (Knowledge Base)

|Method|Path|Description|
|--------|------|-------------|
|GET|`/kb/admin/categories`|All categories (including inactive)|
|POST|`/kb/admin/categories`|Create category (name, slug, description?, icon?, color?, sort_order?)|
|PUT|`/kb/admin/categories/:id`|Update category|
|DELETE|`/kb/admin/categories/:id`|Delete category|
|GET|`/kb/admin/articles`|All articles (optional `category` query)|
|GET|`/kb/admin/articles/:id`|Single article by ID|
|POST|`/kb/admin/articles`|Create article (category_id, title, slug, summary?, content, keywords?, is_featured?, is_published?)|
|PUT|`/kb/admin/articles/:id`|Update article|
|DELETE|`/kb/admin/articles/:id`|Delete article|
|GET|`/kb/admin/stats`|Knowledge base statistics|

---

## Rate Limiting

All API endpoints are subject to rate limiting:

**Limits:**

- **Authentication endpoints:** 5 requests per 15 minutes per IP
- **General API endpoints:** 100 requests per 15 minutes per authenticated user
- **File upload endpoints:** 10 requests per hour per authenticated user

**Rate limit headers:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1643746800
```

**Rate limit exceeded response:**

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "windowMs": 900000,
    "resetTime": "2024-02-01T21:00:00Z"
  }
}
```

## Webhooks (Future Enhancement)

Webhook endpoints for real-time notifications:

### Available Events

- `client.created` - New client registration
- `project.status_changed` - Project status updates
- `milestone.completed` - Milestone completions
- `message.received` - New project messages
- `file.uploaded` - File uploads

### Webhook Payload Example

```json
{
  "event": "project.status_changed",
  "timestamp": "2024-02-01T20:15:00Z",
  "data": {
    "project_id": 101,
    "client_id": 1,
    "old_status": "in-progress",
    "new_status": "in-review",
    "updated_by": "nobhaduri@gmail.com"
  }
}
```

## SDK Examples

### JavaScript/Node.js

```javascript
const client = new NoBhadCodesAPI({
  baseURL: 'https://nobhad.codes/api',
  token: 'your-jwt-token'
});

// Get projects
const projects = await client.projects.list();

// Create milestone
const milestone = await client.milestones.create(projectId, {
  title: 'New Milestone',
  due_date: '2024-03-15'
});

// Upload files
const files = await client.files.upload(projectId, fileArray);
```

### cURL Examples

```bash
# Login
curl -X POST https://nobhad.codes/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"client@example.com","password":"password123"}'

# Get projects
curl -X GET https://nobhad.codes/api/projects \
  -H "Authorization: Bearer your-jwt-token"

# Create milestone
curl -X POST https://nobhad.codes/api/projects/101/milestones \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Milestone","due_date":"2024-03-15"}'
```

## Messaging System

### Message Threads

#### Get Message Threads

```bash
GET /api/messages/threads
Authorization: Bearer <token>
```

**Response:**

```json
{
  "threads": [
    {
      "id": 1,
      "subject": "Website Development Inquiry",
      "thread_type": "general",
      "status": "active",
      "priority": "normal",
      "last_message_at": "2025-01-02T10:30:00Z",
      "last_message_by": "John Doe",
      "message_count": 5,
      "unread_count": 2,
      "project_name": "E-commerce Site"
    }
  ]
}
```

#### Create Message Thread

```bash
curl -X POST https://nobhad.codes/api/messages/threads \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "New Project Discussion",
    "thread_type": "project",
    "priority": "normal",
    "project_id": 123
  }'
```

### Messages

#### Send Message with Attachments

```bash
curl -X POST https://nobhad.codes/api/messages/threads/1/messages \
  -H "Authorization: Bearer your-token" \
  -F "message=Here's my project update" \
  -F "priority=normal" \
  -F "attachments=@document.pdf" \
  -F "attachments=@screenshot.png"
```

#### Mark Messages as Read

```bash
curl -X PUT https://nobhad.codes/api/messages/threads/1/read \
  -H "Authorization: Bearer your-token"
```

### Quick Inquiries

#### Send Quick Inquiry

```bash
curl -X POST https://nobhad.codes/api/messages/inquiry \
  -H "Authorization: Bearer your-token" \
  -F "subject=Website Development Question" \
  -F "message=I need help with responsive design" \
  -F "message_type=inquiry" \
  -F "priority=normal" \
  -F "attachments=@wireframe.pdf"
```

### Notification Preferences

#### Update Notification Settings

```bash
curl -X PUT https://nobhad.codes/api/messages/preferences \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "email_notifications": true,
    "project_updates": true,
    "new_messages": true,
    "milestone_updates": false,
    "notification_frequency": "daily"
  }'
```

### Admin Analytics

#### Get Messaging Analytics (Admin Only)

```bash
curl https://nobhad.codes/api/messages/analytics \
  -H "Authorization: Bearer your-admin-token"
```

**Response:**

```json
{
  "analytics": {
    "total_threads": 45,
    "active_threads": 32,
    "total_messages": 234,
    "unread_messages": 12,
    "urgent_messages": 3
  },
  "recentActivity": [
    {
      "subject": "Website Updates",
      "priority": "normal",
      "last_message_at": "2025-01-02T15:30:00Z",
      "company_name": "Example Corp"
    }
  ]
}
```

## Invoice Endpoints

The Invoice system handles billing, payments, deposits, and credits.

### Invoice Types

|Type|Description|
|------|-------------|
|`standard`|Regular invoice for services|
|`deposit`|Upfront deposit payment|

### Invoice Statuses

|Status|Description|
|--------|-------------|
|`draft`|Not yet sent to client|
|`sent`|Sent to client, awaiting payment|
|`viewed`|Client has viewed the invoice|
|`partial`|Partially paid|
|`paid`|Fully paid|
|`overdue`|Past due date|
|`cancelled`|Invoice cancelled|

### GET `/api/invoices/me`

Get all invoices for the authenticated client with summary statistics.

**Authentication:** Required (Client)

**Response (200 OK):**

```json
{
  "success": true,
  "invoices": [
    {
      "id": 1,
      "invoice_number": "INV-2026-001",
      "client_id": 5,
      "project_id": 1,
      "amount_total": 2500.00,
      "amount_paid": 0,
      "status": "sent",
      "invoice_type": "standard",
      "due_date": "2026-02-28T00:00:00.000Z",
      "created_at": "2026-01-30T10:00:00.000Z",
      "project_name": "Website Redesign"
    }
  ],
  "count": 1,
  "summary": {
    "totalOutstanding": 2500.00,
    "totalPaid": 1500.00
  }
}
```

### GET `/api/invoices/:id`

Get a specific invoice by ID.

**Authentication:** Required

### GET `/api/invoices/project/:projectId`

Get all invoices for a specific project.

**Authentication:** Required

### POST `/api/invoices`

Create a new standard invoice.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "projectId": 1,
  "clientId": 5,
  "lineItems": [
    {
      "description": "Website Design",
      "quantity": 1,
      "rate": 2500,
      "amount": 2500
    }
  ],
  "notes": "Payment due within 30 days",
  "terms": "Net 30"
}
```

### POST `/api/invoices/deposit`

Create a deposit invoice for a project.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "projectId": 1,
  "clientId": 5,
  "amount": 1000,
  "percentage": 50,
  "description": "Project deposit"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Deposit invoice created successfully",
  "invoice": {
    "id": 15,
    "invoice_number": "INV-2026-015",
    "invoice_type": "deposit",
    "amount_total": 1000
  }
}
```

### PUT `/api/invoices/:id`

Update a draft invoice (line items, notes).

**Authentication:** Required (Admin)

**Request:**

```json
{
  "lineItems": [
    {
      "description": "Updated service",
      "quantity": 1,
      "rate": 2500,
      "amount": 2500
    }
  ],
  "notes": "Updated notes"
}
```

**Notes:**

- Only draft invoices can be edited
- Returns 400 error if invoice status is not 'draft'

### PUT `/api/invoices/:id/status`

Update invoice status.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "status": "paid",
  "paymentData": {
    "amountPaid": 2500,
    "paymentMethod": "bank_transfer",
    "paymentReference": "TXN-12345"
  }
}
```

### POST `/api/invoices/:id/send`

Send invoice to client (triggers email notification).

**Authentication:** Required (Admin)

### GET `/api/invoices/deposits/:projectId`

Get available deposits for a project (paid but not fully applied as credits).

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "deposits": [
    {
      "invoice_id": 10,
      "invoice_number": "INV-2026-010",
      "total_amount": 1000,
      "amount_applied": 500,
      "available_amount": 500,
      "paid_date": "2026-01-15T10:00:00Z"
    }
  ]
}
```

### POST `/api/invoices/:id/apply-credit`

Apply a deposit credit to an invoice.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "depositInvoiceId": 10,
  "amount": 500
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Credit applied successfully"
}
```

**Error Responses:**

- `400` - Credit amount exceeds available balance
- `404` - Invoice or deposit not found

### GET `/api/invoices/:id/credits`

Get credits applied to an invoice.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "credits": [
    {
      "id": 1,
      "invoice_id": 15,
      "deposit_invoice_id": 10,
      "deposit_invoice_number": "INV-2026-010",
      "amount": 500,
      "applied_at": "2026-01-20T14:30:00Z"
    }
  ],
  "totalCredits": 500
}
```

### GET `/api/invoices/:id/pdf`

Download or preview invoice as PDF.

**Authentication:** Required

**Query Parameters:**

- `preview=true` - Opens inline in browser tab
- `preview=false` (default) - Downloads as file attachment

**Response:** PDF file with appropriate headers

**PDF Features:**

- For deposit invoices: Title shows "DEPOSIT INVOICE"
- For invoices with applied credits: Shows credit line items and adjusted total

---

## Payment Plan Templates

Payment plan templates allow creating reusable payment structures for projects.

### GET `/api/invoices/payment-plans`

Get all payment plan templates.

**Authentication:** Required (Admin)

**Response (200 OK):**

```json
{
  "success": true,
  "templates": [
    {
      "id": 1,
      "name": "50/50 Split",
      "description": "50% upfront, 50% on completion",
      "payments": [
        { "percentage": 50, "trigger": "upfront" },
        { "percentage": 50, "trigger": "completion" }
      ],
      "isDefault": true,
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

### POST `/api/invoices/payment-plans`

Create a new payment plan template.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "name": "Custom 30/30/40 Split",
  "description": "30% upfront, 30% at midpoint, 40% on completion",
  "payments": [
    { "percentage": 30, "trigger": "upfront" },
    { "percentage": 30, "trigger": "midpoint" },
    { "percentage": 40, "trigger": "completion" }
  ],
  "isDefault": false
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Payment plan template created",
  "template": { "id": 6, ... }
}
```

### DELETE `/api/invoices/payment-plans/:id`

Delete a payment plan template.

**Authentication:** Required (Admin)

### POST `/api/invoices/generate-from-plan`

Generate invoices from a payment plan template.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "projectId": 1,
  "clientId": 5,
  "templateId": 1,
  "totalAmount": 5000
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Generated 2 invoices from payment plan",
  "invoices": [
    { "id": 15, "invoiceNumber": "INV-2026-015", "amountTotal": 2500 },
    { "id": 16, "invoiceNumber": "INV-2026-016", "amountTotal": 2500 }
  ]
}
```

---

## Milestone-Linked Invoices

Link invoices to project milestones for better tracking.

### POST `/api/invoices/milestone/:milestoneId`

Create an invoice linked to a milestone.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "projectId": 1,
  "clientId": 5,
  "lineItems": [
    { "description": "Design Phase Complete", "quantity": 1, "rate": 2000, "amount": 2000 }
  ],
  "notes": "Payment for design milestone"
}
```

### GET `/api/invoices/milestone/:milestoneId`

Get all invoices linked to a milestone.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "invoices": [
    {
      "id": 15,
      "invoiceNumber": "INV-2026-015",
      "milestoneId": 301,
      "amountTotal": 2000,
      "status": "sent"
    }
  ]
}
```

### PUT `/api/invoices/:id/link-milestone`

Link an existing invoice to a milestone.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "milestoneId": 301
}
```

---

## Invoice Scheduling

Schedule invoices for future automatic generation.

### POST `/api/invoices/schedule`

Schedule a future invoice.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "projectId": 1,
  "clientId": 5,
  "scheduledDate": "2026-03-01",
  "triggerType": "date",
  "lineItems": [
    { "description": "Monthly Maintenance", "quantity": 1, "rate": 500, "amount": 500 }
  ],
  "notes": "Scheduled maintenance invoice"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Invoice scheduled successfully",
  "scheduledInvoice": {
    "id": 1,
    "scheduledDate": "2026-03-01",
    "status": "pending"
  }
}
```

### GET `/api/invoices/scheduled`

Get all scheduled invoices.

**Authentication:** Required (Admin)

**Query Parameters:**

- `projectId` (optional): Filter by project

**Response (200 OK):**

```json
{
  "success": true,
  "scheduledInvoices": [
    {
      "id": 1,
      "projectId": 1,
      "clientId": 5,
      "scheduledDate": "2026-03-01",
      "triggerType": "date",
      "status": "pending",
      "lineItems": [...],
      "createdAt": "2026-01-30T10:00:00Z"
    }
  ]
}
```

### DELETE `/api/invoices/scheduled/:id`

Cancel a scheduled invoice.

**Authentication:** Required (Admin)

---

## Recurring Invoices

Create recurring invoice patterns for retainers and maintenance plans.

### POST `/api/invoices/recurring`

Create a recurring invoice pattern.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "projectId": 1,
  "clientId": 5,
  "frequency": "monthly",
  "dayOfMonth": 1,
  "lineItems": [
    { "description": "Monthly Hosting & Maintenance", "quantity": 1, "rate": 150, "amount": 150 }
  ],
  "startDate": "2026-02-01",
  "endDate": "2026-12-31",
  "notes": "Monthly maintenance invoice"
}
```

**Frequency Options:** `weekly`, `monthly`, `quarterly`

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Recurring invoice created",
  "recurringInvoice": {
    "id": 1,
    "frequency": "monthly",
    "nextGenerationDate": "2026-02-01",
    "isActive": true
  }
}
```

### GET `/api/invoices/recurring`

Get all recurring invoice patterns.

**Authentication:** Required (Admin)

**Query Parameters:**

- `projectId` (optional): Filter by project

### PUT `/api/invoices/recurring/:id`

Update a recurring invoice pattern.

**Authentication:** Required (Admin)

### POST `/api/invoices/recurring/:id/pause`

Pause a recurring invoice.

**Authentication:** Required (Admin)

### POST `/api/invoices/recurring/:id/resume`

Resume a paused recurring invoice.

**Authentication:** Required (Admin)

### DELETE `/api/invoices/recurring/:id`

Delete a recurring invoice pattern.

**Authentication:** Required (Admin)

---

## Payment Reminders

Automated payment reminder system for overdue invoices.

### GET `/api/invoices/:id/reminders`

Get all scheduled reminders for an invoice.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "reminders": [
    {
      "id": 1,
      "invoiceId": 15,
      "reminderType": "upcoming",
      "scheduledDate": "2026-02-25",
      "status": "pending",
      "sentAt": null
    },
    {
      "id": 2,
      "invoiceId": 15,
      "reminderType": "due",
      "scheduledDate": "2026-02-28",
      "status": "pending",
      "sentAt": null
    }
  ]
}
```

**Reminder Types:**

|Type|Description|
|------|-------------|
|`upcoming`|3 days before due date|
|`due`|On due date|
|`overdue_3`|3 days overdue|
|`overdue_7`|7 days overdue|
|`overdue_14`|14 days overdue|
|`overdue_30`|30 days overdue|

### POST `/api/invoices/reminders/:id/skip`

Skip a scheduled reminder.

**Authentication:** Required (Admin)

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Reminder skipped"
}
```

---

## Additional Invoice Management

### DELETE `/api/invoices/:id`

Delete or void an invoice.

**Authentication:** Required (Admin)

**Behavior:**

- Draft/Cancelled invoices are permanently deleted
- Sent/Viewed/Partial/Overdue invoices are voided (status changed to cancelled)
- Paid invoices cannot be deleted or voided

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Invoice deleted successfully",
  "action": "deleted"
}
```

### POST `/api/invoices/:id/duplicate`

Create a copy of an existing invoice as a new draft.

**Authentication:** Required (Admin)

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Invoice duplicated successfully",
  "invoice": { "id": 20, "invoice_number": "INV-202602-123456", "status": "draft" }
}
```

### POST `/api/invoices/:id/record-payment`

Record a partial or full payment on an invoice.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "amount": 500.00,
  "paymentMethod": "zelle",
  "paymentReference": "TXN-12345"
}
```

**Payment Methods:** `zelle`, `venmo`, `check`, `bank_transfer`, `credit_card`, `cash`, `other`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Partial payment recorded successfully",
  "invoice": { "status": "partial", "amount_paid": 500.00 }
}
```

### POST `/api/invoices/:id/send-reminder`

Manually send a payment reminder email for an outstanding invoice.

**Authentication:** Required (Admin)

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Payment reminder sent successfully",
  "sentTo": "client@example.com"
}
```

### GET `/api/invoices/search`

Search invoices with filters and pagination.

**Authentication:** Required (Admin)

**Query Parameters:**

|Parameter|Type|Description|
|-----------|------|-------------|
|`clientId`|number|Filter by client|
|`projectId`|number|Filter by project|
|`status`|string|Filter by status (comma-separated for multiple)|
|`invoiceType`|string|`standard` or `deposit`|
|`search`|string|Search in invoice number and notes|
|`dateFrom`|date|Filter by issue date (from)|
|`dateTo`|date|Filter by issue date (to)|
|`dueDateFrom`|date|Filter by due date (from)|
|`dueDateTo`|date|Filter by due date (to)|
|`minAmount`|number|Minimum amount|
|`maxAmount`|number|Maximum amount|
|`limit`|number|Results per page (default: 50)|
|`offset`|number|Pagination offset|

**Response (200 OK):**

```json
{
  "success": true,
  "invoices": [],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### POST `/api/invoices/check-overdue`

Manually trigger the overdue invoice check (also runs automatically via scheduler daily).

**Authentication:** Required (Admin)

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Marked 3 invoice(s) as overdue",
  "count": 3
}
```

### POST `/api/invoices/export-batch`

Export multiple invoices as a ZIP file containing PDFs.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "invoiceIds": [1, 2, 3, 4, 5]
}
```

**Response:** Binary ZIP file stream

**Response Headers:**

```http
Content-Type: application/zip
Content-Disposition: attachment; filename="invoices-1707234567890.zip"
```

**ZIP Contents:**

- Individual PDF files named by invoice number (e.g., `INV-000001.pdf`)
- `manifest.json` with export summary

**Limits:**

- Maximum 100 invoices per request

**Error Response (400):**

```json
{
  "error": "invoiceIds must be a non-empty array",
  "code": "INVALID_INPUT"
}
```

---

## Advanced Invoice Features

### Payment Terms Presets

#### GET `/api/invoices/payment-terms`

Get all payment terms presets (Net 15, Net 30, etc.).

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "terms": [
    {
      "id": 4,
      "name": "Net 30",
      "days_until_due": 30,
      "description": "Payment due within 30 days",
      "late_fee_rate": 1.5,
      "late_fee_type": "percentage",
      "grace_period_days": 0,
      "is_default": true
    }
  ]
}
```

#### POST `/api/invoices/payment-terms`

Create a custom payment terms preset.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "name": "Net 45",
  "daysUntilDue": 45,
  "description": "Payment due within 45 days",
  "lateFeeRate": 2.0,
  "lateFeeType": "percentage"
}
```

#### POST `/api/invoices/:id/apply-terms`

Apply payment terms to an invoice.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "termsId": 4
}
```

### Tax and Discounts

#### PUT `/api/invoices/:id/tax-discount`

Update invoice tax rate and/or discount.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "taxRate": 8.25,
  "discountType": "percentage",
  "discountValue": 10
}
```

**Notes:**

- Only draft invoices can have tax/discount modified
- `discountType` can be "percentage" or "fixed"
- System calculates subtotal, tax amount, discount amount, and new total

### Late Fees

#### GET `/api/invoices/:id/late-fee`

Calculate potential late fee for an invoice.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "invoiceId": 15,
  "lateFee": 37.50,
  "alreadyApplied": false,
  "lateFeeAppliedAt": null
}
```

#### POST `/api/invoices/:id/apply-late-fee`

Apply late fee to an overdue invoice.

**Authentication:** Required (Admin)

**Notes:**

- Late fee is added to invoice total
- Cannot apply twice to the same invoice
- Late fee type options: "flat", "percentage", "daily_percentage"

#### POST `/api/invoices/process-late-fees`

Apply late fees to all eligible overdue invoices.

**Authentication:** Required (Admin)

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Late fees applied to 5 invoices",
  "count": 5
}
```

### Payment History

#### GET `/api/invoices/:id/payments`

Get payment history for an invoice.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "payments": [
    {
      "id": 1,
      "invoice_id": 15,
      "amount": 500.00,
      "payment_method": "bank_transfer",
      "payment_reference": "TXN-12345",
      "payment_date": "2026-01-20",
      "notes": "Partial payment",
      "created_at": "2026-01-20T14:30:00Z"
    }
  ]
}
```

#### POST `/api/invoices/:id/record-payment-with-history`

Record a payment and add to payment history.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "amount": 500,
  "paymentMethod": "bank_transfer",
  "paymentReference": "TXN-12345",
  "notes": "Partial payment received"
}
```

#### GET `/api/invoices/all-payments`

Get all payments across all invoices for reports.

**Authentication:** Required (Admin)

**Query Parameters:**

- `dateFrom` - Filter payments from this date
- `dateTo` - Filter payments up to this date

### Accounts Receivable Aging

#### GET `/api/invoices/aging-report`

Generate an A/R aging report.

**Authentication:** Required (Admin)

**Query Parameters:**

- `clientId` - Filter by client (optional)

**Response (200 OK):**

```json
{
  "success": true,
  "report": {
    "generated_at": "2026-02-01",
    "total_outstanding": 15000.00,
    "buckets": [
      {
        "bucket": "current",
        "count": 5,
        "total_amount": 5000.00,
        "invoices": []
      },
      {
        "bucket": "1-30",
        "count": 3,
        "total_amount": 4500.00,
        "invoices": []
      },
      {
        "bucket": "31-60",
        "count": 2,
        "total_amount": 3000.00,
        "invoices": []
      },
      {
        "bucket": "61-90",
        "count": 1,
        "total_amount": 1500.00,
        "invoices": []
      },
      {
        "bucket": "90+",
        "count": 1,
        "total_amount": 1000.00,
        "invoices": []
      }
    ]
  }
}
```

### Internal Notes

#### PUT `/api/invoices/:id/internal-notes`

Update internal notes (admin-only, not visible to clients).

**Authentication:** Required (Admin)

**Request:**

```json
{
  "internalNotes": "Client requested NET 45. Approved by manager."
}
```

### Comprehensive Statistics

#### GET `/api/invoices/comprehensive-stats`

Get comprehensive invoice statistics and analytics.

**Authentication:** Required (Admin)

**Query Parameters:**

- `dateFrom` - Filter from this date
- `dateTo` - Filter to this date

**Response (200 OK):**

```json
{
  "success": true,
  "stats": {
    "total_invoices": 150,
    "total_revenue": 125000.00,
    "total_outstanding": 15000.00,
    "total_overdue": 3500.00,
    "average_invoice_amount": 833.33,
    "average_days_to_payment": 18.5,
    "status_breakdown": {
      "draft": 5,
      "sent": 10,
      "viewed": 3,
      "partial": 2,
      "paid": 125,
      "overdue": 4,
      "cancelled": 1
    },
    "monthly_revenue": [
      {"month": "2026-02", "revenue": 12500.00, "count": 15},
      {"month": "2026-01", "revenue": 18000.00, "count": 22}
    ]
  }
}
```

### Custom Invoice Numbers

#### POST `/api/invoices/with-custom-number`

Create invoice with custom number prefix.

**Authentication:** Required (Admin)

**Request:**

```json
{
  "prefix": "WEB",
  "projectId": 1,
  "clientId": 5,
  "lineItems": [
    {
      "description": "Website Design",
      "quantity": 1,
      "rate": 2500,
      "amount": 2500
    }
  ]
}
```

**Response:**

Invoice created with number like "WEB-202602-0001".

---

## Scheduler Service

The scheduler service runs automated tasks for invoice reminders and recurring invoice generation.

**Configuration (Environment Variables):**

|Variable|Default|Description|
|----------|---------|-------------|
|`SCHEDULER_ENABLED`|`true`|Enable/disable scheduler|
|`SCHEDULER_REMINDERS`|`true`|Enable payment reminders|
|`SCHEDULER_SCHEDULED`|`true`|Enable scheduled invoice generation|
|`SCHEDULER_RECURRING`|`true`|Enable recurring invoice generation|

**Schedule:**

- **Reminder checks:** Every hour at :00
- **Invoice generation:** Daily at 1:00 AM

**Reminder Email Sequence:**

When an invoice is sent, reminders are automatically scheduled:

1. 3 days before due date - "Payment Reminder"
2. On due date - "Payment Due Today"
3. 3 days overdue - "Payment Overdue"
4. 7 days overdue - "URGENT: Payment Overdue"
5. 14 days overdue - "FINAL NOTICE"
6. 30 days overdue - "COLLECTION NOTICE"

---

## Proposal Builder Endpoints

The Proposal Builder system allows clients to create tiered proposals after completing the intake form. Admins can review, approve, reject, or convert proposals to invoices.

### Valid Constants

**Project Types:**

- `simple-site`, `business-site`, `portfolio`, `ecommerce`, `web-app`, `browser-extension`, `other`

**Tier IDs:**

- `good`, `better`, `best`

**Maintenance Options:**

- `diy`, `essential`, `standard`, `premium`

**Proposal Statuses:**

- `pending`, `reviewed`, `accepted`, `rejected`, `converted`

### POST `/proposals`

Create a new proposal request.

**Request:**

```json
{
  "projectId": 1,
  "clientId": 5,
  "projectType": "business-site",
  "selectedTier": "better",
  "basePrice": 3500,
  "finalPrice": 4200,
  "maintenanceOption": "essential",
  "clientNotes": "Looking for clean, modern design",
  "features": [
    {
      "featureId": "responsive-design",
      "featureName": "Responsive Design",
      "featurePrice": 0,
      "featureCategory": "design",
      "isIncludedInTier": true,
      "isAddon": false
    },
    {
      "featureId": "blog-integration",
      "featureName": "Blog Integration",
      "featurePrice": 500,
      "featureCategory": "content",
      "isIncludedInTier": false,
      "isAddon": true
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Proposal submitted successfully",
  "data": {
    "proposalId": 12,
    "projectId": 1,
    "selectedTier": "better",
    "finalPrice": 4200
  }
}
```

**Error Responses:**

- `400` - Missing required fields or invalid values
- `404` - Project or client not found

### GET `/proposals/:id`

Get a specific proposal by ID.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 12,
    "projectId": 1,
    "clientId": 5,
    "projectType": "business-site",
    "selectedTier": "better",
    "basePrice": 3500,
    "finalPrice": 4200,
    "maintenanceOption": "essential",
    "status": "pending",
    "clientNotes": "Looking for clean, modern design",
    "adminNotes": null,
    "createdAt": "2026-01-28T10:30:00Z",
    "reviewedAt": null,
    "reviewedBy": null,
    "project": {
      "name": "Acme Corp Website"
    },
    "client": {
      "name": "John Smith",
      "email": "john@acme.com",
      "company": "Acme Corp"
    },
    "features": [
      {
        "featureId": "responsive-design",
        "featureName": "Responsive Design",
        "featurePrice": 0,
        "featureCategory": "design",
        "isIncludedInTier": true,
        "isAddon": false
      }
    ]
  }
}
```

### GET `/proposals/:id/pdf`

Generate and download PDF for a proposal.

**Headers:** `Authorization: Bearer <token>`

**Response:** PDF file stream with headers:

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="proposal-Acme-Corp-Website-12.pdf"
```

**PDF Contents:**

- Logo header (centered)
- Business contact information
- Proposal title
- Prepared For / Prepared By sections
- Project details (name, description, type)
- Selected package tier with base price
- Included features list
- Add-ons with individual prices
- Maintenance plan selection
- Pricing summary table with total
- Client notes
- Footer with validity notice (30 days)

### GET `/proposals/admin/list`

List all proposals (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**

- `status` (optional): Filter by status (`pending`, `reviewed`, `accepted`, `rejected`, `converted`)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Skip results for pagination (default: 0)

**Response:**

```json
{
  "success": true,
  "data": {
    "proposals": [
      {
        "id": 12,
        "projectId": 1,
        "clientId": 5,
        "projectType": "business-site",
        "selectedTier": "better",
        "basePrice": 3500,
        "finalPrice": 4200,
        "maintenanceOption": "essential",
        "status": "pending",
        "createdAt": "2026-01-28T10:30:00Z",
        "reviewedAt": null,
        "project": {
          "name": "Acme Corp Website"
        },
        "client": {
          "name": "John Smith",
          "email": "john@acme.com",
          "company": "Acme Corp"
        }
      }
    ],
    "total": 25,
    "limit": 50,
    "offset": 0
  }
}
```

### PUT `/proposals/admin/:id`

Update proposal status (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request:**

```json
{
  "status": "accepted",
  "adminNotes": "Great proposal, approved for development"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Proposal updated successfully"
}
```

**Error Responses:**

- `400` - Invalid status or no updates provided
- `404` - Proposal not found

### POST `/proposals/admin/:id/convert`

Convert an accepted proposal to an invoice (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Response:**

```json
{
  "success": true,
  "message": "Proposal converted to invoice",
  "data": {
    "invoiceId": 45,
    "invoiceNumber": "INV-2026-0045"
  }
}
```

**Process:**

1. Verifies proposal status is `accepted`
2. Creates invoice with line items from proposal features
3. Sets invoice status to `draft`
4. Updates proposal status to `converted`
5. Returns new invoice ID and number

**Error Responses:**

- `400` - Proposal status is not `accepted`
- `404` - Proposal not found

### GET `/proposals/config/:projectType`

Get tier configuration for a specific project type.

**Response:**

```json
{
  "success": true,
  "message": "Configuration is managed client-side",
  "projectType": "business-site"
}
```

**Note:** Tier configurations are defined on the frontend in `proposal-builder-data.ts`. This endpoint is available for future server-side configuration if needed.

---

## Analytics & Reporting API

The Analytics API provides business intelligence and visitor tracking capabilities.

### Visitor Tracking (Public)

#### POST `/api/analytics/track`

Submit tracking events (rate limited, public endpoint).

**Request:**

```json
{
  "type": "page_view",
  "sessionId": "abc123",
  "data": {
    "path": "/projects",
    "title": "Projects"
  }
}
```

### Visitor Analytics (Admin)

#### GET `/api/analytics/summary`

Get analytics summary with date range filtering.

**Query Parameters:**

- `days` - Number of days to include (default: 30)

#### GET `/api/analytics/realtime`

Get real-time visitor data.

#### GET `/api/analytics/sessions`

List visitor sessions with pagination.

**Query Parameters:**

- `limit` - Results per page (default: 50)
- `offset` - Pagination offset

#### GET `/api/analytics/sessions/:sessionId`

Get detailed session data.

#### GET `/api/analytics/export`

Export analytics data as CSV or JSON.

**Query Parameters:**

- `format` - `csv` or `json` (default: json)
- `dateFrom` - Start date
- `dateTo` - End date

#### DELETE `/api/analytics/data`

Clear old tracking data.

### Saved Reports

#### GET `/api/analytics/reports`

List saved reports.

**Query Parameters:**

- `type` - Filter by report type
- `favorites` - Show only favorites (`true`)

#### POST `/api/analytics/reports`

Create a new saved report.

#### GET `/api/analytics/reports/:id`

Get a specific report.

#### PUT `/api/analytics/reports/:id`

Update a report.

#### DELETE `/api/analytics/reports/:id`

Delete a report.

#### POST `/api/analytics/reports/:id/favorite`

Toggle report favorite status.

#### POST `/api/analytics/reports/:id/run`

Execute a report and get results.

### Report Schedules

#### GET `/api/analytics/reports/:reportId/schedules`

Get schedules for a report.

#### POST `/api/analytics/reports/:reportId/schedules`

Create a report schedule.

#### PUT `/api/analytics/schedules/:id`

Update a schedule.

#### DELETE `/api/analytics/schedules/:id`

Delete a schedule.

#### POST `/api/analytics/schedules/process`

Process all due schedules.

### Dashboard Widgets

#### GET `/api/analytics/widgets`

Get user's dashboard widgets.

#### POST `/api/analytics/widgets`

Create a widget.

#### PUT `/api/analytics/widgets/:id`

Update a widget.

#### DELETE `/api/analytics/widgets/:id`

Delete a widget.

#### PUT `/api/analytics/widgets/layout`

Update widget positions/sizes.

#### GET `/api/analytics/widgets/presets`

Get available dashboard presets.

#### POST `/api/analytics/widgets/presets/:id/apply`

Apply a dashboard preset.

### KPI Snapshots

#### POST `/api/analytics/kpis/snapshot`

Capture a KPI snapshot.

#### GET `/api/analytics/kpis/latest`

Get latest KPI values.

#### GET `/api/analytics/kpis/:type/trend`

Get KPI trend over time.

**Query Parameters:**

- `days` - Number of days (default: 30)

### Metric Alerts

#### GET `/api/analytics/alerts`

Get all metric alerts.

#### POST `/api/analytics/alerts`

Create an alert.

#### PUT `/api/analytics/alerts/:id`

Update an alert.

#### DELETE `/api/analytics/alerts/:id`

Delete an alert.

#### POST `/api/analytics/alerts/check`

Check all alerts for triggers.

### Quick Analytics

#### GET `/api/analytics/quick/revenue`

Revenue analytics summary.

#### GET `/api/analytics/quick/pipeline`

Pipeline analytics.

#### GET `/api/analytics/quick/projects`

Project analytics.

#### GET `/api/analytics/quick/clients`

Client analytics.

#### GET `/api/analytics/quick/team`

Team performance analytics.

#### GET `/api/analytics/report-runs`

Report execution history.

---

## Client CRM API

Extended client management with contacts, activities, custom fields, tags, and health scoring.

### Client Contacts

#### GET `/api/clients/:id/contacts`

Get all contacts for a client.

#### POST `/api/clients/:id/contacts`

Add a contact to a client.

**Request:**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1-555-0123",
  "role": "Project Manager",
  "isPrimary": false
}
```

#### PUT `/api/clients/contacts/:contactId`

Update a contact.

#### DELETE `/api/clients/contacts/:contactId`

Delete a contact.

#### POST `/api/clients/:id/contacts/:contactId/set-primary`

Set a contact as primary.

### Client Activities

#### GET `/api/clients/:id/activities`

Get activity history for a client.

**Query Parameters:**

- `limit` - Results per page (default: 50)
- `offset` - Pagination offset

#### POST `/api/clients/:id/activities`

Log an activity for a client.

**Request:**

```json
{
  "activityType": "call",
  "description": "Discussed project timeline",
  "metadata": {}
}
```

**Activity Types:** `note`, `call`, `email`, `meeting`, `status_change`, `invoice_sent`, `payment_received`, `project_created`, `proposal_sent`, `contact_added`, `contact_removed`, `tag_added`, `tag_removed`

#### GET `/api/clients/activities/recent`

Get recent activities across all clients.

### Custom Fields

#### GET `/api/clients/custom-fields`

Get all custom field definitions.

#### POST `/api/clients/custom-fields`

Create a custom field.

**Request:**

```json
{
  "fieldName": "industry",
  "fieldType": "select",
  "options": ["Tech", "Healthcare", "Finance"],
  "isRequired": false
}
```

**Field Types:** `text`, `number`, `date`, `select`, `multiselect`, `boolean`

#### PUT `/api/clients/custom-fields/:fieldId`

Update a custom field definition.

#### DELETE `/api/clients/custom-fields/:fieldId`

Delete a custom field.

#### GET `/api/clients/:id/custom-fields`

Get custom field values for a client.

#### PUT `/api/clients/:id/custom-fields`

Update custom field values for a client.

### Client Tags

#### GET `/api/clients/tags`

Get all available tags.

#### POST `/api/clients/tags`

Create a new tag.

**Request:**

```json
{
  "name": "VIP",
  "color": "#dc2626"
}
```

#### PUT `/api/clients/tags/:tagId`

Update a tag.

#### DELETE `/api/clients/tags/:tagId`

Delete a tag.

#### GET `/api/clients/:id/tags`

Get tags assigned to a client.

#### POST `/api/clients/:id/tags/:tagId`

Assign a tag to a client.

#### DELETE `/api/clients/:id/tags/:tagId`

Remove a tag from a client.

#### GET `/api/clients/by-tag/:tagId`

Get all clients with a specific tag.

### Client Health Scoring

#### GET `/api/clients/:id/health`

Get health score for a client.

**Response:**

```json
{
  "success": true,
  "health": {
    "score": 85,
    "status": "healthy",
    "factors": {
      "paymentHistory": 90,
      "engagement": 80,
      "projectSuccess": 85
    },
    "lastCalculated": "2026-02-01T10:00:00Z"
  }
}
```

#### POST `/api/clients/:id/health/recalculate`

Force recalculation of health score.

#### GET `/api/clients/at-risk`

Get clients with low health scores.

### Client Statistics

#### GET `/api/clients/:id/stats`

Get comprehensive statistics for a client.

#### PUT `/api/clients/:id/crm`

Update CRM-specific fields for a client.

#### GET `/api/clients/follow-up`

Get clients needing follow-up.

---

## API Versioning

The API uses URL-based versioning:

- Current version: `v1` (implied, no version prefix required)
- Future versions: `https://nobhad.codes/api/v2/...`

**Version compatibility:**

- Major version changes may include breaking changes
- Minor version changes are backward compatible
- Version deprecation notices will be provided 6 months in advance

## Support

For API support and questions:

- **Documentation:** [nobhad.codes/docs](https://nobhad.codes/docs)
- **Email:** <<<api-nobhaduri@gmail.com>>>
- **Response Time:** 24-48 hours for technical inquiries
