/**
 * PortalMessagesView
 * Main messages component with thread list and message view
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  MessageSquare,
  RefreshCw,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { usePortalMessages } from './usePortalMessages';
import { MessageThread } from './MessageThread';
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
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function truncatePreview(text: string, maxLength: number = 60): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ThreadListItemProps {
  thread: MessageThreadType;
  isSelected: boolean;
  onClick: () => void;
}

function ThreadListItem({ thread, isSelected, onClick }: ThreadListItemProps) {
  const hasUnread = thread.unread_count > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('tw-list-item', isSelected && 'tw-table-row-selected')}
      style={{ borderBottom: '1px solid var(--portal-border-subtle)' }}
    >
      {/* Icon */}
      <div className={hasUnread ? 'tw-text-primary' : 'tw-text-muted'}>
        <MessageSquare className="tw-h-4 tw-w-4" />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span className="tw-text-primary" style={{ fontSize: '14px' }}>{thread.subject}</span>
          <span className="tw-text-muted" style={{ fontSize: '11px', flexShrink: 0 }}>
            {formatThreadTime(thread.last_message_at)}
          </span>
        </div>

        {thread.project_name && (
          <span className="tw-text-muted" style={{ fontSize: '11px' }}>{thread.project_name}</span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.125rem' }}>
          <span className={hasUnread ? 'tw-text-primary' : 'tw-text-muted'} style={{ fontSize: '12px' }}>
            {truncatePreview(thread.last_message_preview)}
          </span>

          {hasUnread && (
            <span className="tw-badge" style={{ fontSize: '11px' }}>
              {thread.unread_count > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : thread.unread_count}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="tw-h-4 tw-w-4 tw-text-muted" />
    </button>
  );
}

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
  onRefresh,
}: ThreadListProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(0.05);

  // Loading state
  if (loading && threads.length === 0) {
    return (
      <div className="tw-loading">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading messages...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tw-error">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="tw-btn-secondary" onClick={onRefresh}>Retry</button>
      </div>
    );
  }

  // Empty state
  if (threads.length === 0) {
    return (
      <div ref={containerRef} className="tw-empty-state">
        <Inbox className="tw-h-6 tw-w-6" />
        <p>No messages yet</p>
        <p style={{ fontSize: '12px' }}>New conversations will appear here</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tw-section">
      {/* Header with refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="tw-divider">
        <h3 className="tw-section-title">Messages</h3>
        <button className="tw-btn-icon" onClick={onRefresh} title="Refresh">
          <RefreshCw className={cn('tw-h-4 tw-w-4', loading && 'tw-animate-spin')} />
        </button>
      </div>

      {/* Thread list */}
      <div ref={listRef} className="tw-section" style={{ gap: 0 }}>
        {threads.map((thread) => (
          <ThreadListItem
            key={thread.id}
            thread={thread}
            isSelected={selectedThread?.id === thread.id}
            onClick={() => onSelectThread(thread)}
          />
        ))}
      </div>
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
  showNotification,
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
    deleteMessage,
  } = usePortalMessages({ getAuthToken });

  // Track if we're viewing a thread (for mobile layout)
  const [viewingThread, setViewingThread] = useState(false);

  const handleSelectThread = useCallback((thread: MessageThreadType) => {
    selectThread(thread);
    setViewingThread(true);
  }, [selectThread]);

  const handleBackToList = useCallback(() => {
    setViewingThread(false);
  }, []);

  return (
    <div ref={containerRef} className="tw-flex tw-flex-col tw-h-full tw-min-h-[400px]">
      {/* Thread View (when a thread is selected) */}
      {viewingThread && selectedThread ? (
        <MessageThread
          thread={selectedThread}
          messages={messages}
          loading={messagesLoading}
          error={messagesError}
          onBack={handleBackToList}
          onRefresh={refreshMessages}
          onSendMessage={sendMessage}
          onEditMessage={editMessage}
          onDeleteMessage={deleteMessage}
          showNotification={showNotification}
        />
      ) : (
        /* Thread List */
        <ThreadList
          threads={threads}
          selectedThread={selectedThread}
          loading={threadsLoading}
          error={threadsError}
          onSelectThread={handleSelectThread}
          onRefresh={refreshThreads}
        />
      )}
    </div>
  );
}
