/**
 * ===============================================
 * API CONFIGURATION
 * ===============================================
 * Centralized API configuration to avoid hardcoding
 */

/**
 * Runtime API configuration. Mirrors the `APIConfig` type used for
 * `window.API_CONFIG` in src/types/global.d.ts so the window value is
 * structurally assignable with no cast needed. The previous `endpoints`
 * field was dead — the actual paths live in `authEndpoints` /
 * `adminAuthEndpoints` below, and no caller read `apiConfig.endpoints`
 * anywhere in the codebase.
 */
interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Get API configuration based on environment
 */
function getApiConfig(): ApiConfig {
  // Check if running in browser and get from window globals first
  if (typeof window !== 'undefined' && window.API_CONFIG) {
    return window.API_CONFIG;
  }

  // import.meta.env, not process.env: Vite replaces these with literals at
  // build time, so the development branch below is provably dead in a
  // production build and gets shaken out with it. Reading process.env.NODE_ENV
  // instead left the bundler unable to prove that, and shipped the
  // http://localhost:4001 fallback as a string inside the production bundle —
  // unreachable, but there.

  // Try to get from environment variables or meta tags
  let baseUrl = '';

  if (typeof window !== 'undefined') {
    // Try to get from meta tag
    const apiBaseMeta = document.querySelector('meta[name="api-base-url"]');
    if (apiBaseMeta) {
      baseUrl = apiBaseMeta.getAttribute('content') || '';
    }
  }

  // Fallback to environment-based detection
  if (!baseUrl) {
    // Check for Vite environment variable (set at build time)
    // Same-origin by default, in every environment. Dev does not need an
    // absolute URL: vite.config proxies /api to the API server, so a relative
    // path already reaches it. Hard-coding http://localhost:4001 as a dev
    // fallback only put that string in the production bundle, where it was
    // unreachable but present, and no branch guard reliably removed it.
    baseUrl = import.meta.env.VITE_API_URL || '';
  }

  return { baseUrl };
}

export const apiConfig = getApiConfig();

/**
 * Third-party API base URLs
 * Centralized to avoid hardcoding throughout the codebase
 * These can be overridden via environment variables if needed
 */
export const THIRD_PARTY_APIS = {
  FORMSPREE: import.meta.env.VITE_FORMSPREE_BASE_URL || 'https://formspree.io',
  EMAILJS: import.meta.env.VITE_EMAILJS_BASE_URL || 'https://api.emailjs.com'
} as const;

/**
 * Build Formspree form submission URL
 */
export function getFormspreeUrl(formId: string): string {
  return `${THIRD_PARTY_APIS.FORMSPREE}/f/${formId}`;
}

/**
 * Build full API URL from endpoint
 */
export function buildApiUrl(endpoint: string): string {
  return `${apiConfig.baseUrl}${endpoint}`;
}

/**
 * Get auth endpoints (client)
 * Use relative paths so requests go through the dev server proxy and
 * HttpOnly cookies are handled consistently across login and API calls.
 * Using `buildApiUrl(...)` produces absolute URLs (e.g. http://localhost:4001),
 * which can create cross-origin cookie issues in development when the
 * frontend is served from a different origin. Relative `/api/...` paths
 * will be proxied by Vite to the backend and preserve cookie behavior.
 */
export const authEndpoints = {
  // Unified login endpoint — handles both admin and client authentication.
  // Routes to admin or client path server-side based on the submitted email.
  login: '/api/auth/portal-login',
  logout: '/api/auth/logout',
  refresh: '/api/auth/refresh',
  validate: '/api/auth/validate',
  profile: '/api/auth/profile',
  magicLink: '/api/auth/magic-link',
  verifyMagicLink: '/api/auth/verify-magic-link',
  forgotPassword: '/api/auth/forgot-password'
};

/**
 * Get admin auth endpoints
 */
export const adminAuthEndpoints = {
  // Use relative paths so requests go through the dev server proxy and
  // HttpOnly cookies are handled consistently across login and API calls.
  // Login is unified through authEndpoints.login — server detects admin vs
  // client by email. This object only holds admin-specific session routes.
  logout: '/api/auth/admin/logout',
  validate: '/api/auth/validate'
};
