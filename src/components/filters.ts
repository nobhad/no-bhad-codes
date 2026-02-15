/**
 * ===============================================
 * FILTER COMPONENTS (REUSABLE)
 * ===============================================
 * @file src/components/filters.ts
 *
 * Reusable filter components for tables and data views.
 * Includes search, status, date range, and per-page filters.
 */

import { ICONS } from '../constants/icons';
import { cx } from '../utils/dom-utils';

// ===============================================
// TYPES
// ===============================================

export interface SearchFilterConfig {
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Search handler */
  onSearch: (query: string) => void;
  /** Initial value */
  initialValue?: string;
  /** Additional class names */
  className?: string;
  /** Expandable mode (icon expands to input) */
  expandable?: boolean;
  /** ID attribute */
  id?: string;
  /** aria-label for accessibility */
  ariaLabel?: string;
}

export interface StatusFilterOption {
  value: string;
  label: string;
  color?: string;
}

export interface StatusFilterConfig {
  /** Available status options */
  options: StatusFilterOption[];
  /** Selected values (for multi-select) */
  selectedValues?: string[];
  /** Change handler */
  onChange: (selectedValues: string[]) => void;
  /** Allow multiple selections */
  multiSelect?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** ID attribute */
  id?: string;
  /** "All" option text (default: 'All Statuses') */
  allLabel?: string;
}

export interface DateRangeFilterConfig {
  /** Start date change handler */
  onStartChange: (date: string) => void;
  /** End date change handler */
  onEndChange: (date: string) => void;
  /** Combined change handler */
  onChange?: (startDate: string, endDate: string) => void;
  /** Initial start date (ISO format) */
  startDate?: string;
  /** Initial end date (ISO format) */
  endDate?: string;
  /** Show presets (Today, This Week, etc.) */
  showPresets?: boolean;
  /** Min date constraint */
  minDate?: string;
  /** Max date constraint */
  maxDate?: string;
  /** Additional class names */
  className?: string;
}

export interface PerPageSelectConfig {
  /** Available options (default: [10, 25, 50, 100]) */
  options?: number[];
  /** Current value */
  value: number;
  /** Change handler */
  onChange: (perPage: number) => void;
  /** Additional class names */
  className?: string;
  /** ID attribute */
  id?: string;
}

export interface FilterBarConfig {
  /** Search filter config (optional) */
  search?: SearchFilterConfig;
  /** Status filter config (optional) */
  status?: StatusFilterConfig;
  /** Date range filter config (optional) */
  dateRange?: DateRangeFilterConfig;
  /** Per page select config (optional) */
  perPage?: PerPageSelectConfig;
  /** Clear all handler */
  onClearAll?: () => void;
  /** Additional class names */
  className?: string;
  /** Collapse to dropdown on mobile */
  responsiveCollapse?: boolean;
}

// ===============================================
// SEARCH FILTER
// ===============================================

/**
 * Create a search filter input with debouncing.
 */
export function createSearchFilter(config: SearchFilterConfig): HTMLElement {
  const {
    placeholder = 'Search...',
    debounceMs = 300,
    onSearch,
    initialValue = '',
    className = '',
    expandable = false,
    id,
    ariaLabel = 'Search'
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx(
    'search-filter',
    expandable && 'search-filter-expandable',
    className
  );

  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = placeholder;
  input.value = initialValue;
  input.className = 'search-filter-input form-input';
  input.setAttribute('aria-label', ariaLabel);
  if (id) input.id = id;

  const iconBtn = document.createElement('button');
  iconBtn.type = 'button';
  iconBtn.className = 'search-filter-icon';
  iconBtn.setAttribute('aria-label', 'Toggle search');
  iconBtn.innerHTML = ICONS.SEARCH;

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'search-filter-clear';
  clearBtn.setAttribute('aria-label', 'Clear search');
  clearBtn.innerHTML = ICONS.X;
  clearBtn.style.display = initialValue ? '' : 'none';

  // Debounce handler
  let debounceTimer: ReturnType<typeof setTimeout>;
  const handleSearch = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onSearch(input.value);
    }, debounceMs);
    clearBtn.style.display = input.value ? '' : 'none';
  };

  input.addEventListener('input', handleSearch);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      onSearch('');
      clearBtn.style.display = 'none';
      if (expandable) {
        wrapper.classList.remove('expanded');
        input.blur();
      }
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    onSearch('');
    clearBtn.style.display = 'none';
    input.focus();
  });

  if (expandable) {
    iconBtn.addEventListener('click', () => {
      wrapper.classList.toggle('expanded');
      if (wrapper.classList.contains('expanded')) {
        input.focus();
      }
    });

    input.addEventListener('blur', () => {
      if (!input.value) {
        wrapper.classList.remove('expanded');
      }
    });
  }

  wrapper.appendChild(iconBtn);
  wrapper.appendChild(input);
  wrapper.appendChild(clearBtn);

  return wrapper;
}

// ===============================================
// STATUS FILTER
// ===============================================

/**
 * Create a status filter dropdown (single or multi-select).
 */
export function createStatusFilter(config: StatusFilterConfig): HTMLElement {
  const {
    options,
    selectedValues = [],
    onChange,
    multiSelect = true,
    // placeholder reserved for future use
    className = '',
    id,
    allLabel = 'All Statuses'
  } = config;

  const selected = new Set(selectedValues);

  const wrapper = document.createElement('div');
  wrapper.className = cx('status-filter', 'custom-dropdown', className);
  if (id) wrapper.id = id;

  // Trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'status-filter-trigger form-input';

  const updateTriggerText = () => {
    if (selected.size === 0) {
      trigger.textContent = allLabel;
    } else if (selected.size === 1) {
      const opt = options.find(o => o.value === Array.from(selected)[0]);
      trigger.textContent = opt?.label || Array.from(selected)[0];
    } else {
      trigger.textContent = `${selected.size} selected`;
    }
  };

  updateTriggerText();

  // Dropdown menu
  const menu = document.createElement('div');
  menu.className = 'status-filter-menu custom-dropdown-menu';

  // "All" option
  const allOption = document.createElement('label');
  allOption.className = 'status-filter-option';
  allOption.innerHTML = `
    <input type="${multiSelect ? 'checkbox' : 'radio'}" name="status-filter" value="" ${selected.size === 0 ? 'checked' : ''}>
    <span class="status-filter-label">${allLabel}</span>
  `;
  menu.appendChild(allOption);

  // Status options
  options.forEach(opt => {
    const option = document.createElement('label');
    option.className = 'status-filter-option';

    const dotStyle = opt.color ? `style="background-color: ${opt.color}"` : `data-status="${opt.value}"`;

    option.innerHTML = `
      <input type="${multiSelect ? 'checkbox' : 'radio'}" name="status-filter" value="${opt.value}" ${selected.has(opt.value) ? 'checked' : ''}>
      <span class="status-dot" ${dotStyle}></span>
      <span class="status-filter-label">${opt.label}</span>
    `;
    menu.appendChild(option);
  });

  // Handle changes
  menu.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const value = target.value;

    if (value === '') {
      // "All" selected - clear selection
      selected.clear();
    } else if (multiSelect) {
      if (target.checked) {
        selected.add(value);
      } else {
        selected.delete(value);
      }
    } else {
      selected.clear();
      selected.add(value);
      wrapper.classList.remove('open');
    }

    // Update "All" checkbox
    const allCheckbox = menu.querySelector('input[value=""]') as HTMLInputElement;
    if (allCheckbox) {
      allCheckbox.checked = selected.size === 0;
    }

    updateTriggerText();
    onChange(Array.from(selected));
  });

  // Toggle dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      wrapper.classList.remove('open');
    }
  });

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  return wrapper;
}

// ===============================================
// DATE RANGE FILTER
// ===============================================

/**
 * Create a date range filter with optional presets.
 */
export function createDateRangeFilter(config: DateRangeFilterConfig): HTMLElement {
  const {
    onStartChange,
    onEndChange,
    onChange,
    startDate = '',
    endDate = '',
    showPresets = true,
    minDate,
    maxDate,
    className = ''
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx('date-range-filter', className);

  // Start date
  const startGroup = document.createElement('div');
  startGroup.className = 'date-range-field';

  const startLabel = document.createElement('label');
  startLabel.className = 'date-range-label';
  startLabel.textContent = 'From';

  const startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.className = 'date-range-input form-input';
  startInput.value = startDate;
  if (minDate) startInput.min = minDate;
  if (maxDate) startInput.max = maxDate;

  startGroup.appendChild(startLabel);
  startGroup.appendChild(startInput);

  // End date
  const endGroup = document.createElement('div');
  endGroup.className = 'date-range-field';

  const endLabel = document.createElement('label');
  endLabel.className = 'date-range-label';
  endLabel.textContent = 'To';

  const endInput = document.createElement('input');
  endInput.type = 'date';
  endInput.className = 'date-range-input form-input';
  endInput.value = endDate;
  if (minDate) endInput.min = minDate;
  if (maxDate) endInput.max = maxDate;

  endGroup.appendChild(endLabel);
  endGroup.appendChild(endInput);

  // Event handlers
  startInput.addEventListener('change', () => {
    onStartChange(startInput.value);
    onChange?.(startInput.value, endInput.value);
    // Update end date min
    endInput.min = startInput.value || minDate || '';
  });

  endInput.addEventListener('change', () => {
    onEndChange(endInput.value);
    onChange?.(startInput.value, endInput.value);
    // Update start date max
    startInput.max = endInput.value || maxDate || '';
  });

  wrapper.appendChild(startGroup);
  wrapper.appendChild(endGroup);

  // Presets
  if (showPresets) {
    const presetsContainer = document.createElement('div');
    presetsContainer.className = 'date-range-presets';

    const presets = [
      { label: 'Today', getValue: () => getDatePreset('today') },
      { label: 'This Week', getValue: () => getDatePreset('week') },
      { label: 'This Month', getValue: () => getDatePreset('month') },
      { label: 'Last 30 Days', getValue: () => getDatePreset('last30') }
    ];

    presets.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'date-range-preset-btn';
      btn.textContent = preset.label;

      btn.addEventListener('click', () => {
        const { start, end } = preset.getValue();
        startInput.value = start;
        endInput.value = end;
        onStartChange(start);
        onEndChange(end);
        onChange?.(start, end);
      });

      presetsContainer.appendChild(btn);
    });

    wrapper.appendChild(presetsContainer);
  }

  return wrapper;
}

/**
 * Get date range for preset values.
 */
function getDatePreset(preset: 'today' | 'week' | 'month' | 'last30'): { start: string; end: string } {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
  case 'today':
    return { start: formatDate(today), end: formatDate(today) };

  case 'week': {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return { start: formatDate(startOfWeek), end: formatDate(endOfWeek) };
  }

  case 'month': {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: formatDate(startOfMonth), end: formatDate(endOfMonth) };
  }

  case 'last30': {
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return { start: formatDate(thirtyDaysAgo), end: formatDate(today) };
  }

  default:
    return { start: '', end: '' };
  }
}

// ===============================================
// PER PAGE SELECT
// ===============================================

/**
 * Create a per-page select dropdown.
 */
export function createPerPageSelect(config: PerPageSelectConfig): HTMLElement {
  const {
    options = [10, 25, 50, 100],
    value,
    onChange,
    className = '',
    id
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx('per-page-select', className);

  const label = document.createElement('label');
  label.className = 'per-page-label';
  label.textContent = 'Show';

  const select = document.createElement('select');
  select.className = 'per-page-dropdown form-input';
  if (id) select.id = id;

  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = String(opt);
    option.textContent = String(opt);
    option.selected = opt === value;
    select.appendChild(option);
  });

  const suffix = document.createElement('span');
  suffix.className = 'per-page-suffix';
  suffix.textContent = 'per page';

  select.addEventListener('change', () => {
    onChange(parseInt(select.value, 10));
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);
  wrapper.appendChild(suffix);

  return wrapper;
}

// ===============================================
// FILTER BAR
// ===============================================

/**
 * Create a complete filter bar with multiple filter types.
 */
export function createFilterBar(config: FilterBarConfig): HTMLElement {
  const {
    search,
    status,
    dateRange,
    perPage,
    onClearAll,
    className = '',
    responsiveCollapse = true
  } = config;

  const bar = document.createElement('div');
  bar.className = cx('filter-bar', responsiveCollapse && 'filter-bar-responsive', className);

  // Left side - search and filters
  const leftSection = document.createElement('div');
  leftSection.className = 'filter-bar-left';

  if (search) {
    leftSection.appendChild(createSearchFilter(search));
  }

  if (status) {
    leftSection.appendChild(createStatusFilter(status));
  }

  if (dateRange) {
    leftSection.appendChild(createDateRangeFilter(dateRange));
  }

  // Right side - per page and clear
  const rightSection = document.createElement('div');
  rightSection.className = 'filter-bar-right';

  if (perPage) {
    rightSection.appendChild(createPerPageSelect(perPage));
  }

  if (onClearAll) {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'filter-bar-clear btn btn-ghost btn-sm';
    clearBtn.textContent = 'Clear All';
    clearBtn.addEventListener('click', onClearAll);
    rightSection.appendChild(clearBtn);
  }

  bar.appendChild(leftSection);
  bar.appendChild(rightSection);

  return bar;
}
