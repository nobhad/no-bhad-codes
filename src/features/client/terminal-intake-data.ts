/**
 * ===============================================
 * TERMINAL INTAKE - DATA DEFINITIONS
 * ===============================================
 * @file src/features/client/terminal-intake-data.ts
 *
 * Lean lead-capture question definitions for the intake process.
 * 6 questions only — detailed discovery is deferred to a separate follow-up.
 */

import type { IntakeQuestion } from './terminal-intake-types';

/**
 * Question flow definitions for the intake process
 * Streamlined to essential information only
 */
export const QUESTIONS: IntakeQuestion[] = [
  // Phase 1: Contact
  {
    id: 'greeting',
    field: '',
    question:
      'Hello, I\'m Arrow - Noelle\'s personal assistant. I\'m here to help you start your project. This will only take a few minutes. First, what\'s your name?',
    type: 'text',
    required: true,
    validation: (value) =>
      value.trim().length >= 2 ? null : 'Please enter your name (at least 2 characters).',
    placeholder: 'Enter your full name'
  },
  {
    id: 'email',
    field: 'email',
    question: 'Nice to meet you, {{name}}! What\'s your email address?',
    type: 'email',
    required: true,
    validation: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value) ? null : 'Please enter a valid email address';
    },
    placeholder: 'your@email.com'
  },

  // Phase 2: Project Basics
  {
    id: 'projectType',
    field: 'projectType',
    question: 'Great! What type of project are you looking to build?',
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
    question: 'Tell me about your project. What are you trying to achieve?',
    type: 'textarea',
    required: true,
    validation: (value) =>
      value.trim().length >= 10
        ? null
        : 'Please add a little more detail (at least 10 characters).',
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

  // Phase 3: Budget
  {
    id: 'budget',
    field: 'budget',
    question: 'What\'s your budget range for this project?',
    type: 'select',
    required: true,
    options: [
      { value: 'under-1k', label: 'Under $1,000' },
      { value: '1k-3k', label: '$1,000 – $3,000' },
      { value: '3k-5k', label: '$3,000 – $5,000' },
      { value: '5k-10k', label: '$5,000 – $10,000' },
      { value: '10k-plus', label: '$10,000+' },
      { value: 'discuss', label: 'Let\'s discuss / not sure yet' }
    ]
  }
];

/**
 * Get the total number of base (non-dependent) questions
 */
export function getBaseQuestionCount(): number {
  return QUESTIONS.filter((q) => !q.dependsOn).length;
}
