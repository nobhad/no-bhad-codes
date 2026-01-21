/**
 * ===============================================
 * CLIENT LOGGING SERVICE
 * ===============================================
 * @file src/utils/logging/index.ts
 *
 * Client-side logging facade with console output
 * and optional remote logging support.
 */

import {
  type Logger,
  type LogLevelType,
  type LogEntry,
  LogLevel
} from '../../../shared/logging/types';

// Re-export types
export * from '../../../shared/logging/types';

/**
 * Client logger configuration
 */
export interface ClientLoggerConfig {
  /** Minimum log level to output */
  level: LogLevelType;

  /** Enable console output */
  console: boolean;

  /** Enable colored output */
  enableColors: boolean;

  /** Logger name/category */
  name?: string;

  /** Send errors to remote endpoint */
  remoteErrorReporting?: boolean;

  /** Remote logging endpoint */
  remoteEndpoint?: string;

  /** Additional context for all logs */
  context?: Record<string, unknown>;
}

const DEFAULT_CLIENT_CONFIG: ClientLoggerConfig = {
  level: 'INFO',
  console: true,
  enableColors: true,
  remoteErrorReporting: false
};

/**
 * Client Logger Implementation
 */
export class ClientLogger implements Logger {
  private config: ClientLoggerConfig;
  private levelValue: number;
  private context: Record<string, unknown> = {};

  constructor(config: Partial<ClientLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CLIENT_CONFIG, ...config };
    this.levelValue = LogLevel[this.config.level];

    if (config.context) {
      this.context = config.context;
    }
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevelType): boolean {
    return LogLevel[level] <= this.levelValue;
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevelType,
    message: string,
    metadata?: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      category: this.config.name,
      metadata: {
        ...this.context,
        ...metadata
      }
    };
  }

  /**
   * Output to console
   */
  private writeToConsole(entry: LogEntry): void {
    if (!this.config.console) return;

    const prefix = this.config.name ? `[${this.config.name}]` : '';
    const message = prefix ? `${prefix} ${entry.message}` : entry.message;

    const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

    // Use appropriate console method
    switch (entry.level) {
    case 'ERROR':
      if (hasMetadata) {
        console.error(message, entry.metadata);
      } else {
        console.error(message);
      }
      break;
    case 'WARN':
      if (hasMetadata) {
        console.warn(message, entry.metadata);
      } else {
        console.warn(message);
      }
      break;
    case 'DEBUG':
    case 'TRACE':
      // Use console.log for debug/trace (console.debug not in allowed list)
      if (hasMetadata) {
        console.log(`[${entry.level}]`, message, entry.metadata);
      } else {
        console.log(`[${entry.level}]`, message);
      }
      break;
    default:
      if (hasMetadata) {
        console.log(message, entry.metadata);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Send error to remote endpoint
   */
  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.remoteErrorReporting || !this.config.remoteEndpoint) {
      return;
    }

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...entry,
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      });
    } catch (error) {
      // Silently fail - don't want to cause infinite loop
      console.error('Failed to send log to remote:', error);
    }
  }

  /**
   * Internal log method
   */
  private logInternal(
    level: LogLevelType,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, message, metadata);
    this.writeToConsole(entry);

    // Send errors to remote if configured
    if (level === 'ERROR' && this.config.remoteErrorReporting) {
      this.sendToRemote(entry);
    }
  }

  // ============================================
  // Public Interface
  // ============================================

  error(message: string, metadata?: Record<string, unknown>): void {
    this.logInternal('ERROR', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.logInternal('WARN', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.logInternal('INFO', message, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.logInternal('DEBUG', message, metadata);
  }

  trace(message: string, metadata?: Record<string, unknown>): void {
    this.logInternal('TRACE', message, metadata);
  }

  /**
   * Log shorthand (uses info level)
   */
  log(message: string, metadata?: Record<string, unknown>): void {
    this.info(message, metadata);
  }

  /**
   * Log an error with stack trace
   */
  logError(error: Error, context?: Record<string, unknown>): void {
    this.error(error.message, {
      ...context,
      errorName: error.name,
      stack: error.stack
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    return new ClientLogger({
      ...this.config,
      context: {
        ...this.context,
        ...context
      }
    });
  }

  /**
   * Update log level at runtime
   */
  setLevel(level: LogLevelType): void {
    this.config.level = level;
    this.levelValue = LogLevel[level];
  }

  /**
   * Enable/disable console output
   */
  setConsoleEnabled(enabled: boolean): void {
    this.config.console = enabled;
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a named logger
 */
export function createLogger(name?: string, config?: Partial<ClientLoggerConfig>): ClientLogger {
  const isDev = import.meta.env?.MODE === 'development' ||
                import.meta.env?.DEV === true ||
                window.location.hostname === 'localhost';

  return new ClientLogger({
    level: isDev ? 'DEBUG' : 'INFO',
    console: true,
    enableColors: true,
    name,
    ...config
  });
}

/**
 * Create a child logger with context
 */
export function createChildLogger(
  parent: Logger,
  context: Record<string, unknown>
): Logger {
  return parent.child(context);
}

// ============================================
// Default Loggers
// ============================================

/**
 * Default application logger
 */
export const logger = createLogger('App');

/**
 * Create component-specific loggers
 */
export const loggers = {
  auth: createLogger('Auth'),
  api: createLogger('API'),
  admin: createLogger('Admin'),
  client: createLogger('Client'),
  performance: createLogger('Performance')
};

export default logger;
