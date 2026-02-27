/**
 * ===============================================
 * ADMIN DOCUMENTS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-documents.ts
 *
 * Unified documents tab that manages all document subtabs:
 * - Invoices
 * - Contracts
 * - Document Requests
 * - Questionnaires
 *
 * Uses single container with internal card switching via events.
 * Pattern matches admin-knowledge-base.ts for consistency.
 */

import type { AdminDashboardContext } from '../admin-types';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('AdminDocuments');

// ---------------------------------------------------------------------------
// Section State
// ---------------------------------------------------------------------------

let currentDocumentsSection: 'invoices' | 'contracts' | 'document-requests' | 'questionnaires' = 'invoices';
let documentsSubtabListenerSetup = false;
let isLoading = false;
let hasRendered = false;

// ---------------------------------------------------------------------------
// Module Loading (lazy imports for code splitting)
// ---------------------------------------------------------------------------

async function loadInvoicesModule() {
  const module = await import('./admin-invoices');
  return module;
}

async function loadContractsModule() {
  const module = await import('./admin-contracts');
  return module;
}

async function loadDocumentRequestsModule() {
  const module = await import('./admin-document-requests');
  return module;
}

async function loadQuestionnairesModule() {
  const module = await import('./admin-questionnaires');
  return module;
}

// ---------------------------------------------------------------------------
// Section Display
// ---------------------------------------------------------------------------

/**
 * Show/hide cards based on selected section
 */
function applyDocumentsSection(section: 'invoices' | 'contracts' | 'document-requests' | 'questionnaires'): void {
  logger.log('applyDocumentsSection:', section);
  const invoicesCard = document.getElementById('documents-invoices-card');
  const contractsCard = document.getElementById('documents-contracts-card');
  const documentRequestsCard = document.getElementById('documents-document-requests-card');
  const questionnairesCard = document.getElementById('documents-questionnaires-card');

  // Remove active class from all cards (CSS handles display:none)
  invoicesCard?.classList.remove('active');
  contractsCard?.classList.remove('active');
  documentRequestsCard?.classList.remove('active');
  questionnairesCard?.classList.remove('active');

  // Also remove inline styles that might override CSS
  if (invoicesCard) invoicesCard.style.display = '';
  if (contractsCard) contractsCard.style.display = '';
  if (documentRequestsCard) documentRequestsCard.style.display = '';
  if (questionnairesCard) questionnairesCard.style.display = '';

  // Add active class to selected card (CSS handles display:flex with gap)
  switch (section) {
  case 'invoices':
    invoicesCard?.classList.add('active');
    break;
  case 'contracts':
    contractsCard?.classList.add('active');
    break;
  case 'document-requests':
    documentRequestsCard?.classList.add('active');
    break;
  case 'questionnaires':
    questionnairesCard?.classList.add('active');
    break;
  }
}

/**
 * Setup listener for subtab changes from header
 */
function setupDocumentsSubtabListener(): void {
  if (documentsSubtabListenerSetup) return;
  documentsSubtabListenerSetup = true;

  document.addEventListener('documentsSubtabChange', ((e: CustomEvent<{ subtab: string }>) => {
    const section = e.detail.subtab as 'invoices' | 'contracts' | 'document-requests' | 'questionnaires';
    logger.log('documentsSubtabChange received:', section);
    currentDocumentsSection = section;
    applyDocumentsSection(section);
  }) as EventListener);

  // Apply initial section state
  applyDocumentsSection(currentDocumentsSection);
}

// ============================================
// DYNAMIC TAB RENDERING
// ============================================

/**
 * Renders the Documents tab structure dynamically.
 * Called by admin-dashboard before loading data.
 */
export function renderDocumentsTab(container: HTMLElement): void {
  logger.log('renderDocumentsTab called, container:', container?.id || 'no-id', 'hasRendered:', hasRendered);

  // Skip if already rendered to prevent wiping content during double-calls
  if (hasRendered && container.querySelector('#documents-invoices-card')) {
    logger.log('Skipping render - already rendered');
    return;
  }

  hasRendered = true;
  container.innerHTML = `
    <div id="documents-invoices-card" class="documents-subtab-content active">
      <!-- Invoices content will be rendered here -->
    </div>
    <div id="documents-contracts-card" class="documents-subtab-content">
      <!-- Contracts content will be rendered here -->
    </div>
    <div id="documents-document-requests-card" class="documents-subtab-content">
      <!-- Document Requests content will be rendered here -->
    </div>
    <div id="documents-questionnaires-card" class="documents-subtab-content">
      <!-- Questionnaires content will be rendered here -->
    </div>
  `;

  // Reset listener flag so it gets re-attached
  documentsSubtabListenerSetup = false;
}

/**
 * Load all document subtab data
 */
export async function loadDocuments(ctx: AdminDashboardContext): Promise<void> {
  const tabContainer = document.getElementById('tab-documents');
  logger.log('loadDocuments called, isLoading:', isLoading,
    'container exists:', !!tabContainer,
    'has active class:', tabContainer?.classList.contains('active'));

  // Prevent double-loading
  if (isLoading) {
    logger.log('Skipping load - already loading');
    return;
  }

  isLoading = true;
  setupDocumentsSubtabListener();

  // Load all modules in parallel
  const [invoicesModule, contractsModule, drModule, questionnairesModule] = await Promise.all([
    loadInvoicesModule(),
    loadContractsModule(),
    loadDocumentRequestsModule(),
    loadQuestionnairesModule()
  ]);

  logger.log('All modules loaded');

  // Get card containers
  const invoicesCard = document.getElementById('documents-invoices-card');
  const contractsCard = document.getElementById('documents-contracts-card');
  const documentRequestsCard = document.getElementById('documents-document-requests-card');
  const questionnairesCard = document.getElementById('documents-questionnaires-card');

  logger.log('Card containers:', {
    invoices: !!invoicesCard,
    contracts: !!contractsCard,
    documentRequests: !!documentRequestsCard,
    questionnaires: !!questionnairesCard
  });

  // Render each module into its card container
  if (invoicesCard) {
    logger.log('Rendering invoices tab');
    invoicesModule.renderInvoicesTab(invoicesCard);
  }

  if (contractsCard) {
    contractsModule.renderContractsTab(contractsCard);
  }

  if (documentRequestsCard) {
    drModule.renderDocumentRequestsTab(documentRequestsCard);
  }

  if (questionnairesCard) {
    questionnairesModule.renderQuestionnairesTab(questionnairesCard);
  }

  // Load data for all modules in parallel
  await Promise.all([
    invoicesModule.loadInvoicesData(ctx),
    contractsModule.loadContracts(ctx),
    drModule.loadDocumentRequests(ctx),
    questionnairesModule.loadQuestionnairesModule(ctx)
  ]);

  // Apply initial section visibility
  applyDocumentsSection(currentDocumentsSection);

  isLoading = false;

  // Debug: Check final state
  const finalInvoicesCard = document.getElementById('documents-invoices-card');
  logger.log('loadDocuments complete', {
    invoicesCardExists: !!finalInvoicesCard,
    invoicesCardDisplay: finalInvoicesCard?.style.display,
    invoicesCardContent: finalInvoicesCard?.innerHTML.substring(0, 100)
  });
}
