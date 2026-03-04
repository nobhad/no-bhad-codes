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
  CLIENTS_ME: '/api/clients/me',
  CLIENTS_ME_BILLING: '/api/clients/me/billing',
  PROJECTS: '/api/projects',
  INVOICES: '/api/invoices',
  MESSAGES: '/api/messages',
  CONTRACTS: '/api/contracts',
  CONTRACTS_BULK_DELETE: '/api/contracts/bulk-delete',
  PROPOSALS: '/api/proposals',
  QUESTIONNAIRES: '/api/questionnaires',
  QUESTIONNAIRES_BULK_DELETE: '/api/questionnaires/bulk-delete',
  QUESTIONNAIRES_MY_RESPONSES: '/api/questionnaires/my-responses',
  DOCUMENT_REQUESTS: '/api/document-requests',
  DOCUMENT_REQUESTS_BULK_DELETE: '/api/document-requests/bulk-delete',
  DOCUMENT_REQUESTS_MY: '/api/document-requests/my-requests',
  AD_HOC_REQUESTS: '/api/ad-hoc-requests',
  AD_HOC_REQUESTS_BULK_DELETE: '/api/ad-hoc-requests/bulk-delete',
  AD_HOC_REQUESTS_MY: '/api/ad-hoc-requests/my-requests',
  TRIGGERS: '/api/triggers',
  APPROVALS: '/api/approvals',
  APPROVALS_PENDING: '/api/approvals/pending',
  EMAIL_TEMPLATES: '/api/email-templates',
  KNOWLEDGE_BASE: '/api/kb',
  ANALYTICS: '/api/analytics',
  DELIVERABLES: '/api/v1/deliverables',
  FILES: '/api/uploads',
  FILES_CLIENT: '/api/uploads/client',
  FILES_MULTIPLE: '/api/uploads/multiple',
  RECEIPTS: '/api/receipts',

  // Client portal features
  CLIENT_INFO: '/api/client-info',
  INTAKE: '/api/intake',
  ONBOARDING: '/api/client-info/onboarding',
  ONBOARDING_SAVE: '/api/client-info/onboarding/save',
  ONBOARDING_COMPLETE: '/api/client-info/onboarding/complete',

  // Portal-specific
  PORTAL: {
    PROJECTS: '/api/portal/projects'
  },

  // Auth
  AUTH: '/api/auth',
  AUTH_PORTAL_LOGIN: '/api/auth/portal-login',

  // Admin-specific endpoints (require admin authentication)
  ADMIN: {
    // Dashboard & Overview
    DASHBOARD: '/api/admin/dashboard',
    SYSTEM_STATUS: '/api/admin/system-status',
    PERFORMANCE: '/api/admin/performance',

    // CRM
    LEADS: '/api/admin/leads',
    LEADS_BULK_STATUS: '/api/admin/leads/bulk/status',
    LEADS_BULK_DELETE: '/api/admin/leads/bulk/delete',
    CLIENTS: '/api/admin/clients',
    CONTACTS: '/api/admin/contacts',
    CONTACTS_BULK_DELETE: '/api/admin/contacts/bulk-delete',

    // Projects & Work
    PROJECTS: '/api/admin/projects',
    PROJECTS_BULK_DELETE: '/api/admin/projects/bulk/delete',
    TASKS: '/api/admin/tasks',
    TASKS_BULK_DELETE: '/api/admin/tasks/bulk-delete',
    DELIVERABLES: '/api/admin/deliverables',
    DELIVERABLES_BULK_DELETE: '/api/admin/deliverables/bulk-delete',

    // Proposals & Contracts
    PROPOSALS: '/api/admin/proposals',
    PROPOSALS_BULK_DELETE: '/api/admin/proposals/bulk-delete',

    // Time Tracking
    TIME_ENTRIES: '/api/admin/time-entries',
    TIME_ENTRIES_START: '/api/admin/time-entries/start',

    // Design Reviews
    DESIGN_REVIEWS: '/api/admin/design-reviews',

    // Messages
    MESSAGES: '/api/admin/messages',
    MESSAGES_CONVERSATIONS: '/api/admin/messages/conversations',

    // Document Management
    FILES: '/api/admin/files',
    DELETED_ITEMS: '/api/admin/deleted-items',
    DELETED_ITEMS_EMPTY: '/api/admin/deleted-items/empty',
    DELETED_ITEMS_BULK_RESTORE: '/api/admin/deleted-items/bulk-restore',
    DELETED_ITEMS_BULK_DELETE: '/api/admin/deleted-items/bulk-delete',

    // Workflows & Automation
    WORKFLOWS: '/api/admin/workflows',
    WORKFLOWS_BULK_STATUS: '/api/admin/workflows/bulk-status',
    WORKFLOWS_BULK_DELETE: '/api/admin/workflows/bulk-delete',

    // Analytics
    ANALYTICS: '/api/admin/analytics',
    AD_HOC_ANALYTICS: '/api/admin/ad-hoc-analytics',
    AD_HOC_ANALYTICS_QUERIES: '/api/admin/ad-hoc-analytics/queries',
    AD_HOC_ANALYTICS_RUN: '/api/admin/ad-hoc-analytics/run',

    // Email & Communication
    EMAIL_TEMPLATES: '/api/admin/email-templates',
    NOTIFICATIONS: '/api/admin/notifications',

    // Knowledge Base
    KB_CATEGORIES: '/api/kb/admin/categories',
    KB_ARTICLES: '/api/kb/admin/articles',
    KB_STATS: '/api/kb/admin/stats'
  },

  // Client contacts (nested under clients)
  CLIENT_CONTACTS: '/api/clients/contacts',

  // Notes
  NOTES: '/api/notes',

  // Milestones
  MILESTONES: '/api/milestones'
} as const;

/**
 * Helper function to build endpoint URLs with IDs
 */
export const buildEndpoint = {
  // Projects
  project: (id: number | string) => `${API_ENDPOINTS.PROJECTS}/${id}`,
  projectMilestones: (id: number | string) => `${API_ENDPOINTS.PROJECTS}/${id}/milestones`,
  projectUpdates: (id: number | string) => `${API_ENDPOINTS.PROJECTS}/${id}/updates`,
  projectUpload: (id: number | string) => `${API_ENDPOINTS.FILES}/project/${id}`,

  // Clients
  client: (id: number | string) => `${API_ENDPOINTS.CLIENTS}/${id}`,

  // Invoices
  invoice: (id: number | string) => `${API_ENDPOINTS.INVOICES}/${id}`,
  invoicePdf: (id: number | string) => `${API_ENDPOINTS.INVOICES}/${id}/pdf`,

  // Receipts
  receiptsByInvoice: (invoiceId: number | string) => `${API_ENDPOINTS.RECEIPTS}/invoice/${invoiceId}`,
  receiptPdf: (id: number | string) => `${API_ENDPOINTS.RECEIPTS}/${id}/pdf`,

  // Contracts
  contract: (id: number | string) => `${API_ENDPOINTS.CONTRACTS}/${id}`,
  contractSend: (id: number | string) => `${API_ENDPOINTS.CONTRACTS}/${id}/send`,

  // Proposals
  adminProposal: (id: number | string) => `${API_ENDPOINTS.ADMIN.PROPOSALS}/${id}`,
  adminProposalSend: (id: number | string) => `${API_ENDPOINTS.ADMIN.PROPOSALS}/${id}/send`,
  adminProposalDuplicate: (id: number | string) => `${API_ENDPOINTS.ADMIN.PROPOSALS}/${id}/duplicate`,

  // Contacts
  adminContact: (id: number | string) => `${API_ENDPOINTS.ADMIN.CONTACTS}/${id}`,

  // Tasks
  adminTask: (id: number | string) => `${API_ENDPOINTS.ADMIN.TASKS}/${id}`,

  // Deliverables
  adminDeliverable: (id: number | string) => `${API_ENDPOINTS.ADMIN.DELIVERABLES}/${id}`,

  // Time Entries
  adminTimeEntryStop: (id: number | string) => `${API_ENDPOINTS.ADMIN.TIME_ENTRIES}/${id}/stop`,

  // Files
  adminFile: (id: number | string) => `${API_ENDPOINTS.ADMIN.FILES}/${id}`,
  fileAction: (id: number | string, action: string) => `${API_ENDPOINTS.FILES}/${id}/${action}`,
  fileView: (id: number | string) => `${API_ENDPOINTS.FILES}/file/${id}`,
  fileDownload: (id: number | string) => `${API_ENDPOINTS.FILES}/file/${id}?download=true`,
  fileDelete: (id: number | string) => `${API_ENDPOINTS.FILES}/file/${id}`,

  // Deleted Items
  adminDeletedItemRestore: (id: number | string) => `${API_ENDPOINTS.ADMIN.DELETED_ITEMS}/${id}/restore`,
  adminDeletedItem: (id: number | string) => `${API_ENDPOINTS.ADMIN.DELETED_ITEMS}/${id}`,

  // Messages
  adminConversation: (id: number | string) => `${API_ENDPOINTS.ADMIN.MESSAGES_CONVERSATIONS}/${id}`,
  adminConversationRead: (id: number | string) => `${API_ENDPOINTS.ADMIN.MESSAGES_CONVERSATIONS}/${id}/read`,
  adminConversationStar: (id: number | string) => `${API_ENDPOINTS.ADMIN.MESSAGES_CONVERSATIONS}/${id}/star`,

  // Message Threads (Portal)
  messageThread: (id: number | string) => `${API_ENDPOINTS.MESSAGES}/threads/${id}`,
  messageThreadMessages: (id: number | string) => `${API_ENDPOINTS.MESSAGES}/threads/${id}/messages`,

  // Questionnaires
  questionnaire: (id: number | string) => `${API_ENDPOINTS.QUESTIONNAIRES}/${id}`,
  questionnaireSend: (id: number | string) => `${API_ENDPOINTS.QUESTIONNAIRES}/${id}/send`,
  questionnaireResponseSave: (id: number | string) => `${API_ENDPOINTS.QUESTIONNAIRES}/responses/${id}/save`,
  questionnaireResponseSubmit: (id: number | string) => `${API_ENDPOINTS.QUESTIONNAIRES}/responses/${id}/submit`,

  // Document Requests
  documentRequest: (id: number | string) => `${API_ENDPOINTS.DOCUMENT_REQUESTS}/${id}`,
  documentRequestUpload: (id: number | string) => `${API_ENDPOINTS.DOCUMENT_REQUESTS}/${id}/upload`,

  // Ad-Hoc Requests
  adHocRequest: (id: number | string) => `${API_ENDPOINTS.AD_HOC_REQUESTS}/${id}`,
  adHocRequestApprove: (id: number | string) => `${API_ENDPOINTS.AD_HOC_REQUESTS_MY}/${id}/approve`,
  adHocRequestDecline: (id: number | string) => `${API_ENDPOINTS.AD_HOC_REQUESTS_MY}/${id}/decline`,

  // Ad-Hoc Analytics
  adminAdHocQuery: (id: number | string) => `${API_ENDPOINTS.ADMIN.AD_HOC_ANALYTICS_QUERIES}/${id}`,

  // Approvals
  approvalRespond: (id: number | string) => `${API_ENDPOINTS.APPROVALS}/requests/${id}/respond`
} as const;

/**
 * Application routes for redirects and navigation
 * Use these instead of hardcoded paths
 *
 * Canonical routes:
 *   PORTAL.LOGIN     → /#/portal    (unified login hash page on main site)
 *   PORTAL.DASHBOARD → /dashboard   (role-based dashboard, reads JWT)
 *
 * ADMIN and CLIENT are aliases kept for backward compatibility.
 * All old /admin/login, /client/login, /admin, /client URLs redirect to the canonical routes.
 */
export const ROUTES = {
  PORTAL: {
    LOGIN: '/#/portal',
    DASHBOARD: '/dashboard'
  },
  ADMIN: {
    LOGIN: '/#/portal',
    DASHBOARD: '/dashboard'
  },
  CLIENT: {
    LOGIN: '/#/portal',
    PORTAL: '/dashboard'
  }
} as const;

export type ApiEndpoint = (typeof API_ENDPOINTS)[keyof typeof API_ENDPOINTS];
