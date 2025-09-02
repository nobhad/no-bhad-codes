/**
 * ===============================================
 * COMPONENT SYSTEM REGISTRY
 * ===============================================
 * @file src/components/index.ts
 *
 * Central registry for all components and component utilities.
 */

export { BaseComponent } from './base-component';
export type { ComponentProps, ComponentState, ComponentTemplate, ComponentHooks } from './base-component';

export { componentStore, ComponentUtils } from './component-store';
export type { ComponentDefinition, ComponentInstance } from './component-store';

export { ButtonComponent } from './button-component';
export type { ButtonProps, ButtonState } from './button-component';

export { ModalComponent } from './modal-component';
export type { ModalProps, ModalState } from './modal-component';

export { PerformanceDashboard } from './performance-dashboard';
export type { PerformanceDashboardProps, PerformanceDashboardState } from './performance-dashboard';

export { ConsentBanner } from './consent-banner';
export type { ConsentBannerProps, ConsentBannerState } from './consent-banner';

export { AnalyticsDashboard } from './analytics-dashboard';
export type { AnalyticsDashboardProps, AnalyticsDashboardState } from './analytics-dashboard';

// Component registration
import { componentStore, ComponentUtils } from './component-store';
import { BaseComponent } from './base-component';
import type { ComponentProps } from './base-component';
import { ButtonComponent, ButtonProps } from './button-component';
import { ModalComponent, ModalProps } from './modal-component';
import { PerformanceDashboard, PerformanceDashboardProps } from './performance-dashboard';
import { ConsentBanner, ConsentBannerProps } from './consent-banner';
import { AnalyticsDashboard, AnalyticsDashboardProps } from './analytics-dashboard';

// Register built-in components
componentStore.register({
  name: 'Button',
  factory: async (props: ButtonProps) => new ButtonComponent(props),
  singleton: false,
  lazy: false
});

componentStore.register({
  name: 'Modal',
  factory: async (props: ModalProps) => new ModalComponent(props),
  singleton: false,
  lazy: false
});

componentStore.register({
  name: 'PerformanceDashboard',
  factory: async (props: PerformanceDashboardProps) => new PerformanceDashboard(props),
  singleton: true,
  lazy: false
});

componentStore.register({
  name: 'ConsentBanner',
  factory: async (props: ConsentBannerProps) => new ConsentBanner(props),
  singleton: true,
  lazy: false
});

componentStore.register({
  name: 'AnalyticsDashboard',
  factory: async (props: AnalyticsDashboardProps) => new AnalyticsDashboard(props),
  singleton: true,
  lazy: false
});

// Component factory functions for easier usage
export const createButton = (props: ButtonProps, mountTarget?: string | HTMLElement) => {
  return componentStore.create<ButtonComponent>('Button', props, mountTarget);
};

export const createModal = (props: ModalProps, mountTarget?: string | HTMLElement) => {
  return componentStore.create<ModalComponent>('Modal', props, mountTarget);
};

export const createPerformanceDashboard = (props: PerformanceDashboardProps = {}, mountTarget?: string | HTMLElement) => {
  return componentStore.create<PerformanceDashboard>('PerformanceDashboard', props, mountTarget);
};

export const createConsentBanner = (props: ConsentBannerProps = {}, mountTarget?: string | HTMLElement) => {
  return componentStore.create<ConsentBanner>('ConsentBanner', props, mountTarget);
};

export const createAnalyticsDashboard = (props: AnalyticsDashboardProps = {}, mountTarget?: string | HTMLElement) => {
  return componentStore.create<AnalyticsDashboard>('AnalyticsDashboard', props, mountTarget);
};

// Utility functions for common operations
export class ComponentRegistry {
  /**
   * Auto-initialize components from data attributes
   */
  static autoInit(container: HTMLElement = document.body): Promise<void[]> {
    const elements = container.querySelectorAll('[data-component]');
    const initPromises: Promise<void>[] = [];

    elements.forEach(async (element) => {
      const componentName = element.getAttribute('data-component');
      if (!componentName) return;

      const props = ComponentUtils.parseDataAttributes(element as HTMLElement, 'data-prop-');

      try {
        await componentStore.create(componentName, props, element as HTMLElement);
        initPromises.push(Promise.resolve());
      } catch (error) {
        console.error(`Failed to auto-initialize component ${componentName}:`, error);
      }
    });

    return Promise.all(initPromises);
  }

  /**
   * Create components from JSON configuration
   */
  static async fromConfig(config: {
    component: string;
    props: any;
    target: string;
  }[]): Promise<BaseComponent[]> {
    const components: BaseComponent[] = [];

    for (const item of config) {
      try {
        const component = await componentStore.create(item.component, item.props, item.target);
        components.push(component);
      } catch (error) {
        console.error('Failed to create component from config:', error);
      }
    }

    return components;
  }

  /**
   * Bulk update component props
   */
  static async updateComponentsByType(componentName: string, props: Partial<ComponentProps>): Promise<void> {
    const instances = componentStore.findByName(componentName);
    await Promise.all(
      instances.map(instance => componentStore.updateProps(instance.id, props))
    );
  }

  /**
   * Get component statistics
   */
  static getStats() {
    const registryInfo = componentStore.getRegistryInfo();
    const stats = {
      ...registryInfo,
      memoryUsage: {
        totalInstances: registryInfo.totalInstances,
        mountedInstances: registryInfo.mountedInstances,
        unmountedInstances: registryInfo.totalInstances - registryInfo.mountedInstances
      },
      performance: {
        averageInitTime: 0, // Could be tracked with performance monitoring
        errorRate: 0 // Could be tracked with error monitoring
      }
    };

    return stats;
  }
}

// ComponentUtils is already exported above, no need to re-export