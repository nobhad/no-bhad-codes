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
    <div class="filter-search-dropdown">
      <span class="filter-search-icon">
        ${ICONS.SEARCH_SMALL}
      </span>
      <input type="text" placeholder="Search..." class="filter-search-input" value="${escapeAttr(state.searchTerm)}" />
      <button type="button" class="filter-search-clear" title="Clear search" aria-label="Clear search">
        ${ICONS.X_SMALL}
      </button>
    </div>
  `;

  const searchTrigger = searchWrapper.querySelector('.filter-search-trigger') as HTMLButtonElement;
  const _searchDropdown = searchWrapper.querySelector('.filter-search-dropdown') as HTMLElement;
  const searchInput = searchWrapper.querySelector('input') as HTMLInputElement;
  const searchClear = searchWrapper.querySelector('.filter-search-clear') as HTMLButtonElement;

  // Toggle search dropdown
  searchTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    searchWrapper.classList.toggle('open');
    if (searchWrapper.classList.contains('open')) {
      searchInput.focus();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!searchWrapper.contains(e.target as Node)) {
      searchWrapper.classList.remove('open');
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
    }
  });

  container.appendChild(searchWrapper);

  // Filter dropdown
  const dropdownWrapper = document.createElement('div');
  dropdownWrapper.className = 'filter-dropdown-wrapper';

  const activeCount = countActiveFilters(state);
  dropdownWrapper.innerHTML = `
    <button type="button" class="filter-dropdown-trigger icon-btn" title="Filters" aria-label="Filters">
      ${ICONS.FILTER}
      <span class="filter-count-badge ${activeCount > 0 ? 'visible' : ''}">${activeCount}</span>
    </button>
    <div class="filter-dropdown-menu">
      <div class="filter-section">
        <span class="filter-section-label">Status</span>
        <div class="filter-checkbox-group">
          ${config.statusOptions.map(opt => `
            <label class="filter-checkbox">
              <div class="portal-checkbox">
                <input type="checkbox" value="${opt.value}" ${state.statusFilters.includes(opt.value) ? 'checked' : ''} />
              </div>
              <span>${opt.label}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="filter-section">
        <span class="filter-section-label">Date Range</span>
        <div class="filter-date-group">
          <input type="date" class="filter-date-input" data-filter="start" value="${state.dateStart}" />
          <span class="filter-date-separator">to</span>
          <input type="date" class="filter-date-input" data-filter="end" value="${state.dateEnd}" />
        </div>
      </div>
      <button type="button" class="filter-clear-btn">Clear All</button>
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

  // Status checkboxes
  const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const checked = Array.from(checkboxes)
        .filter((cb): cb is HTMLInputElement => (cb as HTMLInputElement).checked)
        .map(cb => cb.value);
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
    checkboxes.forEach(cb => {
      (cb as HTMLInputElement).checked = false;
    });
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

      // Click handler
      th.addEventListener('click', () => {
        const currentDirection = state.sortColumn === column.key ? state.sortDirection : 'desc';
        const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

        // Update icons on all headers
        headerCells.forEach(cell => {
          const sortIcon = cell.querySelector('.sort-icon');
          if (sortIcon) {
            sortIcon.innerHTML = getSortIcon(cell.dataset.sort || '', {
              ...state,
              sortColumn: column.key,
              sortDirection: newDirection
            });
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
      const normalizedStatus = String(status).toLowerCase().replace(/-/g, '_');
      return state.statusFilters.some(f => normalizedStatus === f.toLowerCase());
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
        } else {
          const aStr = aVal ? String(aVal).toLowerCase() : '';
          const bStr = bVal ? String(bVal).toLowerCase() : '';
          comparison = aStr.localeCompare(bStr);
        }

        return state.sortDirection === 'asc' ? comparison : -comparison;
      });
    }
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
    { value: 'pending', label: 'Pending' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'active', label: 'Active' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'converted', label: 'Converted' },
    { value: 'completed', label: 'Completed' },
    { value: 'lost', label: 'Lost' }
  ],
  dateField: 'created_at',
  sortableColumns: [
    { key: 'created_at', label: 'Date', type: 'date' },
    { key: 'contact_name', label: 'Contact', type: 'string' },
    { key: 'company_name', label: 'Company', type: 'string' },
    { key: 'project_type', label: 'Project Type', type: 'string' },
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
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'email', label: 'Email', type: 'string' },
    { key: 'company', label: 'Company', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' }
  ],
  storageKey: 'admin_contacts_filter'
};

export const PROJECTS_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'projects',
  searchFields: ['name', 'client_name', 'project_type'],
  statusField: 'status',
  statusOptions: [
    { value: 'active', label: 'Active' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ],
  dateField: 'created_at',
  sortableColumns: [
    { key: 'name', label: 'Project', type: 'string' },
    { key: 'client_name', label: 'Client', type: 'string' },
    { key: 'project_type', label: 'Type', type: 'string' },
    { key: 'budget', label: 'Budget', type: 'number' },
    { key: 'status', label: 'Status', type: 'string' }
  ],
  storageKey: 'admin_projects_filter'
};

export const CLIENTS_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'clients',
  searchFields: ['name', 'email', 'company_name'],
  statusField: 'status',
  statusOptions: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ],
  dateField: 'created_at',
  sortableColumns: [
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'client_type', label: 'Type', type: 'string' },
    { key: 'email', label: 'Email', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'created_at', label: 'Created', type: 'date' }
  ],
  storageKey: 'admin_clients_filter'
};
