/**
 * ===============================================
 * FILTER SELECT / DROPDOWN (REUSABLE)
 * ===============================================
 * @file src/components/filter-select.ts
 *
 * Single reusable component for all dropdowns: table filters, form selects.
 * Uses .admin-filter-select or .form-input styling. Call setOptions() when data loads.
 */

export interface FilterSelectOption {
  value: string;
  label: string;
}

export interface FilterSelectConfig {
  /** Optional id for the select (e.g. for form submission / getElementById) */
  id?: string;
  /** aria-label (required for a11y) */
  ariaLabel: string;
  /** First option label (e.g. "All categories"); omit for no empty option */
  emptyOption?: string;
  /** Initial options (can be empty; use setOptions after load) */
  options: FilterSelectOption[];
  /** Currently selected value */
  value: string;
  /** Called when user changes selection (optional for form selects) */
  onChange?: (value: string) => void;
  /** Optional class name(s); default "admin-filter-select" */
  className?: string;
  /** HTML required attribute */
  required?: boolean;
  /** HTML name attribute (for form submission) */
  name?: string;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export interface FilterSelectInstance {
  element: HTMLSelectElement;
  setOptions: (options: FilterSelectOption[], selectedValue?: string) => void;
}

/**
 * Create a filter select. Returns the select element and setOptions to update
 * options after data loads (e.g. categories). Mount the element where the
 * filter should appear.
 */
export function createFilterSelect(config: FilterSelectConfig): FilterSelectInstance {
  const {
    id,
    ariaLabel,
    emptyOption,
    options,
    value,
    onChange,
    className = 'admin-filter-select',
    required = false,
    name
  } = config;

  const select = document.createElement('select');
  select.className = className;
  if (id) select.id = id;
  select.setAttribute('aria-label', ariaLabel);
  if (required) select.required = true;
  if (name) select.name = name;

  function buildOptionsHtml(opts: FilterSelectOption[]): string {
    const optionRows = opts.map(
      (o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
    );
    const empty = emptyOption !== null && emptyOption !== undefined ? `<option value="">${escapeHtml(emptyOption)}</option>` : '';
    return empty + optionRows.join('');
  }

  select.innerHTML = buildOptionsHtml(options);
  select.value = value;

  if (onChange) {
    select.addEventListener('change', () => {
      onChange(select.value);
    });
  }

  function setOptions(opts: FilterSelectOption[], selectedValue?: string): void {
    select.innerHTML = buildOptionsHtml(opts);
    if (selectedValue !== undefined) select.value = selectedValue;
  }

  return { element: select, setOptions };
}
