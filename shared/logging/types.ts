/**
 * ===============================================
 * SHARED LOGGING TYPES
 * ===============================================
 * @file shared/logging/types.ts
 *
 * Type definitions for the unified logging system.
 * Shared between client and server.
 */

// ============================================
// Log Level Types
// ============================================

/**
 * Log level enum values
 */
export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
} as const;

export type LogLevelType = keyof typeof LogLevel;
export type LogLevelValue = (typeof LogLevel)[LogLevelType];

/**
 * Map log level to numeric value
 */
export function getLogLevelValue(level: LogLevelType): LogLevelValue {
  return LogLevel[level];
}

/**
 * Parse string to log level
 */
export function parseLogLevel(level: string): LogLevelType {
  const normalized = level.toUpperCase() as LogLevelType;
  if (normalized in LogLevel) {
    return normalized;
  }
  return 'INFO';
}

// ============================================
// Log Entry Types
// ============================================

/**
 * Base log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevelType;
  message: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Extended log entry with error context
 */
export interface ErrorLogEntry extends LogEntry {
  level: 'ERROR';
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * HTTP request log entry
 */
export interface HttpLogEntry extends LogEntry {
  category: 'HTTP';
  request: {
    method: string;
    url: string;
    ip?: string;
    userAgent?: string;
    contentLength?: number;
    contentType?: string;
  };
  response?: {
    statusCode: number;
    duration?: number;
  };
  requestId?: string;
  userId?: string;
}

/**
 * Security event log entry
 */
export interface SecurityLogEntry extends LogEntry {
  category: 'SECURITY';
  event: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  details?: Record<string, unknown>;
}

/**
 * Database operation log entry
 */
export interface DatabaseLogEntry extends LogEntry {
  category: 'DATABASE';
  operation: string;
  table?: string;
  duration?: number;
  query?: string;
  rowCount?: number;
}

/**
 * Performance log entry
 */
export interface PerformanceLogEntry extends LogEntry {
  category: 'PERFORMANCE';
  operation: string;
  duration: number;
  threshold?: number;
  details?: Record<string, unknown>;
}

/**
 * Union type for all log entries
 */
export type AnyLogEntry =
  | LogEntry
  | ErrorLogEntry
  | HttpLogEntry
  | SecurityLogEntry
  | DatabaseLogEntry
  | PerformanceLogEntry;

// ============================================
// Logger Interface
// ============================================

/**
 * Unified logger interface
 * Implemented by both client and server loggers
 */
export interface Logger {
  /**
   * Log an error message
   */
  error(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log a trace message (most verbose)
   */
  trace?(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger;

  /**
   * Log an error with full stack trace
   */
  logError?(error: Error, context?: Record<string, unknown>): void;
}

/**
 * Extended logger interface for server
 */
export interface ServerLogger extends Logger {
  /**
   * Log an HTTP request
   */
  logRequest(req: unknown, res: unknown, duration?: number): void;

  /**
   * Log a security event
   */
  logSecurity(event: string, details?: Record<string, unknown>, req?: unknown): void;

  /**
   * Log a database operation
   */
  logDatabase(operation: string, details?: Record<string, unknown>): void;

  /**
   * Log an error with full context
   */
  logError(error: Error, context?: Record<string, unknown>): void;

  /**
   * Create a child logger with additional context (returns ServerLogger)
   */
  child(context: Record<string, unknown>): ServerLogger;
}

// ============================================
// Logger Configuration
// ============================================

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevelType;

  /** Enable console output */
  console: boolean;

  /** Enable file output (server only) */
  file?: boolean;

  /** Path to log file (server only) */
  filePath?: string;

  /** Path to error log file (server only) */
  errorFilePath?: string;

  /** Maximum log file size before rotation */
  maxFileSize?: string;

  /** Maximum number of log files to keep */
  maxFiles?: string;

  /** Date format for timestamps */
  dateFormat?: string;

  /** Enable colored output */
  enableColors?: boolean;

  /** Default category for logs */
  defaultCategory?: string;

  /** Additional context to include in all logs */
  defaultContext?: Record<string, unknown>;
}

/**
 * Default logger configuration
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: 'INFO',
  console: true,
  file: false,
  enableColors: true
};

// ============================================
// Transport Types
// ============================================

/**
 * Log transport interface (server only)
 */
export interface LogTransport {
  /** Transport name for identification */
  name: string;

  /** Minimum log level for this transport */
  level: LogLevelType;

  /** Write a log entry */
  write(entry: AnyLogEntry): void | Promise<void>;

  /** Flush any buffered logs */
  flush?(): void | Promise<void>;

  /** Close the transport */
  close?(): void | Promise<void>;
}

/**
 * Console transport configuration
 */
export interface ConsoleTransportConfig {
  level?: LogLevelType;
  enableColors?: boolean;
  includeTimestamp?: boolean;
}

/**
 * File transport configuration
 */
export interface FileTransportConfig {
  level?: LogLevelType;
  filePath: string;
  maxFileSize?: string;
  maxFiles?: string;
}

/**
 * Sentry transport configuration
 */
export interface SentryTransportConfig {
  level?: LogLevelType;
  dsn: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

// ============================================
// Log Formatting
// ============================================

/**
 * Format a log entry for console output
 */
export function formatLogEntry(entry: AnyLogEntry, options?: { includeTimestamp?: boolean; includeLevel?: boolean }): string {
  const parts: string[] = [];

  if (options?.includeTimestamp !== false) {
    parts.push(entry.timestamp);
  }

  if (options?.includeLevel !== false) {
    parts.push(`[${entry.level}]`);
  }

  if (entry.category) {
    parts.push(`[${entry.category}]`);
  }

  parts.push(entry.message);

  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    parts.push(`| ${JSON.stringify(entry.metadata)}`);
  }

  if ('error' in entry && entry.error?.stack) {
    parts.push(`\n${entry.error.stack}`);
  }

  return parts.join(' ');
}

/**
 * Console color codes
 */
export const LOG_COLORS = {
  ERROR: '\x1b[31m',   // Red
  WARN: '\x1b[33m',    // Yellow
  INFO: '\x1b[36m',    // Cyan
  DEBUG: '\x1b[35m',   // Magenta
  TRACE: '\x1b[90m',   // Gray
  RESET: '\x1b[0m'
} as const;

/**
 * Colorize text for console output
 */
export function colorize(text: string, level: LogLevelType): string {
  const color = LOG_COLORS[level];
  return `${color}${text}${LOG_COLORS.RESET}`;
}

// ============================================
// Utility Types
// ============================================

/**
 * Log context passed through child loggers
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  category?: string;
  [key: string]: unknown;
}

/**
 * Options for creating a log entry
 */
export interface LogOptions {
  category?: string;
  metadata?: Record<string, unknown>;
  error?: Error;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}
