# No Bhad Codes - System Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Implementation Summary](#implementation-summary)
3. [Architecture](#architecture)
4. [Invoice Generation System](#invoice-generation-system)
5. [File Upload System](#file-upload-system)
6. [Database Schema](#database-schema)
7. [Implementation Details](#implementation-details)
8. [API Endpoints](#api-endpoints)
9. [Authentication & Security](#authentication--security)
10. [Development Setup](#development-setup)
11. [Deployment Guide](#deployment-guide)

## System Overview

The No Bhad Codes system is a comprehensive client management and project tracking platform built for web development services. It features automated invoice generation, secure file uploads, client portal functionality, and project management tools.

### System Key Features

- **Client Intake Management**: Automated client onboarding with form processing
- **Project Management**: Track projects from intake to completion
- **Invoice Generation**: Automated invoice creation from client intakes and project data
- **File Upload System**: Secure file handling for avatars, project files, and attachments
- **Client Portal**: Dedicated interface for client interactions
- **Admin Dashboard**: Comprehensive management tools for business operations

### Technology Stack

- **Backend**: Node.js with Express.js and TypeScript (100% type-safe)
- **Database**: SQLite with custom wrapper for async operations and type-safe row helpers
- **Authentication**: JWT tokens with role-based access control
- **File Processing**: Multer for secure file uploads
- **Development**: Vite build system with hot reload
- **Error Tracking**: Sentry integration for production monitoring

**Type Safety**: All server-side code is fully type-safe with 0 TypeScript errors. Database row accesses use type-safe helper utilities (`server/database/row-helpers.ts`) for consistent, safe property extraction.

## Implementation Summary

### ✅ Completed Systems

#### 1. 📊 Invoice Generation System

**Purpose**: Automated invoice creation, management, and payment tracking for web development projects.

**Key Achievements**:

- ✅ Complete CRUD operations for invoice management
- ✅ Automated invoice generation from client intake forms
- ✅ Smart line item creation based on project type and budget
- ✅ Payment status tracking and history
- ✅ Invoice numbering system with timestamp-based uniqueness
- ✅ Integration with existing client and project data

**Technical Implementation**:

- **Service Layer**: `InvoiceService` with singleton pattern
- **Database Integration**: SQLite with custom async wrapper
- **API Endpoints**: 11 comprehensive REST endpoints
- **Authentication**: JWT token-based security
- **Business Logic**: Intelligent project-to-invoice mapping

#### 2. 📁 File Upload System

**Purpose**: Secure file handling for avatars, project files, documents, and attachments.

**Key Achievements**:

- ✅ Multi-format file upload support (images, documents, archives, etc.)
- ✅ Organized storage with automatic directory creation
- ✅ File type validation and security filtering
- ✅ Size limits and upload count restrictions
- ✅ User authentication and file ownership tracking
- ✅ Specialized endpoints for different file types

**Technical Implementation**:

- **File Processing**: Multer with custom storage configuration
- **Security**: MIME type validation, size limits, authentication
- **Storage**: Organized directory structure by file purpose
- **API Endpoints**: 9 specialized upload endpoints (including CRUD)
- **Error Handling**: Comprehensive multer error processing

#### 3. 📂 Client Portal File Management

**Purpose**: Complete file management interface for clients in the Client Portal.

**Key Achievements**:

- ✅ Drag & drop file upload with visual feedback
- ✅ File list rendering from backend API
- ✅ Demo mode fallback when backend unavailable
- ✅ File preview (images/PDFs open in new browser tab)
- ✅ File download with original filename
- ✅ Access control (clients can only access their own files)
- ✅ File type icons (document, image, PDF)
- ✅ Human-readable file size formatting
- ✅ XSS protection via HTML escaping

**Technical Implementation**:

- **Frontend**: Vanilla TypeScript with Fetch API
- **Backend**: Express.js with Multer middleware
- **Authentication**: JWT token-based access control
- **Demo Mode**: Graceful fallback when server unavailable

### 📈 Business Value

**Automated Operations**:

- Time Savings: Automated invoice generation reduces manual work
- Consistency: Standardized line items and pricing structure
- Accuracy: Automated calculations prevent human error
- Scalability: System handles growing client base

**Client Experience**:

- File Management: Secure upload and storage system
- Professional Invoicing: Consistent, branded invoice format
- Payment Tracking: Clear status updates and payment history
- Project Organization: Files linked to specific projects

**Administrative Efficiency**:

- Centralized Management: Single system for all invoice operations
- Status Tracking: Real-time visibility into payment status
- Automated Workflows: From intake to invoice generation
- Reporting Capabilities: Statistics and analytics built-in

## Architecture

### Core Components

```text
server/
├── app.ts                 # Main Express application
├── database/
│   ├── init.ts           # Database initialization and wrapper
│   └── migrations/       # Database schema migrations
├── middleware/
│   ├── auth.ts          # JWT authentication middleware
│   ├── errorHandler.ts  # Global error handling
│   └── logger.ts        # Request logging
├── routes/
│   ├── invoices.ts      # Invoice management endpoints
│   ├── uploads.ts       # File upload endpoints
│   ├── auth.ts          # Authentication routes
│   ├── clients.ts       # Client management
│   └── projects.ts      # Project management
├── services/
│   ├── invoice-service.ts    # Invoice business logic
│   ├── email-service.ts      # Email notifications
│   ├── cache-service.ts      # Redis caching
│   └── error-tracking.ts     # Error monitoring
└── uploads/             # File storage directory
    ├── avatars/
    ├── projects/
    ├── invoices/
    ├── messages/
    └── general/
```

### Design Patterns

- **Singleton Pattern**: Services use singleton instances for consistency
- **Repository Pattern**: Database operations abstracted through service layer
- **Middleware Pattern**: Express middleware for authentication and validation
- **Factory Pattern**: Dynamic route and service initialization
- **Observer Pattern**: Error tracking and logging systems

## Invoice Generation System

### Invoice Overview

The invoice system provides comprehensive invoice management with automated generation from client intakes, flexible line item management, and payment tracking.

### Invoice Key Features

- **Automated Generation**: Create invoices directly from client intake forms
- **Flexible Line Items**: Support for multiple services and pricing structures
- **Payment Tracking**: Monitor payment status and history
- **Project Integration**: Link invoices to specific projects and clients
- **Status Management**: Track invoice lifecycle from draft to paid

### Invoice Service (`server/services/invoice-service.ts`)

#### Core Methods

```typescript
class InvoiceService {
  // Create new invoice
  async createInvoice(data: InvoiceCreateData): Promise<Invoice>
  
  // Retrieve invoices
  async getInvoiceById(id: number): Promise<Invoice>
  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice>
  async getClientInvoices(clientId: number): Promise<Invoice[]>
  async getProjectInvoices(projectId: number): Promise<Invoice[]>
  
  // Update invoice status
  async updateInvoiceStatus(id: number, status: Invoice['status'], paymentData?: PaymentData): Promise<Invoice>
  async sendInvoice(id: number): Promise<Invoice>
  async markInvoiceAsPaid(id: number, paymentData: PaymentData): Promise<Invoice>
  
  // Analytics and reporting
  async getInvoiceStats(clientId?: number): Promise<InvoiceStats>
  
  // Auto-generation from intake
  async generateInvoiceFromIntake(intakeId: number): Promise<Invoice>
}
```

#### Invoice Data Structure

```typescript
interface Invoice {
  id?: number;
  invoiceNumber: string;          // Auto-generated: INV-YYYYMM-XXXXXX
  projectId: number;
  clientId: number;
  amountTotal: number;
  amountPaid: number;
  currency: string;               // Default: USD
  status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  dueDate?: string;
  issuedDate?: string;
  paidDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}
```

### Invoice API Endpoints

#### Invoice Management

- **POST /api/invoices** - Create new invoice
- **GET /api/invoices/:id** - Get invoice by ID
- **GET /api/invoices/number/:invoiceNumber** - Get by invoice number
- **GET /api/invoices/client/:clientId** - Get client invoices
- **GET /api/invoices/project/:projectId** - Get project invoices

#### Invoice Operations

- **PUT /api/invoices/:id/status** - Update invoice status
- **POST /api/invoices/:id/send** - Send invoice to client
- **POST /api/invoices/:id/pay** - Mark invoice as paid

#### Analytics & Automation

- **GET /api/invoices/stats** - Get invoice statistics
- **POST /api/invoices/generate/intake/:intakeId** - Generate from intake

#### Development/Testing

- **GET /api/invoices/test** - System health check

### Auto-Generation Logic

The system automatically generates invoices from client intakes based on project type and budget:

#### Project Type Mapping

```typescript
// Website/Business Site (70% dev, 20% CMS, 10% SEO)
'website' | 'business site' → [
  'Website Design & Development',
  'Content Management System Setup', 
  'SEO Optimization & Testing'
]

// Web Application (60% dev, 20% database, 10% API, 10% testing)
'web app' | 'application' → [
  'Application Development',
  'Database Design & Setup',
  'API Development',
  'Testing & Deployment'
]

// E-commerce (50% platform, 20% payment, 20% catalog, 10% security)
'e-commerce' → [
  'E-commerce Platform Development',
  'Payment Integration',
  'Product Catalog Setup',
  'Security & Testing'
]

// Browser Extension (80% dev, 10% compatibility, 10% submission)
'browser extension' → [
  'Browser Extension Development',
  'Cross-browser Compatibility',
  'Store Submission & Review'
]
```

#### Budget Parsing

```typescript
// Parses budget ranges like "5k-10k", "2500-5000", "10k+"
const budgetMatch = budgetRange.match(/(\d+)k?-?(\d+)?k?/);
const baseAmount = calculateAverageFromRange(budgetMatch);
```

## File Upload System

### Upload Overview

Comprehensive file upload system with security validation, organized storage, and multi-format support for client portal functionality.

### Upload Key Features

- **Multi-Type Uploads**: Single files, multiple files, avatars, project-specific
- **Security Validation**: File type filtering, size limits, authentication
- **Organized Storage**: Automatic directory structure based on file purpose
- **Metadata Tracking**: Complete file information and user association

### Upload Service Configuration

#### Multer Configuration (Service)

```typescript
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Dynamic subdirectory based on file type
    let subDir = 'general';
    switch(file.fieldname) {
      case 'avatar': subDir = 'avatars'; break;
      case 'project_file': subDir = 'projects'; break;
      case 'invoice_attachment': subDir = 'invoices'; break;
      case 'message_attachment': subDir = 'messages'; break;
    }
    // Auto-create directory if not exists
    const targetDir = resolve(uploadDir, subDir);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random.ext
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2);
    const ext = extname(file.originalname);
    cb(null, `${timestamp}-${randomString}${ext}`);
  }
});
```

#### File Type Validation

```typescript
const allowedTypes = {
  images: /\.(jpg|jpeg|png|gif|webp)$/i,
  documents: /\.(pdf|doc|docx|txt|md)$/i,
  spreadsheets: /\.(xls|xlsx|csv)$/i,
  presentations: /\.(ppt|pptx)$/i,
  archives: /\.(zip|rar|tar|gz)$/i,
  code: /\.(js|ts|html|css|json|xml)$/i
};
```

#### Security Limits

- **File Size**: 10MB maximum per file
- **File Count**: 5 files maximum per request
- **Authentication**: JWT token required for all uploads
- **File Validation**: MIME type and extension checking

### Upload API Endpoints

#### Core Upload Operations

- **POST /api/uploads/single** - Upload single file
- **POST /api/uploads/multiple** - Upload multiple files (max 5)
- **POST /api/uploads/avatar** - Upload user avatar (images only)
- **POST /api/uploads/project/:projectId** - Upload project-specific files

#### System Management

- **GET /api/uploads/test** - System health and configuration check

### File Metadata Structure

```typescript
interface UploadedFile {
  id: string;                    // Unique identifier
  filename: string;              // Generated filename
  originalName: string;          // Client's original filename
  mimetype: string;              // MIME type
  size: number;                  // File size in bytes
  path: string;                  // Full server path
  url: string;                   // Public access URL
  uploadedBy: number;            // User ID who uploaded
  uploadedAt: string;            // ISO timestamp
  projectId?: number;            // Associated project (if applicable)
}
```

### Directory Structure

```text
uploads/
├── avatars/          # User profile images
├── projects/         # Project-related files
├── invoices/         # Invoice attachments
├── messages/         # Message attachments
└── general/          # Miscellaneous uploads
```

## Database Schema

### Core Tables

#### invoices

```sql
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  amount_total DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft',
  due_date DATE,
  issued_date DATE,
  paid_date DATE,
  payment_method TEXT,
  payment_reference TEXT,
  line_items TEXT NOT NULL,  -- JSON array
  notes TEXT,
  terms TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

#### clients

```sql
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### projects

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  budget_range TEXT,
  status TEXT DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

#### client_intakes

```sql
CREATE TABLE client_intakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_type TEXT NOT NULL,
  project_description TEXT,
  budget_range TEXT,
  timeline TEXT,
  contact_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  project_id INTEGER,  -- Set when converted to project
  client_id INTEGER,   -- Set when converted to client
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

### Database Wrapper

Custom async wrapper for SQLite operations:

```typescript
class DatabaseWrapper implements Database {
  async get(sql: string, params: any[] = []): Promise<DatabaseRow | undefined>
  async all(sql: string, params: any[] = []): Promise<DatabaseRow[]>
  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }>
  async close(): Promise<void>
}
```

## Implementation Details

### Invoice Service Architecture

The `InvoiceService` class implements a singleton pattern for consistent database connections and business logic centralization.

```typescript
export class InvoiceService {
  private static instance: InvoiceService;
  private db: Database;

  private constructor() {
    this.db = getDatabase();
  }

  static getInstance(): InvoiceService {
    if (!InvoiceService.instance) {
      InvoiceService.instance = new InvoiceService();
    }
    return InvoiceService.instance;
  }
}
```

#### Automatic Invoice Number Generation

```typescript
private generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-6);
  return `INV-${year}${month}-${timestamp}`;
}
```

**Format**: `INV-YYYYMM-XXXXXX` (e.g., `INV-202509-123456`)

#### Smart Line Item Generation

The system intelligently creates line items based on project type:

```typescript
private generateLineItemsFromIntake(intake: any): InvoiceLineItem[] {
  const projectType = intake.project_type || 'website';
  const budgetRange = intake.budget_range || '5k-10k';
  
  // Parse budget range to determine base amount
  const budgetMatch = budgetRange.match(/(\d+)k?-?(\d+)?k?/);
  let baseAmount = 5000; // Default fallback
  
  if (budgetMatch) {
    const min = parseInt(budgetMatch[1]) * (budgetMatch[1].length <= 2 ? 1000 : 1);
    const max = budgetMatch[2] ? parseInt(budgetMatch[2]) * (budgetMatch[2].length <= 2 ? 1000 : 1) : min;
    baseAmount = Math.floor((min + max) / 2);
  }

  // Generate line items based on project type
  switch (projectType.toLowerCase()) {
    case 'website':
    case 'business site':
      return [
        { description: 'Website Design & Development', quantity: 1, rate: baseAmount * 0.7, amount: baseAmount * 0.7 },
        { description: 'Content Management System Setup', quantity: 1, rate: baseAmount * 0.2, amount: baseAmount * 0.2 },
        { description: 'SEO Optimization & Testing', quantity: 1, rate: baseAmount * 0.1, amount: baseAmount * 0.1 }
      ];
    // Additional project types...
  }
}
```

### File Upload Implementation

#### Multer Configuration (Implementation)

```typescript
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Dynamic subdirectory based on file type
    let subDir = 'general';
    
    if (file.fieldname === 'avatar') {
      subDir = 'avatars';
    } else if (file.fieldname === 'project_file') {
      subDir = 'projects';
    } else if (file.fieldname === 'invoice_attachment') {
      subDir = 'invoices';
    } else if (file.fieldname === 'message_attachment') {
      subDir = 'messages';
    }
    
    // Create directory if it doesn't exist
    const targetDir = resolve(uploadDir, subDir);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const filename = sanitizeFilename(file.originalname); // nobhadcodes_<name>_<timestamp><ext>
    cb(null, filename);
  }
});
```

Implementation uses `server/config/uploads.ts`: `getUploadsDir()`, `getUploadsSubdir()`, `sanitizeFilename()`, and `UPLOAD_DIRS` (general, avatars, projects, invoices, messages, intake).

#### File Type Security Filter

Allowed extensions in `server/routes/uploads.ts` (JS/TS/HTML/CSS excluded to prevent stored XSS): images (jpg, jpeg, png, gif, webp, svg), documents (pdf, doc, docx, txt, md, rtf), spreadsheets (xls, xlsx, csv), presentations (ppt, pptx), archives (zip, rar, tar, gz, 7z), data (json, xml). Limits: 10MB per file, 5 files per request.

### Database Integration

#### Async SQLite Wrapper Implementation

```typescript
class DatabaseWrapper implements Database {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  async get(sql: string, params: any[] = []): Promise<DatabaseRow | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as DatabaseRow);
      });
    });
  }

  async all(sql: string, params: any[] = []): Promise<DatabaseRow[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as DatabaseRow[]);
      });
    });
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
}
```

## API Endpoints

### Authentication Endpoints

```text
POST /api/auth/login          # User login (client or admin)
GET  /api/auth/profile        # Current user profile
POST /api/auth/refresh        # Token refresh
POST /api/auth/logout         # User logout
GET  /api/auth/validate       # Validate token
POST /api/auth/forgot-password   # Request password reset
POST /api/auth/reset-password    # Reset password with token
POST /api/auth/magic-link     # Request magic link (passwordless)
POST /api/auth/verify-magic-link # Verify magic link and login
POST /api/auth/verify-invitation # Verify client invitation token
POST /api/auth/set-password   # Set password from invitation
POST /api/auth/admin/login    # Admin login
```

**Note:** There is no public `/api/auth/register`; clients are created by admin or via invitation. Full request/response details: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

### Client Management

```text
GET  /api/clients             # List all clients
POST /api/clients             # Create new client
GET  /api/clients/:id         # Get client details
PUT  /api/clients/:id         # Update client
DELETE /api/clients/:id       # Delete client
```

### Project Management

```text
GET  /api/projects            # List all projects
POST /api/projects            # Create new project
GET  /api/projects/:id        # Get project details
PUT  /api/projects/:id        # Update project
DELETE /api/projects/:id      # Delete project
GET  /api/projects/client/:clientId  # Get client projects
```

### Invoice System

```text
GET  /api/invoices/test                     # System health check
POST /api/invoices                          # Create invoice
GET  /api/invoices/:id                      # Get invoice by ID
GET  /api/invoices/number/:invoiceNumber    # Get by invoice number
GET  /api/invoices/client/:clientId         # Get client invoices
GET  /api/invoices/project/:projectId       # Get project invoices
PUT  /api/invoices/:id/status              # Update status
POST /api/invoices/:id/send                # Send to client
POST /api/invoices/:id/pay                 # Mark as paid
GET  /api/invoices/stats                   # Get statistics
POST /api/invoices/generate/intake/:intakeId  # Generate from intake
```

### File Upload API

```text
GET  /api/uploads/test                    # System health check
POST /api/uploads/single                  # Upload single file
POST /api/uploads/multiple                # Upload multiple files
POST /api/uploads/avatar                  # Upload user avatar
POST /api/uploads/project/:projectId      # Upload project file
```

### Additional API Route Groups

Full reference: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

|Prefix|Description|
|--------|-------------|
|`/api/intake`|Client intake form (POST), status by project (GET `/status/:projectId`)|
|`/api/messages`|Threads, messages, inquiry, preferences, analytics|
|`/api/proposals`|Proposal CRUD, admin list/update/convert, PDF, config|
|`/api/analytics`|Track, summary, realtime, sessions, reports, widgets, KPIs, alerts, quick stats|
|`/api/approvals`|Workflow definitions, start workflow, pending, approve/reject|
|`/api/triggers`|Workflow trigger CRUD, options, logs, test-emit|
|`/api/document-requests`|Client my-requests/view/upload; admin CRUD, templates, review|
|`/api/kb`|Knowledge base: categories, articles, search, featured, feedback; admin CRUD|
|`/api/contact`|Public contact form (POST)|

### System Endpoints

```text
GET  /                       # API information and available endpoints
GET  /health                 # System health check
GET  /uploads/:filename      # Static file serving (via /uploads)
```

## Authentication & Security

### JWT Authentication

- **Token-based**: Stateless authentication using JSON Web Tokens
- **Role-based Access**: Admin and client roles with different permissions
- **Token Expiration**: Configurable token lifetime with refresh capability
- **Secure Headers**: Bearer token authentication in Authorization header

### Security Middleware

```typescript
// Authentication middleware
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction)

// Admin access requirement
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction)

// Client access requirement  
export const requireClient = (req: AuthenticatedRequest, res: Response, next: NextFunction)
```

### Magic Link Authentication

Passwordless login option for clients:

- **Request**: POST `/api/auth/magic-link` with email
- **Verify**: POST `/api/auth/verify-magic-link` with token
- **Security**: Token expires in 15 minutes, single use
- **Rate Limited**: 3 requests per 15 minutes per IP

```typescript
// Request magic link
await fetch('/api/auth/magic-link', {
  method: 'POST',
  body: JSON.stringify({ email: 'client@example.com' })
});

// Verify and login
const response = await fetch('/api/auth/verify-magic-link', {
  method: 'POST',
  body: JSON.stringify({ token: 'abc123...' })
});
const { token, user } = await response.json();
```

### Audit Logging

Comprehensive audit logging tracks all user actions:

#### Automatic Logging (via middleware)

- All POST, PUT, PATCH, DELETE requests
- User info, IP address, user agent
- Request path and body
- Response status

#### Manual Logging (via service)

- Login/logout events
- Failed login attempts
- Password resets
- Status changes

#### Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  user_email TEXT,
  user_type TEXT,      -- 'admin', 'client', 'system'
  action TEXT,         -- 'create', 'update', 'delete', 'login', etc.
  entity_type TEXT,    -- 'client', 'project', 'invoice', etc.
  entity_id TEXT,
  entity_name TEXT,
  old_value TEXT,      -- JSON
  new_value TEXT,      -- JSON
  changes TEXT,        -- JSON diff
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME
);
```

#### Query Audit Logs

```typescript
import { auditLogger } from './services/audit-logger.js';

const logs = await auditLogger.query({
  userId: 1,
  action: 'login',
  startDate: '2024-01-01',
  limit: 50
});
```

### Security Features

- **Helmet.js**: HTTP security headers
- **CORS**: Cross-origin resource sharing configuration
- **Input Validation**: Request body validation and sanitization
- **File Upload Security**: MIME type validation, size limits, secure storage
- **Error Handling**: Secure error messages without sensitive information exposure
- **Audit Logging**: All write operations logged with user context
- **Rate Limiting**: Prevents brute force attacks on auth endpoints

### Environment Variables

```bash
# Required
JWT_SECRET=your-secret-key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password

# Optional
PORT=4001
DATABASE_PATH=./data/client_portal.db
FRONTEND_URL=http://localhost:4000

# Email Service
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=nobhaduri@gmail.com

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Development Setup

### Prerequisites

- Node.js 18+ with npm
- TypeScript 5.0+
- SQLite 3
- Git for version control

### Installation

```bash
# Clone repository
git clone <repository-url>
cd no_bhad_codes

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database
npm run db:migrate

# Start development server
npm run dev:server
```

### Development Commands

```bash
npm run dev:server        # Start server with hot reload
npm run dev:client        # Start client development server
npm run dev:full          # Start both server and client
npm run build            # Build for production
npm run test             # Run test suite
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

### Project Structure

```text
no_bhad_codes/
├── server/              # Backend Express application
├── src/                # Frontend TypeScript application  
├── uploads/            # File upload storage
├── data/               # Database files
├── templates/          # EJS templates
├── dist/               # Built frontend assets
├── node_modules/       # Dependencies
├── package.json        # Project configuration
├── tsconfig.json       # TypeScript configuration
├── vite.config.js      # Vite build configuration
└── .env                # Environment variables
```

## Deployment Guide

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Environment Configuration

```bash
# Production environment variables
NODE_ENV=production
PORT=3001
DATABASE_PATH=/app/data/production.db
JWT_SECRET=your-production-secret
FRONTEND_URL=https://yourdomain.com

# Email configuration for production
SMTP_HOST=your-smtp-server
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password
SMTP_FROM=noreply@yourdomain.com

# Redis configuration for production caching
REDIS_HOST=your-redis-server
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Error tracking (optional - leave empty to disable)
SENTRY_DSN=
```

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] File upload directories created with proper permissions
- [ ] SSL certificates installed
- [ ] Error tracking configured
- [ ] Email service configured
- [ ] Backup strategy implemented
- [ ] Monitoring and logging set up

### Server Requirements

- **Memory**: 512MB minimum, 1GB recommended
- **Storage**: 10GB minimum for application and file uploads
- **CPU**: 1 vCPU minimum, 2 vCPU recommended
- **Network**: HTTPS enabled, firewall configured
- **Database**: SQLite file with backup strategy
- **Cache**: Redis instance for optimal performance

---

## Additional Resources

### API Testing

Use tools like Postman or curl to test API endpoints:

```bash
# Test invoice system
curl -X GET http://localhost:4001/api/invoices/test

# Test upload system  
curl -X GET http://localhost:4001/api/uploads/test

# Create invoice (requires authentication)
curl -X POST http://localhost:4001/api/invoices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectId":1,"clientId":1,"lineItems":[...]}'
```

### Troubleshooting

- Check server logs for detailed error information
- Verify environment variables are set correctly
- Ensure database file has proper permissions
- Check upload directory permissions and disk space
- Verify JWT secret is configured for authentication

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with proper tests
4. Submit a pull request with detailed description
5. Ensure all tests pass and code follows style guidelines
