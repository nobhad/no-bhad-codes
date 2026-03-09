/**
 * ===============================================
 * NOTIFICATION MESSAGE CONSTANTS
 * ===============================================
 * @file src/constants/notifications.ts
 *
 * Centralized notification messages used across admin and portal features.
 * Use these instead of inline strings for consistency and easy updates.
 */

export const NOTIFICATIONS = {
  // Milestone messages
  milestone: {
    ADDED: 'Milestone added',
    ADD_FAILED: 'Failed to add milestone',
    UPDATED: 'Milestone updated',
    UPDATE_FAILED: 'Failed to update milestone',
    DELETED: 'Milestone deleted',
    DELETE_FAILED: 'Failed to delete milestone',
    TITLE_REQUIRED: 'Please enter a title'
  },

  // Note messages
  note: {
    ADDED: 'Note added',
    ADD_FAILED: 'Failed to add note',
    UPDATED: 'Note updated',
    UPDATE_FAILED: 'Failed to update note',
    DELETED: 'Note deleted',
    DELETE_FAILED: 'Failed to delete note',
    PINNED: 'Note pinned',
    UNPINNED: 'Note unpinned',
    PIN_FAILED: 'Failed to update note',
    CONTENT_REQUIRED: 'Note content is required'
  },

  // Invoice messages
  invoice: {
    SENT: 'Invoice sent',
    SEND_FAILED: 'Failed to send invoice',
    MARKED_PAID: 'Invoice marked as paid',
    MARK_PAID_FAILED: 'Failed to mark invoice as paid',
    DELETED: 'Invoice deleted',
    DELETE_FAILED: 'Failed to delete invoice',
    PDF_DOWNLOADED: 'PDF downloaded',
    PDF_DOWNLOAD_FAILED: 'Failed to download PDF'
  },

  // Project messages
  project: {
    UPDATED: 'Updated successfully',
    UPDATE_FAILED: 'Failed to update',
    DELETED: 'Project deleted',
    DELETE_FAILED: 'Failed to delete project',
    ARCHIVED: 'Project archived',
    ARCHIVE_FAILED: 'Failed to archive project',
    STATUS_UPDATE_FAILED: 'Failed to update status',
    NOTES_SAVED: 'Notes saved',
    NOTES_SAVE_FAILED: 'Failed to save notes',
    DUPLICATE_COMING_SOON: 'Duplicate feature coming soon',
    DOCS_COMING_SOON: 'Document generation coming soon'
  },

  // Contract messages
  contract: {
    GENERATE_COMING_SOON: 'Contract generation coming soon',
    SIGNATURE_COMING_SOON: 'E-signature integration coming soon'
  },

  // File messages
  file: {
    DELETED: 'File deleted',
    DELETE_FAILED: 'Failed to delete file',
    UPLOAD_FAILED: 'Failed to upload files',
    NOW_PRIVATE: 'File is now private',
    NOW_SHARED: 'File is now shared with client',
    SHARE_FAILED: 'Failed to update sharing'
  },

  // Message messages
  message: {
    SEND_FAILED: 'Failed to send message',
    EDIT_FAILED: 'Failed to edit message',
    REACTION_FAILED: 'Failed to update reaction'
  },

  // Client messages
  client: {
    DELETED: 'Client deleted',
    DELETE_FAILED: 'Failed to delete client',
    ARCHIVED: 'Client archived',
    ARCHIVE_FAILED: 'Failed to archive client',
    STATUS_UPDATE_FAILED: 'Failed to update status',
    INVITATION_SENT: 'Invitation sent',
    INVITATION_FAILED: 'Failed to send invitation'
  },

  // Contact messages
  contact: {
    ADDED: 'Contact added',
    ADD_FAILED: 'Failed to add contact',
    UPDATED: 'Contact updated',
    UPDATE_FAILED: 'Failed to update contact',
    DELETED: 'Contact deleted',
    DELETE_FAILED: 'Failed to delete contact'
  }
} as const;

/**
 * Helper to build status update notification message
 */
export function statusUpdatedMessage(statusLabel: string): string {
  return `Status updated to ${statusLabel}`;
}

/**
 * Helper to build file upload notification message
 */
export function fileUploadMessage(successCount: number, failCount: number): string {
  if (failCount === 0) {
    return `Uploaded ${successCount} file${successCount !== 1 ? 's' : ''}`;
  }
  if (successCount > 0) {
    return `Uploaded ${successCount}, failed ${failCount}`;
  }
  return NOTIFICATIONS.file.UPLOAD_FAILED;
}
