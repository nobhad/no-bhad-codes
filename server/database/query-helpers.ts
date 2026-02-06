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
  `${alias ? alias + '.' : ''}deleted_at IS NULL`;

/**
 * Returns SQL fragment to find soft-deleted records
 * @param alias - Optional table alias
 * @returns SQL fragment like 'deleted_at IS NOT NULL'
 */
export const isDeleted = (alias?: string): string =>
  `${alias ? alias + '.' : ''}deleted_at IS NOT NULL`;

/**
 * Returns SQL fragment to find records deleted within retention period
 * @param alias - Optional table alias
 * @param days - Number of days in retention period (default 30)
 * @returns SQL fragment for recoverable deleted records
 */
export const isRecoverable = (alias?: string, days: number = 30): string => {
  const prefix = alias ? alias + '.' : '';
  return `${prefix}deleted_at IS NOT NULL AND datetime(${prefix}deleted_at, '+${days} days') > datetime('now')`;
};

/**
 * Returns SQL fragment to find records past retention period (ready for permanent deletion)
 * @param alias - Optional table alias
 * @param days - Number of days in retention period (default 30)
 * @returns SQL fragment for expired deleted records
 */
export const isExpired = (alias?: string, days: number = 30): string => {
  const prefix = alias ? alias + '.' : '';
  return `${prefix}deleted_at IS NOT NULL AND datetime(${prefix}deleted_at, '+${days} days') <= datetime('now')`;
};
