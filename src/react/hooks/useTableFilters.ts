import { useState, useCallback, useMemo, useEffect } from 'react';
import type { SortConfig } from '@react/features/admin/types';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  defaultValue?: string;
}

interface UseTableFiltersOptions<T> {
  /** Storage key for persisting filter state */
  storageKey?: string;
  /** Filter configurations */
  filters: FilterConfig[];
  /** Function to filter items based on current filters */
  filterFn: (item: T, filters: Record<string, string[]>, search: string) => boolean;
  /** Function to sort items */
  sortFn?: (a: T, b: T, sort: SortConfig) => number;
  /** Default sort configuration */
  defaultSort?: SortConfig;
}

interface UseTableFiltersReturn<T> {
  /** Current filter values — array of selected values per key (empty = no filter) */
  filterValues: Record<string, string[]>;
  /** Toggle a value on/off for a key; 'all' clears the key */
  setFilter: (key: string, value: string) => void;
  /** Current search query */
  search: string;
  /** Set search query */
  setSearch: (query: string) => void;
  /** Current sort configuration */
  sort: SortConfig | null;
  /** Set sort configuration */
  setSort: (sort: SortConfig | null) => void;
  /** Toggle sort for a column */
  toggleSort: (column: string) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Apply filters to data */
  applyFilters: (data: T[]) => T[];
  /** Filter configurations */
  filterConfigs: FilterConfig[];
  /** Check if any filters are active */
  hasActiveFilters: boolean;
}

/**
 * Hook for managing table filters, search, and sorting.
 * Supports multi-select: each filter key holds an array of selected values.
 * Empty array means "all" (no filter applied for that key).
 */
export function useTableFilters<T>(options: UseTableFiltersOptions<T>): UseTableFiltersReturn<T> {
  const { storageKey, filters, filterFn, sortFn, defaultSort } = options;

  const getInitialFilters = useCallback((): Record<string, string[]> => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`${storageKey}_filters`);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Migrate legacy string values to arrays
          const migrated: Record<string, string[]> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (Array.isArray(v)) {
              migrated[k] = v;
            } else if (typeof v === 'string' && v !== 'all') {
              migrated[k] = [v];
            } else {
              migrated[k] = [];
            }
          }
          return migrated;
        }
      } catch {
        // Ignore storage errors
      }
    }
    return filters.reduce((acc, filter) => {
      acc[filter.key] = [];
      return acc;
    }, {} as Record<string, string[]>);
  }, [storageKey, filters]);

  const getInitialSearch = useCallback((): string => {
    if (storageKey) {
      try {
        return localStorage.getItem(`${storageKey}_search`) || '';
      } catch {
        return '';
      }
    }
    return '';
  }, [storageKey]);

  const getInitialSort = useCallback((): SortConfig | null => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`${storageKey}_sort`);
        if (stored) return JSON.parse(stored);
      } catch {
        // Ignore storage errors
      }
    }
    return defaultSort || null;
  }, [storageKey, defaultSort]);

  const [filterValues, setFilterValues] = useState<Record<string, string[]>>(getInitialFilters);
  const [search, setSearchState] = useState<string>(getInitialSearch);
  const [sort, setSortState] = useState<SortConfig | null>(getInitialSort);

  // Persist to storage
  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`${storageKey}_filters`, JSON.stringify(filterValues));
      } catch {
        // Ignore storage errors
      }
    }
  }, [storageKey, filterValues]);

  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`${storageKey}_search`, search);
      } catch {
        // Ignore storage errors
      }
    }
  }, [storageKey, search]);

  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`${storageKey}_sort`, JSON.stringify(sort));
      } catch {
        // Ignore storage errors
      }
    }
  }, [storageKey, sort]);

  // Toggle a value in/out of the filter array; 'all' clears the key
  const setFilter = useCallback((key: string, value: string) => {
    setFilterValues((prev) => {
      if (value === 'all') {
        return { ...prev, [key]: [] };
      }
      const current = prev[key] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  }, []);

  const setSearch = useCallback((query: string) => {
    setSearchState(query);
  }, []);

  const setSort = useCallback((newSort: SortConfig | null) => {
    setSortState(newSort);
  }, []);

  const toggleSort = useCallback((column: string) => {
    setSortState((prev) => {
      if (!prev || prev.column !== column) return { column, direction: 'asc' };
      if (prev.direction === 'asc') return { column, direction: 'desc' };
      return null;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilterValues(
      filters.reduce((acc, filter) => {
        acc[filter.key] = [];
        return acc;
      }, {} as Record<string, string[]>)
    );
    setSearchState('');
  }, [filters]);

  const hasActiveFilters = useMemo(() => {
    if (search.trim()) return true;
    return Object.values(filterValues).some((arr) => arr.length > 0);
  }, [filterValues, search]);

  const applyFilters = useCallback(
    (data: T[]): T[] => {
      let result = data.filter((item) => filterFn(item, filterValues, search));
      if (sort && sortFn) {
        result = [...result].sort((a, b) => sortFn(a, b, sort));
      }
      return result;
    },
    [filterFn, filterValues, search, sort, sortFn]
  );

  return {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    setSort,
    toggleSort,
    clearFilters,
    applyFilters,
    filterConfigs: filters,
    hasActiveFilters
  };
}
