/**
 * ===============================================
 * DOM HELPERS UTILITY
 * ===============================================
 * @file src/utils/dom-helpers.ts
 *
 * Shared DOM helper functions for element selection.
 * Consolidates duplicated patterns from admin modules.
 */

/* global Document, EventListenerOrEventListenerObject, AddEventListenerOptions, EventListenerOptions, HTMLElementEventMap */

// ===============================================
// CACHED ELEMENT LOOKUP
// ===============================================

/**
 * Cache for storing DOM element references by ID.
 * Reduces repeated document.getElementById calls.
 */
const elementCache: Map<string, HTMLElement | null> = new Map();

/**
 * Simple getElementById wrapper.
 * Use for one-off element access where caching isn't needed.
 *
 * @param id - Element ID (without # prefix)
 * @returns The element or null if not found
 *
 * @example
 * const button = el('submit-btn');
 * button?.addEventListener('click', handleClick);
 */
export function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

/**
 * Get element by ID with caching.
 * Elements are cached on first access to reduce repeated DOM queries.
 * Use clearDOMCache() when the DOM changes significantly.
 *
 * @param id - Element ID (without # prefix)
 * @returns The element or null if not found
 *
 * @example
 * // First call queries the DOM
 * const header = getCachedElement('page-header');
 *
 * // Subsequent calls return cached reference
 * const headerAgain = getCachedElement('page-header');
 */
export function getCachedElement(id: string): HTMLElement | null {
  if (!elementCache.has(id)) {
    elementCache.set(id, document.getElementById(id));
  }
  return elementCache.get(id) ?? null;
}

/**
 * Clear the DOM element cache.
 * Call this when the DOM structure changes significantly
 * (e.g., after rendering new content, modal opens/closes).
 *
 * @example
 * // After dynamically updating the page
 * container.innerHTML = newContent;
 * clearDOMCache();
 */
export function clearDOMCache(): void {
  elementCache.clear();
}

/** @deprecated Use clearDOMCache instead */
export const clearElementCache = clearDOMCache;

/**
 * Invalidate a specific element from the cache.
 * Use when a single element is removed or replaced.
 *
 * @param id - Element ID to invalidate
 *
 * @example
 * // After replacing a specific element
 * invalidateCachedElement('old-element');
 */
export function invalidateCachedElement(id: string): void {
  elementCache.delete(id);
}

// ===============================================
// QUERY SELECTOR HELPERS
// ===============================================

/**
 * querySelector wrapper with optional parent scope.
 * Returns null if element not found.
 *
 * @param selector - CSS selector string
 * @param parent - Optional parent element to scope the query (defaults to document)
 * @returns The first matching element or null
 *
 * @example
 * // Query from document
 * const nav = qs('.main-nav');
 *
 * // Query within a parent element
 * const modal = qs('.modal');
 * const closeBtn = qs('.close-btn', modal);
 */
export function qs(selector: string, parent?: Element | Document): Element | null {
  const root = parent ?? document;
  return root.querySelector(selector);
}

/**
 * querySelectorAll wrapper that returns an array instead of NodeList.
 * Makes it easier to use array methods like map, filter, forEach.
 *
 * @param selector - CSS selector string
 * @param parent - Optional parent element to scope the query (defaults to document)
 * @returns Array of matching elements
 *
 * @example
 * // Get all items as an array
 * const items = qsa('.list-item');
 *
 * // Use array methods directly
 * const activeItems = qsa('.list-item').filter(item =>
 *   item.classList.contains('active')
 * );
 *
 * // Query within a parent
 * const form = qs('form');
 * const inputs = qsa('input', form);
 */
export function qsa(selector: string, parent?: Element | Document): Element[] {
  const root = parent ?? document;
  return Array.from(root.querySelectorAll(selector));
}

// ===============================================
// TYPED HELPERS
// ===============================================

/**
 * Get element by ID with type assertion.
 * Use when you know the specific element type.
 *
 * @param id - Element ID (without # prefix)
 * @returns The element as the specified type, or null
 *
 * @example
 * const input = elAs<HTMLInputElement>('email-input');
 * if (input) {
 *   console.log(input.value);
 * }
 */
export function elAs<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Get cached element with type assertion.
 *
 * @param id - Element ID (without # prefix)
 * @returns The element as the specified type, or null
 *
 * @example
 * const select = getCachedElementAs<HTMLSelectElement>('country-select');
 * if (select) {
 *   console.log(select.selectedIndex);
 * }
 */
export function getCachedElementAs<T extends HTMLElement>(id: string): T | null {
  return getCachedElement(id) as T | null;
}

/**
 * querySelector with type assertion.
 *
 * @param selector - CSS selector string
 * @param parent - Optional parent element
 * @returns The element as the specified type, or null
 *
 * @example
 * const form = qsAs<HTMLFormElement>('form.contact-form');
 */
export function qsAs<T extends Element>(selector: string, parent?: Element | Document): T | null {
  return qs(selector, parent) as T | null;
}

/**
 * querySelectorAll with type assertion.
 *
 * @param selector - CSS selector string
 * @param parent - Optional parent element
 * @returns Array of elements as the specified type
 *
 * @example
 * const buttons = qsaAs<HTMLButtonElement>('.action-btn');
 */
export function qsaAs<T extends Element>(selector: string, parent?: Element | Document): T[] {
  return qsa(selector, parent) as T[];
}

// ===============================================
// EVENT LISTENER MANAGER
// ===============================================

/**
 * Listener registration for cleanup tracking
 */
interface ListenerRegistration {
  element: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

/**
 * Event listener manager for tracking and cleaning up listeners.
 * Use this to prevent memory leaks from orphaned event listeners.
 *
 * @example
 * const manager = createEventManager();
 *
 * // Add listeners (automatically tracked)
 * manager.on(button, 'click', handleClick);
 * manager.on(window, 'resize', handleResize);
 *
 * // Clean up all listeners when done
 * manager.cleanup();
 */
export interface EventManager {
  /** Add an event listener (tracked for cleanup) */
  on: <K extends keyof HTMLElementEventMap>(
    element: EventTarget,
    type: K | string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => void;
  /** Remove a specific listener */
  off: <K extends keyof HTMLElementEventMap>(
    element: EventTarget,
    type: K | string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ) => void;
  /** Remove all tracked listeners */
  cleanup: () => void;
  /** Get count of tracked listeners */
  count: () => number;
}

/**
 * Create an event manager instance for a module/component.
 * Each manager tracks its own listeners independently.
 *
 * @returns EventManager instance
 *
 * @example
 * class MyComponent {
 *   private events = createEventManager();
 *
 *   init() {
 *     this.events.on(this.button, 'click', this.handleClick);
 *     this.events.on(window, 'scroll', this.handleScroll, { passive: true });
 *   }
 *
 *   destroy() {
 *     this.events.cleanup(); // Removes all listeners
 *   }
 * }
 */
export function createEventManager(): EventManager {
  const listeners: ListenerRegistration[] = [];

  return {
    on(element, type, listener, options) {
      element.addEventListener(type, listener, options);
      listeners.push({ element, type, listener, options });
    },

    off(element, type, listener, options) {
      element.removeEventListener(type, listener, options);
      const index = listeners.findIndex(
        (l) => l.element === element && l.type === type && l.listener === listener
      );
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    },

    cleanup() {
      for (const { element, type, listener, options } of listeners) {
        element.removeEventListener(type, listener, options);
      }
      listeners.length = 0;
    },

    count() {
      return listeners.length;
    }
  };
}

/**
 * Global event manager for app-wide listeners.
 * Use createEventManager() for component-specific listeners instead.
 */
export const globalEventManager = createEventManager();
