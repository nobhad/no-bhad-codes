/**
 * ===============================================
 * ICON BUTTON (REUSABLE)
 * ===============================================
 * @file src/components/icon-button.ts
 *
 * Renders a button with an SVG icon only. Use in admin and client portal
 * for edit, invite, close, etc. so markup and a11y are consistent.
 */

export interface IconButtonConfig {
  /** SVG markup (e.g. from ICONS constant or inline) */
  iconSvg: string;
  /** Accessible label (required for icon-only buttons) */
  label: string;
  /** Optional tooltip (defaults to label) */
  title?: string;
  /** Click handler */
  onClick?: (e: MouseEvent) => void;
  /** Optional additional class names */
  className?: string;
  /** Button type (default "button") */
  type?: 'button' | 'submit';
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Create an icon-only button. Use shared class .icon-btn (see portal CSS).
 */
export function createIconButton(config: IconButtonConfig): HTMLButtonElement {
  const {
    iconSvg,
    label,
    title = label,
    onClick,
    className = '',
    type = 'button',
    disabled = false
  } = config;

  const btn = document.createElement('button');
  btn.type = type;
  btn.className = ['icon-btn', className].filter(Boolean).join(' ');
  btn.setAttribute('aria-label', label);
  btn.title = title;
  btn.disabled = disabled;

  const wrap = document.createElement('span');
  wrap.innerHTML = iconSvg;
  wrap.classList.add('icon-btn-svg');
  btn.appendChild(wrap);

  if (onClick) {
    btn.addEventListener('click', onClick);
  }

  return btn;
}
