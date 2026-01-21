/**
 * ===============================================
 * UNIFIED SERVER LOGGING SERVICE
 * ===============================================
 * @file server/services/logging/index.ts
 *
 * Centralized logging facade for the server.
 * Provides a single interface for all logging operations
 * with configurable transports.
 */

import {
  type ServerLogger,
  type LogTransport,
  type AnyLogEntry,
  type LogEntry,
  type LogLevelType,
  type LoggerConfig,
  type LogContext,
  type LogOptions,
  LogLevel,
  parseLogLevel,
  DEFAULT_LOGGER_CONFIG
} from '../../../shared/logging/types.js';

import { createConsoleTransport } from './console-transport.js';
import { createFileTransport, createErrorFileTransport } from './file-transport.js';

// Re-export types
export * from '../../../shared/logging/types.js';
export { createConsoleTransport } from './console-transport.js';
export { createFileTransport, createErrorFileTransport } from './file-transport.js';

/**
 * Unified Logger Service
 */
export class UnifiedLoggerService implements ServerLogger {
  private config: LoggerConfig;
  private transports: LogTransport[] = [];
  private levelValue: number;
  private context: LogContext = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };
    this.levelValue = LogLevel[this.config.level];

    this.initializeTransports();
  }

  /**
   * Initialize transports based on configuration
   */
  private initializeTransports(): void {
    // Console transport
    if (this.config.console) {
      this.transports.push(
        createConsoleTransport({
          level: this.config.level,
          enableColors: this.config.enableColors
        })
      );
    }

    // File transport
    if (this.config.file && this.config.filePath) {
      this.transports.push(
        createFileTransport({
          level: this.config.level,
          filePath: this.config.filePath,
          maxFileSize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles
        })
      );

      // Separate error file
      if (this.config.errorFilePath) {
        this.transports.push(
          createErrorFileTransport(this.config.errorFilePath, {
            maxFileSize: this.config.maxFileSize,
            maxFiles: this.config.maxFiles
          })
        );
      }
    }
  }

  /**
   * Add a custom transport
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * Remove a transport by name
   */
  removeTransport(name: string): void {
    this.transports = this.transports.filter((t) => t.name !== name);
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
    options: LogOptions = {}
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      category: options.category || this.config.defaultCategory || this.context.category,
      metadata: {
        ...this.config.defaultContext,
        ...this.context,
        ...options.metadata,
        ...(options.requestId && { requestId: options.requestId }),
        ...(options.userId && { userId: options.userId }),
        ...(options.ip && { ip: options.ip }),
        ...(options.userAgent && { userAgent: options.userAgent })
      }
    };
  }

  /**
   * Write entry to all transports
   */
  private writeToTransports(entry: AnyLogEntry): void {
    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (error) {
        console.error(`Transport ${transport.name} failed:`, error);
      }
    }
  }

  /**
   * Internal log method
   */
  private log(level: LogLevelType, message: string, options?: LogOptions): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, message, options);
    this.writeToTransports(entry);
  }

  // ============================================
  // Public Logger Interface
  // ============================================

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('ERROR', message, { metadata });
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('WARN', message, { metadata });
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('INFO', message, { metadata });
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('DEBUG', message, { metadata });
  }

  trace(message: string, metadata?: Record<string, unknown>): void {
    this.log('TRACE', message, { metadata });
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ServerLogger {
    const childLogger = Object.create(this);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  // ============================================
  // Extended Server Logger Interface
  // ============================================

  /**
   * Log an error with full context
   */
  logError(error: Error, context: LogOptions = {}): void {
    const entry: AnyLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message,
      category: context.category || 'APPLICATION',
      metadata: {
        ...this.config.defaultContext,
        ...this.context,
        ...context.metadata
      },
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as NodeJS.ErrnoException).code
      }
    };

    this.writeToTransports(entry);
  }

  /**
   * Log HTTP request
   */
  logRequest(req: { method?: string; url?: string; ip?: string; get?: (key: string) => string | undefined; id?: string; user?: { id?: unknown } }, res: { statusCode?: number }, duration?: number): void {
    const statusCode = res.statusCode || 200;
    const level: LogLevelType = statusCode >= 400 ? 'WARN' : 'INFO';

    const entry: AnyLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: `${req.method || 'UNKNOWN'} ${req.url || 'UNKNOWN'} ${statusCode}`,
      category: 'HTTP',
      request: {
        method: req.method || 'UNKNOWN',
        url: req.url || 'UNKNOWN',
        ip: req.ip,
        userAgent: req.get?.('user-agent'),
        contentLength: parseInt(req.get?.('content-length') || '0'),
        contentType: req.get?.('content-type')
      },
      response: {
        statusCode,
        duration
      },
      requestId: req.id,
      userId: typeof req.user?.id === 'string' || typeof req.user?.id === 'number' ? String(req.user.id) : undefined,
      metadata: {
        ...this.context
      }
    };

    this.writeToTransports(entry);
  }

  /**
   * Log security event
   */
  logSecurity(event: string, details: Record<string, unknown> = {}, req?: { ip?: string; url?: string; method?: string; get?: (key: string) => string | undefined; user?: { id?: unknown } }): void {
    const entry: AnyLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message: `Security Event: ${event}`,
      category: 'SECURITY',
      event,
      ip: req?.ip,
      userAgent: req?.get?.('user-agent'),
      userId: typeof req?.user?.id === 'string' || typeof req?.user?.id === 'number' ? String(req.user.id) : undefined,
      details,
      metadata: {
        ...this.context,
        ...details
      }
    };

    this.writeToTransports(entry);
  }

  /**
   * Log database operation
   */
  logDatabase(operation: string, details: Record<string, unknown> = {}): void {
    const entry: AnyLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      message: `Database: ${operation}`,
      category: 'DATABASE',
      operation,
      table: details.table as string,
      duration: details.duration as number,
      query: details.query as string,
      rowCount: details.rowCount as number,
      metadata: {
        ...this.context,
        ...details
      }
    };

    this.writeToTransports(entry);
  }

  // ============================================
  // Configuration Methods
  // ============================================

  /**
   * Update logger configuration
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.levelValue = LogLevel[this.config.level];
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.transports.map((t) => t.flush?.())
    );
  }

  /**
   * Close all transports
   */
  async close(): Promise<void> {
    await Promise.all(
      this.transports.map((t) => t.close?.())
    );
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a logger with environment-based defaults
 */
export function createLogger(config?: Partial<LoggerConfig>): UnifiedLoggerService {
  const isDev = process.env.NODE_ENV === 'development';

  return new UnifiedLoggerService({
    level: parseLogLevel(process.env.LOG_LEVEL || (isDev ? 'DEBUG' : 'INFO')),
    console: true,
    file: !isDev,
    filePath: process.env.LOG_FILE || './logs/app.log',
    errorFilePath: process.env.LOG_ERROR_FILE || './logs/error.log',
    maxFileSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_MAX_FILES || '14',
    enableColors: isDev,
    ...config
  });
}

/**
 * Create a child logger with context (helper function)
 */
export function createChildLogger(
  parent: ServerLogger,
  context: Record<string, unknown>
): ServerLogger {
  return parent.child(context);
}

// ============================================
// Default Logger Instance
// ============================================

/**
 * Default logger instance
 * Use this for general application logging
 */
export const logger = createLogger();

export default logger;
