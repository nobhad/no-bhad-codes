/**
 * ===============================================
 * FILE TRANSPORT
 * ===============================================
 * @file server/services/logging/file-transport.ts
 *
 * Log transport for file output with rotation support.
 */

import fs from 'fs';
import path from 'path';
import {
  type LogTransport,
  type AnyLogEntry,
  type LogLevelType,
  type FileTransportConfig,
  LogLevel,
  formatLogEntry
} from '../../../shared/logging/types.js';

/**
 * File transport implementation
 */
export class FileTransport implements LogTransport {
  readonly name = 'file';
  readonly level: LogLevelType;
  private filePath: string;
  private maxFileSize: number;
  private maxFiles: number;
  private levelValue: number;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(config: FileTransportConfig) {
    this.level = config.level || 'INFO';
    this.filePath = config.filePath;
    this.maxFileSize = this.parseFileSize(config.maxFileSize || '10m');
    this.maxFiles = parseInt(config.maxFiles?.replace(/[^0-9]/g, '') || '14');
    this.levelValue = LogLevel[this.level];

    this.ensureDirectoryExists();
  }

  /**
   * Ensure log directory exists
   */
  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Parse file size string to bytes
   */
  private parseFileSize(size: string): number {
    const units: Record<string, number> = {
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024
    };

    const match = size.match(/^(\d+)([kmg])?$/i);
    if (!match) return 10 * 1024 * 1024; // Default 10MB

    const value = parseInt(match[1]);
    const unit = match[2]?.toLowerCase() as keyof typeof units;

    return value * (units[unit] || 1);
  }

  /**
   * Write a log entry to file
   */
  write(entry: AnyLogEntry): void {
    // Check if this log should be output
    const entryLevel = LogLevel[entry.level];
    if (entryLevel > this.levelValue) {
      return;
    }

    // Queue the write operation
    this.writeQueue = this.writeQueue.then(() => this.writeToFile(entry));
  }

  /**
   * Internal write operation
   */
  private async writeToFile(entry: AnyLogEntry): Promise<void> {
    try {
      const formatted = formatLogEntry(entry);
      await fs.promises.appendFile(this.filePath, `${formatted}\n`);

      // Check if rotation is needed
      await this.checkRotation();
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Check if log rotation is needed
   */
  private async checkRotation(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.filePath);
      if (stats.size > this.maxFileSize) {
        await this.rotateFile();
      }
    } catch (error) {
      // File doesn't exist or other error - ignore
    }
  }

  /**
   * Rotate the log file
   */
  private async rotateFile(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(this.filePath);
      const base = path.basename(this.filePath, ext);
      const dir = path.dirname(this.filePath);
      const rotatedFile = path.join(dir, `${base}-${timestamp}${ext}`);

      await fs.promises.rename(this.filePath, rotatedFile);
      await this.cleanupOldFiles();
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Clean up old rotated files
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      const ext = path.extname(this.filePath);
      const base = path.basename(this.filePath, ext);

      const files = await fs.promises.readdir(dir);
      const logFiles = files
        .filter((file) => file.startsWith(`${base}-`) && file.endsWith(ext))
        .map((file) => ({
          name: file,
          path: path.join(dir, file)
        }));

      // Sort by modification time (newest first)
      const filesWithStats = await Promise.all(
        logFiles.map(async (file) => {
          const stats = await fs.promises.stat(file.path);
          return { ...file, mtime: stats.mtime.getTime() };
        })
      );

      filesWithStats.sort((a, b) => b.mtime - a.mtime);

      // Delete old files beyond maxFiles
      const toDelete = filesWithStats.slice(this.maxFiles);
      await Promise.all(toDelete.map((file) => fs.promises.unlink(file.path)));
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * Flush any pending writes
   */
  async flush(): Promise<void> {
    await this.writeQueue;
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    await this.flush();
  }
}

/**
 * Create file transport
 */
export function createFileTransport(config: FileTransportConfig): FileTransport {
  return new FileTransport(config);
}

/**
 * Create separate error file transport
 */
export function createErrorFileTransport(errorFilePath: string, config?: Partial<FileTransportConfig>): FileTransport {
  return new FileTransport({
    level: 'ERROR',
    filePath: errorFilePath,
    ...config
  });
}
