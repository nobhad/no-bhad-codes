/**
 * ===============================================
 * SERVICE CONFIGURATION
 * ===============================================
 * @file src/core/services-config.ts
 *
 * Defines and registers all application services.
 * Services are singleton instances that provide shared functionality.
 */

import { container } from './container';
import { componentStore, ComponentRegistry } from '../components';

/**
 * Register all application services with the DI container
 */
export function registerServices(): void {
  // Register component store as a service
  container.singleton('ComponentStore', async () => componentStore);

  // Register component registry utilities
  container.singleton('ComponentRegistry', async () => ComponentRegistry);

  // Register router service
  container.register(
    'RouterService',
    async () => {
      const { RouterService } = await import('../services/router-service');
      return new RouterService({
        defaultRoute: '/',
        smoothScrolling: true,
        scrollOffset: 80,
        transitionDuration: 600
      });
    },
    { singleton: true }
  );

  // Register data service
  container.register(
    'DataService',
    async () => {
      const { DataService } = await import('../services/data-service');
      return new DataService();
    },
    { singleton: true }
  );

  // Register contact service
  container.register(
    'ContactService',
    async () => {
      const { ContactService } = await import('../services/contact-service');
      return new ContactService({
        backend: 'netlify' // Can be configured based on environment
      });
    },
    { singleton: true }
  );

  // Register performance service
  container.register(
    'PerformanceService',
    async () => {
      const { PerformanceService } = await import('../services/performance-service');
      return new PerformanceService({
        lcp: 2500,
        fid: 100,
        cls: 0.1,
        bundleSize: 600 * 1024,
        ttfb: 200
      });
    },
    { singleton: true }
  );

  // Register bundle analyzer service
  container.register(
    'BundleAnalyzerService',
    async () => {
      const { BundleAnalyzerService } = await import('../services/bundle-analyzer');
      return new BundleAnalyzerService();
    },
    { singleton: true }
  );

  // Register visitor tracking service
  container.register(
    'VisitorTrackingService',
    async () => {
      const { VisitorTrackingService } = await import('../services/visitor-tracking');
      // Use API endpoint - Railway in production, localhost in dev
      const apiUrl = import.meta.env.PROD
        ? 'https://no-bhad-codes-production.up.railway.app'
        : 'http://localhost:4001';
      return new VisitorTrackingService({
        enableTracking: true,
        respectDoNotTrack: false, // Track all visitors for analytics
        cookieConsent: false, // Don't require cookie consent for basic analytics
        sessionTimeout: 30,
        trackScrollDepth: true,
        trackClicks: true,
        trackBusinessCardInteractions: true,
        trackFormSubmissions: true,
        trackDownloads: true,
        trackExternalLinks: true,
        batchSize: 10,
        flushInterval: 30,
        endpoint: `${apiUrl}/api/analytics/track`
      });
    },
    { singleton: true }
  );

  // Register code protection service (uses config)
  container.register(
    'CodeProtectionService',
    async () => {
      const { CodeProtectionService } = await import('../services/code-protection-service');
      const { getProtectionConfig } = await import('../config/protection.config');
      return new CodeProtectionService(getProtectionConfig());
    },
    { singleton: true }
  );
}
