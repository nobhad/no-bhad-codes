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
  // Create wrapper - uses custom-dropdown class plus modal-dropdown modifier
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-dropdown modal-dropdown';

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
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="custom-dropdown-caret"><path d="m6 9 6 6 6-6"/></svg>
  `;

  // Create dropdown menu - ul like messages tab
  const menu = document.createElement('ul');
  menu.className = 'custom-dropdown-menu';

  // Add options to menu
  selectOptions.forEach(opt => {
    if (opt.value === '') return; // Skip placeholder options

    const li = document.createElement('li');
    li.className = 'custom-dropdown-item';
    li.dataset.value = opt.value;

    // Create inner structure
    const nameSpan = document.createElement('span');
    nameSpan.className = 'dropdown-item-name';
    nameSpan.textContent = opt.text;
    li.appendChild(nameSpan);

    if (opt.value === currentValue) {
      li.classList.add('selected');
    }

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

  // Update selected state on options
  wrapper.querySelectorAll('.custom-dropdown-item').forEach(opt => {
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
  const option = wrapper.querySelector(`.custom-dropdown-item[data-value="${value}"]`) as HTMLElement;
  if (option) {
    const nameEl = option.querySelector('.dropdown-item-name');
    const label = nameEl?.textContent || option.textContent || '';

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

    // Update selected state
    wrapper.querySelectorAll('.custom-dropdown-item').forEach(opt => {
      opt.classList.remove('selected');
    });
    option.classList.add('selected');
  }
}
