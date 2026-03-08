/**
 * ===============================================
 * UNIT TESTS - DATABASE QUERY HELPERS
 * ===============================================
 * @file tests/unit/server/query-helpers.test.ts
 *
 * Tests for server/database/query-helpers.ts — covers:
 * - notDeleted
 * - isDeleted
 * - isRecoverable
 * - isExpired
 * - buildSafeUpdate
 * - isValidFieldName
 * - assertValidFieldName
 */

import { describe, it, expect } from 'vitest';
import {
  notDeleted,
  isDeleted,
  isRecoverable,
  isExpired,
  buildSafeUpdate,
  isValidFieldName,
  assertValidFieldName
} from '../../../server/database/query-helpers';

// ============================================
// notDeleted
// ============================================

describe('notDeleted', () => {
  it('returns "deleted_at IS NULL" without an alias', () => {
    expect(notDeleted()).toBe('deleted_at IS NULL');
  });

  it('returns "c.deleted_at IS NULL" with alias "c"', () => {
    expect(notDeleted('c')).toBe('c.deleted_at IS NULL');
  });

  it('returns "tbl.deleted_at IS NULL" with alias "tbl"', () => {
    expect(notDeleted('tbl')).toBe('tbl.deleted_at IS NULL');
  });

  it('returns "deleted_at IS NULL" for explicit undefined alias', () => {
    expect(notDeleted(undefined)).toBe('deleted_at IS NULL');
  });
});

// ============================================
// isDeleted
// ============================================

describe('isDeleted', () => {
  it('returns "deleted_at IS NOT NULL" without an alias', () => {
    expect(isDeleted()).toBe('deleted_at IS NOT NULL');
  });

  it('returns "u.deleted_at IS NOT NULL" with alias "u"', () => {
    expect(isDeleted('u')).toBe('u.deleted_at IS NOT NULL');
  });

  it('returns "deleted_at IS NOT NULL" for undefined alias', () => {
    expect(isDeleted(undefined)).toBe('deleted_at IS NOT NULL');
  });
});

// ============================================
// isRecoverable
// ============================================

describe('isRecoverable', () => {
  it('returns correct fragment without alias using default 30 days', () => {
    const result = isRecoverable();
    expect(result).toBe(
      "deleted_at IS NOT NULL AND datetime(deleted_at, '+30 days') > datetime('now')"
    );
  });

  it('returns correct fragment with alias and default days', () => {
    const result = isRecoverable('c');
    expect(result).toBe(
      "c.deleted_at IS NOT NULL AND datetime(c.deleted_at, '+30 days') > datetime('now')"
    );
  });

  it('uses custom days value', () => {
    const result = isRecoverable(undefined, 7);
    expect(result).toBe(
      "deleted_at IS NOT NULL AND datetime(deleted_at, '+7 days') > datetime('now')"
    );
  });

  it('uses custom alias and custom days', () => {
    const result = isRecoverable('inv', 14);
    expect(result).toBe(
      "inv.deleted_at IS NOT NULL AND datetime(inv.deleted_at, '+14 days') > datetime('now')"
    );
  });

  it('returns correct fragment for 1 day retention', () => {
    const result = isRecoverable(undefined, 1);
    expect(result).toBe(
      "deleted_at IS NOT NULL AND datetime(deleted_at, '+1 days') > datetime('now')"
    );
  });
});

// ============================================
// isExpired
// ============================================

describe('isExpired', () => {
  it('returns correct fragment without alias using default 30 days', () => {
    const result = isExpired();
    expect(result).toBe(
      "deleted_at IS NOT NULL AND datetime(deleted_at, '+30 days') <= datetime('now')"
    );
  });

  it('returns correct fragment with alias and default days', () => {
    const result = isExpired('r');
    expect(result).toBe(
      "r.deleted_at IS NOT NULL AND datetime(r.deleted_at, '+30 days') <= datetime('now')"
    );
  });

  it('uses custom days value', () => {
    const result = isExpired(undefined, 90);
    expect(result).toBe(
      "deleted_at IS NOT NULL AND datetime(deleted_at, '+90 days') <= datetime('now')"
    );
  });

  it('uses custom alias and custom days', () => {
    const result = isExpired('p', 60);
    expect(result).toBe(
      "p.deleted_at IS NOT NULL AND datetime(p.deleted_at, '+60 days') <= datetime('now')"
    );
  });

  it('isExpired uses <= while isRecoverable uses >', () => {
    const expired = isExpired();
    const recoverable = isRecoverable();
    expect(expired).toContain('<=');
    expect(recoverable).toContain('>');
    // They should be symmetric (same structure, different comparator)
    expect(expired.replace('<=', '>')).toBe(recoverable);
  });
});

// ============================================
// buildSafeUpdate
// ============================================

describe('buildSafeUpdate', () => {
  const ALLOWED = ['name', 'status', 'description', 'amount', 'is_active'];

  it('builds a SET clause for a single field', () => {
    const { setClause, params } = buildSafeUpdate({ name: 'Alice' }, ALLOWED);
    expect(setClause).toBe('name = ?, updated_at = CURRENT_TIMESTAMP');
    expect(params).toEqual(['Alice']);
  });

  it('builds a SET clause for multiple fields', () => {
    const { setClause, params } = buildSafeUpdate(
      { name: 'Bob', status: 'active' },
      ALLOWED
    );
    expect(setClause).toBe('name = ?, status = ?, updated_at = CURRENT_TIMESTAMP');
    expect(params).toEqual(['Bob', 'active']);
  });

  it('adds updated_at timestamp by default', () => {
    const { setClause } = buildSafeUpdate({ name: 'Test' }, ALLOWED);
    expect(setClause).toContain('updated_at = CURRENT_TIMESTAMP');
  });

  it('does not add timestamp when addTimestamp is false', () => {
    const { setClause } = buildSafeUpdate({ name: 'Test' }, ALLOWED, { addTimestamp: false });
    expect(setClause).toBe('name = ?');
    expect(setClause).not.toContain('CURRENT_TIMESTAMP');
  });

  it('uses a custom timestamp field name', () => {
    const { setClause } = buildSafeUpdate(
      { name: 'Test' },
      ALLOWED,
      { addTimestamp: true, timestampField: 'modified_at' }
    );
    expect(setClause).toContain('modified_at = CURRENT_TIMESTAMP');
  });

  it('throws for an invalid field name not in allowedFields', () => {
    expect(() => buildSafeUpdate({ hacked: 'value' }, ALLOWED)).toThrow('Invalid field name: hacked');
  });

  it('throws and names the invalid field in the error message', () => {
    expect(() => buildSafeUpdate({ injected: '; DROP TABLE users--' }, ALLOWED)).toThrow(
      /Invalid field name: injected/
    );
  });

  it('skips undefined values silently', () => {
    const { setClause, params } = buildSafeUpdate(
      { name: 'Alice', status: undefined as any },
      ALLOWED
    );
    expect(setClause).toBe('name = ?, updated_at = CURRENT_TIMESTAMP');
    expect(params).toEqual(['Alice']);
  });

  it('handles null values as valid params', () => {
    const { setClause, params } = buildSafeUpdate({ description: null }, ALLOWED);
    expect(params).toEqual([null]);
    expect(setClause).toContain('description = ?');
  });

  it('handles boolean values', () => {
    const { params } = buildSafeUpdate({ is_active: false }, ALLOWED);
    expect(params).toContain(false);
  });

  it('handles numeric values', () => {
    const { params } = buildSafeUpdate({ amount: 99.99 }, ALLOWED);
    expect(params).toContain(99.99);
  });

  it('returns empty setClause and empty params when updates object is empty', () => {
    const { setClause, params } = buildSafeUpdate({}, ALLOWED);
    // No fields → no timestamp either (because setClauses.length === 0)
    expect(setClause).toBe('');
    expect(params).toEqual([]);
  });

  it('returns empty setClause when only undefined values are provided', () => {
    const { setClause, params } = buildSafeUpdate(
      { name: undefined as any },
      ALLOWED
    );
    expect(setClause).toBe('');
    expect(params).toEqual([]);
  });

  it('includes the list of allowed fields in the error message', () => {
    try {
      buildSafeUpdate({ unknown: 'val' }, ALLOWED);
      expect(true).toBe(false); // should not reach here
    } catch (err) {
      expect((err as Error).message).toContain(ALLOWED.join(', '));
    }
  });

  it('handles string values', () => {
    const { setClause, params } = buildSafeUpdate({ status: 'pending' }, ALLOWED);
    expect(setClause).toContain('status = ?');
    expect(params).toContain('pending');
  });

  it('processes fields in the order they appear in the updates object', () => {
    const { setClause } = buildSafeUpdate(
      { status: 'a', name: 'b', description: 'c' },
      ALLOWED
    );
    const statusIdx = setClause.indexOf('status');
    const nameIdx = setClause.indexOf('name');
    const descIdx = setClause.indexOf('description');
    expect(statusIdx).toBeLessThan(nameIdx);
    expect(nameIdx).toBeLessThan(descIdx);
  });
});

// ============================================
// isValidFieldName
// ============================================

describe('isValidFieldName', () => {
  it('returns true for simple lowercase name', () => {
    expect(isValidFieldName('name')).toBe(true);
  });

  it('returns true for name with underscores', () => {
    expect(isValidFieldName('created_at')).toBe(true);
  });

  it('returns true for name starting with uppercase', () => {
    expect(isValidFieldName('Name')).toBe(true);
  });

  it('returns true for name with leading underscore', () => {
    expect(isValidFieldName('_private')).toBe(true);
  });

  it('returns true for name with numbers (not at start)', () => {
    expect(isValidFieldName('field1')).toBe(true);
  });

  it('returns true for all uppercase name', () => {
    expect(isValidFieldName('ID')).toBe(true);
  });

  it('returns false for name starting with a digit', () => {
    expect(isValidFieldName('1field')).toBe(false);
  });

  it('returns false for name with a space', () => {
    expect(isValidFieldName('field name')).toBe(false);
  });

  it('returns false for name with a hyphen', () => {
    expect(isValidFieldName('field-name')).toBe(false);
  });

  it('returns false for name with SQL injection attempt', () => {
    expect(isValidFieldName("name'; DROP TABLE users--")).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidFieldName('')).toBe(false);
  });

  it('returns false for name with a period', () => {
    expect(isValidFieldName('table.column')).toBe(false);
  });

  it('returns false for name with a semicolon', () => {
    expect(isValidFieldName('field;')).toBe(false);
  });

  it('returns true for single character name', () => {
    expect(isValidFieldName('x')).toBe(true);
  });

  it('returns true for single underscore', () => {
    expect(isValidFieldName('_')).toBe(true);
  });
});

// ============================================
// assertValidFieldName
// ============================================

describe('assertValidFieldName', () => {
  it('does not throw for a valid field name', () => {
    expect(() => assertValidFieldName('valid_field')).not.toThrow();
    expect(() => assertValidFieldName('firstName')).not.toThrow();
    expect(() => assertValidFieldName('id')).not.toThrow();
    expect(() => assertValidFieldName('_internal')).not.toThrow();
  });

  it('throws for a name starting with a digit', () => {
    expect(() => assertValidFieldName('1bad')).toThrow(/Invalid field name/);
  });

  it('throws for a name with a space', () => {
    expect(() => assertValidFieldName('bad field')).toThrow(/Invalid field name/);
  });

  it('throws for a name with special SQL characters', () => {
    expect(() => assertValidFieldName('name; DROP')).toThrow(/Invalid field name/);
  });

  it('includes the offending field name in the error message', () => {
    try {
      assertValidFieldName('bad-name');
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect((err as Error).message).toContain('bad-name');
    }
  });

  it('throws for an empty string', () => {
    expect(() => assertValidFieldName('')).toThrow(/Invalid field name/);
  });

  it('includes guidance about allowed characters in error', () => {
    try {
      assertValidFieldName('bad!');
    } catch (err) {
      expect((err as Error).message).toContain('alphanumeric');
    }
  });
});
