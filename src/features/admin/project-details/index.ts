/**
 * Project Details Module Index
 * @file src/features/admin/project-details/index.ts
 *
 * Re-exports all sub-modules for the project details feature.
 */

// Types
export type { ProjectDetailsContext, ProjectDetailsHandler, InvoiceLineItem } from './types';
export { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from './types';

// DOM Cache
export { domCache, initDOMCache } from './dom-cache';
export type { ProjectDetailsDOMKeys } from './dom-cache';

// Messages
export {
  loadProjectMessages,
  sendProjectMessage,
  getCurrentThreadId,
  resetThreadId
} from './messages';

// Files
export {
  loadProjectFiles,
  isAllowedFileType,
  uploadFiles,
  setupFileUploadHandlers,
  loadPendingRequestsDropdown
} from './files';

// Milestones
export {
  loadProjectMilestones,
  updateProgressBar,
  showAddMilestonePrompt,
  addMilestone,
  toggleMilestone,
  deleteMilestone,
  toggleMilestoneTasks,
  toggleTaskCompletion
} from './milestones';

// Invoices
export {
  loadProjectInvoices,
  type ExtendedInvoice
} from './invoices';

// Invoice Modals
export {
  showCreateInvoicePrompt,
  createInvoiceWithLineItems,
  createDepositInvoice,
  createInvoice
} from './invoice-modals';

// Invoice Actions
export {
  editInvoice,
  showApplyCreditPrompt,
  sendInvoice,
  markInvoicePaid,
  sendInvoiceReminder,
  duplicateInvoice,
  deleteInvoice,
  recordPayment
} from './invoice-actions';

// Invoice Scheduling
export {
  processLateFees,
  showScheduleInvoicePrompt,
  showSetupRecurringPrompt,
  loadScheduledInvoices,
  loadRecurringInvoices,
  cancelScheduledInvoice,
  toggleRecurringInvoice
} from './invoice-scheduling';

// Project Actions
export {
  deleteProject,
  archiveProject,
  duplicateProject,
  openEditProjectModal,
  saveProjectChanges,
  handleContractSign
} from './actions';
