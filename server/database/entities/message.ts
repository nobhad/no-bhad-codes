/**
 * ===============================================
 * MESSAGE ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/message.ts
 *
 * Entity schemas and mappers for messaging-related data types.
 */

import { defineSchema, definePartialSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface Mention {
  id: number;
  messageId: number;
  mentionedType: 'user' | 'team' | 'all';
  mentionedId?: string;
  notified: boolean;
  notifiedAt?: string;
  createdAt: string;
}

export interface Reaction {
  id: number;
  messageId: number;
  userEmail: string;
  userType: string;
  reaction: string;
  createdAt: string;
}

export interface Subscription {
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

export interface ReadReceipt {
  id: number;
  messageId: number;
  userEmail: string;
  userType: string;
  readAt: string;
}

export interface PinnedMessage {
  id: number;
  threadId: number;
  messageId: number;
  pinnedBy: string;
  pinnedAt: string;
  message?: object;
}

// =====================================================
// ROW TYPE DEFINITIONS
// =====================================================

export interface MentionRow extends DatabaseRow {
  id: number;
  message_id: number;
  mentioned_type: string;
  mentioned_id?: string;
  notified: number;
  notified_at?: string;
  created_at: string;
}

export interface ReactionRow extends DatabaseRow {
  id: number;
  message_id: number;
  user_email: string;
  user_type: string;
  reaction: string;
  created_at: string;
}

export interface SubscriptionRow extends DatabaseRow {
  id: number;
  project_id: number;
  user_email: string;
  user_type: string;
  notify_all: number;
  notify_mentions: number;
  notify_replies: number;
  muted_until?: string;
  created_at: string;
  updated_at: string;
}

export interface ReadReceiptRow extends DatabaseRow {
  id: number;
  message_id: number;
  user_email: string;
  user_type: string;
  read_at: string;
}

export interface PinnedMessageRow extends DatabaseRow {
  id: number;
  thread_id: number;
  message_id: number;
  pinned_by: string;
  pinned_at: string;
}

// =====================================================
// ENTITY SCHEMAS
// =====================================================

export const mentionSchema = defineSchema<Mention>({
  id: 'number',
  messageId: { column: 'message_id', type: 'number' },
  mentionedType: {
    column: 'mentioned_type',
    type: 'string',
    transform: (v) => v as 'user' | 'team' | 'all',
  },
  mentionedId: { column: 'mentioned_id', type: 'string?' },
  notified: { column: 'notified', type: 'boolean' },
  notifiedAt: { column: 'notified_at', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
});

export const reactionSchema = defineSchema<Reaction>({
  id: 'number',
  messageId: { column: 'message_id', type: 'number' },
  userEmail: { column: 'user_email', type: 'string' },
  userType: { column: 'user_type', type: 'string' },
  reaction: 'string',
  createdAt: { column: 'created_at', type: 'string' },
});

export const subscriptionSchema = defineSchema<Subscription>({
  id: 'number',
  projectId: { column: 'project_id', type: 'number' },
  userEmail: { column: 'user_email', type: 'string' },
  userType: { column: 'user_type', type: 'string' },
  notifyAll: { column: 'notify_all', type: 'boolean' },
  notifyMentions: { column: 'notify_mentions', type: 'boolean' },
  notifyReplies: { column: 'notify_replies', type: 'boolean' },
  mutedUntil: { column: 'muted_until', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' },
});

export const readReceiptSchema = defineSchema<ReadReceipt>({
  id: 'number',
  messageId: { column: 'message_id', type: 'number' },
  userEmail: { column: 'user_email', type: 'string' },
  userType: { column: 'user_type', type: 'string' },
  readAt: { column: 'read_at', type: 'string' },
});

// PinnedMessage has optional 'message' computed field
export const pinnedMessageSchema = definePartialSchema<PinnedMessage>()({
  id: 'number',
  threadId: { column: 'thread_id', type: 'number' },
  messageId: { column: 'message_id', type: 'number' },
  pinnedBy: { column: 'pinned_by', type: 'string' },
  pinnedAt: { column: 'pinned_at', type: 'string' },
});

// =====================================================
// MAPPER FUNCTIONS
// =====================================================

export const toMention = createMapper<MentionRow, Mention>(mentionSchema);
export const toReaction = createMapper<ReactionRow, Reaction>(reactionSchema);
export const toSubscription = createMapper<SubscriptionRow, Subscription>(subscriptionSchema);
export const toReadReceipt = createMapper<ReadReceiptRow, ReadReceipt>(readReceiptSchema);

/**
 * Map a PinnedMessageRow to PinnedMessage.
 * Note: 'message' is an optional computed field that needs to be added separately.
 */
export function toPinnedMessage(row: PinnedMessageRow): PinnedMessage {
  type BasePinnedMessage = Omit<PinnedMessage, 'message'>;
  return createMapper<PinnedMessageRow, BasePinnedMessage>(
    pinnedMessageSchema as ReturnType<typeof defineSchema<BasePinnedMessage>>
  )(row) as PinnedMessage;
}
