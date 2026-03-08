/**
 * ===============================================
 * UNIT TESTS - ENTITY MAPPER
 * ===============================================
 * @file tests/unit/server/entity-mapper.test.ts
 *
 * Tests for server/database/entity-mapper.ts — covers:
 * - snakeToCamel, camelToSnake
 * - extractValue (via transformRow) for all FieldTypes
 * - transformRow with a schema
 * - createMapper
 * - field() helper
 * - fields shorthand creators
 * - defineSchema
 * - definePartialSchema
 * - createPartialMapper
 */

import { describe, it, expect } from 'vitest';
import {
  snakeToCamel,
  camelToSnake,
  transformRow,
  createMapper,
  field,
  fields,
  defineSchema,
  definePartialSchema,
  createPartialMapper
} from '../../../server/database/entity-mapper';

// ============================================
// snakeToCamel
// ============================================

describe('snakeToCamel', () => {
  it('converts a simple snake_case string', () => {
    expect(snakeToCamel('first_name')).toBe('firstName');
  });

  it('converts multiple underscores', () => {
    expect(snakeToCamel('created_at_utc')).toBe('createdAtUtc');
  });

  it('leaves a camelCase string unchanged', () => {
    expect(snakeToCamel('alreadyCamel')).toBe('alreadyCamel');
  });

  it('handles a single word with no underscores', () => {
    expect(snakeToCamel('name')).toBe('name');
  });

  it('handles a string starting with an underscore', () => {
    // '_foo' → the regex /_([a-z])/ matches '_f' and replaces with 'F'
    expect(snakeToCamel('_foo')).toBe('Foo');
  });

  it('handles consecutive underscores', () => {
    // '__bar' → regex /_([a-z])/ matches '_b', the leading '_' is not matched
    // Result: '_Bar'
    expect(snakeToCamel('__bar')).toBe('_Bar');
  });

  it('converts id field', () => {
    expect(snakeToCamel('client_id')).toBe('clientId');
  });
});

// ============================================
// camelToSnake
// ============================================

describe('camelToSnake', () => {
  it('converts a simple camelCase string', () => {
    expect(camelToSnake('firstName')).toBe('first_name');
  });

  it('converts multiple uppercase letters', () => {
    expect(camelToSnake('createdAtUtc')).toBe('created_at_utc');
  });

  it('leaves a snake_case string unchanged', () => {
    expect(camelToSnake('first_name')).toBe('first_name');
  });

  it('handles a single word with no uppercase', () => {
    expect(camelToSnake('name')).toBe('name');
  });

  it('converts clientId correctly', () => {
    expect(camelToSnake('clientId')).toBe('client_id');
  });

  it('converts isActive correctly', () => {
    expect(camelToSnake('isActive')).toBe('is_active');
  });

  it('converts ID abbreviation', () => {
    expect(camelToSnake('projectID')).toBe('project_i_d');
  });
});

// ============================================
// transformRow with schema
// ============================================

describe('transformRow - string type', () => {
  it('extracts a string field', () => {
    const schema = { name: { column: 'name', type: 'string' as const } };
    const result = transformRow({ name: 'Alice' }, schema);
    expect(result.name).toBe('Alice');
  });

  it('returns empty string when string field is missing', () => {
    const schema = { name: { column: 'name', type: 'string' as const } };
    const result = transformRow({}, schema);
    expect(result.name).toBe('');
  });
});

describe('transformRow - string? type', () => {
  it('extracts a string when value is present', () => {
    const schema = { email: { column: 'email', type: 'string?' as const } };
    expect(transformRow({ email: 'a@b.com' }, schema).email).toBe('a@b.com');
  });

  it('returns null when value is null and default is null', () => {
    // When the column is present with null, getStringOrNull returns null,
    // then extractValue applies the default (null explicitly set).
    const schema = { email: { column: 'email', type: 'string?' as const, default: null } };
    expect(transformRow({ email: null }, schema).email).toBeNull();
  });

  it('returns undefined when column is absent and no default is set', () => {
    // getStringOrNull returns null for missing key, then extractValue sets value = defaultValue
    // which is undefined (not provided) → result is undefined
    const schema = { email: { column: 'email', type: 'string?' as const } };
    expect(transformRow({}, schema).email).toBeUndefined();
  });
});

describe('transformRow - number type', () => {
  it('extracts a number field', () => {
    const schema = { age: { column: 'age', type: 'number' as const } };
    expect(transformRow({ age: 25 }, schema).age).toBe(25);
  });

  it('returns 0 when number field is missing', () => {
    const schema = { age: { column: 'age', type: 'number' as const } };
    expect(transformRow({}, schema).age).toBe(0);
  });
});

describe('transformRow - number? type', () => {
  it('returns undefined when column is absent and no default set', () => {
    const schema = { parentId: { column: 'parent_id', type: 'number?' as const } };
    expect(transformRow({}, schema).parentId).toBeUndefined();
  });

  it('returns null when value is null and default is null', () => {
    const schema = { parentId: { column: 'parent_id', type: 'number?' as const, default: null } };
    expect(transformRow({ parent_id: null }, schema).parentId).toBeNull();
  });

  it('returns the number when present', () => {
    const schema = { parentId: { column: 'parent_id', type: 'number?' as const } };
    expect(transformRow({ parent_id: 5 }, schema).parentId).toBe(5);
  });
});

describe('transformRow - boolean type', () => {
  it('converts SQLite 1 to true', () => {
    const schema = { isActive: { column: 'is_active', type: 'boolean' as const } };
    expect(transformRow({ is_active: 1 }, schema).isActive).toBe(true);
  });

  it('converts SQLite 0 to false', () => {
    const schema = { isActive: { column: 'is_active', type: 'boolean' as const } };
    expect(transformRow({ is_active: 0 }, schema).isActive).toBe(false);
  });

  it('returns false when boolean field is missing', () => {
    const schema = { isActive: { column: 'is_active', type: 'boolean' as const } };
    expect(transformRow({}, schema).isActive).toBe(false);
  });
});

describe('transformRow - boolean? type', () => {
  it('returns undefined when boolean? column is absent and no default set', () => {
    const schema = { isVerified: { column: 'is_verified', type: 'boolean?' as const } };
    expect(transformRow({}, schema).isVerified).toBeUndefined();
  });

  it('returns null when value is null and default is null', () => {
    const schema = { isVerified: { column: 'is_verified', type: 'boolean?' as const, default: null } };
    expect(transformRow({ is_verified: null }, schema).isVerified).toBeNull();
  });

  it('returns true for integer 1', () => {
    const schema = { isVerified: { column: 'is_verified', type: 'boolean?' as const } };
    expect(transformRow({ is_verified: 1 }, schema).isVerified).toBe(true);
  });
});

describe('transformRow - float type', () => {
  it('extracts a float from a decimal string', () => {
    const schema = { amount: { column: 'amount', type: 'float' as const } };
    expect(transformRow({ amount: '9.99' }, schema).amount).toBeCloseTo(9.99);
  });

  it('extracts a float from a number', () => {
    const schema = { amount: { column: 'amount', type: 'float' as const } };
    expect(transformRow({ amount: 14.5 }, schema).amount).toBe(14.5);
  });

  it('returns 0 when float field is missing', () => {
    const schema = { amount: { column: 'amount', type: 'float' as const } };
    expect(transformRow({}, schema).amount).toBe(0);
  });
});

describe('transformRow - float? type', () => {
  it('returns undefined when float? column is absent and no default set', () => {
    const schema = { discount: { column: 'discount', type: 'float?' as const } };
    expect(transformRow({}, schema).discount).toBeUndefined();
  });

  it('returns null when value is null and default is null', () => {
    const schema = { discount: { column: 'discount', type: 'float?' as const, default: null } };
    expect(transformRow({ discount: null }, schema).discount).toBeNull();
  });

  it('parses a float string', () => {
    const schema = { discount: { column: 'discount', type: 'float?' as const } };
    expect(transformRow({ discount: '5.5' }, schema).discount).toBeCloseTo(5.5);
  });
});

describe('transformRow - json type', () => {
  it('parses a JSON string into an object', () => {
    const schema = { metadata: { column: 'metadata', type: 'json' as const, default: {} } };
    const result = transformRow({ metadata: '{"key":"val"}' }, schema);
    expect(result.metadata).toEqual({ key: 'val' });
  });

  it('uses default when JSON field is null', () => {
    const schema = { metadata: { column: 'metadata', type: 'json' as const, default: { empty: true } } };
    const result = transformRow({ metadata: null }, schema);
    expect(result.metadata).toEqual({ empty: true });
  });

  it('uses default {} when JSON field is missing and no custom default', () => {
    const schema = { metadata: { column: 'metadata', type: 'json' as const } };
    const result = transformRow({}, schema);
    expect(result.metadata).toEqual({});
  });

  it('uses default when JSON string is invalid', () => {
    const schema = { metadata: { column: 'metadata', type: 'json' as const, default: { fallback: true } } };
    const result = transformRow({ metadata: '{bad}' }, schema);
    expect(result.metadata).toEqual({ fallback: true });
  });

  it('passes through non-null non-string values directly', () => {
    const alreadyParsed = { foo: 'bar' };
    const schema = { metadata: { column: 'metadata', type: 'json' as const } };
    const result = transformRow({ metadata: alreadyParsed }, schema);
    expect(result.metadata).toBe(alreadyParsed);
  });
});

describe('transformRow - json? type', () => {
  it('parses a JSON string', () => {
    const schema = { config: { column: 'config', type: 'json?' as const } };
    const result = transformRow({ config: '["a","b"]' }, schema);
    expect(result.config).toEqual(['a', 'b']);
  });

  it('returns null from extractValue when field is null (json? sets value=null before default check)', () => {
    // json? branch: when rawValue is null, sets value = null.
    // Then extractValue checks (value === null || value === undefined) → sets value = defaultValue.
    // No default → value becomes undefined.
    const schema = { config: { column: 'config', type: 'json?' as const } };
    expect(transformRow({ config: null }, schema).config).toBeUndefined();
  });

  it('returns undefined when field is missing and no default', () => {
    const schema = { config: { column: 'config', type: 'json?' as const } };
    expect(transformRow({}, schema).config).toBeUndefined();
  });

  it('returns null for invalid JSON when json? sets value=null, then with explicit null default', () => {
    // json? invalid JSON → sets value = null → default override → undefined (no default set)
    const schema = { config: { column: 'config', type: 'json?' as const } };
    expect(transformRow({ config: '{bad' }, schema).config).toBeUndefined();
  });

  it('returns null for invalid JSON when default is explicitly null', () => {
    const schema = { config: { column: 'config', type: 'json?' as const, default: null } };
    expect(transformRow({ config: '{bad' }, schema).config).toBeNull();
  });

  it('passes through non-null non-string values', () => {
    const obj = { x: 1 };
    const schema = { config: { column: 'config', type: 'json?' as const } };
    expect(transformRow({ config: obj }, schema).config).toBe(obj);
  });
});

describe('transformRow - date type', () => {
  it('parses an ISO date string', () => {
    const schema = { createdAt: { column: 'created_at', type: 'date' as const } };
    const result = transformRow({ created_at: '2024-01-01T00:00:00Z' }, schema);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('uses current date (new Date()) when date field is missing', () => {
    const schema = { createdAt: { column: 'created_at', type: 'date' as const } };
    const before = Date.now();
    const result = transformRow({}, schema);
    const after = Date.now();
    const d = result.createdAt as Date;
    expect(d.getTime()).toBeGreaterThanOrEqual(before);
    expect(d.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('transformRow - date? type', () => {
  it('parses an ISO date string', () => {
    const schema = { deletedAt: { column: 'deleted_at', type: 'date?' as const } };
    const result = transformRow({ deleted_at: '2024-06-01T00:00:00Z' }, schema);
    expect(result.deletedAt).toBeInstanceOf(Date);
  });

  it('returns undefined when date? field is absent and no default is set', () => {
    // getDate returns null for missing key → extractValue sets value = defaultValue = undefined
    const schema = { deletedAt: { column: 'deleted_at', type: 'date?' as const } };
    expect(transformRow({}, schema).deletedAt).toBeUndefined();
  });

  it('returns null when date? field is absent and default is null', () => {
    const schema = { deletedAt: { column: 'deleted_at', type: 'date?' as const, default: null } };
    expect(transformRow({}, schema).deletedAt).toBeNull();
  });
});

describe('transformRow - default fallback', () => {
  it('applies default when extracted value is null', () => {
    const schema = {
      status: { column: 'status', type: 'string?' as const, default: 'pending' }
    };
    const result = transformRow({ status: null }, schema);
    expect(result.status).toBe('pending');
  });
});

describe('transformRow - custom transform function', () => {
  it('applies the transform function to the extracted value', () => {
    const schema = {
      name: {
        column: 'name',
        type: 'string' as const,
        transform: (v: unknown) => (typeof v === 'string' ? v.toUpperCase() : v)
      }
    };
    const result = transformRow({ name: 'alice' }, schema);
    expect(result.name).toBe('ALICE');
  });

  it('applies transform even when value comes from default', () => {
    const schema = {
      label: {
        column: 'label',
        type: 'string?' as const,
        default: 'default-label',
        transform: (v: unknown) => (typeof v === 'string' ? v.toUpperCase() : v)
      }
    };
    const result = transformRow({ label: null }, schema);
    expect(result.label).toBe('DEFAULT-LABEL');
  });
});

describe('transformRow - unknown type (fallback to raw)', () => {
  it('returns raw row value for an unrecognised type', () => {
    // Cast type to test the default branch
    const schema = {
      weird: { column: 'weird', type: 'unknown-type' as any }
    };
    const result = transformRow({ weird: 'raw-value' }, schema);
    expect(result.weird).toBe('raw-value');
  });
});

// ============================================
// createMapper
// ============================================

describe('createMapper', () => {
  it('returns a function that maps rows to entities', () => {
    const schema = {
      id: { column: 'id', type: 'number' as const },
      name: { column: 'name', type: 'string' as const }
    };
    const toEntity = createMapper<{ id: number; name: string }, { id: number; name: string }>(schema as any);
    const result = toEntity({ id: 1, name: 'Test' });
    expect(result).toEqual({ id: 1, name: 'Test' });
  });

  it('can be used with Array.map', () => {
    const schema = {
      id: { column: 'id', type: 'number' as const }
    };
    const toEntity = createMapper<{ id: number }, { id: number }>(schema as any);
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(rows.map(toEntity)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });
});

// ============================================
// field() helper
// ============================================

describe('field()', () => {
  it('returns a function that builds a FieldMapping', () => {
    const makeField = field('string');
    const mapping = makeField('firstName');
    expect(mapping.type).toBe('string');
    // Column derived from camelToSnake('firstName') = 'first_name'
    expect(mapping.column).toBe('first_name');
  });

  it('uses explicit column from options when provided', () => {
    const makeField = field('number', { column: 'custom_col' });
    const mapping = makeField('someField');
    expect(mapping.column).toBe('custom_col');
  });

  it('merges additional options into the mapping', () => {
    const makeField = field('string?', { default: 'fallback' });
    const mapping = makeField('description');
    expect(mapping.default).toBe('fallback');
    expect(mapping.type).toBe('string?');
  });
});

// ============================================
// fields shorthand creators
// ============================================

describe('fields shorthands', () => {
  it('fields.string() creates a string mapping', () => {
    const m = fields.string('my_col');
    expect(m.type).toBe('string');
    expect(m.column).toBe('my_col');
  });

  it('fields.string() uses empty string when no column given', () => {
    expect(fields.string().column).toBe('');
  });

  it('fields.stringOrNull() creates a string? mapping', () => {
    expect(fields.stringOrNull('col').type).toBe('string?');
  });

  it('fields.number() creates a number mapping', () => {
    expect(fields.number('col').type).toBe('number');
  });

  it('fields.numberOrNull() creates a number? mapping', () => {
    expect(fields.numberOrNull('col').type).toBe('number?');
  });

  it('fields.boolean() creates a boolean mapping', () => {
    expect(fields.boolean('col').type).toBe('boolean');
  });

  it('fields.booleanOrNull() creates a boolean? mapping', () => {
    expect(fields.booleanOrNull('col').type).toBe('boolean?');
  });

  it('fields.float() creates a float mapping', () => {
    expect(fields.float('col').type).toBe('float');
  });

  it('fields.floatOrNull() creates a float? mapping', () => {
    expect(fields.floatOrNull('col').type).toBe('float?');
  });

  it('fields.json() creates a json mapping with default {}', () => {
    const m = fields.json('col');
    expect(m.type).toBe('json');
    expect(m.default).toEqual({});
  });

  it('fields.json() uses custom default when provided', () => {
    const m = fields.json('col', []);
    expect(m.default).toEqual([]);
  });

  it('fields.jsonOrNull() creates a json? mapping', () => {
    expect(fields.jsonOrNull('col').type).toBe('json?');
  });

  it('fields.date() creates a date mapping', () => {
    expect(fields.date('col').type).toBe('date');
  });

  it('fields.dateOrNull() creates a date? mapping', () => {
    expect(fields.dateOrNull('col').type).toBe('date?');
  });
});

// ============================================
// defineSchema
// ============================================

describe('defineSchema', () => {
  it('derives column names from camelCase keys', () => {
    interface TestEntity {
      id: number;
      clientId: number;
      createdAt: string;
    }

    const schema = defineSchema<TestEntity>({
      id: 'number',
      clientId: 'number',
      createdAt: 'string'
    });

    expect(schema.id.column).toBe('id');
    expect(schema.clientId.column).toBe('client_id');
    expect(schema.createdAt.column).toBe('created_at');
  });

  it('sets the correct types from string shorthand', () => {
    interface TestEntity {
      name: string;
      active: boolean;
    }

    const schema = defineSchema<TestEntity>({
      name: 'string',
      active: 'boolean'
    });

    expect(schema.name.type).toBe('string');
    expect(schema.active.type).toBe('boolean');
  });

  it('uses column from full FieldMapping when provided', () => {
    interface TestEntity {
      id: number;
      name: string;
    }

    const schema = defineSchema<TestEntity>({
      id: 'number',
      name: { column: 'display_name', type: 'string' }
    });

    expect(schema.name.column).toBe('display_name');
  });

  it('derives column from key when FieldMapping has empty column', () => {
    interface TestEntity {
      clientId: number;
    }

    const schema = defineSchema<TestEntity>({
      clientId: { column: '', type: 'number' }
    });

    // column is '' (falsy) → falls back to camelToSnake('clientId') = 'client_id'
    expect(schema.clientId.column).toBe('client_id');
  });

  it('produces a schema that can map a real row', () => {
    interface Contact {
      id: number;
      firstName: string;
      isActive: boolean;
    }

    const schema = defineSchema<Contact>({
      id: 'number',
      firstName: 'string',
      isActive: 'boolean'
    });

    const row = { id: 1, first_name: 'John', is_active: 1 };
    const result = transformRow(row, schema);
    expect(result.id).toBe(1);
    expect(result.firstName).toBe('John');
    expect(result.isActive).toBe(true);
  });
});

// ============================================
// definePartialSchema
// ============================================

describe('definePartialSchema', () => {
  it('builds a schema for a subset of entity fields', () => {
    interface FullEntity {
      id: number;
      name: string;
      computedField?: string;
    }

    const schema = definePartialSchema<FullEntity>()({
      id: 'number',
      name: 'string'
    });

    expect(schema.id.column).toBe('id');
    expect(schema.name.column).toBe('name');
    expect(schema).not.toHaveProperty('computedField');
  });

  it('derives column from camelCase key', () => {
    interface Entity {
      createdAt: string;
    }

    const schema = definePartialSchema<Entity>()({
      createdAt: 'string'
    });

    expect(schema.createdAt.column).toBe('created_at');
  });

  it('uses column from full FieldMapping when provided', () => {
    interface Entity {
      name: string;
    }

    const schema = definePartialSchema<Entity>()({
      name: { column: 'display_name', type: 'string' }
    });

    expect(schema.name.column).toBe('display_name');
  });

  it('falls back to camelToSnake key when FieldMapping column is empty', () => {
    interface Entity {
      clientId: number;
    }

    const schema = definePartialSchema<Entity>()({
      clientId: { column: '', type: 'number' }
    });

    expect(schema.clientId.column).toBe('client_id');
  });
});

// ============================================
// createPartialMapper
// ============================================

describe('createPartialMapper', () => {
  it('maps a database row to a partial entity', () => {
    interface FullEntity {
      id: number;
      name: string;
      computedScore?: number;
    }

    type PartialEntity = Pick<FullEntity, 'id' | 'name'>;

    const schema = definePartialSchema<FullEntity>()({
      id: 'number',
      name: 'string'
    });

    const mapper = createPartialMapper<{ id: number; name: string }, FullEntity, PartialEntity>(schema);
    const result = mapper({ id: 5, name: 'Alice' });

    expect(result.id).toBe(5);
    expect(result.name).toBe('Alice');
    expect((result as any).computedScore).toBeUndefined();
  });

  it('can be applied via Array.map', () => {
    interface Entity {
      id: number;
      title: string;
    }

    const schema = definePartialSchema<Entity>()({
      id: 'number',
      title: 'string'
    });

    const mapper = createPartialMapper<{ id: number; title: string }, Entity, Pick<Entity, 'id' | 'title'>>(schema);

    const rows = [
      { id: 1, title: 'First' },
      { id: 2, title: 'Second' }
    ];

    const results = rows.map(mapper);
    expect(results[0]).toEqual({ id: 1, title: 'First' });
    expect(results[1]).toEqual({ id: 2, title: 'Second' });
  });
});
