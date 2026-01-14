/**
 * ===============================================
 * MODAL DROPDOWN UTILITY
 * ===============================================
 * @file src/utils/modal-dropdown.ts
 *
 * Converts native select elements into custom styled dropdowns
 * for use within modals. Provides full styling control over
 * the dropdown menu that native selects don't allow.
 */

export interface ModalDropdownOptions {
  onChange?: (value: string, label: string) => void;
  placeholder?: string;
}

/**
 * Initialize a custom dropdown from a native select element
 * Replaces the select with a fully styled custom dropdown
 */
export function initModalDropdown(
  selectElement: HTMLSelectElement,
  options: ModalDropdownOptions = {}
): HTMLElement {
  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-dropdown';

  // Get current value and options from select
  const currentValue = selectElement.value;
  const selectOptions = Array.from(selectElement.options);
  const currentOption = selectOptions.find(opt => opt.value === currentValue);
  const displayText = currentOption?.text || options.placeholder || 'Select...';

  // Create trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'modal-dropdown-trigger';
  trigger.innerHTML = `
    <span class="dropdown-text">${displayText}</span>
    <span class="dropdown-arrow">&#9662;</span>
  `;

  // Create dropdown menu
  const menu = document.createElement('div');
  menu.className = 'modal-dropdown-menu';

  // Add options to menu
  selectOptions.forEach(opt => {
    if (opt.value === '') return; // Skip placeholder options

    const optionEl = document.createElement('button');
    optionEl.type = 'button';
    optionEl.className = 'modal-dropdown-option';
    optionEl.dataset.value = opt.value;
    optionEl.textContent = opt.text;

    // Add status class if value contains status keyword
    const statusClass = getStatusClass(opt.value);
    if (statusClass) {
      optionEl.classList.add(statusClass);
    }

    if (opt.value === currentValue) {
      optionEl.classList.add('selected');
    }

    optionEl.addEventListener('click', () => {
      selectOption(wrapper, selectElement, opt.value, opt.text, options.onChange);
    });

    menu.appendChild(optionEl);
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

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      closeDropdown(wrapper);
    }
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDropdown(wrapper);
    }
  });

  // Replace select with custom dropdown
  selectElement.style.display = 'none';
  selectElement.parentNode?.insertBefore(wrapper, selectElement);

  return wrapper;
}

/**
 * Get status class based on value
 */
function getStatusClass(value: string): string | null {
  const normalizedValue = value.toLowerCase().replace(/-/g, '_');

  if (['pending', 'new', 'on_hold'].includes(normalizedValue)) {
    return `status-${normalizedValue}`;
  }
  if (['active', 'in_progress'].includes(normalizedValue)) {
    return `status-${normalizedValue}`;
  }
  if (['completed', 'converted'].includes(normalizedValue)) {
    return `status-${normalizedValue}`;
  }
  if (['cancelled', 'lost', 'inactive'].includes(normalizedValue)) {
    return `status-${normalizedValue}`;
  }

  return null;
}

/**
 * Toggle dropdown open/closed
 */
function toggleDropdown(wrapper: HTMLElement): void {
  const isOpen = wrapper.classList.contains('open');

  // Close all other dropdowns first
  document.querySelectorAll('.modal-dropdown.open').forEach(el => {
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
  const textEl = wrapper.querySelector('.dropdown-text');
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

  // Update selected state on options
  wrapper.querySelectorAll('.modal-dropdown-option').forEach(opt => {
    opt.classList.remove('selected');
    if ((opt as HTMLElement).dataset.value === value) {
      opt.classList.add('selected');
    }
  });

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
  const option = wrapper.querySelector(`.modal-dropdown-option[data-value="${value}"]`) as HTMLElement;
  if (option) {
    const label = option.textContent || '';

    // Update trigger text
    const textEl = wrapper.querySelector('.dropdown-text');
    if (textEl) {
      textEl.textContent = label;
    }

    // Update hidden input
    const hiddenInput = wrapper.querySelector('input[type="hidden"]') as HTMLInputElement;
    if (hiddenInput) {
      hiddenInput.value = value;
    }

    // Update selected state
    wrapper.querySelectorAll('.modal-dropdown-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    option.classList.add('selected');
  }
}
