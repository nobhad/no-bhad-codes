/**
 * PortalMessagesView
 * Thin wrapper around factory MessageThread for client portal.
 * Auto-selects the first thread and displays conversation directly —
 * no thread list, no back arrow.
 */

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { MessageThread, type ThreadMessage } from '@react/factories';
import type { MessageAttachment as FactoryAttachment } from '@react/factories/MessageThread';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { TableLayout } from '@react/components/portal/TableLayout';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePortalMessages } from './usePortalMessages';
import { useEventSource } from '@react/hooks/useEventSource';
import { TIMING } from '@/constants/timing';
import type { PortalMessagesProps, Message, MessageAttachment } from './types';

// ============================================================================
// HELPERS
// ============================================================================

/** Parse attachments from API (may be JSON string, array, or null) */
function parseAttachments(raw: Message['attachments']): MessageAttachment[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as MessageAttachment[];
    } catch {
      return [];
    }
  }
  return raw;
}

/** Map portal MessageAttachment (snake_case) → factory MessageAttachment (camelCase) */
function mapAttachments(attachments: MessageAttachment[]): FactoryAttachment[] {
  return attachments.map((a) => ({
    id: a.id,
    filename: a.filename,
    fileSize: a.file_size,
    fileType: a.file_type,
    downloadUrl: a.download_url
  }));
}

/** Map portal Message → factory ThreadMessage */
function mapMessage(m: Message): ThreadMessage {
  const attachments = parseAttachments(m.attachments);
  return {
    id: m.id,
    content: m.message || m.content || '',
    isOwn: m.sender_type === 'client',
    senderName: m.sender_name,
    timestamp: m.created_at,
    isEdited: !!(m.updated_at && m.updated_at !== m.created_at),
    readReceipt: m.read_at ? 'read' : 'sent',
    attachments: attachments.length > 0 ? mapAttachments(attachments) : undefined
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PortalMessagesView({
  getAuthToken,
  showNotification
}: PortalMessagesProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const {
    threads,
    selectedThread,
    threadsLoading,
    messages,
    messagesLoading,
    messagesError,
    selectThread,
    refreshThreads,
    refreshMessages,
    sendMessage,
    editMessage
  } = usePortalMessages({ getAuthToken });

  // Typing indicator state
  const [typingUser, setTypingUser] = React.useState<string | null>(null);
  const typingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // SSE for real-time updates
  useEventSource({
    onNewMessage: useCallback((data: { threadId: number }) => {
      if (selectedThread && data.threadId === selectedThread.id) {
        refreshMessages();
      }
      refreshThreads();
    }, [selectedThread, refreshMessages, refreshThreads]),

    onTyping: useCallback((data: { threadId: number; isTyping: boolean; senderName: string }) => {
      if (!selectedThread || data.threadId !== selectedThread.id) return;

      if (data.isTyping) {
        setTypingUser(data.senderName);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          setTypingUser(null);
        }, TIMING.SEARCH_DEBOUNCE * 10);
      } else {
        setTypingUser(null);
        if (typingTimerRef.current) {
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = null;
        }
      }
    }, [selectedThread])
  });

  // Auto-select first thread when threads load
  React.useEffect(() => {
    if (!threadsLoading && threads.length > 0 && !selectedThread) {
      selectThread(threads[0]);
    }
  }, [threadsLoading, threads, selectedThread, selectThread]);

  // Map portal messages → factory ThreadMessage[]
  const threadMessages = useMemo<ThreadMessage[]>(
    () => messages.map(mapMessage),
    [messages]
  );

  // Wrap sendMessage to match factory signature (content, files) => Promise<boolean>
  const handleSend = useCallback(
    async (content: string, attachments?: File[]): Promise<boolean> => {
      return sendMessage(content, attachments);
    },
    [sendMessage]
  );

  const threadTitle = 'Messages';

  // Loading threads
  if (threadsLoading && threads.length === 0) {
    return (
      <div ref={containerRef} className="section">
        <LoadingState message="Loading messages..." />
      </div>
    );
  }

  // Error loading threads
  if (messagesError && !selectedThread) {
    return (
      <div ref={containerRef} className="section">
        <ErrorState message={messagesError} onRetry={refreshThreads} />
      </div>
    );
  }

  // No threads at all
  if (!threadsLoading && threads.length === 0) {
    return (
      <TableLayout
        containerRef={containerRef}
        title="MESSAGES"
        actions={
          <IconButton action="refresh" onClick={refreshThreads} loading={threadsLoading} title="Refresh" />
        }
      >
        <EmptyState
          icon={<MessageSquare className="icon-lg" />}
          message="No messages yet. New conversations will appear here."
        />
      </TableLayout>
    );
  }

  // Show the conversation directly using factory MessageThread
  return (
    <TableLayout
      containerRef={containerRef}
      title={threadTitle}
      actions={
        <IconButton action="refresh" onClick={refreshMessages} loading={messagesLoading} title="Refresh" />
      }
    >
      {typingUser && (
        <div className="msgtab-typing-indicator">
          {typingUser} is typing...
        </div>
      )}
      <MessageThread
        messages={threadMessages}
        isLoading={messagesLoading}
        onSend={handleSend}
        onEdit={editMessage}
        showNotification={showNotification}
        attachmentsEnabled
      />
    </TableLayout>
  );
}
