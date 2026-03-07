/**
 * Portal Messages Types
 * Types for client portal messaging feature
 */

import type { PortalViewProps } from '../types';

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface MessageAttachment {
  id: number;
  filename: string;
  file_size: number;
  file_type: string;
  download_url: string;
}

export interface Message {
  id: number;
  thread_id?: number;
  sender_name: string;
  sender_type: 'client' | 'admin';
  /** Message content - API returns this as 'message' field */
  message: string;
  /** Alias for message content for convenience */
  content?: string;
  priority?: string;
  reply_to?: number | null;
  attachments: MessageAttachment[] | string | null;
  is_pinned?: number;
  read_at?: string | null;
  created_at: string;
  updated_at?: string;
  reactions?: Array<{
    id: number;
    message_id: number;
    reaction: string;
    user_email: string;
    created_at: string;
  }>;
}

export interface MessageThread {
  id: number;
  subject: string;
  project_id?: number;
  project_name?: string;
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
  created_at: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ThreadsResponse {
  threads: MessageThread[];
  total: number;
}

export interface MessagesResponse {
  messages: Message[];
  total: number;
  thread: MessageThread;
}

export interface SendMessageRequest {
  content: string;
  attachments?: File[];
}

export interface SendMessageResponse {
  message: Message;
  success: boolean;
}

export interface UpdateMessageRequest {
  content: string;
}

export interface UpdateMessageResponse {
  message: Message;
  success: boolean;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface PortalMessagesProps extends PortalViewProps {}
