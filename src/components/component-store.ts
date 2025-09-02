/**
 * ===============================================
 * COMPONENT STORE
 * ===============================================
 * @file src/components/component-store.ts
 *
 * Central registry for managing component instances,
 * providing lifecycle management and communication.
 */

import { BaseComponent, ComponentProps, ComponentState } from './base-component';
import { container } from '../core/container';

export interface ComponentDefinition {
  name: string;
  factory: (props: ComponentProps) => Promise<BaseComponent>;
  singleton?: boolean;
  lazy?: boolean;
}

export interface ComponentInstance {
  id: string;
  component: BaseComponent;
  mounted: boolean;
  props: ComponentProps;
  element?: HTMLElement;
}

class ComponentStore {
  private components = new Map<string, ComponentInstance>();
  private definitions = new Map<string, ComponentDefinition>();
  private idCounter = 0;

  /**
   * Register a component type
   */
  register(definition: ComponentDefinition): void {
    this.definitions.set(definition.name, definition);

    // Also register in the main container for consistency
    container.register(
      definition.name,
      definition.factory as any,
      {
        singleton: definition.singleton ?? false,
        dependencies: []
      }
    );
  }

  /**
   * Create and mount a component instance
   */
  async create<T extends BaseComponent = BaseComponent>(
    componentName: string,
    props: ComponentProps = {},
    mountTarget?: string | HTMLElement
  ): Promise<T> {
    const definition = this.definitions.get(componentName);
    if (!definition) {
      throw new Error(`Component '${componentName}' not registered`);
    }

    const id = `${componentName}-${++this.idCounter}`;
    const component = await definition.factory(props) as T;

    const instance: ComponentInstance = {
      id,
      component,
      mounted: false,
      props: { ...props },
      element: mountTarget as HTMLElement
    };

    this.components.set(id, instance);

    // Mount if target provided
    if (mountTarget) {
      await component.mount(mountTarget);
      instance.mounted = true;
    }

    return component;
  }

  /**
   * Find component instances by name
   */
  findByName(componentName: string): ComponentInstance[] {
    return Array.from(this.components.values())
      .filter(instance => instance.component.constructor.name.includes(componentName));
  }

  /**
   * Get component instance by ID
   */
  getInstance(id: string): ComponentInstance | null {
    return this.components.get(id) || null;
  }

  /**
   * Update component props
   */
  async updateProps(id: string, newProps: Partial<ComponentProps>): Promise<void> {
    const instance = this.components.get(id);
    if (!instance) {
      throw new Error(`Component instance '${id}' not found`);
    }

    instance.props = { ...instance.props, ...newProps };
    await instance.component.updateProps(newProps);
  }

  /**
   * Destroy component instance
   */
  async destroy(id: string): Promise<void> {
    const instance = this.components.get(id);
    if (!instance) {
      return;
    }

    await instance.component.destroy();
    this.components.delete(id);
  }

  /**
   * Destroy all instances of a component type
   */
  async destroyByName(componentName: string): Promise<void> {
    const instances = this.findByName(componentName);
    await Promise.all(instances.map(instance => this.destroy(instance.id)));
  }

  /**
   * Destroy all components
   */
  async destroyAll(): Promise<void> {
    const destroyPromises = Array.from(this.components.keys())
      .map(id => this.destroy(id));
    await Promise.all(destroyPromises);
  }

  /**
   * Get all component instances
   */
  getAllInstances(): ComponentInstance[] {
    return Array.from(this.components.values());
  }

  /**
   * Get component registry info
   */
  getRegistryInfo() {
    return {
      registeredComponents: Array.from(this.definitions.keys()),
      totalInstances: this.components.size,
      mountedInstances: Array.from(this.components.values())
        .filter(instance => instance.mounted).length,
      instances: Array.from(this.components.entries()).map(([id, instance]) => ({
        id,
        name: instance.component.constructor.name,
        mounted: instance.mounted,
        status: instance.component.getStatus()
      }))
    };
  }

  /**
   * Component communication via events
   */
  broadcast(eventName: string, data: any = {}): void {
    this.components.forEach(instance => {
      const event = new CustomEvent(`component:${eventName}`, {
        detail: { data, sourceId: 'store' }
      });

      if (instance.element) {
        instance.element.dispatchEvent(event);
      } else {
        document.dispatchEvent(event);
      }
    });
  }

  /**
   * Send event to specific component
   */
  send(componentId: string, eventName: string, data: any = {}): void {
    const instance = this.components.get(componentId);
    if (instance) {
      const event = new CustomEvent(`component:${eventName}`, {
        detail: { data, sourceId: 'store', targetId: componentId }
      });

      if (instance.element) {
        instance.element.dispatchEvent(event);
      } else {
        document.dispatchEvent(event);
      }
    }
  }
}

// Component utilities
export class ComponentUtils {
  /**
   * Create a template literal function for HTML
   */
  static html(strings: TemplateStringsArray, ...values: any[]): string {
    return strings.reduce((result, string, i) => {
      return result + string + (values[i] || '');
    }, '');
  }

  /**
   * Create a template literal function for CSS
   */
  static css(strings: TemplateStringsArray, ...values: any[]): string {
    return strings.reduce((result, string, i) => {
      return result + string + (values[i] || '');
    }, '');
  }

  /**
   * Sanitize HTML to prevent XSS
   */
  static sanitizeHTML(html: string): string {
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
  }

  /**
   * Create a debounced function
   */
  static debounce<T extends(...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * Create a throttled function
   */
  static throttle<T extends(...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Parse data attributes from element
   */
  static parseDataAttributes(element: HTMLElement, prefix = 'data-'): Record<string, any> {
    const data: Record<string, any> = {};

    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith(prefix)) {
        const key = attr.name.slice(prefix.length).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        let value: any = attr.value;

        // Try to parse as JSON, number, or boolean
        try {
          value = JSON.parse(attr.value);
        } catch {
          if (attr.value === 'true') value = true;
          else if (attr.value === 'false') value = false;
          else if (!isNaN(Number(attr.value))) value = Number(attr.value);
        }

        data[key] = value;
      }
    });

    return data;
  }

  /**
   * Generate unique ID
   */
  static generateId(prefix = 'component'): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if element is in viewport
   */
  static isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
}

// Global component store instance
export const componentStore = new ComponentStore();