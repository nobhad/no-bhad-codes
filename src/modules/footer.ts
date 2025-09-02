/**
 * ===============================================
 * FOOTER MODULE - COPYRIGHT YEAR MANAGEMENT
 * ===============================================
 * @file src/modules/footer.ts
 *
 * Handles dynamic copyright year updates and other footer functionality
 */

import { BaseModule } from './base';

export class FooterModule extends BaseModule {
  private currentYearElement: HTMLElement | null = null;

  constructor() {
    super('FooterModule');
  }

  /**
   * Initialize the footer module
   */
  override async init(): Promise<void> {
    this.log('Initializing footer module');

    // Find the current year element
    this.currentYearElement = document.getElementById('current-year');

    if (this.currentYearElement) {
      this.updateCopyrightYear();
      this.log('Copyright year updated successfully');
    } else {
      this.error('Current year element not found');
    }
  }

  /**
   * Update the copyright year to current year
   */
  private updateCopyrightYear(): void {
    if (!this.currentYearElement) return;

    const currentYear = new Date().getFullYear();
    this.currentYearElement.textContent = currentYear.toString();

    this.log(`Copyright year updated to: ${currentYear}`);
  }

  /**
   * Cleanup when module is destroyed
   */
  override async destroy(): Promise<void> {
    this.currentYearElement = null;
    this.log('Footer module destroyed');
  }

  /**
   * Get current year (useful for other modules)
   */
  getCurrentYear(): number {
    return new Date().getFullYear();
  }
}