/**
 * ===============================================
 * DATABASE QUERY HELPERS
 * ===============================================
 * @file server/database/query-helpers.ts
 *
 * Reusable SQL query helpers for common patterns.
 */

/**
 * Returns SQL fragment to filter out soft-deleted records
 * @param alias - Optional table alias (e.g., 'c' for 'clients c')
 * @returns SQL fragment like 'deleted_at IS NULL' or 'c.deleted_at IS NULL'
 *
 * @example
 * // Without alias
 * `SELECT * FROM clients WHERE ${notDeleted()}`
 * // => SELECT * FROM clients WHERE deleted_at IS NULL
 *
 * @example
 * // With alias
 * `SELECT * FROM clients c WHERE ${notDeleted('c')}`
 * // => SELECT * FROM clients c WHERE c.deleted_at IS NULL
 */
export const notDeleted = (alias?: string): string =>
  `${alias ? `${alias  }.` : ''}deleted_at IS NULL`;

/**
 * Returns SQL fragment to find soft-deleted records
 * @param alias - Optional table alias
 * @returns SQL fragment like 'deleted_at IS NOT NULL'
 */
export const isDeleted = (alias?: string): string =>
  `${alias ? `${alias  }.` : ''}deleted_at IS NOT NULL`;

/**
 * Returns SQL fragment to find records deleted within retention period
 * @param alias - Optional table alias
 * @param days - Number of days in retention period (default 30)
 * @returns SQL fragment for recoverable deleted records
 */
export const isRecoverable = (alias?: string, days: number = 30): string => {
  const prefix = alias ? `${alias  }.` : '';
  return `${prefix}deleted_at IS NOT NULL AND datetime(${prefix}deleted_at, '+${days} days') > datetime('now')`;
};

/**
 * Returns SQL fragment to find records past retention period (ready for permanent deletion)
 * @param alias - Optional table alias
 * @param days - Number of days in retention period (default 30)
 * @returns SQL fragment for expired deleted records
 */
export const isExpired = (alias?: string, days: number = 30): string => {
  const prefix = alias ? `${alias  }.` : '';
  return `${prefix}deleted_at IS NOT NULL AND datetime(${prefix}deleted_at, '+${days} days') <= datetime('now')`;
};

// ============================================
// SAFE UPDATE BUILDER
// ============================================

/**
 * Type for allowed field values in updates
 */
export type SqlValue = string | number | boolean | null;

/**
 * Result of building a safe update query
 */
export interface SafeUpdateResult {
  setClause: string;
  params: SqlValue[];
}

/**
 * Build a safe SQL UPDATE SET clause by validating field names against a whitelist.
 * Prevents SQL injection by ensuring only allowed columns are updated.
 *
 * @param updates - Object mapping field names to values
 * @param allowedFields - Array of allowed field names for this table
 * @param options - Optional settings
 * @returns Object with setClause string and params array
 * @throws Error if an invalid field name is provided
 *
 * @example
 * const ALLOWED_FIELDS = ['name', 'status', 'description'];
 * const { setClause, params } = buildSafeUpdate(
 *   { name: 'New Name', status: 'active' },
 *   ALLOWED_FIELDS,
 *   { addTimestamp: true }
 * );
 * // setClause = 'name = ?, status = ?, updated_at = CURRENT_TIMESTAMP'
 * // params = ['New Name', 'active']
 * await db.run(`UPDATE my_table SET ${setClause} WHERE id = ?`, [...params, id]);
 */
export function buildSafeUpdate(
  updates: Record<string, SqlValue>,
  allowedFields: readonly string[],
  options: { addTimestamp?: boolean; timestampField?: string } = {}
): SafeUpdateResult {
  const { addTimestamp = true, timestampField = 'updated_at' } = options;
  const setClauses: string[] = [];
  const params: SqlValue[] = [];

  for (const [field, value] of Object.entries(updates)) {
    // Skip undefined values
    if (value === undefined) continue;

    // Validate field name against whitelist
    if (!allowedFields.includes(field)) {
      throw new Error(`Invalid field name: ${field}. Allowed fields: ${allowedFields.join(', ')}`);
    }

    setClauses.push(`${field} = ?`);
    params.push(value);
  }

  // Add timestamp if requested and there are updates
  if (addTimestamp && setClauses.length > 0) {
    setClauses.push(`${timestampField} = CURRENT_TIMESTAMP`);
  }

  return {
    setClause: setClauses.join(', '),
    params
  };
}

/**
 * Validate that a field name is safe for use in SQL.
 * Only allows alphanumeric characters and underscores.
 *
 * @param fieldName - The field name to validate
 * @returns true if valid, false otherwise
 */
export function isValidFieldName(fieldName: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName);
}

/**
 * Validate a field name and throw if invalid.
 *
 * @param fieldName - The field name to validate
 * @throws Error if field name is invalid
 */
export function assertValidFieldName(fieldName: string): void {
  if (!isValidFieldName(fieldName)) {
    throw new Error(`Invalid field name: ${fieldName}. Field names must be alphanumeric with underscores.`);
  }
}
