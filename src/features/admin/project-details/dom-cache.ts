/**
 * DOM Cache configuration for project details module
 * @file src/features/admin/project-details/dom-cache.ts
 *
 * Centralizes all DOM element selectors for the project detail view.
 * Uses the createDOMCache utility for performance optimization.
 */

import { createDOMCache } from '../../../utils/dom-cache';

/** DOM element selector keys for the project details module */
export type ProjectDetailsDOMKeys = {
  // Overview elements
  detailTitle: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  company: string;
  status: string;
  projectType: string;
  budget: string;
  timeline: string;
  startDate: string;
  endDate: string;
  progressPercent: string;
  progressBar: string;
  progressBarContainer: string;
  description: string;
  previewUrlLink: string;
  // URLs section
  urlsSection: string;
  repoUrlLink: string;
  productionUrlLink: string;
  // Financial section
  financialSection: string;
  deposit: string;
  price: string;
  // Contract section
  contractSection: string;
  contractStatusBadge: string;
  contractSignedInfo: string;
  contractDate: string;
  contractCountersignedInfo: string;
  contractCountersignedDate: string;
  contractPreviewBtn: string;
  contractDownloadBtn: string;
  contractSignBtn: string;
  contractCountersignBtn: string;
  contractBuilderBtn: string;
  contractCountersignRow: string;
  contractCountersignDateRow: string;
  contractCountersigner: string;
  contractCountersignedDatetime: string;
  contractSignatureCard: string;
  contractSigner: string;
  contractSignedDatetime: string;
  // Admin notes
  adminNotesSection: string;
  adminNotes: string;
  notes: string;
  // Settings form
  settingName: string;
  settingStatus: string;
  settingProgress: string;
  // Client account info
  clientAccountEmail: string;
  clientAccountStatus: string;
  clientLastLogin: string;
  // Header elements
  projectNameCard: string;
  moreMenu: string;
  // Buttons
  backBtn: string;
  sendMsgBtn: string;
  resendInviteBtn: string;
  addMilestoneBtn: string;
  createInvoiceBtn: string;
  btnAddTask: string;
  btnManageDeliverables: string;
  processLateFeesBtn: string;
  scheduleInvoiceBtn: string;
  setupRecurringBtn: string;
  scheduledInvoicesList: string;
  recurringInvoicesList: string;
  // Custom dropdown
  statusDropdown: string;
  statusTrigger: string;
  statusMenu: string;
  // Messages
  messagesThread: string;
  messageInput: string;
  // Files
  filesList: string;
  uploadDropzone: string;
  fileInput: string;
  browseFilesBtn: string;
  // Milestones
  milestonesList: string;
  // Deliverables
  deliverablesList: string;
  // Invoices
  invoicesList: string;
  outstanding: string;
  paid: string;
  // Edit modal
  editModal: string;
  editForm: string;
  editClose: string;
  editCancel: string;
};

/** Cached DOM element references for performance */
export const domCache = createDOMCache<ProjectDetailsDOMKeys>();

/** Register all element selectors (called once when module loads) */
export function initDOMCache(): void {
  domCache.register({
    // Overview elements
    detailTitle: '#project-detail-title',
    projectName: '#pd-project-name',
    clientName: '#pd-client-name',
    clientEmail: '#pd-client-email',
    company: '#pd-company',
    status: '#pd-status',
    projectType: '#pd-type',
    budget: '#pd-budget',
    timeline: '#pd-timeline',
    startDate: '#pd-start-date',
    endDate: '#pd-end-date',
    progressPercent: '#pd-progress-percent',
    progressBar: '#pd-progress-bar',
    progressBarContainer: '#pd-progress-bar-container',
    description: '#pd-description',
    previewUrlLink: '#pd-preview-url-link',
    // URLs section
    urlsSection: '#pd-urls-section',
    repoUrlLink: '#pd-repo-url-link',
    productionUrlLink: '#pd-production-url-link',
    // Financial section
    financialSection: '#pd-financial-section',
    deposit: '#pd-deposit',
    price: '#pd-price',
    // Contract section
    contractSection: '#pd-contract-section',
    contractStatusBadge: '#pd-contract-status-badge',
    contractSignedInfo: '#pd-contract-signed-info',
    contractDate: '#pd-contract-date',
    contractCountersignedInfo: '#pd-contract-countersigned-info',
    contractCountersignedDate: '#pd-contract-countersigned-date',
    contractPreviewBtn: '#pd-contract-preview-btn',
    contractDownloadBtn: '#pd-contract-download-btn',
    contractSignBtn: '#pd-contract-sign-btn',
    contractCountersignBtn: '#pd-contract-countersign-btn',
    contractBuilderBtn: '#pd-contract-builder-btn',
    contractCountersignRow: '#pd-contract-countersign-row',
    contractCountersignDateRow: '#pd-contract-countersign-date-row',
    contractCountersigner: '#pd-contract-countersigner',
    contractCountersignedDatetime: '#pd-contract-countersigned-datetime',
    contractSignatureCard: '#pd-contract-signature-card',
    contractSigner: '#pd-contract-signer',
    contractSignedDatetime: '#pd-contract-signed-datetime',
    // Admin notes
    adminNotesSection: '#pd-admin-notes-section',
    adminNotes: '#pd-admin-notes',
    notes: '#pd-notes',
    // Settings form
    settingName: '#pd-setting-name',
    settingStatus: '#pd-setting-status',
    settingProgress: '#pd-setting-progress',
    // Client account info
    clientAccountEmail: '#pd-client-account-email',
    clientAccountStatus: '#pd-client-account-status',
    clientLastLogin: '#pd-client-last-login',
    // Header elements
    projectNameCard: '#pd-project-name-card',
    moreMenu: '#pd-more-menu',
    // Buttons
    backBtn: '#btn-back-to-projects',
    sendMsgBtn: '#btn-pd-send-message',
    resendInviteBtn: '#btn-resend-invite',
    addMilestoneBtn: '#btn-add-milestone',
    createInvoiceBtn: '#btn-create-invoice',
    btnAddTask: '#btn-add-task',
    btnManageDeliverables: '#btn-manage-deliverables',
    processLateFeesBtn: '#btn-process-late-fees',
    scheduleInvoiceBtn: '#btn-schedule-invoice',
    setupRecurringBtn: '#btn-setup-recurring',
    scheduledInvoicesList: '#pd-scheduled-invoices',
    recurringInvoicesList: '#pd-recurring-invoices',
    // Custom dropdown
    statusDropdown: '#pd-status-dropdown',
    statusTrigger: '#pd-status-trigger',
    statusMenu: '#pd-status-menu',
    // Messages
    messagesThread: '#pd-messages-thread',
    messageInput: '#pd-message-input',
    // Files
    filesList: '#pd-files-list',
    uploadDropzone: '#pd-upload-dropzone',
    fileInput: '#pd-file-input',
    browseFilesBtn: '#btn-pd-browse-files',
    // Milestones
    milestonesList: '#pd-milestones-list',
    // Deliverables
    deliverablesList: '#pd-deliverables-list',
    // Invoices
    invoicesList: '#pd-invoices-list',
    outstanding: '#pd-outstanding',
    paid: '#pd-paid',
    // Edit modal
    editModal: '#edit-project-modal',
    editForm: '#edit-project-form',
    editClose: '#edit-project-close',
    editCancel: '#edit-project-cancel'
  });
}

// Initialize on module load
initDOMCache();
