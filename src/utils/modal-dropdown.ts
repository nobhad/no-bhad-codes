/**
 * ===============================================
 * MODAL DROPDOWN UTILITY
 * ===============================================
 * @file src/utils/modal-dropdown.ts
 *
 * Converts native select elements into custom styled dropdowns
 * for use within modals. Uses position: fixed to escape modal
 * overflow constraints.
 */

import { ICONS } from '../constants/icons';

// Track if global handlers have been set up
let globalHandlersInitialized = false;

// Track active dropdown for repositioning on scroll/resize
let activeDropdown: HTMLElement | null = null;

/**
 * Position the dropdown menu using fixed positioning
 * This allows the menu to escape modal overflow constraints
 */
function positionDropdownMenu(wrapper: HTMLElement): void {
  const trigger = wrapper.querySelector('.custom-dropdown-trigger') as HTMLElement;
  const menu = wrapper.querySelector('.custom-dropdown-menu') as HTMLElement;
  if (!trigger || !menu) return;

  const triggerRect = trigger.getBoundingClientRect();
  const menuHeight = menu.scrollHeight;
  const viewportHeight = window.innerHeight;
  const VIEWPORT_PADDING = 8;

  // Calculate space available below and above the trigger
  const spaceBelow = viewportHeight - triggerRect.bottom - VIEWPORT_PADDING;
  const spaceAbove = triggerRect.top - VIEWPORT_PADDING;

  // Determine if menu should flip above
  const shouldFlipAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

  // Set fixed position
  menu.style.position = 'fixed';
  menu.style.left = `${triggerRect.left}px`;
  menu.style.width = `${triggerRect.width}px`;

  if (shouldFlipAbove) {
    // Position above trigger
    menu.style.top = 'auto';
    menu.style.bottom = `${viewportHeight - triggerRect.top + 1}px`;
    menu.style.maxHeight = `${Math.min(spaceAbove, 200)}px`;
    wrapper.classList.add('flip-above');
  } else {
    // Position below trigger
    menu.style.top = `${triggerRect.bottom - 1}px`;
    menu.style.bottom = 'auto';
    menu.style.maxHeight = `${Math.min(spaceBelow, 200)}px`;
    wrapper.classList.remove('flip-above');
  }
}

/**
 * Reset menu positioning when dropdown closes
 */
function resetDropdownMenuPosition(wrapper: HTMLElement): void {
  const menu = wrapper.querySelector('.custom-dropdown-menu') as HTMLElement;
  if (!menu) return;

  menu.style.position = '';
  menu.style.top = '';
  menu.style.bottom = '';
  menu.style.left = '';
  menu.style.width = '';
  menu.style.maxHeight = '';
  wrapper.classList.remove('flip-above');
}

/**
 * Handle scroll/resize events to reposition active dropdown
 */
function handleScrollOrResize(): void {
  if (activeDropdown && activeDropdown.classList.contains('open')) {
    positionDropdownMenu(activeDropdown);
  }
}

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
        resetDropdownMenuPosition(dropdown as HTMLElement);
        if (activeDropdown === dropdown) {
          activeDropdown = null;
        }
      }
    });
  });

  // Close dropdowns on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.custom-dropdown[data-modal-dropdown].open').forEach((dropdown) => {
        dropdown.classList.remove('open');
        resetDropdownMenuPosition(dropdown as HTMLElement);
      });
      activeDropdown = null;
    }
  });

  // Reposition on scroll (capture phase to catch modal scroll)
  document.addEventListener('scroll', handleScrollOrResize, true);

  // Reposition on resize
  window.addEventListener('resize', handleScrollOrResize);
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

  // Create text span (use textContent to avoid HTML encoding issues)
  const textSpan = document.createElement('span');
  textSpan.className = 'custom-dropdown-text';
  textSpan.textContent = displayText;
  trigger.appendChild(textSpan);

  // Add caret icon (use innerHTML only for the SVG icon)
  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = ICONS.CARET_DOWN;
  trigger.appendChild(iconSpan);

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
      resetDropdownMenuPosition(el as HTMLElement);
    }
  });

  if (isOpen) {
    wrapper.classList.remove('open');
    resetDropdownMenuPosition(wrapper);
    activeDropdown = null;
  } else {
    wrapper.classList.add('open');
    activeDropdown = wrapper;
    // Position menu after adding open class (menu needs to be visible for scrollHeight)
    requestAnimationFrame(() => {
      positionDropdownMenu(wrapper);
    });
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
