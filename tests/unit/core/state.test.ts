/**
 * ===============================================
 * STATE MANAGEMENT TESTS
 * ===============================================
 * @file tests/unit/core/state.test.ts
 *
 * Unit tests for the state management system.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StateManager, createStateManager } from '../../../src/core/state.js';

// Mock logger
vi.mock('../../../src/services/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    stateManager.destroy();
  });

  describe('Basic State Operations', () => {
    it('should set and get state values', () => {
      stateManager.setState('testKey', 'testValue');

      expect(stateManager.getState('testKey')).toBe('testValue');
    });

    it('should return undefined for non-existent keys', () => {
      expect(stateManager.getState('nonExistentKey')).toBeUndefined();
    });

    it('should return default value for non-existent keys', () => {
      expect(stateManager.getState('nonExistentKey', 'defaultValue')).toBe('defaultValue');
    });

    it('should update existing state values', () => {
      stateManager.setState('updateKey', 'initialValue');
      stateManager.setState('updateKey', 'updatedValue');

      expect(stateManager.getState('updateKey')).toBe('updatedValue');
    });

    it('should handle complex state objects', () => {
      const complexState = {
        user: {
          id: 1,
          name: 'John Doe',
          settings: {
            theme: 'dark',
            notifications: true
          }
        },
        projects: [
          { id: 1, name: 'Project 1' },
          { id: 2, name: 'Project 2' }
        ]
      };

      stateManager.setState('complex', complexState);

      expect(stateManager.getState('complex')).toEqual(complexState);
      expect(stateManager.getState('complex')?.user.name).toBe('John Doe');
    });
  });

  describe('State Subscription System', () => {
    it('should notify subscribers when state changes', () => {
      const subscriber = vi.fn();
      const unsubscribe = stateManager.subscribe('testKey', subscriber);

      stateManager.setState('testKey', 'value1');

      expect(subscriber).toHaveBeenCalledWith('value1', undefined, 'testKey');

      unsubscribe();
    });

    it('should pass previous value to subscribers', () => {
      const subscriber = vi.fn();
      stateManager.setState('testKey', 'initialValue');
      stateManager.subscribe('testKey', subscriber);

      stateManager.setState('testKey', 'newValue');

      expect(subscriber).toHaveBeenCalledWith('newValue', 'initialValue', 'testKey');
    });

    it('should support multiple subscribers for same key', () => {
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      stateManager.subscribe('testKey', subscriber1);
      stateManager.subscribe('testKey', subscriber2);

      stateManager.setState('testKey', 'value');

      expect(subscriber1).toHaveBeenCalledWith('value', undefined, 'testKey');
      expect(subscriber2).toHaveBeenCalledWith('value', undefined, 'testKey');
    });

    it('should allow unsubscribing from state changes', () => {
      const subscriber = vi.fn();
      const unsubscribe = stateManager.subscribe('testKey', subscriber);

      stateManager.setState('testKey', 'value1');
      expect(subscriber).toHaveBeenCalledTimes(1);

      unsubscribe();
      stateManager.setState('testKey', 'value2');
      expect(subscriber).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should support wildcard subscriptions', () => {
      const wildcardSubscriber = vi.fn();
      stateManager.subscribe('*', wildcardSubscriber);

      stateManager.setState('key1', 'value1');
      stateManager.setState('key2', 'value2');

      expect(wildcardSubscriber).toHaveBeenCalledWith('value1', undefined, 'key1');
      expect(wildcardSubscriber).toHaveBeenCalledWith('value2', undefined, 'key2');
    });
  });

  describe('Batch Operations', () => {
    it('should batch multiple state updates', () => {
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      stateManager.subscribe('key1', subscriber1);
      stateManager.subscribe('key2', subscriber2);

      stateManager.batch(() => {
        stateManager.setState('key1', 'value1');
        stateManager.setState('key2', 'value2');
      });

      expect(subscriber1).toHaveBeenCalledTimes(1);
      expect(subscriber2).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in batch operations', () => {
      const subscriber = vi.fn();
      stateManager.subscribe('key1', subscriber);

      expect(() => {
        stateManager.batch(() => {
          stateManager.setState('key1', 'value1');
          throw new Error('Batch error');
        });
      }).toThrow('Batch error');

      // State should still be updated despite error
      expect(stateManager.getState('key1')).toBe('value1');
    });
  });

  describe('State Persistence', () => {
    it('should persist state to localStorage when enabled', () => {
      const persistentState = new StateManager({
        persist: true,
        persistKey: 'test-state'
      });

      persistentState.setState('persistentKey', 'persistentValue');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'test-state',
        expect.stringContaining('persistentValue')
      );

      persistentState.destroy();
    });

    it('should restore state from localStorage on initialization', () => {
      // Mock localStorage data
      const mockStateData = JSON.stringify({
        restoredKey: 'restoredValue'
      });
      (localStorage.getItem as any).mockReturnValue(mockStateData);

      const persistentState = new StateManager({
        persist: true,
        persistKey: 'restore-test'
      });

      expect(persistentState.getState('restoredKey')).toBe('restoredValue');

      persistentState.destroy();
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (localStorage.setItem as any).mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const persistentState = new StateManager({
        persist: true,
        persistKey: 'error-test'
      });

      // Should not throw, just log error
      persistentState.setState('testKey', 'testValue');

      expect(consoleSpy).toHaveBeenCalled();

      persistentState.destroy();
      consoleSpy.mockRestore();
    });
  });

  describe('State Validation', () => {
    it('should validate state with custom validator', () => {
      const validator = (value: any) => {
        if (typeof value !== 'string') {
          throw new Error('Value must be string');
        }
        return true;
      };

      stateManager.setValidator('stringKey', validator);

      expect(() => {
        stateManager.setState('stringKey', 'validString');
      }).not.toThrow();

      expect(() => {
        stateManager.setState('stringKey', 123);
      }).toThrow('Value must be string');
    });

    it('should support async validators', async () => {
      const asyncValidator = async (value: any) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (value !== 'validAsync') {
          throw new Error('Invalid async value');
        }
        return true;
      };

      stateManager.setValidator('asyncKey', asyncValidator);

      await expect(stateManager.setStateAsync('asyncKey', 'validAsync')).resolves.not.toThrow();

      await expect(stateManager.setStateAsync('asyncKey', 'invalidAsync')).rejects.toThrow(
        'Invalid async value'
      );
    });
  });

  describe('State History', () => {
    it('should track state history when enabled', () => {
      const historyState = new StateManager({ trackHistory: true });

      historyState.setState('historyKey', 'value1');
      historyState.setState('historyKey', 'value2');
      historyState.setState('historyKey', 'value3');

      const history = historyState.getHistory('historyKey');

      expect(history).toHaveLength(3);
      expect(history[0].value).toBeUndefined();
      expect(history[1].value).toBe('value1');
      expect(history[2].value).toBe('value2');

      historyState.destroy();
    });

    it('should support undo operations', () => {
      const historyState = new StateManager({ trackHistory: true });

      historyState.setState('undoKey', 'value1');
      historyState.setState('undoKey', 'value2');

      expect(historyState.getState('undoKey')).toBe('value2');

      historyState.undo('undoKey');

      expect(historyState.getState('undoKey')).toBe('value1');

      historyState.destroy();
    });

    it('should support redo operations', () => {
      const historyState = new StateManager({ trackHistory: true });

      historyState.setState('redoKey', 'value1');
      historyState.setState('redoKey', 'value2');
      historyState.undo('redoKey');

      expect(historyState.getState('redoKey')).toBe('value1');

      historyState.redo('redoKey');

      expect(historyState.getState('redoKey')).toBe('value2');

      historyState.destroy();
    });
  });

  describe('Computed State', () => {
    it('should compute derived state values', () => {
      stateManager.setState('firstName', 'John');
      stateManager.setState('lastName', 'Doe');

      stateManager.setComputed('fullName', (state) => {
        const firstName = state.get('firstName') || '';
        const lastName = state.get('lastName') || '';
        return `${firstName} ${lastName}`.trim();
      });

      expect(stateManager.getState('fullName')).toBe('John Doe');
    });

    it('should update computed values when dependencies change', () => {
      stateManager.setState('count', 5);
      stateManager.setComputed('doubled', (state) => {
        const count = state.get('count') || 0;
        return count * 2;
      });

      expect(stateManager.getState('doubled')).toBe(10);

      stateManager.setState('count', 7);
      expect(stateManager.getState('doubled')).toBe(14);
    });

    it('should handle computed state errors gracefully', () => {
      stateManager.setState('errorKey', 'value');
      stateManager.setComputed('errorComputed', () => {
        throw new Error('Computed error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(stateManager.getState('errorComputed')).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('State Middleware', () => {
    it('should apply middleware to state changes', () => {
      const middleware = vi.fn((key, value, previousValue) => {
        return value?.toString().toUpperCase();
      });

      stateManager.use(middleware);
      stateManager.setState('middlewareKey', 'lowercase');

      expect(stateManager.getState('middlewareKey')).toBe('LOWERCASE');
      expect(middleware).toHaveBeenCalledWith('middlewareKey', 'lowercase', undefined);
    });

    it('should support multiple middleware functions', () => {
      const middleware1 = vi.fn((key, value) => `${value  }_1`);
      const middleware2 = vi.fn((key, value) => `${value  }_2`);

      stateManager.use(middleware1);
      stateManager.use(middleware2);
      stateManager.setState('multiMiddleware', 'base');

      expect(stateManager.getState('multiMiddleware')).toBe('base_1_2');
    });

    it('should handle middleware errors gracefully', () => {
      const errorMiddleware = () => {
        throw new Error('Middleware error');
      };

      stateManager.use(errorMiddleware);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw, should use original value
      stateManager.setState('errorMiddleware', 'originalValue');
      expect(stateManager.getState('errorMiddleware')).toBe('originalValue');

      consoleSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    it('should clear all state on destroy', () => {
      stateManager.setState('key1', 'value1');
      stateManager.setState('key2', 'value2');

      expect(stateManager.getState('key1')).toBe('value1');

      stateManager.destroy();

      expect(stateManager.getState('key1')).toBeUndefined();
      expect(stateManager.getState('key2')).toBeUndefined();
    });

    it('should remove specific state keys', () => {
      stateManager.setState('removeKey', 'removeValue');
      stateManager.setState('keepKey', 'keepValue');

      stateManager.removeState('removeKey');

      expect(stateManager.getState('removeKey')).toBeUndefined();
      expect(stateManager.getState('keepKey')).toBe('keepValue');
    });

    it('should clear all subscriptions on destroy', () => {
      const subscriber = vi.fn();
      stateManager.subscribe('testKey', subscriber);

      stateManager.destroy();
      stateManager.setState('testKey', 'value');

      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});

describe('createStateManager', () => {
  it('should create state manager with default options', () => {
    const manager = createStateManager();

    expect(manager).toBeInstanceOf(StateManager);

    manager.destroy();
  });

  it('should create state manager with custom options', () => {
    const options = {
      persist: true,
      persistKey: 'custom-test',
      trackHistory: true
    };

    const manager = createStateManager(options);

    expect(manager).toBeInstanceOf(StateManager);

    manager.destroy();
  });
});
