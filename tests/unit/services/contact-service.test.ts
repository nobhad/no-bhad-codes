/**
 * ===============================================
 * CONTACT SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/contact-service.test.ts
 *
 * Unit tests for the contact service.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContactService } from '../../../src/services/contact-service.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('../../../src/services/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ContactService', () => {
  let contactService: ContactService;

  beforeEach(() => {
    contactService = new ContactService({
      endpoint: '/api/contact',
      timeout: 5000,
      enableSpamProtection: true
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Form Submission', () => {
    it('should submit contact form data successfully', async () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message.'
      };

      const expectedResponse = {
        success: true,
        messageId: 'msg-123',
        timestamp: '2024-01-01T12:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(expectedResponse),
        headers: new Headers()
      });

      const result = await contactService.submitForm(formData);

      expect(mockFetch).toHaveBeenCalledWith('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      expect(result).toEqual(expectedResponse);
    });

    it('should validate required fields', async () => {
      const incompleteFormData = {
        name: 'John Doe',
        email: '', // Missing email
        message: 'Test message'
      };

      await expect(contactService.submitForm(incompleteFormData as any)).rejects.toThrow(
        'Email is required'
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      const invalidFormData = {
        name: 'John Doe',
        email: 'invalid-email',
        message: 'Test message'
      };

      await expect(contactService.submitForm(invalidFormData)).rejects.toThrow(
        'Invalid email format'
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should validate message length', async () => {
      const shortMessageData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hi' // Too short
      };

      await expect(contactService.submitForm(shortMessageData)).rejects.toThrow(
        'Message must be at least 10 characters'
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should sanitize form data', async () => {
      const formDataWithScripts = {
        name: 'John<script>alert("xss")</script>Doe',
        email: 'john@example.com',
        subject: '<b>Bold Subject</b>',
        message: 'This is a <script>malicious</script> message.'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
        headers: new Headers()
      });

      await contactService.submitForm(formDataWithScripts);

      const sentData = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(sentData.name).toBe('JohnDoe'); // Scripts removed
      expect(sentData.subject).toBe('Bold Subject'); // Safe HTML allowed
      expect(sentData.message).toBe('This is a  message.'); // Scripts removed
    });
  });

  describe('Spam Protection', () => {
    it('should detect spam patterns in message content', async () => {
      const spamFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'BUY NOW! CHEAP VIAGRA! CLICK HERE! www.spam-site.com'
      };

      await expect(contactService.submitForm(spamFormData)).rejects.toThrow(
        'Message appears to be spam'
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should detect suspicious email patterns', async () => {
      const suspiciousEmailData = {
        name: 'John Doe',
        email: 'noreply@temporary-mail.com',
        message: 'This is a legitimate message.'
      };

      await expect(contactService.submitForm(suspiciousEmailData)).rejects.toThrow(
        'Email domain not allowed'
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should allow legitimate messages', async () => {
      const legitimateFormData = {
        name: 'Jane Smith',
        email: 'jane.smith@gmail.com',
        subject: 'Website Inquiry',
        message:
          'I am interested in learning more about your services and would like to schedule a consultation.'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
        headers: new Headers()
      });

      const result = await contactService.submitForm(legitimateFormData);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should rate limit submissions from same email', async () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'First message.'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
        headers: new Headers()
      });

      // First submission should work
      await contactService.submitForm(formData);

      // Immediate second submission should be rate limited
      await expect(
        contactService.submitForm({ ...formData, message: 'Second message.' })
      ).rejects.toThrow('Too many requests from this email');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network timeouts', async () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message.'
      };

      // Mock a timeout
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 100))
      );

      await expect(contactService.submitForm(formData)).rejects.toThrow(
        'Failed to send message. Please try again.'
      );
    });

    it('should handle server errors', async () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message.'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server error' })
      });

      await expect(contactService.submitForm(formData)).rejects.toThrow(
        'Server error occurred. Please try again later.'
      );
    });

    it('should retry failed requests', async () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message.'
      };

      // First two attempts fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true })
        });

      const result = await contactService.submitForm(formData);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should give up after max retries', async () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message.'
      };

      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      await expect(contactService.submitForm(formData)).rejects.toThrow(
        'Failed to send message. Please try again.'
      );

      // Should try 3 times (initial + 2 retries)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Form Validation', () => {
    it('should provide detailed validation results', () => {
      const invalidFormData = {
        name: '',
        email: 'invalid-email',
        message: 'Hi'
      };

      const validation = contactService.validateForm(invalidFormData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Name is required');
      expect(validation.errors).toContain('Invalid email format');
      expect(validation.errors).toContain('Message must be at least 10 characters');
    });

    it('should validate successful form data', () => {
      const validFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Website Inquiry',
        message: 'This is a valid message with sufficient content.'
      };

      const validation = contactService.validateForm(validFormData);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate phone numbers when provided', () => {
      const formDataWithPhone = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '(555) 123-4567',
        message: 'Message with phone number.'
      };

      const validation = contactService.validateForm(formDataWithPhone);
      expect(validation.isValid).toBe(true);

      const invalidPhoneData = {
        ...formDataWithPhone,
        phone: 'invalid-phone'
      };

      const invalidValidation = contactService.validateForm(invalidPhoneData);
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.errors).toContain('Invalid phone number format');
    });
  });

  describe('Template Management', () => {
    it('should format email template for admin notification', () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Website Inquiry',
        message: 'I would like to know more about your services.'
      };

      const template = contactService.generateEmailTemplate(formData);

      expect(template.subject).toBe('New Contact Form Submission: Website Inquiry');
      expect(template.html).toContain('John Doe');
      expect(template.html).toContain('john@example.com');
      expect(template.html).toContain('I would like to know more about your services.');
    });

    it('should format auto-reply template for user', () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Website Inquiry',
        message: 'Service inquiry message.'
      };

      const autoReply = contactService.generateAutoReplyTemplate(formData);

      expect(autoReply.subject).toBe('Thank you for contacting us, John');
      expect(autoReply.html).toContain('Hi John Doe');
      expect(autoReply.html).toContain('We received your message about "Website Inquiry"');
      expect(autoReply.to).toBe('john@example.com');
    });
  });

  describe('Analytics and Tracking', () => {
    it('should track form submission metrics', async () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Analytics test message.'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
        headers: new Headers()
      });

      await contactService.submitForm(formData);

      const metrics = contactService.getMetrics();

      expect(metrics.totalSubmissions).toBe(1);
      expect(metrics.successfulSubmissions).toBe(1);
      expect(metrics.lastSubmissionTime).toBeTruthy();
    });

    it('should track spam attempts', async () => {
      const spamData = {
        name: 'Spammer',
        email: 'spam@example.com',
        message: 'BUY CHEAP PRODUCTS NOW! CLICK HERE!'
      };

      try {
        await contactService.submitForm(spamData);
      } catch (error) {
        // Expected to fail
      }

      const metrics = contactService.getMetrics();

      expect(metrics.spamAttempts).toBe(1);
    });

    it('should track validation failures', async () => {
      const invalidData = {
        name: '',
        email: 'invalid-email',
        message: 'Hi'
      };

      try {
        await contactService.submitForm(invalidData);
      } catch (error) {
        // Expected to fail
      }

      const metrics = contactService.getMetrics();

      expect(metrics.validationFailures).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should allow custom endpoint configuration', () => {
      const customService = new ContactService({
        endpoint: '/custom/contact-endpoint',
        timeout: 10000
      });

      expect(customService.config.endpoint).toBe('/custom/contact-endpoint');
      expect(customService.config.timeout).toBe(10000);
    });

    it('should support disabling spam protection', async () => {
      const noSpamService = new ContactService({
        endpoint: '/api/contact',
        enableSpamProtection: false
      });

      const spamData = {
        name: 'Spammer',
        email: 'spam@temporary-email.com',
        message: 'BUY CHEAP PRODUCTS NOW!'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
        headers: new Headers()
      });

      // Should not throw spam error when protection disabled
      const result = await noSpamService.submitForm(spamData);
      expect(result.success).toBe(true);
    });

    it('should allow custom validation rules', () => {
      const customService = new ContactService({
        endpoint: '/api/contact',
        customValidation: {
          nameMinLength: 2,
          messageMinLength: 5,
          allowedDomains: ['gmail.com', 'company.com']
        }
      });

      const shortNameData = {
        name: 'J', // Only 1 character
        email: 'john@gmail.com',
        message: 'Short' // Only 5 characters (minimum)
      };

      const validation = customService.validateForm(shortNameData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Name must be at least 2 characters');
    });
  });

  describe('Cleanup', () => {
    it('should clear rate limiting data', () => {
      contactService.clearRateLimitData();

      const metrics = contactService.getMetrics();
      expect(metrics.rateLimitedEmails).toHaveLength(0);
    });

    it('should reset metrics', () => {
      contactService.resetMetrics();

      const metrics = contactService.getMetrics();
      expect(metrics.totalSubmissions).toBe(0);
      expect(metrics.spamAttempts).toBe(0);
      expect(metrics.validationFailures).toBe(0);
    });
  });
});
