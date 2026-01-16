/**
 * ===============================================
 * EMAIL SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/email-service.test.ts
 *
 * Unit tests for email service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { emailService, sendNewIntakeNotification, sendWelcomeEmail } from '../../../server/services/email-service';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

describe('Email Service', () => {
  let mockTransporter: any;

  beforeEach(() => {
    mockTransporter = {
      sendMail: vi.fn(),
    };

    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as any);
    vi.clearAllMocks();
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
        budget: '$10,000',
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      const result = await sendNewIntakeNotification(intakeData, 1);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should handle email send errors gracefully', async () => {
      const intakeData = {
        name: 'John Doe',
        email: 'john@example.com',
        projectType: 'WEB_DEVELOPMENT',
        projectDescription: 'Test project',
        timeline: '3 months',
        budget: '$10,000',
      };

      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

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
        additionalInfo: 'Additional information',
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-id',
      });

      await sendNewIntakeNotification(intakeData, 1);

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
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
        budget: '$10,000',
      };

      const result = await sendNewIntakeNotification(intakeData, 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'welcome-message-id',
      });

      const result = await sendWelcomeEmail('test@example.com', 'Test User', 'access-token');

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should include portal URL in welcome email', async () => {
      process.env.BASE_URL = 'https://example.com';
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-id',
      });

      await sendWelcomeEmail('test@example.com', 'Test User', 'access-token');

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Test User');
      expect(callArgs.html).toContain('access-token');
    });
  });

  describe('emailService', () => {
    it('should initialize email service', async () => {
      await emailService.init({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password',
        },
        from: 'test@example.com',
      });

      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it('should get service status', () => {
      const status = emailService.getStatus();
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('queueSize');
      expect(status).toHaveProperty('templatesLoaded');
    });

    it('should test connection', async () => {
      mockTransporter.verify = vi.fn().mockResolvedValue(true);

      const result = await emailService.testConnection();

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });
  });
});
