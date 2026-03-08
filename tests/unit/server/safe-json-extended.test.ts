/**
 * ===============================================
 * SAFE JSON UTILITIES EXTENDED TESTS
 * ===============================================
 * @file tests/unit/server/safe-json-extended.test.ts
 *
 * Extended coverage for safe JSON parsing utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../server/services/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

import {
  safeJsonParse,
  safeJsonParseOrNull,
  safeJsonParseArray,
  safeJsonParseObject,
  parseIfString
} from '../../../server/utils/safe-json';
import { logger } from '../../../server/services/logger';

const mockLogger = logger as { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('safeJsonParse', () => {
  it('parses valid JSON and returns the parsed value', () => {
    expect(safeJsonParse('{"key":"value"}', null)).toEqual({ key: 'value' });
  });

  it('parses a JSON array', () => {
    expect(safeJsonParse('[1, 2, 3]', [])).toEqual([1, 2, 3]);
  });

  it('parses a JSON number', () => {
    expect(safeJsonParse('42', 0)).toBe(42);
  });

  it('returns fallback for null input', () => {
    expect(safeJsonParse(null, 'fallback')).toBe('fallback');
  });

  it('returns fallback for undefined input', () => {
    expect(safeJsonParse(undefined, 'fallback')).toBe('fallback');
  });

  it('returns fallback for empty string', () => {
    expect(safeJsonParse('', 'fallback')).toBe('fallback');
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('{invalid json}', 'fallback')).toBe('fallback');
  });

  it('logs a warning when context is provided and parsing fails', () => {
    safeJsonParse('{bad json}', null, 'test context');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('test context'),
      expect.any(Object)
    );
  });

  it('does not log when context is not provided and parsing fails', () => {
    safeJsonParse('{bad json}', null);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('does not log for successful parse', () => {
    safeJsonParse('{"ok": true}', null, 'ctx');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});

describe('safeJsonParseOrNull', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParseOrNull<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns null for null input', () => {
    expect(safeJsonParseOrNull(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(safeJsonParseOrNull(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeJsonParseOrNull('')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(safeJsonParseOrNull('{bad}')).toBeNull();
  });

  it('logs warning on failure when context provided', () => {
    safeJsonParseOrNull('{bad}', 'some context');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('some context'),
      expect.any(Object)
    );
  });
});

describe('safeJsonParseArray', () => {
  it('parses valid JSON array', () => {
    expect(safeJsonParseArray<number>('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('returns empty array for null input', () => {
    expect(safeJsonParseArray(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(safeJsonParseArray(undefined)).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(safeJsonParseArray('not valid')).toEqual([]);
  });

  it('returns empty array when JSON is a non-array value (object)', () => {
    expect(safeJsonParseArray<unknown>('{"key":"value"}')).toEqual([]);
  });

  it('returns empty array when JSON is a non-array value (string)', () => {
    expect(safeJsonParseArray<unknown>('"just a string"')).toEqual([]);
  });

  it('returns empty array when JSON is a number', () => {
    expect(safeJsonParseArray<unknown>('42')).toEqual([]);
  });

  it('parses array of objects', () => {
    expect(safeJsonParseArray<{ id: number }>('[{"id":1},{"id":2}]')).toEqual([
      { id: 1 },
      { id: 2 }
    ]);
  });
});

describe('safeJsonParseObject', () => {
  it('parses valid JSON object', () => {
    expect(safeJsonParseObject('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('returns empty object for null input', () => {
    expect(safeJsonParseObject(null)).toEqual({});
  });

  it('returns empty object for undefined input', () => {
    expect(safeJsonParseObject(undefined)).toEqual({});
  });

  it('returns empty object for invalid JSON', () => {
    expect(safeJsonParseObject('{{invalid}}')).toEqual({});
  });

  it('returns empty object when JSON is an array', () => {
    expect(safeJsonParseObject('[1, 2, 3]')).toEqual({});
  });

  it('returns empty object when JSON is a primitive string', () => {
    expect(safeJsonParseObject('"just a string"')).toEqual({});
  });

  it('returns empty object when JSON is a number', () => {
    expect(safeJsonParseObject('42')).toEqual({});
  });

  it('preserves nested object properties', () => {
    const result = safeJsonParseObject<{ nested: { x: number } }>('{"nested":{"x":1}}');
    expect(result).toEqual({ nested: { x: 1 } });
  });
});

describe('parseIfString', () => {
  it('returns fallback for null', () => {
    expect(parseIfString(null, 'fallback')).toBe('fallback');
  });

  it('returns fallback for undefined', () => {
    expect(parseIfString(undefined, 'fallback')).toBe('fallback');
  });

  it('parses a valid JSON string', () => {
    expect(parseIfString<{ key: string }>('{"key":"val"}', null)).toEqual({ key: 'val' });
  });

  it('returns already-parsed object as-is', () => {
    const obj = { key: 'value' };
    expect(parseIfString(obj, null)).toBe(obj);
  });

  it('returns already-parsed array as-is', () => {
    const arr = [1, 2, 3];
    expect(parseIfString(arr, null)).toBe(arr);
  });

  it('returns fallback for invalid JSON string', () => {
    expect(parseIfString('{bad}', 'fallback')).toBe('fallback');
  });

  it('returns fallback for non-JSON empty string', () => {
    expect(parseIfString('', 'fallback')).toBe('fallback');
  });

  it('passes context to inner safeJsonParse', () => {
    parseIfString('{bad json}', null, 'parse context');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('parse context'),
      expect.any(Object)
    );
  });
});
