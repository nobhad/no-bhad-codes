/**
 * ===============================================
 * DEBUG LOGGER UTILITY
 * ===============================================
 * @file src/utils/logger.ts
 *
 * Centralized logging utility with configurable log levels.
 * All debug logs are automatically disabled in production.
 *
 * Usage:
 *   import { createLogger } from '../utils/logger';
 *   const logger = createLogger('MyModule');
 *   logger.debug('Debug message');  // Only in dev
 *   logger.info('Info message');    // Only in dev
 *   logger.warn('Warning');         // Always shown
 *   logger.error('Error');          // Always shown
 */

import { isDev, getDebugMode } from '../core/env';

/**
 * Log levels in order of severity
 */
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

/**
 * Logger configuration
 */
interface LoggerConfig {
  /** Minimum log level to display */
  level: LogLevel;
  /** Whether to include timestamps */
  timestamps: boolean;
  /** Whether logging is enabled */
  enabled: boolean;
}

/**
 * Global logger configuration
 */
const config: LoggerConfig = {
  level: isDev() ? 'DEBUG' : 'WARN',
  timestamps: false,
  enabled: true
};

/**
 * Configure the global logger settings
 */
export function configureLogger(options: Partial<LoggerConfig>): void {
  Object.assign(config, options);
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): Readonly<LoggerConfig> {
  return { ...config };
}

/**
 * Format log message with optional timestamp
 */
function formatMessage(prefix: string, timestamp: boolean): string {
  if (timestamp) {
    const now = new Date().toISOString().split('T')[1].slice(0, 12);
    return `[${now}] [${prefix}]`;
  }
  return `[${prefix}]`;
}

/**
 * Check if a log level should be displayed
 */
function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

/**
 * Logger interface
 */
export interface Logger {
  log: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  /** Create a child logger with extended prefix */
  child: (subPrefix: string) => Logger;
}

/**
 * Create a logger with a specific prefix
 * @param prefix - Module or component name for log identification
 */
export function createLogger(prefix: string): Logger {
  const debug = getDebugMode();

  const logger: Logger = {
    /**
     * Log debug message (only in development with DEBUG level)
     */
    log(...args: unknown[]): void {
      if (debug && shouldLog('DEBUG')) {
        console.log(formatMessage(prefix, config.timestamps), ...args);
      }
    },

    /**
     * Log debug message (alias for log)
     */
    debug(...args: unknown[]): void {
      if (debug && shouldLog('DEBUG')) {
        // eslint-disable-next-line no-console
        console.debug(formatMessage(prefix, config.timestamps), ...args);
      }
    },

    /**
     * Log info message (only in development with INFO level or lower)
     */
    info(...args: unknown[]): void {
      if (debug && shouldLog('INFO')) {
        // eslint-disable-next-line no-console
        console.info(formatMessage(prefix, config.timestamps), ...args);
      }
    },

    /**
     * Log warning (always shown unless SILENT or ERROR level)
     */
    warn(...args: unknown[]): void {
      if (shouldLog('WARN')) {
        console.warn(formatMessage(prefix, config.timestamps), ...args);
      }
    },

    /**
     * Log error (always shown unless SILENT)
     */
    error(...args: unknown[]): void {
      if (shouldLog('ERROR')) {
        console.error(formatMessage(prefix, config.timestamps), ...args);
      }
    },

    /**
     * Create a child logger with extended prefix
     */
    child(subPrefix: string): Logger {
      return createLogger(`${prefix}:${subPrefix}`);
    }
  };

  return logger;
}

/**
 * Default logger instance
 */
export const logger = createLogger('App');

/**
 * Check if debug mode is enabled
 */
export const isDebugMode = (): boolean => isDev();

/**
 * Silence all logs (useful for tests)
 */
export function silenceLogs(): void {
  configureLogger({ enabled: false });
}

/**
 * Restore logs after silencing
 */
export function restoreLogs(): void {
  configureLogger({ enabled: true });
}
