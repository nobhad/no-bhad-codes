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
import { getFormspreeUrl } from '../../config/api';
import type { ModuleOptions } from '../../types/modules';
import { gsap } from 'gsap';
import { getDebugMode } from '../../core/env';
import { validateEmail } from '../../../shared/validation/validators';
import { TIMING } from '../../constants/timing';
import { INPUT_LIMITS } from '../../constants/thresholds';
import { initArrowCallouts } from '../../components/arrow-callout/arrow-callout.js';
import type { ArrowCalloutController } from '../../components/arrow-callout/arrow-callout.js';
import {
  ARROW_SUCCESS,
  ARROW_SIZE_STEPS,
  arrowSayValidation,
  arrowSayFailure
} from '../../constants/arrow-copy';

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
  /** Arrow — the mascot who speaks every piece of feedback this form gives. */
  private arrow: ArrowCalloutController | null = null;
  private arrowEl: HTMLElement | null = null;

  constructor(options: ContactFormModuleOptions = {}) {
    super('contact-form', { debug: getDebugMode(), ...options });

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
    this.submitButton = this.getElement(
      'Submit button',
      '.submit-button',
      true
    ) as HTMLButtonElement;

    if (this.form) {
      this.setupEventListeners();
      this.setupArrow();
      this.log('Contact form initialized with backend:', this.contactService.getConfig().backend);
    }
  }

  /**
   * Wire the Arrow callout. Manual mode: she is off screen until this module
   * asks for her, so she never sits over the form waiting for an event.
   */
  private setupArrow(): void {
    this.arrowEl = document.querySelector<HTMLElement>('[data-callout-id="contact-feedback"]');
    if (!this.arrowEl) {
      this.warn('Arrow callout markup not found — form feedback will be silent');
      return;
    }
    this.arrow = initArrowCallouts({ exitMs: TIMING.ARROW_EXIT_DURATION });
    this.log('Arrow callout initialized');
  }

  /** True at widths where Arrow has no gutter to stand in and must be brief. */
  private get isNarrowViewport(): boolean {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  /**
   * Everything the form says to a visitor goes through here.
   *
   * On mobile she auto-dips after a read-length pause, because at that width
   * she necessarily overlaps the form; on desktop she parks in the gutter and
   * waits to be dismissed.
   */
  private arrowSay(message: string): void {
    // Size the bubble to what's in it BEFORE opening, so she animates in at
    // her final size instead of popping and then resizing. The art is fixed
    // 540x500 line-work, so the whole canvas scales as one — a stretched
    // bubble would distort its corners and tail.
    if (this.arrowEl) {
      this.arrowEl.dataset.arrowSize =
        message.length <= ARROW_SIZE_STEPS.SHORT_MAX_CHARS
          ? 'short'
          : message.length <= ARROW_SIZE_STEPS.MEDIUM_MAX_CHARS
            ? 'medium'
            : 'long';
    }
    this.arrow?.open('contact-feedback', message, {
      autoCloseMs: this.isNarrowViewport ? TIMING.ARROW_MOBILE_AUTO_HIDE : 0
    });
  }

  /**
   * Bring her on with the bubble closed — standing by, not talking.
   *
   * She turns up as soon as someone starts typing, which is the point at which
   * she becomes relevant, and stays put. The bubble is reserved for actual
   * messages: a speech balloon with nothing to say is furniture, and it covers
   * part of the form to say it.
   */
  private arrowSummon(): void {
    this.arrow?.summon('contact-feedback');
  }

  /** Put her away — e.g. the visitor started fixing the thing she flagged. */
  private arrowHush(): void {
    this.arrow?.close('contact-feedback');
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
        'input[required], select[required], textarea[required]'
      );

      const isValid = Array.from(requiredFields).every((field) => {
        const input = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const value = input.value?.trim() || '';

        // Message field requires minimum 10 characters
        if (input.id === 'message' || input.name === 'Message') {
          return value.length >= 10;
        }
        return value !== '';
      });

      this.log('Form validation:', {
        requiredFieldsCount: requiredFields.length,
        isValid,
        touchedFields: Array.from(touchedFields),
        buttonElement: this.submitButton?.tagName
      });

      if (this.submitButton) {
        // Toggle valid state; arrow only flies off on send, never points at fields
        this.submitButton.classList.remove(
          'form-valid',
          'point-to-name',
          'point-to-email',
          'point-to-message'
        );

        if (isValid) {
          this.submitButton.classList.add('form-valid');
          this.log('Added form-valid class');
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
    // Arrow steps in the moment someone starts typing. Not once — every
    // keystroke re-asserts it, so she comes back if she has been dismissed or
    // has auto-dipped on mobile, and the latch is the bubble itself rather
    // than a boolean: while she is mid-sentence, summon() would close the
    // blurb she is holding, so leave her alone until she has finished.
    const keepArrowStandingBy = (): void => {
      if (this.arrow?.isOpen('contact-feedback')) {return;}
      this.arrowSummon();
    };

    const allFields = this.form.querySelectorAll('input:not([type="submit"]), select, textarea');
    allFields.forEach((field) => {
      field.addEventListener('input', keepArrowStandingBy);
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
    const isRequired = inputField.hasAttribute('required');

    // Remove existing error styling
    this.removeErrorMessage(field);

    // Validate based on field type
    if (inputField.tagName === 'TEXTAREA') {
      if (isRequired && value.length < 10) {
        isValid = false;
      }
    } else {
      switch (inputField.type) {
        case 'email':
          if (value && !this.isValidEmail(value)) {
            isValid = false;
          } else if (isRequired && !value) {
            isValid = false;
          }
          break;
        case 'text':
          if (isRequired && value.length < 2) {
            isValid = false;
          }
          break;
      }
    }

    if (!isValid) {
      this.showFieldError(field, '');
    }

    return isValid;
  }

  isValidEmail(email: string) {
    // Use shared validator for consistency across codebase
    const result = validateEmail(email, { allowDisposable: true });
    return result.isValid;
  }

  showFieldError(field: Element, _message: string) {
    const inputField = field as HTMLInputElement | HTMLTextAreaElement;
    const inputItem = field.closest('.input-item');
    if (inputItem) {
      inputItem.classList.add('error');
    }
    field.classList.add('error');
    inputField.setAttribute('aria-invalid', 'true');
  }

  removeErrorMessage(field: Element) {
    const inputField = field as HTMLInputElement | HTMLTextAreaElement;
    const inputItem = field.closest('.input-item');
    if (inputItem) {
      inputItem.classList.remove('error');
    }
    field.classList.remove('error');
    inputField.removeAttribute('aria-invalid');
    inputField.removeAttribute('aria-describedby');
  }

  async handleSubmit(e: Event) {
    e.preventDefault();

    if (this.isSubmitting) {
      return;
    }

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
        // Play the button's bow-and-arrow animation, THEN let Arrow speak —
        // two things popping at once reads as a glitch. (Unrelated arrows:
        // that one is the submit icon, this one is the mascot.)
        await this.playArrowFlyAnimation();
        this.arrowSay(ARROW_SUCCESS);
      } else {
        // result.message is the developer-facing string and is what gets
        // logged; Arrow translates the status into something actionable.
        this.error('Form submission rejected:', result.error ?? result.message);
        this.arrowSay(arrowSayFailure(result.status ?? null, result.message));
      }
    } catch (error) {
      this.error('Form submission failed:', error);
      // No response at all — offline, DNS, aborted. Status is genuinely unknown.
      this.arrowSay(arrowSayFailure(null, error instanceof Error ? error.message : ''));
    } finally {
      this.isSubmitting = false;
      this.setSubmitButtonState(false);
    }
  }

  /**
   * Gather form data into ContactFormData structure with client-side sanitization
   */
  private gatherFormData(): Partial<ContactFormData> {
    if (!this.form) {
      return {};
    }

    const formData = new FormData(this.form);

    const rawData = {
      name: formData.get('Name')?.toString().trim() || '',
      email: formData.get('Email')?.toString().trim() || '',
      companyName: formData.get('Company-Name')?.toString().trim(),
      message: formData.get('Message')?.toString().trim() || ''
    };

    // Apply client-side sanitization as first defense layer.
    //
    // Email is deliberately NOT put through sanitizeEmail here. That helper
    // returns '' for anything failing its format regex, which made a malformed
    // address indistinguishable from a missing one: type "you@gmial" and the
    // form told you to ADD an email you could plainly see you had typed.
    // Stripping HTML and normalising case gives validateFormData something it
    // can actually judge, so it can say "check that email" instead.
    //
    // This does not loosen what gets SENT: ContactService.submitForm runs
    // sanitizeFormData (and therefore sanitizeEmail) over this object before it
    // touches the network, and the server validates independently. The looser
    // value never leaves the client.
    return {
      name: SanitizationUtils.sanitizeText(rawData.name),
      email: SanitizationUtils.stripHtml(rawData.email.trim().toLowerCase()),
      companyName: rawData.companyName ? SanitizationUtils.sanitizeText(rawData.companyName) : '',
      message: SanitizationUtils.sanitizeMessage(rawData.message)
    };
  }

  /**
   * Show validation errors as inline messages on fields
   * Uses the same pattern as portal forms for consistency
   */
  private showValidationErrors(errors: string[]) {
    this.clearAllErrors();

    let firstErrorField: Element | null = null;

    errors.forEach((error) => {
      this.log('Validation error:', error);

      // Map error message to field and highlight it
      let fieldSelector = '';
      if (error.toLowerCase().includes('name')) {
        fieldSelector = 'input[name="Name"]';
      } else if (error.toLowerCase().includes('email')) {
        fieldSelector = 'input[name="Email"]';
      } else if (error.toLowerCase().includes('message')) {
        fieldSelector = 'textarea[name="Message"]';
      }

      if (fieldSelector) {
        const field = this.form?.querySelector(fieldSelector);
        if (field) {
          this.showFieldError(field, error);
          if (!firstErrorField) {
            firstErrorField = field;
          }
        }
      }
    });

    // Arrow carries the wording; the red field outlines set above carry the
    // location. The old .form-error-tooltip did both jobs and did neither well.
    this.arrowSay(arrowSayValidation(errors));

    // Focus on the first field with an error for accessibility
    if (firstErrorField) {
      (firstErrorField as HTMLElement).focus();
    }
  }

  /**
   * Clear all field errors and ARIA attributes
   */
  private clearAllErrors() {
    // Arrow was the one holding the message, so clearing errors puts her away.
    this.arrowHush();

    // Remove error class from input items and fields
    const errorFields = this.form?.querySelectorAll('.error');
    errorFields?.forEach((field) => field.classList.remove('error'));

    // Clear ARIA attributes from all form fields
    this.form?.querySelectorAll('input, select, textarea').forEach((el) => {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
    });
  }

  validateForm(): boolean {
    const inputs = this.form!.querySelectorAll(
      'input[required], select[required], textarea[required]'
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
    if (!this.submitButton) {
      return;
    }

    if (isLoading) {
      this.submitButton.disabled = true;
      this.submitButton.classList.add('loading');
    } else {
      this.submitButton.disabled = false;
      this.submitButton.classList.remove('loading');
    }
  }

  // Email service integrations
  async submitToNetlify(data: Partial<ContactFormData>) {
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

  async submitToFormspree(data: Partial<ContactFormData>) {
    // Get Formspree form ID from environment variable
    const formId = import.meta.env.VITE_FORMSPREE_FORM_ID;

    if (!formId) {
      throw new Error('Formspree form ID not configured in environment variables');
    }

    const response = await fetch(getFormspreeUrl(formId), {
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

  async submitToEmailJS(_data: Partial<ContactFormData>) {
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
          gsap.fromTo(
            buttonSpan,
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
      tl.to(
        bowGroup,
        {
          opacity: 0,
          duration: 0.2,
          ease: 'power1.out'
        },
        '-=0.2'
      );
    });
  }

  /**
   * Check for security issues in real-time input
   */
  checkForSecurityIssues(field: HTMLInputElement) {
    const { value } = field;
    const errors: string[] = [];

    // Check for XSS patterns
    if (SanitizationUtils.detectXss(value)) {
      errors.push('Invalid characters detected. Please remove any HTML or script tags.');
      this.showFieldError(field, '');
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
    if (value.length > INPUT_LIMITS.MAX_INPUT_LENGTH) {
      errors.push('Input too long. Please shorten your message.');
      this.showFieldError(field, '');
      SanitizationUtils.logSecurityViolation(
        'input_length_violation',
        {
          fieldName: field.name || field.id,
          length: value.length
        },
        navigator.userAgent
      );
    }

    if (errors.length > 0) {
      this.arrowSay(arrowSayValidation(errors));
    }
  }

  override async onDestroy(): Promise<void> {
    this.isSubmitting = false;
    // Returns the portaled callout to its section, so an SPA re-entry re-inits
    // against real markup instead of an orphan on <body>.
    this.arrow?.destroy();
    this.arrow = null;
    await super.onDestroy();
  }
}
