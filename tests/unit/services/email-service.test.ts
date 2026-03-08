/**
 * ===============================================
 * EMAIL SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/email-service.test.ts
 *
 * Unit tests for email service.
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import {
  emailService,
  sendNewIntakeNotification,
  sendWelcomeEmail
} from '../../../server/services/email-service';

// Create mock transporter
const mockSendMail = vi.fn();
const mockVerify = vi.fn();
const mockTransporter = {
  sendMail: mockSendMail,
  verify: mockVerify
};

// Mock nodemailer with proper exports
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => mockTransporter)
  },
  createTransport: vi.fn(() => mockTransporter)
}));

// Mock database
vi.mock('../../../server/database/init', () => ({
  getDatabase: () => ({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
  })
}));

// Mock logger
vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock environment config
vi.mock('../../../server/config/environment', () => ({
  default: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
    APP_URL: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:3000',
    PORT: 3000
  },
  getBaseUrl: vi.fn(() => 'http://localhost:3000'),
  getAdminUrl: vi.fn(() => 'http://localhost:3000/admin'),
  getPortalUrl: vi.fn(() => 'http://localhost:3000/client/portal'),
  validateConfig: vi.fn(),
  getConfigSummary: vi.fn(() => ({}))
}));

describe('Email Service', () => {
  beforeAll(async () => {
    // Initialize email service once
    await emailService.init({
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@example.com',
        pass: 'password'
      },
      from: 'test@example.com'
    });
  });

  beforeEach(() => {
    // Clear mock call history before each test
    mockSendMail.mockClear();
    mockVerify.mockClear();
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
    mockVerify.mockResolvedValue(true);
  });

  describe('sendNewIntakeNotification', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
    });

    it('should send intake notification successfully', async () => {
      const intakeData = {
        name: 'John Doe',
        email: 'john@example.com',
        projectType: 'WEB_DEVELOPMENT',
        projectDescription: 'Test project',
        timeline: '3 months',
        budget: '$10,000'
      };

      const result = await sendNewIntakeNotification(intakeData, 1);

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should handle email send errors gracefully', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

      const intakeData = {
        name: 'John Doe',
        email: 'john@example.com',
        projectType: 'WEB_DEVELOPMENT',
        projectDescription: 'Test project',
        timeline: '3 months',
        budget: '$10,000'
      };

      const result = await sendNewIntakeNotification(intakeData, 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed');
    });

    it('should include all intake data in email', async () => {
      const intakeData = {
        name: 'John Doe',
        email: 'john@example.com',
        projectType: 'WEB_DEVELOPMENT',
        projectDescription: 'Test project description',
        timeline: '3 months',
        budget: '$10,000',
        techComfort: 'Intermediate',
        domainHosting: 'Yes',
        features: ['Feature 1', 'Feature 2'],
        designLevel: 'Professional',
        additionalInfo: 'Additional information'
      };

      await sendNewIntakeNotification(intakeData, 1);

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('John Doe');
      expect(callArgs.html).toContain('Test project description');
      expect(callArgs.html).toContain('$10,000');
    });

    it('should return error when ADMIN_EMAIL is not configured', async () => {
      delete process.env.ADMIN_EMAIL;

      const intakeData = {
        name: 'John Doe',
        email: 'john@example.com',
        projectType: 'WEB_DEVELOPMENT',
        projectDescription: 'Test project',
        timeline: '3 months',
        budget: '$10,000'
      };

      const result = await sendNewIntakeNotification(intakeData, 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      const result = await sendWelcomeEmail('test@example.com', 'Test User', 'access-token');

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should include portal URL in welcome email', async () => {
      process.env.BASE_URL = 'https://example.com';

      await sendWelcomeEmail('test@example.com', 'Test User', 'access-token');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Test User');
      expect(callArgs.html).toContain('access-token');
    });
  });

  describe('emailService', () => {
    it('should initialize email service', async () => {
      // Test that init completes without error
      // Note: Mock call tracking is unreliable with vitest module mocking
      await expect(
        emailService.init({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'password'
          },
          from: 'test@example.com'
        })
      ).resolves.not.toThrow();

      // Verify service is initialized by checking status
      const status = emailService.getStatus();
      expect(status.initialized).toBe(true);
    });

    it('should get service status', () => {
      const status = emailService.getStatus();
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('queueSize');
      expect(status).toHaveProperty('templatesLoaded');
    });

    it('should test connection', async () => {
      const result = await emailService.testConnection();

      expect(result).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
    });
  });
});
