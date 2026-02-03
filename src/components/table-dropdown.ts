/**
 * ===============================================
 * TABLE DROPDOWN (REUSABLE)
 * ===============================================
 * @file src/components/table-dropdown.ts
 *
 * Reusable dropdown for tables: table cells (status, actions) and table header
 * filters (e.g. per page). Custom trigger + menu; compact, no row height change.
 * Use createFormSelect for form/modals.
 */

import { ICONS } from '../constants/icons';

/** Internal wrapper type for filter dropdown with setOptions */
interface TableDropdownWrapper extends HTMLElement {
  _ariaLabelPrefix?: string;
  _options?: TableDropdownOption[];
  _onChange?: (value: string) => void;
  _showAllWithCheckmark?: boolean;
  setOptions?: (options: TableDropdownOption[], selectedValue?: string) => void;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export interface TableDropdownOption {
  value: string;
  label: string;
}

export interface TableDropdownConfig {
  options: TableDropdownOption[];
  currentValue: string;
  onChange: (value: string) => void;
  /** When false, omit the status dot (e.g. for pagination "Per page" dropdown). Default true. */
  showStatusDot?: boolean;
  /** Optional prefix for trigger aria-label, e.g. "Per page" -> "Per page, current: 25". */
  ariaLabelPrefix?: string;
  /** When true, show all options in menu with a checkmark next to selected; fixed-width check column so labels align. */
  showAllWithCheckmark?: boolean;
}

/**
 * Normalize status value (convert underscores to hyphens to match database format)
 */
function normalizeStatus(status: string): string {
  return status.replace(/_/g, '-');
}

/**
 * Create a compact table dropdown element. Use in table cells (status, actions)
 * or table header (e.g. filter, per page). For form fields use createFormSelect.
 */
export function createTableDropdown(config: TableDropdownConfig): HTMLElement {
  const { options, currentValue, onChange, showStatusDot = true, ariaLabelPrefix, showAllWithCheckmark = false } = config;

  // Normalize value (legacy data may have underscores, we use hyphens)
  const normalizedValue = normalizeStatus(currentValue);

  // Find current option label
  const currentOption = options.find(opt => opt.value === normalizedValue);
  const currentLabel = currentOption?.label || getStatusLabel(currentValue);

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'table-dropdown custom-dropdown';
  wrapper.dataset.status = normalizedValue;
  if (showAllWithCheckmark) {
    wrapper.classList.add('filter-dropdown-with-check');
    (wrapper as TableDropdownWrapper)._showAllWithCheckmark = true;
  }

  // Trigger: no status dot when showAllWithCheckmark (filter dropdown)
  const useStatusDot = showStatusDot && !showAllWithCheckmark;

  // Create trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-dropdown-trigger';
  const ariaLabel = ariaLabelPrefix
    ? `${ariaLabelPrefix}, current: ${currentLabel}`
    : `Change status, current: ${currentLabel}`;
  trigger.setAttribute('aria-label', ariaLabel);
  trigger.innerHTML =
    `${useStatusDot ? '<span class="status-dot"></span>' : ''
    }<span class="custom-dropdown-text">${escapeHtml(currentLabel)}</span>
    ${ICONS.CARET_DOWN}`;

  // Create menu
  const menu = document.createElement('ul');
  menu.className = 'custom-dropdown-menu';

  if (showAllWithCheckmark) {
    // All options; each has fixed-width check column so labels align
    options.forEach(opt => {
      const li = document.createElement('li');
      li.className = 'custom-dropdown-item';
      li.dataset.value = opt.value;
      const checkSpan = document.createElement('span');
      checkSpan.className = 'filter-dropdown-check';
      checkSpan.setAttribute('aria-hidden', 'true');
      checkSpan.textContent = opt.value === normalizedValue ? '\u2713' : '';
      const textSpan = document.createElement('span');
      textSpan.className = 'custom-dropdown-text';
      textSpan.textContent = opt.label;
      li.appendChild(checkSpan);
      li.appendChild(textSpan);

      li.addEventListener('click', (e) => {
        e.stopPropagation();
        selectOption(wrapper, opt.value, opt.label, options, onChange);
      });

      menu.appendChild(li);
    });
  } else {
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
  }

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  // Toggle on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleDropdown(wrapper);
    if (wrapper.classList.contains('open')) {
      scheduleFlipCheck(wrapper);
    } else {
      wrapper.classList.remove('dropdown-open-up');
    }
  });

  // Store aria label prefix for selectOption updates
  if (ariaLabelPrefix !== undefined) {
    (wrapper as TableDropdownWrapper)._ariaLabelPrefix = ariaLabelPrefix;
  }

  // When showAllWithCheckmark, store options/onChange for setOptions and attach setOptions
  if (showAllWithCheckmark) {
    (wrapper as TableDropdownWrapper)._options = options;
    (wrapper as TableDropdownWrapper)._onChange = onChange;
    (wrapper as TableDropdownWrapper).setOptions = (newOptions: TableDropdownOption[], selectedValue?: string) => {
      (wrapper as TableDropdownWrapper)._options = newOptions;
      const value = selectedValue !== undefined ? selectedValue : (wrapper.dataset.status ?? '');
      const normalized = normalizeStatus(value);
      const currentOpt = newOptions.find(o => o.value === normalized);
      const label = currentOpt?.label ?? (value === '' ? newOptions[0]?.label ?? '' : String(value));
      wrapper.dataset.status = normalized;
      const textEl = wrapper.querySelector('.custom-dropdown-trigger .custom-dropdown-text');
      if (textEl) textEl.textContent = label;
      const triggerBtn = wrapper.querySelector('button.custom-dropdown-trigger');
      if (triggerBtn) {
        const prefix = (wrapper as TableDropdownWrapper)._ariaLabelPrefix;
        triggerBtn.setAttribute('aria-label', prefix ? `${prefix}, current: ${label}` : `Change status, current: ${label}`);
      }
      const menuEl = wrapper.querySelector('.custom-dropdown-menu');
      if (menuEl) {
        menuEl.innerHTML = '';
        newOptions.forEach(opt => {
          const li = document.createElement('li');
          li.className = 'custom-dropdown-item';
          li.dataset.value = opt.value;
          const checkSpan = document.createElement('span');
          checkSpan.className = 'filter-dropdown-check';
          checkSpan.setAttribute('aria-hidden', 'true');
          checkSpan.textContent = opt.value === normalized ? '\u2713' : '';
          const textSpan = document.createElement('span');
          textSpan.className = 'custom-dropdown-text';
          textSpan.textContent = opt.label;
          li.appendChild(checkSpan);
          li.appendChild(textSpan);
          li.addEventListener('click', (e) => {
            e.stopPropagation();
            selectOption(wrapper, opt.value, opt.label, newOptions, (wrapper as TableDropdownWrapper)._onChange!);
          });
          menuEl.appendChild(li);
        });
      }
    };
  }

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
 * After open, check if menu would be cut off below; if so, show menu above trigger
 */
function scheduleFlipCheck(wrapper: HTMLElement): void {
  const menu = wrapper.querySelector('.custom-dropdown-menu') as HTMLElement;
  const trigger = wrapper.querySelector('.custom-dropdown-trigger') as HTMLElement;
  if (!menu || !trigger) return;

  const run = (): void => {
    if (!wrapper.classList.contains('open')) return;
    const triggerRect = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight || 140;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    if (spaceBelow < menuHeight && spaceAbove >= menuHeight) {
      wrapper.classList.add('dropdown-open-up');
    } else {
      wrapper.classList.remove('dropdown-open-up');
    }
  };

  requestAnimationFrame(() => {
    run();
  });
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
  // Update trigger text and aria-label
  const textEl = wrapper.querySelector('.custom-dropdown-text');
  if (textEl) {
    textEl.textContent = label;
  }
  const trigger = wrapper.querySelector('button.custom-dropdown-trigger');
  if (trigger) {
    const prefix = (wrapper as HTMLElement & { _ariaLabelPrefix?: string })._ariaLabelPrefix;
    const ariaLabel = prefix ? `${prefix}, current: ${label}` : `Change status, current: ${label}`;
    trigger.setAttribute('aria-label', ariaLabel);
  }

  // Update data-status for styling (and for reading value from wrapper when used as filter)
  wrapper.dataset.status = value;

  // Rebuild menu
  const menu = wrapper.querySelector('.custom-dropdown-menu');
  const showAllWithCheckmark = (wrapper as TableDropdownWrapper)._showAllWithCheckmark;

  if (menu && showAllWithCheckmark) {
    menu.innerHTML = '';
    allOptions.forEach(opt => {
      const li = document.createElement('li');
      li.className = 'custom-dropdown-item';
      li.dataset.value = opt.value;
      const checkSpan = document.createElement('span');
      checkSpan.className = 'filter-dropdown-check';
      checkSpan.setAttribute('aria-hidden', 'true');
      checkSpan.textContent = opt.value === value ? '\u2713' : '';
      const textSpan = document.createElement('span');
      textSpan.className = 'custom-dropdown-text';
      textSpan.textContent = opt.label;
      li.appendChild(checkSpan);
      li.appendChild(textSpan);

      li.addEventListener('click', (e) => {
        e.stopPropagation();
        selectOption(wrapper, opt.value, opt.label, allOptions, onChange);
      });

      menu.appendChild(li);
    });
  } else if (menu) {
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
    // Lead statuses
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    'in-progress': 'In Progress',
    in_progress: 'In Progress', // Legacy support
    converted: 'Converted',
    lost: 'Lost',
    'on-hold': 'On Hold',
    on_hold: 'On Hold', // Legacy support
    cancelled: 'Cancelled',
    // Contact statuses
    read: 'Read',
    responded: 'Responded',
    archived: 'Archived',
    // Project statuses
    planning: 'Planning',
    review: 'Review',
    completed: 'Completed',
    // Legacy - kept for backwards compatibility
    pending: 'New', // Map legacy 'pending' to 'New'
    active: 'In Progress' // Map legacy 'active' to 'In Progress'
  };
  return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

// Lead status options - simplified pipeline stages
export const LEAD_STATUS_OPTIONS: TableDropdownOption[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' }
];

// Contact status options
export const CONTACT_STATUS_OPTIONS: TableDropdownOption[] = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'responded', label: 'Responded' },
  { value: 'archived', label: 'Archived' }
];

// Project status options
export const PROJECT_STATUS_OPTIONS: TableDropdownOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];
