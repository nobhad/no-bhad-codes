/**
 * ===============================================
 * ZAPIER INTEGRATION SERVICE
 * ===============================================
 * @file server/services/integrations/zapier-service.ts
 *
 * Provides Zapier-compatible webhook formats and helpers
 * for seamless integration with Zapier automations.
 */

import { getDatabase } from '../../database/init';

// Zapier-compatible event payload formats
export interface ZapierPayload {
  id: string;
  event_type: string;
  timestamp: string;
  data: Record<string, unknown>;
  meta: {
    version: string;
    source: string;
  };
}

// Zapier trigger sample data for testing
export interface ZapierTriggerSample {
  event_type: string;
  sample_payload: ZapierPayload;
  description: string;
}

/**
 * Format event data into Zapier-compatible payload structure
 */
export function formatZapierPayload(
  eventType: string,
  data: Record<string, unknown>,
  entityId?: string | number
): ZapierPayload {
  return {
    id: `${eventType}_${entityId || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    data: flattenObject(data),
    meta: {
      version: '1.0',
      source: 'no-bhad-codes'
    }
  };
}

/**
 * Flatten nested objects for Zapier compatibility
 * Zapier works better with flat structures
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else if (value instanceof Date) {
      result[newKey] = value.toISOString();
    } else if (Array.isArray(value)) {
      // Convert arrays to comma-separated strings for Zapier
      result[newKey] = value.map(v =>
        typeof v === 'object' ? JSON.stringify(v) : String(v)
      ).join(', ');
      result[`${newKey}_count`] = value.length;
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Get sample payloads for Zapier trigger testing
 */
export function getZapierTriggerSamples(): ZapierTriggerSample[] {
  return [
    {
      event_type: 'invoice.created',
      description: 'Triggered when a new invoice is created',
      sample_payload: formatZapierPayload('invoice.created', {
        invoice: {
          id: 123,
          number: 'INV-2026-001',
          client_name: 'Acme Corp',
          client_email: 'billing@acme.com',
          amount: 5000.00,
          currency: 'USD',
          status: 'draft',
          due_date: '2026-03-10',
          line_items: [
            { description: 'Web Design', amount: 3000 },
            { description: 'Development', amount: 2000 }
          ]
        }
      }, 123)
    },
    {
      event_type: 'invoice.paid',
      description: 'Triggered when an invoice is marked as paid',
      sample_payload: formatZapierPayload('invoice.paid', {
        invoice: {
          id: 123,
          number: 'INV-2026-001',
          client_name: 'Acme Corp',
          client_email: 'billing@acme.com',
          amount: 5000.00,
          amount_paid: 5000.00,
          currency: 'USD',
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'stripe'
        }
      }, 123)
    },
    {
      event_type: 'project.created',
      description: 'Triggered when a new project is created',
      sample_payload: formatZapierPayload('project.created', {
        project: {
          id: 456,
          name: 'New Website Project',
          client_name: 'Acme Corp',
          client_email: 'contact@acme.com',
          type: 'web-design',
          status: 'active',
          start_date: '2026-02-15',
          due_date: '2026-04-15',
          budget: 10000.00
        }
      }, 456)
    },
    {
      event_type: 'project.completed',
      description: 'Triggered when a project is marked as completed',
      sample_payload: formatZapierPayload('project.completed', {
        project: {
          id: 456,
          name: 'Website Redesign',
          client_name: 'Acme Corp',
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_hours: 120,
          final_amount: 12000.00
        }
      }, 456)
    },
    {
      event_type: 'contract.signed',
      description: 'Triggered when a contract is signed by client',
      sample_payload: formatZapierPayload('contract.signed', {
        contract: {
          id: 789,
          project_name: 'E-commerce Build',
          client_name: 'Shop Inc',
          client_email: 'legal@shop.com',
          signer_name: 'John Smith',
          signed_at: new Date().toISOString(),
          contract_type: 'standard'
        }
      }, 789)
    },
    {
      event_type: 'proposal.accepted',
      description: 'Triggered when a proposal is accepted',
      sample_payload: formatZapierPayload('proposal.accepted', {
        proposal: {
          id: 101,
          project_name: 'Mobile App',
          client_name: 'Tech Startup',
          client_email: 'founder@startup.com',
          selected_tier: 'premium',
          total_price: 25000.00,
          accepted_at: new Date().toISOString()
        }
      }, 101)
    },
    {
      event_type: 'task.completed',
      description: 'Triggered when a task is marked as completed',
      sample_payload: formatZapierPayload('task.completed', {
        task: {
          id: 202,
          title: 'Design Homepage Mockup',
          project_name: 'Website Redesign',
          milestone: 'Design Phase',
          assigned_to: 'designer@company.com',
          completed_at: new Date().toISOString(),
          actual_hours: 8
        }
      }, 202)
    },
    {
      event_type: 'client.created',
      description: 'Triggered when a new client is created',
      sample_payload: formatZapierPayload('client.created', {
        client: {
          id: 303,
          name: 'New Client LLC',
          email: 'contact@newclient.com',
          company: 'New Client LLC',
          phone: '+1-555-0123',
          created_at: new Date().toISOString()
        }
      }, 303)
    },
    {
      event_type: 'lead.created',
      description: 'Triggered when a new lead is submitted',
      sample_payload: formatZapierPayload('lead.created', {
        lead: {
          id: 404,
          name: 'Potential Customer',
          email: 'lead@example.com',
          company: 'Interested Corp',
          source: 'website',
          project_type: 'web-design',
          budget_range: '$5k-$10k',
          message: 'Interested in your services',
          created_at: new Date().toISOString()
        }
      }, 404)
    },
    {
      event_type: 'milestone.completed',
      description: 'Triggered when a project milestone is completed',
      sample_payload: formatZapierPayload('milestone.completed', {
        milestone: {
          id: 505,
          title: 'Design Phase Complete',
          project_name: 'Website Project',
          project_id: 456,
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_hours: 40
        }
      }, 505)
    }
  ];
}

/**
 * Create a Zapier-compatible webhook configuration
 */
export async function createZapierWebhook(
  name: string,
  url: string,
  events: string[],
  secretKey?: string
): Promise<{ id: number; secret_key: string }> {
  const db = getDatabase();

  // Generate secret key if not provided
  const secret = secretKey || generateSecretKey();

  // Create Zapier-optimized payload template
  const payloadTemplate = JSON.stringify({
    id: '{{id}}',
    event_type: '{{event_type}}',
    timestamp: '{{timestamp}}',
    data: '{{data}}',
    meta: {
      version: '1.0',
      source: 'no-bhad-codes'
    }
  });

  const result = await db.run(
    `INSERT INTO webhooks (name, url, method, payload_template, events, secret_key, is_active, created_at, updated_at)
     VALUES (?, ?, 'POST', ?, ?, ?, 1, datetime('now'), datetime('now'))`,
    [name, url, payloadTemplate, events.join(','), secret]
  ) as { lastID?: number };

  return {
    id: result.lastID || 0,
    secret_key: secret
  };
}

/**
 * Generate a secure secret key for webhook signing
 */
function generateSecretKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'whsec_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get all available Zapier event types
 */
export function getZapierEventTypes(): { value: string; label: string; description: string }[] {
  return [
    // Invoice events
    { value: 'invoice.created', label: 'Invoice Created', description: 'When a new invoice is created' },
    { value: 'invoice.sent', label: 'Invoice Sent', description: 'When an invoice is sent to client' },
    { value: 'invoice.paid', label: 'Invoice Paid', description: 'When an invoice is marked as paid' },
    { value: 'invoice.overdue', label: 'Invoice Overdue', description: 'When an invoice becomes overdue' },

    // Project events
    { value: 'project.created', label: 'Project Created', description: 'When a new project is created' },
    { value: 'project.started', label: 'Project Started', description: 'When a project status changes to active' },
    { value: 'project.completed', label: 'Project Completed', description: 'When a project is completed' },
    { value: 'project.status_changed', label: 'Project Status Changed', description: 'When project status changes' },

    // Contract events
    { value: 'contract.created', label: 'Contract Created', description: 'When a new contract is created' },
    { value: 'contract.sent', label: 'Contract Sent', description: 'When a contract is sent for signing' },
    { value: 'contract.signed', label: 'Contract Signed', description: 'When a contract is signed' },

    // Proposal events
    { value: 'proposal.created', label: 'Proposal Created', description: 'When a new proposal is created' },
    { value: 'proposal.sent', label: 'Proposal Sent', description: 'When a proposal is sent to client' },
    { value: 'proposal.accepted', label: 'Proposal Accepted', description: 'When a proposal is accepted' },
    { value: 'proposal.rejected', label: 'Proposal Rejected', description: 'When a proposal is rejected' },

    // Client events
    { value: 'client.created', label: 'Client Created', description: 'When a new client is created' },

    // Lead events
    { value: 'lead.created', label: 'Lead Created', description: 'When a new lead is submitted' },
    { value: 'lead.converted', label: 'Lead Converted', description: 'When a lead becomes a client' },

    // Task events
    { value: 'task.created', label: 'Task Created', description: 'When a new task is created' },
    { value: 'task.completed', label: 'Task Completed', description: 'When a task is completed' },
    { value: 'task.overdue', label: 'Task Overdue', description: 'When a task becomes overdue' },

    // Milestone events
    { value: 'milestone.completed', label: 'Milestone Completed', description: 'When a milestone is completed' }
  ];
}

export default {
  formatZapierPayload,
  flattenObject,
  getZapierTriggerSamples,
  createZapierWebhook,
  getZapierEventTypes
};
