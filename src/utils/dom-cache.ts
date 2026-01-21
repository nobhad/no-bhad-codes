/**
 * ===============================================
 * DOM CACHE UTILITY
 * ===============================================
 * @file src/utils/dom-cache.ts
 *
 * Provides efficient DOM element caching to reduce
 * repeated querySelector/getElementById calls.
 */

/**
 * Creates a DOM element cache for a module.
 * Elements are lazily cached on first access.
 */
export function createDOMCache<T extends Record<string, string>>() {
  const cache = new Map<keyof T, HTMLElement | null>();
  const selectors: Partial<T> = {};

  return {
    /**
     * Register element selectors for caching
     * @param selectorMap Object mapping keys to CSS selectors or IDs
     */
    register(selectorMap: T): void {
      Object.assign(selectors, selectorMap);
    },

    /**
     * Get a cached element by key, querying DOM only on first access
     * @param key The key for the element
     * @param forceRefresh Force a fresh DOM query
     */
    get<K extends keyof T>(key: K, forceRefresh = false): HTMLElement | null {
      if (!forceRefresh && cache.has(key)) {
        return cache.get(key) || null;
      }

      const selector = selectors[key];
      if (!selector) {
        console.warn(`[DOMCache] No selector registered for key: ${String(key)}`);
        return null;
      }

      // Handle both ID selectors and CSS selectors
      const element = selector.startsWith('#')
        ? document.getElementById(selector.slice(1))
        : document.querySelector(selector) as HTMLElement | null;

      cache.set(key, element);
      return element;
    },

    /**
     * Get element as specific type
     */
    getAs<E extends HTMLElement>(key: keyof T, forceRefresh = false): E | null {
      return this.get(key, forceRefresh) as E | null;
    },

    /**
     * Clear the entire cache (useful when DOM changes significantly)
     */
    clear(): void {
      cache.clear();
    },

    /**
     * Remove a specific element from cache
     */
    invalidate(key: keyof T): void {
      cache.delete(key);
    },

    /**
     * Check if an element is cached and exists
     */
    has(key: keyof T): boolean {
      const element = this.get(key);
      return element !== null;
    }
  };
}

/**
 * Simple element getter with null coalescing
 * Use for one-off element access where caching isn't needed
 */
export function getElement(id: string): HTMLElement | null {
  return document.getElementById(id);
}

/**
 * Get element and throw if not found
 * Use when element is required
 */
export function getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Required element not found: #${id}`);
  }
  return element;
}

/**
 * Get multiple elements by IDs efficiently
 * @param ids Array of element IDs
 * @returns Map of ID to element (null if not found)
 */
export function getElements(ids: string[]): Map<string, HTMLElement | null> {
  const result = new Map<string, HTMLElement | null>();
  for (const id of ids) {
    result.set(id, document.getElementById(id));
  }
  return result;
}

/**
 * Update text content only if element exists and value changed
 * @returns true if updated, false if element not found or value unchanged
 */
export function updateText(id: string, value: string): boolean {
  const element = document.getElementById(id);
  if (element && element.textContent !== value) {
    element.textContent = value;
    return true;
  }
  return false;
}

/**
 * Batch update multiple elements' text content
 * @param updates Object mapping element IDs to text values
 */
export function batchUpdateText(updates: Record<string, string>): void {
  for (const [id, value] of Object.entries(updates)) {
    updateText(id, value);
  }
}
