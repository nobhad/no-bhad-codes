/**
 * ===============================================
 * THEME MODULE TESTS
 * ===============================================
 * @file src/modules/theme.test.ts
 *
 * Unit tests for ThemeModule functionality.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThemeModule } from './theme';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock state manager with stateful mock
const mockState = { theme: 'light' as 'light' | 'dark', navOpen: false };
const mockSubscribers: Array<(newValue: any, oldValue: any, key: string) => void> = [];

vi.mock('../../../src/core/state.js', () => ({
  StateManager: vi.fn().mockImplementation(() => ({
    setState: vi.fn((updates: any) => {
      const oldState = { ...mockState };
      Object.assign(mockState, updates);
      // Notify subscribers
      Object.keys(updates).forEach(key => {
        mockSubscribers.forEach(cb => cb(mockState[key as keyof typeof mockState], oldState[key as keyof typeof oldState], key));
      });
    }),
    getState: vi.fn(() => mockState),
    subscribe: vi.fn(() => () => {}), // Return unsubscribe function
    subscribeToProperty: vi.fn((key: string, callback: any) => {
      mockSubscribers.push(callback);
      return () => {
        const index = mockSubscribers.indexOf(callback);
        if (index > -1) mockSubscribers.splice(index, 1);
      };
    }),
    destroy: vi.fn()
  })),
  appState: {
    setState: vi.fn((updates: any) => {
      const oldState = { ...mockState };
      Object.assign(mockState, updates);
      // Notify subscribers
      Object.keys(updates).forEach(key => {
        mockSubscribers.forEach(cb => cb(mockState[key as keyof typeof mockState], oldState[key as keyof typeof oldState], key));
      });
    }),
    getState: vi.fn(() => mockState),
    subscribe: vi.fn(() => () => {}),
    subscribeToProperty: vi.fn((key: string, callback: any) => {
      mockSubscribers.push(callback);
      return () => {
        const index = mockSubscribers.indexOf(callback);
        if (index > -1) mockSubscribers.splice(index, 1);
      };
    }),
    destroy: vi.fn()
  }
}));

describe('ThemeModule', () => {
  let themeModule: ThemeModule;
  let mockToggleButton: HTMLElement;

  beforeEach(() => {
    // Reset mock state
    mockState.theme = 'light';
    mockState.navOpen = false;
    mockSubscribers.length = 0; // Clear subscribers

    // Create test container with theme toggle structure
    container = document.createElement('div');
    container.innerHTML = `
      <div class="theme-controls">
        <button
          id="theme-toggle"
          class="theme-toggle"
          aria-label="Toggle theme"
          data-theme="light"
        >
          <span class="theme-icon-wrap">
            <span class="theme-icon">🌙</span>
          </span>
          <span class="theme-text">Dark Mode</span>
        </button>
      </div>
    `;

    document.body.appendChild(container);
    document.documentElement.setAttribute('data-theme', 'light');

    themeModule = new ThemeModule(container);
    vi.clearAllMocks();

    // Mock toggle button
    mockToggleButton = {
      addEventListener: vi.fn(),
      querySelector: vi.fn().mockReturnValue({
        style: { transform: '' }
      })
    } as any;

    mockDocument.getElementById.mockReturnValue(mockToggleButton);
    mockDocument.documentElement.getAttribute.mockReturnValue('light');
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-theme');

    // Restore matchMedia mock after each test (some tests override it)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  describe('initialization', () => {
    it('should initialize with default light theme', async () => {
      await themeModule.init();

      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });

    it('should load theme from localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue('dark');

      await themeModule.init();

      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('theme');
    });

    it('should set up toggle button event listener', async () => {
      await themeModule.init();

      expect(mockDocument.getElementById).toHaveBeenCalledWith('toggle-theme');
      expect(mockToggleButton.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
    });

    it('should handle missing toggle button gracefully', async () => {
      mockDocument.getElementById.mockReturnValue(null);

      await expect(themeModule.init()).resolves.not.toThrow();
    });

    it('should dispatch theme-loaded event', async () => {
      await themeModule.init();

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ThemeModule:theme-loaded'
        })
      );
    });
  });

  describe('theme switching', () => {
    beforeEach(async () => {
      await themeModule.init();
    });

    it('should toggle from light to dark', () => {
      mockDocument.documentElement.getAttribute.mockReturnValue('light');

      themeModule.toggleTheme();

      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should toggle from dark to light', () => {
      mockDocument.documentElement.getAttribute.mockReturnValue('dark');

      themeModule.toggleTheme();

      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    });

    it('should dispatch theme-changed event', () => {
      themeModule.toggleTheme();

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ThemeModule:theme-changed'
        })
      );
    });

    it('should set theme directly', () => {
      themeModule.setTheme('dark');

      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should not change if same theme is set', () => {
      mockDocument.documentElement.getAttribute.mockReturnValue('light');

      themeModule.setTheme('light');

      expect(mockDocument.documentElement.setAttribute).not.toHaveBeenCalled();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('theme detection', () => {
    beforeEach(async () => {
      await themeModule.init();
    });

    it('should get current theme', () => {
      mockDocument.documentElement.getAttribute.mockReturnValue('dark');

      const currentTheme = themeModule.getCurrentTheme();

      expect(currentTheme).toBe('dark');
    });

    it('should check if dark theme is active', () => {
      mockDocument.documentElement.getAttribute.mockReturnValue('dark');

      expect(themeModule.isDarkTheme()).toBe(true);

      mockDocument.documentElement.getAttribute.mockReturnValue('light');

      expect(themeModule.isDarkTheme()).toBe(false);
    });
  });

  describe('icon animation', () => {
    let mockIconWrap: HTMLElement;

    beforeEach(async () => {
      mockIconWrap = {
        style: { transform: '' }
      } as any;

      mockToggleButton.querySelector = vi.fn().mockReturnValue(mockIconWrap);
      await themeModule.init();
    });

    it('should animate icon when toggling to dark theme', () => {
      mockDocument.documentElement.getAttribute.mockReturnValue('light');

      themeModule.toggleTheme();

      expect(mockIconWrap.style.transform).toBe('rotate(180deg)');
    });

    it('should animate icon when toggling to light theme', () => {
      mockDocument.documentElement.getAttribute.mockReturnValue('dark');

      themeModule.toggleTheme();

      expect(mockIconWrap.style.transform).toBe('rotate(0deg)');
    });

    it('should handle missing icon wrap gracefully', () => {
      mockToggleButton.querySelector = vi.fn().mockReturnValue(null);

      expect(() => themeModule.toggleTheme()).not.toThrow();
    });
  });

  describe('preferences', () => {
    beforeEach(async () => {
      await themeModule.init();
    });

    it('should get saved preference', () => {
      mockLocalStorage.getItem.mockReturnValue('dark');

      const preference = themeModule.getSavedPreference();

      expect(preference).toBe('dark');
    });

    it('should clear saved preference', () => {
      themeModule.clearSavedPreference();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('theme');
    });

    it('should reset to default theme', () => {
      themeModule.resetToDefault();

      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('theme');
    });
  });

  describe('error handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      await expect(themeModule.init()).resolves.not.toThrow();
      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });

    it('should handle DOM manipulation errors gracefully', () => {
      mockDocument.documentElement.setAttribute.mockImplementation(() => {
        throw new Error('DOM error');
      });

      expect(() => themeModule.setTheme('dark')).not.toThrow();
    });
  });

  describe('status', () => {
    it('should return correct status before initialization', () => {
      const status = themeModule.getStatus();

      expect(status.initialized).toBe(false);
      expect(status.ready).toBe(false);
    });

    it('should return correct status after initialization', async () => {
      await themeModule.init();

      const status = themeModule.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.ready).toBe(true);
      expect(status.name).toBe('ThemeModule');
    });
  });

  describe('destruction', () => {
    beforeEach(async () => {
      await themeModule.init();
    });

    it('should clean up event listeners on destroy', async () => {
      const removeEventListenerSpy = vi.fn();
      mockToggleButton.removeEventListener = removeEventListenerSpy;

      await themeModule.destroy();

      expect(themeModule.isReady()).toBe(false);
    });
  });
});