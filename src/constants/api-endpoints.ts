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
 *   fetch(`${API_ENDPOINTS.CLIENTS}/${clientId}`)
 *   fetch(`${API_ENDPOINTS.ADMIN.LEADS}/${leadId}`)
 */

export const API_ENDPOINTS = {
  // Core entity endpoints
  CLIENTS: '/api/clients',
  PROJECTS: '/api/projects',
  INVOICES: '/api/invoices',
  MESSAGES: '/api/messages',
  CONTRACTS: '/api/contracts',
  PROPOSALS: '/api/proposals',
  QUESTIONNAIRES: '/api/questionnaires',
  DOCUMENT_REQUESTS: '/api/document-requests',
  AD_HOC_REQUESTS: '/api/ad-hoc-requests',
  TRIGGERS: '/api/triggers',
  APPROVALS: '/api/approvals',
  EMAIL_TEMPLATES: '/api/email-templates',
  KNOWLEDGE_BASE: '/api/kb',
  ANALYTICS: '/api/analytics',
  DELIVERABLES: '/api/v1/deliverables',
  FILES: '/api/uploads',

  // Client portal features
  CLIENT_INFO: '/api/client-info',
  INTAKE: '/api/intake',
  ONBOARDING: '/api/client-info/onboarding',

  // Auth
  AUTH: '/api/auth',

  // Admin-specific endpoints (require admin authentication)
  ADMIN: {
    LEADS: '/api/admin/leads',
    LEADS_BULK_STATUS: '/api/admin/leads/bulk/status',
    LEADS_BULK_DELETE: '/api/admin/leads/bulk/delete',
    PROJECTS: '/api/admin/projects',
    PROJECTS_BULK_DELETE: '/api/admin/projects/bulk/delete',
    CONTACTS: '/api/admin/contacts',
    TASKS: '/api/admin/tasks',
    TASKS_BULK_DELETE: '/api/admin/tasks/bulk-delete',
    WORKFLOWS: '/api/admin/workflows',
    WORKFLOWS_BULK_STATUS: '/api/admin/workflows/bulk-status',
    WORKFLOWS_BULK_DELETE: '/api/admin/workflows/bulk-delete',
    NOTIFICATIONS: '/api/admin/notifications',
    ANALYTICS: '/api/admin/analytics',
    DELIVERABLES: '/api/admin/deliverables',
    DELETED_ITEMS: '/api/admin/deleted-items',
    FILES: '/api/admin/files',
    CLIENTS: '/api/admin/clients'
  },

  // Client contacts (nested under clients)
  CLIENT_CONTACTS: '/api/clients/contacts'
} as const;

/**
 * Application routes for redirects and navigation
 * Use these instead of hardcoded paths
 */
export const ROUTES = {
  ADMIN: {
    LOGIN: '/admin',
    DASHBOARD: '/admin/login'
  },
  CLIENT: {
    LOGIN: '/client/login.html',
    PORTAL: '/client/portal.html'
  }
} as const;

export type ApiEndpoint = (typeof API_ENDPOINTS)[keyof typeof API_ENDPOINTS];
