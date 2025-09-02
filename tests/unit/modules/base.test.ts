/**
 * ===============================================
 * BASE MODULE TESTS
 * ===============================================
 * @file tests/unit/modules/base.test.ts
 * 
 * Unit tests for the BaseModule class.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseModule } from '../../../src/modules/base.js';

// Mock logger
vi.mock('../../../src/services/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Concrete implementation for testing
class TestModule extends BaseModule {
  public initCalled = false;
  public destroyCalled = false;
  public initError: Error | null = null;
  public destroyError: Error | null = null;

  constructor(container: HTMLElement, options: any = {}) {
    super(container, options);
    this.name = 'test-module';
  }

  override async init(): Promise<void> {
    if (this.initError) throw this.initError;
    this.initCalled = true;
  }

  override async destroy(): Promise<void> {
    if (this.destroyError) throw this.destroyError;
    this.destroyCalled = true;
  }

  // Expose protected methods for testing
  public testLog(message: string) {
    this.log(message);
  }

  public testLogError(message: string, error: Error) {
    this.logError(message, error);
  }
}

describe('BaseModule', () => {
  let container: HTMLElement;
  let module: TestModule;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    container.innerHTML = '<div class="test-content">Test content</div>';
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should initialize with correct properties', () => {
      module = new TestModule(container, { debug: true });

      expect(module.name).toBe('test-module');
      expect(module.container).toBe(container);
      expect(module.isInitialized).toBe(false);
    });

    it('should initialize with default options', () => {
      module = new TestModule(container);

      expect(module.name).toBe('test-module');
      expect(module.container).toBe(container);
    });

    it('should throw error for invalid container', () => {
      expect(() => {
        new TestModule(null as any);
      }).toThrow('Container element is required for module');
    });
  });

  describe('Lifecycle Management', () => {
    beforeEach(() => {
      module = new TestModule(container);
    });

    it('should initialize module successfully', async () => {
      await module.initialize();

      expect(module.isInitialized).toBe(true);
      expect(module.initCalled).toBe(true);
    });

    it('should not initialize twice', async () => {
      await module.initialize();
      module.initCalled = false; // Reset flag

      await module.initialize(); // Second call

      expect(module.initCalled).toBe(false); // Should not be called again
      expect(module.isInitialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Init failed');
      module.initError = error;

      await expect(module.initialize()).rejects.toThrow('Init failed');
      expect(module.isInitialized).toBe(false);
    });

    it('should destroy module successfully', async () => {
      await module.initialize();
      await module.teardown();

      expect(module.isInitialized).toBe(false);
      expect(module.destroyCalled).toBe(true);
    });

    it('should handle destroy errors', async () => {
      await module.initialize();
      const error = new Error('Destroy failed');
      module.destroyError = error;

      await expect(module.teardown()).rejects.toThrow('Destroy failed');
      expect(module.isInitialized).toBe(false); // Should still mark as not initialized
    });

    it('should not destroy uninitialized module', async () => {
      await module.teardown();

      expect(module.destroyCalled).toBe(false);
    });
  });

  describe('Event System', () => {
    beforeEach(() => {
      module = new TestModule(container);
    });

    it('should emit events', () => {
      let eventFired = false;
      let eventData: any = null;

      container.addEventListener('test-event', (event: any) => {
        eventFired = true;
        eventData = event.detail;
      });

      module.emit('test-event', { message: 'test data' });

      expect(eventFired).toBe(true);
      expect(eventData).toEqual({ message: 'test data' });
    });

    it('should emit events without data', () => {
      let eventFired = false;

      container.addEventListener('simple-event', () => {
        eventFired = true;
      });

      module.emit('simple-event');

      expect(eventFired).toBe(true);
    });

    it('should listen to events', () => {
      let callbackFired = false;
      let callbackData: any = null;

      const callback = (event: CustomEvent) => {
        callbackFired = true;
        callbackData = event.detail;
      };

      module.on('listen-test', callback);

      // Emit event directly on container
      const event = new CustomEvent('listen-test', {
        detail: { test: 'data' }
      });
      container.dispatchEvent(event);

      expect(callbackFired).toBe(true);
      expect(callbackData).toEqual({ test: 'data' });
    });

    it('should remove event listeners', () => {
      let callbackCount = 0;

      const callback = () => {
        callbackCount++;
      };

      module.on('remove-test', callback);
      module.off('remove-test', callback);

      // Emit event - should not trigger callback
      const event = new CustomEvent('remove-test');
      container.dispatchEvent(event);

      expect(callbackCount).toBe(0);
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      module = new TestModule(container);
    });

    it('should set and get state', () => {
      module.setState('testKey', 'testValue');

      expect(module.getStatus('testKey')).toBe('testValue');
    });

    it('should return undefined for non-existent state', () => {
      expect(module.getStatus('nonExistent')).toBeUndefined();
    });

    it('should return default value for non-existent state', () => {
      expect(module.getStatus('nonExistent', 'defaultValue')).toBe('defaultValue');
    });

    it('should update existing state', () => {
      module.setState('updateKey', 'initialValue');
      module.setState('updateKey', 'updatedValue');

      expect(module.getStatus('updateKey')).toBe('updatedValue');
    });

    it('should handle complex state objects', () => {
      const complexState = {
        nested: {
          array: [1, 2, 3],
          boolean: true
        }
      };

      module.setState('complex', complexState);

      expect(module.getStatus('complex')).toEqual(complexState);
    });
  });

  describe('Element Queries', () => {
    beforeEach(() => {
      module = new TestModule(container);
      container.innerHTML = `
        <div class="test-class" data-test="value1">Element 1</div>
        <div class="test-class" data-test="value2">Element 2</div>
        <span id="unique-element">Unique</span>
      `;
    });

    it('should find single element', () => {
      const element = module.find('#unique-element');

      expect(element).toBeTruthy();
      expect(element?.textContent).toBe('Unique');
    });

    it('should return null for non-existent element', () => {
      const element = module.find('.non-existent');

      expect(element).toBeNull();
    });

    it('should find all matching elements', () => {
      const elements = module.findAll('.test-class');

      expect(elements).toHaveLength(2);
      expect(elements[0].textContent).toBe('Element 1');
      expect(elements[1].textContent).toBe('Element 2');
    });

    it('should return empty array for no matches', () => {
      const elements = module.findAll('.no-matches');

      expect(elements).toHaveLength(0);
    });
  });

  describe('Logging', () => {
    beforeEach(() => {
      module = new TestModule(container, { debug: true });
    });

    it('should log messages when debug enabled', () => {
      const { logger } = require('../../../src/services/logger.js');

      module.testLog('Test message');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[test-module] Test message')
      );
    });

    it('should log errors', () => {
      const { logger } = require('../../../src/services/logger.js');
      const error = new Error('Test error');

      module.testLogError('Error occurred', error);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[test-module] Error occurred'),
        expect.objectContaining({
          error: error.message,
          stack: error.stack
        })
      );
    });

    it('should not log when debug disabled', () => {
      const debugDisabledModule = new TestModule(container, { debug: false });
      const { logger } = require('../../../src/services/logger.js');

      debugDisabledModule.testLog('Should not log');

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      module = new TestModule(container);
    });

    it('should clean up event listeners on destroy', async () => {
      let callbackCount = 0;
      const callback = () => callbackCount++;

      await module.initialize();
      module.on('cleanup-test', callback);

      await module.teardown();

      // Event should not fire after teardown
      const event = new CustomEvent('cleanup-test');
      container.dispatchEvent(event);

      expect(callbackCount).toBe(0);
    });

    it('should clear state on destroy', async () => {
      await module.initialize();
      module.setState('cleanupKey', 'value');

      expect(module.getStatus('cleanupKey')).toBe('value');

      await module.teardown();

      expect(module.getStatus('cleanupKey')).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      module = new TestModule(container);
    });

    it('should handle async initialization errors gracefully', async () => {
      const asyncError = new Error('Async init error');
      module.initError = asyncError;

      await expect(module.initialize()).rejects.toThrow('Async init error');

      // Module should remain uninitialized
      expect(module.isInitialized).toBe(false);
    });

    it('should handle destroy errors without breaking state', async () => {
      await module.initialize();
      
      const destroyError = new Error('Destroy error');
      module.destroyError = destroyError;

      await expect(module.teardown()).rejects.toThrow('Destroy error');

      // Should still mark as not initialized despite error
      expect(module.isInitialized).toBe(false);
    });
  });
});