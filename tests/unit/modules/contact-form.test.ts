/**
 * ===============================================
 * CONTACT FORM MODULE TESTS
 * ===============================================
 * @file tests/unit/modules/contact-form.test.ts
 *
 * Unit tests for the contact form module.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContactFormModule } from '../../../src/modules/contact-form.js';

// Mock dependencies
vi.mock('../../../src/services/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/services/contact-service.js', () => ({
  ContactService: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    submitForm: vi.fn(),
    validateForm: vi.fn(),
    validateFormData: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    getConfig: vi.fn().mockReturnValue({ backend: 'netlify' })
  }))
}));

describe('ContactFormModule', () => {
  let container: HTMLElement;
  let contactModule: ContactFormModule;

  beforeEach(() => {
    // Create test container with typical contact form structure
    container = document.createElement('div');
    container.innerHTML = `
      <form id="contact-form" class="contact-form">
        <div class="form-group">
          <label for="contact-name">Name *</label>
          <input type="text" id="contact-name" name="name" required>
          <span class="error-message" style="display: none;"></span>
        </div>
        <div class="form-group">
          <label for="contact-email">Email *</label>
          <input type="email" id="contact-email" name="email" required>
          <span class="error-message" style="display: none;"></span>
        </div>
        <div class="form-group">
          <label for="contact-subject">Subject</label>
          <input type="text" id="contact-subject" name="subject">
        </div>
        <div class="form-group">
          <label for="contact-message">Message *</label>
          <textarea id="contact-message" name="message" required rows="5"></textarea>
          <span class="error-message" style="display: none;"></span>
        </div>
        <div class="form-actions">
          <button type="submit" class="form-button" id="submit-btn">
            <span class="btn-text">Send Message</span>
            <span class="btn-loader" style="display: none;">Sending...</span>
          </button>
        </div>
      </form>
      <div class="form-messages">
        <div class="success-message" style="display: none;"></div>
        <div class="error-message" style="display: none;"></div>
      </div>
    `;

    document.body.appendChild(container);
    contactModule = new ContactFormModule({ debug: false });

    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should initialize contact form module', async () => {
      await contactModule.init();

      expect(contactModule.isInitialized).toBe(true);
      expect(contactModule.name).toBe('contact-form');
    });

    it('should find and bind form elements', async () => {
      await contactModule.init();

      const form = contactModule.find('#contact-form');
      const nameInput = contactModule.find('#contact-name');
      const emailInput = contactModule.find('#contact-email');
      const messageInput = contactModule.find('#contact-message');

      expect(form).toBeTruthy();
      expect(nameInput).toBeTruthy();
      expect(emailInput).toBeTruthy();
      expect(messageInput).toBeTruthy();
    });

    it('should set up form validation', async () => {
      await contactModule.init();

      const form = contactModule.find('#contact-form') as HTMLFormElement;
      expect(form.noValidate).toBe(true); // Should disable browser validation
    });
  });

  describe('Form Validation', () => {
    beforeEach(async () => {
      await contactModule.init();
    });

    it('should validate required fields', () => {
      const nameInput = contactModule.find('#contact-name') as HTMLInputElement;
      const emailInput = contactModule.find('#contact-email') as HTMLInputElement;
      const messageInput = contactModule.find('#contact-message') as HTMLTextAreaElement;

      // Test empty required fields
      nameInput.value = '';
      emailInput.value = '';
      messageInput.value = '';

      nameInput.dispatchEvent(new Event('blur'));
      emailInput.dispatchEvent(new Event('blur'));
      messageInput.dispatchEvent(new Event('blur'));

      const nameGroup = nameInput.closest('.form-group');
      const emailGroup = emailInput.closest('.form-group');
      const messageGroup = messageInput.closest('.form-group');

      expect(nameGroup?.classList.contains('error')).toBe(true);
      expect(emailGroup?.classList.contains('error')).toBe(true);
      expect(messageGroup?.classList.contains('error')).toBe(true);
    });

    it('should validate email format', () => {
      const emailInput = contactModule.find('#contact-email') as HTMLInputElement;

      // Test invalid email
      emailInput.value = 'invalid-email';
      emailInput.dispatchEvent(new Event('blur'));

      const emailGroup = emailInput.closest('.form-group');
      expect(emailGroup?.classList.contains('error')).toBe(true);

      // Test valid email
      emailInput.value = 'valid@example.com';
      emailInput.dispatchEvent(new Event('blur'));

      expect(emailGroup?.classList.contains('error')).toBe(false);
    });

    it('should show validation error messages', () => {
      const nameInput = contactModule.find('#contact-name') as HTMLInputElement;

      nameInput.value = '';
      nameInput.dispatchEvent(new Event('blur'));

      const nameGroup = nameInput.closest('.form-group');
      const errorMessage = nameGroup?.querySelector('.error-message') as HTMLElement;

      expect(errorMessage?.style.display).not.toBe('none');
      expect(errorMessage?.textContent).toContain('Name is required');
    });

    it('should clear validation errors when field becomes valid', () => {
      const nameInput = contactModule.find('#contact-name') as HTMLInputElement;
      const nameGroup = nameInput.closest('.form-group');

      // Make invalid
      nameInput.value = '';
      nameInput.dispatchEvent(new Event('blur'));

      expect(nameGroup?.classList.contains('error')).toBe(true);

      // Make valid
      nameInput.value = 'John Doe';
      nameInput.dispatchEvent(new Event('input'));

      expect(nameGroup?.classList.contains('error')).toBe(false);
    });

    it('should validate minimum message length', () => {
      const messageInput = contactModule.find('#contact-message') as HTMLTextAreaElement;

      messageInput.value = 'Hi'; // Too short
      messageInput.dispatchEvent(new Event('blur'));

      const messageGroup = messageInput.closest('.form-group');
      expect(messageGroup?.classList.contains('error')).toBe(true);

      messageInput.value = 'This is a proper message with enough content.';
      messageInput.dispatchEvent(new Event('input'));

      expect(messageGroup?.classList.contains('error')).toBe(false);
    });
  });

  describe('Form Submission', () => {
    beforeEach(async () => {
      await contactModule.init();
    });

    it('should submit form when valid', async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ success: true });
      (contactModule as any).contactService = { submitForm: mockSubmit };

      // Fill valid form data
      (contactModule.find('#contact-name') as HTMLInputElement).value = 'John Doe';
      (contactModule.find('#contact-email') as HTMLInputElement).value = 'john@example.com';
      (contactModule.find('#contact-subject') as HTMLInputElement).value = 'Test Subject';
      (contactModule.find('#contact-message') as HTMLTextAreaElement).value =
        'This is a test message with sufficient content.';

      const form = contactModule.find('#contact-form') as HTMLFormElement;
      const submitEvent = new Event('submit');
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Test Subject',
          message: 'This is a test message with sufficient content.'
        })
      );
    });

    it('should prevent submission when form is invalid', () => {
      const mockSubmit = vi.fn();
      (contactModule as any).contactService = { submitForm: mockSubmit };

      const form = contactModule.find('#contact-form') as HTMLFormElement;
      const submitEvent = new Event('submit');
      form.dispatchEvent(submitEvent);

      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('should show loading state during submission', async () => {
      const mockSubmit = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
        );
      (contactModule as any).contactService = { submitForm: mockSubmit };

      // Fill valid form
      (contactModule.find('#contact-name') as HTMLInputElement).value = 'John Doe';
      (contactModule.find('#contact-email') as HTMLInputElement).value = 'john@example.com';
      (contactModule.find('#contact-message') as HTMLTextAreaElement).value =
        'Test message content.';

      const form = contactModule.find('#contact-form') as HTMLFormElement;
      const submitBtn = contactModule.find('#submit-btn') as HTMLButtonElement;
      const btnText = contactModule.find('.btn-text') as HTMLElement;
      const btnLoader = contactModule.find('.btn-loader') as HTMLElement;

      form.dispatchEvent(new Event('submit'));

      // Should show loading state immediately
      expect(submitBtn.disabled).toBe(true);
      expect(btnText.style.display).toBe('none');
      expect(btnLoader.style.display).not.toBe('none');

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(submitBtn.disabled).toBe(false);
      expect(btnText.style.display).not.toBe('none');
      expect(btnLoader.style.display).toBe('none');
    });

    it('should show success message after successful submission', async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ success: true });
      (contactModule as any).contactService = { submitForm: mockSubmit };

      // Fill and submit form
      (contactModule.find('#contact-name') as HTMLInputElement).value = 'John Doe';
      (contactModule.find('#contact-email') as HTMLInputElement).value = 'john@example.com';
      (contactModule.find('#contact-message') as HTMLTextAreaElement).value = 'Test message.';

      const form = contactModule.find('#contact-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      await new Promise((resolve) => setTimeout(resolve, 100));

      const successMessage = container.querySelector('.success-message') as HTMLElement;
      expect(successMessage.style.display).not.toBe('none');
      expect(successMessage.textContent).toContain('message sent successfully');
    });

    it('should handle submission errors gracefully', async () => {
      const mockSubmit = vi.fn().mockRejectedValue(new Error('Submission failed'));
      (contactModule as any).contactService = { submitForm: mockSubmit };

      // Fill and submit form
      (contactModule.find('#contact-name') as HTMLInputElement).value = 'John Doe';
      (contactModule.find('#contact-email') as HTMLInputElement).value = 'john@example.com';
      (contactModule.find('#contact-message') as HTMLTextAreaElement).value = 'Test message.';

      const form = contactModule.find('#contact-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      await new Promise((resolve) => setTimeout(resolve, 100));

      const errorMessage = container.querySelector('.form-messages .error-message') as HTMLElement;
      expect(errorMessage.style.display).not.toBe('none');
      expect(errorMessage.textContent).toContain('failed to send');
    });

    it('should reset form after successful submission', async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ success: true });
      (contactModule as any).contactService = { submitForm: mockSubmit };

      const nameInput = contactModule.find('#contact-name') as HTMLInputElement;
      const emailInput = contactModule.find('#contact-email') as HTMLInputElement;
      const messageInput = contactModule.find('#contact-message') as HTMLTextAreaElement;

      // Fill form
      nameInput.value = 'John Doe';
      emailInput.value = 'john@example.com';
      messageInput.value = 'Test message.';

      const form = contactModule.find('#contact-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Form should be reset
      expect(nameInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(messageInput.value).toBe('');
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await contactModule.init();
    });

    it('should have proper ARIA attributes', () => {
      const nameInput = contactModule.find('#contact-name') as HTMLInputElement;
      const emailInput = contactModule.find('#contact-email') as HTMLInputElement;

      // Test required field attributes
      expect(nameInput.getAttribute('aria-required')).toBe('true');
      expect(emailInput.getAttribute('aria-required')).toBe('true');
    });

    it('should associate error messages with inputs', () => {
      const nameInput = contactModule.find('#contact-name') as HTMLInputElement;

      nameInput.value = '';
      nameInput.dispatchEvent(new Event('blur'));

      const nameGroup = nameInput.closest('.form-group');
      const errorMessage = nameGroup?.querySelector('.error-message') as HTMLElement;

      expect(nameInput.getAttribute('aria-describedby')).toBe(errorMessage.id);
      expect(nameInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('should focus on first error field on submission failure', () => {
      const form = contactModule.find('#contact-form') as HTMLFormElement;
      const nameInput = contactModule.find('#contact-name') as HTMLInputElement;

      form.dispatchEvent(new Event('submit'));

      expect(document.activeElement).toBe(nameInput);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await contactModule.init();
    });

    it('should prevent rapid form submissions', async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ success: true });
      (contactModule as any).contactService = { submitForm: mockSubmit };

      // Fill valid form
      (contactModule.find('#contact-name') as HTMLInputElement).value = 'John Doe';
      (contactModule.find('#contact-email') as HTMLInputElement).value = 'john@example.com';
      (contactModule.find('#contact-message') as HTMLTextAreaElement).value = 'Test message.';

      const form = contactModule.find('#contact-form') as HTMLFormElement;

      // Submit twice quickly
      form.dispatchEvent(new Event('submit'));
      form.dispatchEvent(new Event('submit'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should only submit once
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    it('should allow resubmission after cooldown period', async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ success: true });
      (contactModule as any).contactService = { submitForm: mockSubmit };

      // Fill valid form
      (contactModule.find('#contact-name') as HTMLInputElement).value = 'John Doe';
      (contactModule.find('#contact-email') as HTMLInputElement).value = 'john@example.com';
      (contactModule.find('#contact-message') as HTMLTextAreaElement).value = 'Test message.';

      const form = contactModule.find('#contact-form') as HTMLFormElement;

      // First submission
      form.dispatchEvent(new Event('submit'));

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Wait for cooldown period (typically a few seconds)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Second submission should work
      form.dispatchEvent(new Event('submit'));

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSubmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('Spam Protection', () => {
    beforeEach(async () => {
      await contactModule.init();
    });

    it('should detect honeypot field usage', () => {
      // Add honeypot field
      const honeypot = document.createElement('input');
      honeypot.type = 'text';
      honeypot.name = 'website'; // Common honeypot name
      honeypot.style.display = 'none';
      honeypot.value = 'spam-bot-filled-this';

      const form = contactModule.find('#contact-form') as HTMLFormElement;
      form.appendChild(honeypot);

      const mockSubmit = vi.fn();
      (contactModule as any).contactService = { submitForm: mockSubmit };

      // Try to submit with honeypot filled
      form.dispatchEvent(new Event('submit'));

      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('should validate form submission timing', () => {
      const mockSubmit = vi.fn();
      (contactModule as any).contactService = { submitForm: mockSubmit };

      // Simulate extremely fast form submission (likely bot)
      const form = contactModule.find('#contact-form') as HTMLFormElement;

      // Fill and submit immediately (within 1 second of page load)
      (contactModule.find('#contact-name') as HTMLInputElement).value = 'Bot Name';
      (contactModule.find('#contact-email') as HTMLInputElement).value = 'bot@example.com';
      (contactModule.find('#contact-message') as HTMLTextAreaElement).value = 'Bot message.';

      form.dispatchEvent(new Event('submit'));

      // Should be blocked for being too fast
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up event listeners on destroy', async () => {
      await contactModule.init();

      const form = contactModule.find('#contact-form') as HTMLFormElement;
      const submitHandler = vi.fn();
      form.addEventListener('submit', submitHandler);

      await contactModule.teardown();

      form.dispatchEvent(new Event('submit'));
      expect(submitHandler).toHaveBeenCalled(); // External handler still works
    });

    it('should clear rate limiting timers on destroy', async () => {
      await contactModule.init();

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await contactModule.teardown();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
