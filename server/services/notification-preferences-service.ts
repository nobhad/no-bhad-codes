/**
 * ===============================================
 * NOTIFICATION PREFERENCES SERVICE
 * ===============================================
 * @file server/services/notification-preferences-service.ts
 *
 * Service for managing user notification preferences.
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

export type UserType = 'client' | 'admin';
export type EmailFrequency = 'immediate' | 'daily_digest' | 'weekly_digest' | 'none';
export type NotificationChannel = 'email' | 'push' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';

export interface NotificationPreferences {
  id: number;
  user_id: number;
  user_type: UserType;

  // Email settings
  email_enabled: boolean;
  email_frequency: EmailFrequency;
  digest_time: string;
  digest_day: string;

  // Event notifications
  notify_new_message: boolean;
  notify_message_reply: boolean;
  notify_invoice_created: boolean;
  notify_invoice_reminder: boolean;
  notify_invoice_paid: boolean;
  notify_project_update: boolean;
  notify_project_milestone: boolean;
  notify_document_request: boolean;
  notify_document_approved: boolean;
  notify_document_rejected: boolean;
  notify_deliverable_ready: boolean;
  notify_proposal_created: boolean;
  notify_contract_ready: boolean;
  notify_file_uploaded: boolean;

  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;

  // Marketing
  marketing_emails: boolean;
  newsletter_emails: boolean;
  product_updates: boolean;

  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: number;
  user_id: number;
  user_type: UserType;
  notification_type: string;
  channel: NotificationChannel;
  subject?: string;
  message_preview?: string;
  status: NotificationStatus;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface UpdatePreferencesData {
  email_enabled?: boolean;
  email_frequency?: EmailFrequency;
  digest_time?: string;
  digest_day?: string;
  notify_new_message?: boolean;
  notify_message_reply?: boolean;
  notify_invoice_created?: boolean;
  notify_invoice_reminder?: boolean;
  notify_invoice_paid?: boolean;
  notify_project_update?: boolean;
  notify_project_milestone?: boolean;
  notify_document_request?: boolean;
  notify_document_approved?: boolean;
  notify_document_rejected?: boolean;
  notify_deliverable_ready?: boolean;
  notify_proposal_created?: boolean;
  notify_contract_ready?: boolean;
  notify_file_uploaded?: boolean;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  marketing_emails?: boolean;
  newsletter_emails?: boolean;
  product_updates?: boolean;
}

// =====================================================
// SERVICE CLASS
// =====================================================

class NotificationPreferencesService {
  // =====================================================
  // PREFERENCES MANAGEMENT
  // =====================================================

  /**
   * Get preferences for a user, creating defaults if they don't exist
   */
  async getPreferences(userId: number, userType: UserType = 'client'): Promise<NotificationPreferences> {
    const db = await getDatabase();

    let prefs = await db.get(
      'SELECT * FROM notification_preferences WHERE user_id = ? AND user_type = ?',
      [userId, userType]
    );

    if (!prefs) {
      // Create default preferences
      await db.run(
        'INSERT INTO notification_preferences (user_id, user_type) VALUES (?, ?)',
        [userId, userType]
      );

      prefs = await db.get(
        'SELECT * FROM notification_preferences WHERE user_id = ? AND user_type = ?',
        [userId, userType]
      );
    }

    return this.mapPreferences(prefs);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: number,
    userType: UserType,
    data: UpdatePreferencesData
  ): Promise<NotificationPreferences> {
    const db = await getDatabase();

    // Ensure preferences exist
    await this.getPreferences(userId, userType);

    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | number | boolean)[] = [];

    const booleanFields = [
      'email_enabled',
      'notify_new_message',
      'notify_message_reply',
      'notify_invoice_created',
      'notify_invoice_reminder',
      'notify_invoice_paid',
      'notify_project_update',
      'notify_project_milestone',
      'notify_document_request',
      'notify_document_approved',
      'notify_document_rejected',
      'notify_deliverable_ready',
      'notify_proposal_created',
      'notify_contract_ready',
      'notify_file_uploaded',
      'quiet_hours_enabled',
      'marketing_emails',
      'newsletter_emails',
      'product_updates'
    ];

    const stringFields = [
      'email_frequency',
      'digest_time',
      'digest_day',
      'quiet_hours_start',
      'quiet_hours_end'
    ];

    for (const field of booleanFields) {
      const value = data[field as keyof UpdatePreferencesData];
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        values.push(value ? 1 : 0);
      }
    }

    for (const field of stringFields) {
      const value = data[field as keyof UpdatePreferencesData];
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        values.push(value as string);
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId, userType);

      await db.run(
        `UPDATE notification_preferences SET ${updates.join(', ')} WHERE user_id = ? AND user_type = ?`,
        values
      );
    }

    return this.getPreferences(userId, userType);
  }

  /**
   * Check if a user should receive a specific notification type
   */
  async shouldNotify(
    userId: number,
    userType: UserType,
    notificationType: string
  ): Promise<boolean> {
    const prefs = await this.getPreferences(userId, userType);

    // Master switch
    if (!prefs.email_enabled) {
      return false;
    }

    // Check quiet hours
    if (prefs.quiet_hours_enabled && this.isQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) {
      // Queue for later instead of sending now
      return false;
    }

    // Check specific notification type
    const typeMap: Record<string, keyof NotificationPreferences> = {
      new_message: 'notify_new_message',
      message_reply: 'notify_message_reply',
      invoice_created: 'notify_invoice_created',
      invoice_reminder: 'notify_invoice_reminder',
      invoice_paid: 'notify_invoice_paid',
      project_update: 'notify_project_update',
      project_milestone: 'notify_project_milestone',
      document_request: 'notify_document_request',
      document_approved: 'notify_document_approved',
      document_rejected: 'notify_document_rejected',
      deliverable_ready: 'notify_deliverable_ready',
      proposal_created: 'notify_proposal_created',
      contract_ready: 'notify_contract_ready',
      file_uploaded: 'notify_file_uploaded'
    };

    const prefKey = typeMap[notificationType];
    if (prefKey && typeof prefs[prefKey] === 'boolean') {
      return prefs[prefKey] as boolean;
    }

    // Default to true for unknown types
    return true;
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(start: string, end: string): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // =====================================================
  // NOTIFICATION LOGGING
  // =====================================================

  /**
   * Log a notification
   */
  async logNotification(data: {
    userId: number;
    userType: UserType;
    notificationType: string;
    channel?: NotificationChannel;
    subject?: string;
    messagePreview?: string;
    status?: NotificationStatus;
    metadata?: Record<string, unknown>;
  }): Promise<number> {
    const db = await getDatabase();

    const result = await db.run(
      `INSERT INTO notification_log
       (user_id, user_type, notification_type, channel, subject, message_preview, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId,
        data.userType,
        data.notificationType,
        data.channel || 'email',
        data.subject || null,
        data.messagePreview || null,
        data.status || 'pending',
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    );

    return result.lastID!;
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(
    logId: number,
    status: NotificationStatus,
    errorMessage?: string
  ): Promise<void> {
    const db = await getDatabase();

    const updates: string[] = ['status = ?'];
    const values: (string | number)[] = [status];

    if (status === 'sent') {
      updates.push('sent_at = CURRENT_TIMESTAMP');
    } else if (status === 'delivered') {
      updates.push('delivered_at = CURRENT_TIMESTAMP');
    }

    if (errorMessage) {
      updates.push('error_message = ?');
      values.push(errorMessage);
    }

    values.push(logId);

    await db.run(
      `UPDATE notification_log SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Get notification history for a user
   */
  async getNotificationHistory(
    userId: number,
    userType: UserType,
    limit: number = 50
  ): Promise<NotificationLog[]> {
    const db = await getDatabase();

    const logs = await db.all(
      `SELECT * FROM notification_log
       WHERE user_id = ? AND user_type = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, userType, limit]
    );

    return logs.map((log: any) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null
    })) as NotificationLog[];
  }

  // =====================================================
  // DIGEST QUEUE
  // =====================================================

  /**
   * Queue a notification for digest
   */
  async queueForDigest(data: {
    userId: number;
    userType: UserType;
    notificationType: string;
    title: string;
    message?: string;
    entityType?: string;
    entityId?: number;
    priority?: number;
  }): Promise<void> {
    const db = await getDatabase();

    await db.run(
      `INSERT INTO notification_digest_queue
       (user_id, user_type, notification_type, title, message, entity_type, entity_id, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId,
        data.userType,
        data.notificationType,
        data.title,
        data.message || null,
        data.entityType || null,
        data.entityId || null,
        data.priority || 0
      ]
    );
  }

  /**
   * Get pending digest items for a user
   */
  async getPendingDigestItems(userId: number, userType: UserType): Promise<any[]> {
    const db = await getDatabase();

    return db.all(
      `SELECT * FROM notification_digest_queue
       WHERE user_id = ? AND user_type = ? AND processed = 0
       ORDER BY priority DESC, created_at ASC`,
      [userId, userType]
    );
  }

  /**
   * Mark digest items as processed
   */
  async markDigestProcessed(itemIds: number[]): Promise<void> {
    if (itemIds.length === 0) return;

    const db = await getDatabase();
    const placeholders = itemIds.map(() => '?').join(',');

    await db.run(
      `UPDATE notification_digest_queue
       SET processed = 1, processed_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})`,
      itemIds
    );
  }

  /**
   * Get users due for daily digest
   */
  async getUsersForDailyDigest(): Promise<{ user_id: number; user_type: UserType }[]> {
    const db = await getDatabase();
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const users = await db.all(
      `SELECT DISTINCT user_id, user_type FROM notification_preferences
       WHERE email_enabled = 1
         AND email_frequency = 'daily_digest'
         AND digest_time <= ?`,
      [currentTime]
    );

    return users as { user_id: number; user_type: UserType }[];
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Map database row to NotificationPreferences type
   */
  private mapPreferences(row: any): NotificationPreferences {
    return {
      id: row.id,
      user_id: row.user_id,
      user_type: row.user_type,
      email_enabled: Boolean(row.email_enabled),
      email_frequency: row.email_frequency,
      digest_time: row.digest_time,
      digest_day: row.digest_day,
      notify_new_message: Boolean(row.notify_new_message),
      notify_message_reply: Boolean(row.notify_message_reply),
      notify_invoice_created: Boolean(row.notify_invoice_created),
      notify_invoice_reminder: Boolean(row.notify_invoice_reminder),
      notify_invoice_paid: Boolean(row.notify_invoice_paid),
      notify_project_update: Boolean(row.notify_project_update),
      notify_project_milestone: Boolean(row.notify_project_milestone),
      notify_document_request: Boolean(row.notify_document_request),
      notify_document_approved: Boolean(row.notify_document_approved),
      notify_document_rejected: Boolean(row.notify_document_rejected),
      notify_deliverable_ready: Boolean(row.notify_deliverable_ready),
      notify_proposal_created: Boolean(row.notify_proposal_created),
      notify_contract_ready: Boolean(row.notify_contract_ready),
      notify_file_uploaded: Boolean(row.notify_file_uploaded),
      quiet_hours_enabled: Boolean(row.quiet_hours_enabled),
      quiet_hours_start: row.quiet_hours_start,
      quiet_hours_end: row.quiet_hours_end,
      marketing_emails: Boolean(row.marketing_emails),
      newsletter_emails: Boolean(row.newsletter_emails),
      product_updates: Boolean(row.product_updates),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

// Export singleton instance
export const notificationPreferencesService = new NotificationPreferencesService();
