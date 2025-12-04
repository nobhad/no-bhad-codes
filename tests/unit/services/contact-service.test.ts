/**
 * ===============================================
 * CONTACT SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/contact-service.test.ts
 *
 * Unit tests for the contact form service.
 * Tests the ContactService class and its validation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContactService, ContactFormData } from '../../../src/services/contact-service.js';

// Mock the SanitizationUtils module
vi.mock('../../../src/utils/sanitization-utils.js', () => ({
  SanitizationUtils: {
    sanitizeText: vi.fn((text: string) => text?.trim() || ''),
    sanitizeEmail: vi.fn((email: string) => email?.toLowerCase().trim() || ''),
    sanitizeMessage: vi.fn((message: string) => message?.trim() || ''),
    checkRateLimit: vi.fn(() => true),
    logSecurityViolation: vi.fn(),
  },
}));

describe('ContactService', () => {
  let service: ContactService;

  const validFormData: ContactFormData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    companyName: 'Test Company',
    inquiryType: 'consultation',
    message: 'This is a test message with enough characters.',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new ContactService({ backend: 'netlify' });
    await service.init();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ContactService);
    });

    it('should accept netlify backend by default', () => {
      const defaultService = new ContactService();
      expect(defaultService).toBeInstanceOf(ContactService);
    });

    it('should accept custom backend with endpoint', async () => {
      const customService = new ContactService({
        backend: 'custom',
        endpoint: '/api/contact',
      });
      await customService.init();
      expect(customService).toBeInstanceOf(ContactService);
    });

    it('should throw error for formspree without formId', async () => {
      const formspreeService = new ContactService({ backend: 'formspree' });
      await expect(formspreeService.init()).rejects.toThrow('Formspree backend requires formId');
    });

    it('should throw error for custom without endpoint', async () => {
      const customService = new ContactService({ backend: 'custom' });
      await expect(customService.init()).rejects.toThrow('Custom backend requires endpoint');
    });
  });

  describe('Form Validation', () => {
    it('should validate complete form data', () => {
      const result = service.validateFormData(validFormData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require first name', () => {
      const result = service.validateFormData({
        ...validFormData,
        firstName: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('First name is required');
    });

    it('should require last name', () => {
      const result = service.validateFormData({
        ...validFormData,
        lastName: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Last name is required');
    });

    it('should require email', () => {
      const result = service.validateFormData({
        ...validFormData,
        email: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    it('should validate email format', () => {
      const result = service.validateFormData({
        ...validFormData,
        email: 'invalid-email',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Please enter a valid email address');
    });

    it('should require inquiry type', () => {
      const result = service.validateFormData({
        ...validFormData,
        inquiryType: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Please select what you need help with');
    });

    it('should require message', () => {
      const result = service.validateFormData({
        ...validFormData,
        message: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message is required');
    });

    it('should require minimum message length', () => {
      const result = service.validateFormData({
        ...validFormData,
        message: 'Short',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message must be at least 10 characters long');
    });

    it('should collect all validation errors', () => {
      const result = service.validateFormData({
        firstName: '',
        lastName: '',
        email: '',
        inquiryType: '',
        message: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Form Submission', () => {
    it('should have submitForm method', () => {
      expect(typeof service.submitForm).toBe('function');
    });

    it('should return result with success flag', async () => {
      // Mock fetch to return success
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await service.submitForm(validFormData);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });

    it('should return error for invalid data', async () => {
      const result = await service.submitForm({
        ...validFormData,
        email: '',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe('Backend Configuration', () => {
    it('should allow custom endpoint configuration', async () => {
      const customService = new ContactService({
        backend: 'custom',
        endpoint: '/custom/api',
      });
      await customService.init();

      expect(customService).toBeInstanceOf(ContactService);
    });

    it('should allow formspree with formId', async () => {
      const formspreeService = new ContactService({
        backend: 'formspree',
        formId: 'test123',
      });
      await formspreeService.init();

      expect(formspreeService).toBeInstanceOf(ContactService);
    });
  });
});
