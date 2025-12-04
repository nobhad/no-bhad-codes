/**
 * ===============================================
 * AUDIT MIDDLEWARE
 * ===============================================
 * @file server/middleware/audit.ts
 *
 * Automatically logs all write operations (POST, PUT, DELETE)
 * to the audit_logs table.
 */

import { Request, Response, NextFunction } from 'express';
import { auditLogger, AuditAction, AuditEntityType } from '../services/audit-logger.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    type: string;
  };
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
  '/api/auth': 'session',
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
 */
export function auditMiddleware() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to capture response
    res.json = function (body: any) {
      // Log after successful response (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const action = getAction(req.method, req.path);
        const entityType = getEntityType(req.path);
        const entityId = getEntityId(req) || body?.id?.toString() || body?.data?.id?.toString();

        // Don't await - fire and forget for performance
        auditLogger.log({
          userId: req.user?.id,
          userEmail: req.user?.email,
          userType: req.user?.type === 'admin' ? 'admin' : req.user ? 'client' : 'system',
          action,
          entityType,
          entityId,
          entityName: body?.name || body?.email || body?.subject || req.body?.name,
          newValue: req.method === 'DELETE' ? undefined : req.body,
          ipAddress: (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', ''),
          userAgent: req.get('user-agent'),
          requestPath: req.path,
          requestMethod: req.method,
          metadata: {
            statusCode: res.statusCode,
            responseId: body?.id || body?.data?.id,
          },
        }).catch((err) => console.error('[AUDIT] Failed to log:', err));
      }

      return originalJson(body);
    };

    next();
  };
}

export default auditMiddleware;
