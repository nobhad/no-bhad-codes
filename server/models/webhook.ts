/**
 * Webhook Models and Types
 * Handles webhook configuration, delivery logs, and execution
 */

import type { Database } from '../database/init.js';
export interface WebhookConfig {
  id: number;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  payload_template: string; // JSON template with {{variable}} placeholders
  events: string[]; // array of event types
  is_active: boolean;
  secret_key: string; // HMAC signature key
  retry_enabled: boolean;
  retry_max_attempts: number;
  retry_backoff_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: number;
  webhook_id: number;
  event_type: string;
  event_data: string; // JSON
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempt_number: number;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  signature: string; // HMAC-SHA256 signature
  delivered_at: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookPayload {
  event_type: string;
  event_id: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Create webhook tables if they don't exist
 */
export async function initializeWebhookTables(db: Database): Promise<void> {
  // Create webhooks table
  await db.run(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'POST',
      headers TEXT DEFAULT '{}', -- JSON
      payload_template TEXT NOT NULL,
      events TEXT NOT NULL, -- comma-separated
      is_active INTEGER NOT NULL DEFAULT 1,
      secret_key TEXT NOT NULL UNIQUE,
      retry_enabled INTEGER NOT NULL DEFAULT 1,
      retry_max_attempts INTEGER NOT NULL DEFAULT 3,
      retry_backoff_seconds INTEGER NOT NULL DEFAULT 60,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create webhook deliveries table
  await db.run(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      event_data TEXT NOT NULL, -- JSON
      status TEXT NOT NULL DEFAULT 'pending',
      attempt_number INTEGER NOT NULL DEFAULT 1,
      response_status INTEGER,
      response_body TEXT,
      error_message TEXT,
      signature TEXT NOT NULL,
      delivered_at DATETIME,
      next_retry_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for query performance
  await db.run(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id 
    ON webhook_deliveries(webhook_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status 
    ON webhook_deliveries(status)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type 
    ON webhook_deliveries(event_type)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry 
    ON webhook_deliveries(next_retry_at)`);
}
