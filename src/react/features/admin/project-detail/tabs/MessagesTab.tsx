import * as React from 'react';
import { useCallback, useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, User, Clock } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { EmptyState, LoadingState } from '@react/components/portal/EmptyState';
import { PortalButton } from '@react/components/portal/PortalButton';
import type { Message } from '../../types';
import { NOTIFICATIONS } from '@/constants/notifications';
import { KEYS } from '@/constants/keyboard';

interface MessagesTabProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string) => Promise<boolean>;
  onLoadMessages: () => Promise<void>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Format date/time for messages
 */
function formatMessageTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * MessagesTab
 * Thread-based messaging for project
 */
export function MessagesTab({
  messages,
  isLoading,
  onSendMessage,
  onLoadMessages,
  showNotification
}: MessagesTabProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load messages on mount
  useEffect(() => {
    onLoadMessages();
  }, [onLoadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!newMessage.trim()) return;

    setIsSending(true);
    const success = await onSendMessage(newMessage.trim());
    setIsSending(false);

    if (success) {
      setNewMessage('');
      textareaRef.current?.focus();
    } else {
      showNotification?.(NOTIFICATIONS.message.SEND_FAILED, 'error');
    }
  }, [newMessage, onSendMessage, showNotification]);

  // Handle keyboard shortcut (Ctrl/Cmd + Enter to send)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === KEYS.ENTER) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="panel msgtab-container">
      {/* Messages List */}
      <div className="scroll-container msgtab-panel">
        {isLoading ? (
          <LoadingState message="Loading messages..." />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="icon-lg" />}
            message="No messages yet. Start a conversation with your client."
          />
        ) : (
          <div className="msgtab-thread">
            {messages.map((message) => {
              const isAdmin = message.sender_type === 'admin';

              return (
                <div
                  key={message.id}
                  className={cn(
                    'msgtab-row',
                    isAdmin && 'is-admin'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'msgtab-avatar',
                      isAdmin ? 'is-admin' : 'is-client'
                    )}
                  >
                    <User
                      className={cn('icon-md', isAdmin && 'text-dark')}
                    />
                  </div>

                  {/* Message Content */}
                  <div
                    className={cn(
                      'msgtab-content-wrap',
                      isAdmin && 'is-admin'
                    )}
                  >
                    {/* Sender and Time */}
                    <div className="msgtab-meta text-muted">
                      <span>{message.sender_name || (isAdmin ? 'You' : 'Client')}</span>
                      <Clock className="icon-sm" />
                      <span>{formatMessageTime(message.created_at)}</span>
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={cn(
                        'msgtab-bubble',
                        isAdmin ? 'is-admin' : 'is-client'
                      )}
                    >
                      <p className="msgtab-content">{message.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="msgtab-input-panel">
        <div className="msgtab-input-row">
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={2}
            className="textarea msgtab-textarea"
            aria-label="Message"
          />
          <PortalButton
            className="msgtab-send-btn"
            onClick={handleSend}
            disabled={!newMessage.trim()}
            loading={isSending}
            icon={<Send className="icon-md" />}
          >
            Send
          </PortalButton>
        </div>
        <div className="text-muted pd-hint pd-mt-2">
          Press <kbd className="badge msgtab-kbd">Cmd+Enter</kbd> to send
        </div>
      </div>
    </div>
  );
}
