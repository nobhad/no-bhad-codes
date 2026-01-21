/**
 * ===============================================
 * CLIENT PORTAL MODULE
 * ===============================================
 * @file src/modules/client-portal.ts
 *
 * Handles client portal functionality including login, project dashboard,
 * and project management interface.
 */

import { BaseModule } from '../../modules/core/base';
import type { ClientProject, ClientProjectStatus, ProjectPriority } from '../../types/client';
import { gsap } from 'gsap';
import { APP_CONSTANTS } from '../../config/constants';
import 'emoji-picker-element';
import type { ClientPortalContext } from './portal-types';
import {
  loadFilesModule,
  loadInvoicesModule,
  loadMessagesModule,
  loadSettingsModule,
  loadNavigationModule,
  loadProjectsModule,
  loadAuthModule
} from './modules';
import { decodeJwtPayload, isAdminPayload } from '../../utils/jwt-utils';
import { ICONS, getAccessibleIcon } from '../../constants/icons';

export class ClientPortalModule extends BaseModule {
  private isLoggedIn = false;
  private currentProject: ClientProject | null = null;
  private currentUser: string | null = null;
  private dashboardListenersSetup = false;

  // Configuration
  private config = {
    loginSectionId: 'login-section',
    dashboardSectionId: 'dashboard-section',
    loginFormId: 'login-form',
    projectsListId: 'projects-list',
    projectDetailsId: 'project-details'
  };

  // DOM elements
  private loginSection: HTMLElement | null = null;
  private dashboardSection: HTMLElement | null = null;
  private loginForm: HTMLFormElement | null = null;
  private projectsList: HTMLElement | null = null;
  private projectDetails: HTMLElement | null = null;

  /** Context object for module communication */
  private moduleContext: ClientPortalContext;

  constructor() {
    super('client-portal');
    this.moduleContext = this.createModuleContext();
  }

  /** Create module context for passing to child modules */
  private createModuleContext(): ClientPortalContext {
    return {
      getAuthToken: () => sessionStorage.getItem('client_auth_mode'),
      showNotification: (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'error') {
          console.error('[ClientPortal]', message);
          alert(message); // Show error prominently
        } else {
          this.showSuccessMessage(message);
        }
      },
      formatDate: (dateString: string) => this.formatDate(dateString),
      escapeHtml: (text: string) => this.escapeHtml(text)
    };
  }

  protected override async onInit(): Promise<void> {
    this.cacheElements();
    this.setupEventListeners();
    // Check for existing authentication using the auth module
    const authModule = await loadAuthModule();
    await authModule.checkExistingAuth({
      onAuthValid: async (user) => {
        this.isLoggedIn = true;
        this.currentUser = user.email;
        await this.loadRealUserProjects(user);
        this.showDashboard();
      }
    });
  }

  protected override async onDestroy(): Promise<void> {
    // Cleanup handled by page unload
  }

  private cacheElements(): void {
    this.loginSection = this.getElement(
      'Login section',
      `#${this.config.loginSectionId}`,
      false
    ) as HTMLElement | null;
    this.dashboardSection = this.getElement(
      'Dashboard section',
      `#${this.config.dashboardSectionId}`,
      false
    ) as HTMLElement | null;
    this.loginForm = this.getElement(
      'Login form',
      `#${this.config.loginFormId}`,
      false
    ) as HTMLFormElement | null;
    this.projectsList = this.getElement(
      'Projects list',
      `#${this.config.projectsListId}`,
      false
    ) as HTMLElement | null;
    this.projectDetails = this.getElement(
      'Project details',
      `#${this.config.projectDetailsId}`,
      false
    ) as HTMLElement | null;
  }

  private setupEventListeners(): void {
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(this.loginForm!);
        const authModule = await loadAuthModule();
        await authModule.handleLogin(
          {
            email: formData.get('email') as string,
            password: formData.get('password') as string
          },
          {
            onLoginSuccess: async (user) => {
              this.isLoggedIn = true;
              this.currentUser = user.email;
              await this.loadRealUserProjects(user);
              const isOnPortalPage = document.body.getAttribute('data-page') === 'client-portal';
              if (!isOnPortalPage) {
                window.location.href = '/client/portal.html';
                return;
              }
              this.showDashboard();
            },
            onLoginError: (message) => authModule.showLoginError(message),
            setLoading: (loading) => authModule.setLoginLoading(loading),
            clearErrors: () => authModule.clearErrors(),
            showFieldError: (fieldId, message) => authModule.showFieldError(fieldId, message)
          }
        );
      });
    }

    // Use setTimeout to ensure DOM elements are ready after dashboard is shown
    setTimeout(() => {
      this.setupDashboardEventListeners();
    }, 100);

    // Password toggle (login form)
    const passwordToggle = document.getElementById('password-toggle');
    const passwordInput = document.getElementById('client-password') as HTMLInputElement;
    if (passwordToggle && passwordInput) {
      passwordToggle.addEventListener('click', () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        passwordToggle.innerHTML =
          type === 'password'
            ? getAccessibleIcon('EYE', 'Show password')
            : getAccessibleIcon('EYE_OFF', 'Hide password');
      });
    }
  }

  private setupDashboardEventListeners(): void {
    if (this.dashboardListenersSetup) {
      this.log('Dashboard event listeners already set up, skipping...');
      return;
    }

    this.log('Setting up dashboard event listeners...');

    // Sidebar toggle (desktop)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    }

    // Header sidebar toggle buttons (arrows next to page titles)
    const headerSidebarToggles = document.querySelectorAll('.header-sidebar-toggle');
    headerSidebarToggles.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    });

    // Logout button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.handleLogout();
      });
    }

    // Sidebar buttons with data-tab attribute
    const sidebarButtons = document.querySelectorAll('.sidebar-buttons .btn[data-tab]');
    if (sidebarButtons.length > 0) {
      this.log(`Found ${sidebarButtons.length} sidebar buttons with data-tab`);
      sidebarButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const tabName = (btn as HTMLElement).dataset.tab;
          if (tabName) {
            this.switchTab(tabName);
            // Update active state on buttons
            sidebarButtons.forEach((b) => {
              b.classList.remove('active');
              b.removeAttribute('aria-current');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-current', 'page');
          }
        });
      });
    }

    // Clickable stat cards
    const statCards = document.querySelectorAll('.stat-card-clickable[data-tab]');
    if (statCards.length > 0) {
      this.log(`Found ${statCards.length} clickable stat cards`);
      statCards.forEach((card) => {
        card.addEventListener('click', (e) => {
          e.preventDefault();
          const tabName = (card as HTMLElement).dataset.tab;
          if (tabName) {
            this.switchTab(tabName);
            // Update active state on sidebar buttons
            sidebarButtons.forEach((b) => {
              b.classList.remove('active');
              b.removeAttribute('aria-current');
              if ((b as HTMLElement).dataset.tab === tabName) {
                b.classList.add('active');
                b.setAttribute('aria-current', 'page');
              }
            });
          }
        });
      });
    }

    // Password toggle buttons
    const passwordToggles = document.querySelectorAll('.cp-password-toggle');
    passwordToggles.forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = (toggle as HTMLElement).dataset.target;
        if (targetId) {
          const input = document.getElementById(targetId) as HTMLInputElement;
          if (input) {
            if (input.type === 'password') {
              input.type = 'text';
              toggle.innerHTML = ICONS.EYE_OFF;
            } else {
              input.type = 'password';
              toggle.innerHTML = ICONS.EYE;
            }
          }
        }
      });
    });

    // Emoji picker (using emoji-picker-element web component)
    const emojiToggle = document.getElementById('emoji-toggle');
    const emojiPickerWrapper = document.getElementById('emoji-picker-wrapper');
    const emojiPicker = document.getElementById('emoji-picker');
    const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
    const sendButton = document.getElementById('btn-send-message');

    if (emojiToggle && emojiPickerWrapper && emojiPicker) {
      // Toggle picker visibility
      emojiToggle.addEventListener('click', () => {
        emojiPickerWrapper.classList.toggle('hidden');
      });

      // Handle emoji selection from web component
      emojiPicker.addEventListener('emoji-click', (event: Event) => {
        const customEvent = event as CustomEvent;
        if (messageInput && customEvent.detail?.unicode) {
          const emoji = customEvent.detail.unicode;
          const start = messageInput.selectionStart;
          const end = messageInput.selectionEnd;
          const text = messageInput.value;
          messageInput.value = text.substring(0, start) + emoji + text.substring(end);
          messageInput.focus();
          messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
        }
      });

      // Close picker when clicking outside
      document.addEventListener('click', (e) => {
        if (
          !emojiPickerWrapper.contains(e.target as Node) &&
          e.target !== emojiToggle &&
          !emojiToggle.contains(e.target as Node)
        ) {
          emojiPickerWrapper.classList.add('hidden');
        }
      });
    }

    // Enter key to send message
    if (messageInput && sendButton) {
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendButton.click();
        }
      });

      // Send button click handler
      sendButton.addEventListener('click', (e) => {
        this.sendMessage(e);
      });
    }

    // Setup file upload handlers (drag & drop) - uses module
    loadFilesModule().then((filesModule) => {
      filesModule.setupFileUploadHandlers(this.moduleContext);
    });

    // Setup settings form handlers
    this.setupSettingsFormHandlers();

    this.log('Dashboard event listeners setup complete');
    this.dashboardListenersSetup = true;
  }

  /**
   * Setup settings form handlers (profile, notifications, billing)
   */
  private setupSettingsFormHandlers(): void {
    // Profile form
    const profileForm = document.getElementById('profile-form') as HTMLFormElement;
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveProfileSettings();
      });
    }

    // Password form
    const passwordForm = document.getElementById('password-form') as HTMLFormElement;
    if (passwordForm) {
      passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.savePasswordSettings();
      });
    }

    // Notifications form
    const notificationsForm = document.getElementById('notifications-form') as HTMLFormElement;
    if (notificationsForm) {
      notificationsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveNotificationSettings();
      });
    }

    // Billing form
    const billingForm = document.getElementById('billing-form') as HTMLFormElement;
    if (billingForm) {
      billingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveBillingSettings();
      });
    }

    // New project form
    const newProjectForm = document.getElementById('new-project-form') as HTMLFormElement;
    if (newProjectForm) {
      newProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitProjectRequest();
      });
    }
  }

  /**
   * Submit new project request
   */
  private async submitProjectRequest(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode) {
      alert('Please log in to submit a project request.');
      return;
    }

    const name = (document.getElementById('project-name') as HTMLInputElement)?.value;
    const projectType = (document.getElementById('project-type') as HTMLSelectElement)?.value;
    const budget = (document.getElementById('project-budget') as HTMLSelectElement)?.value;
    const timeline = (document.getElementById('project-timeline') as HTMLSelectElement)?.value;
    const description = (document.getElementById('project-description') as HTMLTextAreaElement)
      ?.value;

    if (!name || !projectType || !description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`${ClientPortalModule.PROJECTS_API_BASE}/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify({
          name,
          projectType,
          budget,
          timeline,
          description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit project request');
      }

      alert(data.message || 'Project request submitted successfully!');

      // Clear the form
      const form = document.getElementById('new-project-form') as HTMLFormElement;
      if (form) form.reset();

      // Switch to dashboard tab
      this.switchTab('dashboard');
    } catch (error) {
      console.error('Error submitting project request:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to submit project request. Please try again.'
      );
    }
  }

  /**
   * Save profile settings
   */
  private async saveProfileSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode) {
      alert('Please log in to save settings.');
      return;
    }

    const contactName = (document.getElementById('settings-name') as HTMLInputElement)?.value;
    const companyName = (document.getElementById('settings-company') as HTMLInputElement)?.value;
    const phone = (document.getElementById('settings-phone') as HTMLInputElement)?.value;
    const currentPassword = (document.getElementById('current-password') as HTMLInputElement)
      ?.value;
    const newPassword = (document.getElementById('new-password') as HTMLInputElement)?.value;
    const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement)
      ?.value;

    try {
      // Update profile info
      const profileResponse = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify({
          contact_name: contactName,
          company_name: companyName,
          phone: phone
        })
      });

      if (!profileResponse.ok) {
        const error = await profileResponse.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      // If password fields are filled, update password
      if (currentPassword && newPassword) {
        if (newPassword !== confirmPassword) {
          alert('New passwords do not match');
          return;
        }

        if (newPassword.length < 8) {
          alert('Password must be at least 8 characters');
          return;
        }

        const passwordResponse = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include', // Include HttpOnly cookies
          body: JSON.stringify({
            currentPassword,
            newPassword
          })
        });

        if (!passwordResponse.ok) {
          const error = await passwordResponse.json();
          throw new Error(error.error || 'Failed to update password');
        }

        // Clear password fields
        (document.getElementById('current-password') as HTMLInputElement).value = '';
        (document.getElementById('new-password') as HTMLInputElement).value = '';
        (document.getElementById('confirm-password') as HTMLInputElement).value = '';
      }

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert(error instanceof Error ? error.message : 'Failed to save profile. Please try again.');
    }
  }

  /**
   * Save password settings
   */
  private async savePasswordSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode) {
      alert('Please log in to change your password.');
      return;
    }

    const currentPassword = (document.getElementById('current-password') as HTMLInputElement)?.value;
    const newPassword = (document.getElementById('new-password') as HTMLInputElement)?.value;
    const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement)?.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      const response = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update password');
      }

      // Clear password fields
      (document.getElementById('current-password') as HTMLInputElement).value = '';
      (document.getElementById('new-password') as HTMLInputElement).value = '';
      (document.getElementById('confirm-password') as HTMLInputElement).value = '';

      alert('Password updated successfully!');
    } catch (error) {
      console.error('Error updating password:', error);
      alert(error instanceof Error ? error.message : 'Failed to update password. Please try again.');
    }
  }

  /**
   * Save notification settings
   */
  private async saveNotificationSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode) {
      alert('Please log in to save settings.');
      return;
    }

    const form = document.getElementById('notifications-form');
    if (!form) return;

    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    const settings = {
      messages: (checkboxes[0] as HTMLInputElement)?.checked || false,
      status: (checkboxes[1] as HTMLInputElement)?.checked || false,
      invoices: (checkboxes[2] as HTMLInputElement)?.checked || false,
      weekly: (checkboxes[3] as HTMLInputElement)?.checked || false
    };

    try {
      const response = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update notification preferences');
      }

      alert('Notification preferences saved!');
    } catch (error) {
      console.error('Error saving notifications:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to save preferences. Please try again.'
      );
    }
  }

  /**
   * Save billing settings
   */
  private async saveBillingSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode) {
      alert('Please log in to save settings.');
      return;
    }

    const billing = {
      company: (document.getElementById('billing-company') as HTMLInputElement)?.value,
      address: (document.getElementById('billing-address') as HTMLInputElement)?.value,
      address2: (document.getElementById('billing-address2') as HTMLInputElement)?.value,
      city: (document.getElementById('billing-city') as HTMLInputElement)?.value,
      state: (document.getElementById('billing-state') as HTMLInputElement)?.value,
      zip: (document.getElementById('billing-zip') as HTMLInputElement)?.value,
      country: (document.getElementById('billing-country') as HTMLInputElement)?.value
    };

    try {
      const response = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/billing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify(billing)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update billing information');
      }

      alert('Billing information saved!');
    } catch (error) {
      console.error('Error saving billing:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to save billing info. Please try again.'
      );
    }
  }

  /**
   * Load real user projects from API (for authenticated users)
   * Fetches projects and milestones from backend instead of using mock data
   */
  private async loadRealUserProjects(user: {
    id: number;
    email: string;
    name: string;
  }): Promise<void> {
    try {
      // Fetch projects from API
      const projectsResponse = await fetch('/api/projects', {
        credentials: 'include'
      });

      if (!projectsResponse.ok) {
        console.error('[ClientPortal] Failed to fetch projects:', projectsResponse.status);
        // Show error state
        const clientNameElement = document.getElementById('client-name');
        if (clientNameElement) {
          clientNameElement.textContent = user.name || user.email || 'Client';
        }
        if (this.projectsList) {
          this.projectsList.innerHTML =
            '<div class="error-message"><p>Unable to load projects. Please try again later.</p></div>';
        }
        return;
      }

      const projectsData = await projectsResponse.json();
      const apiProjects = projectsData.projects || [];

      if (apiProjects.length === 0) {
        // No projects yet - show empty state
        const clientNameElement = document.getElementById('client-name');
        if (clientNameElement) {
          clientNameElement.textContent = user.name || user.email || 'Client';
        }
        this.populateProjectsList([]);
        return;
      }

      // Transform API projects to ClientProject interface
      const clientProjects: ClientProject[] = await Promise.all(
        apiProjects.map(async (apiProject: any) => {
          // Fetch milestones for this project
          let milestones: any[] = [];
          try {
            const milestonesResponse = await fetch(`/api/projects/${apiProject.id}/milestones`, {
              credentials: 'include'
            });
            if (milestonesResponse.ok) {
              const milestonesData = await milestonesResponse.json();
              milestones = milestonesData.milestones || [];
            }
          } catch (milestoneError) {
            console.warn(`[ClientPortal] Failed to fetch milestones for project ${apiProject.id}:`, milestoneError);
          }

          // Transform milestone data to match ProjectMilestone interface
          const transformedMilestones = milestones.map((m: any) => ({
            id: String(m.id),
            title: m.title || 'Untitled Milestone',
            description: m.description || '',
            dueDate: m.due_date || new Date().toISOString().split('T')[0],
            completedDate: m.completed_date || undefined,
            isCompleted: Boolean(m.is_completed),
            deliverables: Array.isArray(m.deliverables) ? m.deliverables : []
          }));

          // Calculate progress from milestones if available
          const completedMilestones = transformedMilestones.filter((m: any) => m.isCompleted).length;
          const totalMilestones = transformedMilestones.length;
          const calculatedProgress = totalMilestones > 0
            ? Math.round((completedMilestones / totalMilestones) * 100)
            : (apiProject.progress || 0);

          // Transform to ClientProject interface
          return {
            id: String(apiProject.id),
            projectName: apiProject.project_name || apiProject.name || 'Untitled Project',
            description: apiProject.description || '',
            clientId: String(apiProject.client_id || user.id),
            clientName: user.name || user.email || 'Client',
            status: (apiProject.status || 'pending') as ClientProjectStatus,
            priority: (apiProject.priority || 'medium') as ProjectPriority,
            progress: calculatedProgress,
            startDate: apiProject.start_date || apiProject.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            estimatedEndDate: apiProject.estimated_end_date || undefined,
            actualEndDate: apiProject.actual_end_date || undefined,
            updates: [], // Loaded on-demand when project is selected
            files: [],   // Loaded on-demand when project is selected
            messages: [], // Loaded on-demand when project is selected
            milestones: transformedMilestones
          } as ClientProject;
        })
      );

      // Set client name in header
      const clientNameElement = document.getElementById('client-name');
      if (clientNameElement) {
        clientNameElement.textContent = user.name || user.email || 'Client';
      }

      this.populateProjectsList(clientProjects);
    } catch (error) {
      console.error('[ClientPortal] Failed to load projects:', error);
      // Show error state
      const clientNameElement = document.getElementById('client-name');
      if (clientNameElement) {
        clientNameElement.textContent = user.name || user.email || 'Client';
      }
      if (this.projectsList) {
        this.projectsList.innerHTML =
          '<div class="error-message"><p>Unable to load projects. Please try again later.</p></div>';
      }
    }
  }

  private populateProjectsList(projects: ClientProject[]): void {
    if (!this.projectsList) return;

    if (projects.length === 0) {
      this.projectsList.innerHTML = '<div class="no-projects"><p>No projects found.</p></div>';
      return;
    }

    this.projectsList.innerHTML = '';

    projects.forEach((project) => {
      const projectItem = document.createElement('div');
      projectItem.className = 'project-item';
      projectItem.dataset.projectId = project.id;

      projectItem.innerHTML = `
        <span class="project-icon">📄</span>
        <span class="project-name">${project.projectName}</span>
      `;

      projectItem.addEventListener('click', () => {
        this.selectProject(project);
        document
          .querySelectorAll('.project-item')
          .forEach((item) => item.classList.remove('active'));
        projectItem.classList.add('active');
      });

      this.projectsList?.appendChild(projectItem);
    });
  }

  private async selectProject(project: ClientProject): Promise<void> {
    this.currentProject = project;

    // Hide other views first
    const welcomeView = document.getElementById('welcome-view');
    const projectDetailView = document.getElementById('project-detail-view');
    const settingsView = document.getElementById('settings-view');
    const billingView = document.getElementById('billing-view');

    if (welcomeView) welcomeView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';
    if (billingView) billingView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'block';

    // Clear active state from navigation items
    document.querySelectorAll('.account-item').forEach((item) => item.classList.remove('active'));

    // For authenticated users, fetch full project details (updates, messages)
    const authMode = sessionStorage.getItem('client_auth_mode');
    if (authMode === 'authenticated') {
      await this.fetchProjectDetails(project.id);
    }

    this.populateProjectDetails();
  }

  /**
   * Fetch full project details including updates and messages from API
   */
  private async fetchProjectDetails(projectId: string): Promise<void> {
    if (!this.currentProject) return;

    try {
      // Fetch project details from API
      const response = await fetch(`/api/projects/${projectId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        console.warn('[ClientPortal] Failed to fetch project details:', response.status);
        return;
      }

      const data = await response.json();

      // Transform and update updates
      if (data.updates && Array.isArray(data.updates)) {
        this.currentProject.updates = data.updates.map((u: any) => ({
          id: String(u.id),
          date: u.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          title: u.title || 'Update',
          description: u.description || '',
          author: u.author || 'System',
          type: u.update_type || 'general'
        }));
      }

      // Transform and update messages
      if (data.messages && Array.isArray(data.messages)) {
        this.currentProject.messages = data.messages.map((m: any) => ({
          id: String(m.id),
          sender: m.sender_name || 'Unknown',
          senderRole: m.sender_role === 'admin' ? 'developer' : (m.sender_role || 'system'),
          message: m.message || '',
          timestamp: m.created_at || new Date().toISOString(),
          isRead: Boolean(m.is_read)
        }));
      }

    } catch (error) {
      console.warn('[ClientPortal] Error fetching project details:', error);
    }
  }

  private populateProjectDetails(): void {
    if (!this.currentProject) return;

    // Populate project title
    const titleElement = document.getElementById('project-title');
    if (titleElement) {
      titleElement.textContent = this.currentProject.projectName;
    }

    // Populate status
    const statusElement = document.getElementById('project-status');
    if (statusElement) {
      statusElement.textContent = this.currentProject.status.replace('-', ' ');
      statusElement.className = `status-badge status-${this.currentProject.status}`;
    }

    // Populate project description
    const descriptionElement = document.getElementById('project-description');
    if (descriptionElement) {
      descriptionElement.textContent =
        this.currentProject.description || 'Project details will be updated soon.';
    }

    // Populate current phase
    const currentPhaseElement = document.getElementById('current-phase');
    if (currentPhaseElement) {
      const phase =
        this.currentProject.status === 'pending'
          ? 'Initial Review'
          : this.currentProject.status === 'in-progress'
            ? 'Development'
            : this.currentProject.status === 'in-review'
              ? 'Review'
              : 'Completed';
      currentPhaseElement.textContent = phase;
    }

    // Populate next milestone
    const nextMilestoneElement = document.getElementById('next-milestone');
    if (
      nextMilestoneElement &&
      this.currentProject.milestones &&
      this.currentProject.milestones.length > 0
    ) {
      const nextMilestone = this.currentProject.milestones.find((m) => !m.isCompleted);
      nextMilestoneElement.textContent = nextMilestone
        ? nextMilestone.title
        : 'No upcoming milestones';
    }

    // Populate progress
    const progressFill = document.getElementById('progress-fill') as HTMLElement;
    const progressText = document.getElementById('progress-text');
    if (progressFill && progressText) {
      progressFill.style.width = `${this.currentProject.progress}%`;
      progressText.textContent = `${this.currentProject.progress}% Complete`;
    }

    // Populate dates
    const startDateElement = document.getElementById('start-date');
    if (startDateElement) {
      startDateElement.textContent = this.formatDate(this.currentProject.startDate);
    }

    const lastUpdateElement = document.getElementById('last-update');
    if (lastUpdateElement) {
      const lastUpdate =
        this.currentProject.updates && this.currentProject.updates.length > 0
          ? this.currentProject.updates[0].date
          : this.currentProject.startDate;
      lastUpdateElement.textContent = this.formatDate(lastUpdate);
    }

    // Load sections
    this.loadUpdates();
    this.loadFiles();
    this.loadMessages();
  }

  private loadUpdates(): void {
    if (!this.currentProject) return;

    const timelineContainer = document.getElementById('updates-timeline');
    if (!timelineContainer) return;

    timelineContainer.innerHTML = '';

    this.currentProject.updates.forEach((update) => {
      const updateElement = document.createElement('div');
      updateElement.className = 'timeline-item';
      // Sanitize user data to prevent XSS
      const safeTitle = this.escapeHtml(update.title || '');
      const safeDescription = this.escapeHtml(update.description || '');
      const safeAuthor = this.escapeHtml(update.author || '');
      updateElement.innerHTML = `
        <div class="timeline-marker ${update.type}"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <h4>${safeTitle}</h4>
            <span class="timeline-date">${this.formatDate(update.date)}</span>
          </div>
          <p>${safeDescription}</p>
          <div class="timeline-author">by ${safeAuthor}</div>
        </div>
      `;
      timelineContainer.appendChild(updateElement);
    });
  }

  /** Files API base URL */
  private static readonly FILES_API_BASE = '/api/uploads';

  /** Invoices API base URL */
  private static readonly INVOICES_API_BASE = '/api/invoices';

  /** Clients API base URL */
  private static readonly CLIENTS_API_BASE = '/api/clients';

  /** Projects API base URL */
  private static readonly PROJECTS_API_BASE = '/api/projects';

  /** Messages API base URL */
  private static readonly MESSAGES_API_BASE = '/api/messages';

  /**
   * Load files from API and render the list (delegates to module)
   */
  private async loadFiles(): Promise<void> {
    const filesModule = await loadFilesModule();
    await filesModule.loadFiles(this.moduleContext);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // =====================================================
  // INVOICE MANAGEMENT
  // =====================================================

  /**
   * Load invoices - delegates to invoices module
   */
  private async loadInvoices(): Promise<void> {
    const invoicesModule = await loadInvoicesModule();
    await invoicesModule.loadInvoices(this.moduleContext);
  }

  // NOTE: Invoice rendering methods moved to portal-invoices module

  private loadMessages(): void {
    if (!this.currentProject) return;

    const messagesContainer = document.getElementById('messages-list');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';

    this.currentProject.messages.forEach((message) => {
      const messageElement = document.createElement('div');
      messageElement.className = `message message-${message.senderRole}`;
      // Sanitize user data to prevent XSS
      const safeSender = this.escapeHtml(message.sender || '');
      const safeMessage = this.escapeHtml(message.message || '');
      messageElement.innerHTML = `
        <div class="message-header">
          <span class="message-sender">${safeSender}</span>
          <span class="message-time">${this.formatDate(message.timestamp)}</span>
        </div>
        <div class="message-content">${safeMessage}</div>
      `;
      messagesContainer.appendChild(messageElement);
    });
  }

  private showDashboard(): void {
    if (!this.loginSection || !this.dashboardSection) return;

    // Simplified transition without GSAP to prevent flashing
    if (this.loginSection) this.loginSection.style.display = 'none';
    if (this.dashboardSection) {
      this.dashboardSection.style.display = 'block';

      // Setup dashboard event listeners if not already done
      if (!this.dashboardListenersSetup) {
        setTimeout(() => {
          this.setupDashboardEventListeners();
        }, 100);
      }

      // Show admin features if user is admin
      this.setupAdminFeatures();
    }
  }

  /**
   * Check if user is admin and show admin-only UI elements
   */
  private setupAdminFeatures(): void {
    try {
      // Check sessionStorage for admin flag
      const authData = sessionStorage.getItem('clientAuth');
      if (authData) {
        const parsed = JSON.parse(authData);
        if (parsed.isAdmin) {
          // Show admin buttons
          const adminButtons = document.querySelectorAll('.btn-admin');
          adminButtons.forEach((btn) => btn.classList.remove('hidden'));
          this.log('[ClientPortal] Admin features enabled');
        }
      }

      // Also check JWT token for admin flag
      const token = sessionStorage.getItem('client_auth_token');
      if (token) {
        const payload = decodeJwtPayload(token);
        if (payload && isAdminPayload(payload)) {
          const adminButtons = document.querySelectorAll('.btn-admin');
          adminButtons.forEach((btn) => btn.classList.remove('hidden'));
          this.log('[ClientPortal] Admin features enabled (from token)');
        }
      }
    } catch (error) {
      console.error('[ClientPortal] Error checking admin status:', error);
    }
  }

  private animateDashboard(): void {
    gsap.fromTo(
      this.dashboardSection,
      {
        opacity: 0,
        y: 20
      },
      {
        opacity: 1,
        y: 0,
        duration: APP_CONSTANTS.TIMERS.PAGE_TRANSITION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      }
    );
  }

  private async logout(): Promise<void> {
    // Clear authentication data using auth module
    const authModule = await loadAuthModule();
    authModule.clearAuthData();

    this.isLoggedIn = false;
    this.currentProject = null;
    this.currentUser = null;
    this.dashboardListenersSetup = false; // Reset listeners flag

    // Clear form data
    if (this.loginForm) {
      this.loginForm.reset();
    }
    authModule.clearErrors();

    // Simple transition without animations
    if (this.dashboardSection) this.dashboardSection.style.display = 'none';
    if (this.loginSection) this.loginSection.style.display = 'block';
  }

  // =====================================================
  // MESSAGING - Delegates to portal-messages module
  // =====================================================

  /**
   * Load messages from API - delegates to messages module
   */
  private async loadMessagesFromAPI(): Promise<void> {
    const messagesModule = await loadMessagesModule();
    await messagesModule.loadMessagesFromAPI(this.moduleContext);
  }

  /**
   * Send a message - delegates to messages module
   */
  private async sendMessage(event: Event): Promise<void> {
    event.preventDefault();
    const messagesModule = await loadMessagesModule();
    await messagesModule.sendMessage(this.moduleContext);
  }

  // NOTE: Message rendering methods moved to portal-messages module

  private handleTabClick(event: Event): void {
    event.preventDefault();
    const tab = event.target as HTMLElement;
    const tabName = tab.dataset.tab;
    if (!tabName) return;

    // Update tab active states
    document.querySelectorAll('.project-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.remove('active'));
    const targetPane = document.getElementById(`${tabName}-content`);
    if (targetPane) {
      targetPane.classList.add('active');
    }
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // =====================================================
  // NAVIGATION - Delegates to portal-navigation module
  // =====================================================

  private async showSettings(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showSettings(() => this.loadUserSettings());
  }

  private async showBillingView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showBillingView(() => this.loadBillingSettings());
  }

  private async showContactView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showContactView(() => this.loadContactSettings());
  }

  private async showNotificationsView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showNotificationsView(() => this.loadNotificationSettings());
  }

  private async showUpdatesView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showUpdatesView();
  }

  private async showFilesView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showFilesView();
  }

  private async showMessagesView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showMessagesView();
  }

  private async showContentView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showContentView();
  }

  private async showProjectDetailView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showProjectDetailView(() => this.showWelcomeView());
  }

  private async showWelcomeView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showWelcomeView();
  }

  private async hideAllViews(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.hideAllViews();
  }

  private async toggleSidebar(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.toggleSidebar();
  }

  /**
   * Handle user logout - delegates to auth module
   */
  private async handleLogout(): Promise<void> {
    const authModule = await loadAuthModule();
    authModule.handleLogout();
  }

  /**
   * Switch to a specific tab in the dashboard - delegates to navigation module
   */
  private async switchTab(tabName: string): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.switchTab(tabName, {
      loadFiles: () => this.loadFiles(),
      loadInvoices: () => this.loadInvoices(),
      loadProjectPreview: () => this.loadProjectPreview(),
      loadMessagesFromAPI: () => this.loadMessagesFromAPI()
    });
  }

  /**
   * Load project preview into iframe - delegates to projects module
   */
  private async loadProjectPreview(): Promise<void> {
    const projectsModule = await loadProjectsModule();
    await projectsModule.loadProjectPreview(this.moduleContext);
  }

  private async toggleAccountFolder(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.toggleAccountFolder();
  }

  /**
   * Setup settings forms - delegates to settings module
   */
  private async setupSettingsForms(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    settingsModule.setupSettingsForms(this.moduleContext);
  }

  // =====================================================
  // SETTINGS - Delegates to portal-settings module
  // =====================================================

  /**
   * Load user settings - delegates to settings module
   */
  private async loadUserSettings(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    settingsModule.loadUserSettings(this.currentUser);
  }

  /**
   * Load billing settings - delegates to settings module
   */
  private async loadBillingSettings(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    settingsModule.loadBillingSettings();
  }

  /**
   * Load contact settings - delegates to settings module
   */
  private async loadContactSettings(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    settingsModule.loadContactSettings(this.currentUser);
  }

  /**
   * Load notification settings - delegates to settings module
   */
  private async loadNotificationSettings(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    settingsModule.loadNotificationSettings();
  }

  // NOTE: Settings save methods moved to portal-settings module
  // The setupViewFormHandlers method now delegates to the module

  private showSuccessMessage(message: string): void {
    // Create success message element
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-primary);
      color: var(--color-dark);
      padding: 1rem 2rem;
      border: 2px solid var(--color-dark);
      z-index: 9999;
      font-weight: 600;
    `;

    document.body.appendChild(successDiv);

    // Remove after 3 seconds
    setTimeout(() => {
      successDiv.remove();
    }, 3000);
  }
}
