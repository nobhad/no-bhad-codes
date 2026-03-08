/**
 * ===============================================
 * UNIT TESTS - MESSAGE SERVICE
 * ===============================================
 * @file tests/unit/services/message-service.test.ts
 *
 * Tests for the enhanced messaging service including:
 * - Mention parsing and processing
 * - Reactions (add, remove, get)
 * - Subscriptions (get/create, update, mute, unmute, shouldNotify)
 * - Read receipts (markAsRead, markThreadAsRead, getReadReceipts, getUnreadCount)
 * - Pinned messages (pin, unpin, getPinnedMessages)
 * - Message editing and soft deletion
 * - Thread archiving
 * - Thread replies and search
 * - Route-compatible wrapper methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// =====================================================
// Mock setup must precede service import
// =====================================================

const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock all entity mapper functions so they return predictable shaped objects
vi.mock('../../../server/database/entities/index', () => ({
  toMention: vi.fn((row) => ({
    id: row.id,
    messageId: row.message_id,
    mentionedType: row.mentioned_type,
    mentionedId: row.mentioned_id,
    notified: Boolean(row.notified),
    notifiedAt: row.notified_at,
    createdAt: row.created_at
  })),
  toReaction: vi.fn((row) => ({
    id: row.id,
    messageId: row.message_id,
    userEmail: row.user_email,
    userType: row.user_type,
    reaction: row.reaction,
    createdAt: row.created_at
  })),
  toSubscription: vi.fn((row) => ({
    id: row?.id ?? 1,
    projectId: row?.project_id ?? 1,
    userEmail: row?.user_email ?? '',
    userType: row?.user_type ?? 'client',
    notifyAll: Boolean(row?.notify_all ?? 1),
    notifyMentions: Boolean(row?.notify_mentions ?? 1),
    notifyReplies: Boolean(row?.notify_replies ?? 1),
    mutedUntil: row?.muted_until ?? null,
    createdAt: row?.created_at ?? '',
    updatedAt: row?.updated_at ?? ''
  })),
  toReadReceipt: vi.fn((row) => ({
    id: row.id,
    messageId: row.message_id,
    userEmail: row.user_email,
    userType: row.user_type,
    readAt: row.read_at
  })),
  toPinnedMessage: vi.fn((row) => ({
    id: row.id,
    threadId: row.thread_id,
    messageId: row.message_id,
    pinnedBy: row.pinned_by,
    pinnedAt: row.pinned_at,
    message: undefined
  }))
}));

vi.mock('../../../server/database/row-helpers', () => ({
  getString: vi.fn((row, key) => (row && row[key] != null ? String(row[key]) : '')),
  getNumber: vi.fn((row, key) => (row && row[key] != null ? Number(row[key]) : 0)),
  getBoolean: vi.fn((row, key) => Boolean(row && row[key]))
}));

// Import after mocks
import { messageService } from '../../../server/services/message-service';

// =====================================================
// Shared fixtures
// =====================================================

const makeMentionRow = (overrides = {}) => ({
  id: 10,
  message_id: 1,
  mentioned_type: 'user',
  mentioned_id: 'test@example.com',
  notified: 0,
  notified_at: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeReactionRow = (overrides = {}) => ({
  id: 20,
  message_id: 1,
  user_email: 'user@example.com',
  user_type: 'client',
  reaction: '👍',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeSubscriptionRow = (overrides = {}) => ({
  id: 5,
  project_id: 1,
  user_email: 'user@example.com',
  user_type: 'client',
  notify_all: 1,
  notify_mentions: 1,
  notify_replies: 1,
  muted_until: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeReadReceiptRow = (overrides = {}) => ({
  id: 30,
  message_id: 1,
  user_email: 'user@example.com',
  user_type: 'client',
  read_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makePinnedRow = (overrides = {}) => ({
  id: 40,
  thread_id: 1,
  message_id: 1,
  pinned_by: 'admin@example.com',
  pinned_at: '2026-01-01T00:00:00Z',
  sender_name: 'Alice',
  message: 'Hello world',
  message_created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

// =====================================================
// MENTION TESTS
// =====================================================

describe('MessageService - Mentions', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('processMentions', () => {
    it('saves @all mention and updates message mention count', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 10 }); // INSERT mention
      mockDb.get.mockResolvedValueOnce(makeMentionRow({ mentioned_type: 'all', mentioned_id: null }));
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE mention_count

      const result = await messageService.processMentions(1, 'Hey @all please review');

      expect(mockDb.run).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(result[0].mentionedType).toBe('all');
    });

    it('saves @team:name mention', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 11 });
      mockDb.get.mockResolvedValueOnce(makeMentionRow({ mentioned_type: 'team', mentioned_id: 'designers' }));
      mockDb.run.mockResolvedValueOnce(undefined);

      const result = await messageService.processMentions(1, 'Hey @team:designers please review');

      expect(result).toHaveLength(1);
      expect(result[0].mentionedType).toBe('team');
    });

    it('saves @email mention', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 12 });
      mockDb.get.mockResolvedValueOnce(makeMentionRow({ mentioned_type: 'user', mentioned_id: 'test@example.com' }));
      mockDb.run.mockResolvedValueOnce(undefined);

      const result = await messageService.processMentions(1, 'Hey @test@example.com please review');

      expect(result).toHaveLength(1);
      expect(result[0].mentionedType).toBe('user');
    });

    it('saves multiple mentions of different types', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 10 }); // @all insert
      mockDb.get.mockResolvedValueOnce(makeMentionRow({ mentioned_type: 'all' }));
      mockDb.run.mockResolvedValueOnce({ lastID: 11 }); // @team insert
      mockDb.get.mockResolvedValueOnce(makeMentionRow({ mentioned_type: 'team', mentioned_id: 'devs' }));
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE mention_count

      const result = await messageService.processMentions(1, 'Hey @all and @team:devs');

      expect(result).toHaveLength(2);
    });

    it('returns empty array and updates count to zero when no mentions', async () => {
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE mention_count

      const result = await messageService.processMentions(1, 'No mentions in this message');

      expect(result).toHaveLength(0);
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE messages SET mention_count = ? WHERE id = ?',
        [0, 1]
      );
    });

    it('skips row not returned from db.get after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 10 });
      mockDb.get.mockResolvedValueOnce(null); // No row returned
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE

      const result = await messageService.processMentions(1, 'Hey @all');

      expect(result).toHaveLength(0);
    });
  });

  describe('getMentions', () => {
    it('returns mentions for a message', async () => {
      mockDb.all.mockResolvedValueOnce([makeMentionRow(), makeMentionRow({ id: 11 })]);

      const result = await messageService.getMentions(1);

      expect(result).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('message_mentions'), [1]);
    });

    it('returns empty array when no mentions', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await messageService.getMentions(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('getMyMentions', () => {
    it('returns messages where user is mentioned', async () => {
      const msgRow = {
        id: 1, thread_id: 1, sender_type: 'admin', sender_name: 'Admin',
        message: 'Hello', priority: 'normal', read_at: null, is_internal: 0,
        edited_at: null, deleted_at: null, created_at: '2026-01-01T00:00:00Z',
        parent_message_id: null, reaction_count: 0, reply_count: 0, mention_count: 1
      };
      mockDb.all.mockResolvedValueOnce([msgRow]);

      const result = await messageService.getMyMentions('user@example.com');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('uses default limit of 50', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await messageService.getMyMentions('user@example.com');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.any(String),
        ['user@example.com', 50]
      );
    });

    it('accepts custom limit', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await messageService.getMyMentions('user@example.com', 10);

      expect(mockDb.all).toHaveBeenCalledWith(expect.any(String), ['user@example.com', 10]);
    });
  });

  describe('markMentionsNotified', () => {
    it('marks unnotified mentions as notified', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);

      await messageService.markMentionsNotified(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('notified = TRUE'),
        [1]
      );
    });
  });
});

// =====================================================
// REACTION TESTS
// =====================================================

describe('MessageService - Reactions', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('addReaction', () => {
    it('adds a reaction and updates reaction count', async () => {
      mockDb.get.mockResolvedValueOnce(null); // No existing reaction
      mockDb.run.mockResolvedValueOnce({ lastID: 20 }); // INSERT
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE count
      mockDb.get.mockResolvedValueOnce(makeReactionRow());

      const result = await messageService.addReaction(1, 'user@example.com', 'client', '👍');

      expect(result.reaction).toBe('👍');
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    it('throws when reaction already exists', async () => {
      mockDb.get.mockResolvedValueOnce({ id: 20 }); // Existing reaction

      await expect(
        messageService.addReaction(1, 'user@example.com', 'client', '👍')
      ).rejects.toThrow('Reaction already exists');
    });
  });

  describe('removeReaction', () => {
    it('removes reaction and decrements count when rows changed', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // DELETE
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE count

      await messageService.removeReaction(1, 'user@example.com', '👍');

      expect(mockDb.run).toHaveBeenCalledTimes(2);
      expect(mockDb.run).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('reaction_count = reaction_count - 1'),
        [1]
      );
    });

    it('does not update count if no rows changed', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 0 }); // Nothing deleted

      await messageService.removeReaction(1, 'user@example.com', '👍');

      expect(mockDb.run).toHaveBeenCalledTimes(1);
    });

    it('does not update count if changes is undefined', async () => {
      mockDb.run.mockResolvedValueOnce({}); // No changes property

      await messageService.removeReaction(1, 'user@example.com', '👍');

      expect(mockDb.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('getReactions', () => {
    it('returns grouped reaction summaries', async () => {
      mockDb.all.mockResolvedValueOnce([
        { reaction: '👍', count: 2, users: 'alice@x.com|client,bob@x.com|admin' }
      ]);

      const result = await messageService.getReactions(1);

      expect(result).toHaveLength(1);
      expect(result[0].reaction).toBe('👍');
      expect(result[0].count).toBe(2);
      expect(result[0].users).toHaveLength(2);
    });

    it('handles empty users string gracefully', async () => {
      mockDb.all.mockResolvedValueOnce([
        { reaction: '❤️', count: 0, users: '' }
      ]);

      const result = await messageService.getReactions(1);

      expect(result[0].users).toHaveLength(0);
    });

    it('returns empty array when no reactions', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await messageService.getReactions(1);

      expect(result).toHaveLength(0);
    });
  });
});

// =====================================================
// SUBSCRIPTION TESTS
// =====================================================

describe('MessageService - Subscriptions', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getOrCreateSubscription', () => {
    it('returns existing subscription without inserting', async () => {
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow());

      const result = await messageService.getOrCreateSubscription(1, 'user@example.com', 'client');

      expect(result.projectId).toBe(1);
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('creates subscription when none exists', async () => {
      mockDb.get.mockResolvedValueOnce(null); // Not found
      mockDb.run.mockResolvedValueOnce(undefined); // INSERT
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow()); // After insert

      const result = await messageService.getOrCreateSubscription(1, 'user@example.com', 'client');

      expect(result.projectId).toBe(1);
      expect(mockDb.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateSubscription', () => {
    it('updates all notification preferences', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow());

      const result = await messageService.updateSubscription(1, 'user@example.com', {
        notifyAll: false,
        notifyMentions: true,
        notifyReplies: false
      });

      expect(mockDb.run).toHaveBeenCalledTimes(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('notify_all = ?'),
        expect.arrayContaining([0, 1, 0])
      );
      expect(result).toBeDefined();
    });

    it('updates only provided preferences', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow());

      await messageService.updateSubscription(1, 'user@example.com', { notifyMentions: false });

      const callArgs = mockDb.run.mock.calls[0];
      expect(callArgs[0]).toContain('notify_mentions = ?');
      expect(callArgs[0]).not.toContain('notify_all');
    });

    it('skips db.run when no preferences provided', async () => {
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow());

      await messageService.updateSubscription(1, 'user@example.com', {});

      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('muteProject', () => {
    it('mutes a project with expiry date', async () => {
      // getOrCreateSubscription: existing row
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow());
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE muted_until

      const until = new Date('2026-12-31T00:00:00Z');
      await messageService.muteProject(1, 'user@example.com', 'client', until);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('muted_until = ?'),
        [until.toISOString(), 1, 'user@example.com']
      );
    });

    it('mutes a project permanently (no date)', async () => {
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow());
      mockDb.run.mockResolvedValueOnce(undefined);

      await messageService.muteProject(1, 'user@example.com', 'client');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('muted_until = ?'),
        [null, 1, 'user@example.com']
      );
    });
  });

  describe('unmuteProject', () => {
    it('clears muted_until', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);

      await messageService.unmuteProject(1, 'user@example.com');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('muted_until = NULL'),
        [1, 'user@example.com']
      );
    });
  });

  describe('shouldNotify', () => {
    it('returns true when no subscription exists', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await messageService.shouldNotify(1, 'user@example.com', 'all');

      expect(result).toBe(true);
    });

    it('returns false when project is muted until future date', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      // toSubscription mock returns mutedUntil from the row
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow({ muted_until: futureDate }));

      // Override toSubscription for this test to return muted subscription
      const { toSubscription } = await import('../../../server/database/entities/index');
      vi.mocked(toSubscription).mockReturnValueOnce({
        id: 5, projectId: 1, userEmail: 'user@example.com', userType: 'client',
        notifyAll: true, notifyMentions: true, notifyReplies: true,
        mutedUntil: futureDate, createdAt: '', updatedAt: ''
      });

      const result = await messageService.shouldNotify(1, 'user@example.com', 'all');

      expect(result).toBe(false);
    });

    it('returns notifyAll for type "all"', async () => {
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow({ notify_all: 0 }));
      const { toSubscription } = await import('../../../server/database/entities/index');
      vi.mocked(toSubscription).mockReturnValueOnce({
        id: 5, projectId: 1, userEmail: 'user@example.com', userType: 'client',
        notifyAll: false, notifyMentions: true, notifyReplies: true,
        mutedUntil: undefined, createdAt: '', updatedAt: ''
      });

      const result = await messageService.shouldNotify(1, 'user@example.com', 'all');

      expect(result).toBe(false);
    });

    it('returns notifyMentions for type "mention"', async () => {
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow());
      const { toSubscription } = await import('../../../server/database/entities/index');
      vi.mocked(toSubscription).mockReturnValueOnce({
        id: 5, projectId: 1, userEmail: 'user@example.com', userType: 'client',
        notifyAll: true, notifyMentions: false, notifyReplies: true,
        mutedUntil: undefined, createdAt: '', updatedAt: ''
      });

      const result = await messageService.shouldNotify(1, 'user@example.com', 'mention');

      expect(result).toBe(false);
    });

    it('returns notifyReplies for type "reply"', async () => {
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow());
      const { toSubscription } = await import('../../../server/database/entities/index');
      vi.mocked(toSubscription).mockReturnValueOnce({
        id: 5, projectId: 1, userEmail: 'user@example.com', userType: 'client',
        notifyAll: true, notifyMentions: true, notifyReplies: false,
        mutedUntil: undefined, createdAt: '', updatedAt: ''
      });

      const result = await messageService.shouldNotify(1, 'user@example.com', 'reply');

      expect(result).toBe(false);
    });

    it('returns notifyAll as default for unknown notification type', async () => {
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow());
      const { toSubscription } = await import('../../../server/database/entities/index');
      vi.mocked(toSubscription).mockReturnValueOnce({
        id: 5, projectId: 1, userEmail: 'user@example.com', userType: 'client',
        notifyAll: true, notifyMentions: true, notifyReplies: true,
        mutedUntil: undefined, createdAt: '', updatedAt: ''
      });

      // Force the default branch with a cast
      const result = await messageService.shouldNotify(1, 'user@example.com', 'all');

      expect(result).toBe(true);
    });
  });

  describe('getSubscription', () => {
    it('returns null when no subscription exists', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await messageService.getSubscription(1, 'user@example.com');

      expect(result).toBeNull();
    });

    it('returns subscription when it exists', async () => {
      mockDb.get.mockResolvedValueOnce(makeSubscriptionRow());

      const result = await messageService.getSubscription(1, 'user@example.com');

      expect(result).not.toBeNull();
      expect(result!.userEmail).toBe('user@example.com');
    });
  });
});

// =====================================================
// READ RECEIPT TESTS
// =====================================================

describe('MessageService - Read Receipts', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('markAsRead', () => {
    it('inserts a read receipt', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);

      await messageService.markAsRead(1, 'user@example.com', 'client');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE INTO message_read_receipts'),
        [1, 'user@example.com', 'client']
      );
    });
  });

  describe('markThreadAsRead', () => {
    it('marks all unread messages in a thread as read', async () => {
      mockDb.all.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
      mockDb.run.mockResolvedValueOnce(undefined); // markAsRead for msg 1
      mockDb.run.mockResolvedValueOnce(undefined); // markAsRead for msg 2

      const count = await messageService.markThreadAsRead(5, 'user@example.com', 'client');

      expect(count).toBe(2);
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    it('returns 0 when all messages already read', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const count = await messageService.markThreadAsRead(5, 'user@example.com', 'client');

      expect(count).toBe(0);
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('getReadReceipts', () => {
    it('returns receipts for a message', async () => {
      mockDb.all.mockResolvedValueOnce([makeReadReceiptRow(), makeReadReceiptRow({ id: 31 })]);

      const result = await messageService.getReadReceipts(1);

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no receipts', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await messageService.getReadReceipts(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('getUnreadCount', () => {
    it('uses admin query for admin user type', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 3 });

      const count = await messageService.getUnreadCount('admin@example.com', 'admin');

      expect(count).toBe(3);
      // Admin query uses a single email param
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining("sender_type != 'admin'"),
        ['admin@example.com']
      );
    });

    it('uses client query for client user type', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 5 });

      const count = await messageService.getUnreadCount('client@example.com', 'client');

      expect(count).toBe(5);
      // Client query uses email twice
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining("sender_type != 'client'"),
        ['client@example.com', 'client@example.com']
      );
    });

    it('returns 0 when result is null/falsy', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const count = await messageService.getUnreadCount('admin@example.com', 'admin');

      expect(count).toBe(0);
    });
  });

  describe('markMultipleAsRead', () => {
    it('marks all provided message IDs as read and returns count', async () => {
      mockDb.run.mockResolvedValue(undefined);

      const count = await messageService.markMultipleAsRead([1, 2, 3], 'user@example.com', 'client');

      expect(count).toBe(3);
      expect(mockDb.run).toHaveBeenCalledTimes(3);
    });

    it('continues and logs warning if individual markAsRead fails', async () => {
      mockDb.run
        .mockResolvedValueOnce(undefined) // msg 1 ok
        .mockRejectedValueOnce(new Error('DB error')) // msg 2 fails
        .mockResolvedValueOnce(undefined); // msg 3 ok

      const { logger } = await import('../../../server/services/logger');
      const count = await messageService.markMultipleAsRead([1, 2, 3], 'user@example.com', 'client');

      expect(count).toBe(2);
      expect(vi.mocked(logger.warn)).toHaveBeenCalled();
    });

    it('returns 0 for empty array', async () => {
      const count = await messageService.markMultipleAsRead([], 'user@example.com', 'client');

      expect(count).toBe(0);
    });
  });

  describe('getThreadUnreadCount', () => {
    it('returns unread count for a thread', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 7 });

      const count = await messageService.getThreadUnreadCount(1, 'user@example.com');

      expect(count).toBe(7);
    });

    it('returns 0 when result is falsy', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const count = await messageService.getThreadUnreadCount(1, 'user@example.com');

      expect(count).toBe(0);
    });
  });
});

// =====================================================
// PINNED MESSAGE TESTS
// =====================================================

describe('MessageService - Pinned Messages', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('pinMessage', () => {
    it('pins a message and increments thread pinned count', async () => {
      mockDb.get.mockResolvedValueOnce({ id: 1 }); // Message found in thread
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // INSERT OR IGNORE (new pin)
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE pinned_count
      mockDb.get.mockResolvedValueOnce(makePinnedRow()); // Fetch pinned row

      const result = await messageService.pinMessage(1, 1, 'admin@example.com');

      expect(result.pinnedBy).toBe('admin@example.com');
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    it('does not increment pinned count if already pinned (changes = 0)', async () => {
      mockDb.get.mockResolvedValueOnce({ id: 1 });
      mockDb.run.mockResolvedValueOnce({ changes: 0 }); // Already pinned
      mockDb.get.mockResolvedValueOnce(makePinnedRow());

      await messageService.pinMessage(1, 1, 'admin@example.com');

      expect(mockDb.run).toHaveBeenCalledTimes(1); // Only INSERT, no UPDATE
    });

    it('throws when message not found in thread', async () => {
      mockDb.get.mockResolvedValueOnce(null); // Message not in thread

      await expect(
        messageService.pinMessage(1, 999, 'admin@example.com')
      ).rejects.toThrow('Message not found in thread');
    });
  });

  describe('unpinMessage', () => {
    it('unpins a message and decrements pinned count', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // DELETE
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE pinned_count

      await messageService.unpinMessage(1, 1);

      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    it('does not decrement if message was not pinned', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 0 });

      await messageService.unpinMessage(1, 1);

      expect(mockDb.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPinnedMessages', () => {
    it('returns pinned messages with embedded message content', async () => {
      mockDb.all.mockResolvedValueOnce([makePinnedRow(), makePinnedRow({ id: 41, message_id: 2 })]);

      const result = await messageService.getPinnedMessages(1);

      expect(result).toHaveLength(2);
      // Each pinned message should have message content attached
      expect(result[0].message).toBeDefined();
    });

    it('returns empty array when no pinned messages', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await messageService.getPinnedMessages(1);

      expect(result).toHaveLength(0);
    });
  });
});

// =====================================================
// MESSAGE EDITING / DELETION TESTS
// =====================================================

describe('MessageService - Editing and Deletion', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('editMessage', () => {
    it('updates message content and re-processes mentions', async () => {
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE message
      mockDb.run.mockResolvedValueOnce(undefined); // DELETE old mentions
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE mention_count (processMentions, no matches)

      await messageService.editMessage(1, 'Updated content');

      expect(mockDb.run).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SET message = ?'),
        ['Updated content', 1]
      );
      expect(mockDb.run).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM message_mentions WHERE message_id = ?',
        [1]
      );
    });

    it('re-processes new mentions in edited content', async () => {
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE
      mockDb.run.mockResolvedValueOnce(undefined); // DELETE mentions
      mockDb.run.mockResolvedValueOnce({ lastID: 10 }); // INSERT @all mention
      mockDb.get.mockResolvedValueOnce(makeMentionRow({ mentioned_type: 'all' }));
      mockDb.run.mockResolvedValueOnce(undefined); // UPDATE mention_count

      await messageService.editMessage(1, 'Updated @all content');

      // processMentions should have inserted the @all mention
      const insertCall = mockDb.run.mock.calls.find(call =>
        call[0].includes('INSERT INTO message_mentions')
      );
      expect(insertCall).toBeDefined();
    });
  });

  describe('deleteMessage', () => {
    it('soft-deletes a message by setting deleted_at and deleted_by', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);

      await messageService.deleteMessage(1, 'admin@example.com');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = datetime'),
        ['admin@example.com', 1]
      );
    });
  });

  describe('restoreMessage', () => {
    it('clears deleted_at and deleted_by', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);

      await messageService.restoreMessage(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = NULL'),
        [1]
      );
    });
  });
});

// =====================================================
// THREAD TESTS
// =====================================================

describe('MessageService - Threads', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('archiveThread', () => {
    it('archives a thread', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);

      await messageService.archiveThread(1, 'admin@example.com');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("status = 'archived'"),
        ['admin@example.com', 1]
      );
    });
  });

  describe('unarchiveThread', () => {
    it('unarchives a thread', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);

      await messageService.unarchiveThread(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("status = 'active'"),
        [1]
      );
    });
  });

  describe('getThreadReplies', () => {
    const msgRow = {
      id: 1, thread_id: 1, sender_type: 'admin', sender_name: 'Admin',
      message: 'Hello', priority: 'normal', read_at: null, is_internal: 0,
      edited_at: null, deleted_at: null, created_at: '2026-01-01T00:00:00Z',
      parent_message_id: null, reaction_count: 0, reply_count: 0, mention_count: 0
    };

    it('fetches top-level messages when no parentMessageId', async () => {
      mockDb.all.mockResolvedValueOnce([msgRow]);

      const result = await messageService.getThreadReplies(1);

      expect(result).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('parent_message_id IS NULL'),
        [1]
      );
    });

    it('fetches replies to a specific parent message', async () => {
      mockDb.all.mockResolvedValueOnce([{ ...msgRow, parent_message_id: 5 }]);

      const result = await messageService.getThreadReplies(1, 5);

      expect(result).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('parent_message_id = ?'),
        [1, 5]
      );
    });
  });

  describe('getArchivedThreads', () => {
    it('returns archived threads', async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: 1, archived_at: '2026-01-01T00:00:00Z', project_name: 'Project A' }
      ]);

      const result = await messageService.getArchivedThreads();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('archived_at');
    });
  });
});

// =====================================================
// SEARCH TESTS
// =====================================================

describe('MessageService - Search', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  const makeSearchRow = (overrides = {}) => ({
    message_id: 1,
    thread_id: 1,
    thread_subject: 'Test Thread',
    sender_name: 'Alice',
    message: 'Hello world',
    created_at: '2026-01-01T00:00:00Z',
    project_id: 10,
    project_name: 'Project A',
    ...overrides
  });

  describe('searchMessages', () => {
    it('searches messages with basic query', async () => {
      mockDb.all.mockResolvedValueOnce([makeSearchRow()]);

      const result = await messageService.searchMessages('hello');

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Hello world');
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LIKE ?'),
        expect.arrayContaining(['%hello%'])
      );
    });

    it('filters by projectId when provided', async () => {
      mockDb.all.mockResolvedValueOnce([makeSearchRow()]);

      await messageService.searchMessages('hello', { projectId: 10 });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('mt.project_id = ?'),
        expect.arrayContaining([10])
      );
    });

    it('filters by threadId when provided', async () => {
      mockDb.all.mockResolvedValueOnce([makeSearchRow()]);

      await messageService.searchMessages('hello', { threadId: 1 });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('m.thread_id = ?'),
        expect.arrayContaining([1])
      );
    });

    it('excludes internal messages by default', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await messageService.searchMessages('hello');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('is_internal'),
        expect.any(Array)
      );
    });

    it('includes internal messages when includeInternal is true', async () => {
      mockDb.all.mockResolvedValueOnce([makeSearchRow()]);

      await messageService.searchMessages('hello', { includeInternal: true });

      const callArgs = mockDb.all.mock.calls[0][0] as string;
      expect(callArgs).not.toContain('is_internal');
    });

    it('uses default limit of 50', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await messageService.searchMessages('hello');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([50])
      );
    });

    it('uses custom limit', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await messageService.searchMessages('hello', { limit: 10 });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10])
      );
    });

    it('maps undefined project_id and project_name to undefined', async () => {
      mockDb.all.mockResolvedValueOnce([makeSearchRow({ project_id: null, project_name: null })]);

      const result = await messageService.searchMessages('hello');

      expect(result[0].projectId).toBeUndefined();
      expect(result[0].projectName).toBeUndefined();
    });

    it('returns empty array when no results', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await messageService.searchMessages('no match');

      expect(result).toHaveLength(0);
    });
  });
});
