/**
 * ===============================================
 * MESSAGE THREAD (REACT FACTORY)
 * ===============================================
 * @file src/react/factories/MessageThread.tsx
 *
 * Reusable message thread component for all admin messaging contexts.
 * Layout:
 *   - Sender name above first bubble in a group (other messages only)
 *   - Footer (timestamp + read receipt) below the bubble-row, outside
 *     msgtab-bubble-group so the Smile button centers on the bubble alone
 *   - Inline hover actions beside the bubble (Smile for reactions only)
 *   - Click own bubble to edit inline (no separate edit button)
 *   - Long-press bubble on mobile (pointer: coarse) to open reaction picker
 *   - Date separators between message days
 *   - Avatar spacer on continuation rows
 *   - Edit form replaces bubble inline; Esc cancels, Cmd+Enter saves
 *   - Reaction picker anchored above the Smile button via msgtab-reaction-anchor
 */

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { User, MessageSquare, CheckCheck, Smile, X, Check } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { LoadingState, EmptyState } from '@react/factories/StateDisplay';
import { KEYS } from '@/constants/keyboard';

// ============================================
// CONSTANTS
// ============================================

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

// ============================================
// PUBLIC TYPES
// ============================================

export interface ThreadMessage {
  id: number;
  content: string;
  /** Pre-computed by caller: true when the sender is "self" (admin in admin context) */
  isOwn: boolean;
  senderName?: string;
  timestamp: string;
  isEdited?: boolean;
  /** Read receipt status for own messages */
  readReceipt?: 'sent' | 'delivered' | 'read';
  /** Emoji reactions */
  reactions?: Array<{ emoji: string; count: number; reacted: boolean }>;
}

export interface MessageThreadProps {
  messages: ThreadMessage[];
  isLoading: boolean;
  onSend: (content: string) => Promise<boolean>;
  onReact?: (messageId: number, emoji: string) => Promise<boolean>;
  onEdit?: (messageId: number, content: string) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  className?: string;
}

// ============================================
// HELPERS
// ============================================

function formatMessageTime(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
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

function formatDateSeparator(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// ============================================
// COMPONENT
// ============================================

/**
 * MessageThread
 *
 * Drop-in thread UI for admin messaging contexts.
 * Manages compose state internally; caller owns data and send/edit/react logic.
 *
 * @example
 * <MessageThread
 *   messages={messages.map((m) => ({
 *     id: m.id,
 *     content: m.content,
 *     isOwn: m.senderType === 'admin',
 *     senderName: m.senderName,
 *     timestamp: m.timestamp,
 *     readReceipt: m.status,
 *   }))}
 *   isLoading={isLoading}
 *   onSend={handleSend}
 *   onEdit={handleEdit}
 *   onReact={handleReact}
 *   showNotification={showNotification}
 * />
 */
export function MessageThread({
  messages,
  isLoading,
  onSend,
  onReact,
  onEdit,
  showNotification,
  className
}: MessageThreadProps) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [pickerOpenId, setPickerOpenId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActivated = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close reaction picker on outside click
  useEffect(() => {
    if (pickerOpenId === null) return;
    const handleClick = () => setPickerOpenId(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pickerOpenId]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || isSending) return;
    setIsSending(true);
    const success = await onSend(content);
    setIsSending(false);
    if (success) {
      setDraft('');
      textareaRef.current?.focus();
    } else {
      showNotification?.('Failed to send message', 'error');
    }
  }, [draft, isSending, onSend, showNotification]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === KEYS.ENTER) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleStartEdit = useCallback((message: ThreadMessage) => {
    setEditingId(message.id);
    setEditContent(message.content);
    setPickerOpenId(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditContent('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (editingId === null || !editContent.trim() || !onEdit) return;
    setIsSavingEdit(true);
    const success = await onEdit(editingId, editContent.trim());
    setIsSavingEdit(false);
    if (success) {
      setEditingId(null);
      setEditContent('');
    } else {
      showNotification?.('Failed to save edit', 'error');
    }
  }, [editingId, editContent, onEdit, showNotification]);

  const handleReaction = useCallback(
    async (messageId: number, emoji: string) => {
      setPickerOpenId(null);
      if (!onReact) return;
      const success = await onReact(messageId, emoji);
      if (!success) {
        showNotification?.('Failed to add reaction', 'error');
      }
    },
    [onReact, showNotification]
  );

  const handleBubbleTouchStart = useCallback((messageId: number) => {
    longPressActivated.current = false;
    if (!onReact) return;
    longPressTimer.current = setTimeout(() => {
      longPressActivated.current = true;
      setPickerOpenId(messageId);
    }, 500);
  }, [onReact]);

  const handleBubbleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleBubbleClick = useCallback((message: ThreadMessage) => {
    if (longPressActivated.current) {
      longPressActivated.current = false;
      return;
    }
    if (message.isOwn && onEdit) {
      handleStartEdit(message);
    }
  }, [handleStartEdit, onEdit]);

  return (
    <div className={cn('msgtab-container panel', className)}>
      {/* Scroll area */}
      <div className="scroll-container msgtab-panel">
        {isLoading && messages.length === 0 ? (
          <LoadingState message="Loading messages..." />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="icon-lg" />}
            message="No messages yet. Start a conversation."
          />
        ) : (
          <div className="msgtab-thread">
            {messages.map((message, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showDateSep = !prevMessage || !isSameDay(prevMessage.timestamp, message.timestamp);
              const isContinuation =
                !showDateSep &&
                prevMessage &&
                prevMessage.isOwn === message.isOwn;

              const isEditing = editingId === message.id;

              return (
                <React.Fragment key={message.id}>
                  {/* Date separator */}
                  {showDateSep && (
                    <div
                      className="msgtab-date-sep"
                      aria-label={formatDateSeparator(message.timestamp)}
                    >
                      <span className="msgtab-date-label">
                        {formatDateSeparator(message.timestamp)}
                      </span>
                    </div>
                  )}

                  <div
                    className={cn(
                      'msgtab-row',
                      message.isOwn && 'is-admin',
                      isContinuation && 'is-continuation'
                    )}
                  >
                    {/* Avatar or spacer */}
                    {!isContinuation ? (
                      <div
                        className={cn('msgtab-avatar', message.isOwn ? 'is-admin' : 'is-client')}
                        aria-hidden="true"
                      >
                        {!message.isOwn && <User className="icon-md" />}
                      </div>
                    ) : (
                      <div className="msgtab-avatar-spacer" aria-hidden="true" />
                    )}

                    {/* Content wrap */}
                    <div className={cn('msgtab-content-wrap', message.isOwn && 'is-admin')}>
                      {/* Sender name — other messages, first in group */}
                      {!message.isOwn && !isContinuation && (
                        <span className="msgtab-sender">
                          {message.senderName ?? 'Client'}
                        </span>
                      )}

                      {/* Bubble row: [inline actions] + [bubble-group] */}
                      <div className="msgtab-bubble-row">
                        {/* Inline hover actions — always in flow, hidden until hover */}
                        {!isEditing && (
                          <div className="msgtab-inline-actions">
                            {onReact && (
                              <div className="msgtab-reaction-anchor">
                                <button
                                  className="icon-btn message-action-btn"
                                  aria-label="Add reaction"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPickerOpenId(pickerOpenId === message.id ? null : message.id);
                                  }}
                                >
                                  <Smile className="icon-sm" />
                                </button>
                                {/* Reaction picker — anchored above the Smile button */}
                                <div
                                  className={cn('reaction-picker', pickerOpenId !== message.id && 'hidden')}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleReaction(message.id, emoji)}
                                      aria-label={`React with ${emoji}`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bubble group: bubble only (footer is outside so Smile centers on bubble) */}
                        <div className="msgtab-bubble-group">
                          {isEditing ? (
                            <div className="message-edit-form">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === KEYS.ESCAPE) handleCancelEdit();
                                  if ((e.metaKey || e.ctrlKey) && e.key === KEYS.ENTER) {
                                    e.preventDefault();
                                    handleSaveEdit();
                                  }
                                }}
                                className="textarea message-edit-textarea"
                                rows={2}
                                autoFocus
                                aria-label="Edit message"
                              />
                              <div className="message-edit-actions">
                                <button
                                  className="icon-btn message-action-btn"
                                  onClick={handleCancelEdit}
                                  aria-label="Cancel edit"
                                >
                                  <X className="icon-sm" />
                                </button>
                                <button
                                  className="icon-btn message-action-btn"
                                  onClick={handleSaveEdit}
                                  disabled={isSavingEdit || !editContent.trim()}
                                  aria-label="Save edit"
                                >
                                  <Check className="icon-sm" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={cn('msgtab-bubble', message.isOwn ? 'is-admin' : 'is-client', message.isOwn && onEdit && 'is-editable')}
                              onClick={() => handleBubbleClick(message)}
                              onTouchStart={() => handleBubbleTouchStart(message.id)}
                              onTouchEnd={handleBubbleTouchEnd}
                              onTouchCancel={handleBubbleTouchEnd}
                              onContextMenu={(e) => e.preventDefault()}
                              role={message.isOwn && onEdit ? 'button' : undefined}
                              aria-label={message.isOwn && onEdit ? 'Click to edit message' : undefined}
                            >
                              <p className="msgtab-content">{message.content}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer: below bubble-row so Smile aligns with bubble only */}
                      {!isEditing && (
                        <div className={cn('msgtab-footer', message.isOwn && 'is-admin')}>
                          {message.isEdited && (
                            <span className="message-edited">(edited)</span>
                          )}
                          <span className="msgtab-time">
                            {formatMessageTime(message.timestamp)}
                          </span>
                          {message.isOwn && (
                            <span
                              className={cn(
                                'msgtab-receipt',
                                message.readReceipt === 'read' && 'is-read'
                              )}
                              aria-label={message.readReceipt ?? 'sent'}
                            >
                              <CheckCheck className="icon-xs" />
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reaction badges */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="message-reactions">
                          {message.reactions.map((r) => (
                            <button
                              key={r.emoji}
                              className={cn('reaction-badge', r.reacted && 'is-reacted')}
                              onClick={() => onReact?.(message.id, r.emoji)}
                              aria-label={`${r.emoji} ${r.count}`}
                            >
                              {r.emoji} {r.count}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Compose input */}
      <div className="msgtab-input-panel">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={2}
          className="textarea msgtab-textarea"
          aria-label="Message"
        />
        <PortalButton
          variant="primary"
          className="msgtab-send-btn"
          onClick={handleSend}
          disabled={!draft.trim() || isSending}
          loading={isSending}
        >
          Send Message
        </PortalButton>
        <div className="text-muted pd-hint">
          Press <kbd className="badge msgtab-kbd">Cmd+Enter</kbd> to send
        </div>
      </div>
    </div>
  );
}
