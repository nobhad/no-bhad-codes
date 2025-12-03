/**
 * ===============================================
 * CONTACT FORM HANDLER - UPDATED
 * ===============================================
 *
 * @file src/modules/contact-form.ts
 *
 * Handles contact form submission with client-side validation
 * and integrated contact service support.
 *
 * ===============================================
 */

import { BaseModule } from './base';
import {
  ContactService,
  type ContactFormData,
  type ContactBackend
} from '../services/contact-service';
import { SanitizationUtils } from '../utils/sanitization-utils';
import type { ModuleOptions } from '../types/modules';

export interface ContactFormModuleOptions extends ModuleOptions {
  backend?: ContactBackend;
  formId?: string;
  apiKey?: string;
  endpoint?: string;
}

export class ContactFormModule extends BaseModule {
  private form: HTMLFormElement | null = null;
  private submitButton: HTMLButtonElement | null = null;
  private isSubmitting = false;
  private contactService: ContactService;

  constructor(options: ContactFormModuleOptions = {}) {
    super('contact-form', { debug: true, ...options });

    // Initialize contact service with configuration
    this.contactService = new ContactService({
      backend: options.backend || 'netlify',
      formId: options.formId || '',
      apiKey: options.apiKey || '',
      endpoint: options.endpoint || ''
    });

    // Bind methods
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
  }

  override async onInit() {
    // Initialize contact service first
    await this.contactService.init();

    this.form = this.getElement('Contact form', '.contact-form', true) as HTMLFormElement;
    this.submitButton = this.getElement('Submit button', '.form-button', true) as HTMLButtonElement;

    if (this.form) {
      this.setupEventListeners();
      this.log('Contact form initialized with backend:', this.contactService.getConfig().backend);
    }
  }

  setupEventListeners(): void {
    this.addEventListener(this.form!, 'submit', this.handleSubmit);

    // Add input validation listeners
    const inputs = this.form!.querySelectorAll('input, select, textarea');
    inputs.forEach((input) => {
      this.addEventListener(input, 'input', this.handleInputChange);
      this.addEventListener(input, 'blur', this.handleInputChange);
    });

    // Setup form validation for submit button
    this.setupFormValidation();
  }

  private setupFormValidation(): void {
    if (!this.form || !this.submitButton) return;

    // Disable browser validation in favor of custom validation
    this.form.noValidate = true;

    const validateForm = () => {
      const requiredFields = this.form!.querySelectorAll(
        'input[data-required], select[data-required], textarea[data-required]'
      );
      const isValid = Array.from(requiredFields).every((field) => {
        const input = field as any;
        return input.value && input.value.trim() !== '';
      });

      if (this.submitButton) {
        if (isValid) {
          this.submitButton.classList.add('form-valid');
        } else {
          this.submitButton.classList.remove('form-valid');
        }
      }
    };

    // Add input event listeners to all form fields
    const allFields = this.form.querySelectorAll('input, select, textarea');
    allFields.forEach((field) => {
      this.addEventListener(field, 'input', validateForm);
      this.addEventListener(field, 'change', validateForm);
    });

    // Initial validation
    validateForm();
  }

  handleInputChange(e: Event) {
    // Only check for security issues on input, don't validate (validation happens on submit)
    this.checkForSecurityIssues(e.target as HTMLInputElement);
  }

  validateField(field: Element) {
    const inputField = field as HTMLInputElement;
    const value = inputField.value.trim();
    let isValid = true;
    let errorMessage = '';
    const isRequired = inputField.hasAttribute('data-required');

    // Get the parent form-group
    const formGroup = field.closest('.form-group');

    // Remove existing error styling
    formGroup?.classList.remove('error');
    field.classList.remove('error');
    this.removeErrorMessage(field);

    // Validate based on field type
    if (inputField.tagName === 'TEXTAREA') {
      if (isRequired && value.length < 10) {
        isValid = false;
        errorMessage = 'Please provide a more detailed message';
      }
    } else {
      switch (inputField.type) {
      case 'email':
        if (value && !this.isValidEmail(value)) {
          isValid = false;
          errorMessage = 'Please enter a valid email address';
        } else if (isRequired && !value) {
          isValid = false;
          errorMessage = 'Email is required';
        }
        break;
      case 'text':
        if (isRequired && value.length < 2) {
          isValid = false;
          errorMessage =
              inputField.name === 'name'
                ? 'Name is required'
                : 'This field must be at least 2 characters';
        }
        break;
      }
    }

    if (!isValid) {
      this.showFieldError(field, errorMessage);
    }

    return isValid;
  }

  isValidEmail(email: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  showFieldError(field: Element, message: string) {
    // Add error class to form-group parent for better styling control
    const formGroup = field.closest('.form-group');
    if (formGroup) {
      formGroup.classList.add('error');
    }

    field.classList.add('error');

    // Check if error message container already exists
    const existingError = formGroup?.querySelector('.error-message') as HTMLElement;
    if (existingError) {
      existingError.textContent = message;
      existingError.style.display = 'block';
    } else {
      // Create new error message
      const errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      errorDiv.textContent = message;
      field.parentNode?.insertBefore(errorDiv, field.nextSibling);
    }
  }

  removeErrorMessage(field: Element) {
    const formGroup = field.closest('.form-group');

    // Hide existing error-message span
    const errorSpan = formGroup?.querySelector('.error-message') as HTMLElement;
    if (errorSpan) {
      errorSpan.style.display = 'none';
      errorSpan.textContent = '';
    }

    // Remove field-error divs
    const errorDiv = field.parentNode?.querySelector('.field-error');
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  async handleSubmit(e: Event) {
    e.preventDefault();

    if (this.isSubmitting) return;

    this.log('Form submission started');

    // Gather form data
    const formData = this.gatherFormData();

    // Validate form data using contact service
    const validation = this.contactService.validateFormData(formData);
    if (!validation.valid) {
      this.showValidationErrors(validation.errors);
      return;
    }

    this.isSubmitting = true;
    this.setSubmitButtonState(true);

    try {
      // Use contact service to submit form
      const result = await this.contactService.submitForm(formData as ContactFormData);

      if (result.success) {
        this.showFormMessage(result.message, 'success');
        this.form?.reset();
        this.clearAllErrors();
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      this.error('Form submission failed:', error);
      this.showFormMessage(
        'Sorry, there was an error sending your message. Please try again.',
        'error'
      );
    } finally {
      this.isSubmitting = false;
      this.setSubmitButtonState(false);
    }
  }

  /**
   * Gather form data into ContactFormData structure with client-side sanitization
   */
  private gatherFormData(): Partial<ContactFormData> {
    if (!this.form) return {};

    const formData = new FormData(this.form);

    const rawData = {
      firstName: formData.get('First-Name')?.toString().trim() || '',
      lastName: formData.get('Last-Name')?.toString().trim() || '',
      email: formData.get('Email')?.toString().trim() || '',
      companyName: formData.get('Company-Name')?.toString().trim(),
      inquiryType: formData.get('Inquiry-Type')?.toString() || '',
      projectType: formData.get('Project-Type')?.toString() || '',
      timeline: formData.get('Timeline')?.toString() || '',
      budgetRange: formData.get('Budget-Range')?.toString() || '',
      message: formData.get('Project-Description')?.toString().trim() || ''
    };

    // Apply client-side sanitization as first defense layer
    return {
      firstName: SanitizationUtils.sanitizeText(rawData.firstName),
      lastName: SanitizationUtils.sanitizeText(rawData.lastName),
      email: SanitizationUtils.sanitizeEmail(rawData.email),
      companyName: rawData.companyName ? SanitizationUtils.sanitizeText(rawData.companyName) : '',
      inquiryType: SanitizationUtils.sanitizeText(rawData.inquiryType),
      projectType: rawData.projectType ? SanitizationUtils.sanitizeText(rawData.projectType) : undefined,
      timeline: rawData.timeline ? SanitizationUtils.sanitizeText(rawData.timeline) : undefined,
      budgetRange: rawData.budgetRange ? SanitizationUtils.sanitizeText(rawData.budgetRange) : undefined,
      message: SanitizationUtils.sanitizeMessage(rawData.message)
    };
  }

  /**
   * Show validation errors
   */
  private showValidationErrors(errors: string[]) {
    this.clearAllErrors();

    errors.forEach((error) => {
      this.log('Validation error:', error);
    });

    // Join with newline - showFormMessage uses textContent so HTML won't render
    this.showFormMessage(errors.join('\n'), 'error');
  }

  /**
   * Clear all field errors
   */
  private clearAllErrors() {
    const errorMessages = this.form?.querySelectorAll('.field-error');
    errorMessages?.forEach((error) => error.remove());

    const errorFields = this.form?.querySelectorAll('.error');
    errorFields?.forEach((field) => field.classList.remove('error'));
  }

  validateForm(): boolean {
    const inputs = this.form!.querySelectorAll(
      'input[data-required], select[data-required], textarea[data-required]'
    );
    let allValid = true;

    inputs.forEach((input) => {
      if (!this.validateField(input)) {
        allValid = false;
      }
    });

    return allValid;
  }

  setSubmitButtonState(isLoading: boolean) {
    if (!this.submitButton) return;

    if (isLoading) {
      this.submitButton.disabled = true;
      this.submitButton.textContent = 'Sending...';
      this.submitButton.classList.add('loading');
    } else {
      this.submitButton.disabled = false;
      this.submitButton.textContent = 'Let\'s Talk';
      this.submitButton.classList.remove('loading');
    }
  }

  showFormMessage(message: string, type: string) {
    // Remove existing message
    const existingMessage = this.form!.querySelector('.form-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `form-message ${type}`;

    // Handle multiple error messages by creating separate lines
    // Use textContent for each line to prevent XSS
    const lines = message.split('\n');
    if (lines.length > 1) {
      lines.forEach((line, index) => {
        const span = document.createElement('span');
        span.textContent = line;
        messageDiv.appendChild(span);
        if (index < lines.length - 1) {
          messageDiv.appendChild(document.createElement('br'));
        }
      });
    } else {
      messageDiv.textContent = message;
    }

    this.form!.insertBefore(messageDiv, this.form!.firstChild);

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 5000);
    }
  }

  // Email service integrations
  async submitToNetlify(data: any) {
    // For Netlify Forms, we need to submit as form-encoded data
    const params = new URLSearchParams();
    params.append('form-name', 'contact-form');

    Object.entries(data).forEach(([key, value]) => {
      params.append(key, String(value));
    });

    const response = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (response.ok) {
      return { success: true };
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  async submitToFormspree(data: any) {
    // Replace 'your-form-id' with actual Formspree endpoint
    const response = await fetch('https://formspree.io/f/your-form-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      return { success: true };
    }
    const errorData = await response.json();
    throw new Error(errorData.message || 'Formspree submission failed');
  }

  async submitToEmailJS(_data: any) {
    // EmailJS integration would go here
    // This requires EmailJS SDK and proper configuration
    return { success: false, error: 'EmailJS not configured' };
  }

  /**
   * Check for security issues in real-time input
   */
  checkForSecurityIssues(field: HTMLInputElement) {
    const { value } = field;

    // Check for XSS patterns
    if (SanitizationUtils.detectXss(value)) {
      this.showFieldError(
        field,
        'Invalid characters detected. Please remove any HTML or script tags.'
      );
      SanitizationUtils.logSecurityViolation(
        'client_xss_attempt',
        {
          fieldName: field.name || field.id,
          fieldType: field.type,
          value: SanitizationUtils.sanitizeText(value)
        },
        navigator.userAgent
      );
    }

    // Check for extremely long input (potential DoS)
    if (value.length > 5000) {
      this.showFieldError(field, 'Input too long. Please shorten your message.');
      SanitizationUtils.logSecurityViolation(
        'input_length_violation',
        {
          fieldName: field.name || field.id,
          length: value.length
        },
        navigator.userAgent
      );
    }
  }

  override async onDestroy(): Promise<void> {
    this.isSubmitting = false;
    await super.onDestroy();
  }
}
