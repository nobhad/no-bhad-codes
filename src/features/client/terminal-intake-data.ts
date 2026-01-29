/**
 * ===============================================
 * TERMINAL INTAKE - DATA DEFINITIONS
 * ===============================================
 * @file src/features/client/terminal-intake-data.ts
 *
 * Streamlined question definitions for the intake process.
 * Reduced from 41 to ~10 questions for a faster user experience.
 */

import type { IntakeQuestion } from './terminal-intake-types';

/**
 * Question flow definitions for the intake process
 * Streamlined to essential information only
 */
export const QUESTIONS: IntakeQuestion[] = [
  // Phase 1: Contact (2 questions)
  {
    id: 'greeting',
    field: '',
    question:
      'Hello, I\'m Arrow - Noelle\'s personal assistant. I\'m here to help you start your project. This will only take a few minutes. First, what\'s your name?',
    type: 'text',
    required: true,
    placeholder: 'Enter your full name'
  },
  {
    id: 'email',
    field: 'email',
    question:
      'Nice to meet you, {{name}}! What\'s your email address?',
    type: 'email',
    required: true,
    validation: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value) ? null : 'Please enter a valid email address';
    },
    placeholder: 'your@email.com'
  },
  {
    id: 'projectFor',
    field: 'projectFor',
    question: 'Is this project for a business or personal use?',
    type: 'select',
    required: true,
    options: [
      { value: 'business', label: 'Business / Company' },
      { value: 'personal', label: 'Personal Project' }
    ]
  },
  {
    id: 'companyName',
    field: 'companyName',
    question: 'What\'s the name of your business or company?',
    type: 'text',
    required: true,
    dependsOn: {
      field: 'projectFor',
      value: 'business'
    },
    placeholder: 'Enter company name'
  },

  // Phase 2: Project Basics (3 questions)
  {
    id: 'projectType',
    field: 'projectType',
    question:
      'Great! What type of project are you looking to build?',
    type: 'select',
    required: true,
    options: [
      { value: 'simple-site', label: 'Simple Site (landing page, link page, 1-2 pages)' },
      { value: 'business-site', label: 'Business Website (multi-page site)' },
      { value: 'portfolio', label: 'Portfolio Website' },
      { value: 'e-commerce', label: 'E-commerce Store' },
      { value: 'web-app', label: 'Web Application' },
      { value: 'browser-extension', label: 'Browser Extension' },
      { value: 'other', label: 'Other' }
    ]
  },
  {
    id: 'projectDescription',
    field: 'projectDescription',
    question:
      'Tell me about your project. What are you trying to achieve?',
    type: 'textarea',
    required: true,
    placeholder: 'Describe your project goals, target audience, and vision...'
  },
  {
    id: 'timeline',
    field: 'timeline',
    question: 'What\'s your ideal timeline?',
    type: 'select',
    required: true,
    options: [
      { value: 'asap', label: 'ASAP (Rush job)' },
      { value: '1-month', label: 'Within 1 month' },
      { value: '1-3-months', label: '1-3 months' },
      { value: '3-6-months', label: '3-6 months' },
      { value: 'flexible', label: 'Flexible / No rush' }
    ]
  },

  // Phase 3: Technical Quick-Check (2 questions)
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
    id: 'domainHosting',
    field: 'domainHosting',
    question: 'Do you have a domain name and/or hosting set up?',
    type: 'select',
    required: true,
    options: [
      { value: 'both', label: 'Yes, I have both' },
      { value: 'domain-only', label: 'Domain only (no hosting)' },
      { value: 'hosting-only', label: 'Hosting only (no domain)' },
      { value: 'neither', label: 'Neither - need both' },
      { value: 'unsure', label: 'I\'m not sure' }
    ]
  },

  // Phase 4: Features & Design (2 questions)
  {
    id: 'features',
    field: 'features',
    question: 'What key features do you need? Select all that apply:',
    type: 'multiselect',
    required: true,
    options: [] // Dynamically set based on projectType
  },
  {
    id: 'designLevel',
    field: 'designLevel',
    question: 'What level of design service do you need?',
    type: 'select',
    required: true,
    options: [
      { value: 'full-design', label: 'Full Design (I need everything designed)' },
      { value: 'partial-design', label: 'Design Guidance (I have some ideas)' },
      { value: 'have-designs', label: 'I Have Designs (just need development)' }
    ]
  },

  // Phase 5: Budget & Wrap-up (2 questions)
  {
    id: 'budget',
    field: 'budget',
    question: 'What\'s your budget range for this project?',
    type: 'select',
    required: true,
    options: [] // Dynamically set based on projectType
  },
  {
    id: 'additionalInfo',
    field: 'additionalInfo',
    question: 'Last question! Any additional details, questions, or concerns? Feel free to share your current website URL or any sites you like the look/feel of. (optional)',
    type: 'textarea',
    required: false,
    placeholder: 'Current site URL, inspiration sites, or any other details...'
  }
];

/**
 * Budget options by project type
 */
export const BUDGET_OPTIONS: Record<string, { value: string; label: string }[]> = {
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
  'e-commerce': [
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

/**
 * Simplified feature options by project type
 */
export const FEATURE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  'simple-site': [
    { value: 'contact-form', label: 'Contact Form' },
    { value: 'social-links', label: 'Social Media Links' },
    { value: 'analytics', label: 'Analytics Tracking' },
    { value: 'mobile-optimized', label: 'Mobile Optimization' },
    { value: 'age-verification', label: 'Age Verification Page' },
    { value: 'basic-only', label: 'Basic Static Content Only' }
  ],
  'business-site': [
    { value: 'contact-form', label: 'Contact Form' },
    { value: 'blog', label: 'Blog/News Section' },
    { value: 'gallery', label: 'Photo Gallery' },
    { value: 'testimonials', label: 'Customer Testimonials' },
    { value: 'booking', label: 'Appointment Booking' },
    { value: 'cms', label: 'Content Management System' },
    { value: 'age-verification', label: 'Age Verification Page' }
  ],
  portfolio: [
    { value: 'portfolio-gallery', label: 'Project Gallery' },
    { value: 'case-studies', label: 'Case Studies' },
    { value: 'resume-download', label: 'Resume/CV Download' },
    { value: 'contact-form', label: 'Contact Form' },
    { value: 'blog', label: 'Blog/Articles' }
  ],
  'e-commerce': [
    { value: 'shopping-cart', label: 'Shopping Cart' },
    { value: 'payment-processing', label: 'Payment Processing' },
    { value: 'inventory-management', label: 'Inventory Management' },
    { value: 'user-accounts', label: 'User Accounts/Login' },
    { value: 'admin-dashboard', label: 'Admin Dashboard' },
    { value: 'age-verification', label: 'Age Verification Page' }
  ],
  'web-app': [
    { value: 'user-authentication', label: 'User Authentication' },
    { value: 'database-integration', label: 'Database Integration' },
    { value: 'api-integration', label: 'Third-party API Integration' },
    { value: 'user-dashboard', label: 'User Dashboard' },
    { value: 'admin-panel', label: 'Admin Panel' },
    { value: 'age-verification', label: 'Age Verification Page' }
  ],
  'browser-extension': [
    { value: 'popup-interface', label: 'Popup Interface' },
    { value: 'content-modification', label: 'Page Content Modification' },
    { value: 'background-processing', label: 'Background Processing' },
    { value: 'data-storage', label: 'Data Storage' },
    { value: 'cross-browser', label: 'Cross-browser Compatibility' }
  ],
  other: [
    { value: 'contact-form', label: 'Contact Form' },
    { value: 'user-authentication', label: 'User Authentication' },
    { value: 'database-integration', label: 'Database Integration' },
    { value: 'api-integration', label: 'API Integration' },
    { value: 'admin-panel', label: 'Admin Panel' },
    { value: 'age-verification', label: 'Age Verification Page' }
  ]
};

/**
 * Get the total number of base (non-dependent) questions
 */
export function getBaseQuestionCount(): number {
  return QUESTIONS.filter((q) => !q.dependsOn).length;
}
