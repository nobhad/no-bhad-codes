/**
 * ===============================================
 * TABLE KEYBOARD NAVIGATION
 * ===============================================
 * @file src/components/table-keyboard-nav.ts
 *
 * Linear-style keyboard navigation for tables.
 * J/K to move up/down, Enter to open, X/Space to select.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TableKeyboardNavConfig {
  /** The table element to enable navigation on */
  tableSelector: string;
  /** Row selector (default: 'tbody tr') */
  rowSelector?: string;
  /** Callback when a row is selected (Enter pressed) */
  onRowSelect?: (row: HTMLTableRowElement, index: number) => void;
  /** Callback when row focus changes */
  onRowFocus?: (row: HTMLTableRowElement, index: number) => void;
  /** Callback when row is toggled (X or Space pressed) */
  onRowToggle?: (row: HTMLTableRowElement, index: number, selected: boolean) => void;
  /** Class to add to focused row */
  focusClass?: string;
  /** Class to add to selected rows */
  selectedClass?: string;
}

interface TableNavInstance {
  destroy: () => void;
  focusRow: (index: number) => void;
  getFocusedIndex: () => number;
  getSelectedRows: () => HTMLTableRowElement[];
}

// ============================================================================
// STATE
// ============================================================================

const instances = new Map<string, TableNavInstance>();

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Initialize keyboard navigation for a table
 */
export function initTableKeyboardNav(config: TableKeyboardNavConfig): TableNavInstance | null {
  const {
    tableSelector,
    rowSelector = 'tbody tr',
    onRowSelect,
    onRowFocus,
    onRowToggle,
    focusClass = 'row-focused',
    selectedClass = 'row-selected'
  } = config;

  const table = document.querySelector(tableSelector) as HTMLTableElement | null;
  if (!table) return null;

  // Clean up existing instance
  if (instances.has(tableSelector)) {
    instances.get(tableSelector)?.destroy();
  }

  let focusedIndex = -1;
  const selectedIndices = new Set<number>();

  function getRows(): HTMLTableRowElement[] {
    return Array.from(table!.querySelectorAll(rowSelector)) as HTMLTableRowElement[];
  }

  function updateFocus(newIndex: number): void {
    const rows = getRows();
    if (rows.length === 0) return;

    // Clamp index
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= rows.length) newIndex = rows.length - 1;

    // Remove focus from current row
    if (focusedIndex >= 0 && focusedIndex < rows.length) {
      rows[focusedIndex].classList.remove(focusClass);
      rows[focusedIndex].removeAttribute('data-focused');
    }

    // Add focus to new row
    focusedIndex = newIndex;
    const row = rows[focusedIndex];
    row.classList.add(focusClass);
    row.setAttribute('data-focused', 'true');

    // Scroll into view
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    // Callback
    onRowFocus?.(row, focusedIndex);
  }

  function toggleSelection(index: number): void {
    const rows = getRows();
    if (index < 0 || index >= rows.length) return;

    const row = rows[index];
    const isSelected = selectedIndices.has(index);

    if (isSelected) {
      selectedIndices.delete(index);
      row.classList.remove(selectedClass);
      row.removeAttribute('data-selected');
    } else {
      selectedIndices.add(index);
      row.classList.add(selectedClass);
      row.setAttribute('data-selected', 'true');
    }

    onRowToggle?.(row, index, !isSelected);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    // Don't handle if user is typing in an input
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    // Don't handle if any modifier keys are pressed
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const rows = getRows();
    if (rows.length === 0) return;

    switch (e.key.toLowerCase()) {
    case 'j':
    case 'arrowdown':
      e.preventDefault();
      if (focusedIndex === -1) {
        updateFocus(0);
      } else {
        updateFocus(focusedIndex + 1);
      }
      break;

    case 'k':
    case 'arrowup':
      e.preventDefault();
      if (focusedIndex === -1) {
        updateFocus(rows.length - 1);
      } else {
        updateFocus(focusedIndex - 1);
      }
      break;

    case 'enter':
      if (focusedIndex >= 0 && focusedIndex < rows.length) {
        e.preventDefault();
        onRowSelect?.(rows[focusedIndex], focusedIndex);
      }
      break;

    case 'x':
    case ' ':
      if (e.key === ' ') e.preventDefault(); // Prevent page scroll
      if (focusedIndex >= 0) {
        toggleSelection(focusedIndex);
      }
      break;

    case 'escape':
      // Clear focus
      if (focusedIndex >= 0 && focusedIndex < rows.length) {
        rows[focusedIndex].classList.remove(focusClass);
        rows[focusedIndex].removeAttribute('data-focused');
        focusedIndex = -1;
      }
      break;

    case 'g':
      // G goes to first row (like vim gg)
      e.preventDefault();
      updateFocus(0);
      break;
    }

    // Shift+G goes to last row (like vim G)
    if (e.key === 'G' && e.shiftKey) {
      e.preventDefault();
      updateFocus(rows.length - 1);
    }
  }

  // Handle click to focus
  function handleRowClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const row = target.closest(rowSelector) as HTMLTableRowElement | null;
    if (!row) return;

    const rows = getRows();
    const index = rows.indexOf(row);
    if (index >= 0) {
      updateFocus(index);
    }
  }

  // Attach listeners
  document.addEventListener('keydown', handleKeyDown);
  table.addEventListener('click', handleRowClick);

  const instance: TableNavInstance = {
    destroy: () => {
      document.removeEventListener('keydown', handleKeyDown);
      table.removeEventListener('click', handleRowClick);
      instances.delete(tableSelector);

      // Clean up classes
      const rows = getRows();
      rows.forEach(row => {
        row.classList.remove(focusClass, selectedClass);
        row.removeAttribute('data-focused');
        row.removeAttribute('data-selected');
      });
    },
    focusRow: (index: number) => updateFocus(index),
    getFocusedIndex: () => focusedIndex,
    getSelectedRows: () => {
      const rows = getRows();
      return Array.from(selectedIndices)
        .filter(i => i < rows.length)
        .map(i => rows[i]);
    }
  };

  instances.set(tableSelector, instance);
  return instance;
}

/**
 * Get an existing table nav instance
 */
export function getTableKeyboardNav(tableSelector: string): TableNavInstance | undefined {
  return instances.get(tableSelector);
}

/**
 * Destroy all table nav instances
 */
export function destroyAllTableKeyboardNav(): void {
  instances.forEach(instance => instance.destroy());
  instances.clear();
}
