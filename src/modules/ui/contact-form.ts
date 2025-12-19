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

import { BaseModule } from '../core/base';
import {
  ContactService,
  type ContactFormData,
  type ContactBackend
} from '../../services/contact-service';
import { SanitizationUtils } from '../../utils/sanitization-utils';
import type { ModuleOptions } from '../../types/modules';
import { gsap } from 'gsap';

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
    this.submitButton = this.getElement('Submit button', '.submit-button', true) as HTMLButtonElement;

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
    if (!this.form || !this.submitButton) {
      this.warn('Form or submit button not found for validation setup');
      return;
    }

    // Disable browser validation in favor of custom validation
    this.form.noValidate = true;

    // Track which fields have been interacted with
    const touchedFields = new Set<string>();

    const validateForm = () => {
      const requiredFields = this.form!.querySelectorAll(
        'input[data-required], select[data-required], textarea[data-required]'
      );

      let firstInvalidField: HTMLElement | null = null;

      const isValid = Array.from(requiredFields).every((field) => {
        const input = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const value = input.value?.trim() || '';

        let fieldValid = true;

        // Message field requires minimum 10 characters
        if (input.id === 'message' || input.name === 'Message') {
          fieldValid = value.length >= 10;
        } else {
          fieldValid = value !== '';
        }

        if (!fieldValid && !firstInvalidField) {
          firstInvalidField = input;
        }

        return fieldValid;
      });

      // Check if message field has been touched
      const messageTouched = touchedFields.has('message') || touchedFields.has('Message');

      this.log('Form validation:', {
        requiredFieldsCount: requiredFields.length,
        isValid,
        messageTouched,
        touchedFields: Array.from(touchedFields),
        buttonElement: this.submitButton?.tagName
      });

      if (this.submitButton) {
        // Remove all arrow direction classes
        this.submitButton.classList.remove('form-valid', 'point-to-name', 'point-to-email', 'point-to-message');

        if (isValid) {
          this.submitButton.classList.add('form-valid');
          this.log('Added form-valid class');
        } else if (messageTouched && firstInvalidField) {
          // Only point to invalid field once message field has been touched
          const fieldId = (firstInvalidField as HTMLInputElement).id || (firstInvalidField as HTMLInputElement).name;
          if (fieldId === 'name' || fieldId === 'Name') {
            this.submitButton.classList.add('point-to-name');
          } else if (fieldId === 'email' || fieldId === 'Email') {
            this.submitButton.classList.add('point-to-email');
          } else if (fieldId === 'message' || fieldId === 'Message') {
            this.submitButton.classList.add('point-to-message');
          }
          this.log('Arrow pointing to:', fieldId);

          // Focus on the invalid field
          (firstInvalidField as HTMLInputElement).focus();
        }
      }
    };

    // Track field interactions
    const markFieldTouched = (e: Event) => {
      const input = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const fieldId = input.id || input.name;
      touchedFields.add(fieldId);
      validateForm();
    };

    // Add input event listeners to all form fields using native addEventListener
    const allFields = this.form.querySelectorAll('input:not([type="submit"]), select, textarea');
    allFields.forEach((field) => {
      field.addEventListener('input', validateForm);
      field.addEventListener('change', validateForm);
      field.addEventListener('blur', markFieldTouched); // Mark as touched when leaving field
    });

    this.log('Form validation setup complete, listening on', allFields.length, 'fields');

    // Don't run initial validation - arrow starts in default position
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
        this.form?.reset();
        this.clearAllErrors();
        // Play arrow animation then show "SENT!"
        await this.playArrowFlyAnimation();
      } else {
        // Show the actual error message from the service
        this.showFormMessage(result.message, 'error');
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
      name: formData.get('Name')?.toString().trim() || '',
      email: formData.get('Email')?.toString().trim() || '',
      companyName: formData.get('Company-Name')?.toString().trim(),
      message: formData.get('Message')?.toString().trim() || ''
    };

    // Apply client-side sanitization as first defense layer
    return {
      name: SanitizationUtils.sanitizeText(rawData.name),
      email: SanitizationUtils.sanitizeEmail(rawData.email),
      companyName: rawData.companyName ? SanitizationUtils.sanitizeText(rawData.companyName) : '',
      message: SanitizationUtils.sanitizeMessage(rawData.message)
    };
  }

  /**
   * Show validation errors as temporary inline messages on fields
   */
  private showValidationErrors(errors: string[]) {
    this.clearAllErrors();

    errors.forEach((error) => {
      this.log('Validation error:', error);

      // Map error message to field
      let fieldSelector = '';
      if (error.toLowerCase().includes('name')) {
        fieldSelector = 'input[name="Name"]';
      } else if (error.toLowerCase().includes('email')) {
        fieldSelector = 'input[name="Email"]';
      } else if (error.toLowerCase().includes('message')) {
        fieldSelector = 'textarea[name="Message"]';
      }

      if (fieldSelector) {
        const field = this.form?.querySelector(fieldSelector) as HTMLElement;
        if (field) {
          this.showTemporaryFieldError(field, error);
        }
      }
    });
  }

  /**
   * Show a temporary popup error on a field
   */
  private showTemporaryFieldError(field: HTMLElement, message: string) {
    // Add error class for red outline
    field.classList.add('field-has-error');

    // Get field position for popup placement
    const rect = field.getBoundingClientRect();

    // Create popup element - fixed position, outside layout
    const popup = document.createElement('div');
    popup.className = 'field-error-popup';
    popup.textContent = message;

    // Position popup at right end of field (fixed positioning)
    popup.style.position = 'fixed';
    popup.style.top = `${rect.top + rect.height / 2}px`;
    popup.style.left = `${rect.right - 16}px`;
    popup.style.transform = 'translate(-100%, -50%)';

    // Append to body, not form (completely outside layout)
    document.body.appendChild(popup);

    // Remove after 3 seconds
    setTimeout(() => {
      field.classList.remove('field-has-error');
      popup.classList.add('fade-out');
      setTimeout(() => popup.remove(), 300);
    }, 3000);
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
      this.submitButton.classList.add('loading');
    } else {
      this.submitButton.disabled = false;
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

    this.form!.appendChild(messageDiv);

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
    // Get Formspree form ID from environment variable
    const formId = import.meta.env.VITE_FORMSPREE_FORM_ID;

    if (!formId) {
      throw new Error('Formspree form ID not configured in environment variables');
    }

    const response = await fetch(`https://formspree.io/f/${formId}`, {
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
   * Play the arrow fly animation on successful form submission
   */
  private playArrowFlyAnimation(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.submitButton) {
        resolve();
        return;
      }

      const svg = this.submitButton.querySelector('svg');
      const arrowGroup = this.submitButton.querySelector('.arrow-group');
      const bowGroup = this.submitButton.querySelector('.bow-group');
      const buttonSpan = this.submitButton.querySelector('span');

      if (!svg || !arrowGroup) {
        // Fallback: just show SENT! if SVG structure not found
        this.submitButton.classList.add('form-sent');
        if (buttonSpan) {
          buttonSpan.textContent = 'SENT!';
        }
        resolve();
        return;
      }

      // Ensure SVG can overflow
      svg.style.overflow = 'visible';
      this.submitButton.style.overflow = 'visible';

      // Create timeline for sequenced animation
      const tl = gsap.timeline({
        onComplete: () => {
          // Show "SENT!" after animation
          this.submitButton?.classList.add('form-sent');
          if (buttonSpan) {
            buttonSpan.textContent = 'SENT!';
          }
          // Fade in the span
          gsap.fromTo(buttonSpan,
            { opacity: 0, scale: 0.5 },
            { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }
          );
          resolve();
        }
      });

      // Phase 1: Pull back the arrow (toward bottom-left)
      tl.to(arrowGroup, {
        x: -4,
        y: 4,
        duration: 0.4,
        ease: 'power2.out'
      });

      // Phase 2: Quick tension hold (pull back a bit more)
      tl.to(arrowGroup, {
        x: -6,
        y: 6,
        duration: 0.15,
        ease: 'power1.in'
      });

      // Phase 3: Arrow flies off along diagonal (to top-right, off screen)
      tl.to(arrowGroup, {
        x: 300,
        y: -300,
        duration: 0.5,
        ease: 'power2.in'
      });

      // Phase 4: Fade out the bow
      tl.to(bowGroup, {
        opacity: 0,
        duration: 0.2,
        ease: 'power1.out'
      }, '-=0.2');
    });
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
