/**
 * ===============================================
 * ADMIN PROJECT DETAILS HANDLER
 * ===============================================
 * @file src/features/admin/admin-project-details.ts
 *
 * Handles project detail view, including messages, files, milestones, and invoices.
 */

import { SanitizationUtils } from '../../utils/sanitization-utils';
import { formatFileSize } from '../../utils/format-utils';
import { AdminAuth } from './admin-auth';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../utils/api-client';
import { createDOMCache, getElement } from '../../utils/dom-cache';
import { confirmDanger, alertError, alertSuccess, alertWarning } from '../../utils/confirm-dialog';

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
  contractDate: string;
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
  contractDate: '#pd-contract-date',
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

    if (projectName) projectName.textContent = project.project_name || 'Untitled Project';
    if (clientName) clientName.textContent = project.contact_name || '-';
    if (clientEmail) clientEmail.textContent = project.email || '-';
    if (company) company.textContent = project.company_name || '-';
    if (status) {
      status.textContent = (project.status || 'pending').replace('_', ' ');
      status.className = `status-badge status-${(project.status || 'pending').replace('_', '-')}`;
    }
    if (projectType && this.formatProjectTypeFn && project.project_type) {
      projectType.textContent = this.formatProjectTypeFn(project.project_type);
    }
    if (budget) budget.textContent = project.budget_range || '-';
    if (timeline) timeline.textContent = project.timeline || '-';
    if (startDate) {
      const dateToShow = project.start_date || project.created_at;
      startDate.textContent = dateToShow
        ? new Date(dateToShow).toLocaleDateString()
        : '-';
    }

    // Target end date
    const endDate = domCache.get('endDate');
    if (endDate) {
      endDate.textContent = project.estimated_end_date
        ? new Date(project.estimated_end_date).toLocaleDateString()
        : '-';
    }

    // Progress
    const progressPercent = domCache.get('progressPercent');
    const progressBar = domCache.get('progressBar');
    const progress = project.progress || 0;
    if (progressPercent) progressPercent.textContent = `${progress}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;

    // Project description
    const descriptionEl = domCache.get('description');
    if (descriptionEl) {
      descriptionEl.textContent = project.description || '-';
    }

    // Preview URL
    const previewUrlLink = domCache.getAs<HTMLAnchorElement>('previewUrlLink');
    if (previewUrlLink) {
      if (project.preview_url) {
        previewUrlLink.href = project.preview_url;
        previewUrlLink.textContent = project.preview_url;
      } else {
        previewUrlLink.href = '#';
        previewUrlLink.textContent = '-';
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
    if (repoUrlLink) {
      if (project.repository_url) {
        repoUrlLink.href = project.repository_url;
        repoUrlLink.textContent = project.repository_url;
      } else {
        repoUrlLink.href = '#';
        repoUrlLink.textContent = '-';
      }
    }
    if (productionUrlLink) {
      if (project.production_url) {
        productionUrlLink.href = project.production_url;
        productionUrlLink.textContent = project.production_url;
      } else {
        productionUrlLink.href = '#';
        productionUrlLink.textContent = '-';
      }
    }

    // Financial section (deposit, contract date)
    const financialSection = domCache.get('financialSection');
    const depositEl = domCache.get('deposit');
    const contractDateEl = domCache.get('contractDate');

    const hasFinancial = project.deposit_amount || project.contract_signed_at;
    if (financialSection) {
      financialSection.style.display = hasFinancial ? 'flex' : 'none';
    }
    if (depositEl) {
      depositEl.textContent = project.deposit_amount ? `$${project.deposit_amount.toFixed(2)}` : '-';
    }
    if (contractDateEl) {
      contractDateEl.textContent = project.contract_signed_at
        ? new Date(project.contract_signed_at).toLocaleDateString()
        : '-';
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
        ? new Date(project.last_login_at).toLocaleString()
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

      btn.addEventListener('click', () => {
        const tabName = btnEl.dataset.pdTab;
        if (!tabName) return;

        // Update active button
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active content
        tabContents.forEach((content) => {
          content.classList.toggle('active', content.id === `pd-tab-${tabName}`);
        });
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

    // File upload handlers
    this.setupFileUploadHandlers();
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
      'on_hold': 'On Hold',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    valueSpan.textContent = statusLabels[status] || status;

    // Update trigger color
    trigger.classList.remove('status-pending', 'status-active', 'status-on_hold', 'status-completed', 'status-cancelled');
    if (status) {
      trigger.classList.add(`status-${status}`);
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
        const error = await response.json();
        alertError(`Failed to save: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error saving project:', error);
      alertError('Error saving project');
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
                  <span class="message-time">${new Date(msg.created_at).toLocaleString()}</span>
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
          filesList.innerHTML = '<p class="empty-state">No files uploaded yet.</p>';
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
                <span class="file-meta">Uploaded ${new Date(file.uploadedAt).toLocaleDateString()} - ${formatFileSize(file.size)}</span>
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
                  ${m.due_date ? `<span class="milestone-due-date">${new Date(m.due_date).toLocaleDateString()}</span>` : ''}
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
  private showAddMilestonePrompt(): void {
    if (!this.currentProjectId) return;

    const title = prompt('Enter milestone title:');
    if (!title) return;

    const description = prompt('Enter milestone description (optional):') || '';
    const dueDateStr = prompt('Enter due date (YYYY-MM-DD, optional):') || '';

    this.addMilestone(title, description, dueDateStr);
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
        const error = await response.json();
        alertError(`Failed to add milestone: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error adding milestone:', error);
      alertError('Error adding milestone');
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
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error toggling milestone:', error);
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
        alertError('Failed to delete milestone');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error deleting milestone:', error);
      alertError('Error deleting milestone');
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
          invoicesList.innerHTML = '<p class="empty-state">No invoices created yet.</p>';
        } else {
          invoicesList.innerHTML = invoices
            .map((inv: InvoiceResponse) => {
              const statusClass =
                inv.status === 'paid'
                  ? 'status-completed'
                  : inv.status === 'overdue'
                    ? 'status-cancelled'
                    : 'status-active';
              return `
              <div class="invoice-item">
                <div class="invoice-info">
                  <strong>${inv.invoice_number || `INV-${inv.id}`}</strong>
                  <span class="invoice-date">${new Date(inv.created_at).toLocaleDateString()}</span>
                </div>
                <div class="invoice-amount">$${(typeof inv.amount_total === 'string' ? parseFloat(inv.amount_total) : (inv.amount_total || 0)).toFixed(2)}</div>
                <span class="status-badge ${statusClass}">${inv.status}</span>
                <div class="invoice-actions">
                  <a href="/api/invoices/${inv.id}/pdf" class="btn btn-outline btn-sm" target="_blank">PDF</a>
                  ${inv.status === 'draft' ? `<button class="btn btn-secondary btn-sm" onclick="window.adminDashboard?.sendInvoice(${inv.id})">Send</button>` : ''}
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
   * Show prompt to create a new invoice
   */
  private showCreateInvoicePrompt(): void {
    if (!this.currentProjectId) return;

    const project = this.projectsData.find((p: ProjectResponse) => p.id === this.currentProjectId);
    if (!project) return;

    const description = prompt('Enter line item description:', 'Web Development Services');
    if (!description) return;

    const amountStr = prompt('Enter amount ($):', '1000');
    if (!amountStr) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alertWarning('Please enter a valid amount');
      return;
    }

    this.createInvoice(project.client_id, description, amount);
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
        const error = await response.json();
        alertError(`Failed to create invoice: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error creating invoice:', error);
      alertError('Error creating invoice');
    }
  }

  /**
   * Send an invoice to the client (exposed globally for onclick)
   */
  public async sendInvoice(invoiceId: number): Promise<void> {
    if (!AdminAuth.isAuthenticated()) return;

    try {
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
   * Upload files to the current project
   */
  private async uploadFiles(files: FileList): Promise<void> {
    if (!this.currentProjectId) return;

    if (!AdminAuth.isAuthenticated()) return;

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
        const error = await response.json();
        alertError(`Failed to upload files: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error uploading files:', error);
      alertError('Error uploading files');
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

