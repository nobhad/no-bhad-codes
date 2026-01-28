/**
 * ===============================================
 * FOCUS TRAP UTILITIES
 * ===============================================
 * @file src/utils/focus-trap.ts
 *
 * Utilities for managing focus within modals and dialogs.
 * Provides focus trapping, focus restoration, and keyboard navigation.
 */

/** Selector for all focusable elements */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/** Store for focus restoration */
interface FocusTrapState {
  previouslyFocused: HTMLElement | null;
  trapElement: HTMLElement;
  keydownHandler: (e: KeyboardEvent) => void;
}

const activeTrap = new WeakMap<HTMLElement, FocusTrapState>();

/**
 * Get all focusable elements within a container
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(elements).filter(
    (el) => el.offsetParent !== null // Filter out hidden elements
  );
}

/**
 * Create a focus trap within a modal/dialog
 * - Traps Tab/Shift+Tab within the container
 * - Stores the previously focused element for restoration
 * - Moves focus to the first focusable element
 *
 * @param container - The modal/dialog element
 * @param options - Configuration options
 */
export function createFocusTrap(
  container: HTMLElement,
  options: {
    initialFocus?: HTMLElement | string | null;
    returnFocus?: boolean;
    onEscape?: () => void;
  } = {}
): void {
  const { initialFocus, returnFocus = true, onEscape } = options;

  // Store previously focused element
  const previouslyFocused = document.activeElement as HTMLElement | null;

  // Handler for keyboard navigation
  const keydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }

    if (e.key !== 'Tab') return;

    const focusableElements = getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Shift+Tab on first element -> move to last
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      // Tab on last element -> move to first
      e.preventDefault();
      firstElement.focus();
    }
  };

  // Store state
  activeTrap.set(container, {
    previouslyFocused: returnFocus ? previouslyFocused : null,
    trapElement: container,
    keydownHandler
  });

  // Add keyboard handler
  container.addEventListener('keydown', keydownHandler);

  // Set initial focus
  requestAnimationFrame(() => {
    let focusTarget: HTMLElement | null = null;

    if (initialFocus) {
      if (typeof initialFocus === 'string') {
        focusTarget = container.querySelector<HTMLElement>(initialFocus);
      } else {
        focusTarget = initialFocus;
      }
    }

    if (!focusTarget) {
      // Focus first focusable element, or the container itself
      const focusableElements = getFocusableElements(container);
      focusTarget = focusableElements[0] || container;
    }

    // Ensure container is focusable if needed
    if (focusTarget === container && !container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1');
    }

    focusTarget.focus();
  });
}

/**
 * Remove the focus trap and restore previous focus
 *
 * @param container - The modal/dialog element
 */
export function removeFocusTrap(container: HTMLElement): void {
  const state = activeTrap.get(container);
  if (!state) return;

  // Remove keyboard handler
  container.removeEventListener('keydown', state.keydownHandler);

  // Restore previous focus
  if (state.previouslyFocused && state.previouslyFocused.focus) {
    requestAnimationFrame(() => {
      state.previouslyFocused?.focus();
    });
  }

  // Clean up
  activeTrap.delete(container);
}

/**
 * Check if a focus trap is active on an element
 */
export function hasFocusTrap(container: HTMLElement): boolean {
  return activeTrap.has(container);
}

/**
 * Higher-level helper: manage focus trap lifecycle with a modal
 * Returns cleanup function
 *
 * @param modal - The modal element
 * @param options - Configuration options
 */
export function manageFocusTrap(
  modal: HTMLElement,
  options: {
    initialFocus?: HTMLElement | string | null;
    onClose?: () => void;
  } = {}
): () => void {
  const { initialFocus, onClose } = options;

  // Set ARIA attributes
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  // Create focus trap with escape handler
  createFocusTrap(modal, {
    initialFocus,
    returnFocus: true,
    onEscape: onClose
  });

  // Return cleanup function
  return () => {
    removeFocusTrap(modal);
    modal.removeAttribute('aria-modal');
  };
}
