/**
 * ===============================================
 * CONFIGURATION INDEX
 * ===============================================
 * @file server/config/index.ts
 *
 * Central exports for all configuration modules.
 *
 * Usage:
 *   import { environment, businessConfig } from '../config/index.js';
 */

// Environment configuration (validated env vars)
export { default as environment, validateConfig, getConfigSummary } from './environment.js';
export type { AppConfig } from './environment.js';

// Business configuration (company info, branding)
export { default as businessConfig } from './business.js';

// Upload configuration (file handling settings)
export {
  getUploadsDir,
  getUploadsSubdir,
  getRelativePath,
  UPLOAD_DIRS,
  sanitizeFilename
} from './uploads.js';

// Default project templates
export { DEFAULT_MILESTONES } from './default-milestones.js';
export { DEFAULT_TASKS } from './default-tasks.js';

// Navigation configuration
export { getPortalConfig, PORTAL_CONFIGS, ICONS, ADMIN_TAB_IDS } from './navigation.js';
export type { NavItem, SubtabGroup, PortalConfig } from './navigation.js';

// Swagger/API documentation configuration
export { default as setupSwagger, specs as swaggerSpecs } from './swagger.js';
