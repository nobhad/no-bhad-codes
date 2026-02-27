# Backend Design Patterns

**Last Updated:** February 27, 2026

This document defines the standard patterns for backend development. All new code should follow these patterns for consistency.

---

## Table of Contents

1. [Response Format Standards](#1-response-format-standards)
2. [Service Patterns](#2-service-patterns)
3. [Authentication Patterns](#3-authentication-patterns)
4. [Middleware Patterns](#4-middleware-patterns)
5. [Error Handling](#5-error-handling)
6. [Database Access](#6-database-access)
7. [Logging Standards](#7-logging-standards)

---

## 1. Response Format Standards

### Success Responses

Always use the `api-response.ts` utilities:

```typescript
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response.js';

// GET - Return data
sendSuccess(res, { client }, 'Client retrieved successfully');

// POST - Return created entity with 201
sendCreated(res, { invoice }, 'Invoice created successfully');

// DELETE - Return 204 No Content
sendNoContent(res);
```

### Error Responses

Use `errorResponse` with proper HTTP status codes:

```typescript
import { errorResponse } from '../utils/api-response.js';

// 400 - Bad Request (validation errors)
errorResponse(res, 'Email is required', 400, 'VALIDATION_ERROR');

// 401 - Unauthorized (not authenticated)
errorResponse(res, 'Authentication required', 401, 'UNAUTHORIZED');

// 403 - Forbidden (authenticated but not allowed)
errorResponse(res, 'Access denied', 403, 'FORBIDDEN');

// 404 - Not Found
errorResponse(res, 'Client not found', 404, 'NOT_FOUND');

// 409 - Conflict (duplicate, state conflict)
errorResponse(res, 'Email already exists', 409, 'DUPLICATE_EMAIL');

// 500 - Internal Server Error
errorResponse(res, 'An unexpected error occurred', 500, 'INTERNAL_ERROR');
```

### Response Shape

All responses follow this structure:

```typescript
// Success
{
  success: true,
  data: { ... },      // Optional
  message: "..."      // Optional
}

// Error
{
  success: false,
  error: {
    message: "...",
    code: "ERROR_CODE"
  }
}
```

---

## 2. Service Patterns

### Singleton Pattern (Preferred)

Use the static `getInstance()` pattern for services:

```typescript
export class MyService {
  private static instance: MyService;

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  static getInstance(): MyService {
    if (!MyService.instance) {
      MyService.instance = new MyService();
    }
    return MyService.instance;
  }

  async doSomething(): Promise<Result> {
    // Implementation
  }
}

// Export singleton instance
export const myService = MyService.getInstance();
```

### Service Method Pattern

```typescript
async createEntity(data: CreateInput): Promise<Entity> {
  const db = getDatabase();

  try {
    // 1. Validate input
    if (!data.name) {
      throw new Error('Name is required');
    }

    // 2. Perform operation
    const result = await db.run(
      'INSERT INTO entities (name) VALUES (?)',
      [data.name]
    );

    // 3. Return result
    return this.getById(result.lastID);

  } catch (error) {
    // 4. Log and re-throw (never return false silently)
    logger.logError(error as Error, {
      context: 'MyService.createEntity',
      data
    });
    throw error;
  }
}
```

### Error Handling in Services

**DO throw errors for failures:**

```typescript
// CORRECT
async createAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.run('INSERT ...', [...]);
  } catch (error) {
    throw new AuditLogError('Failed to create audit log', entry, error);
  }
}
```

**DON'T return boolean for success/failure:**

```typescript
// INCORRECT - Silent failures are dangerous
async createAuditLog(entry: AuditEntry): Promise<boolean> {
  try {
    await db.run('INSERT ...', [...]);
    return true;
  } catch (error) {
    logger.error('Failed');
    return false; // Caller doesn't know it failed!
  }
}
```

**Exceptions:**

- Cache operations may fail gracefully since caching is optional
- `email-template-service.ts:deleteTemplate()` returns `Promise<boolean>` (known deviation, consider refactoring)

---

## 3. Authentication Patterns

### Middleware Chain (Preferred)

Use middleware for all auth checks:

```typescript
import { authenticateToken, requireAdmin, requireClient } from '../middleware/auth.js';

// Admin-only route
router.get(
  '/admin/users',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    // Handler code
  })
);

// Client route
router.get(
  '/portal/projects',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    // Handler code
  })
);
```

### Request Type

Always use `JWTAuthRequest` from the central types:

```typescript
import type { JWTAuthRequest } from '../types/request.js';

// Or use the re-exported alias
import { AuthenticatedRequest } from '../middleware/auth.js';
```

### Access Control Checks

For resource-level permissions, use access control utilities:

```typescript
import { canAccessProject, isUserAdmin } from '../utils/access-control.js';

router.get('/:projectId/files', authenticateToken, asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.projectId);

  if (!await canAccessProject(req, projectId)) {
    return errorResponse(res, 'Access denied', 403, 'FORBIDDEN');
  }

  // Continue with authorized request
}));
```

---

## 4. Middleware Patterns

### Standard Middleware Structure

```typescript
import { Request, Response, NextFunction } from 'express';

// Synchronous middleware
export const myMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Do something
    next();
  } catch (error) {
    next(error);
  }
};

// Async middleware
export const myAsyncMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await someAsyncOperation();
    next();
  } catch (error) {
    next(error);
  }
};
```

### Middleware with Options

```typescript
export function rateLimiter(options: RateLimitOptions = {}) {
  const { maxRequests = 100, windowMs = 60000 } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Implementation using options
    next();
  };
}
```

### Export Pattern

Use named exports only (no default exports):

```typescript
// CORRECT
export { authenticateToken, requireAdmin, requireClient };

// AVOID
export default authenticateToken;
```

**Known Deviations:** Some middleware files use default exports for legacy reasons:

- `audit.ts` - exports default `auditMiddleware`
- `cache.ts` - exports default `cache`
- `rate-limiter.ts` - exports default object
- `sanitization.ts` - exports default `sanitizeInputs`

These should be migrated to named exports when refactored.

---

## 5. Error Handling

### Custom Error Classes

Create domain-specific error classes for important operations:

```typescript
export class AuditLogError extends Error {
  constructor(
    message: string,
    public readonly entry: Partial<AuditLogEntry>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AuditLogError';
  }
}
```

### Route Error Handling

Always wrap async handlers with `asyncHandler`:

```typescript
import { asyncHandler } from '../middleware/errorHandler.js';

router.post(
  '/clients',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Errors here are automatically caught and passed to error middleware
    const client = await clientService.create(req.body);
    sendCreated(res, { client });
  })
);
```

### Error Response Codes

Use consistent error codes:

| Code | Usage |
|------|-------|
| `VALIDATION_ERROR` | Input validation failed |
| `UNAUTHORIZED` | Not authenticated |
| `FORBIDDEN` | Authenticated but not allowed |
| `NOT_FOUND` | Resource doesn't exist |
| `DUPLICATE_*` | Unique constraint violation |
| `INTERNAL_ERROR` | Unexpected server error |

---

## 6. Database Access

### Get Database Instance

```typescript
import { getDatabase } from '../database/init.js';

const db = getDatabase();
```

### Query Patterns

```typescript
// SELECT single row
const client = await db.get(
  'SELECT id, name, email FROM clients WHERE id = ?',
  [clientId]
);

// SELECT multiple rows
const clients = await db.all(
  'SELECT id, name, email FROM clients WHERE status = ?',
  ['active']
);

// INSERT
const result = await db.run(
  'INSERT INTO clients (name, email) VALUES (?, ?)',
  [name, email]
);
const newId = result.lastID;

// UPDATE
const result = await db.run(
  'UPDATE clients SET name = ? WHERE id = ?',
  [name, id]
);
const affectedRows = result.changes;

// DELETE (soft delete preferred)
await db.run(
  'UPDATE clients SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
  [id]
);
```

### Avoid SELECT *

Always specify columns explicitly:

```typescript
// CORRECT
const COLUMNS = 'id, name, email, created_at';
await db.all(`SELECT ${COLUMNS} FROM clients`);

// INCORRECT
await db.all('SELECT * FROM clients');
```

---

## 7. Logging Standards

### Log Prefix Format

Use `[SERVICE_NAME]` in UPPER_SNAKE_CASE:

```typescript
logger.info('[CLIENT_SERVICE] Creating new client');
logger.error('[INVOICE_SERVICE] Failed to generate PDF');
logger.warn('[CACHE] Redis connection lost, using fallback');
```

### Log Levels

| Level | Usage |
|-------|-------|
| `error` | Errors that need attention |
| `warn` | Warnings, degraded functionality |
| `info` | Normal operations, milestones |
| `debug` | Detailed debugging info |

### Security Logging

For security events, use `logSecurity`:

```typescript
await logger.logSecurity('login_failed', {
  email: attemptedEmail,
  ip: req.ip,
  reason: 'Invalid password'
}, req);
```

---

## Quick Reference

### File Organization

```text
server/
├── config/           # Configuration (environment, business, etc.)
│   └── index.ts      # Central exports
├── database/         # Database layer
│   ├── init.ts       # Connection management
│   ├── migrations.ts # Schema migrations
│   └── entities/     # Entity definitions
├── middleware/       # Express middleware
├── routes/           # API route handlers
│   ├── api.ts        # Route aggregator
│   └── [domain]/     # Domain-specific routes
├── services/         # Business logic
├── types/            # TypeScript types
│   └── index.ts      # Central exports
└── utils/            # Utility functions
```

### Import Order

```typescript
// 1. Node.js built-ins
import path from 'path';

// 2. External packages
import express from 'express';

// 3. Internal modules (absolute paths)
import { getDatabase } from '../database/init.js';
import { clientService } from '../services/client-service.js';

// 4. Types
import type { JWTAuthRequest } from '../types/request.js';
```
