/**
 * ===============================================
 * INLINE EDIT COMPONENT
 * ===============================================
 * @file src/components/inline-edit.ts
 *
 * Linear-style inline editing for table cells.
 * Click to edit, Enter/blur to save, Escape to cancel.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface InlineEditConfig {
  /** The element to make editable */
  element: HTMLElement;
  /** Current value */
  value: string;
  /** Callback when value is saved */
  onSave: (newValue: string) => Promise<void> | void;
  /** Optional callback when editing is cancelled */
  onCancel?: () => void;
  /** Input type: 'text', 'number', 'date' */
  type?: 'text' | 'number' | 'date';
  /** Placeholder text */
  placeholder?: string;
  /** Minimum value (for number type) */
  min?: number;
  /** Maximum value (for number type) */
  max?: number;
  /** Whether the field is required */
  required?: boolean;
}

// ============================================================================
// STATE
// ============================================================================

/** Track active inline edit to prevent multiple edits */
let activeEdit: { element: HTMLElement; cleanup: () => void } | null = null;

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Enable inline editing on an element
 */
export function enableInlineEdit(config: InlineEditConfig): void {
  const { element, value, onSave, onCancel, type = 'text', placeholder = '', required = false } = config;

  // Close any active edit first
  if (activeEdit) {
    activeEdit.cleanup();
  }

  // Store original content
  const originalContent = element.innerHTML;
  const originalValue = value;

  // Create input element
  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.className = 'inline-edit-input';

  if (type === 'number') {
    if (config.min !== undefined) input.min = String(config.min);
    if (config.max !== undefined) input.max = String(config.max);
  }

  // Style the input to match the cell
  input.style.cssText = `
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--color-primary);
    border-radius: 4px;
    background: var(--portal-bg-darker);
    color: var(--portal-text-light);
    font-size: inherit;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
  `;

  // Add editing class to cell
  element.classList.add('is-editing');

  // Replace content with input
  element.innerHTML = '';
  element.appendChild(input);

  // Focus and select all
  input.focus();
  input.select();

  // Cleanup function
  const cleanup = () => {
    element.classList.remove('is-editing');
    element.innerHTML = originalContent;
    activeEdit = null;
  };

  // Save function
  const save = async () => {
    const newValue = input.value.trim();

    // Validate required
    if (required && !newValue) {
      input.style.borderColor = 'var(--color-danger)';
      input.focus();
      return;
    }

    // Only save if value changed
    if (newValue !== originalValue) {
      // Show saving state
      input.disabled = true;
      input.style.opacity = '0.6';

      try {
        await onSave(newValue);
      } catch (error) {
        console.error('[InlineEdit] Save failed:', error);
        // Restore original on error
        cleanup();
        return;
      }
    }

    // Cleanup after save
    activeEdit = null;
    element.classList.remove('is-editing');
    // The parent should update the display value
  };

  // Cancel function
  const cancel = () => {
    cleanup();
    onCancel?.();
  };

  // Event handlers
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  const handleBlur = () => {
    // Small delay to allow click events to fire first
    setTimeout(() => {
      if (activeEdit?.element === element) {
        save();
      }
    }, 100);
  };

  input.addEventListener('keydown', handleKeyDown);
  input.addEventListener('blur', handleBlur);

  // Track active edit
  activeEdit = { element, cleanup };
}

/**
 * Make a cell inline-editable on click
 */
export function makeEditable(
  cell: HTMLElement,
  getValue: () => string,
  onSave: (newValue: string) => Promise<void> | void,
  options: Partial<Omit<InlineEditConfig, 'element' | 'value' | 'onSave'>> = {}
): void {
  // Add editable indicator
  cell.classList.add('inline-editable');
  cell.style.cursor = 'pointer';

  cell.addEventListener('click', (e) => {
    // Don't trigger if clicking a button or link inside
    if ((e.target as HTMLElement).closest('button, a, .icon-btn')) {
      return;
    }

    // Don't trigger if already editing
    if (cell.classList.contains('is-editing')) {
      return;
    }

    enableInlineEdit({
      element: cell,
      value: getValue(),
      onSave,
      ...options
    });
  });
}

/**
 * Create an inline-editable cell with display and edit modes
 */
export function createEditableCell(config: {
  value: string;
  displayValue?: string;
  onSave: (newValue: string) => Promise<void> | void;
  type?: 'text' | 'number' | 'date';
  placeholder?: string;
  className?: string;
}): HTMLElement {
  const { value, displayValue, onSave, type = 'text', placeholder = '', className = '' } = config;

  const cell = document.createElement('td');
  cell.className = `inline-editable ${className}`.trim();
  cell.textContent = displayValue || value || placeholder;
  cell.dataset.value = value;

  if (!value && placeholder) {
    cell.classList.add('placeholder');
  }

  makeEditable(
    cell,
    () => cell.dataset.value || '',
    async (newValue) => {
      await onSave(newValue);
      cell.textContent = newValue || placeholder;
      cell.dataset.value = newValue;

      if (!newValue && placeholder) {
        cell.classList.add('placeholder');
      } else {
        cell.classList.remove('placeholder');
      }
    },
    { type, placeholder }
  );

  return cell;
}

/**
 * Cancel any active inline edit
 */
export function cancelActiveEdit(): void {
  if (activeEdit) {
    activeEdit.cleanup();
  }
}
