/**
 * ===============================================
 * PORTAL MESSAGES - THREAD MANAGEMENT (DEPRECATED)
 * ===============================================
 * @file src/features/client/modules/portal-messages-threads.ts
 *
 * @deprecated All thread management is now handled by the React
 * portalMessages component. This file is retained as an empty
 * stub to avoid breaking any stale dynamic imports.
 */

/** Thread shape - kept for type compatibility */
export interface MessageThread {
  id: number;
  subject: string;
  project_name?: string;
  last_message_at: string;
  message_count: number;
  unread_count: number;
}
