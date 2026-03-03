import * as React from 'react';
import { useCallback, useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, User, Clock } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import type { Message } from '../../types';

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
      showNotification?.('Failed to send message', 'error');
    }
  }, [newMessage, onSendMessage, showNotification]);

  // Handle keyboard shortcut (Ctrl/Cmd + Enter to send)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="tw-panel tw-flex tw-flex-col msgtab-container">
      {/* Messages List */}
      <div className="tw-flex-1 tw-overflow-y-auto tw-scroll-container msgtab-panel">
        {isLoading ? (
          <div className="loading-state">
            <span className="loading-spinner" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <MessageSquare className="icon-xl" />
            <span>No messages yet</span>
            <span className="tw-text-sm">Start a conversation with your client</span>
          </div>
        ) : (
          <div className="tw-flex tw-flex-col tw-gap-4">
            {messages.map((message) => {
              const isAdmin = message.sender_type === 'admin';

              return (
                <div
                  key={message.id}
                  className={cn(
                    'tw-flex tw-gap-3',
                    isAdmin && 'tw-flex-row-reverse'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'tw-w-8 tw-h-8 tw-flex tw-items-center tw-justify-center tw-flex-shrink-0 msgtab-avatar',
                      isAdmin
                        ? 'tw-bg-white'
                        : 'tw-bg-transparent tw-border tw-border-[var(--portal-border-color)]'
                    )}
                  >
                    <User className={cn('icon-md', isAdmin ? 'tw-text-black' : 'tw-text-primary')} />
                  </div>

                  {/* Message Content */}
                  <div
                    className={cn(
                      'tw-max-w-[70%] tw-flex tw-flex-col tw-gap-1',
                      isAdmin && 'tw-items-end'
                    )}
                  >
                    {/* Sender and Time */}
                    <div className="tw-flex tw-items-center tw-gap-2 tw-text-muted tw-text-sm">
                      <span>{message.sender_name || (isAdmin ? 'You' : 'Client')}</span>
                      <Clock className="icon-xs" />
                      <span>{formatMessageTime(message.created_at)}</span>
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={cn(
                        'tw-px-4 tw-py-2 msgtab-bubble',
                        isAdmin
                          ? 'tw-bg-white tw-text-black'
                          : 'tw-border tw-border-[var(--portal-border-color)] tw-text-primary'
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
      <div className="tw-border-t tw-border-[var(--portal-border-color)] tw-pt-4 msgtab-input-panel">
        <div className="tw-flex tw-gap-3">
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={2}
            className="tw-textarea tw-flex-1 msgtab-textarea"
          />
          <button
            className="btn-primary tw-self-end"
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
          >
            <Send className="icon-md" />
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
        <div className="tw-text-muted tw-mt-2 tw-text-sm">
          Press <kbd className="tw-badge msgtab-kbd">Cmd+Enter</kbd> to send
        </div>
      </div>
    </div>
  );
}
