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
