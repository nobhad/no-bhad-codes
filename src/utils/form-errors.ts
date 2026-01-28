/**
 * ===============================================
 * INLINE FORM ERROR UTILITIES
 * ===============================================
 * @file src/utils/form-errors.ts
 *
 * Utilities for showing inline validation errors below form fields.
 * Provides consistent error display with proper accessibility.
 */

/** Error element class for styling */
const ERROR_CLASS = 'field-error';
const ERROR_VISIBLE_CLASS = 'field-error--visible';
const FIELD_INVALID_CLASS = 'field--invalid';

/**
 * Show an inline error message below a form field
 *
 * @param field - The input/select/textarea element
 * @param message - The error message to display
 */
export function showFieldError(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null,
  message: string
): void {
  if (!field) return;

  // Add invalid class to field
  field.classList.add(FIELD_INVALID_CLASS);
  field.setAttribute('aria-invalid', 'true');

  // Find or create error element
  let errorEl = getFieldErrorElement(field);

  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = ERROR_CLASS;
    errorEl.id = `${field.id || field.name}-error`;

    // Insert after the field (or after its wrapper if it has one)
    const wrapper = field.closest('.form-group, .field-wrapper');
    if (wrapper) {
      wrapper.appendChild(errorEl);
    } else {
      field.insertAdjacentElement('afterend', errorEl);
    }
  }

  // Set error message and make visible
  errorEl.textContent = message;
  errorEl.classList.add(ERROR_VISIBLE_CLASS);
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'polite');

  // Associate error with field for screen readers
  field.setAttribute('aria-describedby', errorEl.id);
}

/**
 * Clear the inline error message for a form field
 *
 * @param field - The input/select/textarea element
 */
export function clearFieldError(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
): void {
  if (!field) return;

  // Remove invalid class from field
  field.classList.remove(FIELD_INVALID_CLASS);
  field.removeAttribute('aria-invalid');
  field.removeAttribute('aria-describedby');

  // Hide error element
  const errorEl = getFieldErrorElement(field);
  if (errorEl) {
    errorEl.classList.remove(ERROR_VISIBLE_CLASS);
    errorEl.textContent = '';
    errorEl.removeAttribute('role');
    errorEl.removeAttribute('aria-live');
  }
}

/**
 * Clear all field errors in a form
 *
 * @param form - The form element
 */
export function clearAllFieldErrors(form: HTMLFormElement | null): void {
  if (!form) return;

  const fields = form.querySelectorAll('input, select, textarea');
  fields.forEach((field) => {
    clearFieldError(field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement);
  });
}

/**
 * Show multiple field errors at once
 *
 * @param errors - Object mapping field names/ids to error messages
 * @param form - Optional form element to scope the search
 */
export function showFieldErrors(
  errors: Record<string, string>,
  form?: HTMLFormElement | null
): void {
  const container = form || document;

  Object.entries(errors).forEach(([fieldName, message]) => {
    const field = container.querySelector(
      `#${fieldName}, [name="${fieldName}"]`
    ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

    if (field) {
      showFieldError(field, message);
    }
  });
}

/**
 * Get the error element for a field (if it exists)
 */
function getFieldErrorElement(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): HTMLElement | null {
  const errorId = `${field.id || field.name}-error`;
  return document.getElementById(errorId);
}

/**
 * Validate a field and show error if invalid
 * Returns true if valid, false if invalid
 *
 * @param field - The field to validate
 * @param validator - Function that returns error message or null if valid
 */
export function validateField(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null,
  validator: (value: string) => string | null
): boolean {
  if (!field) return true;

  const errorMessage = validator(field.value);

  if (errorMessage) {
    showFieldError(field, errorMessage);
    return false;
  }

  clearFieldError(field);
  return true;
}

/**
 * Common validators
 */
export const validators = {
  required: (label = 'This field') => (value: string): string | null =>
    value.trim() ? null : `${label} is required`,

  email: (value: string): string | null => {
    if (!value.trim()) return null; // Use required validator for empty check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Please enter a valid email address';
  },

  minLength: (min: number, label = 'This field') => (value: string): string | null =>
    value.length >= min ? null : `${label} must be at least ${min} characters`,

  maxLength: (max: number, label = 'This field') => (value: string): string | null =>
    value.length <= max ? null : `${label} must be no more than ${max} characters`,

  numeric: (value: string): string | null => {
    if (!value.trim()) return null;
    return /^\d+$/.test(value) ? null : 'Please enter a valid number';
  },

  currency: (value: string): string | null => {
    if (!value.trim()) return null;
    return /^\d+(\.\d{1,2})?$/.test(value) ? null : 'Please enter a valid amount';
  }
};
