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
  formatCurrency
} from '../../utils/format-utils';
import { apiPut } from '../../utils/api-client';
import {
  createSecondarySidebar,
  SECONDARY_TAB_ICONS,
  type SecondarySidebarController
} from '../../components/secondary-sidebar';
import { renderEmptyState } from '../../components/empty-state';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminProjectDetails');

// Import from sub-modules
import {
  domCache,
  type ProjectDetailsHandler,
  // Messages
  loadProjectMessages,
  resetThreadId,
  // Files
  loadProjectFiles,
  loadPendingRequestsDropdown,
  // Milestones
  loadProjectMilestones,
  updateProgressBar,
  toggleMilestone as toggleMilestoneModule,
  deleteMilestone as deleteMilestoneModule,
  toggleMilestoneTasks as toggleMilestoneTasksModule,
  toggleTaskCompletion as toggleTaskCompletionModule,
  // Invoices
  loadProjectInvoices,
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
  loadScheduledInvoices,
  loadRecurringInvoices,
  cancelScheduledInvoice as cancelScheduledInvoiceModule,
  toggleRecurringInvoice as toggleRecurringInvoiceModule,
  // Render
  renderProjectDetailTab,
  // Inline Editing
  setupInlineEditing as setupInlineEditingModule,
  showTypeDropdown as showTypeDropdownModule,
  showStatusDropdown as showStatusDropdownModule,
  showSelectDropdown,
  showTextareaEdit,
  // Populate Sections
  populateUrlSection,
  populateContractSection,
  populateFeatures,
  populateSettingsForm,
  // Event Handlers
  setupEventHandlers,
  setupMoreMenuDelegation,
  type EventHandlerContext
} from './project-details';

import type { ProjectResponse } from '../../types/api';

export type { ProjectDetailsHandler };

// Re-export renderProjectDetailTab for external consumers
export { renderProjectDetailTab };

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

    resetThreadId();

    const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
    if (!project) {
      logger.error(' Project not found:', projectId);
      return;
    }

    switchTab('project-detail');

    const tabContainer = document.getElementById('tab-project-detail');
    if (tabContainer) {
      renderProjectDetailTab(tabContainer);
      domCache.clear();
    }

    const deliverablesBtn = document.getElementById('btn-manage-deliverables');
    if (deliverablesBtn) {
      deliverablesBtn.dataset.projectId = String(projectId);
    }

    this.populateProjectDetailView(project);
    this.initSecondarySidebar();
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
    const project = this.projectsData.find((p) => p.id === projectId);
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

    modal.footer.querySelector('#btn-cancel-notes')?.addEventListener('click', () => modal.hide());
    modal.footer.querySelector('#btn-save-notes')?.addEventListener('click', async () => {
      const textarea = document.getElementById('edit-notes-textarea') as HTMLTextAreaElement;
      if (!textarea) return;

      try {
        const response = await apiPut(`/api/projects/${projectId}`, {
          notes: textarea.value.trim()
        });

        if (response.ok) {
          project.notes = textarea.value.trim();
          this.populateProjectDetailView(project);
          modal.hide();
          const { alertSuccess } = await import('../../utils/confirm-dialog');
          alertSuccess('Project notes updated successfully');
        } else {
          const { alertError } = await import('../../utils/confirm-dialog');
          alertError('Failed to update project notes');
        }
      } catch (error) {
        logger.error(' Error updating notes:', error);
        const { alertError } = await import('../../utils/confirm-dialog');
        alertError('Error updating project notes');
      }
    });
  }

  /**
   * Initialize secondary sidebar for project detail tabs
   */
  private initSecondarySidebar(): void {
    this.cleanupSecondarySidebar();

    const container = document.getElementById('admin-dashboard');
    const sidebarMount = document.getElementById('secondary-sidebar');
    const horizontalMount = document.getElementById('secondary-tabs-horizontal');

    if (!container || !sidebarMount || !horizontalMount) return;

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

    this.secondarySidebar = createSecondarySidebar({
      tabs: projectTabs,
      activeTab: 'overview',
      title: 'Project',
      container,
      onTabChange: (tabId) => this.switchToProjectDetailTab(tabId)
    });

    sidebarMount.innerHTML = '';
    sidebarMount.appendChild(this.secondarySidebar.getElement());

    horizontalMount.innerHTML = '';
    horizontalMount.appendChild(this.secondarySidebar.getHorizontalTabs());

    container.classList.add('has-secondary-sidebar');
  }

  /**
   * Switch to a specific project detail tab
   */
  private async switchToProjectDetailTab(tabName: string): Promise<void> {
    const inlineTabBtns = document.querySelectorAll('.project-detail-tabs button');
    const headerTabBtns = document.querySelectorAll('#project-detail-header-tabs .portal-subtab');
    const tabContents = document.querySelectorAll('[id^="pd-tab-"]');

    inlineTabBtns.forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.pdTab === tabName);
    });
    headerTabBtns.forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.pdTab === tabName);
    });
    tabContents.forEach((content) => {
      content.classList.toggle('active', content.id === `pd-tab-${tabName}`);
    });

    if (this.secondarySidebar) {
      this.secondarySidebar.setActiveTab(tabName);
    }
  }

  private cleanupSecondarySidebar(): void {
    if (this.secondarySidebar) {
      this.secondarySidebar.destroy();
      this.secondarySidebar = undefined;
    }
    const container = document.getElementById('admin-dashboard');
    if (container) container.classList.remove('has-secondary-sidebar');
  }

  private showProjectDetail(projectId: number): void {
    if (this.switchTabFn && this.loadProjectsFn && this.formatProjectTypeFn && this.inviteLeadFn) {
      this.showProjectDetails(
        projectId, this.projectsData, this.switchTabFn,
        this.loadProjectsFn, this.formatProjectTypeFn, this.inviteLeadFn
      );
    }
  }

  /**
   * Build context object for delegated event handlers
   */
  private buildEventHandlerContext(): EventHandlerContext {
    return {
      currentProjectId: this.currentProjectId,
      projectsData: this.projectsData,
      switchTabFn: this.switchTabFn,
      loadProjectsFn: this.loadProjectsFn,
      inviteLeadFn: this.inviteLeadFn,
      secondarySidebar: this.secondarySidebar,
      cleanupSecondarySidebar: () => this.cleanupSecondarySidebar(),
      showProjectDetail: (id) => this.showProjectDetail(id)
    };
  }

  /**
   * Populate the project detail view with data
   */
  private populateProjectDetailView(project: ProjectResponse): void {
    const detailTitle = domCache.get('detailTitle');
    const projectNameCard = domCache.get('projectNameCard');
    if (detailTitle) detailTitle.textContent = project.project_name || 'Untitled Project';
    if (projectNameCard) projectNameCard.textContent = project.project_name || 'Untitled Project';

    const clientName = domCache.get('clientName');
    const clientEmail = domCache.get('clientEmail');
    const company = domCache.get('company');
    if (clientName) clientName.textContent = project.client_name || project.contact_name || '';
    if (clientEmail) {
      clientEmail.innerHTML = getEmailWithCopyHtml(
        project.email || '', SanitizationUtils.escapeHtml(project.email || '')
      );
    }
    if (company) company.textContent = project.company_name || '';

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
        ? this.formatProjectTypeFn(project.project_type || '') : project.project_type || '';
    }
    if (budget) {budget.textContent = project.budget_range || (project.budget ? String(project.budget) : '-');}
    if (timeline) timeline.textContent = project.timeline || '';
    if (startDate) startDate.textContent = project.start_date ? formatDate(project.start_date) : '-';
    if (endDate) endDate.textContent = project.estimated_end_date ? formatDate(project.estimated_end_date) : '-';
    if (description) description.textContent = project.description || '';
    if (price) price.textContent = project.price ? formatCurrency(project.price) : '-';
    if (deposit) deposit.textContent = project.deposit_amount ? formatCurrency(project.deposit_amount) : '-';

    const progressPercent = domCache.get('progressPercent');
    const progressBar = domCache.get('progressBar');
    const progress = project.progress || 0;
    if (progressPercent) progressPercent.textContent = `${progress}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;

    populateUrlSection(project);
    populateContractSection(project);

    const adminNotesSection = domCache.get('adminNotesSection');
    const adminNotes = domCache.get('adminNotes');
    if (project.notes) {
      if (adminNotesSection) adminNotesSection.style.display = '';
      if (adminNotes) adminNotes.innerHTML = formatTextWithLineBreaks(project.notes);
    } else {
      if (adminNotesSection) adminNotesSection.style.display = 'none';
    }

    const notesDisplay = document.getElementById('pd-notes-display');
    if (notesDisplay) {
      if (project.notes && project.notes.trim()) {
        notesDisplay.innerHTML = `<div class="notes-content">${formatTextWithLineBreaks(project.notes)}</div>`;
      } else {
        renderEmptyState(notesDisplay, 'No notes yet. Click "Edit Notes" to add internal notes about this project.');
      }
    }

    populateFeatures(project, (str) => this.parseFeatures(str));
    populateSettingsForm(project, (s) => this.updateCustomDropdown(s), () => this.setupCustomStatusDropdown());
    this.refreshProjectData(project.id);

    setupInlineEditingModule(
      project, this.projectsData, (p) => this.populateProjectDetailView(p),
      (el, proj, id) => showTypeDropdownModule(el, proj, id, showSelectDropdown),
      (el, proj, id) => showStatusDropdownModule(el, proj, id, showSelectDropdown),
      (el, val, onSave) => showTextareaEdit(el, val, onSave)
    );
  }

  private refreshProjectData(projectId: number): void {
    loadProjectMessages(projectId, this.projectsData);
    loadProjectFiles(projectId);
    loadPendingRequestsDropdown(projectId);
    loadProjectMilestones(projectId, (progress) => updateProgressBar(projectId, progress));
    loadProjectInvoices(projectId);
  }

  private setupProjectDetailTabs(): void {
    const inlineTabBtns = document.querySelectorAll('.project-detail-tabs button');
    inlineTabBtns.forEach((btn) => {
      const btnEl = btn as HTMLElement;
      if (btnEl.dataset.listenerAdded) return;
      btnEl.dataset.listenerAdded = 'true';
      btn.addEventListener('click', () => {
        const tabName = btnEl.dataset.pdTab;
        if (tabName) this.switchToProjectDetailTab(tabName);
      });
    });

    const ctx = this.buildEventHandlerContext();
    setupMoreMenuDelegation(ctx);
    setupEventHandlers(ctx);
  }

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
      if (!dropdown.contains(e.target as Node)) dropdown.classList.remove('open');
    });
  }

  private updateCustomDropdown(status: string): void {
    const trigger = domCache.get('statusTrigger');
    const valueSpan = trigger?.querySelector('.custom-dropdown-value');
    const menu = domCache.get('statusMenu');
    if (!trigger || !valueSpan) return;

    const statusLabels: Record<string, string> = {
      pending: 'Pending', active: 'Active', 'on-hold': 'On Hold',
      on_hold: 'On Hold', completed: 'Completed', cancelled: 'Cancelled'
    };
    valueSpan.textContent = statusLabels[status] || status;

    const normalizedStatus = status.replace(/_/g, '-');
    trigger.classList.remove('status-pending', 'status-active', 'status-on-hold', 'status-completed', 'status-cancelled');
    if (normalizedStatus) trigger.classList.add(`status-${normalizedStatus}`);

    if (menu) {
      menu.querySelectorAll('.custom-dropdown-option').forEach((option) => {
        option.classList.toggle('selected', (option as HTMLElement).dataset.value === status);
      });
    }
  }

  private parseFeatures(featuresStr: string): string[] {
    if (!featuresStr) return [];
    if (featuresStr.includes(',')) {
      return featuresStr.split(',').map((f) => f.trim()).filter((f) => f);
    }

    const knownFeatures = [
      'contact-form', 'social-links', 'analytics', 'mobile-optimized', 'age-verification',
      'basic-only', 'blog', 'gallery', 'testimonials', 'booking', 'cms', 'portfolio-gallery',
      'case-studies', 'resume-download', 'shopping-cart', 'payment-processing',
      'inventory-management', 'user-accounts', 'admin-dashboard', 'product-search', 'reviews',
      'real-time-updates', 'api-integration', 'database', 'authentication', 'dashboard',
      'notifications', 'file-upload', 'offline-support', 'tab-management', 'bookmarks',
      'sync', 'dark-mode', 'keyboard-shortcuts'
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
      loadProjectMilestones(this.currentProjectId!, (p) => updateProgressBar(this.currentProjectId!, p));
    });
  }

  public async deleteMilestone(milestoneId: number): Promise<void> {
    if (!this.currentProjectId) return;
    await deleteMilestoneModule(this.currentProjectId, milestoneId, () => {
      loadProjectMilestones(this.currentProjectId!, (p) => updateProgressBar(this.currentProjectId!, p));
    });
  }

  public async toggleMilestoneTasks(milestoneId: number, projectId: number): Promise<void> {
    await toggleMilestoneTasksModule(milestoneId, projectId);
  }

  public async toggleTaskCompletion(taskId: number, isCompleted: boolean, projectId: number): Promise<void> {
    await toggleTaskCompletionModule(taskId, isCompleted, projectId);
  }

  public async sendInvoice(invoiceId: number): Promise<void> {
    await sendInvoiceModule(invoiceId, () => { if (this.currentProjectId) loadProjectInvoices(this.currentProjectId); });
  }

  public async editInvoice(invoiceId: number): Promise<void> {
    await editInvoiceModule(invoiceId, () => { if (this.currentProjectId) loadProjectInvoices(this.currentProjectId); });
  }

  public async markInvoicePaid(invoiceId: number): Promise<void> {
    await markInvoicePaidModule(invoiceId, () => { if (this.currentProjectId) loadProjectInvoices(this.currentProjectId); });
  }

  public async sendInvoiceReminder(invoiceId: number): Promise<void> {
    await sendInvoiceReminderModule(invoiceId);
  }

  public async duplicateInvoice(invoiceId: number): Promise<void> {
    await duplicateInvoiceModule(invoiceId, () => { if (this.currentProjectId) loadProjectInvoices(this.currentProjectId); });
  }

  public async deleteInvoice(invoiceId: number): Promise<void> {
    await deleteInvoiceModule(invoiceId, () => { if (this.currentProjectId) loadProjectInvoices(this.currentProjectId); });
  }

  public async showApplyCreditPrompt(invoiceId: number): Promise<void> {
    if (!this.currentProjectId) return;
    await showApplyCreditPromptModule(this.currentProjectId, invoiceId, () => { loadProjectInvoices(this.currentProjectId!); });
  }

  public async recordPayment(invoiceId: number): Promise<void> {
    await recordPaymentModule(invoiceId, () => { if (this.currentProjectId) loadProjectInvoices(this.currentProjectId); });
  }

  public async cancelScheduledInvoice(scheduleId: number): Promise<void> {
    if (!this.currentProjectId) return;
    await cancelScheduledInvoiceModule(scheduleId, () => { loadScheduledInvoices(this.currentProjectId!); });
  }

  public async toggleRecurringInvoice(recurringId: number, isActive: boolean): Promise<void> {
    if (!this.currentProjectId) return;
    await toggleRecurringInvoiceModule(recurringId, isActive, () => { loadRecurringInvoices(this.currentProjectId!); });
  }

  getCurrentProjectId(): number | null { return this.currentProjectId; }

  getCurrentProjectName(): string | null {
    if (!this.currentProjectId) return null;
    const project = this.projectsData.find((p) => p.id === this.currentProjectId);
    return project?.project_name ?? null;
  }
}
