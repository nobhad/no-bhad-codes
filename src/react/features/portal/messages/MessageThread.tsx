/**
 * MessageThread
 * Single thread view with messages, composer, and actions
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Send,
  Pencil,
  Trash2,
  Check,
  File,
  MessageSquare
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { PortalButton } from '@react/components/portal/PortalButton';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { UI_LIMITS } from '@react/config/portal-constants';
import type { Message, MessageThread as MessageThreadType, MessageAttachment } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatMessageTime(dateString: string): string {
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Parse attachments which may be a JSON string, array, or null
 */
function parseAttachments(attachments: MessageAttachment[] | string | null): MessageAttachment[] {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments;
  if (typeof attachments === 'string') {
    try {
      const parsed = JSON.parse(attachments);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Render attachments section if present
 */
function renderAttachments(attachments: MessageAttachment[] | string | null): React.ReactNode {
  const parsedAttachments = parseAttachments(attachments);
  if (parsedAttachments.length === 0) return null;

  return (
    <div className="message-attachments-list">
      {parsedAttachments.map((attachment, index) => (
        <AttachmentPreview key={attachment.id || index} attachment={attachment} />
      ))}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface AttachmentPreviewProps {
  attachment: MessageAttachment;
}

function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const isImage = attachment.file_type.startsWith('image/');

  const handleDownload = () => {
    window.open(attachment.download_url, '_blank');
  };

  return (
    <div className="attachment-preview-item">
      {isImage ? (
        <img src={attachment.download_url} alt={attachment.filename} className="attachment-thumbnail" />
      ) : (
        <File className="icon-sm" />
      )}
      <div className="attachment-preview-info card-content-truncate">
        <div className="attachment-preview-name">{attachment.filename}</div>
        <div className="attachment-preview-size">{formatFileSize(attachment.file_size)}</div>
      </div>
      <IconButton action="download" onClick={handleDownload} title="Download" />
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onEdit: (messageId: number, content: string) => Promise<boolean>;
  onDelete: (messageId: number) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

function MessageBubble({ message, isOwn, onEdit, onDelete, showNotification }: MessageBubbleProps) {
  // Handle both 'message' (API) and 'content' (legacy) field names
  const messageContent = message.message || message.content || '';
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(messageContent);
  const [showActions, setShowActions] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const confirmDialog = useConfirmDialog();

  const handleStartEdit = useCallback(() => {
    setEditContent(messageContent);
    setIsEditing(true);
    setShowActions(false);
  }, [messageContent]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(messageContent);
  }, [messageContent]);

  const handleSaveEdit = useCallback(async () => {
    if (!editContent.trim() || editContent === messageContent) {
      handleCancelEdit();
      return;
    }

    const success = await onEdit(message.id, editContent.trim());
    if (success) {
      setIsEditing(false);
      showNotification?.('Message updated', 'success');
    } else {
      showNotification?.('Failed to update message', 'error');
    }
  }, [editContent, messageContent, message.id, onEdit, handleCancelEdit, showNotification]);

  const handleDelete = useCallback(async () => {
    const success = await onDelete(message.id);
    if (success) {
      showNotification?.('Message deleted', 'success');
    } else {
      showNotification?.('Failed to delete message', 'error');
    }
  }, [message.id, onDelete, showNotification]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [isEditing, editContent.length]);

  return (
    <div
      className={cn('message-bubble-container', isOwn ? 'own' : 'other')}
      onMouseEnter={() => isOwn && !isEditing && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Sender name for non-own messages */}
      {!isOwn && (
        <span className="message-sender-name">
          {decodeHtmlEntities(message.sender_name)}
        </span>
      )}

      <div className="message-row group">
        {/* Actions for own messages */}
        {isOwn && showActions && !isEditing && (
          <div className="message-bubble-actions">
            <PortalButton
              variant="ghost"
              size="icon"
              onClick={handleStartEdit}
              title="Edit"
              className="message-action-btn"
            >
              <Pencil className="icon-xs" />
            </PortalButton>
            <PortalButton
              variant="ghost"
              size="icon"
              onClick={confirmDialog.open}
              title="Delete"
              className="message-action-btn danger"
            >
              <Trash2 className="icon-xs" />
            </PortalButton>
          </div>
        )}

        {/* Message bubble */}
        <div className={cn('message-bubble', isOwn ? 'own' : 'other')}>
          {isEditing ? (
            <div className="message-edit-form">
              <textarea
                ref={editInputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="message-edit-textarea"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
              <div className="message-edit-actions">
                <PortalButton
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="message-edit-btn"
                >
                  Cancel
                </PortalButton>
                <PortalButton
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEdit}
                  className="message-edit-btn"
                >
                  <Check className="icon-xs" />
                  Save
                </PortalButton>
              </div>
            </div>
          ) : (
            <>
              <p className="message-bubble-text">
                {decodeHtmlEntities(messageContent)}
              </p>
              {renderAttachments(message.attachments)}
            </>
          )}
        </div>
      </div>

      {/* Time and edited indicator */}
      <div className="message-meta">
        <span className="message-time">
          {formatMessageTime(message.created_at)}
        </span>
        {message.updated_at && message.updated_at !== message.created_at && (
          <span className="message-edited">
            (edited)
          </span>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={confirmDialog.isOpen}
        onOpenChange={confirmDialog.setIsOpen}
        title="Delete Message"
        description="Are you sure you want to delete this message? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        loading={confirmDialog.isLoading}
      />
    </div>
  );
}

interface MessageComposerProps {
  onSend: (content: string, attachments?: File[]) => Promise<boolean>;
  disabled?: boolean;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

function MessageComposer({ onSend, disabled, showNotification }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAddAttachment = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Validate files
    const validFiles = files.filter((file) => {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        showNotification?.(`${file.name} is too large (max 10MB)`, 'error');
        return false;
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        showNotification?.(`${file.name} has unsupported file type`, 'error');
        return false;
      }
      return true;
    });

    setAttachments((prev) => [...prev, ...validFiles]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [showNotification]);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && attachments.length === 0) return;

    setIsSending(true);
    const success = await onSend(trimmedContent, attachments.length > 0 ? attachments : undefined);

    if (success) {
      setContent('');
      setAttachments([]);
    } else {
      showNotification?.('Failed to send message', 'error');
    }

    setIsSending(false);
  }, [content, attachments, onSend, showNotification]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, UI_LIMITS.MAX_TEXTAREA_HEIGHT)}px`;
    }
  }, [content]);

  return (
    <div className="message-composer">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="composer-attachments-preview">
          {attachments.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="composer-attachment-item"
            >
              <File className="icon-xs" />
              <span className="attachment-filename">{file.name}</span>
              <IconButton action="close" onClick={() => handleRemoveAttachment(index)} iconSize="xs" />
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="composer-input-row">
        <input ref={fileInputRef} type="file" multiple accept={ALLOWED_FILE_TYPES.join(',')} onChange={handleFileChange} className="file-input-hidden" />

        <IconButton action="attach" onClick={handleAddAttachment} disabled={disabled || isSending} title="Attach file" />

        <div className="composer-textarea-wrapper">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled || isSending}
            rows={1}
            className="textarea composer-textarea"
          />
        </div>

        <button
          className="btn-primary p-2"
          onClick={handleSend}
          disabled={disabled || isSending || (!content.trim() && attachments.length === 0)}
          title="Send message"
        >
          <Send className="icon-sm" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface MessageThreadProps {
  thread: MessageThreadType;
  messages: Message[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onSendMessage: (content: string, attachments?: File[]) => Promise<boolean>;
  onEditMessage: (messageId: number, content: string) => Promise<boolean>;
  onDeleteMessage: (messageId: number) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * MessageThread Component
 * Displays a single message thread with messages and composer
 */
export function MessageThread({
  thread,
  messages,
  loading,
  error,
  onBack,
  onRefresh,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  showNotification
}: MessageThreadProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const messagesRef = useStaggerChildren<HTMLDivElement>(0.05);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div ref={containerRef} className="section">
      <div className="table-layout">
        <div className="data-table-card">
          <div className="message-thread-container">
            {/* Header */}
            <div className="data-table-header">
              <IconButton action="back" onClick={onBack} title="Back to threads" />

              <div className="flex-1 card-content-truncate">
                <h3 className="text-primary text-sm">{decodeHtmlEntities(thread.subject)}</h3>
                {thread.project_name && (
                  <span className="text-muted text-sm">{decodeHtmlEntities(thread.project_name)}</span>
                )}
              </div>

              <IconButton action="refresh" onClick={onRefresh} title="Refresh" className={loading ? 'loading-spin' : ''} />
            </div>

            {/* Messages area */}
            <div className="messages-area scroll-container">
              {loading && messages.length === 0 ? (
                <LoadingState message="Loading messages..." />
              ) : error ? (
                <ErrorState message={error} onRetry={onRefresh} />
              ) : messages.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="icon-lg" />}
                  message="No messages yet. Start the conversation!"
                />
              ) : (
                <div ref={messagesRef} className="section">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.sender_type === 'client'}
                      onEdit={onEditMessage}
                      onDelete={onDeleteMessage}
                      showNotification={showNotification}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Composer */}
            <MessageComposer
              onSend={onSendMessage}
              disabled={loading || !!error}
              showNotification={showNotification}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
