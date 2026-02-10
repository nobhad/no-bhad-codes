/**
 * ===============================================
 * MESSAGE SERVICE
 * ===============================================
 * @file server/services/message-service.ts
 *
 * Service for enhanced messaging features:
 * - Mentions (@user, @team, @all)
 * - Reactions
 * - Subscriptions
 * - Read receipts
 * - Pinned messages
 * - Message editing/deletion
 * - Internal messages
 * - Search
 */

import { getDatabase } from '../database/init.js';
import { getString, getNumber } from '../database/row-helpers.js';

// =====================================================
// TYPES
// =====================================================

interface Mention {
  id: number;
  messageId: number;
  mentionedType: 'user' | 'team' | 'all';
  mentionedId?: string;
  notified: boolean;
  notifiedAt?: string;
  createdAt: string;
}

interface Reaction {
  id: number;
  messageId: number;
  userEmail: string;
  userType: string;
  reaction: string;
  createdAt: string;
}

interface ReactionSummary {
  reaction: string;
  count: number;
  users: { email: string; type: string }[];
}

interface Subscription {
  id: number;
  projectId: number;
  userEmail: string;
  userType: string;
  notifyAll: boolean;
  notifyMentions: boolean;
  notifyReplies: boolean;
  mutedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

interface ReadReceipt {
  id: number;
  messageId: number;
  userEmail: string;
  userType: string;
  readAt: string;
}

interface PinnedMessage {
  id: number;
  threadId: number;
  messageId: number;
  pinnedBy: string;
  pinnedAt: string;
  message?: object;
}

interface MessageWithDetails {
  id: number;
  threadId: number;
  senderType: string;
  senderName: string;
  message: string;
  priority: string;
  isRead: boolean;
  isInternal: boolean;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  parentMessageId?: number;
  reactionCount: number;
  replyCount: number;
  mentionCount: number;
  reactions?: ReactionSummary[];
  mentions?: Mention[];
  replies?: MessageWithDetails[];
}

interface SearchResult {
  messageId: number;
  threadId: number;
  threadSubject: string;
  senderName: string;
  message: string;
  createdAt: string;
  projectId?: number;
  projectName?: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function mapMention(row: Record<string, unknown>): Mention {
  return {
    id: getNumber(row, 'id'),
    messageId: getNumber(row, 'message_id'),
    mentionedType: getString(row, 'mentioned_type') as 'user' | 'team' | 'all',
    mentionedId: row.mentioned_id as string | undefined,
    notified: Boolean(row.notified),
    notifiedAt: row.notified_at as string | undefined,
    createdAt: getString(row, 'created_at')
  };
}

function mapReaction(row: Record<string, unknown>): Reaction {
  return {
    id: getNumber(row, 'id'),
    messageId: getNumber(row, 'message_id'),
    userEmail: getString(row, 'user_email'),
    userType: getString(row, 'user_type'),
    reaction: getString(row, 'reaction'),
    createdAt: getString(row, 'created_at')
  };
}

function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: getNumber(row, 'id'),
    projectId: getNumber(row, 'project_id'),
    userEmail: getString(row, 'user_email'),
    userType: getString(row, 'user_type'),
    notifyAll: Boolean(row.notify_all),
    notifyMentions: Boolean(row.notify_mentions),
    notifyReplies: Boolean(row.notify_replies),
    mutedUntil: row.muted_until as string | undefined,
    createdAt: getString(row, 'created_at'),
    updatedAt: getString(row, 'updated_at')
  };
}

function mapReadReceipt(row: Record<string, unknown>): ReadReceipt {
  return {
    id: getNumber(row, 'id'),
    messageId: getNumber(row, 'message_id'),
    userEmail: getString(row, 'user_email'),
    userType: getString(row, 'user_type'),
    readAt: getString(row, 'read_at')
  };
}

function mapPinnedMessage(row: Record<string, unknown>): PinnedMessage {
  return {
    id: getNumber(row, 'id'),
    threadId: getNumber(row, 'thread_id'),
    messageId: getNumber(row, 'message_id'),
    pinnedBy: getString(row, 'pinned_by'),
    pinnedAt: getString(row, 'pinned_at')
  };
}

/**
 * Parse mentions from message content
 * Supports @email, @team:name, @all
 */
function parseMentions(content: string): { type: 'user' | 'team' | 'all'; id?: string }[] {
  const mentions: { type: 'user' | 'team' | 'all'; id?: string }[] = [];

  // Match @all
  if (/@all\b/i.test(content)) {
    mentions.push({ type: 'all' });
  }

  // Match @team:name
  const teamMatches = content.match(/@team:(\w+)/gi);
  if (teamMatches) {
    for (const match of teamMatches) {
      const teamName = match.replace(/@team:/i, '');
      mentions.push({ type: 'team', id: teamName });
    }
  }

  // Match @email (simplified email pattern)
  const emailMatches = content.match(/@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
  if (emailMatches) {
    for (const match of emailMatches) {
      const email = match.substring(1); // Remove @ prefix
      mentions.push({ type: 'user', id: email });
    }
  }

  return mentions;
}

// =====================================================
// MESSAGE SERVICE CLASS
// =====================================================

class MessageService {
  // =====================================================
  // MENTION METHODS
  // =====================================================

  /**
   * Extract and save mentions from a message
   */
  async processMentions(messageId: number, content: string): Promise<Mention[]> {
    const db = getDatabase();
    const mentions = parseMentions(content);

    const savedMentions: Mention[] = [];

    for (const mention of mentions) {
      const result = await db.run(
        `INSERT INTO message_mentions (message_id, mentioned_type, mentioned_id, created_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [messageId, mention.type, mention.id || null]
      );

      const row = await db.get('SELECT * FROM message_mentions WHERE id = ?', [result.lastID]);
      if (row) {
        savedMentions.push(mapMention(row as Record<string, unknown>));
      }
    }

    // Update message mention count
    await db.run(
      'UPDATE general_messages SET mention_count = ? WHERE id = ?',
      [mentions.length, messageId]
    );

    return savedMentions;
  }

  /**
   * Get mentions for a message
   */
  async getMentions(messageId: number): Promise<Mention[]> {
    const db = getDatabase();
    const rows = await db.all(
      'SELECT * FROM message_mentions WHERE message_id = ?',
      [messageId]
    );
    return rows.map((row) => mapMention(row as Record<string, unknown>));
  }

  /**
   * Get messages where a user is mentioned
   */
  async getMyMentions(userEmail: string, limit = 50): Promise<MessageWithDetails[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT gm.*, mt.subject as thread_subject
       FROM general_messages gm
       JOIN message_mentions mm ON gm.id = mm.message_id
       JOIN message_threads mt ON gm.thread_id = mt.id
       WHERE (mm.mentioned_type = 'all' OR mm.mentioned_id = ?)
         AND gm.deleted_at IS NULL
       ORDER BY gm.created_at DESC
       LIMIT ?`,
      [userEmail, limit]
    );

    return rows.map((row) => this.mapMessageWithDetails(row as Record<string, unknown>));
  }

  /**
   * Mark mentions as notified
   */
  async markMentionsNotified(messageId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE message_mentions SET notified = TRUE, notified_at = datetime('now')
       WHERE message_id = ? AND notified = FALSE`,
      [messageId]
    );
  }

  // =====================================================
  // REACTION METHODS
  // =====================================================

  /**
   * Add a reaction to a message
   */
  async addReaction(messageId: number, userEmail: string, userType: string, reaction: string): Promise<Reaction> {
    const db = getDatabase();

    // Check if already exists
    const existing = await db.get(
      'SELECT id FROM message_reactions WHERE message_id = ? AND user_email = ? AND reaction = ?',
      [messageId, userEmail, reaction]
    );

    if (existing) {
      throw new Error('Reaction already exists');
    }

    const result = await db.run(
      `INSERT INTO message_reactions (message_id, user_email, user_type, reaction, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [messageId, userEmail, userType, reaction]
    );

    // Update message reaction count
    await db.run(
      'UPDATE general_messages SET reaction_count = reaction_count + 1 WHERE id = ?',
      [messageId]
    );

    const row = await db.get('SELECT * FROM message_reactions WHERE id = ?', [result.lastID]);
    return mapReaction(row as Record<string, unknown>);
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(messageId: number, userEmail: string, reaction: string): Promise<void> {
    const db = getDatabase();

    const result = await db.run(
      'DELETE FROM message_reactions WHERE message_id = ? AND user_email = ? AND reaction = ?',
      [messageId, userEmail, reaction]
    );

    if (result.changes && result.changes > 0) {
      // Update message reaction count
      await db.run(
        'UPDATE general_messages SET reaction_count = reaction_count - 1 WHERE id = ?',
        [messageId]
      );
    }
  }

  /**
   * Get reactions for a message
   */
  async getReactions(messageId: number): Promise<ReactionSummary[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT reaction, COUNT(*) as count, GROUP_CONCAT(user_email || '|' || user_type) as users
       FROM message_reactions
       WHERE message_id = ?
       GROUP BY reaction`,
      [messageId]
    );

    return rows.map((row) => {
      const r = row as Record<string, unknown>;
      const usersStr = r.users as string || '';
      const users = usersStr.split(',').filter(Boolean).map((u) => {
        const [email, type] = u.split('|');
        return { email, type };
      });

      return {
        reaction: getString(r, 'reaction'),
        count: getNumber(r, 'count'),
        users
      };
    });
  }

  // =====================================================
  // SUBSCRIPTION METHODS
  // =====================================================

  /**
   * Get or create subscription for a project
   */
  async getOrCreateSubscription(projectId: number, userEmail: string, userType: string): Promise<Subscription> {
    const db = getDatabase();

    let row = await db.get(
      'SELECT * FROM message_subscriptions WHERE project_id = ? AND user_email = ?',
      [projectId, userEmail]
    );

    if (!row) {
      await db.run(
        `INSERT INTO message_subscriptions (project_id, user_email, user_type, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        [projectId, userEmail, userType]
      );

      row = await db.get(
        'SELECT * FROM message_subscriptions WHERE project_id = ? AND user_email = ?',
        [projectId, userEmail]
      );
    }

    return mapSubscription(row as Record<string, unknown>);
  }

  /**
   * Update subscription preferences
   */
  async updateSubscription(
    projectId: number,
    userEmail: string,
    prefs: Partial<{ notifyAll: boolean; notifyMentions: boolean; notifyReplies: boolean }>
  ): Promise<Subscription> {
    const db = getDatabase();

    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];

    if (prefs.notifyAll !== undefined) {
      updates.push('notify_all = ?');
      params.push(prefs.notifyAll ? 1 : 0);
    }
    if (prefs.notifyMentions !== undefined) {
      updates.push('notify_mentions = ?');
      params.push(prefs.notifyMentions ? 1 : 0);
    }
    if (prefs.notifyReplies !== undefined) {
      updates.push('notify_replies = ?');
      params.push(prefs.notifyReplies ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = datetime(\'now\')');
      params.push(projectId, userEmail);

      await db.run(
        `UPDATE message_subscriptions SET ${updates.join(', ')} WHERE project_id = ? AND user_email = ?`,
        params
      );
    }

    const row = await db.get(
      'SELECT * FROM message_subscriptions WHERE project_id = ? AND user_email = ?',
      [projectId, userEmail]
    );

    return mapSubscription(row as Record<string, unknown>);
  }

  /**
   * Mute a project temporarily
   */
  async muteProject(projectId: number, userEmail: string, userType: string, untilDate?: Date): Promise<void> {
    const db = getDatabase();

    // Get or create subscription first
    await this.getOrCreateSubscription(projectId, userEmail, userType);

    const until = untilDate ? untilDate.toISOString() : null;

    await db.run(
      `UPDATE message_subscriptions SET muted_until = ?, updated_at = datetime('now')
       WHERE project_id = ? AND user_email = ?`,
      [until, projectId, userEmail]
    );
  }

  /**
   * Unmute a project
   */
  async unmuteProject(projectId: number, userEmail: string): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE message_subscriptions SET muted_until = NULL, updated_at = datetime('now')
       WHERE project_id = ? AND user_email = ?`,
      [projectId, userEmail]
    );
  }

  /**
   * Check if user should be notified for a project
   */
  async shouldNotify(projectId: number, userEmail: string, notificationType: 'all' | 'mention' | 'reply'): Promise<boolean> {
    const db = getDatabase();

    const row = await db.get(
      'SELECT * FROM message_subscriptions WHERE project_id = ? AND user_email = ?',
      [projectId, userEmail]
    );

    if (!row) {
      return true; // Default to notify
    }

    const sub = mapSubscription(row as Record<string, unknown>);

    // Check if muted
    if (sub.mutedUntil && new Date(sub.mutedUntil) > new Date()) {
      return false;
    }

    switch (notificationType) {
      case 'all':
        return sub.notifyAll;
      case 'mention':
        return sub.notifyMentions;
      case 'reply':
        return sub.notifyReplies;
      default:
        return sub.notifyAll;
    }
  }

  // =====================================================
  // READ RECEIPT METHODS
  // =====================================================

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: number, userEmail: string, userType: string): Promise<void> {
    const db = getDatabase();

    // Insert or ignore (already read)
    await db.run(
      `INSERT OR IGNORE INTO message_read_receipts (message_id, user_email, user_type, read_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [messageId, userEmail, userType]
    );
  }

  /**
   * Mark all messages in a thread as read
   */
  async markThreadAsRead(threadId: number, userEmail: string, userType: string): Promise<number> {
    const db = getDatabase();

    // Get all unread messages in thread
    const messages = await db.all(
      `SELECT gm.id FROM general_messages gm
       LEFT JOIN message_read_receipts mrr ON gm.id = mrr.message_id AND mrr.user_email = ?
       WHERE gm.thread_id = ? AND mrr.id IS NULL`,
      [userEmail, threadId]
    );

    for (const msg of messages) {
      await this.markAsRead(getNumber(msg as Record<string, unknown>, 'id'), userEmail, userType);
    }

    return messages.length;
  }

  /**
   * Get read receipts for a message
   */
  async getReadReceipts(messageId: number): Promise<ReadReceipt[]> {
    const db = getDatabase();
    const rows = await db.all(
      'SELECT * FROM message_read_receipts WHERE message_id = ? ORDER BY read_at DESC',
      [messageId]
    );
    return rows.map((row) => mapReadReceipt(row as Record<string, unknown>));
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userEmail: string, userType: string): Promise<number> {
    const db = getDatabase();

    // Different query based on user type
    const query = userType === 'admin'
      ? `SELECT COUNT(*) as count FROM general_messages gm
         LEFT JOIN message_read_receipts mrr ON gm.id = mrr.message_id AND mrr.user_email = ?
         WHERE gm.sender_type != 'admin' AND gm.deleted_at IS NULL AND mrr.id IS NULL`
      : `SELECT COUNT(*) as count FROM general_messages gm
         JOIN message_threads mt ON gm.thread_id = mt.id
         LEFT JOIN message_read_receipts mrr ON gm.id = mrr.message_id AND mrr.user_email = ?
         WHERE mt.client_id = (SELECT id FROM clients WHERE email = ?)
           AND gm.sender_type != 'client' AND gm.deleted_at IS NULL AND mrr.id IS NULL`;

    const params = userType === 'admin' ? [userEmail] : [userEmail, userEmail];
    const row = await db.get(query, params);

    return getNumber(row as Record<string, unknown>, 'count');
  }

  // =====================================================
  // PINNED MESSAGE METHODS
  // =====================================================

  /**
   * Pin a message
   */
  async pinMessage(threadId: number, messageId: number, pinnedBy: string): Promise<PinnedMessage> {
    const db = getDatabase();

    // Verify message belongs to thread
    const message = await db.get(
      'SELECT id FROM general_messages WHERE id = ? AND thread_id = ?',
      [messageId, threadId]
    );

    if (!message) {
      throw new Error('Message not found in thread');
    }

    const result = await db.run(
      `INSERT OR IGNORE INTO pinned_messages (thread_id, message_id, pinned_by, pinned_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [threadId, messageId, pinnedBy]
    );

    if (result.changes && result.changes > 0) {
      // Update thread pinned count
      await db.run(
        'UPDATE message_threads SET pinned_count = pinned_count + 1 WHERE id = ?',
        [threadId]
      );
    }

    const row = await db.get(
      'SELECT * FROM pinned_messages WHERE thread_id = ? AND message_id = ?',
      [threadId, messageId]
    );

    return mapPinnedMessage(row as Record<string, unknown>);
  }

  /**
   * Unpin a message
   */
  async unpinMessage(threadId: number, messageId: number): Promise<void> {
    const db = getDatabase();

    const result = await db.run(
      'DELETE FROM pinned_messages WHERE thread_id = ? AND message_id = ?',
      [threadId, messageId]
    );

    if (result.changes && result.changes > 0) {
      // Update thread pinned count
      await db.run(
        'UPDATE message_threads SET pinned_count = pinned_count - 1 WHERE id = ?',
        [threadId]
      );
    }
  }

  /**
   * Get pinned messages in a thread
   */
  async getPinnedMessages(threadId: number): Promise<PinnedMessage[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT pm.*, gm.sender_name, gm.message, gm.created_at as message_created_at
       FROM pinned_messages pm
       JOIN general_messages gm ON pm.message_id = gm.id
       WHERE pm.thread_id = ?
       ORDER BY pm.pinned_at DESC`,
      [threadId]
    );

    return rows.map((row) => {
      const r = row as Record<string, unknown>;
      const pinned = mapPinnedMessage(r);
      pinned.message = {
        senderName: getString(r, 'sender_name'),
        message: getString(r, 'message'),
        createdAt: getString(r, 'message_created_at')
      };
      return pinned;
    });
  }

  // =====================================================
  // MESSAGE EDITING/DELETION METHODS
  // =====================================================

  /**
   * Edit a message
   */
  async editMessage(messageId: number, newContent: string): Promise<void> {
    const db = getDatabase();

    await db.run(
      `UPDATE general_messages SET message = ?, edited_at = datetime('now') WHERE id = ?`,
      [newContent, messageId]
    );

    // Re-process mentions
    await db.run('DELETE FROM message_mentions WHERE message_id = ?', [messageId]);
    await this.processMentions(messageId, newContent);
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: number, deletedBy: string): Promise<void> {
    const db = getDatabase();

    await db.run(
      `UPDATE general_messages SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ?`,
      [deletedBy, messageId]
    );
  }

  /**
   * Restore a deleted message
   */
  async restoreMessage(messageId: number): Promise<void> {
    const db = getDatabase();

    await db.run(
      `UPDATE general_messages SET deleted_at = NULL, deleted_by = NULL WHERE id = ?`,
      [messageId]
    );
  }

  // =====================================================
  // THREAD METHODS
  // =====================================================

  /**
   * Archive a thread
   */
  async archiveThread(threadId: number, archivedBy: string): Promise<void> {
    const db = getDatabase();

    await db.run(
      `UPDATE message_threads SET archived_at = datetime('now'), archived_by = ?, status = 'archived' WHERE id = ?`,
      [archivedBy, threadId]
    );
  }

  /**
   * Unarchive a thread
   */
  async unarchiveThread(threadId: number): Promise<void> {
    const db = getDatabase();

    await db.run(
      `UPDATE message_threads SET archived_at = NULL, archived_by = NULL, status = 'active' WHERE id = ?`,
      [threadId]
    );
  }

  /**
   * Get thread replies (nested messages)
   */
  async getThreadReplies(threadId: number, parentMessageId?: number): Promise<MessageWithDetails[]> {
    const db = getDatabase();

    const query = parentMessageId
      ? `SELECT * FROM general_messages WHERE thread_id = ? AND parent_message_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`
      : `SELECT * FROM general_messages WHERE thread_id = ? AND parent_message_id IS NULL AND deleted_at IS NULL ORDER BY created_at ASC`;

    const params = parentMessageId ? [threadId, parentMessageId] : [threadId];
    const rows = await db.all(query, params);

    return rows.map((row) => this.mapMessageWithDetails(row as Record<string, unknown>));
  }

  // =====================================================
  // SEARCH METHODS
  // =====================================================

  /**
   * Search messages
   */
  async searchMessages(query: string, options?: {
    projectId?: number;
    threadId?: number;
    userEmail?: string;
    limit?: number;
    includeInternal?: boolean;
  }): Promise<SearchResult[]> {
    const db = getDatabase();

    let sql = `
      SELECT gm.id as message_id, gm.thread_id, mt.subject as thread_subject,
             gm.sender_name, gm.message, gm.created_at,
             mt.project_id, p.project_name
      FROM general_messages gm
      JOIN message_threads mt ON gm.thread_id = mt.id
      LEFT JOIN projects p ON mt.project_id = p.id
      WHERE gm.message LIKE ? AND gm.deleted_at IS NULL
    `;

    const params: (string | number)[] = [`%${query}%`];

    if (options?.projectId) {
      sql += ' AND mt.project_id = ?';
      params.push(options.projectId);
    }

    if (options?.threadId) {
      sql += ' AND gm.thread_id = ?';
      params.push(options.threadId);
    }

    // Filter out internal messages unless includeInternal is true
    if (!options?.includeInternal) {
      sql += ' AND (gm.is_internal IS NULL OR gm.is_internal = 0)';
    }

    sql += ` ORDER BY gm.created_at DESC LIMIT ?`;
    params.push(options?.limit || 50);

    const rows = await db.all(sql, params);

    return rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        messageId: getNumber(r, 'message_id'),
        threadId: getNumber(r, 'thread_id'),
        threadSubject: getString(r, 'thread_subject'),
        senderName: getString(r, 'sender_name'),
        message: getString(r, 'message'),
        createdAt: getString(r, 'created_at'),
        projectId: r.project_id ? getNumber(r, 'project_id') : undefined,
        projectName: r.project_name ? getString(r, 'project_name') : undefined
      };
    });
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private mapMessageWithDetails(row: Record<string, unknown>): MessageWithDetails {
    return {
      id: getNumber(row, 'id'),
      threadId: getNumber(row, 'thread_id'),
      senderType: getString(row, 'sender_type'),
      senderName: getString(row, 'sender_name'),
      message: getString(row, 'message'),
      priority: getString(row, 'priority'),
      isRead: row.read_at !== null,
      isInternal: Boolean(row.is_internal),
      editedAt: row.edited_at as string | undefined,
      deletedAt: row.deleted_at as string | undefined,
      createdAt: getString(row, 'created_at'),
      parentMessageId: row.parent_message_id ? getNumber(row, 'parent_message_id') : undefined,
      reactionCount: getNumber(row, 'reaction_count') || 0,
      replyCount: getNumber(row, 'reply_count') || 0,
      mentionCount: getNumber(row, 'mention_count') || 0
    };
  }

  // =====================================================
  // Route-compatible wrapper methods
  // =====================================================

  async getSubscription(projectId: number, userEmail: string): Promise<Subscription | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT * FROM message_subscriptions WHERE project_id = ? AND user_email = ?`,
      [projectId, userEmail]
    );

    if (!row) return null;
    const r = row as Record<string, unknown>;
    return {
      id: getNumber(r, 'id'),
      projectId: getNumber(r, 'project_id'),
      userEmail: getString(r, 'user_email'),
      userType: getString(r, 'user_type'),
      notifyAll: Boolean(r.notify_all),
      notifyMentions: Boolean(r.notify_mentions),
      notifyReplies: Boolean(r.notify_replies),
      mutedUntil: r.muted_until as string | undefined,
      createdAt: getString(r, 'created_at'),
      updatedAt: getString(r, 'updated_at')
    };
  }

  async markMultipleAsRead(messageIds: number[], userEmail: string, userType: string): Promise<number> {
    const db = getDatabase();
    let count = 0;
    for (const messageId of messageIds) {
      try {
        await this.markAsRead(messageId, userEmail, userType);
        count++;
      } catch (_err) {
        // Skip messages that fail
      }
    }
    return count;
  }

  async getThreadUnreadCount(threadId: number, userEmail: string): Promise<number> {
    const db = getDatabase();
    const result = await db.get(`
      SELECT COUNT(*) as count
      FROM general_messages gm
      LEFT JOIN message_read_receipts mrr
        ON gm.id = mrr.message_id AND mrr.user_email = ?
      WHERE gm.thread_id = ?
        AND gm.deleted_at IS NULL
        AND mrr.id IS NULL
    `, [userEmail, threadId]);

    return result ? getNumber(result as Record<string, unknown>, 'count') : 0;
  }

  async getArchivedThreads(): Promise<any[]> {
    const db = getDatabase();
    return db.all(`
      SELECT mt.*, p.project_name
      FROM message_threads mt
      LEFT JOIN projects p ON mt.project_id = p.id
      WHERE mt.archived_at IS NOT NULL
      ORDER BY mt.archived_at DESC
    `);
  }
}

// Export singleton instance
export const messageService = new MessageService();
export default messageService;
