/**
 * ===============================================
 * PORTAL INTAKE LOADER
 * ===============================================
 * @file src/features/client/portal-intake-loader.ts
 *
 * Handles lazy-loading the TerminalIntakeModule when
 * the "New Project" tab is activated in the client portal.
 *
 * Migrated from inline <script> in templates/pages/client-portal.ejs
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalIntakeLoader');

// --- Constants ---

const DEMO_TOKEN_PREFIX = 'demo_token_';
const CLIENT_AUTH_TOKEN_KEY = 'client_auth_token';
const CLIENT_EMAIL_KEY = 'clientEmail';
const DEFAULT_CLIENT_NAME = 'Client';

// --- DOM Element IDs ---

const ELEMENT_IDS = {
  NEW_PROJECT_BTN: 'btn-new-project',
  CLIENT_NAME: 'client-name',
  SETTINGS_NAME: 'settings-name',
  SETTINGS_EMAIL: 'settings-email',
  SETTINGS_COMPANY: 'settings-company'
} as const;

const INTAKE_CONTAINER_SELECTOR = '#tab-new-project .terminal-intake-container';

// --- Types ---

interface ClientData {
  name?: string;
  email?: string;
  company?: string;
}

// --- Helpers ---

/**
 * Extract client data from the logged-in session for intake pre-fill.
 * Returns undefined if in demo mode or no meaningful client data found.
 */
function getClientDataForIntake(): ClientData | undefined {
  const token = localStorage.getItem(CLIENT_AUTH_TOKEN_KEY);

  // Demo mode tokens should not pre-fill
  if (!token || token.startsWith(DEMO_TOKEN_PREFIX)) {
    return undefined;
  }

  const clientNameEl = document.getElementById(ELEMENT_IDS.CLIENT_NAME);
  const settingsNameEl = document.getElementById(ELEMENT_IDS.SETTINGS_NAME) as HTMLInputElement | null;
  const settingsEmailEl = document.getElementById(ELEMENT_IDS.SETTINGS_EMAIL) as HTMLInputElement | null;
  const settingsCompanyEl = document.getElementById(ELEMENT_IDS.SETTINGS_COMPANY) as HTMLInputElement | null;

  const clientData: ClientData = {
    name: settingsNameEl?.value || clientNameEl?.textContent || undefined,
    email: settingsEmailEl?.value || localStorage.getItem(CLIENT_EMAIL_KEY) || undefined,
    company: settingsCompanyEl?.value || undefined
  };

  // Only return if we have meaningful client data
  const hasClientData = clientData.name && clientData.name !== DEFAULT_CLIENT_NAME;
  return hasClientData ? clientData : undefined;
}

/**
 * Lazy-load and initialize the TerminalIntakeModule into the given container.
 */
async function loadAndInitIntake(container: HTMLElement): Promise<void> {
  try {
    const module = await import('./terminal-intake');
    const clientData = getClientDataForIntake();

    const intake = new module.TerminalIntakeModule(container, {
      isModal: false,
      clientData
    });
    intake.init();
    logger.debug('TerminalIntakeModule initialized');
  } catch (err) {
    logger.error('Failed to load TerminalIntakeModule', err);
  }
}

// --- Public Entry Point ---

/**
 * Initialize the portal intake lazy-loader.
 * Call this on DOMContentLoaded from the client portal page.
 *
 * Loads the TerminalIntakeModule on "New Project" button click,
 * or immediately if the new-project tab is already active.
 */
export function initPortalIntakeLoader(): void {
  const newProjectBtn = document.getElementById(ELEMENT_IDS.NEW_PROJECT_BTN);
  const intakeContainer = document.querySelector<HTMLElement>(INTAKE_CONTAINER_SELECTOR);
  let intakeInitialized = false;

  // Initialize when tab is clicked
  newProjectBtn?.addEventListener('click', () => {
    if (!intakeInitialized && intakeContainer) {
      intakeInitialized = true;
      loadAndInitIntake(intakeContainer);
    }
  });

  // Also initialize if tab is already active on page load
  if (intakeContainer?.closest('.tab-content.active')) {
    intakeInitialized = true;
    loadAndInitIntake(intakeContainer);
  }
}
