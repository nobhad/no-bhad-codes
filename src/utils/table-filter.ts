/**
 * ===============================================
 * TABLE FILTER UTILITY
 * ===============================================
 * @file src/utils/table-filter.ts
 *
 * Client-side filtering, sorting, and search for admin tables.
 * Provides reusable utilities for all admin table modules.
 */

import { ICONS } from '../constants/icons';
import { getPortalCheckboxHTML } from '../components/portal-checkbox';

// ===============================================
// TYPES
// ===============================================

export interface TableFilterConfig {
  tableId: string;
  searchFields: string[];
  statusField: string;
  statusOptions: StatusOption[];
  dateField: string;
  sortableColumns: SortableColumn[];
  storageKey: string;
}

export interface StatusOption {
  value: string;
  label: string;
}

export interface SortableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date';
}

export interface FilterState {
  searchTerm: string;
  statusFilters: string[];
  dateStart: string;
  dateEnd: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
}

// ===============================================
// DEFAULT STATE
// ===============================================

export function getDefaultFilterState(): FilterState {
  return {
    searchTerm: '',
    statusFilters: [],
    dateStart: '',
    dateEnd: '',
    sortColumn: '',
    sortDirection: 'desc'
  };
}

// ===============================================
// LOCALSTORAGE PERSISTENCE
// ===============================================

export function loadFilterState(storageKey: string): FilterState {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...getDefaultFilterState(), ...parsed };
    }
  } catch (e) {
    console.warn('[TableFilter] Failed to load filter state:', e);
  }
  return getDefaultFilterState();
}

export function saveFilterState(storageKey: string, state: FilterState): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (e) {
    console.warn('[TableFilter] Failed to save filter state:', e);
  }
}

// ===============================================
// FILTER UI CREATION
// ===============================================

export function createFilterUI(
  config: TableFilterConfig,
  state: FilterState,
  onStateChange: (newState: FilterState) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'table-filter-controls';

  // Search dropdown (icon button with expandable input)
  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'filter-search-wrapper';
  const hasSearchTerm = state.searchTerm && state.searchTerm.length > 0;
  searchWrapper.innerHTML = `
    <button type="button" class="icon-btn filter-search-trigger ${hasSearchTerm ? 'has-value' : ''}" title="Search" aria-label="Search">
      ${ICONS.SEARCH}
    </button>
    <div class="filter-search-dropdown search-bar">
      <span class="filter-search-icon search-bar-icon">
        ${ICONS.SEARCH_SMALL}
      </span>
      <input type="text" placeholder="Search..." class="filter-search-input search-bar-input" value="${escapeAttr(state.searchTerm)}" />
      <button type="button" class="filter-search-clear search-bar-clear" title="Clear search" aria-label="Clear search">
        ${ICONS.X_SMALL}
      </button>
    </div>
  `;

  const searchTrigger = searchWrapper.querySelector('.filter-search-trigger') as HTMLButtonElement;
  const searchDropdown = searchWrapper.querySelector('.filter-search-dropdown') as HTMLElement;
  const searchInput = searchWrapper.querySelector('input') as HTMLInputElement;
  const searchClear = searchWrapper.querySelector('.filter-search-clear') as HTMLButtonElement;

  // Keep input non-focusable when closed so focus/tab never opens the dropdown
  const setInputFocusable = (open: boolean) => {
    searchInput.tabIndex = open ? 0 : -1;
  };
  setInputFocusable(false);

  // Open dropdown only when the search button is clicked (not on input focus/click)
  searchTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = !searchWrapper.classList.contains('open');
    searchWrapper.classList.toggle('open');
    setInputFocusable(searchWrapper.classList.contains('open'));
    if (willOpen) {
      searchInput.focus();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!searchWrapper.contains(e.target as Node)) {
      searchWrapper.classList.remove('open');
      setInputFocusable(false);
    }
  });

  // Clear search
  searchClear.addEventListener('click', (e) => {
    e.stopPropagation();
    searchInput.value = '';
    searchTrigger.classList.remove('has-value');
    const newState = { ...state, searchTerm: '' };
    saveFilterState(config.storageKey, newState);
    onStateChange(newState);
  });

  let searchTimeout: ReturnType<typeof setTimeout>;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const newState = { ...state, searchTerm: searchInput.value };
      searchTrigger.classList.toggle('has-value', searchInput.value.length > 0);
      saveFilterState(config.storageKey, newState);
      onStateChange(newState);
    }, 200);
  });

  // Close on Enter key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      searchWrapper.classList.remove('open');
      setInputFocusable(false);
    }
  });

  // Prevent input from opening dropdown: do not open on input focus/click
  searchInput.addEventListener('mousedown', (e) => e.stopPropagation());
  searchDropdown.addEventListener('mousedown', (e) => e.stopPropagation());

  container.appendChild(searchWrapper);

  // Filter dropdown
  const dropdownWrapper = document.createElement('div');
  dropdownWrapper.className = 'filter-dropdown-wrapper';

  const activeCount = countActiveFilters(state);
  const allChecked = state.statusFilters.length === 0;
  const hasStatusOptions = config.statusOptions && config.statusOptions.length > 0;

  // Build status section HTML only if there are status options
  const statusSectionHTML = hasStatusOptions ? `
      <div class="filter-section">
        <span class="filter-section-label">Status</span>
        <div class="filter-checkbox-group">
          <label class="filter-checkbox filter-all-option">
            ${getPortalCheckboxHTML({
    value: 'all',
    checked: allChecked,
    ariaLabel: 'Show all statuses'
  })}
            <span>All</span>
          </label>
          ${config.statusOptions.map(opt => `
            <label class="filter-checkbox">
              ${getPortalCheckboxHTML({
    value: opt.value,
    checked: state.statusFilters.includes(opt.value),
    ariaLabel: `Filter by ${opt.label}`
  })}
              <span>${opt.label}</span>
            </label>
          `).join('')}
        </div>
      </div>` : '';

  dropdownWrapper.innerHTML = `
    <button type="button" class="filter-dropdown-trigger icon-btn" title="Filters" aria-label="Filters">
      ${ICONS.FILTER}
      <span class="filter-count-badge ${activeCount > 0 ? 'visible' : ''}">${activeCount}</span>
    </button>
    <div class="filter-dropdown-menu">
      ${statusSectionHTML}
      <div class="filter-section">
        <span class="filter-section-label">Date Range</span>
        <div class="filter-date-group">
          <input type="date" class="filter-date-input" data-filter="start" value="${state.dateStart}" />
          <span class="filter-date-separator">to</span>
          <input type="date" class="filter-date-input" data-filter="end" value="${state.dateEnd}" />
        </div>
      </div>
      <button type="button" class="filter-clear-btn" aria-label="Clear all filters">Clear All</button>
    </div>
  `;

  // Toggle dropdown
  const trigger = dropdownWrapper.querySelector('.filter-dropdown-trigger') as HTMLButtonElement;
  const menu = dropdownWrapper.querySelector('.filter-dropdown-menu') as HTMLElement;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownWrapper.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!dropdownWrapper.contains(e.target as Node)) {
      dropdownWrapper.classList.remove('open');
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdownWrapper.classList.remove('open');
    }
  });

  // Status checkboxes - handle "All" option specially
  const allCheckbox = menu.querySelector('input[type="checkbox"][value="all"]') as HTMLInputElement;
  const statusCheckboxes = menu.querySelectorAll('input[type="checkbox"]:not([value="all"])');

  // "All" checkbox clears all status filters
  if (allCheckbox) {
    allCheckbox.addEventListener('change', () => {
      if (allCheckbox.checked) {
        // Uncheck all status checkboxes
        statusCheckboxes.forEach(cb => {
          (cb as HTMLInputElement).checked = false;
        });
        const newState = { ...state, statusFilters: [] };
        saveFilterState(config.storageKey, newState);
        updateFilterBadge(dropdownWrapper, newState);
        onStateChange(newState);
      }
    });
  }

  // Status checkboxes - uncheck "All" when any status is checked
  statusCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const checked = Array.from(statusCheckboxes)
        .filter((cb): cb is HTMLInputElement => (cb as HTMLInputElement).checked)
        .map(cb => cb.value);

      // Uncheck "All" if any status is selected
      if (allCheckbox && checked.length > 0) {
        allCheckbox.checked = false;
      }
      // Check "All" if no status is selected
      if (allCheckbox && checked.length === 0) {
        allCheckbox.checked = true;
      }

      const newState = { ...state, statusFilters: checked };
      saveFilterState(config.storageKey, newState);
      updateFilterBadge(dropdownWrapper, newState);
      onStateChange(newState);
    });
  });

  // Date inputs
  const dateStart = menu.querySelector('[data-filter="start"]') as HTMLInputElement;
  const dateEnd = menu.querySelector('[data-filter="end"]') as HTMLInputElement;

  dateStart.addEventListener('change', () => {
    const newState = { ...state, dateStart: dateStart.value };
    saveFilterState(config.storageKey, newState);
    updateFilterBadge(dropdownWrapper, newState);
    onStateChange(newState);
  });

  dateEnd.addEventListener('change', () => {
    const newState = { ...state, dateEnd: dateEnd.value };
    saveFilterState(config.storageKey, newState);
    updateFilterBadge(dropdownWrapper, newState);
    onStateChange(newState);
  });

  // Clear all button
  const clearBtn = menu.querySelector('.filter-clear-btn') as HTMLButtonElement;
  clearBtn.addEventListener('click', () => {
    // Reset UI
    searchInput.value = '';
    statusCheckboxes.forEach(cb => {
      (cb as HTMLInputElement).checked = false;
    });
    if (allCheckbox) allCheckbox.checked = true;
    dateStart.value = '';
    dateEnd.value = '';

    // Reset state
    const newState = getDefaultFilterState();
    saveFilterState(config.storageKey, newState);
    updateFilterBadge(dropdownWrapper, newState);
    dropdownWrapper.classList.remove('open');
    onStateChange(newState);
  });

  container.appendChild(dropdownWrapper);

  return container;
}

/**
 * Update the status options in an existing filter UI
 * Use this to dynamically populate options (e.g., categories loaded from API)
 */
export function updateFilterStatusOptions(
  filterContainer: HTMLElement,
  options: StatusOption[],
  label: string = 'Status',
  state: FilterState,
  config: TableFilterConfig,
  onStateChange: (newState: FilterState) => void
): void {
  const menu = filterContainer.querySelector('.filter-dropdown-menu');
  if (!menu) return;

  // Find or create status section
  const statusSection = menu.querySelector('.filter-section:first-child');

  if (options.length === 0) {
    // Remove status section if no options
    if (statusSection) {
      const sectionLabel = statusSection.querySelector('.filter-section-label');
      if (sectionLabel && sectionLabel.textContent !== 'Date Range') {
        statusSection.remove();
      }
    }
    return;
  }

  // Build new status section HTML
  const allChecked = state.statusFilters.length === 0;
  const statusHTML = `
    <div class="filter-section">
      <span class="filter-section-label">${label}</span>
      <div class="filter-checkbox-group">
        <label class="filter-checkbox filter-all-option">
          ${getPortalCheckboxHTML({
    value: 'all',
    checked: allChecked,
    ariaLabel: `Show all ${label.toLowerCase()}`
  })}
          <span>All</span>
        </label>
        ${options.map(opt => `
          <label class="filter-checkbox">
            ${getPortalCheckboxHTML({
    value: opt.value,
    checked: state.statusFilters.includes(opt.value),
    ariaLabel: `Filter by ${opt.label}`
  })}
            <span>${opt.label}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;

  // Replace or insert status section
  const dateSection = menu.querySelector('.filter-section:has(.filter-date-group)');
  if (statusSection && statusSection !== dateSection) {
    statusSection.outerHTML = statusHTML;
  } else if (dateSection) {
    dateSection.insertAdjacentHTML('beforebegin', statusHTML);
  }

  // Re-attach event listeners
  const newStatusSection = menu.querySelector('.filter-section:first-child');
  if (!newStatusSection) return;

  const allCheckbox = newStatusSection.querySelector('input[type="checkbox"][value="all"]') as HTMLInputElement;
  const statusCheckboxes = newStatusSection.querySelectorAll('input[type="checkbox"]:not([value="all"])');
  const dropdownWrapper = filterContainer.querySelector('.filter-dropdown-wrapper') as HTMLElement;

  if (allCheckbox) {
    allCheckbox.addEventListener('change', () => {
      if (allCheckbox.checked) {
        statusCheckboxes.forEach(cb => {
          (cb as HTMLInputElement).checked = false;
        });
        const newState = { ...state, statusFilters: [] };
        saveFilterState(config.storageKey, newState);
        updateFilterBadge(dropdownWrapper, newState);
        onStateChange(newState);
      }
    });
  }

  statusCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const checked = Array.from(statusCheckboxes)
        .filter((cb): cb is HTMLInputElement => (cb as HTMLInputElement).checked)
        .map(cb => cb.value);

      if (allCheckbox && checked.length > 0) {
        allCheckbox.checked = false;
      }
      if (allCheckbox && checked.length === 0) {
        allCheckbox.checked = true;
      }

      const newState = { ...state, statusFilters: checked };
      saveFilterState(config.storageKey, newState);
      updateFilterBadge(dropdownWrapper, newState);
      onStateChange(newState);
    });
  });
}

function countActiveFilters(state: FilterState): number {
  let count = 0;
  if (state.statusFilters.length > 0) count += state.statusFilters.length;
  if (state.dateStart) count++;
  if (state.dateEnd) count++;
  return count;
}

function updateFilterBadge(wrapper: HTMLElement, state: FilterState): void {
  const badge = wrapper.querySelector('.filter-count-badge');
  if (badge) {
    const count = countActiveFilters(state);
    badge.textContent = String(count);
    badge.classList.toggle('visible', count > 0);
  }
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===============================================
// SORTABLE HEADERS
// ===============================================

export function createSortableHeaders(
  config: TableFilterConfig,
  state: FilterState,
  onSort: (column: string, direction: 'asc' | 'desc') => void
): void {
  const tableId = `${config.tableId}-table`;
  const table = document.querySelector(`.${tableId}`) || document.querySelector(`#${config.tableId}-table-body`)?.closest('table');
  if (!table) return;

  const thead = table.querySelector('thead');
  if (!thead) return;

  // Store current sort state on the thead element so click handlers can read fresh values
  thead.dataset.sortColumn = state.sortColumn || '';
  thead.dataset.sortDirection = state.sortDirection || 'desc';

  const headerCells = thead.querySelectorAll('th');

  headerCells.forEach((th, _index) => {
    const column = config.sortableColumns.find(col => {
      // Match by index or by existing data-sort attribute
      return th.dataset.sort === col.key || th.textContent?.trim().toLowerCase() === col.label.toLowerCase();
    });

    if (column) {
      th.classList.add('sortable');
      th.dataset.sort = column.key;

      // Add sort icon if not present
      if (!th.querySelector('.sort-icon')) {
        const icon = document.createElement('span');
        icon.className = 'sort-icon';
        icon.innerHTML = getSortIcon(column.key, state);
        th.appendChild(icon);
      }

      // Click handler - reads fresh state from DOM data attributes
      th.addEventListener('click', () => {
        // Read current state from DOM, not from closure
        const currentSortColumn = thead.dataset.sortColumn || '';
        const currentSortDirection = thead.dataset.sortDirection as 'asc' | 'desc' || 'desc';

        const currentDirection = currentSortColumn === column.key ? currentSortDirection : 'desc';
        const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

        // Update DOM state
        thead.dataset.sortColumn = column.key;
        thead.dataset.sortDirection = newDirection;

        // Update icons on all headers
        const freshState: FilterState = {
          searchTerm: '',
          statusFilters: [],
          dateStart: '',
          dateEnd: '',
          sortColumn: column.key,
          sortDirection: newDirection
        };

        headerCells.forEach(cell => {
          const sortIcon = cell.querySelector('.sort-icon');
          if (sortIcon) {
            sortIcon.innerHTML = getSortIcon(cell.dataset.sort || '', freshState);
          }
        });

        onSort(column.key, newDirection);
      });
    }
  });
}

function getSortIcon(columnKey: string, state: FilterState): string {
  if (state.sortColumn !== columnKey) {
    return ICONS.SORT_NEUTRAL;
  }
  if (state.sortDirection === 'asc') {
    return ICONS.SORT_ASC;
  }
  return ICONS.SORT_DESC;
}

// ===============================================
// FILTER APPLICATION
// ===============================================

/**
 * Apply filters, search, and sorting to an array of data
 * Works with any object type that has the fields specified in config
 */
export function applyFilters<T>(
  data: T[],
  state: FilterState,
  config: TableFilterConfig
): T[] {
  let filtered = [...data];

  // 1. Search filter
  if (state.searchTerm.trim()) {
    const searchLower = state.searchTerm.toLowerCase().trim();
    filtered = filtered.filter(item => {
      return config.searchFields.some(field => {
        const value = getNestedValue(item as object, field);
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchLower);
      });
    });
  }

  // 2. Status filter
  if (state.statusFilters.length > 0) {
    filtered = filtered.filter(item => {
      const status = getNestedValue(item as object, config.statusField);
      if (status === null || status === undefined) return false;
      // Normalize to hyphens (database format)
      const normalizedStatus = String(status).toLowerCase().replace(/_/g, '-');
      return state.statusFilters.some(f => normalizedStatus === f.toLowerCase().replace(/_/g, '-'));
    });
  }

  // 3. Date range filter
  if (state.dateStart || state.dateEnd) {
    filtered = filtered.filter(item => {
      const dateValue = getNestedValue(item as object, config.dateField);
      if (!dateValue) return false;

      const itemDate = new Date(String(dateValue));
      if (isNaN(itemDate.getTime())) return false;

      if (state.dateStart) {
        const startDate = new Date(state.dateStart);
        startDate.setHours(0, 0, 0, 0);
        if (itemDate < startDate) return false;
      }

      if (state.dateEnd) {
        const endDate = new Date(state.dateEnd);
        endDate.setHours(23, 59, 59, 999);
        if (itemDate > endDate) return false;
      }

      return true;
    });
  }

  // 4. Sorting
  if (state.sortColumn) {
    const column = config.sortableColumns.find(c => c.key === state.sortColumn);
    if (column) {
      // Build status priority map from statusOptions if sorting by status field
      const statusPriority: Record<string, number> = {};
      if (column.key === config.statusField && config.statusOptions) {
        config.statusOptions.forEach((opt, idx) => {
          statusPriority[opt.value.toLowerCase().replace(/_/g, '-')] = idx;
        });
      }

      filtered.sort((a, b) => {
        const aVal = getNestedValue(a as object, column.key);
        const bVal = getNestedValue(b as object, column.key);

        let comparison = 0;

        if (column.type === 'date') {
          const aDate = aVal ? new Date(String(aVal)).getTime() : 0;
          const bDate = bVal ? new Date(String(bVal)).getTime() : 0;
          comparison = aDate - bDate;
        } else if (column.type === 'number') {
          const aNum = aVal ? parseFloat(String(aVal).replace(/[^0-9.-]/g, '')) : 0;
          const bNum = bVal ? parseFloat(String(bVal).replace(/[^0-9.-]/g, '')) : 0;
          comparison = aNum - bNum;
        } else if (column.key === config.statusField && Object.keys(statusPriority).length > 0) {
          // Use status priority order from statusOptions
          const aStatus = aVal ? String(aVal).toLowerCase().replace(/_/g, '-') : '';
          const bStatus = bVal ? String(bVal).toLowerCase().replace(/_/g, '-') : '';
          const aPriority = statusPriority[aStatus] ?? 999;
          const bPriority = statusPriority[bStatus] ?? 999;
          comparison = aPriority - bPriority;
        } else {
          const aStr = aVal ? String(aVal).toLowerCase() : '';
          const bStr = bVal ? String(bVal).toLowerCase() : '';
          comparison = aStr.localeCompare(bStr);
        }

        return state.sortDirection === 'asc' ? comparison : -comparison;
      });
    }
  }

  // 5. Always push archived items to the bottom (secondary sort)
  if (config.statusField) {
    filtered.sort((a, b) => {
      const aStatus = getNestedValue(a as object, config.statusField!) as string;
      const bStatus = getNestedValue(b as object, config.statusField!) as string;
      const aArchived = aStatus === 'archived';
      const bArchived = bStatus === 'archived';

      // If both are archived or both are not, maintain current order
      if (aArchived === bArchived) return 0;
      // Archived items go to the bottom
      return aArchived ? 1 : -1;
    });
  }

  return filtered;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: object, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ===============================================
// FILTER CONFIGS FOR EACH TABLE
// ===============================================

export const LEADS_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'leads',
  searchFields: ['contact_name', 'email', 'company_name', 'project_type'],
  statusField: 'status',
  statusOptions: [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'converted', label: 'Converted' },
    { value: 'lost', label: 'Lost' },
    { value: 'on-hold', label: 'On Hold' },
    { value: 'cancelled', label: 'Cancelled' }
  ],
  dateField: 'created_at',
  sortableColumns: [
    { key: 'created_at', label: 'Date', type: 'date' },
    { key: 'contact_name', label: 'Lead', type: 'string' },
    { key: 'company_name', label: 'Company', type: 'string' },
    { key: 'project_type', label: 'Type', type: 'string' },
    { key: 'budget_range', label: 'Budget', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' }
  ],
  storageKey: 'admin_leads_filter'
};

export const CONTACTS_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'contacts',
  searchFields: ['name', 'email', 'company', 'message'],
  statusField: 'status',
  statusOptions: [
    { value: 'new', label: 'New' },
    { value: 'read', label: 'Read' },
    { value: 'responded', label: 'Responded' },
    { value: 'archived', label: 'Archived' }
  ],
  dateField: 'created_at',
  sortableColumns: [
    { key: 'created_at', label: 'Date', type: 'date' },
    { key: 'name', label: 'Contact', type: 'string' },
    { key: 'email', label: 'Email', type: 'string' },
    { key: 'company', label: 'Company', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' }
  ],
  storageKey: 'admin_contacts_filter'
};

export const PROJECTS_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'projects',
  searchFields: ['project_name', 'contact_name', 'email', 'project_type'],
  statusField: 'status',
  statusOptions: [
    { value: 'active', label: 'Active' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'on-hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ],
  dateField: 'created_at',
  sortableColumns: [
    { key: 'project_name', label: 'Project', type: 'string' },
    { key: 'contact_name', label: 'Client', type: 'string' },
    { key: 'project_type', label: 'Type', type: 'string' },
    { key: 'budget_range', label: 'Budget', type: 'string' },
    { key: 'timeline', label: 'Timeline', type: 'string' },
    { key: 'start_date', label: 'Start', type: 'date' },
    { key: 'end_date', label: 'End Date', type: 'date' },
    { key: 'status', label: 'Status', type: 'string' }
  ],
  storageKey: 'admin_projects_filter'
};

export const CLIENTS_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'clients',
  searchFields: ['name', 'email', 'company_name', 'contact_name'],
  statusField: 'status',
  statusOptions: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ],
  dateField: 'created_at',
  sortableColumns: [
    { key: 'name', label: 'Client', type: 'string' },
    { key: 'client_type', label: 'Type', type: 'string' },
    { key: 'email', label: 'Email', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'created_at', label: 'Created', type: 'date' }
  ],
  storageKey: 'admin_clients_filter'
};

export const DOCUMENT_REQUESTS_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'document-requests',
  searchFields: ['title', 'client_name', 'document_type', 'description'],
  statusField: 'status',
  statusOptions: [
    { value: 'requested', label: 'Requested' },
    { value: 'viewed', label: 'Viewed' },
    { value: 'uploaded', label: 'Uploaded' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }
  ],
  dateField: 'created_at',
  sortableColumns: [
    { key: 'title', label: 'Title', type: 'string' },
    { key: 'client_name', label: 'Client', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'due_date', label: 'Due', type: 'date' },
    { key: 'created_at', label: 'Created', type: 'date' }
  ],
  storageKey: 'admin_document_requests_filter'
};

export const KNOWLEDGE_BASE_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'kb-articles',
  searchFields: ['title', 'category_name', 'slug', 'summary'],
  // statusField uses category_name intentionally — KB filters by category, not status
  statusField: 'category_name',
  statusOptions: [], // Populated dynamically with categories
  // dateField uses updated_at intentionally — KB articles show "last updated" as primary date
  dateField: 'updated_at',
  sortableColumns: [
    { key: 'title', label: 'Title', type: 'string' },
    { key: 'category_name', label: 'Category', type: 'string' },
    { key: 'updated_at', label: 'Updated', type: 'date' }
  ],
  storageKey: 'admin_knowledge_base_filter'
};

export const INVOICES_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'invoices',
  searchFields: ['invoice_number', 'client_name', 'project_name'],
  statusField: 'status',
  statusOptions: [
    { value: 'draft', label: 'Draft' },
    { value: 'pending', label: 'Pending' },
    { value: 'sent', label: 'Sent' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' }
  ],
  dateField: 'due_date',
  sortableColumns: [
    { key: 'invoice_number', label: 'Invoice #', type: 'string' },
    { key: 'client_name', label: 'Client', type: 'string' },
    { key: 'project_name', label: 'Project', type: 'string' },
    { key: 'amount_total', label: 'Amount', type: 'number' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'due_date', label: 'Due Date', type: 'date' }
  ],
  storageKey: 'admin_invoices_filter'
};

export const PROPOSALS_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'proposals',
  // Uses camelCase fields intentionally — API returns camelCase for proposals
  searchFields: ['client.name', 'client.email', 'client.company', 'project.name'],
  statusField: 'status',
  statusOptions: [
    { value: 'pending', label: 'Pending' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'converted', label: 'Converted' }
  ],
  dateField: 'createdAt',
  sortableColumns: [
    { key: 'client.name', label: 'Client', type: 'string' },
    { key: 'project.name', label: 'Project', type: 'string' },
    { key: 'projectType', label: 'Type', type: 'string' },
    { key: 'selectedTier', label: 'Tier', type: 'string' },
    { key: 'finalPrice', label: 'Price', type: 'number' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'createdAt', label: 'Created', type: 'date' }
  ],
  storageKey: 'admin_proposals_filter'
};
