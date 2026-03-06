/**
 * ===============================================
 * PORTAL MESSAGES - RENDERER
 * ===============================================
 * @file src/features/client/modules/portal-messages-renderer.ts
 *
 * Rendering functions for messages and attachments.
 * Extracted from portal-messages.ts for maintainability.
 */

import type { PortalMessage, ClientPortalContext } from '../portal-types';
import { ICONS } from '../../../constants/icons';
import { API_ENDPOINTS } from '../../../constants/api-endpoints';
import { renderEmptyState } from '../../../components/empty-state';
import { setupMessageActionHandlers } from './portal-messages-threads';

const MESSAGES_API = API_ENDPOINTS.MESSAGES;

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Render attachment list for a message
 */
export function renderMessageAttachments(
  attachments: { filename: string; originalName: string; size: number; mimeType: string }[] | null
): string {
  if (!attachments || attachments.length === 0) return '';

  const attachmentItems = attachments
    .map((att) => {
      const size = formatFileSize(att.size);
      const name = att.originalName || att.filename;
      const displayName = name.length > 25 ? `${name.substring(0, 22)}...` : name;

      return `
      <a href="${MESSAGES_API}/attachments/${att.filename}/download"
         class="message-attachment"
         target="_blank"
         rel="noopener noreferrer"
         title="Download ${name}">
        <span class="message-attachment-icon">${ICONS.FILE}</span>
        <span class="message-attachment-name">${displayName}</span>
        <span class="message-attachment-size">(${size})</span>
        <span class="message-attachment-download">${ICONS.DOWNLOAD}</span>
      </a>
    `;
    })
    .join('');

  return `<div class="message-attachments">${attachmentItems}</div>`;
}

/**
 * Render messages list
 */
export function renderMessages(
  container: HTMLElement,
  messages: PortalMessage[],
  ctx: ClientPortalContext
): void {
  // Add accessibility attributes to the message container
  container.setAttribute('role', 'log');
  container.setAttribute('aria-label', 'Message conversation');
  container.setAttribute('aria-live', 'polite');

  if (messages.length === 0) {
    renderEmptyState(container, 'No messages yet. Send a message to Noelle to get started.', {
      className: 'no-messages'
    });
    return;
  }

  container.innerHTML = messages
    .map((msg) => {
      const isSent = msg.sender_type === 'client';
      const isAdmin = msg.sender_type === 'admin';
      const initials = (msg.sender_name || 'Unknown').substring(0, 3).toUpperCase();
      const displayName = isAdmin ? 'Noelle' : msg.sender_name || 'Unknown';

      // Admin uses avatar image, clients use initials placeholder
      const avatarHtml = isAdmin
        ? '<img src="/images/avatar_small_sidebar.svg" alt="Admin" class="avatar-img" />'
        : `<div class="avatar-placeholder">${initials}</div>`;

      const senderClass = isAdmin ? 'message-admin' : 'message-client';

      // Parse attachments if present
      const attachments = msg.attachments;
      const attachmentsHtml = renderMessageAttachments(
        attachments as
          | { filename: string; originalName: string; size: number; mimeType: string }[]
          | null
      );

      // Client messages get edit/delete actions
      const actionsHtml = isSent
        ? `
        <div class="message-actions">
          <button type="button" class="message-action-btn message-edit-btn" data-message-id="${msg.id}" title="Edit message" aria-label="Edit message">
            ${ICONS.EDIT}
          </button>
          <button type="button" class="message-action-btn message-delete-btn" data-message-id="${msg.id}" title="Delete message" aria-label="Delete message">
            ${ICONS.TRASH}
          </button>
        </div>
      `
        : '';

      return `
      <div class="message message-${isSent ? 'sent' : 'received'} ${senderClass}" data-message-id="${msg.id}">
        <div class="message-avatar">
          ${avatarHtml}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-sender">${ctx.escapeHtml(displayName)}</span>
            <span class="message-time">${ctx.formatDate(msg.created_at)}</span>
            ${actionsHtml}
          </div>
          <div class="message-body">${ctx.escapeHtml(msg.message)}</div>
          ${attachmentsHtml}
        </div>
      </div>
    `;
    })
    .join('');

  // Set up edit/delete handlers for client messages
  setupMessageActionHandlers(container, ctx);

  container.scrollTop = container.scrollHeight;
}

// ============================================
// ATTACHMENT VALIDATION
// ============================================

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'png', 'jpg', 'jpeg', 'gif', 'txt', 'zip'
];

export { MAX_ATTACHMENTS };

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Validate a file for attachment
 */
export function validateFile(file: File): string | null {
  const ext = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `File type .${ext} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }

  if (file.size > MAX_FILE_SIZE) {
    return `File ${file.name} is too large. Maximum size is 10MB.`;
  }

  return null;
}

/**
 * Render attachment preview chips
 */
export function renderAttachmentPreview(
  preview: HTMLElement | null,
  pendingAttachments: File[],
  onRemove: (index: number) => void
): void {
  if (!preview) return;

  if (pendingAttachments.length === 0) {
    preview.innerHTML = '';
    preview.classList.add('hidden');
    return;
  }

  preview.classList.remove('hidden');
  preview.innerHTML = pendingAttachments
    .map((file, index) => {
      const size = formatFileSize(file.size);
      const name = file.name.length > 20 ? `${file.name.substring(0, 17)}...` : file.name;

      return `
      <div class="attachment-chip" data-index="${index}">
        <span class="attachment-chip-icon">${ICONS.FILE}</span>
        <span class="attachment-chip-name" title="${file.name}">${name}</span>
        <span class="attachment-chip-size">(${size})</span>
        <button type="button" class="attachment-chip-remove" data-index="${index}" aria-label="Remove attachment">
          ${ICONS.X_SMALL}
        </button>
      </div>
    `;
    })
    .join('');

  // Add remove button handlers
  preview.querySelectorAll('.attachment-chip-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const index = parseInt((btn as HTMLElement).dataset.index || '0');
      onRemove(index);
    });
  });
}
