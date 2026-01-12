/**
 * ===============================================
 * ADMIN PROJECT DETAILS HANDLER
 * ===============================================
 * @file src/features/admin/admin-project-details.ts
 *
 * Handles project detail view, including messages, files, milestones, and invoices.
 */

import { SanitizationUtils } from '../../utils/sanitization-utils';

export interface ProjectDetailsHandler {
  showProjectDetails(projectId: number, projectsData: any[], switchTab: (tab: string) => void, loadProjects: () => Promise<void>, formatProjectType: (type: string) => string, inviteLead: (leadId: number, email: string) => Promise<void>): void;
  toggleMilestone(milestoneId: number, isCompleted: boolean): Promise<void>;
  deleteMilestone(milestoneId: number): Promise<void>;
  sendInvoice(invoiceId: number): Promise<void>;
  getCurrentProjectId(): number | null;
}

export class AdminProjectDetails implements ProjectDetailsHandler {
  private currentProjectId: number | null = null;
  private projectsData: any[] = [];
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
    projectsData: any[],
    switchTab: (tab: string) => void,
    loadProjects: () => Promise<void>,
    formatProjectType: (type: string) => string,
    inviteLead: (leadId: number, email: string) => Promise<void>
  ): void {
    const project = projectsData.find((p: any) => p.id === projectId);
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
  private populateProjectDetailView(project: any): void {
    // Header info
    const titleEl = document.getElementById('project-detail-title');
    if (titleEl) titleEl.textContent = 'Project Details';

    // Overview card
    const projectName = document.getElementById('pd-project-name');
    const clientName = document.getElementById('pd-client-name');
    const clientEmail = document.getElementById('pd-client-email');
    const company = document.getElementById('pd-company');
    const status = document.getElementById('pd-status');
    const projectType = document.getElementById('pd-type');
    const budget = document.getElementById('pd-budget');
    const timeline = document.getElementById('pd-timeline');
    const startDate = document.getElementById('pd-start-date');

    if (projectName) projectName.textContent = project.project_name || 'Untitled Project';
    if (clientName) clientName.textContent = project.contact_name || '-';
    if (clientEmail) clientEmail.textContent = project.email || '-';
    if (company) company.textContent = project.company_name || '-';
    if (status) {
      status.textContent = (project.status || 'pending').replace('_', ' ');
      status.className = `status-badge status-${(project.status || 'pending').replace('_', '-')}`;
    }
    if (projectType && this.formatProjectTypeFn) {
      projectType.textContent = this.formatProjectTypeFn(project.project_type);
    }
    if (budget) budget.textContent = project.budget_range || '-';
    if (timeline) timeline.textContent = project.timeline || '-';
    if (startDate) {
      startDate.textContent = project.created_at
        ? new Date(project.created_at).toLocaleDateString()
        : '-';
    }

    // Progress
    const progressPercent = document.getElementById('pd-progress-percent');
    const progressBar = document.getElementById('pd-progress-bar');
    const progress = project.progress || 0;
    if (progressPercent) progressPercent.textContent = `${progress}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;

    // Project notes
    const notes = document.getElementById('pd-notes');
    if (notes) {
      if (project.description) {
        notes.innerHTML = `<p>${project.description}</p>`;
        if (project.features) {
          notes.innerHTML += `<h4>Features Requested:</h4><p>${project.features}</p>`;
        }
      } else {
        notes.innerHTML = '<p class="empty-state">No project notes yet.</p>';
      }
    }

    // Settings form
    const settingName = document.getElementById('pd-setting-name') as HTMLInputElement;
    const settingStatus = document.getElementById('pd-setting-status') as HTMLInputElement;
    const settingProgress = document.getElementById('pd-setting-progress') as HTMLInputElement;

    if (settingName) settingName.value = project.project_name || '';
    if (settingStatus) {
      const status = project.status || 'pending';
      settingStatus.value = status;
      // Update custom dropdown display
      this.updateCustomDropdown(status);
      // Set up custom dropdown if not already done
      this.setupCustomStatusDropdown();
    }
    if (settingProgress) settingProgress.value = (project.progress || 0).toString();

    // Client account info in settings
    const clientAccountEmail = document.getElementById('pd-client-account-email');
    const clientAccountStatus = document.getElementById('pd-client-account-status');
    const clientLastLogin = document.getElementById('pd-client-last-login');

    if (clientAccountEmail) clientAccountEmail.textContent = project.email || '-';
    if (clientAccountStatus) {
      // Check if client has account
      const hasAccount = project.client_id || project.password_hash;
      clientAccountStatus.textContent = hasAccount ? 'Active' : 'Not Invited';
      clientAccountStatus.className = `status-badge status-${hasAccount ? 'active' : 'pending'}`;
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
    const tabBtns = document.querySelectorAll('.pd-tab-btn');
    const tabContents = document.querySelectorAll('.pd-tab-content');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabName = (btn as HTMLElement).dataset.pdTab;
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

    // Back button handler
    const backBtn = document.getElementById('btn-back-to-projects');
    if (backBtn && this.switchTabFn) {
      backBtn.addEventListener('click', () => {
        this.currentProjectId = null;
        this.switchTabFn!('projects');
      });
    }

    // Settings form handler
    const settingsForm = document.getElementById('pd-project-settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProjectSettings();
      });
    }

    // Send message handler
    const sendMsgBtn = document.getElementById('btn-pd-send-message');
    if (sendMsgBtn) {
      sendMsgBtn.addEventListener('click', () => this.sendProjectMessage());
    }

    // Resend invite handler
    const resendInviteBtn = document.getElementById('btn-resend-invite');
    if (resendInviteBtn && this.inviteLeadFn) {
      resendInviteBtn.addEventListener('click', () => {
        if (this.currentProjectId && this.inviteLeadFn) {
          const project = this.projectsData.find((p: any) => p.id === this.currentProjectId);
          if (project && project.email) {
            this.inviteLeadFn(this.currentProjectId, project.email);
          } else {
            alert('No email address found for this project.');
          }
        }
      });
    }

    // Add milestone handler
    const addMilestoneBtn = document.getElementById('btn-add-milestone');
    if (addMilestoneBtn) {
      addMilestoneBtn.addEventListener('click', () => this.showAddMilestonePrompt());
    }

    // Create invoice handler
    const createInvoiceBtn = document.getElementById('btn-create-invoice');
    if (createInvoiceBtn) {
      createInvoiceBtn.addEventListener('click', () => this.showCreateInvoicePrompt());
    }

    // File upload handlers
    this.setupFileUploadHandlers();
  }

  /**
   * Set up custom status dropdown behavior
   */
  private setupCustomStatusDropdown(): void {
    const dropdown = document.getElementById('pd-status-dropdown');
    console.log('[ProjectDetails] setupCustomStatusDropdown called, dropdown:', dropdown);

    if (!dropdown) return;

    // Skip if already set up
    if (dropdown.dataset.listenerAdded) {
      console.log('[ProjectDetails] Dropdown already set up, skipping');
      return;
    }
    dropdown.dataset.listenerAdded = 'true';
    console.log('[ProjectDetails] Setting up dropdown listeners');

    // Use event delegation on the dropdown container
    dropdown.addEventListener('click', (e) => {
      console.log('[ProjectDetails] Dropdown clicked', e.target);
      const target = e.target as HTMLElement;

      // Handle trigger click
      if (target.closest('.custom-dropdown-trigger')) {
        e.preventDefault();
        e.stopPropagation();
        dropdown.classList.toggle('open');
        console.log('[ProjectDetails] Toggled dropdown, open:', dropdown.classList.contains('open'));
        return;
      }

      // Handle option click
      const option = target.closest('.custom-dropdown-option') as HTMLElement;
      if (option) {
        const value = option.dataset.value || '';
        const hiddenInput = document.getElementById('pd-setting-status') as HTMLInputElement;
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
    const trigger = document.getElementById('pd-status-trigger');
    const valueSpan = trigger?.querySelector('.custom-dropdown-value');
    const menu = document.getElementById('pd-status-menu');

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
   * Save project settings from the settings form
   */
  private async saveProjectSettings(): Promise<void> {
    if (!this.currentProjectId || !this.loadProjectsFn) return;

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') return;

    const name = (document.getElementById('pd-setting-name') as HTMLInputElement)?.value;
    const status = (document.getElementById('pd-setting-status') as HTMLInputElement)?.value;
    const progress = parseInt(
      (document.getElementById('pd-setting-progress') as HTMLInputElement)?.value || '0'
    );

    try {
      const response = await fetch(`/api/projects/${this.currentProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          project_name: name,
          status,
          progress
        })
      });

      if (response.ok) {
        alert('Project settings saved!');
        // Refresh project data
        await this.loadProjectsFn();
        // Re-populate the view
        const project = this.projectsData.find((p: any) => p.id === this.currentProjectId);
        if (project) {
          this.populateProjectDetailView(project);
        }
      } else {
        alert('Failed to save project settings');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error saving project settings:', error);
      alert('Error saving project settings');
    }
  }

  /**
   * Load messages for the current project
   */
  private async loadProjectMessages(projectId: number): Promise<void> {
    const messagesThread = document.getElementById('pd-messages-thread');
    if (!messagesThread) return;

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') {
      messagesThread.innerHTML =
        '<p class="empty-state">Authentication required to view messages.</p>';
      return;
    }

    try {
      // Get the client ID for this project
      const project = this.projectsData.find((p: any) => p.id === projectId);
      if (!project || !project.client_id) {
        messagesThread.innerHTML =
          '<p class="empty-state">No client account linked. Invite the client first to enable messaging.</p>';
        return;
      }

      const response = await fetch(`/api/messages?client_id=${project.client_id}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const messages = data.messages || [];

        if (messages.length === 0) {
          messagesThread.innerHTML =
            '<p class="empty-state">No messages yet. Start the conversation with your client.</p>';
        } else {
          messagesThread.innerHTML = messages
            .map((msg: any) => {
              // Sanitize user data to prevent XSS
              const safeSenderName = SanitizationUtils.escapeHtml(
                msg.sender_type === 'admin' ? 'You' : (project.contact_name || 'Client')
              );
              const safeContent = SanitizationUtils.escapeHtml(msg.content || '');
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
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error loading project messages:', error);
      messagesThread.innerHTML = '<p class="empty-state">Error loading messages.</p>';
    }
  }

  /**
   * Send a message for the current project
   */
  private async sendProjectMessage(): Promise<void> {
    if (!this.currentProjectId) return;

    const messageInput = document.getElementById('pd-message-input') as HTMLTextAreaElement;
    if (!messageInput || !messageInput.value.trim()) return;

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') return;

    const project = this.projectsData.find((p: any) => p.id === this.currentProjectId);
    if (!project || !project.client_id) {
      alert('No client account linked. Invite the client first.');
      return;
    }

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          client_id: project.client_id,
          content: messageInput.value.trim(),
          sender_type: 'admin'
        })
      });

      if (response.ok) {
        messageInput.value = '';
        // Reload messages
        this.loadProjectMessages(this.currentProjectId!);
      } else {
        alert('Failed to send message');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error sending message:', error);
      alert('Error sending message');
    }
  }

  /**
   * Load files for the current project
   */
  private async loadProjectFiles(projectId: number): Promise<void> {
    const filesList = document.getElementById('pd-files-list');
    if (!filesList) return;

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') {
      filesList.innerHTML = '<p class="empty-state">Authentication required to view files.</p>';
      return;
    }

    try {
      const response = await fetch(`/api/files?project_id=${projectId}`, {
        credentials: 'include'
      });

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
                <span class="file-name">${file.original_filename || file.filename}</span>
                <span class="file-meta">Uploaded ${new Date(file.created_at).toLocaleDateString()} - ${this.formatFileSize(file.size)}</span>
              </div>
              <div class="file-actions">
                <a href="/uploads/${file.filename}" class="btn btn-outline btn-sm" target="_blank">Download</a>
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
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Load milestones for the current project
   */
  private async loadProjectMilestones(projectId: number): Promise<void> {
    const milestonesList = document.getElementById('pd-milestones-list');
    if (!milestonesList) return;

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') {
      milestonesList.innerHTML = '<p class="empty-state">Authentication required.</p>';
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/milestones`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const milestones = data.milestones || [];

        if (milestones.length === 0) {
          milestonesList.innerHTML =
            '<p class="empty-state">No milestones yet. Add milestones to track project progress.</p>';
        } else {
          milestonesList.innerHTML = milestones
            .map((m: any) => {
              // Sanitize user data to prevent XSS
              const safeTitle = SanitizationUtils.escapeHtml(m.title || '');
              const safeDescription = SanitizationUtils.escapeHtml(m.description || '');
              const safeDeliverables =
                m.deliverables && m.deliverables.length > 0
                  ? m.deliverables
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
        }
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error loading milestones:', error);
      milestonesList.innerHTML = '<p class="empty-state">Error loading milestones.</p>';
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

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') return;

    try {
      const response = await fetch(`/api/projects/${this.currentProjectId}/milestones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title,
          description: description || null,
          due_date: dueDate || null,
          deliverables: []
        })
      });

      if (response.ok) {
        this.loadProjectMilestones(this.currentProjectId);
      } else {
        const error = await response.json();
        alert(`Failed to add milestone: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error adding milestone:', error);
      alert('Error adding milestone');
    }
  }

  /**
   * Toggle milestone completion status (exposed globally for onclick)
   */
  public async toggleMilestone(milestoneId: number, isCompleted: boolean): Promise<void> {
    if (!this.currentProjectId) return;

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') return;

    try {
      const response = await fetch(
        `/api/projects/${this.currentProjectId}/milestones/${milestoneId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ is_completed: isCompleted })
        }
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
    if (!confirm('Are you sure you want to delete this milestone?')) return;

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') return;

    try {
      const response = await fetch(
        `/api/projects/${this.currentProjectId}/milestones/${milestoneId}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      );

      if (response.ok) {
        this.loadProjectMilestones(this.currentProjectId);
      } else {
        alert('Failed to delete milestone');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error deleting milestone:', error);
      alert('Error deleting milestone');
    }
  }

  /**
   * Load invoices for the current project
   */
  private async loadProjectInvoices(projectId: number): Promise<void> {
    const invoicesList = document.getElementById('pd-invoices-list');
    const outstandingEl = document.getElementById('pd-outstanding');
    const paidEl = document.getElementById('pd-paid');

    if (!invoicesList) return;

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') {
      invoicesList.innerHTML = '<p class="empty-state">Authentication required.</p>';
      return;
    }

    try {
      const response = await fetch(`/api/invoices/project/${projectId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const invoices = data.invoices || [];

        // Calculate totals
        let totalOutstanding = 0;
        let totalPaid = 0;

        invoices.forEach((inv: any) => {
          const amount = parseFloat(inv.amount_total) || 0;
          const paid = parseFloat(inv.amount_paid) || 0;
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
            .map((inv: any) => {
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
                <div class="invoice-amount">$${(parseFloat(inv.amount_total) || 0).toFixed(2)}</div>
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

    const project = this.projectsData.find((p: any) => p.id === this.currentProjectId);
    if (!project) return;

    const description = prompt('Enter line item description:', 'Web Development Services');
    if (!description) return;

    const amountStr = prompt('Enter amount ($):', '1000');
    if (!amountStr) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
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

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') return;

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
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
        })
      });

      if (response.ok) {
        alert('Invoice created successfully!');
        this.loadProjectInvoices(this.currentProjectId);
      } else {
        const error = await response.json();
        alert(`Failed to create invoice: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error creating invoice:', error);
      alert('Error creating invoice');
    }
  }

  /**
   * Send an invoice to the client (exposed globally for onclick)
   */
  public async sendInvoice(invoiceId: number): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') return;

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        alert('Invoice sent successfully!');
        if (this.currentProjectId) {
          this.loadProjectInvoices(this.currentProjectId);
        }
      } else {
        alert('Failed to send invoice');
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error sending invoice:', error);
      alert('Error sending invoice');
    }
  }

  /**
   * Set up file upload handlers for project detail view
   */
  private setupFileUploadHandlers(): void {
    const dropzone = document.getElementById('pd-upload-dropzone');
    const fileInput = document.getElementById('pd-file-input') as HTMLInputElement;
    const browseBtn = document.getElementById('btn-pd-browse-files');

    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          this.uploadFiles(fileInput.files);
          fileInput.value = ''; // Reset input
        }
      });
    }

    if (dropzone) {
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

    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode || authMode === 'demo') return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await fetch(`/api/projects/${this.currentProjectId}/files`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        alert(`${data.files?.length || files.length} file(s) uploaded successfully!`);
        this.loadProjectFiles(this.currentProjectId!);
      } else {
        const error = await response.json();
        alert(`Failed to upload files: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[AdminProjectDetails] Error uploading files:', error);
      alert('Error uploading files');
    }
  }

  /**
   * Get current project ID
   */
  getCurrentProjectId(): number | null {
    return this.currentProjectId;
  }
}

