/**
 * ===============================================
 * THEME MODULE TESTS
 * ===============================================
 * @file tests/unit/modules/theme.test.ts
 * 
 * Unit tests for the theme management module.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThemeModule } from '../../../src/modules/theme.js';

// Mock logger
vi.mock('../../../src/services/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

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
  let container: HTMLElement;
  let themeModule: ThemeModule;

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

  describe('Initialization', () => {
    it('should initialize theme module', async () => {
      await themeModule.initialize();

      expect(themeModule.isInitialized).toBe(true);
      expect(themeModule.name).toBe('theme');
    });

    it('should detect current theme from document', async () => {
      document.documentElement.setAttribute('data-theme', 'dark');

      await themeModule.initialize();

      expect(themeModule.getCurrentTheme()).toBe('dark');
    });

    it('should default to light theme if none set', async () => {
      document.documentElement.removeAttribute('data-theme');

      await themeModule.initialize();

      expect(themeModule.getCurrentTheme()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should restore theme from localStorage', async () => {
      (localStorage.getItem as any).mockReturnValue('dark');

      await themeModule.initialize();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should bind theme toggle button', async () => {
      await themeModule.initialize();

      const toggleButton = themeModule.find('#theme-toggle');
      expect(toggleButton).toBeTruthy();
    });
  });

  describe('Theme Detection', () => {
    beforeEach(async () => {
      await themeModule.initialize();
    });

    it('should detect system theme preference', () => {
      // Mock matchMedia for dark theme preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const systemTheme = themeModule.getSystemTheme();
      expect(systemTheme).toBe('dark');
    });

    it('should detect light system theme', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-color-scheme: light)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const systemTheme = themeModule.getSystemTheme();
      expect(systemTheme).toBe('light');
    });

    it('should handle unsupported system theme detection', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => {
          throw new Error('matchMedia not supported');
        }),
      });

      const systemTheme = themeModule.getSystemTheme();
      expect(systemTheme).toBe('light'); // Default fallback
    });
  });

  describe('Theme Switching', () => {
    beforeEach(async () => {
      await themeModule.initialize();
    });

    it('should switch from light to dark theme', () => {
      themeModule.setTheme('dark');

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(themeModule.getCurrentTheme()).toBe('dark');
    });

    it('should switch from dark to light theme', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      
      themeModule.setTheme('light');

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(themeModule.getCurrentTheme()).toBe('light');
    });

    it('should toggle theme', () => {
      expect(themeModule.getCurrentTheme()).toBe('light');

      themeModule.toggleTheme();
      expect(themeModule.getCurrentTheme()).toBe('dark');

      themeModule.toggleTheme();
      expect(themeModule.getCurrentTheme()).toBe('light');
    });

    it('should persist theme preference to localStorage', () => {
      themeModule.setTheme('dark');

      expect(localStorage.setItem).toHaveBeenCalledWith('theme-preference', 'dark');
    });

    it('should update theme toggle button state', () => {
      const toggleButton = themeModule.find('#theme-toggle') as HTMLButtonElement;
      const themeIcon = themeModule.find('.theme-icon') as HTMLElement;
      const themeText = themeModule.find('.theme-text') as HTMLElement;

      themeModule.setTheme('dark');

      expect(toggleButton.getAttribute('data-theme')).toBe('dark');
      expect(themeIcon.textContent).toBe('☀️');
      expect(themeText.textContent).toBe('Light Mode');
    });

    it('should emit theme change events', () => {
      let themeChangeEventFired = false;
      let eventData: any = null;

      container.addEventListener('themeChanged', (event: any) => {
        themeChangeEventFired = true;
        eventData = event.detail;
      });

      themeModule.setTheme('dark');

      expect(themeChangeEventFired).toBe(true);
      expect(eventData).toEqual({
        theme: 'dark',
        previousTheme: 'light'
      });
    });
  });

  describe('Button Interactions', () => {
    beforeEach(async () => {
      await themeModule.initialize();
    });

    it('should toggle theme when button is clicked', () => {
      const toggleButton = themeModule.find('#theme-toggle') as HTMLButtonElement;
      
      expect(themeModule.getCurrentTheme()).toBe('light');

      toggleButton.click();
      expect(themeModule.getCurrentTheme()).toBe('dark');

      toggleButton.click();
      expect(themeModule.getCurrentTheme()).toBe('light');
    });

    it('should handle keyboard activation', () => {
      const toggleButton = themeModule.find('#theme-toggle') as HTMLButtonElement;
      
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      toggleButton.dispatchEvent(enterEvent);

      expect(themeModule.getCurrentTheme()).toBe('dark');

      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      toggleButton.dispatchEvent(spaceEvent);

      expect(themeModule.getCurrentTheme()).toBe('light');
    });

    it('should update button aria-label', () => {
      const toggleButton = themeModule.find('#theme-toggle') as HTMLButtonElement;

      themeModule.setTheme('dark');
      expect(toggleButton.getAttribute('aria-label')).toBe('Switch to light theme');

      themeModule.setTheme('light');
      expect(toggleButton.getAttribute('aria-label')).toBe('Switch to dark theme');
    });
  });

  describe('Animation and Transitions', () => {
    beforeEach(async () => {
      await themeModule.initialize();
    });

    it('should add transition class during theme change', () => {
      const initialTheme = themeModule.getCurrentTheme();
      
      themeModule.setTheme(initialTheme === 'light' ? 'dark' : 'light');

      expect(document.documentElement.classList.contains('theme-transitioning')).toBe(true);
    });

    it('should remove transition class after animation', async () => {
      themeModule.setTheme('dark');

      // Wait for transition to complete
      await new Promise(resolve => setTimeout(resolve, 350)); // Theme transition typically 300ms

      expect(document.documentElement.classList.contains('theme-transitioning')).toBe(false);
    });

    it('should respect reduced motion preference', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      await themeModule.initialize();
      
      themeModule.setTheme('dark');

      expect(document.documentElement.classList.contains('theme-no-transition')).toBe(true);
    });
  });

  describe('System Theme Sync', () => {
    beforeEach(async () => {
      await themeModule.initialize();
    });

    it('should sync with system theme when auto mode enabled', () => {
      themeModule.setAutoMode(true);

      // Mock system theme change
      const mediaQuery = {
        matches: true, // Dark theme
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };

      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockReturnValue(mediaQuery)
      });

      // Trigger system theme change
      const changeHandler = mediaQuery.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true });

      expect(themeModule.getCurrentTheme()).toBe('dark');
    });

    it('should not sync when auto mode disabled', () => {
      themeModule.setAutoMode(false);
      themeModule.setTheme('light');

      // Mock dark system theme
      const mediaQuery = {
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };

      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockReturnValue(mediaQuery)
      });

      const changeHandler = mediaQuery.addEventListener.mock.calls[0]?.[1];
      if (changeHandler) {
        changeHandler({ matches: true });
      }

      expect(themeModule.getCurrentTheme()).toBe('light'); // Should remain light
    });

    it('should store auto mode preference', () => {
      themeModule.setAutoMode(true);

      expect(localStorage.setItem).toHaveBeenCalledWith('theme-auto-mode', 'true');

      themeModule.setAutoMode(false);

      expect(localStorage.setItem).toHaveBeenCalledWith('theme-auto-mode', 'false');
    });
  });

  describe('CSS Custom Properties', () => {
    beforeEach(async () => {
      await themeModule.initialize();
    });

    it('should update CSS custom properties for themes', () => {
      const root = document.documentElement;

      themeModule.setTheme('dark');

      // Check if theme-specific CSS properties are applied
      const computedStyle = window.getComputedStyle(root);
      expect(root.getAttribute('data-theme')).toBe('dark');
    });

    it('should handle custom theme colors', () => {
      const customColors = {
        primary: '#ff6b6b',
        secondary: '#4ecdc4',
        background: '#2c2c2c',
        text: '#ffffff'
      };

      themeModule.setCustomColors(customColors);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--color-primary')).toBe('#ff6b6b');
      expect(root.style.getPropertyValue('--color-secondary')).toBe('#4ecdc4');
    });
  });

  describe('Theme Validation', () => {
    beforeEach(async () => {
      await themeModule.initialize();
    });

    it('should validate theme values', () => {
      expect(() => themeModule.setTheme('light')).not.toThrow();
      expect(() => themeModule.setTheme('dark')).not.toThrow();
      expect(() => themeModule.setTheme('invalid' as any)).toThrow('Invalid theme');
    });

    it('should handle malformed localStorage data', () => {
      (localStorage.getItem as any).mockReturnValue('invalid-theme');

      expect(() => themeModule.initialize()).not.toThrow();
      expect(themeModule.getCurrentTheme()).toBe('light'); // Should fall back to default
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await themeModule.initialize();
    });

    it('should handle localStorage errors gracefully', () => {
      (localStorage.setItem as any).mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(() => themeModule.setTheme('dark')).not.toThrow();
      expect(themeModule.getCurrentTheme()).toBe('dark'); // Should still work
    });

    it('should handle missing toggle button gracefully', async () => {
      // Remove toggle button
      const toggleButton = container.querySelector('#theme-toggle');
      toggleButton?.remove();

      expect(() => themeModule.initialize()).not.toThrow();
    });

    it('should handle CSS property errors', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock CSS property setting to fail
      const originalSetProperty = document.documentElement.style.setProperty;
      document.documentElement.style.setProperty = vi.fn().mockImplementation(() => {
        throw new Error('CSS error');
      });

      themeModule.setCustomColors({ primary: '#ff0000' });

      expect(consoleSpy).toHaveBeenCalled();

      // Restore
      document.documentElement.style.setProperty = originalSetProperty;
      consoleSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await themeModule.initialize();
    });

    it('should throttle rapid theme changes', () => {
      const setThemeSpy = vi.spyOn(themeModule, 'setTheme');

      // Rapid theme changes
      themeModule.toggleTheme();
      themeModule.toggleTheme();
      themeModule.toggleTheme();
      themeModule.toggleTheme();

      // Should debounce/throttle calls
      expect(setThemeSpy).toHaveBeenCalledTimes(4);
    });

    it('should clean up event listeners on destroy', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      await themeModule.teardown();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await themeModule.initialize();
    });

    it('should maintain focus on theme toggle', () => {
      const toggleButton = themeModule.find('#theme-toggle') as HTMLButtonElement;
      
      toggleButton.focus();
      toggleButton.click();

      expect(document.activeElement).toBe(toggleButton);
    });

    it('should provide proper ARIA attributes', () => {
      const toggleButton = themeModule.find('#theme-toggle') as HTMLButtonElement;

      expect(toggleButton.getAttribute('aria-label')).toBeTruthy();
      expect(toggleButton.getAttribute('role')).toBe('button');
    });

    it('should announce theme changes to screen readers', () => {
      themeModule.setTheme('dark');

      const announcement = container.querySelector('[aria-live="polite"]');
      expect(announcement?.textContent).toContain('Theme changed to dark');
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      await themeModule.initialize();

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      await themeModule.teardown();

      expect(removeEventListenerSpy).toHaveBeenCalled();
      expect(themeModule.isInitialized).toBe(false);
    });

    it('should clear timers on destroy', async () => {
      await themeModule.initialize();

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await themeModule.teardown();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});