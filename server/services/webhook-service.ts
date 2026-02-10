/**
 * Webhook Service
 * Handles webhook configuration, execution, delivery tracking, and retry logic
 */

import crypto from 'crypto';
import { getDatabase } from '../database/init.js';
import { WebhookConfig, WebhookDelivery, WebhookPayload } from '../models/webhook.js';
import type { Database } from '../database/init.js';

export class WebhookService {
  private db: Database;
  private signingAlgorithm = 'sha256';

  constructor(db?: Database) {
    if (!db) {
      this.db = getDatabase();
    } else {
      this.db = db;
    }
  }

  /**
   * Create a new webhook configuration
   */
  async createWebhook(
    name: string,
    url: string,
    events: string[],
    payloadTemplate: string,
    options?: {
      method?: 'POST' | 'PUT' | 'PATCH';
      headers?: Record<string, string>;
      retryEnabled?: boolean;
      retryMaxAttempts?: number;
      retryBackoffSeconds?: number;
    }
  ): Promise<WebhookConfig> {
    const secretKey = this.generateSecretKey();
    const method = options?.method || 'POST';
    const headers = JSON.stringify(options?.headers || {});
    const eventString = events.join(',');

    const result = await this.db.run(
      `INSERT INTO webhooks (name, url, method, headers, payload_template, events, secret_key, 
       retry_enabled, retry_max_attempts, retry_backoff_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        url,
        method,
        headers,
        payloadTemplate,
        eventString,
        secretKey,
        options?.retryEnabled ? 1 : 0,
        options?.retryMaxAttempts || 3,
        options?.retryBackoffSeconds || 60
      ]
    );

    if (!result.lastID) throw new Error('Failed to insert webhook');
    const webhook = await this.getWebhookById(result.lastID);
    if (!webhook) throw new Error('Failed to create webhook');
    return webhook;
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(id: number): Promise<WebhookConfig | null> {
    const row = await this.db.get('SELECT * FROM webhooks WHERE id = ?', [id]);
    if (!row) return null;
    return this.formatWebhook(row);
  }

  /**
   * List all webhooks (active and inactive)
   */
  async listWebhooks(activeOnly = false): Promise<WebhookConfig[]> {
    const query = activeOnly
      ? 'SELECT * FROM webhooks WHERE is_active = 1 ORDER BY created_at DESC'
      : 'SELECT * FROM webhooks ORDER BY created_at DESC';
    const rows = await this.db.all(query);
    return rows.map((row: any) => this.formatWebhook(row));
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(
    id: number,
    updates: Partial<Omit<WebhookConfig, 'id' | 'secret_key' | 'created_at'>>
  ): Promise<WebhookConfig> {
    const existing = await this.getWebhookById(id);
    if (!existing) throw new Error('Webhook not found');

    const {
      name = existing.name,
      url = existing.url,
      method = existing.method,
      headers = existing.headers,
      payload_template = existing.payload_template,
      events = existing.events,
      is_active = existing.is_active,
      retry_enabled = existing.retry_enabled,
      retry_max_attempts = existing.retry_max_attempts,
      retry_backoff_seconds = existing.retry_backoff_seconds
    } = {...updates};

    const eventString = Array.isArray(events) ? events.join(',') : events;
    const headerString = JSON.stringify(headers || {});

    await this.db.run(
      `UPDATE webhooks SET name=?, url=?, method=?, headers=?, payload_template=?, events=?, 
       is_active=?, retry_enabled=?, retry_max_attempts=?, retry_backoff_seconds=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [
        name,
        url,
        method,
        headerString,
        payload_template,
        eventString,
        is_active ? 1 : 0,
        retry_enabled ? 1 : 0,
        retry_max_attempts,
        retry_backoff_seconds,
        id
      ]
    );

    const updated = await this.getWebhookById(id);
    if (!updated) throw new Error('Failed to update webhook');
    return updated;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: number): Promise<void> {
    await this.db.run('DELETE FROM webhooks WHERE id = ?', [id]);
  }

  /**
   * Toggle webhook active status
   */
  async toggleWebhook(id: number, active: boolean): Promise<WebhookConfig> {
    await this.db.run('UPDATE webhooks SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [
      active ? 1 : 0,
      id
    ]);
    const webhook = await this.getWebhookById(id);
    if (!webhook) throw new Error('Webhook not found');
    return webhook;
  }

  /**
   * Trigger webhook for event
   * Finds matching webhooks and executes them
   */
  async triggerEvent(eventType: string, eventData: Record<string, any>): Promise<void> {
    const webhooks = await this.listWebhooks(true); // Get active only
    const matching = webhooks.filter(w => w.events.includes(eventType));

    for (const webhook of matching) {
      await this.executeWebhook(webhook, eventType, eventData);
    }
  }

  /**
   * Execute webhook delivery (primary execution)
   */
  private async executeWebhook(
    webhook: WebhookConfig,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    const payload = this.buildPayload(eventType, eventData, webhook.payload_template);
    const signature = this.generateSignature(payload, webhook.secret_key);

    // Create delivery record
    const result = await this.db.run(
      `INSERT INTO webhook_deliveries (webhook_id, event_type, event_data, signature, status, attempt_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [webhook.id, eventType, JSON.stringify(payload), signature, 'pending', 1]
    );

    if (!result.lastID) throw new Error('Failed to insert delivery record');
    // Attempt delivery
    await this.deliverWebhookAttempt(webhook, result.lastID, payload, signature);
  }

  /**
   * Deliver webhook with retry logic
   */
  private async deliverWebhookAttempt(
    webhook: WebhookConfig,
    deliveryId: number,
    payload: WebhookPayload,
    signature: string
  ): Promise<void> {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-Signature': `${this.signingAlgorithm}=${signature}`,
        'X-Timestamp': new Date().toISOString(),
        'X-Event-ID': payload.event_id,
        ...webhook.headers
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseBody = await response.text();
      const success = response.ok;

      await this.db.run(
        `UPDATE webhook_deliveries 
         SET status=?, response_status=?, response_body=?, delivered_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [success ? 'success' : 'failed', response.status, responseBody, deliveryId]
      );

      if (!success && webhook.retry_enabled) {
        await this.scheduleRetry(deliveryId, webhook);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.db.run(
        `UPDATE webhook_deliveries 
         SET status='failed', error_message=?, updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [errorMessage, deliveryId]
      );

      // Schedule retry if enabled
      if (webhook.retry_enabled) {
        await this.scheduleRetry(deliveryId, webhook);
      }
    }
  }

  /**
   * Schedule retry for failed delivery
   */
  private async scheduleRetry(deliveryId: number, webhook: WebhookConfig): Promise<void> {
    const delivery = await this.getDeliveryById(deliveryId);
    if (!delivery) return;

    const attempt = delivery.attempt_number + 1;
    if (attempt > webhook.retry_max_attempts) {
      // Max retries exceeded
      await this.db.run(
        `UPDATE webhook_deliveries SET status='failed', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [deliveryId]
      );
      return;
    }

    // Calculate next retry time with exponential backoff
    const backoffMs = webhook.retry_backoff_seconds * 1000 * Math.pow(2, attempt - 1);
    const nextRetryTime = new Date(Date.now() + backoffMs).toISOString();

    await this.db.run(
      `UPDATE webhook_deliveries 
       SET status='retrying', attempt_number=?, next_retry_at=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [attempt, nextRetryTime, deliveryId]
    );
  }

  /**
   * Process pending retries
   * Should be called periodically (e.g., every minute by a background job)
   */
  async processPendingRetries(): Promise<void> {
    const deliveries = await this.db.all(
      `SELECT d.*, w.* FROM webhook_deliveries d
       JOIN webhooks w ON d.webhook_id = w.id
       WHERE d.status = 'retrying' AND d.next_retry_at <= CURRENT_TIMESTAMP
       ORDER BY d.next_retry_at ASC`
    );

    for (const row of deliveries) {
      const webhookData = {
        id: row.webhook_id as number,
        name: row.name as string,
        url: row.url as string,
        method: row.method as 'POST' | 'PUT' | 'PATCH',
        headers: JSON.parse((row.headers as string) || '{}'),
        payload_template: row.payload_template as string,
        events: (row.events as string).split(',').map((e: string) => e.trim()),
        is_active: Boolean(row.is_active),
        secret_key: row.secret_key as string,
        retry_enabled: Boolean(row.retry_enabled),
        retry_max_attempts: row.retry_max_attempts as number,
        retry_backoff_seconds: row.retry_backoff_seconds as number,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string
      };

      const payload = JSON.parse(row.event_data as string);
      const signature = row.signature as string;

      await this.deliverWebhookAttempt(webhookData as WebhookConfig, row.id as number, payload, signature);
    }
  }

  /**
   * Get delivery by ID
   */
  async getDeliveryById(id: number): Promise<WebhookDelivery | null> {
    const row = await this.db.get('SELECT * FROM webhook_deliveries WHERE id = ?', [id]);
    if (!row) return null;
    return this.formatDelivery(row);
  }

  /**
   * List deliveries for a webhook
   */
  async getWebhookDeliveries(
    webhookId: number,
    options?: {
      status?: string;
      eventType?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
    let query = 'SELECT * FROM webhook_deliveries WHERE webhook_id = ?';
    const params: any[] = [webhookId];

    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    if (options?.eventType) {
      query += ' AND event_type = ?';
      params.push(options.eventType);
    }

    // Get total count
    const countResult = await this.db.get(
      `SELECT COUNT(*) as count FROM webhook_deliveries WHERE webhook_id = ?
       ${options?.status ? 'AND status = ?' : ''}
       ${options?.eventType ? 'AND event_type = ?' : ''}`,
      params
    );

    // Get paginated results
    query += ' ORDER BY created_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options?.offset || 0);
    }

    const rows = await this.db.all(query, params);
    return {
      deliveries: rows.map((row: any) => this.formatDelivery(row)),
      total: Number(countResult?.count) || 0
    };
  }

  /**
   * Get delivery statistics for a webhook
   */
  async getDeliveryStats(webhookId: number): Promise<{
    total: number;
    success: number;
    failed: number;
    retrying: number;
    successRate: number;
  }> {
    const result = await this.db.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'retrying' THEN 1 ELSE 0 END) as retrying
       FROM webhook_deliveries
       WHERE webhook_id = ?`,
      [webhookId]
    );

    const total = Number(result?.total) || 0;
    const success = Number(result?.success) || 0;
    const failed = Number(result?.failed) || 0;
    const retrying = Number(result?.retrying) || 0;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

    return { total, success, failed, retrying, successRate };
  }

  /**
   * Regenerate secret key (for rotation)
   */
  async regenerateSecret(webhookId: number): Promise<string> {
    const newSecret = this.generateSecretKey();
    await this.db.run('UPDATE webhooks SET secret_key = ?, updated_at=CURRENT_TIMESTAMP WHERE id = ?', [
      newSecret,
      webhookId
    ]);
    return newSecret;
  }

  // ===== Private Helper Methods =====

  /**
   * Build webhook payload from template and data
   */
  private buildPayload(
    eventType: string,
    eventData: Record<string, any>,
    template: string
  ): WebhookPayload {
    let payloadStr = template;

    // Replace {{variable}} placeholders
    const allData = { ...eventData, event_type: eventType };
    payloadStr = payloadStr.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const value = this.getNestedValue(allData, key.trim());
      return value !== undefined ? String(value) : '';
    });

    const customPayload = JSON.parse(payloadStr);

    return {
      event_type: eventType,
      event_id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      data: customPayload
    };
  }

  /**
   * Get nested object value by dot notation (e.g., "invoice.total")
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private generateSignature(payload: WebhookPayload, secretKey: string): string {
    return crypto
      .createHmac(this.signingAlgorithm, secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Generate secure random secret key
   */
  private generateSecretKey(): string {
    return `whk_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Format webhook row from database
   */
  private formatWebhook(row: any): WebhookConfig {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      method: row.method || 'POST',
      headers: JSON.parse(row.headers || '{}'),
      payload_template: row.payload_template,
      events: row.events.split(',').map((e: string) => e.trim()),
      is_active: Boolean(row.is_active),
      secret_key: row.secret_key,
      retry_enabled: Boolean(row.retry_enabled),
      retry_max_attempts: row.retry_max_attempts,
      retry_backoff_seconds: row.retry_backoff_seconds,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Format delivery row from database
   */
  private formatDelivery(row: any): WebhookDelivery {
    return {
      id: row.id,
      webhook_id: row.webhook_id,
      event_type: row.event_type,
      event_data: row.event_data,
      status: row.status,
      attempt_number: row.attempt_number,
      response_status: row.response_status,
      response_body: row.response_body,
      error_message: row.error_message,
      signature: row.signature,
      delivered_at: row.delivered_at,
      next_retry_at: row.next_retry_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

// Export singleton instance (lazy-loaded to avoid database initialization issues in tests)
let webhookServiceInstance: WebhookService;

export function getWebhookService(): WebhookService {
  if (!webhookServiceInstance) {
    webhookServiceInstance = new WebhookService();
  }
  return webhookServiceInstance;
}

export const webhookService = {
  getWebhookById: async (id: number) => getWebhookService().getWebhookById(id),
  listWebhooks: async (activeOnly = false) => getWebhookService().listWebhooks(activeOnly),
  createWebhook: async (
    name: string,
    url: string,
    events: string[],
    payloadTemplate: string,
    options?: any
  ) => getWebhookService().createWebhook(name, url, events, payloadTemplate, options),
  updateWebhook: async (id: number, updates: any) => getWebhookService().updateWebhook(id, updates),
  deleteWebhook: async (id: number) => getWebhookService().deleteWebhook(id),
  toggleWebhook: async (id: number, active: boolean) => getWebhookService().toggleWebhook(id, active),
  triggerEvent: async (eventType: string, eventData: any) =>
    getWebhookService().triggerEvent(eventType, eventData),
  getDeliveryById: async (id: number) => getWebhookService().getDeliveryById(id),
  getWebhookDeliveries: async (webhookId: number, options?: any) =>
    getWebhookService().getWebhookDeliveries(webhookId, options),
  getDeliveryStats: async (webhookId: number) => getWebhookService().getDeliveryStats(webhookId),
  processPendingRetries: async () => getWebhookService().processPendingRetries(),
  regenerateSecret: async (webhookId: number) => getWebhookService().regenerateSecret(webhookId)
};

export default webhookService;
