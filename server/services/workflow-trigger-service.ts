/**
 * ===============================================
 * WORKFLOW TRIGGER SERVICE
 * ===============================================
 * Event-driven automation system for triggering actions
 * based on system events.
 *
 * Usage:
 *   import { workflowTriggerService } from './workflow-trigger-service.js';
 *   await workflowTriggerService.emit('invoice.created', { invoice: {...} });
 */

import { getDatabase } from '../database/init.js';
import { emailService } from './email-service.js';
import { userService } from './user-service.js';

// ============================================
// Types
// ============================================

export type EventType =
  // Invoice events
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.paid'
  | 'invoice.overdue'
  | 'invoice.cancelled'
  // Contract events
  | 'contract.created'
  | 'contract.sent'
  | 'contract.signed'
  | 'contract.expired'
  // Project events
  | 'project.created'
  | 'project.started'
  | 'project.completed'
  | 'project.status_changed'
  | 'project.milestone_completed'
  // Client events
  | 'client.created'
  | 'client.activated'
  | 'client.deactivated'
  // Message events
  | 'message.created'
  | 'message.read'
  // File events
  | 'file.uploaded'
  | 'file.downloaded'
  // Proposal events
  | 'proposal.created'
  | 'proposal.sent'
  | 'proposal.accepted'
  | 'proposal.rejected'
  // Lead events
  | 'lead.created'
  | 'lead.converted'
  | 'lead.stage_changed'
  // Deliverable events
  | 'deliverable.submitted'
  | 'deliverable.approved'
  | 'deliverable.rejected'
  // Task events
  | 'task.created'
  | 'task.completed'
  | 'task.overdue';

export type ActionType = 'send_email' | 'create_task' | 'update_status' | 'webhook' | 'notify';

interface WorkflowTrigger {
  id: number;
  name: string;
  description: string | null;
  event_type: EventType;
  conditions: Record<string, unknown> | null;
  action_type: ActionType;
  action_config: Record<string, unknown>;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface EventContext {
  [key: string]: unknown;
  entityId?: number | null;
  triggeredBy?: string;
}

// ============================================
// Workflow Trigger Service
// ============================================

class WorkflowTriggerService {
  private listeners: Map<string, ((data: EventContext) => Promise<void>)[]> = new Map();

  /**
   * Emit an event and trigger all matching workflows
   */
  async emit(eventType: EventType, context: EventContext): Promise<void> {
    const startTime = Date.now();
    const db = getDatabase();

    // Log the event
    await db.run(
      `INSERT INTO system_events (event_type, entity_type, entity_id, event_data, triggered_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        eventType,
        this.extractEntityType(eventType),
        context.entityId ?? null,
        JSON.stringify(context),
        context.triggeredBy || 'system'
      ]
    );

    // Get all active triggers for this event type
    const triggers = await db.all(
      `SELECT * FROM workflow_triggers
       WHERE event_type = ? AND is_active = TRUE
       ORDER BY priority DESC`,
      [eventType]
    ) as unknown as WorkflowTrigger[];

    console.log(`[WorkflowTrigger] Event ${eventType} - Found ${triggers.length} triggers`);

    // Execute each trigger
    for (const trigger of triggers) {
      try {
        // Check conditions
        if (trigger.conditions) {
          const conditions = typeof trigger.conditions === 'string'
            ? JSON.parse(trigger.conditions)
            : trigger.conditions;

          if (!this.evaluateConditions(conditions, context)) {
            await this.logTriggerExecution(trigger.id, eventType, context, 'skipped', null, Date.now() - startTime);
            continue;
          }
        }

        // Execute action
        await this.executeAction(trigger, context);
        await this.logTriggerExecution(trigger.id, eventType, context, 'success', null, Date.now() - startTime);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[WorkflowTrigger] Trigger ${trigger.id} failed:`, errorMessage);
        await this.logTriggerExecution(trigger.id, eventType, context, 'failed', errorMessage, Date.now() - startTime);
      }
    }

    // Call any registered listeners
    const listeners = this.listeners.get(eventType) || [];
    for (const listener of listeners) {
      try {
        await listener(context);
      } catch (error) {
        console.error(`[WorkflowTrigger] Listener failed for ${eventType}:`, error);
      }
    }
  }

  /**
   * Register a listener for an event type (for in-code handlers)
   */
  on(eventType: EventType, handler: (data: EventContext) => Promise<void>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);
  }

  /**
   * Remove a listener
   */
  off(eventType: EventType, handler: (data: EventContext) => Promise<void>): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // ============================================
  // TRIGGER MANAGEMENT
  // ============================================

  /**
   * Get all triggers
   */
  async getTriggers(eventType?: EventType): Promise<WorkflowTrigger[]> {
    const db = getDatabase();
    if (eventType) {
      return db.all(
        'SELECT * FROM workflow_triggers WHERE event_type = ? ORDER BY priority DESC, name',
        [eventType]
      ) as unknown as Promise<WorkflowTrigger[]>;
    }
    return db.all('SELECT * FROM workflow_triggers ORDER BY event_type, priority DESC, name') as unknown as Promise<WorkflowTrigger[]>;
  }

  /**
   * Get a specific trigger
   */
  async getTrigger(id: number): Promise<WorkflowTrigger | null> {
    const db = getDatabase();
    const result = await db.get('SELECT * FROM workflow_triggers WHERE id = ?', [id]);
    return (result as unknown as WorkflowTrigger) || null;
  }

  /**
   * Create a new trigger
   */
  async createTrigger(data: {
    name: string;
    description?: string;
    event_type: EventType;
    conditions?: Record<string, unknown>;
    action_type: ActionType;
    action_config: Record<string, unknown>;
    is_active?: boolean;
    priority?: number;
  }): Promise<WorkflowTrigger> {
    const db = getDatabase();
    const result = await db.run(
      `INSERT INTO workflow_triggers (name, description, event_type, conditions, action_type, action_config, is_active, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        data.event_type,
        data.conditions ? JSON.stringify(data.conditions) : null,
        data.action_type,
        JSON.stringify(data.action_config),
        data.is_active !== false,
        data.priority || 0
      ]
    );
    return this.getTrigger(result.lastID!) as Promise<WorkflowTrigger>;
  }

  /**
   * Update a trigger
   */
  async updateTrigger(id: number, data: Partial<{
    name: string;
    description: string;
    event_type: EventType;
    conditions: Record<string, unknown>;
    action_type: ActionType;
    action_config: Record<string, unknown>;
    is_active: boolean;
    priority: number;
  }>): Promise<WorkflowTrigger | null> {
    const db = getDatabase();
    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.event_type !== undefined) { updates.push('event_type = ?'); values.push(data.event_type); }
    if (data.conditions !== undefined) { updates.push('conditions = ?'); values.push(JSON.stringify(data.conditions)); }
    if (data.action_type !== undefined) { updates.push('action_type = ?'); values.push(data.action_type); }
    if (data.action_config !== undefined) { updates.push('action_config = ?'); values.push(JSON.stringify(data.action_config)); }
    if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active); }
    if (data.priority !== undefined) { updates.push('priority = ?'); values.push(data.priority); }

    if (updates.length === 0) return this.getTrigger(id);

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.run(
      `UPDATE workflow_triggers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.getTrigger(id);
  }

  /**
   * Delete a trigger
   */
  async deleteTrigger(id: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM workflow_triggers WHERE id = ?', [id]);
  }

  /**
   * Toggle trigger active state
   */
  async toggleTrigger(id: number): Promise<WorkflowTrigger | null> {
    const db = getDatabase();
    await db.run(
      'UPDATE workflow_triggers SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    return this.getTrigger(id);
  }

  // ============================================
  // LOGS AND HISTORY
  // ============================================

  /**
   * Get trigger execution logs
   */
  async getTriggerLogs(triggerId?: number, limit: number = 100): Promise<unknown[]> {
    const db = getDatabase();
    if (triggerId) {
      return db.all(
        `SELECT l.*, t.name as trigger_name
         FROM workflow_trigger_logs l
         JOIN workflow_triggers t ON l.trigger_id = t.id
         WHERE l.trigger_id = ?
         ORDER BY l.created_at DESC
         LIMIT ?`,
        [triggerId, limit]
      );
    }
    return db.all(
      `SELECT l.*, t.name as trigger_name
       FROM workflow_trigger_logs l
       JOIN workflow_triggers t ON l.trigger_id = t.id
       ORDER BY l.created_at DESC
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * Get system events
   */
  async getSystemEvents(eventType?: EventType, limit: number = 100): Promise<unknown[]> {
    const db = getDatabase();
    if (eventType) {
      return db.all(
        'SELECT * FROM system_events WHERE event_type = ? ORDER BY created_at DESC LIMIT ?',
        [eventType, limit]
      );
    }
    return db.all(
      'SELECT * FROM system_events ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Get available event types
   */
  getEventTypes(): string[] {
    return [
      'invoice.created', 'invoice.sent', 'invoice.paid', 'invoice.overdue', 'invoice.cancelled',
      'contract.created', 'contract.sent', 'contract.signed', 'contract.expired',
      'project.created', 'project.started', 'project.completed', 'project.status_changed', 'project.milestone_completed',
      'client.created', 'client.activated', 'client.deactivated',
      'message.created', 'message.read',
      'file.uploaded', 'file.downloaded',
      'proposal.created', 'proposal.sent', 'proposal.accepted', 'proposal.rejected',
      'lead.created', 'lead.converted', 'lead.stage_changed',
      'deliverable.submitted', 'deliverable.approved', 'deliverable.rejected',
      'task.created', 'task.completed', 'task.overdue'
    ];
  }

  /**
   * Get available action types
   */
  getActionTypes(): { type: ActionType; description: string }[] {
    return [
      { type: 'send_email', description: 'Send an email using a template' },
      { type: 'create_task', description: 'Create a task for the project' },
      { type: 'update_status', description: 'Update entity status' },
      { type: 'webhook', description: 'Call an external webhook URL' },
      { type: 'notify', description: 'Send in-app notification' }
    ];
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Execute a trigger action
   */
  private async executeAction(trigger: WorkflowTrigger, context: EventContext): Promise<void> {
    const config = typeof trigger.action_config === 'string'
      ? JSON.parse(trigger.action_config)
      : trigger.action_config;

    switch (trigger.action_type) {
    case 'send_email':
      await this.executeSendEmail(config, context);
      break;

    case 'create_task':
      await this.executeCreateTask(config, context);
      break;

    case 'update_status':
      await this.executeUpdateStatus(config, context);
      break;

    case 'webhook':
      await this.executeWebhook(config, context);
      break;

    case 'notify':
      await this.executeNotify(config, context);
      break;

    default:
      console.warn(`[WorkflowTrigger] Unknown action type: ${trigger.action_type}`);
    }
  }

  /**
   * Send email action
   */
  private async executeSendEmail(
    config: { template: string; to: string; subject?: string },
    context: EventContext
  ): Promise<void> {
    // Resolve recipient email
    let toEmail: string | undefined;
    if (config.to === 'client' && context.clientEmail) {
      toEmail = context.clientEmail as string;
    } else if (config.to === 'admin') {
      toEmail = process.env.ADMIN_EMAIL || 'admin@nobhadcodes.com';
    } else {
      toEmail = config.to;
    }

    if (!toEmail) {
      console.warn('[WorkflowTrigger] No recipient email for send_email action');
      return;
    }

    // For now, log the email that would be sent
    console.log(`[WorkflowTrigger] Would send email: template=${config.template}, to=${toEmail}`);

    // In production, use emailService to send
    // await emailService.sendEmail({
    //   to: toEmail,
    //   subject: this.interpolate(config.subject || '', context),
    //   template: config.template,
    //   data: context
    // });
  }

  /**
   * Create task action
   */
  private async executeCreateTask(
    config: { title: string; description?: string; assignee?: string; due_days?: number },
    context: EventContext
  ): Promise<void> {
    const db = getDatabase();
    const projectId = context.projectId as number;

    if (!projectId) {
      console.warn('[WorkflowTrigger] No projectId for create_task action');
      return;
    }

    const dueDate = config.due_days
      ? new Date(Date.now() + config.due_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;

    // Look up user ID for assignee during transition period
    const assigneeUserId = await userService.getUserIdByEmail(config.assignee);

    await db.run(
      `INSERT INTO project_tasks (project_id, title, description, assigned_to, assigned_to_user_id, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        projectId,
        this.interpolate(config.title, context),
        config.description ? this.interpolate(config.description, context) : null,
        config.assignee || null,
        assigneeUserId,
        dueDate
      ]
    );

    console.log(`[WorkflowTrigger] Created task for project ${projectId}: ${config.title}`);
  }

  /**
   * Update status action
   */
  private async executeUpdateStatus(
    config: { entity: string; status: string; field?: string },
    context: EventContext
  ): Promise<void> {
    const db = getDatabase();
    const field = config.field || 'status';
    let table: string;
    let idField: string;
    let entityId: number | undefined;

    switch (config.entity) {
    case 'project':
      table = 'projects';
      idField = 'id';
      entityId = context.projectId as number;
      break;
    case 'invoice':
      table = 'invoices';
      idField = 'id';
      entityId = context.invoiceId as number;
      break;
    case 'client':
      table = 'clients';
      idField = 'id';
      entityId = context.clientId as number;
      break;
    default:
      console.warn(`[WorkflowTrigger] Unknown entity type for update_status: ${config.entity}`);
      return;
    }

    if (!entityId) {
      console.warn(`[WorkflowTrigger] No ${config.entity}Id for update_status action`);
      return;
    }

    await db.run(
      `UPDATE ${table} SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE ${idField} = ?`,
      [config.status, entityId]
    );

    console.log(`[WorkflowTrigger] Updated ${config.entity} ${entityId} ${field} to ${config.status}`);
  }

  /**
   * Webhook action
   */
  private async executeWebhook(
    config: { url: string; method?: string; headers?: Record<string, string> },
    context: EventContext
  ): Promise<void> {
    try {
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify(context)
      });

      console.log(`[WorkflowTrigger] Webhook ${config.url} returned ${response.status}`);
    } catch (error) {
      console.error(`[WorkflowTrigger] Webhook failed:`, error);
      throw error;
    }
  }

  /**
   * Notify action (in-app notification)
   */
  private async executeNotify(
    config: { channel: string; message: string },
    context: EventContext
  ): Promise<void> {
    // For now, just log the notification
    const message = this.interpolate(config.message, context);
    console.log(`[WorkflowTrigger] Notification [${config.channel}]: ${message}`);

    // In a real implementation, this would push to a notification system
    // or store in a notifications table
  }

  /**
   * Evaluate conditions against context
   */
  private evaluateConditions(conditions: Record<string, unknown>, context: EventContext): boolean {
    for (const [key, expectedValue] of Object.entries(conditions)) {
      // Handle special condition operators
      if (key.endsWith('_gt')) {
        const field = key.replace('_gt', '');
        const actualValue = this.getNestedValue(context, field);
        if (typeof actualValue !== 'number' || actualValue <= (expectedValue as number)) {
          return false;
        }
      } else if (key.endsWith('_lt')) {
        const field = key.replace('_lt', '');
        const actualValue = this.getNestedValue(context, field);
        if (typeof actualValue !== 'number' || actualValue >= (expectedValue as number)) {
          return false;
        }
      } else if (key.endsWith('_contains')) {
        const field = key.replace('_contains', '');
        const actualValue = this.getNestedValue(context, field);
        if (typeof actualValue !== 'string' || !actualValue.includes(expectedValue as string)) {
          return false;
        }
      } else {
        // Simple equality check
        const actualValue = this.getNestedValue(context, key);
        if (actualValue !== expectedValue) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Get nested value from object (e.g., "invoice.status")
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj);
  }

  /**
   * Interpolate template strings with context values
   */
  private interpolate(template: string, context: EventContext): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Extract entity type from event type
   */
  private extractEntityType(eventType: string): string | null {
    const parts = eventType.split('.');
    return parts.length > 0 ? parts[0] : null;
  }

  /**
   * Log trigger execution
   */
  private async logTriggerExecution(
    triggerId: number,
    eventType: string,
    context: EventContext,
    result: string,
    errorMessage: string | null,
    executionTimeMs: number
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `INSERT INTO workflow_trigger_logs (trigger_id, event_type, event_data, action_result, error_message, execution_time_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [triggerId, eventType, JSON.stringify(context), result, errorMessage, executionTimeMs]
    );
  }
}

// Export singleton instance
export const workflowTriggerService = new WorkflowTriggerService();
