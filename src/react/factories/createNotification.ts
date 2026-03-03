/**
 * ===============================================
 * NOTIFICATION FACTORY
 * ===============================================
 * @file src/react/factories/createNotification.ts
 *
 * Standardized notification message templates.
 * Eliminates repeated notification patterns across components.
 */

// ============================================
// TYPES
// ============================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationMessage {
  message: string;
  type: NotificationType;
}

export type NotificationFunction = (
  message: string,
  type: NotificationType
) => void;

// ============================================
// CRUD NOTIFICATIONS
// ============================================

/**
 * Create notification message for CRUD operations.
 *
 * @example
 * showNotification(...notify.created('Client'));
 * showNotification(...notify.deleted('Invoice', 3));
 */
export const notify = {
  // CREATE
  created: (entity: string, count = 1): [string, NotificationType] => [
    count === 1 ? `${entity} created successfully` : `${count} ${entity}s created`,
    'success'
  ],

  // UPDATE
  updated: (entity: string, count = 1): [string, NotificationType] => [
    count === 1 ? `${entity} updated successfully` : `${count} ${entity}s updated`,
    'success'
  ],

  saved: (entity: string): [string, NotificationType] => [
    `${entity} saved successfully`,
    'success'
  ],

  // DELETE
  deleted: (entity: string, count = 1): [string, NotificationType] => [
    count === 1 ? `${entity} deleted` : `${count} ${entity}s deleted`,
    'success'
  ],

  archived: (entity: string, count = 1): [string, NotificationType] => [
    count === 1 ? `${entity} archived` : `${count} ${entity}s archived`,
    'success'
  ],

  restored: (entity: string, count = 1): [string, NotificationType] => [
    count === 1 ? `${entity} restored` : `${count} ${entity}s restored`,
    'success'
  ],

  // SEND
  sent: (entity: string): [string, NotificationType] => [
    `${entity} sent successfully`,
    'success'
  ],

  emailSent: (recipient?: string): [string, NotificationType] => [
    recipient ? `Email sent to ${recipient}` : 'Email sent successfully',
    'success'
  ],

  reminderSent: (entity: string): [string, NotificationType] => [
    `Reminder sent for ${entity}`,
    'success'
  ],

  // STATUS CHANGES
  statusChanged: (entity: string, newStatus: string): [string, NotificationType] => [
    `${entity} marked as ${newStatus}`,
    'success'
  ],

  approved: (entity: string): [string, NotificationType] => [
    `${entity} approved`,
    'success'
  ],

  rejected: (entity: string): [string, NotificationType] => [
    `${entity} rejected`,
    'success'
  ],

  completed: (entity: string): [string, NotificationType] => [
    `${entity} marked as complete`,
    'success'
  ],

  // COPY
  copied: (what = 'Copied to clipboard'): [string, NotificationType] => [
    what,
    'success'
  ],

  linkCopied: (): [string, NotificationType] => [
    'Link copied to clipboard',
    'success'
  ],

  // UPLOAD/DOWNLOAD
  uploaded: (entity: string, count = 1): [string, NotificationType] => [
    count === 1 ? `${entity} uploaded successfully` : `${count} files uploaded`,
    'success'
  ],

  downloadStarted: (): [string, NotificationType] => [
    'Download started',
    'info'
  ],

  exported: (entity: string): [string, NotificationType] => [
    `${entity} exported successfully`,
    'success'
  ],

  // ERRORS
  error: (message: string): [string, NotificationType] => [message, 'error'],

  createFailed: (entity: string): [string, NotificationType] => [
    `Failed to create ${entity.toLowerCase()}`,
    'error'
  ],

  updateFailed: (entity: string): [string, NotificationType] => [
    `Failed to update ${entity.toLowerCase()}`,
    'error'
  ],

  deleteFailed: (entity: string): [string, NotificationType] => [
    `Failed to delete ${entity.toLowerCase()}`,
    'error'
  ],

  loadFailed: (entity: string): [string, NotificationType] => [
    `Failed to load ${entity.toLowerCase()}`,
    'error'
  ],

  sendFailed: (entity: string): [string, NotificationType] => [
    `Failed to send ${entity.toLowerCase()}`,
    'error'
  ],

  uploadFailed: (entity = 'file'): [string, NotificationType] => [
    `Failed to upload ${entity.toLowerCase()}`,
    'error'
  ],

  networkError: (): [string, NotificationType] => [
    'Network error. Please check your connection.',
    'error'
  ],

  unauthorized: (): [string, NotificationType] => [
    'You are not authorized to perform this action',
    'error'
  ],

  sessionExpired: (): [string, NotificationType] => [
    'Your session has expired. Please log in again.',
    'warning'
  ],

  // WARNINGS
  warning: (message: string): [string, NotificationType] => [message, 'warning'],

  unsavedChanges: (): [string, NotificationType] => [
    'You have unsaved changes',
    'warning'
  ],

  // INFO
  info: (message: string): [string, NotificationType] => [message, 'info'],

  processing: (entity: string): [string, NotificationType] => [
    `Processing ${entity.toLowerCase()}...`,
    'info'
  ],

  noChanges: (): [string, NotificationType] => ['No changes to save', 'info'],

  // BULK OPERATIONS
  bulk: {
    selected: (count: number, entity: string): [string, NotificationType] => [
      `${count} ${count === 1 ? entity : `${entity}s`} selected`,
      'info'
    ],

    deleted: (count: number, entity: string): [string, NotificationType] => [
      `${count} ${count === 1 ? entity : `${entity}s`} deleted`,
      'success'
    ],

    archived: (count: number, entity: string): [string, NotificationType] => [
      `${count} ${count === 1 ? entity : `${entity}s`} archived`,
      'success'
    ],

    restored: (count: number, entity: string): [string, NotificationType] => [
      `${count} ${count === 1 ? entity : `${entity}s`} restored`,
      'success'
    ],

    statusChanged: (
      count: number,
      entity: string,
      status: string
    ): [string, NotificationType] => [
      `${count} ${count === 1 ? entity : `${entity}s`} marked as ${status}`,
      'success'
    ],

    failed: (
      count: number,
      entity: string,
      action: string
    ): [string, NotificationType] => [
      `Failed to ${action} ${count} ${count === 1 ? entity : `${entity}s`}`,
      'error'
    ]
  }
};

// ============================================
// NOTIFICATION HELPER HOOK
// ============================================

/**
 * Creates a bound notification helper for a specific entity.
 *
 * @example
 * const clientNotify = createEntityNotifier('Client', showNotification);
 * clientNotify.created();
 * clientNotify.deleted(3);
 */
export function createEntityNotifier(
  entity: string,
  showNotification: NotificationFunction
) {
  return {
    created: (count = 1) =>
      showNotification(...notify.created(entity, count)),
    updated: (count = 1) =>
      showNotification(...notify.updated(entity, count)),
    saved: () => showNotification(...notify.saved(entity)),
    deleted: (count = 1) =>
      showNotification(...notify.deleted(entity, count)),
    archived: (count = 1) =>
      showNotification(...notify.archived(entity, count)),
    restored: (count = 1) =>
      showNotification(...notify.restored(entity, count)),
    sent: () => showNotification(...notify.sent(entity)),
    reminderSent: () => showNotification(...notify.reminderSent(entity)),
    statusChanged: (status: string) =>
      showNotification(...notify.statusChanged(entity, status)),
    approved: () => showNotification(...notify.approved(entity)),
    rejected: () => showNotification(...notify.rejected(entity)),
    completed: () => showNotification(...notify.completed(entity)),

    // Errors
    createFailed: () => showNotification(...notify.createFailed(entity)),
    updateFailed: () => showNotification(...notify.updateFailed(entity)),
    deleteFailed: () => showNotification(...notify.deleteFailed(entity)),
    loadFailed: () => showNotification(...notify.loadFailed(entity)),
    sendFailed: () => showNotification(...notify.sendFailed(entity)),

    // Bulk
    bulkDeleted: (count: number) =>
      showNotification(...notify.bulk.deleted(count, entity)),
    bulkArchived: (count: number) =>
      showNotification(...notify.bulk.archived(count, entity)),
    bulkRestored: (count: number) =>
      showNotification(...notify.bulk.restored(count, entity)),
    bulkStatusChanged: (count: number, status: string) =>
      showNotification(...notify.bulk.statusChanged(count, entity, status)),
    bulkFailed: (count: number, action: string) =>
      showNotification(...notify.bulk.failed(count, entity, action))
  };
}

// ============================================
// COMMON ENTITY NOTIFIERS
// ============================================

/**
 * Pre-configured notifiers for common entities.
 * Use with showNotification from portal context.
 *
 * @example
 * const showNotification = usePortalContext().showNotification;
 * const clientNotify = notifiers.client(showNotification);
 * clientNotify.created();
 */
export const notifiers = {
  client: (fn: NotificationFunction) => createEntityNotifier('Client', fn),
  project: (fn: NotificationFunction) => createEntityNotifier('Project', fn),
  invoice: (fn: NotificationFunction) => createEntityNotifier('Invoice', fn),
  lead: (fn: NotificationFunction) => createEntityNotifier('Lead', fn),
  task: (fn: NotificationFunction) => createEntityNotifier('Task', fn),
  contact: (fn: NotificationFunction) => createEntityNotifier('Contact', fn),
  file: (fn: NotificationFunction) => createEntityNotifier('File', fn),
  message: (fn: NotificationFunction) => createEntityNotifier('Message', fn),
  deliverable: (fn: NotificationFunction) =>
    createEntityNotifier('Deliverable', fn),
  contract: (fn: NotificationFunction) => createEntityNotifier('Contract', fn),
  proposal: (fn: NotificationFunction) => createEntityNotifier('Proposal', fn),
  questionnaire: (fn: NotificationFunction) =>
    createEntityNotifier('Questionnaire', fn),
  template: (fn: NotificationFunction) => createEntityNotifier('Template', fn),
  workflow: (fn: NotificationFunction) => createEntityNotifier('Workflow', fn)
};

// ============================================
// EXPORTS
// ============================================

export default notify;
