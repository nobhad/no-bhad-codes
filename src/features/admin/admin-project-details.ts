/**
 * ===============================================
 * ADMIN PROJECT DETAILS HANDLER
 * ===============================================
 * @file src/features/admin/admin-project-details.ts
 *
 * Handles project detail view, including messages, files, milestones, and invoices.
 */

import { SanitizationUtils } from '../../utils/sanitization-utils';
import {
  formatFileSize,
  formatDisplayValue,
  formatTextWithLineBreaks,
  formatDate,
  formatDateTime,
  formatCurrency
} from '../../utils/format-utils';
import { AdminAuth } from './admin-auth';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../utils/api-client';
import { showToast } from '../../utils/toast-notifications';
import { createDOMCache, getElement } from '../../utils/dom-cache';
import { confirmDialog, confirmDanger, alertError, alertSuccess, alertWarning, multiPromptDialog } from '../../utils/confirm-dialog';

// Allowed file types (matches server validation)
const ALLOWED_EXTENSIONS = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar)$/i;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
  'application/vnd.rar'
];

// ============================================
// DOM CACHE - Cached element references
// ============================================

/** DOM element selector keys for the project details module */
type ProjectDetailsDOMKeys = {
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
  // Contract section
  contractSection: string;
  contractStatusBadge: string;
  contractSignedInfo: string;
  contractDate: string;
  contractPreviewBtn: string;
  contractDownloadBtn: string;
  contractSignBtn: string;
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
  // Buttons
  backBtn: string;
  editProjectBtn: string;
  sendMsgBtn: string;
  resendInviteBtn: string;
  addMilestoneBtn: string;
  createInvoiceBtn: string;
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
const domCache = createDOMCache<ProjectDetailsDOMKeys>();

// Register all element selectors (called once when module loads)
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
  // Contract section
  contractSection: '#pd-contract-section',
  contractStatusBadge: '#pd-contract-status-badge',
  contractSignedInfo: '#pd-contract-signed-info',
  contractDate: '#pd-contract-date',
  contractPreviewBtn: '#pd-contract-preview-btn',
  contractDownloadBtn: '#pd-contract-download-btn',
  contractSignBtn: '#pd-contract-sign-btn',
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
  // Buttons
  backBtn: '#btn-back-to-projects',
  editProjectBtn: '#btn-edit-project',
  sendMsgBtn: '#btn-pd-send-message',
  resendInviteBtn: '#btn-resend-invite',
  addMilestoneBtn: '#btn-add-milestone',
  createInvoiceBtn: '#btn-create-invoice',
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

import type {
  ProjectResponse,
  ProjectMilestoneResponse,
  MessageResponse,
  MessageThreadResponse,
  InvoiceResponse
} from '../../types/api';

export interface ProjectDetailsHandler {
  showProjectDetails(projectId: number, projectsData: ProjectResponse[], switchTab: (tab: string) => void, loadProjects: () => Promise<void>, formatProjectType: (type: string) => string, inviteLead: (leadId: number, email: string) => Promise<void>): void;
  toggleMilestone(milestoneId: number, isCompleted: boolean): Promise<void>;
  deleteMilestone(milestoneId: number): Promise<void>;
  sendInvoice(invoiceId: number): Promise<void>;
  getCurrentProjectId(): number | null;
}

export class AdminProjectDetails implements ProjectDetailsHandler {
  private currentProjectId: number | null = null;
  private projectsData: ProjectResponse[] = [];
  private switchTabFn?: (tab: string) => void;
  private loadProjectsFn?: () => Promise<void>;
  private formatProjectTypeFn?: (type: string) => string;
  private inviteLeadFn?: (leadId: number, email: string) => Promise<void>;

  /**
   * Navigate to full project detail view (replaces modal approach)
   * This mirrors the client portal view for admin management
   */
  showProjectDetails(
    projectId: number,
    projectsData: ProjectResponse[],
    switchTab: (tab: string) => void,
    loadProjects: () => Promise<void>,
    formatProjectType: (type: string) => string,
    inviteLead: (leadId: number, email: string) => Promise<void>
  ): void {
    const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
    if (!project) return;

    this.currentProjectId = projectId;
    this.projectsData = projectsData;
    this.switchTabFn = switchTab;
    this.loadProjectsFn = loadProjects;
    this.formatProjectTypeFn = formatProjectType;
    this.inviteLeadFn = inviteLead;

    // Switch to project-detail tab
    switchTab('project-detail');

    // Populate project detail view
    this.populateProjectDetailView(project);

    // Set up project detail sub-tabs
    this.setupProjectDetailTabs();
  }

  /**
   * Populate the project detail view with project data
   */
  private populateProjectDetailView(project: ProjectResponse): void {
    // Header info (use cached refs)
    const titleEl = domCache.get('detailTitle');
    if (titleEl) titleEl.textContent = 'Project Details';

    // Overview card (use cached refs)
    const projectName = domCache.get('projectName');
    const clientName = domCache.get('clientName');
    const clientEmail = domCache.get('clientEmail');
    const company = domCache.get('company');
    const status = domCache.get('status');
    const projectType = domCache.get('projectType');
    const budget = domCache.get('budget');
    const timeline = domCache.get('timeline');
    const startDate = domCache.get('startDate');

    if (projectName) projectName.textContent = SanitizationUtils.decodeHtmlEntities(project.project_name || 'Untitled Project');
    if (clientName) {
      clientName.textContent = SanitizationUtils.decodeHtmlEntities(project.contact_name || '-');

      // Add invite icon button if client hasn't been invited yet
      const clientLinkEl = document.getElementById('pd-client-link');
      if (clientLinkEl) {
        // Remove any existing invite button
        const existingInviteBtn = clientLinkEl.querySelector('.icon-btn-invite');
        if (existingInviteBtn) existingInviteBtn.remove();

        // Check if client needs invitation
        const projectAny = project as ProjectResponse & { invitation_sent_at?: string; invited_at?: string };
        const hasBeenInvited = !!projectAny.invitation_sent_at || !!project.password_hash || !!projectAny.invited_at;
        const isActive = project.last_login_at;
        const showInviteBtn = !isActive && !hasBeenInvited && project.email;

        if (showInviteBtn) {
          const inviteBtn = document.createElement('button');
          inviteBtn.className = 'icon-btn icon-btn-invite';
          inviteBtn.title = 'Send invitation email';
          inviteBtn.setAttribute('aria-label', 'Send invitation email to client');
          inviteBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          `;
          inviteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.currentProjectId && this.inviteLeadFn && project.email) {
              this.inviteLeadFn(this.currentProjectId, project.email);
            }
          });
          clientLinkEl.appendChild(inviteBtn);
        }
      }
    }
    if (clientEmail) clientEmail.textContent = project.email || '-';
    if (company) company.textContent = SanitizationUtils.decodeHtmlEntities(project.company_name || '-');
    if (status) {
      status.textContent = (project.status || 'pending').replace('_', ' ');
      status.className = `status-badge status-${(project.status || 'pending').replace('_', '-')}`;
    }
    if (projectType && this.formatProjectTypeFn && project.project_type) {
      projectType.textContent = this.formatProjectTypeFn(project.project_type);
    }
    if (budget) budget.textContent = formatDisplayValue(project.budget_range);
    if (timeline) timeline.textContent = formatDisplayValue(project.timeline);
    if (startDate) {
      const dateToShow = project.start_date || project.created_at;
      startDate.textContent = formatDate(dateToShow);
    }

    // Target end date
    const endDate = domCache.get('endDate');
    if (endDate) {
      endDate.textContent = formatDate(project.estimated_end_date);
    }

    // Progress
    const progressPercent = domCache.get('progressPercent');
    const progressBar = domCache.get('progressBar');
    const progress = project.progress || 0;
    if (progressPercent) progressPercent.textContent = `${progress}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;

    // Project description (use innerHTML with sanitized line breaks)
    const descriptionEl = domCache.get('description');
    if (descriptionEl) {
      descriptionEl.innerHTML = formatTextWithLineBreaks(project.description);
    }

    // Preview URL
    const previewUrlLink = domCache.getAs<HTMLAnchorElement>('previewUrlLink');
    if (previewUrlLink) {
      const u = project.preview_url ? SanitizationUtils.decodeHtmlEntities(project.preview_url) : null;
      const textEl = previewUrlLink.querySelector<HTMLElement>('.url-link-text');
      if (u) {
        previewUrlLink.href = u;
        previewUrlLink.onclick = null;
        if (textEl) textEl.textContent = u;
      } else {
        previewUrlLink.href = '#';
        previewUrlLink.onclick = (e) => e.preventDefault();
        if (textEl) textEl.textContent = '';
      }
    }

    // URLs section (repository, production)
    const urlsSection = domCache.get('urlsSection');
    const repoUrlLink = domCache.getAs<HTMLAnchorElement>('repoUrlLink');
    const productionUrlLink = domCache.getAs<HTMLAnchorElement>('productionUrlLink');

    const hasUrls = project.repository_url || project.production_url;
    if (urlsSection) {
      urlsSection.style.display = hasUrls ? 'flex' : 'none';
    }
    const setUrlLink = (link: HTMLAnchorElement | null, url: string | null): void => {
      if (!link) return;
      const decoded = url ? SanitizationUtils.decodeHtmlEntities(url) : null;
      const textEl = link.querySelector<HTMLElement>('.url-link-text');
      if (decoded) {
        link.href = decoded;
        link.onclick = null;
        if (textEl) textEl.textContent = decoded;
      } else {
        link.href = '#';
        link.onclick = (e) => e.preventDefault();
        if (textEl) textEl.textContent = '';
      }
    };
    setUrlLink(repoUrlLink, project.repository_url ?? null);
    setUrlLink(productionUrlLink, project.production_url ?? null);

    // Financial section (deposit only now - contract moved to own section)
    const financialSection = domCache.get('financialSection');
    const depositEl = domCache.get('deposit');

    const hasFinancial = project.deposit_amount;
    if (financialSection) {
      financialSection.style.display = hasFinancial ? 'flex' : 'none';
    }
    if (depositEl) {
      depositEl.textContent = project.deposit_amount ? `$${project.deposit_amount.toFixed(2)}` : '-';
    }

    // Contract section
    const contractStatusBadge = domCache.get('contractStatusBadge');
    const contractSignedInfo = domCache.get('contractSignedInfo');
    const contractDateEl = domCache.get('contractDate');
    const contractPreviewBtn = domCache.get('contractPreviewBtn') as HTMLAnchorElement | null;
    const contractDownloadBtn = domCache.get('contractDownloadBtn') as HTMLAnchorElement | null;
    const contractSignBtn = domCache.get('contractSignBtn') as HTMLButtonElement | null;

    const contractUrl = `/api/projects/${project.id}/contract/pdf`;

    // Set up preview and download links
    if (contractPreviewBtn) {
      contractPreviewBtn.href = contractUrl;
    }
    if (contractDownloadBtn) {
      contractDownloadBtn.href = contractUrl;
    }

    // Update status badge based on contract_signed_at
    if (contractStatusBadge) {
      if (project.contract_signed_at) {
        contractStatusBadge.textContent = 'Signed';
        contractStatusBadge.className = 'status-badge status-signed';
      } else {
        contractStatusBadge.textContent = 'Not Signed';
        contractStatusBadge.className = 'status-badge status-not-signed';
      }
    }

    // Show signed date if contract is signed
    if (contractSignedInfo) {
      contractSignedInfo.style.display = project.contract_signed_at ? 'flex' : 'none';
    }
    if (contractDateEl) {
      contractDateEl.textContent = formatDate(project.contract_signed_at);
    }

    // Update sign button text based on status
    const contractSignBtnText = document.getElementById('pd-contract-sign-btn-text');
    const contractSignatureCard = document.getElementById('pd-contract-signature-card');
    if (contractSignBtn && contractSignBtnText) {
      if (project.contract_signed_at) {
        contractSignBtnText.textContent = 'View Signature';
        contractSignBtn.classList.remove('primary');
      } else {
        contractSignBtnText.textContent = 'Request Signature';
        contractSignBtn.classList.add('primary');
      }
    }
    // Show/hide signature details card
    if (contractSignatureCard) {
      contractSignatureCard.style.display = project.contract_signed_at ? 'block' : 'none';
    }

    // Admin notes section
    const adminNotesSection = domCache.get('adminNotesSection');
    const adminNotesEl = domCache.get('adminNotes');

    if (adminNotesSection) {
      adminNotesSection.style.display = project.notes ? 'flex' : 'none';
    }
    if (adminNotesEl) {
      adminNotesEl.textContent = project.notes || '-';
    }

    // Features - add to notes container if features exist
    const notes = domCache.get('notes');
    if (notes && project.features) {
      // Remove existing features container if present
      const existingFeatures = notes.querySelector('.features-container');
      if (existingFeatures) existingFeatures.remove();

      // Parse features - handle both comma-separated and concatenated formats
      const featuresArray = this.parseFeatures(
        typeof project.features === 'string' ? project.features : project.features.join(', ')
      );

      // Filter out plan tiers and format as feature tags
      const excludedValues = ['basic-only', 'standard', 'premium', 'enterprise'];
      const featuresList = featuresArray
        .filter((f: string) => f && !excludedValues.includes(f.toLowerCase()))
        .map((f: string) => `<span class="feature-tag">${SanitizationUtils.escapeHtml(f.replace(/-/g, ' '))}</span>`)
        .join('');

      if (featuresList) {
        // Add features container with tags
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

    // Settings form (use cached refs)
    const settingName = domCache.getAs<HTMLInputElement>('settingName');
    const settingStatus = domCache.getAs<HTMLInputElement>('settingStatus');
    const settingProgress = domCache.getAs<HTMLInputElement>('settingProgress');

    if (settingName) settingName.value = project.project_name || '';
    if (settingStatus) {
      const projectStatus = project.status || 'pending';
      settingStatus.value = projectStatus;
      // Update custom dropdown display
      this.updateCustomDropdown(projectStatus);
      // Set up custom dropdown if not already done
      this.setupCustomStatusDropdown();
    }
    if (settingProgress) settingProgress.value = (project.progress || 0).toString();

    // Client account info in settings (use cached refs)
    const clientAccountEmail = domCache.get('clientAccountEmail');
    const clientAccountStatus = domCache.get('clientAccountStatus');
    const clientLastLogin = domCache.get('clientLastLogin');

    if (clientAccountEmail) clientAccountEmail.textContent = project.email || '-';
    if (clientAccountStatus) {
      // Check if client has account and activation status
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

    // Load project-specific data
    this.loadProjectMessages(project.id);
    this.loadProjectFiles(project.id);
    this.loadProjectMilestones(project.id);
    this.loadProjectInvoices(project.id);
  }

  /**
   * Set up project detail sub-tab navigation
   */
  private setupProjectDetailTabs(): void {
    // Set up project detail sub-tab navigation
    const tabBtns = document.querySelectorAll('.project-detail-tabs button');
    const tabContents = document.querySelectorAll('[id^="pd-tab-"]');

    tabBtns.forEach((btn) => {
      const btnEl = btn as HTMLElement;
      // Skip if already set up
      if (btnEl.dataset.listenerAdded) return;
      btnEl.dataset.listenerAdded = 'true';

      btn.addEventListener('click', async () => {
        const tabName = btnEl.dataset.pdTab;
        if (!tabName) return;

        // Update active button
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active content
        tabContents.forEach((content) => {
          content.classList.toggle('active', content.id === `pd-tab-${tabName}`);
        });

        // Initialize modules for specific tabs
        if (this.currentProjectId) {
          if (tabName === 'tasks') {
            await this.initTasksModule();
          } else if (tabName === 'time') {
            await this.initTimeTrackingModule();
          } else if (tabName === 'files') {
            await this.initFilesModule();
          }
        }
      });
    });

    // Back button handler (use cached ref)
    const backBtn = domCache.get('backBtn');
    if (backBtn && this.switchTabFn && !backBtn.dataset.listenerAdded) {
      backBtn.dataset.listenerAdded = 'true';
      backBtn.addEventListener('click', () => {
        this.currentProjectId = null;
        this.switchTabFn!('projects');
      });
    }

    // Edit project button handler (use cached ref)
    const editProjectBtn = domCache.get('editProjectBtn');
    if (editProjectBtn && !editProjectBtn.dataset.listenerAdded) {
      editProjectBtn.dataset.listenerAdded = 'true';
      editProjectBtn.addEventListener('click', () => {
        this.openEditProjectModal();
      });
    }

    // Send message handler (use cached ref)
    const sendMsgBtn = domCache.get('sendMsgBtn');
    if (sendMsgBtn && !sendMsgBtn.dataset.listenerAdded) {
      sendMsgBtn.dataset.listenerAdded = 'true';
      sendMsgBtn.addEventListener('click', () => this.sendProjectMessage());
    }

    // Resend invite handler (use cached ref)
    const resendInviteBtn = domCache.get('resendInviteBtn');
    if (resendInviteBtn && this.inviteLeadFn && !resendInviteBtn.dataset.listenerAdded) {
      resendInviteBtn.dataset.listenerAdded = 'true';
      resendInviteBtn.addEventListener('click', () => {
        if (this.currentProjectId && this.inviteLeadFn) {
          const project = this.projectsData.find((p: ProjectResponse) => p.id === this.currentProjectId);
          if (project && project.email) {
            this.inviteLeadFn(this.currentProjectId, project.email);
          } else {
            alertWarning('No email address found for this project.');
          }
        }
      });
    }

    // Add milestone handler (use cached ref)
    const addMilestoneBtn = domCache.get('addMilestoneBtn');
    if (addMilestoneBtn && !addMilestoneBtn.dataset.listenerAdded) {
      addMilestoneBtn.dataset.listenerAdded = 'true';
      addMilestoneBtn.addEventListener('click', () => {
        this.showAddMilestonePrompt();
      });
    }

    // Create invoice handler (use cached ref)
    const createInvoiceBtn = domCache.get('createInvoiceBtn');
    if (createInvoiceBtn && !createInvoiceBtn.dataset.listenerAdded) {
      createInvoiceBtn.dataset.listenerAdded = 'true';
      createInvoiceBtn.addEventListener('click', () => this.showCreateInvoicePrompt());
    }

    // Late fees button handler
    const processLateFeesBtn = domCache.get('processLateFeesBtn');
    if (processLateFeesBtn && !processLateFeesBtn.dataset.listenerAdded) {
      processLateFeesBtn.dataset.listenerAdded = 'true';
      processLateFeesBtn.addEventListener('click', () => this.processLateFees());
    }

    // Schedule invoice button handler
    const scheduleInvoiceBtn = domCache.get('scheduleInvoiceBtn');
    if (scheduleInvoiceBtn && !scheduleInvoiceBtn.dataset.listenerAdded) {
      scheduleInvoiceBtn.dataset.listenerAdded = 'true';
      scheduleInvoiceBtn.addEventListener('click', () => this.showScheduleInvoicePrompt());
    }

    // Setup recurring button handler
    const setupRecurringBtn = domCache.get('setupRecurringBtn');
    if (setupRecurringBtn && !setupRecurringBtn.dataset.listenerAdded) {
      setupRecurringBtn.dataset.listenerAdded = 'true';
      setupRecurringBtn.addEventListener('click', () => this.showSetupRecurringPrompt());
    }

    // Contract sign button handler
    const contractSignBtn = domCache.get('contractSignBtn');
    if (contractSignBtn && !contractSignBtn.dataset.listenerAdded) {
      contractSignBtn.dataset.listenerAdded = 'true';
      contractSignBtn.addEventListener('click', () => this.handleContractSign());
    }

    // Add task handler
    const addTaskBtn = document.getElementById('btn-add-task');
    if (addTaskBtn && !addTaskBtn.dataset.listenerAdded) {
      addTaskBtn.dataset.listenerAdded = 'true';
      addTaskBtn.addEventListener('click', async () => {
        const { showCreateTaskModal } = await import('./modules/admin-tasks');
        showCreateTaskModal();
      });
    }

    // File upload handlers
    this.setupFileUploadHandlers();
  }

  /**
   * Initialize tasks module for current project
   */
  private async initTasksModule(): Promise<void> {
    if (!this.currentProjectId) return;
    try {
      const { initTasksModule } = await import('./modules/admin-tasks');
      await initTasksModule(this.currentProjectId);
    } catch (error) {
      console.error('[AdminProjectDetails] Error initializing tasks module:', error);
    }
  }

  /**
   * Initialize time tracking module for current project
   */
  private async initTimeTrackingModule(): Promise<void> {
    if (!this.currentProjectId) return;
    try {
      const { initTimeTrackingModule } = await import('./modules/admin-time-tracking');
      await initTimeTrackingModule(this.currentProjectId);
    } catch (error) {
      console.error('[AdminProjectDetails] Error initializing time tracking module:', error);
    }
  }

  /**
   * Initialize files module for current project
   */
  private async initFilesModule(): Promise<void> {
    if (!this.currentProjectId) return;
    try {
      const { initFilesModule } = await import('./modules/admin-files');
      await initFilesModule(this.currentProjectId);
    } catch (error) {
      console.error('[AdminProjectDetails] Error initializing files module:', error);
    }
  }

  /**
   * Set up custom status dropdown behavior
   */
  private setupCustomStatusDropdown(): void {
    const dropdown = domCache.get('statusDropdown');

    if (!dropdown) return;

    // Skip if already set up
    if (dropdown.dataset.listenerAdded) {
      return;
    }
    dropdown.dataset.listenerAdded = 'true';

    // Use event delegation on the dropdown container
    dropdown.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle trigger click
      if (target.closest('.custom-dropdown-trigger')) {
        e.preventDefault();
        e.stopPropagation();
        dropdown.classList.toggle('open');
        return;
      }

      // Handle option click
      const option = target.closest('.custom-dropdown-option') as HTMLElement;
      if (option) {
        const value = option.dataset.value || '';
        const hiddenInput = domCache.getAs<HTMLInputElement>('settingStatus');
        if (hiddenInput) {
          hiddenInput.value = value;
        }
        this.updateCustomDropdown(value);
        dropdown.classList.remove('open');
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.classList.remove('open');
      }
    });
  }

  /**
   * Update custom dropdown display based on selected value
   */
  private updateCustomDropdown(status: string): void {
    const trigger = domCache.get('statusTrigger');
    const valueSpan = trigger?.querySelector('.custom-dropdown-value');
    const menu = domCache.get('statusMenu');

    if (!trigger || !valueSpan) return;

    // Update displayed text
    const statusLabels: Record<string, string> = {
      'pending': 'Pending',
      'active': 'Active',
      'on-hold': 'On Hold',
      on_hold: 'On Hold', // Legacy support
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    valueSpan.textContent = statusLabels[status] || status;

    // Update trigger color - normalize to hyphen format for CSS
    const normalizedStatus = status.replace(/_/g, '-');
    trigger.classList.remove('status-pending', 'status-active', 'status-on-hold', 'status-completed', 'status-cancelled');
    if (normalizedStatus) {
      trigger.classList.add(`status-${normalizedStatus}`);
    }

    // Update selected option in menu
    if (menu) {
      const options = menu.querySelectorAll('.custom-dropdown-option');
      options.forEach((option) => {
        option.classList.toggle('selected', (option as HTMLElement).dataset.value === status);
      });
    }
  }

  /**
   * Open the edit project modal with current project data
   */
  private openEditProjectModal(): void {
    if (!this.currentProjectId) return;

    const project = this.projectsData.find((p: ProjectResponse) => p.id === this.currentProjectId);
    if (!project) return;

    const modal = domCache.get('editModal');
    if (!modal) {
      console.error('[ProjectDetails] Edit project modal not found');
      return;
    }

    // Populate form fields - query fresh since values change between openings
    const nameInput = getElement('edit-project-name') as HTMLInputElement;
    const typeSelect = getElement('edit-project-type') as HTMLSelectElement;
    const budgetInput = getElement('edit-project-budget') as HTMLInputElement;
    const priceInput = getElement('edit-project-price') as HTMLInputElement;
    const timelineInput = getElement('edit-project-timeline') as HTMLInputElement;
    const previewUrlInput = getElement('edit-project-preview-url') as HTMLInputElement;
    const statusSelect = getElement('edit-project-status') as HTMLSelectElement;
    const startDateInput = getElement('edit-project-start-date') as HTMLInputElement;
    const endDateInput = getElement('edit-project-end-date') as HTMLInputElement;
    const depositInput = getElement('edit-project-deposit') as HTMLInputElement;
    const contractDateInput = getElement('edit-project-contract-date') as HTMLInputElement;
    const repoUrlInput = getElement('edit-project-repo-url') as HTMLInputElement;
    const productionUrlInput = getElement('edit-project-production-url') as HTMLInputElement;
    const notesInput = getElement('edit-project-notes') as HTMLTextAreaElement;

    if (nameInput) nameInput.value = project.project_name || '';
    if (typeSelect) typeSelect.value = project.project_type || '';
    if (budgetInput) budgetInput.value = project.budget_range || '';
    if (priceInput) priceInput.value = project.price ? String(project.price) : '';
    if (timelineInput) timelineInput.value = project.timeline || '';
    if (previewUrlInput) previewUrlInput.value = project.preview_url || '';
    if (statusSelect) statusSelect.value = project.status || 'pending';
    if (startDateInput) startDateInput.value = project.start_date ? project.start_date.split('T')[0] : '';
    if (endDateInput) endDateInput.value = project.estimated_end_date ? project.estimated_end_date.split('T')[0] : '';
    if (depositInput) depositInput.value = project.deposit_amount ? String(project.deposit_amount) : '';
    if (contractDateInput) contractDateInput.value = project.contract_signed_at ? project.contract_signed_at.split('T')[0] : '';
    if (repoUrlInput) repoUrlInput.value = project.repository_url || '';
    if (productionUrlInput) productionUrlInput.value = project.production_url || '';
    if (notesInput) notesInput.value = project.notes || '';

    // Show modal and lock body scroll
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    // Setup close handlers (use cached refs)
    const closeBtn = domCache.get('editClose');
    const cancelBtn = domCache.get('editCancel');
    const form = domCache.getAs<HTMLFormElement>('editForm');

    const closeModal = () => {
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    };

    closeBtn?.addEventListener('click', closeModal, { once: true });
    cancelBtn?.addEventListener('click', closeModal, { once: true });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    }, { once: true });

    // Handle form submit
    if (form) {
      const handleSubmit = async (e: Event) => {
        e.preventDefault();
        await this.saveProjectChanges();
        closeModal();
      };
      form.removeEventListener('submit', handleSubmit);
      form.addEventListener('submit', handleSubmit, { once: true });
    }
  }

  /**
   * Save project changes from the edit modal
   */
  private async saveProjectChanges(): Promise<void> {
    if (!this.currentProjectId || !this.loadProjectsFn) return;

    if (!AdminAuth.isAuthenticated()) return;

    // Form inputs - query fresh for current values
    const nameInput = getElement('edit-project-name') as HTMLInputElement;
    const typeSelect = getElement('edit-project-type') as HTMLSelectElement;
    const budgetInput = getElement('edit-project-budget') as HTMLInputElement;
    const priceInput = getElement('edit-project-price') as HTMLInputElement;
    const timelineInput = getElement('edit-project-timeline') as HTMLInputElement;
    const previewUrlInput = getElement('edit-project-preview-url') as HTMLInputElement;
    const statusSelect = getElement('edit-project-status') as HTMLSelectElement;
    const startDateInput = getElement('edit-project-start-date') as HTMLInputElement;
    const endDateInput = getElement('edit-project-end-date') as HTMLInputElement;
    const depositInput = getElement('edit-project-deposit') as HTMLInputElement;
    const contractDateInput = getElement('edit-project-contract-date') as HTMLInputElement;
    const repoUrlInput = getElement('edit-project-repo-url') as HTMLInputElement;
    const productionUrlInput = getElement('edit-project-production-url') as HTMLInputElement;
    const notesInput = getElement('edit-project-notes') as HTMLTextAreaElement;

    const updates: Record<string, string> = {};
    if (nameInput?.value) updates.project_name = nameInput.value;
    if (typeSelect?.value) updates.project_type = typeSelect.value;
    if (budgetInput?.value) updates.budget = budgetInput.value;
    if (priceInput?.value) updates.price = priceInput.value;
    if (timelineInput?.value) updates.timeline = timelineInput.value;
    if (previewUrlInput?.value !== undefined) updates.preview_url = previewUrlInput.value;
    if (statusSelect?.value) updates.status = statusSelect.value;
    if (startDateInput?.value !== undefined) updates.start_date = startDateInput.value;
    if (endDateInput?.value !== undefined) updates.estimated_end_date = endDateInput.value;
    if (depositInput?.value !== undefined) updates.deposit_amount = depositInput.value;
    if (contractDateInput?.value !== undefined) updates.contract_signed_at = contractDateInput.value;
    if (repoUrlInput?.value !== undefined) updates.repository_url = repoUrlInput.value;
    if (productionUrlInput?.value !== undefined) updates.production_url = productionUrlInput.value;
    if (notesInput?.value !== undefined) updates.notes = notesInput.value;

    try {
      const response = await apiPut(`/api/projects/${this.currentProjectId}`, updates);

      if (response.ok) {
        // Refresh project data
        await this.loadProjectsFn();
        // Re-populate the view
        const project = this.projectsData.find((p: ProjectResponse) => p.id === this.currentProjectId);
        if (project) {
          this.populateProjectDetailView(project);
        }
      } else {
        alertError('Failed to save project. Please try again.');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error saving project:', error);
      alertError('Failed to save project. Please try again.');
    }
  }

  /**
   * Load messages for the current project using thread-based messaging system
   */
  private currentThreadId: number | null = null;

  private async loadProjectMessages(projectId: number): Promise<void> {
    const messagesThread = domCache.get('messagesThread');
    if (!messagesThread) return;

    if (!AdminAuth.isAuthenticated()) {
      messagesThread.innerHTML =
        '<p class="empty-state">Authentication required to view messages.</p>';
      return;
    }

    try {
      // Get the client ID for this project
      const project = this.projectsData.find((p: ProjectResponse) => p.id === projectId);
      if (!project || !project.client_id) {
        messagesThread.innerHTML =
          '<p class="empty-state">No client account linked. Invite the client first to enable messaging.</p>';
        return;
      }

      // Get all threads and find one for this project/client
      const threadsResponse = await apiFetch('/api/messages/threads');

      if (!threadsResponse.ok) {
        messagesThread.innerHTML = '<p class="empty-state">Error loading messages.</p>';
        return;
      }

      const threadsData = await threadsResponse.json() as { threads?: MessageThreadResponse[] };
      const threads: MessageThreadResponse[] = threadsData.threads || [];

      // Find thread for this project or client
      let thread = threads.find((t: MessageThreadResponse) => t.project_id === projectId);
      if (!thread && project.client_id) {
        thread = threads.find((t: MessageThreadResponse) => t.client_id === project.client_id);
      }

      if (!thread) {
        this.currentThreadId = null;
        messagesThread.innerHTML =
          '<p class="empty-state">No messages yet. Start the conversation with your client.</p>';
        return;
      }

      this.currentThreadId = thread.id;

      // Get messages in this thread
      const messagesResponse = await apiFetch(`/api/messages/threads/${thread.id}/messages`);

      if (!messagesResponse.ok) {
        messagesThread.innerHTML = '<p class="empty-state">Error loading messages.</p>';
        return;
      }

      const messagesData = await messagesResponse.json() as { messages?: MessageResponse[] };
      const messages: MessageResponse[] = messagesData.messages || [];

      if (messages.length === 0) {
        messagesThread.innerHTML =
          '<p class="empty-state">No messages yet. Start the conversation with your client.</p>';
      } else {
        messagesThread.innerHTML = messages
          .map((msg: MessageResponse) => {
            // Sanitize user data to prevent XSS
            const safeSenderName = SanitizationUtils.escapeHtml(
              msg.sender_type === 'admin' ? 'You' : (msg.sender_name || project.contact_name || 'Client')
            );
            const safeContent = SanitizationUtils.escapeHtml(msg.message || '');
            return `
            <div class="message ${msg.sender_type === 'admin' ? 'message-sent' : 'message-received'}">
              <div class="message-content">
                <div class="message-header">
                  <span class="message-sender">${safeSenderName}</span>
                  <span class="message-time">${formatDateTime(msg.created_at)}</span>
                </div>
                <div class="message-body">${safeContent}</div>
              </div>
            </div>
          `;
          })
          .join('');
        // Scroll to bottom
        messagesThread.scrollTop = messagesThread.scrollHeight;
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error loading project messages:', error);
      messagesThread.innerHTML = '<p class="empty-state">Error loading messages.</p>';
    }
  }

  /**
   * Send a message for the current project using thread-based messaging
   */
  private async sendProjectMessage(): Promise<void> {
    if (!this.currentProjectId) return;

    const messageInput = domCache.getAs<HTMLTextAreaElement>('messageInput');
    if (!messageInput || !messageInput.value.trim()) return;

    if (!AdminAuth.isAuthenticated()) return;

    const project = this.projectsData.find((p: ProjectResponse) => p.id === this.currentProjectId);
    if (!project || !project.client_id) {
      alertWarning('No client account linked. Invite the client first.');
      return;
    }

    try {
      // If no existing thread, create one
      if (!this.currentThreadId) {
        const createResponse = await apiPost('/api/messages/threads', {
          client_id: project.client_id,
          project_id: this.currentProjectId,
          subject: `Project: ${project.project_name || 'Untitled'}`,
          thread_type: 'project',
          message: messageInput.value.trim()
        });

        if (createResponse.ok) {
          const data = await createResponse.json();
          this.currentThreadId = data.thread?.id || data.threadId;
          messageInput.value = '';
          this.loadProjectMessages(this.currentProjectId!);
        } else {
          alertError('Failed to create message thread');
        }
        return;
      }

      // Send message to existing thread
      const response = await apiPost(`/api/messages/threads/${this.currentThreadId}/messages`, {
        message: messageInput.value.trim()
      });

      if (response.ok) {
        messageInput.value = '';
        // Reload messages
        this.loadProjectMessages(this.currentProjectId!);
      } else {
        alertError('Failed to send message');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error sending message:', error);
      alertError('Error sending message');
    }
  }

  /**
   * Load files for the current project
   */
  private async loadProjectFiles(projectId: number): Promise<void> {
    const filesList = domCache.get('filesList');
    if (!filesList) return;

    if (!AdminAuth.isAuthenticated()) {
      filesList.innerHTML = '<p class="empty-state">Authentication required to view files.</p>';
      return;
    }

    try {
      const response = await apiFetch(`/api/uploads/project/${projectId}`);

      if (response.ok) {
        const data = await response.json();
        const files = data.files || [];

        if (files.length === 0) {
          filesList.innerHTML = '<p class="empty-state">No files yet. Upload files above.</p>';
        } else {
          filesList.innerHTML = files
            .map(
              (file: any) => `
            <div class="file-item">
              <span class="file-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </span>
              <div class="file-info">
                <span class="file-name">${file.originalName || file.filename}</span>
                <span class="file-meta">Uploaded ${formatDate(file.uploadedAt)} - ${formatFileSize(file.size)}</span>
              </div>
              <div class="file-actions">
                <a href="/api/uploads/file/${file.id}" class="btn btn-outline btn-sm" target="_blank">Download</a>
              </div>
            </div>
          `
            )
            .join('');
        }
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error loading project files:', error);
      filesList.innerHTML = '<p class="empty-state">Error loading files.</p>';
    }
  }

  /**
   * Load milestones for the current project
   */
  private async loadProjectMilestones(projectId: number): Promise<void> {
    const milestonesList = domCache.get('milestonesList');
    if (!milestonesList) return;

    if (!AdminAuth.isAuthenticated()) {
      milestonesList.innerHTML = '<p class="empty-state">Authentication required.</p>';
      return;
    }

    try {
      const response = await apiFetch(`/api/projects/${projectId}/milestones`);

      if (response.ok) {
        const data = await response.json();
        const milestones = data.milestones || [];

        if (milestones.length === 0) {
          milestonesList.innerHTML =
            '<p class="empty-state">No milestones yet. Add milestones to track project progress.</p>';
        } else {
          milestonesList.innerHTML = milestones
            .map((m: ProjectMilestoneResponse) => {
              // Sanitize user data to prevent XSS
              const safeTitle = SanitizationUtils.escapeHtml(m.title || '');
              const safeDescription = SanitizationUtils.escapeHtml(m.description || '');
              const deliverablesArray = Array.isArray(m.deliverables)
                ? m.deliverables
                : (typeof m.deliverables === 'string' && m.deliverables.trim()
                  ? [m.deliverables]
                  : []);
              const safeDeliverables =
                deliverablesArray.length > 0
                  ? deliverablesArray
                    .map((d: string) => `<li>${SanitizationUtils.escapeHtml(d)}</li>`)
                    .join('')
                  : '';
              return `
            <div class="milestone-item ${m.is_completed ? 'completed' : ''}" data-milestone-id="${m.id}">
              <div class="milestone-checkbox">
                <input type="checkbox" ${m.is_completed ? 'checked' : ''}
                       onchange="window.adminDashboard?.toggleMilestone(${m.id}, this.checked)">
              </div>
              <div class="milestone-content">
                <div class="milestone-header">
                  <h4 class="milestone-title">${safeTitle}</h4>
                  ${m.due_date ? `<span class="milestone-due-date">${formatDate(m.due_date)}</span>` : ''}
                </div>
                ${safeDescription ? `<p class="milestone-description">${safeDescription}</p>` : ''}
                ${safeDeliverables ? `<ul class="milestone-deliverables">${safeDeliverables}</ul>` : ''}
              </div>
              <button class="btn btn-danger btn-sm" onclick="window.adminDashboard?.deleteMilestone(${m.id})">Delete</button>
            </div>
          `;
            })
            .join('');

          // Calculate and update progress based on completed milestones
          const completedCount = milestones.filter((m: ProjectMilestoneResponse) => m.is_completed).length;
          const totalCount = milestones.length;
          const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          this.updateProgressBar(progress);
        }
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error loading milestones:', error);
      milestonesList.innerHTML = '<p class="empty-state">Error loading milestones.</p>';
    }
  }

  /**
   * Update the progress bar display and save to database
   */
  private updateProgressBar(progress: number): void {
    const progressPercent = domCache.get('progressPercent');
    const progressBar = domCache.get('progressBar');
    const progressBarContainer = domCache.get('progressBarContainer');

    if (progressPercent) {
      progressPercent.textContent = `${progress}%`;
    }
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
    // Update aria-valuenow for screen readers
    if (progressBarContainer) {
      progressBarContainer.setAttribute('aria-valuenow', progress.toString());
    }

    // Save progress to database
    if (this.currentProjectId) {
      apiPut(`/api/projects/${this.currentProjectId}`, { progress })
        .catch(err => console.error('[AdminProjectDetails] Error saving progress:', err));
    }
  }

  /**
   * Show prompt to add a new milestone
   */
  private async showAddMilestonePrompt(): Promise<void> {
    if (!this.currentProjectId) return;

    const defaultDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await multiPromptDialog({
      title: 'Add Milestone',
      fields: [
        {
          name: 'title',
          label: 'Milestone Title',
          type: 'text',
          placeholder: 'Enter milestone title',
          required: true
        },
        {
          name: 'description',
          label: 'Description (optional)',
          type: 'textarea',
          placeholder: 'Enter milestone description'
        },
        {
          name: 'dueDate',
          label: 'Due Date (optional)',
          type: 'date',
          defaultValue: defaultDueDate
        }
      ],
      confirmText: 'Add Milestone',
      cancelText: 'Cancel'
    });

    if (!result) return;

    this.addMilestone(result.title, result.description || '', result.dueDate || '');
  }

  /**
   * Add a new milestone to the current project
   */
  private async addMilestone(title: string, description: string, dueDate: string): Promise<void> {
    if (!this.currentProjectId) return;

    if (!AdminAuth.isAuthenticated()) return;

    try {
      const response = await apiPost(`/api/projects/${this.currentProjectId}/milestones`, {
        title,
        description: description || null,
        due_date: dueDate || null,
        deliverables: []
      });

      if (response.ok) {
        this.loadProjectMilestones(this.currentProjectId);
      } else {
        alertError('Failed to add milestone. Please try again.');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error adding milestone:', error);
      alertError('Failed to add milestone. Please try again.');
    }
  }

  /**
   * Toggle milestone completion status (exposed globally for onclick)
   */
  public async toggleMilestone(milestoneId: number, isCompleted: boolean): Promise<void> {
    if (!this.currentProjectId) return;

    if (!AdminAuth.isAuthenticated()) return;

    try {
      const response = await apiPut(
        `/api/projects/${this.currentProjectId}/milestones/${milestoneId}`,
        { is_completed: isCompleted }
      );

      if (response.ok) {
        this.loadProjectMilestones(this.currentProjectId);
      } else {
        alertError('Failed to update milestone. Please try again.');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error toggling milestone:', error);
      alertError('Failed to update milestone. Please try again.');
    }
  }

  /**
   * Delete a milestone (exposed globally for onclick)
   */
  public async deleteMilestone(milestoneId: number): Promise<void> {
    if (!this.currentProjectId) return;

    const confirmed = await confirmDanger(
      'Are you sure you want to delete this milestone?',
      'Delete Milestone'
    );
    if (!confirmed) return;

    if (!AdminAuth.isAuthenticated()) return;

    try {
      const response = await apiDelete(
        `/api/projects/${this.currentProjectId}/milestones/${milestoneId}`
      );

      if (response.ok) {
        this.loadProjectMilestones(this.currentProjectId);
      } else {
        alertError('Failed to delete milestone. Please try again.');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error deleting milestone:', error);
      alertError('Failed to delete milestone. Please try again.');
    }
  }

  /**
   * Load invoices for the current project
   */
  private async loadProjectInvoices(projectId: number): Promise<void> {
    const invoicesList = domCache.get('invoicesList');
    const outstandingEl = domCache.get('outstanding');
    const paidEl = domCache.get('paid');

    if (!invoicesList) return;

    if (!AdminAuth.isAuthenticated()) {
      invoicesList.innerHTML = '<p class="empty-state">Authentication required.</p>';
      return;
    }

    try {
      const response = await apiFetch(`/api/invoices/project/${projectId}`);

      if (response.ok) {
        const data = await response.json();
        const invoices: InvoiceResponse[] = data.invoices || [];

        // Calculate totals
        let totalOutstanding = 0;
        let totalPaid = 0;

        invoices.forEach((inv: InvoiceResponse) => {
          const amount = typeof inv.amount_total === 'string' ? parseFloat(inv.amount_total) : (inv.amount_total || 0);
          const paid = typeof inv.amount_paid === 'string' ? parseFloat(inv.amount_paid) : (inv.amount_paid || 0);
          if (inv.status === 'paid') {
            totalPaid += amount;
          } else if (['sent', 'viewed', 'partial', 'overdue'].includes(inv.status)) {
            totalOutstanding += amount - paid;
            totalPaid += paid;
          }
        });

        if (outstandingEl) outstandingEl.textContent = `$${totalOutstanding.toFixed(2)}`;
        if (paidEl) paidEl.textContent = `$${totalPaid.toFixed(2)}`;

        if (invoices.length === 0) {
          invoicesList.innerHTML = '<p class="empty-state">No invoices yet. Create one above.</p>';
        } else {
          // Extend invoice type for deposit fields
          type ExtendedInvoice = InvoiceResponse & { invoice_type?: string };

          invoicesList.innerHTML = invoices
            .map((inv: ExtendedInvoice) => {
              const statusClass =
                inv.status === 'paid'
                  ? 'status-completed'
                  : inv.status === 'overdue'
                    ? 'status-cancelled'
                    : 'status-active';
              // Determine which action buttons to show
              const isDraft = inv.status === 'draft';
              const isCancelled = inv.status === 'cancelled';
              const isPaid = inv.status === 'paid';
              const isOutstanding = ['sent', 'viewed', 'partial', 'overdue'].includes(inv.status);
              const showSendBtn = isDraft;
              const showEditBtn = isDraft;
              const showRecordPaymentBtn = isOutstanding;
              const showMarkPaidBtn = isOutstanding;
              const showReminderBtn = isOutstanding;
              const showApplyCreditBtn = inv.invoice_type !== 'deposit' && isOutstanding;
              const showDuplicateBtn = !isCancelled;
              const showDeleteBtn = !isPaid;
              const isDeposit = inv.invoice_type === 'deposit';

              return `
              <div class="invoice-item${isDeposit ? ' invoice-deposit' : ''}">
                <div class="invoice-info">
                  <strong>${inv.invoice_number || `INV-${inv.id}`}</strong>
                  ${isDeposit ? '<span class="invoice-type-badge">DEPOSIT</span>' : ''}
                  <span class="invoice-date">${formatDate(inv.created_at)}</span>
                </div>
                <div class="invoice-amount">$${(typeof inv.amount_total === 'string' ? parseFloat(inv.amount_total) : (inv.amount_total || 0)).toFixed(2)}</div>
                <span class="status-badge ${statusClass}">${inv.status}</span>
                <div class="invoice-actions">
                  <a href="/api/invoices/${inv.id}/pdf" class="btn btn-outline btn-sm" target="_blank">PDF</a>
                  ${showEditBtn ? `<button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.editInvoice(${inv.id})">Edit</button>` : ''}
                  ${showSendBtn ? `<button class="btn btn-secondary btn-sm" onclick="window.adminDashboard?.sendInvoice(${inv.id})">Send</button>` : ''}
                  ${showRecordPaymentBtn ? `<button class="btn btn-success btn-sm" onclick="window.adminDashboard?.recordPayment(${inv.id})">Record Payment</button>` : ''}
                  ${showMarkPaidBtn ? `<button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.markInvoicePaid(${inv.id})">Mark Paid</button>` : ''}
                  ${showApplyCreditBtn ? `<button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.showApplyCreditPrompt(${inv.id})">Apply Credit</button>` : ''}
                  ${showReminderBtn ? `<button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.sendInvoiceReminder(${inv.id})">Remind</button>` : ''}
                  ${showDuplicateBtn ? `<button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.duplicateInvoice(${inv.id})">Duplicate</button>` : ''}
                  ${showDeleteBtn ? `<button class="btn btn-danger btn-sm" onclick="window.adminDashboard?.deleteInvoice(${inv.id})">Delete</button>` : ''}
                </div>
              </div>
            `;
            })
            .join('');
        }
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error loading invoices:', error);
      invoicesList.innerHTML = '<p class="empty-state">Error loading invoices.</p>';
    }
  }

  /**
   * Handle contract sign button click
   */
  private async handleContractSign(): Promise<void> {
    if (!this.currentProjectId) return;

    const project = this.projectsData.find((p: ProjectResponse) => p.id === this.currentProjectId);
    if (!project) return;

    if (project.contract_signed_at) {
      // Contract already signed - show signature info
      showToast(`Contract signed on ${formatDate(project.contract_signed_at)}`, 'info');
      return;
    }

    // Contract not signed - request signature
    const confirmed = await confirmDialog({
      title: 'Request Contract Signature',
      message: `Send a contract signature request to ${project.client_name || 'the client'}?\n\nThe client will receive an email with a link to review and sign the contract.`,
      confirmText: 'Send Request',
      cancelText: 'Cancel',
      icon: 'question'
    });

    if (!confirmed) return;

    try {
      const response = await apiFetch(`/api/projects/${this.currentProjectId}/contract/request-signature`, {
        method: 'POST'
      });

      if (response.ok) {
        showToast('Signature request sent successfully', 'success');
      } else {
        const error = await response.json();
        showToast(error.message || 'Failed to send signature request', 'error');
      }
    } catch (error) {
      console.error('Error requesting signature:', error);
      showToast('Failed to send signature request', 'error');
    }
  }

  /**
   * Show custom modal to create a new invoice with multiple line items
   */
  private showCreateInvoicePrompt(): void {
    if (!this.currentProjectId) return;

    const project = this.projectsData.find((p: ProjectResponse) => p.id === this.currentProjectId);
    if (!project) return;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.id = 'create-invoice-modal';

    // Line items data
    const lineItems: { description: string; quantity: number; rate: number }[] = [
      { description: 'Web Development Services', quantity: 1, rate: project.price || 500 }
    ];

    // Helper functions (defined before use)
    const saveCurrentValues = (): void => {
      const rows = overlay.querySelectorAll('.line-item-row');
      rows.forEach((row, index) => {
        if (lineItems[index]) {
          const desc = row.querySelector('.line-item-desc') as HTMLInputElement;
          const qty = row.querySelector('.line-item-qty') as HTMLInputElement;
          const rate = row.querySelector('.line-item-rate') as HTMLInputElement;
          lineItems[index].description = desc?.value || '';
          lineItems[index].quantity = parseInt(qty?.value) || 1;
          lineItems[index].rate = parseFloat(rate?.value) || 0;
        }
      });
    };

    const updateLineItemAmounts = (): void => {
      const rows = overlay.querySelectorAll('.line-item-row');
      let total = 0;
      rows.forEach((row) => {
        const qty = parseFloat((row.querySelector('.line-item-qty') as HTMLInputElement)?.value) || 1;
        const rate = parseFloat((row.querySelector('.line-item-rate') as HTMLInputElement)?.value) || 0;
        const amount = qty * rate;
        total += amount;
        const amountSpan = row.querySelector('.line-item-amount');
        if (amountSpan) amountSpan.textContent = `$${amount.toFixed(2)}`;
      });
      const totalEl = overlay.querySelector('.invoice-total strong');
      if (totalEl) totalEl.textContent = `Total: $${total.toFixed(2)}`;
    };

    const closeModal = (): void => {
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 150);
    };

    const submitInvoice = async (): Promise<void> => {
      saveCurrentValues();

      // Validate line items
      const validLineItems = lineItems.filter(item => item.description.trim() && item.rate > 0);
      if (validLineItems.length === 0) {
        alertWarning('Please add at least one line item with description and amount');
        return;
      }

      const typeSelect = overlay.querySelector('#invoice-type-select') as HTMLSelectElement;
      const isDeposit = typeSelect?.value === 'deposit';
      const depositPercentageInput = overlay.querySelector('#deposit-percentage') as HTMLInputElement;
      const depositPercentage = isDeposit && depositPercentageInput ? parseFloat(depositPercentageInput.value) : undefined;

      // Calculate total
      const totalAmount = validLineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);

      closeModal();

      if (isDeposit) {
        // For deposit, use first line item description
        await this.createDepositInvoice(
          project.client_id,
          validLineItems[0].description,
          totalAmount,
          depositPercentage
        );
      } else {
        await this.createInvoiceWithLineItems(project.client_id, validLineItems);
      }
    };

    // Render the modal (defined before attachModalHandlers which uses it)
    const renderModal = (): void => {
      const totalAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);

      overlay.innerHTML = `
        <div class="confirm-dialog invoice-modal">
          <div class="confirm-dialog-icon info">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <h3 class="confirm-dialog-title">Create Invoice</h3>

          <div class="invoice-modal-form">
            <div class="form-group">
              <label class="form-label">Invoice Type *</label>
              <select id="invoice-type-select" class="form-input">
                <option value="standard">Standard Invoice</option>
                <option value="deposit">Deposit Invoice</option>
              </select>
            </div>

            <div class="form-group deposit-field" style="display: none;">
              <label class="form-label">Deposit Percentage</label>
              <input type="number" id="deposit-percentage" class="form-input" value="50" min="1" max="100" placeholder="e.g., 50">
            </div>

            <div class="form-group">
              <label class="form-label">Line Items</label>
              <div class="line-items-container">
                ${lineItems.map((item, index) => `
                  <div class="line-item-row" data-index="${index}">
                    <input type="text" class="form-input line-item-desc" placeholder="Description" value="${SanitizationUtils.escapeHtml(item.description)}" required>
                    <input type="number" class="form-input line-item-qty" placeholder="Qty" value="${item.quantity}" min="1" style="width: 70px;">
                    <input type="number" class="form-input line-item-rate" placeholder="Rate" value="${item.rate}" min="0" step="0.01" style="width: 100px;">
                    <span class="line-item-amount">$${(item.quantity * item.rate).toFixed(2)}</span>
                    ${lineItems.length > 1 ? `<button type="button" class="btn-remove-line" data-index="${index}" title="Remove">&times;</button>` : ''}
                  </div>
                `).join('')}
              </div>
              <button type="button" class="btn btn-outline btn-sm" id="btn-add-line-item">+ Add Line Item</button>
            </div>

            <div class="invoice-total">
              <strong>Total: $${totalAmount.toFixed(2)}</strong>
            </div>
          </div>

          <div class="confirm-dialog-actions">
            <button type="button" class="confirm-dialog-btn confirm-dialog-cancel">Cancel</button>
            <button type="button" class="confirm-dialog-btn confirm-dialog-confirm">Create Invoice</button>
          </div>
        </div>
      `;

      // Attach event handlers inline
      // Invoice type change - show/hide deposit percentage
      const typeSelect = overlay.querySelector('#invoice-type-select') as HTMLSelectElement;
      const depositField = overlay.querySelector('.deposit-field') as HTMLElement;
      typeSelect?.addEventListener('change', () => {
        if (depositField) {
          depositField.style.display = typeSelect.value === 'deposit' ? 'block' : 'none';
        }
      });

      // Add line item button
      const addLineBtn = overlay.querySelector('#btn-add-line-item');
      addLineBtn?.addEventListener('click', () => {
        lineItems.push({ description: '', quantity: 1, rate: 0 });
        saveCurrentValues();
        renderModal();
      });

      // Remove line item buttons
      overlay.querySelectorAll('.btn-remove-line').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt((e.target as HTMLElement).dataset.index || '0');
          lineItems.splice(index, 1);
          saveCurrentValues();
          renderModal();
        });
      });

      // Update amounts on input change
      overlay.querySelectorAll('.line-item-qty, .line-item-rate').forEach(input => {
        input.addEventListener('input', () => {
          updateLineItemAmounts();
        });
      });

      // Cancel button
      overlay.querySelector('.confirm-dialog-cancel')?.addEventListener('click', closeModal);

      // Confirm button
      overlay.querySelector('.confirm-dialog-confirm')?.addEventListener('click', submitInvoice);

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });

      // Close on Escape
      const escHandler = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
          closeModal();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    };

    // Initial render
    renderModal();
    document.body.appendChild(overlay);

    // Focus first input
    setTimeout(() => {
      const firstInput = overlay.querySelector('.line-item-desc') as HTMLInputElement;
      firstInput?.focus();
    }, 100);
  }

  /**
   * Create invoice with multiple line items
   */
  private async createInvoiceWithLineItems(
    clientId: number,
    lineItems: { description: string; quantity: number; rate: number }[]
  ): Promise<void> {
    if (!this.currentProjectId) return;

    if (!AdminAuth.isAuthenticated()) return;

    try {
      const response = await apiPost('/api/invoices', {
        projectId: this.currentProjectId,
        clientId,
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.quantity * item.rate
        })),
        notes: '',
        terms: 'Payment due within 30 days'
      });

      if (response.ok) {
        alertSuccess('Invoice created successfully!');
        this.loadProjectInvoices(this.currentProjectId);
      } else {
        alertError('Failed to create invoice. Please try again.');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error creating invoice:', error);
      alertError('Failed to create invoice. Please try again.');
    }
  }

  /**
   * Create a deposit invoice for the current project
   */
  private async createDepositInvoice(
    clientId: number,
    description: string,
    amount: number,
    percentage?: number
  ): Promise<void> {
    if (!this.currentProjectId) return;

    if (!AdminAuth.isAuthenticated()) return;

    try {
      const response = await apiPost('/api/invoices/deposit', {
        projectId: this.currentProjectId,
        clientId,
        amount,
        percentage,
        description
      });

      if (response.ok) {
        alertSuccess('Deposit invoice created successfully!');
        this.loadProjectInvoices(this.currentProjectId);
      } else {
        alertError('Failed to create deposit invoice. Please try again.');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error creating deposit invoice:', error);
      alertError('Failed to create deposit invoice. Please try again.');
    }
  }

  /**
   * Edit a draft invoice (exposed globally for onclick)
   */
  public async editInvoice(invoiceId: number): Promise<void> {
    console.log('[EditInvoice] Called with invoiceId:', invoiceId);
    if (!AdminAuth.isAuthenticated()) {
      console.log('[EditInvoice] Not authenticated');
      return;
    }

    try {
      // Fetch current invoice data
      console.log('[EditInvoice] Fetching invoice data...');
      const response = await apiFetch(`/api/invoices/${invoiceId}`);
      console.log('[EditInvoice] Response status:', response.status, response.ok);
      if (!response.ok) {
        alertError('Failed to load invoice');
        return;
      }

      const data = await response.json();
      console.log('[EditInvoice] Invoice data:', data);
      const invoice = data.invoice;

      if (invoice.status !== 'draft') {
        alertWarning('Only draft invoices can be edited');
        return;
      }

      // Get current line item (backend returns camelCase)
      const lineItems = invoice.lineItems || [];
      const firstItem = lineItems[0] || { description: '', amount: 0 };

      const result = await multiPromptDialog({
        title: 'Edit Invoice',
        fields: [
          {
            name: 'description',
            label: 'Line Item Description',
            type: 'text',
            defaultValue: firstItem.description || '',
            required: true
          },
          {
            name: 'amount',
            label: 'Amount ($)',
            type: 'number',
            defaultValue: String(firstItem.amount || 0),
            placeholder: 'Enter amount',
            required: true
          },
          {
            name: 'notes',
            label: 'Notes (optional)',
            type: 'textarea',
            defaultValue: invoice.notes || ''
          }
        ],
        confirmText: 'Save Changes',
        cancelText: 'Cancel'
      });

      if (!result) return;

      const amount = parseFloat(result.amount);
      if (isNaN(amount) || amount <= 0) {
        alertWarning('Please enter a valid amount');
        return;
      }

      const updateResponse = await apiPut(`/api/invoices/${invoiceId}`, {
        lineItems: [{
          description: result.description,
          quantity: 1,
          rate: amount,
          amount
        }],
        notes: result.notes || ''
      });

      if (updateResponse.ok) {
        alertSuccess('Invoice updated successfully!');
        if (this.currentProjectId) {
          this.loadProjectInvoices(this.currentProjectId);
        }
      } else {
        alertError('Failed to update invoice');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error editing invoice:', error);
      alertError('Error editing invoice');
    }
  }

  /**
   * Show prompt to apply deposit credit to an invoice (exposed globally for onclick)
   */
  public async showApplyCreditPrompt(invoiceId: number): Promise<void> {
    if (!this.currentProjectId || !AdminAuth.isAuthenticated()) return;

    try {
      // Fetch available deposits for this project
      const depositsResponse = await apiFetch(`/api/invoices/deposits/${this.currentProjectId}`);
      if (!depositsResponse.ok) {
        alertError('Failed to load available deposits');
        return;
      }

      const depositsData = await depositsResponse.json();
      const deposits = depositsData.deposits || [];

      if (deposits.length === 0) {
        alertWarning('No paid deposits available to apply as credit');
        return;
      }

      // Build options for deposit selection
      const depositOptions = deposits.map((d: { invoice_id: number; invoice_number: string; available_amount: number }) => ({
        value: String(d.invoice_id),
        label: `${d.invoice_number} - $${d.available_amount.toFixed(2)} available`
      }));

      const result = await multiPromptDialog({
        title: 'Apply Deposit Credit',
        fields: [
          {
            name: 'depositInvoiceId',
            label: 'Select Deposit',
            type: 'select',
            options: depositOptions,
            required: true
          },
          {
            name: 'amount',
            label: 'Credit Amount ($)',
            type: 'number',
            defaultValue: String(deposits[0]?.available_amount || 0),
            placeholder: 'Enter credit amount',
            required: true
          }
        ],
        confirmText: 'Apply Credit',
        cancelText: 'Cancel'
      });

      if (!result) return;

      const amount = parseFloat(result.amount);
      if (isNaN(amount) || amount <= 0) {
        alertWarning('Please enter a valid amount');
        return;
      }

      // Find the selected deposit to verify amount
      const selectedDeposit = deposits.find((d: { invoice_id: number }) => String(d.invoice_id) === result.depositInvoiceId);
      if (selectedDeposit && amount > selectedDeposit.available_amount) {
        alertWarning(`Amount exceeds available credit ($${selectedDeposit.available_amount.toFixed(2)})`);
        return;
      }

      const creditResponse = await apiPost(`/api/invoices/${invoiceId}/apply-credit`, {
        depositInvoiceId: parseInt(result.depositInvoiceId),
        amount
      });

      if (creditResponse.ok) {
        alertSuccess('Credit applied successfully!');
        this.loadProjectInvoices(this.currentProjectId!);
      } else {
        const errorData = await creditResponse.json();
        alertError(errorData.error || 'Failed to apply credit');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error applying credit:', error);
      alertError('Error applying credit');
    }
  }

  /**
   * Create a new invoice for the current project
   */
  private async createInvoice(
    clientId: number,
    description: string,
    amount: number
  ): Promise<void> {
    if (!this.currentProjectId) return;

    if (!AdminAuth.isAuthenticated()) return;

    try {
      const response = await apiPost('/api/invoices', {
        projectId: this.currentProjectId,
        clientId,
        lineItems: [
          {
            description,
            quantity: 1,
            rate: amount,
            amount
          }
        ],
        notes: '',
        terms: 'Payment due within 30 days'
      });

      if (response.ok) {
        alertSuccess('Invoice created successfully!');
        this.loadProjectInvoices(this.currentProjectId);
      } else {
        alertError('Failed to create invoice. Please try again.');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error creating invoice:', error);
      alertError('Failed to create invoice. Please try again.');
    }
  }

  /**
   * Send an invoice to the client (exposed globally for onclick)
   */
  public async sendInvoice(invoiceId: number): Promise<void> {
    console.log('[SendInvoice] Called with invoiceId:', invoiceId);
    if (!AdminAuth.isAuthenticated()) {
      console.log('[SendInvoice] Not authenticated');
      return;
    }

    try {
      console.log('[SendInvoice] Sending request...');
      const response = await apiPost(`/api/invoices/${invoiceId}/send`);

      if (response.ok) {
        alertSuccess('Invoice sent successfully!');
        if (this.currentProjectId) {
          this.loadProjectInvoices(this.currentProjectId);
        }
      } else {
        alertError('Failed to send invoice');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error sending invoice:', error);
      alertError('Error sending invoice');
    }
  }

  /**
   * Mark an invoice as paid (exposed globally for onclick)
   */
  public async markInvoicePaid(invoiceId: number): Promise<void> {
    if (!AdminAuth.isAuthenticated()) return;

    try {
      const response = await apiPut(`/api/invoices/${invoiceId}`, { status: 'paid' });

      if (response.ok) {
        alertSuccess('Invoice marked as paid!');
        if (this.currentProjectId) {
          this.loadProjectInvoices(this.currentProjectId);
        }
      } else {
        alertError('Failed to update invoice');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error marking invoice paid:', error);
      alertError('Error updating invoice');
    }
  }

  /**
   * Send a payment reminder for an overdue invoice (exposed globally for onclick)
   */
  public async sendInvoiceReminder(invoiceId: number): Promise<void> {
    if (!AdminAuth.isAuthenticated()) return;

    try {
      const response = await apiPost(`/api/invoices/${invoiceId}/send-reminder`);

      if (response.ok) {
        alertSuccess('Payment reminder sent!');
      } else {
        alertError('Failed to send reminder');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error sending reminder:', error);
      alertError('Error sending reminder');
    }
  }

  /**
   * Duplicate an invoice (creates a new draft copy)
   */
  public async duplicateInvoice(invoiceId: number): Promise<void> {
    if (!AdminAuth.isAuthenticated()) return;

    const confirmed = await confirmDialog({
      title: 'Duplicate Invoice',
      message: 'This will create a new draft invoice as a copy. Continue?',
      confirmText: 'Duplicate',
      cancelText: 'Cancel',
      icon: 'info'
    });

    if (!confirmed) return;

    try {
      const response = await apiPost(`/api/invoices/${invoiceId}/duplicate`);

      if (response.ok) {
        alertSuccess('Invoice duplicated successfully');
        this.loadProjectInvoices(this.currentProjectId!);
      } else {
        alertError('Failed to duplicate invoice');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error duplicating invoice:', error);
      alertError('Error duplicating invoice');
    }
  }

  /**
   * Delete or void an invoice
   */
  public async deleteInvoice(invoiceId: number): Promise<void> {
    if (!AdminAuth.isAuthenticated()) return;

    const confirmed = await confirmDanger(
      'Draft invoices will be permanently deleted. Sent invoices will be voided (marked as cancelled). Continue?',
      'Delete/Void',
      'Delete Invoice'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        alertSuccess(data.action === 'deleted' ? 'Invoice deleted' : 'Invoice voided');
        this.loadProjectInvoices(this.currentProjectId!);
      } else {
        const err = await response.json();
        alertError(err.error || 'Failed to delete invoice');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error deleting invoice:', error);
      alertError('Error deleting invoice');
    }
  }

  /**
   * Process late fees for overdue invoices on this project
   */
  private async processLateFees(): Promise<void> {
    if (!AdminAuth.isAuthenticated() || !this.currentProjectId) return;

    const confirmed = await confirmDialog({
      title: 'Apply Late Fees',
      message: 'This will calculate and apply late fees to all overdue invoices for this project. Continue?',
      confirmText: 'Apply Late Fees',
      cancelText: 'Cancel',
      icon: 'warning'
    });

    if (!confirmed) return;

    try {
      const response = await apiPost('/api/invoices/process-late-fees', {
        projectId: this.currentProjectId
      });

      if (response.ok) {
        const data = await response.json();
        alertSuccess(`Late fees applied to ${data.processed || 0} invoices`);
        this.loadProjectInvoices(this.currentProjectId);
      } else {
        alertError('Failed to process late fees');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error processing late fees:', error);
      alertError('Error processing late fees');
    }
  }

  /**
   * Show prompt to schedule an invoice for future generation
   */
  private async showScheduleInvoicePrompt(): Promise<void> {
    if (!AdminAuth.isAuthenticated() || !this.currentProjectId) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];

    const result = await multiPromptDialog({
      title: 'Schedule Invoice',
      fields: [
        {
          name: 'amount',
          label: 'Invoice Amount ($)',
          type: 'number',
          required: true,
          placeholder: '0.00'
        },
        {
          name: 'description',
          label: 'Description',
          type: 'text',
          required: true,
          placeholder: 'e.g., Phase 2 Development'
        },
        {
          name: 'scheduledDate',
          label: 'Generate On Date',
          type: 'date',
          required: true,
          defaultValue: defaultDate
        }
      ],
      confirmText: 'Schedule',
      cancelText: 'Cancel'
    });

    if (!result) return;

    try {
      const response = await apiPost('/api/invoices/schedule', {
        project_id: this.currentProjectId,
        amount: parseFloat(result.amount),
        description: result.description,
        scheduled_date: result.scheduledDate
      });

      if (response.ok) {
        alertSuccess('Invoice scheduled successfully');
        this.loadScheduledInvoices();
      } else {
        alertError('Failed to schedule invoice');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error scheduling invoice:', error);
      alertError('Error scheduling invoice');
    }
  }

  /**
   * Show prompt to set up recurring invoices
   */
  private async showSetupRecurringPrompt(): Promise<void> {
    if (!AdminAuth.isAuthenticated() || !this.currentProjectId) return;

    const result = await multiPromptDialog({
      title: 'Setup Recurring Invoice',
      fields: [
        {
          name: 'amount',
          label: 'Invoice Amount ($)',
          type: 'number',
          required: true,
          placeholder: '0.00'
        },
        {
          name: 'description',
          label: 'Description',
          type: 'text',
          required: true,
          placeholder: 'e.g., Monthly Maintenance'
        },
        {
          name: 'frequency',
          label: 'Frequency',
          type: 'select',
          required: true,
          options: [
            { value: 'weekly', label: 'Weekly' },
            { value: 'biweekly', label: 'Bi-weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' }
          ]
        },
        {
          name: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: true
        }
      ],
      confirmText: 'Setup Recurring',
      cancelText: 'Cancel'
    });

    if (!result) return;

    try {
      const response = await apiPost('/api/invoices/recurring', {
        project_id: this.currentProjectId,
        amount: parseFloat(result.amount),
        description: result.description,
        frequency: result.frequency,
        start_date: result.startDate
      });

      if (response.ok) {
        alertSuccess('Recurring invoice configured');
        this.loadRecurringInvoices();
      } else {
        alertError('Failed to setup recurring invoice');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error setting up recurring invoice:', error);
      alertError('Error setting up recurring invoice');
    }
  }

  /**
   * Load scheduled invoices for the current project
   */
  private async loadScheduledInvoices(): Promise<void> {
    if (!this.currentProjectId) return;

    const container = domCache.get('scheduledInvoicesList');
    if (!container) return;

    try {
      const response = await apiFetch(`/api/invoices/scheduled?projectId=${this.currentProjectId}`);
      if (response.ok) {
        const data = await response.json();
        const scheduled = data.scheduled || [];

        if (scheduled.length === 0) {
          container.innerHTML = '<p class="empty-state">No scheduled invoices.</p>';
        } else {
          container.innerHTML = scheduled.map((inv: { id: number; amount: number; description: string; scheduled_date: string }) => `
            <div class="scheduled-item">
              <span class="scheduled-date">${formatDate(inv.scheduled_date)}</span>
              <span class="scheduled-desc">${SanitizationUtils.escapeHtml(inv.description)}</span>
              <span class="scheduled-amount">${formatCurrency(inv.amount)}</span>
              <button class="btn btn-danger btn-sm" onclick="window.adminDashboard?.cancelScheduledInvoice(${inv.id})">Cancel</button>
            </div>
          `).join('');
        }
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error loading scheduled invoices:', error);
    }
  }

  /**
   * Load recurring invoices for the current project
   */
  private async loadRecurringInvoices(): Promise<void> {
    if (!this.currentProjectId) return;

    const container = domCache.get('recurringInvoicesList');
    if (!container) return;

    try {
      const response = await apiFetch(`/api/invoices/recurring?projectId=${this.currentProjectId}`);
      if (response.ok) {
        const data = await response.json();
        const recurring = data.recurring || [];

        if (recurring.length === 0) {
          container.innerHTML = '<p class="empty-state">No recurring invoices configured.</p>';
        } else {
          container.innerHTML = recurring.map((inv: { id: number; amount: number; description: string; frequency: string; is_active: boolean; next_date: string }) => `
            <div class="recurring-item">
              <span class="recurring-desc">${SanitizationUtils.escapeHtml(inv.description)}</span>
              <span class="recurring-freq">${inv.frequency}</span>
              <span class="recurring-amount">${formatCurrency(inv.amount)}</span>
              <span class="recurring-next">Next: ${formatDate(inv.next_date)}</span>
              <span class="recurring-status ${inv.is_active ? 'active' : 'paused'}">${inv.is_active ? 'Active' : 'Paused'}</span>
              <button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.toggleRecurringInvoice(${inv.id}, ${inv.is_active})">${inv.is_active ? 'Pause' : 'Resume'}</button>
            </div>
          `).join('');
        }
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error loading recurring invoices:', error);
    }
  }

  /**
   * Cancel a scheduled invoice
   */
  public async cancelScheduledInvoice(scheduleId: number): Promise<void> {
    if (!AdminAuth.isAuthenticated()) return;

    const confirmed = await confirmDanger(
      'Are you sure you want to cancel this scheduled invoice?',
      'Cancel',
      'Cancel Scheduled Invoice'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/invoices/scheduled/${scheduleId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        alertSuccess('Scheduled invoice cancelled');
        this.loadScheduledInvoices();
      } else {
        alertError('Failed to cancel scheduled invoice');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error cancelling scheduled invoice:', error);
      alertError('Error cancelling scheduled invoice');
    }
  }

  /**
   * Toggle (pause/resume) a recurring invoice
   */
  public async toggleRecurringInvoice(recurringId: number, isActive: boolean): Promise<void> {
    if (!AdminAuth.isAuthenticated()) return;

    try {
      const action = isActive ? 'pause' : 'resume';
      const response = await apiPost(`/api/invoices/recurring/${recurringId}/${action}`);

      if (response.ok) {
        alertSuccess(`Recurring invoice ${isActive ? 'paused' : 'resumed'}`);
        this.loadRecurringInvoices();
      } else {
        alertError(`Failed to ${action} recurring invoice`);
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error toggling recurring invoice:', error);
      alertError('Error updating recurring invoice');
    }
  }

  /**
   * Record a payment on an invoice
   */
  public async recordPayment(invoiceId: number): Promise<void> {
    if (!AdminAuth.isAuthenticated()) return;

    const result = await multiPromptDialog({
      title: 'Record Payment',
      fields: [
        {
          name: 'amount',
          label: 'Payment Amount ($)',
          type: 'number',
          required: true,
          placeholder: '0.00'
        },
        {
          name: 'paymentMethod',
          label: 'Payment Method',
          type: 'select',
          options: [
            { value: 'zelle', label: 'Zelle' },
            { value: 'venmo', label: 'Venmo' },
            { value: 'check', label: 'Check' },
            { value: 'bank_transfer', label: 'Bank Transfer' },
            { value: 'credit_card', label: 'Credit Card' },
            { value: 'cash', label: 'Cash' },
            { value: 'other', label: 'Other' }
          ],
          required: true
        },
        {
          name: 'reference',
          label: 'Reference/Transaction ID (optional)',
          type: 'text',
          placeholder: 'e.g., TXN-12345'
        }
      ]
    });

    if (!result) return;

    const amount = parseFloat(result.amount);
    if (isNaN(amount) || amount <= 0) {
      alertError('Please enter a valid payment amount');
      return;
    }

    try {
      const response = await apiPost(`/api/invoices/${invoiceId}/record-payment`, {
        amount,
        paymentMethod: result.paymentMethod,
        paymentReference: result.reference || undefined
      });

      if (response.ok) {
        const data = await response.json();
        alertSuccess(data.message || 'Payment recorded');
        this.loadProjectInvoices(this.currentProjectId!);
      } else {
        const err = await response.json();
        alertError(err.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error recording payment:', error);
      alertError('Error recording payment');
    }
  }

  /**
   * Set up file upload handlers for project detail view
   */
  private setupFileUploadHandlers(): void {
    const dropzone = domCache.get('uploadDropzone');
    const fileInput = domCache.getAs<HTMLInputElement>('fileInput');
    const browseBtn = domCache.get('browseFilesBtn');

    if (browseBtn && fileInput && !browseBtn.dataset.listenerAdded) {
      browseBtn.dataset.listenerAdded = 'true';
      browseBtn.addEventListener('click', () => fileInput.click());
    }

    if (fileInput && !fileInput.dataset.listenerAdded) {
      fileInput.dataset.listenerAdded = 'true';
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          this.uploadFiles(fileInput.files);
          fileInput.value = ''; // Reset input
        }
      });
    }

    if (dropzone && !dropzone.dataset.listenerAdded) {
      dropzone.dataset.listenerAdded = 'true';
      // Make dropzone keyboard accessible
      dropzone.setAttribute('tabindex', '0');
      dropzone.setAttribute('role', 'button');
      dropzone.setAttribute('aria-label', 'File upload dropzone - press Enter or Space to browse files, or drag and drop files here');

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          this.uploadFiles(e.dataTransfer.files);
        }
      });

      // Keyboard support - Enter or Space triggers file browser
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInput?.click();
        }
      });
    }
  }

  /**
   * Check if a file type is allowed
   */
  private isAllowedFileType(file: File): boolean {
    const hasValidExtension = ALLOWED_EXTENSIONS.test(file.name);
    const hasValidMimeType = ALLOWED_MIME_TYPES.includes(file.type);
    return hasValidExtension || hasValidMimeType;
  }

  /**
   * Upload files to the current project
   */
  private async uploadFiles(files: FileList): Promise<void> {
    if (!this.currentProjectId) return;

    if (!AdminAuth.isAuthenticated()) return;

    // Validate file types
    const invalidFiles: string[] = [];
    for (let i = 0; i < files.length; i++) {
      if (!this.isAllowedFileType(files[i])) {
        invalidFiles.push(files[i].name);
      }
    }

    if (invalidFiles.length > 0) {
      alertError(`Unsupported file type(s): ${invalidFiles.join(', ')}. Allowed: images, PDF, Word docs, text, ZIP, RAR`);
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await apiFetch(`/api/projects/${this.currentProjectId}/files`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        alertSuccess(`${data.files?.length || files.length} file(s) uploaded successfully!`);
        this.loadProjectFiles(this.currentProjectId!);
      } else {
        alertError('Failed to upload files. Please try again.');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error uploading files:', error);
      alertError('Failed to upload files. Please try again.');
    }
  }

  /**
   * Parse features string - handles both comma-separated and concatenated formats
   * Known feature values are used to intelligently split concatenated strings
   */
  private parseFeatures(featuresStr: string): string[] {
    if (!featuresStr) return [];

    // If comma-separated, split normally
    if (featuresStr.includes(',')) {
      return featuresStr.split(',').map((f: string) => f.trim()).filter((f: string) => f);
    }

    // Known feature values from all project types
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

    // Sort by length (longest first) to match longer patterns before shorter ones
    const sortedFeatures = [...knownFeatures].sort((a, b) => b.length - a.length);

    const found: string[] = [];
    let remaining = featuresStr;

    // Iteratively find and extract known features
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
      // If no known feature found, break to avoid infinite loop
      if (!matched) {
        // If there's remaining text, it might be an unknown feature
        if (remaining.trim()) {
          found.push(remaining.trim());
        }
        break;
      }
    }

    return found;
  }

  /**
   * Get current project ID
   */
  getCurrentProjectId(): number | null {
    return this.currentProjectId;
  }
}

