/**
 * ===============================================
 * BUTTON COMPONENT (REUSABLE)
 * ===============================================
 * @file src/components/button.ts
 *
 * Reusable button component with variants, sizes, states.
 * Use for all buttons in admin and client portals.
 */

import { cx } from '../utils/dom-utils';

// ===============================================
// TYPES
// ===============================================

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonConfig {
  /** Button text */
  text: string;
  /** Button variant (default: 'primary') */
  variant?: ButtonVariant;
  /** Button size (default: 'md') */
  size?: ButtonSize;
  /** Button type (default: 'button') */
  type?: 'button' | 'submit' | 'reset';
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Loading text (shown when loading) */
  loadingText?: string;
  /** Icon SVG to show on left */
  iconLeft?: string;
  /** Icon SVG to show on right */
  iconRight?: string;
  /** Additional class names */
  className?: string;
  /** Click handler */
  onClick?: (e: MouseEvent) => void;
  /** Full width button */
  fullWidth?: boolean;
  /** ID attribute */
  id?: string;
  /** Name attribute */
  name?: string;
  /** aria-label for accessibility */
  ariaLabel?: string;
  /** Data attributes */
  dataAttributes?: Record<string, string | number>;
}

export interface ButtonGroupConfig {
  /** Array of button configurations */
  buttons: ButtonConfig[];
  /** Group layout */
  layout?: 'horizontal' | 'vertical';
  /** Connected styling (buttons touch) */
  connected?: boolean;
  /** Show dividers between buttons */
  dividers?: boolean;
  /** Additional class names */
  className?: string;
}

export interface LinkButtonConfig {
  /** Link text */
  text: string;
  /** Href URL */
  href: string;
  /** Button variant (default: 'primary') */
  variant?: ButtonVariant;
  /** Button size (default: 'md') */
  size?: ButtonSize;
  /** Open in new tab */
  newTab?: boolean;
  /** Icon SVG to show on left */
  iconLeft?: string;
  /** Icon SVG to show on right */
  iconRight?: string;
  /** Additional class names */
  className?: string;
  /** Download attribute */
  download?: string | boolean;
}

export interface ToggleButtonConfig {
  /** Initial state */
  isActive: boolean;
  /** Active state config */
  activeState: {
    text: string;
    iconSvg?: string;
    className?: string;
  };
  /** Inactive state config */
  inactiveState: {
    text: string;
    iconSvg?: string;
    className?: string;
  };
  /** Toggle handler */
  onToggle: (isActive: boolean) => void;
  /** Button size (default: 'md') */
  size?: ButtonSize;
  /** Additional class names */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export interface ButtonWithBadgeConfig extends ButtonConfig {
  /** Badge count */
  badgeCount: number;
  /** Badge variant */
  badgeVariant?: 'default' | 'danger' | 'warning' | 'success';
  /** Hide badge when count is 0 */
  hideBadgeWhenZero?: boolean;
}

// ===============================================
// BUTTON COMPONENT
// ===============================================

/**
 * Create a button element with variants, sizes, and states.
 */
export function createButton(config: ButtonConfig): HTMLButtonElement {
  const {
    text,
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    loading = false,
    loadingText = 'Loading...',
    iconLeft,
    iconRight,
    className = '',
    onClick,
    fullWidth = false,
    id,
    name,
    ariaLabel,
    dataAttributes = {}
  } = config;

  const btn = document.createElement('button');
  btn.type = type;
  btn.disabled = disabled || loading;

  // Build class list
  const classes = cx(
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && 'btn-full-width',
    loading && 'btn-loading',
    className
  );

  btn.className = classes;

  if (id) btn.id = id;
  if (name) btn.name = name;
  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  if (loading) btn.setAttribute('aria-busy', 'true');

  // Add data attributes
  Object.entries(dataAttributes).forEach(([key, value]) => {
    btn.setAttribute(`data-${key}`, String(value));
  });

  // Build content
  if (loading) {
    btn.innerHTML = `
      <span class="btn-spinner" aria-hidden="true"></span>
      <span class="btn-text">${loadingText}</span>
    `;
  } else {
    const leftIcon = iconLeft ? `<span class="btn-icon btn-icon-left" aria-hidden="true">${iconLeft}</span>` : '';
    const rightIcon = iconRight ? `<span class="btn-icon btn-icon-right" aria-hidden="true">${iconRight}</span>` : '';
    btn.innerHTML = `${leftIcon}<span class="btn-text">${text}</span>${rightIcon}`;
  }

  if (onClick) {
    btn.addEventListener('click', onClick);
  }

  return btn;
}

/**
 * Get HTML string for a button (for use in innerHTML templates).
 */
export function getButtonHTML(config: ButtonConfig): string {
  const {
    text,
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    loading = false,
    loadingText = 'Loading...',
    iconLeft,
    iconRight,
    className = '',
    fullWidth = false,
    id,
    name,
    ariaLabel,
    dataAttributes = {}
  } = config;

  const classes = cx(
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && 'btn-full-width',
    loading && 'btn-loading',
    className
  );

  const attrs = [
    `type="${type}"`,
    `class="${classes}"`,
    id ? `id="${id}"` : '',
    name ? `name="${name}"` : '',
    ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : '',
    disabled || loading ? 'disabled' : '',
    loading ? 'aria-busy="true"' : '',
    ...Object.entries(dataAttributes).map(([k, v]) => `data-${k}="${escapeHtml(String(v))}"`)
  ].filter(Boolean).join(' ');

  let content: string;
  if (loading) {
    content = `<span class="btn-spinner" aria-hidden="true"></span><span class="btn-text">${escapeHtml(loadingText)}</span>`;
  } else {
    const leftIcon = iconLeft ? `<span class="btn-icon btn-icon-left" aria-hidden="true">${iconLeft}</span>` : '';
    const rightIcon = iconRight ? `<span class="btn-icon btn-icon-right" aria-hidden="true">${iconRight}</span>` : '';
    content = `${leftIcon}<span class="btn-text">${escapeHtml(text)}</span>${rightIcon}`;
  }

  return `<button ${attrs}>${content}</button>`;
}

// ===============================================
// BUTTON GROUP
// ===============================================

/**
 * Create a button group container.
 */
export function createButtonGroup(config: ButtonGroupConfig): HTMLElement {
  const {
    buttons,
    layout = 'horizontal',
    connected = false,
    dividers = false,
    className = ''
  } = config;

  const group = document.createElement('div');
  group.className = cx(
    'btn-group',
    `btn-group-${layout}`,
    connected && 'btn-group-connected',
    dividers && 'btn-group-dividers',
    className
  );

  group.setAttribute('role', 'group');

  buttons.forEach((btnConfig, index) => {
    const btn = createButton(btnConfig);
    group.appendChild(btn);

    if (dividers && index < buttons.length - 1) {
      const divider = document.createElement('span');
      divider.className = 'btn-group-divider';
      divider.setAttribute('aria-hidden', 'true');
      group.appendChild(divider);
    }
  });

  return group;
}

// ===============================================
// LINK BUTTON
// ===============================================

/**
 * Create an anchor element styled as a button.
 */
export function createLinkButton(config: LinkButtonConfig): HTMLAnchorElement {
  const {
    text,
    href,
    variant = 'primary',
    size = 'md',
    newTab = false,
    iconLeft,
    iconRight,
    className = '',
    download
  } = config;

  const link = document.createElement('a');
  link.href = href;
  link.className = cx(
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    className
  );

  if (newTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  if (download !== undefined) {
    link.download = typeof download === 'string' ? download : '';
  }

  const leftIcon = iconLeft ? `<span class="btn-icon btn-icon-left" aria-hidden="true">${iconLeft}</span>` : '';
  const rightIcon = iconRight ? `<span class="btn-icon btn-icon-right" aria-hidden="true">${iconRight}</span>` : '';
  link.innerHTML = `${leftIcon}<span class="btn-text">${text}</span>${rightIcon}`;

  return link;
}

// ===============================================
// TOGGLE BUTTON
// ===============================================

/**
 * Create a two-state toggle button.
 */
export function createToggleButton(config: ToggleButtonConfig): HTMLButtonElement {
  const {
    isActive,
    activeState,
    inactiveState,
    onToggle,
    size = 'md',
    className = '',
    disabled = false
  } = config;

  let currentState = isActive;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.disabled = disabled;
  btn.setAttribute('aria-pressed', String(currentState));

  const updateButton = () => {
    const state = currentState ? activeState : inactiveState;
    btn.className = cx(
      'btn',
      'btn-toggle',
      `btn-${size}`,
      currentState && 'btn-toggle-active',
      state.className,
      className
    );

    const icon = state.iconSvg ? `<span class="btn-icon" aria-hidden="true">${state.iconSvg}</span>` : '';
    btn.innerHTML = `${icon}<span class="btn-text">${state.text}</span>`;
    btn.setAttribute('aria-pressed', String(currentState));
  };

  updateButton();

  btn.addEventListener('click', () => {
    if (disabled) return;
    currentState = !currentState;
    updateButton();
    onToggle(currentState);
  });

  return btn;
}

// ===============================================
// BUTTON WITH BADGE
// ===============================================

/**
 * Create a button with a notification badge.
 */
export function createButtonWithBadge(config: ButtonWithBadgeConfig): HTMLButtonElement {
  const {
    badgeCount,
    badgeVariant = 'default',
    hideBadgeWhenZero = true,
    ...buttonConfig
  } = config;

  const btn = createButton(buttonConfig);
  btn.classList.add('btn-with-badge');
  btn.style.position = 'relative';

  const badge = document.createElement('span');
  badge.className = `btn-badge btn-badge-${badgeVariant}`;
  badge.textContent = badgeCount > 99 ? '99+' : String(badgeCount);
  badge.setAttribute('aria-label', `${badgeCount} notifications`);

  if (hideBadgeWhenZero && badgeCount === 0) {
    badge.style.display = 'none';
  }

  btn.appendChild(badge);

  return btn;
}

/**
 * Update the badge count on a button with badge.
 */
export function updateButtonBadge(
  button: HTMLButtonElement,
  count: number,
  hideBadgeWhenZero = true
): void {
  const badge = button.querySelector('.btn-badge');
  if (!badge) return;

  badge.textContent = count > 99 ? '99+' : String(count);
  badge.setAttribute('aria-label', `${count} notifications`);

  if (hideBadgeWhenZero) {
    (badge as HTMLElement).style.display = count === 0 ? 'none' : '';
  }
}

// ===============================================
// HELPER FUNCTIONS
// ===============================================

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Set button to loading state.
 */
export function setButtonLoadingState(
  button: HTMLButtonElement,
  loading: boolean,
  loadingText = 'Loading...'
): void {
  const originalText = button.querySelector('.btn-text')?.textContent || '';

  if (loading) {
    button.disabled = true;
    button.classList.add('btn-loading');
    button.setAttribute('aria-busy', 'true');
    button.dataset.originalText = originalText;
    const textSpan = button.querySelector('.btn-text');
    if (textSpan) textSpan.textContent = loadingText;

    // Add spinner if not present
    if (!button.querySelector('.btn-spinner')) {
      const spinner = document.createElement('span');
      spinner.className = 'btn-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      button.insertBefore(spinner, button.firstChild);
    }
  } else {
    button.disabled = false;
    button.classList.remove('btn-loading');
    button.removeAttribute('aria-busy');

    // Remove spinner
    const spinner = button.querySelector('.btn-spinner');
    if (spinner) spinner.remove();

    // Restore original text
    const textSpan = button.querySelector('.btn-text');
    if (textSpan && button.dataset.originalText) {
      textSpan.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}
