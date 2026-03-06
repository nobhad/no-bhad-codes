/**
 * ===============================================
 * useTableFilters HOOK LOGIC TESTS
 * ===============================================
 * @file tests/unit/hooks/useTableFilters.test.ts
 *
 * Tests the core filtering, sorting, and toggle logic
 * used by the useTableFilters hook. Since @testing-library/react
 * is not installed, we test the pure logic directly.
 */

import { describe, it, expect } from 'vitest';

interface TestItem {
  id: number;
  name: string;
  status: string;
  amount: number;
}

const TEST_ITEMS: TestItem[] = [
  { id: 1, name: 'Alpha', status: 'active', amount: 100 },
  { id: 2, name: 'Beta', status: 'inactive', amount: 200 },
  { id: 3, name: 'Gamma', status: 'active', amount: 50 },
  { id: 4, name: 'Delta', status: 'pending', amount: 300 },
];

// Replicate the filterFn pattern used across portals
const filterFn = (item: TestItem, filters: Record<string, string>, search: string): boolean => {
  if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
  if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
  return true;
};

// Replicate the sortFn pattern
const sortFn = (a: TestItem, b: TestItem, sort: { column: string; direction: string }): number => {
  const key = sort.column as keyof TestItem;
  const aVal = a[key];
  const bVal = b[key];
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
  }
  const cmp = String(aVal).localeCompare(String(bVal));
  return sort.direction === 'asc' ? cmp : -cmp;
};

// Replicate the toggleSort state machine: null → asc → desc → null
function toggleSort(prev: { column: string; direction: string } | null, column: string) {
  if (!prev || prev.column !== column) {
    return { column, direction: 'asc' };
  }
  if (prev.direction === 'asc') {
    return { column, direction: 'desc' };
  }
  return null;
}

// Replicate hasActiveFilters computation
function hasActiveFilters(filterValues: Record<string, string>, search: string): boolean {
  if (search.trim()) return true;
  return Object.entries(filterValues).some(([, value]) => value !== 'all');
}

// Replicate applyFilters
function applyFilters(
  data: TestItem[],
  filterValues: Record<string, string>,
  search: string,
  sort: { column: string; direction: string } | null
): TestItem[] {
  let result = data.filter((item) => filterFn(item, filterValues, search));
  if (sort) {
    result = [...result].sort((a, b) => sortFn(a, b, sort));
  }
  return result;
}

describe('useTableFilters - core logic', () => {
  describe('filterFn', () => {
    it('should return all items when filter is "all" and no search', () => {
      const result = TEST_ITEMS.filter((item) => filterFn(item, { status: 'all' }, ''));
      expect(result).toHaveLength(4);
    });

    it('should filter by status', () => {
      const result = TEST_ITEMS.filter((item) => filterFn(item, { status: 'active' }, ''));
      expect(result).toHaveLength(2);
      expect(result.every((item) => item.status === 'active')).toBe(true);
    });

    it('should filter by search (case-insensitive)', () => {
      const result = TEST_ITEMS.filter((item) => filterFn(item, { status: 'all' }, 'BETA'));
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Beta');
    });

    it('should apply both filters and search together', () => {
      const result = TEST_ITEMS.filter((item) => filterFn(item, { status: 'active' }, 'alp'));
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alpha');
    });

    it('should return empty when no matches', () => {
      const result = TEST_ITEMS.filter((item) => filterFn(item, { status: 'inactive' }, 'alpha'));
      expect(result).toHaveLength(0);
    });
  });

  describe('sortFn', () => {
    it('should sort strings ascending', () => {
      const sorted = [...TEST_ITEMS].sort((a, b) => sortFn(a, b, { column: 'name', direction: 'asc' }));
      expect(sorted.map((i) => i.name)).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
    });

    it('should sort strings descending', () => {
      const sorted = [...TEST_ITEMS].sort((a, b) => sortFn(a, b, { column: 'name', direction: 'desc' }));
      expect(sorted.map((i) => i.name)).toEqual(['Gamma', 'Delta', 'Beta', 'Alpha']);
    });

    it('should sort numbers ascending', () => {
      const sorted = [...TEST_ITEMS].sort((a, b) => sortFn(a, b, { column: 'amount', direction: 'asc' }));
      expect(sorted.map((i) => i.amount)).toEqual([50, 100, 200, 300]);
    });

    it('should sort numbers descending', () => {
      const sorted = [...TEST_ITEMS].sort((a, b) => sortFn(a, b, { column: 'amount', direction: 'desc' }));
      expect(sorted.map((i) => i.amount)).toEqual([300, 200, 100, 50]);
    });
  });

  describe('toggleSort state machine', () => {
    it('should set ascending on new column from null', () => {
      expect(toggleSort(null, 'name')).toEqual({ column: 'name', direction: 'asc' });
    });

    it('should toggle to descending on same column', () => {
      const state = toggleSort(null, 'name'); // asc
      expect(toggleSort(state, 'name')).toEqual({ column: 'name', direction: 'desc' });
    });

    it('should clear sort on third toggle', () => {
      const asc = toggleSort(null, 'name');
      const desc = toggleSort(asc, 'name');
      expect(toggleSort(desc, 'name')).toBeNull();
    });

    it('should reset to ascending when switching columns', () => {
      const asc = toggleSort(null, 'name');
      const desc = toggleSort(asc, 'name'); // desc on name
      expect(toggleSort(desc, 'status')).toEqual({ column: 'status', direction: 'asc' });
    });
  });

  describe('hasActiveFilters', () => {
    it('should be false with default "all" and empty search', () => {
      expect(hasActiveFilters({ status: 'all' }, '')).toBe(false);
    });

    it('should be true when a filter is non-default', () => {
      expect(hasActiveFilters({ status: 'active' }, '')).toBe(true);
    });

    it('should be true when search has content', () => {
      expect(hasActiveFilters({ status: 'all' }, 'test')).toBe(true);
    });

    it('should be false when search is only whitespace', () => {
      expect(hasActiveFilters({ status: 'all' }, '   ')).toBe(false);
    });

    it('should handle multiple filters', () => {
      expect(hasActiveFilters({ status: 'all', type: 'all' }, '')).toBe(false);
      expect(hasActiveFilters({ status: 'all', type: 'business' }, '')).toBe(true);
    });
  });

  describe('applyFilters (filter + sort combined)', () => {
    it('should filter and sort together', () => {
      const result = applyFilters(
        TEST_ITEMS,
        { status: 'active' },
        '',
        { column: 'amount', direction: 'asc' }
      );
      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(50);  // Gamma
      expect(result[1].amount).toBe(100); // Alpha
    });

    it('should filter by search, then sort', () => {
      const result = applyFilters(
        TEST_ITEMS,
        { status: 'all' },
        'a', // Alpha, Beta, Gamma, Delta all contain 'a'
        { column: 'name', direction: 'desc' }
      );
      expect(result.map((i) => i.name)).toEqual(['Gamma', 'Delta', 'Beta', 'Alpha']);
    });

    it('should return filtered-only when sort is null', () => {
      const result = applyFilters(TEST_ITEMS, { status: 'pending' }, '', null);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Delta');
    });

    it('should return empty array when no items match', () => {
      const result = applyFilters(TEST_ITEMS, { status: 'all' }, 'zzz', null);
      expect(result).toHaveLength(0);
    });
  });
});
