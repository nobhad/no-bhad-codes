/**
 * ===============================================
 * THEME MODULE TESTS
 * ===============================================
 * @file src/modules/theme.test.ts
 *
 * Unit tests for ThemeModule functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeModule } from './theme';
import { appState } from '../core/state';

describe('ThemeModule', () => {
  let themeModule: ThemeModule;
  let toggleButton: HTMLElement;

  beforeEach(() => {
    // Set up DOM with the required elements
    if (document.body) {
      document.body.innerHTML = `
        <div id="app">
          <button id="toggle-theme" aria-label="Toggle theme">
            <span class="icon-wrap">🌙</span>
          </button>
        </div>
      `;
    }

    toggleButton = document.getElementById('toggle-theme')!;

    // Clear localStorage
    localStorage.clear();
    vi.clearAllMocks();

    // Reset appState to default
    appState.setState({ theme: 'light' });

    themeModule = new ThemeModule({ debug: false });
  });

  afterEach(async () => {
    await themeModule.destroy();
    if (document.body) {
      document.body.innerHTML = '';
    }
  });

  describe('initialization', () => {
    it('should initialize with default light theme', async () => {
      await themeModule.init();

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('should load theme from localStorage', async () => {
      localStorage.setItem('theme', 'dark');
      appState.setState({ theme: 'dark' });

      await themeModule.init();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should set up toggle button event listener', async () => {
      await themeModule.init();

      expect(toggleButton).toBeDefined();
      expect(themeModule.isReady()).toBe(true);
    });

    it('should handle missing toggle button gracefully', async () => {
      if (document.body) {
        document.body.innerHTML = '<div id="app"></div>';
      }

      const moduleWithoutButton = new ThemeModule({ debug: false });
      await expect(moduleWithoutButton.init()).resolves.not.toThrow();
      await moduleWithoutButton.destroy();
    });
  });

  describe('theme switching', () => {
    beforeEach(async () => {
      await themeModule.init();
    });

    it('should toggle from light to dark', () => {
      expect(appState.getState().theme).toBe('light');

      // Simulate click on toggle button
      toggleButton.click();

      expect(appState.getState().theme).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      // Set to dark first
      appState.setState({ theme: 'dark' });
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      // Toggle to light
      toggleButton.click();

      expect(appState.getState().theme).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('should set theme directly', () => {
      appState.setState({ theme: 'dark' });

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('should not change if same theme is set', () => {
      const initialTheme = appState.getState().theme;

      appState.setState({ theme: initialTheme });

      expect(appState.getState().theme).toBe(initialTheme);
    });
  });

  describe('theme detection', () => {
    beforeEach(async () => {
      await themeModule.init();
    });

    it('should get current theme', () => {
      appState.setState({ theme: 'dark' });

      const currentTheme = themeModule.getCurrentTheme();

      expect(currentTheme).toBe('dark');
    });

    it('should check if dark theme is active', () => {
      appState.setState({ theme: 'dark' });
      expect(themeModule.isDarkTheme()).toBe(true);

      appState.setState({ theme: 'light' });
      expect(themeModule.isDarkTheme()).toBe(false);
    });
  });

  describe('icon animation', () => {
    beforeEach(async () => {
      await themeModule.init();
    });

    it('should animate icon when toggling to dark theme', () => {
      const iconWrap = toggleButton.querySelector('.icon-wrap') as HTMLElement;

      appState.setState({ theme: 'dark' });

      // Icon should rotate to 0deg for dark theme
      expect(iconWrap.style.transform).toContain('rotate(0deg)');
    });

    it('should animate icon when toggling to light theme', () => {
      const iconWrap = toggleButton.querySelector('.icon-wrap') as HTMLElement;

      appState.setState({ theme: 'light' });

      // Icon should rotate to 180deg for light theme
      expect(iconWrap.style.transform).toContain('rotate(180deg)');
    });

    it('should handle missing icon wrap gracefully', () => {
      if (document.body) {
        document.body.innerHTML = `
          <div id="app">
            <button id="toggle-theme" aria-label="Toggle theme"></button>
          </div>
        `;
      }

      expect(() => appState.setState({ theme: 'dark' })).not.toThrow();
    });
  });

  describe('preferences', () => {
    beforeEach(async () => {
      await themeModule.init();
    });

    it('should get saved preference', () => {
      localStorage.setItem('theme', 'dark');

      const saved = themeModule.getSavedPreference();

      expect(saved).toBe('dark');
    });

    it('should clear saved preference', () => {
      localStorage.setItem('theme', 'dark');

      themeModule.clearSavedPreference();

      expect(localStorage.getItem('theme')).toBeNull();
    });

    it('should reset to default theme', () => {
      appState.setState({ theme: 'dark' });

      themeModule.resetToDefault();

      expect(appState.getState().theme).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('error handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      await themeModule.init();

      // Should still initialize without throwing
      expect(themeModule.isReady()).toBe(true);

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it('should handle DOM manipulation errors gracefully', () => {
      // Even with errors, the module should not crash
      expect(() => themeModule.getSystemTheme()).not.toThrow();
    });
  });

  describe('status', () => {
    it('should return correct status before initialization', () => {
      const status = themeModule.getStatus();

      expect(status.name).toBe('theme');
      expect(status.initialized).toBe(false);
    });

    it('should return correct status after initialization', async () => {
      await themeModule.init();

      const status = themeModule.getStatus();

      expect(status.name).toBe('theme');
      expect(status.initialized).toBe(true);
    });
  });

  describe('destruction', () => {
    it('should clean up event listeners on destroy', async () => {
      await themeModule.init();

      const clickSpy = vi.fn();
      toggleButton.addEventListener('click', clickSpy);

      await themeModule.destroy();

      // Module should be destroyed
      expect(themeModule.isReady()).toBe(false);
    });
  });
});
