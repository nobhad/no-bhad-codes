/**
 * ===============================================
 * BUTTON COMPONENT
 * ===============================================
 * @file src/components/button-component.ts
 *
 * Reusable button component with variants, states, and accessibility.
 */

import { BaseComponent, type ComponentProps, type ComponentState } from './base-component';
import { ComponentUtils } from './component-store';
import { getDebugMode } from '../core/env';

export interface ButtonProps extends ComponentProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onClick?: (event: MouseEvent) => void;
  children?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit' | 'reset';
}

export interface ButtonState extends ComponentState {
  pressed: boolean;
  focused: boolean;
}

export class ButtonComponent extends BaseComponent<ButtonProps, ButtonState> {
  constructor(props: ButtonProps) {
    const initialState: ButtonState = {
      pressed: false,
      focused: false
    };

    super('ButtonComponent', props, initialState, { debug: getDebugMode() });

    this.template = {
      render: () => this.renderTemplate(),
      css: () => this.getStyles()
    };
  }

  private renderTemplate(): string {
    const {
      variant = 'primary',
      size = 'medium',
      disabled = false,
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children = 'Button',
      ariaLabel,
      type = 'button'
    } = this.props;

    const classes = [
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      disabled && 'btn--disabled',
      loading && 'btn--loading',
      fullWidth && 'btn--full-width',
      this.state.pressed && 'btn--pressed',
      this.state.focused && 'btn--focused'
    ]
      .filter(Boolean)
      .join(' ');

    const iconHtml = icon
      ? `<span class="btn__icon btn__icon--${iconPosition}">${icon}</span>`
      : '';
    const loadingHtml = loading ? '<span class="btn__spinner"></span>' : '';

    return ComponentUtils.html`
      <button
        type="${type}"
        class="${classes}"
        ${disabled ? 'disabled' : ''}
        ${ariaLabel ? `aria-label="${ariaLabel}"` : ''}
        aria-pressed="${this.state.pressed}"
        data-ref="button"
      >
        ${loading ? loadingHtml : ''}
        ${iconPosition === 'left' ? iconHtml : ''}
        <span class="btn__text">${ComponentUtils.sanitizeHTML(children)}</span>
        ${iconPosition === 'right' ? iconHtml : ''}
      </button>
    `;
  }

  private getStyles(): string {
    return ComponentUtils.css`
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border: 1px solid transparent;
        border-radius: 6px;
        font-family: inherit;
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
        user-select: none;
      }

      .btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .btn--small {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        min-height: 2rem;
      }

      .btn--medium {
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        min-height: 2.5rem;
      }

      .btn--large {
        padding: 1rem 2rem;
        font-size: 1.125rem;
        min-height: 3rem;
      }

      .btn--primary {
        background: var(--color-primary, #ff6b6b);
        color: white;
        border-color: var(--color-primary, #ff6b6b);
      }

      .btn--primary:hover:not(:disabled) {
        background: var(--color-primary-dark, #e55a5a);
        border-color: var(--color-primary-dark, #e55a5a);
        transform: translateY(-1px);
      }

      .btn--secondary {
        background: var(--color-secondary, #6c757d);
        color: white;
        border-color: var(--color-secondary, #6c757d);
      }

      .btn--secondary:hover:not(:disabled) {
        background: var(--color-secondary-dark, #5a6268);
        transform: translateY(-1px);
      }

      .btn--ghost {
        background: transparent;
        color: var(--color-text, #333);
        border-color: var(--color-border, #ddd);
      }

      .btn--ghost:hover:not(:disabled) {
        background: var(--color-background-hover, #f8f9fa);
        border-color: var(--color-primary, #ff6b6b);
      }

      .btn--danger {
        background: var(--color-danger, #dc3545);
        color: white;
        border-color: var(--color-danger, #dc3545);
      }

      .btn--danger:hover:not(:disabled) {
        background: var(--color-danger-dark, #c82333);
        transform: translateY(-1px);
      }

      .btn--full-width {
        width: 100%;
      }

      .btn--disabled {
        opacity: 0.6;
        cursor: not-allowed;
        pointer-events: none;
      }

      .btn--loading {
        cursor: wait;
        pointer-events: none;
      }

      .btn--pressed {
        transform: translateY(1px);
      }

      .btn--focused {
        box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.2);
      }

      .btn__icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .btn__text {
        flex: 1;
      }

      .btn__spinner {
        display: inline-block;
        width: 1em;
        height: 1em;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: btn-spin 1s linear infinite;
        margin-right: 0.5rem;
      }

      @keyframes btn-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        .btn {
          transition: none;
        }
        .btn__spinner {
          animation: none;
        }
        .btn:hover:not(:disabled) {
          transform: none;
        }
      }
    `;
  }

  protected override cacheElements(): void {
    this.getElement('button', '[data-ref="button"]');
  }

  protected override bindEvents(): void {
    const button = this.getElement('button', '[data-ref="button"]');
    if (!button) return;

    this.addEventListener(button, 'click', this.handleClick.bind(this) as EventListener);
    this.addEventListener(button, 'mousedown', this.handleMouseDown.bind(this) as EventListener);
    this.addEventListener(button, 'mouseup', this.handleMouseUp.bind(this) as EventListener);
    this.addEventListener(button, 'focus', this.handleFocus.bind(this) as EventListener);
    this.addEventListener(button, 'blur', this.handleBlur.bind(this) as EventListener);
    this.addEventListener(button, 'keydown', this.handleKeyDown.bind(this) as EventListener);
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.props.disabled || this.props.loading) {
      event.preventDefault();
      return;
    }

    this.props.onClick?.(event);
    this.dispatchEvent('click', { originalEvent: event });
  };

  private handleMouseDown = (): void => {
    this.setState({ pressed: true });
  };

  private handleMouseUp = (): void => {
    this.setState({ pressed: false });
  };

  private handleFocus = (): void => {
    this.setState({ focused: true });
  };

  private handleBlur = (): void => {
    this.setState({ focused: false, pressed: false });
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.setState({ pressed: true });

      // Trigger click on key release
      const handleKeyUp = () => {
        this.setState({ pressed: false });
        this.handleClick(event as any);
        window.removeEventListener('keyup', handleKeyUp);
      };

      window.addEventListener('keyup', handleKeyUp);
    }
  };

  /**
   * Public methods for external control
   */
  setLoading(loading: boolean): void {
    this.updateProps({ loading });
  }

  setDisabled(disabled: boolean): void {
    this.updateProps({ disabled });
  }

  focus(): void {
    const button = this.getElement('button', '[data-ref="button"]') as HTMLButtonElement;
    button?.focus();
  }

  blur(): void {
    const button = this.getElement('button', '[data-ref="button"]') as HTMLButtonElement;
    button?.blur();
  }
}
