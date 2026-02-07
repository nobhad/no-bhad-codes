/**
 * ===============================================
 * TABLE BULK ACTIONS UTILITY
 * ===============================================
 * @file src/utils/table-bulk-actions.ts
 *
 * Bulk selection and actions for admin tables.
 * Provides row selection, bulk action toolbar, and action handlers.
 */

import { ICONS } from '../constants/icons';
import { getPortalCheckboxHTML } from '../components/portal-checkbox';

// ===============================================
// TYPES
// ===============================================

export interface BulkAction {
  id: string;
  label: string;
  icon?: string;
  variant?: 'default' | 'danger' | 'warning';
  handler: (selectedIds: number[], selectedValue?: string) => Promise<void> | void;
  /** Optional confirmation message. If provided, shows confirm dialog before action */
  confirmMessage?: string;
  /** If provided, renders a dropdown with these options instead of a button */
  dropdownOptions?: { value: string; label: string }[];
}

export interface BulkActionConfig {
  tableId: string;
  actions: BulkAction[];
  onSelectionChange?: (selectedIds: number[]) => void;
}

export interface BulkSelectionState {
  selectedIds: Set<number>;
  allSelected: boolean;
}

// ===============================================
// STATE MANAGEMENT
// ===============================================

const selectionStates = new Map<string, BulkSelectionState>();

/**
 * Get or create selection state for a table
 */
export function getSelectionState(tableId: string): BulkSelectionState {
  if (!selectionStates.has(tableId)) {
    selectionStates.set(tableId, {
      selectedIds: new Set(),
      allSelected: false
    });
  }
  return selectionStates.get(tableId)!;
}

/**
 * Reset selection state for a table
 */
export function resetSelection(tableId: string): void {
  const state = getSelectionState(tableId);
  state.selectedIds.clear();
  state.allSelected = false;

  // Update UI
  const headerCheckbox = document.querySelector(`#${tableId}-select-all`) as HTMLInputElement;
  if (headerCheckbox) {
    headerCheckbox.checked = false;
    headerCheckbox.indeterminate = false;
  }

  const rowCheckboxes = document.querySelectorAll(`.${tableId}-row-select`) as NodeListOf<HTMLInputElement>;
  rowCheckboxes.forEach(cb => cb.checked = false);

  // Hide toolbar
  const toolbar = document.getElementById(`${tableId}-bulk-toolbar`);
  if (toolbar) {
    toolbar.classList.add('hidden');
  }
}

/**
 * Get selected IDs array
 */
export function getSelectedIds(tableId: string): number[] {
  return Array.from(getSelectionState(tableId).selectedIds);
}

// ===============================================
// UI CREATION
// ===============================================

/**
 * Create bulk action toolbar
 */
export function createBulkActionToolbar(config: BulkActionConfig): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'bulk-action-toolbar hidden';
  toolbar.id = `${config.tableId}-bulk-toolbar`;

  // Separate dropdown actions from button actions
  const buttonActions = config.actions.filter(a => !a.dropdownOptions);
  const dropdownActions = config.actions.filter(a => a.dropdownOptions);

  toolbar.innerHTML = `
    <div class="bulk-toolbar-left">
      <span class="bulk-selection-count">
        <strong id="${config.tableId}-selected-count">0</strong> selected
      </span>
      <button type="button" class="btn-link bulk-clear-selection" aria-label="Clear selection">
        Clear
      </button>
    </div>
    <div class="bulk-toolbar-actions">
      ${buttonActions.map(action => `
        <button type="button"
          class="icon-btn bulk-action-icon-btn ${action.variant === 'danger' ? 'icon-btn-danger' : action.variant === 'warning' ? 'icon-btn-warning' : ''}"
          data-action="${action.id}"
          title="${action.label}"
          aria-label="${action.label}">
          ${action.icon || ''}
        </button>
      `).join('')}
      ${dropdownActions.map(action => `
        <div class="bulk-action-dropdown" data-action="${action.id}"></div>
      `).join('')}
    </div>
  `;

  // Clear selection handler
  const clearBtn = toolbar.querySelector('.bulk-clear-selection');
  clearBtn?.addEventListener('click', () => {
    resetSelection(config.tableId);
    config.onSelectionChange?.([]);
  });

  // Button action handlers
  buttonActions.forEach(action => {
    const btn = toolbar.querySelector(`button[data-action="${action.id}"]`);
    btn?.addEventListener('click', async () => {
      const selectedIds = getSelectedIds(config.tableId);
      if (selectedIds.length === 0) return;

      if (action.confirmMessage) {
        const confirmed = await showBulkConfirm(action.confirmMessage, selectedIds.length);
        if (!confirmed) return;
      }

      try {
        await action.handler(selectedIds);
        resetSelection(config.tableId);
        config.onSelectionChange?.([]);
      } catch (error) {
        console.error(`[BulkActions] Action ${action.id} failed:`, error);
      }
    });
  });

  // Dropdown action handlers
  dropdownActions.forEach(action => {
    const container = toolbar.querySelector(`div[data-action="${action.id}"]`);
    if (container && action.dropdownOptions) {
      const dropdown = createBulkActionDropdown({
        options: action.dropdownOptions,
        icon: action.icon || '',
        label: action.label,
        onSelect: async (value) => {
          const selectedIds = getSelectedIds(config.tableId);
          if (selectedIds.length === 0) return;

          try {
            await action.handler(selectedIds, value);
            resetSelection(config.tableId);
            config.onSelectionChange?.([]);
          } catch (error) {
            console.error(`[BulkActions] Action ${action.id} failed:`, error);
          }
        }
      });
      container.appendChild(dropdown);
    }
  });

  return toolbar;
}

/**
 * Create a dropdown for bulk actions (e.g., status update)
 */
function createBulkActionDropdown(config: {
  options: { value: string; label: string }[];
  icon: string;
  label: string;
  onSelect: (value: string) => void;
}): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'bulk-dropdown table-dropdown custom-dropdown';

  // Trigger button (icon only)
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'icon-btn bulk-action-icon-btn bulk-dropdown-trigger';
  trigger.setAttribute('aria-label', config.label);
  trigger.setAttribute('title', config.label);
  trigger.innerHTML = config.icon;

  // Dropdown menu
  const menu = document.createElement('ul');
  menu.className = 'custom-dropdown-menu bulk-dropdown-menu';

  config.options.forEach(opt => {
    const li = document.createElement('li');
    li.className = 'custom-dropdown-item';
    li.dataset.value = opt.value;
    li.dataset.status = opt.value;

    const dot = document.createElement('span');
    dot.className = 'status-dot';
    li.appendChild(dot);

    const text = document.createElement('span');
    text.className = 'dropdown-item-name';
    text.textContent = opt.label;
    li.appendChild(text);

    li.addEventListener('click', (e) => {
      e.stopPropagation();
      wrapper.classList.remove('open');
      config.onSelect(opt.value);
    });

    menu.appendChild(li);
  });

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  // Toggle on click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();

    // Close other dropdowns
    document.querySelectorAll('.bulk-dropdown.open').forEach(el => {
      if (el !== wrapper) el.classList.remove('open');
    });

    wrapper.classList.toggle('open');
  });

  // Close on outside click
  const closeHandler = (e: MouseEvent) => {
    if (!wrapper.contains(e.target as Node)) {
      wrapper.classList.remove('open');
    }
  };
  document.addEventListener('click', closeHandler);

  return wrapper;
}

/**
 * Create header checkbox for select all
 */
export function createHeaderCheckbox(tableId: string): string {
  return `
    <th class="bulk-select-cell" style="width: 40px;">
      ${getPortalCheckboxHTML({
    id: `${tableId}-select-all`,
    ariaLabel: 'Select all rows',
    inputClassName: 'bulk-select-all'
  })}
    </th>
  `;
}

/**
 * Create row checkbox for individual selection
 */
export function createRowCheckbox(tableId: string, rowId: number): string {
  const state = getSelectionState(tableId);
  const isSelected = state.selectedIds.has(rowId);

  return `
    <td class="bulk-select-cell">
      ${getPortalCheckboxHTML({
    ariaLabel: 'Select row',
    checked: isSelected,
    inputClassName: `${tableId}-row-select`,
    dataAttributes: { rowId }
  })}
    </td>
  `;
}

// ===============================================
// EVENT HANDLERS
// ===============================================

/**
 * Setup bulk selection event handlers for a table
 */
export function setupBulkSelectionHandlers(
  config: BulkActionConfig,
  allRowIds: number[]
): void {
  const { tableId, onSelectionChange } = config;
  const state = getSelectionState(tableId);

  // Header "select all" checkbox
  const headerCheckbox = document.querySelector(`#${tableId}-select-all`) as HTMLInputElement;
  if (headerCheckbox) {
    headerCheckbox.addEventListener('change', () => {
      const isChecked = headerCheckbox.checked;

      if (isChecked) {
        // Select all visible rows
        allRowIds.forEach(id => state.selectedIds.add(id));
        state.allSelected = true;
      } else {
        // Deselect all
        state.selectedIds.clear();
        state.allSelected = false;
      }

      // Update row checkboxes
      const rowCheckboxes = document.querySelectorAll(`.${tableId}-row-select`) as NodeListOf<HTMLInputElement>;
      rowCheckboxes.forEach(cb => cb.checked = isChecked);

      // Update toolbar
      updateToolbarVisibility(tableId, state.selectedIds.size);

      onSelectionChange?.(Array.from(state.selectedIds));
    });
  }

  // Individual row checkboxes
  const rowCheckboxes = document.querySelectorAll(`.${tableId}-row-select`) as NodeListOf<HTMLInputElement>;
  rowCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const rowId = parseInt(checkbox.dataset.rowId || '0');
      if (!rowId) return;

      if (checkbox.checked) {
        state.selectedIds.add(rowId);
      } else {
        state.selectedIds.delete(rowId);
        state.allSelected = false;
      }

      // Update header checkbox state
      updateHeaderCheckbox(tableId, allRowIds.length);

      // Update toolbar
      updateToolbarVisibility(tableId, state.selectedIds.size);

      onSelectionChange?.(Array.from(state.selectedIds));
    });
  });
}

/**
 * Update header checkbox based on selection state
 */
function updateHeaderCheckbox(tableId: string, totalRows: number): void {
  const state = getSelectionState(tableId);
  const headerCheckbox = document.querySelector(`#${tableId}-select-all`) as HTMLInputElement;

  if (!headerCheckbox) return;

  const selectedCount = state.selectedIds.size;

  if (selectedCount === 0) {
    headerCheckbox.checked = false;
    headerCheckbox.indeterminate = false;
  } else if (selectedCount === totalRows) {
    headerCheckbox.checked = true;
    headerCheckbox.indeterminate = false;
    state.allSelected = true;
  } else {
    headerCheckbox.checked = false;
    headerCheckbox.indeterminate = true;
  }
}

/**
 * Update toolbar visibility and selection count
 */
function updateToolbarVisibility(tableId: string, selectedCount: number): void {
  const toolbar = document.getElementById(`${tableId}-bulk-toolbar`);
  const countEl = document.getElementById(`${tableId}-selected-count`);

  if (toolbar) {
    if (selectedCount > 0) {
      toolbar.classList.remove('hidden');
    } else {
      toolbar.classList.add('hidden');
    }
  }

  if (countEl) {
    countEl.textContent = selectedCount.toString();
  }
}

// ===============================================
// HELPER FUNCTIONS
// ===============================================

/**
 * Show confirmation dialog for bulk action
 */
async function showBulkConfirm(message: string, count: number): Promise<boolean> {
  // Try to use the confirmDanger from confirm-dialog if available
  try {
    const { confirmDanger } = await import('./confirm-dialog');
    return confirmDanger(
      message.replace('{count}', count.toString()),
      'Confirm Bulk Action'
    );
  } catch {
    // Fallback to native confirm
    return window.confirm(message.replace('{count}', count.toString()));
  }
}

// ===============================================
// PRE-CONFIGURED BULK ACTIONS
// ===============================================

/**
 * Common bulk action: Archive selected items
 */
export function createArchiveAction(
  apiEndpoint: string,
  onSuccess?: () => void
): BulkAction {
  return {
    id: 'archive',
    label: 'Archive',
    icon: ICONS.ARCHIVE,
    variant: 'warning',
    confirmMessage: 'Archive {count} selected items? They can be restored later.',
    handler: async (selectedIds) => {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: selectedIds })
      });

      if (!response.ok) {
        throw new Error('Failed to archive items');
      }

      onSuccess?.();
    }
  };
}

/**
 * Common bulk action: Delete selected items
 */
export function createDeleteAction(
  apiEndpoint: string,
  onSuccess?: () => void
): BulkAction {
  return {
    id: 'delete',
    label: 'Delete',
    icon: ICONS.TRASH,
    variant: 'danger',
    confirmMessage: 'Permanently delete {count} selected items? This cannot be undone.',
    handler: async (selectedIds) => {
      const response = await fetch(apiEndpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: selectedIds })
      });

      if (!response.ok) {
        throw new Error('Failed to delete items');
      }

      onSuccess?.();
    }
  };
}

/**
 * Common bulk action: Update status of selected items
 */
export function createStatusUpdateAction(
  label: string,
  status: string,
  apiEndpoint: string,
  onSuccess?: () => void
): BulkAction {
  return {
    id: `status-${status}`,
    label,
    variant: 'default',
    handler: async (selectedIds) => {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: selectedIds, status })
      });

      if (!response.ok) {
        throw new Error(`Failed to update status to ${status}`);
      }

      onSuccess?.();
    }
  };
}
