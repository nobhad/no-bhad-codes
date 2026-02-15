/**
 * ===============================================
 * DROPDOWN COMPONENT (REUSABLE)
 * ===============================================
 * @file src/components/dropdown.ts
 *
 * Reusable dropdown menu, dropdown button, and split button.
 */

import { ICONS } from '../constants/icons';
import { cx } from '../utils/dom-utils';

// ===============================================
// TYPES
// ===============================================

export interface DropdownItem {
  /** Item label */
  label: string;
  /** Item value (used in callback) */
  value?: string;
  /** Icon SVG */
  icon?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Danger variant (destructive action) */
  danger?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Divider after this item */
  dividerAfter?: boolean;
}

export interface DropdownConfig {
  /** Menu items */
  items: DropdownItem[];
  /** Trigger element or text */
  trigger: string | HTMLElement;
  /** Trigger icon (default: chevron down) */
  triggerIcon?: string;
  /** Position relative to trigger */
  position?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  /** Additional class names */
  className?: string;
  /** ID attribute */
  id?: string;
  /** Close on item click (default: true) */
  closeOnClick?: boolean;
  /** Close on outside click (default: true) */
  closeOnOutsideClick?: boolean;
  /** Width of menu ('auto', 'trigger', or CSS value) */
  width?: 'auto' | 'trigger' | string;
}

export interface DropdownButtonConfig {
  /** Button text */
  text: string;
  /** Menu items */
  items: DropdownItem[];
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Button icon (left) */
  icon?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

export interface SplitButtonConfig {
  /** Primary action label */
  primaryLabel: string;
  /** Primary action handler */
  onPrimaryClick: () => void;
  /** Dropdown items for secondary actions */
  items: DropdownItem[];
  /** Button variant */
  variant?: 'primary' | 'secondary';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Primary button icon */
  icon?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

export interface TooltipConfig {
  /** Tooltip content */
  content: string;
  /** Target element */
  target: HTMLElement;
  /** Position */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Show delay (ms) */
  delay?: number;
  /** Additional class names */
  className?: string;
}

export interface PopoverConfig {
  /** Popover content (string or element) */
  content: string | HTMLElement;
  /** Target element */
  target: HTMLElement;
  /** Popover title (optional) */
  title?: string;
  /** Position */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Show close button */
  showClose?: boolean;
  /** Close handler */
  onClose?: () => void;
  /** Additional class names */
  className?: string;
}

// ===============================================
// DROPDOWN MENU
// ===============================================

/**
 * Create a dropdown menu.
 */
export function createDropdown(config: DropdownConfig): HTMLElement {
  const {
    items,
    trigger,
    triggerIcon = ICONS.CHEVRON_DOWN,
    position = 'bottom-start',
    className = '',
    id,
    closeOnClick = true,
    closeOnOutsideClick = true,
    width = 'auto'
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx('dropdown', `dropdown-${position}`, className);
  if (id) wrapper.id = id;

  // Create trigger button
  const triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.className = 'dropdown-trigger';
  triggerBtn.setAttribute('aria-haspopup', 'true');
  triggerBtn.setAttribute('aria-expanded', 'false');

  if (typeof trigger === 'string') {
    triggerBtn.innerHTML = `<span class="dropdown-trigger-text">${trigger}</span>`;
  } else {
    triggerBtn.appendChild(trigger);
  }

  if (triggerIcon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'dropdown-trigger-icon';
    iconSpan.innerHTML = triggerIcon;
    triggerBtn.appendChild(iconSpan);
  }

  // Create menu
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.setAttribute('role', 'menu');

  if (width === 'trigger') {
    menu.style.minWidth = '100%';
  } else if (width !== 'auto') {
    menu.style.width = width;
  }

  // Add items
  items.forEach(item => {
    const menuItem = createDropdownItem(item, () => {
      if (closeOnClick) {
        closeDropdown(wrapper);
      }
    });
    menu.appendChild(menuItem);

    if (item.dividerAfter) {
      const divider = document.createElement('div');
      divider.className = 'dropdown-divider';
      divider.setAttribute('role', 'separator');
      menu.appendChild(divider);
    }
  });

  // Toggle on click
  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(wrapper);
  });

  // Keyboard navigation
  triggerBtn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDropdown(wrapper);
      const firstItem = menu.querySelector('.dropdown-item:not([aria-disabled="true"])') as HTMLElement;
      firstItem?.focus();
    }
  });

  menu.addEventListener('keydown', (e) => {
    const menuItems = Array.from(menu.querySelectorAll('.dropdown-item:not([aria-disabled="true"])')) as HTMLElement[];
    const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % menuItems.length;
      menuItems[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
      menuItems[prevIndex]?.focus();
    } else if (e.key === 'Escape') {
      closeDropdown(wrapper);
      triggerBtn.focus();
    }
  });

  // Close on outside click
  if (closeOnOutsideClick) {
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target as Node)) {
        closeDropdown(wrapper);
      }
    });
  }

  wrapper.appendChild(triggerBtn);
  wrapper.appendChild(menu);

  return wrapper;
}

function createDropdownItem(item: DropdownItem, onClickWrapper: () => void): HTMLElement {
  const menuItem = document.createElement('button');
  menuItem.type = 'button';
  menuItem.className = cx(
    'dropdown-item',
    item.danger && 'dropdown-item-danger',
    item.disabled && 'dropdown-item-disabled'
  );
  menuItem.setAttribute('role', 'menuitem');

  if (item.disabled) {
    menuItem.setAttribute('aria-disabled', 'true');
    menuItem.disabled = true;
  }

  if (item.icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'dropdown-item-icon';
    iconSpan.innerHTML = item.icon;
    menuItem.appendChild(iconSpan);
  }

  const labelSpan = document.createElement('span');
  labelSpan.className = 'dropdown-item-label';
  labelSpan.textContent = item.label;
  menuItem.appendChild(labelSpan);

  if (!item.disabled && item.onClick) {
    menuItem.addEventListener('click', () => {
      item.onClick!();
      onClickWrapper();
    });
  }

  return menuItem;
}

function toggleDropdown(dropdown: HTMLElement): void {
  const isOpen = dropdown.classList.contains('open');
  if (isOpen) {
    closeDropdown(dropdown);
  } else {
    openDropdown(dropdown);
  }
}

function openDropdown(dropdown: HTMLElement): void {
  // Close other dropdowns
  document.querySelectorAll('.dropdown.open').forEach(other => {
    if (other !== dropdown) closeDropdown(other as HTMLElement);
  });

  dropdown.classList.add('open');
  const trigger = dropdown.querySelector('.dropdown-trigger');
  trigger?.setAttribute('aria-expanded', 'true');
}

function closeDropdown(dropdown: HTMLElement): void {
  dropdown.classList.remove('open');
  const trigger = dropdown.querySelector('.dropdown-trigger');
  trigger?.setAttribute('aria-expanded', 'false');
}

// ===============================================
// DROPDOWN BUTTON
// ===============================================

/**
 * Create a button with dropdown menu.
 */
export function createDropdownButton(config: DropdownButtonConfig): HTMLElement {
  const {
    text,
    items,
    variant = 'secondary',
    size = 'md',
    icon,
    disabled = false,
    className = ''
  } = config;

  const trigger = document.createElement('span');
  trigger.className = 'dropdown-btn-content';

  if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'dropdown-btn-icon';
    iconSpan.innerHTML = icon;
    trigger.appendChild(iconSpan);
  }

  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  trigger.appendChild(textSpan);

  const dropdown = createDropdown({
    items,
    trigger,
    className: cx(
      'dropdown-button',
      `btn-${variant}`,
      `btn-${size}`,
      disabled && 'disabled',
      className
    )
  });

  if (disabled) {
    const triggerBtn = dropdown.querySelector('.dropdown-trigger') as HTMLButtonElement;
    if (triggerBtn) triggerBtn.disabled = true;
  }

  return dropdown;
}

// ===============================================
// SPLIT BUTTON
// ===============================================

/**
 * Create a split button (primary action + dropdown).
 */
export function createSplitButton(config: SplitButtonConfig): HTMLElement {
  const {
    primaryLabel,
    onPrimaryClick,
    items,
    variant = 'primary',
    size = 'md',
    icon,
    disabled = false,
    className = ''
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx('split-button', `btn-${size}`, className);

  // Primary button
  const primaryBtn = document.createElement('button');
  primaryBtn.type = 'button';
  primaryBtn.className = `btn btn-${variant} btn-${size} split-button-primary`;
  primaryBtn.disabled = disabled;

  if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'btn-icon';
    iconSpan.innerHTML = icon;
    primaryBtn.appendChild(iconSpan);
  }

  const textSpan = document.createElement('span');
  textSpan.textContent = primaryLabel;
  primaryBtn.appendChild(textSpan);

  primaryBtn.addEventListener('click', onPrimaryClick);

  // Dropdown trigger
  const dropdownBtn = document.createElement('button');
  dropdownBtn.type = 'button';
  dropdownBtn.className = `btn btn-${variant} btn-${size} split-button-dropdown`;
  dropdownBtn.disabled = disabled;
  dropdownBtn.setAttribute('aria-haspopup', 'true');
  dropdownBtn.setAttribute('aria-expanded', 'false');
  dropdownBtn.setAttribute('aria-label', 'More options');
  dropdownBtn.innerHTML = ICONS.CHEVRON_DOWN;

  // Menu
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.setAttribute('role', 'menu');

  items.forEach(item => {
    const menuItem = createDropdownItem(item, () => {
      wrapper.classList.remove('open');
      dropdownBtn.setAttribute('aria-expanded', 'false');
    });
    menu.appendChild(menuItem);
  });

  // Toggle
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.toggle('open');
    dropdownBtn.setAttribute('aria-expanded', String(wrapper.classList.contains('open')));
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      wrapper.classList.remove('open');
      dropdownBtn.setAttribute('aria-expanded', 'false');
    }
  });

  wrapper.appendChild(primaryBtn);
  wrapper.appendChild(dropdownBtn);
  wrapper.appendChild(menu);

  return wrapper;
}

// ===============================================
// TOOLTIP
// ===============================================

/**
 * Add a tooltip to an element.
 */
export function createTooltip(config: TooltipConfig): { show: () => void; hide: () => void; destroy: () => void } {
  const {
    content,
    target,
    position = 'top',
    delay = 200,
    className = ''
  } = config;

  let tooltip: HTMLElement | null = null;
  let showTimeout: ReturnType<typeof setTimeout>;
  let hideTimeout: ReturnType<typeof setTimeout>;

  const show = () => {
    clearTimeout(hideTimeout);
    showTimeout = setTimeout(() => {
      if (tooltip) return;

      tooltip = document.createElement('div');
      tooltip.className = cx('tooltip', `tooltip-${position}`, className);
      tooltip.setAttribute('role', 'tooltip');
      tooltip.textContent = content;

      document.body.appendChild(tooltip);
      positionTooltip(tooltip, target, position);
    }, delay);
  };

  const hide = () => {
    clearTimeout(showTimeout);
    hideTimeout = setTimeout(() => {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    }, 100);
  };

  const destroy = () => {
    clearTimeout(showTimeout);
    clearTimeout(hideTimeout);
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
    target.removeEventListener('mouseenter', show);
    target.removeEventListener('mouseleave', hide);
    target.removeEventListener('focus', show);
    target.removeEventListener('blur', hide);
  };

  target.addEventListener('mouseenter', show);
  target.addEventListener('mouseleave', hide);
  target.addEventListener('focus', show);
  target.addEventListener('blur', hide);

  return { show, hide, destroy };
}

function positionTooltip(tooltip: HTMLElement, target: HTMLElement, position: string): void {
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  let top = 0;
  let left = 0;

  switch (position) {
  case 'top':
    top = targetRect.top - tooltipRect.height - 8;
    left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
    break;
  case 'bottom':
    top = targetRect.bottom + 8;
    left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
    break;
  case 'left':
    top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
    left = targetRect.left - tooltipRect.width - 8;
    break;
  case 'right':
    top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
    left = targetRect.right + 8;
    break;
  }

  tooltip.style.top = `${top + window.scrollY}px`;
  tooltip.style.left = `${left + window.scrollX}px`;
}

// ===============================================
// POPOVER
// ===============================================

/**
 * Create a popover attached to an element.
 */
export function createPopover(config: PopoverConfig): { open: () => void; close: () => void; toggle: () => void; destroy: () => void } {
  const {
    content,
    target,
    title,
    position = 'bottom',
    showClose = true,
    onClose,
    className = ''
  } = config;

  let popover: HTMLElement | null = null;
  let isOpen = false;

  // Define close first so it can be used in open
  const close = () => {
    if (!isOpen || !popover) return;
    isOpen = false;

    popover.remove();
    popover = null;
    onClose?.();
  };

  const open = () => {
    if (isOpen) return;
    isOpen = true;

    popover = document.createElement('div');
    popover.className = cx('popover', `popover-${position}`, className);
    popover.setAttribute('role', 'dialog');

    if (title || showClose) {
      const header = document.createElement('div');
      header.className = 'popover-header';

      if (title) {
        const titleEl = document.createElement('span');
        titleEl.className = 'popover-title';
        titleEl.textContent = title;
        header.appendChild(titleEl);
      }

      if (showClose) {
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'popover-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        closeBtn.addEventListener('click', close);
        header.appendChild(closeBtn);
      }

      popover.appendChild(header);
    }

    const body = document.createElement('div');
    body.className = 'popover-body';

    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }

    popover.appendChild(body);
    document.body.appendChild(popover);
    positionTooltip(popover, target, position);
  };

  const toggle = () => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  };

  const destroy = () => {
    close();
    target.removeEventListener('click', toggle);
  };

  // Click to toggle
  target.addEventListener('click', toggle);

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (popover && !popover.contains(e.target as Node) && !target.contains(e.target as Node)) {
      close();
    }
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      close();
    }
  });

  return { open, close, toggle, destroy };
}
