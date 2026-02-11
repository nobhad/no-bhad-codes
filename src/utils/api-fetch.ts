/**
 * ===============================================
 * API FETCH UTILITY
 * ===============================================
 * @file src/utils/api-fetch.ts
 *
 * Centralized fetch wrapper that handles authentication errors globally.
 * Automatically triggers session expiration on 401 responses.
 */

import { AUTH_EVENTS } from '../auth/auth-constants';

/**
 * Check if response is a 401 Unauthorized and trigger session expiration
 */
function handleUnauthorized(response: Response): void {
  if (response.status === 401) {
    // Dispatch session expired event
    window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SESSION_EXPIRED));
  }
}

/**
 * Fetch wrapper that handles 401 responses globally
 * Use this instead of raw fetch() for API calls
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include'
  });

  // Check for 401 and trigger session expiration
  handleUnauthorized(response);

  return response;
}

/**
 * Install global fetch interceptor to handle 401 responses
 * Call this once during app initialization
 */
export function installGlobalAuthInterceptor(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> {
    const response = await originalFetch(input, init);

    // Only intercept API calls (not static assets)
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url.startsWith('/api/')) {
      handleUnauthorized(response);
    }

    return response;
  };
}
