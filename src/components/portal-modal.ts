/**
 * ===============================================
 * PORTAL MODAL SHELL (REUSABLE)
 * ===============================================
 * @file src/components/portal-modal.ts
 *
 * Creates admin/client portal modal structure: overlay, header (title + close),
 * body slot, footer slot. Use for KB, DR, and other form modals.
 */

import { ICONS } from '../constants/icons';
import { createIconButton } from './icon-button';
import { closeModalOverlay, openModalOverlay } from '../utils/modal-utils';

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
}

/**
 * Create a portal modal shell. Caller appends form/content to body and buttons to footer.
 * Uses modal-overlay, modal-content portal-shadow, modal-header, modal-body, modal-footer.
 */
export function createPortalModal(config: PortalModalConfig): PortalModalInstance {
  const { id, titleId, title, contentClassName = '', onClose } = config;

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'modal-overlay hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', titleId);

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

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  overlay.appendChild(content);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) onClose();
  });

  return {
    overlay,
    body,
    footer,
    titleEl,
    setTitle: (t: string) => {
      titleEl.textContent = t;
    },
    show: () => {
      openModalOverlay(overlay, { allowStack: true });
    },
    hide: () => {
      closeModalOverlay(overlay, { unlockBody: true });
    }
  };
}
