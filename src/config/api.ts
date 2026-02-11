/**
 * ===============================================
 * API CONFIGURATION
 * ===============================================
 * Centralized API configuration to avoid hardcoding
 */

interface ApiConfig {
  baseUrl: string;
  endpoints: {
    auth: {
      login: string;
      logout: string;
      refresh: string;
      validate: string;
      profile: string;
      magicLink: string;
      verifyMagicLink: string;
    };
    clients: string;
    projects: string;
    intake: string;
  };
}

/**
 * Get API configuration based on environment
 */
function getApiConfig(): ApiConfig {
  // Check if running in browser and get from window globals first
  if (typeof window !== 'undefined') {
    const windowConfig = (window as any).API_CONFIG;
    if (windowConfig) {
      return windowConfig;
    }
  }

  // Environment-based configuration
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

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
    const viteApiUrl = import.meta.env?.VITE_API_URL;
    if (viteApiUrl) {
      baseUrl = viteApiUrl;
    } else if (isDevelopment) {
      baseUrl = 'http://localhost:4001';
    } else if (isProduction) {
      // In production, use VITE_API_URL or empty for same-origin
      baseUrl = '';
    } else {
      // Default for other environments
      baseUrl = '';
    }
  }

  return {
    baseUrl,
    endpoints: {
      auth: {
        login: '/api/auth/login',
        logout: '/api/auth/logout',
        refresh: '/api/auth/refresh',
        validate: '/api/auth/validate',
        profile: '/api/auth/profile',
        magicLink: '/api/auth/magic-link',
        verifyMagicLink: '/api/auth/verify-magic-link'
      },
      clients: '/api/clients',
      projects: '/api/projects',
      intake: '/api/intake'
    }
  };
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
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  refresh: '/api/auth/refresh',
  validate: '/api/auth/validate',
  profile: '/api/auth/profile',
  magicLink: '/api/auth/magic-link',
  verifyMagicLink: '/api/auth/verify-magic-link'
};

/**
 * Get admin auth endpoints
 */
export const adminAuthEndpoints = {
  // Use relative paths so requests go through the dev server proxy and
  // HttpOnly cookies are handled consistently across login and API calls.
  // Using `buildApiUrl(...)` produces absolute URLs (e.g. http://localhost:4001),
  // which can create cross-origin cookie issues in development when the
  // frontend is served from a different origin. Relative `/api/...` paths
  // will be proxied by Vite to the backend and preserve cookie behavior.
  login: '/api/auth/admin/login',
  logout: '/api/auth/admin/logout',
  validate: '/api/auth/admin/validate'
};
