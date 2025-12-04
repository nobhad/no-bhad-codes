/**
 * ===============================================
 * AUDIT LOGGER SERVICE
 * ===============================================
 * @file server/services/audit-logger.ts
 *
 * Provides functions for logging user actions to the audit_logs table.
 * Tracks creates, updates, deletes, logins, and other important actions.
 *
 * Usage:
 *   import { auditLogger } from './services/audit-logger.js';
 *
 *   // Log a create action
 *   await auditLogger.logCreate('client', client.id, client.name, clientData, req);
 *
 *   // Log an update action
 *   await auditLogger.logUpdate('project', project.id, project.name, oldData, newData, req);
 *
 *   // Log a delete action
 *   await auditLogger.logDelete('invoice', invoice.id, invoice.number, oldData, req);
 */

import { getDatabase } from '../database/init.js';
import type { Request } from 'express';

// Audit action types - expandable string type
export type AuditAction = string;

// Entity types that can be audited - expandable string type
export type AuditEntityType = string;

// User types
export type AuditUserType = 'admin' | 'client' | 'system';

// Audit log entry interface
export interface AuditLogEntry {
  userId?: number;
  userEmail?: string;
  userType?: AuditUserType;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityName?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  metadata?: Record<string, unknown>;
}

// Request context for extracting user info
interface RequestContext {
  user?: {
    id: number;
    email: string;
    role?: string;
  };
  ip?: string;
  headers?: Record<string, string>;
  path?: string;
  method?: string;
}

/**
 * Sensitive fields to redact from audit logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'token',
  'secret',
  'key',
  'credential',
  'access_token',
  'refresh_token',
  'api_key',
];

/**
 * Calculate the changes between old and new values
 */
function calculateChanges(
  oldValue: Record<string, unknown> | undefined,
  newValue: Record<string, unknown> | undefined
): Record<string, { from: unknown; to: unknown }> | undefined {
  if (!oldValue || !newValue) return undefined;

  const changes: Record<string, { from: unknown; to: unknown }> = {};

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);

  for (const key of allKeys) {
    const oldVal = oldValue[key];
    const newVal = newValue[key];

    // Skip if values are equal
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

    // Redact sensitive fields
    if (SENSITIVE_FIELDS.some((s) => key.toLowerCase().includes(s))) {
      changes[key] = { from: '[REDACTED]', to: '[REDACTED]' };
    } else {
      changes[key] = { from: oldVal, to: newVal };
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
}

/**
 * Sanitize data before logging (remove sensitive fields)
 */
function sanitizeForAudit(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data) return undefined;

  const sanitized = { ...data };

  for (const field of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.some((s) => field.toLowerCase().includes(s))) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Extract context from Express request
 */
function extractRequestContext(req?: Request): Partial<AuditLogEntry> {
  if (!req) return {};

  const context: Partial<AuditLogEntry> = {
    ipAddress: (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', ''),
    userAgent: req.get('user-agent') || undefined,
    requestPath: req.path,
    requestMethod: req.method,
  };

  // Extract user info from authenticated request
  const authReq = req as RequestContext;
  if (authReq.user) {
    context.userId = authReq.user.id;
    context.userEmail = authReq.user.email;
    context.userType = authReq.user.role === 'admin' ? 'admin' : 'client';
  }

  return context;
}

/**
 * Core function to create an audit log entry
 */
async function createAuditLog(entry: AuditLogEntry): Promise<boolean> {
  try {
    const db = getDatabase();

    const auditData = {
      user_id: entry.userId || null,
      user_email: entry.userEmail || null,
      user_type: entry.userType || 'system',
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      entity_name: entry.entityName || null,
      old_value: entry.oldValue ? JSON.stringify(sanitizeForAudit(entry.oldValue)) : null,
      new_value: entry.newValue ? JSON.stringify(sanitizeForAudit(entry.newValue)) : null,
      changes: entry.changes
        ? JSON.stringify(entry.changes)
        : entry.oldValue && entry.newValue
          ? JSON.stringify(calculateChanges(entry.oldValue, entry.newValue))
          : null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      request_path: entry.requestPath || null,
      request_method: entry.requestMethod || null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    };

    await db.run(
      `INSERT INTO audit_logs (
        user_id, user_email, user_type, action, entity_type, entity_id, entity_name,
        old_value, new_value, changes, ip_address, user_agent, request_path, request_method, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auditData.user_id,
        auditData.user_email,
        auditData.user_type,
        auditData.action,
        auditData.entity_type,
        auditData.entity_id,
        auditData.entity_name,
        auditData.old_value,
        auditData.new_value,
        auditData.changes,
        auditData.ip_address,
        auditData.user_agent,
        auditData.request_path,
        auditData.request_method,
        auditData.metadata,
      ]
    );

    console.log(
      `[AUDIT] ${entry.action.toUpperCase()} ${entry.entityType}${entry.entityId ? `:${entry.entityId}` : ''} by ${entry.userEmail || 'system'}`
    );

    return true;
  } catch (error) {
    // Audit logging should never break the app
    console.error('[AUDIT] Failed to create audit log:', error);
    return false;
  }
}

/**
 * Audit Logger API
 */
export const auditLogger = {
  /**
   * Log a create action
   */
  async logCreate(
    entityType: AuditEntityType,
    entityId: string,
    entityName?: string,
    newValue?: Record<string, unknown>,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      action: 'create',
      entityType,
      entityId,
      entityName,
      newValue,
      metadata,
    });
  },

  /**
   * Log an update action
   */
  async logUpdate(
    entityType: AuditEntityType,
    entityId: string,
    entityName?: string,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      action: 'update',
      entityType,
      entityId,
      entityName,
      oldValue,
      newValue,
      metadata,
    });
  },

  /**
   * Log a delete action
   */
  async logDelete(
    entityType: AuditEntityType,
    entityId: string,
    entityName?: string,
    oldValue?: Record<string, unknown>,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      action: 'delete',
      entityType,
      entityId,
      entityName,
      oldValue,
      metadata,
    });
  },

  /**
   * Log a successful login
   */
  async logLogin(
    userId: number,
    userEmail: string,
    userType: AuditUserType,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      userId,
      userEmail,
      userType,
      action: 'login',
      entityType: 'session',
      entityId: String(userId),
      entityName: userEmail,
      metadata,
    });
  },

  /**
   * Log a failed login attempt
   */
  async logLoginFailed(
    email: string,
    req?: Request,
    reason?: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      userEmail: email,
      userType: 'system',
      action: 'login_failed',
      entityType: 'session',
      entityName: email,
      metadata: { ...metadata, reason },
    });
  },

  /**
   * Log a logout
   */
  async logLogout(
    userId: number,
    userEmail: string,
    userType: AuditUserType,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      userId,
      userEmail,
      userType,
      action: 'logout',
      entityType: 'session',
      entityId: String(userId),
      entityName: userEmail,
      metadata,
    });
  },

  /**
   * Log a status change
   */
  async logStatusChange(
    entityType: AuditEntityType,
    entityId: string,
    entityName: string,
    oldStatus: string,
    newStatus: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      action: 'status_change',
      entityType,
      entityId,
      entityName,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus },
      metadata,
    });
  },

  /**
   * Log a file upload
   */
  async logUpload(
    entityId: string,
    fileName: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      action: 'upload',
      entityType: 'file',
      entityId,
      entityName: fileName,
      metadata,
    });
  },

  /**
   * Log a file download
   */
  async logDownload(
    entityId: string,
    fileName: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      action: 'download',
      entityType: 'file',
      entityId,
      entityName: fileName,
      metadata,
    });
  },

  /**
   * Log a message sent
   */
  async logMessageSent(
    messageId: string,
    subject: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      action: 'send_message',
      entityType: 'message',
      entityId: messageId,
      entityName: subject,
      metadata,
    });
  },

  /**
   * Log an email sent
   */
  async logEmailSent(
    recipientEmail: string,
    subject: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      action: 'send_email',
      entityType: 'message',
      entityName: subject,
      metadata: { ...metadata, recipient: recipientEmail },
    });
  },

  /**
   * Log a password reset request
   */
  async logPasswordReset(
    userId: number,
    userEmail: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      userId,
      userEmail,
      action: 'password_reset',
      entityType: 'client',
      entityId: String(userId),
      entityName: userEmail,
      metadata,
    });
  },

  /**
   * Log a view action (for tracking access)
   */
  async logView(
    entityType: AuditEntityType,
    entityId: string,
    entityName?: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      action: 'view',
      entityType,
      entityId,
      entityName,
      metadata,
    });
  },

  /**
   * Log an export operation
   */
  async logExport(
    entityType: AuditEntityType,
    format: string,
    recordCount: number,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    return createAuditLog({
      ...extractRequestContext(req),
      action: 'export',
      entityType,
      entityName: `${recordCount} ${entityType}s to ${format}`,
      metadata: { ...metadata, format, recordCount },
    });
  },

  /**
   * Generic log function for custom actions
   */
  async log(entry: AuditLogEntry): Promise<boolean> {
    return createAuditLog(entry);
  },

  /**
   * Query audit logs with filters
   */
  async query(filters: {
    userId?: number;
    userEmail?: string;
    action?: AuditAction;
    entityType?: AuditEntityType;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.userId) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }
    if (filters.userEmail) {
      conditions.push('user_email = ?');
      params.push(filters.userEmail);
    }
    if (filters.action) {
      conditions.push('action = ?');
      params.push(filters.action);
    }
    if (filters.entityType) {
      conditions.push('entity_type = ?');
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      conditions.push('entity_id = ?');
      params.push(filters.entityId);
    }
    if (filters.startDate) {
      conditions.push('created_at >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('created_at <= ?');
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const logs = await db.all(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Parse JSON fields
    return logs.map((log: any) => ({
      ...log,
      old_value: log.old_value ? JSON.parse(log.old_value) : null,
      new_value: log.new_value ? JSON.parse(log.new_value) : null,
      changes: log.changes ? JSON.parse(log.changes) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));
  },
};

export default auditLogger;
