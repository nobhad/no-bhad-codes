/**
 * ===============================================
 * NOTIFICATION SERVICE
 * ===============================================
 * @file server/services/notification-service.ts
 *
 * Service for managing admin notification history
 * (notification bell in admin portal).
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

export interface NotificationRow {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
  data: string | null;
}

interface UpdateResult {
  changes: number;
}

// =====================================================
// SERVICE CLASS
// =====================================================

class NotificationService {
  /**
   * Get notification history for an admin user.
   */
  async getAdminNotificationHistory(
    userId: number,
    limit: number
  ): Promise<NotificationRow[]> {
    const db = getDatabase();
    return db.all<NotificationRow>(
      `SELECT id, type, title, message, is_read, created_at, data
       FROM notification_history
       WHERE user_id = ? AND user_type = 'admin'
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
  }

  /**
   * Mark a single admin notification as read.
   * Returns the number of rows affected.
   */
  async markAdminNotificationRead(
    notificationId: number,
    userId: number
  ): Promise<number> {
    const db = getDatabase();
    const result = await db.run(
      `UPDATE notification_history
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND user_type = 'admin'`,
      [notificationId, userId]
    ) as UpdateResult;
    return result.changes;
  }

  /**
   * Mark all admin notifications as read for a user.
   */
  async markAllAdminNotificationsRead(userId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE notification_history
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND user_type = 'admin' AND is_read = 0`,
      [userId]
    );
  }
}

export const notificationService = new NotificationService();
