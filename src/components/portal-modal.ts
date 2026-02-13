/**
 * ===============================================
 * PORTAL MODAL SHELL (REUSABLE)
 * ===============================================
 * @file src/components/portal-modal.ts
 *
 * Creates admin/client portal modal structure: overlay, header (title + close),
 * body slot, footer slot. Use for KB, DR, and other form modals.
 *
 * Accessibility features:
 * - Focus trapping: Tab cycles within modal (WCAG 2.4.3)
 * - First focusable element receives focus on open
 * - Escape key closes modal
 * - aria-labelledby points to title
 * - aria-describedby points to body content
 */

import { ICONS } from '../constants/icons';
import { createIconButton } from './icon-button';
import { closeModalOverlay, openModalOverlay } from '../utils/modal-utils';

/** Selector for focusable elements within modal */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export interface PortalModalConfig {
  /** Overlay id (e.g. for getElementById) */
  id: string;
  /** Title element id (for aria-labelledby) */
  titleId: string;
  /** Initial title text */
  title: string;
  /** Extra class on .modal-content (e.g. kb-article-modal-content) */
  contentClassName?: string;
  /** Called when close button clicked or overlay backdrop */
  onClose: () => void;
}

export interface PortalModalInstance {
  overlay: HTMLElement;
  body: HTMLElement;
  footer: HTMLElement;
  titleEl: HTMLElement;
  setTitle: (title: string) => void;
  show: () => void;
  hide: () => void;
  /** Cleanup event listeners when modal is destroyed */
  destroy: () => void;
}

/**
 * Create a portal modal shell. Caller appends form/content to body and buttons to footer.
 * Uses modal-overlay, modal-content portal-shadow, modal-header, modal-body, modal-footer.
 *
 * Accessibility:
 * - Focus trapping via Tab key
 * - Escape key closes modal
 * - aria-describedby points to modal body
 */
export function createPortalModal(config: PortalModalConfig): PortalModalInstance {
  const { id, titleId, title, contentClassName = '', onClose } = config;

  // Generate unique ID for body (aria-describedby)
  const bodyId = `${id}-body`;

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'modal-overlay hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', titleId);
  overlay.setAttribute('aria-describedby', bodyId);

  const content = document.createElement('div');
  content.className = ['modal-content', 'portal-shadow', contentClassName].filter(Boolean).join(' ');

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('h2');
  titleEl.id = titleId;
  titleEl.textContent = title;

  const closeBtn = createIconButton({
    iconSvg: ICONS.CLOSE.replace('width="24"', 'width="20"').replace('height="24"', 'height="20"'),
    label: 'Close',
    onClick: () => onClose()
  });
  closeBtn.className = 'modal-close icon-btn';
  closeBtn.id = `${id}-close`;

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.id = bodyId;

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  overlay.appendChild(content);

  // Store previous active element to restore focus on close
  let previousActiveElement: HTMLElement | null = null;

  /**
   * Get all focusable elements within the modal content
   */
  function getFocusableElements(): HTMLElement[] {
    return Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  /**
   * Handle keyboard events for focus trapping and Escape key
   */
  function handleKeyDown(e: KeyboardEvent): void {
    // Escape key closes modal
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    // Tab key focus trapping
    if (e.key === 'Tab') {
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  // Backdrop click closes modal
  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === overlay) onClose();
  }

  overlay.addEventListener('click', handleBackdropClick);
  overlay.addEventListener('keydown', handleKeyDown);

  return {
    overlay,
    body,
    footer,
    titleEl,
    setTitle: (t: string) => {
      titleEl.textContent = t;
    },
    show: () => {
      // Store current focus to restore later
      previousActiveElement = document.activeElement as HTMLElement;

      openModalOverlay(overlay, { allowStack: true });

      // Focus first focusable element after modal is shown
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          // Fallback: focus the close button
          closeBtn.focus();
        }
      });
    },
    hide: () => {
      closeModalOverlay(overlay, { unlockBody: true });

      // Restore focus to previously focused element
      if (previousActiveElement && previousActiveElement.focus) {
        previousActiveElement.focus();
      }
    },
    destroy: () => {
      overlay.removeEventListener('click', handleBackdropClick);
      overlay.removeEventListener('keydown', handleKeyDown);
    }
  };
}
