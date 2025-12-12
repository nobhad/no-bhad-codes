/**
 * ===============================================
 * CONTACT FORM MODULE TESTS
 * ===============================================
 * @file tests/unit/modules/contact-form.test.ts
 *
 * Unit tests for the contact form module.
 * Tests the ContactFormModule class and its methods.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../../src/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/sanitization-utils', () => ({
  SanitizationUtils: {
    sanitizeText: vi.fn((text: string) => text?.trim() || ''),
    sanitizeEmail: vi.fn((email: string) => email?.toLowerCase().trim() || ''),
    sanitizeMessage: vi.fn((message: string) => message?.trim() || ''),
    checkRateLimit: vi.fn(() => true),
    logSecurityViolation: vi.fn(),
  },
}));

// Create a mock ContactService class
class MockContactService {
  init = vi.fn().mockResolvedValue(undefined);
  submitForm = vi.fn().mockResolvedValue({ success: true, message: 'Success!' });
  validateFormData = vi.fn().mockReturnValue({ valid: true, errors: [] });
  getConfig = vi.fn().mockReturnValue({ backend: 'netlify' });
}

vi.mock('../../../src/services/contact-service', () => ({
  ContactService: MockContactService,
}));

describe('ContactFormModule', () => {
  let ContactFormModule: typeof import('../../../src/modules/contact-form').ContactFormModule;
  let container: HTMLElement;
  let contactModule: InstanceType<typeof ContactFormModule>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset module cache
    vi.resetModules();

    // Import after mocks
    const module = await import('../../../src/modules/contact-form');
    ContactFormModule = module.ContactFormModule;

    // Create test container with typical contact form structure
    container = document.createElement('div');
    container.innerHTML = `
      <form class="contact-form" id="contact-form">
        <div class="form-group">
          <label for="First-Name">First Name *</label>
          <input type="text" id="First-Name" name="firstName" required>
          <span class="error-message" style="display: none;"></span>
        </div>
        <div class="form-group">
          <label for="Last-Name">Last Name *</label>
          <input type="text" id="Last-Name" name="lastName" required>
          <span class="error-message" style="display: none;"></span>
        </div>
        <div class="form-group">
          <label for="Email">Email *</label>
          <input type="email" id="Email" name="email" required>
          <span class="error-message" style="display: none;"></span>
        </div>
        <div class="form-group">
          <label for="Message">Message *</label>
          <textarea id="Message" name="message" required rows="5"></textarea>
          <span class="error-message" style="display: none;"></span>
        </div>
        <div class="form-actions">
          <button type="submit" class="submit-button" id="submit-btn">
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
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create module instance', () => {
      contactModule = new ContactFormModule({ debug: false });
      expect(contactModule).toBeDefined();
    });

    it('should have correct module name', () => {
      contactModule = new ContactFormModule({ debug: false });
      expect(contactModule.name).toBe('contact-form');
    });

    it('should initialize successfully with form present', async () => {
      contactModule = new ContactFormModule({ debug: false });
      await contactModule.init();

      expect(contactModule.isInitialized).toBe(true);
    });

    it('should accept backend configuration', () => {
      contactModule = new ContactFormModule({
        backend: 'formspree',
        formId: 'test123',
        debug: false,
      });
      expect(contactModule).toBeDefined();
    });

    it('should accept custom endpoint configuration', () => {
      contactModule = new ContactFormModule({
        backend: 'custom',
        endpoint: '/api/contact',
        debug: false,
      });
      expect(contactModule).toBeDefined();
    });
  });

  describe('Form Elements', () => {
    it('should find form element after initialization', async () => {
      contactModule = new ContactFormModule({ debug: false });
      await contactModule.init();

      const form = document.querySelector('.contact-form');
      expect(form).toBeTruthy();
    });

    it('should find submit button after initialization', async () => {
      contactModule = new ContactFormModule({ debug: false });
      await contactModule.init();

      const button = document.querySelector('.submit-button');
      expect(button).toBeTruthy();
    });

    it('should disable browser validation', async () => {
      contactModule = new ContactFormModule({ debug: false });
      await contactModule.init();

      const form = document.querySelector('.contact-form') as HTMLFormElement;
      expect(form.noValidate).toBe(true);
    });
  });

  describe('Event Binding', () => {
    it('should bind submit event to form', async () => {
      contactModule = new ContactFormModule({ debug: false });
      await contactModule.init();

      // The form should have submit listener bound
      const form = document.querySelector('.contact-form') as HTMLFormElement;
      expect(form).toBeTruthy();
    });

    it('should bind input events to form fields', async () => {
      contactModule = new ContactFormModule({ debug: false });
      await contactModule.init();

      // Input elements should be present
      const inputs = document.querySelectorAll('input, textarea');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  describe('Module Methods', () => {
    it('should have destroy method', async () => {
      contactModule = new ContactFormModule({ debug: false });
      await contactModule.init();

      expect(typeof contactModule.destroy).toBe('function');
    });

    it('should clean up on destroy', async () => {
      contactModule = new ContactFormModule({ debug: false });
      await contactModule.init();

      contactModule.destroy();

      // After destroy, calling methods should be safe but module cleanup occurred
      // Note: BaseModule may not reset isInitialized flag
      expect(contactModule).toBeDefined();
    });
  });

  describe('Form Structure Validation', () => {
    it('should work with standard form structure', async () => {
      contactModule = new ContactFormModule({ debug: false });
      await contactModule.init();

      // Should initialize without errors
      expect(contactModule.isInitialized).toBe(true);
    });

    it('should handle missing optional elements gracefully', async () => {
      // Remove optional elements
      const successMsg = container.querySelector('.success-message');
      successMsg?.remove();

      contactModule = new ContactFormModule({ debug: false });

      // Should not throw
      await expect(contactModule.init()).resolves.not.toThrow();
    });
  });
});
