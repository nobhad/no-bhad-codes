/**
 * ===============================================
 * ROUTE CONFIGURATION
 * ===============================================
 * Centralized route paths to avoid hardcoding throughout the app
 */

export const ROUTES = {
  // Public pages
  HOME: '/',
  ABOUT: '/#about',
  CONTACT: '/#contact',
  PORTFOLIO: '/#portfolio',

  // Client area
  CLIENT: {
    PORTAL: '/client/portal',
    INTAKE: '/client/intake',
    SET_PASSWORD: '/client/set-password'
  },

  // Admin area
  ADMIN: {
    DASHBOARD: '/admin',
    LOGIN: '/admin/login',
    CLIENTS: '/admin/clients',
    PROJECTS: '/admin/projects',
    MESSAGES: '/admin/messages'
  },

  // API endpoints (relative to API base URL)
  API: {
    // Auth
    AUTH: {
      LOGIN: '/api/auth/login',
      LOGOUT: '/api/auth/logout',
      REFRESH: '/api/auth/refresh',
      SET_PASSWORD: '/api/auth/set-password',
      VERIFY: '/api/auth/verify',
      ME: '/api/auth/me'
    },
    // Contact
    CONTACT: '/api/contact',
    // Intake
    INTAKE: '/api/intake',
    // Messages
    MESSAGES: {
      BASE: '/api/messages',
      THREADS: '/api/messages/threads',
      SEND: '/api/messages/send',
      READ: (threadId: string) => `/api/messages/threads/${threadId}/read`
    },
    // Clients
    CLIENTS: {
      BASE: '/api/clients',
      BY_ID: (id: string) => `/api/clients/${id}`,
      PROJECTS: (id: string) => `/api/clients/${id}/projects`
    },
    // Projects
    PROJECTS: {
      BASE: '/api/projects',
      BY_ID: (id: string) => `/api/projects/${id}`,
      UPDATES: (id: string) => `/api/projects/${id}/updates`
    },
    // Uploads
    UPLOADS: {
      BASE: '/api/uploads',
      BY_ID: (id: string) => `/api/uploads/${id}`
    },
    // Health
    HEALTH: '/api/health'
  },

  // External URLs (if needed)
  EXTERNAL: {
    FORMSPREE: (formId: string) => `https://formspree.io/f/${formId}`
  }
} as const;

/**
 * Check if a path matches a route pattern
 */
export function matchRoute(path: string, route: string): boolean {
  // Simple string comparison for exact matches
  return path === route || path.startsWith(`${route}/`);
}

/**
 * Get route with base URL
 */
export function getFullRoute(route: string, baseUrl?: string): string {
  const base = baseUrl || window.location.origin;
  return `${base}${route}`;
}

/**
 * Check if current path is in client area
 */
export function isClientRoute(path: string): boolean {
  return path.startsWith('/client');
}

/**
 * Check if current path is in admin area
 */
export function isAdminRoute(path: string): boolean {
  return path.startsWith('/admin');
}
