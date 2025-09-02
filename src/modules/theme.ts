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

import { BaseModule } from './base';
import { appState } from '../core/state';
import type { ModuleOptions } from '../types/modules';

export class ThemeModule extends BaseModule {
  private themeButton: HTMLElement | null = null;
  private unsubscribeState?: () => void;

  constructor(options: ModuleOptions = {}) {
    super('ThemeModule', options);
  }

  protected override async onInit(): Promise<void> {
    // Get theme toggle button
    this.themeButton = this.getElement('themeButton', '#toggle-theme', true) as HTMLElement | null;

    if (this.themeButton) {
      this.setupThemeToggle();
    }

    // Subscribe to theme state changes
    this.unsubscribeState = appState.subscribeToProperty('theme', (newTheme) => {
      this.applyTheme(newTheme);
    });

    // Apply initial theme
    this.applyTheme(appState.getState().theme);
  }

  /**
   * Setup theme toggle button
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

    // Update theme button
    this.updateThemeButton(theme);

    this.log(`Applied theme: ${theme}`);
  }

  /**
   * Update theme button appearance
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
   * Cleanup
   */
  protected override onDestroy(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
  }
}