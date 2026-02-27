/**
 * MessageThread
 * Single thread view with messages, composer, and actions
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  X,
  Pencil,
  Trash2,
  Check,
  ArrowLeft,
  RefreshCw,
  MoreVertical,
  File,
  Download,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
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
  'text/plain',
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
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
    <div className="tw-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
      {isImage ? (
        <img src={attachment.download_url} alt={attachment.filename} style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
      ) : (
        <File className="tw-h-4 tw-w-4 tw-text-muted" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tw-text-primary" style={{ fontSize: '12px' }}>{attachment.filename}</div>
        <div className="tw-text-muted" style={{ fontSize: '11px' }}>{formatFileSize(attachment.file_size)}</div>
      </div>
      <button className="tw-btn-icon" onClick={handleDownload} title="Download">
        <Download className="tw-h-4 tw-w-4" />
      </button>
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
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const confirmDialog = useConfirmDialog();

  const handleStartEdit = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(true);
    setShowActions(false);
  }, [message.content]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(message.content);
  }, [message.content]);

  const handleSaveEdit = useCallback(async () => {
    if (!editContent.trim() || editContent === message.content) {
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
  }, [editContent, message.content, message.id, onEdit, handleCancelEdit, showNotification]);

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
      className={cn(
        'tw-flex tw-flex-col tw-gap-1',
        isOwn ? 'tw-items-end' : 'tw-items-start'
      )}
      onMouseEnter={() => isOwn && !isEditing && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Sender name for non-own messages */}
      {!isOwn && (
        <span className="tw-text-[10px] tw-text-[var(--portal-text-muted)] tw-ml-1">
          {message.sender_name}
        </span>
      )}

      <div className="tw-flex tw-items-start tw-gap-1.5 tw-group">
        {/* Actions for own messages */}
        {isOwn && showActions && !isEditing && (
          <div className="tw-flex tw-items-center tw-gap-0.5">
            <PortalButton
              variant="ghost"
              size="icon"
              onClick={handleStartEdit}
              title="Edit"
              className="tw-h-6 tw-w-6"
            >
              <Pencil className="tw-h-3 tw-w-3" />
            </PortalButton>
            <PortalButton
              variant="ghost"
              size="icon"
              onClick={confirmDialog.open}
              title="Delete"
              className="tw-h-6 tw-w-6 hover:tw-text-[var(--status-cancelled)]"
            >
              <Trash2 className="tw-h-3 tw-w-3" />
            </PortalButton>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'tw-max-w-[280px] tw-px-3 tw-py-2 tw-rounded-lg',
            isOwn
              ? 'tw-bg-[var(--color-brand-primary)] tw-text-white'
              : 'tw-bg-[var(--portal-bg-medium)] tw-text-[var(--portal-text-primary)]'
          )}
        >
          {isEditing ? (
            <div className="tw-flex tw-flex-col tw-gap-2">
              <textarea
                ref={editInputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className={cn(
                  'tw-w-full tw-min-h-[60px] tw-p-2 tw-text-[12px]',
                  'tw-bg-[var(--portal-bg-darkest)] tw-text-[var(--portal-text-primary)]',
                  'tw-border tw-border-[var(--portal-border-dark)] tw-rounded',
                  'focus:tw-outline-none focus:tw-ring-1 focus:tw-ring-[var(--color-brand-primary)]',
                  'tw-resize-none'
                )}
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
              <div className="tw-flex tw-justify-end tw-gap-1">
                <PortalButton
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="tw-h-6 tw-text-[10px]"
                >
                  Cancel
                </PortalButton>
                <PortalButton
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEdit}
                  className="tw-h-6 tw-text-[10px]"
                >
                  <Check className="tw-h-3 tw-w-3" />
                  Save
                </PortalButton>
              </div>
            </div>
          ) : (
            <>
              <p className="tw-text-[12px] tw-whitespace-pre-wrap tw-break-words">
                {message.content}
              </p>
              {message.attachments.length > 0 && (
                <div className="tw-mt-2 tw-flex tw-flex-col tw-gap-1">
                  {message.attachments.map((attachment) => (
                    <AttachmentPreview key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Time and edited indicator */}
      <div className="tw-flex tw-items-center tw-gap-1 tw-mx-1">
        <span className="tw-text-[10px] tw-text-[var(--portal-text-muted)]">
          {formatMessageTime(message.created_at)}
        </span>
        {message.is_edited && (
          <span className="tw-text-[10px] tw-text-[var(--portal-text-muted)] tw-italic">
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [content]);

  return (
    <div className="tw-section" style={{ gap: '0.5rem' }}>
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0 0.5rem' }}>
          {attachments.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="tw-panel"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.5rem', fontSize: '12px' }}
            >
              <File className="tw-h-3 tw-w-3" />
              <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
              <button type="button" onClick={() => handleRemoveAttachment(index)} className="tw-btn-icon" style={{ padding: '0.125rem' }}>
                <X className="tw-h-3 tw-w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
        <input ref={fileInputRef} type="file" multiple accept={ALLOWED_FILE_TYPES.join(',')} onChange={handleFileChange} className="tw-hidden" />

        <button className="tw-btn-icon" onClick={handleAddAttachment} disabled={disabled || isSending} title="Attach file">
          <Paperclip className="tw-h-4 tw-w-4" />
        </button>

        <div style={{ flex: 1 }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled || isSending}
            rows={1}
            className="tw-textarea"
            style={{ minHeight: 'auto', resize: 'none', overflow: 'hidden' }}
          />
        </div>

        <button
          className="tw-btn-primary"
          onClick={handleSend}
          disabled={disabled || isSending || (!content.trim() && attachments.length === 0)}
          title="Send message"
          style={{ padding: '0.5rem' }}
        >
          <Send className="tw-h-4 tw-w-4" />
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
  currentUserId?: number;
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
  showNotification,
  currentUserId,
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
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="tw-divider" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem' }}>
        <button className="tw-btn-icon" onClick={onBack} title="Back to threads">
          <ArrowLeft className="tw-h-4 tw-w-4" />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="tw-text-primary" style={{ fontSize: '14px' }}>{thread.subject}</h3>
          {thread.project_name && (
            <span className="tw-text-muted" style={{ fontSize: '12px' }}>{thread.project_name}</span>
          )}
        </div>

        <button className="tw-btn-icon" onClick={onRefresh} title="Refresh">
          <RefreshCw className={cn('tw-h-4 tw-w-4', loading && 'tw-animate-spin')} />
        </button>
      </div>

      {/* Messages area */}
      <div className="tw-scroll-container" style={{ flex: 1, padding: '1rem 0.75rem' }}>
        {loading && messages.length === 0 ? (
          <div className="tw-loading" style={{ height: '100%' }}>
            <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
            <span>Loading messages...</span>
          </div>
        ) : error ? (
          <div className="tw-error" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="tw-text-center tw-mb-4">{error}</div>
            <button className="tw-btn-secondary" onClick={onRefresh}>Retry</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="tw-empty-state" style={{ height: '100%' }}>
            <span>No messages yet. Start the conversation!</span>
          </div>
        ) : (
          <div ref={messagesRef} className="tw-section">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_type === 'client' || message.sender_id === currentUserId}
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
      <div className="tw-divider" style={{ padding: '0.75rem' }}>
        <MessageComposer
          onSend={onSendMessage}
          disabled={loading || !!error}
          showNotification={showNotification}
        />
      </div>
    </div>
  );
}
