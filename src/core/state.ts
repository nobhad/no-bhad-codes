/**
 * ===============================================
 * CENTRALIZED STATE MANAGEMENT
 * ===============================================
 * @file scripts/core/state.ts
 *
 * Simple reactive state management for the application.
 * Provides centralized state with subscriptions and type safety.
 */

export type StateListener<T> = (newState: T, previousState: T) => void;
export type StateSelector<T, U> = (state: T) => U;
export type StateAction<T> = {
  type: string;
  payload?: any;
  meta?: {
    timestamp: number;
    source?: string;
  };
};
export type StateReducer<T> = (state: T, action: StateAction<T>) => Partial<T>;
export type StateMiddleware<T> = (store: StateManager<T>) => (next: (action: StateAction<T>) => void) => (action: StateAction<T>) => void;
export type ComputedProperty<T, U> = {
  selector: StateSelector<T, U>;
  dependencies: (keyof T)[];
  lastValue?: U;
  listeners: ((value: U) => void)[];
};

export interface AppState {
  // UI State
  theme: 'light' | 'dark';
  navOpen: boolean;
  currentSection: string | null;

  // Intro State
  introComplete: boolean;
  introAnimating: boolean;

  // Works State
  currentChannel: number;
  channelsLoaded: boolean;
  worksData: any[] | null;

  // Form State
  contactFormVisible: boolean;
  contactFormSubmitting: boolean;

  // Performance State
  reducedMotion: boolean;
  devicePixelRatio: number;

  // Network State
  online: boolean;
  connectionType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

  // Error State
  lastError: string | null;
  errorCount: number;
}

export class StateManager<T = AppState> {
  private state: T;
  private listeners = new Map<string, StateListener<T>[]>();
  private selectors = new Map<string, { selector: StateSelector<T, any>, lastValue: any, listeners: Function[] }>();
  private computed = new Map<string, ComputedProperty<T, any>>();
  private reducers = new Map<string, StateReducer<T>>();
  private middleware: StateMiddleware<T>[] = [];
  private history: { state: T; action?: StateAction<T>; timestamp: number }[] = [];
  private maxHistorySize = 50;
  private isTimeTravel = false;

  constructor(initialState?: T) {
    this.state = initialState ? { ...initialState } : {} as T;
  }

  /**
   * Get current state or specific key
   */
  getState(): T;
  getState<K extends keyof T>(key: K): T[K];
  getState<K extends keyof T>(key: K, defaultValue: T[K]): T[K];
  getState<K extends keyof T>(key?: K, defaultValue?: T[K]): T | T[K] | undefined {
    if (key === undefined) {
      return { ...this.state };
    }
    const value = this.state[key];
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Update state with partial changes or set a specific key
   */
  setState(updates: Partial<T>): void;
  setState<K extends keyof T>(key: K, value: T[K]): void;
  setState<K extends keyof T>(keyOrUpdates: K | Partial<T>, value?: T[K]): void {
    const previousState = { ...this.state };

    if (typeof keyOrUpdates === 'string' || typeof keyOrUpdates === 'number' || typeof keyOrUpdates === 'symbol') {
      // Key-value API
      this.state = { ...this.state, [keyOrUpdates]: value };
    } else {
      // Object API
      this.state = { ...this.state, ...keyOrUpdates };
    }

    // Add to history if not time traveling
    if (!this.isTimeTravel) {
      this.addToHistory(this.state);
    }

    // Notify listeners
    this.notifyListeners(this.state, previousState);
    this.notifySelectors();
    this.notifyComputed(previousState);
  }

  /**
   * Dispatch an action to update state
   */
  dispatch(action: StateAction<T>): void {
    const enhancedAction = {
      ...action,
      meta: {
        timestamp: Date.now(),
        source: 'dispatch',
        ...action.meta
      }
    };

    // Apply middleware
    const middlewareChain = this.middleware.reduceRight(
      (next, middleware) => middleware(this)(next),
      (finalAction: StateAction<T>) => {
        const reducer = this.reducers.get(finalAction.type);
        if (reducer) {
          const updates = reducer(this.state, finalAction);
          this.setState(updates);
        }
      }
    );

    middlewareChain(enhancedAction);
  }

  /**
   * Register an action reducer
   */
  addReducer(actionType: string, reducer: StateReducer<T>): void {
    this.reducers.set(actionType, reducer);
  }

  /**
   * Add middleware
   */
  addMiddleware(middleware: StateMiddleware<T>): void {
    this.middleware.push(middleware);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener<T>): () => void;
  subscribe<K extends keyof T>(
    key: K,
    listener: (newValue: T[K], oldValue: T[K] | undefined, key: K) => void
  ): () => void;
  subscribe<K extends keyof T>(
    keyOrListener: K | StateListener<T>,
    listener?: (newValue: T[K], oldValue: T[K] | undefined, key: K) => void
  ): () => void {
    if (typeof keyOrListener === 'function') {
      // Global subscription
      const globalListener = keyOrListener as StateListener<T>;
      const listeners = this.listeners.get('global') || [];
      listeners.push(globalListener);
      this.listeners.set('global', listeners);

      return () => {
        const currentListeners = this.listeners.get('global') || [];
        const index = currentListeners.indexOf(globalListener);
        if (index > -1) {
          currentListeners.splice(index, 1);
        }
      };
    }

    // Key-based subscription
    const key = keyOrListener as K;
    const keyListener = listener!;
    const propertyListeners = this.listeners.get(key as string) || [];
    const wrappedListener: StateListener<T> = (newState, prevState) => {
      const newValue = newState[key];
      const oldValue = prevState[key];
      if (newValue !== oldValue) {
        keyListener(newValue, oldValue, key);
      }
    };

    propertyListeners.push(wrappedListener);
    this.listeners.set(key as string, propertyListeners);

    return () => {
      const currentListeners = this.listeners.get(key as string) || [];
      const index = currentListeners.indexOf(wrappedListener);
      if (index > -1) {
        currentListeners.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to specific property changes
   */
  subscribeToProperty<K extends keyof T>(
    property: K,
    listener: (newValue: T[K], oldValue: T[K]) => void
  ): () => void {
    const propertyListeners = this.listeners.get(property as string) || [];
    const wrappedListener: StateListener<T> = (newState, prevState) => {
      if (newState[property] !== prevState[property]) {
        listener(newState[property], prevState[property]);
      }
    };

    propertyListeners.push(wrappedListener);
    this.listeners.set(property as string, propertyListeners);

    return () => {
      const currentListeners = this.listeners.get(property as string) || [];
      const index = currentListeners.indexOf(wrappedListener);
      if (index > -1) {
        currentListeners.splice(index, 1);
      }
    };
  }

  /**
   * Create a selector for derived state
   */
  createSelector<U>(
    selector: StateSelector<T, U>,
    listener: (value: U) => void
  ): () => void {
    const id = Math.random().toString(36);
    const currentValue = selector(this.state);

    this.selectors.set(id, {
      selector,
      lastValue: currentValue,
      listeners: [listener]
    });

    // Call immediately with current value
    listener(currentValue);

    return () => {
      this.selectors.delete(id);
    };
  }

  /**
   * Create a computed property that depends on specific state properties
   */
  createComputed<U>(
    name: string,
    selector: StateSelector<T, U>,
    dependencies: (keyof T)[],
    listener?: (value: U) => void
  ): () => void {
    const currentValue = selector(this.state);

    const computedProp: ComputedProperty<T, U> = {
      selector,
      dependencies,
      lastValue: currentValue,
      listeners: listener ? [listener] : []
    };

    this.computed.set(name, computedProp);

    // Call immediately with current value if listener provided
    if (listener) {
      listener(currentValue);
    }

    return () => {
      this.computed.delete(name);
    };
  }

  /**
   * Get computed property value
   */
  getComputed<U>(name: string): U | undefined {
    const computedProp = this.computed.get(name);
    if (computedProp) {
      return computedProp.selector(this.state) as U;
    }
    return undefined;
  }

  private notifyListeners(newState: T, previousState: T): void {
    // Global listeners
    const globalListeners = this.listeners.get('global') || [];
    globalListeners.forEach(listener => listener(newState, previousState));

    // Property-specific listeners
    Object.keys(newState as any).forEach(key => {
      if (newState[key as keyof T] !== previousState[key as keyof T]) {
        const propertyListeners = this.listeners.get(key) || [];
        propertyListeners.forEach(listener => listener(newState, previousState));
      }
    });
  }

  private notifySelectors(): void {
    this.selectors.forEach((selectorData, id) => {
      const newValue = selectorData.selector(this.state);
      if (newValue !== selectorData.lastValue) {
        selectorData.lastValue = newValue;
        selectorData.listeners.forEach(listener => listener(newValue));
      }
    });
  }

  private notifyComputed(previousState: T): void {
    this.computed.forEach((computedProp, name) => {
      // Check if any dependency changed
      const hasChanged = computedProp.dependencies.some(
        dep => this.state[dep] !== previousState[dep]
      );

      if (hasChanged) {
        const newValue = computedProp.selector(this.state);
        if (newValue !== computedProp.lastValue) {
          computedProp.lastValue = newValue;
          computedProp.listeners.forEach(listener => listener(newValue));
        }
      }
    });
  }

  private addToHistory(state: T, action?: StateAction<T>): void {
    const historyEntry: { state: T; action?: StateAction<T>; timestamp: number } = {
      state: { ...state },
      timestamp: Date.now()
    };

    if (action !== undefined) {
      historyEntry.action = action;
    }

    this.history.push(historyEntry);

    // Keep history size manageable
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Reset state to initial values
   */
  reset(initialState?: Partial<T>): void {
    const previousState = { ...this.state };
    this.state = { ...(initialState || {}), ...this.state };
    this.notifyListeners(this.state, previousState);
    this.notifySelectors();
  }

  /**
   * Time travel to previous state
   */
  undo(): boolean {
    if (this.history.length < 2) return false;

    this.history.pop(); // Remove current state
    const previousEntry = this.history[this.history.length - 1];

    this.isTimeTravel = true;
    this.state = { ...previousEntry!.state };
    this.notifyListeners(this.state, this.state);
    this.notifySelectors();
    this.notifyComputed(this.state);
    this.isTimeTravel = false;

    return true;
  }

  /**
   * Get state history
   */
  getHistory(): { state: T; action?: StateAction<T>; timestamp: number }[] {
    return [...this.history];
  }

  /**
   * Clear state history
   */
  clearHistory(): void {
    this.history = [{ state: { ...this.state }, timestamp: Date.now() }];
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      state: this.state,
      listenerCount: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
      selectorCount: this.selectors.size,
      computedCount: this.computed.size,
      reducerCount: this.reducers.size,
      middlewareCount: this.middleware.length,
      historySize: this.history.length,
      reducers: Array.from(this.reducers.keys()),
      computed: Array.from(this.computed.keys())
    };
  }

  /**
   * Create a batch update function to prevent multiple notifications
   */
  batch(updates: () => void): void {
    const originalNotify = this.notifyListeners.bind(this);
    const originalNotifySelectors = this.notifySelectors.bind(this);
    const originalNotifyComputed = this.notifyComputed.bind(this);

    let batchedPreviousState: T | null = null;

    // Override notification methods during batch
    this.notifyListeners = (newState: T, previousState: T) => {
      if (!batchedPreviousState) {
        batchedPreviousState = previousState;
      }
    };

    this.notifySelectors = () => {};
    this.notifyComputed = () => {};

    try {
      updates();
    } finally {
      // Restore original methods and notify once
      this.notifyListeners = originalNotify;
      this.notifySelectors = originalNotifySelectors;
      this.notifyComputed = originalNotifyComputed;

      if (batchedPreviousState) {
        this.notifyListeners(this.state, batchedPreviousState);
        this.notifySelectors();
        this.notifyComputed(batchedPreviousState);
      }
    }
  }

  /**
   * Set a computed property
   */
  setComputed<U>(name: string, selector: StateSelector<T, U>, dependencies: (keyof T)[]): void {
    this.createComputed(name, selector, dependencies);
  }

  /**
   * Remove a state property
   */
  removeState(key: keyof T): void {
    const newState = { ...this.state };
    delete newState[key];
    this.state = newState;
  }

  /**
   * Destroy the state manager and clean up
   */
  destroy(): void {
    this.listeners.clear();
    this.selectors.clear();
    this.computed.clear();
    this.reducers.clear();
    this.middleware = [];
    this.history = [];
  }
}

// Enhanced connection detection
const getConnectionType = (): 'slow-2g' | '2g' | '3g' | '4g' | 'unknown' => {
  const connection = (navigator as any).connection;
  if (connection?.effectiveType) {
    return connection.effectiveType;
  }
  return 'unknown';
};

// Default initial state
const initialState: AppState = {
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  navOpen: false,
  currentSection: null,
  introComplete: false,
  introAnimating: false,
  currentChannel: 1,
  channelsLoaded: false,
  worksData: null,
  contactFormVisible: false,
  contactFormSubmitting: false,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  devicePixelRatio: window.devicePixelRatio || 1,
  online: navigator.onLine,
  connectionType: getConnectionType(),
  lastError: null,
  errorCount: 0
};

// Global state manager instance
export const appState = new StateManager<AppState>(initialState);

// Built-in middleware
const loggingMiddleware: StateMiddleware<AppState> = (store) => (next) => (action) => {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.group(`🔄 Action: ${action.type}`);

    console.log('Payload:', action.payload);

    console.log('Previous State:', store.getState());
    next(action);

    console.log('Next State:', store.getState());
    // eslint-disable-next-line no-console
    console.groupEnd();
  } else {
    next(action);
  }
};

const errorHandlingMiddleware: StateMiddleware<AppState> = (store) => (next) => (action) => {
  try {
    next(action);
  } catch (error) {

    console.error('State update error:', error);
    store.setState({
      lastError: error instanceof Error ? error.message : 'Unknown error',
      errorCount: store.getState().errorCount + 1
    });
  }
};

// Add built-in middleware
appState.addMiddleware(loggingMiddleware);
appState.addMiddleware(errorHandlingMiddleware);

// Built-in reducers
appState.addReducer('SET_THEME', (state, action) => ({
  theme: action.payload
}));

appState.addReducer('TOGGLE_NAV', (state) => ({
  navOpen: !state.navOpen
}));

appState.addReducer('SET_CURRENT_SECTION', (state, action) => ({
  currentSection: action.payload
}));

appState.addReducer('COMPLETE_INTRO', (state) => ({
  introComplete: true,
  introAnimating: false
}));

appState.addReducer('SET_CONTACT_FORM_VISIBLE', (state, action) => ({
  contactFormVisible: action.payload
}));

appState.addReducer('CLEAR_ERROR', (state) => ({
  lastError: null
}));

// Built-in computed properties
appState.createComputed(
  'isReducedExperience',
  (state) => state.reducedMotion || state.connectionType === 'slow-2g' || state.connectionType === '2g',
  ['reducedMotion', 'connectionType']
);

appState.createComputed(
  'canShowAnimations',
  (state) => !state.reducedMotion && state.online,
  ['reducedMotion', 'online']
);

// Network status listeners
window.addEventListener('online', () => {
  appState.dispatch({ type: 'NETWORK_STATUS_CHANGED', payload: { online: true } });
});

window.addEventListener('offline', () => {
  appState.dispatch({ type: 'NETWORK_STATUS_CHANGED', payload: { online: false } });
});

// Connection change listener
if ('connection' in navigator) {
  (navigator as any).connection.addEventListener('change', () => {
    appState.dispatch({
      type: 'CONNECTION_TYPE_CHANGED',
      payload: { connectionType: getConnectionType() }
    });
  });
}

// Reducers for network events
appState.addReducer('NETWORK_STATUS_CHANGED', (state, action) => ({
  online: action.payload.online
}));

appState.addReducer('CONNECTION_TYPE_CHANGED', (state, action) => ({
  connectionType: action.payload.connectionType
}));