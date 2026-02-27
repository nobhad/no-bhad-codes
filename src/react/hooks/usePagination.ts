import { useState, useCallback, useMemo, useEffect } from 'react';

interface UsePaginationOptions {
  /** Storage key for persisting pagination state */
  storageKey?: string;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Default page size */
  defaultPageSize?: number;
  /** Total number of items */
  totalItems: number;
}

interface UsePaginationReturn {
  /** Current page (1-indexed) */
  page: number;
  /** Current page size */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Available page size options */
  pageSizeOptions: number[];
  /** Go to specific page */
  goToPage: (page: number) => void;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  prevPage: () => void;
  /** Go to first page */
  firstPage: () => void;
  /** Go to last page */
  lastPage: () => void;
  /** Set page size */
  setPageSize: (size: number) => void;
  /** Can go to previous page */
  canGoPrev: boolean;
  /** Can go to next page */
  canGoNext: boolean;
  /** Start index for current page (0-indexed) */
  startIndex: number;
  /** End index for current page (exclusive) */
  endIndex: number;
  /** Apply pagination to data array */
  paginate: <T>(data: T[]) => T[];
  /** Page info string (e.g., "1-25 of 100") */
  pageInfo: string;
}

/**
 * Hook for managing table pagination
 */
export function usePagination(options: UsePaginationOptions): UsePaginationReturn {
  const {
    storageKey,
    pageSizeOptions = [10, 25, 50, 100],
    defaultPageSize = 25,
    totalItems
  } = options;

  // Initialize from storage or defaults
  const getInitialPage = useCallback((): number => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`${storageKey}_page`);
        if (stored) {
          return Math.max(1, parseInt(stored, 10));
        }
      } catch {
        // Ignore storage errors
      }
    }
    return 1;
  }, [storageKey]);

  const getInitialPageSize = useCallback((): number => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`${storageKey}_pageSize`);
        if (stored) {
          const size = parseInt(stored, 10);
          if (pageSizeOptions.includes(size)) {
            return size;
          }
        }
      } catch {
        // Ignore storage errors
      }
    }
    return defaultPageSize;
  }, [storageKey, pageSizeOptions, defaultPageSize]);

  const [page, setPage] = useState<number>(getInitialPage);
  const [pageSize, setPageSizeState] = useState<number>(getInitialPageSize);

  // Compute total pages
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize]
  );

  // Adjust page if it exceeds total pages
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // Persist to storage
  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`${storageKey}_page`, String(page));
      } catch {
        // Ignore storage errors
      }
    }
  }, [storageKey, page]);

  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`${storageKey}_pageSize`, String(pageSize));
      } catch {
        // Ignore storage errors
      }
    }
  }, [storageKey, pageSize]);

  // Navigation
  const goToPage = useCallback(
    (newPage: number) => {
      setPage(Math.max(1, Math.min(newPage, totalPages)));
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    setPage((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(p - 1, 1));
  }, []);

  const firstPage = useCallback(() => {
    setPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setPage(totalPages);
  }, [totalPages]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1); // Reset to first page when changing page size
  }, []);

  // Computed values
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Paginate data
  const paginate = useCallback(
    <T>(data: T[]): T[] => {
      return data.slice(startIndex, endIndex);
    },
    [startIndex, endIndex]
  );

  // Page info string
  const pageInfo = useMemo(() => {
    if (totalItems === 0) return '0 items';
    return `${startIndex + 1}-${endIndex} of ${totalItems}`;
  }, [startIndex, endIndex, totalItems]);

  return {
    page,
    pageSize,
    totalPages,
    totalItems,
    pageSizeOptions,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setPageSize,
    canGoPrev,
    canGoNext,
    startIndex,
    endIndex,
    paginate,
    pageInfo
  };
}
