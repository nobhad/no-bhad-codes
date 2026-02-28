/**
 * ===============================================
 * BASE SERVICE CLASS
 * ===============================================
 * @file scripts/services/base-service.ts
 *
 * Foundation class for all service modules (data, API, utilities).
 * Services are different from DOM modules - they don't manage UI.
 */

import { createLogger } from '../utils/logger';

export abstract class BaseService {
  protected name: string;
  protected isInitialized = false;
  protected debug: boolean;
  private logger: ReturnType<typeof createLogger>;

  constructor(name: string, debug = false) {
    this.name = name;
    this.debug = debug;
    this.logger = createLogger(name);
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
      this.logger.log(...args);
    }
  }

  protected warn(...args: unknown[]): void {
    this.logger.warn(...args);
  }

  protected error(...args: unknown[]): void {
    this.logger.error(...args);
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
