/**
 * ===============================================
 * TERMINAL INTAKE MODULE
 * ===============================================
 * @file src/features/client/terminal-intake.ts
 *
 * AI Chat-style intake form that collects project information
 * through a conversational terminal interface.
 */

import { gsap } from 'gsap';

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
  questionIndex?: number; // Track which question this message belongs to
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
    id: 'email',
    field: 'email',
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
    validation: (value) => {
      // Remove all non-digit characters for validation
      const digits = value.replace(/\D/g, '');
      // Valid phone numbers should have 10-15 digits
      if (digits.length < 10) {
        return `Please enter a valid phone number (you entered ${digits.length} digits, need at least 10)`;
      }
      if (digits.length > 15) {
        return `Please enter a valid phone number (you entered ${digits.length} digits, max is 15)`;
      }
      return null;
    },
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
    id: 'customFeatures',
    field: 'customFeatures',
    question: 'Please describe the custom features you need:',
    type: 'text',
    required: true,
    dependsOn: { field: 'features', value: 'custom' },
    placeholder: 'Describe your custom feature requirements...'
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
    id: 'hasDomain',
    field: 'hasDomain',
    question: 'Do you have a domain name for this project?',
    type: 'select',
    required: true,
    options: [
      { value: 'yes', label: 'Yes, I have a domain' },
      { value: 'no', label: 'No, I need help getting one' },
      { value: 'unsure', label: 'Not sure / Need advice' }
    ]
  },
  {
    id: 'domainName',
    field: 'domainName',
    question: 'What\'s your domain name?',
    type: 'text',
    required: true,
    dependsOn: { field: 'hasDomain', value: 'yes' },
    placeholder: 'example.com'
  },
  {
    id: 'hosting',
    field: 'hosting',
    question: 'What are your hosting preferences?',
    type: 'select',
    required: true,
    options: [
      { value: 'have-hosting', label: 'I already have hosting' },
      { value: 'need-hosting', label: 'I need hosting set up' },
      { value: 'need-recommendation', label: 'I need a recommendation' },
      { value: 'unsure', label: 'Not sure what I need' }
    ]
  },
  {
    id: 'hostingProvider',
    field: 'hostingProvider',
    question: 'Who is your current hosting provider?',
    type: 'text',
    required: true,
    dependsOn: { field: 'hosting', value: 'have-hosting' },
    placeholder: 'e.g., GoDaddy, Bluehost, AWS, etc.'
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

    // Flag to prevent double handling
    let handled = false;

    // Declare handler references for cleanup
    let handleResumeClick: ((e: Event) => Promise<void>) | null = null;
    let handleResumeKeydown: ((e: KeyboardEvent) => Promise<void>) | null = null;

    const processChoice = async (choice: 'resume' | 'restart', displayText: string) => {
      if (handled) return;
      handled = true;

      // Remove listeners
      if (handleResumeClick) {
        this.chatContainer?.removeEventListener('click', handleResumeClick, true);
      }
      if (handleResumeKeydown) {
        document.removeEventListener('keydown', handleResumeKeydown);
      }

      this.addMessage({ type: 'user', content: displayText });
      if (this.inputElement) this.inputElement.value = '';

      if (choice === 'resume') {
        // Restore progress
        this.currentQuestionIndex = savedProgress.currentQuestionIndex;
        this.intakeData = savedProgress.intakeData;
        this.updateProgress();

        await this.delay(300);
        await this.addBootMessage('  ✓ Progress restored');
        await this.delay(200);

        // Show previous conversation history
        await this.showPreviousConversation(savedProgress.currentQuestionIndex);

        await this.delay(300);
        await this.askCurrentQuestion();
      } else {
        // Start fresh - clear the chat first
        this.clearProgress();
        this.currentQuestionIndex = 0;
        this.intakeData = {};
        this.messages = [];

        // Clear the chat container
        if (this.chatContainer) {
          this.chatContainer.innerHTML = '';
        }

        // Start fresh with full boot sequence
        await this.startConversation();
      }
    };

    // Handle click on options
    handleResumeClick = async (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('chat-option')) {
        e.stopPropagation();
        const choice = target.dataset.value as 'resume' | 'restart';
        const displayText = target.textContent || choice || '';
        await processChoice(choice, displayText);
      }
    };

    // Handle keyboard input (1 or 2) - immediate response, no Enter needed
    handleResumeKeydown = async (e: KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        e.stopPropagation();
        await processChoice('resume', '[1] Resume where I left off');
      } else if (e.key === '2') {
        e.preventDefault();
        e.stopPropagation();
        await processChoice('restart', '[2] Start over');
      }
    };

    this.chatContainer?.addEventListener('click', handleResumeClick, true);

    // Listen on document for keyboard input (in case input doesn't have focus)
    document.addEventListener('keydown', handleResumeKeydown);

    if (this.inputElement) {
      this.inputElement.disabled = false;
      this.inputElement.placeholder = 'Click or type 1 or 2...';
      this.inputElement.focus();
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

    // Generate login timestamp
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const date = now.getDate();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const loginTime = `Last login: ${dayName} ${monthName} ${date} ${hours}:${minutes}:${seconds} on ttys001`;

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
          <div class="terminal-chat" id="terminalChat">
            <div class="terminal-login-info">${loginTime}<br><span class="terminal-prompt-line">client@NoBhadCodes project-intake % </span><span class="terminal-typing-text" id="terminalTypingText"></span><span class="terminal-cursor" id="terminalCursor">█</span></div>
          </div>
          <div class="terminal-input-area">
            <span class="terminal-prompt">></span>
            <input type="text" class="terminal-input" id="terminalInput" placeholder="Click or type your response..." autocomplete="off">
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

    // Enter key to send (on input)
    this.inputElement?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserInput();
      }
    });

    // Enter key on document for multiselect confirmation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Check if we're in a modal that's closed (skip if so)
        const modal = document.getElementById('intakeModal');
        const isModalClosed = modal && !modal.classList.contains('open');
        if (isModalClosed) return;

        // Skip if processing
        if (this.isProcessing) return;

        const question = this.getCurrentQuestion();
        if (question?.type === 'multiselect' && this.selectedOptions.length > 0) {
          e.preventDefault();
          this.handleUserInput();
        }
      }
    });

    // Number keys for immediate select/multiselect option selection (1-9)
    // Use document listener so it works even without input focus
    document.addEventListener('keydown', (e) => {
      // Skip if processing
      if (this.isProcessing) return;

      // Skip if user is typing in the input field (has text or is focused with non-number key intent)
      // Only allow number shortcuts when input is empty or not focused
      if (this.inputElement) {
        const inputHasText = this.inputElement.value.trim().length > 0;
        const inputIsFocused = document.activeElement === this.inputElement;

        // If input has text, don't intercept number keys - let user type
        if (inputHasText) return;

        // If input is focused but question is text-based, don't intercept
        const question = this.getCurrentQuestion();
        if (inputIsFocused && question) {
          const textTypes = ['text', 'email', 'tel', 'url', 'textarea'];
          if (textTypes.includes(question.type)) return;
        }
      }

      // Only handle if the modal is open and this terminal is active
      const modal = document.getElementById('intakeModal');
      if (modal && !modal.classList.contains('open')) return;

      const question = this.getCurrentQuestion();
      // Only handle for select/multiselect questions with options
      if (!question || !question.options) return;
      if (question.type !== 'select' && question.type !== 'multiselect') return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= question.options.length) {
        e.preventDefault();
        const option = question.options[num - 1];

        if (question.type === 'select') {
          // Single select - submit immediately
          this.processAnswer(option.value, option.label);
        } else {
          // Multiselect - toggle the option
          const optionBtn = this.chatContainer?.querySelector(`.chat-option[data-value="${option.value}"]`) as HTMLElement;
          if (optionBtn) {
            optionBtn.classList.toggle('selected');
            if (optionBtn.classList.contains('selected')) {
              if (!this.selectedOptions.includes(option.value)) {
                this.selectedOptions.push(option.value);
              }
            } else {
              this.selectedOptions = this.selectedOptions.filter((v) => v !== option.value);
            }
          }
        }
      }
    });

    // Arrow key navigation to go back to previous questions
    // Up arrow = go back one question
    document.addEventListener('keydown', (e) => {
      // Skip if processing
      if (this.isProcessing) return;

      // Only handle if the modal is open and this terminal is active
      const modal = document.getElementById('intakeModal');
      if (modal && !modal.classList.contains('open')) return;

      // Only respond to up arrow key
      if (e.key !== 'ArrowUp') return;

      // Don't navigate if user is typing in the input
      if (document.activeElement === this.inputElement && this.inputElement?.value) return;

      // Only allow going back if we have answered at least one question
      if (this.currentQuestionIndex > 0) {
        e.preventDefault();
        this.goBackToQuestion(this.currentQuestionIndex - 1);
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
    // Type "./project_intake.sh" command with GSAP
    await this.typeCommand('./project_intake.sh');
    await this.delay(400);

    // Show avatar first
    await this.showAvatarIntro();
    await this.delay(300);

    // Terminal boot sequence
    await this.addBootMessage('Bootstrapping...');
    await this.delay(300);

    await this.addBootMessage('  ✓ Loading intake module');
    await this.delay(200);

    await this.addBootMessage('  ✓ Initializing question flow');
    await this.delay(200);

    await this.addBootMessage('  ✓ Ready to collect project details');
    await this.delay(400);

    // Empty line before starting conversation
    await this.addBootMessage('');
    await this.delay(300);

    // If we have existing client data, pre-fill and handle company confirmation
    if (this.clientData) {
      await this.handleExistingClientData();
    } else {
      await this.askCurrentQuestion();
    }
  }

  /**
   * Display the avatar SVG full-width before the first message
   */
  private async showAvatarIntro(): Promise<void> {
    if (!this.chatContainer) return;

    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'terminal-avatar-intro';
    avatarContainer.innerHTML = `
      <div class="terminal-avatar-wrapper">
        <img src="/images/avatar.svg" alt="No Bhad Codes" class="terminal-avatar-img" />
      </div>
    `;

    // Start invisible
    avatarContainer.style.opacity = '0';
    this.chatContainer.appendChild(avatarContainer);
    this.scrollToBottom();

    // Fade in with GSAP
    gsap.to(avatarContainer, {
      opacity: 1,
      duration: 0.5,
      ease: 'power2.out'
    });

    await this.delay(500);
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
      this.inputElement.placeholder = 'Click or type 1 or 2...';
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
      this.inputElement.placeholder = 'Click or type 1 or 2...';
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
      this.inputElement.placeholder = 'Click or type company name...';
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
        const expectedValue = question.dependsOn.value;

        // Handle array values (from multiselect fields)
        let matches = false;
        if (Array.isArray(depValue)) {
          // Check if any of the selected values match the expected value
          matches = Array.isArray(expectedValue)
            ? expectedValue.some(v => depValue.includes(v))
            : depValue.includes(expectedValue);
        } else {
          // Simple string comparison
          matches = depValue === expectedValue;
        }

        if (!matches) {
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

  /**
   * Show previous conversation history when resuming
   */
  private async showPreviousConversation(upToIndex: number): Promise<void> {
    this.addMessage({
      type: 'system',
      content: '--- Previous answers ---'
    });

    await this.delay(100);

    // Go through each question up to the current index
    for (let i = 0; i < upToIndex; i++) {
      const question = QUESTIONS[i];

      // Check if this question was applicable (check dependencies)
      if (question.dependsOn) {
        const dependencyField = question.dependsOn.field;
        const dependencyValue = this.intakeData[dependencyField];
        const requiredValue = question.dependsOn.value;

        const matches = Array.isArray(requiredValue)
          ? requiredValue.includes(dependencyValue as string)
          : dependencyValue === requiredValue;

        if (!matches) continue; // Skip this question - dependency not met
      }

      // Get the answer for this question
      const answer = question.field ? this.intakeData[question.field] : undefined;
      if (answer === undefined) continue; // Skip if no answer

      // Show the question (without typing animation for speed)
      this.addMessage({
        type: 'ai',
        content: question.question,
        questionIndex: i
      });

      // Format the answer for display
      let displayAnswer: string;
      if (Array.isArray(answer)) {
        displayAnswer = answer.join(', ');
      } else {
        displayAnswer = String(answer);
      }

      // Show the user's answer
      this.addMessage({
        type: 'user',
        content: displayAnswer,
        questionIndex: i
      });
    }

    this.addMessage({
      type: 'system',
      content: '--- Continuing ---'
    });

    await this.delay(100);
  }

  private getCurrentQuestion(): IntakeQuestion | null {
    while (this.currentQuestionIndex < QUESTIONS.length) {
      const question = QUESTIONS[this.currentQuestionIndex];

      // Check if question depends on another field
      if (question.dependsOn) {
        const dependentValue = this.intakeData[question.dependsOn.field];
        const requiredValue = question.dependsOn.value;

        // Handle array values (from multiselect fields)
        let matches = false;
        if (Array.isArray(dependentValue)) {
          // dependentValue is an array (e.g., features selected)
          matches = Array.isArray(requiredValue)
            ? requiredValue.some(v => dependentValue.includes(v))
            : dependentValue.includes(requiredValue);
        } else if (Array.isArray(requiredValue)) {
          // requiredValue is an array, dependentValue is string
          matches = requiredValue.includes(dependentValue as string);
        } else {
          // Both are strings
          matches = dependentValue === requiredValue;
        }

        if (!matches) {
          this.currentQuestionIndex++;
          continue;
        }
      }

      return question;
    }

    return null;
  }

  private async askCurrentQuestion(): Promise<void> {
    const question = this.getCurrentQuestion();

    if (!question) {
      // All questions answered - show review before submitting
      await this.showReviewAndConfirm();
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

    // Add the AI message with questionIndex for clickable navigation
    const message: ChatMessage = {
      type: 'ai',
      content: questionText,
      questionIndex: this.currentQuestionIndex
    };

    if (question.type === 'select' && question.options) {
      message.options = question.options;
    } else if (question.type === 'multiselect' && question.options) {
      message.options = question.options;
      message.multiSelect = true;
    }

    await this.addMessageWithTyping(message);

    // Update input placeholder
    if (this.inputElement) {
      this.inputElement.placeholder = question.placeholder || 'Click or type your response...';
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
      // Sanitize text input to prevent XSS
      value = this.sanitizeInput(inputValue);
      displayValue = this.sanitizeInput(inputValue);
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

    // Add user response to chat (with questionIndex for clickable navigation)
    this.addMessage({ type: 'user', content: displayValue, questionIndex: this.currentQuestionIndex });

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

  /**
   * Format a field value for display in the review
   */
  private formatFieldForReview(field: string, value: string | string[] | undefined): string {
    if (!value) return 'Not provided';
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None selected';
    }
    return value;
  }

  /**
   * Generate a summary of all answers for review
   */
  private generateReviewSummary(): string {
    const data = this.intakeData;

    const sections = [
      '--- PROJECT SUMMARY ---',
      '',
      '[CONTACT]',
      `Name: ${this.formatFieldForReview('name', data.name as string)}`,
      `Email: ${this.formatFieldForReview('email', data.email as string)}`,
      `Company: ${this.formatFieldForReview('company', data.company as string)}`,
      `Phone: ${this.formatFieldForReview('phone', data.phone as string)}`,
      '',
      '[PROJECT]',
      `Type: ${this.formatFieldForReview('projectType', data.projectType as string)}`,
      `Description: ${this.formatFieldForReview('projectDescription', data.projectDescription as string)}`,
      `Timeline: ${this.formatFieldForReview('timeline', data.timeline as string)}`,
      `Budget: ${this.formatFieldForReview('budget', data.budget as string)}`,
      '',
      '[FEATURES]',
      `Features: ${this.formatFieldForReview('features', data.features as string[])}`
    ];

    if (data.customFeatures) {
      sections.push(`Custom: ${data.customFeatures}`);
    }

    sections.push(`Integrations: ${data.hasIntegrations === 'yes' ? this.formatFieldForReview('integrations', data.integrations as string[]) : 'None'}`);

    sections.push(
      '',
      '[DESIGN]',
      `Level: ${this.formatFieldForReview('designLevel', data.designLevel as string)}`,
      `Assets: ${this.formatFieldForReview('brandAssets', data.brandAssets as string[])}`
    );

    if (data.inspiration) {
      sections.push(`Inspiration: ${data.inspiration}`);
    }

    sections.push(
      '',
      '[TECHNICAL]',
      `Comfort: ${this.formatFieldForReview('techComfort', data.techComfort as string)}`,
      `Site: ${data.hasCurrentSite === 'yes' ? data.currentSite : 'None'}`,
      `Domain: ${data.hasDomain === 'yes' ? data.domainName : (data.hasDomain === 'no' ? 'Need' : 'Advice')}`,
      `Hosting: ${this.formatFieldForReview('hosting', data.hosting as string)}`
    );

    if (data.hostingProvider) {
      sections.push(`Provider: ${data.hostingProvider}`);
    }

    sections.push(
      '',
      '[OTHER]',
      `Concerns: ${this.formatFieldForReview('challenges', data.challenges as string[])}`
    );

    if (data.additionalInfo) {
      sections.push(`Notes: ${data.additionalInfo}`);
    }

    if (data.referralName) {
      sections.push(`Referral: ${data.referralName}`);
    }

    sections.push(
      '',
      '--- END SUMMARY ---'
    );

    return sections.join('\n');
  }

  /**
   * Show review and ask for confirmation before submitting
   */
  private async showReviewAndConfirm(): Promise<void> {
    await this.showTypingIndicator(800);

    this.addMessage({
      type: 'ai',
      content: 'Great! Here\'s a summary of your project request. Please review:'
    });

    await this.delay(500);

    // Show the review summary
    this.addMessage({
      type: 'system',
      content: this.generateReviewSummary()
    });

    await this.delay(300);

    // Add instructions for making changes
    this.addMessage({
      type: 'system',
      content: 'To make changes, scroll up and click on any answer to edit it, or select "Start over" below.'
    });

    await this.delay(200);

    // Ask for confirmation
    this.addMessage({
      type: 'ai',
      content: 'Does everything look correct?',
      options: [
        { value: 'yes', label: 'Yes, submit my request' },
        { value: 'no', label: 'Start over' }
      ]
    });

    // Wait for confirmation
    await this.waitForReviewConfirmation();
  }

  /**
   * Wait for user to confirm or reject the review
   */
  private async waitForReviewConfirmation(): Promise<void> {
    return new Promise((resolve) => {
      // Declare handlers with let to avoid no-use-before-define
      let handleConfirmClick: ((e: Event) => Promise<void>) | null = null;
      let handleConfirmKeydown: ((e: KeyboardEvent) => Promise<void>) | null = null;

      handleConfirmKeydown = async (e: KeyboardEvent) => {
        if (e.key === '1') {
          e.preventDefault();
          if (handleConfirmClick) {
            this.chatContainer?.removeEventListener('click', handleConfirmClick, true);
          }
          if (handleConfirmKeydown) {
            document.removeEventListener('keydown', handleConfirmKeydown);
          }
          this.addMessage({ type: 'user', content: '[1] Yes, submit my request' });
          await this.submitIntake();
          resolve();
        } else if (e.key === '2') {
          e.preventDefault();
          if (handleConfirmClick) {
            this.chatContainer?.removeEventListener('click', handleConfirmClick, true);
          }
          if (handleConfirmKeydown) {
            document.removeEventListener('keydown', handleConfirmKeydown);
          }
          this.addMessage({ type: 'user', content: '[2] No, I need to make changes' });
          this.addMessage({
            type: 'ai',
            content: 'No problem! To make changes, please start over with a fresh form. Your progress has been saved if you\'d like to continue later.',
            options: [
              { value: 'restart', label: 'Start Over' },
              { value: 'submit', label: 'Actually, submit as is' }
            ]
          });
          await this.waitForChangeDecision();
          resolve();
        }
      };

      handleConfirmClick = async (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('chat-option')) {
          e.stopPropagation();
          const choice = target.dataset.value;
          const displayText = target.textContent || '';

          if (handleConfirmClick) {
            this.chatContainer?.removeEventListener('click', handleConfirmClick, true);
          }
          if (handleConfirmKeydown) {
            document.removeEventListener('keydown', handleConfirmKeydown);
          }

          this.addMessage({ type: 'user', content: displayText });

          if (choice === 'yes') {
            await this.submitIntake();
          } else {
            // Let them know how to make changes
            this.addMessage({
              type: 'ai',
              content: 'No problem! To make changes, please start over with a fresh form. Your progress has been saved if you\'d like to continue later.',
              options: [
                { value: 'restart', label: 'Start Over' },
                { value: 'submit', label: 'Actually, submit as is' }
              ]
            });
            await this.waitForChangeDecision();
          }
          resolve();
        }
      };

      this.chatContainer?.addEventListener('click', handleConfirmClick, true);
      document.addEventListener('keydown', handleConfirmKeydown);

      if (this.inputElement) {
        this.inputElement.disabled = false;
        this.inputElement.placeholder = 'Click or type 1 or 2...';
        this.inputElement.focus();
      }
    });
  }

  /**
   * Wait for user decision after they said they want changes
   */
  private async waitForChangeDecision(): Promise<void> {
    return new Promise((resolve) => {
      // Declare handlers with let to avoid no-use-before-define
      let handleClick: ((e: Event) => Promise<void>) | null = null;
      let handleKeydown: ((e: KeyboardEvent) => Promise<void>) | null = null;

      handleKeydown = async (e: KeyboardEvent) => {
        if (e.key === '1') {
          e.preventDefault();
          if (handleClick) {
            this.chatContainer?.removeEventListener('click', handleClick, true);
          }
          if (handleKeydown) {
            document.removeEventListener('keydown', handleKeydown);
          }
          this.addMessage({ type: 'user', content: '[1] Start Over' });
          this.clearProgress();
          this.currentQuestionIndex = 0;
          this.intakeData = {};
          this.messages = [];
          if (this.chatContainer) {
            this.chatContainer.innerHTML = '';
          }
          await this.startConversation();
          resolve();
        } else if (e.key === '2') {
          e.preventDefault();
          if (handleClick) {
            this.chatContainer?.removeEventListener('click', handleClick, true);
          }
          if (handleKeydown) {
            document.removeEventListener('keydown', handleKeydown);
          }
          this.addMessage({ type: 'user', content: '[2] Actually, submit as is' });
          await this.submitIntake();
          resolve();
        }
      };

      handleClick = async (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('chat-option')) {
          e.stopPropagation();
          const choice = target.dataset.value;
          const displayText = target.textContent || '';

          if (handleClick) {
            this.chatContainer?.removeEventListener('click', handleClick, true);
          }
          if (handleKeydown) {
            document.removeEventListener('keydown', handleKeydown);
          }

          this.addMessage({ type: 'user', content: displayText });

          if (choice === 'restart') {
            // Clear and restart
            this.clearProgress();
            this.currentQuestionIndex = 0;
            this.intakeData = {};
            this.messages = [];
            if (this.chatContainer) {
              this.chatContainer.innerHTML = '';
            }
            await this.startConversation();
          } else {
            await this.submitIntake();
          }
          resolve();
        }
      };

      this.chatContainer?.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeydown);

      if (this.inputElement) {
        this.inputElement.disabled = false;
        this.inputElement.placeholder = 'Click or type 1 or 2...';
        this.inputElement.focus();
      }
    });
  }

  private async submitIntake(): Promise<void> {
    this.isProcessing = true;

    if (this.inputElement) this.inputElement.disabled = true;
    if (this.sendButton) this.sendButton.disabled = true;

    await this.showTypingIndicator(1000);
    this.addMessage({
      type: 'ai',
      content: 'Processing your project request...'
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

      console.log('[TerminalIntake] Submitting data:', submitData);

      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TerminalIntake] Server error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Parse response (not currently displayed but may be used in future)
      await response.json();

      // Clear saved progress after successful submission
      this.clearProgress();

      this.addMessage({
        type: 'success',
        content: `
PROJECT REQUEST SUBMITTED SUCCESSFULLY!

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
        content: 'Failed to submit your request. Please try again or contact nobhaduri@gmail.com'
      });

      // Re-enable input for retry
      if (this.inputElement) this.inputElement.disabled = false;
      if (this.sendButton) this.sendButton.disabled = false;
    }

    this.isProcessing = false;
  }

  /**
   * Go back to a previous question to edit the answer
   * This resets ALL progress from that point forward
   */
  private async goBackToQuestion(questionIndex: number): Promise<void> {
    if (this.isProcessing) return;

    // Find the question at the given index
    if (questionIndex >= QUESTIONS.length || questionIndex < 0) return;

    this.isProcessing = true;

    // Get the old answer to pre-fill for text inputs (before we clear data)
    const question = QUESTIONS[questionIndex];
    // Handle special case: greeting question stores name but has empty field property
    let oldAnswer: string | string[] | undefined;
    if (question.id === 'greeting') {
      oldAnswer = this.intakeData.name as string;
    } else if (question.field) {
      oldAnswer = this.intakeData[question.field];
    }

    // Clear the data for this question and ALL subsequent questions
    for (let i = questionIndex; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i];
      if (q.field && this.intakeData[q.field]) {
        delete this.intakeData[q.field];
      }
    }
    // Also clear the special 'name' field if resetting to greeting
    if (questionIndex === 0 && this.intakeData.name) {
      delete this.intakeData.name;
    }

    // Remove ALL chat messages from the clicked question onwards (in DOM)
    // Be more aggressive - track by position, not just by index
    if (this.chatContainer) {
      const allMessages = Array.from(this.chatContainer.querySelectorAll('.chat-message'));
      let startRemoving = false;

      for (const msg of allMessages) {
        const msgIndex = msg.getAttribute('data-question-index');
        if (msgIndex !== null && parseInt(msgIndex, 10) >= questionIndex) {
          startRemoving = true;
        }
        if (startRemoving) {
          msg.remove();
        }
      }

      // Also remove any typing indicators or other elements that came after
      const typingIndicators = this.chatContainer.querySelectorAll('.typing-indicator');
      typingIndicators.forEach(el => el.remove());
    }

    // Filter messages array to only keep messages before this question
    this.messages = this.messages.filter((msg) => {
      if (msg.questionIndex === undefined) return true; // Keep system messages without question index
      return msg.questionIndex < questionIndex;
    });

    // Clear selected options for multiselect questions
    this.selectedOptions = [];

    // Set the question index to go back to that question
    this.currentQuestionIndex = questionIndex;

    // Save the updated progress
    this.saveProgress();

    // Update progress bar to reflect the reset
    this.updateProgress();

    // Add a visual indicator that we're resetting
    this.addMessage({
      type: 'system',
      content: '--- Editing previous answer ---'
    });

    this.isProcessing = false;

    await this.delay(300);
    await this.askCurrentQuestion();

    // Pre-fill the input with old answer for text-based questions
    // This lets users just hit Enter to confirm the same value
    if (oldAnswer && this.inputElement && typeof oldAnswer === 'string') {
      const textTypes = ['text', 'email', 'tel', 'url', 'textarea'];
      if (textTypes.includes(question.type)) {
        // Small delay to ensure input is ready after askCurrentQuestion
        await this.delay(50);
        this.inputElement.value = oldAnswer;
        this.inputElement.focus();
        // Move cursor to end of text
        this.inputElement.setSelectionRange(oldAnswer.length, oldAnswer.length);
      }
    }
  }

  /**
   * Sanitize user input to prevent XSS
   */
  private sanitizeInput(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  private addMessage(message: ChatMessage): void {
    if (!this.chatContainer) return;

    this.messages.push(message);

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.type}`;

    // Make AI questions and user answers clickable to go back
    if (message.questionIndex !== undefined && (message.type === 'ai' || message.type === 'user')) {
      messageEl.classList.add('clickable-message');
      messageEl.dataset.questionIndex = String(message.questionIndex);
      messageEl.title = 'Click to edit this answer';
      messageEl.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling to option click handler
        this.goBackToQuestion(message.questionIndex!);
      });
    }

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';

    // For AI messages, we'll type them out - but set content immediately for now
    // The typing animation happens in addMessageWithTyping
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

  /**
   * Add an AI message with typing animation
   */
  private async addMessageWithTyping(message: ChatMessage): Promise<void> {
    if (!this.chatContainer) return;

    this.messages.push(message);

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.type}`;

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.textContent = ''; // Start empty
    messageEl.appendChild(contentEl);

    this.chatContainer.appendChild(messageEl);
    this.scrollToBottom();

    // Type out the content character by character
    const text = message.content;
    for (let i = 0; i < text.length; i++) {
      contentEl.textContent += text[i];
      this.scrollToBottom();
      await this.delay(15 + Math.random() * 10); // Fast typing speed
    }

    // Add options if present (after typing completes)
    if (message.options && message.options.length > 0) {
      const optionsEl = document.createElement('div');
      optionsEl.className = `chat-options${message.multiSelect ? ' multi-select' : ''}`;

      message.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'chat-option';
        btn.dataset.value = option.value;
        btn.dataset.index = String(index + 1);
        btn.textContent = `[${index + 1}] ${option.label}`;
        optionsEl.appendChild(btn);
      });

      messageEl.appendChild(optionsEl);

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
    // Simple calculation: use total base questions (non-dependent)
    // This gives a stable denominator
    const totalBaseQuestions = QUESTIONS.filter((q) => !q.dependsOn).length;

    // Calculate progress based on answered questions vs total base questions
    // Cap at 95% until form is submitted
    const answeredCount = Object.keys(this.intakeData).length;
    const progress = override ?? Math.min(Math.round((answeredCount / totalBaseQuestions) * 100), 95);

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

    // Handle array values (from multiselect fields)
    if (Array.isArray(dependentValue)) {
      // dependentValue is an array (e.g., features selected)
      return Array.isArray(requiredValue)
        ? requiredValue.some(v => dependentValue.includes(v))
        : dependentValue.includes(requiredValue);
    } else if (Array.isArray(requiredValue)) {
      // requiredValue is an array, dependentValue is string
      return requiredValue.includes(dependentValue as string);
    }
    // Both are strings
    return dependentValue === requiredValue;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Type out a command character by character using GSAP
   */
  private async typeCommand(text: string): Promise<void> {
    const typingText = document.getElementById('terminalTypingText');
    const cursor = document.getElementById('terminalCursor');

    if (!typingText || !cursor) return;

    // Make cursor blink
    gsap.to(cursor, {
      opacity: 0,
      duration: 0.5,
      repeat: -1,
      yoyo: true,
      ease: 'steps(1)'
    });

    // Type each character
    for (let i = 0; i < text.length; i++) {
      typingText.textContent += text[i];
      await this.delay(50 + Math.random() * 30); // Random delay for natural feel
    }

    // Stop cursor blinking and hide it
    gsap.killTweensOf(cursor);
    cursor.style.opacity = '0';
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
