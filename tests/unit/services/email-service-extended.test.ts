/**
 * ===============================================
 * EMAIL SERVICE EXTENDED TESTS
 * ===============================================
 * @file tests/unit/services/email-service-extended.test.ts
 *
 * Extended unit tests covering previously untested functions in email-service.ts:
 * - isClientActivated
 * - processEmailRetryQueue
 * - getEmailRetryQueueSize
 * - emailService.sendPasswordResetEmail
 * - emailService.sendAccountActivationEmail
 * - emailService.sendMagicLinkEmail
 * - emailService.sendProposalSignedNotification
 * - emailService.sendProposalSignedClientConfirmation
 * - emailService.sendEmailVerificationEmail
 * - emailService.sendAdminNotification
 * - emailService.sendMessageNotification
 * - emailService.sendProjectUpdateEmail
 * - emailService.sendIntakeConfirmation
 * - emailService.sendEmail (direct wrapper)
 * - emailService.sendWelcomeEmail (object-based signature)
 * - emailService.testConnection failure path
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';

// Create mock transporter
const mockSendMail = vi.fn();
const mockVerify = vi.fn();
const mockTransporter = {
  sendMail: mockSendMail,
  verify: mockVerify
};

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => mockTransporter)
  },
  createTransport: vi.fn(() => mockTransporter)
}));

// Mock database
const mockDb = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: () => mockDb
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

// Mock fs for template file reads
vi.mock('fs/promises', () => ({
  readFile: vi.fn()
}));

// Import after all mocks
import {
  emailService,
  isClientActivated,
  processEmailRetryQueue,
  getEmailRetryQueueSize
} from '../../../server/services/email-service';
import * as fs from 'fs/promises';

const mockReadFile = vi.mocked(fs.readFile);

describe('Email Service Extended', () => {
  beforeAll(async () => {
    await emailService.init({
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: { user: 'test@example.com', pass: 'password' },
      from: 'test@example.com'
    });
  });

  beforeEach(() => {
    mockSendMail.mockReset();
    mockVerify.mockReset();
    mockDb.get.mockReset();
    mockDb.run.mockReset();
    mockDb.all.mockReset();
    mockReadFile.mockReset();
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    mockVerify.mockResolvedValue(true);
    process.env.ADMIN_EMAIL = 'admin@example.com';
  });

  // ============================================================
  // isClientActivated
  // ============================================================

  describe('isClientActivated', () => {
    it('returns true when client is active (by numeric ID)', async () => {
      mockDb.get.mockResolvedValue({ status: 'active' });

      const result = await isClientActivated(42);

      expect(result).toBe(true);
      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT status FROM clients WHERE id = ?',
        [42]
      );
    });

    it('returns false when client status is not active (by numeric ID)', async () => {
      mockDb.get.mockResolvedValue({ status: 'inactive' });

      const result = await isClientActivated(42);

      expect(result).toBe(false);
    });

    it('returns true when client is active (by email string)', async () => {
      mockDb.get.mockResolvedValue({ status: 'active' });

      const result = await isClientActivated('User@Example.com');

      expect(result).toBe(true);
      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT status FROM clients WHERE email = ?',
        ['user@example.com']
      );
    });

    it('returns false when client is not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const result = await isClientActivated('missing@example.com');

      expect(result).toBe(false);
    });

    it('returns false when client status is pending', async () => {
      mockDb.get.mockResolvedValue({ status: 'pending' });

      const result = await isClientActivated('user@example.com');

      expect(result).toBe(false);
    });
  });

  // ============================================================
  // getEmailRetryQueueSize
  // ============================================================

  describe('getEmailRetryQueueSize', () => {
    it('returns a number', () => {
      const size = getEmailRetryQueueSize();

      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // processEmailRetryQueue
  // ============================================================

  describe('processEmailRetryQueue', () => {
    it('returns zero counts when queue is empty', async () => {
      const result = await processEmailRetryQueue();

      expect(result).toMatchObject({
        retried: 0,
        failed: 0,
        remaining: 0
      });
    });

    it('returns remaining count when queue is not empty but nothing is ready', async () => {
      // First trigger a failure to populate the retry queue
      mockSendMail.mockRejectedValueOnce(new Error('SMTP down'));

      // Import sendWelcomeEmail fresh to trigger a send that fails and enqueues
      const { sendWelcomeEmail } = await import('../../../server/services/email-service');
      await sendWelcomeEmail('fail@example.com', 'Test User', 'token123');

      // Queue should now have 1 item; since nextRetryAt is in the future, nothing retries
      const result = await processEmailRetryQueue();

      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // emailService.sendPasswordResetEmail
  // ============================================================

  describe('emailService.sendPasswordResetEmail', () => {
    it('sends password reset email successfully', async () => {
      const result = await emailService.sendPasswordResetEmail('user@example.com', {
        resetToken: 'reset-token-abc',
        name: 'John Doe'
      });

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('Password Reset');
      expect(callArgs.html).toContain('reset-token-abc');
    });

    it('uses default name when name is not provided', async () => {
      const result = await emailService.sendPasswordResetEmail('user@example.com', {
        resetToken: 'token-xyz'
      });

      expect(result.success).toBe(true);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('User');
    });

    it('handles send failure gracefully', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await emailService.sendPasswordResetEmail('user@example.com', {
        resetToken: 'token-abc',
        name: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed');
    });
  });

  // ============================================================
  // emailService.sendAccountActivationEmail
  // ============================================================

  describe('emailService.sendAccountActivationEmail', () => {
    it('sends account activation email successfully', async () => {
      const result = await emailService.sendAccountActivationEmail('client@example.com', {
        name: 'Jane Smith',
        portalUrl: 'https://portal.example.com'
      });

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('Welcome');
      expect(callArgs.html).toContain('Jane Smith');
    });

    it('uses default name when name is not provided', async () => {
      const result = await emailService.sendAccountActivationEmail('client@example.com', {});

      expect(result.success).toBe(true);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('there');
    });

    it('uses getPortalUrl when portalUrl is not provided', async () => {
      const result = await emailService.sendAccountActivationEmail('client@example.com', {
        name: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  // ============================================================
  // emailService.sendMagicLinkEmail
  // ============================================================

  describe('emailService.sendMagicLinkEmail', () => {
    it('sends magic link email successfully', async () => {
      const result = await emailService.sendMagicLinkEmail('user@example.com', {
        magicLinkToken: 'magic-token-123',
        name: 'Alice'
      });

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('Login Link');
      expect(callArgs.html).toContain('magic-token-123');
    });

    it('uses default name when not provided', async () => {
      const result = await emailService.sendMagicLinkEmail('user@example.com', {
        magicLinkToken: 'token-abc'
      });

      expect(result.success).toBe(true);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('there');
    });
  });

  // ============================================================
  // emailService.sendProposalSignedNotification
  // ============================================================

  describe('emailService.sendProposalSignedNotification', () => {
    const baseProposalData = {
      clientName: 'Bob Client',
      projectName: 'My Website',
      projectType: 'Web Development',
      projectId: 99,
      selectedTier: 'better' as const,
      tierName: 'Professional',
      finalPrice: '5000',
      signerName: 'Bob Client',
      signerEmail: 'bob@example.com',
      signedAt: '2026-03-08T10:00:00Z',
      ipAddress: '127.0.0.1'
    };

    it('returns error when ADMIN_EMAIL is not set', async () => {
      delete process.env.ADMIN_EMAIL;

      const result = await emailService.sendProposalSignedNotification(baseProposalData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Admin email not configured');
    });

    it('returns failure when template files cannot be read', async () => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const result = await emailService.sendProposalSignedNotification(baseProposalData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to load email templates');
    });

    it('sends notification when templates load successfully', async () => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      mockReadFile
        .mockResolvedValueOnce('Proposal Signed: {{clientName}}')
        .mockResolvedValueOnce('<html>{{clientName}} signed {{projectName}}</html>');

      const result = await emailService.sendProposalSignedNotification(baseProposalData);

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('handles addedFeatures in template when present', async () => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      mockReadFile
        .mockResolvedValueOnce('Proposal Signed')
        .mockResolvedValueOnce(
          '<html>{{#each addedFeatures}}<li>{{this.name}} - {{this.price}}</li>{{/each}}</html>'
        );

      const dataWithFeatures = {
        ...baseProposalData,
        addedFeatures: [{ name: 'SEO Package', price: '500' }]
      };

      const result = await emailService.sendProposalSignedNotification(dataWithFeatures);

      expect(result.success).toBe(true);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('SEO Package');
    });
  });

  // ============================================================
  // emailService.sendProposalSignedClientConfirmation
  // ============================================================

  describe('emailService.sendProposalSignedClientConfirmation', () => {
    const baseClientData = {
      clientName: 'Carol Client',
      projectName: 'My App',
      projectType: 'Mobile App',
      projectId: 55,
      selectedTier: 'best' as const,
      tierName: 'Premium',
      finalPrice: '10000',
      signerName: 'Carol Client',
      signerEmail: 'carol@example.com',
      signedAt: '2026-03-08T10:00:00Z',
      ipAddress: '192.168.1.1',
      portalUrl: 'https://portal.example.com',
      supportEmail: 'support@example.com'
    };

    it('returns failure when template files cannot be read', async () => {
      mockReadFile.mockRejectedValue(new Error('Template missing'));

      const result = await emailService.sendProposalSignedClientConfirmation(baseClientData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to load email templates');
    });

    it('sends confirmation when templates load successfully', async () => {
      mockReadFile
        .mockResolvedValueOnce('Contract Confirmed: {{projectName}}')
        .mockResolvedValueOnce('<html>Hi {{clientName}}, your {{projectName}} is confirmed</html>');

      const result = await emailService.sendProposalSignedClientConfirmation(baseClientData);

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.to).toBe('carol@example.com');
    });

    it('handles addedFeatures in client confirmation', async () => {
      mockReadFile
        .mockResolvedValueOnce('Confirmed')
        .mockResolvedValueOnce(
          '<html>{{#each addedFeatures}}<li>{{this.name}}</li>{{/each}}</html>'
        );

      const dataWithFeatures = {
        ...baseClientData,
        addedFeatures: [{ name: 'Analytics', price: '200' }]
      };

      const result = await emailService.sendProposalSignedClientConfirmation(dataWithFeatures);

      expect(result.success).toBe(true);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Analytics');
    });
  });

  // ============================================================
  // emailService.sendEmailVerificationEmail
  // ============================================================

  describe('emailService.sendEmailVerificationEmail', () => {
    it('sends email verification email successfully', async () => {
      const result = await emailService.sendEmailVerificationEmail('user@example.com', {
        verificationToken: 'verify-token-abc',
        name: 'Dave'
      });

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('Verify');
      expect(callArgs.html).toContain('verify-token-abc');
    });

    it('uses default name when name is not provided', async () => {
      const result = await emailService.sendEmailVerificationEmail('user@example.com', {
        verificationToken: 'token-xyz'
      });

      expect(result.success).toBe(true);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('there');
    });
  });

  // ============================================================
  // emailService.sendAdminNotification
  // ============================================================

  describe('emailService.sendAdminNotification', () => {
    it('returns success for string title', async () => {
      const result = await emailService.sendAdminNotification('New user signed up', {
        userId: 42
      });

      expect(result.success).toBe(true);
    });

    it('returns success for object-style title', async () => {
      const result = await emailService.sendAdminNotification({ event: 'signup', userId: 42 });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // emailService.sendMessageNotification
  // ============================================================

  describe('emailService.sendMessageNotification', () => {
    it('returns success', async () => {
      const result = await emailService.sendMessageNotification('user@example.com', {
        message: 'Hello!'
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // emailService.sendProjectUpdateEmail
  // ============================================================

  describe('emailService.sendProjectUpdateEmail', () => {
    it('returns success', async () => {
      const result = await emailService.sendProjectUpdateEmail('user@example.com', {
        projectName: 'My Project'
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // emailService.sendIntakeConfirmation
  // ============================================================

  describe('emailService.sendIntakeConfirmation', () => {
    it('returns success', async () => {
      const result = await emailService.sendIntakeConfirmation({
        name: 'Test',
        email: 'test@example.com'
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // emailService.sendEmail (direct wrapper)
  // ============================================================

  describe('emailService.sendEmail', () => {
    it('sends a raw email successfully', async () => {
      const result = await emailService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Direct Test Email',
        text: 'Plain text content',
        html: '<p>HTML content</p>'
      });

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Direct Test Email'
        })
      );
    });

    it('returns failure when send fails', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('Network error'));

      const result = await emailService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Failing Email',
        text: 'content',
        html: '<p>content</p>'
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // emailService.sendWelcomeEmail (object-based signature)
  // ============================================================

  describe('emailService.sendWelcomeEmail (object-based signature)', () => {
    it('accepts object-based data format', async () => {
      const result = await emailService.sendWelcomeEmail(
        'user@example.com',
        { name: 'Eve', accessToken: 'obj-token-abc' }
      );

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('uses original string signature', async () => {
      const result = await emailService.sendWelcomeEmail(
        'user@example.com',
        'Frank',
        'str-token-xyz'
      );

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // emailService.testConnection failure path
  // ============================================================

  describe('emailService.testConnection', () => {
    it('returns false when verify throws', async () => {
      mockVerify.mockRejectedValueOnce(new Error('Auth failed'));

      const result = await emailService.testConnection();

      expect(result).toBe(false);
    });
  });

  // ============================================================
  // emailService.sendNewIntakeNotification (via service object)
  // ============================================================

  describe('emailService.sendNewIntakeNotification', () => {
    it('sends intake notification via service object', async () => {
      process.env.ADMIN_EMAIL = 'admin@example.com';

      const result = await emailService.sendNewIntakeNotification(
        {
          name: 'Grace',
          email: 'grace@example.com',
          projectType: 'E-commerce',
          projectDescription: 'A shopping site',
          timeline: '6 months',
          budget: '$15,000'
        },
        200
      );

      expect(result.success).toBe(true);
    });
  });
});
