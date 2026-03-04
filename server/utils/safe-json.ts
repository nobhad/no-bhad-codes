/**
 * Safe JSON parsing utilities
 * Provides try-catch wrapped JSON.parse functions to prevent crashes from malformed data
 */

import { logger } from '../services/logger.js';

/**
 * Safely parse JSON string with fallback value
 * @param value - The string to parse
 * @param fallback - Default value if parsing fails
 * @param context - Optional context for logging (e.g., 'webhook headers', 'user settings')
 * @returns Parsed value or fallback
 */
export function safeJsonParse<T>(
  value: string | null | undefined,
  fallback: T,
  context?: string
): T {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    if (context) {
      logger.warn(`[SafeJSON] Failed to parse ${context}`, {
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
          valuePreview: value.substring(0, 100)
        }
      });
    }
    return fallback;
  }
}

/**
 * Safely parse JSON with explicit null on failure (no fallback)
 * Use when you need to know if parsing failed
 * @param value - The string to parse
 * @param context - Optional context for logging
 * @returns Parsed value or null
 */
export function safeJsonParseOrNull<T>(
  value: string | null | undefined,
  context?: string
): T | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    if (context) {
      logger.warn(`[SafeJSON] Failed to parse ${context}`, {
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
          valuePreview: value.substring(0, 100)
        }
      });
    }
    return null;
  }
}

/**
 * Parse JSON array safely, always returns an array
 * @param value - The string to parse
 * @param context - Optional context for logging
 * @returns Parsed array or empty array
 */
export function safeJsonParseArray<T>(
  value: string | null | undefined,
  context?: string
): T[] {
  const result = safeJsonParse<T[]>(value, [], context);
  return Array.isArray(result) ? result : [];
}

/**
 * Parse JSON object safely, always returns an object
 * @param value - The string to parse
 * @param context - Optional context for logging
 * @returns Parsed object or empty object
 */
export function safeJsonParseObject<T extends Record<string, unknown>>(
  value: string | null | undefined,
  context?: string
): T {
  const result = safeJsonParse<T>(value, {} as T, context);
  return typeof result === 'object' && result !== null && !Array.isArray(result)
    ? result
    : ({} as T);
}

/**
 * Handle values that might already be parsed (common with ORM results)
 * @param value - String or already-parsed value
 * @param fallback - Default value if parsing fails
 * @param context - Optional context for logging
 * @returns Parsed value or fallback
 */
export function parseIfString<T>(
  value: string | T | null | undefined,
  fallback: T,
  context?: string
): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    return safeJsonParse<T>(value, fallback, context);
  }

  return value;
}
