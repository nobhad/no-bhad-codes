/**
 * ===============================================
 * STRIPE SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/stripe-service.test.ts
 *
 * Unit tests for Stripe payment integration service.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Mock database
const mockDb = vi.hoisted(() => ({
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn()
}));

vi.mock('../../../server/database/init', () => ({
  getDatabase: () => mockDb
}));

// Mock crypto module
vi.mock('crypto', () => ({
  createHmac: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('expectedsignature')
  })),
  timingSafeEqual: vi.fn((a: Buffer, b: Buffer) => a.toString() === b.toString())
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Store original env
const originalEnv = process.env;

describe('Stripe Service', () => {
  beforeEach(() => {
    vi.resetModules();
    mockDb.run.mockReset();
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockFetch.mockReset();

    // Set up test environment
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_456',
      APP_URL: 'http://localhost:3000'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isStripeConfigured', () => {
    it('returns true when STRIPE_SECRET_KEY is set with sk_ prefix', async () => {
      const { isStripeConfigured } = await import('../../../server/services/integrations/stripe-service');
      expect(isStripeConfigured()).toBe(true);
    });

    it('returns false when STRIPE_SECRET_KEY is not set', async () => {
      process.env.STRIPE_SECRET_KEY = '';
      vi.resetModules();
      const { isStripeConfigured } = await import('../../../server/services/integrations/stripe-service');
      expect(isStripeConfigured()).toBe(false);
    });

    it('returns false when STRIPE_SECRET_KEY does not start with sk_', async () => {
      process.env.STRIPE_SECRET_KEY = 'invalid_key';
      vi.resetModules();
      const { isStripeConfigured } = await import('../../../server/services/integrations/stripe-service');
      expect(isStripeConfigured()).toBe(false);
    });
  });

  describe('getStripeStatus', () => {
    it('returns not_configured when no key set', async () => {
      process.env.STRIPE_SECRET_KEY = '';
      vi.resetModules();
      const { getStripeStatus } = await import('../../../server/services/integrations/stripe-service');

      const status = getStripeStatus();
      expect(status.configured).toBe(false);
      expect(status.mode).toBe('not_configured');
      expect(status.webhookConfigured).toBe(false);
    });

    it('returns test mode for test key', async () => {
      const { getStripeStatus } = await import('../../../server/services/integrations/stripe-service');

      const status = getStripeStatus();
      expect(status.configured).toBe(true);
      expect(status.mode).toBe('test');
      expect(status.webhookConfigured).toBe(true);
    });

    it('returns live mode for live key', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_live_123';
      vi.resetModules();
      const { getStripeStatus } = await import('../../../server/services/integrations/stripe-service');

      const status = getStripeStatus();
      expect(status.configured).toBe(true);
      expect(status.mode).toBe('live');
    });
  });

  describe('createPaymentLink', () => {
    it('throws error when invoice not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const { createPaymentLink } = await import('../../../server/services/integrations/stripe-service');

      await expect(createPaymentLink({
        invoiceId: 999,
        amount: 10000
      })).rejects.toThrow('Invoice 999 not found');
    });

    it('returns null when Stripe is not configured', async () => {
      process.env.STRIPE_SECRET_KEY = '';
      vi.resetModules();
      const { createPaymentLink } = await import('../../../server/services/integrations/stripe-service');

      const result = await createPaymentLink({
        invoiceId: 1,
        amount: 10000
      });

      expect(result).toBeNull();
    });

    it('creates a payment link successfully', async () => {
      mockDb.get.mockResolvedValue({
        id: 1,
        invoice_number: 'INV-001',
        client_id: 10,
        client_email: 'client@example.com',
        total_amount: 100
      });
      mockDb.run.mockResolvedValue({ lastID: 1 });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
          status: 'open',
          created: 1700000000
        })
      });

      const { createPaymentLink } = await import('../../../server/services/integrations/stripe-service');

      const result = await createPaymentLink({
        invoiceId: 1,
        amount: 10000,
        currency: 'usd',
        description: 'Test Invoice'
      });

      expect(result).toMatchObject({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
        amount: 10000,
        currency: 'usd'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.stripe.com/v1/checkout/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk_test_123'
          })
        })
      );
    });

    it('throws error on Stripe API failure', async () => {
      mockDb.get.mockResolvedValue({
        id: 1,
        invoice_number: 'INV-001',
        client_id: 10
      });

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          error: { message: 'Invalid card number' }
        })
      });

      const { createPaymentLink } = await import('../../../server/services/integrations/stripe-service');

      await expect(createPaymentLink({
        invoiceId: 1,
        amount: 10000
      })).rejects.toThrow('Stripe API error: Invalid card number');
    });
  });

  describe('getPaymentLink', () => {
    it('returns null when no active link exists', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const { getPaymentLink } = await import('../../../server/services/integrations/stripe-service');

      const result = await getPaymentLink(1);
      expect(result).toBeNull();
    });

    it('returns payment link details when found', async () => {
      mockDb.get.mockResolvedValue({
        id: 1,
        invoice_id: 1,
        stripe_session_id: 'cs_test_123',
        payment_url: 'https://checkout.stripe.com/pay/cs_test_123',
        amount: 10000,
        currency: 'usd',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z'
      });

      const { getPaymentLink } = await import('../../../server/services/integrations/stripe-service');

      const result = await getPaymentLink(1);
      expect(result).toMatchObject({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
        amount: 10000,
        currency: 'usd',
        status: 'active'
      });
    });
  });

  describe('expirePaymentLink', () => {
    it('updates payment link status to cancelled', async () => {
      mockDb.run.mockResolvedValue({});
      const { expirePaymentLink } = await import('../../../server/services/integrations/stripe-service');

      await expirePaymentLink(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoice_payment_links SET status = \'cancelled\''),
        [1]
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns false when webhook secret is not configured', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = '';
      vi.resetModules();
      const { verifyWebhookSignature } = await import('../../../server/services/integrations/stripe-service');

      const result = verifyWebhookSignature('payload', 'signature');
      expect(result).toBe(false);
    });

    it('returns false when signature header is malformed', async () => {
      const { verifyWebhookSignature } = await import('../../../server/services/integrations/stripe-service');

      const result = verifyWebhookSignature('payload', 'invalid-signature');
      expect(result).toBe(false);
    });

    it('returns false when timestamp is outside tolerance', async () => {
      const { verifyWebhookSignature } = await import('../../../server/services/integrations/stripe-service');

      // Timestamp from 10 minutes ago (outside 5 minute tolerance)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const signature = `t=${oldTimestamp},v1=somesignature`;

      const result = verifyWebhookSignature('payload', signature);
      expect(result).toBe(false);
    });
  });

  describe('handleWebhookEvent', () => {
    it('handles checkout.session.completed event', async () => {
      mockDb.run.mockResolvedValue({});
      const { handleWebhookEvent } = await import('../../../server/services/integrations/stripe-service');

      await handleWebhookEvent({
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: { invoice_id: '1' },
            payment_intent: 'pi_123',
            amount_total: 10000
          }
        },
        created: Date.now()
      });

      // Should update invoice to paid
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices'),
        expect.arrayContaining(['pi_123', '1'])
      );

      // Should record payment
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoice_payments'),
        expect.any(Array)
      );
    });

    it('handles checkout.session.expired event', async () => {
      mockDb.run.mockResolvedValue({});
      const { handleWebhookEvent } = await import('../../../server/services/integrations/stripe-service');

      await handleWebhookEvent({
        id: 'evt_123',
        type: 'checkout.session.expired',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: { invoice_id: '1' }
          }
        },
        created: Date.now()
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoice_payment_links SET status = \'expired\''),
        ['cs_test_123']
      );
    });

    it('handles payment_intent.payment_failed event', async () => {
      mockDb.run.mockResolvedValue({});
      const { handleWebhookEvent } = await import('../../../server/services/integrations/stripe-service');

      await handleWebhookEvent({
        id: 'evt_123',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_123',
            metadata: { invoice_id: '1' },
            last_payment_error: { message: 'Card declined' }
          }
        },
        created: Date.now()
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoice_payment_attempts'),
        expect.arrayContaining(['1', 'pi_123', 'Card declined'])
      );
    });

    it('handles charge.refunded event for full refund', async () => {
      mockDb.get.mockResolvedValue({ id: 1 });
      mockDb.run.mockResolvedValue({});
      const { handleWebhookEvent } = await import('../../../server/services/integrations/stripe-service');

      await handleWebhookEvent({
        id: 'evt_123',
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: 'pi_123',
            amount: 10000,
            amount_refunded: 10000
          }
        },
        created: Date.now()
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices SET status = ?'),
        ['refunded', 100, 1]
      );
    });

    it('handles charge.refunded event for partial refund', async () => {
      mockDb.get.mockResolvedValue({ id: 1 });
      mockDb.run.mockResolvedValue({});
      const { handleWebhookEvent } = await import('../../../server/services/integrations/stripe-service');

      await handleWebhookEvent({
        id: 'evt_123',
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: 'pi_123',
            amount: 10000,
            amount_refunded: 5000
          }
        },
        created: Date.now()
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices SET status = ?'),
        ['partial_refund', 50, 1]
      );
    });
  });

  describe('getOrCreatePaymentUrl', () => {
    it('returns existing payment link url if active', async () => {
      mockDb.get.mockResolvedValue({
        stripe_session_id: 'cs_test_123',
        payment_url: 'https://checkout.stripe.com/pay/cs_test_123',
        amount: 10000,
        currency: 'usd',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z'
      });

      const { getOrCreatePaymentUrl } = await import('../../../server/services/integrations/stripe-service');

      const result = await getOrCreatePaymentUrl(1);
      expect(result).toBe('https://checkout.stripe.com/pay/cs_test_123');
    });

    it('returns null when invoice not found', async () => {
      mockDb.get
        .mockResolvedValueOnce(undefined) // No existing link
        .mockResolvedValueOnce(undefined); // No invoice

      const { getOrCreatePaymentUrl } = await import('../../../server/services/integrations/stripe-service');

      const result = await getOrCreatePaymentUrl(1);
      expect(result).toBeNull();
    });

    it('returns null for paid invoices', async () => {
      mockDb.get
        .mockResolvedValueOnce(undefined) // No existing link
        .mockResolvedValueOnce({ id: 1, status: 'paid' }); // Invoice is paid

      const { getOrCreatePaymentUrl } = await import('../../../server/services/integrations/stripe-service');

      const result = await getOrCreatePaymentUrl(1);
      expect(result).toBeNull();
    });
  });
});
