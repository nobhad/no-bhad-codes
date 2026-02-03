/**
 * ===============================================
 * FORM SELECT (REUSABLE)
 * ===============================================
 * @file src/components/form-select.ts
 *
 * Reusable dropdown for forms: modals, inline forms (client, category, type,
 * status). Native <select> with form-input styling; use setOptions() when data
 * loads. For table cells and table header filters use createTableDropdown.
 */

import {
  createFilterSelect,
  type FilterSelectConfig,
  type FilterSelectInstance,
  type FilterSelectOption
} from './filter-select';

export type FormSelectOption = FilterSelectOption;

export interface FormSelectConfig extends Omit<FilterSelectConfig, 'className'> {
  /** Optional class name(s); default "form-input" for form context. */
  className?: string;
}

/**
 * Create a form select. Use in modals and inline forms (client, category,
 * type, status). Mount in a div (e.g. id="-mount"); call setOptions() when
 * data loads. For table cells and table filters use createTableDropdown.
 */
export function createFormSelect(config: FormSelectConfig): FilterSelectInstance {
  return createFilterSelect({
    ...config,
    className: config.className ?? 'form-input'
  });
}

export type FormSelectInstance = FilterSelectInstance;
