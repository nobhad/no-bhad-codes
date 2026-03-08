/**
 * ===============================================
 * TRANSFORMERS UNIT TESTS
 * ===============================================
 * @file tests/unit/server/transformers.test.ts
 *
 * Tests for camelCase/snake_case conversion utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  camelToSnake,
  snakeToCamel,
  toSnakeCase,
  toCamelCase,
  arrayToSnakeCase,
  arrayToCamelCase,
  pickAndTransform,
  omitAndTransform
} from '../../../server/utils/transformers';

describe('camelToSnake', () => {
  it('converts camelCase to snake_case', () => {
    expect(camelToSnake('userId')).toBe('user_id');
  });

  it('converts multi-word camelCase to snake_case', () => {
    expect(camelToSnake('firstName')).toBe('first_name');
  });

  it('leaves already-snake_case strings unchanged', () => {
    expect(camelToSnake('already_snake')).toBe('already_snake');
  });

  it('converts consecutive uppercase letters', () => {
    expect(camelToSnake('XMLParser')).toBe('_x_m_l_parser');
  });

  it('returns empty string for empty input', () => {
    expect(camelToSnake('')).toBe('');
  });

  it('handles single character', () => {
    expect(camelToSnake('a')).toBe('a');
  });

  it('handles single uppercase character', () => {
    expect(camelToSnake('A')).toBe('_a');
  });
});

describe('snakeToCamel', () => {
  it('converts snake_case to camelCase', () => {
    expect(snakeToCamel('user_id')).toBe('userId');
  });

  it('converts multi-word snake_case to camelCase', () => {
    expect(snakeToCamel('first_name')).toBe('firstName');
  });

  it('leaves already-camelCase strings unchanged', () => {
    expect(snakeToCamel('alreadyCamel')).toBe('alreadyCamel');
  });

  it('returns empty string for empty input', () => {
    expect(snakeToCamel('')).toBe('');
  });

  it('handles multiple underscores', () => {
    expect(snakeToCamel('created_at_date')).toBe('createdAtDate');
  });
});

describe('toSnakeCase', () => {
  it('converts object keys from camelCase to snake_case', () => {
    const result = toSnakeCase({ userId: 1, firstName: 'test' });
    expect(result).toEqual({ user_id: 1, first_name: 'test' });
  });

  it('recursively converts nested objects', () => {
    const result = toSnakeCase({ userData: { firstName: 'test', userId: 42 } });
    expect(result).toEqual({ user_data: { first_name: 'test', user_id: 42 } });
  });

  it('converts keys in arrays of objects', () => {
    const result = toSnakeCase({ itemList: [{ itemName: 'a' }, { itemName: 'b' }] });
    expect(result).toEqual({ item_list: [{ item_name: 'a' }, { item_name: 'b' }] });
  });

  it('preserves null values', () => {
    const result = toSnakeCase({ userId: null });
    expect(result).toEqual({ user_id: null });
  });

  it('preserves primitive array values', () => {
    const result = toSnakeCase({ ids: [1, 2, 3] });
    expect(result).toEqual({ ids: [1, 2, 3] });
  });

  it('handles empty object', () => {
    expect(toSnakeCase({})).toEqual({});
  });
});

describe('toCamelCase', () => {
  it('converts object keys from snake_case to camelCase', () => {
    const result = toCamelCase<{ userId: number; firstName: string }>({
      user_id: 1,
      first_name: 'test'
    });
    expect(result).toEqual({ userId: 1, firstName: 'test' });
  });

  it('recursively converts nested objects', () => {
    const result = toCamelCase<Record<string, unknown>>({
      user_data: { first_name: 'test', user_id: 42 }
    });
    expect(result).toEqual({ userData: { firstName: 'test', userId: 42 } });
  });

  it('converts keys in arrays', () => {
    const result = toCamelCase<Record<string, unknown>>({
      item_list: [{ item_name: 'a' }, { item_name: 'b' }]
    });
    expect(result).toEqual({ itemList: [{ itemName: 'a' }, { itemName: 'b' }] });
  });

  it('preserves null values', () => {
    const result = toCamelCase<Record<string, unknown>>({ user_id: null });
    expect(result).toEqual({ userId: null });
  });

  it('handles empty object', () => {
    expect(toCamelCase({})).toEqual({});
  });
});

describe('arrayToSnakeCase', () => {
  it('converts array of camelCase objects to snake_case', () => {
    const input = [{ userId: 1, firstName: 'Alice' }, { userId: 2, firstName: 'Bob' }];
    const result = arrayToSnakeCase(input);
    expect(result).toEqual([
      { user_id: 1, first_name: 'Alice' },
      { user_id: 2, first_name: 'Bob' }
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(arrayToSnakeCase([])).toEqual([]);
  });

  it('handles single-element array', () => {
    const result = arrayToSnakeCase([{ myKey: 'value' }]);
    expect(result).toEqual([{ my_key: 'value' }]);
  });
});

describe('arrayToCamelCase', () => {
  it('converts array of snake_case objects to camelCase', () => {
    const input = [{ user_id: 1, first_name: 'Alice' }, { user_id: 2, first_name: 'Bob' }];
    const result = arrayToCamelCase<{ userId: number; firstName: string }>(input);
    expect(result).toEqual([
      { userId: 1, firstName: 'Alice' },
      { userId: 2, firstName: 'Bob' }
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(arrayToCamelCase([])).toEqual([]);
  });

  it('handles single-element array', () => {
    const result = arrayToCamelCase([{ my_key: 'value' }]);
    expect(result).toEqual([{ myKey: 'value' }]);
  });
});

describe('pickAndTransform', () => {
  it('picks specified fields and converts keys to snake_case', () => {
    const obj = { userId: 1, firstName: 'Alice', lastName: 'Smith', age: 30 };
    const result = pickAndTransform(obj, ['userId', 'firstName']);
    expect(result).toEqual({ user_id: 1, first_name: 'Alice' });
  });

  it('ignores fields that are not in the source object', () => {
    const obj = { userId: 1 };
    const result = pickAndTransform(obj as Record<string, unknown>, ['userId', 'nonExistent' as never]);
    expect(result).toEqual({ user_id: 1 });
  });

  it('returns empty object when no fields specified', () => {
    const obj = { userId: 1 };
    const result = pickAndTransform(obj, []);
    expect(result).toEqual({});
  });

  it('handles all fields present', () => {
    const obj = { id: 10, createdAt: '2024-01-01' };
    const result = pickAndTransform(obj, ['id', 'createdAt']);
    expect(result).toEqual({ id: 10, created_at: '2024-01-01' });
  });

  it('preserves null values for picked fields', () => {
    const obj = { userId: null, firstName: 'Alice' };
    const result = pickAndTransform(obj as Record<string, unknown>, ['userId' as never, 'firstName' as never]);
    expect(result).toEqual({ user_id: null, first_name: 'Alice' });
  });
});

describe('omitAndTransform', () => {
  it('omits specified fields and converts remaining keys to snake_case', () => {
    const obj = { userId: 1, firstName: 'Alice', password: 'secret' };
    const result = omitAndTransform(obj, ['password']);
    expect(result).toEqual({ user_id: 1, first_name: 'Alice' });
  });

  it('converts all keys when no fields are omitted', () => {
    const obj = { userId: 1, firstName: 'Alice' };
    const result = omitAndTransform(obj, []);
    expect(result).toEqual({ user_id: 1, first_name: 'Alice' });
  });

  it('returns empty object when all fields are omitted', () => {
    const obj = { userId: 1 };
    const result = omitAndTransform(obj, ['userId']);
    expect(result).toEqual({});
  });

  it('omits multiple fields', () => {
    const obj = { userId: 1, firstName: 'Alice', token: 'abc', secret: 'xyz' };
    const result = omitAndTransform(obj, ['token', 'secret']);
    expect(result).toEqual({ user_id: 1, first_name: 'Alice' });
  });

  it('handles empty source object', () => {
    const result = omitAndTransform({} as Record<string, unknown>, []);
    expect(result).toEqual({});
  });

  it('ignores omit fields not present in object', () => {
    const obj = { userId: 1 };
    const result = omitAndTransform(obj as Record<string, unknown>, ['nonExistent' as never]);
    expect(result).toEqual({ user_id: 1 });
  });
});
