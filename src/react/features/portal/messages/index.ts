/**
 * Portal Messages Feature
 * React components for the client portal messages
 */

// Main components
export { PortalMessagesView } from './PortalMessagesView';

// Hook
export { usePortalMessages } from './usePortalMessages';

// Types
export type {
  PortalMessagesProps,
  Message,
  MessageThread as MessageThreadType,
  MessageAttachment,
  ThreadsResponse,
  MessagesResponse,
  SendMessageRequest,
  SendMessageResponse,
  UpdateMessageRequest,
  UpdateMessageResponse
} from './types';
