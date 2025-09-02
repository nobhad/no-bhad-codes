# No Bhad Codes - Implementation Guide

## Overview
This document details the specific implementation of the invoice generation system and file upload functionality that was built for the No Bhad Codes client management platform.

## Table of Contents
1. [Components Implemented](#components-implemented)
2. [Invoice Generation System](#invoice-generation-system)
3. [File Upload System](#file-upload-system)
4. [Database Integration](#database-integration)
5. [Server Configuration](#server-configuration)
6. [Testing & Validation](#testing--validation)

## Components Implemented

### ✅ Invoice Generation System
- **File**: `server/services/invoice-service.ts`
- **Routes**: `server/routes/invoices.ts` 
- **Database**: SQLite with custom async wrapper
- **Features**: CRUD operations, auto-generation, payment tracking

### ✅ File Upload System
- **File**: `server/routes/uploads.ts`
- **Storage**: Multer with organized directory structure
- **Security**: File type validation, size limits, authentication
- **Features**: Single/multiple uploads, avatar handling, project files

### ✅ Database Wrapper
- **File**: `server/database/init.ts`
- **Purpose**: Async SQLite operations with proper error handling
- **Pattern**: Promise-based database interactions

### ✅ Authentication Middleware  
- **File**: `server/middleware/auth.ts`
- **Features**: JWT token validation, role-based access control
- **Security**: Token expiration, secure error messages

### ✅ Server Integration
- **File**: `server/app.ts`
- **Updates**: Route registration, static file serving, endpoint documentation
- **Architecture**: Express.js with TypeScript, middleware pattern

## Invoice Generation System

### Implementation Details

#### Service Architecture
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

#### Key Implementation Features

##### Automatic Invoice Number Generation
```typescript
private generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-6);
  return `INV-${year}${month}-${timestamp}`;
}
```
**Format**: `INV-YYYYMM-XXXXXX` (e.g., `INV-202509-123456`)

##### Line Item Calculation
```typescript
private calculateTotal(lineItems: InvoiceLineItem[]): number {
  return lineItems.reduce((total, item) => total + item.amount, 0);
}
```

##### Auto-Generation from Client Intakes
The system includes intelligent invoice generation based on project type and budget:

```typescript
async generateInvoiceFromIntake(intakeId: number): Promise<Invoice> {
  // 1. Fetch intake data with project/client relationships
  const intake = await this.db.get(intakeSql, [intakeId]);
  
  // 2. Validate intake is ready (converted to project/client)
  if (!intake.project_id || !intake.client_id) {
    throw new Error('Intake must be converted to project and client first');
  }

  // 3. Generate line items based on project type
  const lineItems = this.generateLineItemsFromIntake(intake);

  // 4. Create invoice with generated data
  return this.createInvoice({
    projectId: intake.project_id,
    clientId: intake.client_id,
    lineItems,
    notes: `Generated from intake: ${intake.project_description}`,
    terms: 'Payment due within 30 days. 50% upfront, 50% on completion.'
  });
}
```

##### Smart Line Item Generation
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
      
    case 'web app':
    case 'application':
      return [
        { description: 'Application Development', quantity: 1, rate: baseAmount * 0.6, amount: baseAmount * 0.6 },
        { description: 'Database Design & Setup', quantity: 1, rate: baseAmount * 0.2, amount: baseAmount * 0.2 },
        { description: 'API Development', quantity: 1, rate: baseAmount * 0.1, amount: baseAmount * 0.1 },
        { description: 'Testing & Deployment', quantity: 1, rate: baseAmount * 0.1, amount: baseAmount * 0.1 }
      ];
      
    // Additional project types...
  }
}
```

#### Database Integration

##### Invoice Table Schema
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
  line_items TEXT NOT NULL,  -- JSON array of line items
  notes TEXT,
  terms TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

##### Database Row Mapping
```typescript
private mapRowToInvoice(row: any): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    projectId: row.project_id,
    clientId: row.client_id,
    amountTotal: parseFloat(row.amount_total),
    amountPaid: parseFloat(row.amount_paid || 0),
    currency: row.currency,
    status: row.status,
    dueDate: row.due_date,
    issuedDate: row.issued_date,
    paidDate: row.paid_date,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    lineItems: JSON.parse(row.line_items || '[]'),
    notes: row.notes,
    terms: row.terms,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
```

### Route Implementation

#### Lazy Loading Pattern
Routes use lazy loading to ensure database initialization before service access:

```typescript
// Lazy-load invoice service after database is initialized
function getInvoiceService() {
  return InvoiceService.getInstance();
}
```

#### Comprehensive Error Handling
```typescript
router.post('/', 
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceData: InvoiceCreateData = req.body;

    // Validate required fields
    if (!invoiceData.projectId || !invoiceData.clientId || !invoiceData.lineItems?.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['projectId', 'clientId', 'lineItems']
      });
    }

    // Validate line items structure
    const invalidLineItems = invoiceData.lineItems.filter(item => 
      !item.description || typeof item.quantity !== 'number' || 
      typeof item.rate !== 'number' || typeof item.amount !== 'number'
    );

    if (invalidLineItems.length > 0) {
      return res.status(400).json({
        error: 'Invalid line items',
        code: 'INVALID_LINE_ITEMS',
        message: 'Each line item must have description, quantity, rate, and amount'
      });
    }

    try {
      const invoice = await getInvoiceService().createInvoice(invoiceData);
      
      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        invoice
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to create invoice',
        code: 'CREATION_FAILED',
        message: error.message
      });
    }
  })
);
```

## File Upload System

### Implementation Details

#### Multer Configuration
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
    // Generate unique filename with timestamp and random string
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2);
    const ext = extname(file.originalname);
    const filename = `${timestamp}-${randomString}${ext}`;
    cb(null, filename);
  }
});
```

#### File Type Security Filter
```typescript
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = {
    images: /\.(jpg|jpeg|png|gif|webp)$/i,
    documents: /\.(pdf|doc|docx|txt|md)$/i,
    spreadsheets: /\.(xls|xlsx|csv)$/i,
    presentations: /\.(ppt|pptx)$/i,
    archives: /\.(zip|rar|tar|gz)$/i,
    code: /\.(js|ts|html|css|json|xml)$/i
  };

  const fileName = file.originalname.toLowerCase();
  const isAllowed = Object.values(allowedTypes).some(regex => regex.test(fileName));

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${extname(file.originalname)}`));
  }
};
```

#### Upload Limits & Security
```typescript
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  }
});
```

#### Specialized Upload Endpoints

##### Avatar Upload with Image Validation
```typescript
router.post('/avatar',
  authenticateToken,
  upload.single('avatar'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'No avatar file uploaded',
        code: 'NO_AVATAR'
      });
    }

    // Additional validation for images only
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        error: 'Avatar must be an image file',
        code: 'INVALID_AVATAR_TYPE'
      });
    }

    const avatarInfo = {
      id: Date.now().toString(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/avatars/${req.file.filename}`,
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: avatarInfo
    });
  })
);
```

##### Project-Specific File Upload
```typescript
router.post('/project/:projectId',
  authenticateToken,
  upload.single('project_file'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({
        error: 'Invalid project ID',
        code: 'INVALID_PROJECT_ID'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No project file uploaded',
        code: 'NO_PROJECT_FILE'
      });
    }

    const projectFile = {
      id: Date.now().toString(),
      projectId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/projects/${req.file.filename}`,
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      message: 'Project file uploaded successfully',
      file: projectFile
    });
  })
);
```

#### Multer Error Handling
```typescript
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        message: 'File size cannot exceed 10MB'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        code: 'TOO_MANY_FILES',
        message: 'Cannot upload more than 5 files at once'
      });
    }
  }
  
  if (error.message.includes('File type not allowed')) {
    return res.status(400).json({
      error: 'File type not allowed',
      code: 'INVALID_FILE_TYPE',
      message: error.message
    });
  }
  
  next(error);
});
```

## Database Integration

### Async SQLite Wrapper Implementation

#### Database Wrapper Class
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

#### Database Initialization
```typescript
export async function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbPath = process.env.DATABASE_PATH || './database.sqlite';
    
    const sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Failed to connect to database:', err.message);
        reject(err);
        return;
      }
      
      console.log('Connected to SQLite database');
      
      // Enable foreign key constraints
      sqliteDb.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          console.error('Failed to enable foreign keys:', err);
          reject(err);
          return;
        }
        
        db = new DatabaseWrapper(sqliteDb);
        resolve();
      });
    });
  });
}
```

## Server Configuration

### Main Application Updates

#### Route Registration
```typescript
// Import new route modules
import invoicesRouter from './routes/invoices.js';
import uploadsRouter from './routes/uploads.js';

// Register API routes
app.use('/api/invoices', invoicesRouter);
app.use('/api/uploads', uploadsRouter);
```

#### Static File Serving Configuration
```typescript
// Static file serving for uploaded files
app.use('/uploads', express.static(resolve(__dirname, '../uploads')));
```

#### Root Endpoint Documentation
```typescript
app.get('/', (req, res) => {
  res.json({
    message: 'No Bhad Codes API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      documentation: '/api-docs',
      invoices: '/api/invoices',
      uploads: '/api/uploads'  // Added uploads endpoint
    }
  });
});
```

#### Upload Directory Initialization
```typescript
// Ensure uploads directory exists with proper structure
const uploadDir = resolve(process.cwd(), 'uploads');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

// Create subdirectories
const subdirs = ['avatars', 'projects', 'invoices', 'messages', 'general'];
subdirs.forEach(subdir => {
  const path = resolve(uploadDir, subdir);
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
});
```

## Testing & Validation

### API Endpoint Testing

#### Invoice System Health Check
```bash
curl -X GET http://localhost:3001/api/invoices/test
```
**Expected Response:**
```json
{
  "success": true,
  "message": "Invoice system is operational",
  "timestamp": "2025-09-02T05:46:22.662Z"
}
```

#### Upload System Health Check  
```bash
curl -X GET http://localhost:3001/api/uploads/test
```
**Expected Response:**
```json
{
  "success": true,
  "message": "Upload system is operational",
  "timestamp": "2025-09-02T05:46:22.662Z",
  "uploadDir": "/path/to/uploads",
  "limits": {
    "fileSize": "10MB",
    "maxFiles": 5
  }
}
```

### File System Validation

#### Directory Structure Verification
```bash
ls -la uploads/
# Expected output:
# drwxr-xr-x  avatars/
# drwxr-xr-x  projects/  
# drwxr-xr-x  invoices/
# drwxr-xr-x  messages/
# drwxr-xr-x  general/
```

#### File Upload Test
```bash
# Create test file
echo "test content" > test.txt

# Test single file upload (requires authentication)
curl -X POST http://localhost:3001/api/uploads/single \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.txt"
```

### Database Validation

#### Check Invoice Table Structure
```bash
sqlite3 client_portal.db ".schema invoices"
```

#### Verify Database Connection
```bash
# Check if database file exists and is accessible
sqlite3 client_portal.db "SELECT name FROM sqlite_master WHERE type='table';"
```

### Error Handling Tests

#### Authentication Tests
```bash
# Test endpoint without token (should return 401)
curl -X POST http://localhost:3001/api/invoices \
  -H "Content-Type: application/json" \
  -d '{"projectId":1,"clientId":1,"lineItems":[]}'
```

#### File Size Limit Test
```bash
# Create large file (>10MB) to test limits
dd if=/dev/zero of=large_file.bin bs=1M count=11

# Attempt upload (should fail with FILE_TOO_LARGE)
curl -X POST http://localhost:3001/api/uploads/single \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@large_file.bin"
```

## Production Deployment Considerations

### Security Hardening
1. **File Upload Security**:
   - Implement virus scanning for uploaded files
   - Add rate limiting for upload endpoints
   - Consider storing files outside web root
   - Implement file quarantine system

2. **Database Security**:
   - Use environment variables for sensitive data
   - Implement database connection pooling
   - Add query parameterization validation
   - Set up database backup automation

3. **Authentication Security**:
   - Implement JWT refresh token rotation
   - Add rate limiting for authentication endpoints
   - Monitor for suspicious login patterns
   - Implement account lockout mechanisms

### Performance Optimization
1. **File Storage**:
   - Consider CDN integration for file serving
   - Implement image compression for avatars
   - Add file caching headers
   - Implement file cleanup for expired uploads

2. **Database Performance**:
   - Add database indexes for frequently queried fields
   - Implement connection pooling
   - Consider database sharding for large datasets
   - Add query performance monitoring

### Monitoring & Logging
1. **Application Monitoring**:
   - Add request/response logging
   - Implement error tracking (Sentry)
   - Monitor file upload success rates
   - Track invoice generation performance

2. **System Monitoring**:
   - Disk space monitoring for upload directory
   - Database size and performance monitoring
   - Memory and CPU usage tracking
   - API endpoint response time monitoring

This implementation provides a solid foundation for the invoice generation and file upload systems, with comprehensive error handling, security measures, and scalability considerations.