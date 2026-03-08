/**
 * ===============================================
 * QUERY PARAMETER HELPERS UNIT TESTS
 * ===============================================
 * @file tests/unit/server/query-param-helpers.test.ts
 *
 * Tests for query parameter parsing and validation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  getIntParam,
  getFloatParam,
  getStringParam,
  getBoolParam,
  getPaginationParams,
  getSortParams,
  getDateParam,
  getArrayParam,
  getIntArrayParam,
  PAGINATION_DEFAULTS
} from '../../../server/utils/query-param-helpers';

describe('PAGINATION_DEFAULTS', () => {
  it('has DEFAULT_LIMIT of 50', () => {
    expect(PAGINATION_DEFAULTS.DEFAULT_LIMIT).toBe(50);
  });

  it('has MAX_LIMIT of 1000', () => {
    expect(PAGINATION_DEFAULTS.MAX_LIMIT).toBe(1000);
  });

  it('has DEFAULT_PAGE of 1', () => {
    expect(PAGINATION_DEFAULTS.DEFAULT_PAGE).toBe(1);
  });
});

describe('getIntParam', () => {
  it('returns defaultValue for undefined', () => {
    expect(getIntParam(undefined, 10)).toBe(10);
  });

  it('returns defaultValue for empty string', () => {
    expect(getIntParam('', 10)).toBe(10);
  });

  it('returns defaultValue for null-like value', () => {
    expect(getIntParam(undefined, 5)).toBe(5);
  });

  it('parses a valid integer string', () => {
    expect(getIntParam('42', 0)).toBe(42);
  });

  it('truncates decimal strings via parseInt', () => {
    expect(getIntParam('3.7', 0)).toBe(3);
  });

  it('returns defaultValue for non-numeric string', () => {
    expect(getIntParam('abc', 0)).toBe(0);
  });

  it('takes the first value from an array', () => {
    expect(getIntParam(['5', '10'], 0)).toBe(5);
  });

  it('applies min constraint when value is below min', () => {
    expect(getIntParam('0', 10, { min: 1 })).toBe(1);
  });

  it('allows value at exactly min', () => {
    expect(getIntParam('1', 10, { min: 1 })).toBe(1);
  });

  it('applies max constraint when value exceeds max', () => {
    expect(getIntParam('2000', 10, { max: 1000 })).toBe(1000);
  });

  it('allows value at exactly max', () => {
    expect(getIntParam('1000', 10, { max: 1000 })).toBe(1000);
  });

  it('applies both min and max constraints', () => {
    expect(getIntParam('5', 0, { min: 10, max: 100 })).toBe(10);
    expect(getIntParam('200', 0, { min: 10, max: 100 })).toBe(100);
    expect(getIntParam('50', 0, { min: 10, max: 100 })).toBe(50);
  });

  it('handles negative integers', () => {
    expect(getIntParam('-5', 0)).toBe(-5);
  });
});

describe('getFloatParam', () => {
  it('returns defaultValue for undefined', () => {
    expect(getFloatParam(undefined, 1.5)).toBe(1.5);
  });

  it('returns defaultValue for empty string', () => {
    expect(getFloatParam('', 1.5)).toBe(1.5);
  });

  it('parses a valid float string', () => {
    expect(getFloatParam('3.14', 0)).toBeCloseTo(3.14);
  });

  it('parses integer strings as floats', () => {
    expect(getFloatParam('42', 0)).toBe(42);
  });

  it('returns defaultValue for non-numeric string', () => {
    expect(getFloatParam('xyz', 0)).toBe(0);
  });

  it('takes the first value from an array', () => {
    expect(getFloatParam(['2.5', '10.0'], 0)).toBeCloseTo(2.5);
  });

  it('applies min constraint', () => {
    expect(getFloatParam('0.1', 1.0, { min: 1.0 })).toBeCloseTo(1.0);
  });

  it('applies max constraint', () => {
    expect(getFloatParam('99.9', 0, { max: 50.0 })).toBeCloseTo(50.0);
  });

  it('handles negative float', () => {
    expect(getFloatParam('-3.14', 0)).toBeCloseTo(-3.14);
  });
});

describe('getStringParam', () => {
  it('returns defaultValue for undefined', () => {
    expect(getStringParam(undefined, 'default')).toBe('default');
  });

  it('returns defaultValue for null-like value', () => {
    expect(getStringParam(undefined, 'fallback')).toBe('fallback');
  });

  it('returns defaultValue for empty string', () => {
    expect(getStringParam('', 'default')).toBe('default');
  });

  it('returns the string value', () => {
    expect(getStringParam('hello', 'default')).toBe('hello');
  });

  it('takes the first value from an array', () => {
    expect(getStringParam(['first', 'second'], 'default')).toBe('first');
  });

  it('returns defaultValue when value is not in allowedValues', () => {
    expect(getStringParam('invalid', 'active', { allowedValues: ['active', 'inactive'] })).toBe('active');
  });

  it('returns value when it is in allowedValues', () => {
    expect(getStringParam('inactive', 'active', { allowedValues: ['active', 'inactive'] })).toBe('inactive');
  });

  it('lowercases the value when lowercase option is true', () => {
    expect(getStringParam('HELLO', 'default', { lowercase: true })).toBe('hello');
  });

  it('trims whitespace by default', () => {
    expect(getStringParam('  hello  ', 'default')).toBe('hello');
  });

  it('lowercase is applied before allowedValues check', () => {
    expect(
      getStringParam('ACTIVE', 'default', { lowercase: true, allowedValues: ['active', 'inactive'] })
    ).toBe('active');
  });
});

describe('getBoolParam', () => {
  it('returns defaultValue for undefined', () => {
    expect(getBoolParam(undefined, false)).toBe(false);
    expect(getBoolParam(undefined, true)).toBe(true);
  });

  it('returns defaultValue for empty string', () => {
    expect(getBoolParam('', false)).toBe(false);
  });

  it('returns true for "true"', () => {
    expect(getBoolParam('true', false)).toBe(true);
  });

  it('returns true for "1"', () => {
    expect(getBoolParam('1', false)).toBe(true);
  });

  it('returns true for "yes"', () => {
    expect(getBoolParam('yes', false)).toBe(true);
  });

  it('returns true for "on"', () => {
    expect(getBoolParam('on', false)).toBe(true);
  });

  it('returns false for "false"', () => {
    expect(getBoolParam('false', true)).toBe(false);
  });

  it('returns false for "0"', () => {
    expect(getBoolParam('0', true)).toBe(false);
  });

  it('returns false for "no"', () => {
    expect(getBoolParam('no', true)).toBe(false);
  });

  it('returns false for "off"', () => {
    expect(getBoolParam('off', true)).toBe(false);
  });

  it('is case-insensitive for "TRUE"', () => {
    expect(getBoolParam('TRUE', false)).toBe(true);
  });

  it('is case-insensitive for "YES"', () => {
    expect(getBoolParam('YES', false)).toBe(true);
  });

  it('is case-insensitive for "FALSE"', () => {
    expect(getBoolParam('FALSE', true)).toBe(false);
  });

  it('returns defaultValue for unrecognized string', () => {
    expect(getBoolParam('maybe', false)).toBe(false);
    expect(getBoolParam('maybe', true)).toBe(true);
  });

  it('takes first element of array', () => {
    expect(getBoolParam(['true', 'false'], false)).toBe(true);
  });
});

describe('getPaginationParams', () => {
  it('returns defaults when no params provided', () => {
    const result = getPaginationParams({});
    expect(result.limit).toBe(50);
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it('calculates offset from page and limit', () => {
    const result = getPaginationParams({ page: '2', limit: '10' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(10);
  });

  it('explicit offset overrides page-based calculation', () => {
    const result = getPaginationParams({ page: '3', limit: '10', offset: '5' });
    expect(result.offset).toBe(5);
  });

  it('caps limit at MAX_LIMIT', () => {
    const result = getPaginationParams({ limit: '9999' });
    expect(result.limit).toBe(1000);
  });

  it('enforces minimum limit of 1', () => {
    const result = getPaginationParams({ limit: '0' });
    expect(result.limit).toBe(1);
  });

  it('enforces minimum page of 1', () => {
    const result = getPaginationParams({ page: '0' });
    expect(result.page).toBe(1);
  });

  it('uses custom defaults when provided', () => {
    const result = getPaginationParams({}, { DEFAULT_LIMIT: 25, DEFAULT_PAGE: 2 });
    expect(result.limit).toBe(25);
    expect(result.page).toBe(2);
  });

  it('respects custom MAX_LIMIT', () => {
    const result = getPaginationParams({ limit: '500' }, { MAX_LIMIT: 100 });
    expect(result.limit).toBe(100);
  });

  it('page 1 yields offset 0', () => {
    const result = getPaginationParams({ page: '1', limit: '20' });
    expect(result.offset).toBe(0);
  });

  it('page 3 with limit 10 yields offset 20', () => {
    const result = getPaginationParams({ page: '3', limit: '10' });
    expect(result.offset).toBe(20);
  });
});

describe('getSortParams', () => {
  const allowedColumns = ['created_at', 'name', 'status', 'amount'];

  it('returns defaults when no params provided', () => {
    const result = getSortParams({}, allowedColumns, 'created_at', 'desc');
    expect(result.sortBy).toBe('created_at');
    expect(result.sortOrder).toBe('desc');
  });

  it('uses a valid sort column', () => {
    const result = getSortParams({ sort: 'name' }, allowedColumns, 'created_at', 'desc');
    expect(result.sortBy).toBe('name');
  });

  it('falls back to defaultSort for an invalid column', () => {
    const result = getSortParams({ sort: 'invalid_column' }, allowedColumns, 'created_at', 'desc');
    expect(result.sortBy).toBe('created_at');
  });

  it('accepts "asc" order', () => {
    const result = getSortParams({ order: 'asc' }, allowedColumns, 'created_at', 'desc');
    expect(result.sortOrder).toBe('asc');
  });

  it('defaults unknown order to "desc"', () => {
    const result = getSortParams({ order: 'random' }, allowedColumns, 'created_at', 'desc');
    expect(result.sortOrder).toBe('desc');
  });

  it('supports "sortBy" query param as alias for "sort"', () => {
    const result = getSortParams({ sortBy: 'amount' }, allowedColumns, 'created_at', 'desc');
    expect(result.sortBy).toBe('amount');
  });

  it('supports "sortOrder" query param as alias for "order"', () => {
    const result = getSortParams({ sortOrder: 'asc' }, allowedColumns, 'created_at', 'desc');
    expect(result.sortOrder).toBe('asc');
  });

  it('prefers "sort" over "sortBy"', () => {
    const result = getSortParams({ sort: 'name', sortBy: 'amount' }, allowedColumns, 'created_at', 'desc');
    expect(result.sortBy).toBe('name');
  });

  it('uses defaultOrder when no order param given', () => {
    const result = getSortParams({}, allowedColumns, 'created_at', 'asc');
    expect(result.sortOrder).toBe('asc');
  });
});

describe('getDateParam', () => {
  it('returns null (default) for undefined', () => {
    expect(getDateParam(undefined)).toBeNull();
  });

  it('returns null (default) for empty string', () => {
    expect(getDateParam('')).toBeNull();
  });

  it('returns a Date object for a valid ISO string', () => {
    const result = getDateParam('2024-01-15T00:00:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('returns the provided default for invalid string', () => {
    const fallback = new Date('2023-01-01');
    const result = getDateParam('not-a-date', fallback);
    expect(result).toBe(fallback);
  });

  it('returns null default for invalid string when no default provided', () => {
    expect(getDateParam('not-a-date')).toBeNull();
  });

  it('parses a Unix timestamp string', () => {
    const unixSeconds = 1700000000;
    const result = getDateParam(String(unixSeconds));
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(unixSeconds * 1000);
  });

  it('takes the first value from an array', () => {
    const result = getDateParam(['2024-06-01T12:00:00Z', '2024-07-01T12:00:00Z']);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getUTCFullYear()).toBe(2024);
    expect(result!.getUTCMonth()).toBe(5); // June is UTC month index 5
  });

  it('accepts a custom default value', () => {
    const customDefault = new Date('2020-01-01');
    expect(getDateParam(undefined, customDefault)).toBe(customDefault);
  });
});

describe('getArrayParam', () => {
  it('returns defaultValue for undefined', () => {
    expect(getArrayParam(undefined, ['default'])).toEqual(['default']);
  });

  it('returns empty array as default when none provided', () => {
    expect(getArrayParam(undefined)).toEqual([]);
  });

  it('returns defaultValue for empty string', () => {
    expect(getArrayParam('', ['default'])).toEqual(['default']);
  });

  it('splits comma-separated string into array', () => {
    expect(getArrayParam('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace from each element', () => {
    expect(getArrayParam('  a , b , c  ')).toEqual(['a', 'b', 'c']);
  });

  it('returns filtered array when given an array input', () => {
    expect(getArrayParam(['a', 'b', ''])).toEqual(['a', 'b']);
  });

  it('filters empty strings from array input', () => {
    expect(getArrayParam(['', 'hello', '  '])).toEqual(['hello']);
  });

  it('handles single value string', () => {
    expect(getArrayParam('single')).toEqual(['single']);
  });
});

describe('getIntArrayParam', () => {
  it('returns defaultValue for undefined', () => {
    expect(getIntArrayParam(undefined, [1, 2])).toEqual([1, 2]);
  });

  it('returns empty array as default when none provided', () => {
    expect(getIntArrayParam(undefined)).toEqual([]);
  });

  it('returns defaultValue for empty string', () => {
    expect(getIntArrayParam('', [99])).toEqual([99]);
  });

  it('parses comma-separated integer string', () => {
    expect(getIntArrayParam('1,2,3')).toEqual([1, 2, 3]);
  });

  it('filters out non-integer values', () => {
    expect(getIntArrayParam('1,abc,3')).toEqual([1, 3]);
  });

  it('handles single integer string', () => {
    expect(getIntArrayParam('42')).toEqual([42]);
  });

  it('trims whitespace around values', () => {
    expect(getIntArrayParam(' 1 , 2 , 3 ')).toEqual([1, 2, 3]);
  });

  it('returns empty array default when all values are invalid', () => {
    expect(getIntArrayParam('abc,xyz')).toEqual([]);
  });
});
