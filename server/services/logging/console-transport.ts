/**
 * ===============================================
 * CONSOLE TRANSPORT
 * ===============================================
 * @file server/services/logging/console-transport.ts
 *
 * Log transport for console output with color support.
 */

import {
  type LogTransport,
  type AnyLogEntry,
  type LogLevelType,
  type ConsoleTransportConfig,
  LogLevel,
  formatLogEntry,
  colorize
} from '../../../shared/logging/types.js';

/**
 * Console transport implementation
 */
export class ConsoleTransport implements LogTransport {
  readonly name = 'console';
  readonly level: LogLevelType;
  private enableColors: boolean;
  private includeTimestamp: boolean;
  private levelValue: number;

  constructor(config: ConsoleTransportConfig = {}) {
    this.level = config.level || 'INFO';
    this.enableColors = config.enableColors ?? true;
    this.includeTimestamp = config.includeTimestamp ?? true;
    this.levelValue = LogLevel[this.level];
  }

  /**
   * Write a log entry to console
   */
  write(entry: AnyLogEntry): void {
    // Check if this log should be output
    const entryLevel = LogLevel[entry.level];
    if (entryLevel > this.levelValue) {
      return;
    }

    const formatted = formatLogEntry(entry, {
      includeTimestamp: this.includeTimestamp
    });

    const output = this.enableColors
      ? colorize(formatted, entry.level)
      : formatted;

    // Use appropriate console method
    switch (entry.level) {
    case 'ERROR':
      console.error(output);
      break;
    case 'WARN':
      console.warn(output);
      break;
    case 'DEBUG':
    case 'TRACE':
      console.debug(output);
      break;
    default:
      console.log(output);
    }
  }
}

/**
 * Create console transport with default config
 */
export function createConsoleTransport(config?: ConsoleTransportConfig): ConsoleTransport {
  return new ConsoleTransport(config);
}
