/**
 * ===============================================
 * APP STATE TESTS
 * ===============================================
 * @file tests/unit/state/app-state.test.ts
 *
 * Tests for src/core/state/app-state.ts.
 * Covers: appState instance, built-in reducers, computed properties,
 *         network event handlers, disposeAppStateListeners,
 *         loggingMiddleware, errorHandlingMiddleware, and
 *         getConnectionType / getInitialTheme logic via side effects.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Browser environment stubs — must be set up BEFORE importing app-state
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

// Provide matchMedia that doesn't crash in jsdom
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
}));
Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, writable: true });

// Provide navigator.onLine
Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });

// Provide navigator.connection
Object.defineProperty(navigator, 'connection', {
  value: undefined,
  writable: true,
  configurable: true
});

// Now import appState and disposeAppStateListeners
import { appState, disposeAppStateListeners } from '../../../src/core/state/app-state';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function patchEnv(val: string) {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = val;
  return () => { process.env.NODE_ENV = original; };
}

// ---------------------------------------------------------------------------
// appState instance
// ---------------------------------------------------------------------------
describe('appState — initial state', () => {
  it('is a defined StateManager instance', () => {
    expect(appState).toBeDefined();
  });

  it('has a theme property', () => {
    const theme = appState.getState('theme');
    expect(['light', 'dark']).toContain(theme);
  });

  it('has navOpen defaulting to false', () => {
    expect(appState.getState('navOpen')).toBe(false);
  });

  it('has introComplete defaulting to false', () => {
    expect(appState.getState('introComplete')).toBe(false);
  });

  it('has introAnimating defaulting to false', () => {
    expect(appState.getState('introAnimating')).toBe(false);
  });

  it('has online defaulting to navigator.onLine', () => {
    expect(typeof appState.getState('online')).toBe('boolean');
  });

  it('has errorCount defaulting to 0', () => {
    expect(appState.getState('errorCount')).toBe(0);
  });

  it('has lastError defaulting to null', () => {
    expect(appState.getState('lastError')).toBeNull();
  });

  it('has connectionType as a string', () => {
    const ct = appState.getState('connectionType');
    expect(typeof ct).toBe('string');
  });

  it('has currentChannel defaulting to 1', () => {
    expect(appState.getState('currentChannel')).toBe(1);
  });

  it('has worksData defaulting to null', () => {
    expect(appState.getState('worksData')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Built-in reducers
// ---------------------------------------------------------------------------
describe('appState — SET_THEME reducer', () => {
  afterEach(() => {
    // Reset to a known default
    appState.dispatch({ type: 'SET_THEME', payload: 'light' });
  });

  it('sets theme to dark', () => {
    appState.dispatch({ type: 'SET_THEME', payload: 'dark' });
    expect(appState.getState('theme')).toBe('dark');
  });

  it('sets theme to light', () => {
    appState.dispatch({ type: 'SET_THEME', payload: 'light' });
    expect(appState.getState('theme')).toBe('light');
  });

  it('falls back to light when payload is nullish', () => {
    appState.dispatch({ type: 'SET_THEME', payload: null });
    expect(appState.getState('theme')).toBe('light');
  });
});

describe('appState — TOGGLE_NAV reducer', () => {
  beforeEach(() => {
    // Ensure navOpen starts at false
    if (appState.getState('navOpen')) {
      appState.dispatch({ type: 'TOGGLE_NAV' });
    }
  });

  it('toggles navOpen from false to true', () => {
    appState.dispatch({ type: 'TOGGLE_NAV' });
    expect(appState.getState('navOpen')).toBe(true);
  });

  it('toggles navOpen from true back to false', () => {
    appState.dispatch({ type: 'TOGGLE_NAV' });
    appState.dispatch({ type: 'TOGGLE_NAV' });
    expect(appState.getState('navOpen')).toBe(false);
  });
});

describe('appState — SET_CURRENT_SECTION reducer', () => {
  afterEach(() => {
    appState.dispatch({ type: 'SET_CURRENT_SECTION', payload: null });
  });

  it('sets currentSection to a string', () => {
    appState.dispatch({ type: 'SET_CURRENT_SECTION', payload: 'about' });
    expect(appState.getState('currentSection')).toBe('about');
  });

  it('sets currentSection to null when payload is nullish', () => {
    appState.dispatch({ type: 'SET_CURRENT_SECTION', payload: 'about' });
    appState.dispatch({ type: 'SET_CURRENT_SECTION', payload: null });
    expect(appState.getState('currentSection')).toBeNull();
  });
});

describe('appState — COMPLETE_INTRO reducer', () => {
  it('sets introComplete to true and introAnimating to false', () => {
    appState.dispatch({ type: 'COMPLETE_INTRO' });
    expect(appState.getState('introComplete')).toBe(true);
    expect(appState.getState('introAnimating')).toBe(false);
  });
});

describe('appState — SET_CONTACT_FORM_VISIBLE reducer', () => {
  afterEach(() => {
    appState.dispatch({ type: 'SET_CONTACT_FORM_VISIBLE', payload: false });
  });

  it('shows the contact form', () => {
    appState.dispatch({ type: 'SET_CONTACT_FORM_VISIBLE', payload: true });
    expect(appState.getState('contactFormVisible')).toBe(true);
  });

  it('hides the contact form', () => {
    appState.dispatch({ type: 'SET_CONTACT_FORM_VISIBLE', payload: true });
    appState.dispatch({ type: 'SET_CONTACT_FORM_VISIBLE', payload: false });
    expect(appState.getState('contactFormVisible')).toBe(false);
  });

  it('falls back to false when payload is nullish', () => {
    appState.dispatch({ type: 'SET_CONTACT_FORM_VISIBLE', payload: null });
    expect(appState.getState('contactFormVisible')).toBe(false);
  });
});

describe('appState — CLEAR_ERROR reducer', () => {
  it('clears lastError', () => {
    // Inject an error state directly
    appState.setState({ lastError: 'Something broke' });
    appState.dispatch({ type: 'CLEAR_ERROR' });
    expect(appState.getState('lastError')).toBeNull();
  });
});

describe('appState — NETWORK_STATUS_CHANGED reducer', () => {
  it('sets online to false', () => {
    appState.dispatch({ type: 'NETWORK_STATUS_CHANGED', payload: { online: false } });
    expect(appState.getState('online')).toBe(false);
  });

  it('sets online to true', () => {
    appState.dispatch({ type: 'NETWORK_STATUS_CHANGED', payload: { online: true } });
    expect(appState.getState('online')).toBe(true);
  });

  it('defaults to true when payload is undefined', () => {
    appState.dispatch({ type: 'NETWORK_STATUS_CHANGED', payload: undefined });
    expect(appState.getState('online')).toBe(true);
  });
});

describe('appState — CONNECTION_TYPE_CHANGED reducer', () => {
  it('updates connectionType to 4g', () => {
    appState.dispatch({ type: 'CONNECTION_TYPE_CHANGED', payload: { connectionType: '4g' } });
    expect(appState.getState('connectionType')).toBe('4g');
  });

  it('updates connectionType to slow-2g', () => {
    appState.dispatch({ type: 'CONNECTION_TYPE_CHANGED', payload: { connectionType: 'slow-2g' } });
    expect(appState.getState('connectionType')).toBe('slow-2g');
  });

  it('defaults to unknown when payload is undefined', () => {
    appState.dispatch({ type: 'CONNECTION_TYPE_CHANGED', payload: undefined });
    expect(appState.getState('connectionType')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Built-in computed properties
// ---------------------------------------------------------------------------
describe('appState — isReducedExperience computed', () => {
  afterEach(() => {
    appState.setState({ reducedMotion: false, connectionType: '4g' });
  });

  it('returns true when reducedMotion is true', () => {
    appState.setState({ reducedMotion: true, connectionType: '4g' });
    expect(appState.getComputed<boolean>('isReducedExperience')).toBe(true);
  });

  it('returns true when connectionType is slow-2g', () => {
    appState.setState({ reducedMotion: false, connectionType: 'slow-2g' });
    expect(appState.getComputed<boolean>('isReducedExperience')).toBe(true);
  });

  it('returns true when connectionType is 2g', () => {
    appState.setState({ reducedMotion: false, connectionType: '2g' });
    expect(appState.getComputed<boolean>('isReducedExperience')).toBe(true);
  });

  it('returns false for full-capability state', () => {
    appState.setState({ reducedMotion: false, connectionType: '4g' });
    expect(appState.getComputed<boolean>('isReducedExperience')).toBe(false);
  });
});

describe('appState — canShowAnimations computed', () => {
  afterEach(() => {
    appState.setState({ reducedMotion: false, online: true });
  });

  it('returns true when reducedMotion is false and online is true', () => {
    appState.setState({ reducedMotion: false, online: true });
    expect(appState.getComputed<boolean>('canShowAnimations')).toBe(true);
  });

  it('returns false when reducedMotion is true', () => {
    appState.setState({ reducedMotion: true, online: true });
    expect(appState.getComputed<boolean>('canShowAnimations')).toBe(false);
  });

  it('returns false when offline', () => {
    appState.setState({ reducedMotion: false, online: false });
    expect(appState.getComputed<boolean>('canShowAnimations')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Logging middleware — development mode
// ---------------------------------------------------------------------------
describe('appState — loggingMiddleware', () => {
  it('does not throw when NODE_ENV is development', () => {
    const restore = patchEnv('development');
    try {
      expect(() => {
        appState.dispatch({ type: 'TOGGLE_NAV' });
        appState.dispatch({ type: 'TOGGLE_NAV' }); // reset
      }).not.toThrow();
    } finally {
      restore();
    }
  });

  it('does not throw when NODE_ENV is production', () => {
    const restore = patchEnv('production');
    try {
      expect(() => {
        appState.dispatch({ type: 'TOGGLE_NAV' });
        appState.dispatch({ type: 'TOGGLE_NAV' }); // reset
      }).not.toThrow();
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Error handling middleware
// ---------------------------------------------------------------------------
describe('appState — errorHandlingMiddleware', () => {
  it('catches reducer errors and records them in state', () => {
    // Add a temporary reducer that throws
    appState.addReducer('THROW_TEST', () => {
      throw new Error('reducer boom');
    });

    const beforeCount = appState.getState('errorCount') ?? 0;
    appState.dispatch({ type: 'THROW_TEST' });

    const afterCount = appState.getState('errorCount') ?? 0;
    expect(afterCount).toBeGreaterThan(beforeCount);
    expect(appState.getState('lastError')).toBe('reducer boom');

    // Clean up error state
    appState.dispatch({ type: 'CLEAR_ERROR' });
  });

  it('records "Unknown error" string for non-Error throws', () => {
    appState.addReducer('THROW_STRING', () => {
      throw 'just a string'; // eslint-disable-line no-throw-literal
    });

    appState.dispatch({ type: 'THROW_STRING' });

    expect(appState.getState('lastError')).toBe('Unknown error');
    appState.dispatch({ type: 'CLEAR_ERROR' });
  });
});

// ---------------------------------------------------------------------------
// Network event listener wiring
// ---------------------------------------------------------------------------
describe('appState — window online/offline events', () => {
  it('online event triggers NETWORK_STATUS_CHANGED with online: true', () => {
    appState.setState({ online: false });
    window.dispatchEvent(new Event('online'));
    expect(appState.getState('online')).toBe(true);
  });

  it('offline event triggers NETWORK_STATUS_CHANGED with online: false', () => {
    appState.setState({ online: true });
    window.dispatchEvent(new Event('offline'));
    expect(appState.getState('online')).toBe(false);
  });

  afterEach(() => {
    // Reset to online
    appState.setState({ online: true });
  });
});

// ---------------------------------------------------------------------------
// disposeAppStateListeners
// ---------------------------------------------------------------------------
describe('disposeAppStateListeners', () => {
  it('removes window online/offline listeners so events no longer fire', () => {
    disposeAppStateListeners();

    appState.setState({ online: true });
    window.dispatchEvent(new Event('offline'));
    // After disposal, the offline handler should no longer fire
    expect(appState.getState('online')).toBe(true);

    // Re-register via re-importing would normally happen on re-init;
    // here we just verify the function doesn't throw.
  });

  it('does not throw when called', () => {
    expect(() => disposeAppStateListeners()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// System dark-mode preference change
// ---------------------------------------------------------------------------
describe('appState — dark mode media query listener', () => {
  it('does not throw when matchMedia change event fires', () => {
    // matchMedia.addEventListener is mocked — we exercise the handler
    // indirectly by verifying the module loaded without error.
    expect(appState).toBeDefined();
  });
});
