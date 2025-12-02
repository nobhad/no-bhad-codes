# No Bhad Codes - API Reference

## Table of Contents
1. [Authentication](#authentication)
2. [Client Settings API](#client-settings-api)
3. [Project Management API](#project-management-api)
4. [Invoice Management API](#invoice-management-api)
5. [File Upload API](#file-upload-api)
6. [Messaging API](#messaging-api)
7. [Error Handling](#error-handling)
8. [Request/Response Examples](#requestresponse-examples)

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Authentication Flow
1. Login via `/api/auth/login` to receive JWT token
2. Include token in `Authorization` header for protected endpoints
3. Token expires after configured time (default: 24 hours)
4. Refresh token via `/api/auth/refresh` when needed

## Client Settings API

### Base URL
```
/api/clients
```

### Endpoints

#### 🔍 **GET** `/api/clients/me`
Get current authenticated client's profile

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

---

#### 🔄 **PUT** `/api/clients/me`
Update current client's profile information

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

---

#### 🔐 **PUT** `/api/clients/me/password`
Change client's password

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

---

#### 🔔 **PUT** `/api/clients/me/notifications`
Update notification preferences

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

---

#### 💳 **PUT** `/api/clients/me/billing`
Update billing information

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

---

## Project Management API

### Base URL
```
/api/projects
```

### Endpoints

#### 📝 **POST** `/api/projects/request`
Submit a new project request (clients only)

**Authentication:** Required (Client only)
**Request Body:**
```json
{
  "name": "Company Website Redesign",
  "projectType": "redesign",
  "budget": "5k-10k",
  "timeline": "1-2months",
  "description": "We need to modernize our existing website..."
}
```

**Valid Project Types:**
- `website` - New Website
- `redesign` - Website Redesign
- `webapp` - Web Application
- `ecommerce` - E-Commerce Site
- `maintenance` - Maintenance & Updates
- `other` - Other

**Valid Budget Ranges:**
- `1k-2.5k` - $1,000 - $2,500
- `2.5k-5k` - $2,500 - $5,000
- `5k-10k` - $5,000 - $10,000
- `10k-25k` - $10,000 - $25,000
- `25k+` - $25,000+

**Valid Timelines:**
- `asap` - As soon as possible
- `1-2months` - 1-2 months
- `3-6months` - 3-6 months
- `flexible` - Flexible

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Project request submitted successfully. You will be contacted shortly.",
  "project": {
    "id": 15,
    "name": "Company Website Redesign",
    "status": "pending",
    "created_at": "2025-12-01T15:30:00.000Z"
  }
}
```

**Error (403 Forbidden):**
```json
{
  "error": "Only clients can submit project requests"
}
```

---

## Invoice Management API

### Base URL
```
/api/invoices
```

### Endpoints

#### 🔍 **GET** `/api/invoices/test`
Test invoice system health

**Authentication:** None required  
**Response:**
```json
{
  "success": true,
  "message": "Invoice system is operational",
  "timestamp": "2025-09-02T05:46:22.662Z"
}
```

---

#### 🔍 **GET** `/api/invoices/me`
Get all invoices for the authenticated client with summary statistics

**Authentication:** Required
**Response (200 OK):**
```json
{
  "success": true,
  "invoices": [
    {
      "id": 1,
      "invoice_number": "INV-2025-001",
      "client_id": 5,
      "project_id": 1,
      "amount_total": 2500.00,
      "amount_paid": 0,
      "status": "sent",
      "due_date": "2025-12-30T00:00:00.000Z",
      "created_at": "2025-11-30T10:00:00.000Z",
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

---

#### 📝 **POST** `/api/invoices`
Create a new invoice

**Authentication:** Required  
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "projectId": 1,
  "clientId": 1,
  "lineItems": [
    {
      "description": "Website Design & Development",
      "quantity": 1,
      "rate": 3500.00,
      "amount": 3500.00
    },
    {
      "description": "Content Management System Setup",
      "quantity": 1,
      "rate": 1000.00,
      "amount": 1000.00
    }
  ],
  "dueDate": "2025-10-02",
  "notes": "50% due upfront, 50% on completion",
  "terms": "Payment due within 30 days",
  "currency": "USD"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "invoice": {
    "id": 1,
    "invoiceNumber": "INV-202509-123456",
    "projectId": 1,
    "clientId": 1,
    "amountTotal": 4500.00,
    "amountPaid": 0.00,
    "currency": "USD",
    "status": "draft",
    "dueDate": "2025-10-02",
    "issuedDate": "2025-09-02",
    "lineItems": [...],
    "notes": "50% due upfront, 50% on completion",
    "terms": "Payment due within 30 days",
    "createdAt": "2025-09-02T05:46:22.662Z"
  }
}
```

**Validation Errors (400 Bad Request):**
```json
{
  "error": "Missing required fields",
  "code": "MISSING_FIELDS",
  "required": ["projectId", "clientId", "lineItems"]
}
```

---

#### 🔍 **GET** `/api/invoices/:id`
Get invoice by ID

**Authentication:** Required  
**Parameters:**
- `id` (integer) - Invoice ID

**Response (200 OK):**
```json
{
  "success": true,
  "invoice": {
    "id": 1,
    "invoiceNumber": "INV-202509-123456",
    "projectId": 1,
    "clientId": 1,
    "amountTotal": 4500.00,
    "amountPaid": 0.00,
    "currency": "USD",
    "status": "draft",
    "dueDate": "2025-10-02",
    "issuedDate": "2025-09-02",
    "lineItems": [
      {
        "description": "Website Design & Development",
        "quantity": 1,
        "rate": 3500.00,
        "amount": 3500.00
      }
    ],
    "notes": "50% due upfront, 50% on completion",
    "terms": "Payment due within 30 days",
    "createdAt": "2025-09-02T05:46:22.662Z"
  }
}
```

**Error (404 Not Found):**
```json
{
  "error": "Invoice not found",
  "code": "NOT_FOUND"
}
```

---

#### 🔍 **GET** `/api/invoices/number/:invoiceNumber`
Get invoice by invoice number

**Authentication:** Required  
**Parameters:**
- `invoiceNumber` (string) - Invoice number (e.g., "INV-202509-123456")

**Response:** Same as GET `/api/invoices/:id`

---

#### 🔍 **GET** `/api/invoices/client/:clientId`
Get all invoices for a specific client

**Authentication:** Required  
**Parameters:**
- `clientId` (integer) - Client ID

**Response (200 OK):**
```json
{
  "success": true,
  "invoices": [
    {
      "id": 1,
      "invoiceNumber": "INV-202509-123456",
      "projectId": 1,
      "clientId": 1,
      "amountTotal": 4500.00,
      "status": "draft",
      // ... other invoice fields
    }
  ],
  "count": 1
}
```

---

#### 🔍 **GET** `/api/invoices/project/:projectId`
Get all invoices for a specific project

**Authentication:** Required  
**Parameters:**
- `projectId` (integer) - Project ID

**Response:** Same format as client invoices endpoint

---

#### 🔄 **PUT** `/api/invoices/:id/status`
Update invoice status

**Authentication:** Required  
**Parameters:**
- `id` (integer) - Invoice ID

**Request Body:**
```json
{
  "status": "sent",
  "paymentData": {
    "amountPaid": 2250.00,
    "paymentMethod": "bank_transfer",
    "paymentReference": "TXN-123456",
    "paidDate": "2025-09-15"
  }
}
```

**Valid Statuses:**
- `draft` - Initial state
- `sent` - Sent to client
- `viewed` - Client has viewed
- `partial` - Partially paid
- `paid` - Fully paid
- `overdue` - Past due date
- `cancelled` - Cancelled

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Invoice status updated successfully",
  "invoice": {
    // Updated invoice object
  }
}
```

---

#### 📧 **POST** `/api/invoices/:id/send`
Send invoice to client

**Authentication:** Required  
**Parameters:**
- `id` (integer) - Invoice ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Invoice sent successfully",
  "invoice": {
    // Updated invoice with status: "sent"
  }
}
```

---

#### 💳 **POST** `/api/invoices/:id/pay`
Mark invoice as paid

**Authentication:** Required
**Parameters:**
- `id` (integer) - Invoice ID

**Request Body:**
```json
{
  "amountPaid": 4500.00,
  "paymentMethod": "credit_card",
  "paymentReference": "CC-789012"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Invoice marked as paid",
  "invoice": {
    // Updated invoice with status: "paid" and payment details
  }
}
```

---

#### 📄 **GET** `/api/invoices/:id/pdf`
Download invoice as PDF

**Authentication:** Required
**Parameters:**
- `id` (integer) - Invoice ID

**Response:** PDF file stream with headers:
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="invoice-INV-2025-001.pdf"`

**PDF Contents:**
- Company header with contact information
- Invoice number and dates
- Bill To section with client details
- Line items table
- Subtotal, tax, and total
- Payment terms and notes

**Error (403 Forbidden):**
```json
{
  "error": "Not authorized to view this invoice"
}
```

**Error (404 Not Found):**
```json
{
  "error": "Invoice not found"
}
```

---

#### 📊 **GET** `/api/invoices/stats`
Get invoice statistics

**Authentication:** Required  
**Query Parameters:**
- `clientId` (optional integer) - Filter by specific client

**Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "totalInvoices": 25,
    "totalAmount": 125000.00,
    "totalPaid": 98000.00,
    "totalOutstanding": 27000.00,
    "overdue": 3
  }
}
```

---

#### 🔄 **POST** `/api/invoices/generate/intake/:intakeId`
Generate invoice from client intake

**Authentication:** Required (Admin only)  
**Parameters:**
- `intakeId` (integer) - Client intake ID

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Invoice generated from intake successfully",
  "invoice": {
    // Generated invoice object
    "notes": "Generated from intake: Website redesign for tech startup"
  }
}
```

**Error (400 Bad Request):**
```json
{
  "error": "Intake not ready for invoice generation",
  "code": "INTAKE_NOT_CONVERTED",
  "message": "Intake must be converted to project and client first"
}
```

## File Upload API

### Base URL
```
/api/uploads
```

### Endpoints

#### 🔍 **GET** `/api/uploads/test`
Test upload system health

**Authentication:** None required  
**Response:**
```json
{
  "success": true,
  "message": "Upload system is operational",
  "timestamp": "2025-09-02T05:46:22.662Z",
  "uploadDir": "/path/to/uploads",
  "limits": {
    "fileSize": "10MB",
    "maxFiles": 5
  },
  "allowedTypes": [
    "Images: jpg, jpeg, png, gif, webp",
    "Documents: pdf, doc, docx, txt, md",
    "Spreadsheets: xls, xlsx, csv",
    "Presentations: ppt, pptx",
    "Archives: zip, rar, tar, gz",
    "Code: js, ts, html, css, json, xml"
  ]
}
```

---

#### 📤 **POST** `/api/uploads/single`
Upload a single file

**Authentication:** Required  
**Content-Type:** `multipart/form-data`

**Form Data:**
- `file` (file) - The file to upload
- `category` (string, optional) - File category: `general`, `avatar`, `project_file`, `invoice_attachment`, `message_attachment`

**Response (201 Created):**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "file": {
    "id": "1693574782123",
    "filename": "1693574782123-abc123.pdf",
    "originalName": "project-proposal.pdf",
    "mimetype": "application/pdf",
    "size": 2048576,
    "path": "/uploads/general/1693574782123-abc123.pdf",
    "url": "/uploads/1693574782123-abc123.pdf",
    "uploadedBy": 1,
    "uploadedAt": "2025-09-02T05:46:22.662Z"
  }
}
```

---

#### 📤 **POST** `/api/uploads/multiple`
Upload multiple files (max 5)

**Authentication:** Required  
**Content-Type:** `multipart/form-data`

**Form Data:**
- `files` (file[]) - Array of files to upload

**Response (201 Created):**
```json
{
  "success": true,
  "message": "3 files uploaded successfully",
  "files": [
    {
      "id": "1693574782123-1",
      "filename": "1693574782123-abc123.pdf",
      "originalName": "document1.pdf",
      // ... other file properties
    },
    {
      "id": "1693574782123-2",
      "filename": "1693574782124-def456.jpg",
      "originalName": "image1.jpg",
      // ... other file properties
    }
  ]
}
```

---

#### 👤 **POST** `/api/uploads/avatar`
Upload user avatar (images only)

**Authentication:** Required  
**Content-Type:** `multipart/form-data`

**Form Data:**
- `avatar` (file) - Image file for avatar

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "avatar": {
    "id": "1693574782123",
    "filename": "1693574782123-avatar.jpg",
    "originalName": "profile-pic.jpg",
    "mimetype": "image/jpeg",
    "size": 512000,
    "url": "/uploads/avatars/1693574782123-avatar.jpg",
    "uploadedBy": 1,
    "uploadedAt": "2025-09-02T05:46:22.662Z"
  }
}
```

**Validation Error (400 Bad Request):**
```json
{
  "error": "Avatar must be an image file",
  "code": "INVALID_AVATAR_TYPE"
}
```

---

#### 📁 **POST** `/api/uploads/project/:projectId`
Upload file for specific project

**Authentication:** Required  
**Parameters:**
- `projectId` (integer) - Project ID

**Content-Type:** `multipart/form-data`

**Form Data:**
- `project_file` (file) - File to upload for the project

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Project file uploaded successfully",
  "file": {
    "id": "1693574782123",
    "projectId": 1,
    "filename": "1693574782123-project.zip",
    "originalName": "project-assets.zip",
    "mimetype": "application/zip",
    "size": 5242880,
    "url": "/uploads/projects/1693574782123-project.zip",
    "uploadedBy": 1,
    "uploadedAt": "2025-09-02T05:46:22.662Z"
  }
}
```

---

#### 🔍 **GET** `/api/uploads/client`
Get all files for authenticated client

**Authentication:** Required
**Response (200 OK):**
```json
{
  "success": true,
  "files": [
    {
      "id": 1,
      "originalName": "project-brief.pdf",
      "filename": "1701234567890-abc123.pdf",
      "mimetype": "application/pdf",
      "size": 245760,
      "projectId": 1,
      "projectName": "Website Redesign",
      "uploadedAt": "2025-12-01T10:30:00.000Z",
      "uploadedBy": 5
    }
  ],
  "count": 1
}
```

---

#### 🔍 **GET** `/api/uploads/project/:projectId`
Get all files for a specific project

**Authentication:** Required
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

**Error (403 Forbidden):**
```json
{
  "error": "Access denied to this project"
}
```

---

#### 📥 **GET** `/api/uploads/file/:fileId`
Download or preview a specific file

**Authentication:** Required
**Parameters:**
- `fileId` (integer) - File ID

**Query Parameters:**
- `download` (boolean, optional) - If `true`, forces download with `Content-Disposition: attachment`; otherwise `inline` for preview

**Response:** File stream with appropriate Content-Type and Content-Disposition headers

**Access Control:** User must own the project the file belongs to, or have uploaded the file

**Error (403 Forbidden):**
```json
{
  "error": "Access denied to this file"
}
```

**Error (404 Not Found):**
```json
{
  "error": "File not found"
}
```

---

#### 🗑️ **DELETE** `/api/uploads/file/:fileId`
Delete a specific file

**Authentication:** Required
**Parameters:**
- `fileId` (integer) - File ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Error (403 Forbidden):**
```json
{
  "error": "Access denied - you do not own this file"
}
```

**Error (404 Not Found):**
```json
{
  "error": "File not found"
}
```

## Messaging API

### Base URL
```
/api/messages
```

### Endpoints

#### 🔍 **GET** `/api/messages/threads`
Get all message threads for authenticated user

**Authentication:** Required
**Response (200 OK):**
```json
{
  "success": true,
  "threads": [
    {
      "id": 1,
      "client_id": 5,
      "subject": "General Discussion",
      "thread_type": "general",
      "project_id": 1,
      "priority": "normal",
      "created_at": "2025-11-30T10:00:00.000Z",
      "last_message_at": "2025-12-01T14:30:00.000Z",
      "unread_count": 2
    }
  ],
  "count": 1
}
```

---

#### 📝 **POST** `/api/messages/threads`
Create a new message thread

**Authentication:** Required
**Request Body:**
```json
{
  "subject": "Project Question",
  "projectId": 1,
  "priority": "normal"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Thread created successfully",
  "thread": {
    "id": 2,
    "client_id": 5,
    "subject": "Project Question",
    "thread_type": "general",
    "project_id": 1,
    "priority": "normal",
    "created_at": "2025-12-01T15:00:00.000Z"
  }
}
```

---

#### 🔍 **GET** `/api/messages/threads/:id/messages`
Get all messages in a thread

**Authentication:** Required
**Parameters:**
- `id` (integer) - Thread ID

**Response (200 OK):**
```json
{
  "success": true,
  "messages": [
    {
      "id": 1,
      "thread_id": 1,
      "sender_id": 5,
      "sender_type": "client",
      "sender_name": "John Doe",
      "content": "Hello, I have a question about the project timeline.",
      "created_at": "2025-12-01T14:00:00.000Z",
      "read_at": null
    },
    {
      "id": 2,
      "thread_id": 1,
      "sender_id": 1,
      "sender_type": "admin",
      "sender_name": "Noelle",
      "content": "Sure! We're on track for the December deadline.",
      "created_at": "2025-12-01T14:30:00.000Z",
      "read_at": null
    }
  ],
  "count": 2
}
```

---

#### 📝 **POST** `/api/messages/threads/:id/messages`
Send a message in a thread

**Authentication:** Required
**Parameters:**
- `id` (integer) - Thread ID

**Request Body:**
```json
{
  "content": "Thank you for the update!"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": {
    "id": 3,
    "thread_id": 1,
    "sender_id": 5,
    "sender_type": "client",
    "content": "Thank you for the update!",
    "created_at": "2025-12-01T14:45:00.000Z"
  }
}
```

---

#### 🔍 **GET** `/api/messages/preferences`
Get notification preferences for messages

**Authentication:** Required
**Response (200 OK):**
```json
{
  "success": true,
  "preferences": {
    "email_notifications": true,
    "email_frequency": "immediate",
    "push_notifications": false
  }
}
```

---

#### 🔄 **PUT** `/api/messages/preferences`
Update notification preferences

**Authentication:** Required
**Request Body:**
```json
{
  "email_notifications": true,
  "email_frequency": "daily",
  "push_notifications": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Preferences updated successfully"
}
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "message": "Detailed error description"
}
```

### Common HTTP Status Codes

#### 400 Bad Request
- Invalid request data
- Missing required fields
- File validation failures

#### 401 Unauthorized
- Missing or invalid authentication token
- Expired token

#### 403 Forbidden
- Insufficient permissions
- Admin-only endpoint accessed by non-admin

#### 404 Not Found
- Resource not found
- Invalid ID parameters

#### 413 Payload Too Large
- File size exceeds limit
- Request body too large

#### 500 Internal Server Error
- Database errors
- Server configuration issues
- Unexpected errors

### File Upload Specific Errors

#### File Too Large
```json
{
  "error": "File too large",
  "code": "FILE_TOO_LARGE",
  "message": "File size cannot exceed 10MB"
}
```

#### Too Many Files
```json
{
  "error": "Too many files",
  "code": "TOO_MANY_FILES", 
  "message": "Cannot upload more than 5 files at once"
}
```

#### Invalid File Type
```json
{
  "error": "File type not allowed",
  "code": "INVALID_FILE_TYPE",
  "message": "File type not allowed: .exe"
}
```

### Authentication Errors

#### Missing Token
```json
{
  "error": "Access token required",
  "code": "TOKEN_MISSING"
}
```

#### Invalid Token
```json
{
  "error": "Invalid token",
  "code": "TOKEN_INVALID"
}
```

#### Expired Token
```json
{
  "error": "Token expired",
  "code": "TOKEN_EXPIRED"
}
```

## Request/Response Examples

### Complete Invoice Creation Flow

#### 1. Create Invoice
```bash
curl -X POST http://localhost:3001/api/invoices \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 1,
    "clientId": 1,
    "lineItems": [
      {
        "description": "Website Development",
        "quantity": 1,
        "rate": 5000,
        "amount": 5000
      }
    ],
    "notes": "First project invoice",
    "terms": "Net 30"
  }'
```

#### 2. Send Invoice to Client
```bash
curl -X POST http://localhost:3001/api/invoices/1/send \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### 3. Mark as Paid
```bash
curl -X POST http://localhost:3001/api/invoices/1/pay \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "amountPaid": 5000,
    "paymentMethod": "bank_transfer",
    "paymentReference": "TXN-ABC123"
  }'
```

### File Upload Examples

#### Upload Single File
```bash
curl -X POST http://localhost:3001/api/uploads/single \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "file=@document.pdf"
```

#### Upload Avatar
```bash
curl -X POST http://localhost:3001/api/uploads/avatar \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "avatar=@profile.jpg"
```

#### Upload Multiple Files
```bash
curl -X POST http://localhost:3001/api/uploads/multiple \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "files=@file1.pdf" \
  -F "files=@file2.jpg" \
  -F "files=@file3.docx"
```

### Error Handling Examples

#### Handle Missing Authentication
```javascript
fetch('/api/invoices', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
    // Missing Authorization header
  },
  body: JSON.stringify({ projectId: 1, clientId: 1, lineItems: [] })
})
.then(response => {
  if (response.status === 401) {
    // Redirect to login
    window.location.href = '/login';
  }
  return response.json();
})
```

#### Handle File Upload Errors
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('/api/uploads/single', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
.then(response => response.json())
.then(data => {
  if (!data.success) {
    switch(data.code) {
      case 'FILE_TOO_LARGE':
        alert('File is too large. Maximum size is 10MB.');
        break;
      case 'INVALID_FILE_TYPE':
        alert('File type not supported.');
        break;
      case 'TOKEN_EXPIRED':
        // Refresh token and retry
        refreshToken().then(() => retry());
        break;
      default:
        alert(`Upload failed: ${data.error}`);
    }
  } else {
    console.log('File uploaded:', data.file);
  }
})
```

---

## Rate Limiting & Best Practices

### Rate Limits
- **File Uploads**: 10 requests per minute per user
- **Invoice Operations**: 60 requests per minute per user
- **Authentication**: 5 failed attempts per 15 minutes per IP

### Best Practices

#### Authentication
- Always check token expiration before requests
- Implement automatic token refresh
- Store tokens securely (httpOnly cookies recommended)
- Handle 401/403 responses gracefully

#### File Uploads
- Validate file types on client-side before upload
- Show upload progress for large files
- Implement retry logic for failed uploads
- Compress images before upload when possible

#### Error Handling
- Always check response status codes
- Implement user-friendly error messages
- Log detailed errors for debugging
- Provide fallback options for failed operations

#### Performance
- Use pagination for large result sets
- Cache frequently accessed data
- Implement request debouncing for search/filter operations
- Use appropriate HTTP methods (GET for queries, POST for creation)