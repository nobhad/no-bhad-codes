/**
 * ===============================================
 * API TYPES — MESSAGES
 * ===============================================
 */

// ============================================
// Messaging API Types
// ============================================

/**
 * Message thread response (matches server API response)
 */
export interface MessageThreadResponse {
  id: number;
  subject: string;
  client_id: number;
  project_id?: number; // May be present if thread is associated with a project
  client_name?: string;
  status: ThreadStatus | string; // Allow string for flexibility
  last_message_at: string;
  unread_count: number;
}

export type ThreadStatus = 'active' | 'closed' | 'archived';

/**
 * Message response (matches server API response)
 */
export interface MessageResponse {
  id: number;
  thread_id?: number;
  project_id?: number;
  sender_type?: SenderType;
  sender_role?: string;
  sender_name: string;
  message: string;
  read_at: string | null; // Datetime when message was read, null if unread
  created_at: string;
  attachments?: string | unknown[]; // Can be JSON string or parsed array
}

export type SenderType = 'client' | 'admin' | 'system';

/**
 * Send message request
 */
export interface SendMessageRequest {
  message: string;
  attachments?: string[];
}

/**
 * Create thread request
 */
export interface CreateThreadRequest {
  client_id: number;
  subject: string;
  message: string;
}

// ============================================

// ============================================
// Messaging Enhancement API Types
// ============================================

/**
 * Message mention type
 */
export type MentionType = 'user' | 'team' | 'all';

/**
 * Message mention
 */
export interface MessageMention {
  id: number;
  messageId: number;
  mentionedType: MentionType;
  mentionedId: string | null;
  notified: boolean;
  notifiedAt: string | null;
  createdAt: string;
}

/**
 * Message mention response (snake_case for API)
 */
export interface MessageMentionResponse {
  id: number;
  message_id: number;
  mentioned_type: MentionType;
  mentioned_id: string | null;
  notified: boolean;
  notified_at: string | null;
  created_at: string;
}

/**
 * Message reaction
 */
export interface MessageReaction {
  id: number;
  messageId: number;
  userEmail: string;
  userType: 'admin' | 'client';
  reaction: string;
  createdAt: string;
}

/**
 * Message reaction response (snake_case for API)
 */
export interface MessageReactionResponse {
  id: number;
  message_id: number;
  user_email: string;
  user_type: 'admin' | 'client';
  reaction: string;
  created_at: string;
}

/**
 * Grouped reactions summary
 */
export interface ReactionSummary {
  reaction: string;
  count: number;
  users: string[];
  hasUserReacted: boolean;
}

/**
 * Message subscription preferences
 */
export interface MessageSubscription {
  id: number;
  projectId: number;
  userEmail: string;
  userType: 'admin' | 'client';
  notifyAll: boolean;
  notifyMentions: boolean;
  notifyReplies: boolean;
  mutedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Message subscription response (snake_case for API)
 */
export interface MessageSubscriptionResponse {
  id: number;
  project_id: number;
  user_email: string;
  user_type: 'admin' | 'client';
  notify_all: boolean;
  notify_mentions: boolean;
  notify_replies: boolean;
  muted_until: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Message read receipt
 */
export interface MessageReadReceipt {
  id: number;
  messageId: number;
  userEmail: string;
  userType: 'admin' | 'client';
  readAt: string;
}

/**
 * Message read receipt response (snake_case for API)
 */
export interface MessageReadReceiptResponse {
  id: number;
  message_id: number;
  user_email: string;
  user_type: 'admin' | 'client';
  read_at: string;
}

/**
 * Pinned message
 */
export interface PinnedMessage {
  id: number;
  threadId: number;
  messageId: number;
  pinnedBy: string;
  pinnedAt: string;
  message?: EnhancedMessageResponse;
}

/**
 * Pinned message response (snake_case for API)
 */
export interface PinnedMessageResponse {
  id: number;
  thread_id: number;
  message_id: number;
  pinned_by: string;
  pinned_at: string;
  message?: EnhancedMessageResponse;
}

/**
 * Enhanced message with new fields
 */
export interface EnhancedMessage extends MessageResponse {
  parentMessageId: number | null;
  isInternal: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  reactionCount: number;
  replyCount: number;
  mentionCount: number;
  reactions?: ReactionSummary[];
  mentions?: MessageMention[];
  replies?: EnhancedMessage[];
}

/**
 * Enhanced message response (snake_case for API)
 */
export interface EnhancedMessageResponse {
  id: number;
  client_id: number;
  thread_id: number;
  sender_type: 'admin' | 'client';
  sender_name: string;
  subject: string;
  message: string;
  priority: 'normal' | 'urgent' | 'low';
  reply_to: number | null;
  attachments: MessageAttachment[] | null;
  read_at: string | null; // Datetime when message was read, null if unread
  created_at: string;
  updated_at: string;
  parent_message_id: number | null;
  is_internal: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  reaction_count: number;
  reply_count: number;
  mention_count: number;
  reactions?: ReactionSummary[];
  mentions?: MessageMentionResponse[];
  replies?: EnhancedMessageResponse[];
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
}

/**
 * Enhanced thread with new fields
 */
export interface EnhancedThread extends MessageThreadResponse {
  pinnedCount: number;
  participantCount: number;
  archivedAt: string | null;
  archivedBy: string | null;
}

/**
 * Enhanced thread response (snake_case for API)
 */
export interface EnhancedThreadResponse {
  id: number;
  client_id: number;
  project_id: number | null;
  subject: string;
  thread_type: string;
  status: string;
  priority: string;
  last_message_at: string;
  last_message_by: string | null;
  created_at: string;
  updated_at: string;
  pinned_count: number;
  participant_count: number;
  archived_at: string | null;
  archived_by: string | null;
}

/**
 * Message search options
 */
export interface MessageSearchOptions {
  projectId?: number;
  threadId?: number;
  limit?: number;
  userEmail?: string;
  includeInternal?: boolean;
}

/**
 * Message search result
 */
export interface MessageSearchResult {
  id: number;
  threadId: number;
  threadSubject: string;
  senderName: string;
  senderType: 'admin' | 'client';
  message: string;
  createdAt: string;
  highlight?: string;
}

/**
 * Message search result response (snake_case for API)
 */
export interface MessageSearchResultResponse {
  id: number;
  thread_id: number;
  thread_subject: string;
  sender_name: string;
  sender_type: 'admin' | 'client';
  message: string;
  created_at: string;
  highlight?: string;
}

/**
 * Subscription update request
 */
export interface UpdateSubscriptionRequest {
  notify_all?: boolean;
  notify_mentions?: boolean;
  notify_replies?: boolean;
}

/**
 * Add reaction request
 */
export interface AddReactionRequest {
  reaction: string;
}

/**
 * Mute project request
 */
export interface MuteProjectRequest {
  until?: string;
}

/**
 * Pin message request
 */
export interface PinMessageRequest {
  thread_id: number;
}

/**
 * Edit message request
 */
export interface EditMessageRequest {
  message: string;
}

/**
 * Send internal message request
 */
export interface SendInternalMessageRequest {
  message: string;
}

/**
 * Bulk read request
 */
export interface BulkReadRequest {
  message_ids: number[];
}
