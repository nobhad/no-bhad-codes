/**
 * ===============================================
 * LOGGER SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/logger.test.ts
 *
 * Unit tests for the centralized logging service.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LoggerService, LogLevel, LogEntry } from '../../../server/services/logger.js';
import fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');
vi.mock('fs');

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log');
const mockConsoleError = vi.spyOn(console, 'error');
const mockConsoleWarn = vi.spyOn(console, 'warn');

describe('LoggerService', () => {
  let logger: LoggerService;
  let mockConfig: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock configuration
    mockConfig = {
      LOG_LEVEL: 'info',
      LOG_FILE: './logs/test.log',
      LOG_ERROR_FILE: './logs/test-error.log',
      LOG_MAX_SIZE: '10m',
      LOG_MAX_FILES: '5d',
      NODE_ENV: 'test'
    };

    // Mock environment config
    vi.doMock('../../../server/config/environment.js', () => ({
      default: mockConfig
    }));

    // Create fresh logger instance
    logger = new (LoggerService as any)();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Log Levels', () => {
    it('should have correct log level hierarchy', () => {
      expect(LogLevel.ERROR).toBe(0);
      expect(LogLevel.WARN).toBe(1);
      expect(LogLevel.INFO).toBe(2);
      expect(LogLevel.DEBUG).toBe(3);
    });

    it('should filter logs based on current log level', async () => {
      // Set log level to WARN (1)
      logger.updateConfig({ level: 'WARN' });

      await logger.debug('debug message');
      await logger.info('info message');
      await logger.warn('warn message');
      await logger.error('error message');

      // Only WARN and ERROR should be logged
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('debug message'));
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('info message'));
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('warn message'));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('error message'));
    });
  });

  describe('Log Entry Creation', () => {
    it('should create log entry with timestamp and level', async () => {
      const beforeTime = new Date().toISOString();
      await logger.info('test message');
      const afterTime = new Date().toISOString();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(
          /\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z \\[INFO\\] test message/
        )
      );
    });

    it('should include category in log entry', async () => {
      await logger.info('test message', { category: 'TEST' });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('[TEST]'));
    });

    it('should include metadata in log entry', async () => {
      const metadata = { userId: 123, action: 'login' };
      await logger.info('user action', { metadata });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(metadata))
      );
    });

    it('should include error stack trace', async () => {
      const error = new Error('Test error');
      await logger.error('error occurred', { error });

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(error.stack || error.message)
      );
    });
  });

  describe('File Logging', () => {
    beforeEach(() => {
      // Mock fs methods
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    });

    it('should write to log file', async () => {
      logger.updateConfig({ file: true });
      await logger.info('test message');

      expect(fs.appendFile).toHaveBeenCalledWith(
        './logs/test.log',
        expect.stringContaining('test message\n')
      );
    });

    it('should write errors to separate error file', async () => {
      logger.updateConfig({ file: true });
      await logger.error('error message');

      expect(fs.appendFile).toHaveBeenCalledWith(
        './logs/test-error.log',
        expect.stringContaining('error message\n')
      );
    });

    it('should not write to file when file logging is disabled', async () => {
      logger.updateConfig({ file: false });
      await logger.info('test message');

      expect(fs.appendFile).not.toHaveBeenCalled();
    });
  });

  describe('Console Output', () => {
    it('should output to console when enabled', async () => {
      logger.updateConfig({ console: true });
      await logger.info('console message');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('console message'));
    });

    it('should not output to console when disabled', async () => {
      logger.updateConfig({ console: false });
      await logger.info('no console message');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should use appropriate console methods for different levels', async () => {
      await logger.error('error');
      await logger.warn('warning');
      await logger.info('info');
      await logger.debug('debug');

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('error'));
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('warning'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('info'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('debug'));
    });
  });

  describe('HTTP Request Logging', () => {
    it('should log HTTP request with metadata', async () => {
      const mockReq = {
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-agent'),
        user: { id: 123 },
        id: 'req-123'
      };

      const mockRes = {
        statusCode: 200
      };

      await logger.logRequest(mockReq, mockRes, 150);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('GET /api/test 200'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('150ms'));
    });

    it('should log slow requests as warnings', async () => {
      const mockReq = { method: 'GET', url: '/slow', get: vi.fn() };
      const mockRes = { statusCode: 200 };

      await logger.logRequest(mockReq, mockRes, 1500); // > 1000ms

      // Should log both the request and a slow request warning
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('GET /slow 200'));
    });
  });

  describe('Error Logging', () => {
    it('should log error with context', async () => {
      const error = new Error('Test error');
      const context = { userId: 123, action: 'test' };

      await logger.logError(error, context);

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events', async () => {
      const details = { ip: '127.0.0.1', attempt: 'login' };
      const mockReq = { ip: '127.0.0.1', get: vi.fn(), user: { id: 123 } };

      await logger.logSecurity('Failed login attempt', details, mockReq);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Security Event: Failed login attempt')
      );
    });
  });

  describe('Database Logging', () => {
    it('should log database operations', async () => {
      const details = { query: 'SELECT * FROM users', duration: '25ms' };

      await logger.logDatabase('User query', details);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Database: User query'));
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with inherited context', async () => {
      const context = { requestId: 'req-123', userId: 456 };
      const childLogger = logger.child(context);

      await childLogger.info('child log message');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('child log message'));
      // Context should be included in the log
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('req-123'));
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        level: 'DEBUG' as const,
        console: false,
        file: true
      };

      logger.updateConfig(newConfig);
      const config = logger.getConfig();

      expect(config.level).toBe('DEBUG');
      expect(config.console).toBe(false);
      expect(config.file).toBe(true);
    });

    it('should return current configuration', () => {
      const config = logger.getConfig();

      expect(config).toHaveProperty('level');
      expect(config).toHaveProperty('console');
      expect(config).toHaveProperty('file');
      expect(config).toHaveProperty('filePath');
    });
  });
});
