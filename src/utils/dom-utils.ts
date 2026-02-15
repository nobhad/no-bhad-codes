/**
 * ===============================================
 * DOM UTILITIES
 * ===============================================
 * @file src/utils/dom-utils.ts
 *
 * Common DOM utility functions used across components.
 * Includes classNames, click-outside handling, and debounce/throttle.
 */

// ===============================================
// CLASS NAME UTILITIES
// ===============================================

type ClassValue = string | boolean | null | undefined | Record<string, boolean>;

/**
 * Conditionally join class names together.
 * Filters out falsy values and joins with space.
 *
 * @example
 * cx('btn', isActive && 'active', disabled ? 'disabled' : null)
 * // => 'btn active' (if isActive=true, disabled=false)
 *
 * cx('card', { 'card-hover': isHoverable, 'card-selected': isSelected })
 * // => 'card card-hover' (if isHoverable=true, isSelected=false)
 */
export function cx(...classes: ClassValue[]): string {
  const result: string[] = [];

  for (const cls of classes) {
    if (!cls) continue;

    if (typeof cls === 'string') {
      result.push(cls);
    } else if (typeof cls === 'object') {
      for (const [key, value] of Object.entries(cls)) {
        if (value) {
          result.push(key);
        }
      }
    }
  }

  return result.join(' ');
}

/**
 * Alias for cx - some prefer this name
 */
export const classNames = cx;

// ===============================================
// CLICK OUTSIDE HANDLER
// ===============================================

interface ClickOutsideOptions {
  /** Elements to exclude from triggering close */
  exclude?: HTMLElement[];
  /** Only trigger once then auto-remove */
  once?: boolean;
}

/**
 * Add a click-outside handler to an element.
 * Returns a cleanup function to remove the listener.
 *
 * @example
 * const cleanup = onClickOutside(dropdown, () => {
 *   dropdown.classList.remove('open');
 * });
 * // Later: cleanup();
 */
export function onClickOutside(
  element: HTMLElement,
  callback: (event: MouseEvent) => void,
  options: ClickOutsideOptions = {}
): () => void {
  const { exclude = [], once = false } = options;

  const handler = (event: MouseEvent) => {
    const target = event.target as Node;

    // Check if click is inside the element
    if (element.contains(target)) {
      return;
    }

    // Check if click is inside any excluded elements
    for (const excluded of exclude) {
      if (excluded.contains(target)) {
        return;
      }
    }

    // Click is outside - trigger callback
    callback(event);

    // Remove listener if once option is set
    if (once) {
      document.removeEventListener('click', handler);
    }
  };

  // Use setTimeout to avoid triggering on the same click that opened the element
  setTimeout(() => {
    document.addEventListener('click', handler);
  }, 0);

  // Return cleanup function
  return () => {
    document.removeEventListener('click', handler);
  };
}

// ===============================================
// DEBOUNCE / THROTTLE
// ===============================================

/**
 * Create a debounced version of a function.
 * The function will only be called after it stops being called for the specified delay.
 *
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   searchAPI(query);
 * }, 300);
 *
 * input.addEventListener('input', () => debouncedSearch(input.value));
 */
export function debounce<T extends(...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Create a debounced function that also returns a cancel method.
 * Useful when you need to cancel pending calls.
 *
 * @example
 * const { fn: debouncedSave, cancel } = debounceWithCancel(save, 1000);
 * debouncedSave();
 * // Later, if needed:
 * cancel();
 */
export function debounceWithCancel<T extends(...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): { fn: (...args: Parameters<T>) => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return { fn: debouncedFn, cancel };
}

/**
 * Create a throttled version of a function.
 * The function will be called at most once per specified interval.
 *
 * @example
 * const throttledScroll = throttle(() => {
 *   updateScrollPosition();
 * }, 100);
 *
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle<T extends(...args: Parameters<T>) => void>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= interval) {
      // Enough time has passed, call immediately
      lastCallTime = now;
      fn(...args);
    } else if (!timeoutId) {
      // Schedule a call for when the interval has passed
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        timeoutId = null;
        fn(...args);
      }, interval - timeSinceLastCall);
    }
  };
}

// ===============================================
// KEYBOARD NAVIGATION
// ===============================================

export interface KeyboardNavOptions {
  /** Selector for navigable items within the container */
  itemSelector: string;
  /** Enable wrapping from last to first / first to last */
  wrap?: boolean;
  /** Orientation for arrow key navigation */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** Callback when an item is selected (Enter/Space) */
  onSelect?: (item: HTMLElement, index: number) => void;
  /** Callback when navigation occurs */
  onNavigate?: (item: HTMLElement, index: number) => void;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
}

/**
 * Add keyboard navigation to a container element.
 * Supports arrow keys, Home, End, Enter, Space, and Escape.
 * Returns a cleanup function.
 *
 * @example
 * const cleanup = addKeyboardNav(menu, {
 *   itemSelector: '.menu-item',
 *   onSelect: (item) => item.click(),
 *   onEscape: () => closeMenu()
 * });
 */
export function addKeyboardNav(
  container: HTMLElement,
  options: KeyboardNavOptions
): () => void {
  const {
    itemSelector,
    wrap = true,
    orientation = 'vertical',
    onSelect,
    onNavigate,
    onEscape
  } = options;

  let currentIndex = -1;

  const getItems = (): HTMLElement[] => {
    return Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
  };

  const focusItem = (index: number) => {
    const items = getItems();
    if (items.length === 0) return;

    // Handle wrapping
    if (wrap) {
      if (index < 0) index = items.length - 1;
      if (index >= items.length) index = 0;
    } else {
      index = Math.max(0, Math.min(index, items.length - 1));
    }

    currentIndex = index;
    items[currentIndex].focus();
    onNavigate?.(items[currentIndex], currentIndex);
  };

  const handler = (event: KeyboardEvent) => {
    const items = getItems();
    if (items.length === 0) return;

    // Initialize current index if not set
    if (currentIndex === -1) {
      const focused = document.activeElement as HTMLElement;
      currentIndex = items.indexOf(focused);
      if (currentIndex === -1) currentIndex = 0;
    }

    switch (event.key) {
    case 'ArrowDown':
      if (orientation === 'vertical' || orientation === 'both') {
        event.preventDefault();
        focusItem(currentIndex + 1);
      }
      break;

    case 'ArrowUp':
      if (orientation === 'vertical' || orientation === 'both') {
        event.preventDefault();
        focusItem(currentIndex - 1);
      }
      break;

    case 'ArrowRight':
      if (orientation === 'horizontal' || orientation === 'both') {
        event.preventDefault();
        focusItem(currentIndex + 1);
      }
      break;

    case 'ArrowLeft':
      if (orientation === 'horizontal' || orientation === 'both') {
        event.preventDefault();
        focusItem(currentIndex - 1);
      }
      break;

    case 'Home':
      event.preventDefault();
      focusItem(0);
      break;

    case 'End':
      event.preventDefault();
      focusItem(items.length - 1);
      break;

    case 'Enter':
    case ' ':
      event.preventDefault();
      if (currentIndex >= 0 && currentIndex < items.length) {
        onSelect?.(items[currentIndex], currentIndex);
      }
      break;

    case 'Escape':
      onEscape?.();
      break;
    }
  };

  container.addEventListener('keydown', handler);

  return () => {
    container.removeEventListener('keydown', handler);
  };
}

// ===============================================
// FOCUS MANAGEMENT
// ===============================================

/**
 * Get all focusable elements within a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
}

/**
 * Focus the first focusable element in a container.
 * Returns true if an element was focused.
 */
export function focusFirst(container: HTMLElement): boolean {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    elements[0].focus();
    return true;
  }
  return false;
}

/**
 * Focus the last focusable element in a container.
 * Returns true if an element was focused.
 */
export function focusLast(container: HTMLElement): boolean {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    elements[elements.length - 1].focus();
    return true;
  }
  return false;
}
