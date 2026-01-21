/**
 * ===============================================
 * BASE SERVICE CLASS
 * ===============================================
 * @file scripts/services/base-service.ts
 *
 * Foundation class for all service modules (data, API, utilities).
 * Services are different from DOM modules - they don't manage UI.
 */

export abstract class BaseService {
  protected name: string;
  protected isInitialized = false;
  protected debug: boolean;

  constructor(name: string, debug = false) {
    this.name = name;
    this.debug = debug;
  }

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    this.log('Initializing service...');
    await this.onInit();
    this.isInitialized = true;
    this.log('Service initialized');
  }

  /**
   * Override in child classes
   */
  protected async onInit(): Promise<void> {
    // Override in child classes
  }

  /**
   * Service-specific logging
   */
  protected log(...args: unknown[]): void {
    if (this.debug) {
      console.log(`[${this.name}]`, ...args);
    }
  }

  protected warn(...args: unknown[]): void {
    console.warn(`[${this.name}]`, ...args);
  }

  protected error(...args: unknown[]): void {
    console.error(`[${this.name}]`, ...args);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      name: this.name,
      initialized: this.isInitialized,
      type: 'service'
    };
  }
}
