/**
 * ===============================================
 * AUDIT MIDDLEWARE
 * ===============================================
 * @file server/middleware/audit.ts
 *
 * Automatically logs all write operations (POST, PUT, DELETE)
 * to the audit_logs table.
 *
 * NOTE: Uses the response 'finish' event to avoid conflicts with
 * other middleware that intercept res.json (like logger.ts).
 */

import { Request, Response, NextFunction } from 'express';
import { auditLogger, AuditAction, AuditEntityType } from '../services/audit-logger.js';
import { logger } from '../services/logger.js';
import type { JWTAuthRequest } from '../types/request.js';

// Symbol to store audit context on response object
const AUDIT_CONTEXT = Symbol('auditContext');

interface AuditContext {
  responseBody?: unknown;
  shouldAudit: boolean;
}

// Extend Response type to include audit context
interface AuditableResponse extends Response {
  [AUDIT_CONTEXT]?: AuditContext;
}

/**
 * Map routes to entity types for audit logging
 */
const ROUTE_ENTITY_MAP: Record<string, AuditEntityType> = {
  '/api/clients': 'client',
  '/api/projects': 'project',
  '/api/invoices': 'invoice',
  '/api/messages': 'message',
  '/api/uploads': 'file',
  '/api/intake': 'intake',
  '/api/contact': 'contact_submission',
  '/api/auth': 'session'
};

/**
 * Get entity type from request path
 */
function getEntityType(path: string): AuditEntityType {
  for (const [route, entityType] of Object.entries(ROUTE_ENTITY_MAP)) {
    if (path.startsWith(route)) {
      return entityType;
    }
  }
  return 'settings'; // Default fallback
}

/**
 * Get action type from HTTP method and path
 */
function getAction(method: string, path: string): AuditAction {
  // Special cases
  if (path.includes('/login')) return 'login';
  if (path.includes('/logout')) return 'logout';
  if (path.includes('/password')) return 'password_reset';
  if (path.includes('/upload')) return 'upload';
  if (path.includes('/download')) return 'download';
  if (path.includes('/send') || path.includes('/message')) return 'send_message';
  if (path.includes('/status')) return 'status_change';

  // Default based on method
  switch (method) {
  case 'POST':
    return 'create';
  case 'PUT':
  case 'PATCH':
    return 'update';
  case 'DELETE':
    return 'delete';
  default:
    return 'view';
  }
}

/**
 * Extract entity ID from request
 */
function getEntityId(req: Request): string | undefined {
  // Check params for common ID patterns
  if (req.params.id) return String(req.params.id);
  if (req.params.projectId) return String(req.params.projectId);
  if (req.params.clientId) return String(req.params.clientId);
  if (req.params.invoiceId) return String(req.params.invoiceId);
  if (req.params.messageId) return String(req.params.messageId);
  if (req.params.threadId) return String(req.params.threadId);
  if (req.params.fileId) return String(req.params.fileId);

  // Check body for ID
  if (req.body?.id) return String(req.body.id);

  return undefined;
}

/**
 * Middleware to automatically audit write operations
 *
 * Uses a two-phase approach to avoid res.json conflicts:
 * 1. Intercept res.json to capture response body
 * 2. Use res.on('finish') to perform audit logging
 */
export function auditMiddleware() {
  return (req: JWTAuthRequest, res: AuditableResponse, next: NextFunction) => {
    // Only audit write operations
    const writeOperations = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!writeOperations.includes(req.method)) {
      return next();
    }

    // Skip certain paths
    const skipPaths = ['/api/health', '/health', '/api-docs'];
    if (skipPaths.some((p) => req.path.startsWith(p))) {
      return next();
    }

    // Initialize audit context
    res[AUDIT_CONTEXT] = { shouldAudit: true };

    // Capture response body by intercepting res.json
    // This preserves the chain - other middleware can also intercept
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // Store body for audit logging in finish handler
      if (res[AUDIT_CONTEXT]) {
        res[AUDIT_CONTEXT].responseBody = body;
      }
      return originalJson(body);
    };

    // Perform audit logging on response finish
    res.on('finish', () => {
      const ctx = res[AUDIT_CONTEXT];
      if (!ctx?.shouldAudit) return;

      // Only audit successful responses (2xx status)
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      const body = ctx.responseBody as Record<string, unknown> | undefined;
      const action = getAction(req.method, req.path);
      const entityType = getEntityType(req.path);
      const entityId =
        getEntityId(req) || body?.id?.toString() || (body?.data as Record<string, unknown> | undefined)?.id?.toString();

      // Build the full audit entry before logging so it can be
      // captured in structured logs if DB persistence fails
      const auditEntry = {
        userId: req.user?.id,
        userEmail: req.user?.email,
        userType: req.user?.type === 'admin' ? 'admin' : req.user ? 'client' : 'system',
        action,
        entityType,
        entityId,
        entityName:
          (body?.name as string) ||
          (body?.email as string) ||
          (body?.subject as string) ||
          req.body?.name,
        newValue: req.method === 'DELETE' ? undefined : req.body,
        ipAddress: (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', ''),
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method,
        metadata: {
          statusCode: res.statusCode,
          responseId: body?.id || (body?.data as Record<string, unknown> | undefined)?.id
        }
      } as const;

      // Fire and forget - response already sent, so we log the full
      // audit entry to structured logs on failure to preserve the trail
      auditLogger.log(auditEntry).catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('[Audit] Failed to persist audit entry', {
          error,
          metadata: {
            userId: auditEntry.userId,
            userEmail: auditEntry.userEmail,
            userType: auditEntry.userType,
            action: auditEntry.action,
            entityType: auditEntry.entityType,
            entityId: auditEntry.entityId,
            entityName: auditEntry.entityName,
            ipAddress: auditEntry.ipAddress,
            requestPath: auditEntry.requestPath,
            requestMethod: auditEntry.requestMethod,
            statusCode: auditEntry.metadata.statusCode,
            responseId: auditEntry.metadata.responseId
          }
        });
      });
    });

    next();
  };
}
