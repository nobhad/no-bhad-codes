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
import { getString, getNumber, getBoolean } from '../database/row-helpers.js';
import { logger } from './logger.js';
import {
  type Mention,
  type Reaction,
  type Subscription,
  type ReadReceipt,
  type PinnedMessage,
  type MentionRow,
  type ReactionRow,
  type SubscriptionRow,
  type ReadReceiptRow,
  type PinnedMessageRow,
  toMention,
  toReaction,
  toSubscription,
  toReadReceipt,
  toPinnedMessage
} from '../database/entities/index.js';

// =====================================================
// TYPES
// =====================================================

/** User type discriminator for auth context */
type UserType = 'admin' | 'client';

/** Parameters for creating a new message thread */
interface CreateThreadParams {
  clientId: string;
  projectId: number | null;
  subject: string;
  threadType: string;
  priority: string;
}

/** Parameters for inserting a new message into a thread */
interface InsertMessageParams {
  clientId: string | number;
  senderType: string;
  senderName: string;
  subject: string;
  message: string;
  priority: string;
  replyTo: number | null;
  attachments: string | null;
  threadId: number;
}

/** Row shape returned by the reactions batch query */
interface ReactionRow_Core {
  id: number;
  message_id: number;
  reaction: string;
  user_email: string;
  created_at: string;
}

interface ReactionSummary {
  reaction: string;
  count: number;
  users: { email: string; type: string }[];
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
// COLUMN CONSTANTS - Explicit column lists for SELECT queries
// =====================================================

const MESSAGE_MENTION_COLUMNS = `
  id, message_id, mentioned_type, mentioned_id, notified, notified_at, created_at
`.replace(/\s+/g, ' ').trim();

const MESSAGE_REACTION_COLUMNS = `
  id, message_id, user_email, user_type, reaction, created_at
`.replace(/\s+/g, ' ').trim();

const MESSAGE_SUBSCRIPTION_COLUMNS = `
  id, project_id, user_email, user_type, notify_all, notify_mentions,
  notify_replies, muted_until, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const MESSAGE_READ_RECEIPT_COLUMNS = `
  id, message_id, user_email, user_type, read_at
`.replace(/\s+/g, ' ').trim();

const PINNED_MESSAGE_COLUMNS = `
  id, thread_id, message_id, pinned_by, pinned_at
`.replace(/\s+/g, ' ').trim();

const MESSAGE_COLUMNS = `
  id, project_id, client_id, thread_id, context_type, sender_type, sender_name,
  subject, message, message_type, priority, read_at, attachments,
  parent_message_id, is_internal, edited_at, deleted_at, deleted_by,
  reaction_count, reply_count, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

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

      const row = await db.get(`SELECT ${MESSAGE_MENTION_COLUMNS} FROM message_mentions WHERE id = ?`, [result.lastID]);
      if (row) {
        savedMentions.push(toMention(row as MentionRow));
      }
    }

    // Update message mention count
    await db.run('UPDATE messages SET mention_count = ? WHERE id = ?', [
      mentions.length,
      messageId
    ]);

    return savedMentions;
  }

  /**
   * Get mentions for a message
   */
  async getMentions(messageId: number): Promise<Mention[]> {
    const db = getDatabase();
    const rows = await db.all(`SELECT ${MESSAGE_MENTION_COLUMNS} FROM message_mentions WHERE message_id = ?`, [messageId]);
    return rows.map((row) => toMention(row as MentionRow));
  }

  /**
   * Get messages where a user is mentioned
   */
  async getMyMentions(userEmail: string, limit = 50): Promise<MessageWithDetails[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT m.*, mt.subject as thread_subject
       FROM active_messages m
       JOIN message_mentions mm ON m.id = mm.message_id
       JOIN active_message_threads mt ON m.thread_id = mt.id
       WHERE (mm.mentioned_type = 'all' OR mm.mentioned_id = ?)
       ORDER BY m.created_at DESC
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
  async addReaction(
    messageId: number,
    userEmail: string,
    userType: string,
    reaction: string
  ): Promise<Reaction> {
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
    await db.run('UPDATE messages SET reaction_count = reaction_count + 1 WHERE id = ?', [
      messageId
    ]);

    const row = await db.get(`SELECT ${MESSAGE_REACTION_COLUMNS} FROM message_reactions WHERE id = ?`, [result.lastID]);
    return toReaction(row as ReactionRow);
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
      await db.run('UPDATE messages SET reaction_count = reaction_count - 1 WHERE id = ?', [
        messageId
      ]);
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
      const usersStr = (r.users as string) || '';
      const users = usersStr
        .split(',')
        .filter(Boolean)
        .map((u) => {
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
  async getOrCreateSubscription(
    projectId: number,
    userEmail: string,
    userType: string
  ): Promise<Subscription> {
    const db = getDatabase();

    let row = await db.get(
      `SELECT ${MESSAGE_SUBSCRIPTION_COLUMNS} FROM message_subscriptions WHERE project_id = ? AND user_email = ?`,
      [projectId, userEmail]
    );

    if (!row) {
      await db.run(
        `INSERT INTO message_subscriptions (project_id, user_email, user_type, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        [projectId, userEmail, userType]
      );

      row = await db.get(
        `SELECT ${MESSAGE_SUBSCRIPTION_COLUMNS} FROM message_subscriptions WHERE project_id = ? AND user_email = ?`,
        [projectId, userEmail]
      );
    }

    return toSubscription(row as SubscriptionRow);
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
      `SELECT ${MESSAGE_SUBSCRIPTION_COLUMNS} FROM message_subscriptions WHERE project_id = ? AND user_email = ?`,
      [projectId, userEmail]
    );

    return toSubscription(row as SubscriptionRow);
  }

  /**
   * Mute a project temporarily
   */
  async muteProject(
    projectId: number,
    userEmail: string,
    userType: string,
    untilDate?: Date
  ): Promise<void> {
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
  async shouldNotify(
    projectId: number,
    userEmail: string,
    notificationType: 'all' | 'mention' | 'reply'
  ): Promise<boolean> {
    const db = getDatabase();

    const row = await db.get(
      `SELECT ${MESSAGE_SUBSCRIPTION_COLUMNS} FROM message_subscriptions WHERE project_id = ? AND user_email = ?`,
      [projectId, userEmail]
    );

    if (!row) {
      return true; // Default to notify
    }

    const sub = toSubscription(row as SubscriptionRow);

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
      `SELECT m.id FROM active_messages m
       LEFT JOIN message_read_receipts mrr ON m.id = mrr.message_id AND mrr.user_email = ?
       WHERE m.thread_id = ? AND mrr.id IS NULL`,
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
      `SELECT ${MESSAGE_READ_RECEIPT_COLUMNS} FROM message_read_receipts WHERE message_id = ? ORDER BY read_at DESC`,
      [messageId]
    );
    return rows.map((row) => toReadReceipt(row as ReadReceiptRow));
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userEmail: string, userType: string): Promise<number> {
    const db = getDatabase();

    // Different query based on user type
    const query =
      userType === 'admin'
        ? `SELECT COUNT(*) as count FROM active_messages m
         LEFT JOIN message_read_receipts mrr ON m.id = mrr.message_id AND mrr.user_email = ?
         WHERE m.sender_type != 'admin' AND mrr.id IS NULL`
        : `SELECT COUNT(*) as count FROM active_messages m
         JOIN active_message_threads mt ON m.thread_id = mt.id
         LEFT JOIN message_read_receipts mrr ON m.id = mrr.message_id AND mrr.user_email = ?
         WHERE mt.client_id = (SELECT id FROM active_clients WHERE email = ?)
           AND m.sender_type != 'client' AND mrr.id IS NULL`;

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
    const message = await db.get('SELECT id FROM active_messages WHERE id = ? AND thread_id = ?', [
      messageId,
      threadId
    ]);

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
      await db.run('UPDATE message_threads SET pinned_count = pinned_count + 1 WHERE id = ?', [
        threadId
      ]);
    }

    const row = await db.get(
      `SELECT ${PINNED_MESSAGE_COLUMNS} FROM pinned_messages WHERE thread_id = ? AND message_id = ?`,
      [threadId, messageId]
    );

    return toPinnedMessage(row as PinnedMessageRow);
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
      await db.run('UPDATE message_threads SET pinned_count = pinned_count - 1 WHERE id = ?', [
        threadId
      ]);
    }
  }

  /**
   * Get pinned messages in a thread
   */
  async getPinnedMessages(threadId: number): Promise<PinnedMessage[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT pm.*, m.sender_name, m.message, m.created_at as message_created_at
       FROM pinned_messages pm
       JOIN active_messages m ON pm.message_id = m.id
       WHERE pm.thread_id = ?
       ORDER BY pm.pinned_at DESC`,
      [threadId]
    );

    return rows.map((row) => {
      const r = row as Record<string, unknown>;
      const pinned = toPinnedMessage(r as PinnedMessageRow);
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

    await db.run('UPDATE messages SET message = ?, edited_at = datetime(\'now\') WHERE id = ?', [
      newContent,
      messageId
    ]);

    // Re-process mentions
    await db.run('DELETE FROM message_mentions WHERE message_id = ?', [messageId]);
    await this.processMentions(messageId, newContent);
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: number, deletedBy: string): Promise<void> {
    const db = getDatabase();

    await db.run('UPDATE messages SET deleted_at = datetime(\'now\'), deleted_by = ? WHERE id = ?', [
      deletedBy,
      messageId
    ]);
  }

  /**
   * Restore a deleted message
   */
  async restoreMessage(messageId: number): Promise<void> {
    const db = getDatabase();

    await db.run('UPDATE messages SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', [
      messageId
    ]);
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
      'UPDATE message_threads SET archived_at = datetime(\'now\'), archived_by = ?, status = \'archived\' WHERE id = ?',
      [archivedBy, threadId]
    );
  }

  /**
   * Unarchive a thread
   */
  async unarchiveThread(threadId: number): Promise<void> {
    const db = getDatabase();

    await db.run(
      'UPDATE message_threads SET archived_at = NULL, archived_by = NULL, status = \'active\' WHERE id = ?',
      [threadId]
    );
  }

  /**
   * Get thread replies (nested messages)
   */
  async getThreadReplies(
    threadId: number,
    parentMessageId?: number
  ): Promise<MessageWithDetails[]> {
    const db = getDatabase();

    const query = parentMessageId
      ? `SELECT ${MESSAGE_COLUMNS} FROM active_messages WHERE thread_id = ? AND parent_message_id = ? ORDER BY created_at ASC`
      : `SELECT ${MESSAGE_COLUMNS} FROM active_messages WHERE thread_id = ? AND parent_message_id IS NULL ORDER BY created_at ASC`;

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
  async searchMessages(
    query: string,
    options?: {
      projectId?: number;
      threadId?: number;
      userEmail?: string;
      limit?: number;
      includeInternal?: boolean;
    }
  ): Promise<SearchResult[]> {
    const db = getDatabase();

    let sql = `
      SELECT m.id as message_id, m.thread_id, mt.subject as thread_subject,
             m.sender_name, m.message, m.created_at,
             mt.project_id, p.project_name
      FROM active_messages m
      JOIN active_message_threads mt ON m.thread_id = mt.id
      LEFT JOIN active_projects p ON mt.project_id = p.id
      WHERE m.message LIKE ?
    `;

    const params: (string | number)[] = [`%${query}%`];

    if (options?.projectId) {
      sql += ' AND mt.project_id = ?';
      params.push(options.projectId);
    }

    if (options?.threadId) {
      sql += ' AND m.thread_id = ?';
      params.push(options.threadId);
    }

    // Filter out internal messages unless includeInternal is true
    if (!options?.includeInternal) {
      sql += ' AND (m.is_internal IS NULL OR m.is_internal = 0)';
    }

    sql += ' ORDER BY m.created_at DESC LIMIT ?';
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
  // CORE CRUD METHODS (used by routes/messages/core.ts)
  // =====================================================

  /**
   * Fetch all message threads — admin sees all, client sees own.
   */
  async getThreads(
    userType: UserType,
    userId: string
  ): Promise<Record<string, unknown>[]> {
    const db = getDatabase();

    if (userType === 'admin') {
      return db.all(`
        SELECT
          mt.*,
          c.company_name,
          c.contact_name,
          c.email as client_email,
          p.project_name,
          COUNT(m.id) as message_count,
          COUNT(CASE WHEN m.read_at IS NULL AND m.sender_type != 'admin' AND (m.is_internal IS NULL OR m.is_internal = 0) THEN 1 END) as unread_count
        FROM active_message_threads mt
        JOIN active_clients c ON mt.client_id = c.id
        LEFT JOIN active_projects p ON mt.project_id = p.id
        LEFT JOIN active_messages m ON mt.id = m.thread_id AND m.context_type = 'general'
        GROUP BY mt.id
        ORDER BY mt.last_message_at DESC
      `);
    }

    return db.all(
      `SELECT
          mt.*,
          p.project_name,
          COUNT(CASE WHEN m.is_internal IS NULL OR m.is_internal = 0 THEN 1 END) as message_count,
          COUNT(CASE WHEN m.read_at IS NULL AND m.sender_type != 'client' AND (m.is_internal IS NULL OR m.is_internal = 0) THEN 1 END) as unread_count
        FROM active_message_threads mt
        LEFT JOIN active_projects p ON mt.project_id = p.id
        LEFT JOIN active_messages m ON mt.id = m.thread_id AND m.context_type = 'general'
        WHERE mt.client_id = ?
        GROUP BY mt.id
        ORDER BY mt.last_message_at DESC`,
      [userId]
    );
  }

  /**
   * Verify a project exists (and optionally belongs to a client).
   * Returns the project row or undefined.
   */
  async verifyProjectAccess(
    projectId: number,
    userType: UserType,
    userId: string
  ): Promise<Record<string, unknown> | undefined> {
    const db = getDatabase();

    if (userType === 'admin') {
      return db.get('SELECT id FROM active_projects WHERE id = ?', [projectId]);
    }

    return db.get('SELECT id FROM active_projects WHERE id = ? AND client_id = ?', [
      projectId,
      userId
    ]);
  }

  /**
   * Insert a new message thread row and return the full thread record.
   */
  async createThread(
    params: CreateThreadParams,
    threadColumns: string
  ): Promise<Record<string, unknown> | undefined> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO message_threads (client_id, project_id, subject, thread_type, priority)
       VALUES (?, ?, ?, ?, ?)`,
      [params.clientId, params.projectId, params.subject, params.threadType, params.priority]
    );

    return db.get(
      `SELECT ${threadColumns} FROM active_message_threads WHERE id = ?`,
      [result.lastID]
    );
  }

  /**
   * Find a thread by id, scoped to the user's access level.
   */
  async findThreadById(
    threadId: number,
    userType: UserType,
    userId: string,
    threadColumns: string
  ): Promise<Record<string, unknown> | undefined> {
    const db = getDatabase();

    if (userType === 'admin') {
      return db.get(
        `SELECT ${threadColumns} FROM active_message_threads WHERE id = ?`,
        [threadId]
      );
    }

    return db.get(
      `SELECT ${threadColumns} FROM active_message_threads WHERE id = ? AND client_id = ?`,
      [threadId, userId]
    );
  }

  /**
   * Look up a client's contact_name and email by id.
   */
  async getClientContactInfo(
    clientId: string
  ): Promise<{ contact_name: string | null; email: string } | undefined> {
    const db = getDatabase();
    return db.get('SELECT contact_name, email FROM active_clients WHERE id = ?', [
      clientId
    ]) as Promise<{ contact_name: string | null; email: string } | undefined>;
  }

  /**
   * Insert a message into a thread.
   * Returns the inserted message row.
   */
  async insertMessage(
    params: InsertMessageParams,
    messageColumns: string
  ): Promise<Record<string, unknown> | undefined> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO messages (
        context_type, client_id, sender_type, sender_name, subject, message, priority,
        reply_to, attachments, thread_id
      )
      VALUES ('general', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.clientId,
        params.senderType,
        params.senderName,
        params.subject,
        params.message,
        params.priority,
        params.replyTo,
        params.attachments,
        params.threadId
      ]
    );

    return db.get(
      `SELECT ${messageColumns} FROM active_messages WHERE id = ?`,
      [result.lastID]
    );
  }

  /**
   * Bump the thread's last_message_at timestamp and last_message_by.
   */
  async updateThreadLastMessage(threadId: number, senderName: string): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE message_threads
       SET last_message_at = CURRENT_TIMESTAMP, last_message_by = ?
       WHERE id = ?`,
      [senderName, threadId]
    );
  }

  /**
   * Fetch client row by id (email + contact_name) — used for email notifications.
   */
  async getClientById(
    clientId: number
  ): Promise<Record<string, unknown> | undefined> {
    const db = getDatabase();
    return db.get('SELECT email, contact_name FROM active_clients WHERE id = ?', [clientId]);
  }

  /**
   * Get all messages in a thread (excluding internal), with pinned status.
   */
  async getThreadMessages(threadId: number): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    return db.all(
      `SELECT
        m.id, m.sender_type, m.sender_name, m.message, m.priority, m.reply_to,
        m.attachments, m.read_at, m.created_at, m.updated_at,
        CASE WHEN pm.id IS NOT NULL THEN 1 ELSE 0 END as is_pinned
      FROM active_messages m
      LEFT JOIN pinned_messages pm ON m.id = pm.message_id AND pm.thread_id = ?
      WHERE m.thread_id = ?
        AND m.context_type = 'general'
        AND (m.is_internal IS NULL OR m.is_internal = 0)
      ORDER BY m.created_at ASC`,
      [threadId, threadId]
    );
  }

  /**
   * Batch-fetch reactions for a set of message ids.
   * Returns a Map keyed by message_id.
   */
  async getReactionsByMessageIds(
    messageIds: number[]
  ): Promise<Map<number, ReactionRow_Core[]>> {
    const reactionsMap = new Map<number, ReactionRow_Core[]>();
    if (messageIds.length === 0) return reactionsMap;

    const db = getDatabase();
    const placeholders = messageIds.map(() => '?').join(',');
    const allReactions = await db.all(
      `SELECT id, message_id, reaction, user_email, created_at
       FROM message_reactions
       WHERE message_id IN (${placeholders})`,
      messageIds
    );

    for (const reaction of allReactions) {
      const msgId = reaction.message_id as number;
      if (!reactionsMap.has(msgId)) {
        reactionsMap.set(msgId, []);
      }
      reactionsMap.get(msgId)!.push(reaction as unknown as ReactionRow_Core);
    }

    return reactionsMap;
  }

  /**
   * Mark all messages in a thread as read (except messages sent by the given user type).
   */
  async markThreadMessagesAsRead(threadId: number, senderType: string): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE messages
       SET read_at = CURRENT_TIMESTAMP
       WHERE thread_id = ? AND sender_type != ? AND context_type = 'general'`,
      [threadId, senderType]
    );
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
      isInternal: getBoolean(row, 'is_internal'),
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
      `SELECT ${MESSAGE_SUBSCRIPTION_COLUMNS} FROM message_subscriptions WHERE project_id = ? AND user_email = ?`,
      [projectId, userEmail]
    );

    if (!row) return null;
    const r = row as Record<string, unknown>;
    return {
      id: getNumber(r, 'id'),
      projectId: getNumber(r, 'project_id'),
      userEmail: getString(r, 'user_email'),
      userType: getString(r, 'user_type'),
      notifyAll: getBoolean(r, 'notify_all'),
      notifyMentions: getBoolean(r, 'notify_mentions'),
      notifyReplies: getBoolean(r, 'notify_replies'),
      mutedUntil: r.muted_until as string | undefined,
      createdAt: getString(r, 'created_at'),
      updatedAt: getString(r, 'updated_at')
    };
  }

  async markMultipleAsRead(
    messageIds: number[],
    userEmail: string,
    userType: string
  ): Promise<number> {
    let count = 0;
    for (const messageId of messageIds) {
      try {
        await this.markAsRead(messageId, userEmail, userType);
        count++;
      } catch (err) {
        logger.warn(`[MessageService] Failed to mark message ${messageId} as read`, {
          error: err instanceof Error ? err : new Error(String(err)),
          category: 'MESSAGES'
        });
      }
    }
    return count;
  }

  async getThreadUnreadCount(threadId: number, userEmail: string): Promise<number> {
    const db = getDatabase();
    const result = await db.get(
      `
      SELECT COUNT(*) as count
      FROM active_messages m
      LEFT JOIN message_read_receipts mrr
        ON m.id = mrr.message_id AND mrr.user_email = ?
      WHERE m.thread_id = ?
        AND mrr.id IS NULL
    `,
      [userEmail, threadId]
    );

    return result ? getNumber(result as Record<string, unknown>, 'count') : 0;
  }

  async getArchivedThreads(): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    return db.all(`
      SELECT mt.*, p.project_name
      FROM active_message_threads mt
      LEFT JOIN active_projects p ON mt.project_id = p.id
      WHERE mt.archived_at IS NOT NULL
      ORDER BY mt.archived_at DESC
    `);
  }
  // =====================================================
  // ANALYTICS & ADMIN QUERIES
  // =====================================================

  /**
   * Get message analytics summary (thread counts, message counts, etc.)
   */
  async getMessageAnalytics(): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const analytics = await db.get(`
    SELECT
      COUNT(DISTINCT mt.id) as total_threads,
      COUNT(DISTINCT CASE WHEN mt.status = 'active' THEN mt.id END) as active_threads,
      COUNT(m.id) as total_messages,
      COUNT(CASE WHEN m.read_at IS NULL THEN m.id END) as unread_messages,
      COUNT(CASE WHEN m.sender_type = 'client' THEN m.id END) as client_messages,
      COUNT(CASE WHEN m.sender_type = 'admin' THEN m.id END) as admin_messages,
      COUNT(CASE WHEN m.message_type = 'inquiry' THEN m.id END) as inquiries,
      COUNT(CASE WHEN m.priority = 'urgent' THEN m.id END) as urgent_messages
    FROM active_message_threads mt
    LEFT JOIN active_messages m ON mt.id = m.thread_id AND m.context_type = 'general'
    `);
    return (analytics as Record<string, unknown>) ?? null;
  }

  /**
   * Get recent message thread activity with client info
   */
  async getRecentMessageActivity(limit: number = 10): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    const activity = await db.all(`
    SELECT
      mt.subject,
      mt.thread_type,
      mt.priority,
      mt.last_message_at,
      mt.last_message_by,
      c.company_name,
      c.contact_name
    FROM active_message_threads mt
    JOIN active_clients c ON mt.client_id = c.id
    ORDER BY mt.last_message_at DESC
    LIMIT ?
    `, [limit]);
    return activity as Record<string, unknown>[];
  }

  /**
   * Find a message by attachment filename, optionally scoped to a client.
   * Returns the message row or null.
   */
  async findMessageByAttachmentFilename(
    escapedFilename: string,
    userType: 'admin' | 'client',
    clientId?: number
  ): Promise<Record<string, unknown> | null> {
    const db = getDatabase();

    const messageQuery = userType === 'admin'
      ? 'SELECT m.id, m.attachments, m.thread_id FROM active_messages m WHERE m.attachments LIKE ? ESCAPE \'\\\''
      : `SELECT m.id, m.attachments, m.thread_id FROM active_messages m
         JOIN active_message_threads mt ON m.thread_id = mt.id
         WHERE m.attachments LIKE ? ESCAPE '\\' AND mt.client_id = ?`;

    const params = userType === 'admin'
      ? [`%"filename":"${escapedFilename}"%`]
      : [`%"filename":"${escapedFilename}"%`, clientId!];

    const message = await db.get(messageQuery, params);
    return (message as Record<string, unknown>) ?? null;
  }

  /**
   * Verify thread exists and return it
   */
  async getThreadById(threadId: number): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const MESSAGE_THREAD_COLUMNS = `
      id, project_id, client_id, subject, thread_type, status, priority,
      last_message_at, last_message_by, participant_count, created_at, updated_at,
      pinned_count, archived_at, archived_by
    `.replace(/\s+/g, ' ').trim();
    const thread = await db.get(
      `SELECT ${MESSAGE_THREAD_COLUMNS} FROM active_message_threads WHERE id = ?`,
      [threadId]
    );
    return (thread as Record<string, unknown>) ?? null;
  }

  /**
   * Send an internal message in a thread (admin only)
   */
  async sendInternalMessage(
    threadId: number,
    clientId: number | string | null,
    senderEmail: string,
    subject: string | null,
    content: string
  ): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const MESSAGE_COLUMNS = `
      id, project_id, client_id, thread_id, context_type, sender_type, sender_name,
      subject, message, message_type, priority, read_at, attachments,
      parent_message_id, is_internal, edited_at, deleted_at, deleted_by,
      reaction_count, reply_count, created_at, updated_at
    `.replace(/\s+/g, ' ').trim();

    const result = await db.run(
      `
      INSERT INTO messages (
        context_type, client_id, sender_type, sender_name, subject, message,
        thread_id, is_internal
      )
      VALUES ('general', ?, 'admin', ?, ?, ?, ?, TRUE)
      `,
      [clientId, senderEmail, subject, content, threadId]
    );

    // Process mentions in the internal message
    await this.processMentions(result.lastID!, content);

    const newMessage = await db.get(
      `SELECT ${MESSAGE_COLUMNS} FROM active_messages WHERE id = ?`,
      [result.lastID]
    );
    return (newMessage as Record<string, unknown>) ?? null;
  }

  /**
   * Get internal messages for a thread
   */
  async getInternalMessages(threadId: number): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    const MESSAGE_COLUMNS = `
      id, project_id, client_id, thread_id, context_type, sender_type, sender_name,
      subject, message, message_type, priority, read_at, attachments,
      parent_message_id, is_internal, edited_at, deleted_at, deleted_by,
      reaction_count, reply_count, created_at, updated_at
    `.replace(/\s+/g, ' ').trim();

    const messages = await db.all(
      `SELECT ${MESSAGE_COLUMNS} FROM active_messages
      WHERE thread_id = ? AND is_internal = TRUE AND context_type = 'general'
      ORDER BY created_at ASC`,
      [threadId]
    );
    return messages as Record<string, unknown>[];
  }

  /**
   * Check if user can access a message (admin always yes, client checks ownership)
   */
  async canUserAccessMessage(userType: string, userId: number | undefined, messageId: number): Promise<boolean> {
    if (userType === 'admin') return true;
    const db = getDatabase();
    const row = await db.get(
      `SELECT 1
       FROM active_messages m
       JOIN active_message_threads mt ON m.thread_id = mt.id
       WHERE m.id = ? AND mt.client_id = ?`,
      [messageId, userId]
    );
    return !!row;
  }

  /**
   * Check if user can access a project
   */
  async canUserAccessProject(userType: string, userId: number | undefined, projectId: number): Promise<boolean> {
    if (userType === 'admin') return true;
    const db = getDatabase();
    const row = await db.get(
      'SELECT 1 FROM active_projects WHERE id = ? AND client_id = ?',
      [projectId, userId]
    );
    return !!row;
  }

  // =====================================================
  // QUICK MESSAGE & NOTIFICATION PREFERENCES
  // =====================================================

  /**
   * Create a quick inquiry thread and message
   */
  async createInquiryThread(params: {
    clientId: number;
    subject: string;
    message: string;
    senderType: string;
    senderName: string;
    messageType: string;
    priority: string;
    attachmentData: string | null;
  }): Promise<number> {
    const db = getDatabase();
    const threadResult = await db.run(
      `INSERT INTO message_threads (client_id, subject, thread_type, priority)
       VALUES (?, ?, ?, ?)`,
      [params.clientId, params.subject, 'general', params.priority]
    );
    const threadId = threadResult.lastID!;

    await db.run(
      `INSERT INTO messages (
        context_type, client_id, sender_type, sender_name, subject, message,
        message_type, priority, attachments, thread_id
      )
      VALUES ('general', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.clientId,
        params.senderType,
        params.senderName,
        params.subject,
        params.message,
        params.messageType,
        params.priority,
        params.attachmentData,
        threadId
      ]
    );

    return threadId;
  }

  /**
   * Get the sender display name for a client
   */
  async getClientSenderName(clientId: number): Promise<string> {
    const db = getDatabase();
    const sender = await db.get(
      'SELECT contact_name, email FROM active_clients WHERE id = ?',
      [clientId]
    ) as { contact_name?: string; email?: string } | undefined;
    return sender?.contact_name || sender?.email || 'Unknown';
  }

  /**
   * Get notification preferences for a client, creating defaults if needed
   */
  async getNotificationPreferences(clientId: number): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const NOTIFICATION_PREF_COLUMNS = `
      id, client_id, email_enabled, sms_enabled, push_enabled,
      new_message_notifications, project_updates_notifications,
      invoice_notifications, marketing_notifications,
      quiet_hours_start, quiet_hours_end, timezone, created_at, updated_at
    `.replace(/\s+/g, ' ').trim();

    let preferences = await db.get(
      `SELECT ${NOTIFICATION_PREF_COLUMNS} FROM notification_preferences WHERE client_id = ?`,
      [clientId]
    );

    if (!preferences) {
      const result = await db.run(
        'INSERT INTO notification_preferences (client_id) VALUES (?)',
        [clientId]
      );
      preferences = await db.get(
        `SELECT ${NOTIFICATION_PREF_COLUMNS} FROM notification_preferences WHERE id = ?`,
        [result.lastID]
      );
    }

    return (preferences as Record<string, unknown>) ?? null;
  }

  /**
   * Update notification preferences for a client
   */
  async updateNotificationPreferences(
    clientId: number,
    updates: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const NOTIFICATION_PREF_COLUMNS = `
      id, client_id, email_enabled, sms_enabled, push_enabled,
      new_message_notifications, project_updates_notifications,
      invoice_notifications, marketing_notifications,
      quiet_hours_start, quiet_hours_end, timezone, created_at, updated_at
    `.replace(/\s+/g, ' ').trim();

    const setClauses: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    const allowedFields = [
      'email_notifications',
      'project_updates',
      'new_messages',
      'milestone_updates',
      'invoice_notifications',
      'marketing_emails',
      'notification_frequency'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(updates[field] as string | number | boolean | null);
      }
    }

    if (setClauses.length === 0) return null;

    values.push(clientId);

    await db.run(
      `UPDATE notification_preferences
       SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE client_id = ?`,
      values
    );

    const updatedPreferences = await db.get(
      `SELECT ${NOTIFICATION_PREF_COLUMNS} FROM notification_preferences WHERE client_id = ?`,
      [clientId]
    );
    return (updatedPreferences as Record<string, unknown>) ?? null;
  }
}

// Export singleton instance
export const messageService = new MessageService();
export default messageService;
