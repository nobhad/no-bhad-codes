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
  filterFn: (item: T, filters: Record<string, string>, search: string) => boolean;
  /** Function to sort items */
  sortFn?: (a: T, b: T, sort: SortConfig) => number;
  /** Default sort configuration */
  defaultSort?: SortConfig;
}

interface UseTableFiltersReturn<T> {
  /** Current filter values */
  filterValues: Record<string, string>;
  /** Set a filter value */
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
 * Hook for managing table filters, search, and sorting
 */
export function useTableFilters<T>(options: UseTableFiltersOptions<T>): UseTableFiltersReturn<T> {
  const { storageKey, filters, filterFn, sortFn, defaultSort } = options;

  // Initialize filter values from storage or defaults
  const getInitialFilters = useCallback((): Record<string, string> => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`${storageKey}_filters`);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch {
        // Ignore storage errors
      }
    }

    return filters.reduce(
      (acc, filter) => {
        acc[filter.key] = filter.defaultValue || 'all';
        return acc;
      },
      {} as Record<string, string>
    );
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
        if (stored) {
          return JSON.parse(stored);
        }
      } catch {
        // Ignore storage errors
      }
    }
    return defaultSort || null;
  }, [storageKey, defaultSort]);

  const [filterValues, setFilterValues] = useState<Record<string, string>>(getInitialFilters);
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

  // Set individual filter
  const setFilter = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Set search
  const setSearch = useCallback((query: string) => {
    setSearchState(query);
  }, []);

  // Set sort
  const setSort = useCallback((newSort: SortConfig | null) => {
    setSortState(newSort);
  }, []);

  // Toggle sort for column
  const toggleSort = useCallback((column: string) => {
    setSortState((prev) => {
      if (!prev || prev.column !== column) {
        return { column, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      return null; // Clear sort
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterValues(
      filters.reduce(
        (acc, filter) => {
          acc[filter.key] = filter.defaultValue || 'all';
          return acc;
        },
        {} as Record<string, string>
      )
    );
    setSearchState('');
  }, [filters]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    if (search.trim()) return true;
    return Object.entries(filterValues).some(([, value]) => value !== 'all');
  }, [filterValues, search]);

  // Apply filters to data
  const applyFilters = useCallback(
    (data: T[]): T[] => {
      // Filter
      let result = data.filter((item) => filterFn(item, filterValues, search));

      // Sort
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
