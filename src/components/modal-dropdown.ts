/**
 * ===============================================
 * MODAL DROPDOWN (REUSABLE)
 * ===============================================
 * @file src/components/modal-dropdown.ts
 *
 * Reusable dropdown for modals and forms. Matches form field styling:
 * 48px height, same background/border as .form-input.
 * Use createTableDropdown for table cells.
 */

import { ICONS } from '../constants/icons';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export interface ModalDropdownOption {
  value: string;
  label: string;
}

export interface ModalDropdownConfig {
  options: ModalDropdownOption[];
  currentValue: string;
  onChange?: (value: string) => void;
  /** Optional prefix for trigger aria-label, e.g. "Priority" -> "Priority, current: High". */
  ariaLabelPrefix?: string;
  /** Placeholder text when no value selected. Default: "Select..." */
  placeholder?: string;
}

/**
 * Create a modal dropdown element. Use in modals and forms.
 * Matches form field styling (48px height, same bg/border).
 * For table cells use createTableDropdown.
 */
export function createModalDropdown(config: ModalDropdownConfig): HTMLElement {
  const { options, currentValue, onChange, ariaLabelPrefix, placeholder = 'Select...' } = config;

  // Find current option label
  const currentOption = options.find(opt => opt.value === currentValue);
  const currentLabel = currentOption?.label || (currentValue ? currentValue : placeholder);
  const hasValue = !!currentValue && !!currentOption;

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-dropdown custom-dropdown';
  wrapper.dataset.value = currentValue;

  // Create trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-dropdown-trigger';
  const ariaLabel = ariaLabelPrefix
    ? `${ariaLabelPrefix}, current: ${currentLabel}`
    : `Select option, current: ${currentLabel}`;
  trigger.setAttribute('aria-label', ariaLabel);
  trigger.innerHTML = `
    <span class="custom-dropdown-text${!hasValue ? ' placeholder' : ''}">${escapeHtml(currentLabel)}</span>
    ${ICONS.CARET_DOWN}
  `;

  // Create menu
  const menu = document.createElement('ul');
  menu.className = 'custom-dropdown-menu';

  // Add all options
  options.forEach(opt => {
    const li = document.createElement('li');
    li.className = 'custom-dropdown-item';
    if (opt.value === currentValue) {
      li.classList.add('selected');
    }
    li.dataset.value = opt.value;

    const textSpan = document.createElement('span');
    textSpan.className = 'custom-dropdown-text';
    textSpan.textContent = opt.label;
    li.appendChild(textSpan);

    li.addEventListener('click', (e) => {
      e.stopPropagation();
      selectOption(wrapper, opt.value, opt.label, options, onChange, ariaLabelPrefix);
    });

    menu.appendChild(li);
  });

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  // Toggle on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleDropdown(wrapper);
  });

  // Close on outside click
  const closeHandler = (e: MouseEvent) => {
    if (!wrapper.contains(e.target as Node)) {
      wrapper.classList.remove('open');
    }
  };
  document.addEventListener('click', closeHandler);

  // Store cleanup function
  (wrapper as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    document.removeEventListener('click', closeHandler);
  };

  // Store config for later use
  (wrapper as HTMLElement & { _ariaLabelPrefix?: string })._ariaLabelPrefix = ariaLabelPrefix;

  return wrapper;
}

/**
 * Toggle dropdown open/closed
 */
function toggleDropdown(wrapper: HTMLElement): void {
  // Close all other modal dropdowns first
  document.querySelectorAll('.modal-dropdown.open').forEach(el => {
    if (el !== wrapper) {
      el.classList.remove('open');
    }
  });

  wrapper.classList.toggle('open');
}

/**
 * Select an option and update dropdown
 */
function selectOption(
  wrapper: HTMLElement,
  value: string,
  label: string,
  allOptions: ModalDropdownOption[],
  onChange?: (value: string) => void,
  ariaLabelPrefix?: string
): void {
  // Update trigger text and aria-label
  const textEl = wrapper.querySelector('.custom-dropdown-trigger .custom-dropdown-text');
  if (textEl) {
    textEl.textContent = label;
    textEl.classList.remove('placeholder');
  }
  const trigger = wrapper.querySelector('button.custom-dropdown-trigger');
  if (trigger) {
    const prefix = ariaLabelPrefix || (wrapper as HTMLElement & { _ariaLabelPrefix?: string })._ariaLabelPrefix;
    const ariaLabel = prefix ? `${prefix}, current: ${label}` : `Select option, current: ${label}`;
    trigger.setAttribute('aria-label', ariaLabel);
  }

  // Update data-value for reading value from wrapper
  wrapper.dataset.value = value;

  // Update selected state in menu
  const menuItems = wrapper.querySelectorAll('.custom-dropdown-item');
  menuItems.forEach(item => {
    if ((item as HTMLElement).dataset.value === value) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });

  // Close dropdown
  wrapper.classList.remove('open');

  // Call onChange callback
  if (onChange) {
    onChange(value);
  }
}
