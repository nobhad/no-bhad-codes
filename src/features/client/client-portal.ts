/**
 * ===============================================
 * CLIENT PORTAL MODULE
 * ===============================================
 * @file src/modules/client-portal.ts
 *
 * Handles client portal functionality including login, project dashboard,
 * and project management interface.
 */

import { BaseModule } from '../../modules/base';
import type { ClientProject, ClientProjectStatus } from '../../types/client';
import { gsap } from 'gsap';
import { APP_CONSTANTS } from '../../config/constants';

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

  constructor() {
    super('client-portal');
  }

  protected override async onInit(): Promise<void> {
    this.cacheElements();
    this.setupEventListeners();
    // Disable animations that might cause issues
    // this.setupAnimations();

    // Disable auth check to prevent redirects
    // await this.checkExistingAuth();
  }

  protected override onDestroy(): void {
    // Cleanup event listeners and animations
    if (this.loginForm) {
      this.loginForm.removeEventListener('submit', this.handleLogin);
    }
  }

  private cacheElements(): void {
    this.loginSection = this.getElement('Login section', `#${this.config.loginSectionId}`, false) as HTMLElement | null;
    this.dashboardSection = this.getElement('Dashboard section', `#${this.config.dashboardSectionId}`, false) as HTMLElement | null;
    this.loginForm = this.getElement('Login form', `#${this.config.loginFormId}`, false) as HTMLFormElement | null;
    this.projectsList = this.getElement('Projects list', `#${this.config.projectsListId}`, false) as HTMLElement | null;
    this.projectDetails = this.getElement('Project details', `#${this.config.projectDetailsId}`, false) as HTMLElement | null;
  }

  private setupEventListeners(): void {
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', this.handleLogin.bind(this));
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
        passwordToggle.innerHTML = type === 'password' ?
          '<span class="visually-hidden">Show password</span>👁️' :
          '<span class="visually-hidden">Hide password</span>👁️‍🗨️';
      });
    }
  }

  private setupDashboardEventListeners(): void {
    if (this.dashboardListenersSetup) {
      console.log('Dashboard event listeners already set up, skipping...');
      return;
    }

    console.log('Setting up dashboard event listeners...');

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      console.log('Logout button found, adding event listener');
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.logout();
      });
    } else {
      console.log('Logout button not found');
    }

    // Settings form handlers
    this.setupSettingsForms();

    // Account folder toggle
    const accountHeader = document.querySelector('.account-header');
    if (accountHeader) {
      console.log('Account header found, adding event listener');
      accountHeader.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleAccountFolder();
      });
    } else {
      console.log('Account header not found');
    }

    // Account section buttons
    const contactBtn = document.getElementById('contact-btn');
    if (contactBtn) {
      console.log('Contact button found, adding event listener');
      contactBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showContactView();
      });
    } else {
      console.log('Contact button not found');
    }

    const billingBtn = document.getElementById('billing-btn');
    if (billingBtn) {
      console.log('Billing button found, adding event listener');
      billingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showBillingView();
      });
    } else {
      console.log('Billing button not found');
    }

    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn) {
      console.log('Notifications button found, adding event listener');
      notificationsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showNotificationsView();
      });
    } else {
      console.log('Notifications button not found');
    }

    // Project sub-item navigation
    const updatesBtn = document.getElementById('updates-btn');
    if (updatesBtn) {
      console.log('Updates button found, adding event listener');
      updatesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showUpdatesView();
      });
    } else {
      console.log('Updates button not found');
    }

    const filesBtn = document.getElementById('files-btn');
    if (filesBtn) {
      console.log('Files button found, adding event listener');
      filesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showFilesView();
      });
    } else {
      console.log('Files button not found');
    }

    const messagesBtn = document.getElementById('messages-btn');
    if (messagesBtn) {
      console.log('Messages button found, adding event listener');
      messagesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showMessagesView();
      });
    } else {
      console.log('Messages button not found');
    }

    // Project main item navigation
    const projectMain = document.getElementById('project-main');
    if (projectMain) {
      console.log('Project main found, adding event listener');
      projectMain.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showProjectDetailView();
      });
    } else {
      console.log('Project main not found');
    }

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      console.log('Sidebar toggle button found, adding event listener');
      sidebarToggle.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Toggle button clicked!');
        this.toggleSidebar();
      });
    } else {
      console.log('Sidebar toggle button not found');
    }

    // Message form
    const messageForm = document.getElementById('message-form');
    if (messageForm) {
      console.log('Message form found, adding event listener');
      messageForm.addEventListener('submit', this.sendMessage.bind(this));
    }

    // Tab switching
    const tabs = document.querySelectorAll('.project-tab');
    if (tabs.length > 0) {
      console.log(`Found ${tabs.length} tabs, adding event listeners`);
      tabs.forEach(tab => {
        tab.addEventListener('click', this.handleTabClick.bind(this));
      });
    }

    console.log('Dashboard event listeners setup complete');
    this.dashboardListenersSetup = true;
  }

  private setupAnimations(): void {
    // Disable animations temporarily to prevent flashing
    // this.setupButtonAnimations();
  }

  private setupButtonAnimations(): void {
    const buttons = document.querySelectorAll('.client-buttons .btn');
    buttons.forEach(button => {
      this.animateButton(button as HTMLElement);
    });
  }

  private animateButton(button: HTMLElement): void {
    // GSAP button animation logic here
    const buttonText = button.textContent?.trim() || '';
    button.innerHTML = `<span style="position: relative; z-index: 2;">${buttonText}</span>`;

    // Create fill element for hover effect
    const fillElement = document.createElement('div');
    fillElement.className = 'button-fill';
    fillElement.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 0%;
      height: 100%;
      background-color: #00ff41;
      z-index: 0;
      pointer-events: none;
      border-radius: inherit;
      transform-origin: left center;
    `;
    button.appendChild(fillElement);

    // Add hover animations
    button.addEventListener('mouseenter', (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const mouseX = e.clientX;
      const buttonCenter = rect.left + rect.width / 2;
      const enteredFromLeft = mouseX < buttonCenter;

      gsap.set(fillElement, {
        left: enteredFromLeft ? '0' : 'auto',
        right: enteredFromLeft ? 'auto' : '0',
        transformOrigin: enteredFromLeft ? 'left center' : 'right center'
      });

      gsap.to(fillElement, {
        width: '100%',
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });

      gsap.to(button, {
        color: APP_CONSTANTS.THEME.DARK,
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });
    });

    button.addEventListener('mouseleave', (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const mouseX = e.clientX;
      const buttonCenter = rect.left + rect.width / 2;
      const exitingFromLeft = mouseX < buttonCenter;

      gsap.set(fillElement, {
        left: exitingFromLeft ? '0' : 'auto',
        right: exitingFromLeft ? 'auto' : '0',
        transformOrigin: exitingFromLeft ? 'left center' : 'right center'
      });

      gsap.to(fillElement, {
        width: '0%',
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });

      gsap.to(button, {
        color: 'inherit',
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });
    });
  }

  private async handleLogin(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.loginForm) return;

    const formData = new FormData(this.loginForm);
    const credentials = {
      email: formData.get('email') as string,
      password: formData.get('password') as string
    };

    // Clear previous errors
    this.clearErrors();
    document.getElementById('login-error')!.style.display = 'none';

    // Basic validation
    if (!credentials.email.trim()) {
      this.showFieldError('client-email', 'Email address is required');
      return;
    }

    if (!credentials.password.trim()) {
      this.showFieldError('client-password', 'Password is required');
      return;
    }

    this.setLoginLoading(true);

    try {
      // For demo purposes, simulate successful login
      if (credentials.email && credentials.password) {
        // Simulate a successful login response
        const mockUserData = {
          token: `demo_token_${  Date.now()}`,
          user: {
            id: 1,
            email: credentials.email,
            name: credentials.email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          }
        };

        // Store authentication token
        localStorage.setItem('client_auth_token', mockUserData.token);

        this.isLoggedIn = true;
        this.currentUser = mockUserData.user.email;

        // Load mock user projects
        await this.loadMockUserProjects(mockUserData.user);
        this.showDashboard();
      } else {
        throw new Error('Please enter both email and password');
      }

    } catch (error) {
      console.error('Login error:', error);
      this.showLoginError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      this.setLoginLoading(false);
    }
  }

  private async loadMockUserProjects(user: {id: number, email: string, name: string}): Promise<void> {
    try {
      // Create sample project data based on user
      const sampleProject: ClientProject = {
        id: `project-${user.id}-001`,
        projectName: 'Your Website Project',
        description: 'Custom website development based on your intake form requirements.',
        clientId: user.email,
        clientName: user.name || 'Valued Client',
        status: 'pending' as ClientProjectStatus,
        priority: 'medium',
        progress: 25,
        startDate: new Date().toISOString().split('T')[0],
        estimatedEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        updates: [
          {
            id: 'update-001',
            date: new Date().toISOString().split('T')[0],
            title: 'Project Intake Received',
            description: 'Your project details have been received and we\'re reviewing your requirements.',
            author: 'No Bhad Codes Team',
            type: 'general'
          },
          {
            id: 'update-002',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            title: 'Account Activated',
            description: 'Your client account has been activated and you now have access to this portal.',
            author: 'System',
            type: 'general'
          }
        ],
        files: [],
        messages: [
          {
            id: 'msg-001',
            sender: 'No Bhad Codes Team',
            senderRole: 'system',
            message: 'Welcome to your project portal! We\'ll keep you updated on progress here.',
            timestamp: new Date().toISOString(),
            isRead: false
          }
        ],
        milestones: [
          {
            id: 'milestone-001',
            title: 'Project Planning',
            description: 'Review requirements and create detailed project plan',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            isCompleted: false,
            deliverables: ['Requirements analysis', 'Project timeline', 'Technical specification']
          },
          {
            id: 'milestone-002',
            title: 'Design Phase',
            description: 'Create mockups and design system',
            dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            isCompleted: false,
            deliverables: ['Wireframes', 'Visual designs', 'Style guide']
          }
        ]
      };

      // Set client name in header
      const clientNameElement = document.getElementById('client-name');
      if (clientNameElement) {
        clientNameElement.textContent = user.name || user.email || 'Client';
      }

      this.populateProjectsList([sampleProject]);

    } catch (error) {
      console.error('Failed to load projects:', error);
      // Show error message or fallback
      if (this.projectsList) {
        this.projectsList.innerHTML = '<div class="error-message"><p>Failed to load projects. Please try refreshing the page.</p></div>';
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

    projects.forEach(project => {
      const projectItem = document.createElement('div');
      projectItem.className = 'project-item';
      projectItem.dataset.projectId = project.id;

      projectItem.innerHTML = `
        <span class="project-icon">📄</span>
        <span class="project-name">${project.projectName}</span>
      `;

      projectItem.addEventListener('click', () => {
        this.selectProject(project);
        document.querySelectorAll('.project-item').forEach(item => item.classList.remove('active'));
        projectItem.classList.add('active');
      });

      this.projectsList?.appendChild(projectItem);
    });
  }

  private selectProject(project: ClientProject): void {
    this.currentProject = project;
    this.populateProjectDetails();

    // Hide other views
    const welcomeView = document.getElementById('welcome-view');
    const projectDetailView = document.getElementById('project-detail-view');
    const settingsView = document.getElementById('settings-view');
    const billingView = document.getElementById('billing-view');

    if (welcomeView) welcomeView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';
    if (billingView) billingView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'block';

    // Clear active state from navigation items
    document.querySelectorAll('.account-item').forEach(item => item.classList.remove('active'));
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
      descriptionElement.textContent = this.currentProject.description || 'Project details will be updated soon.';
    }

    // Populate current phase
    const currentPhaseElement = document.getElementById('current-phase');
    if (currentPhaseElement) {
      const phase = this.currentProject.status === 'pending' ? 'Initial Review' :
        this.currentProject.status === 'in-progress' ? 'Development' :
          this.currentProject.status === 'in-review' ? 'Review' : 'Completed';
      currentPhaseElement.textContent = phase;
    }

    // Populate next milestone
    const nextMilestoneElement = document.getElementById('next-milestone');
    if (nextMilestoneElement && this.currentProject.milestones && this.currentProject.milestones.length > 0) {
      const nextMilestone = this.currentProject.milestones.find(m => !m.isCompleted);
      nextMilestoneElement.textContent = nextMilestone ? nextMilestone.title : 'No upcoming milestones';
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
      const lastUpdate = this.currentProject.updates && this.currentProject.updates.length > 0 ?
        this.currentProject.updates[0].date : this.currentProject.startDate;
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

    this.currentProject.updates.forEach((update: any) => {
      const updateElement = document.createElement('div');
      updateElement.className = 'timeline-item';
      updateElement.innerHTML = `
        <div class="timeline-marker ${update.type}"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <h4>${update.title}</h4>
            <span class="timeline-date">${this.formatDate(update.date)}</span>
          </div>
          <p>${update.description}</p>
          <div class="timeline-author">by ${update.author}</div>
        </div>
      `;
      timelineContainer.appendChild(updateElement);
    });
  }

  private loadFiles(): void {
    if (!this.currentProject) return;

    const filesContainer = document.getElementById('files-grid');
    if (!filesContainer) return;

    if (this.currentProject.files.length === 0) {
      filesContainer.innerHTML = '<p class="no-files">No files available yet.</p>';
      return;
    }

    // Populate files when available
    filesContainer.innerHTML = '';
    // Implementation for files display will be added later
  }

  private loadMessages(): void {
    if (!this.currentProject) return;

    const messagesContainer = document.getElementById('messages-list');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';

    this.currentProject.messages.forEach((message: any) => {
      const messageElement = document.createElement('div');
      messageElement.className = `message message-${message.senderRole}`;
      messageElement.innerHTML = `
        <div class="message-header">
          <span class="message-sender">${message.sender}</span>
          <span class="message-time">${this.formatDate(message.timestamp)}</span>
        </div>
        <div class="message-content">${message.message}</div>
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
    }
  }

  private animateDashboard(): void {
    gsap.fromTo(this.dashboardSection, {
      opacity: 0,
      y: 20
    }, {
      opacity: 1,
      y: 0,
      duration: APP_CONSTANTS.TIMERS.PAGE_TRANSITION / 1000,
      ease: APP_CONSTANTS.EASING.SMOOTH
    });
  }

  private logout(): void {
    // Clear authentication token
    localStorage.removeItem('client_auth_token');

    this.isLoggedIn = false;
    this.currentProject = null;
    this.currentUser = null;
    this.dashboardListenersSetup = false; // Reset listeners flag

    // Clear form data
    if (this.loginForm) {
      this.loginForm.reset();
    }
    this.clearErrors();

    // Simple transition without animations
    if (this.dashboardSection) this.dashboardSection.style.display = 'none';
    if (this.loginSection) this.loginSection.style.display = 'block';
  }

  private async sendMessage(event: Event): Promise<void> {
    event.preventDefault();
    // Implementation for sending messages
  }

  private handleTabClick(event: Event): void {
    event.preventDefault();
    const tab = event.target as HTMLElement;
    const tabName = tab.dataset.tab;
    if (!tabName) return;

    // Update tab active states
    document.querySelectorAll('.project-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    const targetPane = document.getElementById(`${tabName}-content`);
    if (targetPane) {
      targetPane.classList.add('active');
    }
  }

  private showFieldError(fieldId: string, message: string): void {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId.replace('client-', '')}-error`);

    if (field) field.classList.add('error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  private showLoginError(message: string): void {
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  private setLoginLoading(loading: boolean): void {
    const submitBtn = document.getElementById('login-btn') as HTMLButtonElement;
    const loader = document.querySelector('.btn-loader') as HTMLElement;

    if (submitBtn) {
      submitBtn.disabled = loading;
      if (loading) {
        submitBtn.classList.add('loading');
      } else {
        submitBtn.classList.remove('loading');
      }
    }

    if (loader) {
      loader.style.display = loading ? 'block' : 'none';
    }
  }

  private async checkExistingAuth(): Promise<void> {
    const token = localStorage.getItem('client_auth_token');
    if (!token) return;

    try {
      const response = await fetch('http://localhost:3001/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.isLoggedIn = true;
        this.currentUser = data.user.email;
        await this.loadMockUserProjects(data.user);
        this.showDashboard();
      } else {
        // Token is invalid, remove it
        localStorage.removeItem('client_auth_token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('client_auth_token');
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

  private clearErrors(): void {
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.error-message').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  }

  private showSettings(): void {
    // Hide other views
    const welcomeView = document.getElementById('welcome-view');
    const projectDetailView = document.getElementById('project-detail-view');
    const settingsView = document.getElementById('settings-view');

    if (welcomeView) welcomeView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'none';
    if (settingsView) {
      settingsView.style.display = 'block';
      // Load current user data into forms
      this.loadUserSettings();
    }

    // Remove active state from all navigation items
    document.querySelectorAll('.project-item, .account-item').forEach(item => item.classList.remove('active'));
  }

  private showBillingView(): void {
    // Hide other views
    this.hideAllViews();

    // Show billing view
    const billingView = document.getElementById('billing-view');
    if (billingView) {
      billingView.style.display = 'block';
      // Load current billing data into forms
      this.loadBillingSettings();
    }

    // Set active state on billing button
    document.querySelectorAll('.project-item, .account-item').forEach(item => item.classList.remove('active'));
    const billingBtn = document.getElementById('billing-btn');
    if (billingBtn) billingBtn.classList.add('active');
  }

  private showContactView(): void {
    // Hide other views
    const welcomeView = document.getElementById('welcome-view');
    const projectDetailView = document.getElementById('project-detail-view');
    const billingView = document.getElementById('billing-view');
    const settingsView = document.getElementById('settings-view');
    const notificationsView = document.getElementById('notifications-view');
    const contactView = document.getElementById('contact-view');

    if (welcomeView) welcomeView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'none';
    if (billingView) billingView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';
    if (notificationsView) notificationsView.style.display = 'none';
    if (contactView) {
      contactView.style.display = 'block';
      // Load current contact data into forms
      this.loadContactSettings();
    }

    // Set active state on contact button
    document.querySelectorAll('.project-item, .account-item').forEach(item => item.classList.remove('active'));
    const contactBtn = document.getElementById('contact-btn');
    if (contactBtn) contactBtn.classList.add('active');
  }

  private showNotificationsView(): void {
    // Hide other views
    const welcomeView = document.getElementById('welcome-view');
    const projectDetailView = document.getElementById('project-detail-view');
    const billingView = document.getElementById('billing-view');
    const settingsView = document.getElementById('settings-view');
    const contactView = document.getElementById('contact-view');
    const notificationsView = document.getElementById('notifications-view');

    if (welcomeView) welcomeView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'none';
    if (billingView) billingView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';
    if (contactView) contactView.style.display = 'none';
    if (notificationsView) {
      notificationsView.style.display = 'block';
      // Load current notification preferences
      this.loadNotificationSettings();
    }

    // Set active state on notifications button
    document.querySelectorAll('.project-item, .account-item').forEach(item => item.classList.remove('active'));
    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn) notificationsBtn.classList.add('active');
  }

  private showUpdatesView(): void {
    // Hide other views
    this.hideAllViews();

    // Show updates view
    const updatesView = document.getElementById('updates-view');
    if (updatesView) {
      updatesView.style.display = 'block';
    }

    // Update active states
    document.querySelectorAll('.project-item, .account-item, .project-subitem').forEach(item => item.classList.remove('active'));
    const updatesBtn = document.getElementById('updates-btn');
    if (updatesBtn) updatesBtn.classList.add('active');
  }

  private showFilesView(): void {
    // Hide other views
    this.hideAllViews();

    // Show files view
    const filesView = document.getElementById('files-view');
    if (filesView) {
      filesView.style.display = 'block';
    }

    // Update active states
    document.querySelectorAll('.project-item, .account-item, .project-subitem').forEach(item => item.classList.remove('active'));
    const filesBtn = document.getElementById('files-btn');
    if (filesBtn) filesBtn.classList.add('active');
  }

  private showMessagesView(): void {
    // Hide other views
    this.hideAllViews();

    // Show messages view
    const messagesView = document.getElementById('messages-view');
    if (messagesView) {
      messagesView.style.display = 'block';
    }

    // Update active states
    document.querySelectorAll('.project-item, .account-item, .project-subitem').forEach(item => item.classList.remove('active'));
    const messagesBtn = document.getElementById('messages-btn');
    if (messagesBtn) messagesBtn.classList.add('active');
  }

  private showContentView(): void {
    // Hide other views
    this.hideAllViews();

    // Show content view
    const contentView = document.getElementById('content-view');
    if (contentView) {
      contentView.style.display = 'block';
    }

    // Update active states
    document.querySelectorAll('.project-item, .account-item, .project-subitem').forEach(item => item.classList.remove('active'));
    const contentBtn = document.getElementById('content-btn');
    if (contentBtn) contentBtn.classList.add('active');
  }

  private showProjectDetailView(): void {
    // Hide other views
    this.hideAllViews();

    // Show project detail view (overview)
    const projectDetailView = document.getElementById('project-detail-view');
    if (projectDetailView) {
      projectDetailView.style.display = 'block';
    }

    // Update active states
    document.querySelectorAll('.project-item, .account-item, .project-subitem').forEach(item => item.classList.remove('active'));
    const projectMain = document.getElementById('project-main');
    if (projectMain) projectMain.classList.add('active');

    // Update breadcrumbs
    this.updateBreadcrumbs([
      { label: 'Dashboard', href: true, onClick: () => this.showWelcomeView() },
      { label: 'Your Website Project', href: false }
    ]);
  }

  private showWelcomeView(): void {
    this.hideAllViews();
    const welcomeView = document.getElementById('welcome-view');
    if (welcomeView) {
      welcomeView.style.display = 'block';
    }

    document.querySelectorAll('.project-item, .account-item, .project-subitem').forEach(item => item.classList.remove('active'));

    this.updateBreadcrumbs([
      { label: 'Dashboard', href: false }
    ]);
  }

  private updateBreadcrumbs(breadcrumbs: Array<{label: string, href: boolean, onClick?: () => void}>): void {
    const breadcrumbList = document.getElementById('breadcrumb-list');
    if (!breadcrumbList) return;

    breadcrumbList.innerHTML = '';

    breadcrumbs.forEach((crumb, index) => {
      const listItem = document.createElement('li');
      listItem.className = 'breadcrumb-item';

      if (crumb.href && crumb.onClick) {
        const link = document.createElement('button');
        link.className = 'breadcrumb-link';
        link.textContent = crumb.label;
        link.onclick = crumb.onClick;
        listItem.appendChild(link);
      } else {
        const span = document.createElement('span');
        span.className = 'breadcrumb-current';
        span.textContent = crumb.label;
        listItem.appendChild(span);
      }

      breadcrumbList.appendChild(listItem);

      // Add separator if not last item
      if (index < breadcrumbs.length - 1) {
        const separator = document.createElement('li');
        separator.className = 'breadcrumb-separator';
        separator.textContent = '>';
        breadcrumbList.appendChild(separator);
      }
    });
  }

  private hideAllViews(): void {
    const views = [
      'welcome-view',
      'settings-view',
      'contact-view',
      'billing-view',
      'notifications-view',
      'project-detail-view',
      'updates-view',
      'files-view',
      'messages-view',
      'content-view'
    ];

    views.forEach(viewId => {
      const view = document.getElementById(viewId);
      if (view) {
        view.style.display = 'none';
      }
    });
  }

  private toggleSidebar(): void {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (!sidebar || !toggleBtn) {
      console.error('Sidebar elements not found');
      return;
    }

    const isCollapsed = sidebar.classList.contains('collapsed');

    if (isCollapsed) {
      // Expand sidebar
      sidebar.classList.remove('collapsed');
      toggleBtn.innerHTML = '<span>◀</span>';
    } else {
      // Collapse sidebar
      sidebar.classList.add('collapsed');
      toggleBtn.innerHTML = '<span>▶</span>';
    }
  }

  private toggleAccountFolder(): void {
    const accountList = document.querySelector('.account-list') as HTMLElement;
    const accountHeader = document.querySelector('.account-header');

    if (!accountList || !accountHeader) return;

    const isCollapsed = accountList.classList.contains('collapsed');

    if (isCollapsed) {
      // Expand folder
      accountList.classList.remove('collapsed');
      accountHeader.classList.add('expanded');
    } else {
      // Collapse folder
      accountList.classList.add('collapsed');
      accountHeader.classList.remove('expanded');
      // Clear any active account items when collapsing
      document.querySelectorAll('.account-item').forEach(item => item.classList.remove('active'));

      // Hide the main content views when collapsing account
      const welcomeView = document.getElementById('welcome-view');
      const settingsView = document.getElementById('settings-view');
      const billingView = document.getElementById('billing-view');

      if (settingsView && settingsView.style.display !== 'none') {
        if (welcomeView) welcomeView.style.display = 'block';
        if (settingsView) settingsView.style.display = 'none';
        if (billingView) billingView.style.display = 'none';
      }
    }
  }


  private setupSettingsForms(): void {
    // Contact Info Form
    const contactForm = document.getElementById('contact-info-form');
    if (contactForm) {
      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveContactInfo(new FormData(contactForm as HTMLFormElement));
      });
    }

    // Billing Address Form
    const billingForm = document.getElementById('billing-address-form');
    if (billingForm) {
      billingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveBillingAddress(new FormData(billingForm as HTMLFormElement));
      });
    }

    // Notification Preferences Form
    const notificationForm = document.getElementById('notification-prefs-form');
    if (notificationForm) {
      notificationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveNotificationPrefs(new FormData(notificationForm as HTMLFormElement));
      });
    }

    // Billing View Forms
    const billingViewForm = document.getElementById('billing-view-form');
    if (billingViewForm) {
      billingViewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveBillingViewAddress(new FormData(billingViewForm as HTMLFormElement));
      });
    }

    const taxInfoForm = document.getElementById('tax-info-form');
    if (taxInfoForm) {
      taxInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveTaxInfo(new FormData(taxInfoForm as HTMLFormElement));
      });
    }
  }

  private loadUserSettings(): void {
    // Load user data from localStorage or API
    const userData = {
      name: this.currentUser || 'User',
      email: this.currentUser || '',
      company: 'Company Name',
      phone: '',
      secondaryEmail: '',
      billing: {
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        country: ''
      }
    };

    // Populate contact info
    const nameInput = document.getElementById('contact-name') as HTMLInputElement;
    const emailInput = document.getElementById('contact-email') as HTMLInputElement;
    const companyInput = document.getElementById('contact-company') as HTMLInputElement;
    const phoneInput = document.getElementById('contact-phone') as HTMLInputElement;
    const secondaryEmailInput = document.getElementById('contact-secondary-email') as HTMLInputElement;

    if (nameInput) nameInput.value = userData.name;
    if (emailInput) emailInput.value = userData.email;
    if (companyInput) companyInput.value = userData.company;
    if (phoneInput) phoneInput.value = userData.phone;
    if (secondaryEmailInput) secondaryEmailInput.value = userData.secondaryEmail;

    // Populate billing address
    const address1Input = document.getElementById('billing-address1') as HTMLInputElement;
    const address2Input = document.getElementById('billing-address2') as HTMLInputElement;
    const cityInput = document.getElementById('billing-city') as HTMLInputElement;
    const stateInput = document.getElementById('billing-state') as HTMLInputElement;
    const zipInput = document.getElementById('billing-zip') as HTMLInputElement;
    const countryInput = document.getElementById('billing-country') as HTMLInputElement;

    if (address1Input) address1Input.value = userData.billing.address1;
    if (address2Input) address2Input.value = userData.billing.address2;
    if (cityInput) cityInput.value = userData.billing.city;
    if (stateInput) stateInput.value = userData.billing.state;
    if (zipInput) zipInput.value = userData.billing.zip;
    if (countryInput) countryInput.value = userData.billing.country;
  }

  private loadBillingSettings(): void {
    // Load billing data from localStorage or API
    const savedBillingData = localStorage.getItem('client_billing_address');
    const savedTaxData = localStorage.getItem('client_tax_info');

    const billingData = savedBillingData ? JSON.parse(savedBillingData) : {
      address1: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
      country: ''
    };

    const taxData = savedTaxData ? JSON.parse(savedTaxData) : {
      taxId: '',
      businessName: ''
    };

    // Populate billing address form
    const address1Input = document.getElementById('billing-view-address1') as HTMLInputElement;
    const address2Input = document.getElementById('billing-view-address2') as HTMLInputElement;
    const cityInput = document.getElementById('billing-view-city') as HTMLInputElement;
    const stateInput = document.getElementById('billing-view-state') as HTMLInputElement;
    const zipInput = document.getElementById('billing-view-zip') as HTMLInputElement;
    const countryInput = document.getElementById('billing-view-country') as HTMLInputElement;

    if (address1Input) address1Input.value = billingData.address1;
    if (address2Input) address2Input.value = billingData.address2;
    if (cityInput) cityInput.value = billingData.city;
    if (stateInput) stateInput.value = billingData.state;
    if (zipInput) zipInput.value = billingData.zip;
    if (countryInput) countryInput.value = billingData.country;

    // Populate tax info form
    const taxIdInput = document.getElementById('tax-id') as HTMLInputElement;
    const businessNameInput = document.getElementById('business-name') as HTMLInputElement;

    if (taxIdInput) taxIdInput.value = taxData.taxId;
    if (businessNameInput) businessNameInput.value = taxData.businessName;
  }

  private loadContactSettings(): void {
    // Load contact data from localStorage or API
    const savedContactData = localStorage.getItem('client_contact_info');

    const contactData = savedContactData ? JSON.parse(savedContactData) : {
      name: this.currentUser || 'User',
      email: this.currentUser || '',
      company: '',
      phone: '',
      secondaryEmail: ''
    };

    // Populate contact form
    const nameInput = document.getElementById('contact-view-name') as HTMLInputElement;
    const emailInput = document.getElementById('contact-view-email') as HTMLInputElement;
    const companyInput = document.getElementById('contact-view-company') as HTMLInputElement;
    const phoneInput = document.getElementById('contact-view-phone') as HTMLInputElement;
    const secondaryEmailInput = document.getElementById('contact-view-secondary-email') as HTMLInputElement;

    if (nameInput) nameInput.value = contactData.name;
    if (emailInput) emailInput.value = contactData.email;
    if (companyInput) companyInput.value = contactData.company;
    if (phoneInput) phoneInput.value = contactData.phone;
    if (secondaryEmailInput) secondaryEmailInput.value = contactData.secondaryEmail;
  }

  private loadNotificationSettings(): void {
    // Load notification preferences from localStorage
    const savedNotifications = localStorage.getItem('client_notification_prefs');
    const savedFrequency = localStorage.getItem('client_notification_frequency');

    const notificationPrefs = savedNotifications ? JSON.parse(savedNotifications) : [
      'project-updates', 'invoices', 'messages', 'milestones'
    ];

    const frequencyData = savedFrequency ? JSON.parse(savedFrequency) : {
      frequency: 'immediate',
      quietStart: '',
      quietEnd: ''
    };

    // Set checkbox values
    const checkboxes = document.querySelectorAll('#email-notifications-form input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      const cb = checkbox as HTMLInputElement;
      cb.checked = notificationPrefs.includes(cb.value);
    });

    // Set frequency settings
    const frequencySelect = document.getElementById('notification-frequency') as HTMLSelectElement;
    const quietStartInput = document.getElementById('quiet-hours-start') as HTMLInputElement;
    const quietEndInput = document.getElementById('quiet-hours-end') as HTMLInputElement;

    if (frequencySelect) frequencySelect.value = frequencyData.frequency;
    if (quietStartInput) quietStartInput.value = frequencyData.quietStart;
    if (quietEndInput) quietEndInput.value = frequencyData.quietEnd;
  }

  private async saveContactInfo(formData: FormData): Promise<void> {
    const data = Object.fromEntries(formData);
    console.log('Saving contact info:', data);

    // Save to localStorage for now
    localStorage.setItem('client_contact_info', JSON.stringify(data));

    // Show success message
    this.showSuccessMessage('Contact information saved successfully!');
  }

  private async saveBillingAddress(formData: FormData): Promise<void> {
    const data = Object.fromEntries(formData);
    console.log('Saving billing address:', data);

    // Save to localStorage for now
    localStorage.setItem('client_billing_address', JSON.stringify(data));

    // Show success message
    this.showSuccessMessage('Billing address saved successfully!');
  }

  private async saveNotificationPrefs(formData: FormData): Promise<void> {
    const checkboxes = formData.getAll('notifications');
    const prefs = {
      projectUpdates: checkboxes.includes('project-updates'),
      invoices: checkboxes.includes('invoices'),
      messages: checkboxes.includes('messages'),
      milestones: checkboxes.includes('milestones')
    };

    console.log('Saving notification preferences:', prefs);

    // Save to localStorage for now
    localStorage.setItem('client_notification_prefs', JSON.stringify(prefs));

    // Show success message
    this.showSuccessMessage('Notification preferences saved successfully!');
  }

  private async saveBillingViewAddress(formData: FormData): Promise<void> {
    const data = Object.fromEntries(formData);
    console.log('Saving billing view address:', data);

    // Save to localStorage for now
    localStorage.setItem('client_billing_view_address', JSON.stringify(data));

    // Show success message
    this.showSuccessMessage('Billing address updated successfully!');
  }

  private async saveTaxInfo(formData: FormData): Promise<void> {
    const data = Object.fromEntries(formData);
    console.log('Saving tax info:', data);

    // Save to localStorage for now
    localStorage.setItem('client_tax_info', JSON.stringify(data));

    // Show success message
    this.showSuccessMessage('Tax information saved successfully!');
  }

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