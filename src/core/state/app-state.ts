/**
 * @file state/app-state.ts
 * @description Application state instance, middleware, reducers, and event listeners
 */

import { StateManager } from './state-manager';
import type { AppState, StateMiddleware } from './types';
import { createLogger } from '../../utils/logger';
import { formatErrorMessage } from '../../utils/error-utils';

const logger = createLogger('AppState');

// Navigator with Network Information API
interface NavigatorWithConnection {
  connection?: {
    effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  };
}

// Enhanced connection detection
const getConnectionType = (): 'slow-2g' | '2g' | '3g' | '4g' | 'unknown' => {
  const nav = navigator as NavigatorWithConnection;
  if (nav.connection?.effectiveType) {
    return nav.connection.effectiveType;
  }
  return 'unknown';
};

/**
 * Get initial theme based on priority:
 * 1. User's explicit preference (localStorage)
 * 2. System preference (prefers-color-scheme)
 * 3. Default to 'light'
 */
const getInitialTheme = (): 'light' | 'dark' => {
  // Check for user's explicit preference in localStorage
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  // Default to light
  return 'light';
};

// Default initial state
const initialState: AppState = {
  theme: getInitialTheme(),
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
    logger.log(`Action: ${action.type}`);
    logger.log('Payload:', action.payload);
    logger.log('Previous State:', store.getState());
    next(action);
    logger.log('Next State:', store.getState());
  } else {
    next(action);
  }
};

const errorHandlingMiddleware: StateMiddleware<AppState> = (store) => (next) => (action) => {
  try {
    next(action);
  } catch (error) {
    logger.error('State update error:', error);
    store.setState({
      lastError: formatErrorMessage(error, 'Unknown error'),
      errorCount: store.getState().errorCount + 1
    });
  }
};

// Add built-in middleware
appState.addMiddleware(loggingMiddleware);
appState.addMiddleware(errorHandlingMiddleware);

// Built-in reducers
appState.addReducer('SET_THEME', (_state, action) => ({
  theme: (action.payload as 'light' | 'dark') ?? 'light'
}));

appState.addReducer('TOGGLE_NAV', (state) => ({
  navOpen: !state.navOpen
}));

appState.addReducer('SET_CURRENT_SECTION', (_state, action) => ({
  currentSection: (action.payload as string | null) ?? null
}));

appState.addReducer('COMPLETE_INTRO', (_state) => ({
  introComplete: true,
  introAnimating: false
}));

appState.addReducer('SET_CONTACT_FORM_VISIBLE', (_state, action) => ({
  contactFormVisible: (action.payload as boolean) ?? false
}));

appState.addReducer('CLEAR_ERROR', (_state) => ({
  lastError: null
}));

// Built-in computed properties
appState.createComputed(
  'isReducedExperience',
  (state) =>
    state.reducedMotion || state.connectionType === 'slow-2g' || state.connectionType === '2g',
  ['reducedMotion', 'connectionType']
);

appState.createComputed('canShowAnimations', (state) => !state.reducedMotion && state.online, [
  'reducedMotion',
  'online'
]);

// Named handler references for cleanup
const handleOnline = (): void => {
  appState.dispatch({ type: 'NETWORK_STATUS_CHANGED', payload: { online: true } });
};

const handleOffline = (): void => {
  appState.dispatch({ type: 'NETWORK_STATUS_CHANGED', payload: { online: false } });
};

const handleConnectionChange = (): void => {
  appState.dispatch({
    type: 'CONNECTION_TYPE_CHANGED',
    payload: { connectionType: getConnectionType() }
  });
};

const handleDarkModeChange = (e: { matches: boolean }): void => {
  // Only respond to system changes if user hasn't set explicit preference
  const savedTheme = localStorage.getItem('theme');
  if (!savedTheme) {
    appState.dispatch({
      type: 'SET_THEME',
      payload: e.matches ? 'dark' : 'light'
    });
  }
};

// Network status listeners
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

// Connection change listener
if ('connection' in navigator) {
  const nav = navigator as NavigatorWithConnection;
  nav.connection?.addEventListener('change', handleConnectionChange);
}

// System theme preference change listener
// Only auto-update if user hasn't set an explicit preference
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
darkModeMediaQuery.addEventListener('change', handleDarkModeChange);

/**
 * Remove all global event listeners registered by app-state.
 * Call on app shutdown / HMR teardown to prevent memory leaks.
 */
export const disposeAppStateListeners = (): void => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);

  if ('connection' in navigator) {
    const nav = navigator as NavigatorWithConnection;
    nav.connection?.removeEventListener('change', handleConnectionChange);
  }

  darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
};

// Reducers for network events
appState.addReducer('NETWORK_STATUS_CHANGED', (_state, action) => {
  const payload = action.payload as { online: boolean } | undefined;
  return { online: payload?.online ?? true };
});

appState.addReducer('CONNECTION_TYPE_CHANGED', (_state, action) => {
  const payload = action.payload as
    | { connectionType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown' }
    | undefined;
  return { connectionType: payload?.connectionType ?? 'unknown' };
});
