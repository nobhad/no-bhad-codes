/**
 * ===============================================
 * PORTAL INDEX
 * ===============================================
 * @file src/features/portal/index.ts
 *
 * Exports for the portal infrastructure
 */

// Main shell controller
export {
  PortalShell,
  getPortalShell,
  destroyPortalShell
} from './PortalShell';

// Module loader
export { PortalModuleLoader } from './PortalModuleLoader';

// Re-export types from shared
export type { PortalContext } from '../shared/types';
