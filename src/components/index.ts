/**
 * ===============================================
 * COMPONENT SYSTEM REGISTRY
 * ===============================================
 * @file src/components/index.ts
 *
 * Central registry for all components and component utilities.
 */

// Import all dependencies needed for both exports and local registration
import {
  BaseComponent,
  type ComponentProps,
  type ComponentState,
  type ComponentTemplate,
  type ComponentHooks
} from './base-component';
import {
  componentStore,
  ComponentUtils,
  type ComponentDefinition,
  type ComponentInstance
} from './component-store';
import { ButtonComponent, type ButtonProps, type ButtonState } from './button-component';
import { ModalComponent, type ModalProps, type ModalState } from './modal-component';
import {
  PerformanceDashboard,
  type PerformanceDashboardProps,
  type PerformanceDashboardState
} from './performance-dashboard';
import { ConsentBanner, type ConsentBannerProps, type ConsentBannerState } from './consent-banner';
import {
  AnalyticsDashboard,
  type AnalyticsDashboardProps,
  type AnalyticsDashboardState
} from './analytics-dashboard';

// Import simple UI components
import {
  createKanbanBoard,
  getKanbanStyles,
  type KanbanColumn,
  type KanbanItem,
  type KanbanBadge,
  type KanbanConfig
} from './kanban-board';
import {
  createTagInput,
  getTagInputStyles,
  type Tag as TagInputTag,
  type TagInputConfig
} from './tag-input';
import {
  createTimeline,
  getTimelineStyles,
  type TimelineEvent,
  type TimelineConfig
} from './timeline';
import {
  createBarChart,
  createPieChart,
  createSparkline,
  createKPICard,
  getChartStyles,
  type BarChartData,
  type PieChartData,
  type LineChartData
} from './chart-simple';

// Re-export all components, types, and utilities
export { BaseComponent };
export type { ComponentProps, ComponentState, ComponentTemplate, ComponentHooks };
export { componentStore, ComponentUtils };
export type { ComponentDefinition, ComponentInstance };
export { ButtonComponent };
export type { ButtonProps, ButtonState };
export { ModalComponent };
export type { ModalProps, ModalState };
export { PerformanceDashboard };
export type { PerformanceDashboardProps, PerformanceDashboardState };
export { ConsentBanner };
export type { ConsentBannerProps, ConsentBannerState };
export { AnalyticsDashboard };
export type { AnalyticsDashboardProps, AnalyticsDashboardState };

// Simple UI Components exports
export { createKanbanBoard, getKanbanStyles };
export type { KanbanColumn, KanbanItem, KanbanBadge, KanbanConfig };
export { createTagInput, getTagInputStyles };
export type { TagInputTag, TagInputConfig };
export { createTimeline, getTimelineStyles };
export type { TimelineEvent, TimelineConfig };
export { createBarChart, createPieChart, createSparkline, createKPICard, getChartStyles };
export type { BarChartData, PieChartData, LineChartData };

// Portal-shared (reusable for admin + client wireframes)
export { renderBreadcrumbs } from './breadcrumbs';
export type { BreadcrumbItem } from './breadcrumbs';
export { setupTabRouter } from './tab-router';
export type { TabRouterConfig } from './tab-router';
export { createQuickStats } from './quick-stats';
export type { QuickStatItem } from './quick-stats';
export { createRecentActivity } from './recent-activity';
export type { RecentActivityItem } from './recent-activity';
export { createPageHeader } from './page-header';
export type { PageHeaderConfig } from './page-header';
export { createSearchBar } from './search-bar';
export type { SearchBarConfig } from './search-bar';
export { createEmptyState, renderEmptyState } from './empty-state';
export type { EmptyStateOptions } from './empty-state';
export { createStatusBadge, getStatusBadgeHTML } from './status-badge';
export type { StatusBadgeVariant } from './status-badge';
export { createIconButton } from './icon-button';
export type { IconButtonConfig } from './icon-button';
export { createPageTitle } from './page-title';
export type { PageTitleConfig } from './page-title';
export { createViewToggle } from './view-toggle';
export type { ViewToggleConfig, ViewToggleOption } from './view-toggle';
export { createFilterSelect } from './filter-select';
export type { FilterSelectConfig, FilterSelectOption, FilterSelectInstance } from './filter-select';
export { createFormSelect } from './form-select';
export type { FormSelectConfig, FormSelectOption, FormSelectInstance } from './form-select';
export { createTableDropdown, getStatusLabel, LEAD_STATUS_OPTIONS, CONTACT_STATUS_OPTIONS, PROJECT_STATUS_OPTIONS } from './table-dropdown';
export type { TableDropdownOption, TableDropdownConfig } from './table-dropdown';
export { createPortalModal } from './portal-modal';
export type { PortalModalConfig, PortalModalInstance } from './portal-modal';
export { getPortalCheckboxHTML } from './portal-checkbox';
export type { PortalCheckboxConfig } from './portal-checkbox';
export { initPasswordToggle, initAllPasswordToggles } from './password-toggle';

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
export const createButton = (props: ButtonProps, mountTarget?: string | HTMLElement) =>
  componentStore.create<ButtonComponent>('Button', props, mountTarget);

export const createModal = (props: ModalProps, mountTarget?: string | HTMLElement) =>
  componentStore.create<ModalComponent>('Modal', props, mountTarget);

export const createPerformanceDashboard = (
  props: PerformanceDashboardProps = {},
  mountTarget?: string | HTMLElement
) => componentStore.create<PerformanceDashboard>('PerformanceDashboard', props, mountTarget);

export const createConsentBanner = (
  props: ConsentBannerProps = {},
  mountTarget?: string | HTMLElement
) => componentStore.create<ConsentBanner>('ConsentBanner', props, mountTarget);

export const createAnalyticsDashboard = (
  props: AnalyticsDashboardProps = {},
  mountTarget?: string | HTMLElement
) => componentStore.create<AnalyticsDashboard>('AnalyticsDashboard', props, mountTarget);

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
  static async fromConfig(
    config: {
      component: string;
      props: any;
      target: string;
    }[]
  ): Promise<BaseComponent[]> {
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
  static async updateComponentsByType(
    componentName: string,
    props: Partial<ComponentProps>
  ): Promise<void> {
    const instances = componentStore.findByName(componentName);
    await Promise.all(instances.map((instance) => componentStore.updateProps(instance.id, props)));
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
