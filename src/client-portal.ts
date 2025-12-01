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
import { NavigationModule } from './modules/navigation';

class ClientPortalApp {
  private isInitialized = false;
  private clientPortalModule: ClientPortalModule | null = null;
  private navigationModule: NavigationModule | null = null;

  constructor() {
    this.setupMinimalServices();
  }

  /**
   * Register only essential services for client portal
   */
  private setupMinimalServices(): void {
    // Theme module for light/dark mode
    container.register(
      'ThemeModule',
      async () => {
        const { ThemeModule } = await import('./modules/theme');
        return new ThemeModule();
      },
      { singleton: true }
    );
  }

  /**
   * Initialize the client portal application
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize theme module (for light/dark toggle in header)
      const themeModule = (await container.resolve('ThemeModule')) as any;
      await themeModule?.init?.();

      // Initialize navigation module WITHOUT DataService (uses fallback data)
      // This enables the main nav menu toggle to work on client portal
      this.navigationModule = new NavigationModule({
        // No routerService or dataService - will use fallback navigation data
        debug: process.env.NODE_ENV === 'development'
      });
      await this.navigationModule.init();

      // Initialize the client portal module
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

// Create the client portal app
const clientPortalApp = new ClientPortalApp();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    clientPortalApp.init();
  });
} else {
  // DOM is already ready
  clientPortalApp.init();
}

// Export for debugging
export { clientPortalApp };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).CLIENT_PORTAL_APP = clientPortalApp;
}
