/**
 * ===============================================
 * ADMIN PROJECT DETAILS HANDLER
 * ===============================================
 * @file src/features/admin/admin-project-details.ts
 *
 * Main orchestrator for project detail view, delegating to sub-modules
 * for messages, files, milestones, invoices, and project actions.
 */

import { SanitizationUtils } from '../../utils/sanitization-utils';
import { getEmailWithCopyHtml } from '../../utils/copy-email';
import {
  formatTextWithLineBreaks,
  formatDate,
  formatDateTime,
  formatCurrency
} from '../../utils/format-utils';
import { alertWarning } from '../../utils/confirm-dialog';
import { apiPut } from '../../utils/api-client';
import {
  createSecondarySidebar,
  SECONDARY_TAB_ICONS,
  type SecondarySidebarController
} from '../../components/secondary-sidebar';
import { renderEmptyState } from '../../components/empty-state';

// Import from sub-modules
import {
  domCache,
  type ProjectDetailsHandler,
  // Messages
  loadProjectMessages,
  sendProjectMessage,
  resetThreadId,
  // Files
  loadProjectFiles,
  setupFileUploadHandlers,
  loadPendingRequestsDropdown,
  // Milestones
  loadProjectMilestones,
  updateProgressBar,
  showAddMilestonePrompt,
  toggleMilestone as toggleMilestoneModule,
  deleteMilestone as deleteMilestoneModule,
  toggleMilestoneTasks as toggleMilestoneTasksModule,
  toggleTaskCompletion as toggleTaskCompletionModule,
  // Invoices
  loadProjectInvoices,
  showCreateInvoicePrompt,
  // Invoice Actions
  editInvoice as editInvoiceModule,
  sendInvoice as sendInvoiceModule,
  markInvoicePaid as markInvoicePaidModule,
  sendInvoiceReminder as sendInvoiceReminderModule,
  duplicateInvoice as duplicateInvoiceModule,
  deleteInvoice as deleteInvoiceModule,
  showApplyCreditPrompt as showApplyCreditPromptModule,
  recordPayment as recordPaymentModule,
  // Invoice Scheduling
  processLateFees,
  showScheduleInvoicePrompt,
  showSetupRecurringPrompt,
  loadScheduledInvoices,
  loadRecurringInvoices,
  cancelScheduledInvoice as cancelScheduledInvoiceModule,
  toggleRecurringInvoice as toggleRecurringInvoiceModule,
  // Project Actions
  deleteProject,
  archiveProject,
  duplicateProject,
  openEditProjectModal,
  saveProjectChanges,
  handleContractSign,
  handleContractCountersign,
  showContractBuilder,
  // Document Generation
  showDocumentGenerationModal
} from './project-details';

import type { ProjectResponse } from '../../types/api';

export type { ProjectDetailsHandler };

// ========================================
// ICONS FOR DYNAMIC RENDERING
// ========================================
const RENDER_ICONS = {
  EDIT: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  MORE: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
  COPY: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  ARCHIVE: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>',
  DOC: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  TRASH: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
  USER: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  BUILDING: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>',
  MAIL: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  EYE: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  GITHUB: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>',
  GLOBE: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  OVERVIEW: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
  FILE: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
  UPLOAD: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>',
  MESSAGE: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"/></svg>',
  INVOICE: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
  TASK: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  CLOCK: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  CONTRACT: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>',
  NOTES: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>',
  PEN: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  SIGN: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  DOWNLOAD: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  CLOSE: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  FOLDER: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
  FOLDER_PLUS: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>',
  LOCK: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
  SHARE: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
  COUNTERSIGN: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4"/><path d="M2 16c3-1 6-4 7-7 1-3 4-6 7-7"/><path d="M13 7l4 4"/><path d="M19 3l2 2"/></svg>',
  CREDIT_CARD: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  LIST: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
  CHEVRON_DOWN: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dropdown-caret"><path d="m6 9 6 6 6-6"/></svg>'
};

/**
 * Render the project detail tab structure dynamically
 */
export function renderProjectDetailTab(container: HTMLElement): void {
  container.innerHTML = `
    <!-- Project Header Card -->
    <div class="portal-project-card portal-shadow pd-header-card">
      <div class="pd-header-top">
        <div class="pd-header-info">
          <div class="detail-title-row">
            <div class="detail-title-group">
              <h2 class="detail-title" id="pd-project-name">Project Name</h2>
              <span class="status-badge" id="pd-status">-</span>
            </div>
            <div class="detail-actions">
              <button class="icon-btn" id="pd-btn-edit" title="Edit Project" aria-label="Edit project details">
                ${RENDER_ICONS.EDIT}
              </button>
              <div class="table-dropdown detail-more-menu" id="pd-more-menu">
                <button type="button" class="custom-dropdown-trigger" aria-label="More actions">
                  ${RENDER_ICONS.MORE}
                </button>
                <ul class="custom-dropdown-menu">
                  <li class="custom-dropdown-item" data-action="edit">${RENDER_ICONS.PEN} Edit Project</li>
                  <li class="custom-dropdown-item" data-action="duplicate">${RENDER_ICONS.COPY} Duplicate Project</li>
                  <li class="custom-dropdown-item" data-action="archive">${RENDER_ICONS.ARCHIVE} Archive Project</li>
                  <li class="custom-dropdown-item" data-action="generate-docs">${RENDER_ICONS.DOC} Generate Documents</li>
                  <li class="dropdown-divider"></li>
                  <li class="custom-dropdown-item danger" data-action="delete">${RENDER_ICONS.TRASH} Delete Project</li>
                </ul>
              </div>
            </div>
          </div>
          <!-- Client Info -->
          <div class="pd-header-client">
            <div class="pd-client-item clickable-client" id="pd-header-client-link">
              ${RENDER_ICONS.USER}
              <span id="pd-header-client-name">-</span>
            </div>
            <div class="pd-client-item" id="pd-header-company-row">
              ${RENDER_ICONS.BUILDING}
              <span id="pd-header-company">-</span>
            </div>
            <div class="pd-client-item">
              ${RENDER_ICONS.MAIL}
              <span id="pd-header-email">-</span>
            </div>
          </div>
          <!-- Project Meta -->
          <div class="pd-header-meta">
            <div class="pd-meta-item">
              <span class="field-label">Type</span>
              <span class="pd-meta-value" id="pd-header-type">-</span>
            </div>
            <div class="pd-meta-item">
              <span class="field-label">Start</span>
              <span class="pd-meta-value" id="pd-header-start">-</span>
            </div>
            <div class="pd-meta-item">
              <span class="field-label">Target End</span>
              <span class="pd-meta-value" id="pd-header-end">-</span>
            </div>
            <div class="pd-meta-item">
              <span class="field-label">Budget</span>
              <span class="pd-meta-value" id="pd-header-budget">-</span>
            </div>
          </div>
          <!-- Description -->
          <div class="pd-header-description">
            <span class="field-label">Description</span>
            <p class="pd-description" id="pd-description">-</p>
          </div>
          <!-- Financial Details -->
          <div class="pd-header-meta">
            <div class="pd-meta-item">
              <span class="field-label">Timeline</span>
              <span class="pd-meta-value" id="pd-timeline">-</span>
            </div>
            <div class="pd-meta-item">
              <span class="field-label">Quoted Price</span>
              <span class="pd-meta-value" id="pd-price">-</span>
            </div>
            <div class="pd-meta-item">
              <span class="field-label">Deposit</span>
              <span class="pd-meta-value" id="pd-deposit">-</span>
            </div>
          </div>
          <!-- URLs -->
          <div class="pd-header-urls" id="pd-urls-section">
            <span class="field-label">Links</span>
            <div class="pd-urls-row">
              <a href="#" id="pd-preview-url-link" target="_blank" rel="noopener noreferrer" class="pd-url-link">
                ${RENDER_ICONS.EYE} <span>Preview</span>
              </a>
              <a href="#" id="pd-repo-url-link" target="_blank" rel="noopener noreferrer" class="pd-url-link">
                ${RENDER_ICONS.GITHUB} <span>Repository</span>
              </a>
              <a href="#" id="pd-production-url-link" target="_blank" rel="noopener noreferrer" class="pd-url-link">
                ${RENDER_ICONS.GLOBE} <span>Production</span>
              </a>
            </div>
          </div>
          <!-- Admin Notes -->
          <div class="pd-header-description" id="pd-admin-notes-section" style="display: none;">
            <span class="field-label">Admin Notes (Internal)</span>
            <p class="pd-description" id="pd-admin-notes">-</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="project-detail-tabs portal-tabs">
      <button class="active" data-pd-tab="overview">${RENDER_ICONS.OVERVIEW}<span>Overview</span></button>
      <button data-pd-tab="files">${RENDER_ICONS.FILE}<span>Files</span></button>
      <button data-pd-tab="deliverables">${RENDER_ICONS.UPLOAD}<span>Deliverables</span></button>
      <button data-pd-tab="messages">${RENDER_ICONS.MESSAGE}<span>Messages</span></button>
      <button data-pd-tab="invoices">${RENDER_ICONS.INVOICE}<span>Invoices</span></button>
      <button data-pd-tab="tasks">${RENDER_ICONS.TASK}<span>Tasks</span></button>
      <button data-pd-tab="time">${RENDER_ICONS.CLOCK}<span>Time</span></button>
      <button data-pd-tab="contract">${RENDER_ICONS.CONTRACT}<span>Contract</span></button>
      <button data-pd-tab="notes">${RENDER_ICONS.NOTES}<span>Notes</span></button>
    </div>

    <!-- Overview Tab -->
    <div class="portal-tab-panel active" id="pd-tab-overview">
      <div class="pd-overview-grid">
        <div class="pd-overview-main">
          <div class="portal-project-card portal-shadow">
            <div class="card-header-with-action">
              <h3>Milestones</h3>
              <button class="btn btn-secondary btn-sm" id="btn-add-milestone">+ Add Milestone</button>
            </div>
            <div class="milestones-list" id="pd-milestones-list">
              <p class="empty-state">No milestones yet. Add milestones to track project progress.</p>
            </div>
          </div>
        </div>
        <div class="pd-overview-sidebar">
          <div class="portal-project-card portal-shadow pd-progress-card">
            <h3>Progress</h3>
            <div class="pd-progress-display">
              <div class="pd-progress-ring">
                <span class="pd-progress-percent" id="pd-progress-percent">0%</span>
              </div>
              <div class="progress-bar" role="progressbar" id="pd-progress-bar-container" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Project completion progress">
                <div class="progress-fill" id="pd-progress-bar" style="width: 0%"></div>
              </div>
            </div>
          </div>
          <div class="portal-project-card portal-shadow">
            <h3>Financials</h3>
            <div class="pd-financial-stats">
              <div class="pd-stat-item"><span class="pd-stat-label">Budget</span><span class="pd-stat-value" id="pd-sidebar-budget">-</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Invoiced</span><span class="pd-stat-value" id="pd-sidebar-invoiced">$0</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Paid</span><span class="pd-stat-value pd-stat-success" id="pd-sidebar-paid">$0</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Outstanding</span><span class="pd-stat-value pd-stat-warning" id="pd-sidebar-outstanding">$0</span></div>
            </div>
          </div>
          <div class="portal-project-card portal-shadow">
            <h3>Quick Stats</h3>
            <div class="pd-quick-stats">
              <div class="pd-stat-item"><span class="pd-stat-label">Files</span><span class="pd-stat-value" id="pd-stat-files">0</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Messages</span><span class="pd-stat-value" id="pd-stat-messages">0</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Tasks</span><span class="pd-stat-value" id="pd-stat-tasks">0</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Invoices</span><span class="pd-stat-value" id="pd-stat-invoices">0</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="portal-project-card portal-shadow pd-activity-card">
        <h3>Recent Activity</h3>
        <ul class="activity-list" id="pd-activity-list" aria-live="polite" aria-atomic="false">
          <li>No activity recorded yet.</li>
        </ul>
      </div>
    </div>

    <!-- Deliverables Tab -->
    <div class="portal-tab-panel" id="pd-tab-deliverables">
      <h3 class="tab-section-heading">Deliverables</h3>
      <div class="portal-project-card portal-shadow">
        <div class="card-header-with-action">
          <h3>Project Deliverables</h3>
          <button class="btn btn-secondary btn-sm" id="btn-manage-deliverables" data-action="open-deliverables">Manage Deliverables</button>
        </div>
        <div id="pd-deliverables-list" class="deliverables-inline-list">
          <p class="empty-state">No deliverables yet. Click "Manage Deliverables" to add and track project deliverables.</p>
        </div>
      </div>
    </div>

    <!-- Files Tab -->
    <div class="portal-tab-panel" id="pd-tab-files">
      <div class="tab-section-header">
        <h3 class="tab-section-heading">Files</h3>
        <div class="table-dropdown generate-document-menu" id="pd-generate-document-menu">
          <button type="button" class="btn btn-secondary custom-dropdown-trigger" aria-label="Generate document">
            ${RENDER_ICONS.DOC} <span>Generate Document</span> ${RENDER_ICONS.CHEVRON_DOWN}
          </button>
          <ul class="custom-dropdown-menu">
            <li class="custom-dropdown-item" data-action="generate-proposal">${RENDER_ICONS.DOC} Generate Proposal PDF</li>
            <li class="custom-dropdown-item" data-action="generate-contract">${RENDER_ICONS.PEN} Generate Contract PDF</li>
            <li class="custom-dropdown-item" data-action="generate-receipt">${RENDER_ICONS.CREDIT_CARD} Generate Receipt PDF</li>
            <li class="custom-dropdown-item" data-action="generate-report">${RENDER_ICONS.DOC} Generate Project Report</li>
            <li class="custom-dropdown-item" data-action="generate-sow">${RENDER_ICONS.LIST} Generate SOW</li>
          </ul>
        </div>
      </div>
      <div class="files-upload-section portal-shadow">
        <h3>Upload Files for Client</h3>
        <div class="upload-dropzone" id="pd-upload-dropzone">
          <p>Drag and drop files here or</p>
          <button class="btn btn-secondary" id="btn-pd-browse-files">Browse Files</button>
          <input type="file" id="pd-file-input" multiple hidden accept=".jpeg,.jpg,.png,.gif,.pdf,.doc,.docx,.txt,.zip,.rar,image/*,application/pdf" />
        </div>
      </div>
      <div class="admin-modal-overlay hidden" id="file-upload-modal" role="dialog" aria-modal="true" aria-labelledby="file-upload-modal-title">
        <div class="admin-modal">
          <div class="admin-modal-header">
            <h2 id="file-upload-modal-title">Upload Files</h2>
            <button type="button" class="btn-icon close-modal" id="file-upload-modal-close" aria-label="Close">${RENDER_ICONS.CLOSE}</button>
          </div>
          <div class="admin-modal-body">
            <div class="upload-files-preview" id="upload-files-preview"></div>
            <div class="form-group">
              <label for="upload-file-type" class="field-label">File Type</label>
              <div id="upload-file-type-mount"></div>
            </div>
            <div class="form-group" id="pd-upload-link-request" style="display: none;">
              <label for="upload-request-select" class="field-label">Link to pending request (optional)</label>
              <div id="upload-request-select-mount"></div>
            </div>
          </div>
          <div class="admin-modal-footer">
            <button type="button" class="btn btn-secondary" id="file-upload-modal-cancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="file-upload-modal-confirm">Upload</button>
          </div>
        </div>
      </div>
      <div class="files-browser portal-shadow">
        <div class="folder-panel">
          <div class="folder-panel-header">
            <h4>Folders</h4>
            <button class="btn-icon" id="btn-create-folder" title="Create Folder" aria-label="Create folder">${RENDER_ICONS.FOLDER_PLUS}</button>
          </div>
          <div class="folder-tree" id="pd-folder-tree">
            <div class="folder-item root active" data-folder-id="root">${RENDER_ICONS.FOLDER} <span>All Files</span></div>
          </div>
        </div>
        <div class="files-panel">
          <div class="files-panel-header">
            <div class="files-path" id="pd-files-path"><span>All Files</span></div>
            <div class="files-panel-controls">
              <div id="files-source-toggle-mount"></div>
              <div id="files-view-toggle-mount"></div>
            </div>
          </div>
          <div class="files-list" id="pd-files-list"><p class="empty-state">No files uploaded yet.</p></div>
          <div class="pending-requests-list hidden" id="pd-pending-requests-list"></div>
        </div>
      </div>
      <div class="file-detail-modal hidden" id="file-detail-modal">
        <div class="file-detail-content portal-shadow">
          <div class="file-detail-header">
            <h2 id="file-detail-name">File Name</h2>
            <button class="btn-icon close-modal" id="close-file-detail">${RENDER_ICONS.CLOSE}</button>
          </div>
          <div class="file-detail-tabs">
            <button class="active" data-tab="info">Info</button>
            <button data-tab="versions">Versions</button>
            <button data-tab="comments">Comments</button>
            <button data-tab="access">Access Log</button>
          </div>
          <div class="file-detail-tab-content active" data-tab-content="info">
            <div class="file-info-grid" id="file-info-content"></div>
          </div>
          <div class="file-detail-tab-content" data-tab-content="versions">
            <div class="file-versions-list" id="file-versions-list"></div>
          </div>
          <div class="file-detail-tab-content" data-tab-content="comments">
            <div class="file-comments-list" id="file-comments-list"></div>
            <div class="file-comment-form">
              <label for="file-comment-input" class="sr-only">Add a comment</label>
              <textarea id="file-comment-input" placeholder="Add a comment..." rows="2" aria-label="Add a comment"></textarea>
              <button class="btn btn-secondary btn-sm" id="btn-add-file-comment">Add Comment</button>
            </div>
          </div>
          <div class="file-detail-tab-content" data-tab-content="access">
            <div class="file-access-log" id="file-access-log"></div>
          </div>
          <div class="file-detail-actions">
            <button class="btn btn-secondary" id="btn-download-file">${RENDER_ICONS.DOWNLOAD} Download</button>
            <button class="btn btn-secondary" id="btn-lock-file">${RENDER_ICONS.LOCK} Lock</button>
            <button class="btn btn-secondary" id="btn-share-file">${RENDER_ICONS.SHARE} Share with Client</button>
            <button class="btn btn-danger" id="btn-delete-file">${RENDER_ICONS.TRASH} Delete</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Messages Tab -->
    <div class="portal-tab-panel" id="pd-tab-messages">
      <h3 class="tab-section-heading">Messages</h3>
      <div class="messages-container portal-shadow">
        <div class="messages-thread" id="pd-messages-thread" aria-live="polite" aria-atomic="false" aria-label="Project messages thread">
          <p class="empty-state">No messages yet. Start the conversation with your client.</p>
        </div>
        <div class="message-compose">
          <div class="message-input-wrapper">
            <label for="pd-message-input" class="sr-only">Message</label>
            <textarea id="pd-message-input" class="form-textarea" placeholder="Type your message to the client..." aria-label="Type your message to the client"></textarea>
          </div>
          <button class="btn btn-secondary" id="btn-pd-send-message">Send Message</button>
        </div>
      </div>
    </div>

    <!-- Invoices Tab -->
    <div class="portal-tab-panel" id="pd-tab-invoices">
      <h3 class="tab-section-heading">Invoices</h3>
      <div class="invoice-summary">
        <div class="summary-card portal-shadow"><span class="summary-label">Total Outstanding</span><span class="summary-value" id="pd-outstanding">$0.00</span></div>
        <div class="summary-card portal-shadow"><span class="summary-label">Total Paid</span><span class="summary-value" id="pd-paid">$0.00</span></div>
      </div>
      <div class="portal-project-card portal-shadow">
        <div class="card-header-with-action">
          <h3>Invoices</h3>
          <div class="invoice-action-buttons">
            <div id="pd-invoices-filter" class="invoice-filter-container"></div>
            <button class="btn btn-outline" id="btn-process-late-fees" title="Apply late fees to overdue invoices">Apply Late Fees</button>
            <button class="btn btn-secondary" id="btn-create-invoice">+ Create Invoice</button>
          </div>
        </div>
        <div class="invoices-list" id="pd-invoices-list"><p class="empty-state">No invoices created yet.</p></div>
      </div>
      <div class="portal-project-card portal-shadow">
        <div class="card-header-with-action">
          <h3>Payment Plans & Recurring</h3>
          <div class="invoice-action-buttons">
            <button class="btn btn-outline" id="btn-schedule-invoice">Schedule Invoice</button>
            <button class="btn btn-outline" id="btn-setup-recurring">Setup Recurring</button>
          </div>
        </div>
        <div class="payment-plans-section">
          <h4>Scheduled Invoices</h4>
          <div id="pd-scheduled-invoices" class="scheduled-list"><p class="empty-state">No scheduled invoices.</p></div>
          <h4>Recurring Invoices</h4>
          <div id="pd-recurring-invoices" class="recurring-list"><p class="empty-state">No recurring invoices configured.</p></div>
        </div>
      </div>
    </div>

    <!-- Tasks Tab -->
    <div class="portal-tab-panel" id="pd-tab-tasks">
      <h3 class="tab-section-heading">Tasks</h3>
      <div class="portal-project-card portal-shadow">
        <div class="card-header-with-action">
          <div class="view-toggle-container">
            <div id="tasks-view-toggle-mount"></div>
            <button class="btn btn-secondary" id="btn-add-task">+ Add Task</button>
          </div>
        </div>
        <div id="tasks-kanban-container"></div>
        <div id="tasks-list-container" style="display: none;"></div>
      </div>
    </div>

    <!-- Time Tracking Tab -->
    <div class="portal-tab-panel" id="pd-tab-time">
      <h3 class="tab-section-heading">Time Tracking</h3>
      <div class="time-tracking-header">
        <div>
          <button class="btn btn-secondary" id="btn-log-time">+ Log Time</button>
          <button class="btn btn-outline" id="btn-export-time">Export CSV</button>
        </div>
      </div>
      <div class="time-tracking-summary" id="time-tracking-summary"></div>
      <div class="time-weekly-chart">
        <h4>This Week</h4>
        <div id="time-weekly-chart-container"></div>
      </div>
      <div class="portal-project-card portal-shadow">
        <h3>Time Entries</h3>
        <div id="time-entries-list"><p class="empty-state">No time entries yet.</p></div>
      </div>
    </div>

    <!-- Contract Tab -->
    <div class="portal-tab-panel" id="pd-tab-contract">
      <h3 class="tab-section-heading">Contract</h3>
      <div class="contract-tab-content">
        <div class="portal-project-card portal-shadow">
          <div class="contract-status-display">
            <div class="contract-status-info">
              <div class="status-item"><span class="field-label">Status</span><span class="status-badge" id="pd-contract-status-badge">Not Signed</span></div>
              <div class="status-item" id="pd-contract-signed-info" style="display: none;"><span class="field-label">Signed On</span><span class="meta-value" id="pd-contract-date">-</span></div>
              <div class="status-item" id="pd-contract-countersigned-info" style="display: none;"><span class="field-label">Countersigned On</span><span class="meta-value" id="pd-contract-countersigned-date">-</span></div>
              <div class="status-item" id="pd-contract-requested-info" style="display: none;"><span class="field-label">Signature Requested</span><span class="meta-value" id="pd-contract-requested-date">-</span></div>
            </div>
          </div>
        </div>
        <div class="portal-project-card portal-shadow">
          <h3>Contract Document</h3>
          <p class="contract-description">Preview, download, or request a signature for this project's contract.</p>
          <div class="contract-actions-grid">
            <a href="#" id="pd-contract-preview-btn" target="_blank" class="contract-action-card">
              ${RENDER_ICONS.EYE.replace('width="14"', 'width="24"').replace('height="14"', 'height="24"')} <span>Preview Contract</span>
            </a>
            <a href="#" id="pd-contract-download-btn" class="contract-action-card" download>
              ${RENDER_ICONS.DOWNLOAD} <span>Download PDF</span>
            </a>
            <button type="button" id="pd-contract-sign-btn" class="contract-action-card primary">
              ${RENDER_ICONS.SIGN} <span id="pd-contract-sign-btn-text">Request Signature</span>
            </button>
            <button type="button" id="pd-contract-countersign-btn" class="contract-action-card" style="display: none;">
              ${RENDER_ICONS.COUNTERSIGN} <span>Countersign</span>
            </button>
          </div>
        </div>
        <div class="portal-project-card portal-shadow">
          <div class="card-header-with-action">
            <div>
              <h3>Contract Builder</h3>
              <p class="contract-description">Build a draft, pull from templates, and preview before sending.</p>
            </div>
            <button type="button" class="btn btn-secondary" id="pd-contract-builder-btn">Open Builder</button>
          </div>
          <div class="contract-builder-meta">
            <div class="status-item"><span class="field-label">Template</span><span class="meta-value" id="pd-contract-template-label">Not selected</span></div>
            <div class="status-item"><span class="field-label">Draft</span><span class="meta-value" id="pd-contract-draft-status">No draft yet</span></div>
          </div>
        </div>
        <div class="portal-project-card portal-shadow" id="pd-contract-signature-card" style="display: none;">
          <h3>Signature Details</h3>
          <div class="signature-details">
            <div class="signature-info-row"><span class="field-label">Signed By</span><span class="meta-value" id="pd-contract-signer">-</span></div>
            <div class="signature-info-row"><span class="field-label">Date & Time</span><span class="meta-value" id="pd-contract-signed-datetime">-</span></div>
            <div class="signature-info-row" id="pd-contract-countersign-row" style="display: none;"><span class="field-label">Countersigned By</span><span class="meta-value" id="pd-contract-countersigner">-</span></div>
            <div class="signature-info-row" id="pd-contract-countersign-date-row" style="display: none;"><span class="field-label">Countersigned At</span><span class="meta-value" id="pd-contract-countersigned-datetime">-</span></div>
            <div class="signature-info-row"><span class="field-label">IP Address</span><span class="meta-value" id="pd-contract-signer-ip">-</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Notes Tab -->
    <div class="portal-tab-panel" id="pd-tab-notes">
      <h3 class="tab-section-heading">Project Notes</h3>
      <div class="portal-project-card portal-shadow">
        <div class="card-header-with-action">
          <h3>Admin Notes (Internal)</h3>
          <button class="btn btn-secondary btn-sm" id="btn-edit-project-notes">Edit Notes</button>
        </div>
        <div id="pd-notes-display" class="notes-display">
          <p class="empty-state">No notes yet. Click "Edit Notes" to add internal notes about this project.</p>
        </div>
      </div>
    </div>
  `;
}

export class AdminProjectDetails implements ProjectDetailsHandler {
  private currentProjectId: number | null = null;
  private projectsData: ProjectResponse[] = [];
  private switchTabFn?: (tab: string) => void;
  private loadProjectsFn?: () => Promise<void>;
  private formatProjectTypeFn?: (type: string) => string;
  private inviteLeadFn?: (leadId: number, email: string) => Promise<void>;
  private secondarySidebar?: SecondarySidebarController;

  /**
   * Navigate to full project detail view
   */
  showProjectDetails(
    projectId: number,
    projectsData: ProjectResponse[],
    switchTab: (tab: string) => void,
    loadProjects: () => Promise<void>,
    formatProjectType: (type: string) => string,
    inviteLead: (leadId: number, email: string) => Promise<void>
  ): void {
    this.currentProjectId = projectId;
    this.projectsData = projectsData;
    this.switchTabFn = switchTab;
    this.loadProjectsFn = loadProjects;
    this.formatProjectTypeFn = formatProjectType;
    this.inviteLeadFn = inviteLead;

    // Reset message thread when switching projects
    resetThreadId();

    // Find the project in data
    const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
    if (!project) {
      console.error('[AdminProjectDetails] Project not found:', projectId);
      return;
    }

    // Switch to project detail view
    switchTab('project-detail');

    // Dynamically render the project detail tab structure
    const tabContainer = document.getElementById('tab-project-detail');
    if (tabContainer) {
      renderProjectDetailTab(tabContainer);
    }

    // Set project ID on deliverables button for event delegation
    const deliverablesBtn = document.getElementById('btn-manage-deliverables');
    if (deliverablesBtn) {
      deliverablesBtn.dataset.projectId = String(projectId);
    }

    // Populate the detail view
    this.populateProjectDetailView(project);

    // Initialize secondary sidebar for project tabs
    this.initSecondarySidebar();

    // Set up tab navigation and event handlers
    this.setupProjectDetailTabs();
    this.setupNotesTab();
  }

  /**
   * Set up Notes tab edit button
   */
  private setupNotesTab(): void {
    const editNotesBtn = document.getElementById('btn-edit-project-notes');
    if (editNotesBtn && !editNotesBtn.dataset.listenerAdded) {
      editNotesBtn.dataset.listenerAdded = 'true';
      editNotesBtn.addEventListener('click', () => {
        if (this.currentProjectId) {
          this.showEditNotesModal(this.currentProjectId);
        }
      });
    }
  }

  /**
   * Show modal to edit project notes
   */
  private async showEditNotesModal(projectId: number): Promise<void> {
    const project = this.projectsData.find(p => p.id === projectId);
    if (!project) return;

    const { createPortalModal } = await import('../../components/portal-modal');
    const modal = createPortalModal({
      id: 'edit-notes-modal',
      titleId: 'edit-notes-title',
      title: 'Edit Project Notes',
      onClose: () => modal.hide()
    });

    modal.body.innerHTML = `
      <div class="form-group">
        <label class="form-label">Admin Notes (Internal)</label>
        <textarea
          id="edit-notes-textarea"
          class="form-input"
          rows="10"
          placeholder="Add internal notes about this project..."
        >${project.notes || ''}</textarea>
      </div>
    `;

    modal.footer.innerHTML = `
      <button type="button" class="btn btn-outline" id="btn-cancel-notes">Cancel</button>
      <button type="button" class="btn btn-primary" id="btn-save-notes">Save Notes</button>
    `;

    document.body.appendChild(modal.overlay);
    modal.show();

    // Event handlers
    modal.footer.querySelector('#btn-cancel-notes')?.addEventListener('click', () => modal.hide());
    modal.footer.querySelector('#btn-save-notes')?.addEventListener('click', async () => {
      const textarea = document.getElementById('edit-notes-textarea') as HTMLTextAreaElement;
      if (!textarea) return;

      try {
        const response = await apiPut(`/api/projects/${projectId}`, {
          notes: textarea.value.trim()
        });

        if (response.ok) {
          // Update local data
          if (project) {
            project.notes = textarea.value.trim();
          }
          // Refresh the project details display
          this.populateProjectDetailView(project);
          modal.hide();
          const { alertSuccess } = await import('../../utils/confirm-dialog');
          alertSuccess('Project notes updated successfully');
        } else {
          const { alertError } = await import('../../utils/confirm-dialog');
          alertError('Failed to update project notes');
        }
      } catch (error) {
        console.error('[ProjectDetails] Error updating notes:', error);
        const { alertError } = await import('../../utils/confirm-dialog');
        alertError('Error updating project notes');
      }
    });
  }

  /**
   * Initialize secondary sidebar for project detail tabs
   */
  private initSecondarySidebar(): void {
    // Clean up existing sidebar if any
    this.cleanupSecondarySidebar();

    const container = document.getElementById('admin-dashboard');
    const sidebarMount = document.getElementById('secondary-sidebar');
    const horizontalMount = document.getElementById('secondary-tabs-horizontal');

    if (!container || !sidebarMount || !horizontalMount) {
      return;
    }

    // Define project detail tabs
    const projectTabs = [
      { id: 'overview', icon: SECONDARY_TAB_ICONS.OVERVIEW, label: 'Overview' },
      { id: 'tasks', icon: SECONDARY_TAB_ICONS.TASKS, label: 'Tasks' },
      { id: 'messages', icon: SECONDARY_TAB_ICONS.MESSAGES, label: 'Messages' },
      { id: 'files', icon: SECONDARY_TAB_ICONS.FILES, label: 'Files' },
      { id: 'invoices', icon: SECONDARY_TAB_ICONS.INVOICES, label: 'Invoices' },
      { id: 'contract', icon: SECONDARY_TAB_ICONS.CONTRACT, label: 'Contract' },
      { id: 'time', icon: SECONDARY_TAB_ICONS.TIMELINE, label: 'Time' },
      { id: 'case-study', icon: SECONDARY_TAB_ICONS.CASE_STUDY, label: 'Case Study' }
    ];

    // Create secondary sidebar
    this.secondarySidebar = createSecondarySidebar({
      tabs: projectTabs,
      activeTab: 'overview',
      title: 'Project',
      container,
      onTabChange: (tabId) => {
        this.handleSecondaryTabChange(tabId);
      }
    });

    // Get sidebar elements
    const sidebarEl = this.secondarySidebar.getElement();
    const horizontalEl = this.secondarySidebar.getHorizontalTabs();

    // Clear and append to mount points (don't replace - keeps the IDs)
    sidebarMount.innerHTML = '';
    sidebarMount.appendChild(sidebarEl);

    horizontalMount.innerHTML = '';
    horizontalMount.appendChild(horizontalEl);

    // Show the sidebar by adding class to container
    container.classList.add('has-secondary-sidebar');
  }

  /**
   * Handle tab change from secondary sidebar
   */
  private handleSecondaryTabChange(tabId: string): void {
    // Find the corresponding tab button and click it
    const tabBtn = document.querySelector(`.project-detail-tabs button[data-pd-tab="${tabId}"]`) as HTMLButtonElement;
    if (tabBtn) {
      tabBtn.click();
    }
  }

  /**
   * Clean up secondary sidebar when leaving project detail view
   */
  private cleanupSecondarySidebar(): void {
    if (this.secondarySidebar) {
      this.secondarySidebar.destroy();
      this.secondarySidebar = undefined;
    }

    // Restore placeholders if needed
    const container = document.getElementById('admin-dashboard');
    if (container) {
      container.classList.remove('has-secondary-sidebar');
    }
  }

  /**
   * Helper to show project detail (used by action callbacks)
   */
  private showProjectDetail(projectId: number): void {
    if (this.switchTabFn && this.loadProjectsFn && this.formatProjectTypeFn && this.inviteLeadFn) {
      this.showProjectDetails(
        projectId,
        this.projectsData,
        this.switchTabFn,
        this.loadProjectsFn,
        this.formatProjectTypeFn,
        this.inviteLeadFn
      );
    }
  }

  /**
   * Populate the project detail view with data
   */
  private populateProjectDetailView(project: ProjectResponse): void {
    // Header elements
    const detailTitle = domCache.get('detailTitle');
    const projectNameCard = domCache.get('projectNameCard');

    if (detailTitle) detailTitle.textContent = project.project_name || 'Untitled Project';
    if (projectNameCard) projectNameCard.textContent = project.project_name || 'Untitled Project';

    // Client info
    const clientName = domCache.get('clientName');
    const clientEmail = domCache.get('clientEmail');
    const company = domCache.get('company');

    if (clientName) clientName.textContent = project.client_name || project.contact_name || '';
    if (clientEmail) clientEmail.innerHTML = getEmailWithCopyHtml(project.email || '', SanitizationUtils.escapeHtml(project.email || ''));
    if (company) company.textContent = project.company_name || '';

    // Project details
    const projectType = domCache.get('projectType');
    const budget = domCache.get('budget');
    const timeline = domCache.get('timeline');
    const startDate = domCache.get('startDate');
    const endDate = domCache.get('endDate');
    const description = domCache.get('description');
    const price = domCache.get('price');
    const deposit = domCache.get('deposit');

    if (projectType) {
      projectType.textContent = this.formatProjectTypeFn
        ? this.formatProjectTypeFn(project.project_type || '')
        : (project.project_type || '');
    }
    if (budget) budget.textContent = project.budget_range || (project.budget ? String(project.budget) : '-');
    if (timeline) timeline.textContent = project.timeline || '';
    if (startDate) startDate.textContent = project.start_date ? formatDate(project.start_date) : '-';
    if (endDate) endDate.textContent = project.estimated_end_date ? formatDate(project.estimated_end_date) : '-';
    if (description) description.textContent = project.description || '';
    if (price) price.textContent = project.price ? formatCurrency(project.price) : '-';
    if (deposit) deposit.textContent = project.deposit_amount ? formatCurrency(project.deposit_amount) : '-';

    // Progress bar
    const progressPercent = domCache.get('progressPercent');
    const progressBar = domCache.get('progressBar');
    const progress = project.progress || 0;

    if (progressPercent) progressPercent.textContent = `${progress}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;

    // URLs
    this.populateUrlSection(project);

    // Contract section
    this.populateContractSection(project);

    // Admin notes
    const adminNotesSection = domCache.get('adminNotesSection');
    const adminNotes = domCache.get('adminNotes');
    if (project.notes) {
      if (adminNotesSection) adminNotesSection.style.display = '';
      if (adminNotes) adminNotes.innerHTML = formatTextWithLineBreaks(project.notes);
    } else {
      if (adminNotesSection) adminNotesSection.style.display = 'none';
    }

    // Populate Notes tab
    const notesDisplay = document.getElementById('pd-notes-display');
    if (notesDisplay) {
      if (project.notes && project.notes.trim()) {
        notesDisplay.innerHTML = `<div class="notes-content">${formatTextWithLineBreaks(project.notes)}</div>`;
      } else {
        renderEmptyState(notesDisplay, 'No notes yet. Click "Edit Notes" to add internal notes about this project.');
      }
    }

    // Features
    this.populateFeatures(project);

    // Settings form
    this.populateSettingsForm(project);

    // Load project-specific data
    this.refreshProjectData(project.id);
  }

  /**
   * Populate URL section
   */
  private populateUrlSection(project: ProjectResponse): void {
    const previewUrlLink = domCache.get('previewUrlLink') as HTMLAnchorElement | null;
    const repoUrlLink = domCache.get('repoUrlLink') as HTMLAnchorElement | null;
    const productionUrlLink = domCache.get('productionUrlLink') as HTMLAnchorElement | null;

    if (previewUrlLink) {
      const previewText = previewUrlLink.querySelector('.url-link-text');
      if (project.preview_url) {
        previewUrlLink.href = project.preview_url;
        if (previewText) previewText.textContent = project.preview_url;
      } else {
        previewUrlLink.href = '#';
        if (previewText) previewText.textContent = '-';
      }
    }

    if (repoUrlLink) {
      const repoText = repoUrlLink.querySelector('.url-link-text');
      if (project.repository_url) {
        repoUrlLink.href = project.repository_url;
        if (repoText) repoText.textContent = project.repository_url;
      } else {
        repoUrlLink.href = '#';
        if (repoText) repoText.textContent = '-';
      }
    }

    if (productionUrlLink) {
      const prodText = productionUrlLink.querySelector('.url-link-text');
      if (project.production_url) {
        productionUrlLink.href = project.production_url;
        if (prodText) prodText.textContent = project.production_url;
      } else {
        productionUrlLink.href = '#';
        if (prodText) prodText.textContent = '-';
      }
    }
  }

  /**
   * Populate contract section
   */
  private populateContractSection(project: ProjectResponse): void {
    const contractStatusBadge = domCache.get('contractStatusBadge');
    const contractSignedInfo = domCache.get('contractSignedInfo');
    const contractDate = domCache.get('contractDate');
    const contractSignBtn = domCache.get('contractSignBtn');
    const contractCountersignedInfo = domCache.get('contractCountersignedInfo');
    const contractCountersignedDate = domCache.get('contractCountersignedDate');
    const contractCountersignBtn = domCache.get('contractCountersignBtn');
    const contractSignatureCard = domCache.get('contractSignatureCard');
    const contractSigner = domCache.get('contractSigner');
    const contractSignedDatetime = domCache.get('contractSignedDatetime');
    const contractCountersignRow = domCache.get('contractCountersignRow');
    const contractCountersignDateRow = domCache.get('contractCountersignDateRow');
    const contractCountersigner = domCache.get('contractCountersigner');
    const contractCountersignedDatetime = domCache.get('contractCountersignedDatetime');

    const hasClientSignature = Boolean(project.contract_signed_at);
    const hasCountersign = Boolean(project.contract_countersigned_at);

    if (hasClientSignature) {
      if (contractStatusBadge) {
        contractStatusBadge.textContent = hasCountersign ? 'Countersigned' : 'Client Signed';
        contractStatusBadge.className = 'status-badge status-completed';
      }
      if (contractSignedInfo) contractSignedInfo.style.display = '';
      if (contractDate) contractDate.textContent = formatDate(project.contract_signed_at);
      if (contractSignatureCard) contractSignatureCard.style.display = '';
      if (contractSigner) contractSigner.textContent = project.contract_signer_name || 'Client';
      if (contractSignedDatetime) contractSignedDatetime.textContent = formatDateTime(project.contract_signed_at);
      if (contractSignBtn) {
        contractSignBtn.textContent = 'View Contract';
        contractSignBtn.classList.remove('btn-primary');
        contractSignBtn.classList.add('btn-outline');
      }
      if (contractCountersignBtn) {
        contractCountersignBtn.style.display = hasCountersign ? 'none' : 'flex';
      }
      if (contractCountersignedInfo) contractCountersignedInfo.style.display = hasCountersign ? '' : 'none';
      if (contractCountersignedDate) {
        contractCountersignedDate.textContent = hasCountersign && project.contract_countersigned_at
          ? formatDate(project.contract_countersigned_at)
          : '-';
      }
      if (contractCountersignRow) contractCountersignRow.style.display = hasCountersign ? '' : 'none';
      if (contractCountersignDateRow) contractCountersignDateRow.style.display = hasCountersign ? '' : 'none';
      if (contractCountersigner) contractCountersigner.textContent = project.contract_countersigner_name || 'Admin';
      if (contractCountersignedDatetime) {
        contractCountersignedDatetime.textContent = hasCountersign && project.contract_countersigned_at
          ? formatDateTime(project.contract_countersigned_at)
          : '-';
      }
    } else {
      if (contractStatusBadge) {
        contractStatusBadge.textContent = 'Not Signed';
        contractStatusBadge.className = 'status-badge status-pending';
      }
      if (contractSignedInfo) contractSignedInfo.style.display = 'none';
      if (contractCountersignedInfo) contractCountersignedInfo.style.display = 'none';
      if (contractSignatureCard) contractSignatureCard.style.display = 'none';
      if (contractCountersignBtn) contractCountersignBtn.style.display = 'none';
      if (contractSignBtn) {
        contractSignBtn.textContent = 'Request Signature';
        contractSignBtn.classList.add('btn-primary');
        contractSignBtn.classList.remove('btn-outline');
      }
    }
  }

  /**
   * Populate features section
   */
  private populateFeatures(project: ProjectResponse): void {
    const notes = domCache.get('notes');
    if (!notes) return;

    // Clear existing features
    const existingFeatures = notes.querySelector('.features-container');
    if (existingFeatures) existingFeatures.remove();

    // Parse and display features
    const features = project.features;
    if (!features) return;

    // Handle both string and string[] formats
    const featuresArray = Array.isArray(features) ? features : this.parseFeatures(features);
    const excludedValues = ['basic-only', 'standard', 'premium', 'enterprise'];
    const featuresList = featuresArray
      .filter((f: string) => f && !excludedValues.includes(f.toLowerCase()))
      .map((f: string) => `<span class="feature-tag">${SanitizationUtils.escapeHtml(f.replace(/-/g, ' '))}</span>`)
      .join('');

    if (featuresList) {
      const featuresContainer = document.createElement('div');
      featuresContainer.className = 'meta-item features-container';
      featuresContainer.style.flexBasis = '100%';
      featuresContainer.innerHTML = `
        <span class="field-label">Features Requested</span>
        <div class="features-list">${featuresList}</div>
      `;
      notes.appendChild(featuresContainer);
    }
  }

  /**
   * Populate settings form
   */
  private populateSettingsForm(project: ProjectResponse): void {
    const settingName = domCache.getAs<HTMLInputElement>('settingName');
    const settingStatus = domCache.getAs<HTMLInputElement>('settingStatus');
    const settingProgress = domCache.getAs<HTMLInputElement>('settingProgress');

    if (settingName) settingName.value = project.project_name || '';
    if (settingStatus) {
      const projectStatus = project.status || 'pending';
      settingStatus.value = projectStatus;
      this.updateCustomDropdown(projectStatus);
      this.setupCustomStatusDropdown();
    }
    if (settingProgress) settingProgress.value = (project.progress || 0).toString();

    // Client account info
    const clientAccountEmail = domCache.get('clientAccountEmail');
    const clientAccountStatus = domCache.get('clientAccountStatus');
    const clientLastLogin = domCache.get('clientLastLogin');

    if (clientAccountEmail) clientAccountEmail.innerHTML = getEmailWithCopyHtml(project.email || '', SanitizationUtils.escapeHtml(project.email || ''));
    if (clientAccountStatus) {
      const hasAccount = project.client_id || project.password_hash;
      const hasLoggedIn = project.last_login_at;
      if (hasAccount && hasLoggedIn) {
        clientAccountStatus.textContent = 'Active';
      } else if (hasAccount) {
        clientAccountStatus.textContent = 'Pending';
      } else {
        clientAccountStatus.textContent = 'Not Invited';
      }
    }
    if (clientLastLogin) {
      clientLastLogin.textContent = project.last_login_at
        ? formatDateTime(project.last_login_at)
        : 'Never';
    }
  }

  /**
   * Refresh all project-specific data
   */
  private refreshProjectData(projectId: number): void {
    loadProjectMessages(projectId, this.projectsData);
    loadProjectFiles(projectId);
    loadPendingRequestsDropdown(projectId);
    loadProjectMilestones(projectId, (progress) => updateProgressBar(projectId, progress));
    loadProjectInvoices(projectId);
  }

  /**
   * Set up project detail sub-tab navigation
   */
  private setupProjectDetailTabs(): void {
    const tabBtns = document.querySelectorAll('.project-detail-tabs button');
    const tabContents = document.querySelectorAll('[id^="pd-tab-"]');

    tabBtns.forEach((btn) => {
      const btnEl = btn as HTMLElement;
      if (btnEl.dataset.listenerAdded) return;
      btnEl.dataset.listenerAdded = 'true';

      btn.addEventListener('click', async () => {
        const tabName = btnEl.dataset.pdTab;
        if (!tabName) return;

        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        tabContents.forEach((content) => {
          content.classList.toggle('active', content.id === `pd-tab-${tabName}`);
        });

        // Sync secondary sidebar active state
        if (this.secondarySidebar) {
          this.secondarySidebar.setActiveTab(tabName);
        }

        // Initialize modules for specific tabs
        if (this.currentProjectId) {
          if (tabName === 'tasks') {
            const { initTasksModule } = await import('./modules/admin-tasks');
            await initTasksModule(this.currentProjectId);
          } else if (tabName === 'time') {
            const { initTimeTrackingModule } = await import('./modules/admin-time-tracking');
            await initTimeTrackingModule(this.currentProjectId);
          } else if (tabName === 'files') {
            const { initFilesModule } = await import('./modules/admin-files');
            await initFilesModule(this.currentProjectId);
          }
        }
      });
    });

    this.setupMoreMenuDelegation();
    this.setupEventHandlers();
  }

  /**
   * Set up all event handlers
   */
  private setupEventHandlers(): void {
    const projectId = this.currentProjectId;
    if (!projectId) return;

    // Back button
    const backBtn = domCache.get('backBtn');
    if (backBtn && this.switchTabFn && !backBtn.dataset.listenerAdded) {
      backBtn.dataset.listenerAdded = 'true';
      backBtn.addEventListener('click', () => {
        this.cleanupSecondarySidebar();
        this.currentProjectId = null;
        this.switchTabFn!('projects');
      });
    }

    // More menu
    this.setupMoreMenu();

    // Send message
    const sendMsgBtn = domCache.get('sendMsgBtn');
    if (sendMsgBtn && !sendMsgBtn.dataset.listenerAdded) {
      sendMsgBtn.dataset.listenerAdded = 'true';
      sendMsgBtn.addEventListener('click', async () => {
        const success = await sendProjectMessage(projectId, this.projectsData);
        if (success) {
          loadProjectMessages(projectId, this.projectsData);
        }
      });
    }

    // Resend invite
    const resendInviteBtn = domCache.get('resendInviteBtn');
    if (resendInviteBtn && this.inviteLeadFn && !resendInviteBtn.dataset.listenerAdded) {
      resendInviteBtn.dataset.listenerAdded = 'true';
      resendInviteBtn.addEventListener('click', () => {
        const project = this.projectsData.find((p) => p.id === projectId);
        if (project && project.email && this.inviteLeadFn) {
          this.inviteLeadFn(projectId, project.email);
        } else {
          alertWarning('No email address found for this project.');
        }
      });
    }

    // Manage deliverables
    const btnManageDeliverables = domCache.get('btnManageDeliverables');
    if (btnManageDeliverables) {
      btnManageDeliverables.setAttribute('data-project-id', projectId.toString());
    }

    // Add milestone
    const addMilestoneBtn = domCache.get('addMilestoneBtn');
    if (addMilestoneBtn && !addMilestoneBtn.dataset.listenerAdded) {
      addMilestoneBtn.dataset.listenerAdded = 'true';
      addMilestoneBtn.addEventListener('click', () => {
        showAddMilestonePrompt(projectId, () => {
          loadProjectMilestones(projectId, (progress) => updateProgressBar(projectId, progress));
        });
      });
    }

    // Create invoice
    const createInvoiceBtn = domCache.get('createInvoiceBtn');
    if (createInvoiceBtn && !createInvoiceBtn.dataset.listenerAdded) {
      createInvoiceBtn.dataset.listenerAdded = 'true';
      createInvoiceBtn.addEventListener('click', () => {
        const project = this.projectsData.find((p) => p.id === projectId);
        if (project) {
          showCreateInvoicePrompt(projectId, project, () => loadProjectInvoices(projectId));
        }
      });
    }

    // Add Task button
    const btnAddTask = domCache.get('btnAddTask', true);
    if (btnAddTask && !btnAddTask.dataset.listenerAdded) {
      btnAddTask.dataset.listenerAdded = 'true';
      btnAddTask.addEventListener('click', async () => {
        const { showCreateTaskModal } = await import('./modules/admin-tasks');
        await showCreateTaskModal();
      });
    }

    // Late fees, schedule, recurring buttons
    this.setupInvoiceSchedulingHandlers(projectId);

    // Contract sign
    const contractSignBtn = domCache.get('contractSignBtn');
    if (contractSignBtn && !contractSignBtn.dataset.listenerAdded) {
      contractSignBtn.dataset.listenerAdded = 'true';
      contractSignBtn.addEventListener('click', () => handleContractSign(projectId, this.projectsData));
    }

    const contractCountersignBtn = domCache.get('contractCountersignBtn');
    if (contractCountersignBtn && !contractCountersignBtn.dataset.listenerAdded) {
      contractCountersignBtn.dataset.listenerAdded = 'true';
      contractCountersignBtn.addEventListener('click', () => handleContractCountersign(projectId, this.projectsData));
    }

    const contractBuilderBtn = domCache.get('contractBuilderBtn');
    if (contractBuilderBtn && !contractBuilderBtn.dataset.listenerAdded) {
      contractBuilderBtn.dataset.listenerAdded = 'true';
      contractBuilderBtn.addEventListener('click', () => showContractBuilder(projectId, this.projectsData));
    }

    // File upload
    setupFileUploadHandlers(projectId, () => loadProjectFiles(projectId));
  }

  /**
   * Set up the more menu via event delegation on the project-detail container.
   * This avoids reliance on DOM cache or timing so the dropdown always opens.
   */
  private setupMoreMenuDelegation(): void {
    const moreMenu = document.getElementById('pd-more-menu');
    if (!moreMenu) return;

    const trigger = moreMenu.querySelector('.custom-dropdown-trigger') as HTMLElement;
    if (!trigger || trigger.dataset.listenerAdded === 'true') return;
    trigger.dataset.listenerAdded = 'true';

    // Direct click on trigger button
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      moreMenu.classList.toggle('open');
    });

    // Handle menu item clicks
    moreMenu.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const item = target.closest('.custom-dropdown-item') as HTMLElement | null;
      if (!item) return;

      e.preventDefault();
      e.stopPropagation();
      const action = item.dataset.action;
      moreMenu.classList.remove('open');

      if (!this.currentProjectId || !action) return;

      switch (action) {
      case 'edit':
        openEditProjectModal(this.currentProjectId, this.projectsData, async () => {
          await saveProjectChanges(
              this.currentProjectId!,
              this.loadProjectsFn!,
              (p) => this.populateProjectDetailView(p),
              this.projectsData
          );
        });
        break;
      case 'duplicate':
        await duplicateProject(
          this.currentProjectId,
          this.projectsData,
            this.loadProjectsFn!,
            (id) => this.showProjectDetail(id)
        );
        break;
      case 'archive':
        await archiveProject(
          this.currentProjectId,
          this.projectsData,
            this.loadProjectsFn!,
            (id) => this.showProjectDetail(id)
        );
        break;
      case 'generate-docs':
        await showDocumentGenerationModal(this.currentProjectId, () => {
          loadProjectFiles(this.currentProjectId!);
        });
        break;
      case 'delete':
        await deleteProject(this.currentProjectId, this.projectsData, () => {
          this.cleanupSecondarySidebar();
          this.currentProjectId = null;
          this.switchTabFn?.('projects');
        });
        break;
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!moreMenu.contains(e.target as Node)) {
        moreMenu.classList.remove('open');
      }
    });
  }

  /**
   * Set up the more menu dropdown (legacy direct binding; delegation in setupMoreMenuDelegation is primary)
   */
  private setupMoreMenu(): void {
    // Delegation handles the more menu; keep this for any other one-off setup if needed
  }

  /**
   * Set up invoice scheduling handlers
   */
  private setupInvoiceSchedulingHandlers(projectId: number): void {
    const processLateFeesBtn = domCache.get('processLateFeesBtn');
    if (processLateFeesBtn && !processLateFeesBtn.dataset.listenerAdded) {
      processLateFeesBtn.dataset.listenerAdded = 'true';
      processLateFeesBtn.addEventListener('click', () => {
        processLateFees(projectId, () => loadProjectInvoices(projectId));
      });
    }

    const scheduleInvoiceBtn = domCache.get('scheduleInvoiceBtn');
    if (scheduleInvoiceBtn && !scheduleInvoiceBtn.dataset.listenerAdded) {
      scheduleInvoiceBtn.dataset.listenerAdded = 'true';
      scheduleInvoiceBtn.addEventListener('click', () => {
        showScheduleInvoicePrompt(projectId, () => loadScheduledInvoices(projectId));
      });
    }

    const setupRecurringBtn = domCache.get('setupRecurringBtn');
    if (setupRecurringBtn && !setupRecurringBtn.dataset.listenerAdded) {
      setupRecurringBtn.dataset.listenerAdded = 'true';
      setupRecurringBtn.addEventListener('click', () => {
        showSetupRecurringPrompt(projectId, () => loadRecurringInvoices(projectId));
      });
    }
  }

  /**
   * Set up custom status dropdown behavior
   */
  private setupCustomStatusDropdown(): void {
    const dropdown = domCache.get('statusDropdown');
    if (!dropdown || dropdown.dataset.listenerAdded) return;

    dropdown.dataset.listenerAdded = 'true';

    dropdown.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.closest('.custom-dropdown-trigger')) {
        e.preventDefault();
        e.stopPropagation();
        dropdown.classList.toggle('open');
        return;
      }

      const option = target.closest('.custom-dropdown-option') as HTMLElement;
      if (option) {
        const value = option.dataset.value || '';
        const hiddenInput = domCache.getAs<HTMLInputElement>('settingStatus');
        if (hiddenInput) hiddenInput.value = value;
        this.updateCustomDropdown(value);
        dropdown.classList.remove('open');
      }
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.classList.remove('open');
      }
    });
  }

  /**
   * Update custom dropdown display
   */
  private updateCustomDropdown(status: string): void {
    const trigger = domCache.get('statusTrigger');
    const valueSpan = trigger?.querySelector('.custom-dropdown-value');
    const menu = domCache.get('statusMenu');

    if (!trigger || !valueSpan) return;

    const statusLabels: Record<string, string> = {
      'pending': 'Pending',
      'active': 'Active',
      'on-hold': 'On Hold',
      on_hold: 'On Hold',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    valueSpan.textContent = statusLabels[status] || status;

    const normalizedStatus = status.replace(/_/g, '-');
    trigger.classList.remove('status-pending', 'status-active', 'status-on-hold', 'status-completed', 'status-cancelled');
    if (normalizedStatus) {
      trigger.classList.add(`status-${normalizedStatus}`);
    }

    if (menu) {
      const options = menu.querySelectorAll('.custom-dropdown-option');
      options.forEach((option) => {
        option.classList.toggle('selected', (option as HTMLElement).dataset.value === status);
      });
    }
  }

  /**
   * Parse features string
   */
  private parseFeatures(featuresStr: string): string[] {
    if (!featuresStr) return [];
    if (featuresStr.includes(',')) {
      return featuresStr.split(',').map((f) => f.trim()).filter((f) => f);
    }

    const knownFeatures = [
      'contact-form', 'social-links', 'analytics', 'mobile-optimized',
      'age-verification', 'basic-only', 'blog', 'gallery', 'testimonials',
      'booking', 'cms', 'portfolio-gallery', 'case-studies', 'resume-download',
      'shopping-cart', 'payment-processing', 'inventory-management',
      'user-accounts', 'admin-dashboard', 'product-search', 'reviews',
      'real-time-updates', 'api-integration', 'database', 'authentication',
      'dashboard', 'notifications', 'file-upload', 'offline-support',
      'tab-management', 'bookmarks', 'sync', 'dark-mode', 'keyboard-shortcuts'
    ];

    const sortedFeatures = [...knownFeatures].sort((a, b) => b.length - a.length);
    const found: string[] = [];
    let remaining = featuresStr;

    while (remaining.length > 0) {
      let matched = false;
      for (const feature of sortedFeatures) {
        const index = remaining.indexOf(feature);
        if (index !== -1) {
          found.push(feature);
          remaining = remaining.slice(0, index) + remaining.slice(index + feature.length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (remaining.trim()) found.push(remaining.trim());
        break;
      }
    }

    return found;
  }

  // ========================================
  // PUBLIC API (exposed globally for onclick)
  // ========================================

  public async toggleMilestone(milestoneId: number, isCompleted: boolean): Promise<void> {
    if (!this.currentProjectId) return;
    await toggleMilestoneModule(this.currentProjectId, milestoneId, isCompleted, () => {
      loadProjectMilestones(this.currentProjectId!, (progress) => updateProgressBar(this.currentProjectId!, progress));
    });
  }

  public async deleteMilestone(milestoneId: number): Promise<void> {
    if (!this.currentProjectId) return;
    await deleteMilestoneModule(this.currentProjectId, milestoneId, () => {
      loadProjectMilestones(this.currentProjectId!, (progress) => updateProgressBar(this.currentProjectId!, progress));
    });
  }

  public async toggleMilestoneTasks(milestoneId: number, projectId: number): Promise<void> {
    await toggleMilestoneTasksModule(milestoneId, projectId);
  }

  public async toggleTaskCompletion(taskId: number, isCompleted: boolean, projectId: number): Promise<void> {
    await toggleTaskCompletionModule(taskId, isCompleted, projectId);
  }

  public async sendInvoice(invoiceId: number): Promise<void> {
    await sendInvoiceModule(invoiceId, () => {
      if (this.currentProjectId) loadProjectInvoices(this.currentProjectId);
    });
  }

  public async editInvoice(invoiceId: number): Promise<void> {
    await editInvoiceModule(invoiceId, () => {
      if (this.currentProjectId) loadProjectInvoices(this.currentProjectId);
    });
  }

  public async markInvoicePaid(invoiceId: number): Promise<void> {
    await markInvoicePaidModule(invoiceId, () => {
      if (this.currentProjectId) loadProjectInvoices(this.currentProjectId);
    });
  }

  public async sendInvoiceReminder(invoiceId: number): Promise<void> {
    await sendInvoiceReminderModule(invoiceId);
  }

  public async duplicateInvoice(invoiceId: number): Promise<void> {
    await duplicateInvoiceModule(invoiceId, () => {
      if (this.currentProjectId) loadProjectInvoices(this.currentProjectId);
    });
  }

  public async deleteInvoice(invoiceId: number): Promise<void> {
    await deleteInvoiceModule(invoiceId, () => {
      if (this.currentProjectId) loadProjectInvoices(this.currentProjectId);
    });
  }

  public async showApplyCreditPrompt(invoiceId: number): Promise<void> {
    if (!this.currentProjectId) return;
    await showApplyCreditPromptModule(this.currentProjectId, invoiceId, () => {
      loadProjectInvoices(this.currentProjectId!);
    });
  }

  public async recordPayment(invoiceId: number): Promise<void> {
    await recordPaymentModule(invoiceId, () => {
      if (this.currentProjectId) loadProjectInvoices(this.currentProjectId);
    });
  }

  public async cancelScheduledInvoice(scheduleId: number): Promise<void> {
    if (!this.currentProjectId) return;
    await cancelScheduledInvoiceModule(scheduleId, () => {
      loadScheduledInvoices(this.currentProjectId!);
    });
  }

  public async toggleRecurringInvoice(recurringId: number, isActive: boolean): Promise<void> {
    if (!this.currentProjectId) return;
    await toggleRecurringInvoiceModule(recurringId, isActive, () => {
      loadRecurringInvoices(this.currentProjectId!);
    });
  }

  getCurrentProjectId(): number | null {
    return this.currentProjectId;
  }

  getCurrentProjectName(): string | null {
    if (!this.currentProjectId) return null;
    const project = this.projectsData.find((p) => p.id === this.currentProjectId);
    return project?.project_name ?? null;
  }
}
