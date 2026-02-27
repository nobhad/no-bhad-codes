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
    <div className="tw-flex tw-flex-col" style={{ height: '500px' }}>
      {/* Messages List */}
      <div className="tw-flex-1 tw-overflow-y-auto tw-scroll-container tw-panel" style={{ borderRadius: 0 }}>
        {isLoading ? (
          <div className="tw-loading">
            <div className="tw-animate-spin tw-h-6 tw-w-6 tw-border-2 tw-border-current tw-border-t-transparent" style={{ borderRadius: '50%' }} />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="tw-empty-state">
            <MessageSquare className="tw-h-8 tw-w-8 tw-mb-2" />
            <span>No messages yet</span>
            <span style={{ fontSize: '12px' }}>Start a conversation with your client</span>
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
                      'tw-w-8 tw-h-8 tw-flex tw-items-center tw-justify-center tw-flex-shrink-0',
                      isAdmin
                        ? 'tw-bg-white'
                        : 'tw-bg-transparent tw-border tw-border-[rgba(255,255,255,0.3)]'
                    )}
                    style={{ borderRadius: 0 }}
                  >
                    <User className={cn('tw-h-4 tw-w-4', isAdmin ? 'tw-text-black' : 'tw-text-white')} />
                  </div>

                  {/* Message Content */}
                  <div
                    className={cn(
                      'tw-max-w-[70%] tw-flex tw-flex-col tw-gap-1',
                      isAdmin && 'tw-items-end'
                    )}
                  >
                    {/* Sender and Time */}
                    <div className="tw-flex tw-items-center tw-gap-2 tw-text-muted" style={{ fontSize: '12px' }}>
                      <span>{message.sender_name || (isAdmin ? 'You' : 'Client')}</span>
                      <Clock className="tw-h-3 tw-w-3" />
                      <span>{formatMessageTime(message.created_at)}</span>
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={cn(
                        'tw-px-4 tw-py-2',
                        isAdmin
                          ? 'tw-bg-white tw-text-black'
                          : 'tw-border tw-border-[rgba(255,255,255,0.3)] tw-text-white'
                      )}
                      style={{ borderRadius: 0 }}
                    >
                      <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{message.content}</p>
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
      <div className="tw-panel" style={{ borderTop: '1px solid rgba(255,255,255,0.2)', borderRadius: 0 }}>
        <div className="tw-flex tw-gap-3">
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={2}
            className="tw-textarea tw-flex-1"
            style={{ minHeight: '60px' }}
          />
          <button
            className="tw-btn-primary tw-self-end"
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
          >
            <Send className="tw-h-4 tw-w-4" />
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
        <div className="tw-text-muted tw-mt-2" style={{ fontSize: '12px' }}>
          Press <kbd className="tw-badge" style={{ fontSize: '11px', padding: '2px 6px' }}>Cmd+Enter</kbd> to send
        </div>
      </div>
    </div>
  );
}
