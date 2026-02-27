/**
 * ===============================================
 * BUTTON ACTIONS
 * ===============================================
 * @file src/factories/buttons/button-actions.ts
 *
 * Central registry of all action button definitions.
 * Each action has an associated icon, title, and accessibility label.
 */

import type { ButtonActionDefinition, ButtonVariant } from '../types';

/**
 * All available button action types.
 * Used across tables, modals, toolbars, and cards.
 */
export const BUTTON_ACTIONS: Record<string, ButtonActionDefinition> = {
  // ============================================
  // VIEW / NAVIGATION
  // ============================================
  view: { icon: 'eye', title: 'View', ariaLabel: 'View' },
  preview: { icon: 'eye', title: 'Preview', ariaLabel: 'Preview' },
  back: { icon: 'arrow-left', title: 'Back', ariaLabel: 'Go back' },
  close: { icon: 'x', title: 'Close', ariaLabel: 'Close' },
  expand: { icon: 'chevron-down', title: 'Expand', ariaLabel: 'Expand' },
  collapse: { icon: 'chevron-up', title: 'Collapse', ariaLabel: 'Collapse' },

  // ============================================
  // EDIT / MODIFY
  // ============================================
  edit: { icon: 'edit', title: 'Edit', ariaLabel: 'Edit' },
  save: { icon: 'check', title: 'Save', ariaLabel: 'Save', variant: 'primary' },
  cancel: { icon: 'x', title: 'Cancel', ariaLabel: 'Cancel' },

  // ============================================
  // CRUD OPERATIONS
  // ============================================
  add: { icon: 'plus', title: 'Add', ariaLabel: 'Add' },
  create: { icon: 'plus', title: 'Create', ariaLabel: 'Create', variant: 'primary' },
  delete: { icon: 'trash', title: 'Delete', ariaLabel: 'Delete', variant: 'danger' },
  remove: { icon: 'x', title: 'Remove', ariaLabel: 'Remove' },

  // ============================================
  // SEND / SHARE / COMMUNICATION
  // ============================================
  send: { icon: 'send', title: 'Send', ariaLabel: 'Send' },
  remind: { icon: 'bell', title: 'Send Reminder', ariaLabel: 'Send reminder' },
  email: { icon: 'mail', title: 'Email', ariaLabel: 'Send email' },
  reply: { icon: 'mail', title: 'Reply', ariaLabel: 'Reply via email' },
  message: { icon: 'message-square', title: 'Message', ariaLabel: 'Send message' },
  call: { icon: 'phone', title: 'Call', ariaLabel: 'Call' },

  // ============================================
  // APPROVE / REJECT / REVIEW
  // ============================================
  approve: { icon: 'circle-check', title: 'Approve', ariaLabel: 'Approve', variant: 'success' },
  reject: { icon: 'circle-x', title: 'Reject', ariaLabel: 'Reject', variant: 'danger' },
  'start-review': { icon: 'check-square', title: 'Start Review', ariaLabel: 'Start review' },
  'mark-paid': { icon: 'circle-check', title: 'Mark as Paid', ariaLabel: 'Mark as paid', variant: 'success' },
  markPaid: { icon: 'circle-check', title: 'Mark as Paid', ariaLabel: 'Mark as paid', variant: 'success' }, // Alias
  complete: { icon: 'check', title: 'Complete', ariaLabel: 'Mark as complete', variant: 'success' },

  // ============================================
  // DOWNLOAD / EXPORT / COPY
  // ============================================
  download: { icon: 'download', title: 'Download', ariaLabel: 'Download' },
  export: { icon: 'download', title: 'Export', ariaLabel: 'Export' },
  pdf: { icon: 'file-text', title: 'Download PDF', ariaLabel: 'Download PDF' },
  copy: { icon: 'copy', title: 'Copy', ariaLabel: 'Copy to clipboard' },
  'copy-link': { icon: 'copy', title: 'Copy Link', ariaLabel: 'Copy link to clipboard' },

  // ============================================
  // CONVERT / TRANSFORM
  // ============================================
  convert: { icon: 'rocket', title: 'Convert', ariaLabel: 'Convert' },
  'convert-client': { icon: 'user-plus', title: 'Convert to Client', ariaLabel: 'Convert to client' },
  'convert-project': { icon: 'rocket', title: 'Convert to Project', ariaLabel: 'Convert to project' },
  'convert-invoice': { icon: 'receipt', title: 'Convert to Invoice', ariaLabel: 'Convert to invoice' },
  activate: { icon: 'rocket', title: 'Activate', ariaLabel: 'Activate' },
  launch: { icon: 'rocket', title: 'Launch', ariaLabel: 'Launch' },

  // ============================================
  // STATUS / TOGGLE
  // ============================================
  toggle: { icon: 'eye', title: 'Toggle', ariaLabel: 'Toggle visibility' },
  enable: { icon: 'eye', title: 'Enable', ariaLabel: 'Enable' },
  disable: { icon: 'eye-off', title: 'Disable', ariaLabel: 'Disable' },
  publish: { icon: 'globe', title: 'Publish', ariaLabel: 'Publish', variant: 'primary' },
  unpublish: { icon: 'eye-off', title: 'Unpublish', ariaLabel: 'Unpublish' },

  // ============================================
  // ARCHIVE / RESTORE / EXPIRE
  // ============================================
  archive: { icon: 'archive', title: 'Archive', ariaLabel: 'Archive' },
  restore: { icon: 'rotate-ccw', title: 'Restore', ariaLabel: 'Restore' },
  expire: { icon: 'clock', title: 'Expire', ariaLabel: 'Mark as expired', variant: 'warning' },
  unarchive: { icon: 'rotate-ccw', title: 'Unarchive', ariaLabel: 'Unarchive' },

  // ============================================
  // WORKFLOW / PROCESS
  // ============================================
  steps: { icon: 'list', title: 'Manage Steps', ariaLabel: 'Manage steps' },
  history: { icon: 'list', title: 'View History', ariaLabel: 'View history' },
  versions: { icon: 'list', title: 'Version History', ariaLabel: 'View version history' },
  workflow: { icon: 'workflow', title: 'Workflow', ariaLabel: 'View workflow' },

  // ============================================
  // UTILITY
  // ============================================
  refresh: { icon: 'refresh', title: 'Refresh', ariaLabel: 'Refresh' },
  search: { icon: 'search', title: 'Search', ariaLabel: 'Search' },
  filter: { icon: 'filter', title: 'Filter', ariaLabel: 'Filter' },
  settings: { icon: 'settings', title: 'Settings', ariaLabel: 'Settings' },
  more: { icon: 'more-vertical', title: 'More', ariaLabel: 'More options' },
  'more-horizontal': { icon: 'more-horizontal', title: 'More', ariaLabel: 'More options' },
  info: { icon: 'help-circle', title: 'Info', ariaLabel: 'More information' },
  help: { icon: 'help-circle', title: 'Help', ariaLabel: 'Help' },
  test: { icon: 'send', title: 'Send Test', ariaLabel: 'Send test' },
  upload: { icon: 'upload', title: 'Upload', ariaLabel: 'Upload file' },
  attach: { icon: 'paperclip', title: 'Attach', ariaLabel: 'Attach file' }
} as const;

export type ButtonActionType = keyof typeof BUTTON_ACTIONS;

/**
 * Get a button action definition.
 */
export function getButtonAction(action: string): ButtonActionDefinition | undefined {
  return BUTTON_ACTIONS[action];
}

/**
 * Check if an action exists.
 */
export function isValidAction(action: string): action is ButtonActionType {
  return action in BUTTON_ACTIONS;
}

/**
 * Get all action names.
 */
export function getAllActionNames(): string[] {
  return Object.keys(BUTTON_ACTIONS);
}

/**
 * Get actions by variant.
 */
export function getActionsByVariant(variant: ButtonVariant): string[] {
  return Object.entries(BUTTON_ACTIONS)
    .filter(([_, def]) => def.variant === variant)
    .map(([name]) => name);
}
