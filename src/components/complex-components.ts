/**
 * ===============================================
 * COMPLEX COMPONENTS (REUSABLE)
 * ===============================================
 * @file src/components/complex-components.ts
 *
 * Complex reusable components: LineItemEditor, FileIcon, InlineEdit,
 * TableToolbar, DataTable.
 */

import { ICONS } from '../constants/icons';
import { cx } from '../utils/dom-utils';

// ===============================================
// TYPES
// ===============================================

export interface LineItem {
  /** Unique item ID */
  id: string;
  /** Description */
  description: string;
  /** Quantity */
  quantity: number;
  /** Rate/price per unit */
  rate: number;
  /** Calculated amount (quantity * rate) */
  amount: number;
}

export interface LineItemEditorConfig {
  /** Initial line items */
  items?: LineItem[];
  /** Currency symbol */
  currency?: string;
  /** Show drag handles for reordering */
  draggable?: boolean;
  /** Minimum items */
  minItems?: number;
  /** Maximum items */
  maxItems?: number;
  /** Additional class names */
  className?: string;
  /** Items change handler */
  onChange?: (items: LineItem[]) => void;
}

export interface FileIconConfig {
  /** File name or MIME type */
  fileType: string;
  /** Icon size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

export interface InlineEditConfig {
  /** Initial value */
  value: string;
  /** Input type */
  type?: 'text' | 'number' | 'email';
  /** Placeholder when empty */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** Save handler */
  onSave?: (value: string) => Promise<boolean> | boolean;
  /** Cancel handler */
  onCancel?: () => void;
  /** Validation function */
  validate?: (value: string) => string | null;
}

export interface TableColumn {
  /** Column key (matches data property) */
  key: string;
  /** Column header label */
  label: string;
  /** Sortable column */
  sortable?: boolean;
  /** Column width */
  width?: string;
  /** Cell renderer */
  render?: (value: unknown, row: Record<string, unknown>, index: number) => string | HTMLElement;
  /** Align */
  align?: 'left' | 'center' | 'right';
}

export interface TableToolbarConfig {
  /** Search configuration */
  search?: {
    placeholder?: string;
    value?: string;
    onSearch: (query: string) => void;
  };
  /** Filters */
  filters?: {
    id: string;
    label: string;
    options: { value: string; label: string }[];
    value?: string;
    onChange: (value: string) => void;
  }[];
  /** View toggle options */
  viewToggle?: {
    options: { value: string; icon: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
  };
  /** Actions */
  actions?: {
    label: string;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    onClick: () => void;
  }[];
  /** Export handler */
  onExport?: () => void;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Additional class names */
  className?: string;
}

export interface DataTableConfig {
  /** Column definitions */
  columns: TableColumn[];
  /** Data rows */
  data: Record<string, unknown>[];
  /** Row key field */
  rowKey?: string;
  /** Enable row selection */
  selectable?: boolean;
  /** Selected row keys */
  selectedKeys?: string[];
  /** Sort configuration */
  sort?: { key: string; direction: 'asc' | 'desc' };
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional class names */
  className?: string;
  /** Row click handler */
  onRowClick?: (row: Record<string, unknown>, index: number) => void;
  /** Selection change handler */
  onSelectionChange?: (selectedKeys: string[]) => void;
  /** Sort change handler */
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
}

// ===============================================
// LINE ITEM EDITOR
// ===============================================

/**
 * Create a line item editor for invoices/quotes.
 */
export function createLineItemEditor(config: LineItemEditorConfig): HTMLElement {
  const {
    items: initialItems = [],
    currency = '$',
    draggable = true,
    minItems = 1,
    maxItems = 50,
    className = '',
    onChange
  } = config;

  let items = [...initialItems];
  if (items.length === 0) {
    items = [{ id: generateId(), description: '', quantity: 1, rate: 0, amount: 0 }];
  }

  const wrapper = document.createElement('div');
  wrapper.className = cx('line-item-editor', className);

  // Header
  const header = document.createElement('div');
  header.className = 'line-item-header';
  header.innerHTML = `
    ${draggable ? '<div class="line-item-col line-item-drag"></div>' : ''}
    <div class="line-item-col line-item-description">Description</div>
    <div class="line-item-col line-item-quantity">Qty</div>
    <div class="line-item-col line-item-rate">Rate</div>
    <div class="line-item-col line-item-amount">Amount</div>
    <div class="line-item-col line-item-actions"></div>
  `;
  wrapper.appendChild(header);

  // Items container
  const container = document.createElement('div');
  container.className = 'line-item-container';
  wrapper.appendChild(container);

  // Footer with totals and add button
  const footer = document.createElement('div');
  footer.className = 'line-item-footer';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'line-item-add btn btn-ghost btn-sm';
  addBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add Line Item';

  const totals = document.createElement('div');
  totals.className = 'line-item-totals';

  footer.appendChild(addBtn);
  footer.appendChild(totals);
  wrapper.appendChild(footer);

  // Forward declare renderItems (will be assigned below)
  // eslint-disable-next-line prefer-const
  let renderItems: () => void;

  // Update totals - define before renderItems uses it
  const updateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    totals.innerHTML = `
      <div class="line-item-total-row">
        <span class="line-item-total-label">Subtotal:</span>
        <span class="line-item-total-value">${formatCurrency(subtotal, currency)}</span>
      </div>
    `;
  };

  // Update add button state - define before renderItems uses it
  const updateAddButton = () => {
    addBtn.disabled = items.length >= maxItems;
  };

  // Create row - define before renderItems uses it
  const createLineItemRow = (item: LineItem, index: number): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.dataset.id = item.id;

    // Amount (calculated) - define first so event listeners can reference it
    const amountCol = document.createElement('div');
    amountCol.className = 'line-item-col line-item-amount';
    const amountSpan = document.createElement('span');
    amountSpan.className = 'line-item-amount-value';
    amountSpan.textContent = formatCurrency(item.amount, currency);
    amountCol.appendChild(amountSpan);

    if (draggable) {
      const dragHandle = document.createElement('div');
      dragHandle.className = 'line-item-col line-item-drag';
      dragHandle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
      dragHandle.setAttribute('draggable', 'true');
      row.appendChild(dragHandle);

      // Drag handlers
      dragHandle.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', String(index));
        row.classList.add('dragging');
      });
      dragHandle.addEventListener('dragend', () => {
        row.classList.remove('dragging');
      });
    }

    // Description
    const descCol = document.createElement('div');
    descCol.className = 'line-item-col line-item-description';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'form-input';
    descInput.value = item.description;
    descInput.placeholder = 'Enter description...';
    descInput.addEventListener('input', () => {
      items[index].description = descInput.value;
      onChange?.(items);
    });
    descCol.appendChild(descInput);
    row.appendChild(descCol);

    // Quantity
    const qtyCol = document.createElement('div');
    qtyCol.className = 'line-item-col line-item-quantity';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'form-input';
    qtyInput.value = String(item.quantity);
    qtyInput.min = '0';
    qtyInput.step = '1';
    qtyInput.addEventListener('input', () => {
      items[index].quantity = parseFloat(qtyInput.value) || 0;
      items[index].amount = items[index].quantity * items[index].rate;
      amountSpan.textContent = formatCurrency(items[index].amount, currency);
      updateTotals();
      onChange?.(items);
    });
    qtyCol.appendChild(qtyInput);
    row.appendChild(qtyCol);

    // Rate
    const rateCol = document.createElement('div');
    rateCol.className = 'line-item-col line-item-rate';
    const rateInput = document.createElement('input');
    rateInput.type = 'number';
    rateInput.className = 'form-input';
    rateInput.value = String(item.rate);
    rateInput.min = '0';
    rateInput.step = '0.01';
    rateInput.addEventListener('input', () => {
      items[index].rate = parseFloat(rateInput.value) || 0;
      items[index].amount = items[index].quantity * items[index].rate;
      amountSpan.textContent = formatCurrency(items[index].amount, currency);
      updateTotals();
      onChange?.(items);
    });
    rateCol.appendChild(rateInput);
    row.appendChild(rateCol);

    // Add amount column (already created above)
    row.appendChild(amountCol);

    // Actions
    const actionsCol = document.createElement('div');
    actionsCol.className = 'line-item-col line-item-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'line-item-delete btn btn-icon btn-ghost btn-sm';
    deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    deleteBtn.setAttribute('aria-label', 'Remove item');
    deleteBtn.disabled = items.length <= minItems;
    deleteBtn.addEventListener('click', () => {
      if (items.length > minItems) {
        items = items.filter((_, i) => i !== index);
        renderItems();
      }
    });
    actionsCol.appendChild(deleteBtn);
    row.appendChild(actionsCol);

    // Drop zone
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') || '0');
      if (fromIndex !== index) {
        const [movedItem] = items.splice(fromIndex, 1);
        items.splice(index, 0, movedItem);
        renderItems();
      }
    });

    return row;
  };

  // Render items - assign to forward-declared variable
  renderItems = () => {
    container.innerHTML = '';
    items.forEach((item, index) => {
      container.appendChild(createLineItemRow(item, index));
    });
    updateTotals();
    updateAddButton();
    onChange?.(items);
  };

  // Add new item
  addBtn.addEventListener('click', () => {
    if (items.length < maxItems) {
      items.push({ id: generateId(), description: '', quantity: 1, rate: 0, amount: 0 });
      renderItems();
    }
  });

  renderItems();
  return wrapper;
}

/**
 * Get items from line item editor
 */
export function getLineItems(wrapper: HTMLElement): LineItem[] {
  const items: LineItem[] = [];
  wrapper.querySelectorAll('.line-item-row').forEach((row) => {
    const id = (row as HTMLElement).dataset.id || '';
    const description = (row.querySelector('.line-item-description input') as HTMLInputElement)?.value || '';
    const quantity = parseFloat((row.querySelector('.line-item-quantity input') as HTMLInputElement)?.value || '0');
    const rate = parseFloat((row.querySelector('.line-item-rate input') as HTMLInputElement)?.value || '0');
    items.push({ id, description, quantity, rate, amount: quantity * rate });
  });
  return items;
}

// ===============================================
// FILE ICON
// ===============================================

const FILE_ICONS: Record<string, string> = {
  pdf: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12h4M10 16h4M8 20h8"/></svg>',
  doc: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
  xls: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="12" width="8" height="6"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="8" y1="15" x2="16" y2="15"/></svg>',
  image: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  video: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  audio: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  archive: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  code: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  default: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
};

const FILE_TYPE_MAP: Record<string, string> = {
  pdf: 'pdf',
  doc: 'doc', docx: 'doc', odt: 'doc', rtf: 'doc',
  xls: 'xls', xlsx: 'xls', csv: 'xls', ods: 'xls',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', svg: 'image', webp: 'image', bmp: 'image',
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  js: 'code', ts: 'code', jsx: 'code', tsx: 'code', json: 'code', html: 'code', css: 'code', py: 'code', java: 'code', cpp: 'code', c: 'code', rb: 'code', php: 'code'
};

/**
 * Create a file icon based on file type.
 */
export function createFileIcon(config: FileIconConfig): HTMLElement {
  const { fileType, size = 'md', className = '' } = config;

  const wrapper = document.createElement('span');
  wrapper.className = cx('file-icon', `file-icon-${size}`, className);

  // Determine icon type
  let iconType = 'default';
  const ext = fileType.toLowerCase().split('.').pop() || '';

  if (FILE_TYPE_MAP[ext]) {
    iconType = FILE_TYPE_MAP[ext];
  } else if (fileType.includes('/')) {
    // MIME type
    const [type] = fileType.split('/');
    if (type === 'image') iconType = 'image';
    else if (type === 'video') iconType = 'video';
    else if (type === 'audio') iconType = 'audio';
    else if (fileType.includes('pdf')) iconType = 'pdf';
    else if (fileType.includes('zip') || fileType.includes('compressed')) iconType = 'archive';
  }

  wrapper.innerHTML = FILE_ICONS[iconType] || FILE_ICONS.default;
  wrapper.dataset.filetype = iconType;

  return wrapper;
}

// ===============================================
// INLINE EDIT
// ===============================================

/**
 * Create an inline editable field.
 */
export function createInlineEdit(config: InlineEditConfig): HTMLElement {
  const {
    value: initialValue,
    type = 'text',
    placeholder = 'Click to edit',
    className = '',
    onSave,
    onCancel,
    validate
  } = config;

  let currentValue = initialValue;
  let isEditing = false;

  const wrapper = document.createElement('div');
  wrapper.className = cx('inline-edit', className);

  // Display mode
  const display = document.createElement('button');
  display.type = 'button';
  display.className = 'inline-edit-display';
  display.textContent = currentValue || placeholder;
  if (!currentValue) display.classList.add('placeholder');

  // Edit mode
  const editWrapper = document.createElement('div');
  editWrapper.className = 'inline-edit-form';
  editWrapper.style.display = 'none';

  const input = document.createElement('input');
  input.type = type;
  input.className = 'inline-edit-input form-input';
  input.value = currentValue;

  const error = document.createElement('span');
  error.className = 'inline-edit-error';

  const actions = document.createElement('div');
  actions.className = 'inline-edit-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'inline-edit-save btn btn-sm btn-primary';
  saveBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
  saveBtn.setAttribute('aria-label', 'Save');

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'inline-edit-cancel btn btn-sm btn-ghost';
  cancelBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  cancelBtn.setAttribute('aria-label', 'Cancel');

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  editWrapper.appendChild(input);
  editWrapper.appendChild(error);
  editWrapper.appendChild(actions);

  wrapper.appendChild(display);
  wrapper.appendChild(editWrapper);

  // Complete exit - define before exitEdit uses it
  const completeExit = () => {
    isEditing = false;
    display.style.display = '';
    editWrapper.style.display = 'none';
    error.textContent = '';
  };

  // Enter edit mode
  const enterEdit = () => {
    isEditing = true;
    display.style.display = 'none';
    editWrapper.style.display = '';
    input.value = currentValue;
    error.textContent = '';
    input.focus();
    input.select();
  };

  // Exit edit mode
  const exitEdit = (save: boolean) => {
    if (!isEditing) return;

    if (save) {
      const newValue = input.value.trim();

      // Validate
      if (validate) {
        const errorMsg = validate(newValue);
        if (errorMsg) {
          error.textContent = errorMsg;
          input.focus();
          return;
        }
      }

      // Save
      const result = onSave?.(newValue);
      if (result instanceof Promise) {
        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        result.then(success => {
          saveBtn.disabled = false;
          cancelBtn.disabled = false;
          if (success) {
            currentValue = newValue;
            display.textContent = currentValue || placeholder;
            display.classList.toggle('placeholder', !currentValue);
            completeExit();
          }
        });
        return;
      } else if (result !== false) {
        currentValue = newValue;
        display.textContent = currentValue || placeholder;
        display.classList.toggle('placeholder', !currentValue);
      }
    } else {
      onCancel?.();
    }

    completeExit();
  };

  // Event handlers
  display.addEventListener('click', enterEdit);

  saveBtn.addEventListener('click', () => exitEdit(true));
  cancelBtn.addEventListener('click', () => exitEdit(false));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      exitEdit(true);
    } else if (e.key === 'Escape') {
      exitEdit(false);
    }
  });

  // Click outside to save
  document.addEventListener('click', (e) => {
    if (isEditing && !wrapper.contains(e.target as Node)) {
      exitEdit(true);
    }
  });

  return wrapper;
}

// ===============================================
// TABLE TOOLBAR
// ===============================================

/**
 * Create a table toolbar with search, filters, and actions.
 */
export function createTableToolbar(config: TableToolbarConfig): HTMLElement {
  const {
    search,
    filters,
    viewToggle,
    actions,
    onExport,
    onRefresh,
    className = ''
  } = config;

  const toolbar = document.createElement('div');
  toolbar.className = cx('table-toolbar', className);

  // Left section (search and filters)
  const left = document.createElement('div');
  left.className = 'table-toolbar-left';

  if (search) {
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'table-toolbar-search';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'table-toolbar-search-icon';
    searchIcon.innerHTML = ICONS.SEARCH || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'table-toolbar-search-input form-input';
    searchInput.placeholder = search.placeholder || 'Search...';
    searchInput.value = search.value || '';

    let debounceTimer: ReturnType<typeof setTimeout>;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        search.onSearch(searchInput.value);
      }, 300);
    });

    searchWrapper.appendChild(searchIcon);
    searchWrapper.appendChild(searchInput);
    left.appendChild(searchWrapper);
  }

  if (filters && filters.length > 0) {
    const filtersWrapper = document.createElement('div');
    filtersWrapper.className = 'table-toolbar-filters';

    filters.forEach(filter => {
      const select = document.createElement('select');
      select.className = 'table-toolbar-filter form-input';
      select.id = `filter-${filter.id}`;

      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = filter.label;
      select.appendChild(defaultOption);

      filter.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        option.selected = opt.value === filter.value;
        select.appendChild(option);
      });

      select.addEventListener('change', () => {
        filter.onChange(select.value);
      });

      filtersWrapper.appendChild(select);
    });

    left.appendChild(filtersWrapper);
  }

  toolbar.appendChild(left);

  // Right section (view toggle, actions, export, refresh)
  const right = document.createElement('div');
  right.className = 'table-toolbar-right';

  if (viewToggle) {
    const toggleWrapper = document.createElement('div');
    toggleWrapper.className = 'table-toolbar-view-toggle';
    toggleWrapper.setAttribute('role', 'group');

    viewToggle.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = cx('table-toolbar-view-btn', opt.value === viewToggle.value && 'active');
      btn.innerHTML = opt.icon;
      btn.setAttribute('aria-label', opt.label);
      btn.setAttribute('aria-pressed', String(opt.value === viewToggle.value));

      btn.addEventListener('click', () => {
        toggleWrapper.querySelectorAll('.table-toolbar-view-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        viewToggle.onChange(opt.value);
      });

      toggleWrapper.appendChild(btn);
    });

    right.appendChild(toggleWrapper);
  }

  if (actions && actions.length > 0) {
    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'table-toolbar-actions';

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = ['btn', `btn-${action.variant || 'secondary'}`, 'btn-sm'].join(' ');
      if (action.icon) {
        btn.innerHTML = `${action.icon} ${action.label}`;
      } else {
        btn.textContent = action.label;
      }
      btn.addEventListener('click', action.onClick);
      actionsWrapper.appendChild(btn);
    });

    right.appendChild(actionsWrapper);
  }

  if (onExport) {
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'table-toolbar-export btn btn-ghost btn-sm';
    exportBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    exportBtn.setAttribute('aria-label', 'Export');
    exportBtn.addEventListener('click', onExport);
    right.appendChild(exportBtn);
  }

  if (onRefresh) {
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'table-toolbar-refresh btn btn-ghost btn-sm';
    refreshBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    refreshBtn.setAttribute('aria-label', 'Refresh');
    refreshBtn.addEventListener('click', onRefresh);
    right.appendChild(refreshBtn);
  }

  toolbar.appendChild(right);

  return toolbar;
}

// ===============================================
// DATA TABLE
// ===============================================

/**
 * Create a data table with sorting, selection, and custom rendering.
 */
export function createDataTable(config: DataTableConfig): HTMLElement {
  const {
    columns,
    data,
    rowKey = 'id',
    selectable = false,
    selectedKeys: initialSelectedKeys = [],
    sort,
    loading = false,
    emptyMessage = 'No data to display',
    className = '',
    onRowClick,
    onSelectionChange,
    onSortChange
  } = config;

  let selectedKeys = new Set(initialSelectedKeys);
  let currentSort = sort;

  const wrapper = document.createElement('div');
  wrapper.className = cx('data-table-wrapper', className);

  const table = document.createElement('table');
  table.className = 'data-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  // Forward declare updateSelection (will be assigned below)
  // eslint-disable-next-line prefer-const
  let updateSelection: () => void;

  if (selectable) {
    const th = document.createElement('th');
    th.className = 'data-table-select';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'data-table-checkbox';
    checkbox.setAttribute('aria-label', 'Select all rows');
    checkbox.checked = data.length > 0 && selectedKeys.size === data.length;
    checkbox.indeterminate = selectedKeys.size > 0 && selectedKeys.size < data.length;

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedKeys = new Set(data.map(row => String(row[rowKey])));
      } else {
        selectedKeys = new Set();
      }
      updateSelection();
      onSelectionChange?.(Array.from(selectedKeys));
    });

    th.appendChild(checkbox);
    headerRow.appendChild(th);
  }

  columns.forEach(col => {
    const th = document.createElement('th');
    th.className = cx('data-table-header', col.sortable && 'sortable', col.align && `align-${col.align}`);
    if (col.width) th.style.width = col.width;

    const content = document.createElement('span');
    content.className = 'data-table-header-content';
    content.textContent = col.label;
    th.appendChild(content);

    if (col.sortable) {
      const sortIcon = document.createElement('span');
      sortIcon.className = 'data-table-sort-icon';
      if (currentSort?.key === col.key) {
        sortIcon.classList.add(currentSort.direction);
        sortIcon.innerHTML = currentSort.direction === 'asc'
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
      } else {
        sortIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg>';
      }
      th.appendChild(sortIcon);

      th.addEventListener('click', () => {
        const newDirection = currentSort?.key === col.key && currentSort.direction === 'asc' ? 'desc' : 'asc';
        currentSort = { key: col.key, direction: newDirection };
        onSortChange?.(col.key, newDirection);
        // Update sort icons
        thead.querySelectorAll('.data-table-sort-icon').forEach(icon => {
          icon.classList.remove('asc', 'desc');
          icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg>';
        });
        const currentIcon = th.querySelector('.data-table-sort-icon');
        if (currentIcon) {
          currentIcon.classList.add(newDirection);
          currentIcon.innerHTML = newDirection === 'asc'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
        }
      });
    }

    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');

  // Update selection - assign to forward-declared variable
  updateSelection = () => {
    // Update header checkbox
    const headerCheckbox = thead.querySelector('.data-table-checkbox') as HTMLInputElement;
    if (headerCheckbox) {
      headerCheckbox.checked = data.length > 0 && selectedKeys.size === data.length;
      headerCheckbox.indeterminate = selectedKeys.size > 0 && selectedKeys.size < data.length;
    }

    // Update row selection state
    tbody.querySelectorAll('.data-table-row').forEach(row => {
      const key = (row as HTMLElement).dataset.key;
      const checkbox = row.querySelector('.data-table-checkbox') as HTMLInputElement;
      if (key && checkbox) {
        const isSelected = selectedKeys.has(key);
        row.classList.toggle('selected', isSelected);
        checkbox.checked = isSelected;
      }
    });
  };

  const renderBody = () => {
    tbody.innerHTML = '';

    if (loading) {
      const loadingRow = document.createElement('tr');
      loadingRow.className = 'data-table-loading';
      const loadingCell = document.createElement('td');
      loadingCell.colSpan = columns.length + (selectable ? 1 : 0);
      loadingCell.innerHTML = '<div class="data-table-spinner"></div>';
      loadingRow.appendChild(loadingCell);
      tbody.appendChild(loadingRow);
      return;
    }

    if (data.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.className = 'data-table-empty';
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = columns.length + (selectable ? 1 : 0);
      emptyCell.textContent = emptyMessage;
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    data.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.className = cx('data-table-row', selectedKeys.has(String(row[rowKey])) && 'selected');
      tr.dataset.key = String(row[rowKey]);

      if (selectable) {
        const td = document.createElement('td');
        td.className = 'data-table-select';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'data-table-checkbox';
        checkbox.checked = selectedKeys.has(String(row[rowKey]));
        checkbox.setAttribute('aria-label', `Select row ${index + 1}`);

        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          if (checkbox.checked) {
            selectedKeys.add(String(row[rowKey]));
          } else {
            selectedKeys.delete(String(row[rowKey]));
          }
          updateSelection();
          onSelectionChange?.(Array.from(selectedKeys));
        });

        td.appendChild(checkbox);
        tr.appendChild(td);
      }

      columns.forEach(col => {
        const td = document.createElement('td');
        td.className = cx('data-table-cell', col.align && `align-${col.align}`);

        const value = row[col.key];
        if (col.render) {
          const rendered = col.render(value, row, index);
          if (typeof rendered === 'string') {
            td.innerHTML = rendered;
          } else {
            td.appendChild(rendered);
          }
        } else {
          td.textContent = String(value ?? '');
        }

        tr.appendChild(td);
      });

      if (onRowClick) {
        tr.classList.add('clickable');
        tr.addEventListener('click', (e) => {
          // Don't trigger row click when clicking checkbox
          if ((e.target as HTMLElement).closest('.data-table-select')) return;
          onRowClick(row, index);
        });
      }

      tbody.appendChild(tr);
    });
  };

  renderBody();
  table.appendChild(tbody);
  wrapper.appendChild(table);

  return wrapper;
}

/**
 * Update data table data
 */
export function updateDataTable(_wrapper: HTMLElement, _data: Record<string, unknown>[]): void {
  // This would need more implementation to properly update
  // For now, recommend recreating the table
  console.warn('updateDataTable: For complex updates, recreate the table');
}

/**
 * Get selected keys from data table
 */
export function getSelectedKeys(wrapper: HTMLElement): string[] {
  const keys: string[] = [];
  wrapper.querySelectorAll('.data-table-row.selected').forEach(row => {
    const key = (row as HTMLElement).dataset.key;
    if (key) keys.push(key);
  });
  return keys;
}

// ===============================================
// HELPERS
// ===============================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function formatCurrency(amount: number, symbol: string): string {
  return `${symbol}${amount.toFixed(2)}`;
}
