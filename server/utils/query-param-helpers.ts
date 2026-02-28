/**
 * ===============================================
 * QUERY PARAMETER HELPERS
 * ===============================================
 * @file server/utils/query-param-helpers.ts
 *
 * Centralized utilities for parsing and validating
 * query parameters. Replaces scattered parseInt/parseFloat
 * calls across route handlers.
 */

// ============================================
// TYPES
// ============================================

export interface IntParamOptions {
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
}

export interface StringParamOptions {
  /** Allowed values (whitelist) */
  allowedValues?: readonly string[];
  /** Transform to lowercase before validation */
  lowercase?: boolean;
  /** Trim whitespace */
  trim?: boolean;
}

export interface PaginationParams {
  limit: number;
  offset: number;
  page: number;
}

export interface SortParams {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ============================================
// INTEGER PARSING
// ============================================

/**
 * Parse an integer query parameter with validation
 *
 * @param value - Raw query parameter value
 * @param defaultValue - Default if missing or invalid
 * @param options - Validation options (min, max)
 * @returns Parsed and validated integer
 *
 * @example
 * const limit = getIntParam(req.query.limit, 100, { min: 1, max: 1000 });
 * const page = getIntParam(req.query.page, 1, { min: 1 });
 */
export function getIntParam(
  value: string | string[] | undefined,
  defaultValue: number,
  options?: IntParamOptions
): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  // Handle array case (multiple query params with same key)
  const strValue = Array.isArray(value) ? value[0] : value;

  const parsed = parseInt(strValue, 10);

  if (isNaN(parsed)) {
    return defaultValue;
  }

  // Apply min/max constraints
  if (options?.min !== undefined && parsed < options.min) {
    return options.min;
  }

  if (options?.max !== undefined && parsed > options.max) {
    return options.max;
  }

  return parsed;
}

/**
 * Parse a float query parameter with validation
 */
export function getFloatParam(
  value: string | string[] | undefined,
  defaultValue: number,
  options?: IntParamOptions
): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const strValue = Array.isArray(value) ? value[0] : value;
  const parsed = parseFloat(strValue);

  if (isNaN(parsed)) {
    return defaultValue;
  }

  if (options?.min !== undefined && parsed < options.min) {
    return options.min;
  }

  if (options?.max !== undefined && parsed > options.max) {
    return options.max;
  }

  return parsed;
}

// ============================================
// STRING PARSING
// ============================================

/**
 * Parse a string query parameter with validation
 *
 * @param value - Raw query parameter value
 * @param defaultValue - Default if missing or invalid
 * @param options - Validation options
 * @returns Validated string
 *
 * @example
 * const status = getStringParam(req.query.status, 'active', {
 *   allowedValues: ['active', 'inactive', 'pending']
 * });
 */
export function getStringParam(
  value: string | string[] | undefined,
  defaultValue: string,
  options?: StringParamOptions
): string {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  let strValue = Array.isArray(value) ? value[0] : value;

  if (options?.trim !== false) {
    strValue = strValue.trim();
  }

  if (options?.lowercase) {
    strValue = strValue.toLowerCase();
  }

  if (options?.allowedValues && !options.allowedValues.includes(strValue)) {
    return defaultValue;
  }

  return strValue;
}

/**
 * Parse a boolean query parameter
 *
 * @param value - Raw query parameter value
 * @param defaultValue - Default if missing
 * @returns Boolean value
 *
 * @example
 * const includeArchived = getBoolParam(req.query.archived, false);
 */
export function getBoolParam(
  value: string | string[] | undefined,
  defaultValue: boolean
): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const strValue = Array.isArray(value) ? value[0] : value;
  const lower = strValue.toLowerCase().trim();

  if (['true', '1', 'yes', 'on'].includes(lower)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(lower)) {
    return false;
  }

  return defaultValue;
}

// ============================================
// PAGINATION HELPERS
// ============================================

/** Default pagination limits */
export const PAGINATION_DEFAULTS = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 1000,
  DEFAULT_PAGE: 1,
} as const;

/**
 * Parse pagination parameters from query
 *
 * @param query - Express query object
 * @param defaults - Override default values
 * @returns Pagination params with limit, offset, and page
 *
 * @example
 * const { limit, offset, page } = getPaginationParams(req.query);
 */
export function getPaginationParams(
  query: Record<string, string | string[] | undefined>,
  defaults?: Partial<typeof PAGINATION_DEFAULTS>
): PaginationParams {
  const defaultLimit = defaults?.DEFAULT_LIMIT ?? PAGINATION_DEFAULTS.DEFAULT_LIMIT;
  const maxLimit = defaults?.MAX_LIMIT ?? PAGINATION_DEFAULTS.MAX_LIMIT;
  const defaultPage = defaults?.DEFAULT_PAGE ?? PAGINATION_DEFAULTS.DEFAULT_PAGE;

  const limit = getIntParam(query.limit, defaultLimit, { min: 1, max: maxLimit });
  const page = getIntParam(query.page, defaultPage, { min: 1 });

  // Support both offset-based and page-based pagination
  let offset: number;
  if (query.offset !== undefined) {
    offset = getIntParam(query.offset, 0, { min: 0 });
  } else {
    offset = (page - 1) * limit;
  }

  return { limit, offset, page };
}

// ============================================
// SORTING HELPERS
// ============================================

/**
 * Parse sort parameters from query
 *
 * @param query - Express query object
 * @param allowedColumns - Columns that can be sorted (whitelist)
 * @param defaultSort - Default sort column
 * @param defaultOrder - Default sort order
 * @returns Sort params
 *
 * @example
 * const { sortBy, sortOrder } = getSortParams(
 *   req.query,
 *   ['created_at', 'name', 'status'],
 *   'created_at',
 *   'desc'
 * );
 */
export function getSortParams(
  query: Record<string, string | string[] | undefined>,
  allowedColumns: readonly string[],
  defaultSort: string,
  defaultOrder: 'asc' | 'desc' = 'desc'
): SortParams {
  const sortBy = getStringParam(query.sort || query.sortBy, defaultSort, {
    allowedValues: allowedColumns,
  });

  const orderValue = getStringParam(query.order || query.sortOrder, defaultOrder, {
    lowercase: true,
  });

  const sortOrder: 'asc' | 'desc' = orderValue === 'asc' ? 'asc' : 'desc';

  return { sortBy, sortOrder };
}

// ============================================
// DATE PARSING
// ============================================

/**
 * Parse a date query parameter
 *
 * @param value - Raw query parameter value (ISO string or timestamp)
 * @param defaultValue - Default if missing or invalid
 * @returns Date object or default
 *
 * @example
 * const startDate = getDateParam(req.query.start, new Date());
 */
export function getDateParam(
  value: string | string[] | undefined,
  defaultValue: Date | null = null
): Date | null {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const strValue = Array.isArray(value) ? value[0] : value;

  // Try parsing as ISO string
  const date = new Date(strValue);

  if (isNaN(date.getTime())) {
    // Try parsing as Unix timestamp (seconds)
    const timestamp = parseInt(strValue, 10);
    if (!isNaN(timestamp)) {
      return new Date(timestamp * 1000);
    }
    return defaultValue;
  }

  return date;
}

// ============================================
// ARRAY PARSING
// ============================================

/**
 * Parse a comma-separated list query parameter
 *
 * @param value - Raw query parameter value
 * @param defaultValue - Default if missing
 * @returns Array of strings
 *
 * @example
 * const statuses = getArrayParam(req.query.status, ['active']);
 * // ?status=active,pending -> ['active', 'pending']
 */
export function getArrayParam(
  value: string | string[] | undefined,
  defaultValue: string[] = []
): string[] {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  // If already an array (multiple params with same key)
  if (Array.isArray(value)) {
    return value.map((v) => v.trim()).filter(Boolean);
  }

  // Split comma-separated values
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Parse a comma-separated list of integers
 *
 * @param value - Raw query parameter value
 * @param defaultValue - Default if missing
 * @returns Array of integers
 *
 * @example
 * const ids = getIntArrayParam(req.query.ids, []);
 * // ?ids=1,2,3 -> [1, 2, 3]
 */
export function getIntArrayParam(
  value: string | string[] | undefined,
  defaultValue: number[] = []
): number[] {
  const strArray = getArrayParam(value, []);

  if (strArray.length === 0) {
    return defaultValue;
  }

  return strArray
    .map((v) => parseInt(v, 10))
    .filter((n) => !isNaN(n));
}
