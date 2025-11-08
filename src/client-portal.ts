/**
 * ===============================================
 * CLIENT PORTAL ENTRY POINT
 * ===============================================
 * @file src/client-portal.ts
 *
 * Entry point for client portal with full dashboard functionality.
 */

// Import only the necessary CSS for client portal
import './styles/main-new.css';

// Only initialize essential modules for client portal
import { container } from './core/container';
import { ClientPortalModule } from './features/client/client-portal';

class ClientPortalApp {
  private isInitialized = false;
  private clientPortalModule: ClientPortalModule | null = null;

  constructor() {
    this.setupMinimalServices();
  }

  /**
   * Register only essential services for client portal
   */
  private setupMinimalServices(): void {
    // Theme module for light/dark mode
    container.register('ThemeModule', async () => {
      const { ThemeModule } = await import('./modules/theme');
      return new ThemeModule();
    }, { singleton: true });

    // Navigation module (for menu functionality)
    container.register('NavigationModule', async () => {
      const { NavigationModule } = await import('./modules/navigation');
      return new NavigationModule();
    }, { singleton: true });
  }

  /**
   * Initialize the client portal application
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize essential modules only
      const themeModule = await container.resolve('ThemeModule') as any;
      const navigationModule = await container.resolve('NavigationModule') as any;

      // Initialize theme
      await themeModule?.init?.();

      // Initialize navigation
      await navigationModule?.init?.();

      // Initialize the full client portal module
      this.clientPortalModule = new ClientPortalModule();
      await this.clientPortalModule.init();

      this.isInitialized = true;

      if (process.env.NODE_ENV === 'development') {
        console.log('Client Portal initialized');
      }
    } catch (error) {
      console.error('Failed to initialize Client Portal:', error);
    }
  }

}

// Create and initialize the client portal app
const clientPortalApp = new ClientPortalApp();
clientPortalApp.init();

// Export for debugging
export { clientPortalApp };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).CLIENT_PORTAL_APP = clientPortalApp;
}