/**
 * ===============================================
 * MODAL DROPDOWN UTILITY
 * ===============================================
 * @file src/utils/modal-dropdown.ts
 *
 * Converts native select elements into custom styled dropdowns
 * for use within modals. Uses the same classes as the messages
 * tab custom-dropdown but adds 'no-border' modifier.
 */

import { ICONS } from '../constants/icons';

// Track if global handlers have been set up
let globalHandlersInitialized = false;

/**
 * Setup global click/escape handlers for all modal dropdowns (only once)
 */
function setupGlobalDropdownHandlers(): void {
  if (globalHandlersInitialized) return;
  globalHandlersInitialized = true;

  // Close dropdowns on click outside
  document.addEventListener('click', (e) => {
    const target = e.target as Node;
    document.querySelectorAll('.custom-dropdown[data-modal-dropdown].open').forEach((dropdown) => {
      if (!dropdown.contains(target)) {
        dropdown.classList.remove('open');
      }
    });
  });

  // Close dropdowns on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.custom-dropdown[data-modal-dropdown].open').forEach((dropdown) => {
        dropdown.classList.remove('open');
      });
    }
  });
}

export interface ModalDropdownOptions {
  onChange?: (value: string, label: string) => void;
  placeholder?: string;
}

/**
 * Initialize a custom dropdown from a native select element
 * Uses the same structure as messages tab dropdown
 */
export function initModalDropdown(
  selectElement: HTMLSelectElement,
  options: ModalDropdownOptions = {}
): HTMLElement {
  // Create wrapper - uses custom-dropdown class plus data attribute for modal styling
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-dropdown';
  wrapper.dataset.modalDropdown = 'true';

  // Get current value and options from select
  const currentValue = selectElement.value;
  const selectOptions = Array.from(selectElement.options);
  const currentOption = selectOptions.find(opt => opt.value === currentValue);
  const displayText = currentOption?.text || options.placeholder || 'Select...';

  // Create trigger button - matches messages tab structure exactly
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-dropdown-trigger';
  trigger.innerHTML = `
    <span class="custom-dropdown-text">${displayText}</span>
    ${ICONS.CARET_DOWN}
  `;

  // Create dropdown menu - ul like messages tab
  const menu = document.createElement('ul');
  menu.className = 'custom-dropdown-menu';

  // Add options to menu (skip currently selected)
  selectOptions.forEach(opt => {
    if (opt.value === '') return; // Skip placeholder options
    if (opt.value === currentValue) return; // Skip currently selected option

    const li = document.createElement('li');
    li.className = 'custom-dropdown-item';
    li.dataset.value = opt.value;

    // Create inner structure
    const nameSpan = document.createElement('span');
    nameSpan.className = 'dropdown-item-name';
    nameSpan.textContent = opt.text;
    li.appendChild(nameSpan);

    li.addEventListener('click', () => {
      selectOption(wrapper, selectElement, opt.value, opt.text, options.onChange);
    });

    menu.appendChild(li);
  });

  // Create hidden input to store value for form submission
  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.name = selectElement.name;
  hiddenInput.id = selectElement.id;
  hiddenInput.value = currentValue;

  // Assemble dropdown
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  wrapper.appendChild(hiddenInput);

  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown(wrapper);
  });

  // Setup global handlers only once (not per dropdown)
  setupGlobalDropdownHandlers();

  // Replace select with custom dropdown
  selectElement.style.display = 'none';
  selectElement.parentNode?.insertBefore(wrapper, selectElement);

  return wrapper;
}

/**
 * Toggle dropdown open/closed
 */
function toggleDropdown(wrapper: HTMLElement): void {
  const isOpen = wrapper.classList.contains('open');

  // Close all other dropdowns first
  document.querySelectorAll('.custom-dropdown.open').forEach(el => {
    if (el !== wrapper) {
      el.classList.remove('open');
    }
  });

  if (isOpen) {
    wrapper.classList.remove('open');
  } else {
    wrapper.classList.add('open');
  }
}

/**
 * Close dropdown
 */
function closeDropdown(wrapper: HTMLElement): void {
  wrapper.classList.remove('open');
}

/**
 * Select an option
 */
function selectOption(
  wrapper: HTMLElement,
  originalSelect: HTMLSelectElement,
  value: string,
  label: string,
  onChange?: (value: string, label: string) => void
): void {
  // Update trigger text
  const textEl = wrapper.querySelector('.custom-dropdown-text');
  if (textEl) {
    textEl.textContent = label;
  }

  // Update hidden input
  const hiddenInput = wrapper.querySelector('input[type="hidden"]') as HTMLInputElement;
  if (hiddenInput) {
    hiddenInput.value = value;
  }

  // Update original select (for form submission compatibility)
  originalSelect.value = value;

  // Rebuild menu to hide newly selected option and show previously selected
  rebuildMenu(wrapper, originalSelect, value, onChange);

  // Close dropdown
  closeDropdown(wrapper);

  // Call onChange callback
  if (onChange) {
    onChange(value, label);
  }

  // Dispatch change event on original select for any existing listeners
  originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Rebuild menu items, hiding the currently selected option
 */
function rebuildMenu(
  wrapper: HTMLElement,
  originalSelect: HTMLSelectElement,
  currentValue: string,
  onChange?: (value: string, label: string) => void
): void {
  const menu = wrapper.querySelector('.custom-dropdown-menu');
  if (!menu) return;

  // Clear existing items
  menu.innerHTML = '';

  // Rebuild from original select options
  const selectOptions = Array.from(originalSelect.options);
  selectOptions.forEach(opt => {
    if (opt.value === '') return; // Skip placeholder
    if (opt.value === currentValue) return; // Skip currently selected

    const li = document.createElement('li');
    li.className = 'custom-dropdown-item';
    li.dataset.value = opt.value;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'dropdown-item-name';
    nameSpan.textContent = opt.text;
    li.appendChild(nameSpan);

    li.addEventListener('click', () => {
      selectOption(wrapper, originalSelect, opt.value, opt.text, onChange);
    });

    menu.appendChild(li);
  });
}

/**
 * Initialize all selects within a modal
 */
export function initModalDropdowns(
  modalElement: HTMLElement,
  options: ModalDropdownOptions = {}
): HTMLElement[] {
  const selects = modalElement.querySelectorAll('select:not([data-dropdown-init])');
  const dropdowns: HTMLElement[] = [];

  selects.forEach(select => {
    const selectEl = select as HTMLSelectElement;
    selectEl.dataset.dropdownInit = 'true';
    const dropdown = initModalDropdown(selectEl, options);
    dropdowns.push(dropdown);
  });

  return dropdowns;
}

/**
 * Get the current value of a modal dropdown
 */
export function getModalDropdownValue(wrapper: HTMLElement): string {
  const hiddenInput = wrapper.querySelector('input[type="hidden"]') as HTMLInputElement;
  return hiddenInput?.value || '';
}

/**
 * Set the value of a modal dropdown
 */
export function setModalDropdownValue(wrapper: HTMLElement, value: string): void {
  // Find the original select element (hidden after the wrapper)
  const originalSelect = wrapper.nextElementSibling as HTMLSelectElement;
  if (!originalSelect || originalSelect.tagName !== 'SELECT') return;

  // Find the option in the original select
  const matchingOption = Array.from(originalSelect.options).find(opt => opt.value === value);
  if (!matchingOption) return;

  const label = matchingOption.text;

  // Update trigger text
  const textEl = wrapper.querySelector('.custom-dropdown-text');
  if (textEl) {
    textEl.textContent = label;
  }

  // Update hidden input
  const hiddenInput = wrapper.querySelector('input[type="hidden"]') as HTMLInputElement;
  if (hiddenInput) {
    hiddenInput.value = value;
  }

  // Update original select
  originalSelect.value = value;

  // Rebuild menu to hide newly selected option
  rebuildMenu(wrapper, originalSelect, value);
}
