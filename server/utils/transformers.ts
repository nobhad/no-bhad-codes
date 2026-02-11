/**
 * ===============================================
 * DATA TRANSFORMERS
 * ===============================================
 * @file server/utils/transformers.ts
 *
 * Utilities for transforming data between camelCase
 * (backend) and snake_case (frontend/database).
 */

/**
 * Convert camelCase string to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case string to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert object keys from camelCase to snake_case
 */
export function toSnakeCase<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[snakeKey] = toSnakeCase(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? toSnakeCase(item as Record<string, unknown>)
          : item
      );
    } else {
      result[snakeKey] = value;
    }
  }

  return result;
}

/**
 * Convert object keys from snake_case to camelCase
 */
export function toCamelCase<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[camelKey] = toCamelCase(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? toCamelCase(item as Record<string, unknown>)
          : item
      );
    } else {
      result[camelKey] = value;
    }
  }

  return result as T;
}

/**
 * Convert array of objects to snake_case
 */
export function arrayToSnakeCase<T extends Record<string, unknown>>(
  arr: T[]
): Record<string, unknown>[] {
  return arr.map((item) => toSnakeCase(item));
}

/**
 * Convert array of objects to camelCase
 */
export function arrayToCamelCase<T>(arr: Record<string, unknown>[]): T[] {
  return arr.map((item) => toCamelCase<T>(item));
}

/**
 * Pick specific fields from object and convert to snake_case
 */
export function pickAndTransform<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};

  for (const field of fields) {
    if (field in obj) {
      const snakeKey = camelToSnake(field as string);
      picked[snakeKey] = obj[field];
    }
  }

  return picked;
}

/**
 * Omit specific fields from object and convert to snake_case
 */
export function omitAndTransform<T extends Record<string, unknown>>(
  obj: T,
  fieldsToOmit: (keyof T)[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const omitSet = new Set(fieldsToOmit as string[]);

  for (const [key, value] of Object.entries(obj)) {
    if (!omitSet.has(key)) {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = value;
    }
  }

  return result;
}
