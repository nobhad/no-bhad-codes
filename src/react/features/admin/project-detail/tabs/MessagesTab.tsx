import * as React from 'react';
import { useEffect, useMemo } from 'react';
import { MessageThread, type ThreadMessage } from '@react/factories';
import type { Message, MessageReaction } from '../../types';

interface MessagesTabProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string) => Promise<boolean>;
  onLoadMessages: () => Promise<void>;
  onEditMessage: (messageId: number, content: string) => Promise<boolean>;
  reactions: Record<number, MessageReaction[]>;
  onToggleReaction: (messageId: number, emoji: string) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * MessagesTab
 * Thin data-mapping wrapper around the MessageThread factory.
 * Maps admin Message (snake_case DB fields) → ThreadMessage (factory shape).
 */
export function MessagesTab({
  messages,
  isLoading,
  onSendMessage,
  onLoadMessages,
  onEditMessage,
  reactions,
  onToggleReaction,
  showNotification
}: MessagesTabProps) {
  useEffect(() => {
    onLoadMessages();
  }, [onLoadMessages]);

  const threadMessages = useMemo<ThreadMessage[]>(
    () =>
      messages.map((m) => ({
        id: m.id,
        content: m.content,
        isOwn: m.sender_type === 'admin',
        senderName: m.sender_name,
        timestamp: m.created_at,
        isEdited: !!m.edited_at,
        readReceipt: m.is_read ? 'read' : 'sent',
        reactions: reactions[m.id] || []
      })),
    [messages, reactions]
  );

  return (
    <div className="panel">
      <MessageThread
        messages={threadMessages}
        isLoading={isLoading}
        onSend={onSendMessage}
        onEdit={onEditMessage}
        onReact={onToggleReaction}
        showNotification={showNotification}
      />
    </div>
  );
}
