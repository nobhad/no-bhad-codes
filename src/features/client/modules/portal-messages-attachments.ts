/**
 * ===============================================
 * PORTAL MESSAGES - ATTACHMENT HANDLING
 * ===============================================
 * @file src/features/client/modules/portal-messages-attachments.ts
 *
 * Attachment upload, validation, and preview management.
 * Extracted from portal-messages.ts for maintainability.
 */

import { showToast } from '../../../utils/toast-notifications';
import { createDOMCache } from '../../../utils/dom-cache';
import { renderAttachmentPreview, validateFile, MAX_ATTACHMENTS } from './portal-messages-renderer';

/** DOM element selector keys for attachment elements */
type AttachmentDOMKeys = {
  messageInput: string;
  attachBtn: string;
  attachInput: string;
  attachPreview: string;
};

/** Cached DOM element references */
const domCache = createDOMCache<AttachmentDOMKeys>();

domCache.register({
  messageInput: '#message-input',
  attachBtn: '#btn-attach-file',
  attachInput: '#attachment-input',
  attachPreview: '#attachment-preview'
});

// Pending attachments for current message
let pendingAttachments: File[] = [];

/**
 * Get pending attachments array
 */
export function getPendingAttachments(): File[] {
  return pendingAttachments;
}

/**
 * Clear pending attachments
 */
export function clearAttachments(): void {
  pendingAttachments = [];
  const preview = domCache.get('attachPreview', true);
  if (preview) {
    preview.innerHTML = '';
    preview.classList.add('hidden');
  }
  const input = domCache.get('attachInput', true) as HTMLInputElement;
  if (input) {
    input.value = '';
  }
}

/**
 * Reset attachment state (for cleanup)
 */
export function resetAttachments(): void {
  pendingAttachments = [];
}

/**
 * Remove a single attachment by index
 */
function removeAttachment(index: number): void {
  pendingAttachments.splice(index, 1);
  renderAttachmentPreviewLocal();
}

/**
 * Render the local attachment preview
 */
function renderAttachmentPreviewLocal(): void {
  const preview = domCache.get('attachPreview', true);
  renderAttachmentPreview(preview as HTMLElement | null, pendingAttachments, removeAttachment);
}

/**
 * Handle file selection
 */
export function handleFileSelection(files: FileList | null): void {
  if (!files || files.length === 0) return;

  const remainingSlots = MAX_ATTACHMENTS - pendingAttachments.length;
  if (remainingSlots <= 0) {
    showToast(`Maximum ${MAX_ATTACHMENTS} attachments allowed`, 'error');
    return;
  }

  const filesToAdd = Array.from(files).slice(0, remainingSlots);

  for (const file of filesToAdd) {
    const error = validateFile(file);
    if (error) {
      showToast(error, 'error');
      continue;
    }
    pendingAttachments.push(file);
  }

  if (files.length > remainingSlots) {
    showToast(`Only ${remainingSlots} more files can be added`, 'warning');
  }

  renderAttachmentPreviewLocal();
}

/**
 * Setup attachment-related listeners
 */
export function setupAttachmentListeners(): void {
  const attachBtn = domCache.get('attachBtn', true);
  const attachInput = domCache.get('attachInput', true) as HTMLInputElement;

  if (attachBtn && attachInput) {
    attachBtn.addEventListener('click', (e) => {
      e.preventDefault();
      attachInput.click();
    });

    attachInput.addEventListener('change', () => {
      handleFileSelection(attachInput.files);
      attachInput.value = '';
    });
  }

  // Drag and drop support on message input
  const messageInput = domCache.get('messageInput', true);
  if (messageInput) {
    messageInput.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      messageInput.classList.add('drag-over');
    });

    messageInput.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      messageInput.classList.remove('drag-over');
    });

    messageInput.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      messageInput.classList.remove('drag-over');
      const dragEvent = e as Event & { dataTransfer?: DataTransfer };
      if (dragEvent.dataTransfer?.files) {
        handleFileSelection(dragEvent.dataTransfer.files);
      }
    });
  }
}
