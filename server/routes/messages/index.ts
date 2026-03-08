/**
 * ===============================================
 * MESSAGE ROUTES INDEX
 * ===============================================
 * @file server/routes/messages/index.ts
 *
 * Re-exports from message sub-modules.
 */

// Export sub-routers
export { coreRouter } from './core.js';
export { quickRouter } from './quick.js';
export { enhancedRouter } from './enhanced.js';
export { adminRouter } from './admin.js';

// Export shared helpers
export {
  MESSAGE_THREAD_COLUMNS,
  MESSAGE_COLUMNS,
  NOTIFICATION_PREF_COLUMNS,
  canAccessMessage,
  canAccessProject,
  upload
} from './helpers.js';

// Export main messages router
export { default as messagesRouter } from '../messages.js';
