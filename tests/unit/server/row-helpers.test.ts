/**
 * ===============================================
 * UNIT TESTS - DATABASE ROW HELPERS
 * ===============================================
 * @file tests/unit/server/row-helpers.test.ts
 *
 * Tests for server/database/row-helpers.ts — covers:
 * - getString, getStringOrNull
 * - getNumber, getNumberOrNull
 * - getFloat, getFloatOrNull
 * - getBoolean, getBooleanOrNull
 * - getUnknown
 * - isString, isNumber, isBoolean (type guards)
 * - getDate
 * - transformRow, transformRows, transformData
 */

import { describe, it, expect } from 'vitest';
import {
  getString,
  getStringOrNull,
  getNumber,
  getNumberOrNull,
  getFloat,
  getFloatOrNull,
  getBoolean,
  getBooleanOrNull,
  getUnknown,
  isString,
  isNumber,
  isBoolean,
  getDate,
  transformRow,
  transformRows,
  transformData
} from '../../../server/database/row-helpers';

// ============================================
// getString
// ============================================

describe('getString', () => {
  it('returns empty string when row is undefined', () => {
    expect(getString(undefined, 'name')).toBe('');
  });

  it('returns empty string when key is missing from row', () => {
    expect(getString({ other: 'value' }, 'name')).toBe('');
  });

  it('returns the string value when it is a string', () => {
    expect(getString({ name: 'Alice' }, 'name')).toBe('Alice');
  });

  it('returns empty string when value is a number', () => {
    expect(getString({ name: 42 }, 'name')).toBe('');
  });

  it('returns empty string when value is null', () => {
    expect(getString({ name: null }, 'name')).toBe('');
  });

  it('returns empty string when value is a boolean', () => {
    expect(getString({ name: true }, 'name')).toBe('');
  });

  it('returns empty string for empty string value in row', () => {
    expect(getString({ name: '' }, 'name')).toBe('');
  });
});

// ============================================
// getStringOrNull
// ============================================

describe('getStringOrNull', () => {
  it('returns null when row is undefined', () => {
    expect(getStringOrNull(undefined, 'name')).toBeNull();
  });

  it('returns null when key is missing from row', () => {
    expect(getStringOrNull({ other: 'x' }, 'name')).toBeNull();
  });

  it('returns null when value is null', () => {
    expect(getStringOrNull({ name: null }, 'name')).toBeNull();
  });

  it('returns null when value is undefined', () => {
    expect(getStringOrNull({ name: undefined }, 'name')).toBeNull();
  });

  it('returns the string when value is a string', () => {
    expect(getStringOrNull({ name: 'Bob' }, 'name')).toBe('Bob');
  });

  it('returns null when value is a number (not a string)', () => {
    expect(getStringOrNull({ name: 123 }, 'name')).toBeNull();
  });

  it('returns null when value is a boolean', () => {
    expect(getStringOrNull({ name: false }, 'name')).toBeNull();
  });

  it('returns empty string when value is an empty string', () => {
    expect(getStringOrNull({ name: '' }, 'name')).toBe('');
  });
});

// ============================================
// getNumber
// ============================================

describe('getNumber', () => {
  it('returns 0 when row is undefined', () => {
    expect(getNumber(undefined, 'count')).toBe(0);
  });

  it('returns 0 when key is missing', () => {
    expect(getNumber({ other: 1 }, 'count')).toBe(0);
  });

  it('returns the number value', () => {
    expect(getNumber({ count: 7 }, 'count')).toBe(7);
  });

  it('returns 0 when value is a string', () => {
    expect(getNumber({ count: '5' }, 'count')).toBe(0);
  });

  it('returns 0 when value is null', () => {
    expect(getNumber({ count: null }, 'count')).toBe(0);
  });

  it('returns 0 when value is a boolean', () => {
    expect(getNumber({ count: true }, 'count')).toBe(0);
  });

  it('returns negative number correctly', () => {
    expect(getNumber({ count: -99 }, 'count')).toBe(-99);
  });

  it('returns float number correctly (no truncation)', () => {
    expect(getNumber({ count: 3.14 }, 'count')).toBe(3.14);
  });
});

// ============================================
// getNumberOrNull
// ============================================

describe('getNumberOrNull', () => {
  it('returns null when row is undefined', () => {
    expect(getNumberOrNull(undefined, 'id')).toBeNull();
  });

  it('returns null when key is missing', () => {
    expect(getNumberOrNull({ other: 1 }, 'id')).toBeNull();
  });

  it('returns null when value is null', () => {
    expect(getNumberOrNull({ id: null }, 'id')).toBeNull();
  });

  it('returns null when value is undefined', () => {
    expect(getNumberOrNull({ id: undefined }, 'id')).toBeNull();
  });

  it('returns the number when value is a number', () => {
    expect(getNumberOrNull({ id: 42 }, 'id')).toBe(42);
  });

  it('returns null when value is a string', () => {
    expect(getNumberOrNull({ id: '42' }, 'id')).toBeNull();
  });

  it('returns 0 as a valid number (not null)', () => {
    expect(getNumberOrNull({ id: 0 }, 'id')).toBe(0);
  });
});

// ============================================
// getFloat
// ============================================

describe('getFloat', () => {
  it('returns 0 when row is undefined', () => {
    expect(getFloat(undefined, 'amount')).toBe(0);
  });

  it('returns 0 when key is missing', () => {
    expect(getFloat({ other: 1 }, 'amount')).toBe(0);
  });

  it('returns 0 when value is null', () => {
    expect(getFloat({ amount: null }, 'amount')).toBe(0);
  });

  it('returns 0 when value is undefined', () => {
    expect(getFloat({ amount: undefined }, 'amount')).toBe(0);
  });

  it('returns number value directly when it is already a number', () => {
    expect(getFloat({ amount: 9.99 }, 'amount')).toBe(9.99);
  });

  it('parses a valid decimal string', () => {
    expect(getFloat({ amount: '12.50' }, 'amount')).toBeCloseTo(12.5);
  });

  it('parses an integer string', () => {
    expect(getFloat({ amount: '100' }, 'amount')).toBe(100);
  });

  it('returns 0 for a non-numeric string', () => {
    expect(getFloat({ amount: 'bad' }, 'amount')).toBe(0);
  });

  it('returns 0 for an object value', () => {
    expect(getFloat({ amount: {} }, 'amount')).toBe(0);
  });

  it('parses negative decimal string', () => {
    expect(getFloat({ amount: '-5.75' }, 'amount')).toBeCloseTo(-5.75);
  });
});

// ============================================
// getFloatOrNull
// ============================================

describe('getFloatOrNull', () => {
  it('returns null when row is undefined', () => {
    expect(getFloatOrNull(undefined, 'amount')).toBeNull();
  });

  it('returns null when key is missing', () => {
    expect(getFloatOrNull({ other: 1 }, 'amount')).toBeNull();
  });

  it('returns null when value is null', () => {
    expect(getFloatOrNull({ amount: null }, 'amount')).toBeNull();
  });

  it('returns null when value is undefined', () => {
    expect(getFloatOrNull({ amount: undefined }, 'amount')).toBeNull();
  });

  it('returns number when value is a number', () => {
    expect(getFloatOrNull({ amount: 19.99 }, 'amount')).toBe(19.99);
  });

  it('parses a valid decimal string', () => {
    expect(getFloatOrNull({ amount: '7.5' }, 'amount')).toBeCloseTo(7.5);
  });

  it('returns null for a non-numeric string', () => {
    expect(getFloatOrNull({ amount: 'bad' }, 'amount')).toBeNull();
  });

  it('returns 0 as a valid number (not null)', () => {
    expect(getFloatOrNull({ amount: 0 }, 'amount')).toBe(0);
  });

  it('returns null for an object value', () => {
    expect(getFloatOrNull({ amount: {} }, 'amount')).toBeNull();
  });
});

// ============================================
// getBoolean
// ============================================

describe('getBoolean', () => {
  it('returns false when row is undefined', () => {
    expect(getBoolean(undefined, 'active')).toBe(false);
  });

  it('returns false when key is missing', () => {
    expect(getBoolean({ other: 1 }, 'active')).toBe(false);
  });

  it('returns native boolean true', () => {
    expect(getBoolean({ active: true }, 'active')).toBe(true);
  });

  it('returns native boolean false', () => {
    expect(getBoolean({ active: false }, 'active')).toBe(false);
  });

  it('converts SQLite integer 1 to true', () => {
    expect(getBoolean({ active: 1 }, 'active')).toBe(true);
  });

  it('converts SQLite integer 0 to false', () => {
    expect(getBoolean({ active: 0 }, 'active')).toBe(false);
  });

  it('converts non-zero integer to true', () => {
    expect(getBoolean({ active: 5 }, 'active')).toBe(true);
  });

  it('returns Boolean() of truthy string', () => {
    expect(getBoolean({ active: 'yes' }, 'active')).toBe(true);
  });

  it('returns false for null via Boolean(null)', () => {
    expect(getBoolean({ active: null }, 'active')).toBe(false);
  });

  it('returns false for empty string via Boolean("")', () => {
    expect(getBoolean({ active: '' }, 'active')).toBe(false);
  });
});

// ============================================
// getBooleanOrNull
// ============================================

describe('getBooleanOrNull', () => {
  it('returns null when row is undefined', () => {
    expect(getBooleanOrNull(undefined, 'active')).toBeNull();
  });

  it('returns null when key is missing', () => {
    expect(getBooleanOrNull({ other: 1 }, 'active')).toBeNull();
  });

  it('returns null when value is null', () => {
    expect(getBooleanOrNull({ active: null }, 'active')).toBeNull();
  });

  it('returns null when value is undefined', () => {
    expect(getBooleanOrNull({ active: undefined }, 'active')).toBeNull();
  });

  it('returns native boolean true', () => {
    expect(getBooleanOrNull({ active: true }, 'active')).toBe(true);
  });

  it('returns native boolean false', () => {
    expect(getBooleanOrNull({ active: false }, 'active')).toBe(false);
  });

  it('converts integer 1 to true', () => {
    expect(getBooleanOrNull({ active: 1 }, 'active')).toBe(true);
  });

  it('converts integer 0 to false', () => {
    expect(getBooleanOrNull({ active: 0 }, 'active')).toBe(false);
  });

  it('returns null for a string value (not boolean or number)', () => {
    expect(getBooleanOrNull({ active: 'true' }, 'active')).toBeNull();
  });
});

// ============================================
// getUnknown
// ============================================

describe('getUnknown', () => {
  it('returns null when row is undefined', () => {
    expect(getUnknown(undefined, 'data')).toBeNull();
  });

  it('returns null when key is missing', () => {
    expect(getUnknown({ other: 1 }, 'data')).toBeNull();
  });

  it('returns the raw value (string)', () => {
    expect(getUnknown({ data: 'hello' }, 'data')).toBe('hello');
  });

  it('returns the raw value (number)', () => {
    expect(getUnknown({ data: 42 }, 'data')).toBe(42);
  });

  it('returns the raw value (null)', () => {
    expect(getUnknown({ data: null }, 'data')).toBeNull();
  });

  it('returns the raw value (object)', () => {
    const obj = { nested: true };
    expect(getUnknown({ data: obj }, 'data')).toBe(obj);
  });

  it('returns the raw value (array)', () => {
    const arr = [1, 2, 3];
    expect(getUnknown({ data: arr }, 'data')).toBe(arr);
  });
});

// ============================================
// Type guards
// ============================================

describe('isString', () => {
  it('returns true for string values', () => {
    expect(isString('hello')).toBe(true);
    expect(isString('')).toBe(true);
  });

  it('returns false for non-string values', () => {
    expect(isString(42)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
    expect(isString(true)).toBe(false);
    expect(isString({})).toBe(false);
  });
});

describe('isNumber', () => {
  it('returns true for number values', () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(3.14)).toBe(true);
    expect(isNumber(-1)).toBe(true);
    expect(isNumber(NaN)).toBe(true); // NaN is typeof 'number'
  });

  it('returns false for non-number values', () => {
    expect(isNumber('42')).toBe(false);
    expect(isNumber(null)).toBe(false);
    expect(isNumber(undefined)).toBe(false);
    expect(isNumber(true)).toBe(false);
  });
});

describe('isBoolean', () => {
  it('returns true for boolean values', () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
  });

  it('returns false for non-boolean values', () => {
    expect(isBoolean(0)).toBe(false);
    expect(isBoolean(1)).toBe(false);
    expect(isBoolean('true')).toBe(false);
    expect(isBoolean(null)).toBe(false);
    expect(isBoolean(undefined)).toBe(false);
  });
});

// ============================================
// getDate
// ============================================

describe('getDate', () => {
  it('returns null when row is undefined', () => {
    expect(getDate(undefined, 'created_at')).toBeNull();
  });

  it('returns null when key is missing', () => {
    expect(getDate({ other: '2024-01-01' }, 'created_at')).toBeNull();
  });

  it('returns null when value is null', () => {
    expect(getDate({ created_at: null }, 'created_at')).toBeNull();
  });

  it('returns null when value is undefined', () => {
    expect(getDate({ created_at: undefined }, 'created_at')).toBeNull();
  });

  it('returns the Date instance when value is already a Date', () => {
    const d = new Date('2024-01-15');
    expect(getDate({ created_at: d }, 'created_at')).toBe(d);
  });

  it('parses an ISO string into a Date', () => {
    const result = getDate({ created_at: '2024-06-01T12:00:00Z' }, 'created_at');
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe('2024-06-01T12:00:00.000Z');
  });

  it('returns null for an invalid date string', () => {
    expect(getDate({ created_at: 'not-a-date' }, 'created_at')).toBeNull();
  });

  it('converts a numeric timestamp to a Date', () => {
    const ts = 1700000000000;
    const result = getDate({ created_at: ts }, 'created_at');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(ts);
  });

  it('returns null for other value types (object)', () => {
    expect(getDate({ created_at: {} }, 'created_at')).toBeNull();
  });
});

// ============================================
// transformRow
// ============================================

describe('transformRow', () => {
  it('returns null for null input', () => {
    expect(transformRow(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(transformRow(undefined)).toBeNull();
  });

  it('passes through non-boolean, non-JSON fields unchanged', () => {
    const row = { id: 1, name: 'Test', status: 'active' };
    const result = transformRow(row);
    expect(result).toEqual({ id: 1, name: 'Test', status: 'active' });
  });

  it('converts known boolean field from 1 to true', () => {
    const row = { id: 1, is_active: 1 };
    const result = transformRow(row);
    expect(result!.is_active).toBe(true);
  });

  it('converts known boolean field from 0 to false', () => {
    const row = { id: 1, is_active: 0 };
    const result = transformRow(row);
    expect(result!.is_active).toBe(false);
  });

  it('does not convert unknown field that happens to be a number', () => {
    const row = { id: 1, score: 1 };
    const result = transformRow(row);
    // 'score' is not in BOOLEAN_FIELDS, stays as number
    expect(result!.score).toBe(1);
  });

  it('parses known JSON field from a string', () => {
    const row = { id: 1, metadata: '{"key":"value"}' };
    const result = transformRow(row);
    expect(result!.metadata).toEqual({ key: 'value' });
  });

  it('leaves known JSON field as-is when it is already an object', () => {
    const row = { id: 1, metadata: { key: 'value' } };
    const result = transformRow(row);
    expect(result!.metadata).toEqual({ key: 'value' });
  });

  it('returns original string for known JSON field with invalid JSON', () => {
    const row = { id: 1, metadata: '{broken json' };
    const result = transformRow(row);
    expect(result!.metadata).toBe('{broken json');
  });

  it('preserves null values in the result', () => {
    const row = { id: 1, description: null };
    const result = transformRow(row);
    expect(result!.description).toBeNull();
  });

  it('handles camelCase boolean field names (isActive)', () => {
    const row = { id: 1, isActive: 1 };
    const result = transformRow(row);
    expect(result!.isActive).toBe(true);
  });

  it('handles camelCase JSON field names (lineItems)', () => {
    const row = { id: 1, lineItems: '[{"qty":1}]' };
    const result = transformRow(row);
    expect(result!.lineItems).toEqual([{ qty: 1 }]);
  });

  it('converts multiple boolean fields in one row', () => {
    const row = { is_active: 1, is_admin: 0, is_verified: 1 };
    const result = transformRow(row);
    expect(result!.is_active).toBe(true);
    expect(result!.is_admin).toBe(false);
    expect(result!.is_verified).toBe(true);
  });

  it('does not convert boolean field that is already a native boolean', () => {
    // If the number check only applies to numbers, a native true stays true
    const row = { is_active: true };
    const result = transformRow(row);
    expect(result!.is_active).toBe(true);
  });
});

// ============================================
// transformRows
// ============================================

describe('transformRows', () => {
  it('returns empty array for null input', () => {
    expect(transformRows(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(transformRows(undefined)).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    expect(transformRows([])).toEqual([]);
  });

  it('transforms each row in the array', () => {
    const rows = [
      { id: 1, is_active: 1 },
      { id: 2, is_active: 0 }
    ];
    const result = transformRows(rows);
    expect(result[0].is_active).toBe(true);
    expect(result[1].is_active).toBe(false);
  });

  it('filters out null results (should not occur in practice but tests filter)', () => {
    const rows = [{ id: 1, name: 'Valid' }];
    const result = transformRows(rows);
    expect(result).toHaveLength(1);
  });
});

// ============================================
// transformData
// ============================================

describe('transformData', () => {
  it('returns null as-is', () => {
    expect(transformData(null)).toBeNull();
  });

  it('returns undefined as-is', () => {
    expect(transformData(undefined)).toBeUndefined();
  });

  it('returns a primitive string as-is', () => {
    expect(transformData('hello')).toBe('hello');
  });

  it('returns a primitive number as-is', () => {
    expect(transformData(42)).toBe(42);
  });

  it('transforms a plain object with a boolean field', () => {
    const result = transformData({ is_active: 1, name: 'test' });
    expect((result as any).is_active).toBe(true);
    expect((result as any).name).toBe('test');
  });

  it('transforms an array of objects', () => {
    const result = transformData([{ is_active: 1 }, { is_active: 0 }]);
    expect((result as any[])[0].is_active).toBe(true);
    expect((result as any[])[1].is_active).toBe(false);
  });

  it('transforms nested objects recursively', () => {
    const data = {
      user: {
        id: 1,
        is_admin: 1
      }
    };
    const result = transformData(data) as typeof data;
    expect(result.user.is_admin).toBe(true);
  });

  it('transforms arrays nested within objects', () => {
    const data = {
      items: [{ is_active: 1 }, { is_active: 0 }]
    };
    const result = transformData(data) as typeof data;
    expect((result.items[0] as any).is_active).toBe(true);
    expect((result.items[1] as any).is_active).toBe(false);
  });

  it('parses JSON fields within objects', () => {
    const data = { settings: '{"theme":"dark"}' };
    const result = transformData(data) as any;
    expect(result.settings).toEqual({ theme: 'dark' });
  });

  it('preserves null values within objects', () => {
    const data = { id: 1, description: null };
    const result = transformData(data) as any;
    expect(result.description).toBeNull();
  });

  it('handles deeply nested structure', () => {
    const data = {
      level1: {
        level2: {
          is_enabled: 1
        }
      }
    };
    const result = transformData(data) as any;
    expect(result.level1.level2.is_enabled).toBe(true);
  });

  it('handles an empty object', () => {
    expect(transformData({})).toEqual({});
  });

  it('handles an empty array', () => {
    expect(transformData([])).toEqual([]);
  });
});
