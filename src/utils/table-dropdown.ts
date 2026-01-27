/**
 * ===============================================
 * TABLE DROPDOWN UTILITY
 * ===============================================
 * @file src/utils/table-dropdown.ts
 *
 * Creates compact custom dropdowns for use in table cells.
 * Designed to not change row height.
 */

import { ICONS } from '../constants/icons';

export interface TableDropdownOption {
  value: string;
  label: string;
}

export interface TableDropdownConfig {
  options: TableDropdownOption[];
  currentValue: string;
  onChange: (value: string) => void;
}

/**
 * Normalize status value (convert hyphens to underscores for consistency)
 */
function normalizeStatus(status: string): string {
  return status.replace(/-/g, '_');
}

/**
 * Create a compact table dropdown element
 */
export function createTableDropdown(config: TableDropdownConfig): HTMLElement {
  const { options, currentValue, onChange } = config;

  // Normalize value (database may have hyphens, options use underscores)
  const normalizedValue = normalizeStatus(currentValue);

  // Find current option label
  const currentOption = options.find(opt => opt.value === normalizedValue);
  const currentLabel = currentOption?.label || getStatusLabel(currentValue);

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'table-dropdown custom-dropdown';
  wrapper.dataset.status = normalizedValue;

  // Create trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-dropdown-trigger';
  trigger.innerHTML = `
    <span class="status-dot"></span>
    <span class="custom-dropdown-text">${currentLabel}</span>
    ${ICONS.CARET_DOWN}
  `;

  // Create menu
  const menu = document.createElement('ul');
  menu.className = 'custom-dropdown-menu';

  // Add options (excluding current)
  options.forEach(opt => {
    if (opt.value === normalizedValue) return;

    const li = document.createElement('li');
    li.className = 'custom-dropdown-item';
    li.dataset.value = opt.value;
    li.textContent = opt.label;

    li.addEventListener('click', (e) => {
      e.stopPropagation();
      selectOption(wrapper, opt.value, opt.label, options, onChange);
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
  (wrapper as any)._cleanup = () => {
    document.removeEventListener('click', closeHandler);
  };

  return wrapper;
}

/**
 * Toggle dropdown open/closed
 */
function toggleDropdown(wrapper: HTMLElement): void {
  // Close all other table dropdowns first
  document.querySelectorAll('.table-dropdown.open').forEach(el => {
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
  allOptions: TableDropdownOption[],
  onChange: (value: string) => void
): void {
  // Update trigger text
  const textEl = wrapper.querySelector('.custom-dropdown-text');
  if (textEl) {
    textEl.textContent = label;
  }

  // Update data-status for styling
  wrapper.dataset.status = value;

  // Rebuild menu with new options
  const menu = wrapper.querySelector('.custom-dropdown-menu');
  if (menu) {
    menu.innerHTML = '';
    allOptions.forEach(opt => {
      if (opt.value === value) return;

      const li = document.createElement('li');
      li.className = 'custom-dropdown-item';
      li.dataset.value = opt.value;
      li.textContent = opt.label;

      li.addEventListener('click', (e) => {
        e.stopPropagation();
        selectOption(wrapper, opt.value, opt.label, allOptions, onChange);
      });

      menu.appendChild(li);
    });
  }

  // Close dropdown
  wrapper.classList.remove('open');

  // Call onChange callback
  onChange(value);
}

/**
 * Get status display label
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'New',
    pending: 'Pending',
    read: 'Read',
    qualified: 'Qualified',
    contacted: 'Contacted',
    responded: 'Responded',
    converted: 'Converted',
    active: 'Active',
    in_progress: 'In Progress',
    on_hold: 'On Hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
    archived: 'Archived',
    lost: 'Lost'
  };
  return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

// Lead status options
export const LEAD_STATUS_OPTIONS: TableDropdownOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'active', label: 'Active' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'converted', label: 'Converted' },
  { value: 'completed', label: 'Completed' },
  { value: 'lost', label: 'Lost' }
];

// Contact status options
export const CONTACT_STATUS_OPTIONS: TableDropdownOption[] = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'responded', label: 'Responded' },
  { value: 'archived', label: 'Archived' }
];
