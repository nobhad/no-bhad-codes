/**
 * ===============================================
 * USE DATA FETCH HOOK
 * ===============================================
 * @file src/react/factories/useDataFetch.tsx
 *
 * Standardized hook for API data fetching with loading,
 * error states, and refetch capabilities.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// TYPES
// ============================================

/**
 * Standard API response structure.
 */
export interface ApiResponse<T> {
  data: T;
  error?: string;
  status?: number;
}

/**
 * Fetch state.
 */
export interface FetchState<T> {
  /** The fetched data */
  data: T | null;
  /** Whether the fetch is in progress */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether the initial fetch has completed */
  isInitialized: boolean;
}

/**
 * Options for useDataFetch hook.
 */
export interface UseDataFetchOptions<T, P = void> {
  /** Function to get auth token */
  getAuthToken?: () => string | null;
  /** The fetch function */
  fetchFn: (params: P, headers: HeadersInit) => Promise<T>;
  /** Fetch parameters */
  params?: P;
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
  /** Dependencies that trigger refetch */
  deps?: unknown[];
  /** Transform response data */
  transform?: (data: T) => T;
  /** Callback on successful fetch */
  onSuccess?: (data: T) => void;
  /** Callback on fetch error */
  onError?: (error: Error) => void;
  /** Initial data value */
  initialData?: T | null;
  /** Debounce delay in ms */
  debounceMs?: number;
}

/**
 * Return type from useDataFetch hook.
 */
export interface UseDataFetchReturn<T> extends FetchState<T> {
  /** Refetch the data */
  refetch: () => Promise<void>;
  /** Set data manually */
  setData: (data: T | null | ((prev: T | null) => T | null)) => void;
  /** Clear error */
  clearError: () => void;
  /** Reset to initial state */
  reset: () => void;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook for standardized data fetching with auth headers.
 *
 * @example
 * ```typescript
 * const { data, isLoading, error, refetch } = useDataFetch({
 *   getAuthToken,
 *   fetchFn: async (_, headers) => {
 *     const response = await fetch('/api/admin/clients', { headers });
 *     if (!response.ok) throw new Error('Failed to load clients');
 *     return response.json();
 *   },
 *   onSuccess: (data) => setStats(data.stats),
 *   initialData: { clients: [], stats: defaultStats }
 * });
 * ```
 */
export function useDataFetch<T, P = void>(
  options: UseDataFetchOptions<T, P>
): UseDataFetchReturn<T> {
  const {
    getAuthToken,
    fetchFn,
    params,
    fetchOnMount = true,
    deps = [],
    transform,
    onSuccess,
    onError,
    initialData = null,
    debounceMs
  } = options;

  const [state, setState] = useState<FetchState<T>>({
    data: initialData,
    isLoading: fetchOnMount,
    error: null,
    isInitialized: false
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Build auth headers.
   */
  const getHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const token = getAuthToken?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  /**
   * Perform the fetch.
   */
  const doFetch = useCallback(async (): Promise<void> => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const headers = getHeaders();
      const fetchedData = await fetchFn(params as P, headers);

      // Apply transform if provided
      const result: T = transform ? transform(fetchedData) : fetchedData;

      setState({
        data: result,
        isLoading: false,
        error: null,
        isInitialized: true
      });

      onSuccess?.(result);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useDataFetch] Fetch failed:', error);

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message,
        isInitialized: true
      }));

      onError?.(error);
    }
  }, [fetchFn, params, getHeaders, transform, onSuccess, onError]);

  /**
   * Refetch with optional debounce.
   */
  const refetch = useCallback(async (): Promise<void> => {
    if (debounceMs) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        doFetch();
      }, debounceMs);
    } else {
      await doFetch();
    }
  }, [doFetch, debounceMs]);

  /**
   * Set data manually.
   */
  const setData = useCallback((
    data: T | null | ((prev: T | null) => T | null)
  ): void => {
    setState(prev => ({
      ...prev,
      data: typeof data === 'function' ? (data as (prev: T | null) => T | null)(prev.data) : data
    }));
  }, []);

  /**
   * Clear error state.
   */
  const clearError = useCallback((): void => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Reset to initial state.
   */
  const reset = useCallback((): void => {
    setState({
      data: initialData,
      isLoading: false,
      error: null,
      isInitialized: false
    });
  }, [initialData]);

  // Fetch on mount and when deps change
  useEffect(() => {
    if (fetchOnMount) {
      doFetch();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // Deps array is intentionally spread from options to support dynamic dependency arrays.
    // This allows consumers to pass custom dependencies that trigger refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchOnMount, ...deps]);

  return {
    ...state,
    refetch,
    setData,
    clearError,
    reset
  };
}

// ============================================
// CONVENIENCE HOOKS
// ============================================

/**
 * Simplified hook for fetching list data with stats.
 */
export interface ListFetchResult<T, S = Record<string, unknown>> {
  items: T[];
  stats: S;
}

export function useListFetch<T, S = Record<string, unknown>>(options: {
  endpoint: string;
  getAuthToken?: () => string | null;
  defaultStats?: S;
  itemsKey?: string;
  deps?: unknown[];
}) {
  const {
    endpoint,
    getAuthToken,
    defaultStats = {} as S,
    itemsKey = 'items',
    deps = []
  } = options;

  return useDataFetch<ListFetchResult<T, S>>({
    getAuthToken,
    fetchFn: async (_, headers) => {
      const response = await fetch(endpoint, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}`);
      }
      const data = await response.json();
      return {
        items: data[itemsKey] || [],
        stats: data.stats || defaultStats
      };
    },
    initialData: { items: [], stats: defaultStats },
    deps
  });
}

/**
 * Hook for CRUD operations on a resource.
 */
export interface UseCrudOptions<T> {
  endpoint: string;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  itemName?: string;
}

export function useCrud<T extends { id: number | string }>(options: UseCrudOptions<T>) {
  const { endpoint, getAuthToken, showNotification, itemName = 'item' } = options;

  const getHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const token = getAuthToken?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const create = useCallback(async (data: Omit<T, 'id'>): Promise<T | null> => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`Failed to create ${itemName}`);
      const result = await response.json();
      showNotification?.(`${itemName} created successfully`, 'success');
      return result;
    } catch (err) {
      console.error(`[useCrud] Create failed:`, err);
      showNotification?.(`Failed to create ${itemName}`, 'error');
      return null;
    }
  }, [endpoint, getHeaders, showNotification, itemName]);

  const update = useCallback(async (id: number | string, data: Partial<T>): Promise<T | null> => {
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`Failed to update ${itemName}`);
      const result = await response.json();
      showNotification?.(`${itemName} updated successfully`, 'success');
      return result;
    } catch (err) {
      console.error(`[useCrud] Update failed:`, err);
      showNotification?.(`Failed to update ${itemName}`, 'error');
      return null;
    }
  }, [endpoint, getHeaders, showNotification, itemName]);

  const remove = useCallback(async (id: number | string): Promise<boolean> => {
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`Failed to delete ${itemName}`);
      showNotification?.(`${itemName} deleted successfully`, 'success');
      return true;
    } catch (err) {
      console.error(`[useCrud] Delete failed:`, err);
      showNotification?.(`Failed to delete ${itemName}`, 'error');
      return false;
    }
  }, [endpoint, getHeaders, showNotification, itemName]);

  return { create, update, remove };
}
