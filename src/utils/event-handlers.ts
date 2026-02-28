/**
 * ===============================================
 * EVENT HANDLER UTILITIES
 * ===============================================
 * @file src/utils/event-handlers.ts
 *
 * Reusable event handler patterns for interactive UI components.
 * Consolidates common patterns from admin modules.
 */

/* global Document */

import { debounce } from './dom-utils';

// ===============================================
// CONSTANTS
// ===============================================

/** Default debounce delay for search inputs in milliseconds */
const DEFAULT_DEBOUNCE_MS = 300;

/** Default long press duration in milliseconds */
const DEFAULT_LONG_PRESS_MS = 500;

/** Default minimum search length */
const DEFAULT_MIN_SEARCH_LENGTH = 0;

// ===============================================
// TOGGLE HANDLER
// ===============================================

/**
 * Create a toggle handler that removes active class from siblings and adds to clicked item.
 * Useful for tab interfaces, tool selectors, and option groups.
 *
 * @param container - Parent element containing the toggle items
 * @param itemSelector - CSS selector for items within the container
 * @param activeClass - Class name to toggle (default: 'active')
 * @returns Function that toggles the active state on a given item
 *
 * @example
 * const toggle = createToggleHandler(toolbar, '.tool-btn', 'active');
 * toolbar.querySelectorAll('.tool-btn').forEach(btn => {
 *   btn.addEventListener('click', () => toggle(btn as HTMLElement));
 * });
 */
export function createToggleHandler(
  container: HTMLElement,
  itemSelector: string,
  activeClass: string = 'active'
): (item: HTMLElement) => void {
  return (item: HTMLElement) => {
    // Remove active class from all items
    container.querySelectorAll(itemSelector).forEach((el) => {
      el.classList.remove(activeClass);
    });
    // Add active class to the clicked item
    item.classList.add(activeClass);
  };
}

// ===============================================
// LONG PRESS HANDLER
// ===============================================

/**
 * Setup long-press handler for touch/mouse events.
 * Triggers callback after holding for specified duration.
 * Works with both touch (mobile) and mouse (desktop) events.
 *
 * @param element - Element to attach long press listener to
 * @param callback - Function to call when long press is detected
 * @param duration - Time in ms to hold before triggering (default: 500)
 * @returns Cleanup function to remove all event listeners
 *
 * @example
 * const cleanup = setupLongPress(messageEl, () => {
 *   showReactionPicker(messageId);
 * }, 500);
 * // Later: cleanup();
 */
export function setupLongPress(
  element: HTMLElement,
  callback: () => void,
  duration: number = DEFAULT_LONG_PRESS_MS
): () => void {
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  const startLongPress = () => {
    longPressTimer = setTimeout(() => {
      callback();
    }, duration);
  };

  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  // Touch events for mobile
  element.addEventListener('touchstart', startLongPress, { passive: true });
  element.addEventListener('touchend', cancelLongPress);
  element.addEventListener('touchmove', cancelLongPress);

  // Mouse events for desktop
  element.addEventListener('mousedown', startLongPress);
  element.addEventListener('mouseup', cancelLongPress);
  element.addEventListener('mouseleave', cancelLongPress);

  // Return cleanup function
  return () => {
    cancelLongPress();
    element.removeEventListener('touchstart', startLongPress);
    element.removeEventListener('touchend', cancelLongPress);
    element.removeEventListener('touchmove', cancelLongPress);
    element.removeEventListener('mousedown', startLongPress);
    element.removeEventListener('mouseup', cancelLongPress);
    element.removeEventListener('mouseleave', cancelLongPress);
  };
}

// ===============================================
// SEARCH INPUT HANDLER
// ===============================================

interface SearchInputOptions {
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Clear input when Escape is pressed (default: true) */
  clearOnEscape?: boolean;
  /** Minimum characters required before triggering search (default: 0) */
  minLength?: number;
}

/**
 * Setup debounced search input with optional Escape key to clear.
 * Handles common search input patterns including debouncing and clearing.
 *
 * @param input - Input element to attach handlers to
 * @param onSearch - Callback function with the search value
 * @param options - Configuration options
 * @returns Cleanup function to remove all event listeners
 *
 * @example
 * const cleanup = setupSearchInput(
 *   searchInput,
 *   (query) => filterResults(query),
 *   { debounceMs: 300, clearOnEscape: true, minLength: 2 }
 * );
 * // Later: cleanup();
 */
export function setupSearchInput(
  input: HTMLInputElement,
  onSearch: (value: string) => void,
  options: SearchInputOptions = {}
): () => void {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    clearOnEscape = true,
    minLength = DEFAULT_MIN_SEARCH_LENGTH
  } = options;

  // Create debounced search function
  const debouncedSearch = debounce((value: string) => {
    if (value.length >= minLength || value.length === 0) {
      onSearch(value);
    }
  }, debounceMs);

  // Input handler for typing
  const handleInput = () => {
    debouncedSearch(input.value.trim());
  };

  // Keydown handler for Escape key
  const handleKeydown = (e: KeyboardEvent) => {
    if (clearOnEscape && e.key === 'Escape') {
      input.value = '';
      onSearch('');
    }
  };

  // Attach event listeners
  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', handleKeydown);

  // Return cleanup function
  return () => {
    input.removeEventListener('input', handleInput);
    input.removeEventListener('keydown', handleKeydown);
  };
}

// ===============================================
// LIST KEYBOARD NAVIGATION
// ===============================================

interface ListKeyboardNavOptions {
  /** Class name for the active item (default: 'active') */
  activeClass?: string;
  /** Callback when an item is selected via Enter or Space */
  onSelect?: (item: HTMLElement) => void;
  /** Wrap navigation from last to first / first to last (default: true) */
  wrap?: boolean;
  /** Update aria-selected attribute (default: true) */
  updateAriaSelected?: boolean;
  /** Callback when focus changes */
  onFocusChange?: (item: HTMLElement, index: number) => void;
}

/**
 * Setup keyboard navigation for a list of items.
 * Supports arrow keys, Enter/Space for selection, and optional wrapping.
 *
 * @param container - Parent element containing the list items
 * @param itemSelector - CSS selector for navigable items
 * @param options - Configuration options
 * @returns Cleanup function to remove all event listeners
 *
 * @example
 * const cleanup = setupListKeyboardNav(threadList, '.thread-item', {
 *   activeClass: 'active',
 *   onSelect: (item) => selectThread(item.dataset.threadId),
 *   wrap: true
 * });
 * // Later: cleanup();
 */
export function setupListKeyboardNav(
  container: HTMLElement,
  itemSelector: string,
  options: ListKeyboardNavOptions = {}
): () => void {
  const {
    activeClass = 'active',
    onSelect,
    wrap = true,
    updateAriaSelected = true,
    onFocusChange
  } = options;

  const getItems = (): HTMLElement[] => {
    return Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
  };

  const getCurrentIndex = (): number => {
    const items = getItems();
    const focused = document.activeElement as HTMLElement;
    return items.indexOf(focused);
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

    const targetItem = items[index];
    targetItem.focus();
    onFocusChange?.(targetItem, index);
  };

  const selectItem = (item: HTMLElement) => {
    // Update visual state
    const items = getItems();
    items.forEach((el) => {
      el.classList.remove(activeClass);
      if (updateAriaSelected) {
        el.setAttribute('aria-selected', 'false');
      }
    });
    item.classList.add(activeClass);
    if (updateAriaSelected) {
      item.setAttribute('aria-selected', 'true');
    }

    // Trigger callback
    onSelect?.(item);
  };

  const handleKeydown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;

    // Only handle events on items within the container
    if (!container.contains(target) || !target.matches(itemSelector)) {
      return;
    }

    const currentIndex = getCurrentIndex();

    switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      focusItem(currentIndex + 1);
      break;

    case 'ArrowUp':
      e.preventDefault();
      focusItem(currentIndex - 1);
      break;

    case 'Enter':
    case ' ':
      e.preventDefault();
      selectItem(target);
      break;

    case 'Home':
      e.preventDefault();
      focusItem(0);
      break;

    case 'End':
      e.preventDefault();
      focusItem(getItems().length - 1);
      break;
    }
  };

  // Attach event listener to container for event delegation
  container.addEventListener('keydown', handleKeydown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeydown);
  };
}

// ===============================================
// TOOL/COLOR SELECTOR HANDLER
// ===============================================

interface SelectorHandlerOptions<T extends string> {
  /** Class name for the active item (default: 'active') */
  activeClass?: string;
  /** Callback when selection changes */
  onSelect?: (value: T, element: HTMLElement) => void;
  /** Data attribute name to read value from (default: 'data-value') */
  dataAttribute?: string;
}

/**
 * Setup click handlers for tool/color/option selector buttons.
 * Useful for annotation tools, color pickers, and option groups.
 *
 * @param container - Parent element or document to search within
 * @param buttonSelector - CSS selector for the buttons
 * @param options - Configuration options
 * @returns Cleanup function to remove all event listeners
 *
 * @example
 * const cleanup = setupSelectorHandler<AnnotationTool>(
 *   toolbar,
 *   '.tool-btn',
 *   {
 *     dataAttribute: 'data-tool',
 *     onSelect: (tool) => canvas.setTool(tool)
 *   }
 * );
 */
export function setupSelectorHandler<T extends string>(
  container: HTMLElement | Document,
  buttonSelector: string,
  options: SelectorHandlerOptions<T> = {}
): () => void {
  const {
    activeClass = 'active',
    onSelect,
    dataAttribute = 'data-value'
  } = options;

  // Extract the attribute name from data-* format
  const attrName = dataAttribute.startsWith('data-')
    ? dataAttribute.slice(5)
    : dataAttribute;

  const handlers: Array<{ element: HTMLElement; handler: (e: Event) => void }> = [];

  container.querySelectorAll(buttonSelector).forEach((btn) => {
    const handler = (e: Event) => {
      const target = e.currentTarget as HTMLElement;

      // Remove active class from all buttons
      container.querySelectorAll(buttonSelector).forEach((b) => {
        b.classList.remove(activeClass);
      });

      // Add active class to clicked button
      target.classList.add(activeClass);

      // Get the value and trigger callback
      const value = target.dataset[attrName] as T;
      if (value !== undefined) {
        onSelect?.(value, target);
      }
    };

    (btn as HTMLElement).addEventListener('click', handler);
    handlers.push({ element: btn as HTMLElement, handler });
  });

  // Return cleanup function
  return () => {
    handlers.forEach(({ element, handler }) => {
      element.removeEventListener('click', handler);
    });
  };
}
