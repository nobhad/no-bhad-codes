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
  // Milestones
  loadProjectMilestones,
  updateProgressBar,
  showAddMilestonePrompt,
  toggleMilestone as toggleMilestoneModule,
  deleteMilestone as deleteMilestoneModule,
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
  handleContractSign
} from './project-details';

import type { ProjectResponse } from '../../types/api';

export type { ProjectDetailsHandler };

export class AdminProjectDetails implements ProjectDetailsHandler {
  private currentProjectId: number | null = null;
  private projectsData: ProjectResponse[] = [];
  private switchTabFn?: (tab: string) => void;
  private loadProjectsFn?: () => Promise<void>;
  private formatProjectTypeFn?: (type: string) => string;
  private inviteLeadFn?: (leadId: number, email: string) => Promise<void>;

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

    // Populate the detail view
    this.populateProjectDetailView(project);

    // Set up tab navigation and event handlers
    this.setupProjectDetailTabs();
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

    if (project.contract_signed_at) {
      if (contractStatusBadge) {
        contractStatusBadge.textContent = 'Signed';
        contractStatusBadge.className = 'status-badge status-completed';
      }
      if (contractSignedInfo) contractSignedInfo.style.display = '';
      if (contractDate) contractDate.textContent = formatDate(project.contract_signed_at);
      if (contractSignBtn) {
        contractSignBtn.textContent = 'View Contract';
        contractSignBtn.classList.remove('btn-primary');
        contractSignBtn.classList.add('btn-outline');
      }
    } else {
      if (contractStatusBadge) {
        contractStatusBadge.textContent = 'Not Signed';
        contractStatusBadge.className = 'status-badge status-pending';
      }
      if (contractSignedInfo) contractSignedInfo.style.display = 'none';
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

    // Late fees, schedule, recurring buttons
    this.setupInvoiceSchedulingHandlers(projectId);

    // Contract sign
    const contractSignBtn = domCache.get('contractSignBtn');
    if (contractSignBtn && !contractSignBtn.dataset.listenerAdded) {
      contractSignBtn.dataset.listenerAdded = 'true';
      contractSignBtn.addEventListener('click', () => handleContractSign(projectId, this.projectsData));
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
      case 'delete':
        await deleteProject(this.currentProjectId, this.projectsData, () => {
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
