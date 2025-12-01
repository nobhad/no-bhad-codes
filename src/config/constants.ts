/**
 * ===============================================
 * APPLICATION CONSTANTS
 * ===============================================
 * Centralized constants to avoid hardcoding throughout the app
 */

export const APP_CONSTANTS = {
  // Timing and intervals (in milliseconds)
  TIMERS: {
    FORM_AUTOSAVE: 30000,
    PAGE_TRANSITION: 600,
    ANIMATION_DURATION: 300,
    DEBOUNCE_DEFAULT: 300,
    TOKEN_REFRESH_CHECK: 6 * 24 * 60 * 60 * 1000, // 6 days
    PERFORMANCE_MONITORING: 30000,
    INTEGRITY_CHECK: 3000,
    RATE_LIMIT_WINDOW: 300000 // 5 minutes
  },

  // Performance thresholds (in milliseconds)
  PERFORMANCE: {
    FCP_GOOD: 1800,
    FCP_NEEDS_WORK: 3000,
    LOAD_GOOD: 3000,
    LOAD_NEEDS_WORK: 5000
  },

  // Rate limiting
  RATE_LIMITS: {
    FORM_SUBMISSIONS: 5,
    LOGIN_ATTEMPTS: 3,
    API_REQUESTS: 100
  },

  // Project status colors
  PROJECT_COLORS: {
    pending: '#FFA500',
    'in-progress': '#3B82F6',
    'in-review': '#8B5CF6',
    completed: '#10B981',
    'on-hold': '#6B7280',
    default: '#6B7280'
  },

  // Theme colors (use CSS variables when possible, these are fallbacks)
  THEME: {
    PRIMARY: 'var(--color-primary, #00ff41)',
    SECONDARY: 'var(--color-secondary, #ff6b6b)',
    DARK: 'var(--color-dark, #000000)',
    LIGHT: 'var(--color-light, #ffffff)',
    NEUTRAL: 'var(--color-neutral-400, #6B7280)'
  },

  // Storage keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    AUTH_USER: 'auth_user',
    THEME: 'theme',
    FORM_BACKUP: 'form_backup_'
  },

  // API configuration
  API: {
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
  },

  // File upload limits
  UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_FILES: 5,
    ALLOWED_TYPES: ['jpeg', 'jpg', 'png', 'pdf', 'doc', 'docx', 'txt', 'zip', 'rar']
  },

  // Security
  SECURITY: {
    PASSWORD_MIN_LENGTH: 8,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
    CSRF_TOKEN_LENGTH: 32
  },

  // Animation easing
  EASING: {
    DEFAULT: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    SMOOTH: 'cubic-bezier(0.4, 0, 0.2, 1)',
    BOUNCE: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  },

  // Breakpoints (should match CSS)
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1200,
    LARGE: 1440
  },

  // URL patterns
  PATTERNS: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^[+]?[1-9][\d]{0,15}$/,
    URL: /^https?:\/\/.+/
  }
} as const;

/**
 * Get project status color
 */
export function getProjectStatusColor(status: string): string {
  return (
    APP_CONSTANTS.PROJECT_COLORS[status as keyof typeof APP_CONSTANTS.PROJECT_COLORS] ||
    APP_CONSTANTS.PROJECT_COLORS.default
  );
}

/**
 * Get responsive breakpoint
 */
export function getBreakpoint(size: keyof typeof APP_CONSTANTS.BREAKPOINTS): number {
  return APP_CONSTANTS.BREAKPOINTS[size];
}

/**
 * Get storage key
 */
export function getStorageKey(key: keyof typeof APP_CONSTANTS.STORAGE_KEYS): string {
  return APP_CONSTANTS.STORAGE_KEYS[key];
}
