import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Send,
  Paperclip,
  MoreHorizontal,
  Check,
  CheckCheck,
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
import { KEYS } from '@/constants/keyboard';
import { unwrapApiData } from '@/utils/api-client';

const logger = createLogger('MessagingView');

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

interface MessagingViewProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Default page size for pagination (used in overview tabs) */
  defaultPageSize?: number;
}

export function MessagingView({ getAuthToken, showNotification, onNavigate, defaultPageSize: _defaultPageSize = 25 }: MessagingViewProps) {
  const containerRef = useFadeIn();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build headers helper with auth token
  const getHeaders = useCallback((contentType = true) => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {};
    if (contentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred' | 'archived'>('all');

  const loadConversations = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.MESSAGES_CONVERSATIONS, {
        method: 'GET',
        headers: getHeaders(false),
        credentials: 'include',
        signal
      });
      if (!response.ok) throw new Error('Failed to load conversations');

      const data = unwrapApiData<Record<string, unknown>>(await response.json());
      setConversations((data.conversations as Conversation[]) || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  const loadMessages = useCallback(async (conversationId: number, signal?: AbortSignal) => {
    setMessagesLoading(true);

    try {
      const response = await fetch(buildEndpoint.adminConversation(conversationId), {
        method: 'GET',
        headers: getHeaders(false),
        credentials: 'include',
        signal
      });
      if (!response.ok) throw new Error('Failed to load messages');

      const data = unwrapApiData<Record<string, unknown>>(await response.json());
      setMessages((data.messages as Message[]) || []);

      // Mark as read
      await fetch(buildEndpoint.adminConversationRead(conversationId), {
        method: 'POST',
        headers: getHeaders(false),
        credentials: 'include',
        signal
      });

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      logger.error('Failed to load messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, [getHeaders]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    const messageContent = newMessage;
    setNewMessage('');

    try {
      const response = await fetch(
        `/api/admin/messages/conversations/${selectedConversation.id}/messages`,
        {
          method: 'POST',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify({ content: messageContent })
        }
      );

      if (!response.ok) throw new Error('Failed to send message');

      const data = unwrapApiData<Record<string, unknown>>(await response.json());
      setMessages((prev) => [...prev, data.message as Message]);

      // Update conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? { ...c, lastMessage: messageContent, lastMessageAt: new Date().toISOString() }
            : c
        )
      );
      showNotification?.('Message sent', 'success');
    } catch (err) {
      logger.error('Failed to send message:', err);
      setNewMessage(messageContent); // Restore message on error
      showNotification?.('Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedConversation, getHeaders, showNotification]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  const toggleStar = useCallback(async (conversationId: number, isStarred: boolean) => {
    try {
      await fetch(buildEndpoint.adminConversationStar(conversationId), {
        method: isStarred ? 'DELETE' : 'POST',
        headers: getHeaders(false),
        credentials: 'include'
      });

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, isStarred: !isStarred } : c))
      );
    } catch (err) {
      logger.error('Failed to toggle star:', err);
    }
  }, [getHeaders]);

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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !conv.clientName.toLowerCase().includes(query) &&
        !conv.projectName?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Status filter
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

          {/* Search */}
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
                        {conv.lastMessageAt ? formatRelativeTime(conv.lastMessageAt) : ''}
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

            {/* Messages */}
            <div className="scroll-container messaging-messages-container">
              {messagesLoading ? (
                <div className="loading-state">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="empty-state h-full">
                  <Inbox className="icon-xl" />
                  <span>No messages yet. Start the conversation!</span>
                </div>
              ) : (
                <div className="messaging-messages-list">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'messaging-message-row',
                        message.senderType === 'admin' ? 'messaging-message-row-admin' : 'messaging-message-row-client'
                      )}
                    >
                      {message.senderType === 'client' && (
                        <div className="messaging-avatar messaging-avatar-sm">
                          <User className="messaging-avatar-icon-sm text-muted" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'messaging-message-bubble',
                          message.senderType === 'admin' ? 'messaging-message-bubble-admin' : 'messaging-message-bubble-client'
                        )}
                      >
                        <p className="messaging-message-content">{message.content}</p>
                        <div
                          className={cn(
                            'messaging-message-meta',
                            message.senderType === 'admin' ? 'messaging-message-meta-admin' : 'messaging-message-meta-client'
                          )}
                        >
                          <span>{formatTime(message.timestamp)}</span>
                          {message.senderType === 'admin' && (
                            <span>
                              {message.status === 'read' ? (
                                <CheckCheck className="messaging-status-icon" />
                              ) : message.status === 'delivered' ? (
                                <CheckCheck className="messaging-status-icon" />
                              ) : (
                                <Check className="messaging-status-icon" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="messaging-compose">
              <div className="messaging-compose-row">
                <button className="icon-btn" aria-label="Attach file">
                  <Paperclip className="messaging-attachment-icon" />
                </button>
                <div className="messaging-compose-input-container">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === KEYS.ENTER && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="textarea messaging-compose-textarea"
                    aria-label="Message"
                  />
                </div>
                <button
                  className="btn-primary messaging-compose-send-btn"
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  aria-label="Send message"
                >
                  <Send className="messaging-send-icon" />
                </button>
              </div>
            </div>
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
  );
}

function formatRelativeTime(timestamp: string): string {
  return formatTimeAgo(timestamp);
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export default MessagingView;
