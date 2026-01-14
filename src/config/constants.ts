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
    RATE_LIMIT_WINDOW: 300000, // 5 minutes
    // Visitor tracking
    SESSION_ACTIVITY_THRESHOLD: 5000,
    EVENT_DEBOUNCE: 1000,
    // DevTools detection
    DEVTOOLS_CHECK_INTERVAL: 100,
    MONITORING_INTERVALS: {
      FAST: 1000,
      MEDIUM: 2000,
      SLOW: 3000,
      VERY_SLOW: 5000
    },
    // Typing animation
    TYPING_SPEED_MIN: 15,
    TYPING_SPEED_VARIANCE: 10,
    COMMAND_TYPING_SPEED: 50,
    COMMAND_TYPING_VARIANCE: 30,
    // Intro animation timing
    INTRO_COMPLETE_WAIT: 3000, // Wait after intro for section card enable
    INTRO_FINISHED_DELAY: 2000, // Delay after intro-finished class detected
    INTRO_MAX_WAIT: 10000, // Max wait if no intro-loading class
    INTRO_OBSERVER_TIMEOUT: 20000, // Max time to observe for intro completion
    // API request timeouts
    API_REQUEST_TIMEOUT: 5000 // Default fetch abort timeout
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

  // Project status colors - CSS variable references
  // These map to semantic status colors defined in colors.css
  // Use getProjectStatusColor() which reads from CSS variables at runtime
  PROJECT_STATUS_CSS_VARS: {
    pending: '--color-status-pending-border',
    'in-progress': '--color-status-progress-border',
    'in-review': '--color-status-review-border',
    completed: '--color-status-completed-border',
    'on-hold': '--color-status-hold-border',
    default: '--color-status-hold-border'
  },

  // Theme colors (use CSS variables when possible, these are fallbacks)
  THEME: {
    PRIMARY: 'var(--color-primary, #dc2626)',
    SECONDARY: 'var(--color-secondary, #ff6b6b)',
    DARK: 'var(--color-dark, #000000)',
    LIGHT: 'var(--color-light, #ffffff)',
    NEUTRAL: 'var(--color-neutral-400, #6B7280)'
  },

  // Chart color CSS variable mappings
  // Use getChartColors() to read these at runtime
  CHART_COLOR_VARS: {
    PRIMARY: '--color-brand-primary',
    DARK: '--color-dark',
    GRAY_600: '--color-gray-600',
    GRAY_400: '--color-gray-400',
    GRAY_300: '--color-gray-300',
    WHITE: '--color-white',
    GRID: '--color-shadow-sm'
  },

  // Storage keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    AUTH_USER: 'auth_user',
    THEME: 'theme',
    FORM_BACKUP: 'form_backup_',
    // Visitor tracking
    VISITOR_ID: 'nbw_visitor_id',
    SESSION_ID: 'nbw_session_id',
    SESSION_DATA: 'nbw_session',
    TRACKING_EVENTS: 'nbw_tracking_events'
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

  // UI dimensions and thresholds
  UI: {
    // Business card 3D
    CARD_PERSPECTIVE: 1000,
    CARD_MAGNETIC_RANGE: 200,
    CARD_FLIP_ROTATION: 180,
    // DevTools detection
    DEVTOOLS_SIZE_THRESHOLD: 200,
    // Max events stored
    MAX_STORED_EVENTS: 1000
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
 * Get project status color from CSS variables
 * Reads the color value at runtime from CSS custom properties
 */
export function getProjectStatusColor(status: string): string {
  const cssVarName =
    APP_CONSTANTS.PROJECT_STATUS_CSS_VARS[
      status as keyof typeof APP_CONSTANTS.PROJECT_STATUS_CSS_VARS
    ] || APP_CONSTANTS.PROJECT_STATUS_CSS_VARS.default;

  // Read color from CSS variable at runtime
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const computedStyle = window.getComputedStyle(document.documentElement);
    const color = computedStyle.getPropertyValue(cssVarName).trim();
    if (color) return color;
  }

  // Fallback for SSR or if CSS variable not found
  const fallbackColors: Record<string, string> = {
    '--color-status-pending-border': '#f59e0b',
    '--color-status-progress-border': '#3b82f6',
    '--color-status-review-border': '#8b5cf6',
    '--color-status-completed-border': '#10b981',
    '--color-status-hold-border': '#6b7280'
  };
  return fallbackColors[cssVarName] || '#6b7280';
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

/**
 * Chart color fallbacks for SSR or when CSS variables unavailable
 */
const CHART_COLOR_FALLBACKS: Record<string, string> = {
  '--color-brand-primary': '#dc2626',
  '--color-dark': '#333333',
  '--color-gray-600': '#525252',
  '--color-gray-400': '#a3a3a3',
  '--color-gray-300': '#d4d4d4',
  '--color-white': '#ffffff',
  '--color-shadow-sm': 'rgba(0, 0, 0, 0.05)'
};

/**
 * Get a single chart color from CSS variable
 */
export function getChartColor(
  colorKey: keyof typeof APP_CONSTANTS.CHART_COLOR_VARS
): string {
  const cssVarName = APP_CONSTANTS.CHART_COLOR_VARS[colorKey];

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const computedStyle = window.getComputedStyle(document.documentElement);
    const color = computedStyle.getPropertyValue(cssVarName).trim();
    if (color) return color;
  }

  return CHART_COLOR_FALLBACKS[cssVarName] || '#333333';
}

/**
 * Get all chart colors as an object for Chart.js configuration
 * Reads from CSS variables at runtime
 */
export function getChartColors(): Record<string, string> {
  const colors: Record<string, string> = {};

  for (const key of Object.keys(
    APP_CONSTANTS.CHART_COLOR_VARS
  ) as (keyof typeof APP_CONSTANTS.CHART_COLOR_VARS)[]) {
    colors[key] = getChartColor(key);
  }

  return colors;
}

/**
 * Get chart color with alpha transparency
 */
export function getChartColorWithAlpha(
  colorKey: keyof typeof APP_CONSTANTS.CHART_COLOR_VARS,
  alpha: number
): string {
  const color = getChartColor(colorKey);

  // If it's already rgba, extract and replace alpha
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/, `${alpha})`);
  }

  // If it's rgb, convert to rgba
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }

  // If it's hex, convert to rgba
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}
