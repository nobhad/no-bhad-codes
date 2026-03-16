import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  MoreHorizontal,
  User,
  Users,
  Inbox,
  Star
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { formatTimeAgo } from '@/utils/time-utils';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPost, apiPut } from '@/utils/api-client';
import { formatErrorMessage } from '@/utils/error-utils';
import { EmptyState, MessageThread } from '@react/factories';
import { FilterDropdown } from '@react/components/portal/TableFilters';
import type { FilterSection } from '@react/components/portal/TableFilters';

const logger = createLogger('MessageView');

interface Message {
  id: number;
  content: string;
  senderName: string;
  senderType: 'admin' | 'client';
  /** ISO timestamp — server returns this as `createdAt` */
  createdAt: string;
  isRead?: number;
  isEdited?: boolean;
  reactions?: Array<{ emoji: string; count: number; reacted: boolean }>;
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
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({});

  const statusFilter = filterValues.status ?? [];
  const filter = (statusFilter.length === 1 ? statusFilter[0] : 'all') as 'all' | 'unread' | 'starred' | 'archived';

  const filterSections: FilterSection[] = useMemo(() => [
    {
      key: 'status',
      label: 'STATUS',
      options: [
        { value: 'all', label: 'All' },
        { value: 'unread', label: 'Unread' },
        { value: 'starred', label: 'Starred' },
        { value: 'archived', label: 'Archived' }
      ]
    }
  ], []);

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
      setError(formatErrorMessage(err, 'Failed to load conversations'));
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

  const handleEdit = useCallback(async (messageId: number, content: string): Promise<boolean> => {
    try {
      const response = await apiPut(buildEndpoint.messageItem(messageId), { message: content });
      if (!response.ok) return false;
      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, content, isEdited: true } : m)
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleReact = useCallback(async (messageId: number, emoji: string): Promise<boolean> => {
    try {
      const response = await apiPost(buildEndpoint.messageReactions(messageId), { emoji });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

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
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">
      <div className="panel messaging-panel-container">
        {/* Title + search bar above both columns */}
        <div className="data-table-header messaging-top-bar">
          <h3>
            Messages
            {totalUnread > 0 && (
              <span className="badge ml-2">
                {totalUnread}
              </span>
            )}
          </h3>
          <div className="data-table-actions">
            <div className="search-bar">
              <Search className="search-bar-icon" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-bar-input"
                aria-label="Search conversations"
              />
            </div>
          </div>
        </div>

        {/* Two-column area */}
        <div className="messaging-columns">
          {/* Conversation List */}
          <div className="messaging-sidebar">
            {/* Filter */}
            <div className="messaging-section-header">
              <FilterDropdown
                sections={filterSections}
                values={filterValues}
                onChange={(key, value) => setFilterValues(prev => {
                  if (value === 'all') return { ...prev, [key]: [] };
                  const current = prev[key] ?? [];
                  const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
                  return { ...prev, [key]: next };
                })}
              />
            </div>

            {/* Conversation List */}
            <div className="scroll-container flex-1">
              {isLoading ? (
                <div className="loading-state">Loading conversations...</div>
              ) : filteredConversations.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="messaging-icon-lg" />}
                  message="No conversations"
                />
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
                          <span className="messaging-conv-time">
                            {conv.lastMessageAt ? formatTimeAgo(conv.lastMessageAt) : ''}
                          </span>
                        </div>
                        {conv.projectName && (
                          <span className="messaging-conv-project">
                            {conv.projectName}
                          </span>
                        )}
                        {conv.lastMessage && (
                          <p className={cn('messaging-conv-preview', conv.unreadCount > 0 && 'messaging-conv-preview-unread')}>
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
                      className={cn('icon-btn', selectedConversation.isStarred && 'is-active')}
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
                    timestamp: m.createdAt,
                    readReceipt: m.isRead ? 'read' : 'sent',
                    isEdited: m.isEdited,
                    reactions: m.reactions
                  }))}
                  isLoading={messagesLoading}
                  onSend={handleSend}
                  onEdit={handleEdit}
                  onReact={handleReact}
                  showNotification={showNotification}
                  className="messaging-main-area-thread"
                />
              </>
            ) : (
              <EmptyState
                icon={<Users className="messaging-icon-xl" />}
                message="Select a conversation"
                className="messaging-empty-state-full"
              >
                <p>Choose a conversation from the list to view messages</p>
              </EmptyState>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessageView;
