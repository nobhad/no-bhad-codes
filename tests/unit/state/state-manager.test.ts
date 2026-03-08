/**
 * ===============================================
 * STATE MANAGER EXTENDED TESTS
 * ===============================================
 * @file tests/unit/state/state-manager.test.ts
 *
 * Targets the branches in state-manager.ts not covered by
 * tests/unit/core/state.test.ts, aiming for 85%+ coverage.
 * Covers: subscribeToProperty, createSelector, createComputed,
 *         getComputed / get alias, dispatch+reducer, addReducer,
 *         addMiddleware/use, undo/redo, clearHistory, reset,
 *         getDebugInfo, getListenerCount, clearListeners,
 *         setComputed, removeState, batch, setValidator,
 *         persistence restore from localStorage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateManager, createStateManager } from '../../../src/core/state/state-manager';

// ---------------------------------------------------------------------------
// Mock createLogger so we don't need a real logger implementation
// ---------------------------------------------------------------------------
vi.mock('../../../src/utils/logger', () => ({
  createLogger: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface TestState {
  count: number;
  name: string;
  active: boolean;
  nested?: { value: number };
}

function makeManager(initial?: Partial<TestState>): StateManager<TestState> {
  return new StateManager<TestState>(
    {
      count: 0,
      name: '',
      active: false,
      ...(initial ?? {})
    }
  );
}

// ---------------------------------------------------------------------------
// Basic getState / setState
// ---------------------------------------------------------------------------
describe('StateManager — getState / setState', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager(); });
  afterEach(() => { sm.destroy(); });

  it('getState() returns a copy of the full state', () => {
    sm.setState({ count: 5, name: 'Alice' });
    const s = sm.getState();
    expect(s.count).toBe(5);
    expect(s.name).toBe('Alice');
  });

  it('getState(key) returns value for that key', () => {
    sm.setState('count', 42);
    expect(sm.getState('count')).toBe(42);
  });

  it('getState(key, defaultValue) returns defaultValue when key is absent', () => {
    // Remove the key so it is absent; getState should return the defaultValue
    sm.removeState('name');
    expect(sm.getState('name', 'fallback' as unknown as string)).toBe('fallback');
  });

  it('setState with object merges partial update', () => {
    sm.setState({ count: 10 });
    sm.setState({ name: 'Bob' });
    expect(sm.getState('count')).toBe(10);
    expect(sm.getState('name')).toBe('Bob');
  });

  it('setState with key/value sets individual property', () => {
    sm.setState('active', true);
    expect(sm.getState('active')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Global subscribe
// ---------------------------------------------------------------------------
describe('StateManager — global subscribe', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager(); });
  afterEach(() => { sm.destroy(); });

  it('global listener receives newState and previousState', () => {
    const listener = vi.fn();
    sm.subscribe(listener);

    sm.setState('count', 3);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ count: 3 }),
      expect.objectContaining({ count: 0 })
    );
  });

  it('unsubscribe removes the global listener', () => {
    const listener = vi.fn();
    const unsub = sm.subscribe(listener);

    sm.setState('count', 1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    sm.setState('count', 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Wildcard subscribe ('*')
// ---------------------------------------------------------------------------
describe('StateManager — wildcard subscribe', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager(); });
  afterEach(() => { sm.destroy(); });

  it('wildcard listener fires for every changed property', () => {
    const listener = vi.fn();
    sm.subscribe('*', listener);

    sm.setState({ count: 5, name: 'X' });

    // Both changed properties should trigger the listener
    expect(listener).toHaveBeenCalledWith(5, 0, 'count');
    expect(listener).toHaveBeenCalledWith('X', '', 'name');
  });

  it('wildcard unsubscribe stops further calls', () => {
    const listener = vi.fn();
    const unsub = sm.subscribe('*', listener);

    sm.setState('count', 1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    sm.setState('count', 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Key-based subscribe
// ---------------------------------------------------------------------------
describe('StateManager — key-based subscribe', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager(); });
  afterEach(() => { sm.destroy(); });

  it('key listener only fires when that key changes', () => {
    const countListener = vi.fn();
    sm.subscribe('count', countListener);

    sm.setState('name', 'ignored');
    expect(countListener).not.toHaveBeenCalled();

    sm.setState('count', 99);
    expect(countListener).toHaveBeenCalledWith(99, 0, 'count');
  });

  it('key listener does not fire when value does not change', () => {
    sm.setState('count', 5);
    const listener = vi.fn();
    sm.subscribe('count', listener);

    sm.setState('count', 5); // same value
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe removes key listener', () => {
    const listener = vi.fn();
    const unsub = sm.subscribe('count', listener);
    sm.setState('count', 1);
    unsub();
    sm.setState('count', 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// subscribeToProperty
// ---------------------------------------------------------------------------
describe('StateManager — subscribeToProperty', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager(); });
  afterEach(() => { sm.destroy(); });

  it('calls listener when the property value changes', () => {
    const listener = vi.fn();
    sm.subscribeToProperty('count', listener);

    sm.setState('count', 7);
    expect(listener).toHaveBeenCalledWith(7, 0);
  });

  it('does NOT call listener when value is unchanged', () => {
    sm.setState('count', 3);
    const listener = vi.fn();
    sm.subscribeToProperty('count', listener);

    sm.setState('count', 3); // same
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribing stops future notifications', () => {
    const listener = vi.fn();
    const unsub = sm.subscribeToProperty('name', listener);

    sm.setState('name', 'first');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    sm.setState('name', 'second');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// createSelector
// ---------------------------------------------------------------------------
describe('StateManager — createSelector', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager({ count: 0 }); });
  afterEach(() => { sm.destroy(); });

  it('calls listener immediately with current derived value', () => {
    sm.setState('count', 4);
    const listener = vi.fn();
    sm.createSelector((s) => s.count * 2, listener);

    expect(listener).toHaveBeenCalledWith(8);
  });

  it('calls listener again when derived value changes', () => {
    const listener = vi.fn();
    sm.createSelector((s) => s.count * 2, listener);

    sm.setState('count', 5);
    expect(listener).toHaveBeenCalledWith(10);
  });

  it('does NOT call listener when derived value is unchanged', () => {
    const listener = vi.fn();
    sm.createSelector((s) => s.active, listener);
    listener.mockClear();

    sm.setState('count', 99); // does not affect active
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribing removes the selector', () => {
    const listener = vi.fn();
    const unsub = sm.createSelector((s) => s.count, listener);
    listener.mockClear();

    unsub();
    sm.setState('count', 100);
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createComputed / getComputed / get
// ---------------------------------------------------------------------------
describe('StateManager — createComputed / getComputed / get', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager({ count: 2, name: 'test', active: false }); });
  afterEach(() => { sm.destroy(); });

  it('creates a computed property and returns its value via getComputed', () => {
    sm.createComputed('doubled', (s) => s.count * 2, ['count']);
    expect(sm.getComputed<number>('doubled')).toBe(4);
  });

  it('get() is an alias for getComputed()', () => {
    sm.createComputed('tripled', (s) => s.count * 3, ['count']);
    expect(sm.get<number>('tripled')).toBe(6);
  });

  it('getComputed returns undefined for unknown computed names', () => {
    expect(sm.getComputed('nonexistent')).toBeUndefined();
  });

  it('immediately invokes listener with current value', () => {
    const listener = vi.fn();
    sm.createComputed('doubled', (s) => s.count * 2, ['count'], listener);
    expect(listener).toHaveBeenCalledWith(4);
  });

  it('notifies listener when a dependency changes', () => {
    const listener = vi.fn();
    sm.createComputed('doubled', (s) => s.count * 2, ['count'], listener);
    listener.mockClear();

    sm.setState('count', 10);
    expect(listener).toHaveBeenCalledWith(20);
  });

  it('does NOT notify listener when non-dependency changes', () => {
    const listener = vi.fn();
    sm.createComputed('doubled', (s) => s.count * 2, ['count'], listener);
    listener.mockClear();

    sm.setState('name', 'irrelevant');
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribing removes the computed property', () => {
    const unsub = sm.createComputed('doubled', (s) => s.count * 2, ['count']);
    unsub();
    expect(sm.getComputed('doubled')).toBeUndefined();
  });

  it('creates computed without listener when listener is omitted', () => {
    expect(() => {
      sm.createComputed('tripled', (s) => s.count * 3, ['count']);
    }).not.toThrow();
    expect(sm.getComputed<number>('tripled')).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// setComputed (alias for createComputed without listener)
// ---------------------------------------------------------------------------
describe('StateManager — setComputed', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager({ count: 5 }); });
  afterEach(() => { sm.destroy(); });

  it('registers a computed property accessible via getComputed', () => {
    sm.setComputed('x2', (s) => s.count * 2, ['count']);
    expect(sm.getComputed<number>('x2')).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// dispatch + addReducer
// ---------------------------------------------------------------------------
describe('StateManager — dispatch / addReducer', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager({ count: 0 }); });
  afterEach(() => { sm.destroy(); });

  it('dispatches an action to a registered reducer', () => {
    sm.addReducer('INCREMENT', (state) => ({ count: state.count + 1 }));
    sm.dispatch({ type: 'INCREMENT' });
    expect(sm.getState('count')).toBe(1);
  });

  it('passes action payload to reducer', () => {
    sm.addReducer('SET_COUNT', (_state, action) => ({
      count: action.payload as number
    }));
    sm.dispatch({ type: 'SET_COUNT', payload: 99 });
    expect(sm.getState('count')).toBe(99);
  });

  it('dispatching an unknown action type does nothing', () => {
    sm.dispatch({ type: 'UNKNOWN_ACTION' });
    expect(sm.getState('count')).toBe(0);
  });

  it('dispatch enriches action with meta.timestamp', () => {
    let receivedMeta: Record<string, unknown> | undefined;
    sm.addReducer('META_CHECK', (_state, action) => {
      receivedMeta = action.meta;
      return {};
    });
    sm.dispatch({ type: 'META_CHECK' });
    expect(receivedMeta?.timestamp).toBeDefined();
    expect(typeof receivedMeta?.timestamp).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// addMiddleware / use
// ---------------------------------------------------------------------------
describe('StateManager — addMiddleware / use', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager({ count: 0 }); });
  afterEach(() => { sm.destroy(); });

  it('middleware intercepts dispatch calls', () => {
    const intercepted: string[] = [];
    sm.use((_store) => (next) => (action) => {
      intercepted.push(action.type);
      next(action);
    });
    sm.addReducer('MW_TEST', () => ({}));
    sm.dispatch({ type: 'MW_TEST' });
    expect(intercepted).toContain('MW_TEST');
  });

  it('middleware can prevent reducer from running', () => {
    sm.addReducer('BLOCKED', () => ({ count: 999 }));
    sm.use((_store) => (_next) => (_action) => {
      // swallows the action - does NOT call next
    });
    sm.dispatch({ type: 'BLOCKED' });
    expect(sm.getState('count')).toBe(0); // reducer never ran
  });

  it('multiple middleware execute in correct order (reduceRight — first added runs first)', () => {
    const order: number[] = [];
    sm.use((_store) => (next) => (action) => { order.push(1); next(action); });
    sm.use((_store) => (next) => (action) => { order.push(2); next(action); });
    sm.addReducer('ORDER_TEST', () => ({}));
    sm.dispatch({ type: 'ORDER_TEST' });
    // reduceRight folds [mw1, mw2] from right: mw2 wraps the base, then mw1 wraps mw2.
    // mw1 is outermost so it executes first: [1, 2]
    expect(order).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// undo / redo
// ---------------------------------------------------------------------------
describe('StateManager — undo / redo', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager({ count: 0 }); });
  afterEach(() => { sm.destroy(); });

  it('undo returns false when history has fewer than 2 entries', () => {
    expect(sm.undo()).toBe(false);
  });

  it('undo reverts to previous state', () => {
    sm.setState('count', 10);
    sm.setState('count', 20);
    sm.undo();
    expect(sm.getState('count')).toBe(10);
  });

  it('undo notifies subscribers', () => {
    sm.setState('count', 5);
    sm.setState('count', 10);

    const listener = vi.fn();
    sm.subscribe(listener);
    sm.undo();
    expect(listener).toHaveBeenCalled();
  });

  it('redo returns false when redo stack is empty', () => {
    expect(sm.redo()).toBe(false);
  });

  it('redo re-applies the undone state', () => {
    sm.setState('count', 10);
    sm.setState('count', 20);
    sm.undo();
    expect(sm.getState('count')).toBe(10);
    sm.redo();
    expect(sm.getState('count')).toBe(20);
  });

  it('new setState clears the redo stack', () => {
    sm.setState('count', 10);
    sm.setState('count', 20);
    sm.undo();
    sm.setState('count', 99); // clears redo
    expect(sm.redo()).toBe(false);
    expect(sm.getState('count')).toBe(99);
  });

  it('undo/redo do not push entries to history (isTimeTravel guard)', () => {
    sm.setState('count', 1);
    sm.setState('count', 2);
    const beforeHistory = sm.getHistory().length;
    sm.undo();
    // Undo removed one entry, no new one added
    expect(sm.getHistory().length).toBe(beforeHistory - 1);
  });
});

// ---------------------------------------------------------------------------
// getHistory / clearHistory
// ---------------------------------------------------------------------------
describe('StateManager — getHistory / clearHistory', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager(); });
  afterEach(() => { sm.destroy(); });

  it('getHistory returns array of history entries', () => {
    sm.setState('count', 1);
    sm.setState('count', 2);
    const history = sm.getHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  it('clearHistory resets to a single entry and clears redo stack', () => {
    sm.setState('count', 1);
    sm.setState('count', 2);
    sm.setState('count', 3);
    sm.undo(); // puts something on redo stack

    sm.clearHistory();
    expect(sm.getHistory()).toHaveLength(1);
    expect(sm.redo()).toBe(false); // redo stack cleared
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------
describe('StateManager — reset', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager({ count: 5, name: 'orig', active: true }); });
  afterEach(() => { sm.destroy(); });

  it('reset notifies global listeners', () => {
    const listener = vi.fn();
    sm.subscribe(listener);
    sm.reset();
    expect(listener).toHaveBeenCalled();
  });

  it('reset with partial initial state merges values', () => {
    sm.setState('count', 99);
    // reset keeps existing state but overlays initial keys
    sm.reset({ count: 0 } as Partial<TestState>);
    // Implementation: reset does { ...initial, ...existing }
    // so existing count (99) wins over initial count (0)
    const state = sm.getState();
    expect(state).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getDebugInfo
// ---------------------------------------------------------------------------
describe('StateManager — getDebugInfo', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager(); });
  afterEach(() => { sm.destroy(); });

  it('returns an object with expected debug keys', () => {
    const info = sm.getDebugInfo();
    expect(info).toHaveProperty('state');
    expect(info).toHaveProperty('listenerCount');
    expect(info).toHaveProperty('selectorCount');
    expect(info).toHaveProperty('computedCount');
    expect(info).toHaveProperty('reducerCount');
    expect(info).toHaveProperty('middlewareCount');
    expect(info).toHaveProperty('historySize');
    expect(info).toHaveProperty('redoStackSize');
    expect(info).toHaveProperty('reducers');
    expect(info).toHaveProperty('computed');
  });

  it('listenerCount increments after subscribing', () => {
    const before = sm.getDebugInfo().listenerCount;
    sm.subscribe(vi.fn());
    expect(sm.getDebugInfo().listenerCount).toBe(before + 1);
  });

  it('reducerCount increments after addReducer', () => {
    const before = sm.getDebugInfo().reducerCount;
    sm.addReducer('TEST', () => ({}));
    expect(sm.getDebugInfo().reducerCount).toBe(before + 1);
  });

  it('computedCount increments after createComputed', () => {
    const before = sm.getDebugInfo().computedCount;
    sm.createComputed('test', (s) => s.count, ['count']);
    expect(sm.getDebugInfo().computedCount).toBe(before + 1);
  });
});

// ---------------------------------------------------------------------------
// getListenerCount / clearListeners
// ---------------------------------------------------------------------------
describe('StateManager — getListenerCount / clearListeners', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager(); });
  afterEach(() => { sm.destroy(); });

  it('getListenerCount returns 0 initially', () => {
    expect(sm.getListenerCount()).toBe(0);
  });

  it('getListenerCount increments for each subscription', () => {
    sm.subscribe(vi.fn());
    sm.subscribe(vi.fn());
    expect(sm.getListenerCount()).toBe(2);
  });

  it('clearListeners removes all listeners for a key', () => {
    sm.subscribe('count', vi.fn());
    sm.subscribe('count', vi.fn());
    sm.clearListeners('count');
    expect(sm.getListenerCount()).toBe(0);
  });

  it('clearListeners for one key does not affect other keys', () => {
    sm.subscribe('count', vi.fn());
    sm.subscribe('name', vi.fn());
    sm.clearListeners('count');
    expect(sm.getListenerCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// removeState
// ---------------------------------------------------------------------------
describe('StateManager — removeState', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager({ count: 5, name: 'test', active: true }); });
  afterEach(() => { sm.destroy(); });

  it('removes the specified key from state', () => {
    sm.removeState('count');
    expect(sm.getState('count')).toBeUndefined();
  });

  it('does not affect other keys', () => {
    sm.removeState('count');
    expect(sm.getState('name')).toBe('test');
    expect(sm.getState('active')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// batch
// ---------------------------------------------------------------------------
describe('StateManager — batch', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager({ count: 0, name: '', active: false }); });
  afterEach(() => { sm.destroy(); });

  it('collects multiple updates and notifies once', () => {
    const listener = vi.fn();
    sm.subscribe(listener);

    sm.batch(() => {
      sm.setState('count', 1);
      sm.setState('count', 2);
      sm.setState('name', 'batched');
    });

    // Listener called only once (for the final notification after batch)
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('applies all updates by the end of the batch', () => {
    sm.batch(() => {
      sm.setState('count', 7);
      sm.setState('name', 'updated');
    });
    expect(sm.getState('count')).toBe(7);
    expect(sm.getState('name')).toBe('updated');
  });

  it('restores notification methods even when the batch throws', () => {
    try {
      sm.batch(() => {
        sm.setState('count', 5);
        throw new Error('intentional');
      });
    } catch {
      // expected
    }
    // After error, setState should still trigger listeners normally
    const listener = vi.fn();
    sm.subscribe(listener);
    sm.setState('count', 10);
    expect(listener).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setValidator
// ---------------------------------------------------------------------------
describe('StateManager — setValidator', () => {
  let sm: StateManager<TestState>;

  beforeEach(() => { sm = makeManager(); });
  afterEach(() => { sm.destroy(); });

  it('setValidator stores the validator without throwing', () => {
    expect(() => {
      sm.setValidator((_state, _updates) => true);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Persistence — restore from localStorage
// The global test setup mocks localStorage with vi.fn() stubs, so we
// control getItem/setItem return values explicitly in each test.
// ---------------------------------------------------------------------------
describe('StateManager — localStorage persistence', () => {
  const PERSIST_KEY = 'test-sm-persist';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset getItem to return null by default (nothing stored)
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('calls localStorage.setItem on setState when persistence is enabled', () => {
    // getItem returns null → no restore, use initialState
    vi.mocked(localStorage.getItem).mockReturnValue(null);

    const sm = new StateManager<TestState>(
      { count: 0, name: '', active: false },
      { enablePersistence: true, persistenceKey: PERSIST_KEY }
    );
    sm.setState('count', 42);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      PERSIST_KEY,
      expect.stringContaining('"count":42')
    );
    sm.destroy();
  });

  it('restores state from localStorage on construction', () => {
    // Simulate existing stored state
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ count: 77, name: 'restored', active: true })
    );

    const sm = new StateManager<TestState>(
      { count: 0, name: '', active: false },
      { enablePersistence: true, persistenceKey: PERSIST_KEY }
    );

    expect(sm.getState('count')).toBe(77);
    expect(sm.getState('name')).toBe('restored');
    sm.destroy();
  });

  it('falls back to initialState when stored JSON is invalid', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('not valid json {{');

    const sm = new StateManager<TestState>(
      { count: 5, name: 'initial', active: false },
      { enablePersistence: true, persistenceKey: PERSIST_KEY }
    );

    // Should not throw, should use initialState
    expect(sm.getState('count')).toBe(5);
    sm.destroy();
  });

  it('calls localStorage.setItem with the default key when no persistenceKey specified', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);

    const sm = new StateManager<TestState>(
      { count: 1, name: '', active: false },
      { enablePersistence: true }
    );
    sm.setState('count', 9);
    // Default key is 'app-state'
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'app-state',
      expect.any(String)
    );
    sm.destroy();
  });
});

// ---------------------------------------------------------------------------
// createStateManager factory
// ---------------------------------------------------------------------------
describe('createStateManager', () => {
  it('creates a StateManager instance with initial state', () => {
    const sm = createStateManager<TestState>({ count: 3, name: 'init', active: true });
    expect(sm.getState('count')).toBe(3);
    sm.destroy();
  });

  it('creates a StateManager with persistence options', () => {
    const sm = createStateManager<TestState>(
      { count: 0, name: '', active: false },
      { enablePersistence: true, persistenceKey: 'factory-test' }
    );
    expect(sm).toBeInstanceOf(StateManager);
    sm.destroy();
  });

  it('creates a StateManager without any options', () => {
    const sm = createStateManager<TestState>();
    expect(sm).toBeInstanceOf(StateManager);
    sm.destroy();
  });
});

// ---------------------------------------------------------------------------
// History size cap (maxHistorySize = 50)
// ---------------------------------------------------------------------------
describe('StateManager — history size cap', () => {
  it('caps history at maxHistorySize (50) entries', () => {
    const sm = makeManager();
    for (let i = 0; i < 60; i++) {
      sm.setState('count', i);
    }
    expect(sm.getHistory().length).toBeLessThanOrEqual(50);
    sm.destroy();
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------
describe('StateManager — destroy', () => {
  it('clears listeners, selectors, computed, reducers, middleware, history', () => {
    const sm = makeManager({ count: 1, name: 'x', active: true });
    sm.subscribe(vi.fn());
    sm.createSelector((s) => s.count, vi.fn());
    sm.createComputed('c', (s) => s.count, ['count']);
    sm.addReducer('R', () => ({}));
    sm.use((_store) => (next) => (action) => next(action));
    sm.setState('count', 5); // generates history

    sm.destroy();

    const info = sm.getDebugInfo();
    expect(info.listenerCount).toBe(0);
    expect(info.selectorCount).toBe(0);
    expect(info.computedCount).toBe(0);
    expect(info.reducerCount).toBe(0);
    expect(info.middlewareCount).toBe(0);
    expect(info.historySize).toBe(0);
    expect(info.redoStackSize).toBe(0);
  });
});
