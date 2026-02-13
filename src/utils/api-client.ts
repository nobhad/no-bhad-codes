/**
 * ===============================================
 * API CLIENT UTILITY
 * ===============================================
 * @file src/utils/api-client.ts
 *
 * Centralized API client with automatic token expiration handling.
 * Intercepts 401 responses and handles session expiration gracefully.
 */

import { AUTH_EVENTS } from '../auth/auth-constants';

/**
 * Error codes returned by the API
 */
export const API_ERROR_CODES = {
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED'
} as const;

/**
 * API response structure for errors
 */
interface ApiErrorResponse {
  error: string;
  code?: string;
  message?: string;
}

/**
 * Configuration for the API client
 */
interface ApiClientConfig {
  onSessionExpired?: () => void;
  showNotification?: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void;
}

let clientConfig: ApiClientConfig = {};

/**
 * Configure the API client with callbacks
 */
export function configureApiClient(config: ApiClientConfig): void {
  clientConfig = { ...clientConfig, ...config };
}

/**
 * Default session expired handler - redirects to appropriate login page
 */
function handleSessionExpired(): void {
  // Dispatch session expired event for auth system integration
  window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SESSION_EXPIRED));

  // Check if we're in admin or client portal
  const isAdminPage = window.location.pathname.includes('/admin');

  // Clear all auth data
  sessionStorage.clear();
  localStorage.removeItem('adminAuth');
  localStorage.removeItem('admin_token');
  localStorage.removeItem('client_auth_token');
  localStorage.removeItem('client_auth_mode');
  localStorage.removeItem('client_auth_user');

  // Show notification if configured
  if (clientConfig.showNotification) {
    clientConfig.showNotification('Your session has expired. Please log in again.', 'warning');
  }

  // Call custom handler if provided
  if (clientConfig.onSessionExpired) {
    clientConfig.onSessionExpired();
  } else {
    // Default: redirect to login page after a brief delay
    setTimeout(() => {
      if (isAdminPage) {
        window.location.href = '/admin';
      } else {
        window.location.href = '/client/login.html';
      }
    }, 1500);
  }
}

/**
 * Check if an error response indicates token expiration
 */
function isTokenExpiredError(data: ApiErrorResponse): boolean {
  return data.code === API_ERROR_CODES.TOKEN_EXPIRED ||
         data.code === API_ERROR_CODES.TOKEN_MISSING ||
         data.code === API_ERROR_CODES.TOKEN_INVALID;
}

/**
 * Enhanced fetch wrapper that handles token expiration
 *
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Promise with the fetch response
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Ensure credentials are included for auth cookies
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers
    }
  };

  const response = await fetch(url, fetchOptions);

  // Handle 401 Unauthorized responses
  if (response.status === 401) {
    try {
      // Clone response to read body without consuming it
      const clonedResponse = response.clone();
      const data: ApiErrorResponse = await clonedResponse.json();

      if (isTokenExpiredError(data)) {
        console.warn('[ApiClient] Session expired:', data.code);
        handleSessionExpired();
      }
    } catch {
      // If we can't parse the response, still treat 401 as potential session issue
      console.warn('[ApiClient] 401 response, unable to parse body');
    }
  }

  return response;
}

/**
 * Convenience method for GET requests
 */
export async function apiGet(url: string, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, { ...options, method: 'GET' });
}

/**
 * Convenience method for POST requests with JSON body
 */
export async function apiPost(
  url: string,
  body?: unknown,
  options: RequestInit = {}
): Promise<Response> {
  return apiFetch(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

/**
 * Convenience method for PUT requests with JSON body
 */
export async function apiPut(
  url: string,
  body?: unknown,
  options: RequestInit = {}
): Promise<Response> {
  return apiFetch(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

/**
 * Convenience method for DELETE requests
 */
export async function apiDelete(url: string, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, { ...options, method: 'DELETE' });
}

/**
 * Standard API response structure
 */
interface ApiSuccessResponse<T> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Helper to parse JSON response with error handling
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData: ApiErrorResponse = await response.json().catch(() => ({
      error: `HTTP ${response.status}`
    }));
    throw new Error(errorData.message || errorData.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Parse API response and unwrap data property
 * Handles the canonical format: { success: true, data: T, message?: string }
 *
 * @example
 * const { clients } = await parseApiResponse<{ clients: Client[] }>(response);
 */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData: ApiErrorResponse = await response.json().catch(() => ({
      error: `HTTP ${response.status}`
    }));
    throw new Error(errorData.message || errorData.error || `Request failed: ${response.status}`);
  }

  const json = await response.json() as ApiSuccessResponse<T> | T;

  // Check if response follows the canonical format with data wrapper
  if (json && typeof json === 'object' && 'success' in json && json.success === true) {
    // Return unwrapped data, or empty object if no data property
    return (json as ApiSuccessResponse<T>).data ?? ({} as T);
  }

  // Legacy format - return as-is for backward compatibility
  return json as T;
}

/**
 * Install global fetch interceptor to handle 401 responses
 * Call this once during app initialization.
 * This intercepts ALL fetch calls to /api/ endpoints.
 */
export function installGlobalAuthInterceptor(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> {
    const response = await originalFetch(input, init);

    // Only intercept API calls (not static assets)
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    if (url.startsWith('/api/') && response.status === 401) {
      // Dispatch session expired event
      window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SESSION_EXPIRED));
    }

    return response;
  };
}
