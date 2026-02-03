/**
 * ===============================================
 * CLIENT PORTAL MODULES INDEX
 * ===============================================
 * @file src/features/client/modules/index.ts
 *
 * Barrel file for client portal modules.
 * Use dynamic imports for code splitting.
 */

// Re-export types
export * from '../portal-types';

// Dynamic module loaders for code splitting
export async function loadFilesModule() {
  return import('./portal-files');
}

export async function loadInvoicesModule() {
  return import('./portal-invoices');
}

export async function loadMessagesModule() {
  return import('./portal-messages');
}

export async function loadSettingsModule() {
  return import('./portal-settings');
}

export async function loadNavigationModule() {
  return import('./portal-navigation');
}

export async function loadProjectsModule() {
  return import('./portal-projects');
}

export async function loadAuthModule() {
  return import('./portal-auth');
}

export async function loadHelpModule() {
  return import('./portal-help');
}

export async function loadDocumentRequestsModule() {
  return import('./portal-document-requests');
}
