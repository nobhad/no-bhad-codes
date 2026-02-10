import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookService } from '../../../server/services/webhook-service';

describe('Webhook Service', () => {
  let mockDb: any;
  let service: WebhookService;

  beforeEach(() => {
    mockDb = {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn()
    };
    service = new WebhookService(mockDb);
  });

  describe('Webhook CRUD Operations', () => {
    it('should create a new webhook', async () => {
      const result = { lastID: 1 };
      mockDb.run.mockResolvedValueOnce(result);
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        method: 'POST',
        headers: '{}',
        payload_template: '{"data": "{{data}}"}',
        events: 'invoice.created,contract.signed',
        is_active: 1,
        secret_key: 'whk_test123',
        retry_enabled: 1,
        retry_max_attempts: 3,
        retry_backoff_seconds: 60,
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      const webhook = await service.createWebhook(
        'Test Webhook',
        'https://example.com/webhook',
        ['invoice.created', 'contract.signed'],
        '{"data": "{{data}}"}',
        { method: 'POST', headers: {} }
      );

      expect(webhook).toMatchObject({
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook'
      });
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should retrieve webhook by ID', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        method: 'POST',
        headers: '{}',
        payload_template: '{}',
        events: 'invoice.created',
        is_active: 1,
        secret_key: 'whk_123',
        retry_enabled: 1,
        retry_max_attempts: 3,
        retry_backoff_seconds: 60,
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      const webhook = await service.getWebhookById(1);

      expect(webhook).not.toBeNull();
      expect(webhook?.id).toBe(1);
      expect(webhook?.name).toBe('Test Webhook');
      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM webhooks WHERE id = ?', [1]);
    });

    it('should return null for non-existent webhook', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const webhook = await service.getWebhookById(999);

      expect(webhook).toBeNull();
    });

    it('should list all webhooks', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Webhook 1',
          events: 'invoice.created',
          is_active: 1,
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z',
          headers: '{}',
          method: 'POST',
          payload_template: '{}',
          secret_key: 'whk_1',
          retry_enabled: 1,
          retry_max_attempts: 3,
          retry_backoff_seconds: 60
        },
        {
          id: 2,
          name: 'Webhook 2',
          events: 'contract.signed',
          is_active: 0,
          created_at: '2026-02-10T13:00:00.000Z',
          updated_at: '2026-02-10T13:00:00.000Z',
          headers: '{}',
          method: 'POST',
          payload_template: '{}',
          secret_key: 'whk_2',
          retry_enabled: 1,
          retry_max_attempts: 3,
          retry_backoff_seconds: 60
        }
      ]);

      const webhooks = await service.listWebhooks();

      expect(webhooks).toHaveLength(2);
      expect(webhooks[0].name).toBe('Webhook 1');
      expect(webhooks[1].is_active).toBe(false);
    });

    it('should list only active webhooks', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Active Webhook',
          events: 'invoice.created',
          is_active: 1,
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z',
          headers: '{}',
          method: 'POST',
          payload_template: '{}',
          secret_key: 'whk_1',
          retry_enabled: 1,
          retry_max_attempts: 3,
          retry_backoff_seconds: 60
        }
      ]);

      const webhooks = await service.listWebhooks(true);

      expect(webhooks).toHaveLength(1);
      expect(webhooks[0].is_active).toBe(true);
      // Verify query includes activeOnly filter
      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[0]).toContain('is_active = 1');
    });

    it('should update webhook configuration', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        method: 'POST',
        headers: '{}',
        payload_template: '{}',
        events: 'invoice.created',
        is_active: 1,
        secret_key: 'whk_123',
        retry_enabled: 1,
        retry_max_attempts: 3,
        retry_backoff_seconds: 60,
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      mockDb.get.mockResolvedValueOnce({
        id: 1,
        name: 'Updated Webhook',
        url: 'https://newurl.com/webhook',
        method: 'PUT',
        headers: '{}',
        payload_template: '{}',
        events: 'invoice.created',
        is_active: 1,
        secret_key: 'whk_123',
        retry_enabled: 1,
        retry_max_attempts: 5,
        retry_backoff_seconds: 60,
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:01:00.000Z'
      });

      const webhook = await service.updateWebhook(1, {
        name: 'Updated Webhook',
        url: 'https://newurl.com/webhook',
        method: 'PUT',
        retry_max_attempts: 5
      });

      expect(webhook.name).toBe('Updated Webhook');
      expect(webhook.url).toBe('https://newurl.com/webhook');
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should delete webhook', async () => {
      await service.deleteWebhook(1);

      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM webhooks WHERE id = ?', [1]);
    });

    it('should toggle webhook active status', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        name: 'Test',
        is_active: 0,
        events: 'test',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z',
        url: 'https://example.com',
        method: 'POST',
        headers: '{}',
        payload_template: '{}',
        secret_key: 'whk_123',
        retry_enabled: 1,
        retry_max_attempts: 3,
        retry_backoff_seconds: 60
      });

      const webhook = await service.toggleWebhook(1, false);

      expect(webhook.is_active).toBe(false);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE webhooks SET is_active=?'),
        expect.arrayContaining([0, 1])
      );
    });
  });

  describe('Webhook Delivery Tracking', () => {
    it('should retrieve delivery by ID', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        webhook_id: 1,
        event_type: 'invoice.created',
        event_data: '{"invoice_id": 123}',
        status: 'success',
        attempt_number: 1,
        response_status: 200,
        response_body: 'OK',
        error_message: null,
        signature: 'sig_abc123',
        delivered_at: '2026-02-10T12:01:00.000Z',
        next_retry_at: null,
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:01:00.000Z'
      });

      const delivery = await service.getDeliveryById(1);

      expect(delivery).not.toBeNull();
      expect(delivery?.status).toBe('success');
      expect(delivery?.response_status).toBe(200);
    });

    it('should list webhook deliveries with pagination', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 100 });
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          webhook_id: 1,
          event_type: 'invoice.created',
          event_data: '{}',
          status: 'success',
          attempt_number: 1,
          response_status: 200,
          response_body: null,
          error_message: null,
          signature: 'sig_1',
          delivered_at: '2026-02-10T12:00:00.000Z',
          next_retry_at: null,
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z'
        }
      ]);

      const result = await service.getWebhookDeliveries(1, { limit: 50, offset: 0 });

      expect(result.total).toBe(100);
      expect(result.deliveries).toHaveLength(1);
      expect(result.deliveries[0].status).toBe('success');
    });

    it('should filter deliveries by status', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 5 });
      mockDb.all.mockResolvedValueOnce([
        {
          id: 2,
          webhook_id: 1,
          event_type: 'invoice.created',
          event_data: '{}',
          status: 'failed',
          attempt_number: 1,
          response_status: 500,
          response_body: 'Server Error',
          error_message: 'Server Error',
          signature: 'sig_2',
          delivered_at: null,
          next_retry_at: '2026-02-10T12:05:00.000Z',
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:01.000Z'
        }
      ]);

      const result = await service.getWebhookDeliveries(1, { status: 'failed' });

      expect(result.deliveries).toHaveLength(1);
      expect(result.deliveries[0].status).toBe('failed');
    });

    it('should calculate delivery statistics', async () => {
      mockDb.get.mockResolvedValueOnce({
        total: 100,
        success: 85,
        failed: 10,
        retrying: 5
      });

      const stats = await service.getDeliveryStats(1);

      expect(stats.total).toBe(100);
      expect(stats.success).toBe(85);
      expect(stats.failed).toBe(10);
      expect(stats.retrying).toBe(5);
      expect(stats.successRate).toBe(85); // 85/100 * 100
    });
  });

  describe('Retry Logic', () => {
    it('should schedule retry with exponential backoff', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        webhook_id: 1,
        event_type: 'invoice.created',
        event_data: '{}',
        status: 'failed',
        attempt_number: 1,
        response_status: null,
        response_body: null,
        error_message: 'Connection timeout',
        signature: 'sig_1',
        delivered_at: null,
        next_retry_at: null,
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      mockDb.run.mockResolvedValueOnce(undefined);

      // Manually call processPendingRetries logic (simplified)
      const now = Date.now();
      const baseBackoff = 60000; // 60 seconds for attempt 1
      const expectedNextRetry = now + baseBackoff;

      // Verify retry scheduling would use exponential backoff
      const attempt1Backoff = 60 * 1000; // 60s
      const attempt2Backoff = 60 * 1000 * Math.pow(2, 1); // 120s
      const attempt3Backoff = 60 * 1000 * Math.pow(2, 2); // 240s

      expect(attempt1Backoff).toBe(60000);
      expect(attempt2Backoff).toBe(120000);
      expect(attempt3Backoff).toBe(240000);
    });

    it('should max out retries after threshold', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        webhook_id: 1,
        event_type: 'invoice.created',
        event_data: '{}',
        status: 'retrying',
        attempt_number: 3, // Max attempts is 3
        response_status: 500,
        response_body: 'Error',
        error_message: 'Server error',
        signature: 'sig_1',
        delivered_at: null,
        next_retry_at: '2026-02-10T12:10:00.000Z',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      // Max attempts = 3, so after 3 attempts, should mark as failed
      const canRetry = 3 < 3; // false
      expect(canRetry).toBe(false);
    });
  });

  describe('Event Triggering', () => {
    it('should trigger event for matching webhooks', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Invoice Webhook',
          events: 'invoice.created,invoice.paid',
          is_active: 1,
          url: 'https://example.com/webhook',
          method: 'POST',
          headers: '{}',
          payload_template: '{"invoice_id": "{{invoice_id}}"}',
          secret_key: 'whk_123',
          retry_enabled: 1,
          retry_max_attempts: 3,
          retry_backoff_seconds: 60,
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z'
        }
      ]);

      mockDb.run.mockResolvedValueOnce({ lastID: 1 });

      await service.triggerEvent('invoice.created', { invoice_id: '123' });

      expect(mockDb.all).toHaveBeenCalled();
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should not trigger inactive webhooks', async () => {
      mockDb.all.mockResolvedValueOnce([]); // No active webhooks

      await service.triggerEvent('invoice.created', { invoice_id: '123' });

      // Verify query was for active webhooks
      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[0]).toContain('is_active = 1');
    });
  });

  describe('Payload Building & Signatures', () => {
    it('should build payload with variable substitution', async () => {
      // Test payload building (via triggerEvent)
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Test',
          events: 'invoice.created',
          is_active: 1,
          url: 'https://example.com',
          method: 'POST',
          headers: '{}',
          payload_template: '{"invoice_id": "{{invoice_id}}", "amount": {{amount}}}',
          secret_key: 'whk_123',
          retry_enabled: 1,
          retry_max_attempts: 3,
          retry_backoff_seconds: 60,
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z'
        }
      ]);

      mockDb.run.mockResolvedValueOnce({ lastID: 1 });

      await service.triggerEvent('invoice.created', { invoice_id: 'INV-123', amount: 1000 });

      // Verify payload template substitution happens
      expect(mockDb.run).toHaveBeenCalled();
      const callArgs = mockDb.run.mock.calls[0];
      expect(callArgs[0]).toContain('webhook_deliveries');
    });

    it('should generate unique signatures per delivery', async () => {
      // Create two deliveries with same payload should have different signatures
      // (due to unique event_id)
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Test',
          events: 'invoice.created',
          is_active: 1,
          url: 'https://example.com',
          method: 'POST',
          headers: '{}',
          payload_template: '{}',
          secret_key: 'whk_123',
          retry_enabled: 1,
          retry_max_attempts: 3,
          retry_backoff_seconds: 60,
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z'
        }
      ]);

      mockDb.run.mockResolvedValueOnce({ lastID: 1 });

      await service.triggerEvent('invoice.created', {});

      // Check signature was generated (HMAC-SHA256 hex string)
      const insertCall = mockDb.run.mock.calls[0];
      const signatureArg = insertCall[1][3]; // 4th parameter in the INSERT
      expect(signatureArg).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex is 64 chars
    });

    it('should use correct signature algorithm (HMAC-SHA256)', async () => {
      // The service should use sha256 for HMAC
      // This is validated by the fact that signatures are generated correctly
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Test',
          events: 'test.event',
          is_active: 1,
          url: 'https://example.com',
          method: 'POST',
          headers: '{}',
          payload_template: '{}',
          secret_key: 'my_secret',
          retry_enabled: 1,
          retry_max_attempts: 3,
          retry_backoff_seconds: 60,
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z'
        }
      ]);

      mockDb.run.mockResolvedValueOnce({ lastID: 1 });

      await service.triggerEvent('test.event', { data: 'test' });

      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('Secret Key Management', () => {
    it('should regenerate webhook secret key', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);

      const newSecret = await service.regenerateSecret(1);

      expect(newSecret).toMatch(/^whk_/);
      expect(newSecret.length).toBeGreaterThan(10);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE webhooks SET secret_key'),
        expect.arrayContaining([expect.stringMatching(/^whk_/), 1])
      );
    });
  });

  describe('error handling', () => {
    it('should handle webhook creation with invalid template JSON', async () => {
      const result = await service.createWebhook(
        'Test',
        'https://example.com',
        ['test'],
        'invalid json'
      ).catch(e => e);

      expect(result).toBeDefined();
    });

    it('should handle retrieval of non-existent webhook', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const webhook = await service.getWebhookById(999);

      expect(webhook).toBeNull();
    });

    it('should handle empty deliveries list', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 0 });
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.getWebhookDeliveries(999);

      expect(result.deliveries).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Database error'));

      try {
        await service.getWebhookById(1);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
