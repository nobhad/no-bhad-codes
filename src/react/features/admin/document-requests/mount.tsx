import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DocumentRequestsTable } from './DocumentRequestsTable';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface DocumentRequestsMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountDocumentRequestsTable(
  element: HTMLElement,
  options: DocumentRequestsMountOptions = {}
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
      <DocumentRequestsTable onNavigate={options.onNavigate} />
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

export function unmountDocumentRequestsTable(): void {
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
