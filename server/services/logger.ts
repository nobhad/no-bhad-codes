/**
 * ===============================================
 * CENTRALIZED LOGGING SERVICE
 * ===============================================
 * @file server/services/logger.ts
 * 
 * Centralized error logging and application logging
 * service with multiple transports and formatting.
 */

import fs from 'fs';
import path from 'path';
import config from '../config/environment.js';

/**
 * Log levels with numeric values for filtering
 */
export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
} as const;

export type LogLevelType = keyof typeof LogLevel;

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevelType;
  message: string;
  category?: string;
  metadata?: Record<string, any>;
  error?: Error;
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level: LogLevelType;
  console: boolean;
  file: boolean;
  filePath?: string;
  errorFilePath?: string;
  maxFileSize?: string;
  maxFiles?: string;
  dateFormat?: string;
  enableColors?: boolean;
}

/**
 * Centralized Logger Service
 */
export class LoggerService {
  private config: LoggerConfig;
  private currentLogLevel: number;

  constructor() {
    this.config = {
      level: this.parseLogLevel(config.LOG_LEVEL || 'info'),
      console: true,
      file: true,
      filePath: config.LOG_FILE || './logs/app.log',
      errorFilePath: config.LOG_ERROR_FILE || './logs/error.log',
      maxFileSize: config.LOG_MAX_SIZE || '10m',
      maxFiles: config.LOG_MAX_FILES || '14d',
      enableColors: config.NODE_ENV === 'development'
    };

    this.currentLogLevel = LogLevel[this.config.level];
    this.ensureLogDirectories();
  }

  /**
   * Parse log level string to enum value
   */
  private parseLogLevel(level: string): LogLevelType {
    const normalizedLevel = level.toUpperCase() as LogLevelType;
    if (normalizedLevel in LogLevel) {
      return normalizedLevel;
    }
    return 'INFO';
  }

  /**
   * Ensure log directories exist
   */
  private ensureLogDirectories(): void {
    if (this.config.filePath) {
      const logDir = path.dirname(this.config.filePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }

    if (this.config.errorFilePath) {
      const errorDir = path.dirname(this.config.errorFilePath);
      if (!fs.existsSync(errorDir)) {
        fs.mkdirSync(errorDir, { recursive: true });
      }
    }
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, category, metadata, error } = entry;
    
    let formatted = `${timestamp} [${level}]`;
    
    if (category) {
      formatted += ` [${category}]`;
    }
    
    formatted += ` ${message}`;

    if (metadata && Object.keys(metadata).length > 0) {
      formatted += ` | ${JSON.stringify(metadata)}`;
    }

    if (error) {
      formatted += `\\n${error.stack || error.message}`;
    }

    return formatted;
  }

  /**
   * Colorize console output
   */
  private colorizeLevel(level: LogLevelType, text: string): string {
    if (!this.config.enableColors) return text;

    const colors = {
      ERROR: '\\x1b[31m', // Red
      WARN: '\\x1b[33m',  // Yellow
      INFO: '\\x1b[36m',  // Cyan
      DEBUG: '\\x1b[35m'  // Magenta
    };

    const reset = '\\x1b[0m';
    return `${colors[level]}${text}${reset}`;
  }

  /**
   * Write log to file
   */
  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.config.file) return;

    const formatted = this.formatLogEntry(entry);
    const filePath = entry.level === 'ERROR' && this.config.errorFilePath 
      ? this.config.errorFilePath 
      : this.config.filePath;

    if (!filePath) return;

    try {
      await fs.promises.appendFile(filePath, formatted + '\\n');
      
      // Basic log rotation check (simple file size check)
      const stats = await fs.promises.stat(filePath);
      const maxSize = this.parseFileSize(this.config.maxFileSize || '10m');
      
      if (stats.size > maxSize) {
        await this.rotateLogFile(filePath);
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Parse file size string to bytes
   */
  private parseFileSize(size: string): number {
    const units = { k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 };
    const match = size.match(/^(\\d+)([kmg])?$/i);
    
    if (!match) return 10 * 1024 * 1024; // Default 10MB
    
    const value = parseInt(match[1]);
    const unit = match[2]?.toLowerCase() as keyof typeof units;
    
    return value * (units[unit] || 1);
  }

  /**
   * Rotate log file when it gets too large
   */
  private async rotateLogFile(filePath: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(filePath);
      const base = path.basename(filePath, ext);
      const dir = path.dirname(filePath);
      const rotatedFile = path.join(dir, `${base}-${timestamp}${ext}`);
      
      await fs.promises.rename(filePath, rotatedFile);
      
      // Clean up old rotated files based on maxFiles setting
      await this.cleanupOldLogs(dir, base, ext);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(dir: string, baseName: string, ext: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(dir);
      const logFiles = files
        .filter(file => file.startsWith(`${baseName}-`) && file.endsWith(ext))
        .map(file => ({
          name: file,
          path: path.join(dir, file),
          stats: fs.statSync(path.join(dir, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      // Keep only the most recent files based on config
      const maxFiles = parseInt(this.config.maxFiles?.replace(/[^0-9]/g, '') || '14');
      const filesToDelete = logFiles.slice(maxFiles);

      for (const file of filesToDelete) {
        await fs.promises.unlink(file.path);
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Check if log level should be processed
   */
  private shouldLog(level: LogLevelType): boolean {
    return LogLevel[level] <= this.currentLogLevel;
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevelType,
    message: string,
    options: Partial<LogEntry> = {}
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...options
    };
  }

  /**
   * Write log entry
   */
  private async writeLog(entry: LogEntry): Promise<void> {
    if (!this.shouldLog(entry.level)) return;

    // Console output
    if (this.config.console) {
      const formatted = this.formatLogEntry(entry);
      const colorized = this.colorizeLevel(entry.level, formatted);
      
      if (entry.level === 'ERROR') {
        console.error(colorized);
      } else if (entry.level === 'WARN') {
        console.warn(colorized);
      } else {
        console.log(colorized);
      }
    }

    // File output
    await this.writeToFile(entry);
  }

  /**
   * Log error message
   */
  async error(message: string, options: Partial<LogEntry> = {}): Promise<void> {
    const entry = this.createLogEntry('ERROR', message, options);
    await this.writeLog(entry);
  }

  /**
   * Log warning message
   */
  async warn(message: string, options: Partial<LogEntry> = {}): Promise<void> {
    const entry = this.createLogEntry('WARN', message, options);
    await this.writeLog(entry);
  }

  /**
   * Log info message
   */
  async info(message: string, options: Partial<LogEntry> = {}): Promise<void> {
    const entry = this.createLogEntry('INFO', message, options);
    await this.writeLog(entry);
  }

  /**
   * Log debug message
   */
  async debug(message: string, options: Partial<LogEntry> = {}): Promise<void> {
    const entry = this.createLogEntry('DEBUG', message, options);
    await this.writeLog(entry);
  }

  /**
   * Log HTTP request
   */
  async logRequest(req: any, res: any, duration?: number): Promise<void> {
    const message = `${req.method} ${req.url} ${res.statusCode}`;
    const metadata = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      duration: duration ? `${duration}ms` : undefined
    };

    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    
    await this.writeLog(this.createLogEntry(level, message, {
      category: 'HTTP',
      metadata,
      requestId: req.id,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    }));
  }

  /**
   * Log application error with full context
   */
  async logError(error: Error, context: Partial<LogEntry> = {}): Promise<void> {
    await this.error(error.message, {
      ...context,
      error,
      category: context.category || 'APPLICATION'
    });
  }

  /**
   * Log security event
   */
  async logSecurity(event: string, details: Record<string, any> = {}, req?: any): Promise<void> {
    await this.warn(`Security Event: ${event}`, {
      category: 'SECURITY',
      metadata: details,
      ip: req?.ip,
      userAgent: req?.get('user-agent'),
      userId: req?.user?.id
    });
  }

  /**
   * Log database operation
   */
  async logDatabase(operation: string, details: Record<string, any> = {}): Promise<void> {
    await this.info(`Database: ${operation}`, {
      category: 'DATABASE',
      metadata: details
    });
  }

  /**
   * Create child logger with context
   */
  child(context: Partial<LogEntry>): LoggerService {
    const childLogger = Object.create(this);
    const originalWriteLog = this.writeLog.bind(this);
    
    childLogger.writeLog = async (entry: LogEntry) => {
      const enhancedEntry = {
        ...entry,
        ...context,
        metadata: { ...context.metadata, ...entry.metadata }
      };
      await originalWriteLog(enhancedEntry);
    };
    
    return childLogger;
  }

  /**
   * Update logger configuration
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.currentLogLevel = LogLevel[this.config.level];
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Export the class for testing
export { LoggerService };

// Create and export singleton logger instance
export const logger = new LoggerService();
export default logger;