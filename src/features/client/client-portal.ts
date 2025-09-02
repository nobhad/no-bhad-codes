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
import type {
  ClientProject,
  ClientProjectStatus,
  ProjectPriority
} from '../../types/client';
import { getPriorityIcon } from '../../types/client';
import { gsap } from 'gsap';
import { APP_CONSTANTS } from '../../config/constants';

export class ClientPortalModule extends BaseModule {
  private isLoggedIn = false;
  private currentProject: ClientProject | null = null;
  private currentUser: string | null = null;

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
    this.setupAnimations();
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

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', this.logout.bind(this));
    }

    // Message form
    const messageForm = document.getElementById('message-form');
    if (messageForm) {
      messageForm.addEventListener('submit', this.sendMessage.bind(this));
    }
  }

  private setupAnimations(): void {
    // Setup button animations for login page
    this.setupButtonAnimations();
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
      // Simulate authentication
      await new Promise(resolve => setTimeout(resolve, APP_CONSTANTS.API.TIMEOUT / 10));

      // For demo - check against demo credentials
      if (credentials.email === 'demo@example.com' && credentials.password === 'password123') {
        this.isLoggedIn = true;
        this.currentUser = credentials.email;
        await this.loadUserProjects(credentials.email);
        this.showDashboard();
      } else {
        throw new Error('Invalid email or password');
      }
    } catch (error) {
      this.showLoginError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      this.setLoginLoading(false);
    }
  }

  private async loadUserProjects(userEmail: string): Promise<void> {
    // Load projects for the user
    // For now, using sample data
    const sampleProject: ClientProject = {
      id: 'project-intake-001',
      projectName: 'E-commerce Website Development',
      clientId: userEmail,
      clientName: 'John Smith',
      status: 'pending',
      priority: 'medium',
      progress: 15,
      startDate: '2025-01-15',
      estimatedEndDate: '2025-04-15',
      updates: [
        {
          id: 'update-001',
          date: '2025-01-01',
          title: 'Project Intake Received',
          description: 'Initial project intake form submitted and under review.',
          author: 'No Bhad Codes Team',
          type: 'general'
        }
      ],
      files: [],
      messages: [
        {
          id: 'msg-001',
          sender: 'No Bhad Codes Team',
          senderRole: 'system',
          message: 'Thank you for submitting your project intake form.',
          timestamp: '2025-01-01T10:00:00Z',
          isRead: false
        }
      ],
      milestones: [
        {
          id: 'milestone-001',
          title: 'Initial Consultation',
          description: 'Review requirements and schedule kickoff meeting',
          dueDate: '2025-01-10',
          isCompleted: false,
          deliverables: ['Requirements review', 'Project timeline', 'Initial proposal']
        }
      ]
    };

    this.populateProjectsList([sampleProject]);
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
        <div class="project-item-header">
          <h3 class="project-item-title">${project.projectName}</h3>
          <span class="project-item-status status-${project.status}">${project.status.replace('-', ' ')}</span>
        </div>
        <div class="project-item-progress">
          <div class="project-item-progress-bar">
            <div class="project-item-progress-fill" style="width: ${project.progress}%"></div>
          </div>
          <span class="project-item-progress-text">${project.progress}%</span>
        </div>
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

    const welcomeView = document.getElementById('welcome-view');
    const projectDetailView = document.getElementById('project-detail-view');

    if (welcomeView) welcomeView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'block';
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

    // Populate progress
    const progressFill = document.getElementById('progress-fill') as HTMLElement;
    const progressText = document.getElementById('progress-text');
    if (progressFill && progressText) {
      progressFill.style.width = `${this.currentProject.progress}%`;
      progressText.textContent = `${this.currentProject.progress}%`;
    }

    // Populate dates
    const startDateElement = document.getElementById('start-date');
    if (startDateElement) {
      startDateElement.textContent = this.formatDate(this.currentProject.startDate);
    }

    const endDateElement = document.getElementById('end-date');
    if (endDateElement && this.currentProject.estimatedEndDate) {
      endDateElement.textContent = this.formatDate(this.currentProject.estimatedEndDate);
    }

    // Populate priority
    const priorityElement = document.getElementById('project-priority');
    if (priorityElement) {
      const icon = getPriorityIcon(this.currentProject.priority);
      priorityElement.innerHTML = `${icon} ${this.currentProject.priority}`;
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

    const filesContainer = document.getElementById('project-files');
    if (!filesContainer) return;

    if (this.currentProject.files.length === 0) {
      filesContainer.innerHTML = '<p class="no-files">No files available yet.</p>';
      return;
    }

    // Populate files when available
    filesContainer.innerHTML = '';
    // Implementation for files display
  }

  private loadMessages(): void {
    if (!this.currentProject) return;

    const messagesContainer = document.getElementById('messages-container');
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

    gsap.to(this.loginSection, {
      opacity: 0,
      y: -20,
      duration: APP_CONSTANTS.TIMERS.PAGE_TRANSITION / 1000,
      onComplete: () => {
        if (this.loginSection) this.loginSection.style.display = 'none';
        if (this.dashboardSection) {
          this.dashboardSection.style.display = 'block';
          this.animateDashboard();
        }
      }
    });
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
    this.isLoggedIn = false;
    this.currentProject = null;
    this.currentUser = null;

    if (this.dashboardSection) this.dashboardSection.style.display = 'none';
    if (this.loginSection) {
      this.loginSection.style.display = 'block';
      gsap.fromTo(this.loginSection, {
        opacity: 0,
        y: 20
      }, {
        opacity: 1,
        y: 0,
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000
      });
    }
  }

  private async sendMessage(event: Event): Promise<void> {
    event.preventDefault();
    // Implementation for sending messages
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
}