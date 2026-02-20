/**
 * ===============================================
 * DETAIL VIEW KEYBOARD NAVIGATION
 * ===============================================
 * @file src/components/detail-keyboard-nav.ts
 *
 * Provides keyboard shortcuts for detail view pages:
 * - E: Edit (triggers edit button)
 * - Escape: Go back to list view
 * - 1-9: Switch tabs (if tabbed view)
 */

export interface DetailKeyboardNavConfig {
  /** Selector for the edit button */
  editButtonSelector?: string;
  /** Callback to go back to list view */
  onBack: () => void;
  /** Selectors for tab buttons (optional, for tabbed views) */
  tabSelectors?: string[];
  /** Tab container selector for numbered tab switching */
  tabContainerSelector?: string;
  /** Whether shortcuts are currently active */
  enabled?: boolean;
  /** Selector for the detail view container (must be visible for shortcuts to work) */
  containerSelector?: string;
}

let currentConfig: DetailKeyboardNavConfig | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

/**
 * Initialize keyboard navigation for a detail view
 */
export function initDetailKeyboardNav(config: DetailKeyboardNavConfig): () => void {
  // Clean up any existing handler
  cleanupDetailKeyboardNav();

  currentConfig = { enabled: true, ...config };

  keydownHandler = (e: KeyboardEvent) => {
    if (!currentConfig?.enabled) return;

    // Check if detail view container is visible (if specified)
    if (currentConfig.containerSelector) {
      const container = document.querySelector(currentConfig.containerSelector);
      if (!container || !container.classList.contains('active')) return;
    }

    // Ignore if typing in an input, textarea, or contenteditable
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // Still allow Escape to close/go back
      if (e.key !== 'Escape') return;
    }

    // Ignore if modal is open
    const modalOpen = document.querySelector('.modal-overlay.open, .admin-modal-overlay.open');
    if (modalOpen && e.key !== 'Escape') return;

    switch (e.key) {
    case 'Escape':
      e.preventDefault();
      // If a modal is open, let the modal handle it
      if (modalOpen) return;
      currentConfig.onBack();
      break;

    case 'e':
    case 'E':
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      triggerEdit();
      break;

    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9': {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tabIndex = parseInt(e.key, 10) - 1;
      switchToTab(tabIndex);
      break;
    }
    }
  };

  document.addEventListener('keydown', keydownHandler);

  // Return cleanup function
  return cleanupDetailKeyboardNav;
}

/**
 * Clean up keyboard navigation
 */
export function cleanupDetailKeyboardNav(): void {
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  currentConfig = null;
}

/**
 * Temporarily disable/enable keyboard shortcuts
 */
export function setDetailKeyboardNavEnabled(enabled: boolean): void {
  if (currentConfig) {
    currentConfig.enabled = enabled;
  }
}

/**
 * Trigger the edit button
 */
function triggerEdit(): void {
  if (!currentConfig?.editButtonSelector) return;

  const editBtn = document.querySelector(currentConfig.editButtonSelector) as HTMLButtonElement;
  if (editBtn && !editBtn.disabled) {
    editBtn.click();
  }
}

/**
 * Switch to a tab by index
 */
function switchToTab(index: number): void {
  if (!currentConfig) return;

  // If specific tab selectors provided, use those
  if (currentConfig.tabSelectors && currentConfig.tabSelectors[index]) {
    const tabBtn = document.querySelector(currentConfig.tabSelectors[index]) as HTMLButtonElement;
    if (tabBtn && !tabBtn.disabled) {
      tabBtn.click();
      return;
    }
  }

  // Otherwise, use tab container selector to find tabs
  if (currentConfig.tabContainerSelector) {
    const container = document.querySelector(currentConfig.tabContainerSelector);
    if (container) {
      const tabs = container.querySelectorAll('button:not([disabled])');
      if (tabs[index]) {
        (tabs[index] as HTMLButtonElement).click();
      }
    }
  }
}
