/**
 * ===============================================
 * BASE MODULE SYSTEM
 * ===============================================
 *
 * @file scripts/base.ts
 *
 * Foundation class for all NBW application modules.
 * Provides consistent initialization patterns, error handling,
 * and lifecycle management across the entire application.
 *
 * Features:
 * ✓ Standardized initialization patterns
 * ✓ Built-in error handling and logging
 * ✓ Component lifecycle management
 * ✓ Reduced motion accessibility support
 * ✓ Debug mode for development
 * ✓ Event system integration
 * ✓ Cleanup and destroy methods
 *
 * ===============================================
 */

import type { ModuleOptions, ModuleStatus, EventHandler } from '../../types/modules';

export class BaseModule {
  protected name: string;
  protected isInitialized: boolean;
  protected isDestroyed: boolean;
  protected debug: boolean;
  protected reducedMotion: boolean;
  protected eventListeners: Map<string, EventHandler>;
  protected timelines: Set<any>; // GSAP timeline type would go here
  protected elements: Map<string, Element | null>;
  protected lastActivity: Date | null;
  protected errors: string[];

  constructor(name: string, options: ModuleOptions = {}) {
    this.name = name;
    this.isInitialized = false;
    this.isDestroyed = false;
    this.debug = options.debug || false;
    this.reducedMotion = this.checkReducedMotion();
    this.eventListeners = new Map(); // Map to store { element, event, handler } for easy removal
    this.timelines = new Set(); // Set to store GSAP timelines for easy killing
    this.elements = new Map(); // Map to store cached DOM elements
    this.lastActivity = null;
    this.errors = [];

    // Bind methods to maintain context
    this.init = this.init.bind(this);
    this.destroy = this.destroy.bind(this);
    this.log = this.log.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
    this.getElement = this.getElement.bind(this);
    this.getElements = this.getElements.bind(this);
    this.addEventListener = this.addEventListener.bind(this); // Bind the new method
  }

  /**
   * Check if user prefers reduced motion
   * @returns {boolean}
   */
  protected checkReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Standardized initialization method for all modules with error boundary
   * Child classes should override onInit()
   * @returns {Promise<void>}
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      this.warn('Module already initialized.');
      return;
    }
    this.log('Initializing...');
    try {
      await this.onInit();
      this.isInitialized = true;
      this.isDestroyed = false; // Reset if it was destroyed previously
      this.log('Initialized successfully');
      this.dispatchEvent('initialized');
    } catch (error) {
      this.error('Initialization failed:', error);
      // Error boundary: Module fails gracefully
      this.handleInitError(error as Error);
      // Mark as initialized but with error state
      this.isInitialized = true;
      (this as any).hasError = true;
      this.dispatchEvent('init-error', { error });
    }
  }

  /**
   * Handle initialization errors gracefully
   * @param {Error} error
   */
  protected handleInitError(error: Error): void {
    // Log error details
    this.error(`Module ${this.name} failed to initialize properly:`, error.message);

    // Try to recover with minimal functionality
    if (this.onErrorRecovery) {
      try {
        this.onErrorRecovery(error);
      } catch (recoveryError) {
        this.error('Recovery also failed:', recoveryError);
      }
    }
  }

  /**
   * Optional error recovery method for child classes
   * @param {Error} error
   */
  protected onErrorRecovery(_error: Error): void {
    // Child classes can override this for custom recovery logic
  }

  /**
   * Alias for init() to support legacy tests
   * @returns {Promise<void>}
   */
  async initialize(): Promise<void> {
    return this.init();
  }

  /**
   * Override this method in child classes for custom initialization logic
   * @returns {Promise<void>}
   */
  protected async onInit(): Promise<void> {
    // Child classes should override this method
    return Promise.resolve();
  }

  /**
   * Helper to get and cache a single DOM element
   * @param {string} name - A unique name for the element in the cache
   * @param {string} selector - CSS selector for the element
   * @param {boolean} [required=true] - If true, logs an error if element not found
   * @returns {Element|null} The found element or null
   */
  protected getElement(name: string, selector: string, required = true): Element | null {
    let element = this.elements.get(name);
    if (!element) {
      element = document.querySelector(selector);
      if (element) {
        this.elements.set(name, element);
        this.log(`Cached element: ${name} (${selector})`);
      } else if (required) {
        this.error(`Required element "${name}" with selector "${selector}" not found.`);
      }
      // Optional elements that aren't found don't need a warning - that's expected behavior
    }
    return element;
  }

  /**
   * Helper to get and cache multiple DOM elements (NodeList)
   * @param {string} name - A unique name for the elements in the cache
   * @param {string} selector - CSS selector for the elements
   * @param {boolean} [required=true] - If true, logs a warning if no elements found
   * @returns {NodeListOf<Element>|Array<Element>} The found elements or an empty array
   */
  protected getElements(
    name: string,
    selector: string,
    required = true
  ): NodeListOf<Element> | null {
    let elements = this.elements.get(name) as NodeListOf<Element> | null;
    if (!elements || (elements as NodeListOf<Element>).length === 0) {
      elements = document.querySelectorAll(selector);
      if ((elements as NodeListOf<Element>).length > 0) {
        this.elements.set(name, elements as any);
        this.log(
          `Cached ${(elements as NodeListOf<Element>).length} elements for: ${name} (${selector})`
        );
      } else if (required) {
        this.warn(`No elements found for "${name}" with selector "${selector}".`);
      }
    }
    return elements as NodeListOf<Element> | null;
  }

  /**
   * Add a GSAP timeline to be managed by the module (killed on destroy)
   * @param {gsap.core.Timeline|gsap.core.Tween} timeline
   */
  protected addTimeline(timeline: any): void {
    if (timeline) {
      this.timelines.add(timeline);
    }
  }

  /**
   * Remove a GSAP timeline from being managed
   * @param {gsap.core.Timeline|gsap.core.Tween} timeline
   */
  protected removeTimeline(timeline: any): void {
    if (timeline) {
      this.timelines.delete(timeline);
    }
  }

  /**
   * Add an event listener and store it for cleanup
   * @param {EventTarget} element - The DOM element or EventTarget to attach the listener to
   * @param {string} event - The event type (e.g., 'click', 'keydown')
   * @param {Function} handler - The event handler function
   * @param {string} [key] - An optional unique key for the listener (useful for specific removals)
   */
  protected addEventListener(
    element: Element,
    event: string,
    handler: EventListener,
    key = `${(element as any).id || element.tagName}-${event}-${this.eventListeners.size}`
  ): void {
    if (!element || typeof element.addEventListener !== 'function') {
      this.warn(`Cannot add event listener: Invalid element provided for key "${key}".`);
      return;
    }
    if (typeof handler !== 'function') {
      this.warn(`Cannot add event listener: Invalid handler provided for key "${key}".`);
      return;
    }

    element.addEventListener(event, handler);
    this.eventListeners.set(key, { element, event, handler });
    this.log(`Added event listener: ${key} on ${element.tagName || element.nodeName}`);
  }

  /**
   * Dispatch a custom event from the module
   * @param {string} eventName - Name of the event
   * @param {Object} [detail={}] - Custom data for the event
   */
  protected dispatchEvent(eventName: string, detail: any = {}): void {
    const event = new CustomEvent(`${this.name}:${eventName}`, { detail });
    document.dispatchEvent(event);
    this.log(`Dispatched event: ${eventName}`);
  }

  /**
   * Standardized destruction method for all modules
   * Cleans up event listeners, GSAP timelines, and calls onDestroy()
   * @returns {Promise<void>}
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      this.warn('Module already destroyed.');
      return;
    }
    this.log('Destroying...');
    try {
      // Remove all event listeners
      this.eventListeners.forEach((listener, key) => {
        // 'key' is the Map key, not 'type'
        if (listener && typeof listener === 'object') {
          // Ensure listener is an object
          const { element, event, handler } = listener;
          if (element && event && typeof handler === 'function') {
            // Ensure handler is a function
            element.removeEventListener(event, handler);
          } else {
            this.warn(
              `[${this.name}] Skipping removal for malformed listener (key: ${key}):`,
              listener
            );
          }
        } else {
          this.warn(
            `[${this.name}] Skipping removal for non-object listener (key: ${key}):`,
            listener
          );
        }
      });
      this.eventListeners.clear();

      // Kill all GSAP timelines
      this.timelines.forEach((tl) => tl.kill());
      this.timelines.clear();

      // Call module-specific onDestroy
      await this.onDestroy();

      // Clear element cache
      this.elements.clear();

      // Clear state
      (this as any).state = {};

      this.isDestroyed = true;
      this.isInitialized = false;

      this.log('Destroyed successfully');
      this.dispatchEvent('destroyed');
    } catch (error) {
      this.error('Destruction failed:', error);
      // Mark as destroyed even if cleanup failed
      this.isDestroyed = true;
      this.isInitialized = false;
      throw error; // Re-throw to propagate the error if necessary
    }
  }

  /**
   * Override this method in child classes for custom cleanup logic
   */
  protected async onDestroy(): Promise<void> {
    // Child classes should override this method
  }

  /**
   * Logging methods with module context
   */
  protected log(...args: any[]): void {
    if (this.debug) {
      console.log(`[${this.name}]`, ...args);
    }
  }

  protected warn(...args: any[]): void {
    console.warn(`[${this.name}]`, ...args);
  }

  protected error(...args: any[]): void {
    console.error(`[${this.name}]`, ...args);
  }

  /**
   * Check if module is ready to use
   * @returns {boolean}
   */
  isReady(): boolean {
    return this.isInitialized && !this.isDestroyed;
  }

  /**
   * Get module status information
   * @returns {Object}
   */
  getStatus(): ModuleStatus {
    return {
      name: this.name,
      initialized: this.isInitialized,
      destroyed: this.isDestroyed,
      ready: this.isReady(),
      reducedMotion: this.reducedMotion,
      elementCount: this.elements.size,
      listenerCount: this.eventListeners.size,
      timelineCount: this.timelines.size
    };
  }

  /**
   * Emit custom event (alias for dispatchEvent)
   */
  emit(eventName: string, detail?: any): void {
    this.dispatchEvent(eventName, detail);
  }

  /**
   * Listen for custom events (alias for addEventListener)
   * Tracked for automatic cleanup on destroy
   */
  on(eventName: string, callback: EventListener): void {
    if (typeof document !== 'undefined') {
      document.addEventListener(eventName, callback);
      // Track for cleanup
      const key = `document-${eventName}-${this.eventListeners.size}`;
      this.eventListeners.set(key, {
        element: document as any,
        event: eventName,
        handler: callback
      });
    }
  }

  /**
   * Remove event listener
   */
  off(eventName: string, callback: EventListener): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener(eventName, callback);
      // Remove from tracking
      for (const [key, listener] of this.eventListeners.entries()) {
        if (listener.event === eventName && listener.handler === callback) {
          this.eventListeners.delete(key);
          break;
        }
      }
    }
  }

  /**
   * Find element within cached elements
   */
  find(selector: string): Element | null {
    // Search in cached elements first
    for (const element of this.elements.values()) {
      if (element && element.matches(selector)) {
        return element;
      }
    }
    // Fallback to document query
    return document.querySelector(selector);
  }

  /**
   * Find all elements matching selector
   */
  findAll(selector: string): Element[] {
    return Array.from(document.querySelectorAll(selector));
  }

  /**
   * Set module state (placeholder for state management)
   */
  setState(key: string | Record<string, any>, value?: any): void {
    if (!(this as any).state) {
      (this as any).state = {};
    }

    if (typeof key === 'string') {
      // Single key-value pair
      (this as any).state[key] = value;
    } else {
      // Object with multiple key-value pairs
      (this as any).state = { ...(this as any).state, ...key };
    }
  }

  /**
   * Get module state value
   */
  getState(key: string, defaultValue?: any): any {
    if (!(this as any).state) {
      return defaultValue;
    }
    const value = (this as any).state[key];
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Teardown method (alias for destroy)
   */
  async teardown(): Promise<void> {
    await this.destroy();
  }
}
