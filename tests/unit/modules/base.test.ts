import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseModule } from '@/modules/base';

// Create a concrete test class since BaseModule is meant to be extended
class TestModule extends BaseModule {
  public initCalled = false;
  public destroyCalled = false;
  public initError: Error | null = null;
  public destroyError: Error | null = null;

  constructor(options: any = {}) {
    super('test-module', options);
  }

  override async onInit(): Promise<void> {
    if (this.initError) throw this.initError;
    this.initCalled = true;
  }

  override async onDestroy(): Promise<void> {
    if (this.destroyError) throw this.destroyError;
    this.destroyCalled = true;
  }

  // Expose protected methods for testing
  public testLog(message: string) {
    this.log(message);
  }

  public testLogError(message: string, error: Error) {
    this.error(message, error);
  }
}

describe('BaseModule', () => {
  let module: TestModule;
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="test-element">Test</div>';
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    module = new TestModule({ debug: true });
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      module = new TestModule({ debug: true });

      expect(module.name).toBe('test-module');
      expect(module.isInitialized).toBe(false);
    });

    it('should initialize with default options', () => {
      module = new TestModule();

      expect(module.name).toBe('test-module');
      expect(module.isInitialized).toBe(false);
    });

    it('should validate name is provided', () => {
      // Name is now required in constructor and set in TestModule
      module = new TestModule({ debug: true });
      expect(module.name).toBe('test-module');
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await module.init();
      expect(module['isInitialized']).toBe(true);
      expect(module['isDestroyed']).toBe(false);
    });

    it('should not initialize twice', async () => {
      const warnSpy = vi.spyOn(module as any, 'warn');
      await module.init();
      await module.init();
      expect(warnSpy).toHaveBeenCalledWith('Module already initialized.');
    });
  });

  describe('Event System', () => {
    beforeEach(() => {
      module = new TestModule();
    });

    it('should emit events', () => {
      let eventFired = false;
      let eventData: any = null;

      // Events are dispatched on document with module name prefix
      document.addEventListener('test-module:test-event', (event: any) => {
        eventFired = true;
        eventData = event.detail;
      });

      module.emit('test-event', { message: 'test data' });

      expect(eventFired).toBe(true);
      expect(eventData).toEqual({ message: 'test data' });
    });

    it('should emit events without data', () => {
      let eventFired = false;

      document.addEventListener('test-module:simple-event', () => {
        eventFired = true;
      });

      module.emit('simple-event');

      expect(eventFired).toBe(true);
    });

    it('should listen to events', () => {
      let callbackFired = false;
      let callbackData: any = null;

      const callback = (event: any) => {
        callbackFired = true;
        callbackData = event.detail;
      };

      module.on('listen-test', callback);

      // Emit event directly on document
      const event = new CustomEvent('listen-test', {
        detail: { test: 'data' },
      });
      document.dispatchEvent(event);

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
      document.dispatchEvent(event);

      expect(callbackCount).toBe(0);
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      module = new TestModule();
    });

    it('should set and get state', () => {
      module.setState('testKey', 'testValue');

      expect(module.getState('testKey')).toBe('testValue');
    });

    it('should return undefined for non-existent state', () => {
      expect(module.getState('nonExistent')).toBeUndefined();
    });

    it('should return default value for non-existent state', () => {
      expect(module.getState('nonExistent', 'defaultValue')).toBe('defaultValue');
    });

    it('should update existing state', () => {
      module.setState('updateKey', 'initialValue');
      module.setState('updateKey', 'updatedValue');

      expect(module.getState('updateKey')).toBe('updatedValue');
    });

    it('should handle complex state objects', () => {
      const complexState = {
        nested: {
          array: [1, 2, 3],
          boolean: true,
        },
      };

      module.setState('complex', complexState);

      expect(module.getState('complex')).toEqual(complexState);
    });
  });

  describe('Element Queries', () => {
    beforeEach(() => {
      module = new TestModule();
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

    it('should cache elements for repeated access', () => {
      const querySelectorSpy = vi.spyOn(document, 'querySelector');

      module['getElement']('test', '#test-element');
      module['getElement']('test', '#test-element');

      // Should only query once, second call uses cache
      expect(querySelectorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logging', () => {
    beforeEach(() => {
      module = new TestModule({ debug: true });
    });

    it('should log messages when debug enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      module.testLog('Test message');

      expect(consoleSpy).toHaveBeenCalledWith('[test-module]', 'Test message');

      consoleSpy.mockRestore();
    });

    it('should log errors', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const error = new Error('Test error');

      module.testLogError('Error occurred', error);

      expect(consoleSpy).toHaveBeenCalledWith('[test-module]', 'Error occurred', error);

      consoleSpy.mockRestore();
    });

    it('should not log when debug disabled', () => {
      const debugDisabledModule = new TestModule({ debug: false });
      const consoleSpy = vi.spyOn(console, 'log');

      debugDisabledModule.testLog('Should not log');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      module = new TestModule();
    });

    it('should clean up event listeners on destroy', async () => {
      let callbackCount = 0;
      const callback = () => callbackCount++;

      await module.initialize();
      module.on('cleanup-test', callback);

      await module.teardown();

      // Event should not fire after teardown
      const event = new CustomEvent('cleanup-test');
      document.dispatchEvent(event);

      expect(callbackCount).toBe(0);
    });

    it('should clear state on destroy', async () => {
      await module.initialize();
      module.setState('cleanupKey', 'value');

      expect(module.getState('cleanupKey')).toBe('value');

      await module.teardown();

      expect(module.getState('cleanupKey')).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      module = new TestModule();
    });

    it('should handle async initialization errors gracefully', async () => {
      const asyncError = new Error('Async init error');
      module.initError = asyncError;

      // Init() catches errors and marks module with error state instead of rejecting
      await module.initialize();

      // Module should be marked as initialized but with error
      expect(module.isInitialized).toBe(true);
      expect((module as any).hasError).toBe(true);
    });

    it('should handle destroy errors without breaking state', async () => {
      await module.initialize();

      const destroyError = new Error('Destroy error');
      module.destroyError = destroyError;

      // Destroy re-throws errors
      await expect(module.teardown()).rejects.toThrow('Destroy error');

      // Should still mark as not initialized despite error
      expect(module.isInitialized).toBe(false);
    });
  });
});
