/**
 * ===============================================
 * BUTTON SETS
 * ===============================================
 * @file src/factories/buttons/button-sets.ts
 *
 * Predefined button combinations for common use cases.
 * Each set returns an array of button configurations.
 */

import type { ButtonConfig, UIContext } from '../types';

type ButtonSetId = string | number;

/**
 * Predefined button sets for different contexts.
 * Each function returns an array of ButtonConfig objects.
 */
export const BUTTON_SETS = {
  // ============================================
  // TABLE ROW ACTIONS
  // ============================================

  /** Standard CRUD: View, Edit, Delete */
  tableCrud: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'view', dataId: id },
    { action: 'edit', dataId: id },
    { action: 'delete', dataId: id }
  ],

  /** View and Delete only */
  tableViewDelete: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'view', dataId: id },
    { action: 'delete', dataId: id }
  ],

  /** Edit and Delete only */
  tableEditDelete: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'edit', dataId: id },
    { action: 'delete', dataId: id }
  ],

  /** File actions: Preview, Download, Delete */
  tableFile: (id: ButtonSetId, canPreview = true, canDelete = true): ButtonConfig[] => [
    { action: 'preview', dataId: id, show: canPreview },
    { action: 'download', dataId: id },
    { action: 'delete', dataId: id, show: canDelete }
  ],

  /** Deleted items: Restore, Delete permanently */
  tableDeletedItem: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'restore', dataId: id },
    { action: 'delete', dataId: id, title: 'Delete Permanently', ariaLabel: 'Delete permanently' }
  ],

  /** Lead actions: View, Convert, Email, Delete */
  tableLead: (id: ButtonSetId, canConvert = true): ButtonConfig[] => [
    { action: 'view', dataId: id },
    { action: 'convert-client', dataId: id, show: canConvert },
    { action: 'email', dataId: id },
    { action: 'delete', dataId: id }
  ],

  /** Proposal actions: View, Send, Convert, Delete */
  tableProposal: (id: ButtonSetId, canSend = true, canConvert = true): ButtonConfig[] => [
    { action: 'view', dataId: id },
    { action: 'send', dataId: id, show: canSend },
    { action: 'convert-project', dataId: id, show: canConvert },
    { action: 'delete', dataId: id }
  ],

  /** Invoice actions: View, Send, Mark Paid, Delete */
  tableInvoice: (id: ButtonSetId, canSend = true, canMarkPaid = true): ButtonConfig[] => [
    { action: 'view', dataId: id },
    { action: 'send', dataId: id, show: canSend },
    { action: 'mark-paid', dataId: id, show: canMarkPaid },
    { action: 'delete', dataId: id }
  ],

  /** Workflow actions: View, Steps, Edit, Delete */
  tableWorkflow: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'view', dataId: id },
    { action: 'steps', dataId: id },
    { action: 'edit', dataId: id },
    { action: 'delete', dataId: id }
  ],

  /** Template actions: Preview, Edit, Test, Delete */
  tableTemplate: (id: ButtonSetId, canTest = true): ButtonConfig[] => [
    { action: 'preview', dataId: id },
    { action: 'edit', dataId: id },
    { action: 'test', dataId: id, show: canTest },
    { action: 'delete', dataId: id }
  ],

  /** Review actions: Approve, Reject */
  tableReview: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'approve', dataId: id },
    { action: 'reject', dataId: id }
  ],

  // ============================================
  // MODAL ACTIONS
  // ============================================

  /** Modal confirm: Cancel, Save */
  modalConfirm: (): ButtonConfig[] => [
    { action: 'cancel' },
    { action: 'save', variant: 'primary' }
  ],

  /** Modal confirm with delete: Cancel, Delete, Save */
  modalConfirmWithDelete: (canDelete = true): ButtonConfig[] => [
    { action: 'cancel' },
    { action: 'delete', show: canDelete },
    { action: 'save', variant: 'primary' }
  ],

  /** Modal destructive: Cancel, Delete */
  modalDestructive: (): ButtonConfig[] => [
    { action: 'cancel' },
    { action: 'delete', variant: 'danger' }
  ],

  /** Modal close only */
  modalClose: (): ButtonConfig[] => [{ action: 'close' }],

  // ============================================
  // TOOLBAR ACTIONS
  // ============================================

  /** Toolbar refresh: Refresh */
  toolbarRefresh: (): ButtonConfig[] => [{ action: 'refresh' }],

  /** Toolbar with export: Refresh, Export */
  toolbarWithExport: (): ButtonConfig[] => [{ action: 'refresh' }, { action: 'export' }],

  /** Toolbar with add: Add */
  toolbarAdd: (): ButtonConfig[] => [{ action: 'add', variant: 'primary' }],

  /** Toolbar search and filter */
  toolbarSearchFilter: (): ButtonConfig[] => [{ action: 'search' }, { action: 'filter' }],

  // ============================================
  // CARD ACTIONS
  // ============================================

  /** Card preview: Preview, Download */
  cardPreview: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'preview', dataId: id },
    { action: 'download', dataId: id }
  ],

  /** Card with more menu */
  cardWithMore: (id: ButtonSetId): ButtonConfig[] => [{ action: 'more', dataId: id }],

  /** Card edit actions */
  cardEdit: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'edit', dataId: id },
    { action: 'delete', dataId: id }
  ],

  // ============================================
  // SPECIALIZED TABLE ACTIONS
  // ============================================

  /** Questionnaire actions: Edit, Send, Delete */
  tableQuestionnaire: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'edit', dataId: id },
    {
      action: 'send',
      dataId: id,
      title: 'Send to client',
      ariaLabel: 'Send questionnaire to client'
    },
    { action: 'delete', dataId: id }
  ],

  /** Questionnaire response actions: View, Remind, Delete */
  tableQuestionnaireResponse: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'view', dataId: id },
    { action: 'remind', dataId: id },
    { action: 'delete', dataId: id }
  ],

  /** Contact actions: Convert, Archive/Restore */
  tableContact: (id: ButtonSetId, canConvert = true, isArchived = false): ButtonConfig[] => [
    { action: 'convert-client', dataId: id, show: canConvert },
    { action: 'archive', dataId: id, show: !isArchived },
    { action: 'restore', dataId: id, show: isArchived }
  ],

  /** Contract actions: View, Remind, Expire */
  tableContract: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'view', dataId: id },
    { action: 'remind', dataId: id, title: 'Resend reminder', ariaLabel: 'Resend reminder' },
    { action: 'expire', dataId: id }
  ],

  /** Email template actions: Preview, Edit, Versions, Test, Delete */
  tableEmailTemplate: (id: ButtonSetId, canTest = true): ButtonConfig[] => [
    { action: 'preview', dataId: id },
    { action: 'edit', dataId: id },
    { action: 'versions', dataId: id },
    { action: 'test', dataId: id, show: canTest },
    { action: 'delete', dataId: id }
  ],

  /** Document request actions: View, Start Review, Approve, Reject */
  tableDocumentRequest: (id: ButtonSetId, status: string): ButtonConfig[] => [
    { action: 'view', dataId: id },
    { action: 'start-review', dataId: id, show: status === 'uploaded' },
    { action: 'approve', dataId: id, show: status === 'under_review' },
    { action: 'reject', dataId: id, show: status === 'under_review' }
  ],

  /** Toggle actions: Enable/Disable, Edit, Delete */
  tableToggle: (id: ButtonSetId, isActive = true): ButtonConfig[] => [
    { action: 'disable', dataId: id, show: isActive },
    { action: 'enable', dataId: id, show: !isActive },
    { action: 'edit', dataId: id },
    { action: 'delete', dataId: id }
  ],

  /** Time entry actions: Edit, Delete */
  tableTimeEntry: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'edit', dataId: id },
    { action: 'delete', dataId: id }
  ],

  /** Deliverable actions: View, Approve, Reject, Delete */
  tableDeliverable: (id: ButtonSetId, needsReview = false): ButtonConfig[] => [
    { action: 'view', dataId: id },
    { action: 'approve', dataId: id, show: needsReview },
    { action: 'reject', dataId: id, show: needsReview },
    { action: 'delete', dataId: id }
  ],

  /** Task actions: Complete, Edit, Delete */
  tableTask: (id: ButtonSetId, canComplete = true): ButtonConfig[] => [
    { action: 'complete', dataId: id, show: canComplete },
    { action: 'edit', dataId: id },
    { action: 'delete', dataId: id }
  ],

  // ============================================
  // INLINE ACTIONS
  // ============================================

  /** Inline save/cancel */
  inlineSaveCancel: (): ButtonConfig[] => [
    { action: 'save', variant: 'primary' },
    { action: 'cancel' }
  ],

  /** Inline edit/delete */
  inlineEditDelete: (id: ButtonSetId): ButtonConfig[] => [
    { action: 'edit', dataId: id },
    { action: 'delete', dataId: id }
  ]
} as const;

export type ButtonSetName = keyof typeof BUTTON_SETS;

/**
 * Get a button set by name with arguments.
 */
export function getButtonSet<T extends ButtonSetName>(
  setName: T,
  ...args: Parameters<(typeof BUTTON_SETS)[T]>
): ButtonConfig[] {
  const setFn = BUTTON_SETS[setName] as (...args: unknown[]) => ButtonConfig[];
  return setFn(...args);
}

/**
 * Apply context to a button set.
 */
export function applyContextToSet(buttons: ButtonConfig[], context: UIContext): ButtonConfig[] {
  return buttons.map((btn) => ({ ...btn, context }));
}

/**
 * Merge additional configs into a button set.
 */
export function extendButtonSet(
  buttons: ButtonConfig[],
  overrides: Partial<ButtonConfig>[]
): ButtonConfig[] {
  return buttons.map((btn, i) => ({
    ...btn,
    ...(overrides[i] || {})
  }));
}

/**
 * Filter a button set by show condition.
 */
export function filterButtonSet(buttons: ButtonConfig[]): ButtonConfig[] {
  return buttons.filter((btn) => btn.show !== false);
}
