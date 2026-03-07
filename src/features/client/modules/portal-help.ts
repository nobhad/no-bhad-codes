/**
 * ===============================================
 * PORTAL HELP MODULE (DEPRECATED)
 * ===============================================
 * @file src/features/client/modules/portal-help.ts
 *
 * @deprecated All help/knowledge-base rendering is now handled by the
 * React portalHelp component via portal-navigation.ts tab routing.
 * This file is retained as a stub to avoid breaking the barrel
 * export in index.ts (loadHelpModule).
 */

import type { ClientPortalContext } from '../portal-types';

/**
 * Load help - no-op, React component handles rendering
 */
export async function loadHelp(_ctx: ClientPortalContext): Promise<void> {
  // React component handles its own rendering via TAB_TO_REACT_MODULE
}
