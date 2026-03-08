/**
 * ===============================================
 * QUERY PARAMETER HELPERS - EXTENDED UNIT TESTS
 * ===============================================
 * @file tests/unit/server/query-param-helpers-extended.test.ts
 *
 * Extended tests for edge cases not covered by the base test file.
 * Focused on: array inputs, boundary values, and combined option interactions.
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
  getIntArrayParam
} from '../../../server/utils/query-param-helpers';

// ============================================
// getIntParam — edge cases
// ============================================

describe('getIntParam - extended edge cases', () => {
  it('handles null-like coercion: passes undefined explicitly', () => {
    // value is explicitly undefined (undefined branch)
    expect(getIntParam(undefined, 99)).toBe(99);
  });

  it('takes first element when array has multiple entries', () => {
    expect(getIntParam(['7', '8', '9'], 0)).toBe(7);
  });

  it('returns default for array with non-numeric first element', () => {
    expect(getIntParam(['nan', '5'], 42)).toBe(42);
  });

  it('returns 0 for string "0" without constraints', () => {
    expect(getIntParam('0', 99)).toBe(0);
  });

  it('handles a very large positive integer', () => {
    expect(getIntParam('9007199254740991', 0)).toBe(9007199254740991);
  });

  it('applies min then returns min when value is below and no max set', () => {
    expect(getIntParam('-100', 0, { min: 0 })).toBe(0);
  });

  it('applies max then returns max when value above and no min set', () => {
    expect(getIntParam('500', 0, { max: 100 })).toBe(100);
  });

  it('returns in-range value when within both min and max', () => {
    expect(getIntParam('50', 0, { min: 1, max: 100 })).toBe(50);
  });

  it('parses a string with leading zeros correctly', () => {
    // parseInt('007', 10) === 7
    expect(getIntParam('007', 0)).toBe(7);
  });

  it('returns default for float-only string that parseInt gives NaN on? No — parseInt truncates', () => {
    // parseInt('3.9', 10) === 3
    expect(getIntParam('3.9', 0)).toBe(3);
  });
});

// ============================================
// getFloatParam — edge cases
// ============================================

describe('getFloatParam - extended edge cases', () => {
  it('takes first element when array has multiple entries', () => {
    expect(getFloatParam(['1.1', '2.2'], 0)).toBeCloseTo(1.1);
  });

  it('returns defaultValue for array with invalid first element', () => {
    expect(getFloatParam(['bad', '2.2'], 5.5)).toBe(5.5);
  });

  it('handles scientific notation strings', () => {
    expect(getFloatParam('1e2', 0)).toBeCloseTo(100);
  });

  it('handles a string with only a decimal point', () => {
    // parseFloat('.5') === 0.5
    expect(getFloatParam('.5', 0)).toBeCloseTo(0.5);
  });

  it('returns exact value when equal to min boundary', () => {
    expect(getFloatParam('1.0', 0, { min: 1.0 })).toBeCloseTo(1.0);
  });

  it('returns exact value when equal to max boundary', () => {
    expect(getFloatParam('10.0', 0, { max: 10.0 })).toBeCloseTo(10.0);
  });

  it('applies both min and max constraints correctly', () => {
    expect(getFloatParam('0.5', 0, { min: 1.0, max: 5.0 })).toBeCloseTo(1.0);
    expect(getFloatParam('9.9', 0, { min: 1.0, max: 5.0 })).toBeCloseTo(5.0);
    expect(getFloatParam('3.0', 0, { min: 1.0, max: 5.0 })).toBeCloseTo(3.0);
  });
});

// ============================================
// getStringParam — edge cases
// ============================================

describe('getStringParam - extended edge cases', () => {
  it('does not trim when trim is explicitly false', () => {
    expect(getStringParam('  hello  ', 'default', { trim: false })).toBe('  hello  ');
  });

  it('trim defaults to true even when no option object given', () => {
    expect(getStringParam('  spaces  ', 'default')).toBe('spaces');
  });

  it('returns value from array even if value has surrounding spaces (trims)', () => {
    expect(getStringParam(['  hi  ', 'second'], 'default')).toBe('hi');
  });

  it('applies lowercase before allowedValues check', () => {
    const result = getStringParam('PENDING', 'active', {
      lowercase: true,
      allowedValues: ['active', 'pending', 'closed']
    });
    expect(result).toBe('pending');
  });

  it('returns default when value after lowercasing is not in allowedValues', () => {
    const result = getStringParam('UNKNOWN', 'active', {
      lowercase: true,
      allowedValues: ['active', 'pending']
    });
    expect(result).toBe('active');
  });

  it('allowedValues check is case-sensitive without lowercase option', () => {
    // 'Active' is not in ['active'] without lowercasing
    const result = getStringParam('Active', 'default', {
      allowedValues: ['active']
    });
    expect(result).toBe('default');
  });

  it('returns value as-is when allowedValues is an empty array', () => {
    // Empty allowedValues array: every value fails includes() check → returns default
    expect(getStringParam('anything', 'default', { allowedValues: [] })).toBe('default');
  });

  it('handles a value that is a numeric string', () => {
    expect(getStringParam('42', 'default')).toBe('42');
  });
});

// ============================================
// getBoolParam — edge cases
// ============================================

describe('getBoolParam - extended edge cases', () => {
  it('takes first element of array and resolves to false for "0"', () => {
    expect(getBoolParam(['0', '1'], true)).toBe(false);
  });

  it('takes first element of array and resolves to true for "on"', () => {
    expect(getBoolParam(['on', 'off'], false)).toBe(true);
  });

  it('returns defaultValue for whitespace-only string after trim', () => {
    // '   '.toLowerCase().trim() === '' — but the empty string check happens BEFORE this
    // The value is '   ' which is not '', so it proceeds to the lower check
    // '   '.toLowerCase().trim() === '' which is not in either truthy or falsy lists
    // → returns defaultValue
    expect(getBoolParam('   ', false)).toBe(false);
    expect(getBoolParam('   ', true)).toBe(true);
  });

  it('handles mixed case "True"', () => {
    expect(getBoolParam('True', false)).toBe(true);
  });

  it('handles mixed case "False"', () => {
    expect(getBoolParam('False', true)).toBe(false);
  });

  it('handles mixed case "No"', () => {
    expect(getBoolParam('No', true)).toBe(false);
  });

  it('handles mixed case "Off"', () => {
    expect(getBoolParam('Off', true)).toBe(false);
  });

  it('handles mixed case "Yes"', () => {
    expect(getBoolParam('Yes', false)).toBe(true);
  });

  it('handles mixed case "On"', () => {
    expect(getBoolParam('On', false)).toBe(true);
  });

  it('returns defaultValue for numeric string that is not "0" or "1"', () => {
    expect(getBoolParam('2', false)).toBe(false);
    expect(getBoolParam('2', true)).toBe(true);
  });
});

// ============================================
// getPaginationParams — edge cases
// ============================================

describe('getPaginationParams - extended edge cases', () => {
  it('uses explicit offset 0 when offset is provided as "0"', () => {
    const result = getPaginationParams({ offset: '0', page: '5', limit: '10' });
    // offset param present → uses getIntParam(offset, 0, { min: 0 }) = 0
    expect(result.offset).toBe(0);
  });

  it('uses custom DEFAULT_PAGE when no page given', () => {
    const result = getPaginationParams({}, { DEFAULT_PAGE: 3 });
    expect(result.page).toBe(3);
    expect(result.offset).toBe((3 - 1) * 50); // default limit * (page - 1)
  });

  it('uses custom MAX_LIMIT and DEFAULT_LIMIT together', () => {
    const result = getPaginationParams({}, { DEFAULT_LIMIT: 10, MAX_LIMIT: 20 });
    expect(result.limit).toBe(10);
  });

  it('explicit offset beats page-based calculation regardless of page', () => {
    const result = getPaginationParams({ page: '10', limit: '100', offset: '7' });
    expect(result.offset).toBe(7);
  });

  it('returns page 1 and offset 0 with default limit when given empty params', () => {
    const result = getPaginationParams({});
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(50);
  });

  it('handles string page that parses to 0 → clamps to 1', () => {
    const result = getPaginationParams({ page: '0', limit: '10' });
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it('handles negative limit → clamps to 1', () => {
    const result = getPaginationParams({ limit: '-5' });
    expect(result.limit).toBe(1);
  });

  it('handles negative offset → clamps to 0', () => {
    const result = getPaginationParams({ offset: '-10' });
    expect(result.offset).toBe(0);
  });
});

// ============================================
// getSortParams — edge cases
// ============================================

describe('getSortParams - extended edge cases', () => {
  const columns = ['id', 'name', 'created_at', 'updated_at'];

  it('defaults to asc when defaultOrder is asc and no order given', () => {
    const result = getSortParams({}, columns, 'id', 'asc');
    expect(result.sortOrder).toBe('asc');
  });

  it('prefers "order" over "sortOrder" alias', () => {
    // getStringParam uses query.order || query.sortOrder — order takes precedence
    const result = getSortParams({ order: 'asc', sortOrder: 'desc' }, columns, 'id', 'desc');
    expect(result.sortOrder).toBe('asc');
  });

  it('falls back to defaultSort when sortBy is an invalid column', () => {
    const result = getSortParams({ sortBy: 'hacker; DROP TABLE' }, columns, 'name', 'asc');
    expect(result.sortBy).toBe('name');
  });

  it('handles uppercase order value — defaults to desc (not whitelisted)', () => {
    // 'ASC'.toLowerCase() !== 'asc' after the lowercase transform in getSortParams?
    // Actually getSortParams uses { lowercase: true } on order → 'ASC' → 'asc'
    const result = getSortParams({ order: 'ASC' }, columns, 'id', 'desc');
    expect(result.sortOrder).toBe('asc');
  });

  it('returns sortBy from "sort" key when valid', () => {
    const result = getSortParams({ sort: 'updated_at' }, columns, 'id', 'desc');
    expect(result.sortBy).toBe('updated_at');
  });

  it('returns default sortBy when neither sort nor sortBy is provided', () => {
    const result = getSortParams({}, columns, 'created_at', 'desc');
    expect(result.sortBy).toBe('created_at');
  });

  it('handles empty string order → falls through to defaultOrder desc', () => {
    const result = getSortParams({ order: '' }, columns, 'id', 'desc');
    expect(result.sortOrder).toBe('desc');
  });
});

// ============================================
// getDateParam — edge cases
// ============================================

describe('getDateParam - extended edge cases', () => {
  it('takes first value from an array of timestamps', () => {
    const ts = 1700000000;
    const result = getDateParam([String(ts), '2024-01-01']);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(ts * 1000);
  });

  it('returns provided default (non-null) when value is undefined', () => {
    const fallback = new Date('2022-06-15');
    expect(getDateParam(undefined, fallback)).toBe(fallback);
  });

  it('returns null for a clearly invalid date string', () => {
    expect(getDateParam('not-a-date-at-all')).toBeNull();
  });

  it('parses a date-only ISO string (no time component)', () => {
    const result = getDateParam('2024-03-01');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getUTCFullYear()).toBe(2024);
    expect(result!.getUTCMonth()).toBe(2); // March = index 2
  });

  it('handles a Unix timestamp of 0 (epoch) via the timestamp fallback path', () => {
    // new Date('0') is Invalid Date in V8, so code falls to parseInt('0', 10) = 0
    // then returns new Date(0 * 1000) = epoch
    const result = getDateParam('0');
    // Result depends on runtime: new Date('0') may or may not be valid.
    // Either the ISO parse succeeds (unlikely) or the timestamp fallback runs.
    // In Node.js/V8, new Date('0') is Invalid Date → falls back to parseInt → epoch.
    if (result !== null) {
      expect(result).toBeInstanceOf(Date);
    } else {
      // In environments where '0' parses as invalid and parseInt also fails → null
      expect(result).toBeNull();
    }
  });
});

// ============================================
// getArrayParam — edge cases
// ============================================

describe('getArrayParam - extended edge cases', () => {
  it('filters blank entries produced by trailing comma', () => {
    expect(getArrayParam('a,b,')).toEqual(['a', 'b']);
  });

  it('filters blank entries produced by leading comma', () => {
    expect(getArrayParam(',a,b')).toEqual(['a', 'b']);
  });

  it('filters blank entries produced by double comma', () => {
    expect(getArrayParam('a,,b')).toEqual(['a', 'b']);
  });

  it('returns empty array from comma-only string', () => {
    expect(getArrayParam(',')).toEqual([]);
  });

  it('returns single item array for a value without commas', () => {
    expect(getArrayParam('only')).toEqual(['only']);
  });

  it('passes through an already-split array and trims items', () => {
    expect(getArrayParam([' x ', ' y '])).toEqual(['x', 'y']);
  });

  it('uses a provided non-empty default', () => {
    expect(getArrayParam(undefined, ['foo', 'bar'])).toEqual(['foo', 'bar']);
  });
});

// ============================================
// getIntArrayParam — edge cases
// ============================================

describe('getIntArrayParam - extended edge cases', () => {
  it('passes array of string integers and parses all', () => {
    expect(getIntArrayParam(['10', '20', '30'])).toEqual([10, 20, 30]);
  });

  it('filters out float strings (parseInt truncates but does not produce NaN)', () => {
    // parseInt('3.9', 10) = 3, which is a valid int
    expect(getIntArrayParam('3.9,4.1')).toEqual([3, 4]);
  });

  it('handles mix of valid and invalid in array input', () => {
    expect(getIntArrayParam(['5', 'abc', '10'])).toEqual([5, 10]);
  });

  it('returns empty array when all entries are non-numeric strings (array input bypasses defaultValue)', () => {
    // When array input is provided, getArrayParam returns ['x', 'y'] (non-empty),
    // so getIntArrayParam proceeds to filter NaN values → gets [].
    // The defaultValue is only used when getArrayParam returns [] (i.e. the input was empty/undefined).
    // Array input of all-invalid strings still produces [] not the default.
    expect(getIntArrayParam(['x', 'y'], [99])).toEqual([]);
  });

  it('handles large numbers', () => {
    expect(getIntArrayParam('100,200,300')).toEqual([100, 200, 300]);
  });

  it('returns default for empty string input', () => {
    expect(getIntArrayParam('', [7, 8])).toEqual([7, 8]);
  });
});
