/**
 * ===============================================
 * THEME MODULE
 * ===============================================
 * @file src/modules/theme.ts
 * @extends BaseModule
 *
 * Manages light/dark theme switching with state management.
 * Converted to new architecture with dependency injection.
 */

import { BaseModule } from '../core/base';
import { appState } from '../../core/state';
import type { ModuleOptions } from '../../types/modules';

export class ThemeModule extends BaseModule {
  private themeButton: HTMLElement | null = null;
  private dashboardThemeButton: HTMLElement | null = null;
  private unsubscribeState?: () => void;

  constructor(options: ModuleOptions = {}) {
    super('theme', options);
  }

  protected override async onInit(): Promise<void> {
    // Get theme toggle button (main site header) - not required as some pages don't have it
    this.themeButton = this.getElement('themeButton', '#toggle-theme', false) as HTMLElement | null;

    // Get dashboard theme toggle button (client portal dashboard header)
    this.dashboardThemeButton = document.getElementById(
      'dashboard-theme-toggle'
    ) as HTMLElement | null;

    if (this.themeButton) {
      this.setupThemeToggle();
    }

    if (this.dashboardThemeButton) {
      this.setupDashboardThemeToggle();
    }

    // Subscribe to theme state changes
    this.unsubscribeState = appState.subscribeToProperty('theme', (newTheme) => {
      this.applyTheme(newTheme);
    });

    // Apply initial theme
    this.applyTheme(appState.getState().theme);
  }

  /**
   * Setup theme toggle button (main site header)
   */
  private setupThemeToggle(): void {
    if (!this.themeButton) return;

    this.addEventListener(this.themeButton, 'click', () => {
      this.toggleTheme();
    });

    // Update button state
    this.updateThemeButton(appState.getState().theme);
  }

  /**
   * Setup dashboard theme toggle button (client portal)
   */
  private setupDashboardThemeToggle(): void {
    if (!this.dashboardThemeButton) return;

    this.addEventListener(this.dashboardThemeButton, 'click', () => {
      this.toggleTheme();
    });

    // Update button state
    this.updateDashboardThemeButton(appState.getState().theme);
  }

  /**
   * Toggle between light and dark themes
   */
  private toggleTheme(): void {
    const currentTheme = appState.getState().theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Update global state (this will trigger applyTheme via subscription)
    appState.setState({ theme: newTheme });

    this.log(`Theme switched to: ${newTheme}`);
  }

  /**
   * Apply theme to document
   */
  private applyTheme(theme: 'light' | 'dark'): void {
    // Update document attribute
    document.documentElement.setAttribute('data-theme', theme);

    // Store in localStorage
    localStorage.setItem('theme', theme);

    // Update theme-color meta tag to match site background
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      // Light mode: #f8f5f4, Dark mode: #2a2a2a (same for mobile and desktop)
      const themeColor = theme === 'dark' ? '#2a2a2a' : '#f8f5f4';
      themeColorMeta.setAttribute('content', themeColor);
    }

    // Update theme buttons
    this.updateThemeButton(theme);
    this.updateDashboardThemeButton(theme);

    this.log(`Applied theme: ${theme}`);
  }

  /**
   * Update theme button appearance (main site header)
   */
  private updateThemeButton(theme: 'light' | 'dark'): void {
    if (!this.themeButton) return;

    const iconWrap = this.themeButton.querySelector('.icon-wrap') as HTMLElement;
    if (!iconWrap) return;

    // Rotate icon based on theme
    const rotation = theme === 'dark' ? '0deg' : '180deg';
    iconWrap.style.transform = `rotate(${rotation})`;

    // Update aria-label
    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    this.themeButton.setAttribute('aria-label', label);
  }

  /**
   * Update dashboard theme button appearance (client portal)
   */
  private updateDashboardThemeButton(theme: 'light' | 'dark'): void {
    if (!this.dashboardThemeButton) return;

    // Update emoji to reflect current theme
    this.dashboardThemeButton.textContent = theme === 'dark' ? '☀️' : '🌙';

    // Update aria-label
    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    this.dashboardThemeButton.setAttribute('aria-label', label);
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): 'light' | 'dark' {
    return appState.getState().theme;
  }

  /**
   * Set theme programmatically
   */
  setTheme(theme: 'light' | 'dark'): void {
    appState.setState({ theme });
  }

  /**
   * Check if dark theme is active
   */
  isDarkTheme(): boolean {
    return this.getCurrentTheme() === 'dark';
  }

  /**
   * Get saved theme preference from localStorage
   */
  getSavedPreference(): 'light' | 'dark' | null {
    try {
      const saved = localStorage.getItem('theme');
      return saved as 'light' | 'dark' | null;
    } catch {
      return null;
    }
  }

  /**
   * Clear saved theme preference
   */
  clearSavedPreference(): void {
    try {
      localStorage.removeItem('theme');
    } catch {
      // Ignore errors
    }
  }

  /**
   * Reset to default theme
   */
  resetToDefault(): void {
    this.setTheme('light');
    this.clearSavedPreference();
  }

  /**
   * Get system theme preference
   */
  getSystemTheme(): 'light' | 'dark' | 'no-preference' {
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
      return 'no-preference';
    } catch {
      return 'no-preference';
    }
  }

  /**
   * Alias for init() to support legacy tests
   */
  initialize(): Promise<void> {
    return this.init();
  }

  /**
   * Cleanup
   */
  protected override async onDestroy(): Promise<void> {
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
  }
}
