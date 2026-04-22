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

import crypto from 'node:crypto';
import { getDatabase } from '../database/init.js';
import type { Request } from 'express';
import { logger } from './logger.js';
import { safeJsonParseOrNull } from '../utils/safe-json.js';

/**
 * Hash-chain helpers for the audit_logs table.
 *
 * `computeRowHash` returns the SHA-256 hex digest of a canonical
 * representation of the row's content fields, concatenated with the
 * previous row's hash. The canonicalization sorts keys so we're not
 * at the mercy of JSON.stringify property order.
 *
 * The genesis row's prev_hash is the sentinel 'GENESIS' — writing
 * empty-string would collide with a row whose content hashed to the
 * literal empty string, which is extremely unlikely but free to
 * sidestep.
 */
const CHAIN_GENESIS = 'GENESIS';

export interface AuditChainContent {
  user_id: number | null;
  user_email: string | null;
  user_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changes: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_path: string | null;
  request_method: string | null;
  metadata: string | null;
  created_at: string;
}

/**
 * Canonical, collision-resistant serialisation of a row's content
 * fields for the chain hash input. Length-prefixing each value makes
 * the encoding injective — two rows whose concatenated content would
 * otherwise align into the same byte stream are disambiguated by the
 * value lengths. Keys are sorted so source-object property order
 * doesn't perturb the hash.
 *
 * Previous implementation used ASCII Unit Separator (0x1F) as a
 * delimiter; that's safe for well-behaved content but an attacker
 * controlling a logged field (user_agent, metadata, request_path)
 * could inject 0x1F to forge a canonical-form collision. Length
 * prefixes close that gap regardless of content bytes.
 */
function canonicalize(content: AuditChainContent): string {
  const keys = Object.keys(content).sort() as Array<keyof AuditChainContent>;
  return keys
    .map((k) => {
      const value = content[k] ?? '';
      const valueStr = String(value);
      return `${k}:${valueStr.length}:${valueStr}`;
    })
    .join('|');
}

export function computeRowHash(content: AuditChainContent, prevHash: string): string {
  return crypto.createHash('sha256').update(`${canonicalize(content)}|${prevHash}`).digest('hex');
}

// =====================================================
// Column Constants - Explicit column lists for SELECT queries
// =====================================================

const AUDIT_LOG_COLUMNS = `
  id, user_id, user_email, user_type, action, entity_type, entity_id, entity_name,
  old_value, new_value, changes, ip_address, user_agent, request_path, request_method,
  metadata, created_at
`.replace(/\s+/g, ' ').trim();

// Database row returned from audit_logs table
interface AuditLogRow {
  id: number;
  user_id: number | null;
  user_email: string | null;
  user_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changes: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_path: string | null;
  request_method: string | null;
  metadata: string | null;
  created_at: string;
}

// Parsed audit log with JSON fields deserialized
interface ParsedAuditLog extends Omit<AuditLogRow, 'old_value' | 'new_value' | 'changes' | 'metadata'> {
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

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
  'api_key'
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
    requestMethod: req.method
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
 * Custom error class for audit logging failures
 */
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

/**
 * Core function to create an audit log entry
 * @throws {AuditLogError} When audit log creation fails - COMPLIANCE CRITICAL
 */
async function createAuditLog(entry: AuditLogEntry): Promise<void> {
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
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null
    };

    // Insert-then-hash inside a transaction so concurrent audit writes
    // serialize and each row's prev_hash reflects the actual preceding
    // committed row. We can't include created_at in the hash until the
    // DB assigns it on INSERT, so the flow is:
    //   1. INSERT the content (SQLite sets id + created_at)
    //   2. Read the previous row's hash (the most recent one *before*
    //      our new id, so two concurrent writers don't link to each
    //      other's pre-commit state)
    //   3. Compute this row's hash over its content + prev_hash
    //   4. UPDATE the row with prev_hash + hash
    await db.transaction(async (ctx) => {
      const insertResult = await ctx.run(
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
          auditData.metadata
        ]
      );

      const newId = insertResult.lastID;
      if (!newId) {
        throw new Error('Audit insert returned no lastID; cannot chain');
      }

      const inserted = (await ctx.get(
        'SELECT created_at FROM audit_logs WHERE id = ?',
        [newId]
      )) as { created_at: string } | undefined;
      const createdAt = inserted?.created_at ?? new Date().toISOString();

      const prevRow = (await ctx.get(
        `SELECT hash FROM audit_logs
          WHERE id < ? AND hash IS NOT NULL
          ORDER BY id DESC
          LIMIT 1`,
        [newId]
      )) as { hash: string } | undefined;
      const prevHash = prevRow?.hash ?? CHAIN_GENESIS;

      const content: AuditChainContent = {
        user_id: auditData.user_id,
        user_email: auditData.user_email,
        user_type: auditData.user_type,
        action: auditData.action,
        entity_type: auditData.entity_type,
        entity_id: auditData.entity_id,
        entity_name: auditData.entity_name,
        old_value: auditData.old_value,
        new_value: auditData.new_value,
        changes: auditData.changes,
        ip_address: auditData.ip_address,
        user_agent: auditData.user_agent,
        request_path: auditData.request_path,
        request_method: auditData.request_method,
        metadata: auditData.metadata,
        created_at: createdAt
      };
      const hash = computeRowHash(content, prevHash);

      await ctx.run(
        'UPDATE audit_logs SET prev_hash = ?, hash = ? WHERE id = ?',
        [prevHash, hash, newId]
      );
    });

    logger.info(
      `[Audit] ${entry.action.toUpperCase()} ${entry.entityType}${entry.entityId ? `:${entry.entityId}` : ''} by ${entry.userEmail || 'system'}`
    );
  } catch (error) {
    // COMPLIANCE CRITICAL: Audit failures must be visible, not silent
    const auditError = new AuditLogError(
      `Failed to create audit log for ${entry.action} on ${entry.entityType}`,
      entry,
      error instanceof Error ? error : undefined
    );

    logger.error('[Audit] CRITICAL - Audit log creation failed:', {
      error: auditError,
      metadata: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId
      }
    });

    throw auditError;
  }
}

export interface AuditChainBreak {
  id: number;
  kind: 'prev_hash_mismatch' | 'hash_mismatch' | 'missing_hash';
  expected?: string;
  actual?: string;
  createdAt: string;
}

export interface AuditChainVerification {
  total: number;
  verified: number;
  skipped: number;
  breaks: AuditChainBreak[];
}

export interface VerifyAuditChainOptions {
  /** Page size — SELECT this many rows at a time. Default 5000. */
  batchSize?: number;
  /** Stop walking after this many breaks; default unlimited. */
  maxBreaks?: number;
}

/**
 * Walk the audit_logs chain in insertion order and verify each row's
 * hash was produced by the documented recipe and correctly linked to
 * its predecessor. Returns a list of breaks (if any) rather than
 * throwing — caller decides whether to alert, page, or halt writes.
 *
 * Streams rows in id-ordered batches so memory stays bounded even at
 * a million-row audit history. Cross-batch continuity is preserved
 * by carrying `lastKnownHash` and `sawFirstHashedRow` between pages.
 *
 * Rows inserted before migration 135 have null hash / prev_hash;
 * they're counted as `skipped`, not `breaks`.
 */
export async function verifyAuditChain(
  options: VerifyAuditChainOptions = {}
): Promise<AuditChainVerification> {
  const batchSize = Math.min(Math.max(options.batchSize ?? 5000, 100), 50_000);
  const maxBreaks = options.maxBreaks ?? Number.POSITIVE_INFINITY;

  const db = getDatabase();

  const breaks: AuditChainBreak[] = [];
  let verified = 0;
  let skipped = 0;
  let total = 0;
  let lastKnownHash = CHAIN_GENESIS;
  let sawFirstHashedRow = false;
  let cursor = 0;

  // Pull the table in id-ordered pages. Each page is self-contained,
  // so the verifier's peak memory is ~batchSize rows rather than the
  // full table.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await db.all<AuditLogRow & { prev_hash: string | null; hash: string | null }>(
      `SELECT id, user_id, user_email, user_type, action, entity_type, entity_id, entity_name,
              old_value, new_value, changes, ip_address, user_agent, request_path, request_method,
              metadata, created_at, prev_hash, hash
         FROM audit_logs
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?`,
      [cursor, batchSize]
    );

    if (rows.length === 0) break;
    total += rows.length;

    for (const row of rows) {
      cursor = row.id;

      if (row.hash == null) {
        skipped += 1;
        continue;
      }

      const content: AuditChainContent = {
        user_id: row.user_id,
        user_email: row.user_email,
        user_type: row.user_type,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        entity_name: row.entity_name,
        old_value: row.old_value,
        new_value: row.new_value,
        changes: row.changes,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        request_path: row.request_path,
        request_method: row.request_method,
        metadata: row.metadata,
        created_at: row.created_at
      };

      const expectedPrev = sawFirstHashedRow ? lastKnownHash : row.prev_hash ?? CHAIN_GENESIS;
      if (sawFirstHashedRow && row.prev_hash !== expectedPrev) {
        breaks.push({
          id: row.id,
          kind: 'prev_hash_mismatch',
          expected: expectedPrev,
          actual: row.prev_hash ?? undefined,
          createdAt: row.created_at
        });
      }

      const recomputed = computeRowHash(content, row.prev_hash ?? CHAIN_GENESIS);
      if (recomputed !== row.hash) {
        breaks.push({
          id: row.id,
          kind: 'hash_mismatch',
          expected: recomputed,
          actual: row.hash,
          createdAt: row.created_at
        });
      } else {
        verified += 1;
      }

      lastKnownHash = row.hash;
      sawFirstHashedRow = true;

      if (breaks.length >= maxBreaks) {
        return { total, verified, skipped, breaks };
      }
    }

    // If the batch was under-full we've hit the end of the table.
    if (rows.length < batchSize) break;
  }

  return { total, verified, skipped, breaks };
}

/**
 * Audit Logger API
 */
export const auditLogger = {
  /**
   * Log a create action
   * @throws {AuditLogError} When audit log creation fails
   */
  async logCreate(
    entityType: AuditEntityType,
    entityId: string,
    entityName?: string,
    newValue?: Record<string, unknown>,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      action: 'create',
      entityType,
      entityId,
      entityName,
      newValue,
      metadata
    });
  },

  /**
   * Log an update action
   * @throws {AuditLogError} When audit log creation fails
   */
  async logUpdate(
    entityType: AuditEntityType,
    entityId: string,
    entityName?: string,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      action: 'update',
      entityType,
      entityId,
      entityName,
      oldValue,
      newValue,
      metadata
    });
  },

  /**
   * Log a delete action
   * @throws {AuditLogError} When audit log creation fails
   */
  async logDelete(
    entityType: AuditEntityType,
    entityId: string,
    entityName?: string,
    oldValue?: Record<string, unknown>,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      action: 'delete',
      entityType,
      entityId,
      entityName,
      oldValue,
      metadata
    });
  },

  /**
   * Log a successful login
   * @throws {AuditLogError} When audit log creation fails
   */
  async logLogin(
    userId: number,
    userEmail: string,
    userType: AuditUserType,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      userId,
      userEmail,
      userType,
      action: 'login',
      entityType: 'session',
      entityId: String(userId),
      entityName: userEmail,
      metadata
    });
  },

  /**
   * Log a failed login attempt
   * @throws {AuditLogError} When audit log creation fails
   */
  async logLoginFailed(
    email: string,
    req?: Request,
    reason?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      userEmail: email,
      userType: 'system',
      action: 'login_failed',
      entityType: 'session',
      entityName: email,
      metadata: { ...metadata, reason }
    });
  },

  /**
   * Log a logout
   * @throws {AuditLogError} When audit log creation fails
   */
  async logLogout(
    userId: number,
    userEmail: string,
    userType: AuditUserType,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      userId,
      userEmail,
      userType,
      action: 'logout',
      entityType: 'session',
      entityId: String(userId),
      entityName: userEmail,
      metadata
    });
  },

  /**
   * Log a status change
   * @throws {AuditLogError} When audit log creation fails
   */
  async logStatusChange(
    entityType: AuditEntityType,
    entityId: string,
    entityName: string,
    oldStatus: string,
    newStatus: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      action: 'status_change',
      entityType,
      entityId,
      entityName,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus },
      metadata
    });
  },

  /**
   * Log a file upload
   * @throws {AuditLogError} When audit log creation fails
   */
  async logUpload(
    entityId: string,
    fileName: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      action: 'upload',
      entityType: 'file',
      entityId,
      entityName: fileName,
      metadata
    });
  },

  /**
   * Log a file download
   * @throws {AuditLogError} When audit log creation fails
   */
  async logDownload(
    entityId: string,
    fileName: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      action: 'download',
      entityType: 'file',
      entityId,
      entityName: fileName,
      metadata
    });
  },

  /**
   * Log a message sent
   * @throws {AuditLogError} When audit log creation fails
   */
  async logMessageSent(
    messageId: string,
    subject: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      action: 'send_message',
      entityType: 'message',
      entityId: messageId,
      entityName: subject,
      metadata
    });
  },

  /**
   * Log an email sent
   * @throws {AuditLogError} When audit log creation fails
   */
  async logEmailSent(
    recipientEmail: string,
    subject: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      action: 'send_email',
      entityType: 'message',
      entityName: subject,
      metadata: { ...metadata, recipient: recipientEmail }
    });
  },

  /**
   * Log a password reset request
   * @throws {AuditLogError} When audit log creation fails
   */
  async logPasswordReset(
    userId: number,
    userEmail: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      userId,
      userEmail,
      action: 'password_reset',
      entityType: 'client',
      entityId: String(userId),
      entityName: userEmail,
      metadata
    });
  },

  /**
   * Log a view action (for tracking access)
   * @throws {AuditLogError} When audit log creation fails
   */
  async logView(
    entityType: AuditEntityType,
    entityId: string,
    entityName?: string,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      action: 'view',
      entityType,
      entityId,
      entityName,
      metadata
    });
  },

  /**
   * Log an export operation
   * @throws {AuditLogError} When audit log creation fails
   */
  async logExport(
    entityType: AuditEntityType,
    format: string,
    recordCount: number,
    req?: Request,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog({
      ...extractRequestContext(req),
      action: 'export',
      entityType,
      entityName: `${recordCount} ${entityType}s to ${format}`,
      metadata: { ...metadata, format, recordCount }
    });
  },

  /**
   * Generic log function for custom actions
   * @throws {AuditLogError} When audit log creation fails
   */
  async log(entry: AuditLogEntry): Promise<void> {
    await createAuditLog(entry);
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
  }): Promise<ParsedAuditLog[]> {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: (string | number)[] = [];

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
      `SELECT ${AUDIT_LOG_COLUMNS} FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Parse JSON fields safely
    return logs.map((log: AuditLogRow) => ({
      ...log,
      old_value: safeJsonParseOrNull(log.old_value, 'audit log old_value'),
      new_value: safeJsonParseOrNull(log.new_value, 'audit log new_value'),
      changes: safeJsonParseOrNull(log.changes, 'audit log changes'),
      metadata: safeJsonParseOrNull(log.metadata, 'audit log metadata')
    }));
  }
};

export default auditLogger;
