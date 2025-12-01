/**
 * ===============================================
 * BASE COMPONENT SYSTEM
 * ===============================================
 * @file src/components/base-component.ts
 *
 * Enhanced component architecture with props, state, and lifecycle hooks.
 * Extends BaseModule with component-specific features.
 */

import { BaseModule } from '../modules/base';
import { appState } from '../core/state';
import type { ModuleOptions } from '../types/modules';

export interface ComponentProps {
  [key: string]: any;
}

export interface ComponentState {
  [key: string]: any;
}

export interface ComponentTemplate {
  render(): string;
  css?(): string;
}

export interface ComponentHooks {
  beforeMount?(): void | Promise<void>;
  mounted?(): void | Promise<void>;
  beforeUpdate?(prevProps: ComponentProps, prevState: ComponentState): void | Promise<void>;
  updated?(prevProps: ComponentProps, prevState: ComponentState): void | Promise<void>;
  beforeUnmount?(): void | Promise<void>;
  unmounted?(): void | Promise<void>;
}

export abstract class BaseComponent<
    P extends ComponentProps = ComponentProps,
    S extends ComponentState = ComponentState,
  >
  extends BaseModule
  implements ComponentHooks {
  protected props: P;
  protected state: S;
  protected template: ComponentTemplate | null = null;
  protected shadowRoot: ShadowRoot | null = null;
  protected host: HTMLElement | null = null;
  protected refs: Map<string, Element> = new Map();

  private stateUnsubscribe: (() => void) | null = null;
  private propWatchers: Map<keyof P, ((newVal: any, oldVal: any) => void)[]> = new Map();
  private stateWatchers: Map<keyof S, ((newVal: any, oldVal: any) => void)[]> = new Map();

  constructor(name: string, props: P, initialState: S, options: ModuleOptions = {}) {
    super(name, options);
    this.props = { ...props };
    this.state = { ...initialState };
  }

  /**
   * Mount component to DOM element
   */
  async mount(selector: string | HTMLElement): Promise<void> {
    if (typeof selector === 'string') {
      this.host = document.querySelector(selector);
    } else {
      this.host = selector;
    }

    if (!this.host) {
      throw new Error('Cannot mount component: host element not found');
    }

    await this.beforeMount?.();
    await this.render();
    await this.mounted?.();

    // Subscribe to global state changes
    this.subscribeToGlobalState();

    this.log('Component mounted successfully');
  }

  /**
   * Update component props
   */
  async updateProps(newProps: Partial<P>): Promise<void> {
    const prevProps = { ...this.props };
    this.props = { ...this.props, ...newProps };

    // Notify prop watchers
    Object.keys(newProps).forEach((key) => {
      const watchers = this.propWatchers.get(key as keyof P) || [];
      watchers.forEach((watcher) => watcher(newProps[key], prevProps[key as keyof P]));
    });

    await this.beforeUpdate?.(prevProps, this.state);
    await this.render();
    await this.updated?.(prevProps, this.state);
  }

  /**
   * Update component state
   */
  async setState(updates: Partial<S>): Promise<void> {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };

    // Notify state watchers
    Object.keys(updates).forEach((key) => {
      const watchers = this.stateWatchers.get(key as keyof S) || [];
      watchers.forEach((watcher) => watcher(updates[key], prevState[key as keyof S]));
    });

    await this.beforeUpdate?.(this.props, prevState);
    await this.render();
    await this.updated?.(this.props, prevState);
  }

  /**
   * Watch for prop changes
   */
  watchProp<K extends keyof P>(
    prop: K,
    callback: (newVal: P[K], oldVal: P[K]) => void
  ): () => void {
    const watchers = this.propWatchers.get(prop) || [];
    watchers.push(callback);
    this.propWatchers.set(prop, watchers);

    return () => {
      const currentWatchers = this.propWatchers.get(prop) || [];
      const index = currentWatchers.indexOf(callback);
      if (index > -1) {
        currentWatchers.splice(index, 1);
      }
    };
  }

  /**
   * Watch for state changes
   */
  watchState<K extends keyof S>(
    stateKey: K,
    callback: (newVal: S[K], oldVal: S[K]) => void
  ): () => void {
    const watchers = this.stateWatchers.get(stateKey) || [];
    watchers.push(callback);
    this.stateWatchers.set(stateKey, watchers);

    return () => {
      const currentWatchers = this.stateWatchers.get(stateKey) || [];
      const index = currentWatchers.indexOf(callback);
      if (index > -1) {
        currentWatchers.splice(index, 1);
      }
    };
  }

  /**
   * Create a ref to a DOM element
   */
  createRef(name: string): (el: Element | null) => void {
    return (el: Element | null) => {
      if (el) {
        this.refs.set(name, el);
      } else {
        this.refs.delete(name);
      }
    };
  }

  /**
   * Get a ref by name
   */
  getRef(name: string): Element | null {
    return this.refs.get(name) || null;
  }

  /**
   * Subscribe to global state changes
   */
  private subscribeToGlobalState(): void {
    if (this.onGlobalStateChange) {
      this.stateUnsubscribe = appState.subscribe((newState, prevState) => {
        this.onGlobalStateChange!(newState, prevState);
      });
    }
  }

  /**
   * Override in child classes to handle global state changes
   */
  protected onGlobalStateChange?(newState: any, prevState: any): void;

  /**
   * Render the component
   */
  private async render(): Promise<void> {
    if (!this.host || !this.template) return;

    const html = this.template.render();
    const css = this.template.css?.() || '';

    // Use shadow DOM for style isolation if CSS is provided
    if (css && !this.shadowRoot && !this.host.shadowRoot) {
      this.shadowRoot = this.host.attachShadow({ mode: 'open' });
    } else if (this.host.shadowRoot) {
      this.shadowRoot = this.host.shadowRoot;
    }

    const target = this.shadowRoot || this.host;

    if (this.shadowRoot && css) {
      target.innerHTML = `<style>${css}</style>${html}`;
    } else {
      target.innerHTML = html;
    }

    // Re-cache elements after render
    this.cacheElements();
    this.bindEvents();
  }

  /**
   * Cache DOM elements after render
   */
  protected cacheElements(): void {
    // Override in child classes
  }

  /**
   * Bind event listeners after render
   */
  protected bindEvents(): void {
    // Override in child classes
  }

  /**
   * Component lifecycle hooks
   */
  beforeMount?(): void | Promise<void>;
  mounted?(): void | Promise<void>;
  beforeUpdate?(prevProps: P, prevState: S): void | Promise<void>;
  updated?(prevProps: P, prevState: S): void | Promise<void>;
  beforeUnmount?(): void | Promise<void>;
  unmounted?(): void | Promise<void>;

  /**
   * Enhanced destroy method
   */
  override async destroy(): Promise<void> {
    await this.beforeUnmount?.();

    // Clear watchers
    this.propWatchers.clear();
    this.stateWatchers.clear();

    // Clear refs
    this.refs.clear();

    // Unsubscribe from global state
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }

    // Remove from DOM
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }

    await super.destroy();
    await this.unmounted?.();
  }

  /**
   * Get component info
   */
  getComponentInfo() {
    return {
      ...this.getStatus(),
      props: this.props,
      state: this.state,
      refsCount: this.refs.size,
      propWatchersCount: Array.from(this.propWatchers.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      stateWatchersCount: Array.from(this.stateWatchers.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      hasShadowRoot: !!this.shadowRoot,
      isMounted: !!this.host
    };
  }
}
