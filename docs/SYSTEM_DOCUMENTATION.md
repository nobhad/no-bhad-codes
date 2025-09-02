# No Bhad Codes - System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Invoice Generation System](#invoice-generation-system)
4. [File Upload System](#file-upload-system)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Authentication & Security](#authentication--security)
8. [Development Setup](#development-setup)
9. [Deployment Guide](#deployment-guide)

## System Overview

The No Bhad Codes system is a comprehensive client management and project tracking platform built for web development services. It features automated invoice generation, secure file uploads, client portal functionality, and project management tools.

### Key Features
- **Client Intake Management**: Automated client onboarding with form processing
- **Project Management**: Track projects from intake to completion
- **Invoice Generation**: Automated invoice creation from client intakes and project data
- **File Upload System**: Secure file handling for avatars, project files, and attachments
- **Client Portal**: Dedicated interface for client interactions
- **Admin Dashboard**: Comprehensive management tools for business operations

### Technology Stack
- **Backend**: Node.js with Express.js and TypeScript
- **Database**: SQLite with custom wrapper for async operations
- **Authentication**: JWT tokens with role-based access control
- **File Processing**: Multer for secure file uploads
- **Development**: Vite build system with hot reload
- **Error Tracking**: Sentry integration for production monitoring

## Architecture

### Core Components

```
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

### Overview
The invoice system provides comprehensive invoice management with automated generation from client intakes, flexible line item management, and payment tracking.

### Key Features
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

### API Endpoints

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

### Overview
Comprehensive file upload system with security validation, organized storage, and multi-format support for client portal functionality.

### Key Features
- **Multi-Type Uploads**: Single files, multiple files, avatars, project-specific
- **Security Validation**: File type filtering, size limits, authentication
- **Organized Storage**: Automatic directory structure based on file purpose
- **Metadata Tracking**: Complete file information and user association

### Upload Service Configuration

#### Multer Configuration
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
```
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

## API Endpoints

### Authentication Endpoints
```
POST /api/auth/login          # User login
POST /api/auth/register       # User registration
POST /api/auth/refresh        # Token refresh
POST /api/auth/logout         # User logout
```

### Client Management
```
GET  /api/clients             # List all clients
POST /api/clients             # Create new client
GET  /api/clients/:id         # Get client details
PUT  /api/clients/:id         # Update client
DELETE /api/clients/:id       # Delete client
```

### Project Management
```
GET  /api/projects            # List all projects
POST /api/projects            # Create new project
GET  /api/projects/:id        # Get project details
PUT  /api/projects/:id        # Update project
DELETE /api/projects/:id      # Delete project
GET  /api/projects/client/:clientId  # Get client projects
```

### Invoice System
```
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

### File Upload System
```
GET  /api/uploads/test                    # System health check
POST /api/uploads/single                  # Upload single file
POST /api/uploads/multiple                # Upload multiple files
POST /api/uploads/avatar                  # Upload user avatar
POST /api/uploads/project/:projectId      # Upload project file
```

### System Endpoints
```
GET  /                       # API information and available endpoints
GET  /health                 # System health check
GET  /uploads/:filename      # Static file serving
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

### Security Features
- **Helmet.js**: HTTP security headers
- **CORS**: Cross-origin resource sharing configuration
- **Input Validation**: Request body validation and sanitization
- **File Upload Security**: MIME type validation, size limits, secure storage
- **Error Handling**: Secure error messages without sensitive information exposure

### Environment Variables
```bash
# Required
JWT_SECRET=your-secret-key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password

# Optional
PORT=3001
DATABASE_PATH=./data/client_portal.db
FRONTEND_URL=http://localhost:3000

# Email Service
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@nobhadcodes.com

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
```
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

# Error tracking
SENTRY_DSN=your-sentry-dsn
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
curl -X GET http://localhost:3001/api/invoices/test

# Test upload system  
curl -X GET http://localhost:3001/api/uploads/test

# Create invoice (requires authentication)
curl -X POST http://localhost:3001/api/invoices \
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