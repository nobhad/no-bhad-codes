/**
 * ===============================================
 * FORM VALIDATION UTILITIES
 * ===============================================
 * @file src/utils/form-validation.ts
 *
 * Universal form validation utilities for all forms across the site.
 */

/**
 * Check if all required fields in a form are filled and update button state
 */
export function validateFormCompletion(form: HTMLFormElement): void {
  const requiredFields = form.querySelectorAll(
    'input[required], select[required], textarea[required]'
  );
  const submitButton = form.querySelector('.form-button') as HTMLButtonElement | HTMLInputElement;

  if (!submitButton) return;

  let allFieldsFilled = true;

  requiredFields.forEach((field) => {
    const input = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!input.value.trim()) {
      allFieldsFilled = false;
    }
  });

  if (allFieldsFilled) {
    submitButton.classList.add('form-valid');
  } else {
    submitButton.classList.remove('form-valid');
  }
}

/**
 * Initialize form validation on a form element
 */
export function initFormValidation(form: HTMLFormElement): void {
  const requiredFields = form.querySelectorAll(
    'input[required], select[required], textarea[required]'
  );

  // Check validation on input changes
  requiredFields.forEach((field) => {
    field.addEventListener('input', () => validateFormCompletion(form));
    field.addEventListener('change', () => validateFormCompletion(form));
  });

  // Initial validation check
  validateFormCompletion(form);
}

/**
 * Initialize form validation for all forms on the page
 */
export function initAllFormsValidation(): void {
  const forms = document.querySelectorAll('form');
  forms.forEach((form) => initFormValidation(form as HTMLFormElement));
}
