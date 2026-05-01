/**
 * ===============================================
 * PORTAL FETCH HOOK
 * ===============================================
 * @file src/react/hooks/usePortalFetch.ts
 *
 * Shared data-fetching hook for all portal components.
 * Eliminates repeated auth header building, error handling,
 * and AbortController cleanup across portal views.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { unwrapApiData, apiFetch, HttpApiError } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';
import { formatErrorMessage } from '@/utils/error-utils';

const logger = createLogger('usePortalFetch');

// ============================================
// TYPES
// ============================================

interface UsePortalFetchOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
}

interface FetchOptions {
  /** HTTP method */
  method?: string;
  /** Request body */
  body?: unknown;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Whether to unwrap { data: ... } response envelope */
  unwrap?: boolean;
}

interface UsePortalFetchReturn {
  /** Perform an authenticated fetch, returning parsed JSON */
  portalFetch: <T>(url: string, options?: FetchOptions) => Promise<T>;
}

// ============================================
// HOOK
// ============================================

/**
 * Shared hook providing authenticated fetch for portal components.
 *
 * Usage:
 * ```ts
 * const { portalFetch } = usePortalFetch({ getAuthToken });
 *
 * // Simple GET
 * const data = await portalFetch<MyType>(API_ENDPOINTS.SOME_ENDPOINT);
 *
 * // POST with body
 * const result = await portalFetch<MyType>(url, { method: 'POST', body: payload });
 * ```
 */
export function usePortalFetch({ getAuthToken }: UsePortalFetchOptions): UsePortalFetchReturn {
  // Ref avoids stale closure over getAuthToken
  const getAuthTokenRef = useRef(getAuthToken);
  useEffect(() => {
    getAuthTokenRef.current = getAuthToken;
  }, [getAuthToken]);

  const portalFetch = useCallback(async <T>(
    url: string,
    options: FetchOptions = {}
  ): Promise<T> => {
    const { method = 'GET', body, headers: extraHeaders, unwrap = true } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders
    };

    const fetchOptions: RequestInit = {
      method,
      headers
    };

    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await apiFetch(url, fetchOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Throw a rich error so the catch site can branch on status
      // (rate-limited, circuit-open, idempotency-conflict) instead of
      // string-matching a generic message.
      throw new HttpApiError(response.status, errorData as Record<string, unknown>);
    }

    const json = await response.json();
    return (unwrap ? unwrapApiData<T>(json) : json) as T;
  }, []);

  return { portalFetch };
}

// ============================================
// COMPANION: usePortalData
// ============================================

interface UsePortalDataOptions<T> {
  /** Auth token getter */
  getAuthToken?: () => string | null;
  /** API endpoint URL */
  url: string;
  /** Transform the response before setting state */
  transform?: (data: unknown) => T;
  /** Whether to fetch on mount (default: true) */
  fetchOnMount?: boolean;
}

interface UsePortalDataReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  /** Perform an authenticated fetch */
  portalFetch: <R>(url: string, options?: FetchOptions) => Promise<R>;
}

/**
 * Higher-level hook that combines usePortalFetch with loading/error state.
 * Use this when a component needs a single primary data fetch.
 *
 * ```ts
 * const { data, isLoading, error, refetch } = usePortalData<MyType[]>({
 *   getAuthToken,
 *   url: API_ENDPOINTS.MY_ENDPOINT,
 *   transform: (raw) => (raw as { items: MyType[] }).items
 * });
 * ```
 */
export function usePortalData<T>({
  getAuthToken,
  url,
  transform,
  fetchOnMount = true
}: UsePortalDataOptions<T>): UsePortalDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(fetchOnMount);
  const [error, setError] = useState<string | null>(null);

  const { portalFetch } = usePortalFetch({ getAuthToken });

  // Store transform in a ref to avoid re-creating fetchData when
  // callers pass an unmemoized inline function. Without this,
  // an unstable transform reference causes infinite re-fetches.
  const transformRef = useRef(transform);
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch(url, { signal });

      if (!response.ok) {
        throw new Error('Failed to load data');
      }

      const json = await response.json();
      const unwrapped = unwrapApiData<unknown>(json);
      const currentTransform = transformRef.current;
      setData(currentTransform ? currentTransform(unwrapped) : unwrapped as T);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const message = formatErrorMessage(err, 'Failed to load data');
      logger.error(`Fetch error for ${url}:`, err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  // Fetch on mount with AbortController cleanup
  useEffect(() => {
    if (!fetchOnMount) return;
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData, fetchOnMount]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch, portalFetch };
}
