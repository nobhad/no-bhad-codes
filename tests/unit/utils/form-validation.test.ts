/**
 * ===============================================
 * FORM VALIDATION TESTS
 * ===============================================
 * @file tests/unit/utils/form-validation.test.ts
 *
 * Unit tests for form validation utilities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateFormCompletion,
  initFormValidation,
  initAllFormsValidation,
} from '../../../src/utils/form-validation';

describe('Form Validation', () => {
  let form: HTMLFormElement;
  let submitButton: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    form = document.createElement('form');
    submitButton = document.createElement('button');
    submitButton.className = 'form-button';
    form.appendChild(submitButton);
    document.body.appendChild(form);
  });

  describe('validateFormCompletion', () => {
    it('should add form-valid class when all required fields are filled', () => {
      const input1 = document.createElement('input');
      input1.type = 'text';
      input1.required = true;
      input1.value = 'test value';

      const input2 = document.createElement('input');
      input2.type = 'email';
      input2.required = true;
      input2.value = 'test@example.com';

      form.appendChild(input1);
      form.appendChild(input2);

      validateFormCompletion(form);

      expect(submitButton.classList.contains('form-valid')).toBe(true);
    });

    it('should remove form-valid class when required fields are empty', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.required = true;
      input.value = '';

      form.appendChild(input);
      submitButton.classList.add('form-valid');

      validateFormCompletion(form);

      expect(submitButton.classList.contains('form-valid')).toBe(false);
    });

    it('should handle forms without submit button', () => {
      const formWithoutButton = document.createElement('form');
      const input = document.createElement('input');
      input.required = true;
      input.value = 'test';

      formWithoutButton.appendChild(input);

      // Should not throw
      expect(() => validateFormCompletion(formWithoutButton)).not.toThrow();
    });

    it('should handle select elements', () => {
      const select = document.createElement('select');
      select.required = true;
      const option = document.createElement('option');
      option.value = 'test';
      option.textContent = 'Test';
      select.appendChild(option);
      select.value = 'test';

      form.appendChild(select);

      validateFormCompletion(form);

      expect(submitButton.classList.contains('form-valid')).toBe(true);
    });

    it('should handle textarea elements', () => {
      const textarea = document.createElement('textarea');
      textarea.required = true;
      textarea.value = 'test message';

      form.appendChild(textarea);

      validateFormCompletion(form);

      expect(submitButton.classList.contains('form-valid')).toBe(true);
    });

    it('should trim whitespace when checking values', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.required = true;
      input.value = '   '; // Only whitespace

      form.appendChild(input);

      validateFormCompletion(form);

      expect(submitButton.classList.contains('form-valid')).toBe(false);
    });
  });

  describe('initFormValidation', () => {
    it('should add event listeners to required fields', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.required = true;
      form.appendChild(input);

      const addEventListenerSpy = vi.spyOn(input, 'addEventListener');

      initFormValidation(form);

      expect(addEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should call validateFormCompletion on input change', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.required = true;
      input.value = 'test';
      form.appendChild(input);

      initFormValidation(form);

      // Verify initial state
      expect(submitButton.classList.contains('form-valid')).toBe(true);

      // Clear input and trigger change
      input.value = '';
      input.dispatchEvent(new Event('input'));

      // Should update button state
      expect(submitButton.classList.contains('form-valid')).toBe(false);
    });

    it('should perform initial validation check', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.required = true;
      input.value = 'test';
      form.appendChild(input);

      initFormValidation(form);

      // Initial validation should have run
      expect(submitButton.classList.contains('form-valid')).toBe(true);
    });
  });

  describe('initAllFormsValidation', () => {
    it('should initialize validation for all forms on page', () => {
      const form1 = document.createElement('form');
      const form2 = document.createElement('form');
      document.body.appendChild(form1);
      document.body.appendChild(form2);

      const initSpy = vi.spyOn(
        { initFormValidation },
        'initFormValidation' as any
      );

      initAllFormsValidation();

      // Should have been called for each form
      expect(document.querySelectorAll('form').length).toBeGreaterThan(0);
    });

    it('should handle pages with no forms', () => {
      document.body.innerHTML = '';

      expect(() => initAllFormsValidation()).not.toThrow();
    });
  });
});
