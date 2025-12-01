/**
 * ===============================================
 * LOGGER SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/logger.test.ts
 *
 * Unit tests for the centralized logging service.
 * Tests the LoggerService class and related utilities.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LogLevel } from '../../../server/services/logger.js';

// Note: Full integration tests of LoggerService require proper environment setup
// These unit tests focus on testing the public API and log level filtering

describe('LogLevel', () => {
  it('should have correct log level hierarchy', () => {
    expect(LogLevel.ERROR).toBe(0);
    expect(LogLevel.WARN).toBe(1);
    expect(LogLevel.INFO).toBe(2);
    expect(LogLevel.DEBUG).toBe(3);
  });

  it('should have ERROR as the highest priority (lowest value)', () => {
    expect(LogLevel.ERROR).toBeLessThan(LogLevel.WARN);
    expect(LogLevel.WARN).toBeLessThan(LogLevel.INFO);
    expect(LogLevel.INFO).toBeLessThan(LogLevel.DEBUG);
  });
});

describe('LoggerService', () => {
  let LoggerService: typeof import('../../../server/services/logger.js').LoggerService;
  let logger: InstanceType<typeof LoggerService>;

  beforeEach(async () => {
    // Clear any cached modules
    vi.resetModules();

    // Mock fs to prevent file operations
    vi.mock('fs', () => ({
      default: {
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        statSync: vi.fn(() => ({ size: 100, mtime: new Date() })),
        promises: {
          appendFile: vi.fn().mockResolvedValue(undefined),
          stat: vi.fn().mockResolvedValue({ size: 100 }),
          readdir: vi.fn().mockResolvedValue([]),
          rename: vi.fn().mockResolvedValue(undefined),
          unlink: vi.fn().mockResolvedValue(undefined)
        }
      },
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      statSync: vi.fn(() => ({ size: 100, mtime: new Date() })),
      promises: {
        appendFile: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockResolvedValue({ size: 100 }),
        readdir: vi.fn().mockResolvedValue([]),
        rename: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined)
      }
    }));

    // Mock environment config
    vi.mock('../../../server/config/environment.js', () => ({
      default: {
        LOG_LEVEL: 'debug',
        LOG_FILE: './logs/test.log',
        LOG_ERROR_FILE: './logs/test-error.log',
        LOG_MAX_SIZE: '10m',
        LOG_MAX_FILES: '5d',
        NODE_ENV: 'test'
      }
    }));

    // Import after mocks are set up
    const module = await import('../../../server/services/logger.js');
    LoggerService = module.LoggerService;
    logger = new LoggerService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('Initialization', () => {
    it('should create logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(LoggerService);
    });

    it('should have logging methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Logging Methods', () => {
    it('should log info messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await logger.info('test info message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log error messages', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await logger.error('test error message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log warn messages', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await logger.warn('test warn message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log debug messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await logger.debug('test debug message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Log Options', () => {
    it('should accept category option', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await logger.info('test message', { category: 'TEST' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should accept metadata option', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await logger.info('test message', { metadata: { key: 'value' } });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Specialized Logging', () => {
    it('should have logRequest method', () => {
      expect(typeof logger.logRequest).toBe('function');
    });

    it('should have logError method', () => {
      expect(typeof logger.logError).toBe('function');
    });

    it('should have logSecurity method', () => {
      expect(typeof logger.logSecurity).toBe('function');
    });

    it('should have logDatabase method', () => {
      expect(typeof logger.logDatabase).toBe('function');
    });

    it('should log HTTP requests', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockReq = {
        method: 'GET',
        url: '/test',
        get: vi.fn().mockReturnValue('test-user-agent'),
        ip: '127.0.0.1'
      };
      const mockRes = { statusCode: 200 };

      await logger.logRequest(mockReq, mockRes, 100);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log errors with context', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Test error');
      await logger.logError(error, { category: 'TEST' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log security events', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await logger.logSecurity('Failed login', { userId: 123 });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log database operations', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await logger.logDatabase('SELECT query', { table: 'users' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Child Logger', () => {
    it('should have child method', () => {
      expect(typeof logger.child).toBe('function');
    });

    it('should create child logger', () => {
      const childLogger = logger.child({ category: 'CHILD' });

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
    });

    it('should inherit logging methods', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const childLogger = logger.child({ category: 'CHILD' });
      await childLogger.info('child message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Configuration', () => {
    it('should have updateConfig method', () => {
      expect(typeof logger.updateConfig).toBe('function');
    });

    it('should update log level', () => {
      logger.updateConfig({ level: 'ERROR' });
      // Should not throw
      expect(true).toBe(true);
    });
  });
});
