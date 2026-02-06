/**
 * ===============================================
 * ADMIN MODULES INDEX
 * ===============================================
 * @file src/features/admin/modules/index.ts
 *
 * Barrel file for admin dashboard modules.
 * Use dynamic imports for code splitting.
 */

// Re-export types
export * from '../admin-types';

// Dynamic module loaders for code splitting
export async function loadLeadsModule() {
  return import('./admin-leads');
}

export async function loadContactsModule() {
  return import('./admin-contacts');
}

export async function loadProjectsModule() {
  return import('./admin-projects');
}

export async function loadClientsModule() {
  return import('./admin-clients');
}

export async function loadMessagingModule() {
  return import('./admin-messaging');
}

export async function loadAnalyticsModule() {
  return import('./admin-analytics');
}

export async function loadOverviewModule() {
  return import('./admin-overview');
}

export async function loadPerformanceModule() {
  return import('./admin-performance');
}

export async function loadSystemStatusModule() {
  return import('./admin-system-status');
}

export async function loadProposalsModule() {
  return import('./admin-proposals');
}

export async function loadClientDetailsModule() {
  return import('./admin-client-details');
}

export async function loadTasksModule() {
  return import('./admin-tasks');
}

export async function loadTimeTrackingModule() {
  return import('./admin-time-tracking');
}

export async function loadFilesModule() {
  return import('./admin-files');
}

export async function loadKnowledgeBaseModule() {
  return import('./admin-knowledge-base');
}

export async function loadDocumentRequestsModule() {
  return import('./admin-document-requests');
}

export async function loadInvoicesModule() {
  return import('./admin-invoices');
}

export async function loadDeletedItemsModule() {
  return import('./admin-deleted-items');
}
