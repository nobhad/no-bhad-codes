/**
 * ===============================================
 * DEBUG & DEVELOPMENT HELPERS
 * ===============================================
 * @file src/core/debug.ts
 *
 * Development utilities and window globals for debugging.
 * Only active in development environment.
 */

import type { Application } from './app';
import { container } from './container';
import { appState } from './state';
import { componentStore } from '../components';

// Type definitions for window globals
interface ServiceInstance {
  init?(): Promise<void> | void;
  destroy?(): Promise<void> | void;
  generateReport?(): unknown;
  analyzeBundles?(): Promise<unknown>;
  exportData?(): Promise<unknown>;
  [key: string]: unknown;
}

// Extend Window interface
declare global {
  interface Window {
    NBW_APP?: Application;
    NBW_STATE?: typeof appState;
    NBW_CONTAINER?: typeof container;
    NBW_DEBUG?: {
      app: Application;
      state: typeof appState;
      container: typeof container;
      components: typeof componentStore;
      getStatus(): unknown;
      getComponentStats(): unknown;
      getPerformanceReport(): Promise<unknown>;
      getBundleAnalysis(): Promise<unknown>;
      getVisitorData(): Promise<unknown>;
      hotReload(): Promise<void>;
      testBusinessCard(): void;
    };
  }
}

/**
 * Setup development helpers on window object
 */
export function setupDebugHelpers(app: Application): void {
  if (typeof window === 'undefined') return;

  window.NBW_APP = app;
  window.NBW_STATE = appState;
  window.NBW_CONTAINER = container;
  window.NBW_DEBUG = {
    app,
    state: appState,
    container,
    components: componentStore,
    getStatus: () => app.getStatus(),
    getComponentStats: () => ({ message: 'Component stats not available' }),
    getPerformanceReport: async () => {
      const perfService = (await container.resolve('PerformanceService')) as ServiceInstance;
      return perfService.generateReport?.();
    },
    getBundleAnalysis: async () => {
      const bundleService = (await container.resolve('BundleAnalyzerService')) as ServiceInstance;
      return bundleService.analyzeBundles?.();
    },
    getVisitorData: async () => {
      try {
        const trackingService = (await container.resolve('VisitorTrackingService')) as ServiceInstance;
        return trackingService.exportData
          ? trackingService.exportData()
          : { error: 'Export method not available' };
      } catch (_error) {
        return { error: 'Visitor tracking not initialized or consented' };
      }
    },
    hotReload: () => app.hotReload(),
    testBusinessCard: () => testBusinessCard(app)
  };
}

/**
 * Test business card debugging helper
 */
function testBusinessCard(app: Application): void {
  console.log('=== BUSINESS CARD DEBUG TEST ===');
  console.log('Overlay elements:', {
    overlayContainer: !!document.getElementById('overlay-business-card-container'),
    overlayCard: !!document.getElementById('overlay-business-card'),
    overlayInner: !!document.getElementById('overlay-business-card-inner')
  });
  console.log('Section elements:', {
    sectionCard: !!document.getElementById('business-card'),
    sectionInner: !!document.getElementById('business-card-inner'),
    sectionContainer: !!document.querySelector('.business-card-container')
  });

  const renderer = app.getModule('SectionCardRenderer');
  const interactions = app.getModule('SectionCardInteractions');

  console.log('SectionCardRenderer:', {
    exists: !!renderer,
    status:
      renderer &&
      typeof renderer === 'object' &&
      'getStatus' in renderer &&
      typeof renderer.getStatus === 'function'
        ? renderer.getStatus()
        : 'No status method'
  });
  console.log('SectionCardInteractions:', {
    exists: !!interactions,
    status:
      interactions &&
      typeof interactions === 'object' &&
      'getStatus' in interactions &&
      typeof interactions.getStatus === 'function'
        ? interactions.getStatus()
        : 'No status method'
  });

  if (
    renderer &&
    'getCardElements' in renderer &&
    typeof renderer.getCardElements === 'function'
  ) {
    console.log('Renderer elements:', renderer.getCardElements());
  }

  console.log(
    'All business card elements:',
    Array.from(
      document.querySelectorAll('[id*="business-card"], [class*="business-card"]')
    ).map((el) => ({
      tag: el.tagName,
      id: el.id,
      classes: el.className
    }))
  );

  // Test clicking on section card
  const sectionCard = document.getElementById('business-card');
  if (sectionCard) {
    console.log('Section card click listeners:', sectionCard.onclick);
    console.log('Section card style:', {
      cursor: sectionCard.style.cursor,
      pointerEvents: sectionCard.style.pointerEvents
    });
  }
}
