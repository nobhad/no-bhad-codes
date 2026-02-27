import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
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
  Star,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderType: 'admin' | 'client';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  attachments?: { id: string; name: string; url: string }[];
}

interface Conversation {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  projectId?: string;
  projectName?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  isStarred: boolean;
  isArchived: boolean;
}

interface MessagingPanelProps {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function MessagingPanel({ onNavigate }: MessagingPanelProps) {
  const containerRef = useFadeIn();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred' | 'archived'>('all');

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadConversations() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/messages/conversations');
      if (!response.ok) throw new Error('Failed to load conversations');

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    setMessagesLoading(true);

    try {
      const response = await fetch(`/api/admin/messages/conversations/${conversationId}`);
      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      setMessages(data.messages || []);

      // Mark as read
      await fetch(`/api/admin/messages/conversations/${conversationId}/read`, {
        method: 'POST',
      });

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    const messageContent = newMessage;
    setNewMessage('');

    try {
      const response = await fetch(
        `/api/admin/messages/conversations/${selectedConversation.id}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: messageContent }),
        }
      );

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);

      // Update conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? { ...c, lastMessage: messageContent, lastMessageAt: new Date().toISOString() }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function toggleStar(conversationId: string, isStarred: boolean) {
    try {
      await fetch(`/api/admin/messages/conversations/${conversationId}/star`, {
        method: isStarred ? 'DELETE' : 'POST',
      });

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, isStarred: !isStarred } : c))
      );
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  }

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
      className="tw-panel"
      style={{ display: 'flex', height: 'calc(100vh - 200px)', minHeight: '500px', overflow: 'hidden' }}
    >
      {/* Conversation List */}
      <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid var(--portal-border-color)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--portal-border-color)' }}>
          <h2 className="tw-heading" style={{ fontSize: 'var(--font-size-base)', marginBottom: '0.75rem' }}>
            Messages
            {totalUnread > 0 && (
              <span className="tw-badge" style={{ marginLeft: '0.5rem' }}>
                {totalUnread}
              </span>
            )}
          </h2>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--portal-text-muted)' }} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tw-input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Filter Tabs */}
          <div className="tw-tab-list" style={{ marginTop: '0.75rem', borderBottom: 'none', gap: '0.25rem' }}>
            {[
              { id: 'all', label: 'All', icon: Inbox },
              { id: 'unread', label: 'Unread', icon: Clock },
              { id: 'starred', label: 'Starred', icon: Star },
              { id: 'archived', label: 'Archived', icon: Archive },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as typeof filter)}
                className={filter === tab.id ? 'tw-tab-active' : 'tw-tab'}
                style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-2xs)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <tab.icon style={{ width: '0.75rem', height: '0.75rem' }} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="tw-scroll-container" style={{ flex: 1 }}>
          {isLoading ? (
            <div className="tw-loading">Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="tw-empty-state">
              <Inbox style={{ width: '2rem', height: '2rem', opacity: 0.5 }} />
              <p>No conversations</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={cn(
                  'tw-list-item',
                  selectedConversation?.id === conv.id && 'tw-table-row-selected'
                )}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', width: '100%' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', border: '1px solid var(--portal-border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User style={{ width: '1.25rem', height: '1.25rem', color: 'var(--portal-text-muted)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontWeight: conv.unreadCount > 0 ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.clientName}
                      </span>
                      <span className="tw-text-muted" style={{ fontSize: 'var(--font-size-2xs)', flexShrink: 0 }}>
                        {conv.lastMessageAt ? formatRelativeTime(conv.lastMessageAt) : ''}
                      </span>
                    </div>
                    {conv.projectName && (
                      <span className="tw-text-muted" style={{ fontSize: 'var(--font-size-2xs)', display: 'block' }}>
                        {conv.projectName}
                      </span>
                    )}
                    {conv.lastMessage && (
                      <p
                        className={conv.unreadCount > 0 ? 'tw-text-primary' : 'tw-text-muted'}
                        style={{ fontSize: 'var(--font-size-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.25rem' }}
                      >
                        {conv.lastMessage}
                      </p>
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="tw-badge">{conv.unreadCount}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--portal-border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="tw-heading" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {selectedConversation.clientName}
                </h3>
                {selectedConversation.projectName && (
                  <button
                    onClick={() => onNavigate?.('projects', selectedConversation.projectId)}
                    className="tw-btn-ghost"
                    style={{ padding: 0, fontSize: 'var(--font-size-xs)' }}
                  >
                    {selectedConversation.projectName}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => toggleStar(selectedConversation.id, selectedConversation.isStarred)}
                  className="tw-btn-icon"
                  style={{ color: selectedConversation.isStarred ? 'var(--portal-text-light)' : 'var(--portal-text-muted)' }}
                >
                  <Star
                    style={{ width: '1rem', height: '1rem', fill: selectedConversation.isStarred ? 'currentColor' : 'none' }}
                  />
                </button>
                <button className="tw-btn-icon">
                  <MoreHorizontal style={{ width: '1rem', height: '1rem' }} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="tw-scroll-container" style={{ flex: 1, padding: '1rem' }}>
              {messagesLoading ? (
                <div className="tw-loading">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="tw-empty-state" style={{ height: '100%' }}>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      style={{ display: 'flex', gap: '0.75rem', justifyContent: message.senderType === 'admin' ? 'flex-end' : 'flex-start' }}
                    >
                      {message.senderType === 'client' && (
                        <div style={{ width: '2rem', height: '2rem', border: '1px solid var(--portal-border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User style={{ width: '1rem', height: '1rem', color: 'var(--portal-text-muted)' }} />
                        </div>
                      )}
                      <div
                        style={{
                          maxWidth: '70%',
                          padding: '0.5rem 1rem',
                          border: '1px solid var(--portal-border-color)',
                          background: message.senderType === 'admin' ? 'var(--portal-text-light)' : 'transparent',
                          color: message.senderType === 'admin' ? 'var(--portal-bg-dark)' : 'var(--portal-text-light)',
                        }}
                      >
                        <p style={{ fontSize: 'var(--font-size-sm)', whiteSpace: 'pre-wrap' }}>{message.content}</p>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '0.25rem',
                            marginTop: '0.25rem',
                            fontSize: 'var(--font-size-2xs)',
                            color: message.senderType === 'admin' ? 'var(--portal-text-dark)' : 'var(--portal-text-muted)',
                          }}
                        >
                          <span>{formatTime(message.timestamp)}</span>
                          {message.senderType === 'admin' && (
                            <span>
                              {message.status === 'read' ? (
                                <CheckCheck style={{ width: '0.75rem', height: '0.75rem' }} />
                              ) : message.status === 'delivered' ? (
                                <CheckCheck style={{ width: '0.75rem', height: '0.75rem' }} />
                              ) : (
                                <Check style={{ width: '0.75rem', height: '0.75rem' }} />
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
            <div style={{ padding: '1rem', borderTop: '1px solid var(--portal-border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                <button className="tw-btn-icon">
                  <Paperclip style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
                <div style={{ flex: 1 }}>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="tw-textarea"
                    style={{ minHeight: '40px', maxHeight: '120px' }}
                  />
                </div>
                <button
                  className="tw-btn-primary"
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  style={{ padding: '0.5rem' }}
                >
                  <Send style={{ width: '1rem', height: '1rem' }} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="tw-empty-state" style={{ flex: 1 }}>
            <Users style={{ width: '3rem', height: '3rem', opacity: 0.5 }} />
            <p style={{ fontSize: 'var(--font-size-base)' }}>Select a conversation</p>
            <p className="tw-text-muted">Choose a conversation from the list to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default MessagingPanel;
