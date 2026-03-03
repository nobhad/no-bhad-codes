/**
 * ===============================================
 * ENTITY MAPPER - DATA ACCESS LAYER
 * ===============================================
 * @file server/database/entity-mapper.ts
 *
 * Generic entity mapping utilities for transforming database rows
 * (snake_case) to TypeScript entities (camelCase).
 *
 * Leverages existing row-helpers.ts utilities for type-safe extraction.
 */

import type { DatabaseRow } from './init.js';
import {
  getString,
  getStringOrNull,
  getNumber,
  getNumberOrNull,
  getBoolean,
  getBooleanOrNull,
  getFloat,
  getFloatOrNull,
  getDate,
} from './row-helpers.js';

/**
 * Convert snake_case string to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase string to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Field type definitions for schema mapping
 */
export type FieldType =
  | 'string'
  | 'string?'
  | 'number'
  | 'number?'
  | 'boolean'
  | 'boolean?'
  | 'json'
  | 'json?'
  | 'date'
  | 'date?'
  | 'float'
  | 'float?';

/**
 * Field mapping configuration
 */
export interface FieldMapping {
  /** Database column name (snake_case) */
  column: string;
  /** Field type for transformation */
  type: FieldType;
  /** Default value if field is missing/null */
  default?: unknown;
  /** Custom transform function */
  transform?: (value: unknown) => unknown;
}

/**
 * Entity schema definition - maps entity fields to database columns
 */
export type EntitySchema<T> = {
  [K in keyof T]: FieldMapping;
};

/**
 * Extract value from database row based on field mapping
 */
function extractValue(row: DatabaseRow, mapping: FieldMapping): unknown {
  const { column, type, default: defaultValue, transform } = mapping;

  let value: unknown;

  switch (type) {
    case 'string':
      value = getString(row, column);
      break;
    case 'string?':
      value = getStringOrNull(row, column);
      break;
    case 'number':
      value = getNumber(row, column);
      break;
    case 'number?':
      value = getNumberOrNull(row, column);
      break;
    case 'boolean':
      value = getBoolean(row, column);
      break;
    case 'boolean?':
      value = getBooleanOrNull(row, column);
      break;
    case 'float':
      value = getFloat(row, column);
      break;
    case 'float?':
      value = getFloatOrNull(row, column);
      break;
    case 'json':
      {
        const rawValue = row[column];
        if (typeof rawValue === 'string') {
          try {
            value = JSON.parse(rawValue);
          } catch {
            value = defaultValue ?? {};
          }
        } else if (rawValue != null) {
          value = rawValue;
        } else {
          value = defaultValue ?? {};
        }
      }
      break;
    case 'json?':
      {
        const rawValue = row[column];
        if (typeof rawValue === 'string') {
          try {
            value = JSON.parse(rawValue);
          } catch {
            value = null;
          }
        } else if (rawValue != null) {
          value = rawValue;
        } else {
          value = null;
        }
      }
      break;
    case 'date':
      value = getDate(row, column) ?? new Date();
      break;
    case 'date?':
      value = getDate(row, column);
      break;
    default:
      value = row[column];
  }

  // Apply default if value is null/undefined
  if (value === null || value === undefined) {
    value = defaultValue;
  }

  // Apply custom transform if provided
  if (transform) {
    value = transform(value);
  }

  return value;
}

/**
 * Transform a database row using an entity schema
 */
export function transformRow<T>(row: DatabaseRow, schema: EntitySchema<T>): T {
  const result: Record<string, unknown> = {};

  for (const [key, mapping] of Object.entries(schema) as [string, FieldMapping][]) {
    result[key] = extractValue(row, mapping);
  }

  return result as T;
}

/**
 * Create a reusable mapper function from a schema
 *
 * @example
 * ```typescript
 * const toContact = createMapper<ContactRow, ClientContact>(clientContactSchema);
 * const contacts = rows.map(toContact);
 * ```
 */
export function createMapper<TRow extends DatabaseRow, TEntity>(
  schema: EntitySchema<TEntity>
): (row: TRow) => TEntity {
  return (row: TRow) => transformRow<TEntity>(row, schema);
}

/**
 * Helper to create a simple field mapping
 * Uses convention: camelCase field name → snake_case column name
 */
export function field(
  type: FieldType,
  options?: Partial<FieldMapping>
): (fieldName: string) => FieldMapping {
  return (fieldName: string) => ({
    column: options?.column ?? camelToSnake(fieldName),
    type,
    ...options,
  });
}

/**
 * Shorthand field creators
 */
export const fields = {
  /** Required string field */
  string: (column?: string) => ({ column: column ?? '', type: 'string' as const }),
  /** Optional string field */
  stringOrNull: (column?: string) => ({ column: column ?? '', type: 'string?' as const }),
  /** Required number field */
  number: (column?: string) => ({ column: column ?? '', type: 'number' as const }),
  /** Optional number field */
  numberOrNull: (column?: string) => ({ column: column ?? '', type: 'number?' as const }),
  /** Required boolean field (handles SQLite 0/1) */
  boolean: (column?: string) => ({ column: column ?? '', type: 'boolean' as const }),
  /** Optional boolean field */
  booleanOrNull: (column?: string) => ({ column: column ?? '', type: 'boolean?' as const }),
  /** Required float field (handles string → number conversion) */
  float: (column?: string) => ({ column: column ?? '', type: 'float' as const }),
  /** Optional float field */
  floatOrNull: (column?: string) => ({ column: column ?? '', type: 'float?' as const }),
  /** Required JSON field */
  json: (column?: string, defaultValue?: unknown) => ({
    column: column ?? '',
    type: 'json' as const,
    default: defaultValue ?? {},
  }),
  /** Optional JSON field */
  jsonOrNull: (column?: string) => ({ column: column ?? '', type: 'json?' as const }),
  /** Required date field */
  date: (column?: string) => ({ column: column ?? '', type: 'date' as const }),
  /** Optional date field */
  dateOrNull: (column?: string) => ({ column: column ?? '', type: 'date?' as const }),
};

/**
 * Schema builder helper for cleaner schema definition
 *
 * @example
 * ```typescript
 * const schema = defineSchema<ClientContact>({
 *   id: 'number',
 *   clientId: 'number',
 *   firstName: 'string',
 *   lastName: 'string',
 *   email: 'string?',
 *   isPrimary: 'boolean',
 *   createdAt: 'string',
 * });
 * ```
 */
export function defineSchema<T>(
  definition: Record<keyof T, FieldType | FieldMapping>
): EntitySchema<T> {
  const schema: Record<string, FieldMapping> = {};

  for (const [key, value] of Object.entries(definition)) {
    if (typeof value === 'string') {
      // It's just a type, derive column name from key
      schema[key] = {
        column: camelToSnake(key),
        type: value as FieldType,
      };
    } else {
      // It's a full FieldMapping, use column from mapping or derive from key
      const mapping = value as FieldMapping;
      schema[key] = {
        ...mapping,
        column: mapping.column || camelToSnake(key),
      };
    }
  }

  return schema as EntitySchema<T>;
}

/**
 * Partial schema builder for entities with computed fields.
 * Only maps the fields that come from the database.
 * Use this when the entity type has additional optional/computed fields
 * that are added after the database mapping.
 *
 * @example
 * ```typescript
 * // ProjectTask has subtasks, dependencies, etc. that are computed
 * const schema = definePartialSchema<ProjectTask>()({
 *   id: 'number',
 *   projectId: 'number',
 *   title: 'string',
 *   // ... only database fields
 * });
 * ```
 */
export function definePartialSchema<T>() {
  return <K extends keyof T>(
    definition: Record<K, FieldType | FieldMapping>
  ): EntitySchema<Pick<T, K>> => {
    const schema: Record<string, FieldMapping> = {};

    for (const [key, value] of Object.entries(definition)) {
      if (typeof value === 'string') {
        schema[key] = {
          column: camelToSnake(key),
          type: value as FieldType,
        };
      } else {
        const mapping = value as FieldMapping;
        schema[key] = {
          ...mapping,
          column: mapping.column || camelToSnake(key),
        };
      }
    }

    return schema as EntitySchema<Pick<T, K>>;
  };
}

/**
 * Create a mapper that returns a partial entity.
 * Useful for entities with computed fields that need to be added after mapping.
 */
export function createPartialMapper<
  TRow extends DatabaseRow,
  TEntity,
  TPartial extends Partial<TEntity>,
>(schema: EntitySchema<TPartial>): (row: TRow) => TPartial {
  return (row: TRow) => transformRow<TPartial>(row, schema);
}
