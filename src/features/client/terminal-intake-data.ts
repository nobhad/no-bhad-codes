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
 * Arrow's introduction. Rendered beside her portrait above the boot output
 * rather than as the first question, so she says hello where she appears and
 * the first prompt is just the question.
 */
export const ARROW_INTRO =
  "Hello, I'm Arrow - Noelle's personal assistant. I'm here to help you start your project. This will only take a few minutes.";

/**
 * Question flow definitions for the intake process
 * Streamlined to essential information only
 */
export const QUESTIONS: IntakeQuestion[] = [
  // Phase 1: Contact
  {
    id: 'greeting',
    field: '',
    question: "First, what's your name?",
    type: 'text',
    required: true,
    validation: (value) =>
      value.trim().length >= 2 ? null : 'Please enter your name (at least 2 characters).',
    placeholder: 'Enter your full name'
  },
  {
    id: 'email',
    field: 'email',
    question: "Nice to meet you, {{name}}! What's your email address?",
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
  // Phase 2b: Scope — what the work actually covers, and what already exists.
  {
    id: 'projectScope',
    field: 'projectScope',
    question: 'Do you need design as well as development, or is the design already handled?',
    type: 'select',
    required: true,
    options: [
      { value: 'design-and-build', label: 'Design and development — start from scratch' },
      { value: 'build-only', label: 'Development only — I have designs ready' },
      { value: 'not-sure', label: "Not sure yet — let's discuss" }
    ]
  },
  {
    id: 'brandAssets',
    field: 'brandAssets',
    question: 'Do you have your own assets — logo, brand colours, images?',
    type: 'select',
    required: true,
    options: [
      { value: 'have-all', label: 'Yes — logo, colours and images are ready' },
      { value: 'have-some', label: 'Some of it — a logo or a few colours' },
      { value: 'none', label: 'None yet — I need help creating them' }
    ]
  },

  {
    id: 'timeline',
    field: 'timeline',
    question: "What's your ideal timeline?",
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
  // Budget is asked twice over, on the same field, because design changes the
  // floor: a build against designs that already exist starts a long way below
  // one that includes the design work. resolveCurrentQuestion picks whichever
  // dependency is met, so exactly one of these is ever asked, and changing the
  // scope answer re-asks it (see findFirstDependentQuestionIndex).
  {
    id: 'budget',
    field: 'budget',
    question: "What's your budget range for this project?",
    type: 'select',
    required: true,
    dependsOn: { field: 'projectScope', value: ['build-only', 'not-sure'] },
    options: [
      { value: 'under-1k', label: 'Under $1,000' },
      { value: '1k-3k', label: '$1,000 – $3,000' },
      { value: '3k-5k', label: '$3,000 – $5,000' },
      { value: '5k-10k', label: '$5,000 – $10,000' },
      { value: '10k-plus', label: '$10,000+' },
      { value: 'discuss', label: "Let's discuss / not sure yet" }
    ]
  },
  {
    id: 'budgetDesignBuild',
    field: 'budget',
    question: "What's your budget range for design and development?",
    type: 'select',
    required: true,
    dependsOn: { field: 'projectScope', value: 'design-and-build' },
    options: [
      { value: '2k-5k', label: '$2,000 – $5,000' },
      { value: '5k-10k', label: '$5,000 – $10,000' },
      { value: '10k-plus', label: '$10,000+' },
      { value: 'discuss', label: "Let's discuss / not sure yet" }
    ]
  }
];

/**
 * Get the total number of base (non-dependent) questions
 */
export function getBaseQuestionCount(): number {
  // One answer per FIELD, not per question. Questions that are variants of each
  // other — the two budget bands — share a field and only one is ever asked, so
  // counting questions overstates the denominator and the bar runs slow.
  const fields = new Set(QUESTIONS.map((q) => q.field || q.id));
  return fields.size;
}
