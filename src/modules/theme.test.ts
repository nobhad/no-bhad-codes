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

// Mock DOM
const mockDocument = {
  documentElement: {
    getAttribute: vi.fn(),
    setAttribute: vi.fn()
  },
  getElementById: vi.fn(),
  addEventListener: vi.fn()
};
Object.defineProperty(global, 'document', {
  value: mockDocument
});

// Mock custom event dispatch
const mockDispatchEvent = vi.fn();
Object.defineProperty(document, 'dispatchEvent', {
  value: mockDispatchEvent
});

describe('ThemeModule', () => {
  let themeModule: ThemeModule;
  let mockToggleButton: HTMLElement;

  beforeEach(() => {
    themeModule = new ThemeModule({ debug: true });

    // Reset all mocks
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
    vi.clearAllMocks();
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