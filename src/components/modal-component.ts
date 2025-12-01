/**
 * ===============================================
 * MODAL COMPONENT
 * ===============================================
 * @file src/components/modal-component.ts
 *
 * Accessible modal dialog component with focus management.
 */

import { BaseComponent, type ComponentProps, type ComponentState } from './base-component';
import { ComponentUtils } from './component-store';

export interface ModalProps extends ComponentProps {
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  closable?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  headerContent?: string;
  footerContent?: string;
  children?: string;
  onClose?: () => void;
  onOpen?: () => void;
  zIndex?: number;
}

export interface ModalState extends ComponentState {
  isOpen: boolean;
  isAnimating: boolean;
}

export class ModalComponent extends BaseComponent<ModalProps, ModalState> {
  private previousFocusedElement: HTMLElement | null = null;
  private focusableElements: HTMLElement[] = [];

  constructor(props: ModalProps) {
    const initialState: ModalState = {
      isOpen: false,
      isAnimating: false
    };

    super('ModalComponent', props, initialState, { debug: true });

    this.template = {
      render: () => this.renderTemplate(),
      css: () => this.getStyles()
    };
  }

  private renderTemplate(): string {
    const {
      title = 'Modal',
      size = 'medium',
      closable = true,
      showHeader = true,
      showFooter = false,
      headerContent = '',
      footerContent = '',
      children = '',
      zIndex = 1000
    } = this.props;

    const { isOpen, isAnimating } = this.state;

    if (!isOpen && !isAnimating) {
      return '';
    }

    const modalClasses = [
      'modal',
      `modal--${size}`,
      isOpen && 'modal--open',
      isAnimating && 'modal--animating'
    ]
      .filter(Boolean)
      .join(' ');

    return ComponentUtils.html`
      <div class="modal-backdrop" style="z-index: ${zIndex}" data-ref="backdrop">
        <div 
          class="${modalClasses}"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          data-ref="modal"
        >
          ${
  showHeader
    ? `
            <div class="modal__header" data-ref="header">
              <h2 id="modal-title" class="modal__title">${ComponentUtils.sanitizeHTML(title)}</h2>
              ${
  closable
    ? `
                <button 
                  class="modal__close" 
                  aria-label="Close modal"
                  data-ref="closeButton"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              `
    : ''
}
              ${headerContent ? `<div class="modal__header-content">${headerContent}</div>` : ''}
            </div>
          `
    : ''
}
          
          <div class="modal__body" data-ref="body">
            ${children}
          </div>
          
          ${
  showFooter
    ? `
            <div class="modal__footer" data-ref="footer">
              ${footerContent}
            </div>
          `
    : ''
}
        </div>
      </div>
    `;
  }

  private getStyles(): string {
    return ComponentUtils.css`
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        padding: 1rem;
        box-sizing: border-box;
      }

      .modal-backdrop--open {
        opacity: 1;
        visibility: visible;
      }

      .modal {
        background: var(--color-background, white);
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        max-width: 100%;
        max-height: 100%;
        display: flex;
        flex-direction: column;
        transform: scale(0.9) translateY(-20px);
        transition: transform 0.3s ease;
        position: relative;
      }

      .modal--open {
        transform: scale(1) translateY(0);
      }

      .modal--small {
        width: 400px;
      }

      .modal--medium {
        width: 600px;
      }

      .modal--large {
        width: 800px;
      }

      .modal--fullscreen {
        width: 100%;
        height: 100%;
        border-radius: 0;
      }

      .modal__header {
        padding: 1.5rem;
        border-bottom: 1px solid var(--color-border, #e5e5e5);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }

      .modal__title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text, #333);
      }

      .modal__close {
        background: none;
        border: none;
        padding: 0.5rem;
        cursor: pointer;
        color: var(--color-text-secondary, #666);
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }

      .modal__close:hover {
        background: var(--color-background-hover, #f5f5f5);
      }

      .modal__close:focus {
        outline: 2px solid var(--color-primary, #ff6b6b);
        outline-offset: 2px;
      }

      .modal__header-content {
        margin-left: auto;
        margin-right: 0.5rem;
      }

      .modal__body {
        padding: 1.5rem;
        flex: 1;
        overflow-y: auto;
        color: var(--color-text, #333);
      }

      .modal__footer {
        padding: 1.5rem;
        border-top: 1px solid var(--color-border, #e5e5e5);
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        flex-shrink: 0;
      }

      @media (max-width: 768px) {
        .modal--small,
        .modal--medium,
        .modal--large {
          width: 100%;
          height: 100%;
          border-radius: 0;
        }
        
        .modal-backdrop {
          padding: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .modal-backdrop,
        .modal {
          transition: none;
        }
      }
    `;
  }

  protected override cacheElements(): void {
    this.getElement('backdrop', '[data-ref="backdrop"]');
    this.getElement('modal', '[data-ref="modal"]');
    this.getElement('closeButton', '[data-ref="closeButton"]', false);
    this.getElement('body', '[data-ref="body"]');
  }

  protected override bindEvents(): void {
    const backdrop = this.getElement('backdrop', '[data-ref="backdrop"]');
    const closeButton = this.getElement('closeButton', '[data-ref="closeButton"]', false);

    if (backdrop && this.props.closeOnBackdrop) {
      this.addEventListener(backdrop, 'click', (event: Event) =>
        this.handleBackdropClick(event as MouseEvent)
      );
    }

    if (closeButton) {
      this.addEventListener(closeButton, 'click', this.handleClose.bind(this));
    }

    if (this.props.closeOnEscape) {
      this.addEventListener(document as unknown as Element, 'keydown', (event: Event) =>
        this.handleKeydown(event as KeyboardEvent)
      );
    }
  }

  private handleBackdropClick = (event: MouseEvent): void => {
    if (event.target === event.currentTarget) {
      this.close();
    }
  };

  private handleClose = (): void => {
    this.close();
  };

  private handleKeydown = (event: KeyboardEvent): void => {
    if (!this.state.isOpen) return;

    switch (event.key) {
    case 'Escape':
      if (this.props.closeOnEscape) {
        event.preventDefault();
        this.close();
      }
      break;
    case 'Tab':
      this.handleTabKey(event);
      break;
    }
  };

  private handleTabKey(event: KeyboardEvent): void {
    if (this.focusableElements.length === 0) return;

    const firstFocusable = this.focusableElements[0];
    const lastFocusable = this.focusableElements[this.focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable?.focus();
      }
    } else if (document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable?.focus();
    }
  }

  private updateFocusableElements(): void {
    const modal = this.getElement('modal', '[data-ref="modal"]') as HTMLElement;
    if (!modal) return;

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    this.focusableElements = Array.from(
      modal.querySelectorAll(focusableSelectors.join(','))
    ) as HTMLElement[];
  }

  /**
   * Public API
   */
  async open(): Promise<void> {
    if (this.state.isOpen || this.state.isAnimating) return;

    // Store currently focused element
    this.previousFocusedElement = document.activeElement as HTMLElement;

    await this.setState({ isOpen: true, isAnimating: true });

    // Add backdrop class for animation
    const backdrop = this.getElement('backdrop', '[data-ref="backdrop"]') as HTMLElement;
    if (backdrop) {
      backdrop.classList.add('modal-backdrop--open');
    }

    // Focus management
    setTimeout(() => {
      this.updateFocusableElements();
      if (this.focusableElements.length > 0) {
        this.focusableElements[0]?.focus();
      }

      this.setState({ isAnimating: false });
      this.props.onOpen?.();
    }, 100);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    this.dispatchEvent('open');
  }

  async close(): Promise<void> {
    if (!this.state.isOpen || this.state.isAnimating) return;

    await this.setState({ isAnimating: true });

    // Remove backdrop class for animation
    const backdrop = this.getElement('backdrop', '[data-ref="backdrop"]') as HTMLElement;
    if (backdrop) {
      backdrop.classList.remove('modal-backdrop--open');
    }

    setTimeout(async () => {
      await this.setState({ isOpen: false, isAnimating: false });

      // Restore focus
      if (this.previousFocusedElement) {
        this.previousFocusedElement.focus();
        this.previousFocusedElement = null;
      }

      // Restore body scroll
      document.body.style.overflow = '';

      this.props.onClose?.();
      this.dispatchEvent('close');
    }, 300);
  }

  toggle(): void {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setContent(content: string): void {
    this.updateProps({ children: content });
  }

  isOpen(): boolean {
    return this.state.isOpen;
  }
}
