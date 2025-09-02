# API Documentation

## Overview

The No Bhad Codes API provides a RESTful interface for client management, project tracking, and administrative operations. All endpoints use JSON for request and response payloads unless otherwise specified.

**Base URL:** `https://nobhadcodes.com/api`  
**Authentication:** Bearer token (JWT)  
**Content-Type:** `application/json`

## Authentication

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

### Authorization Header
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

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
Authenticate user credentials and receive JWT token.

**Request:**
```json
{
  "email": "client@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "client@example.com",
    "type": "client",
    "company_name": "Acme Corp"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "24h"
}
```

**Error Responses:**
- `400` - Invalid email format
- `401` - Invalid credentials
- `429` - Too many login attempts

### POST `/auth/logout`
Invalidate current authentication token.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### POST `/auth/refresh`
Refresh JWT token before expiration.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "24h"
}
```

## Client Management Endpoints

### GET `/clients`
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
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

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

### POST `/projects/:id/files`
Upload files to project.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request:**
```
POST /api/projects/101/files
Content-Type: multipart/form-data

files: [File objects]
```

**Response:**
```json
{
  "message": "3 file(s) uploaded successfully",
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
- Allowed file types: PDF, DOC, DOCX, TXT, PNG, JPG, JPEG, GIF, ZIP

### GET `/projects/:id/files`
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

## Client Intake Endpoint

### POST `/intake-form`
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
    "updated_by": "admin@nobhadcodes.com"
  }
}
```

## SDK Examples

### JavaScript/Node.js
```javascript
const client = new NoBhadCodesAPI({
  baseURL: 'https://nobhadcodes.com/api',
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
curl -X POST https://nobhadcodes.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"client@example.com","password":"password123"}'

# Get projects
curl -X GET https://nobhadcodes.com/api/projects \
  -H "Authorization: Bearer your-jwt-token"

# Create milestone
curl -X POST https://nobhadcodes.com/api/projects/101/milestones \
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
curl -X POST https://nobhadcodes.com/api/messages/threads \
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
curl -X POST https://nobhadcodes.com/api/messages/threads/1/messages \
  -H "Authorization: Bearer your-token" \
  -F "message=Here's my project update" \
  -F "priority=normal" \
  -F "attachments=@document.pdf" \
  -F "attachments=@screenshot.png"
```

#### Mark Messages as Read
```bash
curl -X PUT https://nobhadcodes.com/api/messages/threads/1/read \
  -H "Authorization: Bearer your-token"
```

### Quick Inquiries

#### Send Quick Inquiry
```bash
curl -X POST https://nobhadcodes.com/api/messages/inquiry \
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
curl -X PUT https://nobhadcodes.com/api/messages/preferences \
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
curl https://nobhadcodes.com/api/messages/analytics \
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

## API Versioning

The API uses URL-based versioning:
- Current version: `v1` (implied, no version prefix required)
- Future versions: `https://nobhadcodes.com/api/v2/...`

**Version compatibility:**
- Major version changes may include breaking changes
- Minor version changes are backward compatible
- Version deprecation notices will be provided 6 months in advance

## Support

For API support and questions:
- **Documentation:** [nobhadcodes.com/docs](https://nobhadcodes.com/docs)
- **Email:** api-support@nobhadcodes.com
- **Response Time:** 24-48 hours for technical inquiries