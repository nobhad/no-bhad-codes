/**
 * PortalMessagesView
 * Main messages component with thread list and message view
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  MessageSquare,
  ChevronRight,
  Inbox
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter } from '@react/components/portal/TableFilters';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { GSAP } from '@react/config/portal-constants';
import { usePortalMessages } from './usePortalMessages';
import { MessageThread } from './MessageThread';
import { useEventSource } from '@react/hooks/useEventSource';
import { TIMING } from '@/constants/timing';
import type { PortalMessagesProps, MessageThread as MessageThreadType } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const UNREAD_BADGE_MAX = 99;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatThreadTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

}

function truncatePreview(text: string, maxLength: number = 60): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()  }...`;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ThreadListItemProps {
  thread: MessageThreadType;
  isSelected: boolean;
  onClick: () => void;
}

const ThreadListItem = React.memo(({ thread, isSelected, onClick }: ThreadListItemProps) => {
  const hasUnread = thread.unread_count > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('list-item message-thread-item', isSelected && 'table-row-selected')}
    >
      {/* Icon */}
      <div className={hasUnread ? 'text-primary' : ''}>
        <MessageSquare className="icon-xs" />
      </div>

      {/* Content */}
      <div className="message-thread-content">
        <div className="message-thread-row">
          <span className="text-primary ">{decodeHtmlEntities(thread.subject)}</span>
          <span className="text-muted text-xs message-timestamp">
            {formatThreadTime(thread.last_message_at)}
          </span>
        </div>

        {thread.project_name && (
          <span className="text-muted text-xs">{decodeHtmlEntities(thread.project_name)}</span>
        )}

        <div className="message-thread-preview-row">
          <span className={cn(hasUnread ? 'text-primary' : 'text-muted', 'text-sm')}>
            {truncatePreview(decodeHtmlEntities(thread.last_message_preview))}
          </span>

          {hasUnread && (
            <span className="badge text-xs">
              {thread.unread_count > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : thread.unread_count}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="icon-xs" />
    </button>
  );
});

interface ThreadListProps {
  threads: MessageThreadType[];
  selectedThread: MessageThreadType | null;
  loading: boolean;
  error: string | null;
  onSelectThread: (thread: MessageThreadType) => void;
  onRefresh: () => void;
}

function ThreadList({
  threads,
  selectedThread,
  loading,
  error,
  onSelectThread,
  onRefresh
}: ThreadListProps) {
  const listRef = useStaggerChildren<HTMLDivElement>(GSAP.STAGGER_DEFAULT);

  // Loading state
  if (loading && threads.length === 0) {
    return <LoadingState message="Loading messages..." />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} />;
  }

  // Empty state
  if (threads.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="icon-lg" />}
        message="No messages yet. New conversations will appear here."
      />
    );
  }

  return (
    <div ref={listRef} className="message-thread-list">
      {threads.map((thread) => (
        <ThreadListItem
          key={thread.id}
          thread={thread}
          isSelected={selectedThread?.id === thread.id}
          onClick={() => onSelectThread(thread)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * PortalMessagesView Component
 * Main entry point for the portal messages feature
 */
export function PortalMessagesView({
  getAuthToken,
  showNotification
}: PortalMessagesProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const {
    threads,
    selectedThread,
    threadsLoading,
    threadsError,
    messages,
    messagesLoading,
    messagesError,
    selectThread,
    refreshThreads,
    refreshMessages,
    sendMessage,
    editMessage,
    deleteMessage
  } = usePortalMessages({ getAuthToken });

  // Typing indicator state
  const [typingUser, setTypingUser] = React.useState<string | null>(null);
  const typingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // SSE for real-time updates
  useEventSource({
    onNewMessage: React.useCallback((data: { threadId: number }) => {
      // If the message is for the currently viewed thread, refresh
      if (selectedThread && data.threadId === selectedThread.id) {
        refreshMessages();
      }
      // Always refresh thread list to update previews/unread counts
      refreshThreads();
    }, [selectedThread, refreshMessages, refreshThreads]),

    onTyping: React.useCallback((data: { threadId: number; isTyping: boolean; senderName: string }) => {
      // Only show typing for the active thread from the other party
      if (!selectedThread || data.threadId !== selectedThread.id) return;

      if (data.isTyping) {
        setTypingUser(data.senderName);
        // Auto-clear after timeout
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

  // Search filter for threads
  const [searchQuery, setSearchQuery] = React.useState('');

  // Filter threads by search
  const filteredThreads = React.useMemo(() => {
    if (!searchQuery) return threads;
    const s = searchQuery.toLowerCase();
    return threads.filter(
      (t) =>
        t.subject?.toLowerCase().includes(s) ||
        t.project_name?.toLowerCase().includes(s) ||
        t.last_message_preview?.toLowerCase().includes(s)
    );
  }, [threads, searchQuery]);

  // Track if we're viewing a thread (for mobile layout)
  const [viewingThread, setViewingThread] = useState(false);

  const handleSelectThread = useCallback((thread: MessageThreadType) => {
    selectThread(thread);
    setViewingThread(true);
  }, [selectThread]);

  const handleBackToList = useCallback(() => {
    setViewingThread(false);
  }, []);

  // Auto-select when there's exactly one thread (client portal has one thread per project)
  useEffect(() => {
    if (!threadsLoading && threads.length === 1 && !selectedThread) {
      handleSelectThread(threads[0]);
    }
  }, [threadsLoading, threads, selectedThread, handleSelectThread]);

  // Thread detail view
  if (viewingThread && selectedThread) {
    return (
      <div ref={containerRef} className="section">
        <MessageThread
          thread={selectedThread}
          messages={messages}
          loading={messagesLoading}
          error={messagesError}
          typingUser={typingUser}
          onBack={handleBackToList}
          onRefresh={refreshMessages}
          onSendMessage={sendMessage}
          onEditMessage={editMessage}
          onDeleteMessage={deleteMessage}
          showNotification={showNotification}
        />
      </div>
    );
  }

  // Thread list view
  return (
    <TableLayout
      containerRef={containerRef}
      title="MESSAGES"
      stats={<TableStats items={[{ value: threads.length, label: 'total' }]} />}
      actions={
        <>
          <SearchFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search messages..." />
          <IconButton action="refresh" onClick={refreshThreads} loading={threadsLoading} title="Refresh" />
        </>
      }
    >
      <ThreadList
        threads={filteredThreads}
        selectedThread={selectedThread}
        loading={threadsLoading}
        error={threadsError}
        onSelectThread={handleSelectThread}
        onRefresh={refreshThreads}
      />
    </TableLayout>
  );
}
