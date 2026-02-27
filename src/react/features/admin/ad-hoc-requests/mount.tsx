import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AdHocRequestsTable } from './AdHocRequestsTable';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface AdHocRequestsMountOptions {
  clientId?: string;
  projectId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountAdHocRequestsTable(
  element: HTMLElement,
  options: AdHocRequestsMountOptions = {}
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
      <AdHocRequestsTable
        clientId={options.clientId}
        projectId={options.projectId}
        onNavigate={options.onNavigate}
      />
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

export function unmountAdHocRequestsTable(): void {
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
