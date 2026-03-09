import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  MoreHorizontal,
  Clock,
  User,
  Users,
  Inbox,
  Archive,
  Star
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { formatTimeAgo } from '@/utils/time-utils';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPost } from '@/utils/api-client';
import { MessageThread } from '@react/factories';

const logger = createLogger('MessageView');

interface Message {
  id: number;
  content: string;
  senderId: number;
  senderName: string;
  senderType: 'admin' | 'client';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  attachments?: { id: number; name: string; url: string }[];
}

interface Conversation {
  id: number;
  clientId: number;
  clientName: string;
  clientEmail: string;
  projectId?: number;
  projectName?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  isStarred: boolean;
  isArchived: boolean;
}

interface MessageViewProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Default page size for pagination (used in overview tabs) */
  defaultPageSize?: number;
}

export function MessageView({ getAuthToken: _getAuthToken, showNotification, onNavigate, defaultPageSize: _defaultPageSize = 25 }: MessageViewProps) {
  const containerRef = useFadeIn();

  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred' | 'archived'>('all');

  const loadConversations = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch(API_ENDPOINTS.ADMIN.MESSAGES_CONVERSATIONS, { signal });
      if (!response.ok) throw new Error('Failed to load conversations');

      const data = unwrapApiData<Record<string, unknown>>(await response.json());
      setConversations((data.conversations as Conversation[]) || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: number, signal?: AbortSignal) => {
    setMessagesLoading(true);

    try {
      const response = await apiFetch(buildEndpoint.adminConversation(conversationId), { signal });
      if (!response.ok) throw new Error('Failed to load messages');

      const data = unwrapApiData<Record<string, unknown>>(await response.json());
      setMessages((data.messages as Message[]) || []);

      // Mark as read
      await apiPost(buildEndpoint.adminConversationRead(conversationId));

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      logger.error('Failed to load messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const handleSend = useCallback(async (content: string): Promise<boolean> => {
    if (!selectedConversation) return false;
    try {
      const response = await apiPost(
        buildEndpoint.adminConversationMessages(selectedConversation.id),
        { content }
      );
      if (!response.ok) return false;
      const data = unwrapApiData<Record<string, unknown>>(await response.json());
      setMessages((prev) => [...prev, data.message as Message]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? { ...c, lastMessage: content, lastMessageAt: new Date().toISOString() }
            : c
        )
      );
      return true;
    } catch {
      return false;
    }
  }, [selectedConversation]);

  const toggleStar = useCallback(async (conversationId: number, isStarred: boolean) => {
    try {
      await apiFetch(buildEndpoint.adminConversationStar(conversationId), {
        method: isStarred ? 'DELETE' : 'POST'
      });

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, isStarred: !isStarred } : c))
      );
    } catch (err) {
      logger.error('Failed to toggle star:', err);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadConversations(controller.signal);
    return () => controller.abort();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConversation) {
      const controller = new AbortController();
      loadMessages(selectedConversation.id, controller.signal);
      return () => controller.abort();
    }
  }, [selectedConversation, loadMessages]);

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !conv.clientName.toLowerCase().includes(query) &&
        !conv.projectName?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    switch (filter) {
    case 'unread':
      return conv.unreadCount > 0;
    case 'starred':
      return conv.isStarred;
    case 'archived':
      return conv.isArchived;
    default:
      return !conv.isArchived;
    }
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="panel messaging-panel-container"
    >
      {/* Full-width search top bar */}
      <div className="messaging-top-bar">
        <div className="messaging-search-container">
          <Search className="messaging-search-icon" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input messaging-search-input"
            aria-label="Search conversations"
          />
        </div>
      </div>

      {/* Two-column area */}
      <div className="messaging-columns">
        {/* Conversation List */}
        <div className="messaging-sidebar">
          {/* Header */}
          <div className="messaging-section-header">
            <h2 className="heading messaging-heading-with-badge">
              Messages
              {totalUnread > 0 && (
                <span className="badge ml-2">
                  {totalUnread}
                </span>
              )}
            </h2>

            {/* Filter Tabs */}
            <div className="tab-list messaging-filter-tabs">
              {[
                { id: 'all', label: 'All', icon: Inbox },
                { id: 'unread', label: 'Unread', icon: Clock },
                { id: 'starred', label: 'Starred', icon: Star },
                { id: 'archived', label: 'Archived', icon: Archive }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as typeof filter)}
                  className={cn(
                    filter === tab.id ? 'tab-active' : 'tab',
                    'messaging-filter-tab'
                  )}
                >
                  <tab.icon className="messaging-filter-tab-icon" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="scroll-container flex-1">
            {isLoading ? (
              <div className="loading-state">Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="empty-state">
                <Inbox className="messaging-icon-lg" />
                <p>No conversations</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={cn(
                    'list-item',
                    selectedConversation?.id === conv.id && 'table-row-selected'
                  )}
                >
                  <div className="messaging-conv-item-content">
                    <div className="messaging-avatar">
                      <User className="messaging-avatar-icon" />
                    </div>
                    <div className="messaging-conv-item-details">
                      <div className="messaging-conv-item-header">
                        <span className={cn('messaging-conv-name', conv.unreadCount > 0 && 'messaging-conv-name-unread')}>
                          {conv.clientName}
                        </span>
                        <span className="text-muted messaging-conv-time">
                          {conv.lastMessageAt ? formatTimeAgo(conv.lastMessageAt) : ''}
                        </span>
                      </div>
                      {conv.projectName && (
                        <span className="text-muted messaging-conv-project">
                          {conv.projectName}
                        </span>
                      )}
                      {conv.lastMessage && (
                        <p className={cn('messaging-conv-preview', conv.unreadCount > 0 ? 'text-primary' : 'text-muted')}>
                          {conv.lastMessage}
                        </p>
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="badge">{conv.unreadCount}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Area */}
        <div className="messaging-main-area">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="messaging-conv-header">
                <div>
                  <h3 className="heading messaging-conv-heading">
                    {selectedConversation.clientName}
                  </h3>
                  {selectedConversation.projectName && (
                    <button
                      onClick={() => onNavigate?.('projects', selectedConversation.projectId != null ? String(selectedConversation.projectId) : undefined)}
                      className="btn-ghost messaging-conv-project-link"
                    >
                      {selectedConversation.projectName}
                    </button>
                  )}
                </div>
                <div className="messaging-conv-actions">
                  <button
                    onClick={() => toggleStar(selectedConversation.id, selectedConversation.isStarred)}
                    className={cn('icon-btn', selectedConversation.isStarred ? 'text-primary' : 'text-muted')}
                    aria-label={selectedConversation.isStarred ? 'Unstar conversation' : 'Star conversation'}
                  >
                    <Star
                      className="messaging-star-icon"
                      style={{ fill: selectedConversation.isStarred ? 'currentColor' : 'none' }}
                    />
                  </button>
                  <button className="icon-btn" aria-label="More actions">
                    <MoreHorizontal className="messaging-more-icon" />
                  </button>
                </div>
              </div>

              <MessageThread
                messages={messages.map((m) => ({
                  id: m.id,
                  content: m.content,
                  isOwn: m.senderType === 'admin',
                  senderName: m.senderName,
                  timestamp: m.timestamp,
                  readReceipt: m.status
                }))}
                isLoading={messagesLoading}
                onSend={handleSend}
                showNotification={showNotification}
                className="messaging-main-area-thread"
              />
            </>
          ) : (
            <div className="empty-state messaging-empty-state-full">
              <Users className="messaging-icon-xl" />
              <p className="messaging-empty-state-message">Select a conversation</p>
              <p className="text-muted">Choose a conversation from the list to view messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageView;
