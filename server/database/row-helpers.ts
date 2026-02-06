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
