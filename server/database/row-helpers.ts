/**
 * ===============================================
 * DATABASE ROW TYPE HELPERS
 * ===============================================
 * @file server/database/row-helpers.ts
 *
 * Type-safe utilities for extracting values from database rows
 * Since database rows are typed as `DatabaseRow` (which is `Record<string, unknown>`),
 * we need type guards and helpers to safely extract typed values.
 */

import type { DatabaseRow } from './init.js';

/**
 * Safely extract a string value from a database row
 */
export function getString(row: DatabaseRow | undefined, key: string): string {
  if (!row || !(key in row)) {
    return '';
  }
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Safely extract a string value from a database row, returning null if not present
 */
export function getStringOrNull(row: DatabaseRow | undefined, key: string): string | null {
  if (!row || !(key in row)) {
    return null;
  }
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : null;
}

/**
 * Safely extract a number value from a database row
 */
export function getNumber(row: DatabaseRow | undefined, key: string): number {
  if (!row || !(key in row)) {
    return 0;
  }
  const value = row[key];
  return typeof value === 'number' ? value : 0;
}

/**
 * Safely extract a number value from a database row, returning null if not present
 */
export function getNumberOrNull(row: DatabaseRow | undefined, key: string): number | null {
  if (!row || !(key in row)) {
    return null;
  }
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'number' ? value : null;
}

/**
 * Safely extract a float value from a database row
 * Handles SQLite DECIMAL fields that may return as strings
 */
export function getFloat(row: DatabaseRow | undefined, key: string): number {
  if (!row || !(key in row)) {
    return 0;
  }
  const value = row[key];
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Safely extract a float value from a database row, returning null if not present
 * Handles SQLite DECIMAL fields that may return as strings
 */
export function getFloatOrNull(row: DatabaseRow | undefined, key: string): number | null {
  if (!row || !(key in row)) {
    return null;
  }
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Safely extract a boolean value from a database row
 * Handles SQLite's 0/1 representation of booleans
 */
export function getBoolean(row: DatabaseRow | undefined, key: string): boolean {
  if (!row || !(key in row)) {
    return false;
  }
  const value = row[key];
  // Handle native boolean
  if (typeof value === 'boolean') {
    return value;
  }
  // Handle SQLite's 0/1 integer representation
  if (typeof value === 'number') {
    return value !== 0; // 0 = false, non-zero = true
  }
  // Fallback for truthy/falsy values
  return Boolean(value);
}

/**
 * Safely extract a boolean value from a database row, returning null if not present
 * Handles SQLite's 0/1 representation of booleans
 */
export function getBooleanOrNull(row: DatabaseRow | undefined, key: string): boolean | null {
  if (!row || !(key in row)) {
    return null;
  }
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  // Handle native boolean
  if (typeof value === 'boolean') {
    return value;
  }
  // Handle SQLite's 0/1 integer representation
  if (typeof value === 'number') {
    return value !== 0; // 0 = false, non-zero = true
  }
  return null;
}

/**
 * Safely extract an unknown value from a database row
 */
export function getUnknown(row: DatabaseRow | undefined, key: string): unknown {
  if (!row || !(key in row)) {
    return null;
  }
  return row[key];
}

/**
 * Type guard to check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Type guard to check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Safely extract a Date value from a database row (from ISO string or timestamp)
 */
export function getDate(row: DatabaseRow | undefined, key: string): Date | null {
  if (!row || !(key in row)) {
    return null;
  }
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'number') {
    return new Date(value);
  }
  return null;
}

// ============================================
// DATA TRANSFORMATION UTILITIES
// ============================================

/**
 * Known boolean field names in the database that use SQLite 0/1
 * These will be converted to JavaScript true/false in API responses
 */
const BOOLEAN_FIELDS = new Set([
  // Common boolean fields
  'is_active',
  'is_admin',
  'is_billable',
  'is_primary',
  'is_internal',
  'is_read',
  'is_starred',
  'is_archived',
  'is_deleted',
  'is_verified',
  'is_paid',
  'is_overdue',
  'is_template',
  'is_default',
  'is_locked',
  'is_hidden',
  'is_completed',
  'is_published',
  'is_featured',
  'is_enabled',
  'is_recurring',
  'is_public',
  'is_system',
  // Specific fields
  'active',
  'billable',
  'billed',
  'paid',
  'approved',
  'archived',
  'deleted',
  'locked',
  'verified',
  'published',
  'featured',
  'enabled',
  'recurring',
  'shared_with_client',
  'client_visible',
  'admin_only',
  'requires_approval',
  'auto_approve',
  'notify_client',
  'notify_admin',
  'send_reminders',
  'allow_comments',
  'allow_uploads',
  'include_in_reports',
  // CamelCase versions (for API responses)
  'isActive',
  'isAdmin',
  'isBillable',
  'isPrimary',
  'isInternal',
  'isRead',
  'isStarred',
  'isArchived',
  'isDeleted',
  'isVerified',
  'isPaid',
  'isOverdue',
  'isTemplate',
  'isDefault',
  'isLocked',
  'isHidden',
  'isCompleted',
  'isPublished',
  'isFeatured',
  'isEnabled',
  'isRecurring',
  'isPublic',
  'isSystem',
  'sharedWithClient',
  'clientVisible',
  'adminOnly',
  'requiresApproval',
  'autoApprove',
  'notifyClient',
  'notifyAdmin',
  'sendReminders',
  'allowComments',
  'allowUploads',
  'includeInReports'
]);

/**
 * Known JSON field names that should be parsed from strings
 */
const JSON_FIELDS = new Set([
  'line_items',
  'lineItems',
  'metadata',
  'settings',
  'config',
  'options',
  'data',
  'tags',
  'categories',
  'permissions',
  'preferences',
  'filters',
  'columns',
  'variables',
  'attachments',
  'recipients',
  'schedule'
]);

/**
 * Convert SQLite 0/1 to JavaScript boolean for known boolean fields
 */
function convertBooleanValue(key: string, value: unknown): unknown {
  if (BOOLEAN_FIELDS.has(key) && typeof value === 'number') {
    return value !== 0;
  }
  return value;
}

/**
 * Parse JSON strings for known JSON fields
 */
function parseJsonValue(key: string, value: unknown): unknown {
  if (JSON_FIELDS.has(key) && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      // Return original value if parsing fails
      return value;
    }
  }
  return value;
}

/**
 * Transform a database row for API response:
 * - Convert 0/1 to boolean for known boolean fields
 * - Parse JSON strings for known JSON fields
 */
export function transformRow<T extends Record<string, unknown>>(row: T | null | undefined): T | null {
  if (!row) return null;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    // Skip null/undefined values
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    // Convert booleans
    let transformed = convertBooleanValue(key, value);

    // Parse JSON
    transformed = parseJsonValue(key, transformed);

    result[key] = transformed;
  }

  return result as T;
}

/**
 * Transform an array of database rows for API response
 */
export function transformRows<T extends Record<string, unknown>>(rows: T[] | null | undefined): T[] {
  if (!rows || !Array.isArray(rows)) return [];
  return rows.map(row => transformRow(row)).filter((row): row is T => row !== null);
}

/**
 * Transform nested data structures recursively
 * Handles objects, arrays, and nested structures
 */
export function transformData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => transformData(item)) as T;
  }

  if (typeof data === 'object' && data !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value === null || value === undefined) {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = transformData(value);
      } else if (typeof value === 'object') {
        result[key] = transformData(value as Record<string, unknown>);
      } else {
        // Apply boolean and JSON transformations
        let transformed = convertBooleanValue(key, value);
        transformed = parseJsonValue(key, transformed);
        result[key] = transformed;
      }
    }
    return result as T;
  }

  return data;
}
