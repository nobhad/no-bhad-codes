import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DeliverablesTable } from './DeliverablesTable';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface DeliverablesMountOptions {
  projectId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountDeliverablesTable(
  element: HTMLElement,
  options: DeliverablesMountOptions = {}
): () => void {
  if (root) {
    root.unmount();
    root = null;
  }

  mountedContainer = element;
  element.innerHTML = '';

  // Add brutalist styling class
  element.classList.add('react-portal-mount');

  root = createRoot(element);
  root.render(
    <React.StrictMode>
      <DeliverablesTable projectId={options.projectId} onNavigate={options.onNavigate} />
    </React.StrictMode>
  );

  return () => {
    if (root) {
      root.unmount();
      root = null;
    }
    if (mountedContainer) {
      mountedContainer.innerHTML = '';
      mountedContainer = null;
    }
  };
}

export function unmountDeliverablesTable(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.classList.remove('react-portal-mount');
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
