/**
 * ===============================================
 * CENTRALIZED API ENDPOINT CONSTANTS
 * ===============================================
 * @file src/constants/api-endpoints.ts
 *
 * All API base paths should be defined here for consistency.
 * Use pattern: API_ENDPOINTS.FEATURE_NAME (without _BASE suffix)
 *
 * Usage:
 *   import { API_ENDPOINTS } from '../../../constants/api-endpoints';
 *   fetch(`${API_ENDPOINTS.LEADS}/${leadId}`)
 */

export const API_ENDPOINTS = {
  // Admin features
  LEADS: '/api/leads',
  CONTACTS: '/api/contacts',
  CLIENTS: '/api/clients',
  PROJECTS: '/api/projects',
  INVOICES: '/api/invoices',
  TASKS: '/api/tasks',
  MESSAGES: '/api/messages',
  CONTRACTS: '/api/contracts',
  PROPOSALS: '/api/proposals',
  QUESTIONNAIRES: '/api/questionnaires',
  DOCUMENT_REQUESTS: '/api/document-requests',
  AD_HOC_REQUESTS: '/api/ad-hoc-requests',
  WORKFLOWS: '/api/workflows',
  TRIGGERS: '/api/triggers',
  APPROVALS: '/api/approvals',
  EMAIL_TEMPLATES: '/api/email-templates',
  KNOWLEDGE_BASE: '/api/kb',
  ANALYTICS: '/api/analytics',
  SYSTEM: '/api/system',
  DELIVERABLES: '/api/v1/deliverables',
  FILES: '/api/uploads',

  // Client portal features
  CLIENT_INFO: '/api/client-info',
  INTAKE: '/api/intake',
  ONBOARDING: '/api/onboarding',
  NOTIFICATIONS: '/api/notifications',

  // Auth
  AUTH: '/api/auth'
} as const;

export type ApiEndpoint = (typeof API_ENDPOINTS)[keyof typeof API_ENDPOINTS];
