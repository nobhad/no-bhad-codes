/**
 * ===============================================
 * FORM BUILDER (REUSABLE)
 * ===============================================
 * @file src/components/form-builder.ts
 *
 * Reusable form components for admin and client portals.
 * Creates consistent form groups, inputs, textareas, and date pickers.
 */

import { cx } from '../utils/dom-utils';

// ===============================================
// TYPES
// ===============================================

export interface FormGroupConfig {
  /** Unique ID for the input element */
  id: string;
  /** Label text */
  label: string;
  /** Optional: Use label-inside pattern (default: false, label above) */
  labelInside?: boolean;
  /** Optional: Input type (default: 'text') */
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'url' | 'date' | 'textarea';
  /** Optional: Placeholder text */
  placeholder?: string;
  /** Optional: Initial value */
  value?: string;
  /** Optional: Required field */
  required?: boolean;
  /** Optional: Disabled state */
  disabled?: boolean;
  /** Optional: Read-only state */
  readonly?: boolean;
  /** Optional: Error message to display */
  errorMessage?: string;
  /** Optional: Additional class names for the input */
  inputClassName?: string;
  /** Optional: Additional class names for the form group */
  className?: string;
  /** Optional: Autocomplete attribute */
  autocomplete?: string;
  /** Optional: Name attribute */
  name?: string;
  /** Optional: aria-describedby for accessibility */
  ariaDescribedBy?: string;
  /** Optional: maxlength for text inputs */
  maxLength?: number;
  /** Optional: min value for number/date inputs */
  min?: string | number;
  /** Optional: max value for number/date inputs */
  max?: string | number;
  /** Optional: step for number inputs */
  step?: string | number;
  /** Optional: pattern for validation */
  pattern?: string;
  /** Optional: rows for textarea */
  rows?: number;
}

export interface TextInputConfig {
  /** Unique ID */
  id: string;
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'url';
  /** Name attribute */
  name?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Initial value */
  value?: string;
  /** Required field */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readonly?: boolean;
  /** Additional class names */
  className?: string;
  /** Autocomplete attribute */
  autocomplete?: string;
  /** aria-describedby for accessibility */
  ariaDescribedBy?: string;
  /** aria-label for accessibility */
  ariaLabel?: string;
  /** maxlength */
  maxLength?: number;
  /** pattern for validation */
  pattern?: string;
  /** Change handler */
  onChange?: (value: string, event: Event) => void;
  /** Blur handler */
  onBlur?: (value: string, event: FocusEvent) => void;
}

export interface TextAreaConfig {
  /** Unique ID */
  id: string;
  /** Name attribute */
  name?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Initial value */
  value?: string;
  /** Required field */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readonly?: boolean;
  /** Additional class names */
  className?: string;
  /** Number of rows */
  rows?: number;
  /** Enable auto-resize */
  autoResize?: boolean;
  /** Max height for auto-resize (in px) */
  maxHeight?: number;
  /** aria-describedby for accessibility */
  ariaDescribedBy?: string;
  /** aria-label for accessibility */
  ariaLabel?: string;
  /** maxlength */
  maxLength?: number;
  /** Change handler */
  onChange?: (value: string, event: Event) => void;
  /** Blur handler */
  onBlur?: (value: string, event: FocusEvent) => void;
}

export interface DatePickerConfig {
  /** Unique ID */
  id: string;
  /** Name attribute */
  name?: string;
  /** Initial value (ISO format: YYYY-MM-DD) */
  value?: string;
  /** Required field */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readonly?: boolean;
  /** Additional class names */
  className?: string;
  /** Min date (ISO format) */
  min?: string;
  /** Max date (ISO format) */
  max?: string;
  /** aria-describedby for accessibility */
  ariaDescribedBy?: string;
  /** aria-label for accessibility */
  ariaLabel?: string;
  /** Change handler */
  onChange?: (value: string, event: Event) => void;
}

export interface NumberInputConfig {
  /** Unique ID */
  id: string;
  /** Name attribute */
  name?: string;
  /** Initial value */
  value?: number;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Required field */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Show +/- buttons */
  showButtons?: boolean;
  /** Format display (currency, percent, none) */
  format?: 'none' | 'currency' | 'percent';
  /** Currency symbol for currency format */
  currencySymbol?: string;
  /** Decimal places */
  decimals?: number;
  /** aria-label for accessibility */
  ariaLabel?: string;
  /** Change handler */
  onChange?: (value: number, event: Event) => void;
}

export interface RadioOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Disabled state */
  disabled?: boolean;
}

export interface RadioGroupConfig {
  /** Group name (shared by all radios) */
  name: string;
  /** Available options */
  options: RadioOption[];
  /** Currently selected value */
  selectedValue?: string;
  /** Layout direction */
  layout?: 'vertical' | 'horizontal';
  /** Required field */
  required?: boolean;
  /** Disabled state (all options) */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** aria-label for the group */
  ariaLabel?: string;
  /** Change handler */
  onChange?: (value: string, event: Event) => void;
}

export interface FormRowConfig {
  /** Child elements or form groups */
  children: HTMLElement[];
  /** Column layout (auto, equal, or specific widths) */
  columns?: 'auto' | 'equal' | string[];
  /** Gap between columns */
  gap?: 'sm' | 'md' | 'lg';
  /** Stack vertically on mobile */
  stackOnMobile?: boolean;
  /** Additional class names */
  className?: string;
}

export interface FormSectionConfig {
  /** Section title */
  title: string;
  /** Optional description */
  description?: string;
  /** Child elements (form groups) */
  children: HTMLElement[];
  /** Collapsible section */
  collapsible?: boolean;
  /** Initial collapsed state (only if collapsible) */
  collapsed?: boolean;
  /** Additional class names */
  className?: string;
}

export interface FileUploadConfig {
  /** Unique ID */
  id: string;
  /** Name attribute */
  name?: string;
  /** Accepted file types (e.g., '.pdf,.doc,image/*') */
  accept?: string;
  /** Allow multiple files */
  multiple?: boolean;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files (if multiple) */
  maxFiles?: number;
  /** Required field */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Drag and drop label */
  dropLabel?: string;
  /** Browse button label */
  browseLabel?: string;
  /** Show file previews */
  showPreview?: boolean;
  /** aria-label for accessibility */
  ariaLabel?: string;
  /** File selected handler */
  onSelect?: (files: File[]) => void;
  /** File removed handler */
  onRemove?: (file: File, index: number) => void;
  /** Validation error handler */
  onError?: (error: string) => void;
}

// ===============================================
// FORM GROUP BUILDER
// ===============================================

/**
 * Create a form group with label, input, and error message wrapper.
 * Uses consistent portal form styling.
 */
export function createFormGroup(config: FormGroupConfig): HTMLElement {
  const {
    id,
    label,
    labelInside = false,
    type = 'text',
    placeholder = '',
    value = '',
    required = false,
    disabled = false,
    readonly = false,
    errorMessage,
    inputClassName = '',
    className = '',
    autocomplete,
    name,
    ariaDescribedBy,
    maxLength,
    min,
    max,
    step,
    pattern,
    rows = 4
  } = config;

  const group = document.createElement('div');
  group.className = cx('form-group', labelInside && 'label-inside', className);

  // Create label
  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.className = 'field-label';
  labelEl.textContent = label;
  if (required) {
    const requiredSpan = document.createElement('span');
    requiredSpan.className = 'required-indicator';
    requiredSpan.setAttribute('aria-hidden', 'true');
    requiredSpan.textContent = ' *';
    labelEl.appendChild(requiredSpan);
  }

  // Create input based on type
  let input: HTMLInputElement | HTMLTextAreaElement;

  if (type === 'textarea') {
    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.className = cx('form-textarea', inputClassName, errorMessage && 'error');
    textarea.placeholder = placeholder;
    textarea.value = value;
    textarea.required = required;
    textarea.disabled = disabled;
    textarea.readOnly = readonly;
    textarea.rows = rows;
    if (name) textarea.name = name;
    if (ariaDescribedBy) textarea.setAttribute('aria-describedby', ariaDescribedBy);
    if (maxLength) textarea.maxLength = maxLength;
    input = textarea;
  } else {
    const inputEl = document.createElement('input');
    inputEl.id = id;
    inputEl.type = type;
    inputEl.className = cx('form-input', inputClassName, errorMessage && 'error');
    inputEl.placeholder = placeholder;
    inputEl.value = value;
    inputEl.required = required;
    inputEl.disabled = disabled;
    inputEl.readOnly = readonly;
    if (name) inputEl.name = name;
    if (autocomplete) inputEl.setAttribute('autocomplete', autocomplete);
    if (ariaDescribedBy) inputEl.setAttribute('aria-describedby', ariaDescribedBy);
    if (maxLength) inputEl.maxLength = maxLength;
    if (min !== undefined) inputEl.min = String(min);
    if (max !== undefined) inputEl.max = String(max);
    if (step !== undefined) inputEl.step = String(step);
    if (pattern) inputEl.pattern = pattern;
    input = inputEl;
  }

  // Create error message container
  const errorEl = document.createElement('span');
  errorEl.id = `${id}-error`;
  errorEl.className = 'form-error-message';
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'polite');
  if (errorMessage) {
    errorEl.textContent = errorMessage;
    input.setAttribute('aria-describedby', errorEl.id);
    input.setAttribute('aria-invalid', 'true');
  }

  // Assemble
  group.appendChild(labelEl);
  group.appendChild(input);
  group.appendChild(errorEl);

  return group;
}

// ===============================================
// TEXT INPUT BUILDER
// ===============================================

/**
 * Create a standalone text input element.
 * Use createFormGroup for complete form groups with labels.
 */
export function createTextInput(config: TextInputConfig): HTMLInputElement {
  const {
    id,
    type = 'text',
    name,
    placeholder = '',
    value = '',
    required = false,
    disabled = false,
    readonly = false,
    className = '',
    autocomplete,
    ariaDescribedBy,
    ariaLabel,
    maxLength,
    pattern,
    onChange,
    onBlur
  } = config;

  const input = document.createElement('input');
  input.id = id;
  input.type = type;
  input.className = cx('form-input', className);
  input.placeholder = placeholder;
  input.value = value;
  input.required = required;
  input.disabled = disabled;
  input.readOnly = readonly;

  if (name) input.name = name;
  if (autocomplete) input.setAttribute('autocomplete', autocomplete);
  if (ariaDescribedBy) input.setAttribute('aria-describedby', ariaDescribedBy);
  if (ariaLabel) input.setAttribute('aria-label', ariaLabel);
  if (maxLength) input.maxLength = maxLength;
  if (pattern) input.pattern = pattern;

  if (onChange) {
    input.addEventListener('input', (e) => onChange(input.value, e));
  }
  if (onBlur) {
    input.addEventListener('blur', (e) => onBlur(input.value, e as FocusEvent));
  }

  return input;
}

// ===============================================
// TEXT AREA BUILDER
// ===============================================

/**
 * Create a textarea element with optional auto-resize.
 * Use createFormGroup for complete form groups with labels.
 */
export function createTextArea(config: TextAreaConfig): HTMLTextAreaElement {
  const {
    id,
    name,
    placeholder = '',
    value = '',
    required = false,
    disabled = false,
    readonly = false,
    className = '',
    rows = 4,
    autoResize = false,
    maxHeight = 300,
    ariaDescribedBy,
    ariaLabel,
    maxLength,
    onChange,
    onBlur
  } = config;

  const textarea = document.createElement('textarea');
  textarea.id = id;
  textarea.className = cx('form-textarea', className);
  textarea.placeholder = placeholder;
  textarea.value = value;
  textarea.required = required;
  textarea.disabled = disabled;
  textarea.readOnly = readonly;
  textarea.rows = rows;

  if (name) textarea.name = name;
  if (ariaDescribedBy) textarea.setAttribute('aria-describedby', ariaDescribedBy);
  if (ariaLabel) textarea.setAttribute('aria-label', ariaLabel);
  if (maxLength) textarea.maxLength = maxLength;

  // Auto-resize functionality
  if (autoResize) {
    const resizeHandler = () => {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflow = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    };

    textarea.addEventListener('input', resizeHandler);
    // Initial resize after DOM is ready
    requestAnimationFrame(resizeHandler);
  }

  if (onChange) {
    textarea.addEventListener('input', (e) => onChange(textarea.value, e));
  }
  if (onBlur) {
    textarea.addEventListener('blur', (e) => onBlur(textarea.value, e as FocusEvent));
  }

  return textarea;
}

// ===============================================
// DATE PICKER BUILDER
// ===============================================

/**
 * Create a date input element.
 * Use createFormGroup for complete form groups with labels.
 */
export function createDatePicker(config: DatePickerConfig): HTMLInputElement {
  const {
    id,
    name,
    value = '',
    required = false,
    disabled = false,
    readonly = false,
    className = '',
    min,
    max,
    ariaDescribedBy,
    ariaLabel,
    onChange
  } = config;

  const input = document.createElement('input');
  input.id = id;
  input.type = 'date';
  input.className = cx('form-input', className);
  input.value = value;
  input.required = required;
  input.disabled = disabled;
  input.readOnly = readonly;

  if (name) input.name = name;
  if (min) input.min = min;
  if (max) input.max = max;
  if (ariaDescribedBy) input.setAttribute('aria-describedby', ariaDescribedBy);
  if (ariaLabel) input.setAttribute('aria-label', ariaLabel);

  if (onChange) {
    input.addEventListener('change', (e) => onChange(input.value, e));
  }

  return input;
}

// ===============================================
// FORM VALIDATION HELPERS
// ===============================================

/**
 * Set error state on an input element
 */
export function setInputError(input: HTMLInputElement | HTMLTextAreaElement, errorMessage: string): void {
  input.classList.add('error');
  input.setAttribute('aria-invalid', 'true');

  const errorEl = document.getElementById(`${input.id}-error`);
  if (errorEl) {
    errorEl.textContent = errorMessage;
    input.setAttribute('aria-describedby', errorEl.id);
  }
}

/**
 * Clear error state from an input element
 */
export function clearInputError(input: HTMLInputElement | HTMLTextAreaElement): void {
  input.classList.remove('error');
  input.removeAttribute('aria-invalid');

  const errorEl = document.getElementById(`${input.id}-error`);
  if (errorEl) {
    errorEl.textContent = '';
  }
}

/**
 * Validate a form group and return validation result
 */
export function validateFormGroup(
  input: HTMLInputElement | HTMLTextAreaElement,
  validations: {
    required?: { message: string };
    minLength?: { value: number; message: string };
    maxLength?: { value: number; message: string };
    pattern?: { value: RegExp; message: string };
    email?: { message: string };
    custom?: { validator: (value: string) => boolean; message: string };
  }
): { valid: boolean; message?: string } {
  const value = input.value.trim();

  // Required check
  if (validations.required && !value) {
    setInputError(input, validations.required.message);
    return { valid: false, message: validations.required.message };
  }

  // Skip other validations if empty and not required
  if (!value) {
    clearInputError(input);
    return { valid: true };
  }

  // Min length check
  if (validations.minLength && value.length < validations.minLength.value) {
    setInputError(input, validations.minLength.message);
    return { valid: false, message: validations.minLength.message };
  }

  // Max length check
  if (validations.maxLength && value.length > validations.maxLength.value) {
    setInputError(input, validations.maxLength.message);
    return { valid: false, message: validations.maxLength.message };
  }

  // Pattern check
  if (validations.pattern && !validations.pattern.value.test(value)) {
    setInputError(input, validations.pattern.message);
    return { valid: false, message: validations.pattern.message };
  }

  // Email check
  if (validations.email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(value)) {
      setInputError(input, validations.email.message);
      return { valid: false, message: validations.email.message };
    }
  }

  // Custom validation
  if (validations.custom && !validations.custom.validator(value)) {
    setInputError(input, validations.custom.message);
    return { valid: false, message: validations.custom.message };
  }

  clearInputError(input);
  return { valid: true };
}

// ===============================================
// NUMBER INPUT BUILDER
// ===============================================

/**
 * Create a number input with optional +/- buttons and formatting.
 */
export function createNumberInput(config: NumberInputConfig): HTMLElement {
  const {
    id,
    name,
    value = 0,
    min,
    max,
    step = 1,
    required = false,
    disabled = false,
    className = '',
    showButtons = true,
    format = 'none',
    currencySymbol = '$',
    decimals = 2,
    ariaLabel,
    onChange
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx('number-input-wrapper', showButtons && 'with-buttons', className);

  // Format value for display
  const formatValue = (val: number): string => {
    switch (format) {
    case 'currency':
      return `${currencySymbol}${val.toFixed(decimals)}`;
    case 'percent':
      return `${val.toFixed(decimals)}%`;
    default:
      return decimals > 0 ? val.toFixed(decimals) : String(val);
    }
  };

  // Parse value from display
  const parseValue = (val: string): number => {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Clamp value to min/max
  const clampValue = (val: number): number => {
    if (min !== undefined && val < min) return min;
    if (max !== undefined && val > max) return max;
    return val;
  };

  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.id = id;
  input.className = 'form-input number-input';
  input.value = formatValue(value);
  input.required = required;
  input.disabled = disabled;
  if (name) input.name = name;
  if (ariaLabel) input.setAttribute('aria-label', ariaLabel);

  // Store raw value as data attribute
  input.dataset.rawValue = String(value);

  // Handle input
  input.addEventListener('blur', () => {
    const rawValue = clampValue(parseValue(input.value));
    input.value = formatValue(rawValue);
    input.dataset.rawValue = String(rawValue);
  });

  input.addEventListener('input', (e) => {
    const rawValue = parseValue(input.value);
    input.dataset.rawValue = String(rawValue);
    onChange?.(rawValue, e);
  });

  if (showButtons) {
    const decrementBtn = document.createElement('button');
    decrementBtn.type = 'button';
    decrementBtn.className = 'number-input-btn number-input-decrement';
    decrementBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>';
    decrementBtn.setAttribute('aria-label', 'Decrease value');
    decrementBtn.disabled = disabled;

    const incrementBtn = document.createElement('button');
    incrementBtn.type = 'button';
    incrementBtn.className = 'number-input-btn number-input-increment';
    incrementBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
    incrementBtn.setAttribute('aria-label', 'Increase value');
    incrementBtn.disabled = disabled;

    decrementBtn.addEventListener('click', () => {
      const current = parseFloat(input.dataset.rawValue || '0');
      const newValue = clampValue(current - step);
      input.value = formatValue(newValue);
      input.dataset.rawValue = String(newValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    incrementBtn.addEventListener('click', () => {
      const current = parseFloat(input.dataset.rawValue || '0');
      const newValue = clampValue(current + step);
      input.value = formatValue(newValue);
      input.dataset.rawValue = String(newValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    wrapper.appendChild(decrementBtn);
    wrapper.appendChild(input);
    wrapper.appendChild(incrementBtn);
  } else {
    wrapper.appendChild(input);
  }

  return wrapper;
}

/**
 * Get the raw numeric value from a number input
 */
export function getNumberInputValue(wrapper: HTMLElement): number {
  const input = wrapper.querySelector('.number-input') as HTMLInputElement;
  return parseFloat(input?.dataset.rawValue || '0');
}

/**
 * Set the value of a number input
 */
export function setNumberInputValue(wrapper: HTMLElement, value: number): void {
  const input = wrapper.querySelector('.number-input') as HTMLInputElement;
  if (input) {
    input.dataset.rawValue = String(value);
    // Re-format display (simplified - just show the number)
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ===============================================
// RADIO GROUP BUILDER
// ===============================================

/**
 * Create a radio button group with optional descriptions.
 */
export function createRadioGroup(config: RadioGroupConfig): HTMLElement {
  const {
    name,
    options,
    selectedValue,
    layout = 'vertical',
    required = false,
    disabled = false,
    className = '',
    ariaLabel,
    onChange
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx('radio-group', `radio-group-${layout}`, className);
  wrapper.setAttribute('role', 'radiogroup');
  if (ariaLabel) wrapper.setAttribute('aria-label', ariaLabel);
  if (required) wrapper.setAttribute('aria-required', 'true');

  options.forEach((option, index) => {
    const optionWrapper = document.createElement('label');
    optionWrapper.className = cx('radio-option', (option.disabled || disabled) && 'disabled');

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = option.value;
    input.checked = option.value === selectedValue;
    input.disabled = option.disabled || disabled;
    input.required = required && index === 0;
    input.className = 'radio-input';

    input.addEventListener('change', (e) => {
      if (input.checked) {
        onChange?.(option.value, e);
      }
    });

    const indicator = document.createElement('span');
    indicator.className = 'radio-indicator';

    const content = document.createElement('span');
    content.className = 'radio-content';

    const labelText = document.createElement('span');
    labelText.className = 'radio-label';
    labelText.textContent = option.label;
    content.appendChild(labelText);

    if (option.description) {
      const description = document.createElement('span');
      description.className = 'radio-description';
      description.textContent = option.description;
      content.appendChild(description);
    }

    optionWrapper.appendChild(input);
    optionWrapper.appendChild(indicator);
    optionWrapper.appendChild(content);
    wrapper.appendChild(optionWrapper);
  });

  return wrapper;
}

// ===============================================
// FORM ROW BUILDER
// ===============================================

/**
 * Create a horizontal row for multiple form fields.
 */
export function createFormRow(config: FormRowConfig): HTMLElement {
  const {
    children,
    columns = 'equal',
    gap = 'md',
    stackOnMobile = true,
    className = ''
  } = config;

  const row = document.createElement('div');
  row.className = cx('form-row', `form-row-gap-${gap}`, stackOnMobile && 'form-row-stack-mobile', className);

  // Set grid columns
  if (columns === 'equal') {
    row.style.gridTemplateColumns = `repeat(${children.length}, 1fr)`;
  } else if (columns === 'auto') {
    row.style.gridTemplateColumns = `repeat(${children.length}, auto)`;
  } else if (Array.isArray(columns)) {
    row.style.gridTemplateColumns = columns.join(' ');
  }

  children.forEach(child => {
    row.appendChild(child);
  });

  return row;
}

// ===============================================
// FORM SECTION BUILDER
// ===============================================

/**
 * Create a collapsible section for grouping related form fields.
 */
export function createFormSection(config: FormSectionConfig): HTMLElement {
  const {
    title,
    description,
    children,
    collapsible = false,
    collapsed = false,
    className = ''
  } = config;

  const section = document.createElement('div');
  section.className = cx('form-section', collapsible && 'form-section-collapsible', className);

  // Header
  const header = document.createElement('div');
  header.className = 'form-section-header';

  if (collapsible) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'form-section-toggle';
    toggle.setAttribute('aria-expanded', String(!collapsed));

    const icon = document.createElement('span');
    icon.className = 'form-section-icon';
    icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';

    const titleEl = document.createElement('span');
    titleEl.className = 'form-section-title';
    titleEl.textContent = title;

    toggle.appendChild(icon);
    toggle.appendChild(titleEl);
    header.appendChild(toggle);

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'form-section-content';
    content.style.display = collapsed ? 'none' : '';

    if (description) {
      const desc = document.createElement('p');
      desc.className = 'form-section-description';
      desc.textContent = description;
      content.appendChild(desc);
    }

    const fields = document.createElement('div');
    fields.className = 'form-section-fields';
    children.forEach(child => fields.appendChild(child));
    content.appendChild(fields);

    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isExpanded));
      content.style.display = isExpanded ? 'none' : '';
      section.classList.toggle('collapsed', isExpanded);
    });

    section.appendChild(header);
    section.appendChild(content);

    if (collapsed) {
      section.classList.add('collapsed');
    }
  } else {
    const titleEl = document.createElement('h3');
    titleEl.className = 'form-section-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    section.appendChild(header);

    if (description) {
      const desc = document.createElement('p');
      desc.className = 'form-section-description';
      desc.textContent = description;
      section.appendChild(desc);
    }

    const fields = document.createElement('div');
    fields.className = 'form-section-fields';
    children.forEach(child => fields.appendChild(child));
    section.appendChild(fields);
  }

  return section;
}

// ===============================================
// FILE UPLOAD BUILDER
// ===============================================

/**
 * Create a file upload component with drag-and-drop support.
 */
export function createFileUpload(config: FileUploadConfig): HTMLElement {
  const {
    id,
    name,
    accept,
    multiple = false,
    maxSize,
    maxFiles = 10,
    required = false,
    disabled = false,
    className = '',
    dropLabel = 'Drag and drop files here, or',
    browseLabel = 'Browse',
    showPreview = true,
    ariaLabel,
    onSelect,
    onRemove,
    onError
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx('file-upload', disabled && 'disabled', className);

  const dropZone = document.createElement('div');
  dropZone.className = 'file-upload-dropzone';

  const input = document.createElement('input');
  input.type = 'file';
  input.id = id;
  input.className = 'file-upload-input';
  if (name) input.name = name;
  if (accept) input.accept = accept;
  input.multiple = multiple;
  input.required = required;
  input.disabled = disabled;
  if (ariaLabel) input.setAttribute('aria-label', ariaLabel);

  const label = document.createElement('label');
  label.htmlFor = id;
  label.className = 'file-upload-label';

  const icon = document.createElement('span');
  icon.className = 'file-upload-icon';
  icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';

  const text = document.createElement('span');
  text.className = 'file-upload-text';
  text.innerHTML = `${dropLabel} <span class="file-upload-browse">${browseLabel}</span>`;

  const hint = document.createElement('span');
  hint.className = 'file-upload-hint';
  const hints: string[] = [];
  if (accept) hints.push(`Accepted: ${accept}`);
  if (maxSize) hints.push(`Max size: ${formatFileSize(maxSize)}`);
  if (multiple && maxFiles) hints.push(`Max files: ${maxFiles}`);
  hint.textContent = hints.join(' | ');

  label.appendChild(icon);
  label.appendChild(text);
  if (hints.length) label.appendChild(hint);

  dropZone.appendChild(input);
  dropZone.appendChild(label);

  // File list
  const fileList = document.createElement('div');
  fileList.className = 'file-upload-list';

  wrapper.appendChild(dropZone);
  wrapper.appendChild(fileList);

  // Track selected files
  let selectedFiles: File[] = [];

  // Validate file
  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File "${file.name}" exceeds maximum size of ${formatFileSize(maxSize)}`;
    }
    if (accept) {
      const acceptedTypes = accept.split(',').map(t => t.trim().toLowerCase());
      const fileType = file.type.toLowerCase();
      const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;

      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) return fileExt === type;
        if (type.endsWith('/*')) return fileType.startsWith(type.replace('/*', '/'));
        return fileType === type;
      });

      if (!isAccepted) {
        return `File type "${file.type || fileExt}" is not accepted`;
      }
    }
    return null;
  };

  // Declare renderFileList first (will be assigned below)
  // eslint-disable-next-line prefer-const
  let renderFileList: () => void;

  // Render file item
  const renderFileItem = (file: File, index: number): HTMLElement => {
    const item = document.createElement('div');
    item.className = 'file-upload-item';

    if (showPreview && file.type.startsWith('image/')) {
      const preview = document.createElement('img');
      preview.className = 'file-upload-preview';
      preview.alt = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
      item.appendChild(preview);
    } else {
      const fileIcon = document.createElement('span');
      fileIcon.className = 'file-upload-file-icon';
      fileIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      item.appendChild(fileIcon);
    }

    const info = document.createElement('div');
    info.className = 'file-upload-info';

    const fileName = document.createElement('span');
    fileName.className = 'file-upload-name';
    fileName.textContent = file.name;

    const fileSize = document.createElement('span');
    fileSize.className = 'file-upload-size';
    fileSize.textContent = formatFileSize(file.size);

    info.appendChild(fileName);
    info.appendChild(fileSize);
    item.appendChild(info);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'file-upload-remove';
    removeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    removeBtn.setAttribute('aria-label', `Remove ${file.name}`);

    removeBtn.addEventListener('click', () => {
      selectedFiles = selectedFiles.filter((_, i) => i !== index);
      renderFileList();
      onRemove?.(file, index);
    });

    item.appendChild(removeBtn);

    return item;
  };

  // Render file list (assign to the variable declared above)
  renderFileList = () => {
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      fileList.appendChild(renderFileItem(file, index));
    });
  };

  // Handle file selection
  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    // Check max files
    if (multiple && maxFiles && selectedFiles.length + fileArray.length > maxFiles) {
      onError?.(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validFiles: File[] = [];
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        onError?.(error);
      } else {
        validFiles.push(file);
      }
    }

    if (multiple) {
      selectedFiles = [...selectedFiles, ...validFiles];
    } else {
      selectedFiles = validFiles.slice(0, 1);
    }

    renderFileList();
    onSelect?.(selectedFiles);
  };

  // Input change handler
  input.addEventListener('change', () => {
    if (input.files) {
      handleFiles(input.files);
      input.value = '';
    }
  });

  // Drag and drop handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer?.files) {
      handleFiles(e.dataTransfer.files);
    }
  });

  return wrapper;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get selected files from a file upload component
 */
export function getUploadedFiles(_wrapper: HTMLElement): File[] {
  // Note: This requires storing files in a data attribute or closure
  // For now, return empty - files are handled via onSelect callback
  return [];
}

/**
 * Clear all files from a file upload component
 */
export function clearFileUpload(wrapper: HTMLElement): void {
  const fileList = wrapper.querySelector('.file-upload-list');
  if (fileList) {
    fileList.innerHTML = '';
  }
  const input = wrapper.querySelector('.file-upload-input') as HTMLInputElement;
  if (input) {
    input.value = '';
  }
}
