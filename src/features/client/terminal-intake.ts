/**
 * ===============================================
 * TERMINAL INTAKE MODULE
 * ===============================================
 * @file src/features/client/terminal-intake.ts
 *
 * AI Chat-style intake form that collects project information
 * through a conversational terminal interface.
 */

interface IntakeQuestion {
  id: string;
  field: string;
  question: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'select' | 'multiselect' | 'textarea';
  options?: { value: string; label: string }[];
  required: boolean;
  validation?: (value: string) => string | null;
  dependsOn?: { field: string; value: string | string[] };
  placeholder?: string;
}

interface IntakeData {
  [key: string]: string | string[];
}

interface ChatMessage {
  type: 'ai' | 'user' | 'system' | 'error' | 'success';
  content: string;
  options?: { value: string; label: string }[];
  multiSelect?: boolean;
}

// Question flow definitions
const QUESTIONS: IntakeQuestion[] = [
  // Basic Information
  {
    id: 'greeting',
    field: '',
    question: 'Hello! I\'m here to help you start your project. Let\'s gather some information to create a custom proposal for you. First, what\'s your name?',
    type: 'text',
    required: true,
    placeholder: 'Enter your full name'
  },
  {
    id: 'name',
    field: 'name',
    question: 'Nice to meet you, {{name}}! What\'s your email address so I can send you the project details?',
    type: 'email',
    required: true,
    validation: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value) ? null : 'Please enter a valid email address';
    },
    placeholder: 'your@email.com'
  },
  {
    id: 'company',
    field: 'company',
    question: 'What\'s your company or organization name?',
    type: 'text',
    required: true,
    placeholder: 'Company name'
  },
  {
    id: 'phone',
    field: 'phone',
    question: 'What\'s the best phone number to reach you?',
    type: 'tel',
    required: true,
    placeholder: '(555) 123-4567'
  },
  // Project Overview
  {
    id: 'projectType',
    field: 'projectType',
    question: 'Great! Now let\'s talk about your project. What type of project are you looking to build?',
    type: 'select',
    required: true,
    options: [
      { value: 'simple-site', label: 'Simple Site (1-2 pages, landing page)' },
      { value: 'business-site', label: 'Small Business Website (5-10 pages)' },
      { value: 'portfolio', label: 'Portfolio Website' },
      { value: 'ecommerce', label: 'E-commerce Store' },
      { value: 'web-app', label: 'Web Application' },
      { value: 'browser-extension', label: 'Browser Extension' },
      { value: 'other', label: 'Other' }
    ]
  },
  {
    id: 'projectDescription',
    field: 'projectDescription',
    question: 'Tell me more about your project. What are your goals and what do you want to achieve?',
    type: 'textarea',
    required: true,
    placeholder: 'Describe your project goals, target audience, and vision...'
  },
  {
    id: 'timeline',
    field: 'timeline',
    question: 'What\'s your ideal timeline for this project?',
    type: 'select',
    required: true,
    options: [
      { value: 'asap', label: 'ASAP (Rush job)' },
      { value: '1-month', label: 'Within 1 month' },
      { value: '1-3-months', label: '1-3 months' },
      { value: '3-6-months', label: '3-6 months' },
      { value: 'flexible', label: 'Flexible timing' }
    ]
  },
  {
    id: 'budget',
    field: 'budget',
    question: 'What\'s your budget range for this project?',
    type: 'select',
    required: true,
    options: [] // Will be dynamically set based on projectType
  },
  // Features
  {
    id: 'features',
    field: 'features',
    question: 'What features do you need? Select all that apply:',
    type: 'multiselect',
    required: true,
    options: [] // Will be dynamically set based on projectType
  },
  {
    id: 'hasIntegrations',
    field: 'hasIntegrations',
    question: 'Do you need any third-party integrations? (e.g., PayPal, Stripe, Google Analytics)',
    type: 'select',
    required: true,
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' }
    ]
  },
  {
    id: 'integrations',
    field: 'integrations',
    question: 'Which integrations do you need?',
    type: 'multiselect',
    required: true,
    dependsOn: { field: 'hasIntegrations', value: 'yes' },
    options: [
      { value: 'stripe', label: 'Stripe (Payments)' },
      { value: 'paypal', label: 'PayPal' },
      { value: 'google-analytics', label: 'Google Analytics' },
      { value: 'mailchimp', label: 'Mailchimp / Email Marketing' },
      { value: 'crm', label: 'CRM System' },
      { value: 'social', label: 'Social Media Feeds' },
      { value: 'calendar', label: 'Calendar / Booking' },
      { value: 'other', label: 'Other (will specify later)' }
    ]
  },
  // Design
  {
    id: 'designLevel',
    field: 'designLevel',
    question: 'What level of design service do you need?',
    type: 'select',
    required: true,
    options: [
      { value: 'full-design', label: 'Full Design Service' },
      { value: 'partial-design', label: 'Design Guidance Only' },
      { value: 'have-designs', label: 'I Have Existing Designs' }
    ]
  },
  {
    id: 'brandAssets',
    field: 'brandAssets',
    question: 'What brand assets do you already have?',
    type: 'multiselect',
    required: true,
    options: [
      { value: 'logo', label: 'Logo' },
      { value: 'colors', label: 'Brand Colors' },
      { value: 'fonts', label: 'Brand Fonts' },
      { value: 'guidelines', label: 'Brand Guidelines' },
      { value: 'photos', label: 'Professional Photos' },
      { value: 'none', label: 'Need Everything Created' }
    ]
  },
  {
    id: 'hasInspiration',
    field: 'hasInspiration',
    question: 'Do you have any websites you like for design inspiration?',
    type: 'select',
    required: true,
    options: [
      { value: 'yes', label: 'Yes, I have examples' },
      { value: 'no', label: 'No, open to suggestions' }
    ]
  },
  {
    id: 'inspiration',
    field: 'inspiration',
    question: 'Share the website URLs you like (you can list multiple):',
    type: 'textarea',
    required: true,
    dependsOn: { field: 'hasInspiration', value: 'yes' },
    placeholder: 'https://example.com'
  },
  // Additional Info
  {
    id: 'techComfort',
    field: 'techComfort',
    question: 'What\'s your technical comfort level for managing the site after launch?',
    type: 'select',
    required: true,
    options: [
      { value: 'beginner', label: 'Beginner (prefer simple solutions)' },
      { value: 'intermediate', label: 'Intermediate (comfortable with basic updates)' },
      { value: 'advanced', label: 'Advanced (can handle technical tasks)' }
    ]
  },
  {
    id: 'hasCurrentSite',
    field: 'hasCurrentSite',
    question: 'Do you have a current website?',
    type: 'select',
    required: true,
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' }
    ]
  },
  {
    id: 'currentSite',
    field: 'currentSite',
    question: 'What\'s the URL of your current website?',
    type: 'text',
    required: true,
    dependsOn: { field: 'hasCurrentSite', value: 'yes' },
    placeholder: 'https://example.com'
  },
  {
    id: 'challenges',
    field: 'challenges',
    question: 'What are your biggest concerns with this project?',
    type: 'multiselect',
    required: true,
    options: [
      { value: 'budget', label: 'Staying within budget' },
      { value: 'timeline', label: 'Meeting the timeline' },
      { value: 'communication', label: 'Clear communication' },
      { value: 'technical', label: 'Technical complexity' },
      { value: 'design', label: 'Getting the design right' },
      { value: 'maintenance', label: 'Ongoing maintenance' },
      { value: 'none', label: 'No major concerns' }
    ]
  },
  {
    id: 'hasAdditionalInfo',
    field: 'hasAdditionalInfo',
    question: 'Is there anything else you\'d like me to know?',
    type: 'select',
    required: true,
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No, I\'m all set' }
    ]
  },
  {
    id: 'additionalInfo',
    field: 'additionalInfo',
    question: 'Please share any additional details:',
    type: 'textarea',
    required: true,
    dependsOn: { field: 'hasAdditionalInfo', value: 'yes' },
    placeholder: 'Additional information'
  },
  {
    id: 'wasReferred',
    field: 'wasReferred',
    question: 'Last question! Did someone refer you to me?',
    type: 'select',
    required: true,
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' }
    ]
  },
  {
    id: 'referralName',
    field: 'referralName',
    question: 'Who referred you?',
    type: 'text',
    required: true,
    dependsOn: { field: 'wasReferred', value: 'yes' },
    placeholder: 'Name of person or company'
  }
];

// Budget options by project type
const BUDGET_OPTIONS: Record<string, { value: string; label: string }[]> = {
  'simple-site': [
    { value: 'under-1k', label: 'Under $1,000' },
    { value: '1k-2k', label: '$1,000 - $2,000' },
    { value: '2k-3k', label: '$2,000 - $3,000' },
    { value: 'discuss', label: 'Let\'s discuss' }
  ],
  'business-site': [
    { value: '2k-5k', label: '$2,000 - $5,000' },
    { value: '5k-8k', label: '$5,000 - $8,000' },
    { value: '8k-12k', label: '$8,000 - $12,000' },
    { value: 'discuss', label: 'Let\'s discuss' }
  ],
  portfolio: [
    { value: '1k-3k', label: '$1,000 - $3,000' },
    { value: '3k-6k', label: '$3,000 - $6,000' },
    { value: '6k-10k', label: '$6,000 - $10,000' },
    { value: 'discuss', label: 'Let\'s discuss' }
  ],
  ecommerce: [
    { value: '5k-10k', label: '$5,000 - $10,000' },
    { value: '10k-20k', label: '$10,000 - $20,000' },
    { value: '20k-35k', label: '$20,000 - $35,000' },
    { value: '35k-plus', label: '$35,000+' },
    { value: 'discuss', label: 'Let\'s discuss' }
  ],
  'web-app': [
    { value: '10k-25k', label: '$10,000 - $25,000' },
    { value: '25k-50k', label: '$25,000 - $50,000' },
    { value: '50k-100k', label: '$50,000 - $100,000' },
    { value: '100k-plus', label: '$100,000+' },
    { value: 'discuss', label: 'Let\'s discuss' }
  ],
  'browser-extension': [
    { value: '3k-8k', label: '$3,000 - $8,000' },
    { value: '8k-15k', label: '$8,000 - $15,000' },
    { value: '15k-25k', label: '$15,000 - $25,000' },
    { value: 'discuss', label: 'Let\'s discuss' }
  ],
  other: [
    { value: 'under-5k', label: 'Under $5,000' },
    { value: '5k-15k', label: '$5,000 - $15,000' },
    { value: '15k-35k', label: '$15,000 - $35,000' },
    { value: '35k-plus', label: '$35,000+' },
    { value: 'discuss', label: 'Let\'s discuss' }
  ]
};

// Feature options by project type
const FEATURE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  'simple-site': [
    { value: 'contact-form', label: 'Contact Form' },
    { value: 'social-links', label: 'Social Media Links' },
    { value: 'analytics', label: 'Analytics Tracking' },
    { value: 'mobile-optimized', label: 'Mobile Optimization' },
    { value: 'basic-only', label: 'Basic Static Pages Only' }
  ],
  'business-site': [
    { value: 'contact-form', label: 'Contact Form' },
    { value: 'blog', label: 'Blog/News Section' },
    { value: 'gallery', label: 'Photo Gallery' },
    { value: 'testimonials', label: 'Customer Testimonials' },
    { value: 'booking', label: 'Appointment Booking' },
    { value: 'cms', label: 'Content Management System' },
    { value: 'seo-pages', label: 'SEO-Optimized Pages' }
  ],
  portfolio: [
    { value: 'portfolio-gallery', label: 'Project Gallery' },
    { value: 'case-studies', label: 'Case Studies' },
    { value: 'resume-download', label: 'Resume/CV Download' },
    { value: 'contact-form', label: 'Contact Form' },
    { value: 'blog', label: 'Blog/Articles' },
    { value: 'testimonials', label: 'Client Testimonials' }
  ],
  ecommerce: [
    { value: 'shopping-cart', label: 'Shopping Cart' },
    { value: 'payment-processing', label: 'Payment Processing' },
    { value: 'inventory-management', label: 'Inventory Management' },
    { value: 'user-accounts', label: 'User Accounts/Login' },
    { value: 'admin-dashboard', label: 'Admin Dashboard' },
    { value: 'shipping-calculator', label: 'Shipping Calculator' }
  ],
  'web-app': [
    { value: 'user-authentication', label: 'User Authentication' },
    { value: 'database-integration', label: 'Database Integration' },
    { value: 'api-integration', label: 'Third-party API Integration' },
    { value: 'user-dashboard', label: 'User Dashboard' },
    { value: 'real-time-features', label: 'Real-time Features' },
    { value: 'admin-panel', label: 'Admin Panel' }
  ],
  'browser-extension': [
    { value: 'popup-interface', label: 'Popup Interface' },
    { value: 'content-modification', label: 'Page Content Modification' },
    { value: 'background-processing', label: 'Background Processing' },
    { value: 'data-storage', label: 'Data Storage' },
    { value: 'external-api', label: 'External API Calls' },
    { value: 'cross-browser', label: 'Cross-browser Compatibility' }
  ],
  other: [
    { value: 'contact-form', label: 'Contact Form' },
    { value: 'user-authentication', label: 'User Authentication' },
    { value: 'database-integration', label: 'Database Integration' },
    { value: 'api-integration', label: 'API Integration' },
    { value: 'admin-panel', label: 'Admin Panel' },
    { value: 'custom', label: 'Custom Features (describe in next step)' }
  ]
};

export interface TerminalIntakeOptions {
  isModal?: boolean; // If true, show minimize/maximize/close buttons
  clientData?: {
    name?: string;
    email?: string;
    company?: string;
  };
}

export class TerminalIntakeModule {
  private container: HTMLElement;
  private chatContainer: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private progressFill: HTMLElement | null = null;
  private progressPercent: HTMLElement | null = null;

  private currentQuestionIndex = 0;
  private intakeData: IntakeData = {};
  private messages: ChatMessage[] = [];
  private isProcessing = false;
  private selectedOptions: string[] = [];
  private isModal: boolean;
  private clientData: TerminalIntakeOptions['clientData'];
  private confirmedCompany = false; // Track if we've confirmed/asked about company

  private static STORAGE_KEY = 'terminalIntakeProgress';

  constructor(container: HTMLElement, options: TerminalIntakeOptions = {}) {
    this.container = container;
    this.isModal = options.isModal ?? false;
    this.clientData = options.clientData;
  }

  async init(): Promise<void> {
    console.log('[TerminalIntake] Initializing...');
    this.render();
    this.bindEvents();

    // Check for saved progress
    const savedProgress = this.loadProgress();
    if (savedProgress && savedProgress.currentQuestionIndex > 0) {
      await this.askToResume(savedProgress);
    } else {
      await this.startConversation();
    }

    console.log('[TerminalIntake] Initialized successfully');
  }

  private saveProgress(): void {
    const progress = {
      currentQuestionIndex: this.currentQuestionIndex,
      intakeData: this.intakeData,
      timestamp: Date.now()
    };
    localStorage.setItem(TerminalIntakeModule.STORAGE_KEY, JSON.stringify(progress));
  }

  private loadProgress(): { currentQuestionIndex: number; intakeData: IntakeData; timestamp: number } | null {
    try {
      const saved = localStorage.getItem(TerminalIntakeModule.STORAGE_KEY);
      if (saved) {
        const progress = JSON.parse(saved);
        // Only use progress less than 24 hours old
        if (Date.now() - progress.timestamp < 24 * 60 * 60 * 1000) {
          return progress;
        }
      }
    } catch (e) {
      console.error('[TerminalIntake] Error loading progress:', e);
    }
    return null;
  }

  private clearProgress(): void {
    localStorage.removeItem(TerminalIntakeModule.STORAGE_KEY);
  }

  private async askToResume(savedProgress: { currentQuestionIndex: number; intakeData: IntakeData }): Promise<void> {
    await this.addBootMessage('Bootstrapping...');
    await this.delay(300);
    await this.addBootMessage('  ✓ Previous session detected');
    await this.delay(400);

    this.addMessage({
      type: 'ai',
      content: `Welcome back${savedProgress.intakeData.name ? `, ${  savedProgress.intakeData.name}` : ''}! I found your previous progress. Would you like to continue where you left off or start fresh?`,
      options: [
        { value: 'resume', label: 'Resume where I left off' },
        { value: 'restart', label: 'Start over' }
      ]
    });

    // Temporarily override option click handler for resume choice
    const handleResumeChoice = async (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('chat-option')) {
        e.stopPropagation();
        this.chatContainer?.removeEventListener('click', handleResumeChoice, true);

        const choice = target.dataset.value;
        this.addMessage({ type: 'user', content: target.textContent || choice || '' });

        if (choice === 'resume') {
          // Restore progress
          this.currentQuestionIndex = savedProgress.currentQuestionIndex;
          this.intakeData = savedProgress.intakeData;
          this.updateProgress();

          await this.delay(300);
          await this.addBootMessage('  ✓ Progress restored');
          await this.delay(300);
          await this.askCurrentQuestion();
        } else {
          // Start fresh
          this.clearProgress();
          this.currentQuestionIndex = 0;
          this.intakeData = {};

          await this.delay(300);
          await this.addBootMessage('  ✓ Starting fresh');
          await this.delay(300);
          await this.askCurrentQuestion();
        }
      }
    };

    this.chatContainer?.addEventListener('click', handleResumeChoice, true);

    if (this.inputElement) {
      this.inputElement.disabled = true;
    }
  }

  private render(): void {
    // Only show window control buttons in modal mode
    const buttonsHtml = this.isModal
      ? `<div class="terminal-buttons">
              <button class="terminal-btn close" id="terminalClose" aria-label="Close"></button>
              <button class="terminal-btn minimize" id="terminalMinimize" aria-label="Minimize"></button>
              <button class="terminal-btn maximize" id="terminalMaximize" aria-label="Maximize"></button>
            </div>`
      : `<div class="terminal-buttons">
              <span class="terminal-btn close" style="cursor: default;"></span>
              <span class="terminal-btn minimize" style="cursor: default;"></span>
              <span class="terminal-btn maximize" style="cursor: default;"></span>
            </div>`;

    this.container.innerHTML = `
      <div class="terminal-intake">
        <div class="terminal-window">
          <div class="terminal-header">
            ${buttonsHtml}
            <span class="terminal-title">project_intake.sh - No Bhad Codes</span>
          </div>
          <div class="terminal-progress">
            <span class="progress-label">Progress:</span>
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill" style="width: 0%"></div>
            </div>
            <span class="progress-percent" id="progressPercent">0%</span>
          </div>
          <div class="terminal-chat" id="terminalChat"></div>
          <div class="terminal-input-area">
            <span class="terminal-prompt">$</span>
            <input type="text" class="terminal-input" id="terminalInput" placeholder="Type your response..." autocomplete="off">
            <button class="terminal-send" id="terminalSend">SEND</button>
          </div>
        </div>
      </div>
    `;

    this.chatContainer = this.container.querySelector('#terminalChat');
    this.inputElement = this.container.querySelector('#terminalInput');
    this.sendButton = this.container.querySelector('#terminalSend');
    this.progressFill = this.container.querySelector('#progressFill');
    this.progressPercent = this.container.querySelector('#progressPercent');
  }

  private bindEvents(): void {
    // Send button click
    this.sendButton?.addEventListener('click', () => this.handleUserInput());

    // Enter key to send
    this.inputElement?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserInput();
      }
    });

    // Option button clicks (delegated)
    this.chatContainer?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('chat-option')) {
        this.handleOptionClick(target);
      }
    });

    // Close button - close modal
    const closeBtn = this.container.querySelector('#terminalClose');
    closeBtn?.addEventListener('click', () => {
      const modal = document.getElementById('intakeModal');
      if (modal) {
        modal.classList.remove('open');
        modal.classList.remove('minimized');
        modal.classList.remove('fullscreen');
        document.body.style.overflow = '';
        // Reset so it can reinitialize with resume prompt next time
        (window as typeof globalThis & { terminalIntakeInitialized?: boolean }).terminalIntakeInitialized = false;
        // Clear the container
        const container = document.querySelector('#intakeModal .terminal-intake-container');
        if (container) container.innerHTML = '';
      }
    });

    // Minimize button - minimize modal
    const minimizeBtn = this.container.querySelector('#terminalMinimize');
    minimizeBtn?.addEventListener('click', () => {
      const modal = document.getElementById('intakeModal');
      if (modal) {
        modal.classList.remove('fullscreen'); // Can't be both
        modal.classList.toggle('minimized');
      }
    });

    // Maximize button - fullscreen modal
    const maximizeBtn = this.container.querySelector('#terminalMaximize');
    maximizeBtn?.addEventListener('click', () => {
      const modal = document.getElementById('intakeModal');
      if (modal) {
        modal.classList.remove('minimized'); // Can't be both
        modal.classList.toggle('fullscreen');
      }
    });

    // Click header to restore from minimized
    const header = this.container.querySelector('.terminal-header');
    header?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Only restore if clicking header itself (not buttons) and is minimized
      if (!target.classList.contains('terminal-btn')) {
        const modal = document.getElementById('intakeModal');
        if (modal?.classList.contains('minimized')) {
          modal.classList.remove('minimized');
        }
      }
    });
  }

  private async startConversation(): Promise<void> {
    // Terminal boot sequence
    await this.addBootMessage('Bootstrapping...');
    await this.delay(300);

    await this.addBootMessage('  ✓ Loading intake module');
    await this.delay(200);

    await this.addBootMessage('  ✓ Initializing question flow');
    await this.delay(200);

    await this.addBootMessage('  ✓ Ready to collect project details');
    await this.delay(400);

    // Empty line before starting
    await this.addBootMessage('');
    await this.delay(300);

    // If we have existing client data, pre-fill and handle company confirmation
    if (this.clientData) {
      await this.handleExistingClientData();
    } else {
      await this.askCurrentQuestion();
    }
  }

  private async handleExistingClientData(): Promise<void> {
    // Pre-fill name and email if available
    if (this.clientData?.name) {
      this.intakeData.name = this.clientData.name;
    }
    if (this.clientData?.email) {
      this.intakeData.email = this.clientData.email;
    }

    // If we have a company name, ask if this project is for that company
    if (this.clientData?.company) {
      await this.askCompanyConfirmation();
    } else {
      // No company on file - ask if this is for a company
      await this.askIfForCompany();
    }
  }

  private async askCompanyConfirmation(): Promise<void> {
    const companyName = this.clientData?.company || '';
    await this.showTypingIndicator(500);

    // Show the question with options
    this.addMessage({
      type: 'ai',
      content: `Is this project for "${companyName}"?`,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No, different company/personal' }
      ]
    });

    // Set up custom handler for this question
    this.setupCompanyConfirmHandler(companyName);
  }

  private setupCompanyConfirmHandler(companyName: string): void {
    // Enable input for typing 1 or 2
    if (this.inputElement) {
      this.inputElement.placeholder = 'Type 1 or 2...';
      this.inputElement.disabled = false;
      this.inputElement.focus();
    }

    // Override option click handler temporarily
    const originalClickHandler = this.handleOptionClick.bind(this);
    this.handleOptionClick = (target: HTMLElement) => {
      const value = target.dataset.value;
      if (value === 'yes' || value === 'no') {
        this.handleCompanyConfirmAnswer(value, companyName);
        this.handleOptionClick = originalClickHandler;
      }
    };

    // Override handleUserInput for number input
    const originalInputHandler = this.handleUserInput.bind(this);
    this.handleUserInput = async () => {
      const input = this.inputElement?.value.trim();
      if (input === '1') {
        this.handleCompanyConfirmAnswer('yes', companyName);
        this.handleUserInput = originalInputHandler;
        this.handleOptionClick = originalClickHandler;
      } else if (input === '2') {
        this.handleCompanyConfirmAnswer('no', companyName);
        this.handleUserInput = originalInputHandler;
        this.handleOptionClick = originalClickHandler;
      }
    };
  }

  private async handleCompanyConfirmAnswer(value: string, companyName: string): Promise<void> {
    const displayText = value === 'yes' ? 'Yes' : 'No, different company/personal';
    this.addMessage({ type: 'user', content: displayText });
    if (this.inputElement) this.inputElement.value = '';

    if (value === 'yes') {
      this.intakeData.company = companyName;
      this.confirmedCompany = true;
      await this.skipToRelevantQuestion();
    } else {
      await this.askIfForCompany();
    }
  }

  private async askIfForCompany(): Promise<void> {
    await this.showTypingIndicator(500);

    this.addMessage({
      type: 'ai',
      content: 'Is this project for a company or business?',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No, personal project' }
      ]
    });

    this.setupForCompanyHandler();
  }

  private setupForCompanyHandler(): void {
    if (this.inputElement) {
      this.inputElement.placeholder = 'Type 1 or 2...';
      this.inputElement.disabled = false;
      this.inputElement.focus();
    }

    const originalClickHandler = this.handleOptionClick.bind(this);
    this.handleOptionClick = (target: HTMLElement) => {
      const value = target.dataset.value;
      if (value === 'yes' || value === 'no') {
        this.handleForCompanyAnswer(value);
        this.handleOptionClick = originalClickHandler;
      }
    };

    const originalInputHandler = this.handleUserInput.bind(this);
    this.handleUserInput = async () => {
      const input = this.inputElement?.value.trim();
      if (input === '1') {
        this.handleForCompanyAnswer('yes');
        this.handleUserInput = originalInputHandler;
        this.handleOptionClick = originalClickHandler;
      } else if (input === '2') {
        this.handleForCompanyAnswer('no');
        this.handleUserInput = originalInputHandler;
        this.handleOptionClick = originalClickHandler;
      }
    };
  }

  private async handleForCompanyAnswer(value: string): Promise<void> {
    const displayText = value === 'yes' ? 'Yes' : 'No, personal project';
    this.addMessage({ type: 'user', content: displayText });
    if (this.inputElement) this.inputElement.value = '';

    if (value === 'yes') {
      this.confirmedCompany = true;
      await this.askForCompanyName();
    } else {
      this.intakeData.company = '';
      this.confirmedCompany = true;
      await this.skipToRelevantQuestion();
    }
  }

  private async askForCompanyName(): Promise<void> {
    await this.showTypingIndicator(500);

    this.addMessage({
      type: 'ai',
      content: 'What\'s the company or business name?'
    });

    if (this.inputElement) {
      this.inputElement.placeholder = 'Enter company name';
      this.inputElement.disabled = false;
      this.inputElement.focus();
    }

    const originalInputHandler = this.handleUserInput.bind(this);
    this.handleUserInput = async () => {
      const value = this.inputElement?.value.trim();
      if (!value) return;

      this.addMessage({ type: 'user', content: value });
      this.intakeData.company = value;
      if (this.inputElement) this.inputElement.value = '';

      this.handleUserInput = originalInputHandler;
      await this.skipToRelevantQuestion();
    };
  }

  private async skipToRelevantQuestion(): Promise<void> {
    // Skip questions we already have data for
    const fieldsToSkip = ['name', 'email', 'company'];

    while (this.currentQuestionIndex < QUESTIONS.length) {
      const question = QUESTIONS[this.currentQuestionIndex];

      // Skip if we have this data and it's a skippable field
      if (fieldsToSkip.includes(question.field) && this.intakeData[question.field as keyof IntakeData]) {
        this.currentQuestionIndex++;
        continue;
      }

      // Also skip company if we've already handled it
      if (question.field === 'company' && this.confirmedCompany) {
        this.currentQuestionIndex++;
        continue;
      }

      // Check dependsOn conditions
      if (question.dependsOn) {
        const depValue = this.intakeData[question.dependsOn.field as keyof IntakeData];
        if (depValue !== question.dependsOn.value) {
          this.currentQuestionIndex++;
          continue;
        }
      }

      break;
    }

    await this.askCurrentQuestion();
  }

  private async addBootMessage(text: string): Promise<void> {
    if (!this.chatContainer) return;

    const line = document.createElement('div');
    line.className = 'boot-line';
    line.textContent = text;
    this.chatContainer.appendChild(line);
    this.scrollToBottom();
  }

  private getCurrentQuestion(): IntakeQuestion | null {
    while (this.currentQuestionIndex < QUESTIONS.length) {
      const question = QUESTIONS[this.currentQuestionIndex];

      // Check if question depends on another field
      if (question.dependsOn) {
        const dependentValue = this.intakeData[question.dependsOn.field];
        const requiredValue = question.dependsOn.value;

        if (Array.isArray(requiredValue)) {
          if (!requiredValue.includes(dependentValue as string)) {
            this.currentQuestionIndex++;
            continue;
          }
        } else {
          if (dependentValue !== requiredValue) {
            this.currentQuestionIndex++;
            continue;
          }
        }
      }

      return question;
    }

    return null;
  }

  private async askCurrentQuestion(): Promise<void> {
    const question = this.getCurrentQuestion();

    if (!question) {
      await this.submitIntake();
      return;
    }

    // Dynamically set options for budget and features based on project type
    if (question.id === 'budget') {
      const projectType = this.intakeData.projectType as string || 'other';
      question.options = BUDGET_OPTIONS[projectType] || BUDGET_OPTIONS.other;
    }

    if (question.id === 'features') {
      const projectType = this.intakeData.projectType as string || 'other';
      question.options = FEATURE_OPTIONS[projectType] || FEATURE_OPTIONS.other;
    }

    // Replace placeholders in question text
    let questionText = question.question;
    if (questionText.includes('{{name}}')) {
      questionText = questionText.replace('{{name}}', this.intakeData.name as string || 'there');
    }

    await this.showTypingIndicator(600);

    // Add the AI message
    const message: ChatMessage = {
      type: 'ai',
      content: questionText
    };

    if (question.type === 'select' && question.options) {
      message.options = question.options;
    } else if (question.type === 'multiselect' && question.options) {
      message.options = question.options;
      message.multiSelect = true;
    }

    this.addMessage(message);

    // Update input placeholder
    if (this.inputElement) {
      this.inputElement.placeholder = question.placeholder || 'Type your response...';
      this.inputElement.disabled = false;
      this.inputElement.focus();
    }

    // Enable/disable send button based on question type
    if (this.sendButton) {
      this.sendButton.disabled = false;
    }

    // Reset selected options for multiselect
    this.selectedOptions = [];

    this.updateProgress();
  }

  private handleOptionClick(target: HTMLElement): void {
    const value = target.dataset.value;
    if (!value) return;

    const question = this.getCurrentQuestion();
    if (!question) return;

    if (question.type === 'multiselect') {
      // Toggle selection
      target.classList.toggle('selected');
      if (target.classList.contains('selected')) {
        this.selectedOptions.push(value);
      } else {
        this.selectedOptions = this.selectedOptions.filter((v) => v !== value);
      }
    } else {
      // Single select - submit immediately
      this.processAnswer(value, target.textContent || value);
    }
  }

  private async handleUserInput(): Promise<void> {
    if (this.isProcessing) return;

    const question = this.getCurrentQuestion();
    if (!question) return;

    let value: string | string[];
    let displayValue: string;

    if (question.type === 'multiselect' && this.selectedOptions.length > 0) {
      value = this.selectedOptions;
      displayValue = this.selectedOptions
        .map((v) => question.options?.find((o) => o.value === v)?.label || v)
        .join(', ');
    } else if (question.type === 'select') {
      // Check if user typed a number or text matching an option
      const inputValue = this.inputElement?.value.trim();
      if (!inputValue || !question.options) return;

      // Try to match by number (e.g., "1", "2", "3")
      const numericInput = parseInt(inputValue, 10);
      let matchedOption: { value: string; label: string } | undefined;

      if (!isNaN(numericInput) && numericInput >= 1 && numericInput <= question.options.length) {
        // User typed a valid number
        matchedOption = question.options[numericInput - 1];
      } else {
        // Try to match by text (case-insensitive partial match)
        const lowerInput = inputValue.toLowerCase();
        matchedOption = question.options.find(
          (opt) =>
            opt.label.toLowerCase().includes(lowerInput) ||
            opt.value.toLowerCase().includes(lowerInput)
        );
      }

      if (!matchedOption) {
        this.addMessage({
          type: 'error',
          content: `Invalid selection. Please enter a number (1-${question.options.length}) or click an option.`
        });
        return;
      }

      value = matchedOption.value;
      displayValue = matchedOption.label;
    } else {
      const inputValue = this.inputElement?.value.trim();
      if (!inputValue) return;
      value = inputValue;
      displayValue = inputValue;
    }

    await this.processAnswer(value, displayValue);
  }

  private async processAnswer(value: string | string[], displayValue: string): Promise<void> {
    this.isProcessing = true;

    const question = this.getCurrentQuestion();
    if (!question) {
      this.isProcessing = false;
      return;
    }

    // Validate if needed
    if (question.validation && typeof value === 'string') {
      const error = question.validation(value);
      if (error) {
        this.addMessage({ type: 'error', content: error });
        this.isProcessing = false;
        return;
      }
    }

    // Add user response to chat
    this.addMessage({ type: 'user', content: displayValue });

    // Store the data
    if (question.field) {
      this.intakeData[question.field] = value;
    } else if (question.id === 'greeting') {
      // Special case: greeting captures name
      this.intakeData.name = value as string;
    }

    // Clear input
    if (this.inputElement) {
      this.inputElement.value = '';
      this.inputElement.disabled = true;
    }

    // Move to next question
    this.currentQuestionIndex++;
    this.isProcessing = false;

    // Save progress after each answer
    this.saveProgress();

    await this.delay(300);
    await this.askCurrentQuestion();
  }

  private async submitIntake(): Promise<void> {
    this.isProcessing = true;

    if (this.inputElement) this.inputElement.disabled = true;
    if (this.sendButton) this.sendButton.disabled = true;

    await this.showTypingIndicator(1000);
    this.addMessage({
      type: 'ai',
      content: 'Excellent! I have all the information I need. Let me process your project request...'
    });

    await this.showTypingIndicator(1500);

    try {
      // Prepare data for API
      const submitData = {
        ...this.intakeData,
        features: Array.isArray(this.intakeData.features)
          ? this.intakeData.features
          : [this.intakeData.features].filter(Boolean),
        brandAssets: Array.isArray(this.intakeData.brandAssets)
          ? this.intakeData.brandAssets
          : [this.intakeData.brandAssets].filter(Boolean),
        submittedAt: new Date().toISOString()
      };

      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Clear saved progress after successful submission
      this.clearProgress();

      // Success message
      this.addMessage({
        type: 'success',
        content: `
PROJECT REQUEST SUBMITTED SUCCESSFULLY!

Project ID: ${result.data?.projectId || 'Pending'}
Client ID: ${result.data?.clientId || 'Pending'}

What happens next:
1. You'll receive a confirmation email shortly
2. I'll review your requirements within 24-48 hours
3. You'll get a detailed proposal and timeline
4. We'll schedule a call to discuss the details

Thank you for choosing No Bhad Codes!
        `.trim()
      });

      // Clear saved data
      localStorage.removeItem('terminalIntakeData');

      this.updateProgress(100);
    } catch (error) {
      console.error('[TerminalIntake] Submission error:', error);
      this.addMessage({
        type: 'error',
        content: 'Failed to submit your request. Please try again or contact hello@nobhadcodes.com'
      });

      // Re-enable input for retry
      if (this.inputElement) this.inputElement.disabled = false;
      if (this.sendButton) this.sendButton.disabled = false;
    }

    this.isProcessing = false;
  }

  private addMessage(message: ChatMessage): void {
    if (!this.chatContainer) return;

    this.messages.push(message);

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.type}`;

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.textContent = message.content;
    messageEl.appendChild(contentEl);

    // Add options if present
    if (message.options && message.options.length > 0) {
      const optionsEl = document.createElement('div');
      optionsEl.className = `chat-options${message.multiSelect ? ' multi-select' : ''}`;

      message.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'chat-option';
        btn.dataset.value = option.value;
        btn.dataset.index = String(index + 1);
        // Add number prefix for terminal look
        btn.textContent = `[${index + 1}] ${option.label}`;
        optionsEl.appendChild(btn);
      });

      messageEl.appendChild(optionsEl);

      // Add confirm button for multiselect
      if (message.multiSelect) {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'terminal-send confirm-btn';
        confirmBtn.style.marginTop = '12px';
        confirmBtn.style.marginLeft = '20px';
        confirmBtn.textContent = '> CONFIRM SELECTION';
        confirmBtn.addEventListener('click', () => this.handleUserInput());
        messageEl.appendChild(confirmBtn);
      }
    }

    this.chatContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  private async showTypingIndicator(duration: number): Promise<void> {
    if (!this.chatContainer) return;

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    this.chatContainer.appendChild(indicator);
    this.scrollToBottom();

    await this.delay(duration);

    indicator.remove();
  }

  private scrollToBottom(): void {
    if (this.chatContainer) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
  }

  private updateProgress(override?: number): void {
    const totalQuestions = QUESTIONS.filter((q) => !q.dependsOn || this.shouldShowQuestion(q)).length;
    const progress = override ?? Math.round((this.currentQuestionIndex / totalQuestions) * 100);

    if (this.progressFill) {
      this.progressFill.style.width = `${progress}%`;
    }
    if (this.progressPercent) {
      this.progressPercent.textContent = `${progress}%`;
    }
  }

  private shouldShowQuestion(question: IntakeQuestion): boolean {
    if (!question.dependsOn) return true;

    const dependentValue = this.intakeData[question.dependsOn.field];
    const requiredValue = question.dependsOn.value;

    if (Array.isArray(requiredValue)) {
      return requiredValue.includes(dependentValue as string);
    }
    return dependentValue === requiredValue;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const intakeContainer = document.querySelector('.terminal-intake-container') as HTMLElement;
  if (intakeContainer) {
    const module = new TerminalIntakeModule(intakeContainer);
    module.init().catch((error) => {
      console.error('[TerminalIntake] Failed to initialize:', error);
    });
  }
});
