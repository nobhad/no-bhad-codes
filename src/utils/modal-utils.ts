/**
 * ===============================================
 * MODAL UTILITIES
 * ===============================================
 * @file src/utils/modal-utils.ts
 *
 * Shared helpers to open/close modal overlays consistently.
 */

const openOverlays = new Set<HTMLElement>();

export interface ModalOverlayOptions {
  /** Allow multiple overlays to remain open (stacked) */
  allowStack?: boolean;
  /** Toggle body scroll lock (default: true) */
  lockBody?: boolean;
}

export interface ModalCloseOptions {
  /** Animation delay before hiding (ms) */
  delayMs?: number;
  /** Toggle body scroll unlock when no modals remain (default: true) */
  unlockBody?: boolean;
}

export function openModalOverlay(overlay: HTMLElement, options: ModalOverlayOptions = {}): void {
  const { allowStack = false, lockBody = true } = options;

  if (!allowStack) {
    closeAllModalOverlays({ unlockBody: false });
  }

  overlay.classList.remove('hidden');
  overlay.classList.remove('closing');
  openOverlays.add(overlay);

  if (lockBody) {
    document.body.classList.add('modal-open');
  }
}

export function closeModalOverlay(overlay: HTMLElement, options: ModalCloseOptions = {}): void {
  const { delayMs = 150, unlockBody = true } = options;

  if (!openOverlays.has(overlay)) {
    overlay.classList.add('hidden');
    return;
  }

  overlay.classList.add('closing');

  window.setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('closing');
    openOverlays.delete(overlay);

    if (unlockBody && openOverlays.size === 0) {
      document.body.classList.remove('modal-open');
    }
  }, delayMs);
}

export function closeAllModalOverlays(options: ModalCloseOptions = {}): void {
  const { unlockBody = true } = options;

  openOverlays.forEach((overlay) => {
    overlay.classList.add('hidden');
    overlay.classList.remove('closing');
  });
  openOverlays.clear();

  if (unlockBody) {
    document.body.classList.remove('modal-open');
  }
}
