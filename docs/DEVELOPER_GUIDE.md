# Developer Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment](#development-environment)
3. [Architecture Deep Dive](#architecture-deep-dive)
4. [Frontend Development](#frontend-development)
5. [Backend Development](#backend-development)
6. [Database Management](#database-management)
7. [Testing Guide](#testing-guide)
8. [Deployment Guide](#deployment-guide)
9. [Code Style Guide](#code-style-guide)
10. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js** 20.x with npm 8+
- **Git** for version control
- **VS Code** (recommended) with suggested extensions
- **Modern browser** for testing (Chrome, Firefox, Safari, Edge)

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/no_bhad_codes.git
cd no_bhad_codes

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your specific configuration

# 4. Initialize database
npm run migrate

# 5. Start development servers
npm run dev:full
```

### VS Code Extensions

Install these recommended extensions for optimal development experience:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright",
    "vitest.explorer"
  ]
}
```

### Environment Configuration

The application uses environment variables for configuration. Copy `.env.example` to `.env` and configure:

```bash
# Application
NODE_ENV=development
PORT=4001
FRONTEND_URL=http://localhost:4000

# Security
JWT_SECRET="your-development-jwt-secret-min-32-chars"
JWT_EXPIRES_IN="7d"

# Database
DATABASE_PATH=./data/client_portal.db

# Email (optional for development)
EMAIL_ENABLED=false
EMAIL_HOST="smtp.gmail.com"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# Admin Configuration
ADMIN_EMAIL="nobhaduri@gmail.com"
SUPPORT_EMAIL="nobhaduri@gmail.com"

# Feature Flags
ENABLE_REGISTRATION=true
ENABLE_FILE_UPLOAD=true
MAINTENANCE_MODE=false
```

## Development Environment

### Available Scripts

```bash
# Development
npm run dev              # Frontend development server (Vite)
npm run dev:server       # Backend development server (Node.js)
npm run dev:full         # Both frontend and backend concurrently

# Building
npm run build            # Build for production
npm run build:server     # Build backend only
npm run preview          # Preview production build

# Code Quality
npm run lint             # ESLint linting
npm run format           # Prettier formatting
npm run format:check     # Check formatting
npm run typecheck        # TypeScript type checking

# Testing
npm run test             # Run unit tests
npm run test:coverage    # Generate coverage report
npm run test:e2e         # End-to-end tests with Playwright

# Database
npm run migrate          # Run database migrations
npm run migrate:status   # Check migration status
npm run db:reset         # Reset database
```

### Development Workflow

1. **Start Development Servers**
   ```bash
   npm run dev:full
   ```
   - Frontend: http://localhost:4000
   - Backend API: http://localhost:4001

2. **Make Changes**
   - Frontend changes trigger hot module reload
   - Backend changes trigger server restart (nodemon)

3. **Run Tests**
   ```bash
   npm run test           # Unit tests
   npm run test:e2e       # E2E tests
   ```

4. **Check Code Quality**
   ```bash
   npm run lint           # ESLint check
   npm run typecheck      # TypeScript check
   npm run format:check   # Prettier check
   ```

### File Structure Overview

```
no-bhad-codes/
├── src/                    # Frontend TypeScript source
│   ├── core/              # Application framework
│   ├── features/          # Feature modules
│   ├── modules/           # UI modules
│   ├── services/          # Business logic
│   └── styles/            # CSS architecture
├── server/                # Backend Node.js source
│   ├── database/         # Database & migrations
│   ├── middleware/       # Express middleware
│   ├── routes/           # API endpoints
│   ├── services/         # Server services
│   └── templates/        # Email templates
├── tests/                # Test files
├── docs/                 # Documentation
└── client/               # Client portal HTML pages
```

## Architecture Deep Dive

### Frontend Architecture

The frontend uses a sophisticated module-based architecture with dependency injection:

#### Dependency Injection Container

```typescript
// Register services
container.register('dataService', () => new DataService(), { singleton: true });
container.register('apiClient', () => new ApiClient('/api'), { singleton: true });

// Register modules with dependencies
container.register('navigationModule', (dataService, apiClient) => 
  new NavigationModule(document.querySelector('.nav'), dataService, apiClient),
  { dependencies: ['dataService', 'apiClient'] }
);

// Resolve and initialize
const navModule = await container.resolve('navigationModule');
await navModule.init();
```

#### Module System

All modules extend `BaseModule` for consistent lifecycle management:

```typescript
export class MyCustomModule extends BaseModule {
  private apiClient: ApiClient;
  
  constructor(container: HTMLElement, apiClient: ApiClient) {
    super('MyCustomModule', container);
    this.apiClient = apiClient;
  }
  
  async init(): Promise<void> {
    // Setup event listeners
    this.addEventListener(this.container, 'click', this.handleClick.bind(this));
    
    // Load initial data
    await this.loadData();
    
    this.isInitialized = true;
  }
  
  async destroy(): Promise<void> {
    // Cleanup event listeners (automatic)
    this.cleanupEventListeners();
    
    // Custom cleanup
    this.apiClient = null;
    this.isInitialized = false;
  }
  
  private async loadData(): Promise<void> {
    try {
      const data = await this.apiClient.get('/my-endpoint');
      this.renderData(data);
    } catch (error) {
      this.error('Failed to load data:', error); // Uses BaseModule.error() - always shows
    }
  }
}
```

#### Service Layer

Services provide business logic and API communication:

```typescript
export class DataService {
  private cache: Map<string, CachedData> = new Map();
  private apiClient: ApiClient;
  
  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }
  
  async fetchProjects(): Promise<Project[]> {
    const cacheKey = 'projects';
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      return cached.data;
    }
    
    // Fetch from API
    const response = await this.apiClient.get<Project[]>('/projects');
    
    // Cache result
    this.cache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000 // 5 minutes
    });
    
    return response.data;
  }
  
  private isCacheExpired(cached: CachedData): boolean {
    return Date.now() - cached.timestamp > cached.ttl;
  }
}
```

### Backend Architecture

The backend uses Express.js with a layered architecture:

#### Route Structure

```typescript
// routes/projects.ts
import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get projects with authentication
router.get('/', 
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projects = await ProjectService.getProjectsForUser(req.user);
    res.json({ projects });
  })
);

// Create project (admin only) with validation
router.post('/',
  authenticateToken,
  requireAdmin,
  validateRequest(projectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const project = await ProjectService.createProject(req.body);
    res.status(201).json({ project });
  })
);

export { router as projectsRouter };
```

#### Middleware Stack

```typescript
// Authentication middleware
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Validation middleware
export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details
      });
    }
    req.body = value; // Use sanitized data
    next();
  };
};

// Error handling middleware
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err);
  
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details
    });
  }
  
  if (err instanceof AuthenticationError) {
    return res.status(401).json({
      error: 'Authentication failed'
    });
  }
  
  // Default error response
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
};
```

## Frontend Development

### Creating New Modules

1. **Create Module Class**
   ```typescript
   // src/modules/my-new-module.ts
   import { BaseModule } from './base.js';
   
   export class MyNewModule extends BaseModule {
     constructor(container: HTMLElement) {
       super('MyNewModule', container);
     }
     
     async init(): Promise<void> {
       // Implementation
     }
     
     async destroy(): Promise<void> {
       this.cleanupEventListeners();
     }
   }
   ```

2. **Register with Container**
   ```typescript
   // src/core/app.ts
   container.register('myNewModule', () => {
     const element = document.querySelector('.my-new-module');
     return element ? new MyNewModule(element) : null;
   });
   ```

3. **Initialize in App**
   ```typescript
   // src/core/app.ts
   async initializeModules(): Promise<void> {
     const modules = [
       'navigationModule',
       'footerModule',
       'myNewModule' // Add here
     ];
     
     for (const moduleName of modules) {
       const module = await container.resolve(moduleName);
       if (module) {
         await module.init();
       }
     }
   }
   ```

### Adding New Services

1. **Create Service Class**
   ```typescript
   // src/services/my-service.ts
   export class MyService {
     private apiClient: ApiClient;
     
     constructor(apiClient: ApiClient) {
       this.apiClient = apiClient;
     }
     
     async doSomething(): Promise<any> {
       return await this.apiClient.get('/my-endpoint');
     }
   }
   ```

2. **Register Service**
   ```typescript
   // src/core/app.ts
   container.register('myService', (apiClient) => 
     new MyService(apiClient),
     { dependencies: ['apiClient'] }
   );
   ```

### State Management

The application uses a centralized state manager:

```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('MyModule');

// Subscribe to state changes
const unsubscribe = StateManager.subscribe('user', (user) => {
  logger.log('User updated:', user);
  this.updateUI(user);
});

// Update state
StateManager.setState('user', { id: 1, name: 'John Doe' });

// Get current state
const currentUser = StateManager.getState('user');

// Cleanup subscription
unsubscribe();
```

### CSS Architecture

The project uses a modular CSS architecture:

```scss
// src/styles/main.css - Entry point
@import './base/reset.css';
@import './base/typography.css';
@import './components/form.css';
@import './components/navigation.css';
@import './pages/client.css';

// Component-specific styles
// src/styles/components/my-component.css
.my-component {
  /* Component styles using CSS variables */
  background-color: var(--color-surface);
  border-radius: var(--border-radius-md);
  padding: var(--space-lg);
}
```

## Communication & Messaging System

### Messaging Architecture

The application includes a comprehensive messaging system for client-developer communication:

#### Backend Components

1. **Database Schema** (`server/database/migrations/003_messaging_enhancements.sql`)
   - `message_threads`: Conversation organization
   - `general_messages`: Non-project specific messages  
   - `messages`: Project-specific messages with enhanced features
   - `notification_preferences`: Client notification settings

2. **API Routes** (`server/routes/messages.ts`)
   ```typescript
   // Thread management
   router.get('/threads', authenticateToken, loadThreads);
   router.post('/threads', authenticateToken, createThread);
   
   // Message handling with file uploads
   router.post('/threads/:id/messages', 
     authenticateToken, 
     upload.array('attachments', 3),
     sendMessage
   );
   
   // Notification preferences
   router.get('/preferences', authenticateToken, getPreferences);
   router.put('/preferences', authenticateToken, updatePreferences);
   ```

3. **Email Integration**
   ```typescript
   // server/services/email-service.ts
   await emailService.sendMessageNotification(clientEmail, {
     recipientName: 'John Doe',
     senderName: 'Admin',
     subject: 'Project Update',
     message: 'Your website is ready for review',
     threadId: 123,
     portalUrl: 'https://portal.nobhad.codes',
     hasAttachments: false
   });
   ```

#### Frontend Components

1. **Messaging Module** (`src/modules/messaging.ts`)
   ```typescript
   export class MessagingModule extends BaseModule {
     // Thread management
     async loadMessageThreads(): Promise<void> {
       const response = await fetch('/api/messages/threads', {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       this.messageThreads = await response.json();
       this.renderThreadsList();
     }
     
     // Real-time message sending
     async handleSendMessage(event: Event): Promise<void> {
       const formData = new FormData(this.messageForm!);
       await fetch(`/api/messages/threads/${threadId}/messages`, {
         method: 'POST',
         body: formData,
         headers: { 'Authorization': `Bearer ${token}` }
       });
     }
   }
   ```

2. **CSS Styling** (styles included in `src/styles/main.css`)
   - Responsive design with mobile support
   - Thread sidebar with unread indicators
   - Message bubbles with sender identification
   - File attachment display
   - Dark theme compatibility

### Integration Example: Adding Messaging to New Features

```typescript
// In your feature module
import { MessagingModule } from '@/modules/messaging.js';

class ProjectModule extends BaseModule {
  private messaging: MessagingModule;
  
  async init(): Promise<void> {
    // Initialize messaging for this project
    const messagingContainer = this.container.querySelector('.messaging-container');
    if (messagingContainer) {
      this.messaging = new MessagingModule();
      await this.messaging.init();
    }
  }
  
  private async startProjectDiscussion(projectId: number): Promise<void> {
    // Create project-specific thread
    const response = await fetch('/api/messages/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: `Project Discussion: ${projectName}`,
        thread_type: 'project',
        project_id: projectId,
        priority: 'normal'
      })
    });
    
    const { thread } = await response.json();
    
    // Navigate to new thread
    await this.messaging.selectThread(thread.id);
  }
}
```

## Backend Development

### Creating New Routes

1. **Define Route Handler**
   ```typescript
   // server/routes/my-routes.ts
   import express from 'express';
   import { authenticateToken } from '../middleware/auth.js';
   import { asyncHandler } from '../middleware/errorHandler.js';
   
   const router = express.Router();
   
   router.get('/', 
     authenticateToken,
     asyncHandler(async (req, res) => {
       const data = await MyService.getData(req.user);
       res.json({ data });
     })
   );
   
   export { router as myRouter };
   ```

2. **Register Routes**
   ```typescript
   // server/app.ts
   import { myRouter } from './routes/my-routes.js';
   
   app.use('/api/my-endpoint', myRouter);
   ```

### Database Operations

Use the database connection with proper error handling:

```typescript
// server/services/my-service.ts
import { getDatabase } from '../database/init.js';

export class MyService {
  static async getData(userId: number): Promise<any[]> {
    const db = getDatabase();
    
    try {
      const results = await db.all(`
        SELECT id, name, created_at 
        FROM my_table 
        WHERE user_id = ?
        ORDER BY created_at DESC
      `, [userId]);
      
      return results;
    } catch (error) {
      console.error('Database query failed:', error);
      throw new Error('Failed to fetch data');
    }
  }
  
  static async createRecord(data: MyData): Promise<number> {
    const db = getDatabase();
    
    try {
      const result = await db.run(`
        INSERT INTO my_table (name, user_id, created_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [data.name, data.userId]);
      
      return result.lastID;
    } catch (error) {
      console.error('Insert failed:', error);
      throw new Error('Failed to create record');
    }
  }
}
```

### Email Service Integration

Use the email service for notifications:

```typescript
import { emailService } from '../services/email-service.js';

// Send template-based email
await emailService.sendProjectUpdateEmail(client.email, {
  projectName: 'My Project',
  status: 'completed',
  description: 'Project has been completed successfully',
  clientName: 'John Doe',
  portalUrl: 'https://example.com/portal',
  nextSteps: ['Review deliverables', 'Provide feedback']
});

// Send custom email
await emailService.sendEmail({
  to: 'client@example.com',
  subject: 'Custom Subject',
  html: '<h1>Custom HTML Content</h1>',
  priority: 'high'
});
```

## Database Management

### Creating Migrations

1. **Create Migration File**
   ```sql
   -- server/database/migrations/003_add_new_table.sql
   -- UP
   CREATE TABLE IF NOT EXISTS my_new_table (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     user_id INTEGER NOT NULL,
     status TEXT DEFAULT 'active',
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );
   
   CREATE INDEX IF NOT EXISTS idx_my_new_table_user_id ON my_new_table(user_id);
   
   -- DOWN
   DROP INDEX IF EXISTS idx_my_new_table_user_id;
   DROP TABLE IF EXISTS my_new_table;
   ```

2. **Run Migration**
   ```bash
   npm run migrate
   ```

### Database Best Practices

- Always use parameterized queries to prevent SQL injection
- Use type-safe row helpers for database row access (see below)
- Create indexes for frequently queried columns
- Use foreign key constraints for data integrity
- Include created_at and updated_at timestamps
- Use CHECK constraints for data validation

```typescript
// Good: Parameterized query
const users = await db.all('SELECT * FROM users WHERE status = ?', ['active']);

// Bad: String concatenation (vulnerable to SQL injection)
const users = await db.all(`SELECT * FROM users WHERE status = '${status}'`);
```

### Type-Safe Database Row Access

**New in January 2026:** All database row accesses use type-safe helper utilities from `server/database/row-helpers.ts`:

```typescript
import { getString, getNumber, getBoolean, getDate } from '../database/row-helpers.js';

// Get a row from database
const client = await db.get('SELECT * FROM clients WHERE id = ?', [clientId]);

// Type-safe property extraction
const clientId = getNumber(client, 'id');
const email = getString(client, 'email');
const isActive = getBoolean(client, 'is_active');
const createdAt = getDate(client, 'created_at');

// Benefits:
// - Type safety: All values properly typed
// - Null safety: Handles undefined/missing values gracefully
// - Consistent: Same pattern across all route files
// - Maintainable: Centralized type extraction logic
```

**Available Helpers:**
- `getString(row, 'key')` - Extract string values (returns empty string if not found)
- `getStringOrNull(row, 'key')` - Extract string or null
- `getNumber(row, 'key')` - Extract number values (returns 0 if not found)
- `getNumberOrNull(row, 'key')` - Extract number or null
- `getBoolean(row, 'key')` - Extract boolean values (returns false if not found)
- `getBooleanOrNull(row, 'key')` - Extract boolean or null
- `getDate(row, 'key')` - Extract Date values from ISO strings or timestamps
- `getUnknown(row, 'key')` - Extract unknown values (when type is truly unknown)

## Testing Guide

### Unit Testing

Write unit tests for all services and utilities:

```typescript
// src/services/data-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataService } from './data-service.js';
import { ApiClient } from './api-client.js';

describe('DataService', () => {
  let dataService: DataService;
  let mockApiClient: ApiClient;
  
  beforeEach(() => {
    mockApiClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    } as any;
    
    dataService = new DataService(mockApiClient);
  });
  
  it('should fetch and cache projects', async () => {
    const mockProjects = [{ id: 1, name: 'Test Project' }];
    (mockApiClient.get as any).mockResolvedValue({ data: mockProjects });
    
    const projects = await dataService.fetchProjects();
    
    expect(mockApiClient.get).toHaveBeenCalledWith('/projects');
    expect(projects).toEqual(mockProjects);
  });
  
  it('should return cached data when available', async () => {
    const mockProjects = [{ id: 1, name: 'Test Project' }];
    (mockApiClient.get as any).mockResolvedValue({ data: mockProjects });
    
    // First call
    await dataService.fetchProjects();
    
    // Second call should use cache
    const projects = await dataService.fetchProjects();
    
    expect(mockApiClient.get).toHaveBeenCalledOnce();
    expect(projects).toEqual(mockProjects);
  });
});
```

### End-to-End Testing

Write E2E tests for critical user flows:

```typescript
// tests/e2e/project-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test('admin can create and update projects', async ({ page }) => {
    // Login as admin
    await page.goto('/admin');
    await page.fill('[data-testid="email"]', 'admin@example.com');
    await page.fill('[data-testid="password"]', 'admin123');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to projects
    await page.click('[data-testid="projects-nav"]');
    await expect(page.locator('h1')).toContainText('Projects');
    
    // Create new project
    await page.click('[data-testid="new-project-button"]');
    await page.fill('[data-testid="project-name"]', 'Test Project');
    await page.selectOption('[data-testid="client-select"]', '1');
    await page.click('[data-testid="save-project"]');
    
    // Verify project created
    await expect(page.locator('[data-testid="project-list"]')).toContainText('Test Project');
  });
});
```

### Testing Best Practices

- Write tests for all critical business logic
- Mock external dependencies
- Use descriptive test names
- Group related tests with describe blocks
- Test both success and error cases
- Maintain test data fixtures

## Deployment Guide

### Quick Reference - Production URLs

| Service | URL |
|---------|-----|
| **Backend (Railway)** | https://no-bhad-codes-production.up.railway.app |
| **Frontend (Vercel)** | https://nobhad.codes (or Vercel preview URL) |
| **API Health Check** | https://no-bhad-codes-production.up.railway.app/health |
| **API Docs (Swagger)** | https://no-bhad-codes-production.up.railway.app/api-docs |

### Environment Variables Reference

**Railway (Backend):**
| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `PORT` | `4001` |
| `DATABASE_PATH` | `./data/client_portal.db` |
| `JWT_SECRET` | Secure random string (32+ chars) |
| `ADMIN_EMAIL` | Admin email address |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password |
| `EMAIL_ENABLED` | `true` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | Gmail App Password (16 chars) |
| `SENTRY_DSN` | Sentry error tracking DSN |

**Vercel (Frontend):**
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | `https://no-bhad-codes-production.up.railway.app` |
| `VITE_ADMIN_PASSWORD_HASH` | SHA256 hash for admin dashboard |
| `SENTRY_DSN` | Sentry error tracking DSN |

### Production Build

1. **Environment Setup**
   ```bash
   # Set production environment variables
   export NODE_ENV=production
   export JWT_SECRET="your-production-secret"
   export DATABASE_URL="file:./data/production.db"
   ```

2. **Build Application**
   ```bash
   # Install production dependencies
   npm ci --omit=dev
   
   # Build frontend and backend
   npm run build
   
   # Run database migrations
   npm run migrate
   ```

3. **Start Production Server**
   ```bash
   npm run start
   ```

### Docker Deployment

1. **Build Docker Image**
   ```bash
   docker build -t no-bhad-codes .
   ```

2. **Run Container**
   ```bash
   docker run -d \
     --name no-bhad-codes-app \
     -p 3001:3001 \
     -e NODE_ENV=production \
     -e JWT_SECRET="your-secret" \
     -v $(pwd)/data:/app/data \
     no-bhad-codes
   ```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name nobhad.codes;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nobhad.codes;
    
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private.key;
    
    # Serve static files
    location / {
        root /var/www/nobhad-codes;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy API requests
    location /api/ {
        proxy_pass http://localhost:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Code Style Guide

### TypeScript Guidelines

1. **Use Strict Mode**
   ```typescript
   // tsconfig.json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "noImplicitReturns": true,
       "noUnusedLocals": true
     }
   }
   ```

2. **Type Definitions**
   ```typescript
   // Define interfaces for data structures
   interface Project {
     id: number;
     name: string;
     status: ProjectStatus;
     createdAt: string;
   }
   
   // Use enums for constants
   enum ProjectStatus {
     PENDING = 'pending',
     IN_PROGRESS = 'in-progress',
     COMPLETED = 'completed'
   }
   
   // Use generics for reusable types
   interface ApiResponse<T> {
     data: T;
     status: number;
     message?: string;
   }
   ```

3. **Function Signatures**
   ```typescript
   // Always specify return types
   async function fetchProjects(): Promise<Project[]> {
     // Implementation
   }
   
   // Use readonly for immutable data
   interface ReadonlyConfig {
     readonly apiUrl: string;
     readonly timeout: number;
   }
   ```

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn'
  }
};
```

### Naming Conventions

- **Files**: kebab-case (`my-component.ts`)
- **Classes**: PascalCase (`MyComponent`)
- **Functions/Variables**: camelCase (`myFunction`, `userName`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Interfaces**: PascalCase with 'I' prefix optional (`User` or `IUser`)

### Error Handling

```typescript
// Use custom error classes
export class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Async/await error handling
async function fetchData(): Promise<Data> {
  try {
    const response = await apiClient.get('/data');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw new Error('Data fetch failed');
  }
}

// Error boundaries in classes
export class DataService {
  async safeOperation(): Promise<Data | null> {
    try {
      return await this.riskyOperation();
    } catch (error) {
      this.logError('Safe operation failed', error);
      return null;
    }
  }
  
  private logError(message: string, error: unknown): void {
    console.error(`[DataService] ${message}:`, error);
  }
}
```

## Troubleshooting

### Common Development Issues

#### TypeScript Compilation Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
npm run typecheck

# Check for type conflicts
npx tsc --listFiles | grep duplicate
```

#### Module Resolution Issues

```bash
# Check path mapping in tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@tests/*": ["tests/*"]
    }
  }
}

# Verify import paths
import { MyService } from '@/services/my-service'; // Correct
import { MyService } from '../../../services/my-service'; // Avoid
```

#### Database Connection Issues

```bash
# Check database file permissions
ls -la data/
chmod 644 data/development.db

# Reset database
npm run db:reset
npm run migrate
```

#### Port Conflicts

```bash
# Find processes using ports
lsof -i :3000
lsof -i :3001

# Kill processes
kill -9 <PID>

# Or use different ports
PORT=3002 npm run dev:server
```

### Performance Issues

#### Frontend Performance

```typescript
// Use lazy loading for heavy modules
const HeavyModule = lazy(() => import('./heavy-module'));

// Debounce frequent operations
const debouncedSearch = debounce((query: string) => {
  performSearch(query);
}, 300);

// Use intersection observer for lazy loading
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      loadContent(entry.target);
    }
  });
});
```

#### Backend Performance

```typescript
// Use connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20
});

// Implement caching
const cache = new Map();
function getCachedData(key: string) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  const data = fetchData(key);
  cache.set(key, data);
  return data;
}

// Use indexes for frequent queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_status_client ON projects(status, client_id);
```

### Debugging Tips

1. **Use Browser DevTools**
   - Network tab for API calls
   - Console for JavaScript errors
   - Application tab for localStorage/sessionStorage

2. **Debug Logging**
   The codebase uses a centralized debug logger that automatically respects debug mode:
   
   ```typescript
   import { createLogger } from '../utils/logger';
   
   // Create a logger with a prefix
   const logger = createLogger('MyModule');
   
   // Debug logs (only in development)
   logger.log('Debug message');
   logger.info('Info message');
   logger.debug('Detailed debug');
   
   // Warnings and errors (always shown)
   logger.warn('Warning message');
   logger.error('Error message');
   ```
   
   All debug logs are automatically excluded in production builds. Use `logger.log()` instead of `console.log()` for debug messages.

3. **Server Debugging**
   ```bash
   # Enable debug logging
   DEBUG=* npm run dev:server
   
   # Use Node.js debugger
   node --inspect server/app.js
   ```

3. **Database Debugging**
   ```bash
   # Open SQLite CLI
   sqlite3 data/development.db

   # Explain query plans
   EXPLAIN QUERY PLAN SELECT * FROM projects WHERE client_id = 1;

   # DB Browser for SQLite (GUI)
   # Install: brew install db-browser-for-sqlite
   open -a "DB Browser for SQLite"
   # Or open with database directly:
   open -a "DB Browser for SQLite" ./data/client_portal.db
   ```

4. **VS Code Debugging**
   ```json
   // .vscode/launch.json
   {
     "type": "node",
     "request": "launch",
     "name": "Debug Server",
     "program": "${workspaceFolder}/server/app.ts",
     "env": {
       "NODE_ENV": "development"
     }
   }
   ```

### Getting Help

- **Documentation**: Check `docs/` directory
- **Code Examples**: Look at existing implementations
- **Issues**: Search GitHub issues for similar problems
- **Community**: Join discussions in GitHub Discussions
- **Support**: Email nobhaduri@gmail.com

## Contributing Workflow

1. **Fork Repository**
2. **Create Feature Branch**
   ```bash
   git checkout -b feature/my-feature
   ```

3. **Make Changes**
   - Follow code style guidelines
   - Write tests for new functionality
   - Update documentation

4. **Test Changes**
   ```bash
   npm run test
   npm run test:e2e
   npm run lint
   npm run typecheck
   ```

5. **Commit Changes**
   ```bash
   git commit -m "feat: add new feature"
   ```

6. **Push and Create PR**
   ```bash
   git push origin feature/my-feature
   ```

Remember to keep the code clean, well-documented, and thoroughly tested. Happy coding! 🚀