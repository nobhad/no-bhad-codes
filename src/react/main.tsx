import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';
import { createLogger } from '../utils/logger';

const logger = createLogger('React');

// Store roots for cleanup during HMR
const mountedRoots = new Map<string, Root>();

/**
 * Mount a React component into a DOM element
 * Used for island architecture - mounting React components into existing pages
 *
 * @param element - The DOM element or selector to mount into
 * @param component - The React component to render
 * @returns Cleanup function to unmount the component
 */
export function mountReactApp(
  element: HTMLElement | string,
  component: React.ReactNode
): () => void {
  const container =
    typeof element === 'string' ? document.querySelector<HTMLElement>(element) : element;

  if (!container) {
    logger.error(`[React] Mount target not found: ${element}`);
    return () => {};
  }

  const mountId = container.id || `react-mount-${Date.now()}`;

  // Clean up existing root if present (HMR support)
  const existingRoot = mountedRoots.get(mountId);
  if (existingRoot) {
    existingRoot.unmount();
    mountedRoots.delete(mountId);
  }

  // Create and store new root
  const root = createRoot(container);
  mountedRoots.set(mountId, root);

  root.render(
    <StrictMode>
      <App>{component}</App>
    </StrictMode>
  );

  // Return cleanup function
  return () => {
    root.unmount();
    mountedRoots.delete(mountId);
  };
}

// Export for use in feature modules
export { App };
