/**
 * ===============================================
 * MOUNT PORTAL APP
 * ===============================================
 * @file src/react/app/mount-portal.tsx
 *
 * Entry point for mounting the React Portal SPA.
 * Uses flushSync to ensure React paints in the same
 * frame as clearing the EJS content — zero visual flash.
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PortalApp } from './PortalApp';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MountPortal');

let root: Root | null = null;

/**
 * Mount the React Portal SPA into the given container.
 *
 * @param container - DOM element to mount into (typically .portal)
 * @returns Cleanup function to unmount
 */
export function mountPortalApp(container: HTMLElement): () => void {
  if (root) {
    logger.warn('Portal app already mounted, unmounting first');
    root.unmount();
  }

  // Clear the server-rendered portal shell before mounting React.
  // The React SPA renders its own header/sidebar/content structure; leaving the
  // EJS DOM in place can create nested `.dashboard-content` and duplicate IDs.
  container.innerHTML = '';
  container.classList.add('react-portal-mount');

  root = createRoot(container);

  // Synchronous render prevents flash between clearing EJS content
  // and React's first paint. The shell (sidebar, header) renders
  // immediately; lazy route content shows a loading spinner via Suspense.
  flushSync(() => {
    root!.render(
      <React.StrictMode>
        <PortalApp />
      </React.StrictMode>
    );
  });

  logger.info('Portal React SPA mounted');

  return () => {
    if (root) {
      root.unmount();
      root = null;
      logger.info('Portal React SPA unmounted');
    }
    container.classList.remove('react-portal-mount');
  };
}

/**
 * Unmount the React Portal SPA.
 */
export function unmountPortalApp(): void {
  if (root) {
    root.unmount();
    root = null;
  }
}
