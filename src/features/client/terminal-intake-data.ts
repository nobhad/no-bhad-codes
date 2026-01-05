/**
 * ===============================================
 * TERMINAL INTAKE - DATA DEFINITIONS
 * ===============================================
 * @file src/features/client/terminal-intake-data.ts
 *
 * Question definitions and option mappings for the terminal intake module.
 */

import type { IntakeQuestion } from './terminal-intake-types';

/**
 * Question flow definitions for the intake process
 */
export const QUESTIONS: IntakeQuestion[] = [
  // Basic Information
  {
    id: 'greeting',
    field: '',
    question:
      'Hello, I\'m Arrow - Noelle\'s personal assistant. I\'m here to help you start your project. Let\'s gather some information to create a custom proposal for you. First, what\'s your name?',
    type: 'text',
    required: true,
    placeholder: 'Enter your full name'
  },
  {
    id: 'email',
    field: 'email',
    question:
      'Nice to meet you, {{name}}! What\'s your email address so I can send you the project details?',
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
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10) {
        return `Please enter a valid phone number (you entered ${digits.length} digits, need 10)`;
      }
      if (digits.length === 11 && !digits.startsWith('1')) {
        return 'Please enter a valid US phone number (11 digits must start with 1)';
      }
      if (digits.length > 11) {
        return `Please enter a valid phone number (you entered ${digits.length} digits, max is 11)`;
      }
      if (digits.startsWith('555555') || digits.startsWith('1555555')) {
        return 'Please enter a real phone number (555-555-xxxx numbers are fictional)';
      }
      if (/^(\d)\1+$/.test(digits)) {
        return 'Please enter a real phone number';
      }
      if (digits === '1234567890' || digits === '0987654321' || digits === '12345678901') {
        return 'Please enter a real phone number';
      }
      return null;
    },
    placeholder: '(555) 123-4567'
  },
  // Project Overview
  {
    id: 'projectType',
    field: 'projectType',
    question:
      'Great! Now let\'s talk about your project. What type of project are you looking to build?',
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
    question:
      'Tell me more about your project. What are your goals and what do you want to achieve?',
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
    options: [] // Dynamically set based on projectType
  },
  // Features
  {
    id: 'features',
    field: 'features',
    question: 'What features do you need? Select all that apply:',
    type: 'multiselect',
    required: true,
    options: [] // Dynamically set based on projectType
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
    dependsOn: { field: 'hasCurrentSite', value: 'no' },
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

/**
 * Feature options by project type
 */
export const FEATURE_OPTIONS: Record<string, { value: string; label: string }[]> = {
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

/**
 * Get the total number of base (non-dependent) questions
 */
export function getBaseQuestionCount(): number {
  return QUESTIONS.filter((q) => !q.dependsOn).length;
}
