/**
 * React Client Portal Entry Point
 * This file is loaded as a separate entry point to avoid preamble detection issues
 * It registers React components for use by vanilla TypeScript code
 */

// Import pre-generated Tailwind CSS for React components
import './styles/tailwind-generated.css';
// Note: Button styles (tw-btn-*) are now in portal-buttons.css (base portal styles)

import { registerReactComponent } from './registry';
import { createLogger } from '../utils/logger';

const logger = createLogger('PortalEntry');

// Import all portal modules
import { mountPortalInvoices, unmountPortalInvoices } from './features/portal/invoices';
import { mountPortalFiles, unmountPortalFiles } from './features/portal/files';
import { mountPortalProjects, unmountPortalProjects } from './features/portal/projects';
import { mountPortalMessages, unmountPortalMessages } from './features/portal/messages';
import { mountPortalQuestionnaires, unmountPortalQuestionnaires } from './features/portal/questionnaires';
import { mountPortalDocumentRequests, unmountPortalDocumentRequests } from './features/portal/document-requests';
import { mountPortalApprovals, unmountPortalApprovals } from './features/portal/approvals';
import { mountPortalSettings, unmountPortalSettings } from './features/portal/settings';
import { mountPortalAdHocRequests, unmountPortalAdHocRequests } from './features/portal/ad-hoc-requests';
import { mountPortalNavigation, unmountPortalNavigation } from './features/portal/navigation';
import { mountOnboardingWizard, unmountOnboardingWizard } from './features/portal/onboarding';
import { mountPortalDashboard, unmountPortalDashboard } from './features/portal/dashboard/mount';
import { mountPortalProjectDetail, unmountPortalProjectDetail } from './features/portal/projects';
import { mountPortalProposals, unmountPortalProposals } from './features/portal/proposals';
import { mountPortalContracts, unmountPortalContracts } from './features/portal/contracts';
import { mountPortalDeliverables, unmountPortalDeliverables } from './features/portal/deliverables';

// Register all portal components
registerReactComponent('portalInvoices', {
  mount: mountPortalInvoices,
  unmount: unmountPortalInvoices
});

registerReactComponent('portalFiles', {
  mount: mountPortalFiles,
  unmount: unmountPortalFiles
});

registerReactComponent('portalProjects', {
  mount: mountPortalProjects,
  unmount: unmountPortalProjects
});

registerReactComponent('portalMessages', {
  mount: mountPortalMessages,
  unmount: unmountPortalMessages
});

registerReactComponent('portalQuestionnaires', {
  mount: mountPortalQuestionnaires,
  unmount: unmountPortalQuestionnaires
});

registerReactComponent('portalDocumentRequests', {
  mount: mountPortalDocumentRequests,
  unmount: unmountPortalDocumentRequests
});

registerReactComponent('portalApprovals', {
  mount: mountPortalApprovals,
  unmount: unmountPortalApprovals
});

registerReactComponent('portalSettings', {
  mount: mountPortalSettings,
  unmount: unmountPortalSettings
});

registerReactComponent('portalAdHocRequests', {
  mount: mountPortalAdHocRequests,
  unmount: unmountPortalAdHocRequests
});

registerReactComponent('portalNavigation', {
  mount: mountPortalNavigation,
  unmount: unmountPortalNavigation
});

registerReactComponent('portalOnboarding', {
  mount: mountOnboardingWizard,
  unmount: unmountOnboardingWizard
});

// Components mounted directly by ReactModuleLoader (not via tab-content containers)
// These are registered here for consistency but may also be mounted via
// direct import in the vanilla TS portal code.
registerReactComponent('portalDashboard', {
  mount: mountPortalDashboard,
  unmount: unmountPortalDashboard
});

registerReactComponent('portalProjectDetail', {
  mount: mountPortalProjectDetail,
  unmount: unmountPortalProjectDetail
});

registerReactComponent('portalProposals', {
  mount: mountPortalProposals,
  unmount: unmountPortalProposals
});

registerReactComponent('portalContracts', {
  mount: mountPortalContracts,
  unmount: unmountPortalContracts
});

registerReactComponent('portalDeliverables', {
  mount: mountPortalDeliverables,
  unmount: unmountPortalDeliverables
});

logger.info('Portal components registered (16 modules)');
